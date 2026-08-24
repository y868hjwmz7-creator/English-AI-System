/**
 * =====================================================================
 *  ★★★ 重要 — この発音スコアは「本物ではありません」 ★★★
 * =====================================================================
 *
 * ここで返している点数は、録音した音声を実際に解析した結果ではありません。
 * 「録音する → 点数が出る」という画面の流れを確認するための、
 * 仮の数値(シミュレーション)です。
 *
 * 仕様書 5.1 に書いたとおり、本実装では次のどれかに置き換える必要があります。
 *
 *   案1: ブラウザの音声認識(SpeechRecognition)で文字起こしし、
 *        お手本の英文とどれだけ一致したかで採点する
 *        → 無料。ただし Chrome 系に依存し、「単語が合っているか」までしか分からない
 *
 *   案2: 発音評価に特化した外部サービスに音声を送って採点してもらう
 *        → 音素・抑揚まで評価できる。ただし課金あり。音声を外部に送ることになるため
 *          利用規約とプライバシーポリシーへの記載が必要
 *
 *   案3: 端末の中だけで音声解析ライブラリを動かす
 *        → 音声が外に出ない。ただし実装コストが高く精度が読みにくい
 *
 * 置き換えるときは、この scorePronunciation 関数の中身だけを差し替えれば
 * 画面側のコードは変えずに済むように作ってあります。
 */

/** この採点がどの方式で行われたかを示す印。保存データに残します。 */
export const MOCK_ENGINE_NAME = 'mock'

/**
 * 発音を採点する(※現在はシミュレーション)
 *
 * @param {object} params
 * @param {string} params.targetText 練習した英文
 * @param {Blob}   params.audioBlob  録音データ(※現在は使っていません)
 * @returns {Promise<{score:number, engine:string, recognizedText:string|null, isSimulated:boolean, breakdown:object}>}
 */
export async function scorePronunciation({ targetText, audioBlob }) {
  // 本物のAPIを呼んでいる感じを出すための待ち時間(演出です)
  await new Promise((resolve) => setTimeout(resolve, 900))

  // 録音の長さと英文の長さから、それらしい数値を組み立てているだけです。
  const lengthFactor = Math.min(1, (audioBlob?.size ?? 0) / Math.max(1, targetText.length * 900))
  const base = 62 + lengthFactor * 22
  const jitter = Math.random() * 14
  const score = Math.round(Math.max(45, Math.min(98, base + jitter)))

  return {
    score,
    engine: MOCK_ENGINE_NAME,
    recognizedText: null, // 実エンジンにすると、ここに聞き取り結果が入ります
    isSimulated: true,
    breakdown: {
      accuracy: Math.round(Math.max(40, Math.min(99, score + (Math.random() * 10 - 5)))),
      fluency: Math.round(Math.max(40, Math.min(99, score + (Math.random() * 12 - 6)))),
      intonation: Math.round(Math.max(40, Math.min(99, score + (Math.random() * 14 - 7)))),
    },
  }
}
