/**
 * 教材の読み上げ音声を、**もう一度作り直す**(2026-09 実機)。
 *
 * ============================================================================
 * 【なぜ要るのか】
 *
 *   > Mika のひとつ目の発言だけ、明らかに ElevenLabs ではない
 *   > 酷い音声になってしまいます。他でも起こりそうなので原因究明して
 *   > 改善してください。
 *
 *   窓口(`speak`)は、良い声(ElevenLabs)で作れなかったときに
 *   **標準の声(Google / Azure)で作る。** 鳴らないより、その方がよいからである。
 *   ところが**直す前の窓口は、それを「良い段」の場所に置いていた。**
 *
 *     tts/1/premium/<声>/<英文の指紋>.mp3   ← ここに標準の声の MP3
 *
 *   画面はまずこの場所を見に行き、**あればそれで終わり**にする(速いから)。
 *   だから ELEVENLABS_API_KEY を入れたあとも、
 *   **その英文だけは永久に標準の声のまま**になる。
 *   1度でも鳴らした英文だけが、こうなる。だから
 *   **「1つの発言だけおかしい」**という形で出る。
 *
 * 【これから作るものは、もう大丈夫】
 *   いまの窓口は**実際に作った段**で置く(`madeTier`)。標準の声で作れば
 *   標準の場所に入り、良い段の場所は空のままになるので、
 *   鍵を入れたあとに開けば、そこで初めて良い声が作られる。
 *   **利用者が `speak` を配置し直せば、これ以上は増えない。**
 *
 * 【すでに置かれてしまったものは、こちらから直す】
 *   画面は「ある」ものを鳴らすだけなので、放っておいても直らない。
 *   **頼まれたときだけ**作り直す(`force`)。
 *   自動では作り直さない — 作り直しはそのまま ElevenLabs への課金になる
 *   (**見えない費用は管理できない**・CLAUDE.md)。
 */
import { remakeClip } from './audioClips.js'
import { castClipSpeakers, voiceFor } from './voiceCast.js'
import { resolveVoices } from '../data/clipVoices.js'
import { PREMIUM, voiceTierFor } from './voiceTier.js'

/**
 * その教材で、**良い声(ElevenLabs)で鳴るはずの英文**を並べる。
 *
 * 標準の声(ドリル・単語・フレーズ)は作り直さない。
 * あちらは Google / Azure の無料枠で作られていて、
 * **段を取り違える不具合そのものが起きない**(良い段に落ちようがない)。
 *
 * @returns {{text: string, voiceId: string}[]}
 */
export function premiumClipsOf(material) {
  const voiceIds = material?.voiceIds ?? null
  const solo = resolveVoices(voiceIds)[0]
  const out = []
  const seen = new Set()
  for (const sec of material?.sections ?? []) {
    const tier = voiceTierFor({
      exerciseType: sec.exercise_type,
      tags: material?.tags ?? [],
    })
    if (tier !== PREMIUM) continue
    // 話す人 → 声。**鳴らすときとまったく同じ決め方**でなければ、
    // 別の場所の MP3 を作り直してしまう
    const cast = castClipSpeakers((sec.items ?? []).map((it) => it.speaker), voiceIds)
    for (const it of sec.items ?? []) {
      const text = String(it.audio_text || it.prompt_en || '').trim()
      if (!text) continue
      const voiceId = voiceFor(cast, it.speaker, solo)
      const key = `${voiceId}|${text}`
      if (seen.has(key)) continue      // 同じ英文を二度作らない(二度課金しない)
      seen.add(key)
      out.push({ text, voiceId })
    }
  }
  return out
}

/**
 * 作り直す。**1本ずつ順に。**
 *
 * まとめて投げると、窓口(Edge Function)が同時に何本も立ち上がり、
 * ElevenLabs 側でも弾かれやすくなる。急ぐ場面ではないので、順に行う。
 *
 * @param material  教材(`sections` と `voiceIds` が要る)
 * @param onProgress ({done, total}) 進み具合。**押した場所のすぐ下に出す**
 * @returns {{done: number, failed: number, total: number}}
 */
export async function remakeMaterialClips(material, onProgress = null) {
  const list = premiumClipsOf(material)
  let done = 0
  let failed = 0
  onProgress?.({ done: 0, total: list.length })
  for (const { text, voiceId } of list) {
    const url = await remakeClip(text, voiceId, PREMIUM)
    if (url) done += 1
    else failed += 1
    onProgress?.({ done: done + failed, total: list.length })
  }
  return { done, failed, total: list.length }
}
