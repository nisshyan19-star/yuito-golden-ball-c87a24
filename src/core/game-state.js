// CHARACTERS は遅延解決する。ブラウザでは <script> の読み込み順に依存せず、
// 実際に呼ばれた時点で window.SRPG.CHARACTERS を参照する（characters.js が後でも安全）。
function _characters() {
  if (typeof require !== 'undefined') return require('../data/characters.js').CHARACTERS;
  return (typeof window !== 'undefined' && window.SRPG && window.SRPG.CHARACTERS) || {};
}

function createCharacter(id) {
  const def = _characters()[id];
  if (!def) throw new Error('Unknown character id: ' + id);
  return {
    id:       def.id,
    name:     def.name,
    position: def.position,
    type:     def.type || 'power',   // タイプ相性（パワー/スピード/テクニック）
    level:    1,
    exp:      0,
    maxHp:    def.base.hp,
    hp:       def.base.hp,
    maxMp:    def.base.mp,
    mp:       def.base.mp,
    atk:      def.base.atk,
    def:      def.base.def,
    spd:      def.base.spd,
    kiai:     0,                      // キアイゲージ（0..maxKiai／MAXで必殺技解放）
    maxKiai:  100,
    skills:   [...def.skills],
    growth:   { ...def.growth },
    equip:    { weapon: null, armor: null },
    dead:     false,
  };
}

function createNewGame() {
  return {
    party:    [createCharacter('yuito')],
    roster:   [],  // なかまモンスターの 控え（追加弾5-B。パーティが満員のとき ここへ）
    inventory:{ drink: 2 },
    gold:     0,
    flags:    {},
    dex:      {},   // モンスターずかん：{ baseId: たおした数 }（弾3 やりこみ）
    achievements: {}, // じっせき：{ id: true }（追加弾3 やりこみ）
    title:    null, // そうび中の称号 id（追加弾4-A／null=なし。パーティ全員に効果）
    position: { map: 'field1', x: 5, y: 5 },
    settings: { autoAllies: true, difficulty: 'normal' }, // やさしい/ふつう/むずかしい（タイトルで選択）
  };
}

// つよくてニューゲーム（追加弾4-C）。
//   ラスボスを たおした セーブから 2しゅうめ いこうを はじめる。
//   ひきつぐ：パーティ（レベル/けいけんち/とくぎ/そうび）・もちもの・ゴールド・
//            ずかん・じっせき・そうび中の称号・せってい（むずかしさ等）。
//   リセット：フラグ（ストーリー進行・ボス・たからばこ）と いる場所（field1 に もどる）。
//   state.clearCount（しゅうかい数）を +1 する＝戦闘で 敵が しゅうかいぶん つよくなる
//   （battle-scene の newGamePlusScale が この値を使う）。
//   prevState は破壊しない（structuredClone でディープコピーしてから組み立てる）。
function createNewGamePlus(prevState) {
  var prev = prevState || {};
  // パーティは レベル/けいけんち/とくぎ/そうびを たもったまま、
  // HP/MP 全回復・キアイ0・戦闘不能解除 で 2しゅうめへ。
  var src = (prev.party && prev.party.length) ? prev.party : [createCharacter('yuito')];
  var party = src.map(function (p) {
    var c = structuredClone(p);
    c.hp = c.maxHp;
    c.mp = c.maxMp;
    c.kiai = 0;
    c.dead = false;
    return c;
  });
  // なかまモンスターの控えも HP/MP全回復・キアイ0・戦闘不能解除で ひきつぐ（追加弾5-B）
  var roster = (prev.roster || []).map(function (p) {
    var c = structuredClone(p);
    c.hp = c.maxHp;
    c.mp = c.maxMp;
    c.kiai = 0;
    c.dead = false;
    return c;
  });
  return {
    party:        party,
    roster:       roster,
    inventory:    structuredClone(prev.inventory || { drink: 2 }),
    gold:         prev.gold || 0,
    flags:        {},                                        // ストーリー/ボス/宝は はじめから
    dex:          structuredClone(prev.dex || {}),           // ずかんは えいぞく（やりこみ）
    achievements: structuredClone(prev.achievements || {}), // じっせきも えいぞく
    title:        prev.title || null,                        // そうび中の称号は いじする
    clearCount:   (prev.clearCount || 0) + 1,                // しゅうかい数（2しゅうめ=1, 3しゅうめ=2 …）
    position:     { map: 'field1', x: 5, y: 5 },
    settings:     structuredClone(prev.settings || { autoAllies: true, difficulty: 'normal' }),
  };
}

function cloneState(s) {
  return structuredClone(s);
}

// ── 実績システム（追加弾3・やりこみ） ───────────────────────────────────
//   すべて state だけから判定できる純関数で構成（外部データに依存しない）。
//   各実績は { id, name, desc, check(state)->bool }。
function _dexTotal(s)    { var d = (s && s.dex) || {}; var n = 0; for (var k in d) n += (d[k] || 0); return n; }
function _dexDistinct(s) { var d = (s && s.dex) || {}; var n = 0; for (var k in d) if ((d[k] || 0) > 0) n++; return n; }
function _maxLevel(s)    { return ((s && s.party) || []).reduce(function (m, p) { return Math.max(m, p.level || 1); }, 1); }
function _flag(s, f)     { return !!(s && s.flags && s.flags[f]); }

var ACHIEVEMENTS = [
  { id:'first_win',     name:'はじめての しょうり',     desc:'はじめて てきに かった',          check: function (s) { return _dexTotal(s) >= 1; } },
  { id:'dex_10',        name:'ものしり マネージャー',   desc:'ずかんに 10しゅるい きろく',       check: function (s) { return _dexDistinct(s) >= 10; } },
  { id:'beat_guardian', name:'てっぺき とっぱ',         desc:'ガーディアンを たおした',          check: function (s) { return _flag(s, 'boss_guardian'); } },
  { id:'beat_kaiser',   name:'やみを はらいし もの',    desc:'ダーク・カイザーを たおした',      check: function (s) { return _flag(s, 'boss_kaiser'); } },
  { id:'beat_phantom',  name:'まぼろし ハンター',       desc:'ファントムを たおした',            check: function (s) { return _flag(s, 'boss_phantom'); } },
  { id:'beat_emperor',  name:'でんせつの エース',       desc:'ゴールド・エンペラーを たおした',  check: function (s) { return _flag(s, 'boss_emperor'); } },
  { id:'rare_golden',   name:'きらめき ハンター',       desc:'きらめきサッカーボール ほかく',    check: function (s) { return ((s.dex || {}).golden_ball || 0) >= 1; } },
  { id:'rare_metal',    name:'メタル ハンター',         desc:'メタルゴーレム ほかく',            check: function (s) { return ((s.dex || {}).metal_keeper || 0) >= 1; } },
  { id:'full_party',    name:'さいきょうの チーム',     desc:'なかま 5にん あつめた',            check: function (s) { return ((s.party || []).length) >= 5; } },
  { id:'rich',          name:'おかねもち',              desc:'500G いじょう もった',             check: function (s) { return (s.gold || 0) >= 500; } },
  { id:'level_15',      name:'たくましく せいちょう',   desc:'レベル15に とうたつ',              check: function (s) { return _maxLevel(s) >= 15; } },
  { id:'pk_master',     name:'PK せいは',               desc:'PKせんで かった',                  check: function (s) { return _flag(s, 'pk_master'); } },
  { id:'secret_room',   name:'なぞとき めいじん',       desc:'ひみつの へやを クリア',           check: function (s) { return _flag(s, 'secret_puzzle'); } },
  { id:'tournament_champion', name:'トーナメント せいは', desc:'トーナメントで ゆうしょうした', check: function (s) { return _flag(s, 'tournament_champion'); } },
];

// checkAchievements: 未解除の実績で条件を満たしたものを解除し、
//   新しく解除した実績の配列を返す（state.achievements を破壊的に更新）。
//   べき等：解除済みは再判定せず、2回目以降は [] を返す。
function checkAchievements(state) {
  if (!state) return [];
  if (!state.achievements) state.achievements = {};
  var unlocked = [];
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    if (state.achievements[a.id]) continue;
    var ok = false;
    try { ok = !!a.check(state); } catch (e) { ok = false; }
    if (ok) { state.achievements[a.id] = true; unlocked.push(a); }
  }
  return unlocked;
}

// ── 称号システム（追加弾4-A・やりこみ） ─────────────────────────────────
//   実績を解除すると対応する称号が手に入り、メニューで 1つだけ「そうび」できる。
//   そうび中の称号はパーティ全員に小さな能力ボーナス（atk/def）を与える。
//   req は ACHIEVEMENTS の id。bonus は控えめ（最大でも atk+4/def+3）。
var TITLES = [
  { id:'rookie',   name:'ルーキー',                req:'first_win',     bonus:{ atk:1, def:0 }, desc:'はじめての しょうりの あかし' },
  { id:'manager',  name:'ものしり マネージャー',   req:'dex_10',        bonus:{ atk:0, def:2 }, desc:'ずかんを 10しゅるい うめた' },
  { id:'breaker',  name:'かべ くずし',             req:'beat_guardian', bonus:{ atk:2, def:1 }, desc:'ガーディアンを やぶった しょうこ' },
  { id:'hero',     name:'やみを はらいし えいゆう',req:'beat_kaiser',   bonus:{ atk:3, def:2 }, desc:'ダーク・カイザーを たおした' },
  { id:'hunter',   name:'まぼろし ハンター',       req:'beat_phantom',  bonus:{ atk:2, def:2 }, desc:'ファントムを かりとった' },
  { id:'ace',      name:'でんせつの エース',       req:'beat_emperor',  bonus:{ atk:4, def:3 }, desc:'ゴールド・エンペラーを こえた さいきょうの あかし' },
  { id:'shiner',   name:'きらめき コレクター',     req:'rare_golden',   bonus:{ atk:2, def:1 }, desc:'きらめきサッカーボールを つかまえた' },
  { id:'metaler',  name:'メタル ブレイカー',       req:'rare_metal',    bonus:{ atk:1, def:3 }, desc:'メタルゴーレムを うちやぶった' },
  { id:'captain',  name:'キャプテン',              req:'full_party',    bonus:{ atk:1, def:1 }, desc:'なかま 5にんの チームの しるし' },
  { id:'tycoon',   name:'だい ふごう',             req:'rich',          bonus:{ atk:0, def:2 }, desc:'たくさんの ゴールドを ためた' },
  { id:'veteran',  name:'ベテラン せんしゅ',       req:'level_15',      bonus:{ atk:2, def:2 }, desc:'レベル15まで そだった' },
  { id:'pk_king',  name:'PK キング',               req:'pk_master',     bonus:{ atk:3, def:0 }, desc:'PKせんを せいはした' },
  { id:'solver',   name:'なぞとき めいじん',       req:'secret_room',   bonus:{ atk:1, def:2 }, desc:'ひみつの へやを ときあかした' },
  { id:'champion', name:'チャンピオン',            req:'tournament_champion', bonus:{ atk:4, def:4 }, desc:'サッカー トーナメントを せいはした さいきょうの あかし' },
];

function _titleById(id) {
  for (var i = 0; i < TITLES.length; i++) if (TITLES[i].id === id) return TITLES[i];
  return null;
}

// unlockedTitles: req 実績が解除済みの称号だけを返す（手に入れた称号一覧）。
function unlockedTitles(state) {
  var got = (state && state.achievements) || {};
  return TITLES.filter(function (t) { return !!got[t.req]; });
}

// equipTitle: 称号を そうび／解除する。
//   id=null → 称号を外す（必ず成功）。
//   解除済みの称号 → そうび（state.title 更新）。
//   未解除 or 存在しない id → 何もせず false。
function equipTitle(state, id) {
  if (!state) return false;
  if (id == null) { state.title = null; return true; }
  var t = _titleById(id);
  if (!t) return false;
  var got = state.achievements || {};
  if (!got[t.req]) return false;
  state.title = id;
  return true;
}

// titleBonus: そうび中の称号の能力ボーナス {atk,def} を返す（無装備/未解除はゼロ）。
//   battle-scene の _eff から味方の実効値に加算される。
function titleBonus(state) {
  var none = { atk: 0, def: 0 };
  if (!state || !state.title) return none;
  var t = _titleById(state.title);
  if (!t) return none;
  var got = state.achievements || {};
  if (!got[t.req]) return none; // 不正に title だけ残っても効果は出さない（保険）
  return { atk: (t.bonus && t.bonus.atk) || 0, def: (t.bonus && t.bonus.def) || 0 };
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  createCharacter, createNewGame, createNewGamePlus, cloneState, ACHIEVEMENTS, checkAchievements,
  TITLES, titleBonus, unlockedTitles, equipTitle,
});
