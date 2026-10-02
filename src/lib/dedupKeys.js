/**
 * ============================================================================
 * **「同じ英文か」を見分ける鍵**(2026-10-02・第5.345節)
 *
 * 2026-10-02 実機・利用者の指摘。
 *
 *   > 応答問題で15個のフレーズをテキストから入れる、を選択すると
 *   > その倍の問題数30を選択していて、そうなるはずなのに、
 *   > 15問になってしまっています。
 *   > 恐らく指定できる問題数全てで同じ仕様になってしまっています
 *
 * **そのとおりだった。** 鍵に `answer` が入っていたためである。
 *
 *   | | ふつうの教材 | **応答問題** |
 *   |---|---|---|
 *   | 同じ `answer` が2回出たら | **前に出した問**。落とす | **そういう設計**。残す |
 *
 * 応答問題は**1つの表現を2回、正解にする**(利用者の指定「20問選んだ時は
 * 10個の表現がそれぞれ2回ずつ正解になるようにします。量をこなすためです」)。
 * ところが `sentencesOf()` が `answer` を鍵にしていたので、
 * **2回目が1問残らず「前に出した英文」として落ちていた** —— きっちり半分。
 *
 * ── なぜ別のファイルなのか ──────────────────────────────
 *
 *   `materials.js` は Supabase と `import.meta.env` を引き連れており、
 *   **手元で一度も走らせられない。** 落とす算段だけをここへ出せば、
 *   `npm run test:response` が**素の node でそのまま測れる**
 *   (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 *
 *   **中身は1行も変えずに移した。** 足したのは `repeatAnswer` だけで、
 *   **渡さなければこれまでとまったく同じ**である。
 *   `materials.js` は読み直して出し直すだけなので、**呼ぶ側は1行も変わらない**
 *   (`normEn` を `textNorm.js` へ出したときと、まったく同じ作法)。
 *
 * **取り込んでいるのは、同じく何も取り込んでいない `textNorm.js` だけ。**
 * ============================================================================
 */
import { normEn } from './textNorm.js'

/* **例文と練習の英文も数に入れる**(第5.254節)。
   単語 / フレーズは1語ずつのまとまりになり、**英文はその中にもある。**
   ここに入れないと、**あとの「ランダムで出題」が同じ文を作り直す**
   (利用者の指定「これらの問題は始めの問題とは被らない内容とすること」)。
   **拾い方はここ1か所** —— 作る側と照合する側で書き写さない */
const insideEn = (item) => [
  ...(Array.isArray(item?.practice) ? item.practice : []).map((d) => d?.en),
  ...(Array.isArray(item?.examples) ? item.examples : []).map((x) => x?.en),
]

/**
 * その問の、重複を見る英文をぜんぶ並べる。
 *
 * ★ `repeatAnswer` … **解答がわざと何度も出る教材か**(応答問題・第5.345節)。
 *   真のときは**解答を鍵にしない。** 鍵にすると、**2回目が1問残らず
 *   「前に出した英文」として落ち、問数がきっちり半分になる。**
 *   そのときでも**読み上げる質問(`audio_text`)は鍵のまま**なので、
 *   **同じ質問を2回作ることは、これまでどおり防げる。**
 *
 *   **判断はここに書かない。** どの種類がそうなのかは
 *   `materialKinds.js` の `repeatsAnswer()` 1か所が持つ。
 */
const fieldsOf = (item, repeatAnswer = false) => [
  item?.prompt_en,
  item?.audio_text,
  ...(repeatAnswer ? [] : [item?.answer]),
  ...insideEn(item),
]

/**
 * 1つの設問に含まれる英文をすべて取り出す(そろえた形で)。
 *
 * 提示文・読み上げ文・解答のどれか1つでも既出と一致すれば、
 * その設問は「前に出した文」である。穴埋めの提示文は「___」が
 * 空白に潰れるため、解答文と同じ形になる。
 */
export const sentencesOf = (item, repeatAnswer = false) =>
  fieldsOf(item, repeatAnswer).map(normEn).filter(Boolean)

/** 設問から、そのまま照合に出せる生の英文を取り出す */
export const rawSentencesOf = (item, repeatAnswer = false) =>
  fieldsOf(item, repeatAnswer).map((v) => String(v ?? '').trim()).filter(Boolean)

/**
 * 生成した設問から、すでにある英文と同じものを取り除く。
 *
 * usedSet は「そろえた形」の集合。残した設問の英文はその場で
 * usedSet に足す。同じ生成の中で同じ文が二度出るのも防ぐため。
 */
export function dropDuplicates(items, usedSet, repeatAnswer = false) {
  const kept = []
  const dropped = []
  for (const it of items ?? []) {
    const keys = sentencesOf(it, repeatAnswer)
    if (!keys.length) { kept.push(it); continue }
    if (keys.some((k) => usedSet.has(k))) dropped.push(keys[0])
    else { kept.push(it); keys.forEach((k) => usedSet.add(k)) }
  }
  return { kept, dropped }
}
