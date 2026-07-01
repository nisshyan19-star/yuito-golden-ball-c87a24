// === audio.js ===
// Web Audio API でコード生成する効果音（SE）。音声ファイルは一切持たない＝
// index.html のサイズは1バイトも増えず、完全オフラインのまま鳴る。
// window が無い環境（Node の node --test）では全API が安全な no-op になる。
//
// 識別子は他ファイルと衝突しないよう接頭辞 _srpgAudio / SRPG_SE を付ける（鉄則①）。
// UMD export は既存 input.js と同じ書式。シーン側は SRPG.playSe('confirm') 等で呼ぶ。

var _srpgAudioCtx = null;     // 遅延生成する AudioContext（最初の操作で作る）
var _srpgAudioMuted = false;  // ミュート状態
var _srpgAudioUnlocked = false; // iOS 等で一度でもユーザー操作で resume できたか

// SE 定義：name → 「音符の列」。各音符は {f:周波数Hz, d:長さ秒, t:波形, g:音量, df:終端周波数(任意)}。
// df があると f→df へなめらかに変化（スイープ）。子ども向けにかわいいピコピコ音にする。
var SRPG_SE = {
  // UI：カーソル移動・決定・キャンセル（最も体感に効く＝9歳が一番触る所）
  move:    [{ f: 520, d: 0.03, t: 'square', g: 0.12 }],
  confirm: [{ f: 660, d: 0.05, t: 'square', g: 0.18 }, { f: 990, d: 0.06, t: 'square', g: 0.18 }],
  cancel:  [{ f: 440, d: 0.06, t: 'square', g: 0.16, df: 300 }],
  // 戦闘
  attack:  [{ f: 320, d: 0.07, t: 'sawtooth', g: 0.2, df: 120 }],
  special: [{ f: 523, d: 0.05, t: 'square', g: 0.2 }, { f: 659, d: 0.05, t: 'square', g: 0.2 }, { f: 880, d: 0.10, t: 'square', g: 0.2 }],
  damage:  [{ f: 180, d: 0.10, t: 'square', g: 0.18, df: 90 }],
  heal:    [{ f: 523, d: 0.06, t: 'sine', g: 0.18 }, { f: 784, d: 0.10, t: 'sine', g: 0.18 }],
  // ごほうび系
  levelup: [{ f: 523, d: 0.08, t: 'square', g: 0.2 }, { f: 659, d: 0.08, t: 'square', g: 0.2 }, { f: 784, d: 0.08, t: 'square', g: 0.2 }, { f: 1046, d: 0.18, t: 'square', g: 0.2 }],
  treasure:[{ f: 784, d: 0.08, t: 'square', g: 0.2 }, { f: 1046, d: 0.08, t: 'square', g: 0.2 }, { f: 1318, d: 0.16, t: 'square', g: 0.2 }],
  victory: [{ f: 523, d: 0.10, t: 'square', g: 0.22 }, { f: 659, d: 0.10, t: 'square', g: 0.22 }, { f: 784, d: 0.10, t: 'square', g: 0.22 }, { f: 1046, d: 0.26, t: 'square', g: 0.22 }],
  defeat:  [{ f: 392, d: 0.14, t: 'sawtooth', g: 0.2, df: 196 }, { f: 196, d: 0.22, t: 'sawtooth', g: 0.2, df: 98 }],
};

// AudioContext を必要時に生成（無い環境では null のまま）
function _srpgEnsureCtx() {
  if (_srpgAudioCtx) return _srpgAudioCtx;
  if (typeof window === 'undefined') return null;
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { _srpgAudioCtx = new Ctx(); } catch (e) { _srpgAudioCtx = null; }
  return _srpgAudioCtx;
}

// 1音符を指定時刻に鳴らす（エンベロープ付きでプチノイズを防ぐ）
function _srpgPlayNote(ctx, note, startAt) {
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  var g = (typeof note.g === 'number') ? note.g : 0.18;
  var dur = note.d || 0.08;
  osc.type = note.t || 'square';
  osc.frequency.setValueAtTime(note.f, startAt);
  if (typeof note.df === 'number') {
    osc.frequency.linearRampToValueAtTime(note.df, startAt + dur);
  }
  // 立ち上がり/減衰を付けてクリックノイズを消す
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(g, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

// SE を鳴らす。window/AudioContext が無い・ミュート時は何もしない（Node 安全）。
function playSe(name) {
  if (_srpgAudioMuted) return;
  var seq = SRPG_SE[name];
  if (!seq) return;
  var ctx = _srpgEnsureCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    var at = ctx.currentTime + 0.001;
    for (var i = 0; i < seq.length; i++) {
      _srpgPlayNote(ctx, seq[i], at);
      at += (seq[i].d || 0.08);
    }
  } catch (e) { /* 音が出なくてもゲームは止めない */ }
}

// iOS Safari 対策：最初のユーザー操作（タッチ/キー/クリック）で AudioContext を resume。
// rAF ループ内からの生成だけだと iOS は suspended のままになるため、本物のジェスチャで解錠する。
function _srpgUnlock() {
  var ctx = _srpgEnsureCtx();
  if (!ctx) return;
  try { if (ctx.resume) ctx.resume(); } catch (e) { /* noop */ }
  _srpgAudioUnlocked = true;
}

function initAudio() {
  if (typeof window === 'undefined') return;
  var handler = function () { _srpgUnlock(); };
  // once ではなく毎回 resume（途中で suspended に戻る端末対策）。軽いので問題なし。
  window.addEventListener('touchend', handler, { passive: true });
  window.addEventListener('pointerup', handler, { passive: true });
  window.addEventListener('keydown', handler);
}

function setSeMuted(b) { _srpgAudioMuted = !!b; }
function isSeMuted() { return _srpgAudioMuted; }

// ── BGM（ループ再生する簡易ステップ・シーケンサ）────────────────────────
// SE と同じく音声ファイルは一切持たず、その場で音符を鳴らす＝サイズ増ゼロ。
// setInterval で「1ステップずつ」進み、各ステップの melody/bass を鳴らす。
// window/AudioContext が無い Node では ctx が null なので鳴らず、タイマも張らない。
// 識別子は SE と衝突しないよう接頭辞 _srpgBgm / SRPG_BGM を付ける（鉄則①）。
var _srpgBgmTimer  = null;   // 現在動いている setInterval のハンドル
var _srpgBgmName   = null;   // 鳴らしたい曲名（ミュート中でも覚えておく）
var _srpgBgmStep   = 0;      // ループ内の現在ステップ
var _srpgBgmMuted  = false;  // BGM ミュート状態（SE とは独立）

// 曲データ：name → { step:1ステップ秒, mel:[Hz|0...], bass:[Hz|0...], 各種音色/音量 }。
// 0 は休符。mel と bass は長さが違っても各自 % で回る。子ども向けに明るく短め。
var SRPG_BGM = {
  // タイトル：堂々としたヒーロー曲
  title: {
    step: 0.19, melType: 'square', bassType: 'triangle',
    melGain: 0.09, bassGain: 0.07, melDur: 0.17, bassDur: 0.20,
    mel:  [523, 659, 784, 659, 587, 494, 523, 0, 659, 784, 988, 784, 698, 587, 523, 0],
    bass: [131, 0, 131, 0, 98, 0, 98, 0, 110, 0, 110, 0, 175, 0, 196, 0],
  },
  // フィールド：軽快なぼうけんの曲（歩くテンポ）
  field: {
    step: 0.16, melType: 'square', bassType: 'triangle',
    melGain: 0.08, bassGain: 0.06, melDur: 0.14, bassDur: 0.18,
    mel:  [392, 440, 494, 523, 494, 440, 392, 330, 349, 392, 440, 392, 330, 294, 262, 0],
    bass: [131, 0, 196, 0, 110, 0, 196, 0, 174, 0, 196, 0, 131, 0, 98, 0],
  },
  // 町：ほっとするやさしい曲
  town: {
    step: 0.22, melType: 'triangle', bassType: 'sine',
    melGain: 0.09, bassGain: 0.06, melDur: 0.20, bassDur: 0.26,
    mel:  [523, 0, 494, 0, 440, 0, 494, 0, 523, 0, 587, 0, 523, 0, 0, 0],
    bass: [131, 0, 0, 0, 175, 0, 0, 0, 196, 0, 0, 0, 131, 0, 0, 0],
  },
  // ダンジョン：ふしぎで少しドキドキ（怖すぎない）
  dungeon: {
    step: 0.24, melType: 'triangle', bassType: 'sine',
    melGain: 0.08, bassGain: 0.07, melDur: 0.22, bassDur: 0.30,
    mel:  [330, 0, 392, 0, 349, 0, 0, 0, 294, 0, 330, 0, 262, 0, 0, 0],
    bass: [98, 0, 0, 0, 87, 0, 0, 0, 82, 0, 0, 0, 98, 0, 0, 0],
  },
  // バトル：わくわくする速い曲
  battle: {
    step: 0.13, melType: 'square', bassType: 'sawtooth',
    melGain: 0.09, bassGain: 0.07, melDur: 0.11, bassDur: 0.12,
    mel:  [440, 523, 659, 523, 587, 0, 523, 440, 392, 466, 587, 466, 440, 0, 0, 0],
    bass: [110, 110, 110, 110, 98, 98, 98, 98, 87, 87, 87, 87, 110, 0, 110, 0],
  },
};

// 動いているタイマを止める（曲データや曲名は消さない）。
function _srpgBgmStop() {
  if (_srpgBgmTimer !== null && typeof clearInterval !== 'undefined') {
    clearInterval(_srpgBgmTimer);
  }
  _srpgBgmTimer = null;
}

// 現在の _srpgBgmName の曲を（先頭でなく現在ステップから）鳴らし始める。
function _srpgBgmStart() {
  _srpgBgmStop();
  if (_srpgBgmMuted) return;
  var song = SRPG_BGM[_srpgBgmName];
  if (!song) return;
  var ctx = _srpgEnsureCtx();
  if (!ctx || typeof setInterval === 'undefined') return;  // Node は ctx=null で張らない
  var stepMs = (song.step || 0.18) * 1000;
  _srpgBgmTimer = setInterval(function () {
    if (_srpgBgmMuted) return;
    try {
      var c = _srpgEnsureCtx();
      if (!c) return;
      if (c.state === 'suspended' && c.resume) c.resume();
      var at = c.currentTime + 0.001;
      var mel = song.mel || [];
      var mf = mel[_srpgBgmStep % mel.length];
      if (mf) _srpgPlayNote(c, { f: mf, d: (song.melDur || 0.16), t: (song.melType || 'square'), g: (song.melGain || 0.09) }, at);
      var bass = song.bass;
      if (bass && bass.length) {
        var bf = bass[_srpgBgmStep % bass.length];
        if (bf) _srpgPlayNote(c, { f: bf, d: (song.bassDur || 0.22), t: (song.bassType || 'triangle'), g: (song.bassGain || 0.07) }, at);
      }
      _srpgBgmStep++;
    } catch (e) { /* 鳴らなくてもゲームは止めない */ }
  }, stepMs);
}

// 曲を切り替える。同じ曲が既に鳴っていれば何もしない（毎フレーム呼んでも安全）。
function playBgm(name) {
  if (_srpgBgmName === name && _srpgBgmTimer !== null) return;
  _srpgBgmName = name;
  _srpgBgmStep = 0;
  _srpgBgmStart();
}

// BGM を完全停止する。
function stopBgm() {
  _srpgBgmName = null;
  _srpgBgmStop();
}

function setBgmMuted(b) {
  _srpgBgmMuted = !!b;
  if (_srpgBgmMuted) _srpgBgmStop();
  else if (_srpgBgmName) _srpgBgmStart();
}
function isBgmMuted() { return _srpgBgmMuted; }

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, {
  playSe: playSe,
  initAudio: initAudio,
  setSeMuted: setSeMuted,
  isSeMuted: isSeMuted,
  SRPG_SE: SRPG_SE,
  playBgm: playBgm,
  stopBgm: stopBgm,
  setBgmMuted: setBgmMuted,
  isBgmMuted: isBgmMuted,
  SRPG_BGM: SRPG_BGM,
});
