const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const audio = require('../src/engine/audio.js');

// audio.js は Web Audio をコード生成する SE モジュール。
// Node（window 無し）では全API が安全な no-op になることを保証する＝ゲーム本体を絶対に止めない。

test('4つのAPI＋SEテーブルをエクスポートする', () => {
  assert.strictEqual(typeof audio.playSe, 'function');
  assert.strictEqual(typeof audio.initAudio, 'function');
  assert.strictEqual(typeof audio.setSeMuted, 'function');
  assert.strictEqual(typeof audio.isSeMuted, 'function');
  assert.strictEqual(typeof audio.SRPG_SE, 'object');
});

test('SEテーブルは必要な効果音をすべて持つ', () => {
  const need = ['move', 'confirm', 'cancel', 'attack', 'special', 'damage', 'heal', 'levelup', 'treasure', 'victory', 'defeat'];
  need.forEach((name) => {
    assert.ok(Array.isArray(audio.SRPG_SE[name]) && audio.SRPG_SE[name].length > 0, `SE '${name}' が無い／空`);
  });
});

test('各SEの音符は周波数(f)と長さ(d)を数値で持つ', () => {
  Object.entries(audio.SRPG_SE).forEach(([name, seq]) => {
    seq.forEach((note, i) => {
      assert.strictEqual(typeof note.f, 'number', `${name}[${i}].f が数値でない`);
      assert.strictEqual(typeof note.d, 'number', `${name}[${i}].d が数値でない`);
      assert.ok(note.f > 0 && note.d > 0, `${name}[${i}] の f/d が正でない`);
    });
  });
});

test('Node（window無し）では playSe が例外を出さず no-op', () => {
  assert.doesNotThrow(() => audio.playSe('confirm'));
  assert.doesNotThrow(() => audio.playSe('attack'));
  assert.doesNotThrow(() => audio.playSe('存在しない音')); // 未定義名でも安全
  assert.doesNotThrow(() => audio.playSe());                // 引数なしでも安全
});

test('Node では initAudio が例外を出さず no-op', () => {
  assert.doesNotThrow(() => audio.initAudio());
});

test('ミュートの ON/OFF が切り替わる', () => {
  audio.setSeMuted(true);
  assert.strictEqual(audio.isSeMuted(), true);
  audio.setSeMuted(false);
  assert.strictEqual(audio.isSeMuted(), false);
});

// 回帰防止：ソース中で playSe('xxx') と呼んでいる名前が、必ず SE テーブルに存在すること。
// （配線時のタイプミスで無音になるのを検出する）
test('ソースで呼ばれる playSe 名はすべて SE テーブルに存在する', () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const called = new Set();
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) return walk(p);
      if (!ent.name.endsWith('.js')) return;
      const code = fs.readFileSync(p, 'utf8');
      const re = /playSe\(\s*['"]([a-zA-Z_]+)['"]/g;
      let m; while ((m = re.exec(code)) !== null) called.add(m[1]);
    });
  }
  walk(srcDir);
  assert.ok(called.size > 0, 'playSe 呼び出しが1つも検出されなかった');
  called.forEach((name) => {
    assert.ok(audio.SRPG_SE[name], `playSe('${name}') が呼ばれているが SE テーブルに無い`);
  });
});

// ── BGM（ステップ・シーケンサ）──────────────────────────────────────
test('BGMのAPI＋曲テーブルをエクスポートする', () => {
  assert.strictEqual(typeof audio.playBgm, 'function');
  assert.strictEqual(typeof audio.stopBgm, 'function');
  assert.strictEqual(typeof audio.setBgmMuted, 'function');
  assert.strictEqual(typeof audio.isBgmMuted, 'function');
  assert.strictEqual(typeof audio.SRPG_BGM, 'object');
});

test('曲テーブルは必要な曲をすべて持つ', () => {
  ['title', 'field', 'town', 'dungeon', 'battle'].forEach((name) => {
    const song = audio.SRPG_BGM[name];
    assert.ok(song && typeof song === 'object', `曲 '${name}' が無い`);
    assert.ok(typeof song.step === 'number' && song.step > 0, `曲 '${name}' の step が不正`);
    assert.ok(Array.isArray(song.mel) && song.mel.length > 0, `曲 '${name}' の mel が空`);
  });
});

test('各曲の音符は 0（休符）か正の周波数', () => {
  Object.entries(audio.SRPG_BGM).forEach(([name, song]) => {
    (song.mel || []).concat(song.bass || []).forEach((f, i) => {
      assert.strictEqual(typeof f, 'number', `${name} の音符[${i}]が数値でない`);
      assert.ok(f >= 0, `${name} の音符[${i}]が負`);
    });
  });
});

test('Node では playBgm/stopBgm が例外を出さず no-op', () => {
  assert.doesNotThrow(() => audio.playBgm('title'));
  assert.doesNotThrow(() => audio.playBgm('field'));
  assert.doesNotThrow(() => audio.playBgm('存在しない曲')); // 未定義名でも安全
  assert.doesNotThrow(() => audio.playBgm());               // 引数なしでも安全
  assert.doesNotThrow(() => audio.stopBgm());
});

test('BGMミュートの ON/OFF が切り替わる', () => {
  audio.setBgmMuted(true);
  assert.strictEqual(audio.isBgmMuted(), true);
  audio.setBgmMuted(false);
  assert.strictEqual(audio.isBgmMuted(), false);
});

// 回帰防止：ソース中で playBgm('xxx') と呼んでいる名前が、必ず曲テーブルに存在すること。
test('ソースで呼ばれる playBgm 名はすべて曲テーブルに存在する', () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const called = new Set();
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) return walk(p);
      if (!ent.name.endsWith('.js')) return;
      const code = fs.readFileSync(p, 'utf8');
      const re = /playBgm\(\s*['"]([a-zA-Z_]+)['"]/g;
      let m; while ((m = re.exec(code)) !== null) called.add(m[1]);
    });
  }
  walk(srcDir);
  assert.ok(called.size > 0, 'playBgm 呼び出しが1つも検出されなかった');
  called.forEach((name) => {
    assert.ok(audio.SRPG_BGM[name], `playBgm('${name}') が呼ばれているが 曲テーブルに無い`);
  });
});
