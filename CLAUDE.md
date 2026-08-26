# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語

**利用者への返答・コミットメッセージ・コード内のコメント・ドキュメントは、すべて日本語で書く。**
利用者はプログラミングの初学者であり、専門用語には短い言い換えを添える。

## コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| ビルド | `npm run build` |
| GitHub Pages 用ビルド | `npm run build:pages` |
| 1ファイル版(ダウンロードして開ける版) | `npm run build:single` |
| **DB マイグレーションと RLS の検証** | `npm run test:db` |
| お手本音声の生成(Azure の鍵が必要) | `npm run audio` |

自動テストは `npm run test:db` のみ。ユニットテストの枠組みは無い。
UI の変更は `npm run build` が通ることと、必要なら Playwright で実際に触って確かめる。

### `npm run test:db` は SQL を触ったら必ず通す

`supabase/migrations/*.sql` を変更したら、Supabase に貼る前に必ず実行する。
手元の PostgreSQL(`service postgresql start` が要る場合がある)にまっさらな DB を作り、
マイグレーションを **2回** 実行してから、アクセス制御を25項目で検証する。

- `supabase/test/supabase_stub.sql` — `auth.users` / `auth.uid()` / `storage` /
  `authenticated` ロール / 既定の権限付与という、Supabase 環境の最小の再現
- `supabase/test/rls_test.sql` — 講師1人・生徒2人を作り、
  「誰に何が見え、何ができないか」を確かめる。**拒否されるべき操作が通ったら失敗する**

この検証は実際に重大な穴(生徒が自分を講師に昇格できる)を見つけた実績がある。
省略しないこと。

## このアプリが解く問題

パーソナル英語スクールの **レッスンと宿題の循環** を支える道具である。

```
週2回のレッスン → 宿題を出す → 生徒が取り組む
  → 次のレッスンで達成度を確認し、弱点を指摘する
  → その弱点に対応した宿題を出す   ← ここが要
```

**中心機能は学習記録でも発音採点でもなく、「講師が弱点から教材を作り、
指定した生徒に配信する仕組み」である。** 弱点を指摘した直後に教材を出せないと、
練習量が確保できず克服につながらない。他の機能はこの循環の補助と位置づける。

対象はスクールの既存生徒のみ(クローズド)。一般公開はしない。
詳細は `docs/PROJECT_SPEC.md`。**設計判断はすべてこの仕様書に記録すること。**

### 設計を縛っている最大の制約

**講師は1人で、生徒は最大30人(週60レッスン)。** 制約は費用ではなく講師の作業時間である。
教材を毎回新規に作ると週9時間かかり、成立しない。
**教材ライブラリの再利用は費用の節約策ではなく、この仕組みが1人で回るための前提条件。**

したがって教材まわりの UI は、**再利用を最短路にしなければならない**
(既定の動線はライブラリ検索、AI 生成は2番目。発行時に弱点タグを必須にする)。

## 構成

- **React 18 + Vite 5**。ルーティングなし。`src/App.jsx` が学習者画面と管理画面をタブで切り替える
- **GitHub Pages** に GitHub Actions で公開(`main` と `claude/**` から)。
  `BASE_PATH` でリポジトリ名のサブパスを指定する
- **Supabase**(Postgres + Auth + RLS + Storage)。接続情報は `.env` と
  GitHub Actions のシークレットから読む。**未設定でもアプリは落ちず、localStorage で動く**

### データの置き場

| 何を | どこに | なぜ |
|---|---|---|
| 学習記録・教材・配信・スコア | Supabase | 端末をまたいで共有する必要がある |
| **録音した音声そのもの** | **端末内(IndexedDB)** | 生体情報に近い。サーバーに上げない(`docs/PROJECT_SPEC.md` 3.2) |
| お手本音声(MP3) | Supabase Storage | 年 0.3〜1.4GB。Git リポジトリには置けない |
| 設定・アプリ状態 | localStorage | `src/lib/store.js` |

**録音音声をサーバーに送る変更は、方針の転換にあたる。** 勝手に行わず必ず確認する。

## この環境の制約

- **`supabase.co` への通信は遮断されている。** マイグレーションの実行も接続確認もできない。
  SQL は利用者が Supabase の SQL Editor に貼り付け、接続確認はブラウザで行う。
  だからこそ `npm run test:db` で手元で検証してから渡す
- 利用者は **会社PC にアプリをインストールできない**。すべてブラウザで完結させる
- Chromium と Playwright は使える(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)。
  マイクは `--use-fake-device-for-media-stream` で代用する

## 踏んだ落とし穴(繰り返さないこと)

`docs/PROJECT_SPEC.md` の 3.3.2〜3.3.4 に実機での検証結果がある。特に重いものだけ再掲する。

### iOS の録音 — 実機で何度も失敗した

**iOS では、すべてのブラウザの中身が Safari(WebKit)である。**
「iOS の Chrome を使えば回避できる」という手は存在しない。

- `MediaRecorder` は**録り直しで壊れる**。使わない
- `AudioContext` は **1つだけ作り、二度と `close()` しない**
- **マイクの取得と音声グラフの構築は1回だけ**。録音のたびに作り直すと数回で無音になる
- 音声認識の前に**マイクを解放する**。掴んだままだと `aborted` / `audio-capture` になる
- iOS は `isFinal` を返さないことがある。**確定が来なければ interim を採用する**
- **iOS は高品質音声を Web Speech API に一切公開しない**(実機で生47件を確認、premium 0件)。
  端末の音声に頼らず、**事前生成した MP3 を配る**のが唯一の解

### 検証を頼む前に、版が分かるようにする

「直したはずの不具合が直っていない」の原因が、ブラウザに残った古い内容だったことが複数回あった。
`public/mic-test.html` には公開時に版が埋め込まれる(ワークフローの `__BUILD_STAMP__`)。
同種の作業では、**どの版を見ているか機械的に分かるようにしてから**確認を依頼する。

### RLS は「行」しか絞れない

`profiles` の更新を「自分の行なら可」にしたところ、生徒が `role` を `admin` に
書き換えられた。**列の制限が必要なときは、列単位の `grant` を併用する。**
`profiles`(`display_name` / `industry` のみ)と `assignments`(`learner_done_at` のみ)が該当。

### SQL 関数はテーブルより後に定義する

SQL 関数は作成時に本文を検査される。まだ無いテーブルを参照していると
`relation does not exist` で失敗する。`0001_init.sql` では判定関数を
テーブルの後(第7節)にまとめてある。

## 鍵の扱い

| 鍵 | 扱い |
|---|---|
| Supabase の `anon` / `publishable`(`sb_publishable_...`) | 公開前提。アプリに埋め込んでよい |
| Supabase の `service_role` / `secret`(`sb_secret_...`) | **絶対に扱わない。利用者にも求めない** |
| Azure Speech の鍵 | `.env` か GitHub Secrets に直接書いてもらう。**チャットに貼らせない** |

`anon` キーが公開されていても安全なのは RLS が守っているからである。
**RLS を無効化する変更は行わない。**

## Git

- 作業ブランチは `claude/project-spec-document-k5wmwy`。`main` に直接 push しない
- Pull Request は明示的に頼まれたときだけ作る
- コミットメッセージは日本語。**何を変えたかだけでなく、なぜそう判断したかを書く。**
  この判断の記録が、次のセッションの自分にとって唯一の引き継ぎになる
