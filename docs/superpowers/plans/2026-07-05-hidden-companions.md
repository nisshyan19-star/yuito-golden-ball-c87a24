# 隠し仲間3人（げんす／ミキティー／ナナカ）追加 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サッカーRPG「ユイトと黄金のサッカーボール」に、隠しマップで加入する3人の仲間（最強の助っ人げんす／攻撃特化のミキティー／必殺技だけ最強のナナカ）を、ステータス・とくぎ・加入導線・ミニマップ表示・AIアート込みで追加する。

**Architecture:** 既存の仲間システム（`CHARACTERS`＋`SKILLS`＋`joinAlly`＋join NPC＋roster）を素直に拡張する。パーティ上限を5→4へ下げ、5人目以降は自動でroster（控え）へ回す。3人はそれぞれ章別の隠し部屋（新マップ）に置いた join NPC から加入。隠し部屋の入口ワープはミニマップに常時表示する。アートは立ち絵（`ally-art.js`）と歩行3方向（`walk-art.js`）をAI生成し、既存の登録済みファイルへ base64 で注入する。

**Tech Stack:** 素の JavaScript（UMDパターン）、`node build.js`で単一`index.html`へバンドル、`node --test`（node:test）でTDD。ChatGPT（ブラウザ）でAIアート生成、`scratchpad/alpha_bg.py`で透過化、`scratchpad/gen_walk_art.js`でbase64注入。

**重要な制約（厳守）:**
- `build.js`は編集不可・**新規ファイル追加不可**。新データは既存の登録済みファイルへ追記する。
- atk上限32は`star_boots`/`star_mail`装備のみ。レベルアップ成長は上限なし → ミキティー base atk32 / growth atk3 は有効。
- 各コード変更後は該当テストを実行。最終Task 10で決定論ビルド（`md5 -q index.html`×2一致）＋`node --test`全PASSを確認。
- **本番pushはげんちゃんが「Pushして！」と言うまで絶対にしない。**
- 全Bashコマンドの先頭に必ず: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"` を付ける。作業ディレクトリは `/Users/gensu/Claud Code/soccer-rpg-yuito`（Bashはcwdが毎回リセットされるので絶対パス or cd を使う）。

**ベースライン（本ブランチ`feat/hidden-companions`の開始時点）:** `md5 21e41169d6b0d6b2be36369ddf50a431` / size 20486249 bytes / `node --test` 690 tests PASS。

**ステータス表（spec確定値）:**

| ID | 名前 | position | type | hp | mp | atk | def | spd | growth(hp/mp/atk/def/spd) | joinChapter | skills |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gensu | ゲンス | 助っ人(FW) | power | 42 | 14 | 30 | 12 | 11 | 8/3/2/2/1 | 3 | dark_drive, ult_gensu |
| mikity | ミキティー | 攻撃特化(FW) | speed | 30 | 12 | 32 | 5 | 12 | 6/2/3/1/2 | 1 | siren_shot, ult_mikity |
| nanaka | ナナカ | わがまま(FW) | power | 20 | 10 | 4 | 4 | 6 | 4/2/1/1/1 | 2 | poka_punch, ult_nanaka |

**とくぎ表（spec確定値）:**

| ID | 名前 | user | mp | type | power | target | kiai | learnLevel |
|---|---|---|---|---|---|---|---|---|
| dark_drive | ダーク・ドライブ | gensu | 5 | attack | 2.0 | one | — | 1 |
| siren_shot | セイレーン・ショット | mikity | 5 | attack | 2.0 | one | — | 1 |
| poka_punch | ぽかぽかパンチ | nanaka | 2 | attack | 0.6 | one | — | 1 |
| ult_gensu | バイオレット・エンペラー | gensu | 0 | attack | 3.8 | one | 100 | null |
| ult_mikity | セイレーン・ブレイズ | mikity | 0 | attack | 3.6 | one | 100 | null |
| ult_nanaka | イヤイヤ期 | nanaka | 0 | attack | 5.0 | all | 100 | null |

（ult_nanaka power5.0 は現行最大 combo_tomoki 4.8 を超えるゲーム内最大。target:'all' の kiai必殺は ult_aoshi で実績あり。）

**隠し部屋・加入導線（配置確定値）:**

| 章 | 親マップ | 入口ワープ座標 | 隠しマップID | 加入キャラ | vanishFlag |
|---|---|---|---|---|---|
| 1章 | cave1（ほのおの どうくつ） | (2,9) | cave1_secret | mikity | joined_mikity |
| 2章 | tower_ice_2f（こおりの とう 2かい） | (2,11) | tower_ice_secret | nanaka | joined_nanaka |
| 3章 | nebula_f2（ネビュラごう 第2フロア） | (2,11) | nebula_secret | gensu | joined_gensu |

---

## Task 1: パーティ上限 5→4 ＋ full_party/captain判定の合計化 ＋ 既存テスト修正

**Files:**
- Modify: `src/logic/monster.js:5-7`
- Modify: `src/core/game-state.js:124`
- Test: `tests/monster.test.js:5-7, 142-157`

**背景:** `maxParty()`を4にすると`addToRoster`/`joinAlly`経由でpartyは最大4人（リーダー＋3）までしか増えず、5人目以降はroster（控え）へ回る。ここで実績`full_party`（`party.length>=5`）と称号`captain`（req:full_party）が**永久取得不能**になる。判定を「party＋roster合計>=5」に変え、"仲間5人集めた"という意図を保つ。

- [ ] **Step 1: 失敗するテストへ更新（monster.test.js の maxParty と addToRoster）**

`tests/monster.test.js` の該当3テストを次に置き換える。

5-7行目:
```js
test('maxParty() === 4', () => {
  assert.strictEqual(maxParty(), 4);
});
```

142-157行目（addToRoster の2テスト）:
```js
test('addToRoster: party 3人 → "party" に入る', () => {
  const char = { id:'mon_mon', name:'モン', type:'power', level:1, hp:30, maxHp:30, atk:8, def:5, spd:6, isMonster:true };
  const state = { party: [{},{},{}], inventory:{}, gold:0, flags:{} };
  const result = addToRoster(state, char);
  assert.strictEqual(result, 'party');
  assert.strictEqual(state.party.length, 4);
});

test('addToRoster: party 4人（満杯）→ "roster" に入る', () => {
  const char = { id:'mon2_mon', name:'モン2', type:'speed', level:1, hp:20, maxHp:20, atk:5, def:3, spd:12, isMonster:true };
  const state = { party: [{},{},{},{}], inventory:{}, gold:0, flags:{} };
  const result = addToRoster(state, char);
  assert.strictEqual(result, 'roster');
  assert.ok(Array.isArray(state.roster));
  assert.strictEqual(state.roster.length, 1);
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/monster.test.js`
Expected: FAIL（`maxParty()===4`・addToRosterの2件が現状の5前提コードで落ちる）

- [ ] **Step 3: 実装（maxParty=4 と full_party合計判定）**

`src/logic/monster.js` 5-7行目:
```js
function maxParty() {
  return 4;
}
```

`src/core/game-state.js` 124行目（`full_party`実績の`check`）を次へ:
```js
  { id:'full_party',    name:'さいきょうの チーム',     desc:'なかま 5にん あつめた',            check: function (s) { return (((s.party || []).length) + ((s.roster || []).length)) >= 5; } },
```

- [ ] **Step 4: テストが通るのを確認 ＋ swapInMonsterテストの巻き込みチェック**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/monster.test.js`
Expected: PASS（swapInMonster満杯テストは party5人=`5<4`false→入替枝で従来通り、空きテストは party3人=`3<4`true で従来通り。全PASS）

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/logic/monster.js src/core/game-state.js tests/monster.test.js && git commit -m "feat: パーティ上限5→4・full_party判定をparty+roster合計へ"
```

---

## Task 2: 新とくぎ6種を skills.js に追加

**Files:**
- Modify: `src/data/skills.js:29`（`ult_itsuki`の後、`};`の前に追記）
- Test: `tests/hidden-skills.test.js`（新規テストファイル・**tests配下は`build.js`のバンドル対象外なので追加可**）

**注意:** `src/`配下は`build.js`が拾うため新規ファイル不可。`tests/`配下はバンドル対象外なのでテストファイル新規作成は可（既存も個別ファイル運用）。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/hidden-skills.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { SKILLS } = require('../src/data/skills.js');

test('新とくぎ6種が定義されている', () => {
  ['dark_drive','siren_shot','poka_punch','ult_gensu','ult_mikity','ult_nanaka']
    .forEach((id) => assert.ok(SKILLS[id], `${id} が無い`));
});

test('通常とくぎの型（user/mp/power/target/learnLevel）', () => {
  assert.deepStrictEqual(
    { u:SKILLS.dark_drive.user, mp:SKILLS.dark_drive.mp, p:SKILLS.dark_drive.power, t:SKILLS.dark_drive.target, l:SKILLS.dark_drive.learnLevel, ty:SKILLS.dark_drive.type },
    { u:'gensu', mp:5, p:2.0, t:'one', l:1, ty:'attack' });
  assert.deepStrictEqual(
    { u:SKILLS.siren_shot.user, mp:SKILLS.siren_shot.mp, p:SKILLS.siren_shot.power, t:SKILLS.siren_shot.target, l:SKILLS.siren_shot.learnLevel },
    { u:'mikity', mp:5, p:2.0, t:'one', l:1 });
  assert.deepStrictEqual(
    { u:SKILLS.poka_punch.user, mp:SKILLS.poka_punch.mp, p:SKILLS.poka_punch.power, t:SKILLS.poka_punch.target, l:SKILLS.poka_punch.learnLevel },
    { u:'nanaka', mp:2, p:0.6, t:'one', l:1 });
});

test('必殺技の型（kiai100/mp0/learnLevel null）とナナカ全体最強', () => {
  assert.strictEqual(SKILLS.ult_gensu.power, 3.8);
  assert.strictEqual(SKILLS.ult_gensu.kiai, 100);
  assert.strictEqual(SKILLS.ult_gensu.mp, 0);
  assert.strictEqual(SKILLS.ult_gensu.learnLevel, null);
  assert.strictEqual(SKILLS.ult_mikity.power, 3.6);
  assert.strictEqual(SKILLS.ult_nanaka.target, 'all');
  assert.strictEqual(SKILLS.ult_nanaka.power, 5.0);
  // イヤイヤ期はゲーム内最大パワー（連携含む全skill/comboを上回る）
  const { COMBOS } = require('../src/data/skills.js');
  const allPowers = []
    .concat(Object.values(SKILLS).map((s) => s.power || 0))
    .concat(Object.values(COMBOS).map((c) => c.power || 0));
  assert.strictEqual(Math.max.apply(null, allPowers), 5.0);
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-skills.test.js`
Expected: FAIL（`dark_drive が無い`）

- [ ] **Step 3: 実装（skills.js の `ult_itsuki` 行の直後に追記）**

`src/data/skills.js` の29行目 `ult_itsuki: {...},` の直後（30行目 `};` の前）に挿入:
```js

  // ── 隠し仲間3人の とくぎ（2026-07-05追加） ──────────────────────────────
  dark_drive:  { id:'dark_drive',  name:'ダーク・ドライブ',       user:'gensu',  mp:5, type:'attack', power:2.0, target:'one', learnLevel:1 },
  siren_shot:  { id:'siren_shot',  name:'セイレーン・ショット',   user:'mikity', mp:5, type:'attack', power:2.0, target:'one', learnLevel:1 },
  poka_punch:  { id:'poka_punch',  name:'ぽかぽかパンチ',         user:'nanaka', mp:2, type:'attack', power:0.6, target:'one', learnLevel:1 },
  // 必殺技（キアイMAXで解放・mp0・learnLevel:null）
  ult_gensu:   { id:'ult_gensu',   name:'バイオレット・エンペラー', user:'gensu',  mp:0, type:'attack', power:3.8, target:'one', kiai:100, learnLevel:null },
  ult_mikity:  { id:'ult_mikity',  name:'セイレーン・ブレイズ',   user:'mikity', mp:0, type:'attack', power:3.6, target:'one', kiai:100, learnLevel:null },
  ult_nanaka:  { id:'ult_nanaka',  name:'イヤイヤ期',             user:'nanaka', mp:0, type:'attack', power:5.0, target:'all', kiai:100, learnLevel:null },
```

- [ ] **Step 4: テストが通るのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-skills.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/data/skills.js tests/hidden-skills.test.js && git commit -m "feat: 隠し仲間3人のとくぎ6種(dark_drive/siren_shot/poka_punch＋必殺3種)追加"
```

---

## Task 3: 3キャラを characters.js に追加

**Files:**
- Modify: `src/data/characters.js:86`（`itsuki`エントリの後、`};`の前に追記）
- Test: `tests/hidden-characters.test.js`（新規）

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/hidden-characters.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { CHARACTERS } = require('../src/data/characters.js');

test('3キャラが定義され、ステータスがspec通り', () => {
  const g = CHARACTERS.gensu, m = CHARACTERS.mikity, n = CHARACTERS.nanaka;
  assert.ok(g && m && n, '3キャラのどれかが無い');
  assert.deepStrictEqual(g.base,   { hp:42, mp:14, atk:30, def:12, spd:11 });
  assert.deepStrictEqual(g.growth, { hp:8,  mp:3,  atk:2,  def:2,  spd:1  });
  assert.strictEqual(g.joinChapter, 3);
  assert.deepStrictEqual(g.skills, ['dark_drive','ult_gensu']);
  assert.deepStrictEqual(m.base,   { hp:30, mp:12, atk:32, def:5,  spd:12 });
  assert.deepStrictEqual(m.growth, { hp:6,  mp:2,  atk:3,  def:1,  spd:2  });
  assert.strictEqual(m.joinChapter, 1);
  assert.deepStrictEqual(n.base,   { hp:20, mp:10, atk:4,  def:4,  spd:6  });
  assert.strictEqual(n.joinChapter, 2);
});

test('ミキティーの攻撃力はゲンスより高い（げんちゃん指定）', () => {
  assert.ok(CHARACTERS.mikity.base.atk > CHARACTERS.gensu.base.atk);
});

test('profileブロックが揃っている（age/flavor/bio配列/dream）', () => {
  ['gensu','mikity','nanaka'].forEach((id) => {
    const p = CHARACTERS[id].profile;
    assert.ok(p && p.age && p.flavor && Array.isArray(p.bio) && p.bio.length >= 1 && p.dream, `${id} のprofile不備`);
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-characters.test.js`
Expected: FAIL（3キャラのどれかが無い）

- [ ] **Step 3: 実装（characters.js の `itsuki` エントリ直後、`};`の前に追記）**

`src/data/characters.js` 86行目 `  },`（itsuki終端）の直後に挿入:
```js
  gensu: {
    id:'gensu', name:'ゲンス', position:'助っ人(FW)', type:'power',
    base:   { hp:42, mp:14, atk:30, def:12, spd:11 },
    growth: { hp:8,  mp:3,  atk:2,  def:2,  spd:1  },
    skills: ['dark_drive', 'ult_gensu'],
    joinChapter: 3,
    profile: {
      age: 'なぞ',
      flavor: 'むらさきの かぜを まとう さいきょうの すけっと',
      bio: [
        'どこからともなく あらわれる、むらさき色の オーラを まとった なぞの ストライカー。',
        'ちからも まもりも けたちがい。ネビュラごうの おくで ユイトの ちからを みとめて てを かす。',
        'くちかずは すくないが、ピンチのときほど たよりになる ほんものの つよさ。',
      ],
      dream: 'ほんとうに つよい やつと たたかうこと',
    },
  },
  mikity: {
    id:'mikity', name:'ミキティー', position:'攻撃特化(FW)', type:'speed',
    base:   { hp:30, mp:12, atk:32, def:5,  spd:12 },
    growth: { hp:6,  mp:2,  atk:3,  def:1,  spd:2  },
    skills: ['siren_shot', 'ult_mikity'],
    joinChapter: 1,
    profile: {
      age: 'おとな',
      flavor: 'こうげきに すべてを かける あでやかな ストライカー',
      bio: [
        'ほのおの どうくつの おくに ひそむ、あでやかで おとなの ストライカー。',
        'まもりは よわいが、こうげき力は チームだれよりも たかい がんがん せめる アタッカー。',
        'いちど ねらった ゴールは ぜったいに はずさない、じしんに あふれた ひと。',
      ],
      dream: 'いちばん はでな ゴールを きめること',
    },
  },
  nanaka: {
    id:'nanaka', name:'ナナカ', position:'わがまま(FW)', type:'power',
    base:   { hp:20, mp:10, atk:4,  def:4,  spd:6  },
    growth: { hp:4,  mp:2,  atk:1,  def:1,  spd:1  },
    skills: ['poka_punch', 'ult_nanaka'],
    joinChapter: 2,
    profile: {
      age: 'あかちゃん',
      flavor: 'ふだんは よわいが おこると ゲームさいきょう',
      bio: [
        'ゆきぐにの おくに いた、ちいさな あかちゃんの ストライカー。',
        'ふだんの こうげきは とても よわいけれど、きげんを そこねると…。',
        '必殺技「イヤイヤ期」は てき ぜんたいを なぎはらう ゲームさいきょうの いちげき！',
      ],
      dream: 'ずっと ごきげんで いること',
    },
  },
```

- [ ] **Step 4: テストが通るのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-characters.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/data/characters.js tests/hidden-characters.test.js && git commit -m "feat: 隠し仲間3人(げんす/ミキティー/ナナカ)をcharacters.jsへ追加"
```

---

## Task 4: createCharacter が3キャラを生成できることの確認 ＋ NewGame+の_JOINABLE拡張

**Files:**
- Modify: `src/core/game-state.js:83`（`_JOINABLE`）
- Test: `tests/hidden-createchar.test.js`（新規）

**背景:** `createCharacter(id)`は`CHARACTERS[id].base`からステータスを組む汎用関数なので、Task 3で追加済みなら3キャラも生成できるはず。ここでそれを固定する。あわせて`createNewGamePlus`の`_JOINABLE`に3人を追加し、強くてニューゲームでパーティに引き継いだ隠し仲間の`joined_*`フラグが復元されるようにする。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/hidden-createchar.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const GS = require('../src/core/game-state.js');

test('createCharacter が gensu/mikity/nanaka を生成できる', () => {
  const g = GS.createCharacter('gensu');
  assert.strictEqual(g.id, 'gensu');
  assert.strictEqual(g.maxHp, 42);
  assert.strictEqual(g.atk, 30);
  assert.strictEqual(g.maxKiai, 100);
  assert.ok(g.skills.indexOf('ult_gensu') >= 0);
  const m = GS.createCharacter('mikity');
  assert.strictEqual(m.atk, 32);
  const n = GS.createCharacter('nanaka');
  assert.strictEqual(n.atk, 4);
});

test('NewGame+ の _JOINABLE に3人が含まれ、加入済みパーティのフラグが復元される', () => {
  // gensuを含むパーティで beat_kaiser 済みのセーブから NewGame+ を作る
  const prev = {
    party: [ GS.createCharacter('yuito'), GS.createCharacter('gensu') ],
    roster: [ GS.createCharacter('mikity') ],
    achievements: { beat_kaiser: true },
    titles: {},
  };
  const ng = GS.createNewGamePlus(prev);
  // 引き継いだ gensu/mikity の joined_* フラグが立っている（マップの加入NPCが再出現しない）
  assert.strictEqual(ng.flags['joined_gensu'], true);
  assert.strictEqual(ng.flags['joined_mikity'], true);
});
```

- [ ] **Step 2: テストを実行（1本目PASS・2本目FAIL想定）**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-createchar.test.js`
Expected: 1本目PASS（createCharacterは汎用なので既に通る）、2本目FAIL（`_JOINABLE`に3人が無く`joined_gensu`がundefined）
※ もし`createNewGamePlus`のシグネチャ／フラグ復元ロジックが想定と異なりFAILの理由が違う場合は、実装（game-state.js:83周辺のNewGame+実装）を読んで、_JOINABLEにキーを足す形へテストを合わせる。

- [ ] **Step 3: 実装（_JOINABLE に3人追加）**

`src/core/game-state.js` 83行目:
```js
  var _JOINABLE = { ikuma: true, aoshi: true, tomoki: true, itsuki: true, gensu: true, mikity: true, nanaka: true };
```

- [ ] **Step 4: テストが通るのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-createchar.test.js`
Expected: PASS（両方）

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/core/game-state.js tests/hidden-createchar.test.js && git commit -m "feat: NewGame+の_JOINABLEに隠し仲間3人を追加"
```

---

## Task 5: joinAlly を roster あふれ対応にする（addToRoster経由）＋ roster重複チェック

**Files:**
- Modify: `src/data/story.js:5-12`（`_monster()`リゾルバ追加）, `story.js:20`（重複チェックにroster追加）, `story.js:42`（push→addToRoster）
- Test: `tests/hidden-joinally.test.js`（新規）

**背景:** 現状`joinAlly`は(1)party配列のみで重複判定し(2)`state.party.push(ch)`で直接pushする。上限4を超える加入（例：必須加入イツキで4人埋まった後に隠し仲間が加わる）が来た場合、上限を無視してpartyが5人になってしまう。`addToRoster`経由にしてあふれをrosterへ回し、重複判定もrosterを含める。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/hidden-joinally.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { joinAlly } = require('../src/data/story.js');
const GS = require('../src/core/game-state.js');

function baseState() {
  return { party: [ GS.createCharacter('yuito') ], roster: [], flags: {} };
}

test('joinAlly: 上限4を超える加入はrosterへ回る', () => {
  const s = baseState();
  ['ikuma','aoshi','tomoki'].forEach((id) => joinAlly(s, id)); // party=4(満杯)
  assert.strictEqual(s.party.length, 4);
  const name = joinAlly(s, 'itsuki'); // 5人目→roster
  assert.ok(name);
  assert.strictEqual(s.party.length, 4, 'partyは上限4のまま');
  assert.strictEqual(s.roster.length, 1);
  assert.strictEqual(s.roster[0].id, 'itsuki');
  assert.strictEqual(s.flags['joined_itsuki'], true);
});

test('joinAlly: roster在籍キャラは二重加入しない', () => {
  const s = baseState();
  ['ikuma','aoshi','tomoki','itsuki'].forEach((id) => joinAlly(s, id)); // itsukiはroster
  assert.strictEqual(joinAlly(s, 'itsuki'), null, 'roster在籍なら再加入nullのはず');
  assert.strictEqual(s.roster.length, 1);
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-joinally.test.js`
Expected: FAIL（1本目：partyが5になる／2本目：roster在籍を検知できず二重加入）

- [ ] **Step 3: 実装（story.js 3点の変更）**

(a) `src/data/story.js` の`_progression()`関数（9-12行目）の直後に`_monster()`リゾルバを追加:
```js
function _monster() {
  if (typeof require !== 'undefined') return require('../logic/monster.js');
  return (typeof window !== 'undefined' && window.SRPG) || {};
}
```

(b) 20行目の重複チェックをroster込みに:
```js
  if (!Array.isArray(state.roster)) state.roster = [];
  if (state.party.concat(state.roster).some(function (p) { return p.id === id; })) return null;
```

(c) 42行目 `state.party.push(ch);` を:
```js
  var MO = _monster();
  if (MO.addToRoster) { MO.addToRoster(state, ch); }
  else { state.party.push(ch); }
```

- [ ] **Step 4: テストが通るのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-joinally.test.js tests/story.test.js`
Expected: PASS（既存story.testも巻き込み破壊が無いこと）

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/data/story.js tests/hidden-joinally.test.js && git commit -m "feat: joinAllyをroster対応化(上限超過は控えへ・重複判定にroster含める)"
```

---

## Task 6: 歩行スプライト左右反転（walkSideFlip）の3キャラ回帰テスト

**Files:**
- Modify: `tests/walk-facing.test.js:20-36`
- （`src/scenes/field-scene.js`は原則変更なし。理由は下記）

**背景:** `walkSideFlip(id, facing)`は`var sideFacesRight = (id !== 'yuito'); return sideFacesRight ? (facing==='left') : (facing==='right');`。新3キャラは`yuito`ではないので「side素材＝右向き」扱い＝**AIアートを右向きで作れば既存ロジックのまま正しく動く**。よってコード変更は不要で、右向き前提のテストを追加して固定する。もしTask 9で生成した side アートがどうしても左向きになった場合のみ、field-scene.jsに左向き例外を足す（その場合はこのテストの期待も反転させる）。

- [ ] **Step 1: テストを追加（右向き前提）**

`tests/walk-facing.test.js` の21行目 `['ikuma', 'aoshi', 'tomoki', 'itsuki'].forEach(...)` の配列に3キャラを追加し、31行目 up/down ループの配列にも追加する。具体的には21行目を:
```js
['ikuma', 'aoshi', 'tomoki', 'itsuki', 'gensu', 'mikity', 'nanaka'].forEach((id) => {
```
に、31行目を:
```js
['yuito', 'ikuma', 'aoshi', 'tomoki', 'itsuki', 'gensu', 'mikity', 'nanaka'].forEach((id) => {
```
に変更する。

- [ ] **Step 2: テストを実行して通ることを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/walk-facing.test.js`
Expected: PASS（3キャラとも left→true / right→false / up・down→false。既存ロジックで既に成立）

- [ ] **Step 3: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add tests/walk-facing.test.js && git commit -m "test: 隠し仲間3人の歩行左右反転(右向き素材前提)の回帰テスト追加"
```

---

## Task 7: ミニマップに隠しマップ入口（warp）を紫マーカーで常時表示

**Files:**
- Modify: `src/scenes/field-scene.js`（`_drawMinimap()` の出口描画ループ 980-987 の直後に warp 描画ループを追加）
- Test: `tests/minimap-warp.test.js`（新規・純粋関数を切り出して検証）

**背景:** `_drawMinimap()`は`map.exits`を黄色`#ffd34d`で描くが`map.warps`は描かない。隠し部屋の入口はwarpなので、warpを紫`#d6aaff`で**最初から常時表示**する（げんちゃん指定「最初から常に表示」）。描画関数はcanvas依存でnodeテストしにくいため、「描くべきミニマップ点の配列」を返す純粋関数`minimapWarpDots(map, ox, oy, cell)`を切り出してテストし、`_drawMinimap`から呼ぶ。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/minimap-warp.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
global.window = global.window || {};
const S = require('../src/scenes/field-scene.js');

test('minimapWarpDots: map.warps の各座標を紫点として返す', () => {
  const map = { warps: [ { x:2, y:9, to:'cave1_secret' }, { x:5, y:5, tx:1, ty:1 } ] };
  const dots = S.minimapWarpDots(map, 100, 10, 4);
  assert.strictEqual(dots.length, 2);
  assert.strictEqual(dots[0].color, '#d6aaff');
  assert.strictEqual(dots[0].px, 100 + 2 * 4);
  assert.strictEqual(dots[0].py, 10 + 9 * 4);
});

test('minimapWarpDots: warps未定義でも空配列', () => {
  assert.deepStrictEqual(S.minimapWarpDots({}, 0, 0, 4), []);
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/minimap-warp.test.js`
Expected: FAIL（`S.minimapWarpDots is not a function`）

- [ ] **Step 3: 実装**

(a) `src/scenes/field-scene.js` に純粋関数を追加（`walkSideFlip`の近く、トップレベル`function`宣言として）:
```js
// ミニマップに描く「隠しマップ入口(warp)」の紫点リストを返す純粋関数。
// px/py はミニマップ左上原点(ox,oy)＋セルサイズcellでの画素座標。
function minimapWarpDots(map, ox, oy, cell) {
  var warps = (map && map.warps) || [];
  var dots = [];
  for (var i = 0; i < warps.length; i++) {
    var w = warps[i];
    dots.push({ px: ox + w.x * cell, py: oy + w.y * cell, color: '#d6aaff' });
  }
  return dots;
}
```

(b) `_drawMinimap()`内の出口描画ループ（980-987行目付近の黄色`#ffd34d`ループ）の直後に、warp紫点の描画を追加。既存の出口ループが使っている原点変数・セルサイズ変数（例：`ox`,`oy`,`cell`。実際の変数名は当該関数を読んで合わせる）で:
```js
      var warpDots = minimapWarpDots(map, ox, oy, cell);
      for (var wi = 0; wi < warpDots.length; wi++) {
        ctx.fillStyle = warpDots[wi].color;
        ctx.fillRect(warpDots[wi].px, warpDots[wi].py, cell, cell);
      }
```
※ ctx／原点／セル変数名は`_drawMinimap`実体に合わせること（出口ループの直前直後の変数をそのまま使う）。

(c) ファイル末尾のUMD export（`api`オブジェクト）に`minimapWarpDots: minimapWarpDots,`を追加。

- [ ] **Step 4: テストが通るのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/minimap-warp.test.js tests/walk-facing.test.js tests/join-cutin.test.js`
Expected: PASS（field-scene.jsを読む他テストも巻き込み破壊なし）

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/scenes/field-scene.js tests/minimap-warp.test.js && git commit -m "feat: ミニマップに隠しマップ入口(warp)を紫#d6aaffで常時表示"
```

---

## Task 8: 隠し部屋3マップ ＋ 加入NPC ＋ 入口ワープを maps.js に追加

**Files:**
- Modify: `src/data/maps.js`（cave1/tower_ice_2f/nebula_f2 の`warps`へ入口追加、`MAPS`へ隠しマップ3つ追加）
- Test: `tests/hidden-maps.test.js`（新規）

**背景:** 各親マップの床タイルに隠し部屋への入口`warp`（`to`付き）を置き、行き先の隠しマップ（新規MAPエントリ）に join NPC と帰りワープを置く。入口ワープはTask 7でミニマップに紫表示される。親マップの入口座標は歩ける床タイルであることを確認済み（cave1 (2,9)='c'、tower_ice_2f (2,11)='I'、nebula_f2 (2,11)='.'）。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/hidden-maps.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { MAPS } = require('../src/data/maps.js');

test('3つの隠しマップが存在する', () => {
  assert.ok(MAPS.cave1_secret, 'cave1_secret無し');
  assert.ok(MAPS.tower_ice_secret, 'tower_ice_secret無し');
  assert.ok(MAPS.nebula_secret, 'nebula_secret無し');
});

test('親マップに隠し部屋への入口warpがある', () => {
  const has = (map, to) => (map.warps || []).some((w) => w.to === to);
  assert.ok(has(MAPS.cave1, 'cave1_secret'), 'cave1→cave1_secret warp無し');
  assert.ok(has(MAPS.tower_ice_2f, 'tower_ice_secret'), 'tower_ice_2f→tower_ice_secret warp無し');
  assert.ok(has(MAPS.nebula_f2, 'nebula_secret'), 'nebula_f2→nebula_secret warp無し');
});

test('各隠し部屋に加入NPC（joinId＋vanishFlag＋joinStory）と帰りwarpがある', () => {
  const check = (mapId, joinId, vanishFlag, backTo) => {
    const map = MAPS[mapId];
    const npc = (map.npcs || []).find((n) => n.joinId === joinId);
    assert.ok(npc, `${mapId} に joinId=${joinId} のNPC無し`);
    assert.strictEqual(npc.vanishFlag, vanishFlag);
    assert.ok(Array.isArray(npc.joinStory) && npc.joinStory.length >= 1, `${mapId} joinStory不備`);
    assert.ok((map.warps || []).some((w) => w.to === backTo), `${mapId} 帰りwarp(${backTo})無し`);
  };
  check('cave1_secret', 'mikity', 'joined_mikity', 'cave1');
  check('tower_ice_secret', 'nanaka', 'joined_nanaka', 'tower_ice_2f');
  check('nebula_secret', 'gensu', 'joined_gensu', 'nebula_f2');
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-maps.test.js`
Expected: FAIL（cave1_secret無し）

- [ ] **Step 3a: 親マップに入口warpを追加**

`cave1`（886行〜）に`warps`配列が無ければ`exits`の直前に追加、あれば要素追加:
```js
    warps: [
      { x: 2, y: 9, to: 'cave1_secret', tx: 7, ty: 3, msg: 'いわの すきまから\nあやしい ひかりが もれている…\nなかへ すすんだ！' },
    ],
```
`tower_ice_2f`（1004行〜）の`exits`の直前に:
```js
    warps: [
      { x: 2, y: 11, to: 'tower_ice_secret', tx: 7, ty: 3, msg: 'こおりの かべの おくに\nかくしべやを みつけた！' },
    ],
```
`nebula_f2`（2534行〜）の`exits`の直前に:
```js
    warps: [
      { x: 2, y: 11, to: 'nebula_secret', tx: 7, ty: 3, msg: 'ふねの おくから\nむらさきの ひかりが もれている…\nなかへ すすんだ！' },
    ],
```

- [ ] **Step 3b: 隠しマップ3つを MAPS に追加**

`MAPS`オブジェクト内（`secret_field:`エントリの直後あたり、末尾`};`の前）に3マップを追加。共通の素の部屋（16列×12行・全床）テンプレで、加入NPC(7,6)＋帰りワープ(7,10)。

cave1_secret（ミキティー）:
```js
  cave1_secret: {
    id: 'cave1_secret',
    name: 'ほのおの おくのま',
    dark: true,
    grid: [
      '################', // r0
      '#..............#', // r1
      '#..............#', // r2
      '#..............#', // r3  到着(7,3)
      '#..............#', // r4
      '#..............#', // r5
      '#..............#', // r6  ミキティー(7,6)
      '#..............#', // r7
      '#..............#', // r8
      '#..............#', // r9
      '#..............#', // r10 帰りワープ(7,10)
      '################', // r11
    ],
    npcs: [
      {
        x: 7, y: 6, sprite: 'mikity', joinId: 'mikity', vanishFlag: 'joined_mikity',
        joinStory: [
          'ミキティー「あら、こんな おくまで\nよく きたわね。」',
          'ミキティー「わたしの こうげき力は\nチームだれにも まけないの。\nまもりは…にがてだけどね。」',
          'ミキティー「きみの チーム、きにいったわ。\nいちばん はでな ゴールを\nきめて あげる！」',
        ],
        pages: [
          'あら ユイト。わたしは ミキティー。',
          'こうげきに すべてを かける\nおとなの ストライカーよ。',
          'まもりは よわいけど、\nこうげき力なら だれにも まけないわ！',
          'いっしょに はでに あばれましょう！',
        ],
        afterPages: ['ミキティー「はでに きめるわよ！」'],
      },
    ],
    chests: [],
    objects: [],
    warps: [
      { x: 7, y: 10, to: 'cave1', tx: 4, ty: 9, msg: 'どうくつへ もどった。' },
    ],
    exits: [],
    encounter: { rate: 0, enemies: [] },
  },
```

tower_ice_secret（ナナカ）:
```js
  tower_ice_secret: {
    id: 'tower_ice_secret',
    name: 'こおりの おくのま',
    ambient: 'snow',
    grid: [
      '################', // r0
      '#..............#', // r1
      '#..............#', // r2
      '#..............#', // r3  到着(7,3)
      '#..............#', // r4
      '#..............#', // r5
      '#..............#', // r6  ナナカ(7,6)
      '#..............#', // r7
      '#..............#', // r8
      '#..............#', // r9
      '#..............#', // r10 帰りワープ(7,10)
      '################', // r11
    ],
    npcs: [
      {
        x: 7, y: 6, sprite: 'nanaka', joinId: 'nanaka', vanishFlag: 'joined_nanaka',
        joinStory: [
          'あかちゃん「…だぁ？」',
          'ナレーション「ゆきの おくに、ちいさな\nあかちゃんが ひとり すわっている。」',
          'ナレーション「ふだんは とても よわいが、\nおこると てが つけられない\nという うわさの ストライカーだ…！」',
          'ユイト「よし、いっしょに いこう、ナナカ！」',
        ],
        pages: [
          'あかちゃん「…きゃっきゃ！」',
          'ナナカは ユイトに だっこ された。',
          'ふだんの こうげきは よわいけれど、\nきげんを そこねると 必殺技\n「イヤイヤ期」で てき ぜんたいを なぎはらう！',
        ],
        afterPages: ['ナナカ「…だぁー！（ごきげん）」'],
      },
    ],
    chests: [],
    objects: [],
    warps: [
      { x: 7, y: 10, to: 'tower_ice_2f', tx: 4, ty: 11, msg: 'とうの なかへ もどった。' },
    ],
    exits: [],
    encounter: { rate: 0, enemies: [] },
  },
```

nebula_secret（げんす）:
```js
  nebula_secret: {
    id: 'nebula_secret',
    name: 'ネビュラ かくしブリッジ',
    ambient: 'embers',
    grid: [
      '################', // r0
      '#..............#', // r1
      '#..............#', // r2
      '#..............#', // r3  到着(7,3)
      '#..............#', // r4
      '#..............#', // r5
      '#..............#', // r6  ゲンス(7,6)
      '#..............#', // r7
      '#..............#', // r8
      '#..............#', // r9
      '#..............#', // r10 帰りワープ(7,10)
      '################', // r11
    ],
    npcs: [
      {
        x: 7, y: 6, sprite: 'gensu', joinId: 'gensu', vanishFlag: 'joined_gensu',
        joinStory: [
          'むらさきの オーラを まとった\nおとこが しずかに たっている。',
          'ゲンス「…ここまで きたか。\nおまえの たたかい、みていたぞ。」',
          'ゲンス「くだらぬ あくには\nくみしない。だが おまえには\nほんものの つよさを かんじた。」',
          'ゲンス「いいだろう。この ゲンス、\nおまえに ちからを かす。」',
        ],
        pages: [
          'おれの なは ゲンス。\nむらさきの かぜを まとう すけっとだ。',
          'ちからも まもりも、おまえたちの\nたすけに なるだろう。',
          'ただし なれあいは しない。\nほんきで ゴールを めざす やつにだけ\nちからを かす。',
          'いくぞ、ユイト。せかいの さきへ。',
        ],
        afterPages: ['ゲンス「…ゆくぞ。」'],
      },
    ],
    chests: [],
    objects: [],
    warps: [
      { x: 7, y: 10, to: 'nebula_f2', tx: 4, ty: 11, msg: 'ブリッジへ もどった。' },
    ],
    exits: [],
    encounter: { rate: 0, enemies: [] },
  },
```

- [ ] **Step 4: テストが通るのを確認 ＋ 既存マップテスト巻き込み確認**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test tests/hidden-maps.test.js tests/maps.test.js`
Expected: PASS（既存maps.testが到達性・grid整合などを検査していれば併せてPASS。もし新マップに整合性ルール（grid幅一致・出入口対応等）を要求していればエラー内容に従い修正）

- [ ] **Step 5: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/data/maps.js tests/hidden-maps.test.js && git commit -m "feat: 隠し部屋3マップ＋加入NPC＋入口/帰りワープを追加"
```

---

## Task 9: AIアート生成（立ち絵3＋歩行9）と ally-art.js / walk-art.js への注入

**Files:**
- Modify: `src/data/ally-art.js`（`gensu`/`mikity`/`nanaka` の立ち絵 base64 を追加）
- Modify: `src/data/walk-art.js`（`<id>_down`/`<id>_up`/`<id>_side` の9キーを追加）
- 生成補助（scratchpad・非バンドル）: `scratchpad/alpha_bg.py`, `scratchpad/gen_walk_art.js`

**担当:** この工程はブラウザ(ChatGPT)操作が必要なため、subagentではなくコーディネーター（メイン）が実行する。

**アート要件（spec）:**
- **げんす:** 紫ベースのダークで強そうな大人。立ち絵はモンスト風・アルファ付き。歩行3方向（down=正面/up=後ろ/side=**右向き**）。
- **ミキティー:** 色っぽい大人の女性・攻撃特化らしい華やかさ。歩行side=右向き。
- **ナナカ:** 赤ちゃん女の子の見た目・かわいい。歩行side=右向き。
- **共通:** side素材は必ず**右向き**で生成（Task 6のwalkSideFlip前提）。生成後、down/up/sideが取り違え・左右反転していないか目視で最終チェック（げんちゃん厳命）。

- [ ] **Step 1: 立ち絵3枚をChatGPTで生成 → DL → 透過**

各キャラの立ち絵をChatGPTで生成（白背景・全身・アルファ想定）。最後のturn内`img`の`src`を直接fetchでDL → md5でユニーク確認 → `scratchpad/alpha_bg.py <in.png> <out.png> 238` で四隅連結の白のみα0化 → 立ち絵サイズ（既存ally-artに合わせる。基準は後述Step 3で既存値を読んで一致させる）。

- [ ] **Step 2: 歩行9枚（3キャラ×down/up/side）を生成 → DL → 透過 → 縮小**

各キャラ3方向をChatGPTで生成（sideは右向き）。DL→md5ユニーク確認→`alpha_bg.py`透過→歩行アイコンサイズへ縮小（既存walk-artの1枚を読んで同寸へ）。素材は`scratchpad/cut/walk_<id>_<dir>.png`へ配置。

- [ ] **Step 3: ally-art.js に立ち絵3体を注入**

`src/data/ally-art.js`の`ALLY_ART`オブジェクトに、既存エントリ（yuito等）と同じ形式で`gensu`/`mikity`/`nanaka`のbase64を追加。既存の1体を読んでキー名・data URI接頭辞（`data:image/png;base64,`の有無）・改行有無を完全一致させる。

- [ ] **Step 4: walk-art.js に歩行9キーを注入**

`scratchpad/gen_walk_art.js`（`scratchpad/cut/walk_<key>.png`を読みbase64化して`WALK_ART`へマージするスクリプト）の`ADD`配列に9キー（`gensu_down`,`gensu_up`,`gensu_side`,`mikity_down`,…,`nanaka_side`）を指定して実行し、`src/data/walk-art.js`へ追記する。既存キーのdata URI形式に一致させる。

- [ ] **Step 5: アートの目視最終チェック（左右反転・取り違え）**

生成・注入した全12枚をReadで目視確認:
- sideが右向きか（左向きなら作り直し or Task 6ロジック例外を検討）
- down=正面／up=後ろ が取り違っていないか
- 3キャラそれぞれ別人の絵になっているか（他キャラ流用ゼロ＝md5ユニーク）
問題があれば当該キャラのみ再生成して差し替える。

- [ ] **Step 6: コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add src/data/ally-art.js src/data/walk-art.js && git commit -m "feat: 隠し仲間3人の立ち絵3＋歩行9アート(AI生成・右向きside)を注入"
```

---

## Task 10: 決定論ビルド ＋ 全テストPASS ＋ 巻き込み修復

**Files:**
- Generate: `index.html`（`node build.js`）
- Verify: 全`tests/*.test.js`

- [ ] **Step 1: 全テストを実行し、巻き込み破壊を洗い出す**

Run: `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node --test`
Expected: 全PASS（690＋新規追加分）。maxParty=4変更で`full_party`/`captain`関連や、party.length前提の他テストが落ちていないか確認。落ちていれば内容を読み、**仕様通りの期待値へテストを修正**（実装は変えない。ただしバグが露呈した場合はsystematic-debuggingで根本対応）。

- [ ] **Step 2: 決定論ビルドを2回実行してmd5一致を確認**

Run:
```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && node build.js && A=$(md5 -q index.html) && node build.js && B=$(md5 -q index.html) && echo "md5_1=$A md5_2=$B size=$(wc -c < index.html)" && [ "$A" = "$B" ] && echo "DETERMINISTIC_OK" || echo "MISMATCH"
```
Expected: `DETERMINISTIC_OK`（2回のmd5一致）。ベースライン`21e41169…`からは変化しているのが正しい（機能追加＋アート増分）。

- [ ] **Step 3: 実機スモーク（任意・可能なら）**

`index.html`をブラウザで開き、①ミニマップに紫の入口マーカーが最初から出る ②各隠し部屋へ入って3人が加入する ③歩行の向きが自然 ④イヤイヤ期が敵全体に当たる、を確認。

- [ ] **Step 4: 最終コミット**

```bash
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; cd "/Users/gensu/Claud Code/soccer-rpg-yuito" && git add index.html && git commit -m "build: 隠し仲間3人実装の決定論ビルド(index.html)・全テストPASS"
```

- [ ] **Step 5: 完了報告（pushはしない）**

決定論md5・テスト数・追加内容をげんちゃんへ報告。**「Pushして！」があるまで本番pushしない。**

---

## Self-Review（プラン自己点検・記録）

- **spec網羅:** ①上限4化＝Task1 ②げんす/ミキティー/ナナカのステータス＝Task3 ③ミキティーatk>げんす＝Task3テスト ④とくぎ6種・イヤイヤ期全体最強＝Task2 ⑤加入導線(章別隠し部屋)＝Task8 ⑥roster対応＝Task1/5 ⑦ミニマップ常時表示＝Task7 ⑧歩行左右反転チェック＝Task6/Task9 Step5 ⑨AIアート立ち絵＋歩行＝Task9 ⑩決定論ビルド＝Task10。全項目にタスク対応あり。
- **placeholder:** 実コード・実座標・実コマンドを全ステップに記載。Task9のみブラウザ操作依存のため手順ベース（既存の敵アート量産と同型の確立フロー）。
- **型整合:** `minimapWarpDots`（Task7で定義・同名でexport/テスト使用）、`_monster()`（Task5で定義・同関数呼び出し）、skills/characters/maps のID（gensu/mikity/nanaka・dark_drive等）は全タスクで一貫。
- **既知リスク:** (a) `_drawMinimap`内のctx/原点/セル変数名は実体に合わせる（Task7 Step3注記済）。(b) 既存maps.testが新マップに整合ルールを課す可能性（Task8 Step4で対応）。(c) NewGame+のフラグ復元ロジックが想定と違えばTask4 Step2注記に従いテスト側を実体へ合わせる。
