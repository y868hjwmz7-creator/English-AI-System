# 教材の手本(実物)

> **これは利用者がレッスン中に実際に作っているドリルである。**
> AI に教材を生成させるときの手本はこれ。形だけでなく、
> 指導ポイントの粒度、解答の書き方、別解の扱いまで写すこと。
>
> 出典: 利用者から共有(2026-08)。データの形は
> `docs/PROJECT_SPEC.md` 第 5.13 節、検証は
> `supabase/test/material_shape_test.sql`。

---

## 教材:名詞 + to不定詞 =「〜するべき / 〜する必要のある」

- **種類**: 文型ドリル(`pattern`)
- **弱点タグ**: to不定詞(`infinitive`)
- **取り組み方**: to不定詞を「〜すべき」「〜する必要がある」という感覚で捉えること
- **指導ポイント**:
  `emails to reply to` のように、**reply to の to を落とさないこと。**
  reply は `reply to an email` なので、最後の to が要る。
- **分量**: 4演習 × 10問 = 40問。**これで3日分の宿題のほんの一部**

---

### ① 英文和訳 × 10

> 次の英文を日本語に訳しなさい。to不定詞を「〜すべき」「〜する必要がある」という感覚で捉えること。

| # | 出題(英文) | 解答 |
|---|---|---|
| 1 | I have several things to do before the meeting. | 会議の前にやるべきことがいくつかあります。 |
| 2 | There are still many problems to solve. | まだ解決すべき問題がたくさんあります。 |
| 3 | We have some important points to discuss today. | 今日、話し合うべき重要なポイントがいくつかあります。 |
| 4 | She made a list of people to contact. | 彼女は連絡すべき人たちのリストを作りました。 |
| 5 | There are a few things to remember before you leave. | 出発する前に覚えておくべきことがいくつかあります。 |
| 6 | We need to decide which tasks to prioritize. | 私たちはどの仕事を優先すべきか決める必要があります。 |
| 7 | He gave me some documents to check. | 彼は私に確認すべき書類をいくつか渡しました。 |
| 8 | There are several questions to ask the client. | クライアントに聞くべき質問がいくつかあります。 |
| 9 | This is an important rule to follow. | これは守るべき重要なルールです。 |
| 10 | We still have one major decision to make. | まだ決めるべき重要なことが1つ残っています。 |

---

### ② 穴埋め × 10

> カッコ内の動詞を使って、to不定詞を完成させなさい。

| # | 出題 | 与える語 | 解答 |
|---|---|---|---|
| 1 | I have a lot of emails (　　　) today. | reply to | **to reply to** |
| 2 | There are several issues (　　　) before the meeting. | discuss | to discuss |
| 3 | We have an important decision (　　　). | make | to make |
| 4 | Here is a list of customers (　　　). | contact | to contact |
| 5 | There are three rules (　　　). | remember | to remember |
| 6 | I still have some documents (　　　). | check | to check |
| 7 | We have several problems (　　　). | solve | to solve |
| 8 | There are a few questions (　　　) the manager. | ask | to ask |
| 9 | He explained the steps (　　　). | follow | to follow |
| 10 | I wrote down all the things (　　　) this week. | do | to do |

> **1番が要。** `emails to reply to` となる。
> reply は `reply to an email` なので、**最後の to を落としてはいけない。**

---

### ③ 日本語 → 英語 × 10

> 「〜すべき○○」を、なるべく **名詞 + to不定詞** で表現しなさい。

| # | 出題(日本語) | 解答例 |
|---|---|---|
| 1 | 今日やるべきことがたくさんあります。 | I have a lot of things to do today. |
| 2 | まだ解決すべき問題が2つあります。 | There are still two problems to solve. |
| 3 | 話し合うべき重要なポイントがあります。 | We have an important point to discuss. |
| 4 | 電話すべき人のリストを作りました。 | I made a list of people to call. |
| 5 | 覚えておくべきことが1つあります。 | There is one thing to remember. |
| 6 | 私たちは決めるべきことがたくさんあります。 | We have a lot of things to decide. |
| 7 | 確認すべき書類があります。 | I have some documents to check. |
| 8 | 彼に聞くべき質問がいくつかあります。 | There are several questions to ask him. |
| 9 | これは守るべき重要なルールです。 | This is an important rule to follow. |
| 10 | 今週終わらせるべき仕事がたくさんあります。 | I have a lot of work to finish this week. |

> **「解答」ではなく「解答例」。** 英訳は複数の正解がありうるので、
> データ上は `answer`(代表)と `answer_alt`(別解)に分けて持つ。

---

### ④ リスニング + 理解 × 10

> **英文は見せずに読み上げる。** 聞いたあとの質問に、英語または日本語で答える。

| # | 読み上げる英文(見せない) | 設問 | 解答 |
|---|---|---|---|
| 1 | I have three things to do before I leave the office. | How many things does the speaker need to do? | Three. |
| 2 | There are two important issues to discuss at tomorrow's meeting. | When will they discuss the issues? | At tomorrow's meeting. |
| 3 | I made a list of customers to contact this afternoon. | Who does the speaker need to contact? | Customers. |
| 4 | We still have several problems to solve before we launch the new service. | What do they need to do before the launch? | Solve several problems. |
| 5 | There is one important thing to remember when talking to the client. | Is there anything the speaker wants you to remember? | Yes, one important thing. |
| 6 | My manager gave me five documents to check by Friday. | What does the speaker need to check? | Five documents. |
| 7 | We have a difficult decision to make before the end of the month. | What do they need to do? | Make a difficult decision. |
| 8 | Before the interview, write down some questions to ask the candidate. | What should you prepare before the interview? | Some questions to ask the candidate. |
| 9 | There are several safety rules to follow when using this machine. | What should you follow? | Several safety rules. |
| 10 | I have a lot of work to finish today, so I probably can't leave early. | Why can't the speaker leave early? | Because they have a lot of work to finish. |

---

## AI に生成させるときに写すべきこと

1. **1つの文法ポイントに絞る。** 混ぜない
2. **同じ文型で、場面と語彙だけを変える。** 定着が狙いなので、変化は最小限に
3. **業務で実際に使う場面にする**(会議、メール、顧客、書類、締切)。
   生徒の業界が指定されていれば、その場面に寄せる
4. **穴埋めには「落とし穴」を1つ以上入れる。** ①の `reply to` のような、
   間違えて初めて身につくもの
5. **英訳は「解答例」として出し、別解も添える**
6. **リスニングの設問は、英文を聞かないと答えられないものにする。**
   常識で答えられる質問は意味がない
7. **教材全体の指導ポイントを1つ書く。** 1問ごとの注意とは別に、
   その文法の勘所を1〜2文で
