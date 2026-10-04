/**
 * **オフラインの帯**(第5.372節)。
 *
 *   出すものを決めるのは `offlineNote()` 1か所で、ここは**描くだけ**である
 *   (**描けないものは測れない**ので、props で受け取るだけにしてある)。
 *
 *   見た目は**既にある形から選ぶ** —— 裏で作っている教材の知らせと
 *   同じ `.jobnote`。**白い箱を新しく作らない**(CLAUDE.md)。
 */
import { offlineNote } from '../lib/offlineNote.js'

export default function OfflineNote({ offline = false, update = false, onReload }) {
  const note = offlineNote({ offline, update })
  if (!note) return null
  return (
    <div className="jobnote is-quiet" role="status" aria-live="polite">
      <span className="jobnote-text">{note.text}</span>
      {note.action && (
        <button type="button" className="btn btn--small btn--primary" onClick={onReload}>
          {note.action}
        </button>
      )}
    </div>
  )
}
