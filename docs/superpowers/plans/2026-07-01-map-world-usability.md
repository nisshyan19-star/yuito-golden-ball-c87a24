# 第2弾「ワールドマップ化／あそびやすさ強化」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 27マップを画面切替式のまま維持しつつ、「今どこ？どっちへ行く？全体像は？」の不安を消す5つのあそびやすさ機能（スムーズスクロール／ミニマップ／行き先看板／世界地図／ファストトラベル）を、既存の当たり判定・エンカウント・ワープ・隊列ロジックを一切変えずに上乗せする。

**Architecture:** 追加はすべて「描画の上乗せ」か「読み取り専用データの参照」に限定する。純粋ロジック（`lerp`/`stepEase`/`minimapCell`/`nearestExitLabel`/世界地図ノード集約）は `node --test` でユニットテスト。描画（補間表示・ミニマップ・看板・世界地図・ワープ）は built `index.html` を実ブラウザで目視検証。バンドル鉄則①（全 `src/` が1スコープに連結）を厳守し、新規トップレベル識別子は事前 grep で衝突ゼロを確認済み（`lerp`/`stepEase`/`minimapCell`/`nearestExitLabel`/`_drawMinimap`/`_drawSignpost`/`WORLD_MAP_NODES`/`WORLD_MAP_LINKS`/`visibleWorldNodes`/`fastTravelTowns`/`drawWorldPanel`/`buildWorld`/`visited`）。`build.js` の ORDER は編集せず、追記はすべて `field-scene.js` と `menu-scene.js` に閉じる。

**Tech Stack:** 素の JavaScript（ES5 相当・`var` のみ）、canvas 2D 描画、`node:test` + `node:assert`、自作 `build.js`（全 `src/` を1つの `<script>` へ連結）、`preview` MCP（server名 `srpg-dev`・`http://localhost:5599/index.html`）。

---

## 前提コマンド（全タスク共通）

すべてのターミナル操作の前に、Node を PATH に通す：

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
```

**ビルド＆検証チェーン**（各タスク完了時に必ず全部）：

```bash
node build.js
wc -c index.html
md5 -q index.html
node --test
```

- `node --test` は全 PASS・0 fail が必須（既存テストの回帰ゼロ）。
- ビルド後は built `index.html` を **`http://localhost:5599/index.html`** で実ブラウザ目視（ルート `/` は罠＝`dev-render-test.html` を返す）。preview は `preview_list` で毎回 `serverId` を取得（server名 `srpg-dev`）。`preview_eval` の引数名は `expression` と `serverId`。
- **黒画面＝バンドル衝突**の合図。`node --test` はスコープ分離で衝突を検知できないので、必ず built `index.html` を実ブラウザでロードして確認する。

**コミット規約：** 各コミットのメッセージ末尾に必ず付ける：

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

**Push は禁止**（げんちゃんが「Pushして！」と明言するまでローカルコミットのみ）。

---

## File Structure（このプロジェクトで触るファイル）

- **Modify:** `src/scenes/field-scene.js`（機能①②③⑥の本体。純粋関数＋描画オーバーレイ＋機能④の visited 記録＋機能⑥の入場フェード/マップ名フラッシュ）
- **Modify:** `src/scenes/menu-scene.js`（機能④⑤の本体。世界地図データ＋メニュー項目＋世界地図画面＋ファストトラベル）
- **Modify:** `src/engine/audio.js`（機能⑥：マップ切替の効果音 `stairs` を `SRPG_SE` に追加）
- **Create:** `tests/smooth-scroll.test.js`（機能①：`lerp`/`stepEase`）
- **Create:** `tests/minimap.test.js`（機能②：`minimapCell`）
- **Create:** `tests/exit-signpost.test.js`（機能③：`nearestExitLabel`）
- **Create:** `tests/worldmap.test.js`（機能④：`WORLD_MAP_NODES`/`visibleWorldNodes`/`fastTravelTowns`）
- **Create:** `tests/map-transition.test.js`（機能⑥：`fadeAlpha`/`flashAlpha`）
- **参照のみ（編集しない）:** `build.js`（ORDER 固定）、`src/data/maps.js`（`MAPS`/`TILE_LEGEND` を実行時参照）、`src/logic/save.js`（`state` 追記で自動セーブ）

各機能は独立タスク。タスクごとに `node build.js` → テスト → 実機目視 → げんちゃんに見せる（「一段ずつ実機で見せる」スタイル）。

---

## Task 1: 機能① 🎥 スムーズスクロール（歩行のヌルッと補間）

1マス瞬間移動（`px = nx; py = ny;`）はそのまま維持し、描画専用の補間状態（`moveFromX`/`moveFromY`/`moveProg`）を足してカメラと隊列を滑らかに流す。当たり判定・エンカウント・ワープは整数マスのまま＝すり抜けゼロ。

**Files:**
- Create: `tests/smooth-scroll.test.js`
- Modify: `src/scenes/field-scene.js`（純粋関数 `lerp`/`stepEase` をトップレベル追加＋UMDエクスポート、`createFieldScene` 内の補間状態・`_stepLeaderTo`/`_setLeaderPos`・`update`・`draw`/カメラ・actors・描画ループ）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/smooth-scroll.test.js`:

```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { lerp, stepEase } = require('../src/scenes/field-scene.js');

test('lerp: t=0 は始点を返す', () => {
  assert.strictEqual(lerp(2, 10, 0), 2);
});

test('lerp: t=1 は終点を返す', () => {
  assert.strictEqual(lerp(2, 10, 1), 10);
});

test('lerp: t=0.5 は中点', () => {
  assert.strictEqual(lerp(0, 10, 0.5), 5);
});

test('lerp: 負方向にも線形', () => {
  assert.strictEqual(lerp(10, 2, 0.5), 6);
});

test('stepEase: 0 で 0、1 で 1（境界クランプ）', () => {
  assert.strictEqual(stepEase(0), 0);
  assert.strictEqual(stepEase(1), 1);
});

test('stepEase: 0未満/1超はクランプ', () => {
  assert.strictEqual(stepEase(-0.5), 0);
  assert.strictEqual(stepEase(1.5), 1);
});

test('stepEase: easeOut（中間は線形より速い＝0.5で0.5超）', () => {
  const v = stepEase(0.5);
  assert.ok(v > 0.5, 'easeOut は 0.5 時点で 0.5 を超える, got ' + v);
  assert.ok(v < 1, 'まだ 1 未満, got ' + v);
});

test('stepEase: 単調増加', () => {
  let prev = -1;
  for (let i = 0; i <= 10; i++) {
    const v = stepEase(i / 10);
    assert.ok(v >= prev, '単調増加でない at ' + (i / 10));
    prev = v;
  }
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/smooth-scroll.test.js
```
Expected: FAIL（`lerp`/`stepEase` が undefined ＝ `TypeError` または assertion 失敗）。

- [ ] **Step 3: `lerp`/`stepEase` をトップレベル追加**

`src/scenes/field-scene.js` の `_drawObjectiveBar`（857-864行）の直後、865行目付近（`// ── 弾6：DQ風の地形タイル …` コメントの直前）に挿入：

```javascript
// ── 弾7-①：スムーズスクロール用の純粋関数（描画補間のみ・ゲームロジックは整数マスのまま） ──
// lerp: 線形補間。a→b を t(0..1) で。
function lerp(a, b, t) {
  return a + (b - a) * t;
}
// stepEase: 歩行1マスぶんの easeOut。足元が気持ちよくなる程度の軽い減速。境界はクランプ。
function stepEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * (2 - t);
}
```

- [ ] **Step 4: UMD エクスポートに追加**

`src/scenes/field-scene.js` の UMD エクスポート末尾（現在 3052-3076行のオブジェクト）に2行追加。`createFieldScene: createFieldScene,` の直前など、オブジェクト内の任意の位置でよい：

```javascript
  lerp:             lerp,
  stepEase:         stepEase,
```

- [ ] **Step 5: テストが通ることを確認**

Run:
```bash
node --test tests/smooth-scroll.test.js
```
Expected: PASS（8 tests）。

- [ ] **Step 6: 補間状態の変数を追加（プレイヤー）**

`src/scenes/field-scene.js` のプレイヤー変数定義（現在1617-1620行）：

```javascript
      var px = (pos.x !== undefined && pos.x !== null) ? pos.x : 5;
      var py = (pos.y !== undefined && pos.y !== null) ? pos.y : 5;
      var facing = 'down';
      var moveTimer = 0;
```

これらの直後に追加：

```javascript
      // 弾7-①：描画補間状態（px/py は整数マスのまま。表示だけ moveFromX→px を lerp する）
      var moveFromX = px;
      var moveFromY = py;
      var moveProg = 1; // 1 = 補間完了（静止）
```

- [ ] **Step 7: 隊列（followers）に `fromX/fromY` を持たせる**

`src/scenes/field-scene.js` の followers 構築ループ（現在1627-1634行）：

```javascript
      var party = (state && state.party) || [];
      var followers = [];
      for (var fi = 1; fi < party.length; fi++) {
        followers.push({
          id: party[fi].id,
          x: px, y: py, facing: 'down',
          isMonster: party[fi].isMonster,
          baseId: party[fi].baseId,
        });
      }
```

push するオブジェクトに `fromX`/`fromY` を追加：

```javascript
      var party = (state && state.party) || [];
      var followers = [];
      for (var fi = 1; fi < party.length; fi++) {
        followers.push({
          id: party[fi].id,
          x: px, y: py, facing: 'down',
          fromX: px, fromY: py, // 弾7-①：描画補間用の移動元マス
          isMonster: party[fi].isMonster,
          baseId: party[fi].baseId,
        });
      }
```

- [ ] **Step 8: `_stepLeaderTo` で移動元を記録＆補間開始**

`src/scenes/field-scene.js` の `_stepLeaderTo(nx, ny, dir)`（現在2092-2107行）。現状：

```javascript
      function _stepLeaderTo(nx, ny, dir) {
        for (var k = followers.length - 1; k >= 1; k--) {
          followers[k].x = followers[k - 1].x;
          followers[k].y = followers[k - 1].y;
          followers[k].facing = followers[k - 1].facing;
        }
        if (followers.length > 0) {
          followers[0].x = px;
          followers[0].y = py;
          followers[0].facing = dir;
        }
        px = nx; py = ny;
        state.position.x = px;
        state.position.y = py;
        moveTimer = STEP_TIME;
      }
```

隊列シフトの**前に**各 follower の現在マスを `fromX/fromY` へ退避し、`px = nx` の**前に**リーダーの移動元と `moveProg=0` をセット：

```javascript
      function _stepLeaderTo(nx, ny, dir) {
        // 弾7-①：シフト前に各仲間の現在マスを移動元として退避（このマスから次マスへ lerp する）
        for (var f = 0; f < followers.length; f++) {
          followers[f].fromX = followers[f].x;
          followers[f].fromY = followers[f].y;
        }
        for (var k = followers.length - 1; k >= 1; k--) {
          followers[k].x = followers[k - 1].x;
          followers[k].y = followers[k - 1].y;
          followers[k].facing = followers[k - 1].facing;
        }
        if (followers.length > 0) {
          followers[0].x = px;
          followers[0].y = py;
          followers[0].facing = dir;
        }
        // 弾7-①：リーダーの移動元＝旧px/py。ここから nx/ny へ補間する。
        moveFromX = px; moveFromY = py; moveProg = 0;
        px = nx; py = ny;
        state.position.x = px;
        state.position.y = py;
        moveTimer = STEP_TIME;
      }
```

- [ ] **Step 9: `_setLeaderPos`（ワープ）は補間なしで即描画**

`src/scenes/field-scene.js` の `_setLeaderPos(nx, ny)`（現在2111-2118行）。現状：

```javascript
      function _setLeaderPos(nx, ny) {
        px = nx; py = ny;
        for (var k = 0; k < followers.length; k++) {
          followers[k].x = px;
          followers[k].y = py;
          followers[k].facing = facing;
        }
        state.position.x = px;
        state.position.y = py;
      }
```

follower の `fromX/fromY` も新座標に合わせ、`moveProg=1`（補間なし＝ワープ演出と競合させない）：

```javascript
      function _setLeaderPos(nx, ny) {
        px = nx; py = ny;
        for (var k = 0; k < followers.length; k++) {
          followers[k].x = px;
          followers[k].y = py;
          followers[k].fromX = px; // 弾7-①：ワープは補間なし
          followers[k].fromY = py;
          followers[k].facing = facing;
        }
        // 弾7-①：ワープは即座に到達済み扱い（moveProg=1）
        moveFromX = px; moveFromY = py; moveProg = 1;
        state.position.x = px;
        state.position.y = py;
      }
```

- [ ] **Step 10: `update` で `moveProg` を進める**

`src/scenes/field-scene.js` の `update` 内、moveTimer 減算（現在2228-2229行）：

```javascript
        moveTimer -= dt;
        if (moveTimer < 0) moveTimer = 0;
```

の直後に追加：

```javascript
        // 弾7-①：移動補間を進める（STEP_TIME で 0→1）
        if (moveProg < 1) {
          moveProg += dt / STEP_TIME;
          if (moveProg > 1) moveProg = 1;
        }
```

- [ ] **Step 11: カメラを表示座標（renderX/renderY）基準にする**

`src/scenes/field-scene.js` の `draw` 内カメラ計算（現在2301-2304行）：

```javascript
        var cols = map.grid[0].length, rows = map.grid.length;
        var mapW = cols * TS, mapH = rows * TS;
        var offX = clampCamera(Math.round(VW / 2 - (px * TS + TS / 2)), VW, mapW);
        var offY = clampCamera(Math.round(VH / 2 - (py * TS + TS / 2)), VH, mapH);
```

を、補間表示座標を計算して `renderX/renderY` を使うよう変更：

```javascript
        var cols = map.grid[0].length, rows = map.grid.length;
        var mapW = cols * TS, mapH = rows * TS;
        // 弾7-①：表示座標＝移動元→現在マスの補間。カメラ・キャラ描画はこれを使う。
        var _rt = stepEase(moveProg);
        var renderX = lerp(moveFromX, px, _rt);
        var renderY = lerp(moveFromY, py, _rt);
        var offX = clampCamera(Math.round(VW / 2 - (renderX * TS + TS / 2)), VW, mapW);
        var offY = clampCamera(Math.round(VH / 2 - (renderY * TS + TS / 2)), VH, mapH);
```

- [ ] **Step 12: actors に表示座標（rx/ry）を持たせる**

`src/scenes/field-scene.js` の actors 構築（現在2433-2445行）。followers の push（2436-2439）とリーダーの push（2441-2445）に `rx`/`ry` を追加。現状：

```javascript
        for (var ai = followers.length - 1; ai >= 0; ai--) {
          var fo = followers[ai];
          actors.push({ id: fo.id, x: fo.x, y: fo.y, facing: fo.facing, isLeader: false, isMonster: fo.isMonster, baseId: fo.baseId });
        }
        actors.push({ id: (party[0] && party[0].id) || 'yuito', x: px, y: py, facing: facing, isLeader: true, isMonster: party[0] && party[0].isMonster, baseId: party[0] && party[0].baseId });
```

（※上記は要旨。実ファイルの該当プロパティ列にそれぞれ追記する）。各 follower は自分の `fromX/fromY→x/y` を同じ `_rt` で lerp、リーダーは `renderX/renderY`：

```javascript
        for (var ai = followers.length - 1; ai >= 0; ai--) {
          var fo = followers[ai];
          actors.push({
            id: fo.id, x: fo.x, y: fo.y, facing: fo.facing,
            rx: lerp(fo.fromX, fo.x, _rt), ry: lerp(fo.fromY, fo.y, _rt), // 弾7-①
            isLeader: false, isMonster: fo.isMonster, baseId: fo.baseId,
          });
        }
        actors.push({
          id: (party[0] && party[0].id) || 'yuito', x: px, y: py, facing: facing,
          rx: renderX, ry: renderY, // 弾7-①
          isLeader: true, isMonster: party[0] && party[0].isMonster, baseId: party[0] && party[0].baseId,
        });
```

**注意：** actors の Y ソート（現在2460-2466行）は**整数 `a.y` のまま**。描画位置だけ rx/ry を使い、重なり順は整数で安定させる（チラつき防止）。

- [ ] **Step 13: キャラ描画とドットフォールバックで rx/ry を使う**

`src/scenes/field-scene.js` の描画ループ（現在2469-2517行）。キャラクター経路の直前で表示座標を確定させ、キャラ描画とドットフォールバックだけ `_ax/_ay` を使う。**オブジェクト（宝箱・NPC等）とpushball は `act.x/act.y` のまま**（整数マス固定物なので補間不要）。

キャラクター描画部（現在2487-2489行）の直前に：

```javascript
          // 弾7-①：キャラは補間表示座標を使う（無い actor は整数マスにフォールバック）
          var _ax = (act.rx !== undefined) ? act.rx : act.x;
          var _ay = (act.ry !== undefined) ? act.ry : act.y;
```

そしてキャラ経路（2487-2489）：

```javascript
          var footCX = offX + act.x * TS + TS / 2;
          var footBottom = offY + act.y * TS + TS;
          S.drawShadow(ctx, footCX, offY + act.y * TS + TS - 3, act.isLeader ? 11 : 10, 4);
```

を：

```javascript
          var footCX = offX + _ax * TS + TS / 2;
          var footBottom = offY + _ay * TS + TS;
          S.drawShadow(ctx, footCX, offY + _ay * TS + TS - 3, act.isLeader ? 11 : 10, 4);
```

（この経路内で以降 `act.x`/`act.y` を使ってスプライトを配置している箇所も同様に `_ax`/`_ay` に置換する。）

ドットフォールバック（現在2513-2516行）：

```javascript
          if (!drew) {
            var dotSp = S.SPRITES[act.id] || S.SPRITES.yuito;
            S.drawSprite(ctx, dotSp, offX + act.x * TS, offY + act.y * TS, 1);
          }
```

を：

```javascript
          if (!drew) {
            var dotSp = S.SPRITES[act.id] || S.SPRITES.yuito;
            S.drawSprite(ctx, dotSp, offX + _ax * TS, offY + _ay * TS, 1);
          }
```

- [ ] **Step 14: ビルド＆全テスト**

Run:
```bash
node build.js && wc -c index.html && md5 -q index.html && node --test
```
Expected: ビルド成功、全テスト PASS（`smooth-scroll` 8件を含む）、0 fail。

- [ ] **Step 15: 実機目視（黒画面＝衝突チェック）**

preview で built `index.html` をロード：
```
preview_list → serverId 取得（server名 srpg-dev）
preview_eval expression: "location.href='http://localhost:5599/index.html'; 'nav'"
```
- 黒画面でないこと（＝バンドル衝突なし）。
- はじめから／続きから でフィールドに入り、方向キーで歩くとユイトが画面中央付近に留まりつつ周りのマップが**カクッではなくヌルッと**スクロールすること。
- 隊列4人も滑らかに続くこと。壁ドン・宝箱・ワープ・エンカウントが従来通り動くこと。
- スクリーンショットをげんちゃんに提示。

- [ ] **Step 16: コミット**

```bash
git add tests/smooth-scroll.test.js src/scenes/field-scene.js index.html
git commit -m "$(cat <<'EOF'
feat(map): 機能① スムーズスクロール（歩行の補間表示）

- lerp/stepEase 純粋関数を追加（node --test 8件）
- px/py は整数マス維持、描画専用に moveFromX/Y・moveProg を追加
- カメラ・隊列・キャラ描画を補間表示座標(renderX/rx)基準に変更
- 当たり判定/エンカウント/ワープ/隊列ロジックは無改造

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 機能② 🧭 ミニマップ（画面右上に常時）

`draw` の最終段でオーバーレイ描画。地形は「歩ける床＝薄色／通れない＝濃色」に粗く丸め、隠し通路（`secret:true`＝H）は**壁扱い**にして探索の楽しみを守る。自分＝点滅する光点、出口＝黄色マーカー。暗闇マップ（`map.dark`）でも自分と出口だけは出す。

**Files:**
- Create: `tests/minimap.test.js`
- Modify: `src/scenes/field-scene.js`（純粋関数 `minimapCell` をトップレベル追加＋UMDエクスポート、描画関数 `_drawMinimap` をトップレベル追加、`draw` 最終段で呼び出し）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/minimap.test.js`:

```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { minimapCell } = require('../src/scenes/field-scene.js');

// テスト専用のモック凡例（実データに依存しない）
const LEGEND = {
  '.': { walkable: true },
  '#': { walkable: false },
  '~': { walkable: false },
  'H': { walkable: true, secret: true }, // 隠し通路
};

const GRID = [
  '###',
  '#.#',
  '#H#',
];

test('歩けるタイルは floor', () => {
  assert.strictEqual(minimapCell(GRID, 1, 1, LEGEND), 'floor');
});

test('壁は wall', () => {
  assert.strictEqual(minimapCell(GRID, 0, 0, LEGEND), 'wall');
});

test('隠し通路(secret)は壁として丸める（露出しない）', () => {
  assert.strictEqual(minimapCell(GRID, 1, 2, LEGEND), 'wall');
});

test('範囲外(x<0)は wall', () => {
  assert.strictEqual(minimapCell(GRID, -1, 1, LEGEND), 'wall');
});

test('範囲外(y>=rows)は wall', () => {
  assert.strictEqual(minimapCell(GRID, 1, 99, LEGEND), 'wall');
});

test('凡例に無い文字は wall（安全側）', () => {
  assert.strictEqual(minimapCell(['?'], 0, 0, LEGEND), 'wall');
});

test('grid が空/未定義でも落ちず wall', () => {
  assert.strictEqual(minimapCell(null, 0, 0, LEGEND), 'wall');
  assert.strictEqual(minimapCell([], 0, 0, LEGEND), 'wall');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/minimap.test.js
```
Expected: FAIL（`minimapCell` が undefined）。

- [ ] **Step 3: `minimapCell` をトップレベル追加**

`src/scenes/field-scene.js` の Task 1 で追加した `stepEase` の直後（`_drawObjectiveBar` 以降の純粋関数ブロック内）に挿入：

```javascript
// ── 弾7-②：ミニマップ用の地形分類（純粋関数） ──
// 生タイルを 'floor'（歩ける）/'wall'（通れない）に粗く丸める。
// secret:true（隠し通路 H など）は wall 扱い＝ミニマップに隠し要素を露出しない。
function minimapCell(grid, x, y, legend) {
  if (!grid || y < 0 || y >= grid.length) return 'wall';
  var row = grid[y];
  if (!row || x < 0 || x >= row.length) return 'wall';
  var ch = row.charAt(x);
  var def = legend && legend[ch];
  if (!def) return 'wall';
  if (def.secret === true) return 'wall';
  if (def.walkable === true) return 'floor';
  return 'wall';
}
```

- [ ] **Step 4: UMD エクスポートに追加**

`src/scenes/field-scene.js` の UMD エクスポートオブジェクトに追加：

```javascript
  minimapCell:      minimapCell,
```

- [ ] **Step 5: テストが通ることを確認**

Run:
```bash
node --test tests/minimap.test.js
```
Expected: PASS（7 tests）。

- [ ] **Step 6: `_drawMinimap` 描画関数をトップレベル追加**

`src/scenes/field-scene.js` の `minimapCell` の直後に挿入。位置は画面右上。凡例は実行時 `S.TILE_LEGEND` を使う。`phase` は点滅用に呼び出し側から `_gfx` を渡す（`_gfx` はクロージャ内なのでトップレベルから参照不可のため引数化）。`y0` は上部の目標バー/ネームプレートを避けるオフセット：

```javascript
// ── 弾7-②：ミニマップ描画（画面右上・常時オーバーレイ） ──
// 地形=粗い点（floor薄/wall濃）、出口=黄マーカー、自分=点滅する赤点。
// 暗闇マップ(map.dark)は地形を伏せて自分と出口のみ（迷子防止優先）。
// phase: 点滅アニメ用位相（呼び出し側の _gfx を渡す）。y0: パネル上端Y。
function _drawMinimap(ctx, S, map, px, py, VW, phase, y0) {
  if (!map || !map.grid || !map.grid.length) return;
  var legend = S.TILE_LEGEND || {};
  var cols = map.grid[0].length, rows = map.grid.length;
  var MAXW = 66, MAXH = 66, PAD = 4;
  var cell = Math.max(1, Math.floor(Math.min(MAXW / cols, MAXH / rows)));
  var innerW = cols * cell, innerH = rows * cell;
  var panelW = innerW + PAD * 2, panelH = innerH + PAD * 2;
  var x0 = VW - panelW - 6;
  var top = y0;
  // パネル枠
  S.drawWindow(ctx, x0, top, panelW, panelH, { radius: 6, border: '#8fd0ff' });
  var gx = x0 + PAD, gy = top + PAD;
  var dark = !!map.dark;
  // 地形
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      var kind = minimapCell(map.grid, x, y, legend);
      if (dark) {
        ctx.fillStyle = 'rgba(20,24,38,0.75)';
      } else if (kind === 'floor') {
        ctx.fillStyle = 'rgba(150,180,120,0.55)';
      } else {
        ctx.fillStyle = 'rgba(40,50,70,0.70)';
      }
      ctx.fillRect(gx + x * cell, gy + y * cell, cell, cell);
    }
  }
  // 出口（黄マーカー）
  if (map.exits && map.exits.length) {
    ctx.fillStyle = '#ffd34d';
    for (var e = 0; e < map.exits.length; e++) {
      var ex = map.exits[e];
      if (ex == null || ex.x == null || ex.y == null) continue;
      ctx.fillRect(gx + ex.x * cell, gy + ex.y * cell, Math.max(2, cell), Math.max(2, cell));
    }
  }
  // 自分（点滅する赤点）
  var blink = 0.5 + 0.5 * Math.sin((phase || 0) * 3);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * blink;
  ctx.fillStyle = '#ff5d5d';
  var selfSize = Math.max(3, cell + 1);
  ctx.fillRect(gx + px * cell - (selfSize - cell) / 2, gy + py * cell - (selfSize - cell) / 2, selfSize, selfSize);
  ctx.restore();
}
```

- [ ] **Step 7: `draw` 最終段でミニマップを呼ぶ**

`src/scenes/field-scene.js` の `draw` の目標バー描画ブロック（現在2570-2574行）の直後、`draw` を閉じる `},`（現在2575行）の**直前**に挿入。`_ob` は同ブロックで `var` 宣言済み＝draw 関数スコープにホイストされ、ここで参照可能：

```javascript
      // 9. 弾7-②：ミニマップ（右上・常時）。目標バーがある時は下にずらす。
      var _mmY0 = (typeof _ob !== 'undefined' && _ob && _ob.bar) ? 58 : 6;
      _drawMinimap(ctx, S, map, px, py, VW, _gfx, _mmY0);
```

（`MAXW=66` なので `x0 = VW - (66+8) - 6 = 288-80 = 208`。ネームプレート右端 x=204 を確実に避ける。）

- [ ] **Step 8: ビルド＆全テスト**

Run:
```bash
node build.js && wc -c index.html && md5 -q index.html && node --test
```
Expected: ビルド成功、全テスト PASS（`minimap` 7件を含む）、0 fail。

- [ ] **Step 9: 実機目視**

preview で built `index.html`（`http://localhost:5599/index.html`）を再ロード：
- 黒画面でないこと。
- 全マップ（草原・町・洞窟・氷の塔など）で右上にミニマップが出て、自分（赤・点滅）と出口（黄）の位置が分かること。
- 隠し通路（H を持つマップ＝ほのおの どうくつ cave1 等）でミニマップに隠し通路が**壁として**表示され露出しないこと。
- 暗闇マップ（cave1 は dark）で地形が伏せられ自分と出口だけ出ること。
- village1（22×20 の大きいマップ）でもパネル内に収まること。
- スクリーンショットをげんちゃんに提示。

- [ ] **Step 10: コミット**

```bash
git add tests/minimap.test.js src/scenes/field-scene.js index.html
git commit -m "$(cat <<'EOF'
feat(map): 機能② ミニマップ（右上常時オーバーレイ）

- minimapCell 純粋関数（secret→wall で隠し通路を露出しない・node --test 7件）
- _drawMinimap で地形/出口/自分を描画、暗闇マップは自分と出口のみ
- draw 最終段で呼び出し、目標バー有無で上端オフセット切替

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 機能③ 🩧 行き先看板（迷子防止）

出口マスの1〜2マス以内に来たら画面下部に「→ ○○へ」を自動表示。行き先名は `exit.to` → `S.MAPS[to].name` から実行時に引く（**ハードコード禁止**＝捏造防止）。離れたら消える。

> **げんちゃん要望②（水の洞窟が見つけにくい）への効き目:** `nearestExitLabel` は `map.exits` を**全件**走査するため、本線・寄り道の区別なくすべての出口を看板化する。町2（フォレストタウン）の岩場(2,16)にある `cave_water_1f` への出口も、近づけば自動で「→ みずの どうくつへ」と表示される＝ルートは元々存在するのに気づけなかった問題（＝バグではなくUX）を、この機能とミニマップ（機能②）・世界地図（機能④）で表面化させて解消する。追加のマップ編集は不要。

**Files:**
- Create: `tests/exit-signpost.test.js`
- Modify: `src/scenes/field-scene.js`（純粋関数 `nearestExitLabel` をトップレベル追加＋UMDエクスポート、描画関数 `_drawSignpost` をトップレベル追加、`draw` 最終段で呼び出し）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/exit-signpost.test.js`:

```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { nearestExitLabel } = require('../src/scenes/field-scene.js');

// モックのマップ辞書（実データに依存しない）
const MAPS = {
  town1: { name: 'ハーバータウン' },
  cave1: { name: 'ほのおの どうくつ' },
};

test('半径内の出口名を返す', () => {
  const map = { exits: [{ x: 5, y: 5, to: 'town1' }] };
  assert.strictEqual(nearestExitLabel(map, 5, 6, 2, MAPS), '→ ハーバータウンへ');
});

test('半径外なら null', () => {
  const map = { exits: [{ x: 5, y: 5, to: 'town1' }] };
  assert.strictEqual(nearestExitLabel(map, 0, 0, 2, MAPS), null);
});

test('複数出口では最寄りを返す', () => {
  const map = { exits: [
    { x: 0, y: 0, to: 'cave1' },
    { x: 5, y: 5, to: 'town1' },
  ] };
  assert.strictEqual(nearestExitLabel(map, 5, 5, 2, MAPS), '→ ハーバータウンへ');
});

test('マップ辞書に無い to は to をそのまま名前に使う', () => {
  const map = { exits: [{ x: 1, y: 1, to: 'field9' }] };
  assert.strictEqual(nearestExitLabel(map, 1, 1, 2, MAPS), '→ field9へ');
});

test('exits が無い/空なら null', () => {
  assert.strictEqual(nearestExitLabel({ exits: [] }, 1, 1, 2, MAPS), null);
  assert.strictEqual(nearestExitLabel({}, 1, 1, 2, MAPS), null);
  assert.strictEqual(nearestExitLabel(null, 1, 1, 2, MAPS), null);
});

test('座標欠損の出口はスキップ', () => {
  const map = { exits: [{ to: 'town1' }, { x: 3, y: 3, to: 'cave1' }] };
  assert.strictEqual(nearestExitLabel(map, 3, 3, 2, MAPS), '→ ほのおの どうくつへ');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/exit-signpost.test.js
```
Expected: FAIL（`nearestExitLabel` が undefined）。

- [ ] **Step 3: `nearestExitLabel` をトップレベル追加**

`src/scenes/field-scene.js` の純粋関数ブロック（`minimapCell` の直後）に挿入：

```javascript
// ── 弾7-③：行き先看板用の最寄り出口判定（純粋関数） ──
// px,py から radius マス以内で最も近い出口の案内文を返す。範囲外は null。
// 行き先名は mapsById[to].name から引く（無ければ to をそのまま）。
function nearestExitLabel(map, px, py, radius, mapsById) {
  if (!map || !map.exits || !map.exits.length) return null;
  var best = null, bestD = Infinity;
  for (var i = 0; i < map.exits.length; i++) {
    var ex = map.exits[i];
    if (ex == null || ex.x == null || ex.y == null) continue;
    var d = Math.abs(ex.x - px) + Math.abs(ex.y - py); // マンハッタン距離
    if (d <= radius && d < bestD) { bestD = d; best = ex; }
  }
  if (!best) return null;
  var dest = mapsById && mapsById[best.to];
  var name = (dest && dest.name) || best.to;
  return '→ ' + name + 'へ';
}
```

- [ ] **Step 4: UMD エクスポートに追加**

`src/scenes/field-scene.js` の UMD エクスポートオブジェクトに追加：

```javascript
  nearestExitLabel: nearestExitLabel,
```

- [ ] **Step 5: テストが通ることを確認**

Run:
```bash
node --test tests/exit-signpost.test.js
```
Expected: PASS（6 tests）。

- [ ] **Step 6: `_drawSignpost` 描画関数をトップレベル追加**

`src/scenes/field-scene.js` の `nearestExitLabel` の直後に挿入。画面下部中央の緑バー：

```javascript
// ── 弾7-③：行き先看板の描画（画面下部・出口接近時のみ） ──
function _drawSignpost(ctx, S, text, VW, VH) {
  if (!text) return;
  var w = 200, h = 24;
  var x = VW / 2 - w / 2, y = VH - h - 10;
  S.drawWindow(ctx, x, y, w, h, { radius: 8, border: '#7cf29b' });
  S.drawText(ctx, text, VW / 2, y + 6, { size: 12, color: '#c8f7d4', align: 'center' });
}
```

- [ ] **Step 7: `draw` 最終段で看板を呼ぶ**

`src/scenes/field-scene.js` の `draw` 内、Task 2 で追加したミニマップ呼び出しの直後（`draw` を閉じる `},` の直前）に挿入：

```javascript
      // 10. 弾7-③：行き先看板（出口に近づいたら下部に「→ ○○へ」）
      if (typeof nearestExitLabel === 'function' && S.MAPS) {
        var _sign = nearestExitLabel(map, px, py, 2, S.MAPS);
        if (_sign) _drawSignpost(ctx, S, _sign, VW, VH);
      }
```

- [ ] **Step 8: ビルド＆全テスト**

Run:
```bash
node build.js && wc -c index.html && md5 -q index.html && node --test
```
Expected: ビルド成功、全テスト PASS（`exit-signpost` 6件を含む）、0 fail。

- [ ] **Step 9: 実機目視**

preview で built `index.html`（`http://localhost:5599/index.html`）を再ロード：
- 黒画面でないこと。
- 草原（field1）で町（town1）の出口に近づくと下部に「→ ハーバータウンへ」が出て、離れると消えること。
- 行き先名が実マップ名と一致すること（＝`S.MAPS[to].name` から取れている）。
- スクリーンショットをげんちゃんに提示。

- [ ] **Step 10: コミット**

```bash
git add tests/exit-signpost.test.js src/scenes/field-scene.js index.html
git commit -m "$(cat <<'EOF'
feat(map): 機能③ 行き先看板（出口接近時に「→ ○○へ」）

- nearestExitLabel 純粋関数（マンハッタン距離・最寄り優先・node --test 6件）
- 行き先名は S.MAPS[to].name を実行時参照（ハードコードしない）
- _drawSignpost で画面下部に表示、離れると消える

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 機能④ 🗺️ 世界地図画面（メニューから）

メニューに「せかいちず」を追加。静的な世界地図ノードデータ（町・フィールド・ダンジョン入口。ダンジョン各階は入口1ノードに集約）を定義し、訪問済み（`state.visited`）だけ表示、未訪問はモヤ、現在地は光点。マップ移動確定時に `state.visited[map.id]=true`。表示名は必ず実行時 `S.MAPS[id].name` から引く。

**Files:**
- Create: `tests/worldmap.test.js`
- Modify: `src/scenes/menu-scene.js`（`WORLD_MAP_NODES`/`WORLD_MAP_LINKS`/`visibleWorldNodes`/`fastTravelTowns` をトップレベル追加＋UMDエクスポート、`buildMain` に項目追加、`buildWorld`/`drawWorldPanel` 追加、`enter`/`onCancel`/`onConfirm`/`draw` に world モード配線）
- Modify: `src/scenes/field-scene.js`（`createFieldScene` 冒頭で `state.visited` 記録）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/worldmap.test.js`:

```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { WORLD_MAP_NODES, visibleWorldNodes, fastTravelTowns } = require('../src/scenes/menu-scene.js');

test('WORLD_MAP_NODES が配列で主要ノードを含む', () => {
  assert.ok(Array.isArray(WORLD_MAP_NODES));
  assert.ok(WORLD_MAP_NODES.length >= 10);
  const ids = WORLD_MAP_NODES.map(n => n.id);
  ['field1', 'town1', 'cave1', 'tower_ice', 'shrine_forest', 'cave_water', 'town2', 'town3', 'ch2_town'].forEach(id => {
    assert.ok(ids.indexOf(id) >= 0, 'ノード欠落: ' + id);
  });
});

test('各ノードは maps 配列を持ち、normalized 座標を持つ', () => {
  WORLD_MAP_NODES.forEach(n => {
    assert.ok(Array.isArray(n.maps) && n.maps.length >= 1, 'maps 欠落: ' + n.id);
    assert.ok(typeof n.x === 'number' && n.x >= 0 && n.x <= 1, 'x 範囲外: ' + n.id);
    assert.ok(typeof n.y === 'number' && n.y >= 0 && n.y <= 1, 'y 範囲外: ' + n.id);
    assert.ok(['town', 'field', 'dungeon'].indexOf(n.type) >= 0, 'type 不正: ' + n.id);
  });
});

test('ダンジョンノードは各階を maps に集約する', () => {
  const tower = WORLD_MAP_NODES.find(n => n.id === 'tower_ice');
  assert.deepStrictEqual(tower.maps, ['tower_ice_1f', 'tower_ice_2f', 'tower_ice_3f']);
});

test('町ノードは warp 座標を持つ', () => {
  WORLD_MAP_NODES.filter(n => n.type === 'town').forEach(n => {
    assert.ok(n.warp && typeof n.warp.x === 'number' && typeof n.warp.y === 'number', 'warp 欠落: ' + n.id);
  });
});

test('visibleWorldNodes: 訪問済みマップを含むノードだけ返す', () => {
  const visited = { field1: true };
  const vis = visibleWorldNodes(WORLD_MAP_NODES, visited);
  assert.ok(vis.some(n => n.id === 'field1'));
  assert.ok(!vis.some(n => n.id === 'ch2_castle'));
});

test('visibleWorldNodes: visited 未定義でも落ちず空配列', () => {
  assert.deepStrictEqual(visibleWorldNodes(WORLD_MAP_NODES, undefined), []);
  assert.deepStrictEqual(visibleWorldNodes(WORLD_MAP_NODES, {}), []);
});

test('fastTravelTowns: 訪問済みの町ノードだけ返す', () => {
  const visited = { town1: true, field1: true };
  const towns = fastTravelTowns(WORLD_MAP_NODES, visited);
  assert.ok(towns.every(n => n.type === 'town' && n.warp));
  assert.ok(towns.some(n => n.id === 'town1'));
  assert.ok(!towns.some(n => n.id === 'field1')); // field は町でない
});

test('fastTravelTowns: ダンジョンのある階を1つでも踏めば入口ノード可視', () => {
  const vis = visibleWorldNodes(WORLD_MAP_NODES, { tower_ice_2f: true });
  assert.ok(vis.some(n => n.id === 'tower_ice'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/worldmap.test.js
```
Expected: FAIL（`WORLD_MAP_NODES` 等が undefined）。

- [ ] **Step 3: 世界地図データ＋純粋関数をトップレベル追加**

`src/scenes/menu-scene.js` の先頭（`createMenuScene` の定義より前、ファイル冒頭のヘッダコメント直後）に挿入。座標は概略の配置（正確な地理でなく分かりやすさ優先）。`label` はフォールバック用で、表示は実行時 `S.MAPS[id].name`：

```javascript
// ── 弾7-④：世界地図の静的レイアウトデータ（読み取り専用） ──
// x,y は 0..1 の正規化座標。maps は実マップID（ダンジョンは各階を集約）。
// warp は町のファストトラベル到着マス。label は S.MAPS が無い時のフォールバック名。
var WORLD_MAP_NODES = [
  { id: 'field1',        label: 'はじまりの草原',   type: 'field',   x: 0.14, y: 0.30, maps: ['field1'] },
  { id: 'town1',         label: 'ハーバータウン',   type: 'town',    x: 0.28, y: 0.22, maps: ['town1'], warp: { x: 7, y: 2 } },
  { id: 'field2',        label: 'ナイタースタジアム', type: 'field', x: 0.30, y: 0.45, maps: ['field2'] },
  { id: 'village1',      label: 'みのりの村',       type: 'town',    x: 0.16, y: 0.55, maps: ['village1'], warp: { x: 10, y: 1 } },
  { id: 'cave1',         label: 'ほのおの どうくつ', type: 'dungeon', x: 0.40, y: 0.60, maps: ['cave1'] },
  { id: 'field3',        label: 'サンドコート',     type: 'field',   x: 0.46, y: 0.30, maps: ['field3'] },
  { id: 'tower_ice',     label: 'こおりの とう',    type: 'dungeon', x: 0.55, y: 0.18, maps: ['tower_ice_1f', 'tower_ice_2f', 'tower_ice_3f'] },
  { id: 'field4',        label: 'レイニーピッチ',   type: 'field',   x: 0.58, y: 0.42, maps: ['field4'] },
  { id: 'shrine_forest', label: 'もりの しんでん',  type: 'dungeon', x: 0.50, y: 0.72, maps: ['shrine_forest_1f', 'shrine_forest_2f', 'shrine_forest_3f'] },
  { id: 'town2',         label: 'フォレストタウン', type: 'town',    x: 0.62, y: 0.62, maps: ['town2'], warp: { x: 7, y: 2 } },
  { id: 'cave_water',    label: 'みずの どうくつ',  type: 'dungeon', x: 0.72, y: 0.55, maps: ['cave_water_1f', 'cave_water_2f', 'cave_water_3f'] },
  { id: 'field5',        label: 'スカイスタジアム', type: 'field',   x: 0.70, y: 0.30, maps: ['field5'] },
  { id: 'town3',         label: 'クラウドタウン',   type: 'town',    x: 0.78, y: 0.20, maps: ['town3'], warp: { x: 7, y: 2 } },
  { id: 'ch2_gate',      label: 'やみの もん',      type: 'field',   x: 0.82, y: 0.42, maps: ['ch2_gate'] },
  { id: 'ch2_town',      label: 'ノルドタウン',     type: 'town',    x: 0.88, y: 0.55, maps: ['ch2_town'], warp: { x: 14, y: 9 } },
  { id: 'ch2_pass',      label: 'こおりの とうげ',  type: 'field',   x: 0.86, y: 0.72, maps: ['ch2_pass'] },
  { id: 'field6',        label: 'ダークアリーナ',   type: 'field',   x: 0.92, y: 0.34, maps: ['field6'] },
  { id: 'ch2_castle',    label: 'やみのしろ',       type: 'dungeon', x: 0.94, y: 0.82, maps: ['ch2_castle'] },
];

// 主要ノード間の繋がり（世界地図の連絡線。概略・見た目用）
var WORLD_MAP_LINKS = [
  ['field1', 'town1'], ['field1', 'field2'], ['field2', 'village1'], ['field2', 'field3'],
  ['field3', 'cave1'], ['field3', 'tower_ice'], ['tower_ice', 'field4'], ['field4', 'shrine_forest'],
  ['shrine_forest', 'town2'], ['town2', 'cave_water'], ['town2', 'field5'], ['field5', 'town3'],
  ['town3', 'ch2_gate'], ['ch2_gate', 'ch2_town'], ['ch2_town', 'ch2_pass'], ['ch2_gate', 'field6'],
  ['ch2_pass', 'ch2_castle'],
];

// 訪問済みマップを1つでも含むノードだけ返す（未訪問はモヤ用に除外）。
function visibleWorldNodes(nodes, visited) {
  var v = visited || {};
  return (nodes || []).filter(function (n) {
    return n.maps && n.maps.some(function (m) { return !!v[m]; });
  });
}

// ファストトラベル可能な「訪問済みの町」ノードだけ返す。
function fastTravelTowns(nodes, visited) {
  var v = visited || {};
  return (nodes || []).filter(function (n) {
    return n.type === 'town' && n.warp && n.maps.some(function (m) { return !!v[m]; });
  });
}
```

- [ ] **Step 4: UMD エクスポートに追加**

`src/scenes/menu-scene.js` の UMD 末尾（現在758-764行）のエクスポートオブジェクトに追加。現状：

```javascript
})(typeof window !== 'undefined' ? window : globalThis, {
  createMenuScene: createMenuScene,
});
```

を：

```javascript
})(typeof window !== 'undefined' ? window : globalThis, {
  createMenuScene: createMenuScene,
  WORLD_MAP_NODES: WORLD_MAP_NODES,
  WORLD_MAP_LINKS: WORLD_MAP_LINKS,
  visibleWorldNodes: visibleWorldNodes,
  fastTravelTowns: fastTravelTowns,
});
```

- [ ] **Step 5: テストが通ることを確認**

Run:
```bash
node --test tests/worldmap.test.js
```
Expected: PASS（8 tests）。

- [ ] **Step 6: `createFieldScene` 冒頭で訪問記録**

`src/scenes/field-scene.js` の `map` 構築（現在1600行 `var map = _withActiveNpcs(rawMap, ...)`）の直後に挿入。全てのマップ入場（exits/warp/ファストトラベル/ロード）がここを通るので、1か所で網羅：

```javascript
      // 弾7-④：訪問記録（世界地図・ファストトラベルの解禁判定に使う）。古いセーブは || {} で初期化。
      state.visited = state.visited || {};
      if (pos && pos.map) state.visited[pos.map] = true;
```

- [ ] **Step 7: メニューに「せかいちず」項目を追加**

`src/scenes/menu-scene.js` の `buildMain()`（現在65-79行）のリストに項目追加。`'じっせき'` の後あたり（`'しょうごう'` の前）に：

```javascript
    { label: 'せかいちず', v: 'world' },
```

- [ ] **Step 8: `enter`/`onCancel` に world モード配線**

`src/scenes/menu-scene.js` の `enter(m)`（現在314-326行）の `else if` チェーンに追加：

```javascript
    else if (m === 'world') buildWorld();
```

`onCancel()`（現在328-343行）の switch に追加（世界地図から戻るとメインメニューへ）：

```javascript
      case 'world': enter('main'); break;
```

- [ ] **Step 9: `buildWorld`／`drawWorldPanel` を追加**

`src/scenes/menu-scene.js` の `drawListPanel`（現在478-500行）の直後に、`createMenuScene` クロージャ内の関数として追加。`buildWorld` はファストトラベル可能な町リストと未訪問町（？？？）を `listCache` に積む。`drawWorldPanel` は2Dノード図＋町リストを描く。表示名は実行時 `S.MAPS[id].name`：

```javascript
    // ── 弾7-④：世界地図モード ──
    function worldNodeName(node) {
      return (S && S.MAPS && S.MAPS[node.maps[0]] && S.MAPS[node.maps[0]].name) || node.label;
    }
    function buildWorld() {
      mode = 'world';
      cursor = 0;
      var visited = (state && state.visited) || {};
      var towns = WORLD_MAP_NODES.filter(function (n) { return n.type === 'town' && n.warp; });
      listCache = towns.map(function (n) {
        var seen = n.maps.some(function (m) { return !!visited[m]; });
        return {
          label: seen ? ('▶ ' + worldNodeName(n)) : '？？？',
          v: 'wt:' + n.id,
          node: n,
          seen: seen,
        };
      });
      listCache.push({ label: 'もどる', v: 'world_back' });
    }
    function drawWorldPanel(ctx) {
      var visited = (state && state.visited) || {};
      var curMap = (state && state.position && state.position.map) || null;
      // 地図エリア（上半分）
      var MX = 24, MY = 34, MW = VW - 48, MH = 150;
      S.drawWindow(ctx, MX, MY, MW, MH, { radius: 10, border: '#5ec8ff' });
      S.drawText(ctx, 'せかいちず', VW / 2, MY - 18, { size: 14, color: '#dff4ff', align: 'center' });
      function nx(n) { return MX + 8 + n.x * (MW - 16); }
      function ny(n) { return MY + 8 + n.y * (MH - 16); }
      // 連絡線（両端が訪問済みノードの時だけ薄く）
      var byId = {};
      for (var i = 0; i < WORLD_MAP_NODES.length; i++) byId[WORLD_MAP_NODES[i].id] = WORLD_MAP_NODES[i];
      ctx.save();
      ctx.strokeStyle = 'rgba(120,160,200,0.35)';
      ctx.lineWidth = 1;
      for (var l = 0; l < WORLD_MAP_LINKS.length; l++) {
        var a = byId[WORLD_MAP_LINKS[l][0]], b = byId[WORLD_MAP_LINKS[l][1]];
        if (!a || !b) continue;
        var aSeen = a.maps.some(function (m) { return !!visited[m]; });
        var bSeen = b.maps.some(function (m) { return !!visited[m]; });
        if (!aSeen || !bSeen) continue;
        ctx.beginPath(); ctx.moveTo(nx(a), ny(a)); ctx.lineTo(nx(b), ny(b)); ctx.stroke();
      }
      ctx.restore();
      // ノード
      var typeColor = { town: '#ffd34d', field: '#8fe0a0', dungeon: '#c98cff' };
      for (var j = 0; j < WORLD_MAP_NODES.length; j++) {
        var n = WORLD_MAP_NODES[j];
        var seen = n.maps.some(function (m) { return !!visited[m]; });
        var cx = nx(n), cy = ny(n);
        var isCur = curMap && n.maps.indexOf(curMap) >= 0;
        if (!seen) {
          // 未訪問＝モヤ（暗い点＋?）
          ctx.fillStyle = 'rgba(60,70,90,0.7)';
          ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
          S.drawText(ctx, '?', cx, cy - 5, { size: 9, color: '#7a86a0', align: 'center' });
          continue;
        }
        if (isCur) {
          // 現在地＝光るリング
          ctx.save();
          ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = typeColor[n.type] || '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
        S.drawText(ctx, worldNodeName(n), cx, cy + 5, { size: 8, color: '#e8f2ff', align: 'center' });
      }
      // 町リスト（下半分・ファストトラベル選択）
      var LY = MY + MH + 8;
      S.drawWindow(ctx, MX, LY, MW, VH - LY - 12, { radius: 8, border: '#5ec8ff' });
      S.drawText(ctx, 'いきたい まちを えらんでね', VW / 2, LY + 6, { size: 10, color: '#bfe6c8', align: 'center' });
      var rowY = LY + 26, rowH = 20;
      for (var r = 0; r < listCache.length; r++) {
        var it = listCache[r];
        var col = (r === cursor) ? '#fff2a0' : (it.seen === false ? '#7a86a0' : '#e8f2ff');
        var pre = (r === cursor) ? '▶ ' : '  ';
        S.drawText(ctx, pre + it.label, MX + 14, rowY + r * rowH, { size: 12, color: col, align: 'left' });
      }
    }
```

- [ ] **Step 10: `onConfirm` に world モード配線（メイン項目＋ファストトラベルは Task 5）**

`src/scenes/menu-scene.js` の `onConfirm(item)` のメイン switch（現在347-370行）に、メインメニューから世界地図を開くケースを追加：

```javascript
        case 'world': enter('world'); break;
```

（ファストトラベル実行の `if (mode === 'world') { ... }` ブロックは Task 5 で追加。この Task では「開いて閉じる」まで。）
また、`onConfirm` 内で world モードの「もどる」だけ先に処理できるよう、メイン switch の後に：

```javascript
      if (mode === 'world') {
        if (item && item.v === 'world_back') { enter('main'); return; }
        return; // ファストトラベルは Task 5 で実装
      }
```

- [ ] **Step 11: `draw` に world モード分岐を追加**

`src/scenes/menu-scene.js` の `draw(ctx)`（現在743-754行）のモード分岐に追加（`else drawListPanel(ctx);` の前）：

```javascript
      else if (mode === 'world') drawWorldPanel(ctx);
```

- [ ] **Step 12: ビルド＆全テスト**

Run:
```bash
node build.js && wc -c index.html && md5 -q index.html && node --test
```
Expected: ビルド成功、全テスト PASS（`worldmap` 8件を含む）、0 fail。

- [ ] **Step 13: 実機目視**

preview で built `index.html`（`http://localhost:5599/index.html`）を再ロード：
- 黒画面でないこと。
- メニューを開き「せかいちず」を選ぶと世界地図が出ること。
- 行った所（例：はじまりの草原・ハーバータウン）だけ色付きで名前が出て、行ってない所は暗い「?」でモヤること。
- 現在地に光るリングが出ること。
- 上下キーで町リストのカーソルが動き、「もどる」でメインメニューに戻れること。
- スクリーンショットをげんちゃんに提示。

- [ ] **Step 14: コミット**

```bash
git add tests/worldmap.test.js src/scenes/menu-scene.js src/scenes/field-scene.js index.html
git commit -m "$(cat <<'EOF'
feat(map): 機能④ 世界地図画面（メニュー「せかいちず」）

- WORLD_MAP_NODES/LINKS 静的データ＋visibleWorldNodes/fastTravelTowns（node --test 8件）
- state.visited を createFieldScene 冒頭で記録（全入場を1か所で網羅）
- drawWorldPanel でノード図＋町リスト、未訪問はモヤ・現在地は光るリング
- 表示名は S.MAPS[id].name を実行時参照（ハードコードしない）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 機能⑤ ✈️ ファストトラベル（世界地図からワープ）

世界地図で訪問済みの「町」ノードを選ぶと、その町の安全マスへワープ。既存のマップ切替機構（position 差し替え＋fieldシーン再生成）を再利用。未訪問町は選べず「まだ いったことが ないよ！」。

**Files:**
- Modify: `src/scenes/menu-scene.js`（`onConfirm` の `if (mode === 'world')` ブロックにファストトラベル実行を実装）

- [ ] **Step 1: ファストトラベル実行を実装**

`src/scenes/menu-scene.js` の `onConfirm` に Task 4-Step 10 で置いた `if (mode === 'world') { ... }` ブロックを、ワープ実行込みに差し替える。現状（Task 4 時点）：

```javascript
      if (mode === 'world') {
        if (item && item.v === 'world_back') { enter('main'); return; }
        return; // ファストトラベルは Task 5 で実装
      }
```

を：

```javascript
      if (mode === 'world') {
        if (item && item.v === 'world_back') { enter('main'); return; }
        if (item && item.node && item.node.warp) {
          // 未訪問の町は行けない
          if (item.seen === false) {
            showMsg(['まだ いったことが ないよ！'], 'world');
            return;
          }
          // 訪問済みの町へファストトラベル：position を差し替えて field シーン再生成
          var node = item.node;
          state.position = state.position || {};
          state.position.map = node.maps[0];
          state.position.x = node.warp.x;
          state.position.y = node.warp.y;
          if (S.playSe) S.playSe('confirm');
          S.popScene();   // メニューを閉じる
          S.replaceScene(S.createFieldScene(state)); // フィールド再生成（冒頭で visited も記録）
          return;
        }
        return;
      }
```

**注意：** `showMsg(pages, after)` はこのシーンの既存メッセージ表示関数（`src/scenes/menu-scene.js:53`。`pages`＝表示する行の配列、`after`＝メッセージ閉じたあとに戻るモード名で `S.createDialogState` を使ってタイプライター表示する）。`after` に `'world'` を渡すと終了後に `enter('world')` → `buildWorld()`（Task 4 Step 8 で配線済み）が呼ばれ世界地図へ戻る。新しい API は作らず、この既存関数をそのまま使う。

- [ ] **Step 2: ビルド＆全テスト**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node build.js && wc -c index.html && md5 -q index.html && node --test
```
Expected: ビルド成功、全テスト PASS（回帰ゼロ）、0 fail。

- [ ] **Step 3: 実機目視（ファストトラベル動作確認）**

preview で built `index.html`（`http://localhost:5599/index.html`）を再ロード：
- 黒画面でないこと。
- 2つ以上の町を訪問した状態で「せかいちず」を開き、訪問済みの町を選ぶとその町の入口にワープすること。
- ワープ後もミニマップ・行き先看板・進行・セーブが正常に動くこと。
- 未訪問の町（？？？）を選ぶと「まだ いったことが ないよ！」が出てワープしないこと。
- 効果音（SE）が鳴ること。
- スクリーンショットをげんちゃんに提示。

- [ ] **Step 4: コミット**

```bash
git add src/scenes/menu-scene.js index.html
git commit -m "$(cat <<'EOF'
feat(map): 機能⑤ ファストトラベル（世界地図から町へワープ）

- 訪問済みの町ノード選択で warp 座標へワープ（既存マップ切替機構を再利用）
- 未訪問町は「まだ いったことが ないよ！」でブロック
- 既存 SE を再生、ワープ後も visited 記録・セーブ正常

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 機能⑥ 🎬 マップ切替演出（フェード＋SE＋マップ名フラッシュ）

げんちゃんの最重要要望①「マップ間移動がわかりにくい」への直接対応。現状のマップ切替は `state.position.map` を差し替えて `S.createFieldScene(state)` を再生成するだけで、**フェードも効果音もマップ名の大表示も無い**（`field-scene.js` の出口処理 2246-2260、常設ネームプレートは小さく毎フレーム描画 2566-2568）。切替時に (a) 効果音、(b) 新マップが黒からフェードイン、(c) マップ名を画面中央に大きくフラッシュ、の3点で「別の場所に来た！」を明確にする。純粋関数 `fadeAlpha`/`flashAlpha` はテスト可能に切り出し、演出状態は `createFieldScene` のクロージャに閉じ込める（新規トップレベル識別子は `fadeAlpha`/`flashAlpha` の2つだけ＝事前 grep で衝突ゼロ確認済み）。

> **設計上の非干渉:** 演出はすべて**描画専用**。`createFieldScene` はマップ遷移のたびに作り直されるので、演出状態の初期値がそのまま「入場アニメの開始」になる。ゲームロジック（当たり判定・エンカウント・ワープ・セーブ）には一切触れない。SE は既存の `S.playSe` を使い、出口処理の `S.replaceScene` 直前で鳴らす。

**Files:**
- Create: `tests/map-transition.test.js`
- Modify: `src/engine/audio.js`（`SRPG_SE` に切替SE `stairs` を追加）
- Modify: `src/scenes/field-scene.js`（純粋関数 `fadeAlpha`/`flashAlpha` をトップレベル追加＋UMDエクスポート、`createFieldScene` に入場フェード＆マップ名フラッシュ状態を追加、`update` で減衰、`draw` 最終段でオーバーレイ描画、出口処理で `S.playSe('stairs')`）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/map-transition.test.js`:

```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { fadeAlpha, flashAlpha } = require('../src/scenes/field-scene.js');

// fadeAlpha(remain, total): 黒オーバーレイ不透明度 0..1。
//   残りフェード秒 remain が total のとき 1（真っ黒）、0 のとき 0（透明）。
test('fadeAlpha: remain=total で 1（真っ黒）', () => {
  assert.strictEqual(fadeAlpha(0.35, 0.35), 1);
});
test('fadeAlpha: remain=0 で 0（透明）', () => {
  assert.strictEqual(fadeAlpha(0, 0.35), 0);
});
test('fadeAlpha: 中間は線形', () => {
  assert.strictEqual(fadeAlpha(0.2, 0.4), 0.5);
});
test('fadeAlpha: 範囲外はクランプ', () => {
  assert.strictEqual(fadeAlpha(-1, 0.4), 0);
  assert.strictEqual(fadeAlpha(1, 0.4), 1);
});
test('fadeAlpha: total<=0 は 0', () => {
  assert.strictEqual(fadeAlpha(0.2, 0), 0);
});

// flashAlpha(remain, total): マップ名フラッシュ不透明度。
//   序盤(残り40%まで)は 1 で見せきり、残り40%から線形に 0 へ消える。
test('flashAlpha: remain=total で 1', () => {
  assert.strictEqual(flashAlpha(1.2, 1.2), 1);
});
test('flashAlpha: remain=0 で 0', () => {
  assert.strictEqual(flashAlpha(0, 1.2), 0);
});
test('flashAlpha: 残り40%より上はずっと 1', () => {
  assert.strictEqual(flashAlpha(0.4, 1.0), 1);
});
test('flashAlpha: 残り40%地点から下は線形に減衰', () => {
  assert.strictEqual(flashAlpha(0.2, 1.0), 0.5);
});
test('flashAlpha: total<=0 は 0', () => {
  assert.strictEqual(flashAlpha(0.2, 0), 0);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/map-transition.test.js
```
Expected: FAIL（`fadeAlpha`/`flashAlpha` が未定義＝`TypeError: fadeAlpha is not a function`）。

- [ ] **Step 3: 純粋関数を実装（field-scene.js トップレベル）**

`src/scenes/field-scene.js` の**トップレベル**（`function createFieldScene(...)` の直前あたり、`clampCamera` など他のトップレベル関数と並ぶ位置）に追加。`var` 併用の関数宣言で衝突ゼロ：

```javascript
// ── マップ切替演出の純粋関数（弾2・機能⑥）─────────────────────
// 黒オーバーレイ不透明度 0..1。remain=残りフェード秒, total=フェード全体秒。
function fadeAlpha(remain, total) {
  if (!total || total <= 0) return 0;
  var a = remain / total;
  if (a < 0) return 0;
  if (a > 1) return 1;
  return a;
}
// マップ名フラッシュ不透明度 0..1。残り40%地点までは 1、そこから線形に 0 へ。
function flashAlpha(remain, total) {
  if (!total || total <= 0) return 0;
  if (remain <= 0) return 0;
  if (remain >= total) return 1;
  var fadeStart = total * 0.4;
  if (remain >= fadeStart) return 1;
  return remain / fadeStart;
}
```

- [ ] **Step 4: UMD エクスポートに追加**

`field-scene.js` 末尾の UMD エクスポート節（`{ createFieldScene, createPkScene, ... }`）の列挙に `fadeAlpha, flashAlpha` を追加する：

```javascript
})(typeof window !== 'undefined' ? window : globalThis, {
  createFieldScene, createPkScene, createLiftingScene, createShootScene,
  frontTile, walkSideFlip, npcMarkerKind, isWalkable, clampCamera, pendingCutscene,
  warpAt, conveyorAt, puzzleSolved, tryPushBlock, _withActiveNpcs, _ambientFor,
  _toneFor, _isProcTile, _procBaseSprite, _waterEdgeMask, _neighborMask,
  _isBaseTile, _isWaterSprite,
  nearestExitLabel,           // ← Task 3 で追加済み
  fadeAlpha, flashAlpha,      // ← 追加
});
```

> 注: `nearestExitLabel` は Task 3 で既に追加されている想定。行が無ければ併せて追加する（Task 3 未反映で単独実行する場合の保険）。

- [ ] **Step 5: テストが通ることを確認**

Run:
```bash
node --test tests/map-transition.test.js
```
Expected: PASS（10 テスト全通過）。

- [ ] **Step 6: 切替効果音 `stairs` を SRPG_SE に追加（audio.js）**

`src/engine/audio.js` の `SRPG_SE`（既存キー: move/confirm/cancel/attack/special/damage/heal/levelup/treasure/victory/defeat）に、`treasure` の隣あたりへ新キー `stairs` を追加。各ノートは `{ f:周波数Hz, d:秒, t:波形, g:音量 }`。上昇3音で「どこかへ入っていく」感：

```javascript
    stairs: [
      { f: 587, d: 0.06, t: 'square', g: 0.18 },
      { f: 784, d: 0.06, t: 'square', g: 0.18 },
      { f: 1046, d: 0.12, t: 'square', g: 0.18 },
    ],
```

- [ ] **Step 7: createFieldScene に演出状態を追加**

`createFieldScene` のクロージャ内、他の状態変数（`var _gfx = 0;` の付近、field-scene.js:1666 あたり）に追加：

```javascript
    // ── マップ切替の入場演出（弾2・機能⑥）＝描画専用・毎回の再生成で自動開始 ──
    var FADE_TIME = 0.35;        // 黒→透明のフェード秒
    var NAME_FLASH_TIME = 1.4;   // マップ名を大きく出す秒
    var _enterFade = FADE_TIME;       // 残りフェード秒（FADE_TIME→0）
    var _nameFlash = NAME_FLASH_TIME; // 残りフラッシュ秒（NAME_FLASH_TIME→0）
```

- [ ] **Step 8: update(dt) で演出を減衰**

`update: function (dt, input) {` の本体**冒頭**（field-scene.js:2175 直後）に、演出タイマーの減衰を追加。dt は秒（≈0.016）。描画専用なので既存ロジックの前後どちらでも可だが、冒頭に置くと明快：

```javascript
    update: function (dt, input) {
      // 入場演出の減衰（描画専用・ゲーム進行に非干渉）
      if (_enterFade > 0) _enterFade -= dt;
      if (_nameFlash > 0) _nameFlash -= dt;
      // …（以降は既存の update 本体そのまま）…
```

- [ ] **Step 9: 出口処理で切替SEを鳴らす**

`field-scene.js` の出口処理（2246-2260）、`S.replaceScene(S.createFieldScene(state))` の**直前**に SE 呼び出しを1行追加。`requireFlag` 未達で先へ進めないケースには**付けない**（進入成功時のみ鳴らす）：

```javascript
        state.position.map = exit.to;
        state.position.x = exit.tx;
        state.position.y = exit.ty;
        if (S.saveGame) S.saveGame(state);
        if (S.playSe) S.playSe('stairs');   // ← 追加：切替SE
        if (S.replaceScene) S.replaceScene(S.createFieldScene(state));
        return;
```

- [ ] **Step 10: draw 最終段でオーバーレイ描画**

`draw: function (ctx) {` の**最終段**（常設ネームプレート 2566-2568 と目標バー描画の後、`draw` を閉じる `}` の直前 ≈2574）に、黒フェードとマップ名フラッシュを最前面に重ねる。新規トップレベル識別子を増やさないため**インライン描画**（`fadeAlpha`/`flashAlpha` のみ参照）：

```javascript
      // ── マップ切替の入場演出（最前面）──────────────────────────
      var _fa = fadeAlpha(_enterFade, FADE_TIME);
      if (_fa > 0) {
        ctx.fillStyle = 'rgba(0,0,0,' + _fa + ')';
        ctx.fillRect(0, 0, VW, VH);
      }
      var _na = flashAlpha(_nameFlash, NAME_FLASH_TIME);
      if (_na > 0) {
        ctx.save();
        ctx.globalAlpha = _na;
        // 半透明の帯＋大きなマップ名（常設の小さいネームプレートとは別物）
        ctx.fillStyle = 'rgba(6,10,28,0.72)';
        ctx.fillRect(0, VH / 2 - 30, VW, 60);
        S.drawText(ctx, map.name, VW / 2, VH / 2 - 12, { size: 24, color: '#ffe9a8', align: 'center' });
        ctx.restore();
      }
```

> `map` は `draw` 内で参照している現在マップ定義（`map.name` は常設ネームプレート 2566-2568 でも使用済み＝スコープに存在）。`VW`/`VH`/`S`/`S.drawText` も既存で利用可能。

- [ ] **Step 11: ビルドして全テスト**

Run:
```bash
node build.js && wc -c index.html && md5 -q index.html && node --test
```
Expected: ビルド成功、`node --test` 全 PASS・0 fail（既存＋`map-transition.test.js` の10件）。`wc -c`/`md5 -q` の値を記録（音声ファイル0のためサイズ増はコード分のみ）。

- [ ] **Step 12: 実機で目視確認（黒画面でないこと＝バンドル衝突ゼロの確認込み）**

`http://localhost:5599/index.html`（ルート `/` は罠。必ずこの URL を明示 navigate）を実ブラウザで開き、マップを移動して確認：
- 切替時に一瞬黒からフェードインする。
- 画面中央にマップ名が大きく出て、1.4秒ほどで消える。
- 切替SEが鳴る（環境で音が出せない場合はコンソールエラーが無いことを確認）。
- `requireFlag` でロックされた出口では SE が鳴らず従来通りメッセージが出る。
- 戦闘→フィールド復帰など既存遷移で二重フェードや黒残りが起きない（フェードは最長 0.35 秒で必ず 0 に到達）。

> preview ツールは `preview_list`（server名 `srpg-dev`）で現行 `serverId` を取得してから `preview_eval`（引数 `expression`＋`serverId`）で `window.location.href='http://localhost:5599/index.html'` などを実行。

- [ ] **Step 13: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add tests/map-transition.test.js src/engine/audio.js src/scenes/field-scene.js index.html
git commit -m "$(cat <<'EOF'
feat(map): マップ切替演出（フェードイン＋切替SE＋マップ名フラッシュ）

- fadeAlpha/flashAlpha を純粋関数化＋テスト（tests/map-transition.test.js）
- SRPG_SE に切替SE 'stairs' を追加
- createFieldScene 入場時に黒フェードイン＆マップ名を大きくフラッシュ
- 出口進入成功時に S.playSe('stairs')
- 描画専用・ゲームロジック非干渉。げんちゃん要望①「マップ間移動が分かりにくい」対応

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## 全機能完了後の最終確認

- [ ] `node build.js && wc -c index.html && md5 -q index.html && node --test` で全テスト PASS・0 fail。
- [ ] built `index.html` を実ブラウザ（`http://localhost:5599/index.html`）で通し確認：スムーズスクロール／ミニマップ／行き先看板／世界地図／ファストトラベルが全マップで動き、既存機能（戦闘・鍛冶・トーナメント・ミニゲーム・図鑑・セーブ）に回帰がないこと。
- [ ] canon memory `project_soccer_rpg_yuito.md` ＋ Obsidian ミラーに第2弾の完了を追記。
- [ ] **Push は げんちゃんが「Pushして！」と言うまで実行しない**（ローカルコミットのみ）。

## テスト方針（まとめ）

- 純粋ロジック（`lerp`/`stepEase`/`minimapCell`/`nearestExitLabel`/`visibleWorldNodes`/`fastTravelTowns`）は `node --test` でユニットテスト（テスト fixture はモック名でよい）。
- 描画系（補間表示・ミニマップ・看板・世界地図・ワープ）は built `index.html` を実ブラウザで目視（`preview`・server名 `srpg-dev`）。
- `node --test` はスコープ分離でバンドル衝突を検知できないため、各タスクで必ず built `index.html` を実ブラウザでロードして黒画面でないことを確認。

## リスクと対策

- **バンドル衝突（黒画面）**：新規トップレベル識別子は事前 grep で衝突ゼロ確認済み。ビルド後は必ず実ブラウザ確認。
- **セーブ互換**：`state.visited` 未定義の旧セーブは読み出し側で `|| {}`。SAVE_VERSION 据え置き。
- **補間とワープの競合**：ワープ時は `moveProg=1` 即描画で回避。
- **表示名の捏造防止**：世界地図・行き先看板とも表示名は実行時 `S.MAPS[id].name`（フォールバックは `node.label`/`exit.to`）。ハードコードしない。
- **大きいマップのミニマップ縮尺**：`cell = floor(min(MAXW/cols, MAXH/rows))` で内接自動計算。

## 非目標（YAGNI）

- 27マップの物理統合（世界地図＋ファストトラベルで体験だけ実現）。
- ダンジョン各階の個別ノード表示（入口1ノードに集約）。
- フィールド/ダンジョンへのファストトラベル（安全地帯の町のみ）。
- `secret_field`/`legend_arena`/`challenge_room` の世界地図表示（隠し要素のためネタバレ回避で除外）。
