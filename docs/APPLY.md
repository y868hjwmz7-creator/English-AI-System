# Supabase への反映のしかた(手順書)

利用者に「やってください」とお願いするときは、**この手順書をそのまま貼る。**
毎回ゼロから書かない。書き漏らしが出る。

> **「supabase/apply」は Supabase の中ではない。** GitHub のリポジトリの中の
> フォルダである。同じ名前のものが2か所にあると必ず取り違える(2026-08 の指摘)。

---

## 場所の一覧(何がどこにあるか)

| 何 | どこ |
|---|---|
| **SQL のファイル** | **GitHub** のリポジトリの中 |
| SQL を実行する画面 | **Supabase** → 左メニュー **SQL Editor** |
| 関数(Edge Function)のファイル | **GitHub** のリポジトリの中 |
| 関数を配置する画面 | **Supabase** → 左メニュー **Edge Functions** |
| 鍵(API キー)を入れる画面 | **Supabase** → 左メニュー **Edge Functions** → **Secrets** |
| 公開されているアプリ | GitHub Pages(`https://<ユーザー名>.github.io/<リポジトリ名>/`) |

## 押せる URL(そのまま渡す)

ブランチは `claude/project-spec-document-k5wmwy`。**リポジトリの中の道順を
言葉で説明しない。この URL をそのまま渡す。**

| 何 | URL |
|---|---|
| 貼る SQL(全部入り) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-08-29.sql` |
| **貼る SQL(0024 + 0025 まとめて・おすすめ)** | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-08-31c.sql` |
| 貼る SQL(0024 だけ) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-08-31.sql` |
| 貼る SQL(0025 だけ) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-08-31b.sql` |
| **貼る SQL(0026〜0031 を全部まとめたもの・おすすめ)** | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01g.sql` |
| 貼る SQL(0026 スコアの範囲) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01.sql` |
| 貼る SQL(0027 覚えかけ) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01b.sql` |
| 貼る SQL(0028 単語帳の絞り込み) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01c.sql` |
| 貼る SQL(0029 自分のアイコン) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01d.sql` |
| 貼る SQL(0030 入れた語をその日に出す) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01e.sql` |
| 貼る SQL(0031 ゲストのファイルの置き場) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-01f.sql` |
| 貼る SQL(0032 セッションの記録) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-02.sql` |
| 貼る SQL(0033 ディスカッション・0034 に含まれるので不要) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-02b.sql` |
| **★いま貼っていただくもの(0034〜0040 を全部まとめた1つ)** | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-04.sql` |
| 貼る SQL①(0034 誤り訂正 + ディスカッション) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-02c.sql` |
| 貼る SQL②(0035 内容の理解の訳・①のあとに貼る) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-03.sql` |
| 貼る SQL③(0036 見出しの訳・②のあとに貼る) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-03b.sql` |
| 貼る SQL④(0037 会議の種類・③のあとに貼る) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-03c.sql` |
| 貼る SQL⑤(0038 25回で卒業・④のあとに貼る) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-03d.sql` |
| 貼る SQL⑥(0039 一覧の「覚えた」・⑤のあとに貼る) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-03e.sql` |
| 貼る SQL⑦(0040 Quick Response の復習・⑥のあとに貼る) | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-04.sql` |
| 状態を見るだけの SQL | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/check.sql` |
| 教材を作る関数 | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/functions/generate-material/index.ts` |
| 読み上げ音声の関数 | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/functions/speak/index.ts` |
| 語の意味を引く関数 | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/functions/lookup-word/index.ts` |
| 似た英文を弾く関数 | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/functions/check-similar/index.ts` |
| アカウントを作る関数 | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/functions/create-user/index.ts` |

`raw.githubusercontent.com` を開くと、**文字だけの画面**が出る。
そこで ⌘A(全部選ぶ)→ ⌘C(コピー)すればよい。
GitHub の中を辿らせない。

## 書き方の決まり

- **1ステップ = 1つの操作。**「コピーして貼って実行」は3ステップ
- **ステップごとに「成功の目安」**を書く。最後にまとめて書くと途中で気づけない
- **所要時間とステップ数を先に出す**
- **やり直しを頼むときは、ステップ1から最後まで書き直す。**
  「◯◯だけもう一度」と書かない。戻って読ませるのは間違いのもと
- **うまくいかないときの逃げ道**を必ず書く
  (「赤い字が出たら、その文章をそのまま貼ってください」)

## SQL は何度貼っても安全

`supabase/apply/pending_2026-08-29.sql` は
`create ... if not exists` / `create or replace` だけでできている。
**すでに入っているものは飛ばされる。** だから「どこまで貼ったか」を
利用者に思い出させる必要はない。**迷ったら全部貼ってもらえばよい。**

## 確かめ方

貼ったあと、`supabase/apply/check.sql` を実行すると
13行の表が出て、`✅ もう入っています` / `⬜ まだです` が分かる。
**何も書き換えない。見るだけ。**

## 読み上げの鍵(TTS)を入れる場所

**入れるのは Supabase → 左メニュー Edge Functions → Secrets の1か所だけ。**
`.env` にも GitHub Secrets にも入れない(あちらは画面の側の設定で、
読み上げは窓口 `speak` の中で作るため)。

> `docs/AUDIO_SETUP.md` の「`.env` に書く」は**古い**。
> あれは `npm run audio` で前もって音声を作っていた頃のやり方で、
> いまは窓口 `speak` がその場で作る。

| 名前 | 値 | 何に使う | 無料枠 |
|---|---|---|---|
| `GOOGLE_TTS_API_KEY` | Google のキー | 標準の声(**女性**) | 毎月100万文字 |
| `AZURE_SPEECH_KEY` | Azure のキー1 | 標準の声(**男性**) | 毎月50万文字 |
| `AZURE_SPEECH_REGION` | `japaneast` | 上とセット。**片方だけでは動かない** | — |
| `ELEVENLABS_API_KEY` | ElevenLabs のキー | 良い声(記事・会話の本文など) | 無し(従量) |

- **1つも入れなくても壊れない。** その英文だけ端末の声に落ちる
- **Azure は無料枠(F0)に HD 音声が含まれない。** だから窓口は
  HD ではない Neural を指定している。**ここを HD に変えない**
- リージョンは**作ったときに選んだ場所**を、Azure の画面の表記
  (`japaneast` のような小文字1語)のまま入れる。
  「Japan East」と空白入りで入れると通らない

### Azure の鍵を取るところまで(全7ステップ・所要 15分)

1. `https://portal.azure.com/` を開く(無ければ
   `https://azure.microsoft.com/ja-jp/free/` で無料アカウントを作る)
2. 上の検索窓に **`Speech services`** と入れて、出てきた項目を開く
3. **「+ 作成」**(Create)を押す
4. 次の4つだけ入れる。ほかは既定のままでよい

   | 欄 | 入れる値 |
   |---|---|
   | サブスクリプション | そのまま |
   | リソース グループ | **「新規作成」**を押して `english-ai` などと入れる |
   | 地域(Region) | **Japan East** |
   | 価格レベル(Pricing tier) | **Free F0** |

   *成功の目安:* 「Free F0」が選べる。選べない場合は
   その契約に無料枠が1つすでにある(有料の Standard S0 でも動くが、
   課金される。**迷ったらそこで止めて聞いてください**)
5. **「確認および作成」→「作成」**。1〜2分待つ
   *成功の目安:* 「デプロイが完了しました」と出る
6. **「リソースに移動」→ 左メニュー「キーとエンドポイント」**
   *成功の目安:* 「キー1」「キー2」「場所/地域」の3つが並ぶ
7. **「キー1」の右のコピー印**を押して控える。
   **「場所/地域」**の値(`japaneast` など)も控える

> **キーはチャットに貼らないでください。** 次のステップで
> Supabase の画面に直接貼ります。こちらは中身を見ません。

### 控えた鍵を Supabase に入れる(全5ステップ・所要 3分)

1. `https://supabase.com/dashboard` を開き、このプロジェクトを選ぶ
2. 左メニュー **Edge Functions** → 上のタブ **Secrets**
3. **「Add new secret」** を押し、次を入れて保存

   - Name: `AZURE_SPEECH_KEY`  /  Value: 控えたキー1

   *成功の目安:* 一覧に `AZURE_SPEECH_KEY` が増える(値は伏字)
4. もう一度 **「Add new secret」** で、

   - Name: `AZURE_SPEECH_REGION`  /  Value: `japaneast`

   *成功の目安:* 一覧に `AZURE_SPEECH_REGION` が増える
5. **窓口 `speak` を配置し直す。** Secrets は配置し直すまで届かない

   *どこまで影響するか:* 教材・宿題・ゲストの情報には触れない。
   変わるのは、これから作られる MP3 の声だけ

*うまくいかないとき:* 赤い字が出たら、その文章をそのまま貼ってください。
