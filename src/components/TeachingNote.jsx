/**
 * 指導ポイント(文法の説明)を、読める形で出す。
 *
 * 【なぜ必要か】
 *   これまでは長い日本語を1つの <p> にそのまま流していた。
 *   弱点を3つ混ぜた教材では、3つ分の説明が改行も区切りもなく
 *   一続きになり、読めなくなっていた(利用者からの指摘、2026-08)。
 *
 * 【やっていること】
 *   1. 【弱点名】で始まる行は見出しとして扱う
 *   2. 改行で区切って、1行ずつ並べる
 *   3. 改行が無い古い教材は、句点(。)で文に切って並べる
 *   4. 文の中の英語は、日本語と見分けがつくように印をつける
 *      (make a decision のような例が地の文に埋もれると、
 *       何が例なのか分からなくなる)
 */

/** 【…】で始まる見出しの行か */
const HEADING = /^【(.+?)】\s*(.*)$/

/**
 * 日本語の中の英語に印をつける。
 *
 * 英字2文字以上を対象にする。前置詞(by / on / in)そのものが説明の要に
 * なることが多いため、短い語も落とさない。1文字だけは対象外
 * (レベル表記の A1 などを拾ってしまうため)。
 */
const markEnglish = (text, keyPrefix) => {
  const parts = []
  const pattern = /[A-Za-z][A-Za-z'’\-.]*(?:\s+[A-Za-z][A-Za-z'’\-.]*)*/g
  let last = 0
  let match = pattern.exec(text)
  let i = 0
  while (match) {
    const found = match[0]
    const isPhrase = /\s/.test(found) || found.replace(/[^A-Za-z]/g, '').length >= 2
    if (isPhrase) {
      if (match.index > last) parts.push(text.slice(last, match.index))
      parts.push(
        <span key={`${keyPrefix}-${i}`} className="en-term" lang="en">{found}</span>,
      )
      last = match.index + found.length
      i += 1
    }
    match = pattern.exec(text)
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

/** 表示用の行に分ける */
const toLines = (text) => {
  const raw = String(text ?? '').trim()
  if (!raw) return []

  const byNewline = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (byNewline.length > 1) return byNewline

  // 改行が無い古い教材。句点で切る。「。」は残す(切れ目が分かるように)
  if (raw.length > 60) {
    return raw.split(/(?<=。)/).map((l) => l.trim()).filter(Boolean)
  }
  return [raw]
}

export default function TeachingNote({ text, title = '指導ポイント', tone = 'point' }) {
  const lines = toLines(text)
  if (!lines.length) return null

  return (
    <div className={`teaching-note teaching-note--${tone}`}>
      <div className="teaching-note-title">{title}</div>
      <ul className="teaching-note-list">
        {lines.map((line, i) => {
          const heading = HEADING.exec(line)
          if (heading) {
            return (
              <li key={i} className="teaching-note-head">
                <span className="teaching-note-tag">{heading[1]}</span>
                {heading[2] && <span>{markEnglish(heading[2], `h${i}`)}</span>}
              </li>
            )
          }
          return <li key={i}>{markEnglish(line, `l${i}`)}</li>
        })}
      </ul>
    </div>
  )
}
