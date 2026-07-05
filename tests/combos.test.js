// === combos.test.js（追加弾4-B：連携技／コンビ必殺技） ===
// 連携技データの形と、発動条件の純粋関数 availableCombos を検証する。
// 戦闘内での実発動（コマンド選択→キアイ全消費→大ダメージ）はブラウザで非破壊目視する
// （既存の battle-scene.test.js と同じく、シーンの update/draw は node では検証しない方針）。
const test   = require('node:test');
const assert = require('node:assert');
const { COMBOS, SKILLS } = require('../src/data/skills.js');
const { availableCombos } = require('../src/logic/battle.js');

// ── テスト用：キアイMAXの味方ユニットを作る ─────────────────────────────
function unit(id, over) {
  return Object.assign({
    id, name: id, type: 'power', level: 10,
    maxHp: 100, hp: 100, maxMp: 30, mp: 30,
    atk: 30, def: 10, spd: 10,
    kiai: 100, maxKiai: 100, dead: false,
  }, over || {});
}

// ── データ形 ──────────────────────────────────────────────────────────
test('COMBOS は {id,name,desc,members,type,power,target} の連想配列で id 一意', () => {
  assert.ok(COMBOS && typeof COMBOS === 'object', 'COMBOS が無い');
  const ids = Object.keys(COMBOS);
  assert.ok(ids.length >= 4, 'コンビ技は4つ以上');
  const seen = {};
  ids.forEach((k) => {
    const c = COMBOS[k];
    assert.strictEqual(c.id, k, 'キーと id が一致しない: ' + k);
    assert.ok(c.name && typeof c.name === 'string', 'name が無い: ' + k);
    assert.ok(c.desc && typeof c.desc === 'string', 'desc が無い: ' + k);
    assert.ok(Array.isArray(c.members) && c.members.length === 2, 'members は2人: ' + k);
    assert.strictEqual(c.type, 'attack', 'type は attack のみ: ' + k);
    assert.strictEqual(typeof c.power, 'number', 'power が数値でない: ' + k);
    assert.ok(c.target === 'one' || c.target === 'all', 'target は one/all: ' + k);
    if (c.heal != null) assert.ok(typeof c.heal === 'number' && c.heal > 0, 'heal は正の数: ' + k);
    assert.ok(!seen[c.id], 'id 重複: ' + c.id);
    seen[c.id] = true;
  });
});

test('全コンビにユイトが含まれる（操作はユイト1人なので必須）', () => {
  Object.keys(COMBOS).forEach((k) => {
    assert.ok(COMBOS[k].members.indexOf('yuito') >= 0, 'yuito を含まない: ' + k);
  });
});

test('コンビは強力（単体・回復なしコンビは最強の必殺技より高威力）', () => {
  // 必殺技のうち「単体」攻撃技の最大 power を基準にする（コンビはキアイ2本ぶんなので、それを超える価値が要る）。
  // 全体技(target:'all')は威力を範囲と引き換えにする別カテゴリなので基準に含めない。
  // 特にナナカ「イヤイヤ期」は敵全体をなぎ払うゲーム内最大power(5.0)だが、
  // 単体コンビと比べる対象ではない（範囲技ゆえ単体コンビ超えを要求しない）。
  const ultMax = Object.keys(SKILLS)
    .map((k) => SKILLS[k])
    .filter((s) => s.kiai && s.type === 'attack' && s.target === 'one')
    .reduce((m, s) => Math.max(m, s.power || 0), 0);
  Object.keys(COMBOS).forEach((k) => {
    const c = COMBOS[k];
    // 全体技は単体より控えめ、回復付きは威力を回復と引き換えにするので、
    // 「単体 かつ 回復なし」のコンビだけ必殺技超えを必須化する。
    if (c.target === 'one' && c.heal == null) {
      assert.ok(c.power >= ultMax, '単体コンビが必殺技より弱い: ' + k + ' (' + c.power + ' < ' + ultMax + ')');
    }
    // どのコンビも最低限の威力は持つ（弱すぎる連携は無い）。
    assert.ok(c.power >= 2.0, 'コンビ威力が低すぎる: ' + k + ' (' + c.power + ')');
  });
});

test('コンビ名/説明に絵文字を使っていない（canvas フォントは絵文字非対応）', () => {
  const surrogate = /[\uD800-\uDBFF]/;
  Object.keys(COMBOS).forEach((k) => {
    const c = COMBOS[k];
    assert.ok(!surrogate.test(c.name), '絵文字が name に: ' + k);
    assert.ok(!surrogate.test(c.desc), '絵文字が desc に: ' + k);
  });
});

test('コンビの members は実在キャラ id を指す（characters.js）', () => {
  const { CHARACTERS } = require('../src/data/characters.js');
  Object.keys(COMBOS).forEach((k) => {
    COMBOS[k].members.forEach((m) => {
      assert.ok(CHARACTERS[m], 'members に不明キャラ: ' + k + ' -> ' + m);
    });
  });
});

// ── availableCombos（純粋・発動条件） ──────────────────────────────────
test('全員キアイMAX & 生存なら、そのコンビが発動可能になる', () => {
  const party = [unit('yuito'), unit('ikuma')];
  const got = availableCombos(party);
  assert.ok(got.some((c) => c.id === 'combo_ikuma'), 'combo_ikuma が発動可能のはず');
});

test('パートナーのキアイが足りないとコンビは出ない', () => {
  const party = [unit('yuito'), unit('ikuma', { kiai: 50 })];
  const got = availableCombos(party);
  assert.ok(!got.some((c) => c.id === 'combo_ikuma'), 'ikuma 未MAXなら出ない');
});

test('ユイトのキアイが足りないと、どのコンビも出ない', () => {
  const party = [unit('yuito', { kiai: 0 }), unit('ikuma'), unit('aoshi')];
  const got = availableCombos(party);
  assert.deepStrictEqual(got, [], 'ユイト未MAXなら全コンビ不可');
});

test('パートナーが戦闘不能だとそのコンビは出ない', () => {
  const party = [unit('yuito'), unit('tomoki', { dead: true, hp: 0 })];
  const got = availableCombos(party);
  assert.ok(!got.some((c) => c.id === 'combo_tomoki'), '戦闘不能パートナーのコンビは不可');
});

test('hp<=0 のパートナーも（dead フラグが無くても）除外される', () => {
  const party = [unit('yuito'), unit('ikuma', { hp: 0, dead: false })];
  const got = availableCombos(party);
  assert.ok(!got.some((c) => c.id === 'combo_ikuma'), 'hp0 パートナーは不可');
});

test('複数パートナーがMAXなら複数コンビが同時に発動可能', () => {
  const party = [unit('yuito'), unit('ikuma'), unit('aoshi')];
  const got = availableCombos(party);
  const ids = got.map((c) => c.id);
  assert.ok(ids.indexOf('combo_ikuma') >= 0 && ids.indexOf('combo_aoshi') >= 0, '両方発動可能');
});

test('ユイト1人だけのパーティではコンビは出ない', () => {
  const party = [unit('yuito')];
  assert.deepStrictEqual(availableCombos(party), []);
});

test('空配列/未定義でも落ちず空を返す', () => {
  assert.deepStrictEqual(availableCombos([]), []);
  assert.deepStrictEqual(availableCombos(undefined), []);
});
