# 仲間加入必須化＋ストーリー充実 設計書（第3弾・物語編）

日付: 2026-07-02
対象: サッカーRPG「ユイトと黄金のサッカーボール」（単一 index.html バンドル）
発注: げんちゃん「仲間加入イベントが任意になっているので、仲間にしないと次へ進めないようにしてほしい！仲間が加入する際にイベントを追加するなど、全体的にストーリーをもっと充実させてほしい」

## 0. げんちゃん確定の設計判断（AskUserQuestion 2026-07-02）

1. **必須化方式 = 出口ロック方式**（field1〜4 の出口に requireFlag、目標バーが案内）
2. **加入演出 = 全部盛り**（AI立ち絵カットイン＋加入ファンファーレSE＋加入ミニストーリー）
3. **ストーリー充実 = 全4項目**（ボス撃破後の勝利イベント／仲間の伏線・チラ見せ／町の人の会話が進行で変化／章の転換カットシーン増強）

## 1. 現状の問題（調査済み）

- 仲間NPC 4人は道（中央 col7）から外れた位置にいる: イクマ=field1(9,9)、アオシ=field2(4,8)、トモキ=field3(5,8)、イツキ=field4(5,8)
- field1〜4 の南出口(7,16)に requireFlag が無い → 話しかけずに素通りできる
- objectiveFor の spine はボスフラグ7個のみ → 目標バーが仲間を一切案内しない
- 加入演出は「会話4ページ＋1行『○○が なかまに なった！』」だけで薄い

## 2. A. 仲間加入の必須化（出口ロック方式）

### A-1. 出口ロック（maps.js データ編集のみ・新コード不要）

`joinAlly(state,id)`（story.js）が加入時に `state.flags['joined_'+id]=true` を必ず立てる既存仕様を
そのまま出口ゲートに使う。既存ゲート（town1 の boss_magma 等）と同型。

| マップ | 出口 | requireFlag | lockedMsg（子供向け・誘導型） |
|---|---|---|---|
| field1 | (7,16)→town1 | `joined_ikuma` | まちへ いくまえに…\nくさはらの どこかで\nはやての FW イクマが\nまっているみたいだ。\nさがして はなしかけよう！ |
| field2 | (7,16)→field3 | `joined_aoshi` | スタジアムの どこかに\nてんさい MF アオシが いる。\nなかまに さそってから\nさきへ すすもう！ |
| field3 | (7,16)→town2 | `joined_tomoki` | すなはまの どこかで\nまもりの DF トモキが\nきみを まっている。\nはなしかけて なかまに しよう！ |
| field4 | (7,16)→field5 | `joined_itsuki` | あめの ピッチの どこかに\nでんせつの GK イツキが いる。\n5にんめの なかまを\nむかえに いこう！ |

文面はロック時に自動表示される（既存機構）。ミニマップ・✦マーカーで発見は容易。

### A-2. 目標バー案内（story.js objectiveFor の spine 拡張）

spine に加入目標4つを**ワールド到達順＝ゲート順**で挿入する（spine 順序と maps.js の
requireFlag 順序の一致は既存コメントで必須と定められている）:

```
1. joined_ikuma   bar:'イクマを なかまに しよう！'
2. boss_magma     （既存）
3. joined_aoshi   bar:'アオシを なかまに しよう！'
4. joined_tomoki  bar:'トモキを なかまに しよう！'
5. joined_itsuki  bar:'イツキを なかまに しよう！'
6. boss_guardian  （既存）
7. boss_kaiser    （既存）
8. boss_dark_general（既存）
9. boss_ice       （既存）
10. boss_forest   （既存）
11. boss_neo_kaiser（既存）
```

各 npc 文言は「（マップ名）にいる ○○に はなしかけて なかまに しよう！」型。
消費側（目標バー field-scene.js:2099 / 2744）は flags だけ見るので自動反映。

### A-3. つよくてニューゲーム互換（重大バグ予防・二重防御）

**発見済みリスク**: `createNewGamePlus`（game-state.js:57）は party を引き継ぐが
`flags:{}` で全リセットする。2周目はイクマが party にいるのに `joined_ikuma` が無い。
join handler（field-scene.js:1862）は加入済みなら afterPages を出すだけで joinAlly を
呼ばない → フラグが永久に立たず**2周目で出口ロックに詰む**。

対策（両方入れる）:

1. **createNewGamePlus 修正**: flags リセット時、party 在籍者のうち仲間4種
   （ikuma/aoshi/tomoki/itsuki のホワイトリスト）だけ `joined_*` を復元する。
   なかまモンスター・yuito は対象外（フラグ汚染防止）。
   → 2周目は出口素通り・仲間NPCも vanishFlag で消えたまま＝一貫。
2. **join handler の自己修復**: 加入済み分岐（afterPages 表示時）でも
   `flags['joined_'+joinId]=true`＋vanishFlag を立てて saveGame する。
   → 万一フラグ欠けセーブがあっても、話しかければ回復する保険。

### A-4. 既存セーブ互換

joinAlly は従来から joined_* を立てている → 加入済みの進行中セーブは全ゲート通過。
未加入で先へ進んでいたセーブは目標バーが案内 → ファストトラベル＋徒歩で戻って加入
すればよい（後戻り可能な配置なので詰みなし）。

## 3. B. 加入イベント全部盛り

### B-1. 加入の流れ（新）

```
話しかける
→ ① 既存の会話 pages（4ページ・そのまま）
→ ② 加入ミニストーリー joinStory（新規3ページ・キャラの背景と思い）
→ ③ joinAlly 実行＋vanishFlag＋saveGame（既存処理）
→ ④ 加入カットイン（AI立ち絵バーン＋ファンファーレSE＋名前/ポジション/ひとこと）
→ キー/タップで閉じる → フィールド復帰（NPC消滅）
```

### B-2. 加入カットイン画面（field-scene.js に追加）

- `createJoinCutinScene(state, allyId, onClose)` を field-scene.js に**トップレベル関数宣言**で
  追加（同ファイルの createLiftingScene/createShootScene と同じ流儀。実装前に
  `grep -rn "createJoinCutinScene" src/` で衝突ゼロを確認）。
- 描画: 暗転背景 → 金の放射光背＋パーティクル → ALLY_ART の立ち絵がスケールイン →
  「⚡イクマが なかまに なった！」＋ポジション・タイプ色・ひとこと
  （characters.js の `profile.flavor` を流用。なかま ずかん（title-sc6）の描画パターン踏襲）。
- 入力（confirm/タップ）で onClose → replaceScene(createFieldScene(state))。

### B-3. 加入ファンファーレSE（audio.js）

- `SRPG_SE` に `join` を追加: 明るい上昇アルペジオ（ド→ミ→ソ→ド↑の4音・既存 levelup より
  少し長め・豪華に）。カットイン表示開始時に `playSe('join')`。
- 音声ファイル0・コード生成（既存 audio.js の流儀どおり）。

### B-4. 加入ミニストーリー（maps.js の仲間NPC定義に joinStory: [3ページ] 追加）

- **イクマ（FW・スピード）**: まちいちばんの ストライカーだった／カイザーに ボールを
  うばわれて なにも できなかった くやしさ／「ユイトと なら もういちど はしれる！」
- **アオシ（MF・テクニック）**: しあいの ながれを よむ しれいとう／ひとりの ちからでは
  かてないと しった よる／「きみの チームで パスを つなぎたい」
- **トモキ（DF・パワー）**: まちを まもれなかった じぶんを ずっと せめていた／
  もう にどと なかまを なかせない／「ぼくが かべに なる！」
- **イツキ（GK・パワー）**: でんせつの キーパーに あこがれて れんしゅうしてきた／
  ゴールを まもるのは ゆめを まもること／「うしろは まかせろ！」

文面は実装時に子供向けひらがな・1文<br>相当の短文で最終調整。

## 4. C. ストーリー充実（4項目）

### C-1. ボス撃破後の勝利イベント

**機構**: map の入場カットシーンを複数対応に拡張する。

- 新データ形: `map.cutscenes = [{ flag, requireFlag?, pages }, …]`（従来の単一
  `map.cutscene` は内部で長さ1の配列に正規化＝後方互換）。
- `pendingCutscene(map, flags)` を「requireFlag を満たし、かつ flag 未視聴の最初の1件を
  返す」に拡張（既存 export 済み関数の拡張・テスト直接可能）。
- 勝利後フィールド復帰＝createFieldScene 再生成 → 入場カットシーン機構がそのまま発火
  するので、**battle-scene は一切触らない**。

**対象は ending 直行でない本線5ボス**（boss_kaiser / boss_neo_kaiser は
`boss.ending:true` で勝利後エンディングに直行するため除外）:

| winFlag | マップ | 内容（各2〜4ページ・仲間の掛け合い＋次の目的提示） |
|---|---|---|
| boss_magma | cave1 | イクマ中心の掛け合い→「つぎは スカイスタジアムだ！」 |
| boss_guardian | field5 | トモキ/イツキの守備談義→「いよいよ ダークアリーナだ」 |
| boss_dark_general | ch2 の該当マップ（maps.js:2080 付近） | 5人の絆→「こおりの とうげへ」 |
| boss_ice | tower_ice_3f | アオシ中心→「つぎは もりの しんでん」 |
| boss_forest | shrine_forest_3f | 決戦前夜の決意→「やみのしろへ！」 |

### C-2. 仲間の伏線・チラ見せ

未加入仲間のうわさを1つ手前の場所で聞かせる（**既存NPCのセリフ拡張**が基本・新NPC最小限）:

- field1: cs_intro か看板に「くさはらに はやての FWが いるらしい」（イクマ伏線）
- town1: 住民「ナイタースタジアムに 天才MFが いるんだって」（アオシ伏線）
- field2: コーチ/住民「すなはまに まもりの たつじんが いる」（トモキ伏線）
- town2: 住民「あめの ピッチに でんせつの GKが いるって うわさだよ」（イツキ伏線）

加入後は C-3 の variants 機構で「もう なかまに したんだね！すごい！」系に自動で変わる。

### C-3. 町の人の会話が進行で変化

**機構**: NPC 定義に `variants: [{ requireFlag, pages }, …]` を追加。
選択ロジックは純関数 `npcPagesFor(npc, flags)`（field-scene.js に追加・UMD export して
テスト可能に）: requireFlag を満たす**最後の（最も進んだ）** variant の pages、
無ければ従来の npc.pages。_talkTo の会話分岐1か所から呼ぶ。

**適用対象**: town1/town2/town3/village1 の住民 各2人程度＋C-2の伏線NPC。
例: town1 住民は boss_magma 後「ゴーレムを たおしたんだって!? まちの えいゆうだ！」。

### C-4. 章の転換カットシーン増強

- **第1章クリア→第2章への橋渡し**: boss_kaiser は勝利後そのままエンディング
  （ch1エンディング＝既に豪華）に直行するため、C-1 と同機構で field6 に
  `{flag:'cs_after_ch1', requireFlag:'boss_kaiser', pages}` を追加。
  エンディング後にセーブを再開すると field6 で「トロフィーを かかげた 5にん…
  だが とおくの そらに やみが…だい2しょうへ」が一度だけ流れ、ch2_gate へ誘導する。
- **ch2_gate 導入カットシーン**: 既存（maps.js:1877）のページを増強
  （章タイトルコール「だい2しょう やみの ぎゃくしゅう」を含む数ページ追加）。
- プロローグ10ページ絵本・cs_field6・cs_town3 は既に十分なので触らない（YAGNI）。
- boss_neo_kaiser の後日談はエンディング＋スタッフロールが既に担うため対象外。

## 5. テスト計画

- **story.test.js 拡張**: 新 spine 順序（joined_* 4つの位置が上表どおり）・全要素に
  bar/npc が非空。
- **maps 検査（新規 or 既存テストへ追加)**: field1〜4 の南出口に requireFlag/lockedMsg が
  ある・requireFlag 名が同マップ仲間NPCの `'joined_'+joinId` と一致・4人全員に
  joinStory が3ページ以上。
- **game-state.test.js**: createNewGamePlus が party 在籍の仲間4種の joined_* を復元する／
  yuito・なかまモンスターには立てない／party に居ない仲間には立てない。
- **pendingCutscene 拡張**: 複数 cutscenes から requireFlag 未達をスキップ・視聴済み
  スキップ・後方互換（単一 cutscene がそのまま動く）。
- **npcPagesFor**: variants 複数該当は最後を選ぶ・該当なしは pages・variants 無しは pages。
- **audio.test.js**: SRPG_SE に join が存在。
- **実機（preview srpg-dev / :5599/index.html 明示）**:
  1. 新規ゲームで field1 南下 → ロックメッセージ表示
  2. イクマ加入（会話→ミニストーリー→カットイン＋SE）→ 出口通過・目標バー遷移
  3. boss_magma 撃破 → cave1 で勝利イベント発火（1本は実機確認）
  4. town1 住民のセリフが boss_magma 後に変化
  5. つよくてニューゲーム開始 → field1 出口を素通りできる

## 6. 鉄則対応・制約

- **新規バンドルファイル0・build.js ORDER 編集0**（全て既存ファイルへの追記）。
- 新トップレベル識別子は `createJoinCutinScene`・`npcPagesFor` の2つのみ
  （実装前に grep で衝突ゼロ確認・関数宣言）。他は既存関数拡張とデータ追加。
- テキストデータ中心なのでバンドルサイズ影響は微小。
- 検証は node --test＋built index.html の node --check＋実機ロード（鉄則③）。
- 報酬アイテムの追加は無し（バランス表不干渉）。
- コミットは既存ブランチ feat/game-implementation にタスク単位・push は封印継続。

## 7. 実装順（writing-plans でタスク分割する際の骨子）

1. A（出口ロック＋spine＋NG+互換）— ここだけで「必須化」が完成する最小単位
2. B（joinStory データ→SE→カットイン）— 加入体験の豪華化
3. C-1＋C-4（cutscenes 複数対応→勝利イベント5本＋章転換2本）
4. C-2＋C-3（npcPagesFor→variants＋伏線セリフ）
5. 統合実機検証＋回帰（全テスト・md5 決定論ビルド確認）
