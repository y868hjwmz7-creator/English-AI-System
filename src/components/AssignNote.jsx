/**
 * **押した結果の1行**(第5.181節 → 第5.238節で部品にした)。
 *
 * ════════════════════════════════════════════════════════════════
 * 【なぜ部品にしたか】
 *
 *   「アサインする」の画面には、知らせを出す欄が**4つ**ある
 *   (単語帳 / RIZAP ENGLISH / Quick Response / その他の教材)。
 *   同じ書き分けを4か所に書き写すと、**必ずどれかだけ古くなる**
 *   (CLAUDE.md「呼び名・判断を2か所に書かない」)。
 *
 * 【守っていること】
 *
 *   ・**成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)
 *   ・**知らせは、押した場所のすぐ下に出す**(画面のいちばん下に出さない)
 *   ・**色だけに頼らない** —— 地色・文字・枠線は `notice--ok` /
 *     `notice--warn` が持っている(`styles.css` 1か所)
 *
 * @param note `{ kind: 'busy'|'ok'|'ng', text }`。**`null` なら何も出さない**
 * ════════════════════════════════════════════════════════════════
 */
export default function AssignNote({ note = null }) {
  if (!note) return null
  return (
    <p className={note.kind === 'busy' ? 'field-hint'
      : `notice notice--${note.kind === 'ok' ? 'ok' : 'warn'}`}
       role="status">
      {note.text}
    </p>
  )
}
