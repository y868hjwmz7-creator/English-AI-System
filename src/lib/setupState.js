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
export const NEWEST_MIGRATION = '0057'

/**
 * その移行が入っているかを見る印。
 *
 * **表を作らない移行もある。** 0056 は `review_words()` の上限を
 * 上げるだけで、表も列も1つも増えない。だから印は**関数**にした ——
 * 0056 が作る `wordbook_limit()` が在るかどうかで見る
 * (あの関数は上限そのものの出どころでもある。**印のためだけの
 * 関数を作っていない**)。
 *
 * `table` を書けば表の有無、`rpc` を書けば関数の有無を見る。
 * **どちらか一方だけ**を書く。
 */
export const NEWEST_MARK = {
  table: 'shelf_words', label: '業種べつの単語帳(棚)',
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
    const { error } = NEWEST_MARK.rpc
      ? await supabase.rpc(NEWEST_MARK.rpc)
      : await supabase.from(NEWEST_MARK.table).select('*').limit(1)
    if (!error) return 'ok'
    if (noTable(error)) return 'missing'
    return 'unknown'                  // 通信の失敗など。**騒がない**
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
        + 'ゲストごとに出すものを決める欄など、新しく足したものが使えない状態です。',
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
