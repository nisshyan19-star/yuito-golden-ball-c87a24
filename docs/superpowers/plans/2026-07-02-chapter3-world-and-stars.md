# 第3章『世界一への道、そして星のかなたへ』実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サッカーRPGに、完全一本道の達成ゲートで進む大ボリュームの第3章（世界大会→宇宙軍団襲来→星辰の神殿）を追加し、真エンディングまで到達できるようにする。

**Architecture:** 既存の「`story.js` の `objectiveFor()` spine配列 ＋ `maps.js` 各出口の `requireFlag` 完全一致」による一本道保証をそのまま拡張する。新ボスは `enemies.js` に定義し、グラフィックは既存アートを `art:` で流用して `enemy-art.js` を膨らませない。伝説装備 `star_boots`/`star_mail`（定義済み）をボス報酬・宝箱で配布する。第2章ラスボス撃破時のエンディングを外し、地続きで第3章へ突入させ、真ラスボス撃破時のみ真エンディングを流す。

**Tech Stack:** Vanilla JS（UMD）、`node:test`、`node build.js` で単一 `index.html` に結合。Node PATH: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`

**参照spec:** `docs/superpowers/specs/2026-07-02-chapter3-world-and-stars-design.md`

---

## 前提・共通ルール（全タスク共通）

- 各タスク着手時に Node PATH を通す: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`
- テスト実行: `npm test`（`node --test`）。パターン指定: `npm test -- <file>` ではなく `node --test tests/<file>.test.js`
- **build.js は編集不可。** ソースは `src/` 配下のみ編集。
- コミットは必ず: `git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "..."`、本文末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **本番push（GitHub P/main への配信）は行わない。** げんちゃんの明示指示（「Pushして！」相当）を待つ。ブランチ上でのコミットのみ。
- **武器 atk 上限32ルールは `star_boots`/`star_mail` のみ例外。** 他の新規武器は atk≤32 を厳守（Task 8 のテストで保証）。

## 確定する命名（衝突確認は Task 0 で実施）

**進行フラグ（発生順）:**
`ch3_start`(入口イベント・spine外) → `wc_qualify` → `wc_quarter` → `wc_semi` → `boss_volg` → `nebula_f1` → `nebula_f2` → `nebula_f3` → `boss_zeros` → `trial_1` → `trial_2` → `trial_3` → `boss_asterion`

**新マップ id:** `wc_stadium`（S1）, `nebula_f1`/`nebula_f2`/`nebula_f3`（S2）, `star_shrine_1`/`star_shrine_2`/`star_shrine_3`（S3）

**新敵 id:** `rival_ace`（S1雑魚）, `volg`（S1ボス）, `mecha_soldier`/`mecha_drone`（S2雑魚）, `zeros`（S2ボス）, `star_sentinel`（S3雑魚）, `asterion`（S3ボス）

**流用する敵アート（`art:` に既存キーを指定・`enemy-art.js` は編集しない）:**
- `volg` → `art:'phantom_striker'`（人型ストライカー）
- `rival_ace` → `art:'phantom_striker'`
- `mecha_soldier` → `art:'dark_kaiser'`, `mecha_drone` → `art:'offside_ghost'`
- `zeros` → `art:'dark_kaiser_rage'`
- `star_sentinel` → `art:'gold_emperor'`
- `asterion` → `art:'gold_emperor'`
（Task 4〜6 の着手時に `grep -o "\w*:" src/data/enemy-art.js | sort -u` で該当キー存在を確認。無ければ別の既存キーへ差し替える。）

---

## File Structure

- `src/data/story.js` — `objectiveFor()` の spine に第3章ノードを追記、`getEnding()` に真ED分岐を追加。
- `src/data/enemies.js` — 新敵6体を追記。
- `src/data/maps.js` — ch2_castle のボス定義修正（ED除去＋地続き誘導）、新マップ7枚を追記、第3章の出口 `requireFlag` を配線。
- `src/data/items.js` — 変更なし（`star_boots`/`star_mail` は定義済み。確認のみ）。
- `tests/ch3.test.js` — 第3章の進行ゲート・報酬・装備上限・真EDのテスト（新規）。
- `tests/progression-gates.test.js` — 既存の「全クリアで done=true」テストを第3章まで延長（修正）。

---

## Task 0: 準備（ブランチ作成・衝突確認・ベースライン確認）

**Files:** なし（確認とブランチ作成のみ）

- [ ] **Step 1: 実装ブランチを作成**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git checkout -b feat/chapter3-world-and-stars
git branch --show-current   # feat/chapter3-world-and-stars であること
```

- [ ] **Step 2: 命名衝突を確認（何もヒットしないこと）**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
grep -rn "wc_stadium\|nebula_f1\|nebula_f2\|nebula_f3\|star_shrine_1\|star_shrine_2\|star_shrine_3" src/ ; echo "--- map ids ---"
grep -rn "rival_ace\|'volg'\|mecha_soldier\|mecha_drone\|'zeros'\|star_sentinel\|'asterion'" src/data/enemies.js ; echo "--- enemy ids ---"
grep -rn "ch3_start\|wc_qualify\|wc_quarter\|wc_semi\|boss_volg\|nebula_f1\|boss_zeros\|trial_1\|boss_asterion" src/ ; echo "--- flags ---"
```

Expected: いずれも空（既存定義なし）。ヒットしたら、その識別子だけ別名（例 `volg`→`volg_ace`）に変え、本プラン中の全出現箇所を合わせて改名する。

- [ ] **Step 3: 流用アートキーの存在確認**

```bash
grep -o "^\s*[a-z_]*:" src/data/enemy-art.js | tr -d ' :' | sort -u | grep -E "phantom_striker|dark_kaiser|dark_kaiser_rage|offside_ghost|gold_emperor"
```

Expected: `phantom_striker` `dark_kaiser` `dark_kaiser_rage` `offside_ghost` `gold_emperor` が並ぶ。欠けるキーがあれば、存在する近い体型のキーへ差し替え、本プランの `art:` 指定を更新。

- [ ] **Step 4: ベースラインのテストが緑であることを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
npm test 2>&1 | tail -5
```

Expected: 既存テスト（約630件）が全 pass。失敗があれば実装前に報告して停止。

- [ ] **Step 5: ベースラインの決定論ビルドを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js && md5 -q index.html
node build.js && md5 -q index.html   # 2回目
```

Expected: 2回の md5 が一致。値をメモ（後続で回帰確認に使う）。

---

## Task 1: spine に第3章ノードを追加（進行ゲートの骨組み）

**Files:**
- Modify: `src/data/story.js`（`objectiveFor()` 内 spine 配列、story.js:175-222）
- Test: `tests/ch3.test.js`（新規）, `tests/progression-gates.test.js`（既存修正）

- [ ] **Step 1: 失敗するテストを書く（tests/ch3.test.js 新規）**

```javascript
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const story = require('../src/data/story.js');

// 第2章まで全クリアの土台フラグ
const CH2_DONE = {
  joined_ikuma: true, joined_aoshi: true, joined_tomoki: true, joined_itsuki: true,
  boss_magma: true, boss_guardian: true, boss_kaiser: true,
  boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
};

test('ch3: ネオ撃破直後の目標は 世界大会 予選', () => {
  const o = story.objectiveFor(CH2_DONE);
  assert.strictEqual(o.done, false);
  assert.ok(o.bar.includes('予選') || o.bar.includes('世界大会'), 'bar: ' + o.bar);
});

test('ch3: 予選突破後の目標は 準々決勝', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, { wc_qualify: true }));
  assert.ok(o.bar.includes('準々'), 'bar: ' + o.bar);
});

test('ch3: ゼロス撃破後の目標は 神殿 試練1', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, {
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
  }));
  assert.ok(o.bar.includes('しんでん') || o.bar.includes('試練') || o.bar.includes('しれん'), 'bar: ' + o.bar);
});

test('ch3: アステリオンまで全達成で done=true', () => {
  const o = story.objectiveFor(Object.assign({}, CH2_DONE, {
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
    trial_1: true, trial_2: true, trial_3: true, boss_asterion: true,
  }));
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'), 'bar: ' + o.bar);
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: FAIL（ネオ撃破後は現状 done=true を返すため「予選」を含まない）。

- [ ] **Step 3: spine に第3章ノードを追記**

`src/data/story.js` の `objectiveFor()` 内、`{ flag: 'boss_neo_kaiser', ... }` の**直後**（spine 配列の閉じ `]` の前）に以下を挿入する:

```javascript
    { flag: 'wc_qualify',
      bar: 'せかいたいかい 予選！',
      npc: 'だい3しょう スタート！\nグランドスタジアムで\nせかいたいかいの 予選を\nかちぬこう！' },
    { flag: 'wc_quarter',
      bar: '準々決勝！',
      npc: 'グランドスタジアムで\n準々決勝の あいてに\nかとう！' },
    { flag: 'wc_semi',
      bar: '準決勝！',
      npc: 'グランドスタジアムで\n準決勝を かちぬこう！' },
    { flag: 'boss_volg',
      bar: '決勝 ヴォルグ！',
      npc: 'せかいたいかい 決勝！\nれっかの ヴォルグを\nやぶって せかいいちに！' },
    { flag: 'nebula_f1',
      bar: 'うちゅうせん ネビュラごうへ！',
      npc: 'そらから きた うちゅうせん\nネビュラごうに のりこみ\n第1フロアを つきすすもう！' },
    { flag: 'nebula_f2',
      bar: 'ネビュラごう 第2フロア！',
      npc: 'ネビュラごうの 第2フロアを\nつきすすもう！' },
    { flag: 'nebula_f3',
      bar: 'ネビュラごう 第3フロア！',
      npc: 'ネビュラごうの 第3フロアを\nつきぬけて ブリッジへ！' },
    { flag: 'boss_zeros',
      bar: 'メカ・エンペラー ゼロス！',
      npc: 'ブリッジで きかいぐんだんの\nそうしれいかん ゼロスを\nたおそう！' },
    { flag: 'trial_1',
      bar: 'せいしんの しんでん 試練1！',
      npc: 'ほしの かなたの\nせいしんの しんでんで\n試練1を のりこえよう！' },
    { flag: 'trial_2',
      bar: 'しんでん 試練2！',
      npc: 'せいしんの しんでんの\n試練2を のりこえよう！' },
    { flag: 'trial_3',
      bar: 'しんでん 試練3！',
      npc: 'せいしんの しんでんの\n試練3を のりこえて さいおくへ！' },
    { flag: 'boss_asterion',
      bar: 'さいしゅうけっせん アステリオン！',
      npc: 'せいしんの しんでん さいおくで\nほしくいの かみ アステリオンを\nたおして すべてを おえよう！' },
```

- [ ] **Step 4: ch3 テストが pass することを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: 4件すべて pass。

- [ ] **Step 5: 既存テストの回帰を確認・修正**

`tests/progression-gates.test.js` の「全部倒したら done=true」テストは、`boss_neo_kaiser` までしか立てておらず、第3章追加で done=false になり FAIL する。次のように第3章フラグまで延長する（該当テストの `Object.assign` に追記）:

```javascript
test('objectiveFor: 全部倒したら done=true', () => {
  const o = story.objectiveFor(Object.assign({}, J, {
    boss_magma: true, boss_guardian: true, boss_kaiser: true,
    boss_dark_general: true, boss_ice: true, boss_forest: true, boss_neo_kaiser: true,
    wc_qualify: true, wc_quarter: true, wc_semi: true, boss_volg: true,
    nebula_f1: true, nebula_f2: true, nebula_f3: true, boss_zeros: true,
    trial_1: true, trial_2: true, trial_3: true, boss_asterion: true,
  }));
  assert.strictEqual(o.done, true);
  assert.ok(o.bar.includes('クリア'));
});
```

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
npm test 2>&1 | tail -5
```

Expected: 全 pass。

- [ ] **Step 6: コミット**

```bash
git add src/data/story.js tests/ch3.test.js tests/progression-gates.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
feat(ch3): spineに第3章13ノードを追加し進行ゲートを延長

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 第2章ラスボス撃破を地続きで第3章へ（ED除去＋入口イベント）

**Files:**
- Modify: `src/data/maps.js`（`ch2_castle` の neo_kaiser ボスNPC定義）
- Test: `tests/ch3.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記（tests/ch3.test.js）**

```javascript
const MAPS = require('../src/data/maps.js').MAPS || require('../src/data/maps.js');

test('ch3: ネオ・カイザー戦は ending を発火しない（地続き突入）', () => {
  const castle = MAPS.ch2_castle;
  assert.ok(castle, 'ch2_castle が存在する');
  const bossNpc = (castle.npcs || []).find((n) => n.boss && n.boss.enemies && n.boss.enemies.includes('neo_kaiser'));
  assert.ok(bossNpc, 'neo_kaiser ボスNPCが存在する');
  assert.ok(!bossNpc.boss.ending, 'neo_kaiser撃破で ending:true を出さない');
  assert.strictEqual(bossNpc.boss.winFlag, 'boss_neo_kaiser');
});

test('ch3: ネオ撃破後 wc_stadium へ誘導する warp/exit がある', () => {
  const castle = MAPS.ch2_castle;
  const goesToStadium =
    (castle.exits || []).some((e) => e.to === 'wc_stadium') ||
    (castle.warps || []).some((w) => w.to === 'wc_stadium') ||
    (castle.npcs || []).some((n) => n.boss && n.boss.warpTo === 'wc_stadium');
  assert.ok(goesToStadium, 'wc_stadium への遷移口がある');
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: 追加2件が FAIL（現状 ending:true・wc_stadium 遷移なし）。

- [ ] **Step 3: ch2_castle の neo_kaiser ボス定義を修正**

`src/data/maps.js` の `ch2_castle` 内、`neo_kaiser` を戦う NPC の `boss` から `ending: true` を削除し、撃破後メッセージ（`afterPages`）と第3章への遷移を追加する。既存の該当 NPC を次の形に置き換える（座標 x/y と sprite は既存値を維持）:

```javascript
{
  x: 7, y: 4, sprite: 'kaiser',
  boss: {
    enemies: ['neo_kaiser'],
    winFlag: 'boss_neo_kaiser',
    vanishFlag: 'boss_neo_kaiser',
    // ending は出さない。地続きで第3章へ。
    afterPages: [
      'やみは ほろびた……\nと おもった そのとき――',
      'ゴゴゴ… と そらが われ、\nぎんいろの うちゅうせんが\nすがたを あらわした！',
      'ロボの サッカーぐんだんが\nちきゅうに おりてくる！',
      'ユイト「まだ おわってない…\nこんどは うちゅうから!?」',
      'ユイト「いくぞ みんな！\nほんとうの せかいいちを\nこの てで つかむんだ！」',
    ],
    warpTo: 'wc_stadium', warpX: 7, warpY: 15,
    setFlag: 'ch3_start',
  },
  pages: [
    '「よくぞ ここまで きた…\nだが やみは ふめつだ！」',
  ],
},
```

- [ ] **Step 4: ボス撃破ハンドラが afterPages / warpTo / setFlag を処理することを確認・実装**

`src/scenes/battle-scene.js` のボス勝利処理（battle-scene.js:941-957 付近）を確認する。`opts.reward`→`opts.winFlag/vanishFlag`→`opts.ending` の順で処理している。ここに `afterPages`（メッセージ追加）・`setFlag`（フラグ立て）・`warpTo`（遷移）の対応が無ければ追加する。

該当箇所（`if (opts.ending) { ... }` の直前）に挿入:

```javascript
      if (opts.setFlag) { state.flags = state.flags || {}; state.flags[opts.setFlag] = true; }
      if (Array.isArray(opts.afterPages)) { opts.afterPages.forEach(function (p) { pages.push(p); }); }
      if (opts.warpTo) {
        _showMessages(pages, function () {
          if (S && S.saveGame) S.saveGame(state);
          if (S && S.warpTo) S.warpTo(opts.warpTo, opts.warpX, opts.warpY);
          else if (S && S.gotoMap) S.gotoMap(opts.warpTo, opts.warpX, opts.warpY);
          if (S && S.popScene) S.popScene();
        });
        return;
      }
```

※ `S.warpTo`/`S.gotoMap` の正確なAPI名は field-scene.js / scene.js の既存マップ遷移呼び出しを `grep "gotoMap\|warpTo\|changeMap\|loadMap" src/` で確認し、実在する関数名に合わせる。存在するマップ遷移関数を使うこと。

- [ ] **Step 5: テストが pass することを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: Task 2 の2件が pass（`wc_stadium` マップはまだ無いが、遷移口の定義だけで通る）。

- [ ] **Step 6: コミット**

```bash
git add src/data/maps.js src/scenes/battle-scene.js tests/ch3.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
feat(ch3): ネオ・カイザー撃破を地続きで第3章へ(ED除去+入口イベント)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 真エンディング分岐（getEnding）

**Files:**
- Modify: `src/data/story.js`（`getEnding()`、story.js:93-168）
- Test: `tests/ch3.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記（tests/ch3.test.js）**

```javascript
test('ch3: boss_asterion 達成で真エンディングが返る', () => {
  const state = {
    party: [{ id: 'yuito', name: 'ユイト' }, { id: 'ikuma', name: 'イクマ' }],
    flags: { boss_neo_kaiser: true, boss_asterion: true },
  };
  const pages = story.getEnding(state);
  assert.ok(Array.isArray(pages) && pages.length > 0);
  const text = pages.join('\n');
  assert.ok(text.includes('だい3しょう') || text.includes('アステリオン') || text.includes('しんの'),
    '真EDの文言が含まれる');
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: FAIL（現状 boss_neo_kaiser 分岐の第2章EDが返り、第3章文言を含まない）。

- [ ] **Step 3: getEnding() に真ED分岐を追加**

`src/data/story.js` の `getEnding()` 内、`// ★ 第2章エンディング（ネオ・カイザー撃破時）` の `if (...)` ブロックの**直前**に、真ED分岐を挿入する（`_staffRoll` は既に定義済みなので利用する）:

```javascript
  // ★ 真エンディング（アステリオン撃破＝第3章クリア）
  if (state && state.flags && state.flags.boss_asterion) {
    var p3 = [
      'ほしくいの かみ アステリオンは\nおうごんの ひかりの なかへ\nきえていった……',
      'おうごんの ボールは\nもともと ほしの あいだを\nつなぐ たからものだった。',
      'ユイト「これで うちゅうも\nちきゅうも、みんなで\nサッカーが できるんだ！」',
      'せかいたいかいの ゆうしょうカップと\nほしの ちからが ひとつになり、\nちきゅうに へいわが もどった。',
    ];
    var fw3 = {
      ikuma:  'イクマ「うちゅういちの ストライカーは\nおれたちだ！」',
      aoshi:  'アオシ「ほしの かなたでも\nきみと パスを つなぎたい。」',
      tomoki: 'トモキ「どんな てきからも\nみんなを まもって みせる。」',
      itsuki: 'イツキ「この キセキを、\nずっと わすれないよ。」',
    };
    party.forEach(function (p) { if (fw3[p.id]) p3.push(fw3[p.id]); });
    p3.push('ユイト「ありがとう、みんな。\nさあ、つぎの しあいへ！」');
    _staffRoll(p3);
    p3.push('そして…\nさいごまで あそんでくれた きみ！');
    p3.push('だい3しょう\n「せかいいちへの みち、\nそして ほしの かなたへ」\nクリア！');
    p3.push('― しんの クリア！ ―\n\nほんとうに ありがとう！');
    return p3;
  }

```

- [ ] **Step 4: テストが pass することを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
npm test 2>&1 | tail -5
```

Expected: ch3 全 pass、全体も pass（第2章ED分岐は boss_asterion 無しのケースで従来どおり）。

- [ ] **Step 5: コミット**

```bash
git add src/data/story.js tests/ch3.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
feat(ch3): アステリオン撃破の真エンディング分岐を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: S1 世界大会（wc_stadium ＋ ヴォルグ ＋ 一本道の試合ゲート）

**Files:**
- Modify: `src/data/enemies.js`（`rival_ace`, `volg` 追加）
- Modify: `src/data/maps.js`（`wc_stadium` 追加）
- Test: `tests/ch3.test.js`（追記）

- [ ] **Step 1: 新敵を enemies.js に追加**

`src/data/enemies.js` の敵定義オブジェクト内（末尾の敵の後、閉じ括弧の前）に追加:

```javascript
  rival_ace: {
    id:'rival_ace', name:'ライバルこくの エース', type:'speed', art:'phantom_striker',
    hp:90, atk:22, def:12, spd:16, exp:120, gold:90,
    appears:[20,40],
    drops:[{ id:'mat_gold', chance:0.5 }],
  },
  volg: {
    id:'volg', name:'れっかの ヴォルグ', type:'power', art:'phantom_striker', isBoss:true,
    hp:320, atk:26, def:16, spd:18, exp:700, gold:600,
    drops:[{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:1.0 }],
    quotes:{
      intro:['「せかいの かべは あつい…\nおれを こえて みせろ！」'],
      defeat:'「みごとだ… きみたちが\nせかいいちだ。だが そらを みろ！」',
    },
  },
```

- [ ] **Step 2: wc_stadium マップを maps.js に追加**

`ch2_town` の grid を土台にする（`grep -n "ch2_town:" src/data/maps.js` で位置を確認し、その `grid` 配列 18行をコピーして流用）。次のマップオブジェクトを MAPS に追加する。試合は同一マップ内の4体のNPCで表現し、**前の勝利フラグが無い相手は戦えない**ことで一本道化する:

```javascript
wc_stadium: {
  id:'wc_stadium', name:'グランドスタジアム',
  cutscene:{ flag:'cs_wc', pages:[
    '―― グランドスタジアム。\nせかいじゅうの つよ者が\nあつまる ゆめのぶたい。',
    'ユイト「ここで せかいいちを\nきめるんだ！」',
  ]},
  grid: [ /* ch2_town の grid 18行をコピーして使用 */ ],
  npcs: [
    { x:4, y:6, sprite:'coach',
      boss:{ enemies:['rival_ace'], winFlag:'wc_qualify' },
      pages:['よせんの あいてだ！\nかってすすもう！'] },
    { x:8, y:6, sprite:'phantom_striker',
      boss:{ enemies:['rival_ace'], winFlag:'wc_quarter' },
      requireFlag:'wc_qualify', lockedMsg:'まず よせんに かとう！',
      pages:['準々決勝の あいてだ！'] },
    { x:4, y:10, sprite:'phantom_striker',
      boss:{ enemies:['rival_ace','rival_ace'], winFlag:'wc_semi' },
      requireFlag:'wc_quarter', lockedMsg:'準々決勝が さきだ！',
      pages:['準決勝、あいては 2にん！'] },
    { x:8, y:10, sprite:'kaiser',
      boss:{ enemies:['volg'], winFlag:'boss_volg', vanishFlag:'boss_volg',
             afterPages:['そらが われ、うちゅうせんが\nあらわれた！','ユイト「ネビュラごうに\nのりこむぞ！」'],
             warpTo:'nebula_f1', warpX:7, warpY:16, setFlag:'wc_semi' },
      requireFlag:'wc_semi', lockedMsg:'準決勝を かってから！',
      pages:['決勝！ れっかの ヴォルグだ！'] },
  ],
  exits: [
    { x:7, y:16, to:'ch2_castle', tx:7, ty:5,
      msg:'やみのしろへ もどる…' },
  ],
  encounter:{ rate:0.05, enemies:['rival_ace'] },
},
```

※ `requireFlag`/`lockedMsg` は NPC 会話ゲートとして機能させる。field-scene.js の NPC 起動処理が `npc.requireFlag` を見て未達なら `lockedMsg` を出す実装があるか `grep -n "requireFlag" src/scenes/field-scene.js` で確認。無ければ field-scene.js の NPC インタラクション処理に「`npc.requireFlag` があり `state.flags[npc.requireFlag]` が false なら `lockedMsg` を表示して return」を追加する。

- [ ] **Step 3: 一本道ゲートのテストを追記（tests/ch3.test.js）**

```javascript
test('ch3-S1: wc_stadium の決勝NPCは wc_semi を要求する', () => {
  const st = MAPS.wc_stadium;
  assert.ok(st, 'wc_stadium が存在する');
  const finalNpc = (st.npcs || []).find((n) => n.boss && n.boss.enemies.includes('volg'));
  assert.ok(finalNpc, '決勝(ヴォルグ)NPCがある');
  assert.strictEqual(finalNpc.requireFlag, 'wc_semi');
  assert.strictEqual(finalNpc.boss.winFlag, 'boss_volg');
  assert.strictEqual(finalNpc.boss.warpTo, 'nebula_f1');
});
```

- [ ] **Step 4: テスト実行**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: S1テスト pass。

- [ ] **Step 5: ビルドが通ることを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js 2>&1 | tail -2
```

Expected: `built index.html ... bytes`（エラーなし）。

- [ ] **Step 6: コミット**

```bash
git add src/data/enemies.js src/data/maps.js src/scenes/field-scene.js tests/ch3.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
feat(ch3): S1世界大会 wc_stadium とヴォルグ戦・試合ゲートを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: S2 宇宙戦艦ネビュラ号（3フロア ＋ ゼロス ＋ star_boots）

**Files:**
- Modify: `src/data/enemies.js`（`mecha_soldier`, `mecha_drone`, `zeros` 追加）
- Modify: `src/data/maps.js`（`nebula_f1`/`nebula_f2`/`nebula_f3` 追加）
- Test: `tests/ch3.test.js`（追記）

- [ ] **Step 1: 新敵を enemies.js に追加**

```javascript
  mecha_soldier: {
    id:'mecha_soldier', name:'メカ・ソルジャー', type:'power', art:'dark_kaiser',
    hp:110, atk:24, def:16, spd:12, exp:150, gold:110,
    appears:[30,50], drops:[{ id:'mat_iron', chance:0.6 }, { id:'mat_crystal', chance:0.3 }],
  },
  mecha_drone: {
    id:'mecha_drone', name:'メカ・ドローン', type:'speed', art:'offside_ghost',
    hp:80, atk:20, def:10, spd:22, exp:130, gold:90,
    appears:[30,50], drops:[{ id:'mat_iron', chance:0.5 }],
  },
  zeros: {
    id:'zeros', name:'メカ・エンペラー ゼロス', type:'technique', art:'dark_kaiser_rage', isBoss:true,
    hp:450, atk:30, def:22, spd:16, exp:1000, gold:900,
    drops:[{ id:'mat_gold', chance:1.0 }, { id:'mat_crystal', chance:1.0 }, { id:'mat_star', chance:1.0 }],
    phases:[
      { atk:30, def:22, spd:16 },
      { hpRatio:0.6, atk:36, def:24, spd:19 },
      { hpRatio:0.3, atk:42, def:28, spd:22 },
    ],
    quotes:{
      intro:['「ちきゅうの サッカーは\nわれわれ きかいが せいはする！」'],
      phases:['「システム、フルパワー!!」','「ありえない… にんげんに\nまけるなど…!!」'],
      defeat:'「なぜだ… なぜ きかいが\nこころに まけるのだ…」',
    },
  },
```

- [ ] **Step 2: nebula_f1 / nebula_f2 / nebula_f3 を maps.js に追加**

土台 grid は `ch2_pass`（通路系マップ）を `grep -n "ch2_pass:" src/data/maps.js` で確認しコピー。3マップを一本道に連結し、各フロアの出口に前フロアの突破フラグ、ブリッジ相当の nebula_f3 でゼロス戦→star_boots報酬→S3へ:

```javascript
nebula_f1: {
  id:'nebula_f1', name:'ネビュラごう 第1フロア', ambient:'embers',
  grid: [ /* ch2_pass の grid 18行をコピー */ ],
  npcs: [
    { x:7, y:8, sprite:'coach',
      boss:{ enemies:['mecha_soldier','mecha_drone'], winFlag:'nebula_f1' },
      pages:['きかいへいが ゆくてを ふさぐ！'] },
  ],
  exits: [
    { x:7, y:1, to:'nebula_f2', tx:7, ty:16, requireFlag:'nebula_f1',
      lockedMsg:'きかいへいを たおさないと\nさきへ すすめない！' },
    { x:7, y:16, to:'wc_stadium', tx:7, ty:10, msg:'スタジアムへ もどる…' },
  ],
  encounter:{ rate:0.09, enemies:['mecha_soldier','mecha_drone'] },
},
nebula_f2: {
  id:'nebula_f2', name:'ネビュラごう 第2フロア', ambient:'embers',
  grid: [ /* ch2_pass の grid 18行をコピー */ ],
  npcs: [
    { x:7, y:8, sprite:'phantom_striker',
      boss:{ enemies:['mecha_soldier','mecha_soldier'], winFlag:'nebula_f2' },
      pages:['さらに つよい きかいへい だ！'] },
  ],
  exits: [
    { x:7, y:1, to:'nebula_f3', tx:7, ty:16, requireFlag:'nebula_f2',
      lockedMsg:'ここの きかいへいを\nたおしてから！' },
    { x:7, y:16, to:'nebula_f1', tx:7, ty:2, msg:'第1フロアへ もどる…' },
  ],
  encounter:{ rate:0.09, enemies:['mecha_soldier','mecha_drone'] },
},
nebula_f3: {
  id:'nebula_f3', name:'ネビュラごう ブリッジ', ambient:'embers',
  grid: [ /* ch2_pass の grid 18行をコピー */ ],
  npcs: [
    { x:7, y:6, sprite:'phantom_striker',
      boss:{ enemies:['mecha_soldier','mecha_drone','mecha_drone'], winFlag:'nebula_f3' },
      pages:['ブリッジへの さいごの かべ！'] },
    { x:7, y:3, sprite:'kaiser',
      boss:{ enemies:['zeros'], winFlag:'boss_zeros', vanishFlag:'boss_zeros',
             reward:{ item:'star_boots', amount:1, label:'せいなるブーツ' },
             afterPages:['ゼロスは しずかに とまった。','どこからか こえが ひびく…',
                         '「よくぞ ここまで…\nおうごんの ボールの\nしんじつを みせよう。」',
                         'ひかりに つつまれ、ユイトたちは\nほしの かなたへ みちびかれた。'],
             warpTo:'star_shrine_1', warpX:7, warpY:16, setFlag:'nebula_f3' },
      requireFlag:'nebula_f3', lockedMsg:'まず この フロアの\nきかいへいを たおそう！',
      pages:['メカ・エンペラー ゼロス！'] },
  ],
  exits: [
    { x:7, y:16, to:'nebula_f2', tx:7, ty:2, msg:'第2フロアへ もどる…' },
  ],
  encounter:{ rate:0.07, enemies:['mecha_soldier','mecha_drone'] },
},
```

- [ ] **Step 3: S2ゲート＆報酬のテストを追記（tests/ch3.test.js）**

```javascript
test('ch3-S2: nebula 各フロアの前進出口は直前フラグを要求する', () => {
  const f1 = MAPS.nebula_f1, f2 = MAPS.nebula_f2, f3 = MAPS.nebula_f3;
  assert.ok(f1 && f2 && f3, '3フロアが存在する');
  const up1 = (f1.exits || []).find((e) => e.to === 'nebula_f2');
  const up2 = (f2.exits || []).find((e) => e.to === 'nebula_f3');
  assert.strictEqual(up1.requireFlag, 'nebula_f1');
  assert.strictEqual(up2.requireFlag, 'nebula_f2');
});

test('ch3-S2: ゼロス撃破で star_boots を報酬に、star_shrine_1 へ誘導', () => {
  const f3 = MAPS.nebula_f3;
  const zerosNpc = (f3.npcs || []).find((n) => n.boss && n.boss.enemies.includes('zeros'));
  assert.ok(zerosNpc);
  assert.strictEqual(zerosNpc.requireFlag, 'nebula_f3');
  assert.strictEqual(zerosNpc.boss.reward.item, 'star_boots');
  assert.strictEqual(zerosNpc.boss.warpTo, 'star_shrine_1');
});
```

- [ ] **Step 4: テスト実行**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -15
```

Expected: S2テスト pass。

- [ ] **Step 5: ビルド確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js 2>&1 | tail -2
```

Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/data/enemies.js src/data/maps.js tests/ch3.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
feat(ch3): S2ネビュラ号3フロアとゼロス戦・star_boots報酬を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: S3 星辰の神殿（試練3つ ＋ アステリオン ＋ star_mail ＋ 真ED接続）

**Files:**
- Modify: `src/data/enemies.js`（`star_sentinel`, `asterion` 追加）
- Modify: `src/data/maps.js`（`star_shrine_1`/`star_shrine_2`/`star_shrine_3` 追加）
- Test: `tests/ch3.test.js`（追記）

- [ ] **Step 1: 新敵を enemies.js に追加**

```javascript
  star_sentinel: {
    id:'star_sentinel', name:'せいしんの まもりて', type:'technique', art:'gold_emperor',
    hp:140, atk:28, def:20, spd:18, exp:220, gold:150,
    appears:[40,60], drops:[{ id:'mat_star', chance:0.4 }, { id:'mat_crystal', chance:0.4 }],
  },
  asterion: {
    id:'asterion', name:'ほしくいの かみ アステリオン', type:'technique', art:'gold_emperor', isBoss:true,
    hp:560, atk:34, def:26, spd:20, exp:2000, gold:1500,
    drops:[{ id:'mat_gold', chance:1.0 }, { id:'mat_star', chance:1.0 }],
    phases:[
      { atk:34, def:26, spd:20 },
      { hpRatio:0.66, atk:40, def:28, spd:24 },
      { hpRatio:0.33, atk:48, def:32, spd:28 },
    ],
    quotes:{
      intro:['「おうごんの ボールは\nわが ほしの たから。\nにんげんには わたさぬ！」'],
      phases:['「ほしの ちからを\nみせてやろう！」','「なぜ… にんげんの きずなが\nこれほど つよいのだ!?」'],
      defeat:'「わかった…\nこの ボールは、みなを\nつなぐ ための ものだったのだな。」',
    },
  },
```

- [ ] **Step 2: star_shrine_1/2/3 を maps.js に追加**

土台 grid は `shrine_forest_1f` を `grep -n "shrine_forest_1f:" src/data/maps.js` で確認しコピー。試練を一本道に連結。star_mail は star_shrine_2 の宝箱（`requireFlag:'trial_1'` で解錠）に配置。最奥 star_shrine_3 でアステリオン戦→`ending:true`（真ED発火）:

```javascript
star_shrine_1: {
  id:'star_shrine_1', name:'せいしんの しんでん 試練の間', ambient:'embers',
  cutscene:{ flag:'cs_shrine', pages:[
    '―― ほしの かなた、せいしんの しんでん。',
    'おうごんの ボールの\nはじまりの ばしょ。',
  ]},
  grid: [ /* shrine_forest_1f の grid 18行をコピー */ ],
  npcs: [
    { x:7, y:8, sprite:'phantom_striker',
      boss:{ enemies:['star_sentinel'], winFlag:'trial_1' },
      pages:['試練その1。\nまもりてを たおせ！'] },
  ],
  exits: [
    { x:7, y:1, to:'star_shrine_2', tx:7, ty:16, requireFlag:'trial_1',
      lockedMsg:'試練1を こえてから！' },
    { x:7, y:16, to:'nebula_f3', tx:7, ty:4, msg:'ネビュラごうへ もどる…' },
  ],
  encounter:{ rate:0.09, enemies:['star_sentinel'] },
},
star_shrine_2: {
  id:'star_shrine_2', name:'せいしんの しんでん 星の回廊', ambient:'embers',
  grid: [ /* shrine_forest_1f の grid 18行をコピー */ ],
  npcs: [
    { x:7, y:8, sprite:'phantom_striker',
      boss:{ enemies:['star_sentinel','star_sentinel'], winFlag:'trial_2' },
      pages:['試練その2。\nまもりては 2たい！'] },
  ],
  chests: [
    { id:'shrine_star_mail', x:3, y:5, item:'star_mail', amount:1, label:'せいなるよろい',
      requireFlag:'trial_1', lockedMsg:'まだ ひらかない…' },
  ],
  exits: [
    { x:7, y:1, to:'star_shrine_3', tx:7, ty:16, requireFlag:'trial_2',
      lockedMsg:'試練2を こえてから！' },
    { x:7, y:16, to:'star_shrine_1', tx:7, ty:2, msg:'試練の間へ もどる…' },
  ],
  encounter:{ rate:0.09, enemies:['star_sentinel'] },
},
star_shrine_3: {
  id:'star_shrine_3', name:'せいしんの しんでん さいおく', ambient:'embers',
  grid: [ /* shrine_forest_1f の grid 18行をコピー */ ],
  npcs: [
    { x:7, y:8, sprite:'phantom_striker',
      boss:{ enemies:['star_sentinel','star_sentinel'], winFlag:'trial_3' },
      pages:['試練その3。\nさいごの まもりて！'] },
    { x:7, y:3, sprite:'kaiser',
      boss:{ enemies:['asterion'], winFlag:'boss_asterion', vanishFlag:'boss_asterion',
             ending:true },
      requireFlag:'trial_3', lockedMsg:'試練3を こえてから！',
      pages:['ほしくいの かみ アステリオン！\nさいしゅうけっせん だ！'] },
  ],
  exits: [
    { x:7, y:16, to:'star_shrine_2', tx:7, ty:2, msg:'星の回廊へ もどる…' },
  ],
  encounter:{ rate:0.07, enemies:['star_sentinel'] },
},
```

- [ ] **Step 3: S3ゲート＆真ED発火のテストを追記（tests/ch3.test.js）**

```javascript
test('ch3-S3: star_shrine 各出口は直前試練フラグを要求する', () => {
  const s1 = MAPS.star_shrine_1, s2 = MAPS.star_shrine_2, s3 = MAPS.star_shrine_3;
  assert.ok(s1 && s2 && s3, '3フロアが存在する');
  assert.strictEqual((s1.exits || []).find((e) => e.to === 'star_shrine_2').requireFlag, 'trial_1');
  assert.strictEqual((s2.exits || []).find((e) => e.to === 'star_shrine_3').requireFlag, 'trial_2');
});

test('ch3-S3: star_mail は trial_1 解錠の宝箱にある', () => {
  const chest = (MAPS.star_shrine_2.chests || []).find((c) => c.item === 'star_mail');
  assert.ok(chest);
  assert.strictEqual(chest.requireFlag, 'trial_1');
});

test('ch3-S3: アステリオン戦は ending:true で真EDを発火し trial_3 を要求', () => {
  const boss = (MAPS.star_shrine_3.npcs || []).find((n) => n.boss && n.boss.enemies.includes('asterion'));
  assert.ok(boss);
  assert.strictEqual(boss.requireFlag, 'trial_3');
  assert.strictEqual(boss.boss.winFlag, 'boss_asterion');
  assert.strictEqual(boss.boss.ending, true);
});
```

- [ ] **Step 4: テスト実行**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -20
```

Expected: S3テスト pass。

- [ ] **Step 5: ビルド確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js 2>&1 | tail -2
```

Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/data/enemies.js src/data/maps.js tests/ch3.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
feat(ch3): S3星辰の神殿・アステリオン戦・star_mail・真ED接続を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 武器 atk 上限32ルールの保証（star_boots/star_mail のみ例外）

**Files:**
- Modify: `src/data/items.js`（変更なし・確認のみ）
- Test: `tests/ch3.test.js`（追記）

- [ ] **Step 1: 上限テストを追記（tests/ch3.test.js）**

```javascript
const items = require('../src/data/items.js');
const ITEMS = items.ITEMS || items;

test('装備: star_boots は atk40（第3章の例外）', () => {
  assert.strictEqual(ITEMS.star_boots.atk, 40);
});

test('装備: star_boots 以外の全武器は atk<=32', () => {
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it && it.kind === 'weapon' && id !== 'star_boots') {
      assert.ok(it.atk <= 32, id + ' の atk が32超過: ' + it.atk);
    }
  }
});

test('装備: star_mail は def28', () => {
  assert.strictEqual(ITEMS.star_mail.def, 28);
});
```

- [ ] **Step 2: テスト実行**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node --test tests/ch3.test.js 2>&1 | tail -20
```

Expected: 3件 pass。もし「star_boots 以外で atk>32」で FAIL したら、その武器の atk を32以下に修正（本章で追加した武器は無いので、既存の想定外定義があれば報告）。

- [ ] **Step 3: コミット**

```bash
git add tests/ch3.test.js
git -c user.name="genchan" -c user.email="nisshyan19910903@gmail.com" commit -m "$(cat <<'EOF'
test(ch3): 武器atk上限32(star_bootsのみ例外)を保証するテストを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 統合・全テスト・決定論ビルド・実機確認手順

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テストが緑であることを確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
npm test 2>&1 | tail -8
```

Expected: 全 pass（既存＋第3章の新規テスト）。失敗があれば該当タスクに戻って修正。

- [ ] **Step 2: 決定論ビルド（md5×2一致）を確認**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
node build.js && md5 -q index.html
rm -f index.html && node build.js && md5 -q index.html
```

Expected: 2回の md5 が完全一致。一致しなければ非決定的な要素（順序依存など）を調査。

- [ ] **Step 3: 進行の通し（フラグ順）を静的に検証**

spine の順序（story.js）と各マップ出口/NPCの `requireFlag`（maps.js）が次の鎖で完全一致していることを目視確認する:

`boss_neo_kaiser`(入口) → `wc_qualify` → `wc_quarter` → `wc_semi` → `boss_volg` → `nebula_f1` → `nebula_f2` → `nebula_f3` → `boss_zeros` → `trial_1` → `trial_2` → `trial_3` → `boss_asterion`(真ED)

```bash
grep -n "requireFlag" src/data/maps.js | grep -E "wc_|nebula_|trial_|boss_volg|boss_zeros|boss_asterion"
```

Expected: 各前進ゲートが直前フラグを要求している（飛び級不可）。

- [ ] **Step 4: index.html をブラウザで開いて実機通し確認（手動）**

`index.html` を開き、デバッグ用にセーブを第2章クリア直前まで進めるか、通しで次を確認:
1. ネオ・カイザー撃破 → EDが出ず「うちゅうせん」イベント → wc_stadium へ地続き遷移
2. 予選→準々→準決→決勝を順にしか戦えない（前を飛ばすと lockedMsg）
3. ヴォルグ撃破 → nebula_f1 へ。フロアを順にしか進めない
4. ゼロス撃破 → せいなるブーツ入手・装備で atk 上昇 → star_shrine_1 へ
5. 試練1→2→3を順に。star_shrine_2 でせいなるよろい入手
6. アステリオン撃破 → 真エンディング（「だい3しょう … クリア！」）

- [ ] **Step 5: 実装完了の締め（finishing-a-development-branch へ）**

全テスト緑・決定論ビルド一致・実機通しOKを確認したら、`superpowers:finishing-a-development-branch` スキルで完了処理（テスト確認→4択提示）へ進む。**本番push はげんちゃんの明示指示（「Pushして！」）を待つ。**

---

## Self-Review メモ（プラン作成者チェック済み）

- **Spec coverage:** 3ステージ（S1/S2/S3）＝Task4/5/6、一本道ゲート＝Task1＋各マップ requireFlag、伝説装備解禁＝Task5(star_boots)/Task6(star_mail)＋Task7(上限例外テスト)、地続き突入＝Task2、真ED＝Task3+Task6、決定論ビルド＝Task0/Task8。全spec要件にタスクが対応。
- **命名一貫性:** フラグ名・マップid・敵idは「確定する命名」節で一元定義し、全タスクで同一表記を使用。`warpTo`/`setFlag`/`afterPages`/`reward`/`winFlag`/`vanishFlag`/`requireFlag`/`lockedMsg` はボス・出口・宝箱で統一。
- **未確定として明示した点（実装時に既存コードで確定）:** ①マップ grid 実体は既存マップからのコピー（土台マップを明記）②`S.warpTo`/`gotoMap` の実API名は既存遷移呼び出しに合わせる③NPC `requireFlag` 会話ゲートの既存対応有無を確認し無ければ field-scene.js に追加④流用アートキーの実在確認。いずれも「確認コマンド＋代替方針」を各タスクに記載済み。
