# 仲間加入必須化＋ストーリー充実 実装プラン（第3弾・物語編）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仲間4人（イクマ/アオシ/トモキ/イツキ）の加入を出口ロックで必須化し、加入演出（ミニストーリー＋AI立ち絵カットイン＋ファンファーレSE）と勝利イベント・伏線・進行で変わる会話・章転換カットシーンでストーリーを充実させる。

**Architecture:** 新規バンドルファイル0・build.js ORDER 編集0。全て既存ファイルへの追記か既存関数の拡張。新トップレベル識別子は `createJoinCutinScene` と `npcPagesFor` の2つのみ（grep 衝突ゼロ確認済み）。出口ロックは既存の exit.requireFlag/lockedMsg 機構＋`joinAlly` が立てる `joined_*` フラグをそのまま使う（新コード不要のデータ駆動）。勝利イベントは `map.cutscenes` 配列＋`pendingCutscene` の requireFlag 対応拡張で battle-scene を一切触らずに実現する。

**Tech Stack:** 素の JavaScript（UMD）・単一 index.html バンドル（`src/**` → `node build.js` で結合・build.js は編集不可）・テストは `node --test`。

**Node PATH（各コマンドの前に必要）:** `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`

**コミット:** ブランチ `feat/game-implementation` にタスク単位。`git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit`。**push は「Pushして！」の明示指示があるまで封印。**

---

## 検証3点セット（各実装タスクの最後・および Task Z）

1. `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test` → 全 PASS
2. `node build.js` → index.html 再生成。inline script を `node --check` 相当で構文確認（build.js が成功すればビルド通過）
3. 実機（Task Z のみ）: preview server `srpg-dev`(port 5599)・serverId は毎回 `preview_list`・`http://localhost:5599/index.html` を明示 navigate

## File Structure（変更対象と責務）

- `src/data/story.js` — `objectiveFor` の spine に加入目標4つを挿入（A）
- `src/core/game-state.js` — `createNewGamePlus` に仲間4種ホワイトリスト復元（A）
- `src/scenes/field-scene.js` — join handler 自己修復＋joinStory/カットイン組込（A/B）、`createJoinCutinScene` 新規（B）、`pendingCutscene` 複数対応（C-1）、`npcPagesFor` 新規＋通常会話分岐差替（C-3）、UMD export 2件追加
- `src/engine/audio.js` — `SRPG_SE.join` 追加（B）
- `src/data/maps.js` — field1〜4 出口ロック（A）、仲間NPC に joinStory（B）、勝利イベント cutscenes 5本＋章転換2本（C-1/C-4）、伏線＋variants 会話（C-2/C-3）
- `tests/progression-gates.test.js`・`tests/forest-shrine.test.js` — 新 spine に合わせ objectiveFor テストの前提フラグを修正
- `tests/newgame-plus.test.js`・`tests/audio.test.js`・`tests/story4.test.js` — テスト追加/維持

---

# グループA：仲間加入の必須化（ここだけで「必須化」が完成する最小単位）

## Task A1: objectiveFor の spine に加入目標4つを挿入し、既存テストを新順序に修正

**Files:**
- Modify: `src/data/story.js:177-199`（spine 配列）
- Modify: `tests/progression-gates.test.js:7-59`
- Modify: `tests/forest-shrine.test.js:225-243`

- [ ] **Step 1: 既存テストを新 spine 前提に書き換える（先に失敗させる）**

`tests/progression-gates.test.js` の 7〜59 行（objectiveFor 7本）を以下で置換する。ヘルパ `J`（仲間4人加入済み）を導入し、各ボス段階テストは仲間を全員加入済みにした状態を渡す。先頭テストは「最初の目標＝イクマ加入」に意味を合わせて書き換える。

```javascript
// 仲間4人 加入済み（joined_* 一式）。ボス段階のテストは全員加入前提で渡す。
const J = { joined_ikuma: true, joined_aoshi: true, joined_tomoki: true, joined_itsuki: true };

test('objectiveFor: 何もしていない時は イクマ加入 を指す', () => {
  const o = story.objectiveFor({});
  assert.ok(o.bar.includes('イクマ'), 'barに「イクマ」が含まれる: ' + o.bar);
  assert.ok(o.npc.includes('イクマ'), 'npc文にイクマが含まれる');
  assert.strictEqual(o.done, false);
});

test('objectiveFor: イクマ加入後は ほのおの どうくつ を指す', () => {
  const o = story.objectiveFor({ joined_ikuma: true });
  assert.ok(o.bar.includes('ほのお'), 'barに「ほのお」が含まれる: ' + o.bar);
  assert.ok(o.npc.includes('マグマ'), 'npc文にマグマが含まれる');
  assert.strictEqual(o.done, false);
});

test('objectiveFor: 4人加入＋マグマ撃破後は スカイスタジアム(ガーディアン) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, { boss_magma: true }));
  assert.ok(o.bar.includes('スカイスタジアム'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガーディアン'));
});

test('objectiveFor: カイザー撃破後は こおりの とうげ(ヴォルク) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
  }));
  assert.ok(o.bar.includes('こおりの とうげ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ヴォルク'));
});

test('objectiveFor: 将軍撃破後は こおりの とう(アイスゴーレム) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    boss_magma: true, boss_guardian: true, boss_kaiser: true, boss_dark_general: true,
  }));
  assert.ok(o.bar.includes('こおりの とう'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('アイス・ゴーレム'));
});

test('objectiveFor: アイス撃破後は もりの しんでん(ガイア) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true,
  }));
  assert.ok(o.bar.includes('もりの しんでん'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ガイア'));
});

test('objectiveFor: 森撃破後は やみのしろ(ネオ・カイザー) を指す', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true,
  }));
  assert.ok(o.bar.includes('やみのしろ'), 'bar: ' + o.bar);
  assert.ok(o.npc.includes('ネオ・カイザー'));
});

test('objectiveFor: 全部倒したら done=true', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
  }));
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'));
});
```

`tests/forest-shrine.test.js:225-243` の objectiveFor 2本を、仲間全員加入前提に修正する。まず 224 行付近（該当テスト群の直前）に `const J = { joined_ikuma:true, joined_aoshi:true, joined_tomoki:true, joined_itsuki:true };` を追加し、2本のテストの `story.objectiveFor({...})` 引数を `story.objectiveFor(Object.assign({}, J, {...}))` に変更する（boss_ice 済み→「もりの しんでんへ！」／boss_forest 済み→「やみのしろへ！」の期待値はそのまま）。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: 先頭「何もしていない時は イクマ」等が FAIL（現 spine はまだボスだけなので bar='ほのお…'）。

- [ ] **Step 3: story.js の spine に加入目標4つを挿入**

`src/data/story.js:177-199` の spine 配列を以下で置換する（順序＝ゲート順・maps.js の requireFlag 順と一致）。

```javascript
  var spine = [
    { flag: 'joined_ikuma',
      bar: 'イクマを なかまに しよう！',
      npc: 'はじまりの草原に いる\nはやての FW イクマに\nはなしかけて なかまに しよう！' },
    { flag: 'boss_magma',
      bar: 'ほのおの どうくつへ！',
      npc: 'みのりの村の おくに ある\nほのおの どうくつで\nマグマ・ゴーレムを たおそう！' },
    { flag: 'joined_aoshi',
      bar: 'アオシを なかまに しよう！',
      npc: 'ナイタースタジアムに いる\nてんさい MF アオシに\nはなしかけて なかまに しよう！' },
    { flag: 'joined_tomoki',
      bar: 'トモキを なかまに しよう！',
      npc: 'サンドコートに いる\nまもりの DF トモキに\nはなしかけて なかまに しよう！' },
    { flag: 'joined_itsuki',
      bar: 'イツキを なかまに しよう！',
      npc: 'レイニーピッチに いる\nでんせつの GK イツキに\nはなしかけて なかまに しよう！' },
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
    { flag: 'boss_forest',
      bar: 'もりの しんでんへ！',
      npc: 'こおりの とうげの きたから\nもりの しんでんへ。\nさいじょうかいの 森の守り神\nガイアを たおそう！' },
    { flag: 'boss_neo_kaiser',
      bar: 'やみのしろへ！',
      npc: 'やみのしろの ネオ・カイザーを\nたおして せかいを すくおう！' },
  ];
```

- [ ] **Step 4: テストを実行して PASS を確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js tests/forest-shrine.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/data/story.js tests/progression-gates.test.js tests/forest-shrine.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(story): objectiveFor spine に仲間加入目標4つを挿入"
```

## Task A2: field1〜4 の南出口に requireFlag/lockedMsg を追加（出口ロック）

**Files:**
- Modify: `src/data/maps.js`（field1 exits 131-133 / field2 212-214 / field3 284-286 / field4 362-364）
- Test: `tests/progression-gates.test.js`（maps 検査を追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/progression-gates.test.js` の末尾（132 行以降）に以下を追加する。

```javascript
test('必須化: field1〜4 の南出口(7,16) に requireFlag/lockedMsg があり joined_* と一致する', () => {
  const cases = [
    { map: 'field1', to: 'town1',  flag: 'joined_ikuma',  joinId: 'ikuma'  },
    { map: 'field2', to: 'field3', flag: 'joined_aoshi',  joinId: 'aoshi'  },
    { map: 'field3', to: 'town2',  flag: 'joined_tomoki', joinId: 'tomoki' },
    { map: 'field4', to: 'field5', flag: 'joined_itsuki', joinId: 'itsuki' },
  ];
  cases.forEach((c) => {
    const e = (MAPS[c.map].exits || []).find((x) => x.to === c.to);
    assert.ok(e, c.map + '→' + c.to + ' 出口が存在');
    assert.strictEqual(e.requireFlag, c.flag, c.map + ' の requireFlag');
    assert.ok(e.lockedMsg && e.lockedMsg.length > 0, c.map + ' に lockedMsg');
    // requireFlag は同マップ仲間NPCの 'joined_'+joinId と一致
    const npc = (MAPS[c.map].npcs || []).find((n) => n.joinId === c.joinId);
    assert.ok(npc, c.map + ' に joinId=' + c.joinId + ' のNPC');
    assert.strictEqual(e.requireFlag, 'joined_' + npc.joinId, 'requireFlag と joined_+joinId が一致');
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL（requireFlag undefined）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: 追加テストが FAIL。

- [ ] **Step 3: maps.js の各出口に requireFlag/lockedMsg を追加**

各マップの南出口オブジェクト（実装前に対象行を再 Read して正確な `{ x: 7, y: 16, to: ... }` を確認）に `requireFlag` と `lockedMsg` を追記する。

field1 の `{ x: 7, y: 16, to: 'town1', tx: 7, ty: 2 }` →
```javascript
      { x: 7, y: 16, to: 'town1', tx: 7, ty: 2,
        requireFlag: 'joined_ikuma',
        lockedMsg: 'まちへ いくまえに…\nくさはらの どこかで\nはやての FW イクマが\nまっているみたいだ。\nさがして はなしかけよう！' },
```
field2 の `{ x: 7, y: 16, to: 'field3', tx: 7, ty: 2 }` →
```javascript
      { x: 7, y: 16, to: 'field3', tx: 7, ty: 2,
        requireFlag: 'joined_aoshi',
        lockedMsg: 'スタジアムの どこかに\nてんさい MF アオシが いる。\nなかまに さそってから\nさきへ すすもう！' },
```
field3 の `{ x: 7, y: 16, to: 'town2', tx: 7, ty: 2 }` →
```javascript
      { x: 7, y: 16, to: 'town2', tx: 7, ty: 2,
        requireFlag: 'joined_tomoki',
        lockedMsg: 'すなはまの どこかで\nまもりの DF トモキが\nきみを まっている。\nはなしかけて なかまに しよう！' },
```
field4 の `{ x: 7, y: 16, to: 'field5', tx: 7, ty: 2 }` →
```javascript
      { x: 7, y: 16, to: 'field5', tx: 7, ty: 2,
        requireFlag: 'joined_itsuki',
        lockedMsg: 'あめの ピッチの どこかに\nでんせつの GK イツキが いる。\n5にんめの なかまを\nむかえに いこう！' },
```

- [ ] **Step 4: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/data/maps.js tests/progression-gates.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(maps): field1〜4 の出口に仲間加入ロックを追加"
```

## Task A3: createNewGamePlus で party 在籍の仲間4種の joined_* を復元

**Files:**
- Modify: `src/core/game-state.js:79-91`（return オブジェクトの `flags: {}` を修正）
- Test: `tests/newgame-plus.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/newgame-plus.test.js` に以下のテストを追加する（既存の `clearedState()` ヘルパを利用。無ければファイル冒頭のヘルパ構造に合わせて party に ikuma を含む state を用意する）。

```javascript
test('つよくてニューゲーム: party 在籍の仲間4種は joined_* が復元される', () => {
  const gs = require('../src/core/game-state.js');
  const prev = {
    party: [
      { id: 'yuito', maxHp: 30, maxMp: 10 },
      { id: 'ikuma', maxHp: 30, maxMp: 8 },
      { id: 'aoshi', maxHp: 26, maxMp: 16 },
    ],
    flags: { boss_neo_kaiser: true },
  };
  const ng = gs.createNewGamePlus(prev);
  assert.strictEqual(ng.flags.joined_ikuma, true, 'ikuma 復元');
  assert.strictEqual(ng.flags.joined_aoshi, true, 'aoshi 復元');
  assert.ok(!ng.flags.joined_tomoki, 'party に居ない tomoki は立てない');
  assert.ok(!ng.flags.joined_yuito, 'yuito は対象外');
  assert.ok(!ng.flags.boss_neo_kaiser, 'ボス進行はリセット');
});

test('つよくてニューゲーム: なかまモンスター(roster) は joined_ を汚染しない', () => {
  const gs = require('../src/core/game-state.js');
  const prev = { party: [{ id: 'yuito' }], roster: [{ id: 'slime_pal' }], flags: {} };
  const ng = gs.createNewGamePlus(prev);
  assert.ok(!ng.flags.joined_slime_pal, 'モンスターは対象外');
});
```

- [ ] **Step 2: テスト実行 → FAIL（flags が空）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/newgame-plus.test.js`
Expected: joined_ikuma 復元が FAIL。

- [ ] **Step 3: createNewGamePlus に復元ロジックを追加**

`src/core/game-state.js` の `return {` の直前（`var roster = ...` の後・89 行の `return {` の前）に以下を挿入する。

```javascript
  // つよくてニューゲームは flags を全リセットするが、party に在籍する仲間4種だけは
  // joined_* を復元する。復元しないと 2周目に出口ロックで詰む（会話済みでも再加入不可のため）。
  // yuito・なかまモンスターは対象外（フラグ汚染防止）。
  var _JOINABLE = { ikuma: true, aoshi: true, tomoki: true, itsuki: true };
  var carriedFlags = {};
  party.forEach(function (p) {
    if (p && _JOINABLE[p.id]) carriedFlags['joined_' + p.id] = true;
  });
```

そして return の `flags: {},`（84 行）を以下に変更する。

```javascript
    flags:        carriedFlags,                              // 進行はリセット。ただし在籍仲間の joined_* は復元
```

- [ ] **Step 4: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/newgame-plus.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/core/game-state.js tests/newgame-plus.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "fix(newgame+): 在籍仲間の joined_* を復元し2周目の出口ロック詰みを防止"
```

## Task A4: join handler の自己修復（加入済み分岐で joined_* / vanishFlag を回復）

**Files:**
- Modify: `src/scenes/field-scene.js:1862-1867`（already 分岐）

- [ ] **Step 1: already 分岐に自己修復を追加**

`src/scenes/field-scene.js` の join handler（実装前に 1861 行付近を再 Read）の `already` 分岐を以下に置換する。

```javascript
      if (already) {
        // 自己修復（A-3の保険）：万一 joined_ フラグ欠けのセーブでも、話しかければ回復する。
        if (!state.flags) state.flags = {};
        state.flags['joined_' + npc.joinId] = true;
        if (npc.vanishFlag) state.flags[npc.vanishFlag] = true;
        if (S.saveGame) S.saveGame(state);
        S.pushScene(S.createDialog(npc.afterPages || ['いっしょに がんばろう！']));
        return;
      }
```

- [ ] **Step 2: 既存テスト全体が壊れていないことを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test`
Expected: 全 PASS（変更は分岐内のみ・純データ副作用）。

- [ ] **Step 3: ビルド確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node build.js`
Expected: エラーなく index.html 再生成。

- [ ] **Step 4: コミット**

```bash
git add src/scenes/field-scene.js index.html
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "fix(field): 仲間加入済み分岐で joined_/vanishFlag を自己修復"
```

---

# グループB：加入イベント全部盛り

## Task B1: 加入ファンファーレSE `join` を追加

**Files:**
- Modify: `src/engine/audio.js:15-32`（`SRPG_SE` に追記）
- Test: `tests/audio.test.js:18`

- [ ] **Step 1: audio.test.js の need 配列に 'join' を追加（失敗させる）**

`tests/audio.test.js` の `const need = [...]` に `'join'` を追加する。

```javascript
  const need = ['move','confirm','cancel','attack','special','damage','heal','levelup','treasure','victory','defeat','join'];
```

- [ ] **Step 2: テスト実行 → FAIL（join 未定義）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/audio.test.js`
Expected: FAIL。

- [ ] **Step 3: SRPG_SE に join を追加**

`src/engine/audio.js` の `SRPG_SE` 内、`defeat:` の行の直後（31 行の末尾）に以下を追加する（ド→ミ→ソ→ド↑の4音・levelup より長め＆音量大＝加入の高揚感）。

```javascript
  // 仲間加入ファンファーレ（物語編B）：ド→ミ→ソ→ド↑ の上昇アルペジオ（levelupより豪華）
  join:    [{ f: 523, d: 0.10, t: 'square', g: 0.22 }, { f: 659, d: 0.10, t: 'square', g: 0.22 }, { f: 784, d: 0.10, t: 'square', g: 0.22 }, { f: 1046, d: 0.30, t: 'square', g: 0.24 }],
```

- [ ] **Step 4: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/audio.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/engine/audio.js tests/audio.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(audio): 仲間加入ファンファーレSE join を追加"
```

## Task B2: 仲間NPC 4人に joinStory（加入ミニストーリー3ページ）を追加

**Files:**
- Modify: `src/data/maps.js`（ikuma NPC 98-107 / aoshi 166-175 / tomoki 244-253 / itsuki 316-325）
- Test: `tests/progression-gates.test.js`（joinStory 検査を追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/progression-gates.test.js` の末尾に追加する。

```javascript
test('加入演出: 仲間4人に joinStory が3ページ以上ある', () => {
  const want = [
    { map: 'field1', joinId: 'ikuma'  },
    { map: 'field2', joinId: 'aoshi'  },
    { map: 'field3', joinId: 'tomoki' },
    { map: 'field4', joinId: 'itsuki' },
  ];
  want.forEach((w) => {
    const npc = (MAPS[w.map].npcs || []).find((n) => n.joinId === w.joinId);
    assert.ok(npc, w.map + ' に ' + w.joinId);
    assert.ok(Array.isArray(npc.joinStory), w.joinId + ' に joinStory 配列');
    assert.ok(npc.joinStory.length >= 3, w.joinId + ' の joinStory は3ページ以上');
    npc.joinStory.forEach((p) => assert.ok(typeof p === 'string' && p.length > 0));
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: FAIL。

- [ ] **Step 3: 各仲間NPC に joinStory を追加**

各仲間NPC オブジェクト（実装前に対象行を再 Read）の `joinId` の隣に `joinStory` プロパティを追加する。子供向けひらがな・1文<br>相当の短文。

ikuma（field1）:
```javascript
      joinStory: [
        'イクマ「おれは この まちいちばんの\nストライカーだった。」',
        'イクマ「でも カイザーに ボールを\nうばわれて、なにも できなかった。\nくやしくて くやしくて…。」',
        'イクマ「でも ユイト、きみと なら\nもういちど はしれる きが する！\nおれを つれてってくれ！」',
      ],
```
aoshi（field2）:
```javascript
      joinStory: [
        'アオシ「ぼくは しあいの ながれを\nよむのが とくいな しれいとうさ。」',
        'アオシ「でも ひとりの ちからでは\nカイザーには かてない。\nそう しった よるが あった。」',
        'アオシ「きみの チームで\nパスを つなぎたい。\nいっしょに いかせてくれ。」',
      ],
```
tomoki（field3）:
```javascript
      joinStory: [
        'トモキ「ぼくは この まちを\nまもれなかった…。\nずっと じぶんを せめてきた。」',
        'トモキ「もう にどと\nなかまを なかせたくない。」',
        'トモキ「だから ぼくが かべに なる！\nユイト、うしろは しんぱいするな！」',
      ],
```
itsuki（field4）:
```javascript
      joinStory: [
        'イツキ「ぼくは でんせつの キーパーに\nあこがれて れんしゅうしてきた。」',
        'イツキ「ゴールを まもるのは、\nみんなの ゆめを まもること。\nそう おしえてもらったんだ。」',
        'イツキ「うしろは まかせろ！\nきみたちの ゴールは\nぜったいに わらせない。」',
      ],
```

- [ ] **Step 4: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/data/maps.js tests/progression-gates.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(maps): 仲間4人に加入ミニストーリー joinStory を追加"
```

## Task B3: createJoinCutinScene（加入カットイン画面）を新規追加＋export

**Files:**
- Modify: `src/scenes/field-scene.js`（`createLiftingScene` の直前 2960 行付近にトップレベル関数を追加）
- Modify: `src/scenes/field-scene.js:3252-3282`（UMD export に追加）
- Test: `tests/join-cutin.test.js`（新規）

- [ ] **Step 1: 衝突ゼロを再確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; grep -rn "createJoinCutinScene" src/ tests/`
Expected: 0件（定義前）。

- [ ] **Step 2: 失敗するテストを書く**

`tests/join-cutin.test.js` を新規作成する。DOM/canvas 無しの Node で update/isDone のロジックのみ検証する（draw は実機で確認）。

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');

// window を用意して field-scene.js を UMD ロード（他テストと同じ流儀）
global.window = global.window || {};
require('../src/data/characters.js');
require('../src/engine/audio.js');
const S = require('../src/scenes/field-scene.js');
Object.assign(global.window.SRPG || (global.window.SRPG = {}), S);
global.window.SRPG.VW = 288;
global.window.SRPG.VH = 512;
global.window.SRPG.playSe = function () {};

test('createJoinCutinScene: confirm で onClose が呼ばれ isDone になる', () => {
  let closed = false;
  const sc = S.createJoinCutinScene({}, 'ikuma', function () { closed = true; });
  assert.strictEqual(typeof sc.update, 'function');
  assert.strictEqual(sc.isDone(), false);
  // 0.5秒 経過前は閉じない
  sc.update(0.2, { pressed: { confirm: true } });
  assert.strictEqual(sc.isDone(), false, '演出中は閉じない');
  // 0.5秒 以降は confirm で閉じる
  sc.update(0.5, { pressed: {} });
  sc.update(0.1, { pressed: { confirm: true } });
  assert.strictEqual(closed, true, 'onClose が呼ばれる');
  assert.strictEqual(sc.isDone(), true);
});
```

- [ ] **Step 3: テスト実行 → FAIL（createJoinCutinScene 未定義）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/join-cutin.test.js`
Expected: FAIL。

- [ ] **Step 4: createJoinCutinScene を実装**

`src/scenes/field-scene.js` の `function createLiftingScene(state, opts) {`（2961 行）の直前に、以下のトップレベル関数を挿入する。

```javascript
/**
 * createJoinCutinScene — 仲間加入カットイン（物語編B）
 *   暗転 → 金の放射光＋パーティクル → ALLY_ART 立ち絵がスケールイン →
 *   「⚡○○が なかまに なった！」＋ポジション・タイプ色・ひとこと。
 *   開始時に 加入ファンファーレSE 'join' を鳴らす。confirm/タップ で onClose。
 *   立ち絵の描画は なかま ずかん（title-scene）と同じ ALLY_ART→drawImageSprite→SPRITES の順。
 * @param {object} state ゲーム状態（読み取りのみ）
 * @param {string} allyId 加入した仲間の id（characters.js のキー）
 * @param {function} onClose 閉じたときに呼ぶ（フィールド復帰など）
 * @returns {object} シーン（update/draw/isDone/_debug）
 */
function createJoinCutinScene(state, allyId, onClose) {
  var S = (typeof window !== 'undefined' ? window : globalThis).SRPG;
  var VW = S.VW, VH = S.VH;
  var ch = (S.CHARACTERS && S.CHARACTERS[allyId]) || null;
  var pf = (ch && ch.profile) || {};
  var typeColors = { power: '#ff8a5c', speed: '#5cd0ff', technique: '#b98aff' };
  var typeNames  = { power: 'パワー',  speed: 'スピード', technique: 'テクニック' };
  var accent = (ch && typeColors[ch.type]) || '#ffd76e';

  var _t = 0;         // 経過時間（スケールイン・放射光の回転に使う）
  var _done = false;
  var _seDone = false;

  function _finish() {
    if (_done) return;
    _done = true;
    if (typeof onClose === 'function') onClose();
  }

  return {
    update: function (dt, input) {
      _t += dt;
      if (!_seDone) { _seDone = true; if (S.playSe) S.playSe('join'); }
      var pressed = (input && input.pressed) || {};
      // 立ち絵が出そろってから（0.5s〜）閉じられる
      if (_t >= 0.5 && (pressed.confirm || pressed.cancel)) _finish();
    },

    draw: function (ctx) {
      // 1. 暗転
      ctx.fillStyle = 'rgba(3,5,12,0.92)';
      ctx.fillRect(0, 0, VW, VH);

      var cx = VW / 2, cy = 150;

      // 2. 金の放射光（中心から回転）
      var rays = 14, rot = _t * 0.6;
      for (var i = 0; i < rays; i++) {
        var a = rot + (i / rays) * Math.PI * 2;
        ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,216,110,0.16)' : 'rgba(255,216,110,0.06)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 360, cy + Math.sin(a) * 360);
        ctx.lineTo(cx + Math.cos(a + 0.24) * 360, cy + Math.sin(a + 0.24) * 360);
        ctx.closePath();
        ctx.fill();
      }

      // 3. パーティクル（きらきら）
      for (var p = 0; p < 18; p++) {
        var pa = (p / 18) * Math.PI * 2 + _t * 1.4;
        var pr = 60 + ((p * 37) % 90) + Math.sin(_t * 3 + p) * 10;
        var ppx = cx + Math.cos(pa) * pr;
        var ppy = cy + Math.sin(pa) * pr * 0.8;
        ctx.fillStyle = 'rgba(255,240,180,0.9)';
        ctx.fillRect(ppx - 1.5, ppy - 1.5, 3, 3);
      }

      // 4. 立ち絵（スケールイン：高さ 40→130 を 0.35s で）
      var grow = Math.min(1, _t / 0.35);
      var ph = 40 + 90 * grow;
      if (S.drawShadow) S.drawShadow(ctx, cx, cy + ph / 2 - 2, 30 * grow, 7 * grow);
      var art = S.ALLY_ART && S.ALLY_ART[allyId];
      var drew = false;
      if (art && typeof S.drawImageSprite === 'function') {
        drew = S.drawImageSprite(ctx, 'joincut_' + allyId, art, cx, cy, ph, false);
      }
      if (!drew && S.SPRITES && S.SPRITES[allyId] && S.drawSprite) {
        var sp = S.SPRITES[allyId], sc = Math.max(1, Math.round(4 * grow));
        var sw = sp.map[0].length * sc, sh = sp.map.length * sc;
        S.drawSprite(ctx, sp, Math.floor(cx - sw / 2), Math.floor(cy - sh / 2), sc);
      }

      // 5. 「⚡○○が なかまに なった！」
      S.drawText(ctx, '⚡ ' + ((ch && ch.name) || 'なかま') + ' が なかまに なった！', VW / 2, 236, {
        size: 16, color: accent, align: 'center', weight: 'bold', shadow: true,
      });

      // 6. ポジション・タイプ・ひとこと
      S.drawText(ctx, ((ch && ch.position) || '') + '   タイプ：' + ((ch && typeNames[ch.type]) || '－'), VW / 2, 262, {
        size: 11, color: '#dff4ff', align: 'center',
      });
      S.drawText(ctx, '『 ' + (pf.flavor || '') + ' 』', VW / 2, 284, {
        size: 12, color: '#ffe89a', align: 'center',
      });

      // 7. 閉じる案内（演出が出そろってから）
      if (_t >= 0.5) {
        S.drawText(ctx, 'けってい/タップ で つづける', VW / 2, VH - 40, {
          size: 11, color: '#9fb6da', align: 'center',
        });
      }
    },

    isDone: function () { return _done; },
    _debug: function () { return { t: _t, done: _done, allyId: allyId }; },
  };
}

```

`src/scenes/field-scene.js` の UMD export（3252 行〜）に `createShootScene: createShootScene,` の隣へ追加する。

```javascript
  createJoinCutinScene: createJoinCutinScene,
```

- [ ] **Step 5: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/join-cutin.test.js`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/scenes/field-scene.js tests/join-cutin.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(field): 仲間加入カットイン createJoinCutinScene を追加"
```

## Task B4: join handler に「会話→joinStory→加入→カットイン→復帰」を組み込む

**Files:**
- Modify: `src/scenes/field-scene.js:1868-1881`（会話分岐）

- [ ] **Step 1: 会話分岐をカットインフローに置換**

`src/scenes/field-scene.js` の join handler（実装前に再 Read）の会話分岐（1868-1881・`// 会話 → 加入処理 …` から `return;` まで）を以下で置換する。

```javascript
      // 会話 → 加入ミニストーリー → 加入処理 → カットイン → フィールド再構築（NPC を消す）
      var convo = (npc.pages || []).concat(npc.joinStory || []);
      S.pushScene(S.createDialog(convo, { onComplete: function () {
        if (typeof S.joinAlly === 'function') S.joinAlly(state, npc.joinId);
        if (!state.flags) state.flags = {};
        if (npc.vanishFlag) state.flags[npc.vanishFlag] = true;
        if (S.saveGame) S.saveGame(state);
        var back = function () { if (S.replaceScene) S.replaceScene(S.createFieldScene(state)); };
        if (typeof S.createJoinCutinScene === 'function') {
          S.pushScene(S.createJoinCutinScene(state, npc.joinId, back));
        } else {
          S.pushScene(S.createDialog([(npc.joinId || 'なかま') + ' が なかまに なった！'], { onComplete: back }));
        }
      } }));
      return;
```

- [ ] **Step 2: 全テスト＋ビルド確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test && node build.js`
Expected: 全 PASS＋ビルド成功。

- [ ] **Step 3: コミット**

```bash
git add src/scenes/field-scene.js index.html
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(field): 仲間加入フローに joinStory とカットインを組み込み"
```

---

# グループC-1／C-4：ボス勝利イベント＋章転換カットシーン

## Task C1: pendingCutscene を cutscenes 配列＋requireFlag に対応（後方互換維持）

**Files:**
- Modify: `src/scenes/field-scene.js:217-223`
- Test: `tests/story4.test.js`（新テスト追加・既存3本は維持）

- [ ] **Step 1: 複数対応の失敗テストを書く**

`tests/story4.test.js` に追加する（既存の pendingCutscene 3本＝後方互換は変更しない）。

```javascript
test('pendingCutscene: cutscenes 配列は requireFlag 未達をスキップし、条件を満たす最初を返す', () => {
  const map = { cutscenes: [
    { flag: 'a', requireFlag: 'need_a', pages: ['A'] },
    { flag: 'b', requireFlag: 'need_b', pages: ['B'] },
  ] };
  assert.strictEqual(S.pendingCutscene(map, {}), null, '両方 requireFlag 未達→null');
  assert.strictEqual(S.pendingCutscene(map, { need_a: true }).flag, 'a', 'a のみ条件成立');
  // a 視聴済みなら b（requireFlag も満たす場合）
  assert.strictEqual(S.pendingCutscene(map, { need_a: true, need_b: true, a: true }).flag, 'b');
  // すべて視聴済みなら null
  assert.strictEqual(S.pendingCutscene(map, { need_a: true, need_b: true, a: true, b: true }), null);
});
```

- [ ] **Step 2: テスト実行 → FAIL（現 pendingCutscene は cutscene 単数のみ）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/story4.test.js`
Expected: 新テストが FAIL。

- [ ] **Step 3: pendingCutscene を拡張**

`src/scenes/field-scene.js:217-223` を以下で置換する。

```javascript
function pendingCutscene(map, flags) {
  flags = flags || {};
  // 単一 cutscene は長さ1の配列に正規化（後方互換）。cutscenes 優先。
  var list = (map && map.cutscenes) || (map && map.cutscene ? [map.cutscene] : []);
  for (var i = 0; i < list.length; i++) {
    var cs = list[i];
    if (!cs || !cs.pages || !cs.pages.length) continue;
    if (cs.requireFlag && !flags[cs.requireFlag]) continue; // 前提フラグ未達はスキップ
    if (cs.flag && flags[cs.flag]) continue;                // 視聴済みはスキップ
    return cs;
  }
  return null;
}
```

- [ ] **Step 4: テスト実行 → PASS（新テスト＋既存3本）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/story4.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/scenes/field-scene.js tests/story4.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(field): pendingCutscene を cutscenes 配列＋requireFlag に対応"
```

## Task C2: ボス勝利イベント5本を対象マップに追加

**Files:**
- Modify: `src/data/maps.js`（cave1:785 / field5:371 / ch2_pass:2051 / tower_ice_3f:936 / shrine_forest_3f:1086）
- Test: `tests/progression-gates.test.js`（勝利イベント存在検査）

いずれの5マップも既存の入場 cutscene を持たない（grep 確認済み）ため、`cutscenes: [ winEvent ]` を新規プロパティとして追加する。追加位置は各マップの `grid:` の直前（`name:`／`ambient:`／`dark:` 等の直後）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/progression-gates.test.js` の末尾に追加する。

```javascript
test('勝利イベント: 5マップに requireFlag=撃破フラグ の cutscenes がある', () => {
  const want = [
    { map: 'cave1',            flag: 'cs_win_magma',        req: 'boss_magma' },
    { map: 'field5',           flag: 'cs_win_guardian',     req: 'boss_guardian' },
    { map: 'ch2_pass',         flag: 'cs_win_dark_general', req: 'boss_dark_general' },
    { map: 'tower_ice_3f',     flag: 'cs_win_ice',          req: 'boss_ice' },
    { map: 'shrine_forest_3f', flag: 'cs_win_forest',       req: 'boss_forest' },
  ];
  want.forEach((w) => {
    const list = MAPS[w.map].cutscenes || (MAPS[w.map].cutscene ? [MAPS[w.map].cutscene] : []);
    const cs = list.find((c) => c.flag === w.flag);
    assert.ok(cs, w.map + ' に ' + w.flag);
    assert.strictEqual(cs.requireFlag, w.req, w.map + ' の requireFlag');
    assert.ok(cs.pages && cs.pages.length >= 2, w.map + ' の pages が2枚以上');
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: FAIL。

- [ ] **Step 3: 各マップに cutscenes を追加**

cave1（`dark: true,` の直後）:
```javascript
    cutscenes: [
      { flag: 'cs_win_magma', requireFlag: 'boss_magma', pages: [
        'マグマ・ゴーレムは くずれおちた。\nどうくつに しずけさが もどる。',
        'イクマ「やったな ユイト！\nおれたちの スピードは\nマグマにも まけなかったぜ！」',
        'ユイト「つぎは スカイスタジアムだ。\nいこう、みんな！」',
      ] },
    ],
```
field5（`ambient: 'sky',` の直後）:
```javascript
    cutscenes: [
      { flag: 'cs_win_guardian', requireFlag: 'boss_guardian', pages: [
        'ガーディアンは ひかりに つつまれ\nしずかに きえていった。',
        'トモキ「まもりを かためれば\nどんな てきも こわくない。」',
        'イツキ「うしろは まかせろ。\nつぎは いよいよ ダークアリーナだ！」',
      ] },
    ],
```
ch2_pass（`ambient: 'snow',` の直後）:
```javascript
    cutscenes: [
      { flag: 'cs_win_dark_general', requireFlag: 'boss_dark_general', pages: [
        'やみの しょうぐん ヴォルクは\nふぶきの なかへ きえた。',
        'アオシ「5人 そろえば、\nこんな つよい てきにも かてる。」',
        'ユイト「きずなの ちからだ。\nこの とうげを こえて さきへ すすもう！」',
      ] },
    ],
```
tower_ice_3f（`ambient: 'snow',` の直後）:
```javascript
    cutscenes: [
      { flag: 'cs_win_ice', requireFlag: 'boss_ice', pages: [
        'アイス・ゴーレムは くだけちり、\nこおりの とうに ひかりが さした。',
        'アオシ「おちついて よめば、\nかたい こおりにも すきが ある。」',
        'ユイト「つぎは もりの しんでんだ。\nもうすこしで やみに とどく！」',
      ] },
    ],
```
shrine_forest_3f（`ambient: 'forest',` の直後）:
```javascript
    cutscenes: [
      { flag: 'cs_win_forest', requireFlag: 'boss_forest', pages: [
        '森の守り神 ガイアは\nみんなに ちからを たくして きえた。',
        'ユイト「ここまで これたのは\nみんなが いたからだ。」',
        'イクマ「けっせんだ ユイト。\nやみのしろへ、いこう！」',
      ] },
    ],
```

- [ ] **Step 4: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/data/maps.js tests/progression-gates.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(maps): ボス勝利イベント5本を対象マップに追加"
```

## Task C3: 章転換カットシーン増強（field6 cs_after_ch1／ch2_gate 章タイトルコール）

**Files:**
- Modify: `src/data/maps.js`（field6 cutscene 449-459 → cutscenes 配列化／ch2_gate cutscene 1878-1887 にページ追加）
- Test: `tests/progression-gates.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/progression-gates.test.js` の末尾に追加する。

```javascript
test('章転換: field6 に cs_after_ch1(requireFlag=boss_kaiser)、ch2_gate に章タイトルコール', () => {
  const f6 = MAPS.field6.cutscenes || (MAPS.field6.cutscene ? [MAPS.field6.cutscene] : []);
  const intro = f6.find((c) => c.flag === 'cs_field6');
  assert.ok(intro, 'field6 の入場 cs_field6 は維持');
  const after = f6.find((c) => c.flag === 'cs_after_ch1');
  assert.ok(after, 'field6 に cs_after_ch1');
  assert.strictEqual(after.requireFlag, 'boss_kaiser');
  assert.ok(after.pages.length >= 2);

  const gate = MAPS.ch2_gate.cutscene;
  assert.ok(gate && gate.pages.some((p) => p.includes('だい2しょう')), 'ch2_gate に章タイトルコール');
});
```

- [ ] **Step 2: テスト実行 → FAIL**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: FAIL。

- [ ] **Step 3: field6 を cutscenes 配列化し cs_after_ch1 を追加**

`src/data/maps.js` の field6（449-459）の `cutscene: { ... },` を、既存 cs_field6 を保持したまま `cutscenes:` 配列に変換し cs_after_ch1 を追加する。

```javascript
    cutscenes: [
      { flag: 'cs_field6', pages: [
        'くらい アリーナ。\nくうきが ずしりと おもい。\nここに カイザーが いる――。',
        'ながい たびだった。\nたくさんの てきと たたかい、\nここまで きた。',
        'ユイト「みんな、\nここまで ついてきて くれて\nありがとう。」',
        'イクマ「なに いってんだ、\nさいごまで いっしょだろ！」',
        'アオシ「おちつけ、ユイト。\nぼくらの サッカーを\nしんじれば いい。」',
        'ユイトは まえを みすえた。\nユイト「いくぞ――けっせんだ！」',
      ] },
      { flag: 'cs_after_ch1', requireFlag: 'boss_kaiser', pages: [
        'トロフィーを かかげた 5にん。\nかんせいが スタジアムに ひびく。',
        'だが とおくの そらに、\nくろい かげが うずまいていた。',
        'アオシ「あれは…\nまだ おわって いないのか？」',
        'ユイト「いこう。\nだい2しょうの はじまりだ！」',
      ] },
    ],
```

- [ ] **Step 4: ch2_gate の cutscene に章タイトルコールを追加**

`src/data/maps.js` の ch2_gate（1878-1887）の cs_ch2_gate の pages を以下に置換する（末尾に章タイトルコール2枚を追加）。

```javascript
    cutscene: {
      flag: 'cs_ch2_gate',
      pages: [
        'ダーク・カイザーを たおし、\nまちには へいわが もどった――\nはずだった。',
        'だが きたの そらに、\nくろい うずが ひろがっていく。',
        'たおしたはずの やみが、\nふたたび よみがえったのだ。',
        'やみの もんの むこうから\nつめたい きはいが ながれてくる。',
        '― だい2しょう ―\n「やみの ぎゃくしゅう」',
        'ユイト「また みんなを\nおびえさせは しない。\nぼくが とめる！」',
      ],
    },
```

- [ ] **Step 5: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/progression-gates.test.js`
Expected: PASS

- [ ] **Step 6: 全テスト＋ビルド → コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test && node build.js
git add src/data/maps.js index.html tests/progression-gates.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(maps): 章転換カットシーン(field6 cs_after_ch1／ch2_gate 章タイトル)を増強"
```

---

# グループC-2／C-3：伏線＋進行で変わる会話

## Task C4: npcPagesFor（variants 選択の純関数）を追加＋export

**Files:**
- Modify: `src/scenes/field-scene.js`（`pendingCutscene` の直後・224 行付近にトップレベル関数を追加）
- Modify: `src/scenes/field-scene.js` UMD export
- Test: `tests/npc-variants.test.js`（新規）

- [ ] **Step 1: 衝突ゼロ確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; grep -rn "npcPagesFor" src/ tests/`
Expected: 0件。

- [ ] **Step 2: 失敗するテストを書く**

`tests/npc-variants.test.js` を新規作成する。

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');
global.window = global.window || {};
const S = require('../src/scenes/field-scene.js');

test('npcPagesFor: variants 無しなら pages を返す', () => {
  const npc = { pages: ['もと'] };
  assert.deepStrictEqual(S.npcPagesFor(npc, {}), ['もと']);
});
test('npcPagesFor: requireFlag 未達なら pages を返す', () => {
  const npc = { pages: ['もと'], variants: [{ requireFlag: 'x', pages: ['へんか'] }] };
  assert.deepStrictEqual(S.npcPagesFor(npc, {}), ['もと']);
});
test('npcPagesFor: 複数該当は最後（最も進んだ）variant を返す', () => {
  const npc = { pages: ['もと'], variants: [
    { requireFlag: 'a', pages: ['A'] },
    { requireFlag: 'b', pages: ['B'] },
  ] };
  assert.deepStrictEqual(S.npcPagesFor(npc, { a: true }), ['A']);
  assert.deepStrictEqual(S.npcPagesFor(npc, { a: true, b: true }), ['B']);
});
```

- [ ] **Step 3: テスト実行 → FAIL（未定義）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/npc-variants.test.js`
Expected: FAIL。

- [ ] **Step 4: npcPagesFor を実装＋export**

`src/scenes/field-scene.js` の `pendingCutscene` 関数（223 行の閉じ括弧）の直後に追加する。

```javascript

/**
 * npcPagesFor: NPC の会話ページを進行フラグで選ぶ純関数（物語編C-3）。
 *   variants の中から requireFlag を満たす「最後の（最も進んだ）」ものの pages を返す。
 *   該当なし・variants 無しなら従来の npc.pages。
 * @param {Object} npc   NPC 定義（pages / variants を持ちうる）
 * @param {Object} flags state.flags
 * @returns {Array} 表示するページ配列
 */
function npcPagesFor(npc, flags) {
  flags = flags || {};
  var pages = (npc && npc.pages) || [];
  var vs = (npc && npc.variants) || [];
  var chosen = null;
  for (var i = 0; i < vs.length; i++) {
    var v = vs[i];
    if (v && v.requireFlag && flags[v.requireFlag]) chosen = v; // 最後に一致したものを採用
  }
  return (chosen && chosen.pages) ? chosen.pages : pages;
}
```

UMD export（3252 行〜）の `pendingCutscene: pendingCutscene,` の隣に追加する。

```javascript
  npcPagesFor:      npcPagesFor,
```

- [ ] **Step 5: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/npc-variants.test.js`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/scenes/field-scene.js tests/npc-variants.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(field): 進行で会話が変わる npcPagesFor を追加"
```

## Task C5: 通常会話分岐で npcPagesFor を使う

**Files:**
- Modify: `src/scenes/field-scene.js:2109-2110`（`// ⑧ 通常会話`）

- [ ] **Step 1: 通常会話分岐を差し替え**

`src/scenes/field-scene.js` の `// ⑧ 通常会話` の次行（`S.pushScene(S.createDialog(npc.pages));`）を以下に置換する。

```javascript
    // ⑧ 通常会話（進行で変わる variants に対応）
    S.pushScene(S.createDialog(npcPagesFor(npc, (state && state.flags) || {})));
```

- [ ] **Step 2: 全テスト＋ビルド確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test && node build.js`
Expected: 全 PASS＋ビルド成功。

- [ ] **Step 3: コミット**

```bash
git add src/scenes/field-scene.js index.html
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(field): 通常会話を npcPagesFor 経由にして進行変化を反映"
```

## Task C6: 伏線セリフ＋進行で変わる variants を各NPCに追加

**Files:**
- Modify: `src/data/maps.js`（伏線: field1(4,9)コーチ／town1(4,12)住民／field2(9,11)コーチ／town2(4,12)住民。進行変化: town1・town2・town3・village1 の住民）
- Test: `tests/npc-variants.test.js`（データ検査を追記）

各NPCは既存の `pages` を残したまま `variants: [...]` を追加する（実装前に各NPCの座標・オブジェクト境界を再 Read。特に field1(4,9) は `tests/field.test.js` が座標・walkable を固定しているので、座標と `.` タイルは変えず pages/variants 内容のみ変更する）。

- [ ] **Step 1: データ検査テストを書く**

`tests/npc-variants.test.js` に追加する。

```javascript
const MAPS = require('../src/data/maps.js').MAPS;

test('伏線: field1 コーチ(4,9) がイクマ加入前にヒント／加入後に変化', () => {
  const npc = (MAPS.field1.npcs || []).find((n) => n.x === 4 && n.y === 9);
  assert.ok(npc, 'field1(4,9) NPC 存在');
  assert.ok(JSON.stringify(npc.pages).includes('FW') || JSON.stringify(npc.pages).includes('はやて'),
    'イクマ伏線がある');
  assert.ok(Array.isArray(npc.variants) && npc.variants.some((v) => v.requireFlag === 'joined_ikuma'),
    '加入後 variant がある');
});

test('進行変化: town1 住民に boss_magma 後の variant がある', () => {
  const has = (MAPS.town1.npcs || []).some((n) =>
    Array.isArray(n.variants) && n.variants.some((v) => v.requireFlag === 'boss_magma'));
  assert.ok(has, 'town1 に boss_magma variant');
});
```

- [ ] **Step 2: テスト実行 → FAIL**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/npc-variants.test.js`
Expected: FAIL。

- [ ] **Step 3: 伏線NPC を編集（既存 pages を活かしつつヒント＋variants を付与）**

field1 コーチ(4,9)（既存 pages 4枚を保持し、末尾にイクマ伏線を1枚足す。加入後 variant を追加）:
```javascript
      // pages の末尾に追加する1枚（既存4枚はそのまま）:
      //   'この くさはらの どこかに\nはやての FW イクマが いるらしい。\nさがして なかまに しよう！'
      variants: [
        { requireFlag: 'joined_ikuma', pages: [
          'イクマを なかまに したんだね！\nあの スピードは こころづよいよ。',
        ] },
      ],
```
town1 住民(4,12)（既存 pages 3枚を保持し、アオシ伏線＋進行 variant を追加）:
```javascript
      variants: [
        { requireFlag: 'boss_magma', pages: [
          'マグマ・ゴーレムを たおしたって!?\nきみたちは まちの えいゆうだ！',
          'ナイタースタジアムに\nてんさい MF アオシが いるって\nうわさだよ。さがしてみな！',
        ] },
      ],
```
field2 コーチ(9,11)（既存 pages を保持し、トモキ伏線を variants で。未加入時から言えるよう requireFlag 無しの追記でもよいが、ここでは常時ヒントとして pages 末尾に1枚追加）:
```javascript
      // pages の末尾に追加する1枚:
      //   'すなはまの サンドコートに\nまもりの たつじんが いるらしいぞ。'
      variants: [
        { requireFlag: 'joined_tomoki', pages: [
          'トモキを なかまに したのか！\nあれで まもりは ばんぜんだな。',
        ] },
      ],
```
town2 住民(4,12)（既存 pages を保持し、イツキ伏線＋進行 variant を追加）:
```javascript
      variants: [
        { requireFlag: 'boss_guardian', pages: [
          'あめの レイニーピッチに\nでんせつの GKが いるって\nうわさだよ。' ,
        ] },
      ],
```

- [ ] **Step 4: 進行変化 variants を town3／village1 の住民にも1〜2人追加**

town3 住民(4,12)（例）:
```javascript
      variants: [
        { requireFlag: 'boss_dark_general', pages: [
          'やみの しょうぐんを たおしたの!?\nこの まちも これで あんしんだ！',
        ] },
      ],
```
village1 住民（shopkeep 6,10 など1人）:
```javascript
      variants: [
        { requireFlag: 'boss_magma', pages: [
          'どうくつの ゴーレムを たおして\nくれて ありがとう！\nむらは たすかったよ。',
        ] },
      ],
```

- [ ] **Step 5: テスト実行 → PASS**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test tests/npc-variants.test.js tests/field.test.js`
Expected: PASS（field.test.js も維持）。

- [ ] **Step 6: 全テスト＋ビルド → コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test && node build.js
git add src/data/maps.js index.html tests/npc-variants.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "feat(maps): 仲間の伏線と進行で変わる住民セリフを追加"
```

---

# グループ統合

## Task Z: 統合実機検証＋回帰

**Files:** なし（検証のみ。修正が必要なら該当タスクに戻る）

- [ ] **Step 1: 全テスト**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"; node --test`
Expected: 全 PASS。

- [ ] **Step 2: 決定論ビルド確認（md5 が2回一致）**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node build.js && md5 -q index.html
node build.js && md5 -q index.html
```
Expected: 2回の md5 が一致。ファイルサイズも記録する。

- [ ] **Step 3: 実機検証（preview srpg-dev / :5599/index.html 明示）**

`preview_list` で srpg-dev の serverId を取得 → `http://localhost:5599/index.html` を明示 navigate。headless で rAF が止まる場合は `S.updateScenes(0.016,{pressed:{},held:{}}); S.drawScenes(S.getCtx())` を叩いて進める。以下5シナリオを確認する。

1. 新規ゲームで field1 の南(7,16)へ → イクマ未加入なので lockedMsg が表示される
2. イクマに話しかける → 会話→joinStory→カットイン（立ち絵＋SE join）→ 出口通過可・目標バーが「ほのおの どうくつへ！」へ
3. boss_magma 撃破後 cave1 に再入場 → cs_win_magma 勝利イベントが1度だけ流れる
4. town1 の該当住民が boss_magma 後にアオシ伏線セリフへ変化する
5. つよくてニューゲーム開始 → field1 の出口を素通りできる（joined_* 復元）

- [ ] **Step 4: スクリーンショットで証跡を残す**

`preview_screenshot` でカットイン画面・勝利イベントを撮り、げんちゃんに共有する。

- [ ] **Step 5: 最終確認をげんちゃんに報告（push はしない）**

全タスクのローカルコミットが `feat/game-implementation` に積まれた状態で完了報告する。**push は「Pushして！」の明示指示を待つ。**

---

## Self-Review（プラン作成者チェック済み）

**1. Spec 網羅:**
- A-1 出口ロック → Task A2 ✓ / A-2 spine → Task A1 ✓ / A-3 二重防御 → Task A3（NG+復元）＋A4（自己修復）✓ / A-4 既存セーブ互換 → A3 の復元で担保 ✓
- B-1〜B-4 加入全部盛り → B1(SE)/B2(joinStory)/B3(カットイン)/B4(組込) ✓
- C-1 勝利イベント → C1(機構)＋C2(5本) ✓ / C-4 章転換 → C3 ✓
- C-2 伏線＋C-3 会話変化 → C4(npcPagesFor)＋C5(分岐差替)＋C6(データ) ✓
- テスト計画§5 → 各タスクに TDD で内包 ✓ / 実機§5末尾 → Task Z ✓

**2. プレースホルダscan:** コード step はすべて完全コードを記載。C6 のデータは「既存 pages を保持し variants を追加」方針で、追加する variants 配列は完全に記載済み（既存 pages はファイル上に存在するため再 Read で確認して活かす）。

**3. 型・名称整合:** 新識別子は `createJoinCutinScene`／`npcPagesFor` の2つのみ・grep 衝突ゼロ。フラグ名は spine（story.js）と出口 requireFlag（maps.js）と勝利イベント requireFlag で一貫（joined_ikuma/aoshi/tomoki/itsuki・boss_*）。カットインは characters.js の `type`（itsuki=technique）を参照＝実データに一致。`pendingCutscene`／`npcPagesFor` の後方互換は既存テスト（story4）で担保。

## 実装順（spec §7）と実行方式

1. グループA（A1→A2→A3→A4）＝「必須化」完成の最小単位
2. グループB（B1→B2→B3→B4）
3. C-1／C-4（C1→C2→C3）
4. C-2／C-3（C4→C5→C6）
5. 統合（Task Z）

**実行方式:** 本作業は単一 index.html バンドルの鉄則統制（build.js 不可・grep 衝突・タスク単位コミット・push 封印）を一貫適用する必要があるため、**インライン実行（superpowers:executing-plans）**を推奨。Task A1 から着手し、各タスクで対象ファイルを再 Read → Edit → 検証3点セット → タスク単位コミットを回す。
