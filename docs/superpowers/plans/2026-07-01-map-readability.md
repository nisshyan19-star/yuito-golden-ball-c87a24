# 第1弾「マップの見やすさ改善」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マップ上の宝箱（未開封＝光の輪＋強い✦点滅／開封済み＝薄い空箱）とNPC（役割別の頭上マーク）を、近づかなくても一目でわかる見た目にする。

**Architecture:** 変更は `src/scenes/field-scene.js` 一本に閉じる。判定ロジックだけを純粋関数 `npcMarkerKind(npc, state)` として切り出し `node --test` で回帰。描画は `_drawNpcMarker` / `_drawChestAura` / `_drawOpenedChest` の3ヘルパ＋既存 `_drawChestGlow` の微調整で行い、実機（ビルド済み index.html）で目視確認する。

**Tech Stack:** 素のJS（UMDバンドル・トップレベルは `var` のみ・鉄則①=名前衝突で黒画面）、Canvas 2D、`node:test`、`build.js`（ORDER編集禁止）。

---

## File Structure

- `src/scenes/field-scene.js`（変更）
  - 新規トップレベル関数 `npcMarkerKind(npc, state)`（純粋・UMD export）
  - 新規トップレベル関数 `_drawNpcMarker(ctx, kind, sx, sy, TS, phase)`（描画）
  - 新規トップレベル関数 `_drawChestAura(ctx, sx, sy, TS, phase)`（描画）
  - 新規トップレベル関数 `_drawOpenedChest(ctx, sx, sy, TS)`（描画）
  - 既存 `_drawChestGlow` の ✦ を少し強める微調整
  - 宝箱描画ブロック（未開封のみ→未開封は光の輪＋陰影／開封済みは薄い空箱に分岐）
  - NPC描画ブロック（スプライト描画後に頭上マークを追加）
  - UMD export に `npcMarkerKind` を追加
- `tests/marker-kind.test.js`（新規）: `npcMarkerKind` の全分岐テスト

新規識別子4つ（`npcMarkerKind` / `_drawNpcMarker` / `_drawChestAura` / `_drawOpenedChest`）は全src grep で0件＝既存衝突なしを確認済み。

---

## Task 1: `npcMarkerKind` 純粋関数 ＋ テスト

NPCの頭上マークの種類を、話しかけ処理 `_talkTo`（field-scene.js 1568-1669）と同じ優先順位で決める純粋関数。`S.questStage` などに依存せず、フラグ・パーティを直接見るので `node --test` で回帰できる。

**Files:**
- Create: `tests/marker-kind.test.js`
- Modify: `src/scenes/field-scene.js`（`walkSideFlip` 関数定義の直後・44行目付近に新規関数を追加／末尾の UMD export に1行追加）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/marker-kind.test.js`:

```javascript
const test   = require('node:test');
const assert = require('node:assert');
const { npcMarkerKind } = require('../src/scenes/field-scene.js');

// npcMarkerKind: マップ上のNPCの頭上に出すマークの種類を返す純粋関数。
// 判定は話しかけ処理 _talkTo と同じ優先順位（shop→forge→joinId→boss→bossRush→quest→会話）。
// 役割NPCが「済み状態」(加入済み/撃破済み/完了)なら、まだ会話できるので 'talk' に落ちる。

const S0 = { flags: {}, party: [] };

test('お店（道具/装備・inn以外）→ shop', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'shopkeep', shop: { name: 'どうぐや' } }, S0), 'shop');
});

test('宿屋（shop.type=inn）→ inn', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'shopkeep', shop: { type: 'inn', cost: 20 } }, S0), 'inn');
});

test('かじや（forge）→ forge', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'coach', forge: {} }, S0), 'forge');
});

test('未加入の仲間（joinId・未加入）→ ally', () => {
  assert.strictEqual(npcMarkerKind({ joinId: 'aoshi', pages: ['やあ'] }, S0), 'ally');
});

test('加入済みの仲間 → talk（もう仲間なので会話マーク）', () => {
  const S = { flags: {}, party: [{ id: 'aoshi' }] };
  assert.strictEqual(npcMarkerKind({ joinId: 'aoshi' }, S), 'talk');
});

test('未撃破ボス（boss・winFlag未達）→ boss', () => {
  assert.strictEqual(npcMarkerKind({ boss: { winFlag: 'w1', enemies: [] }, pages: ['いくぞ'] }, S0), 'boss');
});

test('撃破済みボス（flags[winFlag]=true）→ talk', () => {
  const S = { flags: { w1: true }, party: [] };
  assert.strictEqual(npcMarkerKind({ boss: { winFlag: 'w1' }, afterPages: ['まけた…'] }, S), 'talk');
});

test('未クリアのボスラッシュ（bossRush）→ boss', () => {
  assert.strictEqual(npcMarkerKind({ bossRush: { winFlag: 'br' }, pages: ['?'] }, S0), 'boss');
});

test('未完了クエスト（quest・doneFlag未達）→ quest', () => {
  assert.strictEqual(npcMarkerKind({ quest: { doneFlag: 'q1', askPages: ['たのむ'] } }, S0), 'quest');
});

test('完了クエスト（flags[doneFlag]=true）→ talk', () => {
  const S = { flags: { q1: true }, party: [] };
  assert.strictEqual(npcMarkerKind({ quest: { doneFlag: 'q1' } }, S), 'talk');
});

test('通常の会話NPC（pages）→ talk', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'ikuma', pages: ['こんにちは'] }, S0), 'talk');
});

test('会話も役割も無いNPC → none', () => {
  assert.strictEqual(npcMarkerKind({ sprite: 'ikuma' }, S0), 'none');
});

test('npc が null → none（クラッシュしない）', () => {
  assert.strictEqual(npcMarkerKind(null, S0), 'none');
});

test('state 未指定でも shop 判定できる', () => {
  assert.strictEqual(npcMarkerKind({ shop: {} }, undefined), 'shop');
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/marker-kind.test.js
```
Expected: FAIL（`npcMarkerKind` is not a function／undefined）

- [ ] **Step 3: 最小実装を書く**

`src/scenes/field-scene.js` の `walkSideFlip(...)` 関数定義の**直後**（44行目付近、`function walkSideFlip` ブロックの閉じ `}` の次の行）に追加:

```javascript
// npcMarkerKind: マップ上のNPCの頭上に出すマークの種類を決める。
//   話しかけ処理 _talkTo と同じ優先順位（shop→forge→joinId→boss→bossRush→quest→会話）で判定する。
//   純粋関数（副作用なし）＝ node --test で回帰できる。S.questStage 等に依存せず、
//   済み判定は state.flags / state.party を直接見る。
//   戻り値: 'inn' | 'shop' | 'forge' | 'ally' | 'boss' | 'quest' | 'talk' | 'none'
function npcMarkerKind(npc, state) {
  if (!npc) return 'none';
  var flags = (state && state.flags) || {};
  var party = (state && state.party) || [];
  // 役割が「済み状態」のとき落ちる先＝会話できるなら talk、会話も無ければ none。
  var talk = ((npc.pages && npc.pages.length) || (npc.afterPages && npc.afterPages.length)) ? 'talk' : 'none';

  if (npc.shop) return (npc.shop.type === 'inn') ? 'inn' : 'shop';
  if (npc.forge) return 'forge';
  if (npc.joinId) {
    var joined = party.some(function (p) { return p.id === npc.joinId; });
    return joined ? 'talk' : 'ally';   // 加入済みは _talkTo で会話するので talk
  }
  if (npc.boss) {
    var bwin = npc.boss.winFlag;
    return (bwin && flags[bwin]) ? 'talk' : 'boss';
  }
  if (npc.bossRush) {
    var rwin = npc.bossRush.winFlag;
    return (rwin && flags[rwin]) ? 'talk' : 'boss';
  }
  if (npc.quest) {
    var dflag = npc.quest.doneFlag;
    return (dflag && flags[dflag]) ? 'talk' : 'quest';
  }
  return talk;
}
```

そして末尾の UMD export（2908-2934行付近、`walkSideFlip: walkSideFlip,` がある行の直後）に1行追加:

```javascript
    walkSideFlip:     walkSideFlip,
    npcMarkerKind:    npcMarkerKind,
```

- [ ] **Step 4: テストを実行して成功を確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node --test tests/marker-kind.test.js
```
Expected: PASS（14 tests / 0 fail）

- [ ] **Step 5: コミット（げんちゃんの明示指示があるまで push はしない）**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add tests/marker-kind.test.js src/scenes/field-scene.js
git commit -m "feat(field): npcMarkerKind 純粋関数＋テスト（頭上マーク判定）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `_drawNpcMarker` 描画ヘルパ ＋ NPCループに配線

`npcMarkerKind` の結果を、NPCの頭上に浮かぶ小さなバッジ（丸＋白フチ＋記号）として描く。`kind` と座標だけで決まる（state 非依存）ので実機目視で確認する。テストは描画なので無し（既存の描画ヘルパと同じ運用）。

**Files:**
- Modify: `src/scenes/field-scene.js`
  - 新規関数 `_drawNpcMarker` を追加（`npcMarkerKind` の直後）
  - NPC描画ブロック（2280-2287行付近）に頭上マーク呼び出しを追加

- [ ] **Step 1: `_drawNpcMarker` を追加**

`src/scenes/field-scene.js` の `npcMarkerKind(...)` 関数の**直後**に追加:

```javascript
// _drawNpcMarker: npcMarkerKind の結果を NPC の頭上に小さなバッジで描く。
//   sx,sy は NPC スプライトの左上スクリーン座標。phase(_gfx) で ふわふわ上下する。
//   文字記号($ ! ?)は nested の glyph() で描き、ベッド/金づち/✦ は手描き。
function _drawNpcMarker(ctx, kind, sx, sy, TS, phase) {
  if (!kind || kind === 'none') return;
  var COL = {
    inn: '#2bb673', shop: '#2bb673', forge: '#f0a020',
    ally: '#ffd200', boss: '#e8443a', quest: '#a065d0', talk: '#ffd200'
  };
  var col = COL[kind] || '#ffd200';
  var small = (kind === 'talk');          // 通常会話は控えめ
  var rad = small ? 6 : 8;                 // バッジ半径
  var bob = Math.sin(phase * 3) * 1.6;     // ふわふわ上下
  var cx = sx + TS / 2;
  var cy = sy - rad - 2 + bob;             // 頭上

  function glyph(ch) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.round(rad * 1.9) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy + 0.5);
  }

  ctx.save();
  // 影（少し大きい黒丸）→ 本体（役割色）→ 白フチ
  ctx.beginPath(); ctx.arc(cx, cy, rad + 1.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = '#ffffff'; ctx.stroke();

  ctx.fillStyle = '#ffffff';
  if (kind === 'shop') glyph('$');
  else if (kind === 'boss' || kind === 'talk') glyph('!');
  else if (kind === 'quest') glyph('?');
  else if (kind === 'inn') {
    // ベッド：マット＋枕
    var bw = rad * 1.35, bh = rad * 0.5;
    ctx.fillRect(cx - bw / 2, cy - bh / 2 + 1, bw, bh);
    ctx.fillRect(cx - bw / 2, cy - bh / 2 - 1.5, bw * 0.34, bh);
  } else if (kind === 'forge') {
    // 金づち：柄＋頭（少し傾ける）
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.5);
    ctx.fillRect(-0.9, -rad * 0.55, 1.8, rad * 1.15);
    ctx.fillRect(-rad * 0.55, -rad * 0.68, rad * 1.1, rad * 0.42);
    ctx.restore();
  } else if (kind === 'ally') {
    // ✦（4方向にとがった星）
    var r2 = rad * 0.78;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r2); ctx.lineTo(cx + r2 * 0.32, cy - r2 * 0.32);
    ctx.lineTo(cx + r2, cy); ctx.lineTo(cx + r2 * 0.32, cy + r2 * 0.32);
    ctx.lineTo(cx, cy + r2); ctx.lineTo(cx - r2 * 0.32, cy + r2 * 0.32);
    ctx.lineTo(cx - r2, cy); ctx.lineTo(cx - r2 * 0.32, cy - r2 * 0.32);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
```

- [ ] **Step 2: NPC描画ブロックに配線**

`src/scenes/field-scene.js` の NPC描画ループ（現状 2280-2287行付近）:

```javascript
      // 5. NPC
      var npcs = map.npcs || [];
      for (var ni = 0; ni < npcs.length; ni++) {
        var npc = npcs[ni];
        var nsp = S.SPRITES[npc.sprite];
        S.drawShadow(ctx, offX + npc.x * TS + TS / 2, offY + npc.y * TS + TS - 3, 10, 4);
        if (nsp) S.drawSprite(ctx, nsp, offX + npc.x * TS, offY + npc.y * TS, 1);
      }
```

を、頭上マーク描画を足したものに置き換える:

```javascript
      // 5. NPC（＋頭上マーク＝話せる人/お店/鍛冶/仲間/ボス/クエストを一目でわかるように）
      var npcs = map.npcs || [];
      for (var ni = 0; ni < npcs.length; ni++) {
        var npc = npcs[ni];
        var nsp = S.SPRITES[npc.sprite];
        S.drawShadow(ctx, offX + npc.x * TS + TS / 2, offY + npc.y * TS + TS - 3, 10, 4);
        if (nsp) S.drawSprite(ctx, nsp, offX + npc.x * TS, offY + npc.y * TS, 1);
        var mkind = npcMarkerKind(npc, state);
        if (mkind !== 'none') {
          _drawNpcMarker(ctx, mkind, offX + npc.x * TS, offY + npc.y * TS, TS, _gfx + ni * 0.6);
        }
      }
```

- [ ] **Step 3: ビルドして全テスト実行（回帰なし確認）**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node build.js && node --test
```
Expected: build 成功・全テスト PASS（0 fail）

- [ ] **Step 4: 実機で頭上マークを目視確認**

`http://localhost:5599/index.html` を明示 navigate（`/` は罠）。`preview_list`（server名=srpg-dev）で serverId を取得 → `preview_eval`（`expression` に `window.location.reload()`）→ ゲーム開始 → 最初の町でお店($緑)・宿(ベッド緑)・仲間(✦黄)・会話NPC(!黄小)の頭上バッジが出て、ふわふわ上下しているのを screenshot で確認。TS に対しバッジが大きすぎ/小さすぎなら `rad` 値を微調整（6/8 → 目視で決定）。

- [ ] **Step 5: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/scenes/field-scene.js index.html
git commit -m "feat(field): NPC頭上マーク描画＋配線（店/宿/鍛冶/仲間/ボス/クエスト/会話）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 未開封宝箱の強調（`_drawChestAura` ＋ 陰影 ＋ ✦強め）

未開封の宝箱の足元に光の輪を敷き、本体に軽い陰影を足し、頭上の ✦ を少し強めて「ここに宝がある」を目立たせる。

**Files:**
- Modify: `src/scenes/field-scene.js`
  - 新規関数 `_drawChestAura` を追加（`_drawChestGlow` の直前・705行目付近）
  - `_drawChestGlow`（707-722行）の ✦ を少し強める
  - 宝箱描画ブロック（2263-2278行付近）の未開封描画に光の輪＋陰影を追加

- [ ] **Step 1: `_drawChestAura` を追加**

`src/scenes/field-scene.js` の `_drawChestGlow` 関数定義の**直前**に追加:

```javascript
// _drawChestAura: 未開封の宝箱の足元に敷くやわらかい光の輪（放射グラデ）。
//   地面が金色に光って「宝があるよ」を強調する。phase(_gfx)で ゆっくり脈打つ。
function _drawChestAura(ctx, sx, sy, TS, phase) {
  var cx = sx + TS / 2, cy = sy + TS - 5;              // 箱の足元
  var pulse = 0.6 + 0.4 * Math.abs(Math.sin(phase * 1.6));
  var R = TS * 0.55 * pulse;
  ctx.save();
  var g = ctx.createRadialGradient(cx, cy, 1, cx, cy, R);
  g.addColorStop(0, 'rgba(255,226,120,0.55)');
  g.addColorStop(0.5, 'rgba(255,210,90,0.22)');
  g.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 0.5, 0, 0, Math.PI * 2);  // 地面に沿った楕円
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 2: `_drawChestGlow` の ✦ を少し強める**

`_drawChestGlow`（707-722行付近）内の2行を変更する。

変更前:
```javascript
  var tw = Math.abs(Math.sin(phase * 2.2));
  if (tw < 0.25) return; // ときどき消える＝点滅
  ctx.save();
  var r = 2 + tw * 2.4;
```

変更後:
```javascript
  var tw = Math.abs(Math.sin(phase * 2.2));
  if (tw < 0.2) return; // ときどき消える＝点滅（少し長めに光る）
  ctx.save();
  var r = 3 + tw * 3.2; // 少し大きく＝目立たせる
```

- [ ] **Step 3: 未開封宝箱の描画に光の輪＋陰影を追加**

宝箱描画ブロック（現状 2263-2278行付近）:

```javascript
      // 4. 宝箱（未開封のみ・簡易プリミティブ）
      var chests = map.chests || [];
      for (var ci = 0; ci < chests.length; ci++) {
        var ch = chests[ci];
        if (opened[ch.id]) continue;
        var sx = offX + ch.x * TS, sy = offY + ch.y * TS;
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx + 5, sy + 13, TS - 10, TS - 15);
        ctx.fillStyle = '#a86b34'; ctx.fillRect(sx + 5, sy + 9, TS - 10, 7);
        ctx.fillStyle = '#ffd76e';
        ctx.fillRect(sx + TS / 2 - 2, sy + 9, 4, TS - 12);
        ctx.fillRect(sx + 5, sy + 15, TS - 10, 3);
        ctx.strokeStyle = '#3a230f'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 5, sy + 9, TS - 10, TS - 13);
        // 未開封の宝の上で ✦ がチカチカ＝「ここに何かあるよ」のサイン。
        _drawChestGlow(ctx, sx, sy, TS, _gfx + ci * 1.7);
      }
```

を、未開封だけに光の輪＋陰影を足したものに置き換える（開封済み分岐は Task 4 で追加。ここでは `continue` のまま残す）:

```javascript
      // 4. 宝箱
      var chests = map.chests || [];
      for (var ci = 0; ci < chests.length; ci++) {
        var ch = chests[ci];
        var sx = offX + ch.x * TS, sy = offY + ch.y * TS;
        if (opened[ch.id]) continue;
        // 未開封：足元の光の輪 → 箱本体（陰影つき）→ 頭上の✦
        _drawChestAura(ctx, sx, sy, TS, _gfx + ci * 1.3);
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(sx + 5, sy + 13, TS - 10, TS - 15);
        ctx.fillStyle = '#a86b34'; ctx.fillRect(sx + 5, sy + 9, TS - 10, 7);
        // 陰影：上フチのハイライト＋下の影で立体感
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx + 5, sy + 9, TS - 10, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx + 5, sy + TS - 4, TS - 10, 2);
        ctx.fillStyle = '#ffd76e';
        ctx.fillRect(sx + TS / 2 - 2, sy + 9, 4, TS - 12);
        ctx.fillRect(sx + 5, sy + 15, TS - 10, 3);
        ctx.strokeStyle = '#3a230f'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 5, sy + 9, TS - 10, TS - 13);
        // 未開封の宝の上で ✦ がチカチカ＝「ここに何かあるよ」のサイン。
        _drawChestGlow(ctx, sx, sy, TS, _gfx + ci * 1.7);
      }
```

（注: `var sx`/`var sy` を `if (opened...)` の**前**に移動。`var` は関数スコープなので再宣言問題なし。Task 4 で開封済み分岐がこの `sx/sy` を使う。）

- [ ] **Step 4: ビルドして全テスト実行**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node build.js && node --test
```
Expected: build 成功・全テスト PASS（0 fail）

- [ ] **Step 5: 実機で未開封宝箱を目視確認**

`http://localhost:5599/index.html` を reload → 宝箱のあるマップで、足元の金色の光の輪・本体の陰影・強めの ✦ 点滅を screenshot で確認。眩しすぎ/地味すぎなら `_drawChestAura` の alpha（0.55/0.22）や `R` 係数（0.55）を微調整。

- [ ] **Step 6: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/scenes/field-scene.js index.html
git commit -m "feat(field): 未開封宝箱を強調（足元の光の輪＋陰影＋✦強め）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 開封済み宝箱を薄い空箱で残す（`_drawOpenedChest`）

現状 `if (opened[ch.id]) continue;` で非表示の開封済み宝箱を、ふたが開いた空箱として薄め（低 alpha）で描く。取った場所が一目でわかり、取りこぼし探索がラクになる。げんちゃん承認済み（「開けた箱も薄く残す（おすすめ）」）。

**Files:**
- Modify: `src/scenes/field-scene.js`
  - 新規関数 `_drawOpenedChest` を追加（`_drawChestAura` の直後）
  - 宝箱描画ブロックの `if (opened[ch.id]) continue;` を分岐化

- [ ] **Step 1: `_drawOpenedChest` を追加**

`src/scenes/field-scene.js` の `_drawChestAura` 関数の**直後**に追加:

```javascript
// _drawOpenedChest: 開封済みの宝箱を「ふたが開いた空箱」として薄く描く。
//   取った場所がわかり、取りこぼし探索がラクになる。低 alpha で控えめに残す。
function _drawOpenedChest(ctx, sx, sy, TS) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  // 箱の下半分（空）
  ctx.fillStyle = '#7a4f28'; ctx.fillRect(sx + 5, sy + 14, TS - 10, TS - 16);
  // 内側の影（空っぽ感）
  ctx.fillStyle = '#3a250f'; ctx.fillRect(sx + 7, sy + 15, TS - 14, 4);
  // 開いたふた（斜め上へ跳ね上がる台形）
  ctx.fillStyle = '#96602f';
  ctx.beginPath();
  ctx.moveTo(sx + 5, sy + 14);
  ctx.lineTo(sx + 7, sy + 6);
  ctx.lineTo(sx + TS - 7, sy + 6);
  ctx.lineTo(sx + TS - 5, sy + 14);
  ctx.closePath(); ctx.fill();
  // 箱の輪郭
  ctx.strokeStyle = 'rgba(58,35,15,0.8)'; ctx.lineWidth = 1;
  ctx.strokeRect(sx + 5, sy + 14, TS - 10, TS - 16);
  ctx.restore();
}
```

- [ ] **Step 2: `continue` を分岐化**

Task 3 で `var sx/sy` を前に出した宝箱ブロックの、開封済み判定を置き換える。

変更前:
```javascript
        var sx = offX + ch.x * TS, sy = offY + ch.y * TS;
        if (opened[ch.id]) continue;
        // 未開封：足元の光の輪 → ...
```

変更後:
```javascript
        var sx = offX + ch.x * TS, sy = offY + ch.y * TS;
        if (opened[ch.id]) {
          // 開封済み：薄い空箱を残す（取った場所がわかる）
          _drawOpenedChest(ctx, sx, sy, TS);
          continue;
        }
        // 未開封：足元の光の輪 → ...
```

- [ ] **Step 3: ビルドして全テスト実行**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node build.js && node --test
```
Expected: build 成功・全テスト PASS（0 fail）

- [ ] **Step 4: 実機で開封済み宝箱を目視確認**

`http://localhost:5599/index.html` を reload → 宝箱を1つ開ける → 開けた箱が薄いふた開き空箱として残り、他の未開封宝箱（光の輪＋✦）と見分けられることを screenshot で確認。開封→再入場（別マップへ exits→戻る）でも空箱が残ることを確認。

- [ ] **Step 5: コミット**

```bash
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
git add src/scenes/field-scene.js index.html
git commit -m "feat(field): 開封済み宝箱を薄い空箱で残す（取った場所がわかる）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 最終ビルド検証（サイズ・md5・全テスト・実機総確認）

第1弾の全変更をまとめて最終確認する。新規ファイルはテスト1つのみ、`build.js` ORDER 編集0、AIアート0＝サイズ増はごくわずかのはず。

**Files:**
- 変更なし（検証のみ）

- [ ] **Step 1: クリーンビルド＋全テスト**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd "/Users/gensu/Claud Code/soccer-rpg-yuito"
node build.js && wc -c index.html && md5 -q index.html && node --test 2>&1 | tail -5
```
Expected: build 成功／サイズは 13,031,535B から数KB増程度／全テスト PASS（0 fail・marker-kind の14件が加算）

- [ ] **Step 2: 実機で黒画面が無いことを確認**

`http://localhost:5599/index.html` を明示 navigate → `preview_console_logs`（level=error）でエラー0を確認 → ゲームが起動しタイトル→フィールドが描画されること（＝バンドル鉄則①の名前衝突による黒画面が無いこと）を screenshot で確認。

- [ ] **Step 3: 第1弾の見た目総まとめを screenshot**

未開封宝箱（光の輪＋✦）・開封済み空箱・各NPCの頭上マーク（店$/宿ベッド/鍛冶金づち/仲間✦/ボス!/会話!）が1画面〜数画面で確認できる screenshot を撮り、げんちゃんに見せる用に用意。

- [ ] **Step 4: げんちゃんに報告（push はしない）**

第1弾完了を報告。**push はげんちゃんの「Pushして！」明示指示があるまで行わない**（memory の配信ルール厳守）。あわせて canon memory `project_soccer_rpg_yuito.md` と Obsidian `70_Claude連携/Projects/サッカーRPG_ユイトと黄金のサッカーボール.md` に第1弾完了を追記（要点ミラー＋リンク）。

---

## 完了の定義

- 未開封の宝箱が「足元の光の輪＋強めの✦点滅＋陰影」で目立つ。
- 開封済みの宝箱が薄いふた開き空箱で残る。
- 各NPCの頭上に役割別マークが出る（宿=ベッド緑／店=$緑／鍛冶=金づち金／仲間=✦黄／ボス=!赤／クエスト=?紫／会話=!黄小）。
- `npcMarkerKind` の全分岐が `node --test` でPASS。
- クリーンビルド成功・全テストPASS・実機で黒画面なし・目視OK。
- （push はげんちゃんの明示指示があるまで行わない。イクマ左右反転の既存ローカル修正も同様に未push。）
