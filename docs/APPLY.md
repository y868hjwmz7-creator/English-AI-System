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
| **貼る SQL(0032 セッションの記録・いま貼るのはこれ)** | `https://raw.githubusercontent.com/y868hjwmz7-creator/English-AI-System/claude/project-spec-document-k5wmwy/supabase/apply/pending_2026-09-02.sql` |
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
