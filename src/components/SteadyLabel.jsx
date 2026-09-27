/**
 * **中身が変わっても、場所を動かさない札**(第5.281節・2026-09-27 利用者の指定)。
 *
 *   > 音声を「繰り返す」にすると文字数が増えた分表示が2段組になります。
 *   > こういう仕様が二度とどこでも起こらないように改善してください。
 *   > UI の配置が変化することをどの場所においても防いでください。
 *
 * 【何が起きていたか】(実機・Quick Response の答え合わせ)
 *   「くり返す」(4文字)を押すと「1回」(2文字)になる。**ボタンが縮む。**
 *   その行(`.qr-peek`)は折り返すので、縮んだぶんだけ3つ目が
 *   **上の行へ上がり、2段が1段に組み変わっていた。**
 *   押した本人は「もう出さない」を押そうとして、**指の下で場所が入れ替わる。**
 *
 * 【直し方】
 *   **起こりうる中身の、いちばん広いぶんを先に取っておく。**
 *   見えているものと、取っておくものを**同じ場所に重ねて置く**ので、
 *   幅は「いちばん長いもの」で決まり、**中身が変わっても1px も動かない。**
 *
 *   ・**数を書かない。** `min-width: 5em` のような決め打ちは、
 *     言葉を変えた日に足りなくなる(**値を書き写さない**・CLAUDE.md)
 *   ・取っておくものは `aria-hidden` にする ——
 *     読み上げに「1回 くり返す」と2つ聞こえては困る
 *   ・**言葉の一覧は、呼ぶ側が1つ持つ。** ここに書き写さない
 *
 * 【使い方】
 *
 *     const 文言 = ['1回', 'くり返す']          // 呼ぶ側が1つ持つ
 *     <SteadyLabel keep={文言}>{文言[on ? 1 : 0]}</SteadyLabel>
 *
 *   数が伸びるものは、**いちばん大きくなった形**を渡す。
 *
 *     <SteadyLabel keep={[`${total} / ${total}`]}>{`${at} / ${total}`}</SteadyLabel>
 *
 * @param {Array<string>} keep 起こりうる中身(いちばん広いものが幅を決める)
 * @param {*} children いま出すもの
 */
export default function SteadyLabel({ keep = [], children, className = '' }) {
  return (
    <span className={`steady${className ? ` ${className}` : ''}`}>
      <span className="steady-now">{children}</span>
      {keep.map((t, i) => (
        /* **場所を取るだけ。** `visibility: hidden` なので目にも
           読み上げにも出ないが、**幅は数える**(`display: none` では取れない) */
        <span className="steady-keep" aria-hidden="true" key={`${t}-${i}`}>{t}</span>
      ))}
    </span>
  )
}
