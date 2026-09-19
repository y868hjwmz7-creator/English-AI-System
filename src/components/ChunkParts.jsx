/**
 * **ビジネス必須チャンク集の、どの段・どの組をやるか**(第5.199節)。
 *
 * ============================================================================
 * 2026-09 利用者の指定。
 *
 *   > quick responseの中の14の型、その中のさせる系、その中の
 *   > S enables 人 to do、のようにビジネス必須チャンク集(冊名)、
 *   > その中の名詞句、その中の-ing、5WH +SV、などなど。
 *
 * 【`FrameParts` とまったく同じ形にする】
 *
 *   あちらも「冊の中から、いま開く1つを選ぶ」である。
 *   **同じことをするものを、別の見た目で2つ作らない**(CLAUDE.md)。
 *   置き場所も(`.wb-add`)、名前と欄の並べ方も(`.field--inline`)、
 *   説明の1行も、あちらから1文字も変えていない。
 *
 * 【「まとめ」を、どの段にも必ず置く】(利用者の指定「全てに共通とします」)
 *
 *   組を1つずつしか選べないと、**その段をまるごと練習する道が無い。**
 *   型の冊の「〜系ぜんぶ」と同じ考え方である。
 *   **名前も数も、こちらで作らない** —— `chunkGroups()` が
 *   先頭に「◯◯まとめ」を入れて持ってくる。ここで足し算すると、
 *   **札の数と出てくる語がずれる**(CLAUDE.md)。
 *
 * 【自分では何も読まない】
 *
 *   語数は `chunkBook.js` が数える(**0円**。ファイルを数えるだけ)。
 *   **props で受け取るだけの部品**なので、骨組み(Supabase 無し)でも
 *   そのまま描ける(**描けないものは測れない**)。
 * ============================================================================
 *
 * @param parts  段の一覧(`CHUNK_PARTS`)
 * @param counts 段ごとの語数(`{ np: 120, … }`)
 * @param picked いま開いている段の id
 * @param onPick 選ばれた段の id
 * @param groups その段の組の一覧(`chunkGroups()`。先頭が「まとめ」)
 * @param group  いま絞っている組。空なら「まとめ」
 * @param onGroup 選ばれた組(「まとめ」は空)
 */
export default function ChunkParts({
  parts = [], counts = {}, picked = null, onPick = null,
  groups = [], group = '', onGroup = null,
}) {
  /** **段が1つも無ければ、欄ごと出さない**(効かない操作を見せない) */
  if (!parts.length) return null

  /* **知らない id が残っていても、いちばん先の段に落ちる。**
     `<select>` に無い値を渡すとブラウザが勝手に先頭を選ぶので、
     画面と中身が食い違う(`ShelfBooks` で踏んだ落とし穴) */
  const now = parts.some((p) => p.id === picked) ? picked : parts[0].id
  const lead = parts.find((p) => p.id === now)?.lead ?? ''
  /* **知らない組が残っていても、「まとめ」に落ちる**(同上)。
     **この欄に出しているものと突き合わせる** */
  const nowGroup = groups.some((g) => g.id === group) ? group : ''

  return (
    <div className="wb-add nfunits">
      {/* **名前と欄を横に並べる決まりは、もう在る**(`.field--inline`)。
          ここで書き写さない */}
      <label className="field field--inline nfunits-pick">
        <span className="field-label">中身</span>
        <select className="input" value={now}
                onChange={(e) => onPick?.(e.target.value)}>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}({counts[p.id] ?? 0} 語)
            </option>
          ))}
        </select>
      </label>
      {/* **組で絞る。** 中身の欄のすぐ下に置く —— どちらも
          「出す語そのものが変わる」ものなので、同じ場所にまとめる。
          **組が「まとめ」1つしか無ければ、欄ごと出さない**
          (押しても何も変わらない・効かない操作を見せない) */}
      {groups.length > 1 && (
        <label className="field field--inline nfunits-pick">
          <span className="field-label">組</span>
          <select className="input" value={nowGroup}
                  onChange={(e) => onGroup?.(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id || 'all'} value={g.id}>
                {/* **「まとめ」には名前を足さない**(`name` が空) */}
                {g.label}{g.name ? `(${g.name})` : ''}({g.n} 語)
              </option>
            ))}
          </select>
        </label>
      )}
      {/* **何をする練習かを、その場で1行。** 選ぶたびに入れ替わる ——
          説明を1つにまとめると、**選んでいないほうの説明も読まされる** */}
      <p className="tip basicpick-lead">
        {lead}
        <strong>自分の単語帳とは混ざりません。</strong>
        覚えた記録は、中身を切り替えても残ります。
      </p>
    </div>
  )
}
