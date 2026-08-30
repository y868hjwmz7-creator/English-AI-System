/**
 * 6Steps — 利用者のスクールのトレーニング(2026-08 利用者の指定)。
 *
 * 【いちばん大事なこと】
 *   6つは**別々の教材ではない。同じ本文に対する取り組み方**である。
 *   だから演習(セクション)として分けない。分けたために「長文」が
 *   16個の短文になった失敗が、すでに一度ある(仕様書 第5.17節)。
 *
 *   もともとこの画面にあった「音読 / オーバーラッピング / シャドーイング /
 *   リピーティング」の4つが、**そのまま 6Steps の一部**だった。
 *   横に別のボタンを足すのではなく、**この切り替えを 6Steps に置き換える。**
 *   同じことをするものが2つ並ぶのを避けるためである。
 *
 * 【単位が2通りある】
 *   ①②④⑥ は**1文ずつ**。③⑤ は**本文まるごと**。
 *   本文の項目は「段落(記事)」「発言(会話)」なので、
 *   1文ずつのステップでは `splitSentences()` でさらに分ける。
 */
import { splitSentences } from './wordTiming.js'

/**
 * @property {string} id       内部の名前
 * @property {string} no       画面に出す番号(①〜⑥)
 * @property {string} label    画面に出す名前
 * @property {string} hint     何をするステップか(利用者の言葉をそのまま使う)
 * @property {'sentence'|'passage'} unit  1文ずつか、本文まるごとか
 * @property {number} rate     お手本の速さ(掛け算のもと)
 * @property {boolean} script  本文の英語を見せるか(⑤だけ false)
 */
export const SIX_STEPS = [
  {
    id: 'dictation', no: '①', label: 'ディクテーション',
    unit: 'sentence', rate: 0.9, script: false,
    hint: '1文ずつ繰り返し聞き、聞こえたとおりに書き取ります。'
      + '「解答を見る」で英文と訳が出ます。そのあと、お手本をまねて声に出します。',
  },
  {
    id: 'slash', no: '②', label: 'スラッシュリーディング',
    unit: 'sentence', rate: 0.9, script: true,
    hint: '意味のカタマリで区切り、前から順に訳せるようにします。'
      + '語と語のあいだを押すとスラッシュが入ります。',
  },
  {
    id: 'overlap', no: '③', label: 'オーバーラッピング',
    unit: 'passage', rate: 0.85, script: true,
    hint: '本文を見ながら、お手本と同時に重ねて読みます。'
      + 'まず音だけをまね、慣れたら意味と語順も考えながら読みます。',
  },
  {
    id: 'meaning', no: '④', label: '意味音読',
    unit: 'sentence', rate: 0.9, script: true,
    hint: '②で分かった意味と文法を考えながら読みます。**速く読むのが目的ではありません。**'
      + '慣れたら、1文読んで顔を上げ、日本語 → 英語の順に言います。',
  },
  {
    id: 'shadow', no: '⑤', label: 'シャドーイング',
    unit: 'passage', rate: 0.85, script: false,
    hint: '③を、本文を見ないで行います。'
      + '追いつけなくなったら「本文を出す」で戻して構いません。',
  },
  {
    id: 'repeat', no: '⑥', label: 'リピーティング',
    unit: 'sentence', rate: 0.9, script: false,
    hint: '1文を通して聞き、聞き終わってから同じ英文を口に出します。'
      + '慣れたら、日本語で意味を言ってから英語を言います。分からなくなったら聞き直します。',
  },
]

export const stepOf = (id) => SIX_STEPS.find((s) => s.id === id) ?? SIX_STEPS[0]

/** ④⑥ の「2段階目」。1文読む → 日本語 → 英語 */
export const HAS_LOOKUP = new Set(['meaning', 'repeat'])

/**
 * 本文の項目(段落 / 発言)を、**1文ずつ**にほどく。
 *
 * ①②④⑥ は1文が単位である。記事の項目は段落なので、そのままでは大きすぎる。
 * 文の切り方は読み上げと同じ `splitSentences()` を使う。
 * **切り方を2か所に持たない。** ずれると、聞いた文と書く文が食い違う。
 *
 * 日本語は**段落ぶんしか無い**(訳は段落単位で作られる)。
 * だから文ごとの訳は付けられない。段落の訳を、その段落のどの文にも添える。
 * **無いものを、あるように見せない。**
 */
export function sentencesOf(items) {
  const out = []
  ;(items ?? []).forEach((item, n) => {
    const en = String(item.prompt_en ?? '').trim()
    if (!en) return
    const parts = splitSentences(en)
      .map((s) => en.slice(s.start, s.end).trim())
      .filter(Boolean)
    parts.forEach((text, i) => {
      out.push({
        id: `${item.id ?? n}-${i}`,
        text,
        speaker: item.speaker ?? '',
        // 段落に文が1つしか無いときは、その訳はその文の訳でもある
        ja: item.prompt_ja ?? '',
        jaIsWhole: parts.length > 1,
        itemId: item.id ?? n,
      })
    })
  })
  return out
}
