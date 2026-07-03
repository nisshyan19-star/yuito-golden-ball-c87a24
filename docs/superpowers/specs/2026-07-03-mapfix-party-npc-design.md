# 第5弾 改修 設計書 — 寄り道必須化・双方向マップ・NPC拡充

**日付:** 2026-07-03
**対象:** サッカーRPG「ユイトと黄金のサッカーボール」（単一 index.html 配布・9歳児向け）
**ブランチ運用:** A（マップ）→ C（NPC拡充）の順に1本の開発ブランチで実装する。各サブプロジェクトは独立した実装プランへ分割してよい。

> **スコープ変更（2026-07-03）:** げんちゃんの判断により「パーティは5人全員参加のまま」に決定。これに伴い**サブプロジェクトB（パーティ4人制＋スカウト編成）は今回スコープ外**とし、要望5（スカウトモンスターの戦闘参加）・要望6（出場4人制＋入れ替え）は見送る。本改修は A と C のみ。パーティ関連コード（`monster.maxParty`＝5、`story.js` `joinAlly` の無条件 push）は現状維持で触らない。

---

## 背景と目的

げんちゃんの2件の元依頼＋4件の追加要望を実装する。

**元依頼:**
1. 寄り道マップがスルーされがちだったので、本線ストーリーで必ず通る構成に作り直す。
2. 一部マップが「来た道を戻れない」一方通行になっているので、全マップ相互に行き来できるようにする。

**追加要望:**
3. 仲間になるキャラのNPCを、加入前から仲間の見た目でマップに立たせて分かりやすくする。
4. NPCの種類を増やす（Rich＝新規ドット絵多数）。
5. ~~スカウトしたモンスターを戦闘に出せるようにする。~~（見送り・下記スコープ変更参照）
6. ~~戦闘に出せるのは4人までにして入れ替えできるようにする。~~（見送り＝5人全員参加のまま）

元依頼1・2はサブプロジェクトA、要望3・4はサブプロジェクトCで扱う。要望5・6（旧サブプロジェクトB）は今回スコープ外。

**不変の制約（全サブプロジェクト共通）:**
- `src/` 分割 → `node build.js` で単一 index.html へ結合。**build.js は編集しない。**
- 決定論ビルド：`md5 -q index.html` を2回実行して一致すること。
- テストは `node --test`。現行 **648テスト** が全て緑のまま、各変更に新規テストを足す。
- 新規トップレベルJS識別子を足す前に必ず grep で衝突確認（単一バンドル時の同名 const 衝突＝black screen を防ぐ）。
- 新ダンジョン報酬武器の atk は32以下（star_boots/star_mail のみ第3章限定例外。本改修では新規武器を追加しない）。
- 第3章（wc_stadium／nebula／star_shrine／asterion 系）は完成済み・実機検証済み。**進行ゲート（requireFlag による前進ロック）と章切替導線を壊さない。**

---

# サブプロジェクトA — 寄り道必須化＋双方向マップ

## A-0 現状の事実（実コード確認済み）

**進行スパイン** `src/data/story.js` `objectiveFor(flags)` の現行順序:

```
joined_ikuma → boss_magma → joined_aoshi → joined_tomoki → joined_itsuki
→ boss_guardian → boss_kaiser → boss_dark_general → boss_ice → boss_forest
→ boss_neo_kaiser → wc_qualify → … → boss_asterion
```

この配列順が `maps.js` の各出口 `requireFlag` と完全一致している必要がある（純粋関数の単一情報源）。

**寄り道4マップの位置と付随フラグ（実データ）:**

| 寄り道マップ | 入口（ホスト） | クリアフラグ | 現状の扱い |
|---|---|---|---|
| `secret_field`（隠し部屋・押しパズル） | `town1`（ハーバータウン）→ `secret_field` | `secret_puzzle`（`pushPuzzle.solveFlag`） | 任意。宝箱 `spike3`（ゴールデンスパイク）は `requireFlag:'secret_puzzle'` |
| `cave_water_1f/2f/3f`（みずのどうくつ） | `town2`（フォレストタウン）→ `cave_water_1f` | `boss_water`（水の主 `winFlag/vanishFlag`） | 任意 |
| `legend_arena`（でんせつのアリーナ） | `town3`（クラウドタウン）→ `legend_arena` | `boss_emperor`（ゴールド・エンペラー `winFlag/vanishFlag`） | 任意。宝箱おうごんのよろいは `requireFlag:'boss_emperor'` |
| `challenge_room`（ちょうせんの間） | `field6`（ダークアリーナ）→ `challenge_room` | `challenge_clear`（`bossRush.winFlag`） | **kaiser撃破後に南扉が開く後日談ボスラッシュ**。報酬 `champion_spike`（atk32） |

**マップ接続グラフ（実データ・forward 出口）:**

```
field1 → town1
town1  → secret_field, field2(boss_magma gate), village1
village1 → town1, cave1
cave1  → village1                         （ほのおの どうくつ＝magma）
field2 → field3
field3 → town2
town2  → field4, cave_water_1f
field4 → field5
field5 → town3
town3  → legend_arena, field6, ch2_gate
field6 → challenge_room(boss_kaiser gate)
（第3章）wc_stadium → ch2_castle ／ nebula_f1 → wc_stadium ／ star_shrine_1 → nebula_f3
```

**`challenge_room` の中身（要注意・実データ）:** `bossRush.enemies = ['guardian','phantom_striker','gold_emperor','dark_kaiser']` の回復なし4体連戦。ラスボス `dark_kaiser` 自身と隠しボス `phantom_striker` を含む。現状は kaiser 撃破後の後日談として設計されている。

**ボスNPCの進行ロック機構（実装済み・利用可能）:** `field-scene.js` `_talkTo` の「⓪ 進行ロック」により、NPC がトップレベル `requireFlag` を持ち当該フラグ未達なら `lockedMsg` を出して会話・戦闘を止める（撃破済み `boss.winFlag` が立っていれば会話へ流す例外あり）。ボスNPCの発動を前提フラグで止められる。

## A-1 決定：寄り道4マップを本線ハードゲート化

**方式（承認済み）:** 付随タウンの「前進出口」に `requireFlag:<寄り道クリアフラグ>` と `lockedMsg` を足し、同じフラグを spine 配列にも同順で挿入する。geography（地理）は変更しない。前進は既存フラグ＋新フラグの両方で守られるため、シーケンスブレイクは起きない。

### A-1a 新しいスパイン順序（`story.js`）

現行スパインに4フラグを挿入する（★＝新規ノード）:

```
joined_ikuma
★ secret_puzzle          （ハーバータウンの隠し部屋パズル）
boss_magma
joined_aoshi
joined_tomoki
★ boss_water             （みずのどうくつの 水の主）
joined_itsuki
boss_guardian
★ boss_emperor           （でんせつのアリーナの ゴールド・エンペラー）
★ challenge_clear        （ちょうせんの間の 腕試し）
boss_kaiser
boss_dark_general → …（以降 現行のまま不変）
```

各新規ノードに `bar`（HUD短文）と `npc`（コーチ案内文）を用意する。文言例:

- `secret_puzzle` … bar「ハーバータウンの ひみつを といて！」／ npc「ハーバータウンの かくしべやで\nボールの パズルを といてから\nさきへ すすもう！」
- `boss_water` … bar「みずのどうくつへ！」／ npc「フォレストタウンの みずのどうくつで\nみずの ぬしを たおしてから\nさきへ すすもう！」
- `boss_emperor` … bar「でんせつのアリーナへ！」／ npc「クラウドタウンの でんせつのアリーナで\nゴールド・エンペラーを たおそう！」
- `challenge_clear` … bar「ちょうせんの間へ！」／ npc「ダークアリーナの ちょうせんの間で\nうでだめしを クリアしてから\nダーク・カイザーに いどもう！」

### A-1b 出口・ボスゲート（`maps.js`）

| # | 対象 | 追加/変更 | 意味 |
|---|---|---|---|
| G1 | `town1` → `village1` の出口 | `requireFlag:'secret_puzzle'` ＋ `lockedMsg` を追加 | ほのおのどうくつ（magma）へ進む前に、隠し部屋パズルを必須化。※`town1`→`field2` は既に `boss_magma` ゲート済で二重に後段 |
| G2 | `town2` → `field4` の出口 | `requireFlag:'boss_water'` ＋ `lockedMsg` を追加 | みずのどうくつ（水の主）を倒す前に先へ進めない |
| G3 | `town3` → `field6` の出口 | `requireFlag:'boss_emperor'` ＋ `lockedMsg` を追加 | でんせつのアリーナ（エンペラー）を倒す前にダークアリーナへ進めない |
| G4 | `field6` の kaiser ボスNPC（`dark_kaiser`） | トップレベル `requireFlag:'challenge_clear'` ＋ `lockedMsg` を追加 | ちょうせんの間クリア前は kaiser と戦えない |
| G5 | `field6` → `challenge_room` の出口 | `requireFlag:'boss_kaiser'` を**撤去**（最初から開く） | challenge が kaiser の前段になったため |

`lockedMsg` はいずれも9歳児が次に何をすべきか分かる肯定文にする（例 G2:「みずの ちからで とざされている。\nみずのどうくつの ぬしを たおすと\nみちが ひらきそうだ…」）。

### A-1c `challenge_room` を軽量な腕試しへ作り替え（承認済み）

後日談ボスラッシュのままだと（未討伐の dark_kaiser を含み・回復なし4体連戦が最終ボス直前の必須関門になり）矛盾＆難易度過多。そこで:

- `bossRush.enemies` を `['guardian','phantom_striker','gold_emperor','dark_kaiser']` → **`['guardian','gold_emperor']`** の2体連戦へ軽量化する（この時点で必ず撃破済みの2ボスのみ／回復なしは維持）。
- `winFlag:'challenge_clear'`・`reward: champion_spike` は維持。
- 受付NPCの案内文（`pages`）を「ラスボス前の腕試し」トーンへ更新（後日談→前哨戦）。
- `afterPages` も「チャンピオン」表現から「腕試しクリア・いよいよラスボスへ」トーンへ更新。

これにより「4マップ全部必須」を矛盾なく実現し、champion_spike（atk32）はラスボス直前の報酬として妥当に収まる。

## A-2 一方通行の双方向化（`maps.js`）

各 forward 出口に対応する reverse 出口が欠落している11か所へ、reverse 出口のみを追加する（前進ゲートの `requireFlag` は一切変更しない＝シーケンスブレイク不可）。

**第1章・町⇄フィールド鎖（8か所）:**

| # | 既存 forward | 追加する reverse |
|---|---|---|
| R1 | `field1 → town1` | `town1 → field1` |
| R2 | `town1 → field2` | `field2 → town1` |
| R3 | `field2 → field3` | `field3 → field2` |
| R4 | `field3 → town2` | `town2 → field3` |
| R5 | `town2 → field4` | `field4 → town2` |
| R6 | `field4 → field5` | `field5 → field4` |
| R7 | `field5 → town3` | `town3 → field5` |
| R8 | `town3 → field6` | `field6 → town3` |

**第3章・完成済みゾーン（3か所・慎重に）:**

| # | 既存 forward | 追加する reverse | 注意 |
|---|---|---|---|
| R9 | `wc_stadium → ch2_castle` | `ch2_castle → wc_stadium` | 章切替ワープ導線と重複しないこと |
| R10 | `nebula_f1 → wc_stadium`（＝戻り）に対し、`wc_stadium` から nebula へ出る辺が無い | `wc_stadium → nebula_f1` | 前進は既存の各フロア `requireFlag` で守られるため足しても崩れない |
| R11 | `star_shrine_1 → nebula_f3`（＝戻り）に対し、`nebula_f3` から star_shrine へ出る辺が無い | `nebula_f3 → star_shrine_1` | 同上 |

各 reverse 出口の着地座標（`tx`/`ty`）は、対応マップの grid と既存到着規約（町/フィールドは中央 col7・到着 (7,2)・出口 (7,16)）を実データで確認して実装プランで確定する。**R9〜R11 は第3章の決定論ビルド・進行ゲートを壊さないことを各タスクで検証する（追加後に 648＋新規テスト全緑・md5 二重一致・objectiveFor の順序不変を確認）。**

## A-3 `secret_field` のヒント強化

押しパズルがスルーされて詰まらないよう、`secret_field` 入口付近／`town1` 内の案内NPCに、パズルの解き方（どのボールをどこへ運ぶか）を手厚く示すページを足す。ヒントはデータ（NPC `pages`）追加のみでエンジン改修不要。

## A-4 受け入れ基準（A）

- 新規プレイで secret_puzzle→magma→…→boss_water→…→boss_emperor→challenge_clear→boss_kaiser の順に、各寄り道をクリアしないと前進できない。
- 4寄り道マップいずれも、本線を進める過程で必ず1回は入る導線になっている。
- 11か所すべてで「来た道を戻る」ことができる（reverse 出口が機能）。
- 前進ゲート（既存 requireFlag）は一切緩まず、フラグ未達で先へ飛べない。
- `objectiveFor` の返す目標順序と `maps.js` の requireFlag が完全一致（不整合テストで担保）。
- 648＋新規テスト全緑・`md5 -q index.html` 二重一致。

---

# サブプロジェクトC — NPC拡充（Rich）

## C-0 現状の事実（実コード確認済み）

- スプライトは `sprites.js` の `buildChar(palette, number, isGK)`：共通の32×32ボディに **パレット（髪/肌/ユニ等の色）を差し替える**方式。coach も shopkeep も同じボディの色違い。→ **新規NPCの量産はドット絵を描き起こさず、パレット定義追加で実現できる。**
- NPCは `maps.js` の `npcs:[{x,y,sprite,joinId?,vanishFlag?,pages?,shop?,boss?,forge?,quest?,...}]`。
- `field-scene.js` `_withActiveNpcs` が `vanishFlag`（トップレベル）／`boss.vanishFlag` の立ったNPCを非表示にする。頭上マークは `npcMarkerKind`（ally/boss/shop/quest 等）。
- 加入NPCは既に仲間スプライト（`sprite:'ikuma'` 等）で立つ。

## C-1 加入前カメオ配置（要望3）

アオシ／トモキ／イツキを、**加入マップより手前のマップ**に「仲間の見た目のまま」立たせる。`joinId` は付けず（＝会話のみ・加入は本来のマップ）、`vanishFlag:'joined_<id>'` を付けて**加入後は自動で消える**（`_withActiveNpcs` が処理・エンジン改修不要）。頭上には ally マーカーが付く。

| キャラ | 加入マップ | カメオ配置先（手前） | vanishFlag |
|---|---|---|---|
| アオシ | field2（ナイタースタジアム） | `town1`（ハーバータウン） | `joined_aoshi` |
| トモキ | field3（サンドコート） | `field2`（ナイタースタジアム） | `joined_tomoki` |
| イツキ | field4（レイニーピッチ） | `field3`（サンドコート） | `joined_itsuki` |

※イクマは最初の仲間（field1）なのでカメオ不要。各カメオNPCに「これから仲間になる予感」を匂わせる固有会話（`pages`）を用意する（例 アオシ@town1「きみ、いい パスを だすね。\nおれは アオシ。\nいつか いっしょに プレーしたいな。」）。配置座標は各マップの歩けるマスへ実装プランで確定。

## C-2 新規NPCスプライト多数（要望4・Rich）

`sprites.js` に新パレットを追加（共通ボディの色替え）。町・フィールドに配置し、世界観を広げる固有会話を持たせる。提案する新NPC種（10種前後）:

1. 女の子（ピンク系）
2. 男の子（青系）
3. おばあさん（白髪）
4. おじいさん（グレー・口ひげ色）
5. 若い女性（茶髪）
6. 若い男性
7. しんぱん（審判・白黒ストライプ）
8. きしゃ（記者・スーツ色）
9. ろてんの おじさん（露店）
10. サポーター（応援カラー）

各町に2〜4体、各フィールド要所に1〜2体を目安に配置（正確な種類数・配置・会話は実装プランで確定）。新パレットのトップレベル識別子は追加前に grep で衝突確認する。会話は世界観・進行ヒント・小ネタを織り交ぜ、既存の雰囲気（ひらがな中心・やさしい語り）に合わせる。

## C-3 受け入れ基準（C）

- アオシ／トモキ／イツキが加入マップの手前に仲間の見た目で立ち、話しかけると固有会話をする。
- 加入すると、そのカメオNPCがマップから消える（vanishFlag）。
- 新規NPC種が複数追加され、複数マップに配置されて会話できる。
- 追加スプライトのパレット識別子が既存と衝突しない（build 後 black screen しない＝テスト＆実機起動で確認）。
- 648＋新規テスト全緑・md5 二重一致。

---

## テスト方針（全体）

- 変更ごとに `node --test` を実行し、現行648テストの緑を維持しつつ新規テストを足す。
- 純粋ロジック（`objectiveFor` の新順序）はユニットテストで固定。
- マップ整合（spine と requireFlag の一致、11 reverse 出口の存在、寄り道ゲートの存在）はデータ検査テストで固定。
- 各節目で `node build.js` → `md5 -q index.html` を2回実行して一致を確認（決定論）。

## スコープ外（YAGNI）

- **パーティ4人制・スカウト編成・出場入れ替え（旧サブプロジェクトB）はやらない。パーティは5人全員参加のまま、パーティ関連コードは触らない。**
- 新規武器・新ダンジョン・新ボスの追加はしない（challenge_room は既存内容の軽量化のみ）。
- 戦闘システム／スカウト確率式の変更はしない。
- 第3章のストーリー・ボス・報酬の変更はしない（reverse 出口の追加のみ）。

## 実装順序

A（マップ）→ C（NPC拡充）を1ブランチで順に。各サブプロジェクトごとに spec→plan→implement のサイクルを回してよい。配信（push）は「Pushして！」の明示指示まで行わない。
