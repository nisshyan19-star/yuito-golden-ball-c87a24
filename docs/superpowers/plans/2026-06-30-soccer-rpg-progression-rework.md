# ストーリー進行ゲート＆難易度カーブ作り直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 追加済みダンジョン（ほのおの どうくつ／こおりの とう）を「ストーリー順でしか入れない一本道」に再構成し、小学生でも次に行く場所に迷わないようにする（常設ナビ＋ゲート文＋難易度カーブの作り直し）。

**Architecture:** 進行は既存のフラグ（`boss_magma` / `boss_guardian` / `boss_kaiser` / `boss_dark_general` / `boss_ice` / `boss_neo_kaiser`）で表現される。(1) 純粋関数 `objectiveFor(flags)` を **既存の `src/data/story.js`** に追加し「いま向かうべき場所」を返す（新規srcファイルを作らない＝`build.js` を触らない）。(2) `field-scene.js` が毎フレーム HUD に「つぎの もくひょう」バーを描画し、案内コーチNPCがフルの案内文をしゃべる。(3) `maps.js` の3つの出口に `requireFlag` を足す／差し替えてハードゲート化し、ザコ敵とボス（マグマ・ゴーレム）の数値を序盤難易度に調整して、撃破フラグの並び `magma → guardian → kaiser → dark_general → ice → neo_kaiser` が単調増加になるようにする。

**Tech Stack:** プレーンJS（単一 `index.html` へ `build.js` が `src/` を固定 `ORDER` で連結）／`node --test`（標準テストランナー）／Claude Preview（実機ブラウザ検証 `http://localhost:5599/index.html`）。

---

## ⚠️ 着手前に必ず読む「鉄則」（このリポジトリ固有の地雷）

1. **単一スコープ束**：`build.js` が `src/` 全ファイルを1つの `<script>` に連結する。トップレベルの `const`/`let` 名が衝突すると SyntaxError＝黒画面。**新しいトップレベル識別子はユニーク名**（関数名 `_drawObjectiveBar` は既存と衝突しないことを確認済み）。
2. **`build.js` はメインエージェント専用**（サブエージェント編集禁止）。本プランは新規srcファイルを作らない設計なので **`build.js` の編集は不要**。`objectiveFor` は既にORDERに載っている `src/data/story.js` に入れる。
3. **`node --test` が通っても束が動く保証にはならない**。各タスクのビルド後は「`node build.js` → インラインscript抽出して `node --check` → 実機 `http://localhost:5599/index.html` をロードして目視」まで行う。ルート `/` は罠（dev-render-test.html を返す）なので必ず `/index.html` を明示。
4. **ボスの `vanishFlag` は `n.boss.vanishFlag` にネスト**（本プランは新ボスを足さないので無関係だが、撃破NPC消滅判定を触る時の鉄則）。
5. **有効なNPCスプライトキーは8種のみ**：`aoshi / coach / ikuma / itsuki / kaiser / keeper / shopkeep / tomoki`。案内コーチは `coach` を使う（実在キー）。
6. **`spawnEnemies` と `spawnForced` の両方**に `art` / `drops` がコピー済み＝敵の数値だけ変えるなら `battle-scene.js` の編集は不要。

---

## 検証で確定済みの地図グラフ（ゲートが効く根拠）

- 開始マップは `field1`（`src/core/game-state.js:44` / `:89` の `position.map: 'field1'`）。
- ch1一本道：`field1 →(出口7,16)→ town1 →(7,16)→ field2 → field3 → town2 → field4 → field5(=スカイスタジアム, guardian) → town3 → field6(=ダークアリーナ, dark_kaiser)`。
- **`field2` へ入る出口は `town1` の1本だけ**（`maps.js:670`）＝ここを `boss_magma` で閉じれば迂回不能。
- `town1 → village1`（`:671`, 無ゲート）→ `village1 → cave1`（`:766`, 無ゲート）＝マグマ討伐ルートは最初から開いている。よって「town1で前進を止められる→村→ほのおの どうくつでマグマ撃破→前進解放」が成立。
- ch2一本道：`boss_kaiser` で `ch2_gate` 解放（`:1264`）→ `ch2_town(=ノルドタウン)`。`ch2_town →(7,1)→ ch2_pass(=こおりの とうげ, dark_general)`（`:1689`, 無ゲート）／`ch2_town →(14,8)→ tower_ice_1f`（`:1690`）／`ch2_pass →(7,1)→ ch2_castle(=やみのしろ, neo_kaiser)`（`:1759`）。
- 各ボスのフラグと所在：`boss_magma`=ほのおの どうくつ(`:806`) / `boss_guardian`=スカイスタジアム(`:395`) / `boss_kaiser`=ダークアリーナ(`:479`) / `boss_dark_general`=こおりの とうげ(`:1726`) / `boss_ice`=こおりの とう さいじょうかい(`:955`) / `boss_neo_kaiser`=やみのしろ(`:1815`)。

---

## ファイル構成（作成・変更するもの）

| ファイル | 役割 | 本プランでの変更 |
|---|---|---|
| `src/data/story.js` | 進行ロジックの純粋関数群 | `objectiveFor(flags)` を追加し UMD export に載せる |
| `src/data/enemies.js` | 敵定義 | `magma_golem` を序盤ボス相当に弱体化（単形態化） |
| `src/data/maps.js` | マップ・出口・宝箱・エンカウント | cave1エンカウント弱体化＋炎ボス報酬差し替え＋3つのゲート＋コーチNPC2体 |
| `src/scenes/field-scene.js` | フィールド描画・NPC会話 | `_drawObjectiveBar` 追加＋描画呼び出し＋`npc.guide` 会話分岐 |
| `tests/progression-gates.test.js` | 進行ゲート＆数値の回帰テスト | 新規作成 |

YAGNI（今回やらない）：森の神殿／水の地底湖の中身（席だけ予約のまま）。`legend_arena`・`challenge_room` 等のクリア後ボーナス導線（本線ではないので `requireFlag` 機構の拡張はしない）。新タイル・新ボス・新スプライト。

---

## 共通の環境準備（各タスクのコマンドで使用）

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node -v   # v24.x が出ればOK
```

> **コミット/プッシュの扱い：** 各タスクにコミット手順を書くが、これは TDD のローカル・チェックポイント。**本番（GitHub Pages）への push は げんちゃんが「pushして」と言うまで絶対に行わない。** ローカルコミットも、げんちゃんの運用方針に合わせて省略可（実行時に確認）。

---

## Task 1: `objectiveFor(flags)` を story.js に追加

「撃破フラグの並び」を1か所に集約し、未達の最初の目標を返す純粋関数。HUDバー用の短文 `bar` と、コーチ会話用のフル案内文 `npc` を返す。

**Files:**
- Modify: `src/data/story.js`（末尾の関数群に追加＋`:144-149` の UMD export に1行追加）
- Test: `tests/progression-gates.test.js`（このタスクで新規作成）

- [ ] **Step 1: 失敗するテストを書く**

新規 `tests/progression-gates.test.js` を作成：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const story = require('../src/data/story.js');

test('objectiveFor: 何もしていない時は ほのおの どうくつ を指す', () => {
  const o = story.objectiveFor({});
  assert.ok(o.bar.includes('ほのお'), 'barに「ほのお」が含まれる: ' + o.bar);
  assert.ok(o.npc.includes('マグマ'), 'npc文にマグマが含まれる');
  assert.strictEqual(o.done, false);
});

test('objectiveFor: マグマ撃破後は スカイスタジアム(ガーディアン) を指す', () => {
  const o = story.objectiveFor({ boss_magma: true });
  assert.ok(o.bar.includes('スカイスタジアム'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガーディアン'));
});

test('objectiveFor: カイザー撃破後は こおりの とうげ(ヴォルク) を指す', () => {
  const o = story.objectiveFor({ boss_magma: true, boss_guardian: true, boss_kaiser: true });
  assert.ok(o.bar.includes('こおりの とうげ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ヴォルク'));
});

test('objectiveFor: 将軍撃破後は こおりの とう(アイスゴーレム) を指す', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true, boss_dark_general: true,
  });
  assert.ok(o.bar.includes('こおりの とう'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('アイスゴーレム'));
});

test('objectiveFor: アイス撃破後は やみのしろ(ネオ・カイザー) を指す', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true,
  });
  assert.ok(o.bar.includes('やみのしろ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ネオ・カイザー'));
});

test('objectiveFor: 全部倒したら done=true', () => {
  const o = story.objectiveFor({
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_neo_kaiser: true,
  });
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'));
});
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: FAIL（`story.objectiveFor is not a function`）

- [ ] **Step 3: 最小実装を書く**

`src/data/story.js` の `getEnding` 関数のあと（`:139` の閉じ `}` の直後、UMD ブロックの前）に追加：

```js
// === 進行ナビ（ストーリー進行ゲートの作り直し） ===
// objectiveFor: 撃破フラグの並びを1か所に集約し、「未達の最初の目標」を返す純粋関数。
//   返り値 { bar:HUD用の短文, npc:コーチ会話用のフル案内文, done:全クリアか }。
//   本線の順序は magma → guardian → kaiser → dark_general → ice → neo_kaiser。
//   この順序が、出口の requireFlag（maps.js）と完全に一致している必要がある。
function objectiveFor(flags) {
  flags = flags || {};
  var spine = [
    { flag: 'boss_magma',
      bar: 'ほのおの どうくつへ！',
      npc: 'みのりの村の おくに ある\nほのおの どうくつで\nマグマ・ゴーレムを たおそう！' },
    { flag: 'boss_guardian',
      bar: 'スカイスタジアムへ！',
      npc: 'つぎは スカイスタジアムで\nガーディアンを たおそう！' },
    { flag: 'boss_kaiser',
      bar: 'ダークアリーナへ！',
      npc: 'ダークアリーナの ボス\nダーク・カイザーを たおして\nだい1しょうを クリアしよう！' },
    { flag: 'boss_dark_general',
      bar: 'こおりの とうげへ！',
      npc: 'だい2しょう スタート！\nノルドタウンの きたの\nこおりの とうげで\nやみの しょうぐん ヴォルクを たおそう！' },
    { flag: 'boss_ice',
      bar: 'こおりの とうへ！',
      npc: 'ノルドタウンの ひがしの\nこおりの とうの てっぺんで\nアイス・ゴーレムを たおそう！' },
    { flag: 'boss_neo_kaiser',
      bar: 'やみのしろへ！',
      npc: 'やみのしろの ネオ・カイザーを\nたおして せかいを すくおう！' },
  ];
  for (var i = 0; i < spine.length; i++) {
    if (!flags[spine[i].flag]) {
      return { bar: spine[i].bar, npc: spine[i].npc, done: false };
    }
  }
  return {
    bar: 'すべて クリア！',
    npc: 'おめでとう！\nきみは ほんものの ゆうしゃだ！',
    done: true,
  };
}
```

そして UMD export（`src/data/story.js` 末尾）に `objectiveFor` を追加：

```js
})(typeof window !== 'undefined' ? window : globalThis, {
  joinAlly: joinAlly,
  getEnding: getEnding,
  questStage: questStage,
  grantReward: grantReward,
  objectiveFor: objectiveFor,
});
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: PASS（このタスク分の6テストが ok）

- [ ] **Step 5: コミット（ローカル・チェックポイント）**

```bash
git add src/data/story.js tests/progression-gates.test.js
git commit -m "feat(rpg): add objectiveFor progression navigator to story.js"
```

---

## Task 2: マグマ・ゴーレムを「最初の試練」相当に弱体化

撃破フラグの並びを単調増加にするため、`magma_golem` を一番弱いボスにする（単形態化）。

**Files:**
- Modify: `src/data/enemies.js:157-172`（`magma_golem` ブロック）
- Test: `tests/progression-gates.test.js`

- [ ] **Step 1: 失敗するテストを追加**

`tests/progression-gates.test.js` の末尾に追記：

```js
const ENEMIES = require('../src/data/enemies.js').ENEMIES;

test('magma_golem は最弱ボス相当・単形態（難易度カーブ単調）', () => {
  const m = ENEMIES.magma_golem;
  assert.strictEqual(m.hp, 80, 'magmaのhpは80');
  assert.ok(!m.phases, 'magmaは単形態（phases無し）');
  // 単調増加：magma < guardian < dark_kaiser < dark_general < ice_golem < neo_kaiser
  const hp = (id) => ENEMIES[id].hp;
  assert.ok(hp('magma_golem') < hp('guardian'),     'magma < guardian');
  assert.ok(hp('guardian')   < hp('dark_kaiser'),   'guardian < dark_kaiser');
  assert.ok(hp('dark_kaiser')< hp('dark_general'),  'dark_kaiser < dark_general');
  assert.ok(hp('dark_general')< hp('ice_golem'),    'dark_general < ice_golem');
  assert.ok(hp('ice_golem')  < hp('neo_kaiser'),    'ice_golem < neo_kaiser');
});
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: FAIL（`magmaのhpは80` が 200 で不一致／phases が存在）

- [ ] **Step 3: enemies.js を編集**

`src/data/enemies.js` の `magma_golem` ブロックを以下に置き換える（`hp` 行の数値を下げ、`phases` 配列を丸ごと削除。`art` / `drops` / `quotes` は維持）：

```js
  magma_golem: {
    id:'magma_golem', name:'マグマ・ゴーレム', type:'power', art:'throwin_golem',
    isBoss: true,
    hp:80, atk:10, def:7, spd:5, exp:40, gold:35,
    drops: [{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:0.7 }],
    quotes: {
      intro: ['「ようがんの ねむりを\nさました やつは だれだ！」'],
      phase: '「ぐおおお…\nもえあがれ マグマ！」',
      defeat: '「しずまる… また\nねむりに つくとしよう…」',
    },
  },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/data/enemies.js tests/progression-gates.test.js
git commit -m "balance(rpg): weaken magma_golem to first-trial boss (single form)"
```

---

## Task 3: ほのおの どうくつ のザコ弱体化＋炎ボス報酬の調整

序盤ダンジョンらしく、エンカウントを最弱敵だけにして報酬も序盤相当に。

**Files:**
- Modify: `src/data/maps.js:807`（炎ボス直接報酬 `reward`）
- Modify: `src/data/maps.js:821`（炎ボス後の鍵付き宝箱 `cave1_chest_boss` の中身）
- Modify: `src/data/maps.js:836-840`（cave1 の `encounter`）
- Test: `tests/progression-gates.test.js`

- [ ] **Step 1: 失敗するテストを追加**

`tests/progression-gates.test.js` の末尾に追記：

```js
const MAPS = require('../src/data/maps.js').MAPS;

test('cave1 エンカウントは最弱敵のみ＋レアは golden_ball', () => {
  const enc = MAPS.cave1.encounter;
  const easy = ['foul_goblin', 'mud_slime', 'offside_ghost', 'corner_crow'];
  assert.deepStrictEqual(enc.enemies.slice().sort(), easy.slice().sort());
  assert.deepStrictEqual(enc.rare.enemies, ['golden_ball']);
  assert.ok(enc.rate <= 0.08, 'cave1のエンカ率は0.08以下');
  // 強すぎる中盤敵が混ざっていないこと
  ['metal_keeper', 'pk_punisher', 'throwin_golem'].forEach((id) => {
    assert.ok(!enc.enemies.includes(id), id + ' は cave1 に出ない');
  });
});

test('炎ボス報酬は序盤相当（スピードスパイク＋こうてつガード）', () => {
  // cave1 の boss NPC を探す
  const npcs = MAPS.cave1.npcs || [];
  const bossNpc = npcs.find((n) => n.boss && n.boss.winFlag === 'boss_magma');
  assert.ok(bossNpc, '炎ボスNPCが存在');
  assert.strictEqual(bossNpc.boss.reward.item, 'spike2');
  // 鍵付き宝箱
  const chest = (MAPS.cave1.chests || []).find((c) => c.id === 'cave1_chest_boss');
  assert.ok(chest, 'cave1_chest_boss が存在');
  assert.strictEqual(chest.item, 'forged_guard');
});
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: FAIL（reward.item が `mithril_spike`／chest.item が `mithril_armor`／enemies が中盤敵）

- [ ] **Step 3: maps.js を編集（3か所）**

(3-a) `src/data/maps.js:807` の炎ボス直接報酬を差し替え：

```js
          reward: { item: 'spike2', amount: 1, label: 'スピードスパイク' },
```

(3-b) `src/data/maps.js:821` の鍵付き宝箱 `cave1_chest_boss` の中身を差し替え（`item` と `label` のみ変更。`requireFlag`/`lockedMsg` は維持）：

```js
        id: 'cave1_chest_boss', x: 4, y: 1, item: 'forged_guard', amount: 1, label: 'こうてつガード',
```

(3-c) `src/data/maps.js:836-840` の cave1 `encounter` を差し替え：

```js
    encounter: {
      rate: 0.08,
      enemies: ['foul_goblin', 'mud_slime', 'offside_ghost', 'corner_crow'],
      rare: { rate: 0.04, enemies: ['golden_ball'] },
    },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/data/maps.js tests/progression-gates.test.js
git commit -m "balance(rpg): down-tune cave1 encounters and first-dungeon rewards"
```

---

## Task 4: 3つのハードゲート（出口 `requireFlag`）

進行順 `magma → guardian → kaiser → dark_general → ice → neo_kaiser` を出口で強制する。新規ゲート2つ＋既存ゲート1つの差し替え。

**Files:**
- Modify: `src/data/maps.js:670`（town1 → field2 に `boss_magma` ゲート追加）
- Modify: `src/data/maps.js:1690`（ch2_town → tower_ice_1f に `boss_dark_general` ゲート追加）
- Modify: `src/data/maps.js:1759-1762`（ch2_pass → ch2_castle のゲートを `boss_dark_general` → `boss_ice` に差し替え＋文言更新）
- Test: `tests/progression-gates.test.js`

> 出口の `requireFlag`/`lockedMsg` 判定は `field-scene.js:1902-1905` に既に実装済み＝データを足すだけで動く。

- [ ] **Step 1: 失敗するテストを追加**

`tests/progression-gates.test.js` の末尾に追記：

```js
function findExit(mapId, toId) {
  return (MAPS[mapId].exits || []).find((e) => e.to === toId);
}

test('ゲート1: town1→field2 は boss_magma が必要', () => {
  const e = findExit('town1', 'field2');
  assert.ok(e, 'town1→field2 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_magma');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('ほのお'), 'lockedMsgが行き先を案内');
});

test('ゲート2: ch2_town→tower_ice_1f は boss_dark_general が必要', () => {
  const e = findExit('ch2_town', 'tower_ice_1f');
  assert.ok(e, 'ch2_town→tower_ice_1f 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_dark_general');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('ヴォルク'), 'lockedMsgが将軍を案内');
});

test('ゲート3: ch2_pass→ch2_castle は boss_ice が必要（将軍ではなくアイス）', () => {
  const e = findExit('ch2_pass', 'ch2_castle');
  assert.ok(e, 'ch2_pass→ch2_castle 出口が存在');
  assert.strictEqual(e.requireFlag, 'boss_ice');
  assert.ok(e.lockedMsg && e.lockedMsg.includes('アイス'), 'lockedMsgがアイスゴーレムを案内');
});
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: FAIL（ゲート1/2は requireFlag undefined、ゲート3は `boss_dark_general` で不一致）

- [ ] **Step 3: maps.js を編集（3か所）**

(4-a) `src/data/maps.js:670` の town1→field2 出口を差し替え：

```js
      { x: 7, y: 16, to: 'field2', tx: 7, ty: 2,
        requireFlag: 'boss_magma',
        lockedMsg: 'スタジアムへの みちは\nまだ とおれない。\nまずは みのりの村の おくの\nほのおの どうくつで\nマグマ・ゴーレムを たおそう！' },
```

(4-b) `src/data/maps.js:1690` の ch2_town→tower_ice_1f 出口を差し替え：

```js
      { x: 14, y: 8, to: 'tower_ice_1f', tx: 8, ty: 15,
        requireFlag: 'boss_dark_general',
        lockedMsg: 'こおりの とうの とびらは\nこおりついて ひらかない。\nまずは こおりの とうげで\nやみの しょうぐん ヴォルクを\nたおそう！' }, // 東：こおりの とう 入口
```

(4-c) `src/data/maps.js:1759-1762` の ch2_pass→ch2_castle 出口を差し替え（`requireFlag` を `boss_ice` に、`lockedMsg` を更新）：

```js
      {
        x: 7, y: 1, to: 'ch2_castle', tx: 7, ty: 15,
        requireFlag: 'boss_ice',
        lockedMsg: 'やみのしろの もんは かたい。\nこおりの とうの ぬし\nアイス・ゴーレムを たおせば\nひらく かもしれない…',
      },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/data/maps.js tests/progression-gates.test.js
git commit -m "feat(rpg): hard-gate dungeon order via exit requireFlags"
```

---

## Task 5: HUD「つぎの もくひょう」バー（常設ナビ）

フィールドの画面上部（ネームプレートの下）に、`objectiveFor(state.flags).bar` を毎フレーム描画する。

**Files:**
- Modify: `src/scenes/field-scene.js`（`_drawObjectiveBar` 関数を新規追加＋draw内の `:2213` 直後に呼び出し）
- Test: 実機目視（Task 8 でまとめて）＋ `node --check`

> `_drawObjectiveBar` は既存の `_draw*` 群（`_drawFieldObject`/`_drawWarpPanel`/…）と名前衝突しないことを grep で確認済み（鉄則①）。`drawWindow(ctx,x,y,w,h,{radius,border})` と `drawText(ctx,str,x,y,{size,color,align})` のシグネチャは `field-scene.js:2212-2213`（ネームプレート）と同形。`S.objectiveFor` は Task 1 で window.SRPG に載る。draw 関数のクロージャ変数 `state` はこのファイル全域で `state.flags` として使用済み＝参照可能。

- [ ] **Step 1: `_drawObjectiveBar` 関数を追加**

`src/scenes/field-scene.js` のトップレベル（例：`_drawChestGlow` 関数の直後）に追加：

```js
// つぎの もくひょう バー（進行ナビ）：画面上部のネームプレート下に常設表示。
// text が空なら何も描かない。color は あたたかい金色で「いま向かう場所」を強調。
function _drawObjectiveBar(ctx, S, text) {
  if (!text) return;
  var VW = S.VW;
  var w = 188, h = 20;
  var x = VW / 2 - w / 2, y = 34;
  S.drawWindow(ctx, x, y, w, h, { radius: 7, border: '#ffcf4a' });
  S.drawText(ctx, '▶ ' + text, VW / 2, y + 4, { size: 11, color: '#ffe9a0', align: 'center' });
}
```

- [ ] **Step 2: draw 内で呼び出す**

`src/scenes/field-scene.js:2211-2213`（ネームプレート描画）の直後・`:2214` の `},`（draw 関数の閉じ）の直前に追加：

```js
      // 8. つぎの もくひょう バー（進行ナビ：いま どこへ いけば いいか 常設表示）
      if (typeof S.objectiveFor === 'function') {
        var _ob = S.objectiveFor((state && state.flags) || {});
        if (_ob && _ob.bar) _drawObjectiveBar(ctx, S, _ob.bar);
      }
```

- [ ] **Step 3: ビルドして構文を確認**

```bash
node build.js
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);fs.writeFileSync('/tmp/srpg_inline.js',m[1]);" && node --check /tmp/srpg_inline.js && echo "INLINE OK"
```
Expected: `INLINE OK`（束のインラインJSが構文エラーなし）

- [ ] **Step 4: コミット**

```bash
git add src/scenes/field-scene.js
git commit -m "feat(rpg): always-on next-objective HUD bar on field"
```

---

## Task 6: 案内コーチNPC（`npc.guide`）＋ハブ町2か所に配置

話しかけると `objectiveFor` のフル案内文をしゃべるコーチを ch1 ハブ（town1）と ch2 ハブ（ch2_town）に置く。

**Files:**
- Modify: `src/scenes/field-scene.js:1627` 直前（`⑧通常会話` の前に `npc.guide` 分岐を追加）
- Modify: `src/data/maps.js`（town1 の npcs に1体／ch2_town の npcs に1体追加）
- Test: `tests/progression-gates.test.js`（コーチNPCの存在）＋実機（Task 8）

> 配置タイルは検証済み：town1 到着(7,2)隣の **(6,2)** は床（r2 `'#......,.......#'` の index6）でNPC/オブジェクト無し。ch2_town 到着(7,15)隣の **(6,15)** も床（r15 同パターン）でNPC/オブジェクト無し。スプライトは実在キー `coach`。

- [ ] **Step 1: 失敗するテストを追加**

`tests/progression-gates.test.js` の末尾に追記：

```js
test('案内コーチが town1 と ch2_town に居る（guide:true・coachスプライト）', () => {
  const t1 = (MAPS.town1.npcs || []).find((n) => n.guide);
  assert.ok(t1, 'town1に案内コーチが居る');
  assert.strictEqual(t1.sprite, 'coach');
  const t2 = (MAPS.ch2_town.npcs || []).find((n) => n.guide);
  assert.ok(t2, 'ch2_townに案内コーチが居る');
  assert.strictEqual(t2.sprite, 'coach');
});
```

- [ ] **Step 2: テストを走らせて落ちることを確認**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -20`
Expected: FAIL（guide NPC が存在しない）

- [ ] **Step 3: `npc.guide` 会話分岐を追加（field-scene.js）**

`src/scenes/field-scene.js:1627` の `// ⑧ 通常会話` の直前に追加：

```js
    // ⑦.9 案内コーチ（進行ナビ）：いま むかうべき もくひょうを フルで おしえる。
    if (npc.guide) {
      var gpages = [];
      if (typeof S.objectiveFor === 'function') {
        var ob = S.objectiveFor((state && state.flags) || {});
        if (ob && ob.npc) gpages.push(ob.npc);
      }
      if (npc.pages && npc.pages.length) gpages = gpages.concat(npc.pages);
      if (!gpages.length) gpages = ['げんきに がんばろう！'];
      S.pushScene(S.createDialog(gpages));
      return;
    }
```

- [ ] **Step 4: コーチNPCを2体追加（maps.js）**

(6-a) `src/data/maps.js` の **town1** の `npcs:` 配列の先頭要素として追加（`:565` のブロック内、`npcs: [` の直後）：

```js
      {
        x: 6, y: 2, sprite: 'coach', guide: true,
        pages: ['こまったら いつでも\nコーチに きいてね！'],
      },
```

(6-b) `src/data/maps.js` の **ch2_town** の `npcs:` 配列の先頭要素として追加（`:1598` のブロック内、`npcs: [` の直後）：

```js
      {
        x: 6, y: 15, sprite: 'coach', guide: true,
        pages: ['だい2しょうも\nコーチが ついてるぞ！'],
      },
```

- [ ] **Step 5: テスト＋ビルド＋構文確認**

```bash
node --test tests/progression-gates.test.js 2>&1 | tail -20
node build.js
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);fs.writeFileSync('/tmp/srpg_inline.js',m[1]);" && node --check /tmp/srpg_inline.js && echo "INLINE OK"
```
Expected: テスト PASS ＋ `INLINE OK`

- [ ] **Step 6: コミット**

```bash
git add src/scenes/field-scene.js src/data/maps.js tests/progression-gates.test.js
git commit -m "feat(rpg): add guide coach NPCs in hub towns"
```

---

## Task 7: 全テスト＆ビルドのグリーン確認

進行ゲート群と既存テストがすべて通り、束のビルドも構文クリーンであることを確定する。

**Files:**
- 変更なし（検証のみ）

- [ ] **Step 1: 進行ゲートテスト単体**

Run: `node --test tests/progression-gates.test.js 2>&1 | tail -25`
Expected: 本プランの全テスト（objectiveFor 6 + magma 1 + cave1 2 + gate 3 + coach 1）が PASS、fail 0

- [ ] **Step 2: 全テスト**

Run: `node --test 2>&1 | tail -25`
Expected: 既存テスト含めて全 PASS（fail 0）。特に `map-gimmicks.test.js` 等が落ちないこと

- [ ] **Step 3: ビルド＋束の構文確認**

```bash
node build.js
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);fs.writeFileSync('/tmp/srpg_inline.js',m[1]);" && node --check /tmp/srpg_inline.js && echo "INLINE OK"
md5 -q index.html
wc -c < index.html
```
Expected: `INLINE OK`。md5 とバイト数を控えておく（実機検証後の記録用）

---

## Task 8: 実機 通しプレイ検証（迷わず・順番どおりに進めるか）

実ブラウザで「ゲートが効く／HUDバーとコーチが正しい行き先を出す」ことを目視する。

**Files:**
- 変更なし（検証のみ）

> Claude Preview のサーバは `srpg-dev`（port 5599）。**必ず `http://localhost:5599/index.html` を明示**（ルート `/` は dev-render-test の罠）。`preview_eval` の引数名は `expression`。

- [ ] **Step 1: 最新ビルドをロード**

`preview_start`（無ければ）→ `preview_eval { expression: "window.location.href='http://localhost:5599/index.html'" }` → リロード。`preview_console_logs` でエラー0を確認。

- [ ] **Step 2: 開始直後（field1→town1）でゲートを確認**

新規ゲームを開始 → town1 へ移動 → 南出口(7,16)へ進入を試す。
Expected: ゲート文「スタジアムへの みちは まだ…ほのおの どうくつで マグマ・ゴーレムを たおそう！」が出て **field2 へ行けない**。画面上部HUDに「▶ ほのおの どうくつへ！」が常時表示。

- [ ] **Step 3: コーチに話す**

town1 の (6,2) のコーチに話しかける。
Expected: 「みのりの村の おくに ある ほのおの どうくつで マグマ・ゴーレムを たおそう！」をしゃべる。

- [ ] **Step 4: マグマ討伐 → ゲート解放**

（デバッグで `flags.boss_magma=true` を立ててもよい：`preview_eval` で現在 state にフラグを立てる、または実際に村→cave1 で討伐）討伐後に town1 南出口へ。
Expected: field2 へ通れる。HUDが「▶ スカイスタジアムへ！」に変わる。コーチも案内文が更新される。

- [ ] **Step 5: ch2 ゲートの確認**

`flags` に `boss_kaiser` まで立てた状態で ch2_town へ。
- ch2_town 東出口(14,8)→tower_ice：`boss_dark_general` 未達なら「こおりの とうの とびらは こおりついて…ヴォルクを たおそう！」でブロック。
- `boss_dark_general` 達成後 → tower_ice に入れる。HUDは「▶ こおりの とうへ！」。
- ch2_pass 北出口→ch2_castle：`boss_ice` 未達なら「やみのしろの もんは かたい…アイス・ゴーレムを たおせば」でブロック。`boss_ice` 達成で通れる。

- [ ] **Step 6: スクリーンショットで証拠**

`preview_screenshot` を Step 2（ゲート文＋HUD）／Step 4（HUD更新）／Step 5（ch2ゲート文）で撮り、げんちゃんに共有。`preview_console_logs` でエラー0を最終確認。

- [ ] **Step 7: 記録（正典＋Obsidianミラー）**

メモリ正典 `project_soccer_rpg_yuito.md` 本文と Obsidian ミラーに、進行ゲート実装完了・最新 index.html の md5/バイト数・未push である旨を追記。

---

## Task 9（任意）: ほのおの どうくつ 専用ザコの AI アート

cave1 のザコは既存の最弱敵（`foul_goblin`/`mud_slime`/`offside_ghost`/`corner_crow`）を流用しており、AIアートは既に存在する。**炎テーマ専用の新ザコ絵が欲しい場合のみ**、げんちゃんに確認のうえ ChatGPT で生成する。

- [ ] **Step 1:** げんちゃんに「炎ダンジョン専用ザコ絵を新規で作る？既存流用で十分？」を確認。
- [ ] **Step 2:** 作る場合のみ、既存の敵AIアート取り込みフロー（`enemy-art.js` への base64 追加＋`art` キー対応）に従う。**新規敵を足す場合は `spawnEnemies`/`spawnForced` 両方への field コピー鉄則を順守**。
- [ ] （不要と判断したらこのタスクはスキップしてクローズ）

---

## Self-Review チェック（プラン作成者による確認・済）

- **Spec coverage:** 設計書の (i)ストーリー順 (ii)迷わせない (iii)ハードゲート (iv)難易度カーブ作り直し をそれぞれ Task1/5/6（ナビ）・Task4（ゲート）・Task2/3（難易度）でカバー。3案内機構（HUDバー=Task5／コーチ=Task6／ゲート文=Task4）を実装。森の神殿・水の地底湖は YAGNI として明示除外。
- **Placeholder scan:** 「TBD/後で」等なし。全コードブロックは実ファイルの現状から起こした確定値。
- **Type consistency:** `objectiveFor` の返り値 `{bar,npc,done}` は Task1 で定義、Task5（`_ob.bar`）と Task6（`ob.npc`）で同じ名前で使用。フラグ名（`boss_magma`/`boss_dark_general`/`boss_ice` 等）は maps.js の実 `winFlag`/`requireFlag` と一致を検証済み。NPCスプライト `coach` は有効8キーに含まれる。
- **設計書からの精緻化（意図的な改善）:** 設計書では `src/logic/objective.js` 新規作成としていたが、`build.js` の固定 ORDER 編集（=メインエージェント専用作業）を避けるため、**既にORDER・UMDに載っている `src/data/story.js` に `objectiveFor` を同居**させる方式へ変更。サブエージェントでも実装可能になる。`legend_arena` 等のボーナス導線ゲートは、warp に `requireFlag` 機構が無く拡張が本線要件外のため YAGNI として見送り（本線の迷子防止は HUD＋コーチ＋本線ゲートで充足）。
