# 第5弾改修（寄り道必須化＋双方向マップ＋NPC拡充）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 寄り道4マップ（secret_field / cave_water / legend_arena / challenge_room）を本線ストーリーで必ず通る構成にし、11か所の一方通行を双方向化し、加入前カメオ＋新NPC種でマップを賑やかにする。

**Architecture:** 地理（grid）は変えず、`story.js` の進行スパインに4フラグを同順挿入し、`maps.js` の前進出口へ `requireFlag` ゲート（G1〜G5）を追加/撤去。既存の純粋関数 `objectiveFor` とデータ駆動の出口/NPC機構だけで完結させ、エンジン（field-scene.js 等）は改修しない。逆流は各マップに reverse 出口を1つ足すだけ。NPCは `sprites.js` のパレット追加（共通ボディ色替え）＋ `maps.js` の `npcs` 追加で量産する。

**Tech Stack:** 素の JavaScript（UMD）／`src/` 分割 → `node build.js` で単一 `index.html` へ結合（**build.js は編集しない**）／テストは `node --test`（現行648）／決定論ビルドは `md5 -q index.html` 二重一致。

**Node PATH（各コマンドの前提）:** `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`

**不変の制約:**
- 新規トップレベルJS識別子（`sprites.js` の新パレット変数など）は追加前に必ず `grep` で衝突確認（単一バンドル同名 const 衝突＝black screen）。
- パーティ関連コード（`monster.maxParty`＝5、`story.js` `joinAlly` の無条件 push）は触らない（スコープ外）。
- 第3章（wc_stadium／nebula／star_shrine／asterion）の進行ゲート・報酬・章切替導線を壊さない。逆流出口の追加のみ。
- 新規武器・新ボス・新ダンジョンは追加しない（challenge_room は既存内容の軽量化のみ）。

---

# サブプロジェクトA — 寄り道必須化＋双方向マップ

## ファイル構成（Aで触るファイル）

- Modify: `src/data/story.js`（`objectiveFor` の spine 配列に4ノード挿入）
- Modify: `src/data/maps.js`（G1〜G5 ゲート、challenge_room 軽量化、R1〜R11 逆流出口、secret_field ヒント）
- Modify: `tests/boss-rush.test.js`（G5 撤去に伴う既存アサーション書き換え）
- Create: `tests/mapfix-spine.test.js`（新スパイン順序のユニットテスト）
- Create: `tests/mapfix-gates.test.js`（G1〜G5 データ検査）
- Create: `tests/mapfix-reverse.test.js`（R1〜R11 逆流出口の存在検査）

各新規テストは自前の最小ヘルパを使う（他テストと共有しない）:

```javascript
const { MAPS } = require('../src/data/maps.js');
const { objectiveFor } = require('../src/data/story.js');
function findExitTo(mapId, toId) {
  return (MAPS[mapId].exits || []).find(e => e.to === toId);
}
```

---

### Task A1: スパインに4フラグを挿入（secret_puzzle / boss_water / boss_emperor / challenge_clear）

**Files:**
- Modify: `src/data/story.js:200-270`（`var spine = [...]`）
- Test: `tests/mapfix-spine.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/mapfix-spine.test.js` を新規作成:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { objectiveFor } = require('../src/data/story.js');

// 新スパイン順序（★＝今回挿入した4フラグ）
// joined_ikuma → ★secret_puzzle → boss_magma → joined_aoshi → joined_tomoki
// → ★boss_water → joined_itsuki → boss_guardian → ★boss_emperor → ★challenge_clear
// → boss_kaiser → boss_dark_general → …（以降不変）
const ORDER = [
  ['joined_ikuma', 'イクマを なかまに しよう！'],
  ['secret_puzzle', 'ハーバータウンの ひみつを といて！'],
  ['boss_magma', 'ほのおの どうくつへ！'],
  ['joined_aoshi', 'アオシを なかまに しよう！'],
  ['joined_tomoki', 'トモキを なかまに しよう！'],
  ['boss_water', 'みずのどうくつへ！'],
  ['joined_itsuki', 'イツキを なかまに しよう！'],
  ['boss_guardian', 'スカイスタジアムへ！'],
  ['boss_emperor', 'でんせつのアリーナへ！'],
  ['challenge_clear', 'ちょうせんの間へ！'],
  ['boss_kaiser', 'ダークアリーナへ！'],
];

test('objectiveFor は新スパイン順に「未達の最初の目標」を返す', () => {
  const flags = {};
  for (const [flag, expectedBar] of ORDER) {
    const obj = objectiveFor(flags);
    assert.strictEqual(obj.bar, expectedBar, `flag=${flag} の直前で bar 不一致`);
    assert.strictEqual(obj.done, false);
    flags[flag] = true; // このフラグを立てて次へ
  }
});

test('boss_kaiser 以降の順序は不変（boss_dark_general が続く）', () => {
  const flags = {};
  for (const [flag] of ORDER) flags[flag] = true;
  const obj = objectiveFor(flags);
  assert.strictEqual(obj.bar, 'こおりの とうげへ！');
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-spine.test.js`
Expected: FAIL（secret_puzzle 未挿入なので bar が 'ほのおの どうくつへ！' 等になり不一致）

- [ ] **Step 3: spine 配列に4ノードを挿入**

`src/data/story.js` の `var spine = [` 内を編集する。

(1) `joined_ikuma` ノード（201-203行）の直後、`boss_magma`（204行）の直前に挿入:

```javascript
    { flag: 'secret_puzzle',
      bar: 'ハーバータウンの ひみつを といて！',
      npc: 'ハーバータウンの かくしべやで\nボールの パズルを といてから\nさきへ すすもう！' },
```

(2) `joined_tomoki` ノード（210-212行）の直後、`joined_itsuki`（213行）の直前に挿入:

```javascript
    { flag: 'boss_water',
      bar: 'みずのどうくつへ！',
      npc: 'フォレストタウンの みずのどうくつで\nみずの ぬしを たおしてから\nさきへ すすもう！' },
```

(3) `boss_guardian` ノード（216-218行）の直後、`boss_kaiser`（219行）の直前に、2ノードを続けて挿入:

```javascript
    { flag: 'boss_emperor',
      bar: 'でんせつのアリーナへ！',
      npc: 'クラウドタウンの でんせつのアリーナで\nゴールド・エンペラーを たおそう！' },
    { flag: 'challenge_clear',
      bar: 'ちょうせんの間へ！',
      npc: 'ダークアリーナの ちょうせんの間で\nうでだめしを クリアしてから\nダーク・カイザーに いどもう！' },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-spine.test.js`
Expected: PASS（2テスト）

- [ ] **Step 5: 既存テスト全体を確認（回帰なし）**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test`
Expected: 全PASS（648 + 新規2）

- [ ] **Step 6: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/story.js tests/mapfix-spine.test.js
git commit -m "feat(story): spine に secret_puzzle/boss_water/boss_emperor/challenge_clear を挿入"
```

---

### Task A2: 前進ゲート G1〜G3 を追加（town1→village1 / town2→field4 / town3→field6）

**Files:**
- Modify: `src/data/maps.js`（town1 exits:739 / town2 exits / town3 exits:1710）
- Test: `tests/mapfix-gates.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/mapfix-gates.test.js` を新規作成:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { MAPS } = require('../src/data/maps.js');
function findExitTo(mapId, toId) {
  return (MAPS[mapId].exits || []).find(e => e.to === toId);
}

test('G1: town1 → village1 は secret_puzzle ゲート', () => {
  const e = findExitTo('town1', 'village1');
  assert.ok(e, 'town1→village1 出口が無い');
  assert.strictEqual(e.requireFlag, 'secret_puzzle');
  assert.ok(e.lockedMsg && e.lockedMsg.length > 0);
});

test('G2: town2 → field4 は boss_water ゲート', () => {
  const e = findExitTo('town2', 'field4');
  assert.ok(e, 'town2→field4 出口が無い');
  assert.strictEqual(e.requireFlag, 'boss_water');
  assert.ok(e.lockedMsg && e.lockedMsg.length > 0);
});

test('G3: town3 → field6 は boss_emperor ゲート', () => {
  const e = findExitTo('town3', 'field6');
  assert.ok(e, 'town3→field6 出口が無い');
  assert.strictEqual(e.requireFlag, 'boss_emperor');
  assert.ok(e.lockedMsg && e.lockedMsg.length > 0);
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-gates.test.js`
Expected: FAIL（requireFlag が undefined）

- [ ] **Step 3: G1 を実装（town1 の village1 出口）**

`src/data/maps.js` town1 の exits（739行）を変更:

```javascript
      { x: 1, y: 2, to: 'village1', tx: 10, ty: 1,
        requireFlag: 'secret_puzzle',
        lockedMsg: 'にしの むらへの みちが\nひかって とじている。\nかくしべやの ボールパズルを\nとくと ひらきそうだ…' },
```

- [ ] **Step 4: G2 を実装（town2 の field4 出口）**

`src/data/maps.js` town2 の exits にある `{ x: 7, y: 16, to: 'field4', tx: 7, ty: 2 }` を変更:

```javascript
      { x: 7, y: 16, to: 'field4', tx: 7, ty: 2,
        requireFlag: 'boss_water',
        lockedMsg: 'みずの ちからで とざされている。\nみずのどうくつの ぬしを たおすと\nみちが ひらきそうだ…' },
```

- [ ] **Step 5: G3 を実装（town3 の field6 出口）**

`src/data/maps.js` town3 の exits にある `{ x: 7, y: 16, to: 'field6', tx: 7, ty: 2 }` を変更:

```javascript
      { x: 7, y: 16, to: 'field6', tx: 7, ty: 2,
        requireFlag: 'boss_emperor',
        lockedMsg: 'でんせつの アリーナの ぬしを\nたおさないと、この さきへは\nすすめないようだ…\nゴールド・エンペラーに いどもう！' },
```

- [ ] **Step 6: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-gates.test.js`
Expected: PASS（3テスト）

- [ ] **Step 7: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-gates.test.js
git commit -m "feat(maps): 前進ゲート G1-G3 追加（寄り道クリアを必須化）"
```

---

### Task A3: G4（field6 kaiser を challenge_clear で封鎖）＋ G5（field6→challenge_room の boss_kaiser ゲート撤去）

**Files:**
- Modify: `src/data/maps.js`（field6 kaiser NPC 533-542 / field6 exits 604-610）
- Modify: `tests/boss-rush.test.js`（既存アサーション書き換え）
- Test: `tests/mapfix-gates.test.js`（追記）

- [ ] **Step 1: 失敗するテストを書く（gates テストへ追記）**

`tests/mapfix-gates.test.js` の末尾に追記:

```javascript
test('G4: field6 の kaiser ボスNPC は challenge_clear で封鎖', () => {
  const kaiser = MAPS.field6.npcs.find(
    n => n.boss && n.boss.winFlag === 'boss_kaiser'
  );
  assert.ok(kaiser, 'field6 の kaiser ボスNPC が無い');
  assert.strictEqual(kaiser.requireFlag, 'challenge_clear');
  assert.ok(kaiser.lockedMsg && kaiser.lockedMsg.length > 0);
});

test('G5: field6 → challenge_room は最初から開く（requireFlag 無し）', () => {
  const e = (MAPS.field6.exits || []).find(x => x.to === 'challenge_room');
  assert.ok(e, 'field6→challenge_room 出口が無い');
  assert.strictEqual(e.requireFlag, undefined);
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-gates.test.js`
Expected: FAIL（kaiser.requireFlag が undefined / challenge_room 出口に boss_kaiser が残っている）

- [ ] **Step 3: G4 を実装（field6 kaiser NPC にトップレベル requireFlag/lockedMsg）**

`src/data/maps.js` field6 の kaiser NPC（`sprite: 'kaiser'`、`boss.winFlag: 'boss_kaiser'` を持つオブジェクト）に、トップレベルの `requireFlag` と `lockedMsg` を追加する。`x: 7, y: 9,` の直後へ:

```javascript
        requireFlag: 'challenge_clear',
        lockedMsg: 'ダーク・カイザー「まだ たたかう\nときでは ない…\nちょうせんの間で うでだめしを\nクリアしてから いどんで こい。」',
```

- [ ] **Step 4: G5 を実装（field6→challenge_room の boss_kaiser ゲート撤去）**

`src/data/maps.js` field6 の exits にある challenge_room 出口を、`requireFlag`/`lockedMsg` を消して次へ:

```javascript
      { x: 7, y: 16, to: 'challenge_room', tx: 7, ty: 15 },
```

- [ ] **Step 5: 既存 boss-rush.test.js の壊れるアサーションを書き換える**

`tests/boss-rush.test.js` 内の「field6 に boss_kaiser ゲートのとびらがあり challenge_room へつながる」テストは、G5 でゲートを撤去したため成立しなくなる。当該テストを次の内容へ置き換える（`door.requireFlag === 'boss_kaiser'` と `assert.ok(door.lockedMsg)` を削除し、ゲート無しでつながることを検証する）:

```javascript
test('field6 → challenge_room の とびらは 最初から ひらいている', () => {
  const door = (MAPS.field6.exits || []).find(e => e.to === 'challenge_room');
  assert.ok(door, 'field6→challenge_room の とびらが無い');
  assert.strictEqual(door.tx, 7);
  assert.strictEqual(door.ty, 15);
  assert.strictEqual(door.requireFlag, undefined);
});
```

- [ ] **Step 6: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-gates.test.js tests/boss-rush.test.js`
Expected: PASS（gates 5テスト + boss-rush 全テスト）

- [ ] **Step 7: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-gates.test.js tests/boss-rush.test.js
git commit -m "feat(maps): G4 kaiser を challenge_clear で封鎖・G5 challenge_room ゲート撤去"
```

---

### Task A4: challenge_room を軽量な腕試し（2体連戦）へ作り替え

**Files:**
- Modify: `src/data/maps.js`（challenge_room の kaiser 受付NPC ≈1900-1965）
- Modify: `tests/boss-rush.test.js`（enemies 内容の検証を更新）

- [ ] **Step 1: 失敗するテストを書く（boss-rush.test.js へ追記）**

`tests/boss-rush.test.js` の末尾に追記:

```javascript
test('challenge_room のボスラッシュは 撃破済み2体（guardian, gold_emperor）へ軽量化', () => {
  const npc = MAPS.challenge_room.npcs.find(n => n.bossRush);
  assert.ok(npc, 'bossRush NPC が無い');
  assert.deepStrictEqual(npc.bossRush.enemies, ['guardian', 'gold_emperor']);
  assert.strictEqual(npc.bossRush.winFlag, 'challenge_clear');
  assert.strictEqual(npc.bossRush.reward.item, 'champion_spike');
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/boss-rush.test.js`
Expected: FAIL（enemies が4体のまま）

- [ ] **Step 3: challenge_room の bossRush.enemies を2体へ軽量化＋文言更新**

`src/data/maps.js` challenge_room の kaiser 受付NPC（`bossRush` を持つオブジェクト）を次のように変更する。

(3-1) `enemies` を2体へ:

```javascript
          bossRush: {
            enemies: ['guardian', 'gold_emperor'],
            winFlag: 'challenge_clear',
            reward: { item: 'champion_spike', amount: 1, label: 'チャンピオンシューズ' },
          },
```

(3-2) `pages` を前哨戦トーンへ:

```javascript
          pages: [
            'ここは ちょうせんの間。',
            'ダーク・カイザーに いどむ まえの\nさいごの うでだめしだ！',
            'これまで たおした ボスが\n2たい つづけて おそいかかる。\nとちゅうで HP・MPは かいふく できない！',
            'うでだめしに ちょうせん する？',
          ],
```

(3-3) `afterPages` を「腕試しクリア→ラスボスへ」トーンへ:

```javascript
          afterPages: [
            'うでだめし クリア！\nきみは カイザーに いどむ\nしかくを てに いれた！',
            'いよいよ ダーク・カイザーだ。\nゆだんせず いどもう！',
          ],
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/boss-rush.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/boss-rush.test.js
git commit -m "feat(maps): challenge_room を撃破済み2体の前哨戦へ軽量化"
```

---

### Task A5: 第1章の逆流出口 R1〜R8 を追加（町⇄フィールド双方向化）

**Files:**
- Modify: `src/data/maps.js`（town1 / field2 / field3 / town2 / field4 / field5 / town3 / field6 の exits）
- Test: `tests/mapfix-reverse.test.js`

到着規約（実データ確認済み）: 各マップの南出口 (7,16) の1つ上 (7,15) は歩行可能（プレイヤーが南出口へ踏み込む前に立つマス）。逆流の着地はすべて「前マップの (7,15)」。逆流出口タイルは踏み込み判定で発火するため壁でも可だが、いずれも中央 col7（道 ','）に置く。**R7 のみ** town3 の (7,1) が既存 ch2_gate 出口で占有済みのため (6,1) に置く。

- [ ] **Step 1: 失敗するテストを書く**

`tests/mapfix-reverse.test.js` を新規作成:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { MAPS } = require('../src/data/maps.js');
function findExitTo(mapId, toId) {
  return (MAPS[mapId].exits || []).find(e => e.to === toId);
}

// [ホストマップ, 逆流先, 期待 x, y, tx, ty]
const REVERSE_CH1 = [
  ['town1',  'field1', 7, 1, 7, 15], // R1
  ['field2', 'town1',  7, 1, 7, 15], // R2
  ['field3', 'field2', 7, 1, 7, 15], // R3
  ['town2',  'field3', 7, 1, 7, 15], // R4
  ['field4', 'town2',  7, 1, 7, 15], // R5
  ['field5', 'field4', 7, 1, 7, 15], // R6
  ['town3',  'field5', 6, 1, 7, 15], // R7（7,1 は ch2_gate 占有→6,1）
  ['field6', 'town3',  7, 1, 7, 15], // R8
];

for (const [host, to, x, y, tx, ty] of REVERSE_CH1) {
  test(`逆流: ${host} → ${to} 出口が存在し座標が正しい`, () => {
    const e = findExitTo(host, to);
    assert.ok(e, `${host}→${to} の逆流出口が無い`);
    assert.strictEqual(e.x, x);
    assert.strictEqual(e.y, y);
    assert.strictEqual(e.tx, tx);
    assert.strictEqual(e.ty, ty);
    assert.strictEqual(e.requireFlag, undefined, '逆流にゲートを付けない');
  });
}
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-reverse.test.js`
Expected: FAIL（8テストとも逆流出口なし）

- [ ] **Step 3: R1〜R8 の逆流出口を各マップ exits へ追加**

各マップの `exits: [` 配列に次の1要素を追加する（既存要素は残す）。

R1 — `town1` の exits へ:
```javascript
      { x: 7, y: 1, to: 'field1', tx: 7, ty: 15, msg: 'はじまりの草原へ もどる…' },
```
R2 — `field2` の exits へ:
```javascript
      { x: 7, y: 1, to: 'town1', tx: 7, ty: 15, msg: 'ハーバータウンへ もどる…' },
```
R3 — `field3` の exits へ:
```javascript
      { x: 7, y: 1, to: 'field2', tx: 7, ty: 15, msg: 'ナイタースタジアムへ もどる…' },
```
R4 — `town2` の exits へ:
```javascript
      { x: 7, y: 1, to: 'field3', tx: 7, ty: 15, msg: 'サンドコートへ もどる…' },
```
R5 — `field4` の exits へ:
```javascript
      { x: 7, y: 1, to: 'town2', tx: 7, ty: 15, msg: 'フォレストタウンへ もどる…' },
```
R6 — `field5` の exits へ:
```javascript
      { x: 7, y: 1, to: 'field4', tx: 7, ty: 15, msg: 'レイニーピッチへ もどる…' },
```
R7 — `town3` の exits へ（**x:6**）:
```javascript
      { x: 6, y: 1, to: 'field5', tx: 7, ty: 15, msg: 'スカイスタジアムへ もどる…' },
```
R8 — `field6` の exits へ:
```javascript
      { x: 7, y: 1, to: 'town3', tx: 7, ty: 15, msg: 'クラウドタウンへ もどる…' },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-reverse.test.js`
Expected: PASS（8テスト）

- [ ] **Step 5: 全テスト確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test`
Expected: 全PASS

- [ ] **Step 6: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-reverse.test.js
git commit -m "feat(maps): 第1章 R1-R8 の逆流出口で町⇄フィールドを双方向化"
```

---

### Task A6: 第3章の逆流出口 R9〜R11 を追加（gated・完成ゾーンを壊さない）

**Files:**
- Modify: `src/data/maps.js`（ch2_castle exits 2316-2318 / wc_stadium exits 2411-2413 / nebula_f3 exits 2555-2557）
- Test: `tests/mapfix-reverse.test.js`（追記）

R9〜R11 は前進が既存ボス撃破フラグで守られているゾーン。逆流にも同じ撃破フラグの `requireFlag` を付け、シーケンスブレイクを防ぐ。着地座標・逆流出口タイルは実 grid 照合済み（下記）。

- [ ] **Step 1: 失敗するテストを書く（reverse テストへ追記）**

`tests/mapfix-reverse.test.js` の末尾に追記:

```javascript
// [ホスト, 逆流先, x, y, tx, ty, requireFlag]
const REVERSE_CH3 = [
  ['ch2_castle', 'wc_stadium',    8, 15, 7, 15, 'boss_neo_kaiser'], // R9
  ['wc_stadium', 'nebula_f1',     9, 10, 7, 15, 'boss_volg'],       // R10
  ['nebula_f3',  'star_shrine_1', 8,  4, 7, 15, 'boss_zeros'],      // R11
];

for (const [host, to, x, y, tx, ty, flag] of REVERSE_CH3) {
  test(`逆流(第3章): ${host} → ${to} 出口が ${flag} ゲートで存在`, () => {
    const e = findExitTo(host, to);
    assert.ok(e, `${host}→${to} の逆流出口が無い`);
    assert.strictEqual(e.x, x);
    assert.strictEqual(e.y, y);
    assert.strictEqual(e.tx, tx);
    assert.strictEqual(e.ty, ty);
    assert.strictEqual(e.requireFlag, flag);
    assert.ok(e.lockedMsg && e.lockedMsg.length > 0);
  });
}

test('第3章の前進ゲートは不変（nebula_f1→nebula_f2 は nebula_f1 フラグ）', () => {
  const fwd = (MAPS.nebula_f1.exits || []).find(e => e.to === 'nebula_f2');
  assert.ok(fwd);
  assert.strictEqual(fwd.requireFlag, 'nebula_f1');
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-reverse.test.js`
Expected: FAIL（R9-R11 の逆流出口なし。前進ゲート不変テストは PASS）

- [ ] **Step 3: R9〜R11 の逆流出口を追加**

R9 — `ch2_castle` の exits へ（(7,16) は shrine_forest_3f 占有のため (8,15) を使用。着地 wc_stadium(7,15)）:
```javascript
      { x: 8, y: 15, to: 'wc_stadium', tx: 7, ty: 15,
        requireFlag: 'boss_neo_kaiser',
        lockedMsg: 'グランドスタジアムへは\nネオ・カイザーを たおしてから！',
        msg: 'グランドスタジアムへ もどる…' },
```

R10 — `wc_stadium` の exits へ（帰還着地 (7,10) の隣 (9,10)。着地 nebula_f1(7,15)）:
```javascript
      { x: 9, y: 10, to: 'nebula_f1', tx: 7, ty: 15,
        requireFlag: 'boss_volg',
        lockedMsg: 'ネビュラごうへは\nヴォルグを たおしてから！',
        msg: 'ネビュラごうへ のりこむ！' },
```

R11 — `nebula_f3` の exits へ（帰還着地 (7,4) の隣 (8,4)。着地 star_shrine_1(7,15)）:
```javascript
      { x: 8, y: 4, to: 'star_shrine_1', tx: 7, ty: 15,
        requireFlag: 'boss_zeros',
        lockedMsg: 'せいしんの しんでんへは\nゼロスを たおしてから！',
        msg: 'せいしんの しんでんへ！' },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-reverse.test.js`
Expected: PASS（R1-R8 の8 + R9-R11 の3 + 前進不変1）

- [ ] **Step 5: 全テスト確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test`
Expected: 全PASS

- [ ] **Step 6: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-reverse.test.js
git commit -m "feat(maps): 第3章 R9-R11 の逆流出口を撃破フラグゲート付きで追加"
```

---

### Task A7: secret_field の押しパズル・ヒントを手厚くする

**Files:**
- Modify: `src/data/maps.js`（secret_field の (6,8) 案内NPC 1769-1775）
- Test: `tests/mapfix-gates.test.js`（追記）

押しパズル（ボール2個を真下へ2マス）がスルーされないよう、既存の (6,8) 案内NPCへ具体的な解法ページを1つ足す（データのみ・エンジン改修不要）。

- [ ] **Step 1: 失敗するテストを書く（gates テストへ追記）**

`tests/mapfix-gates.test.js` の末尾に追記:

```javascript
test('secret_field の案内NPCに「したへ おす」解法ヒントがある', () => {
  const hasHint = MAPS.secret_field.npcs.some(
    n => Array.isArray(n.pages) && n.pages.some(p => p.includes('まっすぐ したへ'))
  );
  assert.ok(hasHint, '押しパズルの解法ヒントが見つからない');
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-gates.test.js`
Expected: FAIL

- [ ] **Step 3: (6,8) 案内NPCの pages に解法ページを追加**

`src/data/maps.js` secret_field の `x: 6, y: 8` の coach NPC の `pages` を次へ変更（3ページ目を追加）:

```javascript
        pages: [
          'しろい ボールを おして\nひかる ▢マークまで はこぼう。',
          '2つ とも そろえると\nたからばこの カギが あくぞ！',
          'ヒント：ひだりの 2つの ボールを\nそれぞれ まっすぐ したへ おすと\nすぐ ▢に そろうよ！',
        ],
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-gates.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-gates.test.js
git commit -m "feat(maps): secret_field 押しパズルの解法ヒントを追加"
```

---

### Task A8: サブプロジェクトA 統合・全テスト・決定論ビルド

**Files:**
- Build: `index.html`（`node build.js` 生成物）

- [ ] **Step 1: 全テスト緑を確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test 2>&1 | tail -5`
Expected: 全PASS（648 + 新規テスト。fail 0）

- [ ] **Step 2: 決定論ビルド（md5 二重一致）**

Run:
```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js && md5 -q index.html
node build.js && md5 -q index.html
```
Expected: 2回の md5 が完全一致すること（値は実行して確認）

- [ ] **Step 3: 起動スモーク（black screen でないこと＝バンドル構文健全）**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node -e "const html=require('fs').readFileSync('index.html','utf8'); if(!html.includes('objectiveFor')) throw new Error('bundle missing story'); console.log('bundle ok', html.length);"`
Expected: `bundle ok <サイズ>` が表示（例外なし）

- [ ] **Step 4: コミット（ビルド生成物）**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add index.html
git commit -m "build: サブプロジェクトA（寄り道必須化＋双方向マップ）を反映"
```

---

# サブプロジェクトC — NPC拡充（加入前カメオ＋新NPC種）

## 設計の要点

- **カメオ**: 仲間になる3人（アオシ／トモキ／イツキ）を、加入マップより手前のマップに「仲間スプライトのまま」立たせる。`joinId` は付けない（会話のみ）。トップレベル `vanishFlag: 'joined_X'` で加入後に自動消滅（`_withActiveNpcs` の既存機構を利用。エンジン改修なし）。
- **新NPC種**: `sprites.js` に共通ボディの色替えパレットを10種追加（IIFE内ローカル `var`＝バンドルのトップレベル識別子ではないので同名衝突は起きない。`return` に列挙するキー名だけ既存キーと重複しないことを確認する）。
- **配置**: 各町2〜3体、各フィールド要所1体を、Explore で実 grid 照合済みの「空き歩行可能マス」に置く。全て会話のみ（`pages`）。

## ファイル構成（Cで触るファイル）

- Modify: `src/data/sprites.js`（新パレット10種を IIFE 内へ追加＋`return` へ列挙）
- Modify: `src/data/maps.js`（town1/field2/field3 へカメオ、各町/各フィールドへ新NPC）
- Create: `tests/mapfix-npc.test.js`（スプライトキー存在＋NPC配置の歩行/非重複検査）

新規テストの共通ヘルパ（`tests/mapfix-npc.test.js` 冒頭に置く）:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { MAPS, TILE_LEGEND } = require('../src/data/maps.js');
const { SPRITES } = require('../src/data/sprites.js');

function isWalkable(map, x, y) {
  const row = map && map.grid && map.grid[y];
  if (!row || x < 0 || x >= row.length) return false;
  const t = TILE_LEGEND[row[x]];
  return !!(t && t.walkable);
}
// 指定マップの (x,y) に、既存の別 npc / solid object / exit が無いこと
function isFree(map, x, y, exceptNpc) {
  const npcHit = (map.npcs || []).some(n => n !== exceptNpc && n.x === x && n.y === y);
  const objHit = (map.objects || []).some(o => o.x === x && o.y === y && o.solid);
  const exitHit = (map.exits || []).some(e => e.x === x && e.y === y);
  return !npcHit && !objHit && !exitHit;
}
function npcAt(mapId, x, y) {
  return (MAPS[mapId].npcs || []).find(n => n.x === x && n.y === y);
}
```

---

### Task C1: sprites.js に新NPCパレット10種を追加

**Files:**
- Modify: `src/data/sprites.js`（`var kaiser = buildChar(...)` の直後／`return { ... }` 331-346）
- Test: `tests/mapfix-npc.test.js`

新スプライトキー: `girl_pink` `boy_blue` `granny` `grandpa` `woman_brown` `young_man` `referee` `reporter` `vendor` `supporter`

- [ ] **Step 1: 事前に識別子/キーの衝突を確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && grep -nE "girl_pink|boy_blue|granny|grandpa|woman_brown|young_man|referee|reporter|vendor|supporter" src/data/sprites.js`
Expected: 出力なし（未定義＝衝突なし）

- [ ] **Step 2: 失敗するテストを書く**

`tests/mapfix-npc.test.js` を新規作成（上記ヘルパの直後に以下を続ける）:

```javascript
const NEW_SPRITE_KEYS = [
  'girl_pink', 'boy_blue', 'granny', 'grandpa', 'woman_brown',
  'young_man', 'referee', 'reporter', 'vendor', 'supporter',
];

test('sprites.js に新NPCスプライト10種が生成されている', () => {
  for (const key of NEW_SPRITE_KEYS) {
    assert.ok(SPRITES[key], `SPRITES.${key} が無い`);
  }
});
```

- [ ] **Step 3: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: FAIL（`SPRITES.girl_pink` が undefined）

- [ ] **Step 4: パレット10種を IIFE 内へ追加**

`src/data/sprites.js` の `var kaiser = buildChar({...}, '', false);` の直後（タイル節コメント `// ────` の直前）に、次を挿入する。全キー凡例 = O:輪郭 / H,h,g:髪(明,中,暗) / S,s,k:肌 / E,m:目,口 / U,u,v,N:服(明,中,暗,番号色) / P,p:ズボン / L,l:脚 / K,c:靴,靴下 / W,b:白,黒。`num=''`・`gk=false` は全員共通:

```javascript
  // ── 町の人々（共通ボディの色替え・背番号なし）──
  var girl_pink = buildChar({
    'O':'#1c1015','H':'#8a5a3a','h':'#6e4428','g':'#523018','S':'#ffe0c4','s':'#f0c2a0','k':'#dc9e78','E':'#3a241a','m':'#c05070','U':'#ff9ec0','u':'#e87aa4','v':'#c85888','N':'#ff9ec0','P':'#d86a98','p':'#b04a78','L':'#f0c2a0','l':'#dc9e78','K':'#ffffff','c':'#e0a0c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var boy_blue = buildChar({
    'O':'#0a0e18','H':'#3a2a1a','h':'#2a1e12','g':'#1a120a','S':'#ffe0c4','s':'#f0c2a0','k':'#dc9e78','E':'#2a3a5a','m':'#a85040','U':'#4a8ade','u':'#356ab8','v':'#254e8e','N':'#4a8ade','P':'#2a3f6a','p':'#1a2846','L':'#f0c2a0','l':'#dc9e78','K':'#ffffff','c':'#b8b8c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var granny = buildChar({
    'O':'#1a1818','H':'#e8e8ee','h':'#c8c8d2','g':'#a8a8b4','S':'#f0d2b8','s':'#e0b89c','k':'#c89878','E':'#4a3a3a','m':'#a86070','U':'#b8a0c8','u':'#9a80ac','v':'#7a6090','N':'#b8a0c8','P':'#6a5878','p':'#4a3c56','L':'#e0b89c','l':'#c89878','K':'#8a7a6a','c':'#6a5c4e','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var grandpa = buildChar({
    'O':'#181818','H':'#c0c0c6','h':'#9e9ea6','g':'#7c7c86','S':'#eccbb0','s':'#d8b090','k':'#c0946a','E':'#3a3030','m':'#9a6050','U':'#7a7050','u':'#5e5640','v':'#443e2c','N':'#7a7050','P':'#4a4436','p':'#322e24','L':'#d8b090','l':'#c0946a','K':'#5a4a3a','c':'#3e3228','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var woman_brown = buildChar({
    'O':'#1a120a','H':'#7a4a24','h':'#5e381a','g':'#442810','S':'#ffdcc0','s':'#f0be9a','k':'#dc9a72','E':'#3a241a','m':'#b85868','U':'#4aa870','u':'#358858','v':'#256840','N':'#4aa870','P':'#3a6a4a','p':'#264a32','L':'#f0be9a','l':'#dc9a72','K':'#ffffff','c':'#b8c0b8','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var young_man = buildChar({
    'O':'#0a0a0e','H':'#2a2426','h':'#1e1a1c','g':'#121012','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#2a2420','m':'#a85040','U':'#f08a3a','u':'#d46a20','v':'#a84e14','N':'#f08a3a','P':'#3a3140','p':'#241e2a','L':'#e6b487','l':'#cc8f5e','K':'#ffffff','c':'#b8b8c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var referee = buildChar({
    'O':'#0a0a0a','H':'#1a1a1a','h':'#101010','g':'#080808','S':'#f0d2b0','s':'#e0b78e','k':'#c89568','E':'#2a241a','m':'#a85040','U':'#2a2a2a','u':'#1a1a1a','v':'#0e0e0e','N':'#2a2a2a','P':'#1a1a1a','p':'#0a0a0a','L':'#e0b78e','l':'#c89568','K':'#e8e8e8','c':'#b0b0b0','W':'#ffff00','b':'#1a1a1a',
  }, '', false);
  var reporter = buildChar({
    'O':'#0a0c14','H':'#2a241e','h':'#1e1a14','g':'#12100c','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#2a241a','m':'#a85040','U':'#2e3850','u':'#1e2638','v':'#121826','N':'#2e3850','P':'#1e2638','p':'#12161f','L':'#e6b487','l':'#cc8f5e','K':'#1a1a1a','c':'#3a3a3a','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var vendor = buildChar({
    'O':'#180e08','H':'#5a3a1a','h':'#442a12','g':'#301c0a','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#3a241a','m':'#a85040','U':'#c8503a','u':'#a83a26','v':'#842a18','N':'#c8503a','P':'#4a3a28','p':'#2e2418','L':'#e6b487','l':'#cc8f5e','K':'#8a6a4a','c':'#6a4e34','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
  var supporter = buildChar({
    'O':'#181408','H':'#3a2a1a','h':'#2a1e12','g':'#1a120a','S':'#f7d2a8','s':'#e6b487','k':'#cc8f5e','E':'#2a241a','m':'#a85040','U':'#ffd23a','u':'#e8b820','v':'#c89814','N':'#ffd23a','P':'#3a5a8a','p':'#26406a','L':'#e6b487','l':'#cc8f5e','K':'#ffffff','c':'#b8b8c0','W':'#ffffff','b':'#1a1a1a',
  }, '', false);
```

- [ ] **Step 5: return オブジェクトへ10キーを列挙**

`src/data/sprites.js` の `return {` 内、`kaiser: kaiser,` の直後に追加:

```javascript
    girl_pink:   girl_pink,
    boy_blue:    boy_blue,
    granny:      granny,
    grandpa:     grandpa,
    woman_brown: woman_brown,
    young_man:   young_man,
    referee:     referee,
    reporter:    reporter,
    vendor:      vendor,
    supporter:   supporter,
```

- [ ] **Step 6: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: PASS（スプライト10種テスト）

- [ ] **Step 7: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/sprites.js tests/mapfix-npc.test.js
git commit -m "feat(sprites): 町の人々パレット10種を追加"
```

---

### Task C2: 加入前カメオ（アオシ→town1 / トモキ→field2 / イツキ→field3）

**Files:**
- Modify: `src/data/maps.js`（town1 npcs / field2 npcs / field3 npcs）
- Test: `tests/mapfix-npc.test.js`（追記）

配置（Explore で空き歩行可能・非重複を確認済み）: アオシ→town1 (9,7) ／ トモキ→field2 (13,7) ／ イツキ→field3 (12,7)。いずれも `vanishFlag: 'joined_X'` で加入後に消える。`joinId` は付けない。

- [ ] **Step 1: 失敗するテストを追記**

`tests/mapfix-npc.test.js` の末尾に追記:

```javascript
const CAMEOS = [
  ['town1',  9,  7, 'aoshi',  'joined_aoshi'],
  ['field2', 13, 7, 'tomoki', 'joined_tomoki'],
  ['field3', 12, 7, 'itsuki', 'joined_itsuki'],
];

for (const [mapId, x, y, sprite, vanishFlag] of CAMEOS) {
  test(`カメオ: ${mapId} (${x},${y}) に ${sprite}（vanishFlag=${vanishFlag}, joinId無し）`, () => {
    const map = MAPS[mapId];
    const n = npcAt(mapId, x, y);
    assert.ok(n, `${mapId}(${x},${y}) にカメオNPCが無い`);
    assert.strictEqual(n.sprite, sprite);
    assert.strictEqual(n.vanishFlag, vanishFlag);
    assert.strictEqual(n.joinId, undefined, 'カメオに joinId を付けない');
    assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
    assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
    assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
  });
}
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: FAIL（カメオNPC未配置）

- [ ] **Step 3: アオシのカメオを town1 npcs へ追加**

`src/data/maps.js` town1 の `npcs: [` 配列へ追加:

```javascript
      { x: 9, y: 7, sprite: 'aoshi', vanishFlag: 'joined_aoshi',
        pages: ['きみ、いい パスを だすね。\nおれは アオシ。', 'いつか いっしょに\nプレーしたいな。'] },
```

- [ ] **Step 4: トモキのカメオを field2 npcs へ追加**

`src/data/maps.js` field2 の `npcs: [` 配列へ追加:

```javascript
      { x: 13, y: 7, sprite: 'tomoki', vanishFlag: 'joined_tomoki',
        pages: ['がっしり した まもりが\nおれの じまん。トモキだ。', 'また どこかで あおうぜ！'] },
```

- [ ] **Step 5: イツキのカメオを field3 npcs へ追加**

`src/data/maps.js` field3 の `npcs: [` 配列へ追加:

```javascript
      { x: 12, y: 7, sprite: 'itsuki', vanishFlag: 'joined_itsuki',
        pages: ['ゴールは だれにも わたさない！', 'キーパーの イツキだ。\nきみの シュート、うけて みたいな。'] },
```

- [ ] **Step 6: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: PASS（カメオ3テスト）

- [ ] **Step 7: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-npc.test.js
git commit -m "feat(maps): 加入前カメオ（アオシ/トモキ/イツキ）を配置"
```

---

### Task C3: 各町に新NPCを配置（town1 / town2 / town3 / village1）

**Files:**
- Modify: `src/data/maps.js`（town1 / town2 / town3 / village1 の npcs）
- Test: `tests/mapfix-npc.test.js`（追記）

配置（全て Explore で空き歩行可能・非重複を確認済み）:

| マップ | 座標 | sprite | 役割 |
|---|---|---|---|
| town1 | (5,7) | girl_pink | サッカー好きの女の子 |
| town1 | (9,10) | grandpa | 元キーパーのおじいさん |
| town1 | (12,15) | vendor | ボールの露店 |
| town2 | (6,6) | woman_brown | 森の町の女性 |
| town2 | (13,9) | boy_blue | 足の速い男の子 |
| town2 | (2,15) | supporter | サポーター |
| town3 | (1,8) | reporter | スポーツ記者 |
| town3 | (13,10) | granny | 空の町のおばあさん |
| village1 | (16,6) | grandpa | 村の長老 |
| village1 | (8,12) | girl_pink | 井戸の女の子 |

- [ ] **Step 1: 失敗するテストを追記**

`tests/mapfix-npc.test.js` の末尾に追記:

```javascript
const TOWN_NPCS = [
  ['town1', 5, 7, 'girl_pink'],
  ['town1', 9, 10, 'grandpa'],
  ['town1', 12, 15, 'vendor'],
  ['town2', 6, 6, 'woman_brown'],
  ['town2', 13, 9, 'boy_blue'],
  ['town2', 2, 15, 'supporter'],
  ['town3', 1, 8, 'reporter'],
  ['town3', 13, 10, 'granny'],
  ['village1', 16, 6, 'grandpa'],
  ['village1', 8, 12, 'girl_pink'],
];

for (const [mapId, x, y, sprite] of TOWN_NPCS) {
  test(`町NPC: ${mapId} (${x},${y}) に ${sprite}`, () => {
    const map = MAPS[mapId];
    const n = npcAt(mapId, x, y);
    assert.ok(n, `${mapId}(${x},${y}) にNPCが無い`);
    assert.strictEqual(n.sprite, sprite);
    assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
    assert.strictEqual(n.joinId, undefined);
    assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
    assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
  });
}
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: FAIL（町NPC未配置）

- [ ] **Step 3: town1 の npcs へ3体追加**

```javascript
      { x: 5, y: 7, sprite: 'girl_pink',
        pages: ['この まちは うみの\nかおりが するでしょ？', 'わたし、サッカーせんしゅに\nなりたいの！'] },
      { x: 9, y: 10, sprite: 'grandpa',
        pages: ['むかしは わしも\nゴールキーパーじゃった。', 'わかいもんは たのもしいのう。'] },
      { x: 12, y: 15, sprite: 'vendor',
        pages: ['やあ！ しんせんな\nボールは いらんかね？', 'といっても みるだけだよ、\nははは。'] },
```

- [ ] **Step 4: town2 の npcs へ3体追加**

```javascript
      { x: 6, y: 6, sprite: 'woman_brown',
        pages: ['もりの みずは とても\nつめたいの。', 'みずのどうくつには\nきを つけてね。'] },
      { x: 13, y: 9, sprite: 'boy_blue',
        pages: ['ぼく、はやく はしれるんだ！', 'おにいちゃんも はやい？'] },
      { x: 2, y: 15, sprite: 'supporter',
        pages: ['がんばれー！\nおうえん してるよ！', 'きみなら できる！'] },
```

- [ ] **Step 5: town3 の npcs へ2体追加**

```javascript
      { x: 1, y: 8, sprite: 'reporter',
        pages: ['スポーツきしゃを している。', 'でんせつの アリーナの\nしょうぶを しゅざい したいんだ。'] },
      { x: 13, y: 10, sprite: 'granny',
        pages: ['そらに いちばん ちかい\nまちだよ。', 'ゆっくり して おいき。'] },
```

- [ ] **Step 6: village1 の npcs へ2体追加**

```javascript
      { x: 16, y: 6, sprite: 'grandpa',
        pages: ['この むらは のどかで\nいいところじゃ。', 'はたけの やさいは\nじゆうに みておくれ。'] },
      { x: 8, y: 12, sprite: 'girl_pink',
        pages: ['おいのりの いど、しってる？', 'ねがいごとを すると\nいいことが あるんだって！'] },
```

- [ ] **Step 7: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: PASS（町NPC10テスト）

- [ ] **Step 8: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-npc.test.js
git commit -m "feat(maps): 各町に新NPCを配置（town1/town2/town3/village1）"
```

---

### Task C4: 各フィールドに新NPCを配置（field1〜field6）

**Files:**
- Modify: `src/data/maps.js`（field1〜field6 の npcs）
- Test: `tests/mapfix-npc.test.js`（追記）

配置（Explore で空き歩行可能・非重複を確認済み。field2/field3 は C2 のカメオと別マス）:

| マップ | 座標 | sprite |
|---|---|---|
| field1 | (11,11) | boy_blue |
| field2 | (2,7) | supporter |
| field3 | (2,7) | woman_brown |
| field4 | (13,6) | granny |
| field5 | (2,7) | reporter |
| field6 | (2,5) | young_man |

- [ ] **Step 1: 失敗するテストを追記**

`tests/mapfix-npc.test.js` の末尾に追記:

```javascript
const FIELD_NPCS = [
  ['field1', 11, 11, 'boy_blue'],
  ['field2', 2, 7, 'supporter'],
  ['field3', 2, 7, 'woman_brown'],
  ['field4', 13, 6, 'granny'],
  ['field5', 2, 7, 'reporter'],
  ['field6', 2, 5, 'young_man'],
];

for (const [mapId, x, y, sprite] of FIELD_NPCS) {
  test(`フィールドNPC: ${mapId} (${x},${y}) に ${sprite}`, () => {
    const map = MAPS[mapId];
    const n = npcAt(mapId, x, y);
    assert.ok(n, `${mapId}(${x},${y}) にNPCが無い`);
    assert.strictEqual(n.sprite, sprite);
    assert.ok(Array.isArray(n.pages) && n.pages.length > 0);
    assert.strictEqual(n.joinId, undefined);
    assert.strictEqual(n.boss, undefined, 'フィールドNPCはボスにしない');
    assert.ok(isWalkable(map, x, y), `(${x},${y}) が歩行不可`);
    assert.ok(isFree(map, x, y, n), `(${x},${y}) が他要素と重複`);
  });
}
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: FAIL（フィールドNPC未配置）

- [ ] **Step 3: field1 の npcs へ追加**

```javascript
      { x: 11, y: 11, sprite: 'boy_blue',
        pages: ['ここは はじまりの そうげん！', 'ボールを けって みようよ！'] },
```

- [ ] **Step 4: field2 の npcs へ追加**

```javascript
      { x: 2, y: 7, sprite: 'supporter',
        pages: ['ナイターの あかりは まぶしいね！', 'いい しあいを みせて おくれ！'] },
```

- [ ] **Step 5: field3 の npcs へ追加**

```javascript
      { x: 2, y: 7, sprite: 'woman_brown',
        pages: ['すなの うえは あしが とられるよ。', 'バランスが たいせつ！'] },
```

- [ ] **Step 6: field4 の npcs へ追加**

```javascript
      { x: 13, y: 6, sprite: 'granny',
        pages: ['あめの ひは ボールが すべるよ。', 'きを つけて いくんだよ。'] },
```

- [ ] **Step 7: field5 の npcs へ追加**

```javascript
      { x: 2, y: 7, sprite: 'reporter',
        pages: ['そらの スタジアムへ ようこそ。', 'ガーディアンは つよいぞ、\nゆだんするな！'] },
```

- [ ] **Step 8: field6 の npcs へ追加**

```javascript
      { x: 2, y: 5, sprite: 'young_man',
        pages: ['ここは やみの きはいが こい…', 'カイザーは まだ たたかえない。\nうでを みがいて こい！'] },
```

- [ ] **Step 9: テストが通ることを確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test tests/mapfix-npc.test.js`
Expected: PASS（フィールドNPC6テスト）

- [ ] **Step 10: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/maps.js tests/mapfix-npc.test.js
git commit -m "feat(maps): 各フィールドに新NPCを配置（field1〜field6）"
```

---

### Task C5: サブプロジェクトC 統合・全テスト・決定論ビルド

**Files:**
- Build: `index.html`（`node build.js` 生成物）

- [ ] **Step 1: 全テスト緑を確認**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node --test 2>&1 | tail -5`
Expected: 全PASS（サブA＋サブCの新規テスト含む。fail 0）

- [ ] **Step 2: 決定論ビルド（md5 二重一致）**

Run:
```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js && md5 -q index.html
node build.js && md5 -q index.html
```
Expected: 2回の md5 が完全一致（値は実行して確認）

- [ ] **Step 3: 起動スモーク（黒画面でない＝バンドル構文健全）**

Run: `cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" && node -e "const html=require('fs').readFileSync('index.html','utf8'); if(!html.includes('girl_pink')||!html.includes('objectiveFor')) throw new Error('bundle missing new content'); console.log('bundle ok', html.length);"`
Expected: `bundle ok <サイズ>` が表示（例外なし）

- [ ] **Step 4: コミット（ビルド生成物）**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add index.html
git commit -m "build: サブプロジェクトC（NPC拡充）を反映"
```

---

## 実装後の最終確認（サブA＋C 統合）

- [ ] `node --test` 全緑（648 + 新規テスト、fail 0）
- [ ] `node build.js` の md5 が二重一致
- [ ] `objectiveFor` の第3章以降の順序が不変（`tests/mapfix-spine.test.js` の回帰テストで担保）
- [ ] 実機（iPhone / ブラウザ）で通し確認：①寄り道4か所を通らないと先へ進めない ②各マップを行き来できる ③カメオが加入後に消える ④新NPCに話しかけられる
- [ ] げんちゃんの「Pushして！」を待ってから本番配信（それまで push しない）

---
