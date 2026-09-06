/**
 * **教材の種類**(`materials.kind`)と、その呼び分け。
 *
 * ============================================================================
 * 【なぜ `src/lib/materials.js` から分けたのか】
 *
 *   あちらは Supabase(`import.meta.env`)を引き連れているので、
 *   **素の node で一度も読み込めない。** ところが
 *   「画面が作れる種類が、表の制約(`materials_kind_check`)に
 *   全部入っているか」を見張る検証は、素の node で走る
 *   (`scripts/check-exercise-types.mjs`)。
 *
 *   演習の種類で**まったく同じ落とし穴**を踏んでいる ——
 *   画面と窓口には足したのに表の制約に足し忘れ、
 *   **教材を発行した瞬間に**「violates check constraint」で止まった。
 *   `npm run lint` も `npm run build` も通る。
 *   だから種類の一覧だけを、何にも依存しない形へ出してある
 *   (`playMark.js` / `gamify.js` / `speechDraft.js` と同じ考え方)。
 *
 *   **読む側は1行も変わらない。** `materials.js` がそのまま出し直している。
 *
 * 【種類を足すときに触る場所は3つ】
 *
 *   | どこ | 何を |
 *   |---|---|
 *   | ここ | `MATERIAL_KINDS` に1行 |
 *   | `src/data/exerciseTypes.js` | `DEFAULT_SECTIONS` に演習の構成 |
 *   | **移行(SQL)** | **`materials_kind_check` の一覧** |
 *
 *   3つとも `npm run test:db` が見張っている。
 */

export const MATERIAL_KINDS = [
  { id: 'pattern',  label: '文型ドリル',
    hint: '同じ文法で違う文章をくり返す。定着が狙い。4演習 × 10問 = 40問' },
  { id: 'reading',  label: 'リーディング(記事)',
    hint: '業界別のニュースや読み物を1本。音読・シャドーイングに使う' },
  { id: 'dialogue', label: 'ダイアローグ(会話)',
    hint: '場面を決めた会話を1本。役を決めて声に出す' },
  /* **会議**(2026-09 利用者の指定「会議の教材が追加されていない」)。
     中身は会話とまったく同じで、**出てくる人数が3〜4人**という1点だけが違う。
     人数は `materials.voice_ids` の長さがそのまま持つので、
     **表も列も増やしていない**(足したのは `kind` の値1つだけ・0037)。 */
  { id: 'meeting',  label: '会議',
    hint: '3〜4人の打ち合わせを1本。立場の違う人が集まり、その場で決めていく' },
  /* **Speech練習**(2026-09 利用者の指定)。
       > 自分でスピーチなどを考えてもらったものをそのままコピペして
       > 指定する音声で text to speech をして、オーバーラッピングや
       > シャドーイングのように練習できるモードが欲しいです。
       > 基本的に「記事」と同じで大丈夫なのですが、タイトルを
       > 「Speech練習」などにしてほしいです。

     中身は**記事とまったく同じ**(本文1本 + 内容の理解 + ディスカッション +
     語句)。ちがうのは **1人が最後まで話しきる**という1点だけである。
     **演習の種類は増やしていない**(本文は記事と同じ `article`)ので、
     `material_sections_type_check` も窓口も触っていない。
     **足したのは `kind` の値1つだけ**(0043)。会議(0037)と同じ考え方。 */
  { id: 'speech',   label: 'Speech練習',
    hint: '自分の原稿を貼って、指定した声で読ませる。AI に作らせることもできる' },
  { id: 'word',     label: '単語', hint: '単語学習で使う' },
  { id: 'phrase',   label: 'フレーズ', hint: 'フレーズ学習で使う' },
  // 旧「長文」。新規では選べないが、既存の教材の表示に使う
  { id: 'passage',  label: '長文(旧)', hint: '作り直す前の形。新しくは作れない', legacy: true },
]

/** 新しく作れる種類(旧いものを除く) */
export const NEW_MATERIAL_KINDS = MATERIAL_KINDS.filter((k) => !k.legacy)

/** 本文を1本作る種類(記事・会話・会議)かどうか。問数ではなく長さで考える */
export const isPassageKind = (kind) =>
  kind === 'reading' || kind === 'dialogue' || kind === 'meeting'
  || kind === 'speech'

/**
 * **会話の形をした種類**(会話・会議)かどうか。
 *
 * この2つは中身が同じで、**出てくる人数だけが違う。**
 * だから「話す人を選ぶ」「場面を選ぶ」「発言で数える」は、どちらにも要る。
 * **`kind === 'dialogue'` と書かない。** 書くと会議で必ず抜ける。
 */
export const isDialogueKind = (kind) => kind === 'dialogue' || kind === 'meeting'

/** 画面に出す短い呼び名(「記事」「会話」「会議」「スピーチ」)。文の中で使う */
export const bodyWord = (kind) => (
  kind === 'reading' ? '記事'
    : kind === 'meeting' ? '会議'
      : kind === 'speech' ? 'スピーチ'
        : '会話'
)

/**
 * **場面(シチュエーション)を選ぶ種類**かどうか。
 *
 * 記事は「話題(ジャンル)」、会話・会議・スピーチは「場面」で選ぶ。
 * **`isDialogueKind` を流用しない。** あれは
 * 「話す人が2人以上いる」ことを意味しており、
 * スピーチ(1人)に当てると人数の欄まで一緒に出てしまう。
 */
export const usesScene = (kind) => isDialogueKind(kind) || kind === 'speech'

/**
 * **自分の原稿を貼って作れる種類**かどうか(2026-09 利用者の指定)。
 *
 *   > 内容は、自分で手入力が基本
 *
 * いまは Speech練習だけ。**判断を画面に書かない** ——
 * ほかの種類にも広げたくなったとき、直すのはここ1行になる。
 */
export const canPasteBody = (kind) => kind === 'speech'

export const kindLabel = (id) => MATERIAL_KINDS.find((k) => k.id === id)?.label ?? id
