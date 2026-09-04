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

  const items = (body.items ?? [])
    .filter((it) => String(it.audio_text || it.prompt_en || '').trim())
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
