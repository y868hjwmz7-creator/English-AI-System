/**
 * 単語帳の絞り込み — **絞る・数える・空にする**(算段だけ)。
 *
 * ============================================================================
 * 【なぜ画面から切り出したのか】(2026-09)
 *
 *   ここはもともと `src/components/WordbookFilter.jsx` の中にあった。
 *   あれは JSX なので、**素の node で一度も走らせられない**
 *   (`playMark.js` / `homeworkFilter.js` と同じ考え方)。
 *
 *   切り出す決め手になったのは **`runKeyOf()`(`reviewScope.js`)**である。
 *   あちらは「絞り込みが変わったら出題を組み直す」ための鍵を作るのに、
 *
 *       f.day ?? '', f.material ?? '', f.field ?? '', f.topic ?? '', f.level ?? ''
 *
 *   と**鍵を書き写していた。** レベルを足したときに片方だけ数え漏らした
 *   のと、まったく同じ形である。`FILTER_KEYS` を**素の node から読める
 *   場所**へ置けば、両方が同じ一覧を見られる。
 *
 *   **呼ぶ側は1行も変わっていない** —— `WordbookFilter.jsx` が
 *   ここから読み直して、これまでどおり出し直している。
 */
import { toDateKey } from './format.js'
import { industryLabel } from '../data/industries.js'
import { genreLabel, sceneLabel } from '../data/genres.js'
import { cefrLabel } from '../data/cefr.js'
import { posGroupOf, posLabel } from './posGroups.js'

/**
 * 絞り込みの鍵。**一覧はここ1か所。**
 *
 * 「いくつ絞っているか」も「ぜんぶ外す」も「組み直すか」も、
 * すべてここから作る。**書き写さない。**
 */
export const FILTER_KEYS = ['day', 'material', 'field', 'topic', 'level', 'pos']

/** いくつ絞っているか。**畳んでいても分かるように**札の数として出す */
export const countNarrowed = (filter) => FILTER_KEYS
  .filter((k) => (filter ?? {})[k]).length

/** 何も絞っていない状態。**外すときも、ここから作る**(鍵を書き写さない) */
export const emptyFilter = () => Object.fromEntries(FILTER_KEYS.map((k) => [k, null]))

/* 「教材なし」をまとめる合図。空文字だと `<option>` の value と紛れる。

   **値はもとのまま(NUL)。書き方だけエスケープにしてある**(2026-09)。
   もとは**生の NUL を1バイト**書いてあったので、git がこのファイルを
   「バイナリ」と見なし、**差分も grep も効かなかった。**
   `\u0000` と書けば**同じ値のまま**、ふつうの文字列として読める */
export const NO_MATERIAL = '\u0000none'

/** その行が単語帳に入った日("2026-08-24")。無ければ null */
export const addedDayOf = (row) => (row?.added_at ? toDateKey(new Date(row.added_at)) : null)

/**
 * その語が「どの場面・話題で出会ったか」(0028)。
 *
 * 教材は**場面か話題のどちらか一方**しか持たない
 * (会話なら場面、記事なら話題)。だから**1つの欄にまとめて出す。**
 * 欄を2つに分けると、片方はいつも空になる。
 */
export const topicOf = (row) => {
  if (row?.material_scene) return { key: `s:${row.material_scene}`, label: sceneLabel(row.material_scene), group: 'シチュエーション' }
  if (row?.material_genre) return { key: `g:${row.material_genre}`, label: genreLabel(row.material_genre), group: '話題' }
  return null
}

/** その語が「どの分野の教材で出会ったか」(0028) */
export const fieldOf = (row) => (row?.material_industry
  ? { key: row.material_industry, label: industryLabel(row.material_industry) }
  : null)

/**
 * その語が「どのレベルの教材で出会ったか」(0048・2026-09 利用者の指定
 * 「レベルの絞り込みも欲しいですね」)。
 *
 * **0048 を貼るまでは空**なので、そのときは行ごと出ない
 * (`material_industry` を足したときとまったく同じ作法)。
 */
export const levelOf = (row) => (row?.material_level
  ? { key: row.material_level, label: cefrLabel(row.material_level) }
  : null)

/**
 * その語の品詞(2026-09 利用者の指定)。
 *
 *   > 全ての単語に対して効くようにして欲しいのが
 *   > 品詞ごとに分ける絞り込み機能です。
 *
 * **そろえ方は `posGroupOf()` 1か所。** `pos` に入っている文字は
 * 「名詞」(窓口が引いた控え)と `n`(基礎単語)の2通りあるので、
 * ここで見分けると必ず片方で抜ける。
 *
 * **分からない品詞は `null`** —— その語は品詞では絞れない。
 * 当てずっぽうで「その他」に入れない。
 */
export const posOf = (row) => {
  const id = posGroupOf(row?.pos)
  return id ? { key: id, label: posLabel(id) } : null
}

/**
 * 絞り込みを当てる。**判断はここ1か所。** 画面ごとに書くとずれる。
 *
 * @param {Array} rows 一覧ぜんぶ
 * @param {{day, material, field, topic, level, pos}} filter
 */
export function applyWordbookFilter(rows, filter) {
  const {
    day = null, material = null, field = null,
    topic = null, level = null, pos = null,
  } = filter ?? {}
  if (!day && !material && !field && !topic && !level && !pos) return rows
  return (rows ?? []).filter((r) => {
    if (day && addedDayOf(r) !== day) return false
    if (material) {
      const key = r.material_title || NO_MATERIAL
      if (key !== material) return false
    }
    if (field && fieldOf(r)?.key !== field) return false
    if (topic && topicOf(r)?.key !== topic) return false
    if (level && levelOf(r)?.key !== level) return false
    if (pos && posOf(r)?.key !== pos) return false
    return true
  })
}
