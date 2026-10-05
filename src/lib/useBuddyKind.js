/**
 * **いま選ばれている相棒を、画面に渡す**(第5.373節)。
 *
 * **決まりは `buddyKind.js` 1か所**にある(こちらは React につなぐだけ)。
 * あちらは素の node で走るので、見張りが画面を描かずに確かめられる。
 *
 * **呼び出し側を1つも変えずに済む**ようにしてある ——
 * `SessionResult` は3つの画面から呼ばれており、
 * そこまで `kind` を手で渡して回ると、**渡し忘れた画面だけ違う相棒**になる。
 */
import { useEffect, useState } from 'react'
import { BUDDY_KIND_EVENT, buddyKindOf, loadBuddyKind } from './buddyKind.js'

export function useBuddyKind() {
  const [kind, setKind] = useState(loadBuddyKind)
  useEffect(() => {
    /* 同じ画面で選び直したとき(合図)と、別のタブで選び直したとき(`storage`) */
    const 来た = (e) => setKind(buddyKindOf(e?.detail ?? loadBuddyKind()))
    const 別タブ = () => setKind(loadBuddyKind())
    window.addEventListener(BUDDY_KIND_EVENT, 来た)
    window.addEventListener('storage', 別タブ)
    return () => {
      window.removeEventListener(BUDDY_KIND_EVENT, 来た)
      window.removeEventListener('storage', 別タブ)
    }
  }, [])
  return kind
}
