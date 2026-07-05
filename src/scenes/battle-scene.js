// バトルシーン（フロントビュー・ターン制）。
// field-scene が S.createBattleScene(state, enemyPool) で push する。
// 戦闘終了は S.popScene() でフィールドへ戻る（replace ではない）。
//
// ⚠️ バンドルスコープの鉄則：単一 index.html では全 src が 1 スコープを共有するため
//    トップレベルの const/let は同名衝突で構文エラー（黒画面）になる。
//    → このファイルはトップレベルを「関数宣言のみ」にし、データ(ENEMIES/SKILLS/ITEMS)は
//      遅延解決する。シーン内部の const/let は関数スコープなので衝突しない。

// ── データ遅延解決（node=require / browser=window.SRPG） ──────────────
function _bsEnemies() {
  if (typeof require !== 'undefined') return require('../data/enemies.js').ENEMIES;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.ENEMIES) || {};
}

// なかまモンスター（スカウト）ロジックの遅延解決。
//   enemyToCharacter / canScout / scoutChance / addToRoster を直接トップレベル参照せず
//   このヘルパ経由で呼ぶ（バンドルスコープ衝突回避＋node/browser両対応）。
function _monster() {
  if (typeof require !== 'undefined') return require('../logic/monster.js');
  return (typeof window !== 'undefined' && window.SRPG) || {};
}

// 鍛冶屋・素材ドロップ（追加弾5-D）のロジック遅延解決。
//   rollDrops を _onVictory で使う（バンドルスコープ衝突回避＋node/browser両対応）。
function _forge() {
  if (typeof require !== 'undefined') return require('../logic/forge.js');
  return (typeof window !== 'undefined' && window.SRPG) || {};
}

// ── 純粋ロジック（テスト対象） ────────────────────────────────────────

/**
 * spawnEnemies(pool, rng)
 * エンカウントのプール（敵id配列）から 1〜3 体の戦闘用インスタンスを生成する。
 * 同じ敵が複数なら名前に A/B/C 接尾辞を付けて区別する。
 * インスタンスの id は一意（baseId#index）。baseId は色/種別判定用。
 * @returns {object[]}
 */
function spawnEnemies(pool, rng) {
  const ENEMIES = _bsEnemies();
  const valid = (pool || []).filter((id) => ENEMIES[id]);
  if (!valid.length) return [];

  const n = (rng && rng.rangeInt) ? rng.rangeInt(1, 3) : 1;
  const picks = [];
  for (let i = 0; i < n; i++) {
    const id = (rng && rng.pick) ? rng.pick(valid) : valid[i % valid.length];
    picks.push(id);
  }

  const insts = picks.map((id, idx) => {
    const base = ENEMIES[id];
    return {
      id: id + '#' + idx,
      baseId: id,
      name: base.name,
      maxHp: base.hp, hp: base.hp,
      atk: base.atk, def: base.def, spd: base.spd,
      exp: base.exp, gold: base.gold,
      isBoss: !!base.isBoss,
      isEnemy: true,
      dead: false,
      drops: base.drops || [],   // 素材ドロップ表（追加弾5-D）：_onVictory で rollDrops が使う
      art: base.art,             // AI絵キー（第2章）：敵アート解決が e.art を優先で使う
    };
  });

  // 同じ baseId が複数あれば名前に A/B/C を付ける
  insts.forEach((inst) => {
    const same = insts.filter((x) => x.baseId === inst.baseId);
    if (same.length > 1) {
      const pos = same.indexOf(inst);
      inst.name = inst.name + ' ' + 'ABCDE'.charAt(pos);
    }
  });
  return insts;
}

/**
 * spawnForced(ids)
 * ボス戦など、出現する敵idを固定して生成する（エンカウント抽選しない）。
 * 多段フェーズ(phases)を持つ敵は phases を引き継ぎ、_phase=1 で開始する。
 * @returns {object[]}
 */
function spawnForced(ids) {
  const ENEMIES = _bsEnemies();
  const valid = (ids || []).filter((id) => ENEMIES[id]);
  const insts = valid.map((id, idx) => {
    const base = ENEMIES[id];
    const inst = {
      id: id + '#' + idx,
      baseId: id,
      name: base.name,
      maxHp: base.hp, hp: base.hp,
      atk: base.atk, def: base.def, spd: base.spd,
      exp: base.exp, gold: base.gold,
      isBoss: !!base.isBoss,
      isEnemy: true,
      dead: false,
      drops: base.drops || [],   // 素材ドロップ表（追加弾5-D）：_onVictory で rollDrops が使う
      art: base.art,             // AI絵キー（第2章）：敵アート解決が e.art を優先で使う
    };
    if (base.phases) { inst.phases = base.phases; inst._phase = 1; }
    return inst;
  });
  insts.forEach((inst) => {
    const same = insts.filter((x) => x.baseId === inst.baseId);
    if (same.length > 1) {
      const pos = same.indexOf(inst);
      inst.name = inst.name + ' ' + 'ABCDE'.charAt(pos);
    }
  });
  return insts;
}

/**
 * buildTurnOrder(units)
 * 素早さ降順・同速は入力順（安定）に並べた配列を返す（非破壊）。
 */
function buildTurnOrder(units) {
  return (units || [])
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (b.u.spd - a.u.spd) || (a.i - b.i))
    .map((x) => x.u);
}

/**
 * chooseEnemyAction(enemy, party, rng)
 * 敵の簡易AI：生存している味方をランダムに通常攻撃する。
 * @returns {{ type:'attack', targetId:(string|null) }}
 */
function chooseEnemyAction(enemy, party, rng) {
  const alive = (party || []).filter((p) => !(p.dead === true || p.hp <= 0));
  if (!alive.length) return { type: 'attack', targetId: null };
  const t = (rng && rng.pick) ? rng.pick(alive) : alive[0];
  return { type: 'attack', targetId: t.id };
}

/**
 * calcReward(enemies)
 * 撃破した敵全員の exp / gold を合算する。
 * @returns {{ exp:number, gold:number }}
 */
function calcReward(enemies) {
  let exp = 0, gold = 0;
  (enemies || []).forEach((e) => { exp += (e.exp || 0); gold += (e.gold || 0); });
  return { exp, gold };
}

/**
 * difficultyScale(diff)
 * 難易度（'easy'|'normal'|'hard'）ごとの補正係数を返す。
 *   enemyHp   : 敵HPの倍率（戦闘開始時に適用）
 *   enemyAtk  : 敵の攻撃威力の倍率（ダメージ計算時に適用）
 *   reward    : 入手 exp/gold の倍率
 *   reviveHalf: 全滅復活がHP半分か（true=むずかしい／false=全回復）
 * @returns {{enemyHp:number, enemyAtk:number, reward:number, reviveHalf:boolean}}
 */
function difficultyScale(diff) {
  // ★2026-07-05 難易度ラダー底上げ（げんちゃん「今のむずかしいを やさしいの基準に」）。
  //   全難易度で敵を強化。やさしい=旧むずかしい相当の強さだが、全滅しても全回復で
  //   立て直せる思想（reviveHalf:false）は死守＝息子くんが詰まらない。むずかしいのみ半分復活。
  switch (diff) {
    case 'easy': return { enemyHp: 1.35, enemyAtk: 1.4, reward: 1.4, reviveHalf: false };
    case 'hard': return { enemyHp: 2.0,  enemyAtk: 2.1, reward: 1.7, reviveHalf: true  };
    default:     return { enemyHp: 1.6,  enemyAtk: 1.7, reward: 1.5, reviveHalf: false };
  }
}

/**
 * newGamePlusScale(clearCount)
 * つよくてニューゲーム（追加弾4-C）の しゅうかい補正。
 *   clearCount=0（1しゅうめ）は すべて等倍。しゅうかい数ぶん 敵HP/敵攻撃/報酬を
 *   引き上げる。報酬は おおめにして、つよくなった敵を たおす たっせいかんと
 *   さらなる育成の はげみに する。
 * @param {number} clearCount - これまで クリアした かいすう（2しゅうめ=1, 3しゅうめ=2 …）
 * @returns {{enemyHp:number, enemyAtk:number, reward:number}}
 */
function newGamePlusScale(clearCount) {
  var n = Math.max(0, clearCount || 0);
  return {
    enemyHp:  1 + 0.40 * n,
    enemyAtk: 1 + 0.25 * n,
    reward:   1 + 0.50 * n,
  };
}

// ── シーン本体（ブラウザ実行・目視検証） ──────────────────────────────

/**
 * createBattleScene(state, enemyPool)
 * @param {object} state - GameState（party を直接参照しHP/MP/expを永続させる）
 * @param {string[]} enemyPool - エンカウントの敵idプール
 * @returns {{ update:Function, draw:Function }}
 */
function createBattleScene(state, enemyPool, opts) {
  opts = opts || {};
  const S = (typeof window !== 'undefined') ? window.SRPG : null;

  // 仮想解像度
  const VW = (S && S.VW) || 288;
  const VH = (S && S.VH) || 512;

  // レイアウト定数（バーチャルパッド y≈357-507 に被らないよう上に収める）
  const AX = 8, AW = VW - 16;        // 下段ウィンドウ x / 幅
  const PSY = 184, PSH = 40;          // パーティ状態ストリップ
  const ACY = 228, ACH = 118;         // コマンド/メッセージ領域（下端346 < pad357）

  // 戦闘専用の乱数（実機は Math.random ベース）
  const rng = {
    next: function () { return Math.random(); },
    rangeInt: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    chance: function (p) { return Math.random() < p; },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  };

  // 強制出現（ボス戦）なら opts.forced を生成、それ以外は通常エンカウント抽選。
  const enemies = (opts.forced && opts.forced.length)
    ? spawnForced(opts.forced)
    : spawnEnemies(enemyPool, rng);

  // ── 難易度補正（settings.difficulty に応じて敵HP/敵攻撃/報酬/復活を変える） ──
  const _diff = (state.settings && state.settings.difficulty) || 'normal';
  const _diffScale = difficultyScale(_diff);
  // つよくてニューゲーム（追加弾4-C）：しゅうかい数ぶん 敵を強化し 報酬も増やす。
  //   difficultyScale は毎回あたらしいオブジェクトを返すので、ここで安全に畳み込める。
  //   以降の _diffScale.enemyHp / .enemyAtk / .reward を読む全箇所が自動で この補正を受ける。
  const _ng = newGamePlusScale(state.clearCount);
  _diffScale.enemyHp  *= _ng.enemyHp;
  _diffScale.enemyAtk *= _ng.enemyAtk;
  _diffScale.reward   *= _ng.reward;
  enemies.forEach((e) => {
    e.maxHp = Math.max(1, Math.round(e.maxHp * _diffScale.enemyHp));
    e.hp = e.maxHp;
  });

  // 味方の初期化：旧セーブにも type/kiai を補完し、戦闘開始時のキアイは0にそろえる
  // （キアイは戦闘内で溜める限定リミットブレイク）。
  state.party.forEach((p) => {
    if (!p.type && S && S.CHARACTERS && S.CHARACTERS[p.id]) p.type = S.CHARACTERS[p.id].type;
    if (p.maxKiai == null) p.maxKiai = 100;
    p.kiai = 0;
  });

  // ── 状態 ──
  let phase = 'intro';        // 'intro' | 'command' | 'resolve' | 'over'
  let round = 0;
  let _msg = null, _msgDone = null;
  let cmdMode = 'root';       // 'root' | 'skill' | 'kiai' | 'combo' | 'item' | 'target'
  let cursor = 0;
  let menuList = [];
  let pendingSkill = null, pendingItem = null, pendingCombo = null, targetKind = null;
  let playerAction = null;
  let actionQueue = [], aqIndex = 0;
  let fleeFailMsg = false;
  let _lastTypeMul = 1;   // 直近の単体攻撃のタイプ相性倍率（「こうかは ばつぐん！」表示用）
  let _lastCrit = false;  // 直近の単体攻撃が会心だったか（「かいしんの 一げき！」表示用）
  let _scouted = [];      // スカウト成功した敵→キャラ変換結果（_onVictory で party/roster へ確定）

  // ── 戦闘エフェクト（アクションアニメ／赤フラッシュ／ダメージ数字） ──
  const LUNGE_DUR = 0.26;   // 突進の往復時間（秒）
  const HIT_DUR = 0.30;     // 被弾点滅の時間
  const SHAKE_DUR = 0.28;   // 画面シェイクの時間
  const FLASH_DUR = 0.32;   // 赤フラッシュ（味方被弾時の画面全体）の時間
  const CAST_DUR = 0.42;    // 技発動リングの時間
  const FLOAT_DUR = 0.90;   // ダメージ数字の浮遊時間
  const IMPACT_DUR = 0.34;  // 着弾の閃光／斬撃の時間
  let shakeT = 0;           // 残りシェイク秒
  let shakeAmp = 6;         // シェイク振幅（px）。会心/必殺で一時的に強める
  let flashT = 0;           // 残りフラッシュ秒
  let flashDur = FLASH_DUR; // 直近フラッシュの基準時間（フェードに使う）
  let flashColor = '#ff2a2a'; // フラッシュ色（味方被弾=赤／必殺=技色）
  let flashMax = 0.42;      // フラッシュの最大不透明度（必殺カットインで上げる）
  let zoomT = 0;            // カットインの一瞬ズーム残り秒（>0で 1.0→1.06→1.0 のパンチ）
  const ZOOM_DUR = 0.22;    // ズームパンチの時間（必殺/連携で発火）
  const STAR_DUR = 0.44;    // ☆バースト（こうかばつぐん）の時間
  const BURST_DUR = 0.40;   // 撃破/カットインの破裂きらめきの時間
  const _fx = {};           // id -> { hitT, lungeT, ldx, ldy, castT }
  // 着弾エフェクト kind: 'hit'|'slash'|'ring'|'star'(星バースト)|'burst'(破裂きらめき)|'sparkle'(回復キラ)
  let _floaters = [];       // { x, y, text, color, size, t } 浮遊ダメージ/回復数字
  let _impacts = [];        // { x, y, t, kind, color, dur, scale } 着弾エフェクト
  function _fxOf(id) {
    return _fx[id] || (_fx[id] = { hitT: 0, lungeT: 0, ldx: 0, ldy: 0, castT: 0 });
  }
  // 画面シェイクを起こす（振幅・時間を任意指定。会心や必殺で強める）。
  function _shake(amp, dur) {
    shakeAmp = (amp != null) ? amp : 6;
    shakeT = Math.max(shakeT, (dur != null) ? dur : SHAKE_DUR);
  }
  // 画面フラッシュを起こす（色・時間・最大不透明度を任意指定。後方互換=赤の被弾フラッシュ）。
  function _flash(color, dur, maxAlpha) {
    flashColor = color || '#ff2a2a';
    flashDur = (dur != null) ? dur : FLASH_DUR;
    flashMax = (maxAlpha != null) ? maxAlpha : 0.42;
    flashT = Math.max(flashT, flashDur);
  }
  // 着弾エフェクトを積む小ヘルパ（kind/色/時間/スケールを指定）。
  function _impact(x, y, kind, color, dur, scale) {
    _impacts.push({ x: x, y: y, t: 0, kind: kind, color: color, dur: dur || 0, scale: scale || 1 });
  }

  // ── 小ヘルパ ──
  function _isDead(u) { return !u || u.dead === true || u.hp <= 0; }
  function _yuito() { return state.party.find((p) => p.id === 'yuito') || state.party[0]; }
  function _aliveParty() { return state.party.filter((p) => !_isDead(p)); }
  function _aliveEnemies() { return enemies.filter((e) => !_isDead(e)); }
  function _findUnit(id) {
    return state.party.find((p) => p.id === id) || enemies.find((e) => e.id === id) || null;
  }
  function _enemiesCleared() { return enemies.every(_isDead); }
  function _partyWiped() { return state.party.every(_isDead); }

  // ボスの第2フェーズ移行：HPが閾値以下になったら攻撃/防御/素早さを強化する。
  // 移行したらメッセージ文字列を返す（しなければ null）。
  function _applyPhaseIfNeeded(e) {
    if (!e || !e.phases || _isDead(e)) return null;
    const cur = e._phase || 1;            // 現在の形態（1始まり。phases[0]=初期形態）
    const next = e.phases[cur];           // これから移行する形態（無ければ最終形態＝null）
    if (!next) return null;
    const ratio = (next.hpRatio != null) ? next.hpRatio : 0.5;
    if (e.hp / e.maxHp > ratio) return null;
    if (next.atk != null) e.atk = next.atk;
    if (next.def != null) e.def = next.def;
    if (next.spd != null) e.spd = next.spd;
    e._phase = cur + 1;
    // ボスセリフ：quotes.phases[]（移行ごと）があればそれ、無ければ quotes.phase、無ければ定型文。
    let line = null;
    if (e.quotes) {
      if (Array.isArray(e.quotes.phases)) line = e.quotes.phases[cur - 1];
      if (!line) line = e.quotes.phase;
    }
    return line || (e.name + 'は ほんきを だしてきた！');
  }

  function _eff(u) {
    if (u.isEnemy) return { atk: u.atk, def: u.def };
    var atk = u.atk, def = u.def;
    if (S && S.applyEquip) { const e = S.applyEquip(u); atk = e.atk; def = e.def; }
    // 称号ボーナス（追加弾4-A）：そうび中の称号を味方全員に加算する。
    if (S && S.titleBonus) { const tb = S.titleBonus(state); atk += (tb.atk || 0); def += (tb.def || 0); }
    return { atk: atk, def: def };
  }

  // 戦闘中ユニットの画面中心（描画側のレイアウト式と一致させてFXの位置決めに使う）。
  function _unitCenter(u) {
    if (!u) return { x: VW / 2, y: 120, size: 40 };
    if (u.isEnemy) {
      const n = enemies.length || 1;
      const i = Math.max(0, enemies.indexOf(u));
      const span = 240 / n;
      const size = n === 1 ? 70 : (n === 2 ? 58 : 46);
      return { x: 24 + span * (i + 0.5), y: 95, size: size };
    }
    const p = state.party, n = p.length || 1;
    const colW = AW / n;
    const boxH = Math.min(60, colW * 1.05);
    const i = Math.max(0, p.indexOf(u));
    return { x: AX + colW * i + colW / 2, y: (PSY + 4) - boxH / 2, size: boxH };
  }

  // 攻撃側を対象へ向かって少し踏み込ませる（往復）。
  function _lunge(actor, target) {
    if (!actor || !target) return;
    const a = _unitCenter(actor), t = _unitCenter(target);
    const dx = t.x - a.x, dy = t.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const reach = Math.min(30, len * 0.5);
    const f = _fxOf(actor.id);
    f.lungeT = LUNGE_DUR;
    f.ldx = (dx / len) * reach;
    f.ldy = (dy / len) * reach;
  }

  // 技発動の演出（足元に広がるリング）。
  function _onCast(actor, color) {
    if (!actor) return;
    _fxOf(actor.id).castT = CAST_DUR;
    const a = _unitCenter(actor);
    _impact(a.x, a.y, 'ring', color || '#ffe6a0');
  }

  // 必殺技・連携技のカットイン全画面演出：大フラッシュ＋大シェイク＋一瞬のズームパンチ。
  //   着弾の大リング/破裂は攻撃解決側（_dealAttack→_onHit）に任せ、ここは画面全体の派手さを担当。
  function _cutin(color) {
    _flash(color || '#ffffff', FLASH_DUR * 1.4, 0.6);
    _shake(12, SHAKE_DUR * 1.6);
    zoomT = ZOOM_DUR;   // 1.0→1.06→1.0 のパンチ（描画側でctxを中央基準スケール）
  }

  // 被弾演出：点滅＋着弾フラッシュ＋斬撃＋ダメージ数字＋シェイク（味方なら画面赤フラッシュ）。
  //   opts.crit=会心（金の特大数字＋2連衝撃＋強シェイク）、opts.typeMul=相性
  //   （>1=☆バースト／<1=控えめ）で派手さを切り替える。引数省略時は従来の挙動。
  function _onHit(target, dmg, opts) {
    if (!target) return;
    opts = opts || {};
    const crit = !!opts.crit;
    const typeMul = (opts.typeMul != null) ? opts.typeMul : 1;
    const weak = typeMul > 1;       // こうかばつぐん
    const resist = typeMul > 0 && typeMul <= 0.75; // いまひとつ
    const c = _unitCenter(target);
    const isAlly = !target.isEnemy;
    _fxOf(target.id).hitT = HIT_DUR;

    // 衝撃：基本の hit ＋（会心は強い ring を重ねて2連発、いまひとつは小さめ）。
    const hitColor = isAlly ? '#ff3a3a' : '#ffcf3a';
    _impact(c.x, c.y, 'hit', hitColor, 0, resist ? 0.7 : 1);
    _impact(c.x, c.y, 'slash');
    if (crit) {
      // 会心：金リングをひと回り大きく重ねて「ドカーン！」感を足す。
      _impact(c.x, c.y, 'ring', '#ffe24a', 0, 1.5);
      _impact(c.x, c.y, 'burst', '#fff4c2', 0, 1.2);
    }
    // こうかばつぐん：黄色い☆バーストでキラッと。
    if (weak) _impact(c.x, c.y, 'star', '#ffe24a', STAR_DUR, crit ? 1.25 : 1);

    // ダメージ数字：会心は特大＆金色、いまひとつはくすんだ色＆小さめ。
    let fcolor = isAlly ? '#ff6a6a' : '#ffe24a';
    let fsize = 18;
    if (crit) { fcolor = '#ffd76e'; fsize = 28; }
    else if (resist) { fcolor = isAlly ? '#c77' : '#bcae7a'; fsize = 15; }
    else if (weak) { fcolor = '#fff0a0'; fsize = 22; }
    _floaters.push({ x: c.x, y: c.y - c.size * 0.3, text: '' + dmg, color: fcolor, size: fsize, t: 0 });

    // シェイク：会心は強く・いまひとつは弱く。
    if (crit) _shake(10, SHAKE_DUR * 1.25);
    else if (resist) _shake(3, SHAKE_DUR * 0.7);
    else if (weak) _shake(8, SHAKE_DUR);
    else _shake(6, SHAKE_DUR);

    // 味方被弾の画面赤フラッシュ（会心被弾は少し濃く）。
    if (isAlly) _flash('#ff2a2a', FLASH_DUR, crit ? 0.55 : 0.42);
  }

  // 回復演出：緑の「+N」を浮かせ、足元にリング＋緑のキラキラ（sparkle）を散らす。
  function _healFloat(t, amt) {
    if (!t || !amt) return;
    const c = _unitCenter(t);
    _floaters.push({ x: c.x, y: c.y - c.size * 0.3, text: '+' + amt, color: '#7bff8a', size: 16, t: 0 });
    _fxOf(t.id).castT = CAST_DUR;
    _impact(c.x, c.y, 'ring', '#7bff8a');
    _impact(c.x, c.y - c.size * 0.1, 'sparkle', '#bfffc8', 0, 1);
  }

  // キアイゲージ加算（味方のみ）。MAX到達時は金色の「キアイMAX!」演出を出す。
  function _gainKiai(unit, amt) {
    if (!unit || unit.isEnemy || _isDead(unit)) return;
    const max = unit.maxKiai || 100;
    unit.maxKiai = max;
    const before = unit.kiai || 0;
    if (before >= max) return;
    unit.kiai = Math.min(max, before + amt);
    if (unit.kiai >= max && before < max) {
      const c = _unitCenter(unit);
      _floaters.push({ x: c.x, y: c.y - c.size * 0.35, text: 'キアイMAX!', color: '#ffd76e', size: 13, t: 0 });
      _fxOf(unit.id).castT = CAST_DUR;
      _impacts.push({ x: c.x, y: c.y, t: 0, kind: 'ring', color: '#ffd76e' });
    }
  }

  // 直近の単体攻撃のタイプ相性に応じた追加メッセージ（無ければ null）。
  function _effPage() {
    if (_lastTypeMul >= 1.5) return 'こうかは バツグンだ！';
    if (_lastTypeMul > 0 && _lastTypeMul <= 0.75) return 'こうかは いまひとつ…';
    return null;
  }
  // 直近の単体攻撃が会心だったときの追加メッセージ（無ければ null）。
  function _critPage() {
    return _lastCrit ? 'かいしんの 一げき！' : null;
  }

  // 毎フレーム、全エフェクトのタイマーを進める（メッセージ表示中も進める＝update冒頭で呼ぶ）。
  function _advanceFx(dt) {
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    if (zoomT > 0) zoomT = Math.max(0, zoomT - dt);
    for (const id in _fx) {
      const f = _fx[id];
      if (f.hitT > 0) f.hitT = Math.max(0, f.hitT - dt);
      if (f.lungeT > 0) f.lungeT = Math.max(0, f.lungeT - dt);
      if (f.castT > 0) f.castT = Math.max(0, f.castT - dt);
    }
    if (_floaters.length) {
      for (let i = 0; i < _floaters.length; i++) _floaters[i].t += dt;
      _floaters = _floaters.filter((f) => f.t < FLOAT_DUR);
    }
    if (_impacts.length) {
      for (let i = 0; i < _impacts.length; i++) _impacts[i].t += dt;
      _impacts = _impacts.filter((m) => m.t < (m.dur || IMPACT_DUR));
    }
  }

  // メッセージ表示（dialogState を流用してタイプライター＋ページ送り）
  function _showMessages(pages, onDone) {
    pages = (pages || []).filter((p) => p != null && p !== '');
    if (!pages.length) { if (onDone) onDone(); return; }
    if (S && S.createDialogState) {
      _msg = S.createDialogState(pages);
      _msgDone = onDone || null;
    } else {
      if (onDone) onDone();
    }
  }

  // 戦闘開始メッセージ（弾4）：「○○が あらわれた！」＋ボスの とうじょうセリフ。
  function _introLines() {
    if (!enemies.length) return ['…てきは いなかった。'];
    const names = enemies.map((e) => e.name);
    const appear = (names.length === 1 ? names[0] : names.join('と')) + 'が あらわれた！';
    const lines = [appear];
    enemies.forEach((e) => {
      if (e.quotes && e.quotes.intro) {
        const arr = Array.isArray(e.quotes.intro) ? e.quotes.intro : [e.quotes.intro];
        arr.forEach((t) => lines.push(t));
      }
    });
    return lines;
  }

  // ── 行動の実行（メッセージ配列を返す／何もしない時は null） ──
  function _redirect(attacker, target) {
    // 敵→味方攻撃で、対象を「かばっている」生存味方がいれば肩代わり
    if (attacker.isEnemy && target && !target.isEnemy) {
      const coverer = state.party.find(
        (p) => !_isDead(p) && p._covering === target.id && p.id !== target.id);
      if (coverer) return coverer;
    }
    return target;
  }

  function _damage(a, d) {
    if (S && S.calcDamage) return S.calcDamage({ atk: a }, { def: d }, { power: 1, rng });
    return Math.max(1, a - Math.floor(d / 2));
  }
  function _dealAttack(attacker, target, power) {
    const a = _eff(attacker).atk, d = _eff(target).def;
    // タイプ相性倍率（攻撃側タイプ vs 防御側タイプ）
    const typeMul = (S && S.typeMultiplier) ? S.typeMultiplier(attacker.type, target.type) : 1;
    _lastTypeMul = typeMul;
    // 難易度補正：敵の攻撃だけ威力を増減する
    const diffMul = attacker.isEnemy ? _diffScale.enemyAtk : 1;
    // 会心(crit)はここで先に判定して calcDamage に渡す＝戻り値からは crit が読めないため、
    // 演出（金の特大数字・2連衝撃・強シェイク）に確実につなぐ。確率はロジックと同じ8%。
    const crit = rng.chance(0.08);
    let dmg;
    if (S && S.calcDamage) dmg = S.calcDamage({ atk: a }, { def: d }, { power: (power || 1) * diffMul, rng, typeMul, crit });
    else dmg = Math.max(1, Math.round((a - d / 2) * (power || 1) * typeMul * diffMul * (crit ? 2 : 1)));
    if (target._defending) dmg = Math.max(1, Math.floor(dmg / 2));
    if (S && S.applyDamage) S.applyDamage(target, dmg);
    else { target.hp = Math.max(0, target.hp - dmg); if (target.hp === 0) target.dead = true; }
    const justDied = _isDead(target);
    _onHit(target, dmg, { crit: crit, typeMul: typeMul });
    if (justDied) _defeatPop(target);   // 撃破ポップ（破裂きらめき＋小フラッシュ）
    _lastCrit = crit;                    // 直近攻撃が会心だったか（メッセージ用）
    _gainKiai(target, 14);   // ダメージを受けるとキアイが溜まる
    return dmg;
  }
  // 撃破ポップ：敵が倒れて消える瞬間に小さな破裂＋きらめき＋小フラッシュを1回出す。
  function _defeatPop(target) {
    if (!target) return;
    const c = _unitCenter(target);
    _impact(c.x, c.y, 'burst', target.isEnemy ? '#ffe24a' : '#ffd0d0', BURST_DUR, target.isBoss ? 1.6 : 1.1);
    _impact(c.x, c.y, 'ring', '#ffffff', BURST_DUR, target.isBoss ? 1.4 : 1);
    if (target.isEnemy) _flash('#fff4c2', FLASH_DUR * 0.6, target.isBoss ? 0.5 : 0.28);
    _shake(target.isBoss ? 9 : 5, SHAKE_DUR);
  }
  function _deathLine(target) {
    return target.isEnemy
      ? (target.name + 'を たおした！')
      : (target.name + 'は たおれてしまった！');
  }

  function _attack(actor, target) {
    if (!target || _isDead(target)) {
      target = actor.isEnemy ? _aliveParty()[0] : _aliveEnemies()[0];
    }
    if (!target) return null;
    target = _redirect(actor, target);
    if (S && S.playSe) S.playSe('attack');
    _lunge(actor, target);
    const dmg = _dealAttack(actor, target, 1);
    _gainKiai(actor, 12);   // 攻撃するとキアイが溜まる
    const pages = [actor.name + 'の こうげき！\n' + target.name + 'に ' + dmg + 'の ダメージ！'];
    const crt = _critPage();
    if (crt) pages.push(crt);
    const eff = _effPage();
    if (eff) pages.push(eff);
    if (_isDead(target)) pages.push(_deathLine(target));
    return pages;
  }

  function _useSkill(actor, skillId, targetId) {
    const SKILLS = (S && S.SKILLS) || {};
    const sk = SKILLS[skillId];
    if (!sk) return _attack(actor, _findUnit(targetId));
    // 必殺技（キアイ消費）：キアイがMAXでなければ使えない。使ったら全消費。
    if (sk.kiai) {
      if ((actor.kiai || 0) < sk.kiai) return [actor.name + 'は まだ キアイが たりない！'];
      actor.kiai = 0;
    }
    if (actor.mp < sk.mp) return [actor.name + 'は スタミナが たりない！'];
    actor.mp -= sk.mp;
    const pages = [sk.kiai
      ? (actor.name + 'の ひっさつわざ！\n「' + sk.name + '」！！')
      : (actor.name + 'の 「' + sk.name + '」！')];

    // 必殺技/超必殺(type:'ultimate')はカットイン全画面演出（大フラッシュ＋大シェイク＋ズーム）。
    const _isUlt = !!sk.kiai || sk.type === 'ultimate';
    if (sk.type === 'attack' || sk.type === 'ultimate') {
      if (S && S.playSe) S.playSe('special');
      _onCast(actor, _isUlt ? '#ff9a3a' : '#ffd76e');
      if (_isUlt) _cutin(sk.kiai ? '#ffdf7a' : '#ffffff');
      if (sk.target === 'all') {
        const targets = _aliveEnemies();
        if (targets[0]) _lunge(actor, targets[0]);
        targets.forEach((t) => _dealAttack(actor, t, sk.power || 1));
        pages.push('てき ぜんたいに ダメージ！');
        targets.filter(_isDead).forEach((t) => pages.push(_deathLine(t)));
      } else {
        let t = _findUnit(targetId);
        if (!t || _isDead(t)) t = _aliveEnemies()[0];
        if (t) {
          _lunge(actor, t);
          const dmg = _dealAttack(actor, t, sk.power || 1);
          pages.push(t.name + 'に ' + dmg + 'の ダメージ！');
          const crt = _critPage();
          if (crt) pages.push(crt);
          const eff = _effPage();
          if (eff) pages.push(eff);
          if (_isDead(t)) pages.push(_deathLine(t));
        }
      }
      if (!sk.kiai) _gainKiai(actor, 10);   // 通常とくぎでもキアイは溜まる（必殺は消費直後なので除外）
    } else if (sk.type === 'heal') {
      const amt = sk.heal || sk.amount || 0;
      if (S && S.playSe) S.playSe('heal');
      _onCast(actor, '#7bff8a');
      if (sk.kiai) _cutin('#9bffb0');   // 必殺の回復（ミラクル・ヒール等）もカットイン
      if (sk.target === 'allies') {
        _aliveParty().forEach((a) => { a.hp = Math.min(a.maxHp, a.hp + amt); _healFloat(a, amt); });
        pages.push('みんなの HPが かいふくした！');
      } else {
        let t = _findUnit(targetId) || actor;
        t.hp = Math.min(t.maxHp, t.hp + amt);
        _healFloat(t, amt);
        pages.push(t.name + 'の HPが かいふくした！');
      }
    } else if (sk.type === 'buff_def') {
      let t = _findUnit(targetId) || actor;
      t._defending = true;
      _onCast(t, '#9ad0ff');
      pages.push(t.name + 'の まもりが かたくなった！');
    } else {
      pages.push('こうかが なかった…');
    }
    return pages;
  }

  // 連携技（追加弾4-B）：コンビの2人が両方キアイMAXのとき発動できる強力なコンビ技。
  //   発動するとメンバー全員のキアイを全消費する（消費後の溜め直しはしない）。
  function _useCombo(actor, comboId, targetId) {
    const COMBOS = (S && S.COMBOS) || {};
    const c = COMBOS[comboId];
    if (!c) return _attack(actor, _findUnit(targetId));
    // メンバー（生存者）のキアイを全消費し、発動カットインを出す。
    const members = (c.members || []).map(_findUnit).filter((u) => u && !_isDead(u));
    members.forEach((u) => { u.kiai = 0; _onCast(u, '#ffd76e'); });
    if (S && S.playSe) S.playSe('special');
    _cutin('#ffe6a0');   // 連携技は全画面カットイン（大フラッシュ＋大シェイク＋ズーム）
    const names = members.map((u) => u.name).join('と');
    const pages = [names + 'の れんけいわざ！\n「' + c.name + '」！！'];

    if (c.target === 'all') {
      const targets = _aliveEnemies();
      if (targets[0]) _lunge(actor, targets[0]);
      targets.forEach((t) => _dealAttack(actor, t, c.power || 1));
      pages.push('てき ぜんたいに だいダメージ！');
      targets.filter(_isDead).forEach((t) => pages.push(_deathLine(t)));
    } else {
      let t = _findUnit(targetId);
      if (!t || _isDead(t)) t = _aliveEnemies()[0];
      if (t) {
        _lunge(actor, t);
        const dmg = _dealAttack(actor, t, c.power || 1);
        pages.push(t.name + 'に ' + dmg + 'の だいダメージ！');
        const crt = _critPage();
        if (crt) pages.push(crt);
        const eff = _effPage();
        if (eff) pages.push(eff);
        if (_isDead(t)) pages.push(_deathLine(t));
      }
    }
    // 回復つき連携（イツキ）：攻撃と同時に味方全員を回復する。
    if (c.heal) {
      _aliveParty().forEach((a) => { a.hp = Math.min(a.maxHp, a.hp + c.heal); _healFloat(a, c.heal); });
      pages.push('みんなの HPも かいふくした！');
    }
    return pages;
  }

  // スカウト（なかまにする）：行動主のターンを消費する＝攻撃と同じ扱い。
  //   成功すると敵を撃破扱いで戦闘から外し、_scouted へ控える（_onVictory で確定）。
  function _scout(actor, targetId) {
    const mlib = _monster();
    let target = _findUnit(targetId);
    if (!target || target.isEnemy !== true || _isDead(target)) target = _aliveEnemies()[0];
    if (!target) return null;
    if (mlib.canScout && !mlib.canScout(target)) {
      return [target.name + 'は ボス！ なかまにできない！'];
    }
    const chance = mlib.scoutChance ? mlib.scoutChance(target) : 0;
    const roll = rng.next();   // 0〜1（ダメージ計算と同じ戦闘乱数）
    const ok = roll < chance;
    if (ok) {
      const char = mlib.enemyToCharacter(target);
      _scouted.push(char);
      // 撃破扱いで戦闘から除外（_isDead/_aliveEnemies/_enemiesCleared と同じ仕組み）。
      target.dead = true;
      target.hp = 0;
      _onCast(target, '#7bff8a');
      return [
        target.name + 'が なかまに なりたそうに している…！',
        target.name + 'が なかまになった！',
      ];
    }
    return [target.name + 'は なかまに ならなかった…'];
  }

  function _useItemAction(actor, itemId, targetId) {
    const ITEMS = (S && S.ITEMS) || {};
    const it = ITEMS[itemId];
    if (!it) return null;
    if ((state.inventory[itemId] || 0) <= 0) return [actor.name + 'は どうぐを もっていない！'];
    const t = _findUnit(targetId) || actor;
    let r = { ok: true, message: '' };
    if (S && S.useItem) r = S.useItem(t, it);
    if (r.ok) state.inventory[itemId] = (state.inventory[itemId] || 1) - 1;
    return [actor.name + 'は ' + it.name + 'を つかった！\n' + (r.message || '')];
  }

  // 敵の1ターン。ボスは固有ギミックを挟む（通常敵はランダム通常攻撃）。
  function _enemyTurn(enemy) {
    enemy._defending = false;            // 前ターンのガードは解除
    enemy._turns = (enemy._turns || 0) + 1;

    // 鉄壁キーパー ガーディアン：3ターンに1度「てっぺきガード」で防御を固める
    if (enemy.baseId === 'guardian' && enemy._turns % 3 === 0) {
      enemy._defending = true;
      _onCast(enemy, '#9ad0ff');
      return [enemy.name + 'は てっぺきガードの こうせい！\nぼうぎょりょくが ぐーんと あがった！'];
    }

    // ダーク・カイザー第2形態：溜め→次ターンに全体攻撃「やみのシュート」
    if (enemy.baseId === 'dark_kaiser' && enemy._phase >= 2) {
      if (enemy._charging) {
        enemy._charging = false;
        _onCast(enemy, '#b07bff');
        const targets = _aliveParty();
        if (targets[0]) _lunge(enemy, targets[0]);
        const pages = [enemy.name + 'の 「やみのシュート」！'];
        targets.forEach((t) => _dealAttack(enemy, t, 1.4));
        pages.push('やみの たまが パーティ ぜんいんを おそう！');
        targets.filter(_isDead).forEach((t) => pages.push(_deathLine(t)));
        return pages;
      }
      if (enemy._turns % 2 === 0) {
        enemy._charging = true;
        _onCast(enemy, '#6a4bce');
        return [enemy.name + 'は やみの ちからを ためている…！'];
      }
    }

    // 通常攻撃
    const act = chooseEnemyAction(enemy, state.party, rng);
    return _attack(enemy, _findUnit(act.targetId));
  }

  function _performAction(actor) {
    if (actor.isEnemy) {
      return _enemyTurn(actor);
    }
    // 味方
    let action;
    if (actor.id === 'yuito') {
      action = playerAction;
    } else if (state.settings && state.settings.autoAllies === false) {
      // おまかせOFFのときは仲間は守りに入る
      action = { type: 'defend' };
    } else if (S && S.chooseAllyAction) {
      action = S.chooseAllyAction(actor, state.party, enemies, rng);
    } else {
      action = { type: 'attack', targetId: (_aliveEnemies()[0] || {}).id };
    }
    if (!action) return null;
    switch (action.type) {
      case 'wait':   return null;
      case 'flee':   return null; // 逃走は resolve 前に処理済み
      case 'defend': actor._defending = true; _gainKiai(actor, 8); return [actor.name + 'は みをまもっている！'];
      case 'attack': return _attack(actor, _findUnit(action.targetId));
      case 'scout':  return _scout(actor, action.targetId);
      case 'skill':  return _useSkill(actor, action.skillId, action.targetId);
      case 'combo':  return _useCombo(actor, action.comboId, action.targetId);
      case 'item':   return _useItemAction(actor, action.itemId, action.targetId);
      case 'cover': {
        actor._covering = action.targetId;
        const tg = _findUnit(action.targetId);
        return [actor.name + 'は ' + (tg ? tg.name : 'なかま') + 'を かばう！'];
      }
      default: return null;
    }
  }

  // ── ラウンド進行 ──
  function _startCommandPhase() {
    round += 1;
    state.party.forEach((p) => { p._defending = false; p._covering = null; });
    if (_isDead(_yuito())) {
      // ユイトが倒れていても仲間が生きていれば自動で1ラウンド回す
      playerAction = { type: 'wait' };
      _startResolve();
      return;
    }
    phase = 'command';
    cmdMode = 'root';
    cursor = 0;
    _buildRootMenu();
  }

  function _attemptFlee() {
    const pSpd = _yuito().spd || 8;
    const foes = _aliveEnemies();
    const eAvg = foes.length ? foes.reduce((s, e) => s + (e.spd || 0), 0) / foes.length : 0;
    let ch = 0.5 + (pSpd - eAvg) * 0.05;
    if (ch < 0.25) ch = 0.25;
    if (ch > 0.95) ch = 0.95;
    return rng.chance(ch);
  }

  function _startResolve() {
    if (playerAction && playerAction.type === 'flee') {
      if (_attemptFlee()) {
        phase = 'over';
        _showMessages(['ユイトたちは うまく にげだした！'], _popToField);
        return;
      }
      playerAction = { type: 'wait' };
      fleeFailMsg = true;
    }
    actionQueue = buildTurnOrder(_aliveParty().concat(_aliveEnemies()));
    aqIndex = 0;
    phase = 'resolve';
    if (fleeFailMsg) {
      fleeFailMsg = false;
      _showMessages(['しかし まわりこまれて にげられない！'], _resolveStep);
    } else {
      _resolveStep();
    }
  }

  function _resolveStep() {
    while (aqIndex < actionQueue.length) {
      const actor = actionQueue[aqIndex++];
      if (_isDead(actor)) continue;
      const pages = _performAction(actor) || [];
      // この行動の結果、ボスが第2フェーズに突入したら告知する
      _aliveEnemies().forEach((e) => {
        const m = _applyPhaseIfNeeded(e);
        if (m) pages.push(m);
      });
      if (!pages.length) continue; // 無音スキップ
      if (_enemiesCleared()) { phase = 'over'; _showMessages(pages, _onVictory); return; }
      if (_partyWiped())     { phase = 'over'; _showMessages(pages, _onDefeat);  return; }
      _showMessages(pages, _resolveStep);
      return;
    }
    _startCommandPhase();
  }

  function _onVictory() {
    const reward = calcReward(enemies);
    // 難易度補正：報酬（経験値/ゴールド）にスケールを掛ける
    reward.exp = Math.max(1, Math.round(reward.exp * _diffScale.reward));
    reward.gold = Math.max(0, Math.round(reward.gold * _diffScale.reward));
    state.gold = (state.gold || 0) + reward.gold;
    const SKILLS = (S && S.SKILLS) || {};
    const pages = [];
    // ボスセリフ（弾4）：やられぎわの一言を いちばん さきに出す。
    enemies.forEach((e) => {
      if (e.quotes && e.quotes.defeat) {
        const arr = Array.isArray(e.quotes.defeat) ? e.quotes.defeat : [e.quotes.defeat];
        arr.forEach((t) => pages.push(t));
      }
    });
    pages.push('てきを たおした！');
    pages.push('けいけんち ' + reward.exp + ' かくとく！\n' + reward.gold + 'ゴールド てにいれた！');
    let _leveledUpAny = false;
    _aliveParty().forEach((m) => {
      if (!(S && S.gainExp)) return;
      const res = S.gainExp(m, reward.exp);
      if (res.leveledUp) { pages.push(m.name + 'は レベル ' + m.level + 'に あがった！'); _leveledUpAny = true; }
      (res.learned || []).forEach((sid) => {
        const sk = SKILLS[sid];
        if (sk) pages.push(m.name + 'は 「' + sk.name + '」を おぼえた！');
      });
    });
    // 効果音：レベルアップしたら祝福感の強い levelup、無ければ勝利ファンファーレ（1回だけ＝重なり防止）
    if (S && S.playSe) S.playSe(_leveledUpAny ? 'levelup' : 'victory');
    // スカウトした敵を party/roster へ確定（state を丸ごとJSON化保存するので push で永続化される）。
    if (_scouted && _scouted.length) {
      const mlib = _monster();
      _scouted.forEach((char) => {
        const dest = mlib.addToRoster(state, char);
        if (dest === 'party') pages.push(char.name + 'が パーティに くわわった！');
        else pages.push(char.name + 'は ひかえに くわわった！（なかまがいっぱい）');
      });
      _scouted = [];
    }
    // モンスターずかん（弾3・やりこみ）：たおした敵を baseId ごとに 数える
    state.dex = state.dex || {};
    enemies.forEach((e) => {
      const k = e.baseId || e.id;
      if (k) state.dex[k] = (state.dex[k] || 0) + 1;
    });
    // 素材ドロップ（追加弾5-D）：たおした敵ごとに drops を抽選し inventory へ加算する。
    var _fl = _forge();
    if (_fl && _fl.rollDrops) {
      state.inventory = state.inventory || {};
      var _got = {};
      enemies.forEach(function (e) {
        (_fl.rollDrops(e, rng) || []).forEach(function (id) {
          state.inventory[id] = (state.inventory[id] || 0) + 1;
          _got[id] = (_got[id] || 0) + 1;
        });
      });
      var _ITM = (typeof require !== 'undefined') ? (require('../data/items.js').ITEMS || {}) : ((typeof window !== 'undefined' && window.SRPG && window.SRPG.ITEMS) || {});
      Object.keys(_got).forEach(function (id) {
        var nm = (_ITM[id] && _ITM[id].name) || id;
        var n = _got[id];
        pages.push(nm + (n > 1 ? (' ×' + n) : '') + 'を ひろった！');
      });
    }

    // 隠しボス報酬など（弾3）：opts.reward があれば 道具/ゴールドを わたす
    if (opts.reward && S && S.grantReward) {
      const rm = S.grantReward(state, opts.reward);
      if (rm) pages.push(rm + 'を てにいれた！');
    }
    // ボス撃破ならフラグを立ててから保存（フィールド再構築/エンディング判定に使う）
    if (opts.winFlag || opts.vanishFlag) {
      state.flags = state.flags || {};
      if (opts.winFlag)    state.flags[opts.winFlag] = true;
      if (opts.vanishFlag) state.flags[opts.vanishFlag] = true;
    }
    // 章の地続き遷移（第3章）：撃破後に追加フラグを立てる。
    if (opts.setFlag) {
      state.flags = state.flags || {};
      state.flags[opts.setFlag] = true;
    }
    if (S && S.saveGame) S.saveGame(state);

    // 撃破後の追加ストーリーページ（イベント演出）を勝利メッセージへ連結。
    if (Array.isArray(opts.afterPages)) pages = pages.concat(opts.afterPages);

    // 勝利後のルーティング
    // ボスラッシュ（追加弾4-D）：onWin が あれば 次の戦闘へ つなぐ判断を 呼び出し側に まかせる。
    // _showMessages は シーンを 積まない（内部 _msg）ので、onWin の中で popScene すること。
    if (typeof opts.onWin === 'function') { _showMessages(pages, function () { opts.onWin(state); }); return; }
    // 章遷移ワープ（第3章突入）：撃破後に別マップの指定座標へ飛ばしてフィールドを作り直す。
    if (opts.warpTo) {
      _showMessages(pages, function () {
        state.position = state.position || {};
        state.position.map = opts.warpTo;
        if (typeof opts.warpX === 'number') state.position.x = opts.warpX;
        if (typeof opts.warpY === 'number') state.position.y = opts.warpY;
        if (S && S.saveGame) S.saveGame(state);
        if (S && S.popScene) S.popScene();
        if (S && S.replaceScene && S.createFieldScene) S.replaceScene(S.createFieldScene(state));
      });
      return;
    }
    if (opts.ending) { _showMessages(pages, _goEnding); return; }
    if (opts.winFlag || opts.vanishFlag) { _showMessages(pages, _returnToFieldRebuild); return; }
    _showMessages(pages, _popToField);
  }

  function _onDefeat() {
    // ゲームオーバーにはせず立て直す。むずかしいは半分回復、それ以外は全回復。
    const half = _diffScale.reviveHalf;
    state.party.forEach((m) => {
      m.dead = false;
      m.hp = half ? Math.max(1, Math.floor(m.maxHp / 2)) : m.maxHp;
      m.mp = half ? Math.floor(m.maxMp / 2) : m.maxMp;
    });
    if (S && S.saveGame) S.saveGame(state);
    _showMessages([
      'ぜんいん たおれてしまった…',
      'でも ユイトたちは あきらめない！',
      half ? 'きあいで たちあがった！（HP はんぶん かいふく）'
           : 'きあいで たちあがった！（HP かいふく）',
    ], _popToField);
  }

  function _popToField() {
    if (S && S.popScene) S.popScene();
  }

  // ボス撃破後：バトルを抜けてフィールドを作り直す（倒したボスNPCを消すため）。
  function _returnToFieldRebuild() {
    if (S && S.popScene) S.popScene();
    if (S && S.replaceScene && S.createFieldScene) S.replaceScene(S.createFieldScene(state));
  }

  // ラスボス撃破後：エンディングを流してタイトルへ戻る。
  function _goEnding() {
    state.flags = state.flags || {};
    state.flags.game_cleared = true;
    if (S && S.saveGame) S.saveGame(state);
    const ending = (S && S.getEnding) ? S.getEnding(state) : ['― おわり ―'];
    _showMessages(ending, function () {
      if (S && S.popScene) S.popScene();
      if (S && S.replaceScene && S.createTitleScene) S.replaceScene(S.createTitleScene());
    });
  }

  // ── コマンドメニュー ──
  function _buildRootMenu() {
    menuList = [
      { label: 'たたかう', v: 'attack' },
      { label: 'とくぎ',   v: 'skill' },
    ];
    // キアイMAXのときだけ「★ひっさつ」コマンドが出る
    const y = _yuito();
    if (y && (y.kiai || 0) >= (y.maxKiai || 100)) {
      menuList.push({ label: '★ひっさつ', v: 'kiai' });
    }
    // 連携技（追加弾4-B）：発動できるコンビが1つでもあれば「☆れんけい」コマンドが出る
    const combos = (S && S.availableCombos) ? S.availableCombos(state.party) : [];
    if (combos.length) {
      menuList.push({ label: '☆れんけい', v: 'combo' });
    }
    menuList.push({ label: 'どうぐ',   v: 'item' });
    menuList.push({ label: 'ぼうぎょ', v: 'defend' });
    // スカウト（なかまにする）：ボスでない生存敵がいるときだけ出す
    menuList.push({ label: 'スカウト', v: 'scout' });
    // ボス戦（強制出現）からは逃げられない
    if (!(opts.forced && opts.forced.length)) {
      menuList.push({ label: 'にげる', v: 'flee' });
    }
    cmdMode = 'root';
    cursor = 0;
  }

  function _enterSkill() {
    const SKILLS = (S && S.SKILLS) || {};
    const y = _yuito();
    const list = (y.skills || [])
      .map((id) => SKILLS[id])
      .filter((s) => s && !s.kiai && (s.type === 'attack' || s.type === 'heal' || s.type === 'buff_def') && y.mp >= s.mp)
      .map((s) => ({ label: s.name + ' (' + s.mp + ')', v: s.id }));
    list.push({ label: 'もどる', v: '__back' });
    menuList = list;
    cmdMode = 'skill';
    cursor = 0;
  }

  // 必殺技メニュー（キアイMAXで解放・mp不要）
  function _enterKiai() {
    const SKILLS = (S && S.SKILLS) || {};
    const y = _yuito();
    const list = (y.skills || [])
      .map((id) => SKILLS[id])
      .filter((s) => s && s.kiai && (s.type === 'attack' || s.type === 'heal'))
      .map((s) => ({ label: '★' + s.name, v: s.id }));
    list.push({ label: 'もどる', v: '__back' });
    menuList = list;
    cmdMode = 'kiai';
    cursor = 0;
  }

  // 連携技メニュー（追加弾4-B）：いま発動できるコンビ技だけを並べる。
  function _enterCombo() {
    const combos = (S && S.availableCombos) ? S.availableCombos(state.party) : [];
    const list = combos.map((c) => ({ label: '☆' + c.name, v: c.id }));
    list.push({ label: 'もどる', v: '__back' });
    menuList = list;
    cmdMode = 'combo';
    cursor = 0;
  }

  function _enterItem() {
    const ITEMS = (S && S.ITEMS) || {};
    const list = [];
    Object.keys(state.inventory || {}).forEach((id) => {
      const it = ITEMS[id];
      const c = state.inventory[id];
      if (it && it.kind === 'item' && c > 0) list.push({ label: it.name + ' x' + c, v: id });
    });
    list.push({ label: 'もどる', v: '__back' });
    menuList = list;
    cmdMode = 'item';
    cursor = 0;
  }

  // スカウト対象選択：生存していてボスでない敵だけを並べる。
  //   1体もいなければルートへ戻して「スカウトできる あいてが いない！」を出す（ターン消費しない）。
  function _enterScout() {
    const mlib = _monster();
    const list = _aliveEnemies()
      .filter((e) => mlib.canScout ? mlib.canScout(e) : !(e.isBoss === true))
      .map((e) => ({ label: e.name, v: e.id }));
    if (!list.length) {
      _buildRootMenu();
      _showMessages(['スカウトできる あいてが いない！']);
      return;
    }
    list.push({ label: 'もどる', v: '__back' });
    targetKind = 'scout';
    menuList = list;
    cmdMode = 'target';
    cursor = 0;
  }

  function _enterTarget(kind, payload) {
    targetKind = kind;
    let list;
    if (kind === 'attack' || kind === 'skill' || kind === 'kiai' || kind === 'combo') {
      list = _aliveEnemies().map((e) => ({ label: e.name, v: e.id }));
    } else {
      const includeDead = (kind === 'item' && payload && payload.effect && ('revive' in payload.effect));
      list = state.party
        .filter((p) => includeDead ? true : !_isDead(p))
        .map((p) => ({ label: p.name + (_isDead(p) ? '（たおれた）' : ''), v: p.id }));
    }
    list.push({ label: 'もどる', v: '__back' });
    menuList = list;
    cmdMode = 'target';
    cursor = 0;
  }

  function _finalize(action) {
    playerAction = action;
    _startResolve();
  }

  function _menuBack() {
    if (cmdMode === 'skill' || cmdMode === 'item' || cmdMode === 'kiai' || cmdMode === 'combo') { _buildRootMenu(); return; }
    if (cmdMode === 'target') {
      if (targetKind === 'attack') _buildRootMenu();
      else if (targetKind === 'scout') _buildRootMenu();
      else if (targetKind === 'skill' || targetKind === 'skill_heal') _enterSkill();
      else if (targetKind === 'kiai' || targetKind === 'kiai_heal') _enterKiai();
      else if (targetKind === 'combo') _enterCombo();
      else if (targetKind === 'item') _enterItem();
      else _buildRootMenu();
    }
    // root はキャンセル不可（何もしない）
  }

  function _menuSelect(item) {
    if (!item) return;
    if (cmdMode === 'root') {
      switch (item.v) {
        case 'attack': _enterTarget('attack', null); break;
        case 'skill':  _enterSkill(); break;
        case 'kiai':   _enterKiai(); break;
        case 'combo':  _enterCombo(); break;
        case 'item':   _enterItem(); break;
        case 'defend': _yuito()._defending = true; _finalize({ type: 'defend' }); break;
        case 'scout':  _enterScout(); break;
        case 'flee':   _finalize({ type: 'flee' }); break;
      }
      return;
    }
    if (cmdMode === 'skill' || cmdMode === 'kiai') {
      if (item.v === '__back') { _buildRootMenu(); return; }
      const SKILLS = (S && S.SKILLS) || {};
      const sk = SKILLS[item.v];
      pendingSkill = sk;
      const tk = (cmdMode === 'kiai') ? 'kiai' : 'skill';
      if (sk.type === 'heal') {
        if (sk.target === 'allies') _finalize({ type: 'skill', skillId: sk.id });
        else _enterTarget(tk + '_heal', sk);
      } else if (sk.type === 'buff_def') {
        _finalize({ type: 'skill', skillId: sk.id });
      } else { // attack
        if (sk.target === 'all') _finalize({ type: 'skill', skillId: sk.id });
        else _enterTarget(tk, sk);
      }
      return;
    }
    if (cmdMode === 'combo') {
      if (item.v === '__back') { _buildRootMenu(); return; }
      const COMBOS = (S && S.COMBOS) || {};
      const c = COMBOS[item.v];
      if (!c) { _buildRootMenu(); return; }
      pendingCombo = c;
      if (c.target === 'all') _finalize({ type: 'combo', comboId: c.id });
      else _enterTarget('combo', c);
      return;
    }
    if (cmdMode === 'item') {
      if (item.v === '__back') { _buildRootMenu(); return; }
      const ITEMS = (S && S.ITEMS) || {};
      pendingItem = item.v;
      _enterTarget('item', ITEMS[item.v]);
      return;
    }
    if (cmdMode === 'target') {
      if (item.v === '__back') { _menuBack(); return; }
      const targetId = item.v;
      if (targetKind === 'scout') _finalize({ type: 'scout', targetId });
      else if (targetKind === 'attack') _finalize({ type: 'attack', targetId });
      else if (targetKind === 'skill' || targetKind === 'skill_heal' ||
               targetKind === 'kiai'  || targetKind === 'kiai_heal')
        _finalize({ type: 'skill', skillId: pendingSkill.id, targetId });
      else if (targetKind === 'combo')
        _finalize({ type: 'combo', comboId: pendingCombo.id, targetId });
      else if (targetKind === 'item')
        _finalize({ type: 'item', itemId: pendingItem, targetId });
    }
  }

  function _handleCommand(pressed) {
    if (!menuList.length) return;
    if (pressed.up)    cursor = (cursor - 1 + menuList.length) % menuList.length;
    if (pressed.down)  cursor = (cursor + 1) % menuList.length;
    if (pressed.cancel) { _menuBack(); return; }
    if (pressed.confirm) _menuSelect(menuList[cursor]);
  }

  // ── 描画 ──
  function _now() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }

  function _drawBar(ctx, x, y, w, h, ratio, color, bg) {
    ratio = Math.max(0, Math.min(1, ratio || 0));
    ctx.fillStyle = bg || 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * ratio), h);
  }

  function _blob(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function _drawEnemyShape(ctx, e, cx, cy, size) {
    const COL = {
      foul_goblin:    { b: '#5bbf5b', d: '#2f7a2f', eye: '#ffe24a' },
      offside_ghost:  { b: '#cfe8ff', d: '#8fb8e0', eye: '#3a4a6a' },
      hand_monster:   { b: '#e8924a', d: '#a85f24', eye: '#ffffff' },
      yellowcard_bat: { b: '#f5d84a', d: '#bf9e10', eye: '#3a2a00' },
      redcard_devil:  { b: '#e0556b', d: '#8f2436', eye: '#ffd76e' },
      guardian:       { b: '#9aa0ac', d: '#5a606c', eye: '#5ec8ff' },
      dark_kaiser:    { b: '#6a4bce', d: '#3a2a7a', eye: '#ff5a7a' },
    };
    const c = COL[e.baseId] || { b: '#a0506e', d: '#6e2f48', eye: '#ffffff' };
    if (S && S.drawShadow) S.drawShadow(ctx, cx, cy + size * 0.55, size * 0.5, size * 0.16);
    // AI生成アート（あれば優先）。全身立ち絵なので足元を影に乗せる。
    const ART = (S && S.ENEMY_ART) ? S.ENEMY_ART : null;
    // 2段階ボスは第二形態(_phase>=2)で「怒り形態」の絵に差し替える。
    let artKey = e.art || e.baseId;
    var RAGE_ART = { dark_kaiser: 'dark_kaiser_rage', ice_golem: 'ice_golem_rage', forest_guardian: 'forest_guardian_rage' };
    if (e._phase >= 2 && RAGE_ART[e.baseId] && ART && ART[RAGE_ART[e.baseId]]) {
      artKey = RAGE_ART[e.baseId];
    }
    if (ART && ART[artKey] && S && S.drawImageSprite) {
      if (S.drawImageSprite(ctx, artKey, ART[artKey], cx, cy - size * 0.18, size * 2.55)) {
        return;
      }
    }
    ctx.save();
    if (e.baseId === 'offside_ghost') ctx.globalAlpha = 0.85;
    ctx.fillStyle = c.d; _blob(ctx, cx, cy, size * 0.52);
    ctx.fillStyle = c.b; _blob(ctx, cx, cy, size * 0.46);
    const ex = size * 0.16, ey = -size * 0.08, er = size * 0.09;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - ex, cy + ey, er, 0, Math.PI * 2);
    ctx.arc(cx + ex, cy + ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.eye;
    ctx.beginPath();
    ctx.arc(cx - ex, cy + ey, er * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + ex, cy + ey, er * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _drawBg(ctx) {
    // AI生成の背景（夜スタジアム）があれば cover（短辺合わせ）で全面描画する。
    const BG = (S && S.BG_ART) ? S.BG_ART : null;
    if (BG && BG.battle && S && S.getImageAsset) {
      const ent = S.getImageAsset('battle_bg', BG.battle);
      if (ent && ent.ready && ent.img) {
        const iw = ent.img.naturalWidth || VW;
        const ih = ent.img.naturalHeight || VH;
        const scale = Math.max(VW / iw, VH / ih);
        const dw = iw * scale, dh = ih * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(ent.img, (VW - dw) / 2, (VH - dh) / 2, dw, dh);
        ctx.restore();
        return;
      }
    }
    // フォールバック：従来のグラデーション背景＋ピッチ
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#13294a');
    g.addColorStop(0.55, '#1c3a2a');
    g.addColorStop(1, '#0e2018');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    // ピッチ（サッカー場）
    ctx.fillStyle = 'rgba(60,150,80,0.35)';
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(VW / 2, 150, 150, 55, 0, 0, Math.PI * 2);
    else ctx.rect(20, 110, VW - 40, 80);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VW / 2, 95);
    ctx.lineTo(VW / 2, 205);
    ctx.stroke();
  }

  function _drawEnemies(ctx) {
    const n = enemies.length || 1;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (_isDead(e)) continue;
      const span = 240 / n;
      const cx = 24 + span * (i + 0.5);
      const size = n === 1 ? 70 : (n === 2 ? 58 : 46);
      const cy = 95;
      // 踏み込み（sinカーブで往復）と被弾点滅は立ち絵だけに掛ける（名前/HPバーは固定位置）。
      const f = _fxOf(e.id);
      const lp = f.lungeT > 0 ? Math.sin((1 - f.lungeT / LUNGE_DUR) * Math.PI) : 0;
      ctx.save();
      if (f.hitT > 0 && Math.floor(f.hitT / 0.06) % 2 === 0) ctx.globalAlpha = 0.4;
      _drawEnemyShape(ctx, e, cx + f.ldx * lp, cy + f.ldy * lp, size);
      ctx.restore();
      if (S && S.drawText) {
        S.drawText(ctx, e.name, cx, cy + size * 0.6, { size: 10, color: '#eef', align: 'center', shadow: true });
      }
      _drawBar(ctx, cx - size * 0.42, cy + size * 0.6 + 13, size * 0.84, 4, e.hp / e.maxHp, '#5bd75b', 'rgba(0,0,0,0.5)');
      // ターゲット選択中のマーカー
      if (cmdMode === 'target' && (targetKind === 'attack' || targetKind === 'skill' || targetKind === 'kiai' || targetKind === 'combo' || targetKind === 'scout')
          && menuList[cursor] && menuList[cursor].v === e.id) {
        if (Math.floor(_now() / 300) % 2 === 0 && S && S.drawText) {
          S.drawText(ctx, '▼', cx, cy - size * 0.72, { size: 16, color: '#ffd76e', align: 'center' });
        }
      }
    }
  }

  function _drawAllies(ctx) {
    // 味方5人のAI立ち絵を、状態ストリップの真上に横並びで描く（敵=奥／味方=手前）。
    // 足元をストリップ上端へ少し潜らせ、_drawPartyStrip の窓で隠して地に着けて見せる。
    if (!(S && S.drawImageSprite)) return;
    const ART = (S && S.ALLY_ART) ? S.ALLY_ART : null;
    const EART = (S && S.ENEMY_ART) ? S.ENEMY_ART : null;
    const p = state.party, n = p.length || 1;
    const colW = AW / n;
    const boxH = Math.min(60, colW * 1.05);
    const yFeet = PSY + 4;
    for (let i = 0; i < p.length; i++) {
      const m = p[i];
      // モンスター味方は ALLY_ART にキーが無いので ENEMY_ART[baseId] で描画する。
      const isMon = m.isMonster;
      const artData = isMon ? (EART && EART[m.baseId]) : (ART && ART[m.id]);
      const artKey  = isMon ? ('monally_' + m.baseId) : ('ally_' + m.id);
      if (!artData) continue;
      const cx = AX + colW * i + colW / 2;
      const cy = yFeet - boxH / 2;
      const dead = _isDead(m);
      // 踏み込み（往復）と被弾点滅を立ち絵に掛ける。
      const f = _fxOf(m.id);
      const lp = f.lungeT > 0 ? Math.sin((1 - f.lungeT / LUNGE_DUR) * Math.PI) : 0;
      ctx.save();
      if (dead) ctx.globalAlpha = 0.3;
      else if (f.hitT > 0 && Math.floor(f.hitT / 0.06) % 2 === 0) ctx.globalAlpha = 0.4;
      // 敵アートとキー衝突しないよう 'ally_'/'monally_' を前置（getImageAsset はキー単位でキャッシュ）。
      S.drawImageSprite(ctx, artKey, artData, cx + f.ldx * lp, cy + f.ldy * lp, boxH);
      ctx.restore();
    }
  }

  function _drawPartyStrip(ctx) {
    if (!(S && S.drawWindow)) return;
    const p = state.party, n = p.length || 1;
    S.drawWindow(ctx, AX, PSY, AW, PSH, { radius: 8, border: '#3a5a8a' });
    const colW = AW / n;
    for (let i = 0; i < p.length; i++) {
      const m = p[i];
      const cx = AX + colW * i + colW / 2;
      const dead = _isDead(m);
      S.drawText(ctx, m.name, cx, PSY + 3, { size: 10, color: dead ? '#7788aa' : '#ffffff', align: 'center' });
      const bx = AX + colW * i + 6, bw = colW - 12;
      _drawBar(ctx, bx, PSY + 16, bw, 7, dead ? 0 : m.hp / m.maxHp, '#5bd75b', 'rgba(0,0,0,0.5)');
      S.drawText(ctx, dead ? 'ダウン' : (m.hp + '/' + m.maxHp), cx, PSY + 16, { size: 8, color: '#ffffff', align: 'center' });
      _drawBar(ctx, bx, PSY + 26, bw, 4, dead ? 0 : m.mp / Math.max(1, m.maxMp), '#5aa0ff', 'rgba(0,0,0,0.5)');
      // キアイゲージ（金色）。MAXのときは点滅して必殺技OKを知らせる。
      const kr = dead ? 0 : (m.kiai || 0) / Math.max(1, m.maxKiai || 100);
      const kFull = kr >= 1;
      const kColor = (kFull && Math.floor(_now() / 250) % 2 === 0) ? '#fff4c2' : '#ffd24a';
      _drawBar(ctx, bx, PSY + 32, bw, 3, kr, kColor, 'rgba(0,0,0,0.5)');
    }
  }

  function _drawActionMenu(ctx) {
    if (!(S && S.drawWindow && S.drawText)) return;
    S.drawWindow(ctx, AX, ACY, AW, ACH, { radius: 8, border: '#5ec8ff' });
    const list = menuList || [];
    // どうぐモードは下部に説明フッターを置くので、その分だけ行間を詰める。
    const showDesc = (cmdMode === 'item');
    const footerH = showDesc ? 30 : 0;
    const rowH = Math.min(20, (ACH - 16 - footerH) / Math.max(1, list.length));
    for (let i = 0; i < list.length; i++) {
      const y = ACY + 10 + i * rowH;
      if (i === cursor) S.drawText(ctx, '▶', AX + 10, y, { size: 14, color: '#ffd76e' });
      S.drawText(ctx, list[i].label, AX + 28, y, { size: 14, color: i === cursor ? '#ffffff' : '#cfe0ff' });
    }
    // 選択中どうぐの説明（効果が分かるように）。
    if (showDesc) {
      const ITEMS = (S && S.ITEMS) || {};
      const cur = list[cursor];
      const det = cur && cur.v ? ITEMS[cur.v] : null;
      if (det && det.desc) {
        const dl = (S.wrapText ? S.wrapText(det.desc, 24) : [det.desc]);
        for (let d = 0; d < Math.min(2, dl.length); d++) {
          S.drawText(ctx, dl[d], AX + 12, ACY + ACH - 28 + d * 14, { size: 10, color: '#bfe6c8' });
        }
      }
    }
  }

  function _drawMessage(ctx) {
    if (!(S && S.drawWindow && S.drawText)) return;
    S.drawWindow(ctx, AX, ACY, AW, ACH, { radius: 8, border: '#5ec8ff' });
    const vis = _msg.getVisibleText ? _msg.getVisibleText() : '';
    const lines = (S.wrapText ? S.wrapText(vis, 17) : [vis]);
    for (let i = 0; i < lines.length; i++) {
      S.drawText(ctx, lines[i], AX + 12, ACY + 12 + i * 20, { size: 14, color: '#dff4ff' });
    }
    if (_msg.isPageComplete && _msg.isPageComplete() && !(_msg.isDone && _msg.isDone())) {
      if (Math.floor(_now() / 400) % 2 === 0) {
        S.drawText(ctx, '▼', AX + AW - 24, ACY + ACH - 22, { size: 12, color: '#5ec8ff' });
      }
    }
  }

  // 着弾エフェクト（衝撃／斬撃／技リング／☆バースト／破裂きらめき／回復キラ）を描く。
  function _drawFx(ctx) {
    for (let k = 0; k < _impacts.length; k++) {
      const m = _impacts[k];
      const p = Math.min(1, m.t / (m.dur || IMPACT_DUR));
      const sc = m.scale || 1;
      if (m.kind === 'hit') {
        const r = (6 + p * 26) * sc;
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.8;
        ctx.fillStyle = m.color || '#ff5a5a';
        _blob(ctx, m.x, m.y, r);
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.fillStyle = '#ffffff';
        _blob(ctx, m.x, m.y, r * 0.4);
        ctx.restore();
      } else if (m.kind === 'slash') {
        const len = 14 + p * 18;
        ctx.save();
        ctx.globalAlpha = (1 - p);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(m.x - len, m.y - len); ctx.lineTo(m.x + len, m.y + len);
        ctx.moveTo(m.x + len, m.y - len); ctx.lineTo(m.x - len, m.y + len);
        ctx.stroke();
        ctx.restore();
      } else if (m.kind === 'ring') {
        const r = (4 + p * 30) * sc;
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.strokeStyle = m.color || '#ffe6a0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (m.kind === 'star') {
        // ☆バースト（こうかばつぐん）：放射状に飛び散る星のスパーク。
        ctx.save();
        ctx.globalAlpha = (1 - p);
        ctx.fillStyle = m.color || '#ffe24a';
        const rays = 8, reach = (10 + p * 26) * sc, ss = (4 - p * 2) * sc;
        for (let i = 0; i < rays; i++) {
          const ang = (i / rays) * Math.PI * 2 + p * 0.6;
          _star(ctx, m.x + Math.cos(ang) * reach, m.y + Math.sin(ang) * reach, ss, ss * 0.45);
        }
        // 中央の大きなキラッ
        ctx.globalAlpha = (1 - p) * 0.95;
        ctx.fillStyle = '#ffffff';
        _star(ctx, m.x, m.y, (7 - p * 4) * sc, (3 - p * 1.5) * sc);
        ctx.restore();
      } else if (m.kind === 'burst') {
        // 破裂きらめき（撃破/カットイン）：白い膨張リング＋飛び散る粒。
        ctx.save();
        const r = (8 + p * 40) * sc;
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.strokeStyle = m.color || '#fff4c2';
        ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        const parts = 10;
        for (let i = 0; i < parts; i++) {
          const ang = (i / parts) * Math.PI * 2;
          const pr = (12 + p * 36) * sc;
          ctx.globalAlpha = (1 - p) * 0.85;
          _blob(ctx, m.x + Math.cos(ang) * pr, m.y + Math.sin(ang) * pr, (3 - p * 2.4) * sc + 0.5);
        }
        ctx.restore();
      } else if (m.kind === 'sparkle') {
        // 回復キラ：ゆらゆら上がる緑のきらめき。
        ctx.save();
        ctx.fillStyle = m.color || '#bfffc8';
        const parts = 6;
        for (let i = 0; i < parts; i++) {
          const ang = (i / parts) * Math.PI * 2;
          const rr = (8 + p * 16) * sc;
          const px = m.x + Math.cos(ang) * rr;
          const py = m.y + Math.sin(ang) * rr * 0.7 - p * 14;
          ctx.globalAlpha = (1 - p) * 0.95;
          _star(ctx, px, py, (3.5 - p * 2) * sc, (1.6 - p) * sc);
        }
        ctx.restore();
      }
    }
  }

  // 小さな4方向の星（とがった十字きらめき）を塗る。r=外半径, ri=内半径。
  function _star(ctx, cx, cy, r, ri) {
    r = Math.max(0.5, r); ri = Math.max(0.2, ri);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rad = (i % 2 === 0) ? r : ri;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 浮遊するダメージ／回復の数字を描く（上にゆっくり上がって消える）。
  function _drawFloaters(ctx) {
    if (!(S && S.drawText)) return;
    for (let k = 0; k < _floaters.length; k++) {
      const f = _floaters[k];
      const p = Math.min(1, f.t / FLOAT_DUR);
      const y = f.y - 4 - p * 22;
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      S.drawText(ctx, f.text, f.x, y, { size: f.size || 16, color: f.color || '#fff', align: 'center', shadow: true });
      ctx.restore();
    }
  }

  // 画面全体のフラッシュ（味方被弾=赤／必殺カットイン=技色／撃破=金）。
  function _drawScreenFlash(ctx) {
    if (flashT <= 0) return;
    const p = flashT / (flashDur || FLASH_DUR);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * (flashMax || 0.42));
    ctx.fillStyle = flashColor || '#ff2a2a';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }

  // ── 開始 ──
  if (!enemies.length) _showMessages(['…てきは いなかった。'], _popToField);
  else _showMessages(_introLines(), _startCommandPhase);

  return {
    update: function (dt, input) {
      if (!S) return;
      // バトルBGMを毎フレーム保証。戦闘を抜けるとフィールド側の update が
      // 自分のステージBGMへ戻すので、ここでは 'battle' を鳴らすだけでよい。
      if (S.playBgm) S.playBgm('battle');
      _advanceFx(dt);   // メッセージ表示中もエフェクトは進める（先頭で必ず呼ぶ）
      const pressed = (input && input.pressed) || {};
      if (_msg) {
        const r = _msg.update(dt, !!pressed.confirm);
        if (r && r.done) {
          const cb = _msgDone;
          _msg = null; _msgDone = null;
          if (cb) cb();
        }
        return;
      }
      if (phase === 'command') _handleCommand(pressed);
    },
    draw: function (ctx) {
      if (!S) return;
      _drawBg(ctx);   // 背景は揺らさない（戦闘員だけ揺らすと見やすい）
      const sh = shakeT > 0 ? shakeT / SHAKE_DUR : 0;
      const amp = shakeAmp || 6;
      const jx = sh > 0 ? (Math.random() * 2 - 1) * sh * amp : 0;
      const jy = sh > 0 ? (Math.random() * 2 - 1) * sh * amp : 0;
      ctx.save();
      // カットインの一瞬ズームパンチ：戦闘ステージ中心(VW/2, 120付近)を基準に 1.0→約1.06→1.0。
      if (zoomT > 0) {
        const zp = Math.sin((zoomT / ZOOM_DUR) * Math.PI); // 0→1→0
        const zs = 1 + 0.06 * zp;
        const zcx = VW / 2, zcy = 120;
        ctx.translate(zcx, zcy);
        ctx.scale(zs, zs);
        ctx.translate(-zcx, -zcy);
      }
      ctx.translate(jx, jy);
      _drawEnemies(ctx);
      _drawAllies(ctx);
      _drawFx(ctx);
      ctx.restore();
      _drawPartyStrip(ctx);
      _drawFloaters(ctx);     // 数字は揺らさず固定座標で上昇
      _drawScreenFlash(ctx);  // 味方被弾の画面赤フラッシュ
      if (_msg) _drawMessage(ctx);
      else if (phase === 'command') _drawActionMenu(ctx);
    },
  };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis,
   { createBattleScene, spawnEnemies, spawnForced, buildTurnOrder, chooseEnemyAction, calcReward, difficultyScale, newGamePlusScale });
