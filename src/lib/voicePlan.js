/**
 * **えらんだ声が、どのページで鳴るのか**(第5.296節・2026-09-28 利用者の指定)。
 *
 *   > 選択画面には名前、性別と(Google)の評価を入れてください。
 *   > そうでないとややこしいです。
 *
 * 【なぜ、ややこしかったのか】
 *   声をえらぶ欄には **ElevenLabs の声**(Jessica / David …)が並ぶ。
 *   ところが**その声で読むページと、読まないページがある。**
 *
 *   | どのページ | 何で読むか |
 *   |---|---|
 *   | 本文(記事・会話)/ リスニング | **えらんだ声そのもの**(ElevenLabs) |
 *   | 発音・リズムの弱点タグが付いた教材 | **全ページ** えらんだ声 |
 *   | それ以外(英文和訳・和文英訳・単語・フレーズ) | **代役**(Google の男女) |
 *
 *   欄には「Jessica(女性)」としか出ていなかったので、
 *   **どこで Jessica が鳴るのかが分からない。**
 *
 * 【ここは「いまの状態」を返すだけ】
 *   **説明の文を置かない**(CLAUDE.md)。返すのは
 *   **いま選んでいる種類と弱点で、どちらがどのページを読むか**である。
 *
 * 【段の決め方は書き写さない】
 *   `voiceTierFor()` 1か所から引く。演習を足した日に、ここだけ古くならない。
 *
 * **素の node で走らせられる形に切り出す**(CLAUDE.md)——
 * `npm run test:voice` が、3つの形を実際に呼んで確かめる。
 */
import { defaultSectionsFor, hasSpokenAudio, sectionLabel } from '../data/exerciseTypes.js'
import { PREMIUM, voiceTierFor } from './voiceTier.js'

/**
 * @param {string} kind 教材の種類
 * @param {Array<string>} tags 弱点タグ
 * @param {Array<string>} voiceIds **えらんだ声**(第5.308節)。
 *   Google の声が混じっていれば、`voiceTierFor()` が全ページを代役に落とす
 * @param {string} examKey **テスト対策の、試験と PART**(第5.309節)。
 *   `exam` だけは PART で構成が変わる —— 渡さないと、
 *   **いつも最初の PART(リスニング)の話をしてしまう**
 * @returns {{ pick: string[], base: string[] }}
 *   `pick` … **えらんだ声**で読むページの名前
 *   `base` … **代役**で読むページの名前
 *   どちらも**音声の付くページだけ**(付かないページは、どちらにも入らない)
 */
export function voicePlan(kind, tags = [], voiceIds = null, examKey = '') {
  const pick = []
  const base = []
  for (const sec of defaultSectionsFor(kind, examKey) ?? []) {
    const t = sec.exercise_type
    /* **音の付かない演習は、どちらにも入れない**(誤り訂正・穴埋め)。
       入れると「読みます」と書いた場所で**1本も鳴らない。**
       判断は `hasSpokenAudio()` 1か所(`audioFrom` から来る)——
       ここで `t === 'error_correction'` と書かない。
       **見張りがこれを捕まえた**(書いたつもりで、書いていなかった) */
    if (!hasSpokenAudio(t)) continue
    const name = sectionLabel(kind, t)
    const tier = voiceTierFor({ exerciseType: t, tags, voiceIds })
    if (tier === PREMIUM) pick.push(name)
    else base.push(name)
  }
  return { pick: [...new Set(pick)], base: [...new Set(base)] }
}

/**
 * 欄の下に出す**1行**。
 *
 * **数を書かない。** ページの名前は `sectionLabel()` から来るので、
 * 演習の名前を変えた日も、ここは付いてくる。
 *
 * @param {string} kind 教材の種類
 * @param {Array<string>} tags 弱点タグ
 * @param {string} provider 代役の会社(`providerOf()` から)
 * @param {string} gender 代役の性別(`'male'` / `'female'`)
 * @param {Array<string>} voiceIds **えらんだ声**(第5.308節)。
 *   Google の声をえらぶと「すべて ◯◯ で読みます」に変わる ——
 *   **黙って落とさない**(CLAUDE.md)
 * @param {string} examKey **テスト対策の、試験と PART**(第5.309節)
 */
/**
 * **その構成に、読み上げの付く段が1つでもあるか**(第5.309節)。
 *
 * **テスト対策には、音の無い PART がある**(TOEIC Part 5・IELTS Writing など)。
 * そこで「話す人」「声の出し方」を出すと、**押しても何も鳴らない欄**になる
 * (効かない操作を見せない・CLAUDE.md)。
 *
 * **判断はここ1か所。** 画面で「穴埋めだけなら…」と書き分けない ——
 * 演習を足した日に、置いた場所の数だけ食い違う。
 * `voicePlan()` から引くので、**数え方も1つ**である。
 */
export const hasAnyAudio = (kind, tags = [], examKey = '') => {
  const { pick, base } = voicePlan(kind, tags, null, examKey)
  return pick.length + base.length > 0
}

export function voicePlanLine(kind, tags, provider, gender, voiceIds = null, examKey = '') {
  const { pick, base } = voicePlan(kind, tags, voiceIds, examKey)
  const 代役 = `${provider}の${gender === 'male' ? '男性' : '女性'}`
  if (!pick.length && !base.length) return ''
  if (!base.length) return 'すべて、えらんだ声で読みます'
  if (!pick.length) return `すべて ${代役} で読みます`
  return `${pick.join('・')}は えらんだ声 / ほかは ${代役}`
}
