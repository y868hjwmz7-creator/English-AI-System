/**
 * **どの曲を流すか**(第5.194節・2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > また、複数登録した曲から選べるようにしてください。
 *
 * 【これまで】
 *
 *   登録した曲を**全部まとめて順不同で流す**だけだった(`startBgm`)。
 *   何曲入れても、**どれを流すかは選べなかった。**
 *
 * 【決めたこと】
 *
 *   ・**「ぜんぶ(順不同)」を先頭に置く。** これまでどおりの流れ方で、
 *     既定もこれ —— **いまの音を1ミリも変えない**
 *   ・そのあとに、登録した曲を**1曲ずつ**並べる
 *   ・1曲を選んだら、**その曲だけをくり返す**(`play()` が巻き戻る)
 *   ・**選んだ曲が消えていたら、黙って「ぜんぶ」に落ちる** ——
 *     消えた曲の id を握ったままだと、音が1つも鳴らない
 *     (**行き止まりを作らない**・CLAUDE.md)
 *
 * 【混ぜるのは「ぜんぶ」のときだけ】
 *
 *   1曲しか流さないのに順を混ぜても意味がない。
 *   **「混ぜるかどうか」も、ここが決める** ——
 *   画面が `shuffle` を書き分けると、置く場所の数だけ食い違う。
 *
 * 【Supabase を引き連れない】
 *
 *   曲の一覧は**呼ぶ側が渡す**(`listTracks()` は `bgm.js` の仕事)。
 *   ここは選び方だけなので、`npm run test:play` が素の node で
 *   呼んで確かめられる(`playMark.js` / `assignBooks.js` と同じ考え方)。
 * ============================================================================
 */

/** 「ぜんぶ(順不同)」。**空の文字にしておく** —— 覚えていないときと同じ扱いになる */
export const BGM_ALL = ''

/** 「ぜんぶ」の呼び名。**画面に書き写さない** */
export const BGM_ALL_LABEL = 'ぜんぶ(順不同)'

/** 覚える鍵。**場面で分けない** —— 曲は単語帳でも Quick Response でも同じものである */
export const BGM_PICK_KEY = 'eas.bgmPick'

/** 名前の無い曲にも、何か出す(**空の行を出さない**) */
const titleOf = (t) => String(t?.title ?? '').trim() || '(名前のない曲)'

/** 流せる曲だけ。**置き場所の無い行は、押しても鳴らない**(効かない操作を見せない) */
export const playable = (tracks = []) => (tracks ?? []).filter((t) => t?.id && t?.path)

/**
 * 選べるものの一覧。**先頭はいつも「ぜんぶ」。**
 *
 * **曲が1つのときは、選ぶ場所そのものが要らない**ので空を返す ——
 * 「ぜんぶ」と「その1曲」は同じものである(**効かない操作を見せない**)。
 */
export function bgmChoices(tracks = []) {
  const got = playable(tracks)
  if (got.length < 2) return []
  return [{ id: BGM_ALL, label: BGM_ALL_LABEL },
    ...got.map((t) => ({ id: String(t.id), label: titleOf(t) }))]
}

/**
 * 実際に流す曲。
 *
 * @param pick 選んでいる曲の id(`BGM_ALL` ならぜんぶ)
 * @returns `{ tracks, shuffle }` —— **そのまま `startBgm()` に渡せる形**
 */
export function bgmPlan(tracks = [], pick = BGM_ALL) {
  const got = playable(tracks)
  const one = pick ? got.find((t) => String(t.id) === String(pick)) : null
  /* **知らない id は「ぜんぶ」に落ちる**(消された曲を握ったままにしない) */
  return one
    ? { tracks: [one], shuffle: false }
    : { tracks: got, shuffle: true }
}

/** いま選んでいるもの。**消えた曲なら「ぜんぶ」** */
export function bgmPickOf(tracks = [], pick = BGM_ALL) {
  const got = playable(tracks)
  return pick && got.some((t) => String(t.id) === String(pick)) ? String(pick) : BGM_ALL
}

/** 覚えているもの。**読めなくても困らない**(既定は「ぜんぶ」) */
export function loadBgmPick() {
  try { return localStorage.getItem(BGM_PICK_KEY) || BGM_ALL } catch { return BGM_ALL }
}

export function saveBgmPick(id) {
  try {
    if (id) localStorage.setItem(BGM_PICK_KEY, String(id))
    else localStorage.removeItem(BGM_PICK_KEY)
  } catch { /* 使えなくても困らない */ }
}
