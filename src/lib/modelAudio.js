/**
 * 事前に生成したお手本音声を扱う場所。
 *
 * ★なぜ必要か(仕様書 5.2)
 *   端末に入っている音声は品質がばらばらで、iPhone では簡易版しか
 *   使えない。練習用の英文は決まった一覧なので、
 *   あらかじめ音声を作って配信すれば、全端末で同じ品質になる。
 *
 * ★仕組み
 *   scripts/generate-audio.mjs が音声ファイルと目録(manifest.json)を作る。
 *   このファイルは目録を読み、「この英文・この話者の音声はあるか」を答える。
 *   無ければ端末内蔵の読み上げに切り替える(予備)。
 */

const MANIFEST_URL = `${import.meta.env.BASE_URL}audio/manifest.json`

let manifestPromise = null

/**
 * 目録を読み込む。まだ音声を用意していない場合は空として扱う。
 * 一度読んだら使い回す。
 */
export function loadModelAudioManifest() {
  if (manifestPromise) return manifestPromise

  // ファイルを直接開いた場合(1ファイル版)は、目録を取りに行けない。
  // 取りに行くとブラウザがエラーとして記録するため、最初から諦める。
  // この場合は端末内蔵の読み上げを使う。
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    manifestPromise = Promise.resolve({ speakers: [], phrases: {}, ext: 'mp3' })
    return manifestPromise
  }

  manifestPromise = fetch(MANIFEST_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data ?? { speakers: [], phrases: {}, ext: 'mp3' })
    .catch(() => ({ speakers: [], phrases: {}, ext: 'mp3' })) // 未用意でもアプリは動く
  return manifestPromise
}

/** その英文・その話者の音声ファイルのURL。無ければ null。 */
export function modelAudioUrl(manifest, phraseId, speakerId) {
  const files = manifest?.phrases?.[phraseId]
  if (!files || !files.includes(speakerId)) return null
  const ext = manifest.ext || 'mp3'
  return `${import.meta.env.BASE_URL}audio/${speakerId}/${phraseId}.${ext}`
}

/** その英文について、音声が用意されている話者のID一覧 */
export function availableSpeakersFor(manifest, phraseId) {
  return manifest?.phrases?.[phraseId] ?? []
}
