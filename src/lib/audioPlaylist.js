/**
 * ============================================================================
 * 教材の音声を、**鳴る順に並べる**。
 *
 * 【なぜ別のファイルにしてあるか】(2026-09 実機)
 *
 *   ここは `downloadAudio.js` の中に書いてあった。ところがあちらは
 *   Supabase(`clipUrl`)を引き連れているので、**素の node では
 *   一度も走らせられなかった。** そのため
 *
 *     const bodyOf = (material) => (material?.sections ?? [])
 *       .find((sec) => sec.exercise_type === 'reading' || … === 'dialogue')
 *
 *   という書き間違い —— 記事の演習の id は **`article`** である ——
 *   が誰にも捕まらず、**会話では出るのに、記事だけ
 *   「音声をダウンロード」のボタンが出ない**まま渡してしまった。
 *
 *   > あれ？先ほど作成した「ダイアローグ」では音声のダウンロードが
 *   > できるのですが、その後に作成した「記事」ではダメでした。
 *
 *   `npm run lint` も `npm run build` も通る。**作ってみるまで分からない。**
 *   だから **`playMark.js` / `mp3Join.js` と同じように**、
 *   何にも依存しない形に切り出して `npm run test:mp3` で見張る。
 *
 * 【本文かどうかを、ここで数えない】
 *   種類の名前を書き写すと、演習を足したときに必ずどこかが古くなる。
 *   本文かどうかは `exerciseTypes.js` の **`isPassage`** が持っている
 *   (`voiceTierFor` も 6Steps もそちらを見ている)。
 *   **判断を2か所に置かない。**
 *
 * 【並べ方は「Listen (全体)」とまったく同じ】
 *   声の当て方も間(ま)の決め方も、鳴らすときと同じ道具を通す
 *   (`castClipSpeakers` / `turnGapMs`)。**数え方を2通り持たない。**
 * ============================================================================
 */
import { castClipSpeakers, voiceFor } from './voiceCast.js'
import { resolveVoices } from '../data/clipVoices.js'
import { isPassageSection } from '../data/exerciseTypes.js'
import { voiceTierFor } from './voiceTier.js'
import { turnGapMs } from './turnGap.js'

/** 本文の演習(記事・会話・会議)。**「Listen (全体)」が鳴らすもの** */
export const bodySectionOf = (material) => (material?.sections ?? [])
  .find((sec) => isPassageSection(sec.exercise_type)) ?? null

/**
 * 音声になる項目だけ。**絞り方をここ1か所に置く。**
 *
 * 通しの一覧も、段落ごとの Listen が使う番号も、**同じこの絞り方**で
 * 数える。片方だけ変えると**番号が1つずれて、別の発言が鳴る。**
 */
export const audioItemsOf = (items) => (items ?? [])
  .filter((it) => String(it.audio_text || it.prompt_en || '').trim())

/** その項目の、読み上げる英文。**`audioItemsOf` と対で使う** */
export const audioTextOf = (it) => String(it.audio_text || it.prompt_en).trim()

/**
 * **1本にまとめた音声の、どこを鳴らせばよいか**(2026-09 利用者の指定)。
 *
 *   > 音声については「1本にまとめる」の仕様に統一しましょう。
 *   > 「段落ごと」は廃止です
 *
 * 本文の音声は**1本だけ**作る。段落ごと・発言ごとの Listen は、
 * **その1本の中の区間**を鳴らす(別の MP3 を作らない = 二度課金しない)。
 *
 * **番号は `audioItemsOf` で数える。** 描くときの番号(空の項目も混じる)を
 * そのまま渡すと、**別の発言の区間を鳴らす。**
 *
 * **本文の演習でなければ、必ず `null` を返す。** 内容の理解や語句は
 * 1本の中に入っていないので、区間を当てようがない。
 * **その判断は `isPassageSection` 1か所に任せる** —— 呼ぶ側に
 * 「本文のときだけ渡してください」と約束させると、必ずどこかが破る。
 *
 * @param {object} section  演習(**項目の一覧ごと**渡す)
 * @param {object} cast     話す人 → 声(`castClipSpeakers` の返り値)
 * @param {string} solo     話す人がいないときの声
 * @param {object} item     いま鳴らそうとしている項目(**同じ実物**)
 * @returns {{texts: string[], voiceIds: string[], index: number}|null}
 */
export function wholeSliceOf(section, cast, solo, item) {
  if (!isPassageSection(section?.exercise_type)) return null
  const list = audioItemsOf(section.items)
  // **2つ以上ないと、1本にまとめる意味がない**(`wholeClip` も同じ条件)
  if (list.length < 2) return null
  const index = list.indexOf(item)
  if (index < 0) return null
  return {
    texts: list.map(audioTextOf),
    voiceIds: list.map((it) => voiceFor(cast, it.speaker, solo)),
    index,
  }
}

/**
 * 通しで鳴るものを、順に並べる。
 *
 * @returns {Array<{text, voiceId, tier, gapMs}>} `gapMs` は**そのあとの間**
 */
export function materialAudioClips(material) {
  const body = bodySectionOf(material)
  if (!body) return []
  const voiceIds = material?.voiceIds ?? material?.voice_ids ?? null
  const solo = resolveVoices(voiceIds)[0]
  const cast = castClipSpeakers((body.items ?? []).map((it) => it.speaker), voiceIds)
  const tier = voiceTierFor({
    exerciseType: body.exercise_type,
    tags: material?.tags ?? [],
  })

  const items = audioItemsOf(body.items)
  return items.map((it, i) => {
    const next = items[i + 1]
    /* **間の決め方も、鳴らすときと同じ。**
       前の発言と次の発言の中身から決まる(`turnGap.js`)。
       同じ人が続けて話すときは、受け答えの規則を当てない */
    const gapMs = next
      ? turnGapMs(it.prompt_en, next.prompt_en, {
        sameVoice: String(it.speaker ?? '') === String(next.speaker ?? ''),
      })
      : 0
    return {
      text: String(it.audio_text || it.prompt_en).trim(),
      voiceId: voiceFor(cast, it.speaker, solo),
      tier,
      gapMs,
    }
  })
}
