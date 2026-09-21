/**
 * **本文から拾う「かたまり」の分類**(第5.230節・2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > 「本文に出た語句」ですが、これを語句というよりも、コロケーション、
 *   > 句動詞、イディオム、決まり文句、つなぎ言葉、丁寧な言い回し、
 *   > 言い換え表現などに分類されるものをピックアップし、
 *   > それぞれに練習問題を追加してほしいです。
 *   > …単語単体はここには載せない。あくまで２語以上のチャンクを練習する場とする
 *
 * 【なぜ分類が要るのか】
 *   これまでは「語句」とだけ書いて、意味と例文を並べていた。
 *   ところが `come up with`(句動詞)と `Could you possibly …?`
 *   (丁寧な言い回し)と `on the other hand`(つなぎ言葉)は、
 *   **覚え方も使いどころも違う。** 同じ見た目で並べると、
 *   どれも「知らない英語」としか見えない。
 *   **札を1つ付けるだけで、何の仲間かがその場で分かる。**
 *
 * 【7つに固定する】(利用者の決定)
 *   足せる形にはしない。**増えるほど、どれに入れるか迷う。**
 *   迷ったものは、いちばん近い1つに入れる(AI にもそう指示している)。
 *
 * 【ここに置いた理由】
 *   **呼び名は1か所**(CLAUDE.md)。画面・窓口への指示・検証の3か所が
 *   同じものを見る。窓口(`generate-material`)は Deno なので
 *   ここを読み込めない —— だから**画面がこの一覧を窓口へ送る**
 *   (`materialAngles` の切り口とまったく同じ作法。
 *   書き写すと、足した日に窓口を置き直してもらうことになる)。
 *
 *   Supabase も `import.meta.env` も引き連れていないので、
 *   **素の node から呼べる**(CLAUDE.md)。
 * ============================================================================
 */

/**
 * 7つの分類。**並びも呼び名もここだけ。**
 *
 * `what` は**窓口へ送る手がかり**である(AI に「どれに入れるか」を
 * 決めさせるための1行)。**画面には出さない** ——
 * 画面に出すのは札(`label`)だけで、説明の文は置かない
 * (`.claude/rules/common.md`「余計な説明書きを置かない」)。
 */
export const CHUNK_KINDS = [
  { id: 'collocation', label: 'コロケーション',
    what: '結びつきの決まった語の組(make a decision / heavy rain)' },
  { id: 'phrasal_verb', label: '句動詞',
    what: '動詞 + 副詞 / 前置詞(come up with / put off)' },
  { id: 'idiom', label: 'イディオム',
    what: '語の意味の足し算では分からない言い回し(hit the road)' },
  { id: 'set_phrase', label: '決まり文句',
    what: 'その場面でそのまま口に出す言い方(Let me get back to you.)' },
  { id: 'connector', label: 'つなぎ言葉',
    what: '話をつなぐ・向きを変える(on the other hand / that said)' },
  { id: 'polite', label: '丁寧な言い回し',
    what: '角を立てずに頼む・断る・言いにくいことを言う(Would you mind …?)' },
  { id: 'paraphrase', label: '言い換え表現',
    what: '同じ内容を別の言い方にする(in other words / to put it simply)' },
]

/** id の一覧。**書き写さない**(窓口へ送る形を組むのに使う) */
export const CHUNK_KIND_IDS = CHUNK_KINDS.map((k) => k.id)

export const chunkKind = (id) => CHUNK_KINDS.find((k) => k.id === id) ?? null

/**
 * 画面に出す札。
 *
 * **当てられないときは空を返す**(CLAUDE.md「当てられなければ黙る」)。
 * 0063 より前に作った教材には分類が入っていないので、
 * そこに「その他」などと書くと、**無いものを在るように見せる**ことになる。
 * 呼ぶ側は空なら札そのものを描かない。
 */
export const chunkKindLabel = (id) => chunkKind(id)?.label ?? ''

/**
 * **2語以上のかたまりか。**(利用者の指定「単語単体はここには載せない」)
 *
 * ハイフンでつながる語は1語と数える —— `exerciseTypes.js` の
 * `isWrongShape`(単語とフレーズの取り違え)と**同じ数え方**である。
 * **数え方を2通り持たない**(CLAUDE.md)。
 */
export const isChunkText = (text) => {
  const s = String(text ?? '').trim()
  if (!s) return false
  return s.split(/\s+/).filter(Boolean).length >= 2
}

/** 練習の問数。**下限と上限はここ1か所**(窓口への指示も画面もこれを見る) */
export const DRILL_MIN = 5
export const DRILL_MAX = 10

/**
 * その かたまり の練習問題を、出せる形にそろえる。
 *
 * **0 と「無い」を取り違えない**(CLAUDE.md)。
 * 片方しか無い問は落とす —— 日本語だけでは答え合わせができず、
 * 英語だけでは出題できない。**残りが0問なら空を返す**ので、
 * 呼ぶ側は「練習する」そのものを出さない(効かない操作を見せない)。
 */
export const chunkDrills = (item) => {
  const list = Array.isArray(item?.practice) ? item.practice : []
  return list
    .map((d) => ({ ja: String(d?.ja ?? '').trim(), en: String(d?.en ?? '').trim() }))
    .filter((d) => d.ja && d.en)
    .slice(0, DRILL_MAX)
}
