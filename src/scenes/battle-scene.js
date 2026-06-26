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

  // ── 状態 ──
  let phase = 'intro';        // 'intro' | 'command' | 'resolve' | 'over'
  let round = 0;
  let _msg = null, _msgDone = null;
  let cmdMode = 'root';       // 'root' | 'skill' | 'item' | 'target'
  let cursor = 0;
  let menuList = [];
  let pendingSkill = null, pendingItem = null, targetKind = null;
  let playerAction = null;
  let actionQueue = [], aqIndex = 0;
  let fleeFailMsg = false;

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
    if (!e || !e.phases || _isDead(e) || e._phase >= 2) return null;
    const ph = e.phases[1];
    if (!ph) return null;
    const ratio = (ph.hpRatio != null) ? ph.hpRatio : 0.5;
    if (e.hp / e.maxHp > ratio) return null;
    if (ph.atk != null) e.atk = ph.atk;
    if (ph.def != null) e.def = ph.def;
    if (ph.spd != null) e.spd = ph.spd;
    e._phase = 2;
    return e.name + 'は ほんきを だしてきた！';
  }

  function _eff(u) {
    if (u.isEnemy) return { atk: u.atk, def: u.def };
    if (S && S.applyEquip) { const e = S.applyEquip(u); return { atk: e.atk, def: e.def }; }
    return { atk: u.atk, def: u.def };
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

  function _introText() {
    if (!enemies.length) return '…てきは いなかった。';
    const names = enemies.map((e) => e.name);
    if (names.length === 1) return names[0] + 'が あらわれた！';
    return names.join('と') + 'が あらわれた！';
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
    let dmg;
    if (S && S.calcDamage) dmg = S.calcDamage({ atk: a }, { def: d }, { power: power || 1, rng });
    else dmg = Math.max(1, Math.round((a - d / 2) * (power || 1)));
    if (target._defending) dmg = Math.max(1, Math.floor(dmg / 2));
    if (S && S.applyDamage) S.applyDamage(target, dmg);
    else { target.hp = Math.max(0, target.hp - dmg); if (target.hp === 0) target.dead = true; }
    return dmg;
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
    const dmg = _dealAttack(actor, target, 1);
    const pages = [actor.name + 'の こうげき！\n' + target.name + 'に ' + dmg + 'の ダメージ！'];
    if (_isDead(target)) pages.push(_deathLine(target));
    return pages;
  }

  function _useSkill(actor, skillId, targetId) {
    const SKILLS = (S && S.SKILLS) || {};
    const sk = SKILLS[skillId];
    if (!sk) return _attack(actor, _findUnit(targetId));
    if (actor.mp < sk.mp) return [actor.name + 'は スタミナが たりない！'];
    actor.mp -= sk.mp;
    const pages = [actor.name + 'の 「' + sk.name + '」！'];

    if (sk.type === 'attack') {
      if (sk.target === 'all') {
        const targets = _aliveEnemies();
        targets.forEach((t) => _dealAttack(actor, t, sk.power || 1));
        pages.push('てき ぜんたいに ダメージ！');
        targets.filter(_isDead).forEach((t) => pages.push(_deathLine(t)));
      } else {
        let t = _findUnit(targetId);
        if (!t || _isDead(t)) t = _aliveEnemies()[0];
        if (t) {
          const dmg = _dealAttack(actor, t, sk.power || 1);
          pages.push(t.name + 'に ' + dmg + 'の ダメージ！');
          if (_isDead(t)) pages.push(_deathLine(t));
        }
      }
    } else if (sk.type === 'heal') {
      const amt = sk.heal || sk.amount || 0;
      if (sk.target === 'allies') {
        _aliveParty().forEach((a) => { a.hp = Math.min(a.maxHp, a.hp + amt); });
        pages.push('みんなの HPが かいふくした！');
      } else {
        let t = _findUnit(targetId) || actor;
        t.hp = Math.min(t.maxHp, t.hp + amt);
        pages.push(t.name + 'の HPが かいふくした！');
      }
    } else if (sk.type === 'buff_def') {
      let t = _findUnit(targetId) || actor;
      t._defending = true;
      pages.push(t.name + 'の まもりが かたくなった！');
    } else {
      pages.push('こうかが なかった…');
    }
    return pages;
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

  function _performAction(actor) {
    if (actor.isEnemy) {
      const act = chooseEnemyAction(actor, state.party, rng);
      return _attack(actor, _findUnit(act.targetId));
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
      case 'defend': actor._defending = true; return [actor.name + 'は みをまもっている！'];
      case 'attack': return _attack(actor, _findUnit(action.targetId));
      case 'skill':  return _useSkill(actor, action.skillId, action.targetId);
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
    state.gold = (state.gold || 0) + reward.gold;
    const SKILLS = (S && S.SKILLS) || {};
    const pages = ['てきを たおした！',
      'けいけんち ' + reward.exp + ' かくとく！\n' + reward.gold + 'ゴールド てにいれた！'];
    _aliveParty().forEach((m) => {
      if (!(S && S.gainExp)) return;
      const res = S.gainExp(m, reward.exp);
      if (res.leveledUp) pages.push(m.name + 'は レベル ' + m.level + 'に あがった！');
      (res.learned || []).forEach((sid) => {
        const sk = SKILLS[sid];
        if (sk) pages.push(m.name + 'は 「' + sk.name + '」を おぼえた！');
      });
    });
    // ボス撃破ならフラグを立ててから保存（フィールド再構築/エンディング判定に使う）
    if (opts.winFlag || opts.vanishFlag) {
      state.flags = state.flags || {};
      if (opts.winFlag)    state.flags[opts.winFlag] = true;
      if (opts.vanishFlag) state.flags[opts.vanishFlag] = true;
    }
    if (S && S.saveGame) S.saveGame(state);

    // 勝利後のルーティング
    if (opts.ending) { _showMessages(pages, _goEnding); return; }
    if (opts.winFlag || opts.vanishFlag) { _showMessages(pages, _returnToFieldRebuild); return; }
    _showMessages(pages, _popToField);
  }

  function _onDefeat() {
    // やさしい難易度：ゲームオーバーにせず全回復で立て直す
    state.party.forEach((m) => { m.dead = false; m.hp = m.maxHp; m.mp = m.maxMp; });
    if (S && S.saveGame) S.saveGame(state);
    _showMessages([
      'ぜんいん たおれてしまった…',
      'でも ユイトたちは あきらめない！',
      'きあいで たちあがった！（HP かいふく）',
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
      { label: 'どうぐ',   v: 'item' },
      { label: 'ぼうぎょ', v: 'defend' },
    ];
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
      .filter((s) => s && (s.type === 'attack' || s.type === 'heal' || s.type === 'buff_def') && y.mp >= s.mp)
      .map((s) => ({ label: s.name + ' (' + s.mp + ')', v: s.id }));
    list.push({ label: 'もどる', v: '__back' });
    menuList = list;
    cmdMode = 'skill';
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

  function _enterTarget(kind, payload) {
    targetKind = kind;
    let list;
    if (kind === 'attack' || kind === 'skill') {
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
    if (cmdMode === 'skill' || cmdMode === 'item') { _buildRootMenu(); return; }
    if (cmdMode === 'target') {
      if (targetKind === 'attack') _buildRootMenu();
      else if (targetKind === 'skill') _enterSkill();
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
        case 'item':   _enterItem(); break;
        case 'defend': _yuito()._defending = true; _finalize({ type: 'defend' }); break;
        case 'flee':   _finalize({ type: 'flee' }); break;
      }
      return;
    }
    if (cmdMode === 'skill') {
      if (item.v === '__back') { _buildRootMenu(); return; }
      const SKILLS = (S && S.SKILLS) || {};
      const sk = SKILLS[item.v];
      pendingSkill = sk;
      if (sk.type === 'heal') {
        if (sk.target === 'allies') _finalize({ type: 'skill', skillId: sk.id });
        else _enterTarget('skill_heal', sk);
      } else if (sk.type === 'buff_def') {
        _finalize({ type: 'skill', skillId: sk.id });
      } else { // attack
        if (sk.target === 'all') _finalize({ type: 'skill', skillId: sk.id });
        else _enterTarget('skill', sk);
      }
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
      if (targetKind === 'attack') _finalize({ type: 'attack', targetId });
      else if (targetKind === 'skill' || targetKind === 'skill_heal')
        _finalize({ type: 'skill', skillId: pendingSkill.id, targetId });
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
    if (ART && ART[e.baseId] && S && S.drawImageSprite) {
      if (S.drawImageSprite(ctx, e.baseId, ART[e.baseId], cx, cy - size * 0.18, size * 2.55)) {
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
      _drawEnemyShape(ctx, e, cx, cy, size);
      if (S && S.drawText) {
        S.drawText(ctx, e.name, cx, cy + size * 0.6, { size: 10, color: '#eef', align: 'center', shadow: true });
      }
      _drawBar(ctx, cx - size * 0.42, cy + size * 0.6 + 13, size * 0.84, 4, e.hp / e.maxHp, '#5bd75b', 'rgba(0,0,0,0.5)');
      // ターゲット選択中のマーカー
      if (cmdMode === 'target' && (targetKind === 'attack' || targetKind === 'skill')
          && menuList[cursor] && menuList[cursor].v === e.id) {
        if (Math.floor(_now() / 300) % 2 === 0 && S && S.drawText) {
          S.drawText(ctx, '▼', cx, cy - size * 0.72, { size: 16, color: '#ffd76e', align: 'center' });
        }
      }
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
    }
  }

  function _drawActionMenu(ctx) {
    if (!(S && S.drawWindow && S.drawText)) return;
    S.drawWindow(ctx, AX, ACY, AW, ACH, { radius: 8, border: '#5ec8ff' });
    const list = menuList || [];
    const rowH = Math.min(20, (ACH - 16) / Math.max(1, list.length));
    for (let i = 0; i < list.length; i++) {
      const y = ACY + 10 + i * rowH;
      if (i === cursor) S.drawText(ctx, '▶', AX + 10, y, { size: 14, color: '#ffd76e' });
      S.drawText(ctx, list[i].label, AX + 28, y, { size: 14, color: i === cursor ? '#ffffff' : '#cfe0ff' });
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

  // ── 開始 ──
  if (!enemies.length) _showMessages(['…てきは いなかった。'], _popToField);
  else _showMessages([_introText()], _startCommandPhase);

  return {
    update: function (dt, input) {
      if (!S) return;
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
      _drawBg(ctx);
      _drawEnemies(ctx);
      _drawPartyStrip(ctx);
      if (_msg) _drawMessage(ctx);
      else if (phase === 'command') _drawActionMenu(ctx);
    },
  };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis,
   { createBattleScene, spawnEnemies, buildTurnOrder, chooseEnemyAction, calcReward });
