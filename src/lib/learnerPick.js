/**
 * **ゲストを名前で絞る**(第5.238節)。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > ゲストのリストは開くためのボタンを一つ配置し、
 *   > デフォルトでは名前を記入して検索する仕様にしてください。
 *
 *   担当は1人あたり25人、伸ばしたあとは同じだけ増える(CLAUDE.md 冒頭)。
 *   **25人ぶんのチェックが常に並んでいると、その下にあるものが
 *   画面の外へ押し出される**(`.claude/rules/common.md`「長い一覧は、
 *   開くまで羅列しない」)。
 *
 * 【なぜ何にも依存しない形にしてあるか】
 *   画面(JSX)はブラウザを引き連れていて、**素の node で一度も
 *   走らせられない**(`playMark.js` と同じ考え方)。
 *   絞り方だけをここに置けば `npm run test:play` で数字を見られる。
 */

/* ── **見出しと、いないときの1行**(第5.238節)────────────────────
   ゲストを選ぶ欄は、教材の画面だけで**2か所**ある
   (まとめて共有する帯 / カードの中の「渡す」)。
   どちらも同じことをするので、**言い方が2つあると別の操作に見える。**
   **呼び名を2か所に書かない**(CLAUDE.md)。

   画面(JSX)ではなくここに置いてあるのは、**骨組みと検証が
   素の node で読めるようにする**ためである(値を書き写さない)。 */

/** 何人でも選べる欄の見出し */
export const PICK_LABEL = '誰に出しますか(複数えらべます)'

/**
 * 受講中のゲストが1人もいないとき。
 *
 * **「担当がいない」とは違う。** 休会中の人はいるが受講中の人がいない、
 * という形がある —— **0 と `null` を取り違えない**のと同じ話である。
 */
export const NO_ACTIVE_TEXT = '受講中のゲストがいません。'

/** 突き合わせ用にそろえる(大文字小文字と、前後の空白を無視する) */
const norm = (s) => String(s ?? '').trim().toLowerCase()

/**
 * 名前で絞る。
 *
 * **空なら絞らない**(全員を返す)。0件にしてしまうと、
 * 「一覧をひらく」を押した人に**誰も出ない**(CLAUDE.md
 * 「黙って絞らない」)。
 *
 * @param people `[{ id, display_name }]`。`null` は読み込み中
 * @param keyword 打った文字
 */
export const matchLearners = (people, keyword) => {
  const q = norm(keyword)
  const list = Array.isArray(people) ? people : []
  if (!q) return list
  return list.filter((p) => norm(p?.display_name).includes(q))
}

/**
 * **一覧を出すか。**
 *
 * **打ったときは、開いていなくても出す** —— 名前で探すのが既定の道なので、
 * 打ったのに何も出ないと行き止まりになる(CLAUDE.md)。
 *
 * @param keyword 打った文字
 * @param open 「一覧をひらく」を押してあるか
 */
export const showsLearnerList = (keyword, open) => Boolean(open) || norm(keyword) !== ''

/**
 * 選んでいる人の名前を、並べて出す形にする。
 *
 * **選んだことは、一覧を閉じても見えていなければならない** ——
 * 見えないまま「共有する」を押すと、誰に出したのか分からない。
 * **名簿に無い id は落とす**(消えたゲストなど)。
 */
export const pickedNames = (people, picked) => {
  const byId = new Map((Array.isArray(people) ? people : []).map((p) => [p?.id, p]))
  return (Array.isArray(picked) ? picked : [])
    .map((id) => byId.get(id)?.display_name)
    .filter(Boolean)
}
