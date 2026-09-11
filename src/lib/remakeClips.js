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
import { remakeClip, wholeClip } from './audioClips.js'
import { castClipSpeakers, voiceFor } from './voiceCast.js'
import { materialAudioClips } from './audioPlaylist.js'
import { resolveVoices } from '../data/clipVoices.js'
import { speakChunks } from './speakChunks.js'
import { PREMIUM, voiceTierFor } from './voiceTier.js'

/**
 * その教材で、**良い声(ElevenLabs)で鳴るはずの英文**を並べる。
 *
 * 標準の声(ドリル・単語・フレーズ)は作り直さない。
 * あちらは Google / Azure の無料枠で作られていて、
 * **段を取り違える不具合そのものが起きない**(良い段に落ちようがない)。
 *
 * ── **長い段落は、鳴らすときと同じように分ける**(2026-09 実機)──────
 *
 *   > 長いSpeech練習は直っていませんでした。ずれ方としては、
 *   > 音に対してハイライトがどんどん遅れていきます。
 *
 * 読み上げは `speakChunks()` で**かけらに分けてから**窓口へ渡すので、
 * MP3 の置き場所は**かけらの英文の指紋**で決まる。ところがここは
 * **段落まるごとの英文**で作り直していた。つまり
 *
 *   ・**誰も鳴らさない場所**の MP3 を作って課金していた
 *   ・**鳴らすほうのかけら**は、いつまでも作り直されない
 *     (だから時刻の控え `.json` も、永久にできない)
 *   ・段落が 1,700 文字を超えると、窓口に断られてただ失敗していた
 *
 * **貼った原稿(Speech練習)だけで起きる。** AI が書く段落は
 * 300 文字ほどなので、`speakChunks` を通っても1つのままである
 * (**ふつうの教材では、これまでと1本も変わらない**)。
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
      /* **鳴らすときとまったく同じ分け方。** ここを書き写すと、
         別の場所の MP3 を作り直して二度課金することになる */
      for (const piece of speakChunks(text)) {
        const body = piece.text.trim()
        if (!body) continue
        const key = `${voiceId}|${body}`
        if (seen.has(key)) continue    // 同じ英文を二度作らない(二度課金しない)
        seen.add(key)
        out.push({ text: body, voiceId })
      }
    }
  }
  return out
}

/**
 * **押す前に、どれだけ課金されるかを言えるようにする**(2026-09 実機)。
 *
 *   > え? 作り直してません。長くてお金がかかるので
 *
 * それまで画面に出していたのは**本数だけ**だった。ところが
 * **ElevenLabs の課金は文字数**なので、「20 本」では高いのか安いのかが
 * 判断できない。**貼った原稿は1本が桁違いに長い**(ふつうの段落 300 文字に
 * 対し、かけらは 1,700 文字まで)ので、本数はまったく当てにならない。
 *
 * **見えない費用は管理できない**(CLAUDE.md)。数え方は
 * `premiumClipsOf()` と同じ1か所に置く —— 画面で数え直すと、
 * **出した数と実際に作る数が食い違う。**
 *
 * @returns {{clips: number, chars: number}}
 */
export function remakeSizeOf(material) {
  const list = premiumClipsOf(material)
  let chars = 0
  for (const c of list) chars += c.text.length
  const whole = wholeRemakeOf(material)
  if (whole) {
    // **1本ぶんも課金される**(全文をもう一度読ませるため)
    for (const t of whole.texts) chars += t.length
    return { clips: list.length + 1, chars }
  }
  return { clips: list.length, chars }
}

/**
 * **1本にまとめた音声の材料**(2026-09 実機・13手め)。作れなければ `null`。
 *
 *   > 同じ声で作り直しましたが何も変わりません
 *
 * **変わらなくて当然だった。** 作り直していたのは
 * **発言ごとの MP3 だけ**で、**いま実際に鳴っている「1本にまとめた音声」を
 * 一度も触っていなかった。**
 *
 * 本文の読み上げは「1本にまとめる」に統一されている(利用者の指定)ので、
 * **聴いている音は、ほぼいつもこちらである。**
 * つまり利用者は**課金だけして、音は1ミリも変わらない**状態だった。
 *
 * **`speakChunks` を通していなかったのと、まったく同じ根**である ——
 * 「作り直す側が、鳴らす側と違うものを作っていた」。
 *
 * 材料の出し方は **`materialAudioClips()` 1か所**(鳴らすときと同じ)。
 * **数え方を2通り持たない。**
 *
 * @returns {{texts: string[], voiceIds: string[]}|null}
 */
export function wholeRemakeOf(material) {
  const list = materialAudioClips(material)
  // 1本にまとめられるのは、良い段の本文が2つ以上あるときだけ
  if (list.length < 2 || list.some((c) => c.tier !== PREMIUM)) return null
  return { texts: list.map((c) => c.text), voiceIds: list.map((c) => c.voiceId) }
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
  /* **1本にまとめた音声も作り直す**(2026-09 実機・13手め)。
     **鳴っているのはこちらである。** 触らないでいたので、
     利用者は課金だけして音が1ミリも変わらなかった */
  const whole = wholeRemakeOf(material)
  const total = list.length + (whole ? 1 : 0)
  let done = 0
  let failed = 0
  onProgress?.({ done: 0, total })
  for (const { text, voiceId } of list) {
    const url = await remakeClip(text, voiceId, PREMIUM)
    if (url) done += 1
    else failed += 1
    onProgress?.({ done: done + failed, total })
  }
  if (whole) {
    // **最後に回す。** ここだけ失敗しても、発言ごとの音は新しくなっている
    const got = await wholeClip({ ...whole, force: true })
    if (got) done += 1
    else failed += 1
    onProgress?.({ done: done + failed, total })
  }
  return { done, failed, total }
}
