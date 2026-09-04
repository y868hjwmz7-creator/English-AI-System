/**
 * ============================================================================
 * 教材の音声を、**1本の MP3 にまとめて渡す**(2026-09 利用者の指定)。
 *
 *   > 各教材の音声をダウンロード出来るようにしてください。
 *   > 全体の音声をひとつ。これだけでOKです。
 *   > 教材と同じビットレートのMP3でOKです。
 *
 * 【何を並べるか】
 *   **「Listen (全体)」で鳴るものと、まったく同じ。**
 *   本文(記事の段落 / 会話の発言)を、出てくる順に並べる。
 *   声の当て方も間(ま)の決め方も、鳴らすときと同じ道具を通す
 *   (`castClipSpeakers` / `turnGapMs`)。**数え方を2通り持たない。**
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
import { clipUrl } from './audioClips.js'
import { audioFileName, joinMp3 } from './mp3Join.js'
import { voiceTrimMs } from '../data/clipVoices.js'
import { materialAudioClips } from './audioPlaylist.js'

/* 並べるところは `audioPlaylist.js` にある。
   あちらは Supabase を持たないので、**素の node で確かめられる**
   (`npm run test:mp3`)。ここから出しておくのは、
   呼ぶ側(`TrainerMaterials.jsx`)がどちらを読むか迷わないようにするため */
export { materialAudioClips }

/**
 * 集めて、つないで、渡す。
 *
 * @param material 教材
 * @param onProgress ({done, total}) 進み具合。**押した場所のすぐ下に出す**
 * @returns {{ok: boolean, total: number, missing: number, bytes: number, error?: string}}
 */
export async function downloadMaterialAudio(material, onProgress = null) {
  const list = materialAudioClips(material)
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
    /* **鳴らすときと同じだけ、終わりを切る**(`voiceTrimMs`)。
       切らないと、落とした MP3 にだけ「プチっ」が残る */
    if (bytes?.length) parts.push({ bytes, gapMs, trimMs: voiceTrimMs(voiceId) })
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
