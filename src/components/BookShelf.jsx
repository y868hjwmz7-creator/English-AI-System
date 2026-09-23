/**
 * **冊をえらぶ「本棚」** —— 縦1列(2026-09 利用者の問い)。
 *
 * ============================================================================
 *   > これからもっと増えていくのに、何列にも重ねるわけにはいかないですよね。
 *   > デザイン面、使いやすさ両方を考えた案をください
 *
 * 【横に並べるのをやめた】
 *
 *   札(`.chip`)の行は、**単語帳の冊 6 つですでに2行**になっていた
 *   (390px で実測・高さ 78px)。Quick Response は 3 つでも2行である
 *   (「自分の Quick Response 帳」が長い)。しかも折り返しは
 *   「3つ + 3つ」のギザギザで、**左端がそろわない。**
 *
 *   **1冊1行**にすれば、冊が 6 でも 20 でも**見た目が変わらない。**
 *   増えたら下に伸びるだけで、作り直しが要らない。
 *
 * 【進み具合は、ここに出さない】(2026-09 利用者の指定)
 *
 *   > 達成具合を確認するには別の専用ページに飛んで出来るようにすれば良いので
 *
 *   ここは**「どれをやるか」を決める場所**である。数字が並ぶと、
 *   決める前に読むものが増える。**名前と件数だけ**にしてある。
 *
 *   **その専用ページ(達成具合)は、のちに廃止した**(第5.246節・
 *   2026-09-23 利用者の指定「達成具合、これ要らないね」)。
 *   **ここに数字を出さない、という決まりのほうは、そのまま残す。**
 *
 * 【冊の中の区切りは、その行の中に置く】
 *
 *   業種べつ → 棚 35 冊 / 基礎単語 → 段 / Native Flow → Unit 6 /
 *   66 の型 → 中身 2 × 型 66。**いま開いている冊の行の中**に出す
 *   (`sub`)。「どの帳面の、どこ」が**1か所で決まる。**
 *
 * 【自分では何も読まない】
 *
 *   一覧も件数も**呼ぶ側が持つ。**`QrCard` / `NativeFlowUnits` と同じ
 *   「props で受け取る部品」なので、骨組み(Supabase 無し)でもそのまま
 *   描ける(**描けないものは測れない**・CLAUDE.md)。
 *
 * @param books  冊の一覧(`[{ id, label }]`)。**並べ替えない。後ろへ足す**
 * @param book   いま開いている冊の id
 * @param counts 冊ごとの件数(`{ [id]: 数 }`)。無ければ数を出さない
 * @param unit   件数の単位(`'語'` / `'問'`)
 * @param onPick 選ばれた冊の id
 * @param sub    **いま開いている冊の行の中**に出すもの(棚・段・Unit・中身・型)
 * ============================================================================
 */
export default function BookShelf({
  books = [], book = null, counts = null, unit = '語', onPick = null, sub = null,
}) {
  /** **冊が1つしか無ければ、えらぶ場所は要らない**(効かない操作を見せない) */
  if (books.length < 2) return null

  return (
    <div className="shelf" role="group" aria-label="どの帳面をやりますか">
      {books.map((b) => {
        const on = b.id === book
        /* **0 と `null` を取り違えない**(CLAUDE.md)。
           数えられなかった冊は、その行に数を出さない —— `0 語` と出すと
           「空っぽ」に見えるが、**数えていないだけ**のことがある */
        const n = counts?.[b.id]
        return (
          <div key={b.id} className={`shelf-row${on ? ' shelf-row--on' : ''}`}>
            <button type="button"
                    className="shelf-pick"
                    /* **いま開いている冊は、色だけに頼らずに示す**(CLAUDE.md)。
                       印(●)+ 太字 + 枠 + 地色 + `aria-current` の5つ */
                    aria-current={on ? 'true' : undefined}
                    onClick={() => { if (!on) onPick?.(b.id) }}>
              <span className="shelf-mark" aria-hidden="true">{on ? '●' : '○'}</span>
              <span className="shelf-name">{b.label}</span>
              {Number.isFinite(n) && (
                <span className="shelf-n">{n} {unit}</span>
              )}
            </button>
            {/* **中の区切りは、その冊の行の中。** 開いている冊にだけ出す ——
                ほかの冊の Unit を選べても、押した先が別の冊では意味がない */}
            {on && sub && <div className="shelf-sub">{sub}</div>}
          </div>
        )
      })}
    </div>
  )
}
