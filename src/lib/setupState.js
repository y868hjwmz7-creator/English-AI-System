/**
 * **準備が済んでいるかを、こちらから訊きに行く**(2026-09 実機・利用者の問い)。
 *
 *   > 前回お願いした2つが、まだでしたら先に。
 *   > ① supabase/apply/pending_matome.sql を貼る
 *   > ② generate-material を置き直す。
 *   > これをやったかどうか覚えていません。この現象がなん度も起きています。
 *   > あなたで把握できる方法はないのですか？
 *
 * ============================================================================
 * 【こちらからは、確かめられない】
 *
 *   この環境から Supabase には**届かない**(CLAUDE.md「この環境の制約」)。
 *   だからリポジトリを何度読んでも、「**何が要るか**」しか分からない。
 *   「**何が済んだか**」は、Supabase の中にしか無い。
 *
 *   けれども**アプリからは確かめられる。** 利用者はいつもアプリを
 *   開いているのだから、**アプリに訊かせて、アプリに言わせる。**
 *
 * 【どちらも 0 円で確かめられる】
 *
 *   | 何 | どう訊くか |
 *   |---|---|
 *   | ① 貼る SQL | いちばん新しい移行の**印**が在るかを読むだけ |
 *   | ② 窓口の版 | `checkGenGateway()`(読めない中身を送って断らせる) |
 *
 *   **教材は1本も作らない。音声も1本も作らない。**
 *
 * 【印は「いちばん新しい移行」1つだけ】
 *
 *   `supabase/apply/check.sql` は 36 行ぜんぶを数えるが、
 *   **ここで同じ一覧を持たない**(持てば、こちらも同じように古びる ——
 *   CLAUDE.md「移行を足したのに check.sql に足し忘れる」)。
 *
 *   `pending_matome.sql` は 0041 以降を**順に**並べたものである。
 *   しかも Supabase の SQL Editor は、**失敗した貼り付けをまるごと
 *   巻き戻す**(CLAUDE.md・2026-09 実機)。だから
 *   **いちばん新しい移行の印が在れば、その手前も全部入っている。**
 *   見るのは1つでよい。
 *
 *   **移行を足したら、ここも直す。** `npm run test:play` が
 *   `supabase/migrations/` のいちばん新しいファイルと突き合わせており、
 *   **直すまで赤いまま**なので、必ず1回は自分の目で数えることになる。
 *
 * 【分からないときは、騒がない】
 *
 *   通信が切れている・ログインしていないときは `unknown` を返す。
 *   **既定は「言わない」。** 接続そのものの知らせは別にある
 *   (`SupabaseStatus`)ので、ここで二重に言わない。
 */
import { supabase } from './supabase.js'
import {
  NEED_GEN_REV, checkGenGateway, genGatewayRev, genGatewayStale,
} from './materials.js'

/* ── 貼る SQL の印 ──────────────────────────────────────────── */

/** いちばん新しい移行。**`supabase/migrations/` と必ずそろえる** */
export const NEWEST_MIGRATION = '0069'

/**
 * その移行が入っているかを見る印。
 *
 * **表を作らない移行もある。** 0056 は `review_words()` の上限を
 * 上げるだけで、表も列も1つも増えない。だから印は**関数**にした ——
 * 0056 が作る `wordbook_limit()` が在るかどうかで見る
 * (あの関数は上限そのものの出どころでもある。**印のためだけの
 * 関数を作っていない**)。
 *
 * 0059 も同じで、**門番に「自分のぶん」を1つ足すだけ**である。
 * その足した半分そのものが `can_set_own_features()`(引数を取らない・
 * **読むだけ**)なので、印としてそのまま呼べる ——
 * **書く関数を印にしない。** 訊いただけで何かが書き換わる。
 *
 * `table` を書けば表の有無、`rpc` を書けば関数の有無を見る。
 * **どちらか一方だけ**を書く。
 */
/*
 * 0060 は**表も列も関数も1つも増えない**(弱点タグを2行足すだけ)。
 * だから `table: 'weakness_tags'` では見られない ——
 * **あの表は 0001 からある**ので、貼る前でも「もう入っています」と出る。
 * **いちばん悪い壊れ方**である(CLAUDE.md「本当は足りないのに全部 ✅」)。
 *
 * そこで **`row`(その行が在るか)** を足した。
 * `weakness_tags` は 0001 で「タグは全員が読める」(`using (true)`)なので、
 * **0件は「まだです」を正しく意味する** —— RLS に断られて 0 件になる表を、
 * この印に選んではいけない。
 */
/*
 * 0062 も**表も列も1つも増えない**(`qr_items()` の上限を上げるだけ)。
 * 0056 とまったく同じで、その移行が作る **`qr_limit()`** を印にする ——
 * あれは上限そのものの出どころでもあるので、
 * **印のためだけの関数ではない。**
 */
/*
 * 0063(文化の背景)は、**許す値を1つ増やすだけ**である。
 * 表も列も関数も行も増えないので、**このままでは画面から見えない** ——
 * 見えないまま ✅ になるのが、CLAUDE.md の言う
 * 「**本当は足りないのに全部 ✅**」(いちばん悪い壊れ方)である。
 *
 * だから 0063 は `section_types()` も作る。あれが答えるのは
 * 「**このデータベースは、どの演習の種類を受け付けるか**」で、
 * アプリの一覧と食い違うと**教材を作った最後の最後で insert が落ちる。**
 * `qr_limit()` とまったく同じ立て付けで、**印のためだけの関数ではない。**
 *
 * **在るかどうかだけでは足りない**(`has`)。関数は 0063 が作るが、
 * 制約のほうを貼り忘れる形もありうる —— だから
 * **返ってきた一覧に `culture_note` が入っているか**まで見る。
 *
 * **演習そのものは 2026-09 に廃止した**(利用者の指定)。
 * それでも、ここも制約も**そのまま**である ——
 * 値の一覧を狭めると、その値が入っている DB に貼り直せなくなる
 * (CLAUDE.md「値の一覧を書き直すファイルは、どれも同じ一覧を書く」)。
 * **ここが見ているのは「0063 を貼ったか」であって、
 * その演習を使うかどうかではない。**
 */
/*
 * 0064(教材の冊と UNIT 番号)は **`materials` に列を2つ増やす**ので、
 * **表そのもの**ではなく**列**で見たいところだが、印は
 * 表 / 関数 / 行の3つしか見られない(下の `checkSqlApplied`)。
 *
 * **列を増やす移行は、読んでみれば分かる** —— 無い列を `select` すると
 * PostgREST が断る(42703)。だから `column` を足した。
 * **在るかどうかだけを見る** —— 0063 のような中身の確かめは要らない
 * (列は在るか無いかしかない)。
 */
/*
 * 0065(かたまりの分類・本文の文章・練習)も **`material_items` に
 * 列を3つ増やすだけ**なので、0064 とまったく同じ見方をする ——
 * **表ではなく列**で見る(表は 0001 からあるので、表の有無で見ると
 * 貼る前でも「もう入っています」と出る)。
 *
 * **3つのうち `practice` を印にする。** どれでもよいが、
 * これが**いちばん最後に効く** —— 分類と本文の文章だけ入っていても、
 * 練習が無ければ「練習する」は出ない(**使えるようになった印**である)。
 */
/*
 * 0067(単語 / フレーズの「日本語 → 英語で言う」)は、
 * **表も列も関数も増やさない。** 増えるのは
 * `material_sections_type_check` の**値2つだけ**である。
 *
 * だから **`section_types()` に訊く**(0063 で作った関数)。
 * あれは制約そのものを読んで返すので、
 * **貼ったかどうかが、そのまま値の有無になる。**
 * 関数の有無で見ると、0063 を貼った時点で「もう入っています」と出る ——
 * CLAUDE.md が「いちばん悪い壊れ方」と呼んでいるものである。
 */
export const NEWEST_MARK = {
  /* **値が1つ増えるだけの印**(0069・第5.263節)。
     0069 は `materials_kind_check` に `test` を足すだけで、
     **表も列も行も1つも増えない。**

     だから **`material_kinds()` に訊く**(0069 で作った関数。
     0063 の `section_types()` とまったく同じ立て付けで、
     **制約そのものを読んで返す**)。
     **関数の有無だけでは足りない** —— 関数を貼って制約を貼り忘れる形が
     ありうるので、**返ってきた一覧に `test` が入っているか**まで見る
     (0067 とまったく同じ見方)。

     **この関数は、いまここからしか呼ばれていない。**
     「受け付ける種類を訊ける」という使い道はあるが、
     使っているのは準備の状態だけである(**分かったように書かない**)。 */
  rpc: 'material_kinds',
  has: 'test',
  label: '教材の種類に「テスト」(0069)',
}

/** 貼る SQL の置き場(**押せる URL**。`raw.` は非公開だと開けない) */
const REPO = 'https://github.com/y868hjwmz7-creator/English-AI-System/blob'
const BRANCH = 'claude/project-spec-document-k5wmwy'
export const MATOME_URL = `${REPO}/${BRANCH}/supabase/apply/pending_matome.sql`
export const CHECK_URL = `${REPO}/${BRANCH}/supabase/apply/check.sql`

/** 「そんな表は無い」と言われたか。**ほかの理由と混ぜない** */
const noTable = (error) => {
  const m = `${error?.code ?? ''} ${error?.message ?? ''}`
  /* **関数のときも同じ言い方で断られる**(0056 で印を関数にした)。
     PostgREST は `PGRST202`、Postgres は `42883` を返す。
     **通信の失敗と混ぜない** —— あちらは `unknown` にして騒がない */
  return /relation .* does not exist|function .* does not exist|42P01|42883|PGRST202|PGRST205|schema cache/i
    .test(m)
}

/**
 * **「そんな列は無い」と言われたか**(0064)。
 *
 * **`noTable()` と混ぜない。** あちらは表・関数の話で、
 * わざと `select('*')` にして 42703 をすり抜けさせている ——
 * `id` を持たない表を印に選んだときに**入っていないのに黙る**のを
 * 避けるためである(すぐ上の説明)。
 *
 * こちらは**列そのものを名指しで読む**ので、42703 は
 * 「その移行がまだ」という意味にしかならない。
 * PostgREST は `PGRST204`、Postgres は `42703` を返す。
 */
const noColumn = (error) => {
  const m = `${error?.code ?? ''} ${error?.message ?? ''}`
  return /column .* does not exist|42703|PGRST204/i.test(m) || noTable(error)
}

/**
 * 貼る SQL が最後まで届いているか。
 *
 * @returns `'ok'`(済んでいる)/ `'missing'`(まだ)/ `'unknown'`(分からない)
 */
export async function checkSqlApplied() {
  if (!supabase) return 'unknown'
  try {
    /* **列の名前を書かない**(`select('*')`)。もとは `'id'` だったが、
       `learner_features`(0055)のように **`id` を持たない表**を印に
       選んだ瞬間、断りが「そんな列は無い」(42703)になって
       `noTable()` をすり抜け、**入っていないのに黙る**ことになる */
    /* **関数の印**(0056)。無ければ PGRST202 で断られる。
       **引数の要らない関数だけを印にする** —— 引数が要ると、
       その中身しだいで断られて「まだです」と誤診する */
    /* **行の印**(0060)。表そのものは前からあるので、
       **その行が在るか**を見る。読めるのに 0 件なら「まだです」である */
    if (NEWEST_MARK.row) {
      const { column, value } = NEWEST_MARK.row
      const { data, error: rowError } = await supabase
        .from(NEWEST_MARK.table).select(column).eq(column, value).limit(1)
      if (rowError) return noTable(rowError) ? 'missing' : 'unknown'
      return (data?.length ?? 0) > 0 ? 'ok' : 'missing'
    }
    /* **列の印**(0064)。**その列を名指しで読む** ——
       `select('*')` では、列が無くても素通りして「もう入っています」に
       なってしまう(**いちばん悪い壊れ方**・CLAUDE.md)。
       **0 件は「まだ」ではない** —— 教材が1つも無いだけである */
    if (NEWEST_MARK.column) {
      const { error: colError } = await supabase
        .from(NEWEST_MARK.table).select(NEWEST_MARK.column).limit(1)
      if (colError) return noColumn(colError) ? 'missing' : 'unknown'
      return 'ok'
    }
    const { data, error } = NEWEST_MARK.rpc
      ? await supabase.rpc(NEWEST_MARK.rpc)
      : await supabase.from(NEWEST_MARK.table).select('*').limit(1)
    if (error) return noTable(error) ? 'missing' : 'unknown'
    /* **中身まで見る印**(0063)。関数は在るのに、制約のほうを
       貼り忘れている形がありうる。**在るかどうかだけでは足りない** */
    if (NEWEST_MARK.has) {
      const list = Array.isArray(data) ? data : []
      return list.includes(NEWEST_MARK.has) ? 'ok' : 'missing'
    }
    return 'ok'
  } catch { return 'unknown' }
}

/* ── まだ済んでいないことだけを並べる ────────────────────────── */

/**
 * **済んでいることは、1行も出さない。**
 * 返ってくるのは「まだのこと」だけである(**行き止まりを作らない**ので、
 * どの行にも「どこで・何を」まで書いてある)。
 *
 * @returns {Promise<{id:string,title:string,why:string,how:string,url:string,more?:string}[]>}
 */
export async function pendingSetup(force = false) {
  const todo = []

  const sql = await checkSqlApplied()
  if (sql === 'missing') {
    todo.push({
      id: 'sql',
      title: '貼る SQL が、まだ最後まで届いていません',
      why: `${NEWEST_MIGRATION} の「${NEWEST_MARK.label}」が、まだ Supabase にありません。`
        + 'レッスンでその弱点を指摘しても、教材を作れない状態です。',
      how: 'Supabase → 左メニュー SQL Editor → New query に貼り付けて、'
        /* **強調の書き方(`**`)を混ぜない。** ここは `<div>` にそのまま出る
           文字列なので、Markdown として読まれず**画面にそのまま見える**
           (CLAUDE.md・場面の説明で一度踏んだ) */
        + '右下の Run を押してください。何度貼っても安全です。',
      url: MATOME_URL,
      more: CHECK_URL,
    })
  }

  /* **②は、まず訊きに行く。**(ふだんは1回だけ。確かめ直すときは訊き直す) */
  await checkGenGateway(force)
  if (genGatewayStale()) {
    todo.push({
      id: 'gen',
      title: '教材の窓口(generate-material)が、まだ置き直されていません',
      why: `いま置かれているのは ${genGatewayRev()}、必要なのは ${NEED_GEN_REV} 以降です。`
        + 'このままだと、会話の登場人物の性別が読み上げの声と合わないこと、'
        + '文法解説が使えないこと、スピーチの原稿が 1,500 文字で切られることがあります。',
      how: 'Supabase → 左メニュー Edge Functions → generate-material を開き、'
        + '中身をリポジトリの最新のものに貼り替えて Deploy してください。',
      url: `${REPO}/${BRANCH}/supabase/functions/generate-material/index.ts`,
    })
  }

  return todo
}
