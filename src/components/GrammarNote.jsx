import { PATTERNS, ROLES } from '../lib/grammarNote.js'

/**
 * 文法解説(SVOC と修飾要素)を出す(0051)。
 *
 * 【何を出すか】(2026-09 利用者の指定)
 *
 *   > 文章ごとにSVOCと修飾要素についての解説をしてくれる、
 *   > 文法解説モードが欲しい。
 *
 *       第3文型(S + V + O)
 *       The office  bought  a new coffee machine  last week.
 *            S         V              O               M
 *       「誰が どうする 何を」の第3文型。last week は「いつ」を足す飾りです。
 *
 * 【色を5つに分けない】
 *   S / V / O / C / M を色で塗り分けるのが世の中では普通だが、
 *   **このアプリでは採らなかった。** 理由は2つある。
 *
 *   ① **役の名前(S / V / O / C / M)そのものが札に出ている。**
 *      色は念押しにしかならない。
 *      「**色だけに頼らない**」(CLAUDE.md)の裏返しでもある
 *   ② 色を1つ足すと、`styles.css` の**9か所**に書き足すことになる
 *      (`:root` / 暗い側2つ / 紙の島 / 紙の暗い戻し2つ / プレイン2つ /
 *      `.focus` の別名)。**5色なら45行**で、1か所でも抜けると
 *      暗い配色や集中モードの紙でだけ色が壊れる
 *      (`npm run test:paper` が見張っている場所そのものである)
 *
 *   **代わりに「骨組みか、飾りか」の2つだけを目で分ける。**
 *   これは利用者が言った「**SVOC と修飾要素**」そのままの分け方である。
 *
 *     ・骨組み(S / V / O / C)… うすい地色 + 同じ色の文字(選んでいる印と同じ組み合わせ)
 *     ・飾り(M)             … 細い枠線だけ。**塗りを2つ並べない**
 *
 *   使っているのは `--accent-soft` / `--accent` / `--border` / `--ink-soft` だけで、
 *   **どれも紙の島にもプレインにも、もとから入っている。**
 *   だから明るい・暗い・プレイン・紙の上のどこでも、そのまま正しく出る。
 *
 * 【語は押せない】
 *   訳を出しているときと同じ扱いにしてある。ここはかたまりの区切りが
 *   意味を持つ画面なので、語ごとに押せると区切りが読み取りにくくなる。
 *   **調べるのは、英語を出しているとき**にする。
 */
export default function GrammarNote({ sentences, unit = '段落' }) {
  const list = Array.isArray(sentences) ? sentences : []
  if (!list.length) {
    /* **黙って消さない**(CLAUDE.md)。まだ解説が入っていない教材があるので、
       なぜ出ないのかと、いつ出るようになるのかを1行で伝える */
    return (
      <p className="gnote-empty">
        この{unit}の文法解説は、まだできていません。
        トレーナーが「セッションで使う」を開くと、裏で作られます。
      </p>
    )
  }

  return (
    <ol className="gnote">
      {list.map((s, i) => (
        <li className="gnote-item" key={`${i}-${s.en}`}>
          {/* 文型は**眉**として上に置く。無い(読み取れなかった)ときは出さない
              —— **あやふやなことを言わない** */}
          {PATTERNS[s.pattern] && (
            <p className="gnote-pat">{PATTERNS[s.pattern]}</p>
          )}
          <p className="gnote-en" lang="en">
            {s.parts.map((p, k) => (
              <span
                key={`${k}-${p.t}`}
                /* 骨組み(S / V / O / C)と飾り(M)の2つだけを分ける */
                className={`gnote-part gnote-part--${p.r === 'M' ? 'mod' : 'core'}`}
                title={`${p.r} … ${ROLES[p.r]?.label ?? ''}`}
              >
                <span className="gnote-t">{p.t}</span>
                <span className="gnote-r">
                  {p.r}
                  {/* 読み上げ機には、日本語の名前も渡す(letter だけでは伝わらない) */}
                  <span className="visually-hidden">（{ROLES[p.r]?.label ?? ''}）</span>
                </span>
              </span>
            ))}
          </p>
          {s.note && <p className="gnote-note">{s.note}</p>}
        </li>
      ))}
    </ol>
  )
}
