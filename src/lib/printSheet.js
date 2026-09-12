/**
 * 紙に出す一瞬だけ描いて、描き終わってから印刷する。
 *
 * 【なぜ「描いてから」なのか】(CLAUDE.md)
 *   ボタンの中で `printElement()` を直に呼ぶと、
 *   **描き替わる前の画面が紙になる。** だから
 *   「刷る」を押したら控えを立て、**描き終わったあと**(`useEffect`)に
 *   呼ぶ。`TrainerMaterials` の `printId` とまったく同じ作法である。
 *
 * 【なぜ画面ごとに書かないか】
 *   単語帳と Quick Response 帳の**2か所**から呼ぶ。
 *   **同じ段取りを書き写すと、必ず片方だけ古くなる**(CLAUDE.md)。
 *
 * 【出す場所の id も、ここが持つ】
 *   `SHEET_ID` を画面ごとに書くと、片方を変えたときに
 *   **紙が真っ白になる**(探しに行った先に何も無い)。
 *   2つの画面が同時に出ることはないので、1つで足りる。
 */
import { useEffect } from 'react'
import { printElement } from './print.js'

export const SHEET_ID = 'review-sheet'

/**
 * `on` が真になったら、`SHEET_ID` の中身を紙に出す。
 * 終わったら(または60秒経ったら)`onDone` を呼ぶ ——
 * **控えを下ろさないと、紙の中身が画面の裏に残り続ける。**
 *
 * **見つからなければ、その場で `onDone`。**
 * 押したのに何も起きないまま戻らない、を作らない(行き止まりを作らない)。
 */
export function usePrintSheet(on, onDone) {
  useEffect(() => {
    if (!on) return undefined
    const el = document.getElementById(SHEET_ID)
    if (!el) { onDone?.(); return undefined }
    const done = () => onDone?.()
    window.addEventListener('afterprint', done)
    // Safari は afterprint を返さないことがある(`print.js` と同じ保険)
    const timer = window.setTimeout(done, 60000)
    printElement(el)
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
    }
  }, [on])
}
