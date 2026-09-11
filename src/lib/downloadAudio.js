/**
 * ============================================================================
 * 教材の音声を、**1本の MP3 にまとめて渡す**(2026-09 利用者の指定)。
 *
 *   > 各教材の音声をダウンロード出来るようにしてください。
 *   > 全体の音声をひとつ。これだけでOKです。
 *   > 教材と同じビットレートのMP3でOKです。
 *
 * 【まず、鳴っているのと同じ1本を探す】(2026-09 実機)
 *   本文の読み上げは**「1本にまとめる」に統一されている**(CLAUDE.md)。
 *   だから通しで聴いても、**発言ごとの MP3 は1本も作られない。**
 *   ここが発言ごとに集めていたので、
 *   **2度通しで聴いても「まだ作られていない音声が 14 本あります」**
 *   としか出なかった。**つなぐ必要も無い —— すでに1本である。**
 *
 * 【1本にできない教材だけ、これまでどおり集めてつなぐ】
 *   **「Listen (全体)」で鳴るものと、まったく同じ。**
 *   本文(記事の段落 / 会話の発言)を、出てくる順に並べる。
 *   声の当て方も間(ま)の決め方も、鳴らすときと同じ道具を通す
 *   (`castClipSpeakers` / `turnGapMs`)。**数え方を2通り持たない。**
 *
 *   **長い段落は、鳴らすときと同じように分ける**(`materialClipPieces`)。
 *   MP3 の置き場所は**かけらの英文の指紋**で決まるので、
 *   段落まるごとの英文で探すと**どこにも無く**、
 *   貼った原稿(Speech練習)で「◯本足りません」としか出なかった。
 *
 * 【作り直さない。課金もしない】
 *   **すでに作ってある MP3 を集めてつなぐだけ**である。
 *   窓口(`speak`)は呼ばないので、**1円もかからない。**
 *
 *   まだ作られていない英文があったときは、**その場でこしらえない。**
 *   作れば ElevenLabs への課金になるからで、
 *   **見えない費用は管理できない**(CLAUDE.md)。
 *   何本足りないかを返し、どうすればよいかは画面が伝える。
 *
 * 【つなぎ方そのものは `mp3Join.js`】
 *   あちらは Supabase も `import.meta.env` も持たないので、
 *   **素の node で確かめられる**(`npm run test:mp3`)。
 * ============================================================================
 */
import { clipUrl, wholeClipUrl } from './audioClips.js'
import { audioFileName, joinMp3 } from './mp3Join.js'
import { materialAudioClips, materialClipPieces } from './audioPlaylist.js'
import { PREMIUM } from './voiceTier.js'

/* 並べるところは `audioPlaylist.js` にある。
   あちらは Supabase を持たないので、**素の node で確かめられる**
   (`npm run test:mp3`)。ここから出しておくのは、
   呼ぶ側(`TrainerMaterials.jsx`)がどちらを読むか迷わないようにするため。

   **呼ぶ側が使うのは `materialClipPieces`(かけら)のほう。**
   本数もそちらで数えないと、**進み具合が「3 / 14」と出ているのに
   22 本目まで進む**ことになる(出した数と、実際に集める数は同じにする) */
export { materialAudioClips, materialClipPieces }

/**
 * 集めて、つないで、渡す。
 *
 * @param material 教材
 * @param onProgress ({done, total}) 進み具合。**押した場所のすぐ下に出す**
 * @returns {{ok: boolean, total: number, missing: number, bytes: number, error?: string}}
 */
export async function downloadMaterialAudio(material, onProgress = null) {
  /* ── ① **鳴っているのと同じ1本**が置いてあれば、それをそのまま渡す ──
   *
   *   > 2度通しで再生しているのにこう表示される
   *   > 「まだ作られていない音声が 14 本あります (全 14 本)」(2026-09 実機)
   *
   *   **本文の読み上げは「1本にまとめる」に統一されている**(CLAUDE.md)。
   *   通しで聴くと作られるのは**その1本だけ**で、
   *   **発言ごとの MP3 は1本も作られない。**
   *   ところがここは発言ごとに集めていたので、
   *   **何度聴いても、永久に「14 本足りません」**と出ていた。
   *
   *   **つなぐ必要も無い。すでに1本である。**
   *   継ぎ目も無いので、②でつないだものより音がよい。 */
  const clips = materialAudioClips(material)
  if (clips.length >= 2 && clips[0].tier === PREMIUM) {
    onProgress?.({ done: 0, total: 1 })
    /* **作らない。置いてあるものだけを見る**(1円もかからない) */
    const url = await wholeClipUrl({
      texts: clips.map((c) => c.text),
      voiceIds: clips.map((c) => c.voiceId),
    })
    if (url) {
      let bytes = null
      try {
        const res = await fetch(url)
        if (res.ok) bytes = new Uint8Array(await res.arrayBuffer())
      } catch { /* 届かなければ、②へ落ちる(行き止まりを作らない) */ }
      if (bytes?.length) {
        onProgress?.({ done: 1, total: 1 })
        saveFile(bytes, audioFileName(material?.title))
        return { ok: true, total: 1, missing: 0, bytes: bytes.length, whole: true }
      }
    }
  }

  /* ── ② 1本にできない教材は、これまでどおり集めてつなぐ ────────────
     鍵が無い・文字数が多すぎる・名簿に無い声が混じっている…のときは、
     読み上げも**発言ごと**に落ちている(`readAloud.js`)。
     だからそちらの MP3 は、聴いたぶんだけ置いてある。

     **鳴らすときとまったく同じ「かけら」で集める**(2026-09 実機)。
     段落まるごとの英文で探すと、貼った原稿(Speech練習)では
     その指紋の MP3 がどこにも無く、「◯本足りません」としか出なかった */
  const list = materialClipPieces(material)
  if (!list.length) return { ok: false, total: 0, missing: 0, bytes: 0, error: '本文がありません' }

  const parts = []
  let missing = 0
  onProgress?.({ done: 0, total: list.length })
  for (let i = 0; i < list.length; i += 1) {
    const { text, voiceId, tier, gapMs } = list[i]
    /* **その場では作らない。** あるものだけを集める(課金しないため) */
    const url = await clipUrl(text, voiceId, tier)
    let bytes = null
    if (url) {
      try {
        const res = await fetch(url)
        if (res.ok) bytes = new Uint8Array(await res.arrayBuffer())
      } catch { /* 届かなければ、無いものとして数える */ }
    }
    if (bytes?.length) parts.push({ bytes, gapMs })
    else missing += 1
    onProgress?.({ done: i + 1, total: list.length })
  }

  /* **足りないまま渡さない。** 途中が抜けた音声は、
     「壊れている」のか「そういう教材」なのか聞いても分からない */
  if (missing) {
    return { ok: false, total: list.length, missing, bytes: 0 }
  }

  const joined = joinMp3(parts)
  if (!joined.length) {
    return { ok: false, total: list.length, missing: list.length, bytes: 0 }
  }
  saveFile(joined, audioFileName(material?.title))
  return { ok: true, total: list.length, missing: 0, bytes: joined.length }
}

/** 端末に保存させる。**押した流れの中で呼ぶこと** */
function saveFile(bytes, name) {
  const blob = new Blob([bytes], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // すぐ消すと、端末によっては保存が始まる前に消えてしまう
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
