const test   = require('node:test');
const assert = require('node:assert');
const { wrapText, createDialogState, createDialog } = require('../src/scenes/dialog.js');

// ── wrapText ─────────────────────────────────────────────────────────

test('wrapText: 短い文字列は1行のまま', () => {
  const result = wrapText('こんにちは', 10);
  assert.deepStrictEqual(result, ['こんにちは']);
});

test('wrapText: ちょうど maxChars の文字列は1行', () => {
  const result = wrapText('あいうえおかきくけこ', 10);
  assert.deepStrictEqual(result, ['あいうえおかきくけこ']);
});

test('wrapText: maxChars を超えたら折り返す', () => {
  const result = wrapText('あいうえおかきくけこさ', 10);
  assert.deepStrictEqual(result, ['あいうえおかきくけこ', 'さ']);
});

test('wrapText: \\n で先に分割される', () => {
  const result = wrapText('ABC\nDEF', 10);
  assert.deepStrictEqual(result, ['ABC', 'DEF']);
});

test('wrapText: \\n 後にも折り返しが入る', () => {
  const result = wrapText('あいうえお\nかきくけこさしすせそ', 5);
  assert.deepStrictEqual(result, ['あいうえお', 'かきくけこ', 'さしすせそ']);
});

test('wrapText: 空文字列は空行1つを返す', () => {
  const result = wrapText('', 10);
  assert.deepStrictEqual(result, ['']);
});

test('wrapText: \\n だけの文字列は空行2つ', () => {
  const result = wrapText('\n', 10);
  assert.deepStrictEqual(result, ['', '']);
});

// ── createDialogState: ページ送り・文字送り遷移 ─────────────────────

test('DialogState: 初期状態は isDone=false', () => {
  const s = createDialogState(['hello']);
  assert.strictEqual(s.isDone(), false);
});

test('DialogState: dt 経過で文字が増える', () => {
  const s = createDialogState(['abcdefghijklmnop']); // 16文字
  s.update(0.3, false); // 45文字/秒 × 0.3秒 = 13文字分
  const visible = s.getVisibleText();
  assert.ok(visible.length >= 13, '13文字以上表示されるはず、実際: ' + visible.length);
  assert.ok(visible.length <= 16, '16文字以下のはず');
});

test('DialogState: 送り途中で confirm → 全部表示（isDone はまだ false）', () => {
  const page = 'あいうえおかきくけこ';
  const s = createDialogState([page]);
  // 少しだけ進める（送り途中）
  s.update(0.05, false);
  // confirm → 全部表示
  s.update(0, true);
  assert.strictEqual(s.getVisibleText(), page);
  assert.strictEqual(s.isDone(), false);
});

test('DialogState: 全部表示済みで confirm → 次のページへ', () => {
  const s = createDialogState(['ページ1', 'ページ2']);
  // ページ1を全部表示
  s.update(10, false); // 10秒で全部出る
  assert.strictEqual(s.getVisibleText(), 'ページ1');
  // confirm → ページ2へ
  s.update(0, true);
  // ページ2の先頭から始まる
  s.update(10, false);
  assert.strictEqual(s.getVisibleText(), 'ページ2');
});

test('DialogState: 最終ページ全部表示後に confirm → isDone=true', () => {
  const s = createDialogState(['最後のページ']);
  s.update(10, false); // 全部表示
  assert.strictEqual(s.isDone(), false);
  s.update(0, true);  // confirm → 完了
  assert.strictEqual(s.isDone(), true);
});

test('DialogState: isDone=true になった後は update しても変わらない', () => {
  const s = createDialogState(['X']);
  s.update(10, false);
  s.update(0, true); // 完了
  assert.strictEqual(s.isDone(), true);
  const result = s.update(10, true);
  assert.strictEqual(result.done, true);
  assert.strictEqual(s.isDone(), true);
});

test('DialogState: 1ページで2連続 confirm → 送り全表示→完了', () => {
  const s = createDialogState(['あいうえお']);
  // 1回目: 送り途中 → 全部表示
  s.update(0, true);
  assert.strictEqual(s.getVisibleText(), 'あいうえお');
  assert.strictEqual(s.isDone(), false);
  // 2回目: 全部表示済み → 完了
  s.update(0, true);
  assert.strictEqual(s.isDone(), true);
});

// ── createDialog: Node 環境でも update/isDone が動く ────────────────

test('createDialog: isDone は最初 false', () => {
  const dlg = createDialog(['テスト']);
  assert.strictEqual(dlg.isDone(), false);
});

test('createDialog: ページ完了後 isDone=true（popScene なし環境）', () => {
  // Node 環境は window なし → popScene の呼び出しをスキップしても例外にならない
  const dlg = createDialog(['テスト']);
  const fakeInput = (confirm) => ({ pressed: { confirm, cancel: false } });
  dlg._state.update(10, false);   // 全部表示
  dlg._state.update(0, true);     // 完了
  assert.strictEqual(dlg.isDone(), true);
});

test('createDialog: onComplete が呼ばれる（_state 経由でテスト）', () => {
  var called = false;
  const dlg = createDialog(['テスト'], { onComplete: function() { called = true; } });
  // _state で完了状態にし、update を通じて onComplete を走らせる
  dlg._state.update(10, false);
  // update(0, true) を直接 _state に当てると isDone → true になる
  dlg._state.update(0, true);
  // createDialog の update を呼ぶとウィンドウなし環境での popScene スキップ+onComplete 呼び出し
  dlg.update(0, { pressed: { confirm: true } });
  assert.strictEqual(called, true);
});
