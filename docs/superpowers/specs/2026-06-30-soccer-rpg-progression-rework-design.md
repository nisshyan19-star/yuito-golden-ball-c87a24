# ストーリー進行ゲート＆難易度カーブ作り直し 設計書

> 2026-06-30 / げんちゃん依頼 / サッカーRPG「ユイトと黄金のサッカーボール」

## 1. 目的（げんちゃんの要望そのまま）

> 「今回追加してもらった各ダンジョンを回れるようにストーリー・シナリオや敵の強さの構成を作り直してほしい。小学生でも次にどこへ行けば良いか迷わないように、ストーリーを進めないと次のダンジョンなどへ行けないようにしてほしい。」

これを次の4点に分解する。

1. **追加ダンジョン（🔥ほのおのどうくつ／❄️こおりのとう）を、ストーリー順に必ず通る**ようにする。
2. **小学生（息子ユイト・9歳）が「次どこ行くの？」で絶対に迷わない**。常に行き先が1本道で示される。
3. **ストーリーを進めないと次のダンジョンへ行けない（ハードゲート）**。進行フラグで物理的に止める。
4. **敵の強さの構成（難易度カーブ）を新しい順序に合わせて作り直す**。

承認済みの方針（2026-06-30 げんちゃん「OK！すすめて！」）:
- **スコープ＝ハイブリッド**：目標システム＋ゲート＋難易度調整をフル実装。地理は原則そのままで、**🔥炎・❄️氷の2ダンジョンだけ**を正しい順序の本線上に最小移設する。🌿森の神殿・💧水の地底湖は「席だけ予約」（次フェーズ）で今は作らない。
- **道案内＝3本立て**（矢印は不採用）：(1) フィールド画面上部に常時「つぎの もくひょう」バー、(2) 各町に案内役NPC（コーチ）が現在の目標をしゃべる、(3) 鍵の門の lockedMsg が次の行き先を名指しする。
- **🔥炎ダンジョン＝序盤の「最初の試練」**：章1の最初に置く。敵を序盤レベルへ下げ、ボス magma_golem を「最初のボス」サイズに弱体化。
- **❄️氷ダンジョン＝章2、将軍（とうげ）の後・城（ラスボス）の前**：難易度が dark_general(HP230) と neo_kaiser(HP380) の間に自然に収まるので、ほぼ現状維持＋微調整。

---

## 2. 現状の問題点（調査で確定）

| # | 問題 | 根拠 |
|---|---|---|
| P1 | 🔥cave1 が最初の港町(town1)の村経由で**ノーゲートで入れる**のに、敵が中盤レベル(pk_punisher HP40 等)で序盤プレイヤーには強すぎる | maps.js cave1 encounter `0.10 [hand_monster,throwin_golem,losstime_ghost,stamina_zombie,pk_punisher]`、magma_golem HP200 |
| P2 | ❄️tower_ice が ch2_town の東門から**ノーゲートでぶら下がる**。将軍前でも入れてしまい、難易度(snow_yeti HP78〜ice_golem HP260)が浮く | maps.js:1690 `{x:14,y:8,to:'tower_ice_1f'...}` requireFlag 無し |
| P3 | 「次どこ行くの？」を示す**常設インジケータが無い**。分岐が無ラベルで多い（村・隠し部屋・アリーナ等） | フィールドHUDに目標表示が存在しない |

---

## 3. 新しい1本道（14ステップ・確定ルート）

```
【第1章 — 黄金のサッカーボールを取り戻せ】
 1. はじまりの草原 field1 ……… チュートリアル戦闘でレベル上げ
 2. ハーバータウン town1 ……… 案内コーチ「まずは みのりの村の おくの どうくつへ！」
 3. みのりの村 village1 ………… 買い物・宿。村人が炎の洞窟を案内
 4. 🔥ほのおの どうくつ cave1 …【最初の試練】ボス=マグマゴーレム(弱)→ boss_magma
        └─ クリアで town1→field2 のゲートが開く
 5. ナイタースタジアム field2 → サンドコート field3 → フォレストタウン town2
 6. レイニーピッチ field4 → スカイスタジアム field5
        └─ 入口に 🔒boss_guardian ゲート … キーパー(guardian)を倒すと先へ
 7. クラウドタウン town3
 8. ダークアリーナ field6
        └─ 🔒boss_kaiser … ダーク・カイザーを倒す＝第1章クリア

【第2章 — よみがえる闇】
 9. やみの もん ch2_gate（town3 北・🔒boss_kaiser で開通）→ ノルドタウン ch2_town
10. こおりの とうげ ch2_pass …… ボス=やみのしょうぐん ヴォルク → boss_dark_general
        └─ 倒すと ch2_town 東門の ❄️氷の塔ゲートが開く
11. ❄️こおりの とう tower_ice 1F→2F→3F …【第2の試練】ボス=アイスゴーレム → boss_ice
        └─ クリアで ch2_pass→ch2_castle のゲートが開く
12. やみのしろ ch2_castle …… ラスボス=ネオ・カイザー → boss_neo_kaiser ＝ 真エンディング

【おまけ（クリア後・寄り道。本線には絶対に出さない）】
13. でんせつのアリーナ legend_arena（エンペラー）／ちょうせんの間 challenge_room（ボスラッシュ）
14. ひみつのトレーニングルーム secret_field（稼ぎ）／隠しボス ファントム
```

ポイント：**本線は「炎 → (章1道中) → 氷 → 城」の完全1本道**。おまけは案内バーに出さず、案内NPCが「強くなったら挑戦してみよう」と別枠で触れるだけにする。

---

## 4. ゲート変更（maps.js・行番号と内容を確定）

「ストーリーを進めないと次へ行けない」を実現する核心。**3か所**だけ変える。

### 4-1. 🔥炎を最初の必須試練にする（town1 → field2 をロック）

- **対象**: `src/data/maps.js:670` — 現状 `{ x: 7, y: 16, to: 'field2', tx: 7, ty: 2 }`（ゲート無し）
- **変更**: `requireFlag: 'boss_magma'` を追加 ＋ lockedMsg を新設

```js
{ x: 7, y: 16, to: 'field2', tx: 7, ty: 2,
  requireFlag: 'boss_magma',
  lockedMsg: 'スタジアムへの みちは\nまだ とおれない。\nまずは みのりの村の おくにある\nほのおの どうくつで\nマグマゴーレムを たおそう！' },
```

→ ゲーム開始直後、唯一進める先が「村→炎の洞窟」になり、炎クリアで本線が開く。

### 4-2. ❄️氷を将軍クリア後に解禁（ch2_town 東門 → tower_ice をロック）

- **対象**: `src/data/maps.js:1690` — 現状 `{ x: 14, y: 8, to: 'tower_ice_1f', tx: 8, ty: 15 }`（ゲート無し）
- **変更**: `requireFlag: 'boss_dark_general'` を追加 ＋ lockedMsg を新設

```js
{ x: 14, y: 8, to: 'tower_ice_1f', tx: 8, ty: 15,
  requireFlag: 'boss_dark_general',
  lockedMsg: 'こおりの とうの とびらは\nこおりついて ひらかない。\nまずは こおりの とうげで\nやみの しょうぐん ヴォルクを\nたおそう！' },
```

- **注意**: `maps.js:917` `{ x: 8, y: 16, to: 'tower_ice_1f', tx: 8, ty: 2 }` は **tower_ice_2f→1F の戻り階段**であってマップ入口ではない。**触らない**（実装時に id を再確認し、ch2_town のexitだけにゲートを付ける）。

### 4-3. ❄️氷を城の前提条件にする（ch2_pass → ch2_castle のフラグ差し替え）

- **対象**: `src/data/maps.js:1759-1761` — 現状 `requireFlag: 'boss_dark_general'`
- **変更**: `requireFlag: 'boss_ice'` に差し替え ＋ lockedMsg を更新

```js
{ x: 7, y: 1, to: 'ch2_castle', tx: 7, ty: 15,
  requireFlag: 'boss_ice',
  lockedMsg: 'やみのしろの もんは かたい。\nこおりの とうの ぬし\nアイスゴーレムを たおせば\nひらく かもしれない…' },
```

→ これで「将軍 → 氷の塔 → 城」の順が**強制**される（氷を飛ばして城に行けない）。

### 4-4. おまけ部屋を「クリア後・寄り道」に明示（既存ゲートの確認のみ）

- challenge_room（ボスラッシュ）: 既に field6 側で `requireFlag: 'boss_kaiser'` ロック済み → **そのまま**（章1クリア後）。
- legend_arena（エンペラー HP280）: town3 から入口がノーゲート気味。**`requireFlag: 'boss_kaiser'` を追加**して章1クリア後の寄り道に固定する（実装時に該当exit行を特定して付与）。
- secret_field（稼ぎ・弱め）: town1 から序盤入れる。ゲートは付けないが、案内NPCが「特訓部屋（おまけ）」と説明し本線と混同させない。

---

## 5. 「つぎの もくひょう」目標システム（新規モジュール）

### 5-1. ロジック `src/logic/objective.js`（新規ファイル）

フラグ列から「今やるべき1つ」を返す純粋関数。テスト容易。

- 公開: `objectiveFor(flags)` → `{ text: string, place: string }` を返す。
- 判定は**上から順に最初に未達のものを返す**（1本道なので先頭一致でよい）：

```
未 boss_magma         → 「みのりの村の おくの ほのおの どうくつへ！」
未 boss_guardian      → 「スタジアムを すすんで キーパーを たおそう！」
未 boss_kaiser        → 「ダークアリーナで ダーク・カイザーを たおそう！」
未 boss_dark_general  → 「やみの もんを こえて こおりの とうげへ！」
未 boss_ice           → 「こおりの とうで アイスゴーレムを たおそう！」
未 boss_neo_kaiser    → 「やみのしろで ネオ・カイザーを たおせ！」
すべて達成            → 「せかいに へいわが もどった！…おまけに ちょうせんしよう」
```

- **鉄則①**：トップレベル識別子は `var` か一意名（接尾辞 `_T` 等）。既存と衝突する `const`/`let` を作らない。UMD で `objectiveFor` を export（既存 story.js と同じ書式に合わせる）。

### 5-2. HUD バー描画（field-scene.js に追加）

- フィールド画面の**上部に常時**横帯を描画し、`objectiveFor(state.flags).text` を「🎯 つぎ：◯◯」の形で表示。
- 既存のフィールド描画関数群に倣い、トップレベル `function _drawObjectiveBar(...)`（一意名）として追加。新 const は作らない（鉄則①）。
- 文字は子供向けにひらがな主体・最大2行・背景は半透明帯で視認性確保。

### 5-3. 案内役NPC（各町にコーチを1人）

- スプライトは有効キーの **`coach`** を使用（新スプライト不要）。
- 配置：town1 / village1 / ch2_town に1人ずつ（既存NPC枠を1つ追加 or 既存村人の台詞を差し替え）。
- 台詞＝`objectiveFor(state.flags).text` をその場で読み、「いまは ◯◯！」と案内。おまけ解禁後は「つよくなったら アリーナにも いけるよ」と添える。

---

## 6. 難易度カーブの作り直し（enemies.js / maps.js）

新順序での目標HP帯（弱→強・単調増加）。**炎を最前に持ってきた分の調整が主**で、他はほぼ据え置き。

| 順 | 場所 | ボス | 現HP | 新HP方針 |
|---|---|---|---|---|
| 4 | 🔥炎 cave1 | magma_golem | 200(+p2) | **95前後に弱体化**（最初のボス。guardian 120 より下）。第2形態は削除 or ごく軽く。exp240→**45前後**、報酬を控えめに |
| 6 | スカイ field5 | guardian | 120 | 据え置き |
| 8 | ダーク field6 | dark_kaiser | 160 | 据え置き |
| 10 | とうげ ch2_pass | dark_general | 230 | 据え置き |
| 11 | ❄️氷 tower_ice | ice_golem | 260(+p2) | 据え置き（将軍230と城380の間でピッタリ） |
| 12 | 城 ch2_castle | neo_kaiser | 380 | 据え置き（ラスボス） |

### 6-1. cave1 のザコを序盤化（maps.js cave1 encounter）

- 現: `rate 0.10 [hand_monster, throwin_golem, losstime_ghost, stamina_zombie, pk_punisher] rare metal_keeper 0.06`
- **新**: `rate 0.08 [foul_goblin, mud_slime, offside_ghost, corner_crow] rare { rate:0.04, enemies:['golden_ball'] }`
  - すべて Lv1〜3 帯の弱い敵。炎テーマ感は薄いが**最初の試練として安全**を最優先。
  - （任意・後述アート方針）余裕があれば炎テーマのザコを1〜2体だけ新規作成して差し込む。なくても成立。

### 6-2. magma_golem を「最初のボス」化（enemies.js）

- 現: `magma_golem hp200 atk22 def20 spd6 / p2 {hp+? atk30 def22 spd9} / art throwin_golem / exp240`
- **新**: `hp95 atk11 def8 spd6 / 第2形態なし / art throwin_golem 流用 / exp45 gold40`
  - guardian(hp120 atk12 def18) より明確に弱く、Lv2〜3 のパーティで勝てる。

### 6-3. 炎ボス報酬を控えめに（maps.js cave1 boss reward / items.js）

- 現報酬 `mithril_spike(atk26)` は序盤に強すぎる → **`spike2`(atk7) 程度**に差し替え（最初のボスらしい報酬）。
- mithril 系は中盤以降の別入手に温存（既存配置があればそのまま）。

### 6-4. 全体の単調性チェック

- field1→field6 のザコ帯は元から単調（Lv1→Lv6）なので据え置き。
- 章2 ch2_town→ch2_pass→tower_ice→ch2_castle も据え置きで単調。
- cave1 を序盤化したことで「序盤(炎) < field2〜6 < 章2」の山が崩れないことを実装時に通しプレイで確認。

---

## 7. アート方針（げんちゃん「追加キャラ画像があればChatGPTで作成も」）

- **原則：既存スプライトで足りる**。案内NPC=`coach`、マップ上のボス=`kaiser`、新ボスのバトル絵は art 流用（magma=throwin_golem / ice=metal_keeper）で成立済み。
- **追加で作るとしたら（任意・実装と並行・必須ではない）**：
  - 炎テーマのザコ1〜2体（cave1 用。なくても 6-1 で成立）。
  - 案内役コーチ専用のバトル/フィールド絵を新規化（今は既存 coach で十分）。
- **作る場合の手順**（既存ルール踏襲）：ChatGPTで生成→DL→`assets/` 相当へ→`enemy-art.js`/スプライト登録→build。**新規トップレベル識別子は一意名（鉄則①）**。アートは「必要になったらその場で作る・無理に増やさない」。
- ※ enemy-art.js は約5MBで全読み禁止。キーのみ grep で確認して追記する。

---

## 8. テスト `tests/progression-gates.test.js`（新規）

`tower-ice.test.js` をテンプレに、進行ゲートの作り直しを固定する。

- **ゲート存在**：
  - town1→field2 exit に `requireFlag === 'boss_magma'` と lockedMsg があること。
  - ch2_town 東門→tower_ice_1f exit に `requireFlag === 'boss_dark_general'` があること。
  - ch2_pass→ch2_castle exit が `requireFlag === 'boss_ice'`（boss_dark_general では**ない**こと）。
- **1本道の到達可能性（BFS）**：開始 field1 から、boss_magma 取得前は field2 以降に到達**できない**こと／取得後に到達**できる**こと（フラグ別 BFS）。
- **目標システム**：`objectiveFor({})` が炎を指す、`boss_magma` 立てると次（guardian）を指す、…全フラグ達成でおまけ文言、を順に検証。
- **難易度単調性**：本線ボスの HP が magma < guardian < dark_kaiser < dark_general < ice_golem < neo_kaiser の順であること。
- **おまけ隔離**：legend_arena 入口に `requireFlag === 'boss_kaiser'` があること。
- 既存テスト（tower-ice ほか）が**壊れない**こと。

---

## 9. 鉄則チェックリスト（着手前に必ず）

- [ ] `build.js` は**編集しない**（メインエージェントのみ／今回も触らない）。
- [ ] 全 `src/` は**1スコープに連結**される。新トップレベル `const`/`let` の名前衝突＝黒画面。一意名 or `var`、関数は一意名 `function _drawObjectiveBar` 等。
- [ ] maps.js トップレベルは `var TILE_LEGEND` と `var MAPS` のみ。新タイルは既存オブジェクト内に追記（今回タイル追加は無しの想定）。
- [ ] ボスの vanishFlag は `n.boss.vanishFlag` にネスト。NPC消滅判定は両方見る（今回ボス新規無し）。
- [ ] spawnEnemies / spawnForced は art:/drops: を両方コピー済み（敵の数値だけ変えるので追加対応不要）。
- [ ] 有効NPCスプライトは aoshi/coach/ikuma/itsuki/kaiser/keeper/shopkeep/tomoki の8種のみ。案内役は `coach`。
- [ ] 18×16超の新マップは無し（LARGE_MAPS 追記不要）。
- [ ] **検証**：`node build.js` → インラインscript抽出 `node --check` → 実ビルド `index.html` を `http://localhost:5599/index.html` で実機ロード（ルート`/`は罠）。preview_eval の引数名は `expression`。
- [ ] `node --test` 通過＝バンドル健全の証明には**ならない**。必ず実機確認。
- [ ] push は げんちゃんが「pushして」と言うまで**しない**。

---

## 10. 実装タスク順（writing-plans で詳細化する単位）

1. `src/logic/objective.js` 新規＋単体テスト（objectiveFor）。
2. enemies.js：magma_golem 弱体化。
3. maps.js：cave1 encounter 序盤化＋炎ボス報酬を spike2 に。
4. maps.js：3ゲート（670 / 1690 / 1759-1761）＋ legend_arena 入口ゲート。
5. field-scene.js：HUD「つぎの もくひょう」バー描画。
6. field-scene.js：案内NPC（coach）配置＋台詞＝objectiveFor。
7. `tests/progression-gates.test.js` 新規。
8. build＋実機通しプレイ（炎→…→氷→城が1本道で進み、飛ばせないこと）。
9. （任意）炎ザコのChatGPTアート追加。

各タスクは**一段ずつ実機で見せる**（げんちゃん確認）。

---

## 11. やらないこと（YAGNI）

- 🌿森の神殿・💧水の地底湖は**今回作らない**（席だけ予約。次フェーズ）。
- 地理の大改造はしない（炎・氷の本線編入と最小ゲートのみ）。
- 矢印ナビは入れない（バー＋NPC＋門メッセージの3本で足りる）。
- 既存の隠し要素（ファントム等）の仕様は変えない（おまけ枠のまま）。
