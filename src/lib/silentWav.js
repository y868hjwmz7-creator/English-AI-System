/**
 * **間(ま)を、音として鳴らす**(第5.285節・2026-09-27 実機・利用者の指定)。
 *
 *   > 聞き流しの途中にスマホの電源を押して画面をオフにすると
 *   > 音声も消えてしまいます。ポケットにスマホを入れたまま
 *   > 聞き流せるように直してください。
 *   > これは全ての機能で同じ仕様にしておきたいです。
 *
 * 【なぜ「無音を鳴らす」のか】
 *   画面を消すと、iPhone は**そのページの時計(`setTimeout`)を止める。**
 *   聞き流しは「1本鳴らす → **時計で間を置く** → 次を鳴らす」で回っていたので、
 *   **いま鳴っている1本が終わったところで、そのまま止まっていた。**
 *   音が出せなくなったのではない ——
 *   **次を鳴らす合図が、誰からも来なくなった**のである。
 *
 *   だから間を、**時計ではなく音**にする。
 *   無音の音声を「間の長さだけ」鳴らせば、終わりは `ended` が知らせる ——
 *   **`ended` は音の側から来る**ので、画面が消えていても届く。
 *   ついでに `<audio>` が**途切れずに鳴り続ける**ことになり、
 *   端末は「これは音楽を鳴らしているページだ」と見なしてくれる。
 *
 * 【ここには DOM も Blob も置かない】
 *   **素の node で走らせられる形に切り出す**(CLAUDE.md)。
 *   ここは「何バイトの、どんな中身か」だけを決める。
 *   `Blob` にして `<audio>` に渡すのは `audioClips.js` の役目である。
 */

/**
 * **これより短い間は、音にしない。**
 *
 * 描き替えを1手待つだけの `wait(0)` まで音にすると、
 * **`<audio>` の差し替えが1語あたり何度も起きる**(プチッの元・第5.205節)。
 * 0.15 秒より短い間は耳に届かないので、これまでどおり時計で待つ。
 */
export const SILENT_MIN_MS = 150

/** 控えの鍵は、この刻みで丸める(0.05 秒ちがいの無音を作り分けない) */
export const SILENT_STEP_MS = 50

/** 1秒あたりの標本の数。**電話の音質で足りる**(無音なので中身は 0) */
export const SILENT_RATE = 8000

/**
 * 控えの鍵。**丸めた長さそのもの**である ——
 * `1500` も `1490` も同じ 1500 の無音を使い回す。
 *
 * **下は `SILENT_STEP_MS` で止める。** 0 を渡されても、
 * 0 バイトの音声を作らない(鳴らせずに `ended` が来ない)。
 */
export const silentKey = (ms) => Math.max(
  SILENT_STEP_MS,
  Math.round((Number(ms) || 0) / SILENT_STEP_MS) * SILENT_STEP_MS,
)

/**
 * 無音の WAV を1つ作る(16bit モノラル 8kHz)。
 *
 * **WAV にするのは、その場で作れるからである。**
 * MP3 は作れない(符号化が要る)し、窓口に頼めば**1本ずつ課金**される。
 * 無音は中身が 0 なので、**ヘッダを書くだけ**で作れて 0 円である。
 *
 * @param {number} ms 長さ(ミリ秒)
 * @returns {Uint8Array} WAV ファイルそのもの
 */
export function silentWav(ms) {
  const len = silentKey(ms)
  const samples = Math.round((SILENT_RATE * len) / 1000)
  const bytes = samples * 2
  const buf = new ArrayBuffer(44 + bytes)
  const view = new DataView(buf)
  const put = (at, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i))
  }
  put(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  put(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)        // fmt の長さ
  view.setUint16(20, 1, true)         // PCM
  view.setUint16(22, 1, true)         // モノラル
  view.setUint32(24, SILENT_RATE, true)
  view.setUint32(28, SILENT_RATE * 2, true)  // 1秒あたりのバイト数
  view.setUint16(32, 2, true)         // 1標本あたりのバイト数
  view.setUint16(34, 16, true)        // 1標本あたりのビット数
  put(36, 'data')
  view.setUint32(40, bytes, true)
  /* 中身は **0 のまま**(`ArrayBuffer` は 0 で始まる)。
     無音とは「全部 0」のことなので、書き込む必要がない */
  return new Uint8Array(buf)
}

/**
 * その待ちを、音で置くか。
 *
 * **判断は1か所に持つ**(CLAUDE.md)—— 聞き流しも読み上げも、
 * ここを通す。画面の中で `ms >= 150` と書かない。
 */
export const silentNeeded = (ms) => (Number(ms) || 0) >= SILENT_MIN_MS
