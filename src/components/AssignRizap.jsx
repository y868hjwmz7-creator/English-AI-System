/**
 * **RIZAP ENGLISH の教材を出す欄**(第5.202節)。
 *
 * ============================================================================
 * 2026-09 利用者の指定。
 *
 *   > 教材のアサインのページから Conversation1、2、3、
 *   > Business Conversation 1、2 をアサインできるようにしてください。
 *   > UNIT ごと、丸ごと、それぞれお願いします。UNIT 毎の場合はプルダウンで
 *
 * 【すぐ上の2つと、1文字も違えない】(第5.186節)
 *
 *   同じページに3つ並ぶので、1つだけ作りが違うと
 *   「これは何の欄だろう」と考えさせる。だから骨組みは
 *   `AssignShelf` から**そのまま借りる** —— `.shelf` / `.shelf-row` /
 *   `.shelf-pick` / `.shelf-name` / `.shelf-n` / `.shelf-open` /
 *   `.shelf-sub`。**見た目の決まりを、こちらに書き写さない。**
 *
 *   ただし**印(● / ○)は出さない。** あちらは「出している / いない」の
 *   入り切りだが、こちらは**宿題として届ける**もので、
 *   一度出したら戻す操作がここには無い。
 *   **同じ印を、違う意味で使わない**(CLAUDE.md)。
 *
 * 【「丸ごと」はプルダウンの先頭】
 *
 *   チャンク集の「◯◯まとめ」・型の「〜系ぜんぶ」とまったく同じ作法。
 *   **値は空文字**(`RIZAP_ALL`)—— UNIT 番号と同じ欄に入れるので、
 *   番号に 0 を使わないことだけ守ればよい。
 *
 * 【まだ UNIT が無い冊は、開いても押せない】
 *
 *   押しても何も起きない操作を見せない。代わりに、その行に
 *   「まだ入っていません」と書く —— **行ごと隠さない**
 *   (隠すと、冊が5つあることが分からない)。
 *
 * 【自分では何も読まない】
 *
 *   UNIT の一覧も知らせも、**props で受け取るだけ**である。
 *   だから骨組み(Supabase 無し)でもそのまま描ける
 *   (**描けないものは測れない**・CLAUDE.md)。
 * ============================================================================
 *
 * @param books   冊の一覧(`RIZAP_BOOKS`)
 * @param units   冊ごとの UNIT。**読めていない冊は `null`**(0 と取り違えない)
 * @param picked  冊ごとに、いま選んでいる UNIT(空は丸ごと)
 * @param onPick  プルダウンを動かした(冊の id, UNIT 番号の文字列 or 空)
 * @param onSend  「出す」を押した(冊の id)
 * @param busy    いま送っている冊の id
 * @param note    知らせ(`{kind:'ok'|'ng'|'busy', text}`)。**押した欄に出す**
 */
import { useState } from 'react'
import { RIZAP_ALL, rizapAllLabel } from '../data/rizapBooks.js'
import AssignNote from './AssignNote.jsx'

export default function AssignRizap({
  books = [], units = {}, picked = {}, onPick = null, onSend = null,
  busy = null, note = null,
}) {
  /** いま開いている冊。**1つだけ開く**(`AssignShelf` と同じ) */
  const [open, setOpen] = useState(null)

  if (!books.length) return null

  return (
    <>
      <div className="shelf assignshelf" role="group" aria-label="この人に出す教材">
        {books.map((b) => {
          /* **読めていない(null / undefined)と、0 UNIT を取り違えない。**
             読めていないのに「まだ入っていません」と書くと嘘になる */
          const list = units[b.id]
          const unread = list === null || list === undefined
          const shown = open === b.id
          const now = String(picked[b.id] ?? RIZAP_ALL)
          return (
            <div key={b.id} className="shelf-row">
              <button
                type="button"
                className="shelf-pick"
                disabled={!!busy}
                aria-expanded={shown}
                onClick={() => setOpen(shown ? null : b.id)}
              >
                <span className="shelf-name">{b.label}</span>
                {/* **0 は出さない**(`AssignShelf` と同じ)。
                    読めていないあいだも出さない —— 0 と見えてしまう */}
                {!unread && list.length > 0 && (
                  <span className="shelf-n">{list.length} UNIT</span>
                )}
                <span className="shelf-open" aria-hidden="true">{shown ? '▾' : '▸'}</span>
              </button>
              {shown && (
                <div className="shelf-sub">
                  {unread ? (
                    <p className="field-hint">読んでいます…</p>
                  ) : list.length === 0 ? (
                    <p className="field-hint">この冊には、まだ UNIT が入っていません。</p>
                  ) : (
                    <div className="rizap-send-row">
                      <label className="field field--inline rizap-unit">
                        <span className="field-label">どこまで</span>
                        <select className="input" value={now}
                                onChange={(e) => onPick?.(b.id, e.target.value)}>
                          {/* **丸ごとを先頭に。** 値は空文字 */}
                          <option value="">
                            {rizapAllLabel(b.id)}({list.length} UNIT)
                          </option>
                          {list.map((u) => (
                            <option key={u.id} value={String(u.unit_no)}>
                              UNIT {u.unit_no}{u.headline ? ` ${u.headline}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="btn btn--small btn--quiet rizap-send"
                              disabled={!!busy}
                              onClick={() => onSend?.(b.id)}>
                        {busy === b.id ? '出しています…' : '出す'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* **押した結果は、必ずこの場に出す**(画面のいちばん上に出さない・
          CLAUDE.md)。**成功と失敗を、同じ見た目で終わらせない** */}
      <AssignNote note={note} />
    </>
  )
}
