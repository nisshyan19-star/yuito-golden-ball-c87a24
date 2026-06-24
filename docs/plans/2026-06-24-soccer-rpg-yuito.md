# ユイトと黄金のサッカーボール 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホのブラウザで遊べる、ドラクエ風ターン制RPG「ユイトと黄金のサッカーボール」を、配布用の単一 `index.html` として完成させる。

**Architecture:** 開発はファイルを責務ごとに分割（`src/`）。純粋ロジック（育成・戦闘・AI・セーブ）は Node の `node --test` でTDD。描画・入力・シーンは Canvas で実装しブラウザで目視確認。最後に `build.js` が全 `src/` を結合して**単一 `index.html`**（外部依存なし・オフライン可）を生成する。各ロジックは UMD 風ガードで Node(require) とブラウザ(window) 両対応。

**Tech Stack:** バニラ JavaScript（ES2020）、HTML5 Canvas、`localStorage`、Node 20（`node --test` / build スクリプトのみ。ランタイム依存ゼロ）。

---

## 実装方針メモ（全タスク共通）

- **テスト対象（TDD必須）**: `src/logic/`（progression, battle, ally-ai, items-effect, save）と `src/core/rng.js`。純粋関数として書き、`tests/*.test.js` から `require` してアサート。
- **目視確認（ブラウザ）**: `src/engine/`・`src/scenes/`・描画・入力。開発用 `index.dev.html` を `python` 無しでも開けるよう、`file://` で直接開くか、ローカルサーバ（`npx serve` 等は使わず）でなく**ビルド済み index.html**で確認する。開発中は `index.dev.html` を `<script type="module">` ではなく**通常 script の連結読み込み**にして `file://` で開けるようにする（CORS回避）。
- **UMDパターン**（全 `src/` ファイル末尾に付ける雛形）:
  ```js
  // ファイル冒頭は通常の関数/データ定義（グローバル副作用なし）
  // ファイル末尾：
  (function (root, api) {
    if (typeof module !== 'undefined' && module.exports) module.exports = api;       // Node
    if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api); // ブラウザ
  })(typeof window !== 'undefined' ? window : globalThis, { /* このファイルの公開API */ });
  ```
  これで Node テストでも `require('../src/logic/battle.js')`、ブラウザでも `window.SRPG.*` で同じコードが動く。`build.js` は各ファイルをそのまま連結するだけ（Node分岐はブラウザで実行されない／window分岐はNodeで実行されない）。
- **git**: 実装開始時にげんちゃんへ「ローカルで `git init` して各タスクごとにコミットしていい？（やり直しの安全網になる）」を確認する。OKなら各タスク末尾のコミットを実行、NGならコミット手順はスキップしてファイル保存のみで進める。
- **DRY / YAGNI / TDD / こまめにコミット** を守る。属性相性・合成・オンライン等は作らない（設計書のスコープ外）。

---

## ファイル構成（このプロジェクトで作るもの）

```
soccer-rpg-yuito/
  package.json                 // {"type":"commonjs"}, test/build スクリプト
  build.js                     // src を結合して index.html を生成
  index.html                   // ★配布用（build.js の生成物・単一ファイル）
  index.dev.html               // 開発確認用（src を順に読み込む）
  src/
    core/
      rng.js                   // シード可能な乱数
      game-state.js            // GameState の生成/初期化/ディープコピー
    data/
      sprites.js               // ドット絵データ（キャラ/敵/タイル/UI枠）
      characters.js            // パーティ初期データ＆成長定義
      skills.js                // 技定義
      enemies.js               // 敵・ボス定義
      items.js                 // 道具・装備定義
      maps.js                  // マップ/タイル/NPC/宝箱/イベント
      story.js                 // 章進行・仲間加入・ボス・セリフ
    logic/
      progression.js           // 経験値・レベルアップ
      items-effect.js          // 道具使用効果・装備適用
      battle.js                // ダメージ計算・行動解決・勝敗判定
      ally-ai.js               // おまかせAI（仲間行動選択）
      save.js                  // serialize/deserialize（純粋）
    engine/
      canvas.js                // Canvas生成・解像度/スケール・pixelated
      render.js                // スプライト/タイル/テキスト/ウィンドウ描画
      input.js                 // タッチ＋キー → up/down/left/right/confirm/cancel
      scene.js                 // シーンスタック（push/pop/replace, update/draw）
      storage.js               // localStorage ラッパ（save.js を利用）
    scenes/
      dialog.js                // メッセージウィンドウ（共通部品）
      title-scene.js
      field-scene.js
      battle-scene.js
      menu-scene.js
      shop-scene.js
    main.js                    // 起動・初期シーン・requestAnimationFrame ループ
  tests/
    rng.test.js
    progression.test.js
    items-effect.test.js
    battle.test.js
    ally-ai.test.js
    save.test.js
```

---

## Task 0: プロジェクト雛形・テスト/ビルド基盤・乱数

**Files:**
- Create: `soccer-rpg-yuito/package.json`
- Create: `soccer-rpg-yuito/src/core/rng.js`
- Create: `soccer-rpg-yuito/tests/rng.test.js`
- Create: `soccer-rpg-yuito/build.js`
- Create: `soccer-rpg-yuito/index.dev.html`

- [ ] **Step 1: package.json を作る**

```json
{
  "name": "soccer-rpg-yuito",
  "version": "0.1.0",
  "type": "commonjs",
  "scripts": {
    "test": "node --test",
    "build": "node build.js"
  }
}
```

- [ ] **Step 2: 失敗するテストを書く** — `tests/rng.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/core/rng.js');

test('同じシードなら同じ列を返す（再現性）', () => {
  const a = makeRng(123), b = makeRng(123);
  assert.strictEqual(a.next(), b.next());
});

test('rangeInt は min..max に収まる', () => {
  const r = makeRng(1);
  for (let i = 0; i < 200; i++) {
    const v = r.rangeInt(1, 6);
    assert.ok(v >= 1 && v <= 6, `range外: ${v}`);
  }
});

test('chance(1) は常に true, chance(0) は常に false', () => {
  const r = makeRng(7);
  assert.strictEqual(r.chance(1), true);
  assert.strictEqual(r.chance(0), false);
});
```

- [ ] **Step 3: テスト失敗を確認**

Run: `cd "soccer-rpg-yuito" && node --test tests/rng.test.js`
Expected: FAIL（`Cannot find module '../src/core/rng.js'`）

- [ ] **Step 4: 最小実装** — `src/core/rng.js`（mulberry32 ベース）

```js
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  function next() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    rangeInt: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { makeRng });
```

- [ ] **Step 5: テスト成功を確認**

Run: `node --test tests/rng.test.js`
Expected: PASS（3 tests）

- [ ] **Step 6: build.js を書く（src を結合して index.html を生成）**

```js
const fs = require('fs');
const path = require('path');
const ORDER = [
  'src/core/rng.js', 'src/core/game-state.js',
  'src/data/sprites.js', 'src/data/characters.js', 'src/data/skills.js',
  'src/data/enemies.js', 'src/data/items.js', 'src/data/maps.js', 'src/data/story.js',
  'src/logic/progression.js', 'src/logic/items-effect.js', 'src/logic/battle.js',
  'src/logic/ally-ai.js', 'src/logic/save.js',
  'src/engine/canvas.js', 'src/engine/render.js', 'src/engine/input.js',
  'src/engine/scene.js', 'src/engine/storage.js',
  'src/scenes/dialog.js', 'src/scenes/title-scene.js', 'src/scenes/field-scene.js',
  'src/scenes/battle-scene.js', 'src/scenes/menu-scene.js', 'src/scenes/shop-scene.js',
  'src/main.js',
];
const js = ORDER.filter(f => fs.existsSync(f)).map(f => `// === ${f} ===\n` + fs.readFileSync(f, 'utf8')).join('\n');
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>ユイトと黄金のサッカーボール</title>
<style>html,body{margin:0;height:100%;background:#0b0b12;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#game{display:block;margin:0 auto;image-rendering:pixelated;background:#000}</style></head>
<body><canvas id="game"></canvas><script>\n${js}\n</script></body></html>`;
fs.writeFileSync('index.html', html);
console.log('built index.html', html.length, 'bytes');
```

- [ ] **Step 7: index.dev.html を書く（開発確認用・src を順次読み込み）**

`build.js` の `ORDER` と同じ順で `<script src="...">` を並べた最小HTML（`<canvas id="game">` を含む）。`file://` でそのまま開ける。

- [ ] **Step 8: ビルド実行を確認**

Run: `node build.js`
Expected: `built index.html ... bytes` と表示され、`index.html` が生成される。

- [ ] **Step 9: コミット**（git管理する場合）

```bash
git add . && git commit -m "chore: project scaffold, rng with tests, build script"
```

---

## Task 1: コアデータ定義（GameState・キャラ・技・敵・道具）

**Files:**
- Create: `src/core/game-state.js`, `src/data/characters.js`, `src/data/skills.js`, `src/data/enemies.js`, `src/data/items.js`

このタスクは「設計書 §4/§6/§7/§8」の数値をデータ化する。やさしい難易度に振る。各ファイルは UMD パターン。

- [ ] **Step 1: skills.js** — 技定義（設計書 §6）。各技 `{ id, name, user, mp, type, power|heal, target, learnLevel }`。

```js
const SKILLS = {
  drive_shoot:   { id:'drive_shoot', name:'ドライブシュート', user:'yuito', mp:4, type:'attack', power:1.4, target:'one', learnLevel:1 },
  overhead:      { id:'overhead', name:'オーバーヘッドシュート', user:'yuito', mp:8, type:'attack', power:2.0, target:'one', learnLevel:6 },
  header:        { id:'header', name:'弾丸ヘディング', user:'ikuma', mp:3, type:'attack', power:1.4, target:'one', learnLevel:1 },
  super_volley:  { id:'super_volley', name:'スーパーボレー', user:'ikuma', mp:9, type:'attack', power:2.4, target:'one', learnLevel:8 },
  razor_pass:    { id:'razor_pass', name:'カミソリパス', user:'aoshi', mp:5, type:'attack', power:1.0, target:'all', learnLevel:1 },
  field_control: { id:'field_control', name:'フィールドコントロール', user:'aoshi', mp:6, type:'buff_def', amount:1.3, target:'allies', learnLevel:7 },
  tackle:        { id:'tackle', name:'スライディングタックル', user:'tomoki', mp:4, type:'attack', power:1.3, stun:0.3, target:'one', learnLevel:1 },
  guard:         { id:'guard', name:'かべになる', user:'tomoki', mp:0, type:'cover', target:'ally', learnLevel:1 },
  super_save:    { id:'super_save', name:'スーパーセーブ', user:'itsuki', mp:4, type:'heal', heal:40, target:'ally', learnLevel:1 },
  healing_whistle:{ id:'healing_whistle', name:'ヒーリングホイッスル', user:'itsuki', mp:10, type:'heal', heal:35, target:'allies', learnLevel:7 },
  golden_strike: { id:'golden_strike', name:'ゴールデン・ストライク', user:'party', mp:0, type:'ultimate', power:3.0, target:'all', learnLevel:null },
};
```
（数値は Task 4 以降で調整可。）

- [ ] **Step 2: characters.js** — パーティ初期データ（設計書 §4）。各キャラ `{ id, name, position, baseStats:{hp,mp,atk,def,spd}, growth:{...毎レベル増分}, skills:[id...], joinChapter }`。
- [ ] **Step 3: items.js** — 道具・装備（設計書 §8）。道具 `{ id,name,kind:'item',effect:{hp|mp|revive},price }`、装備 `{ id,name,kind:'weapon'|'armor',atk|def,price }`。
- [ ] **Step 4: enemies.js** — 敵・ボス（設計書 §7）。各敵 `{ id,name,hp,atk,def,spd,exp,gold,skills?,appears:[mapId...] }`。ボスは `{ phases:[...] }` を持つ。
- [ ] **Step 5: game-state.js** — `createNewGame()` が初期 `GameState`（party=ユイトのみ加入、inventory, gold=0, flags={}, position, settings.autoAllies=true）を返す。`cloneState(s)` でディープコピー（`structuredClone` 利用）。
- [ ] **Step 6: 簡易ロードテスト** — `tests/data.smoke.test.js` で各データを require し、必須キーの存在と型をアサート（例：全 skill に `name` と `mp>=0`）。

```js
const test=require('node:test'); const assert=require('node:assert');
const skills=require('../src/data/skills.js').SKILLS;
test('全 skill が name と mp を持つ', () => {
  for (const k in skills){ assert.ok(skills[k].name, k); assert.ok(skills[k].mp>=0, k); }
});
```

- [ ] **Step 7: テスト＆コミット** — `node --test` 全通過後 `git commit -m "feat: core data (characters/skills/enemies/items/state)"`

---

## Task 2: 育成ロジック（progression）— TDD

**Files:** Create `src/logic/progression.js`, `tests/progression.test.js`

公開API: `expForNextLevel(level)`, `gainExp(character, amount)`（レベルアップ・能力上昇・技習得を適用し `{leveledUp, learned:[skillId...]}` を返す）。

- [ ] **Step 1: 失敗テスト**

```js
const test=require('node:test'); const assert=require('node:assert');
const { expForNextLevel, gainExp } = require('../src/logic/progression.js');

test('必要経験値はレベルとともに増える（やさしくゆるやか）', () => {
  assert.ok(expForNextLevel(1) < expForNextLevel(5));
});
test('十分な経験値でレベルアップし HP最大値が増える', () => {
  const c = { level:1, exp:0, maxHp:30, hp:30, maxMp:10, mp:10, atk:8, def:6, spd:7,
              growth:{hp:6,mp:3,atk:2,def:2,spd:1}, skills:[], id:'yuito' };
  const r = gainExp(c, 1000);
  assert.ok(r.leveledUp);
  assert.ok(c.level >= 2);
  assert.ok(c.maxHp > 30);
});
test('習得レベル到達で技を覚える', () => {
  const c = { level:5, exp:0, maxHp:60, hp:60, maxMp:20, mp:20, atk:14, def:10, spd:11,
              growth:{hp:6,mp:3,atk:2,def:2,spd:1}, skills:['drive_shoot'], id:'yuito' };
  const r = gainExp(c, 1000); // Lv6 で overhead 習得
  assert.ok(c.skills.includes('overhead'));
});
```

- [ ] **Step 2: 失敗確認** → `node --test tests/progression.test.js`（FAIL）
- [ ] **Step 3: 実装** — `expForNextLevel(l)=Math.floor(8*Math.pow(l,1.6))+l*4`（ゆるやか）。`gainExp` はループで閾値を超えるたび level++、各 growth を maxHp/maxMp/atk/def/spd に加算（hp/mp も全回復）、`SKILLS` から `learnLevel<=level && user===id` の技を skills に追加。
- [ ] **Step 4: 成功確認**（PASS）
- [ ] **Step 5: コミット** `feat: leveling & skill learning`

---

## Task 3: 道具・装備効果（items-effect）— TDD

**Files:** Create `src/logic/items-effect.js`, `tests/items-effect.test.js`

公開API: `useItem(target, item)`（HP/MP回復・戦闘不能復活を適用、`{ok, message}`）, `applyEquip(character)`（装備の atk/def をステータスへ反映した実効値を返す）。

- [ ] **Step 1: 失敗テスト**（回復が maxHp を超えない／復活で hp>0／装備で atk が増える）。
```js
const test=require('node:test'); const assert=require('node:assert');
const { useItem, applyEquip } = require('../src/logic/items-effect.js');
test('回復は maxHp を超えない', () => {
  const t={hp:50,maxHp:60,mp:5,maxMp:20,dead:false};
  useItem(t,{kind:'item',effect:{hp:100}});
  assert.strictEqual(t.hp,60);
});
test('リスタートの笛で戦闘不能から復活', () => {
  const t={hp:0,maxHp:60,dead:true};
  useItem(t,{kind:'item',effect:{revive:0.5}});
  assert.ok(!t.dead && t.hp>0);
});
```
- [ ] **Step 2-5:** 失敗確認 → 実装（clamp 処理）→ 成功確認 → コミット `feat: item & equipment effects`

---

## Task 4: 戦闘ダメージ計算（battle core）— TDD

**Files:** Create `src/logic/battle.js`, `tests/battle.test.js`

公開API: `calcDamage(attacker, defender, {power=1, rng, crit})`, `applyDamage(target, dmg)`, `isDefeated(unit)`。

- [ ] **Step 1: 失敗テスト**

```js
const test=require('node:test'); const assert=require('node:assert');
const { calcDamage } = require('../src/logic/battle.js');
const { makeRng } = require('../src/core/rng.js');
test('こうげき>しゅび で1以上のダメージ', () => {
  const d = calcDamage({atk:20},{def:6},{power:1, rng:makeRng(1)});
  assert.ok(d >= 1);
});
test('しゅびが高くても最低1ダメージ', () => {
  const d = calcDamage({atk:5},{def:99},{power:1, rng:makeRng(1)});
  assert.strictEqual(d, Math.max(1, d));
  assert.ok(d >= 1);
});
test('power 倍率が効く', () => {
  const r1=makeRng(5), r2=makeRng(5);
  const lo=calcDamage({atk:20},{def:6},{power:1,rng:r1});
  const hi=calcDamage({atk:20},{def:6},{power:2,rng:r2});
  assert.ok(hi > lo);
});
```

- [ ] **Step 2: 失敗確認**（FAIL）
- [ ] **Step 3: 実装** — `base = atk - def/2`; `dmg = Math.max(1, Math.round(base * power * (0.9 + 0.2*rng.next())))`; `crit` 指定 or `rng.chance(0.08)` で約2倍。`applyDamage`/`isDefeated` も実装。
- [ ] **Step 4: 成功確認**（PASS）
- [ ] **Step 5: コミット** `feat: battle damage calculation`

---

## Task 5: おまかせAI（ally-ai）— TDD

**Files:** Create `src/logic/ally-ai.js`, `tests/ally-ai.test.js`

公開API: `chooseAllyAction(actor, party, enemies, rng)` → `{type:'attack'|'skill'|'item'|'cover', skillId?, targetId?}`。方針は設計書 §4。

- [ ] **Step 1: 失敗テスト**

```js
const test=require('node:test'); const assert=require('node:assert');
const { chooseAllyAction } = require('../src/logic/ally-ai.js');
const { makeRng } = require('../src/core/rng.js');
test('イツキは瀕死の味方がいれば回復を選ぶ', () => {
  const itsuki={id:'itsuki',mp:20,skills:['super_save']};
  const party=[{id:'yuito',hp:5,maxHp:60,dead:false}, itsuki];
  const a=chooseAllyAction(itsuki,party,[{id:'e1',hp:30,dead:false}],makeRng(1));
  assert.strictEqual(a.type,'skill');
  assert.strictEqual(a.skillId,'super_save');
});
test('アオシは敵が2体以上なら全体技を選ぶ', () => {
  const aoshi={id:'aoshi',mp:20,skills:['razor_pass']};
  const enemies=[{id:'e1',hp:20,dead:false},{id:'e2',hp:20,dead:false}];
  const a=chooseAllyAction(aoshi,[aoshi],enemies,makeRng(1));
  assert.ok(a.type==='skill' && a.skillId==='razor_pass');
});
```

- [ ] **Step 2-5:** 失敗確認 → 実装（HP35%閾値・MP不足時は通常攻撃・対象選択）→ 成功確認 → コミット `feat: ally auto-battle AI`

---

## Task 6: セーブ／ロード（serialize）— TDD

**Files:** Create `src/logic/save.js`, `tests/save.test.js`

公開API: `serialize(gameState)` → JSON文字列, `deserialize(str)` → GameState（壊れていれば `null`）。`localStorage` には依存しない純粋関数（Task 8 の `storage.js` がラップ）。

- [ ] **Step 1: 失敗テスト**（往復で同値・不正JSONで null）。
```js
const test=require('node:test'); const assert=require('node:assert');
const { serialize, deserialize } = require('../src/logic/save.js');
test('serialize→deserialize で同値に戻る', () => {
  const s={party:[{id:'yuito',level:3}],gold:120,flags:{ikuma:true},position:{map:'field1',x:5,y:5},settings:{autoAllies:true},inventory:{drink:2}};
  assert.deepStrictEqual(deserialize(serialize(s)), s);
});
test('壊れた文字列は null', () => { assert.strictEqual(deserialize('{oops'), null); });
```
- [ ] **Step 2-5:** 失敗確認 → 実装（version フィールド付与・try/catch）→ 成功確認 → コミット `feat: save serialization`

---

## Task 7: 描画エンジン（canvas/render/sprites）— ブラウザ目視

**Files:** Create `src/engine/canvas.js`, `src/engine/render.js`, `src/data/sprites.js`

- [ ] **Step 1: sprites.js** — ドット絵データ。プレビューと同じ「文字列配列＋パレット」方式。最低限：パーティ5人（向き=正面）、タイル（草/道/壁/水/床）、UI枠。`{ map:[...rows], palette:{char:hex} }`。
- [ ] **Step 2: canvas.js** — 仮想解像度（例 240×320）を実画面幅にスケール、`imageSmoothingEnabled=false`。`getCtx()`, `resize()`。
- [ ] **Step 3: render.js** — `drawSprite(ctx, sprite, x, y, scale)`（パレットで `fillRect`）、`drawTileMap(...)`、`drawText(ctx, str, x, y, opts)`（ドット風）、`drawWindow(ctx, x, y, w, h)`（ドラクエ風角丸枠）。
- [ ] **Step 4: 目視確認** — `index.dev.html` を `file://` で開き、5人＋タイル＋ウィンドウ枠が正しく描画されることをスクリーンショットで確認。
- [ ] **Step 5: コミット** `feat: canvas render engine + sprites`

> 確認は Claude_Preview / browser MCP でスクリーンショットを撮り、実際の表示を見て判断する（描画崩れがないか）。

---

## Task 8: 入力・シーン管理・ストレージ — 目視

**Files:** Create `src/engine/input.js`, `src/engine/scene.js`, `src/engine/storage.js`, `src/main.js`

- [ ] **Step 1: input.js** — 画面下の仮想十字キー＋決定/キャンセルを Canvas に描画し、`touchstart/move/end` と `keydown`(矢印/Enter/Esc) を統一イベント `{up,down,left,right,confirm,cancel}` に変換。
- [ ] **Step 2: scene.js** — シーンスタック（`push/pop/replace`）、`update(dt, input)` と `draw(ctx)` を現在シーンへ委譲。
- [ ] **Step 3: storage.js** — `save(state)`/`load()`/`hasSave()` を `localStorage` + `src/logic/save.js` で実装。
- [ ] **Step 4: main.js** — Canvas初期化 → 入力初期化 → TitleScene を push → `requestAnimationFrame` ループで `update`/`draw`。
- [ ] **Step 5: 目視確認** — 仮想パッド押下に反応してログ/簡易表示が動く。コミット `feat: input, scene stack, storage, main loop`

---

## Task 9: タイトル画面 — 目視

**Files:** Create `src/scenes/title-scene.js`, `src/scenes/dialog.js`

- [ ] **Step 1: dialog.js** — メッセージウィンドウ（文字送り・複数ページ・決定で次へ）。
- [ ] **Step 2: title-scene.js** — タイトルロゴ＋ドット絵、「はじめから／つづきから」（セーブ無ければ「つづきから」を選べない）。決定で FieldScene/ロードへ。
- [ ] **Step 3: 目視確認＆コミット** `feat: title scene + message window`

---

## Task 10: フィールド探索 — 目視

**Files:** Create `src/scenes/field-scene.js`, `src/data/maps.js`

- [ ] **Step 1: maps.js** — 各マップ：タイル配列、通行判定、NPC（位置＋会話）、宝箱（位置＋中身）、出口（隣マップへ）、エンカウント率＋出現敵テーブル。設計書 §3 の6マップ分（やさしくエンカウント控えめ）。
- [ ] **Step 2: field-scene.js** — タイルマップ描画＋プレイヤー移動（衝突判定）、歩数でランダムエンカウント→BattleScene、宝箱開封、NPC会話（dialog）、メニューボタンで MenuScene、マップ間移動。
- [ ] **Step 3: 目視確認** — 1マップを歩け、宝箱・NPC・エンカウントが起きる。コミット `feat: field exploration + maps`

---

## Task 11: バトル画面 — 目視（ロジックは Task4-6 で担保）

**Files:** Create `src/scenes/battle-scene.js`

- [ ] **Step 1: レイアウト** — 上=敵スプライト、中=メッセージ窓、左下=パーティHP/MP一覧、右下=コマンド（ユイトのみ：たたかう/とくぎ/どうぐ/ぼうぎょ/にげる）。
- [ ] **Step 2: ターン処理** — すばやさ順の行動キュー。ユイトは入力、仲間は `chooseAllyAction`、敵は簡易AI。行動を `calcDamage`/`applyDamage`/`useItem` で解決し dialog に結果表示。
- [ ] **Step 3: 勝敗** — 全敵撃破で経験値/ゴール配分（`gainExp`）→ レベルアップ表示 → FieldScene へ。全滅は設計書 §5：直前地点で全回復再開（ゲームオーバーにしない）。
- [ ] **Step 4: 目視確認** — 1戦闘を勝利・レベルアップまで通す。コミット `feat: battle scene wired to logic`

---

## Task 12: メニュー & ショップ — 目視

**Files:** Create `src/scenes/menu-scene.js`, `src/scenes/shop-scene.js`

- [ ] **Step 1: menu-scene.js** — つよさ（各キャラ Lv/HP/MP/能力/装備）、どうぐ（使用/並べ替え）、そうび（変更→`applyEquip`）、さくせん（autoAllies の ON/OFF）、セーブ（`storage.save`）。
- [ ] **Step 2: shop-scene.js** — 道具屋/装備屋。購入（ゴール減算・所持追加）、売却（任意）。NPC会話から開く。
- [ ] **Step 3: 目視確認＆コミット** `feat: menu and shop scenes`

---

## Task 13: ストーリー進行・仲間加入・ボス・エンディング — 目視

**Files:** Create `src/data/story.js`、各シーンへフック追加

- [ ] **Step 1: story.js** — 章フラグ、各マップ到達/ボス撃破イベント、仲間加入（イクマ→アオシ→トモキ→イツキ）のセリフと party 追加、ラスボス2段階、エンディング文。
- [ ] **Step 2: フック** — FieldScene の特定地点で会話/加入イベント発火、BattleScene でボス撃破時にフラグ更新＆次章解放、ラスボス撃破でエンディング→タイトル。
- [ ] **Step 3: 目視確認** — 仲間が順に増え、ボス撃破で進行、最後にエンディングが出る。コミット `feat: story progression, allies, bosses, ending`

---

## Task 14: 通しプレイ・バランス調整・配布ビルド確定

- [ ] **Step 1: 全テスト** `node --test`（全 logic テスト PASS）。
- [ ] **Step 2: `node build.js`** で `index.html` を生成。
- [ ] **Step 3: 通しプレイ** — `index.html` を `file://` で開き、最初から最後（ラスボス撃破→エンディング）まで一人で詰まらず遊べるか確認。9歳目線で「やさしい・テンポ良い」を点検（エンカウント頻度・回復入手性・ボスHP）。
- [ ] **Step 4: 調整** — 詰まり/簡単すぎ/難しすぎを数値で微調整し再ビルド。
- [ ] **Step 5: スマホ確認** — 実機 or モバイル幅で表示・タッチ操作を確認（仮想パッドの押しやすさ、文字サイズ）。
- [ ] **Step 6: 最終コミット** `feat: balance pass + final single-file build`

---

## Self-Review（この計画の自己点検）

**1. Spec coverage（設計書の各節 → タスク対応）**
- §2 技術方針（単一HTML/Canvas/localStorage/タッチ）→ Task 0,7,8,14
- §3 ストーリー/6マップ → Task 10,13
- §4 キャラ/おまかせAI → Task 1,5,11,12
- §5 戦闘システム/全滅時やさしさ → Task 4,6,11
- §6 必殺技 → Task 1,11
- §7 敵・ボス → Task 1,11,13
- §8 育成・経済（経験値/ゴール/ショップ/装備/宝箱）→ Task 2,3,10,12
- §9 画面・UI → Task 7,9,10,11,12
- §10 データ構造/セーブ → Task 1,6,8
- §11 やさしさ設計 → Task 4,10,11,14
- §12 スコープ外 → 全タスクで未実装を維持
- ギャップ：なし（音は §12 で除外。最小効果音が欲しければ Task 14 後の追加フェーズ）。

**2. Placeholder scan:** 各 logic タスクは実テストコード＋実装方針を明記。ビジュアルタスクは「目視確認＋スクショ」の確認手段を明記。"TBD/後で" は不使用。データ数値は具体値（skills.js）またはバランス調整対象として Task 14 に集約（曖昧放置ではない）。

**3. Type consistency:** API名を統一（`makeRng`,`gainExp`,`calcDamage/applyDamage/isDefeated`,`useItem/applyEquip`,`chooseAllyAction`,`serialize/deserialize`,`save/load/hasSave`）。キャラは全タスクで `{id,name,level,hp,maxHp,mp,maxMp,atk,def,spd,skills,equip,dead}` を共通形とする。

---

## 実装の進め方（ハンドオフ）
Task 0 から順に実装。各 logic タスクは TDD（失敗テスト→実装→PASS→コミット）、各ビジュアルタスクは実装→ブラウザ目視（スクショ）→コミット。Task 14 で通しプレイ＆配布用 `index.html` を確定する。
