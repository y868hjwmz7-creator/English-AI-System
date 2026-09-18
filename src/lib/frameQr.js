/**
 * **66 の型を、Quick Response の問にする**(2026-09 利用者の指定)。
 *
 * ============================================================================
 *   > マイクで「話す」の機能は入りません。削除です。全ての型で削除してください。
 *   > そして、型のトレーニングの UI は廃止して、
 *   > quick response の UI にそのままコンテンツを移してください
 *
 * 【新しい仕組みを1つも作っていない】
 *
 *   | 何 | どの道を使うか |
 *   |---|---|
 *   | 問 | `phraseSwap.js` / `frameShift.js`(**ファイル・0円**) |
 *   | 覚え具合 | **`qr_reviews`(0040)** —— ふだんの Quick Response と同じ |
 *   | 溜める | `markQr()` → `mark_qr` |
 *   | 出題・絞り込み・聞き流し・紙 | `QrReview.jsx` そのまま |
 *
 *   **`loadNativeFlowQr()` と1文字も違わない形**にしてある。
 *   行の形をそろえてあるので、`QrReview.jsx` から下は書き分けが要らない。
 *
 *   **端末に持っていた控え(`eas.frameShift.done`)は捨てた。**
 *   専用の画面が無くなったので、覚え具合は Quick Response と同じ
 *   `qr_reviews` に乗る —— **数え方を2通り持たない**(CLAUDE.md)。
 *
 * 【コンテンツは2つのまま。混ぜない】
 *
 *   利用者の指定(2026-09)は
 *   「その中に『日本語→英語』と『言い換え』をコンテンツとして追加します」。
 *   **どちらも残す。** ただし**1つずつ開く** ——
 *   混ぜると 1,879 対 66 なので、**言い換えが埋もれて出てこない**
 *   (黙って絞るのと同じことになる)。
 *
 *   「ぜんぶ」は置かない。**もともと2つは別の練習**であり、
 *   通しで回せていたものを取り上げるわけではない。
 *
 * 【型は、問の文に混ぜない。**ヒントと絞り込みで出す**】(2026-09 利用者の指定)
 *
 *   > quick response 内で型のトレーニングをする際に、絞り込めるようにして欲しい。
 *   > また、ヒントボタンをつけて、一度ボタンを押したら問題を跨いでも、
 *   > もう一度ヒントボタンを押すまでヒントが出続けるようにして欲しい。
 *   > ヒントは、「-の形」というのがヒントにしてください。
 *
 *   **前の形を直している。** 言い換えの問は
 *   `…と伝える(「S makes 人 do(原形)」の型で)` と**日本語の中に**
 *   型を書いていた。**あれを外した** —— 理由は2つある。
 *
 *   - **聞き流しが、その括弧を読み上げる**(`radioJaOf()` は `ja` を読む)。
 *     日本語の声が `S makes 人 do` を読むので、雑音にしかならない
 *   - **紙にもそのまま刷られる**(`qrSheetPairs()` も `ja` を使う)
 *
 *   型は `hint`(**「◯◯」の形**)として別に持ち、画面が出す。
 *   **同じ値を2か所に書かない**(CLAUDE.md)—— 問が持っている型を
 *   そのまま渡すだけで、英文から見分け直さない(**もらえる正解を捨てない**)。
 *
 *   言い換えは**お題1つに型が2つ以上ある**(37 お題 → 66 問)ので、
 *   ヒントを出さないと同じ日本語が2度出る。**型で絞れば1つに決まる**し、
 *   ヒントを出しておけば見分けられる。どちらも利用者の指定で足したものである。
 *
 * 【Supabase を引き連れない】
 *
 *   読み込み(`loadFrameQr()`)だけを `frameQrLoad.js` へ出してある。
 *   ここに置くと `import.meta.env` が付いてきて、
 *   **`npm run test:shift` が素の node で1行も走らせられない**
 *   (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 *   **描けないものは測れない**のと同じ話である。
 * ============================================================================
 */
import { SWAP_FRAMES } from '../data/phraseSwap.js'
import { FRAME_GROUPS, frameGroupCount } from '../data/sentenceFrames.js'
import { sayQuestions, shiftQuestions, swapQuestions } from './frameShift.js'
import { FRAME_FORMS, FRAME_INDEX } from './frameMatch.js'
import { normEn } from './textNorm.js'

/**
 * **中身は2つ。並べ替えない。**
 *
 * `swap` が先なのは、**やさしい順**だからである(もとの段1 → 段2)。
 * 画面はこの一覧を並べるだけで、名前を書き写さない。
 */
export const FRAME_PARTS = [
  { id: 'swap', label: '日本語 → 英語', lead: `日本語を見て、その型で英語を言います。${frameGroupCount()} の型ぜんぶに問があります。` },
  { id: 'say', label: '言い換え', lead: '伝えたいことを、指定の型で言います。型は問に書いてあります。' },
]

/** いちばんやさしい中身。**「先頭」と書かない** —— 並びを変えたら意味が変わる */
export const FIRST_FRAME_PART = FRAME_PARTS[0].id

/** id から1行を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const framePartOf = (id) => FRAME_PARTS.find((p) => p.id === id) ?? null

/**
 * **この冊の名前**(2026-09 利用者の指定)。
 *
 *   > 66の型ですが、実際はもっと少ないはずです。
 *   > 写真のように「させる系」で一つと数えた時の数に変えてください。
 *
 * **数は `frameGroupCount()` 1か所から来る**(14)。画面にも骨組みにも
 * 書き写さない —— 型を足した日に、片方だけ古くなる(CLAUDE.md)。
 */
export const FRAME_BOOK_LABEL = `${frameGroupCount()} の型`

/** 紙と絞り込みに出す名前。**`material_title` に入る。ここ1か所で作る** */
export const framePartTitle = (id) => {
  const p = framePartOf(id)
  return p ? `${FRAME_BOOK_LABEL}(${p.label})` : FRAME_BOOK_LABEL
}

/**
 * その中身の問を、**`{ en, ja }` の形**にほどく。
 *
 * **確かめてから出すのは `swapQuestions()` の仕事**(骨に入れてみて
 * 狙いの型に見えない組み合わせは、はじめから出さない)。ここでは並べるだけ。
 *
 * @param part `'swap'` / `'say'`。知らない id は**空**(当てずっぽうで出さない)
 */
/**
 * 組み立てた問の控え。**同じものを何度も組み立てない。**
 *
 * 5,400 問を `frameFormOf()` に通すので、1回あたり 80ms ほどかかる。
 * 画面は数え上げ・型の一覧・行の3か所から呼ぶので、**控えが無いと
 * 開くたびに 3 回走る**(CLAUDE.md「CPU 2秒」の考え方)。
 * 中身はファイルから作るだけで**いつ呼んでも同じ**なので、控えて安全である。
 */
const PLANNED = new Map()

export function frameQuestions(part = FIRST_FRAME_PART) {
  const kept = PLANNED.get(part)
  if (kept) return kept
  /* **同じ英文は、ここで1つに落とす。**
     数え上げ(`frameQrCounts` / `frameQrForms`)も行(`frameQrRows`)も
     **この1つの道を通る** —— 別々に数えると、
     **札には 52 問と出て、出てくるのは 51 問**になる(2026-09 に踏んだ)。
     **数え方を2通り持たない**(CLAUDE.md)。
     **先に書いてあるほうを残す**(手で書いたお題 → 束の順) */
  const out = []
  const used = new Set()
  for (const q of framePlan(part)) {
    const key = normEn(q.en)
    if (!key || used.has(key)) continue
    used.add(key)
    out.push({ ...q, key })
  }
  PLANNED.set(part, out)
  return out
}

/** 重なりを落とす前の問。**`frameQuestions()` だけが呼ぶ** */
function framePlan(part) {
  /* **型は、問が持っているものをそのまま渡す。**
     英文から見分け直さない(**もらえる正解を捨てない**・CLAUDE.md)*/
  if (part === 'say') {
    /* **手で書いた 37 のお題が先。** あちらは場面のある本物の言い回しで、
       束(`frameSay.js`)は数である。**順を入れ替えない** ——
       並べ方を「教材の順」にした人は、良いほうから始まる */
    return [...shiftQuestions(), ...sayQuestions()]
      .map((q) => ({ ja: q.ja, en: q.ex, form: q.form }))
  }
  if (part !== 'swap') return []
  const out = []
  /* **骨の並びは `phraseSwap.js` のまま。** ここで並べ替えない */
  for (const f of SWAP_FRAMES) {
    for (const q of swapQuestions({ frame: f.id })) {
      out.push({ ja: q.ja, en: q.ex, form: q.form })
    }
  }
  return out
}

/**
 * **ヒントに出す型**(2026-09 利用者の指定)。
 *
 *   > 青で囲まれた「〜の型」をヒントに
 *
 * **返すのは型の名前そのもの。** 文言(`型 ◯◯`)も見た目(青い囲み)も
 * `QrCard` が持っており、**答えを開いたあとに出るものと同じ部品**である ——
 * 同じことを2つの見た目で見せない(CLAUDE.md)。
 *
 * **はじめは「◯◯」の形という文を返していた**が、利用者が
 * 「答えの下に出ている青い囲みと同じものを」と指定したので、そちらへ寄せた。
 *
 * 型が分からない行(ふだんの Quick Response・Native Flow)は `null` ——
 * **当てずっぽうで出さない**ので、あちらにヒントのボタンは出ない。
 */
export const frameHintOf = (form) => (form || null)

/**
 * **型で絞るための一覧**(2026-09 利用者の指定「絞り込めるようにして欲しい」)。
 *
 * **並びは `sentenceFrames.js` のまま**(`FRAME_FORMS`)。問を数え上げた順に
 * 並べると、書いた順になってしまう —— **一覧を勝手に並べ替えない**
 * (`.claude/rules/common.md`)。
 *
 * **1問も無い型は出さない**(開いた先が空になる・行き止まりを作らない)。
 * 組も添えるので、画面は `<optgroup>` でまとめて出せる。
 */
export function frameQrForms(part = FIRST_FRAME_PART) {
  const n = new Map()
  for (const q of frameQuestions(part)) n.set(q.form, (n.get(q.form) ?? 0) + 1)
  return FRAME_FORMS
    .filter((f) => n.get(f) > 0)
    .map((f) => {
      const found = FRAME_INDEX.get(f)
      return {
        form: f,
        /* **組の名前も書き写さない。** `sentenceFrames.js` から引く */
        group: found ? `${found.sectionNo} ${found.groupLabel}` : '',
        /** どの系の中か。**`frameQrGroups()` が束ねるのに使う** */
        groupKey: found ? `${found.sectionId}.${found.groupId}` : '',
        n: n.get(f),
      }
    })
}

/**
 * **「〜系ぜんぶ」を指す値**(2026-09 利用者の指定
 * 「選択肢に『〜系全て』を追加してください」)。
 *
 * 型の名前と**同じ欄**に入れるので、取り違えないよう印を先頭に付ける。
 * 型の名前は `S allows 人 to do` の形で、この印では始まらない。
 * **印の文字はここ1か所**(画面にも検証にも書き写さない)。
 */
const GROUP_MARK = '系:'

/** 系の鍵 → 欄に入れる値。**組み立ても1か所** */
export const frameGroupValue = (key) => `${GROUP_MARK}${key}`

/**
 * **絞り込みの値 → 出す型の一覧。判断はここ1か所**(CLAUDE.md)。
 *
 * - 空(`null` / `''`)… `null` を返す = **ぜんぶ出す**
 * - 型の名前 … その1本
 * - `系:◯◯` … その系に入る型ぜんぶ
 * - **知らない系 … 空**(0問)。**黙って「ぜんぶ」に落とさない** ——
 *   選んでいないものが出るほうが分かりにくい(型ひとつのときと同じ作法)
 */
export function frameFormFilter(value) {
  const v = String(value ?? '')
  if (!v) return null
  if (!v.startsWith(GROUP_MARK)) return [v]
  const g = FRAME_GROUPS.find((x) => x.key === v.slice(GROUP_MARK.length))
  return g ? g.forms : []
}

/**
 * **系ごとに束ねた、絞り込みの一覧**(2026-09 利用者の指定)。
 *
 * 画面は、これをそのまま `<optgroup>` に並べるだけである ——
 * **束ね方も、系ごとの問数も、画面で数え直さない**
 * (別々に数えると「札には 52 問、出てくるのは 51 問」になる)。
 *
 * **並びは `frameQrForms()` のまま** = `sentenceFrames.js` のまま。
 * **1問も無い型は入らない**ので、系まるごと消えることもある。
 */
export function frameQrGroups(part = FIRST_FRAME_PART) {
  const out = []
  for (const f of frameQrForms(part)) {
    const last = out[out.length - 1]
    if (last && last.key === f.groupKey) {
      last.rows.push(f)
      last.n += f.n
      continue
    }
    const g = FRAME_GROUPS.find((x) => x.key === f.groupKey)
    out.push({
      key: f.groupKey,
      /** 欄に入れる値。**画面で組み立てない** */
      value: frameGroupValue(f.groupKey),
      /** 見出し(`① 1. させる(背中を押す)`) */
      label: f.group,
      /** 短い呼び名。画面が `${kei}系ぜんぶ` を作る */
      kei: g?.kei ?? '',
      n: f.n,
      rows: [f],
    })
  }
  return out
}

/**
 * その中身で、**いま選べる絞り方か**。
 *
 * 画面が覚えている値(`FRAME_FORM_KEY`)は、中身を切り替えると
 * 向こうに無いことがある。**「ぜんぶ」に落とす判断はここ1か所**で、
 * 画面は答えを受け取るだけである(型ひとつでも、系ぜんぶでも同じ道)。
 */
export function frameFormOk(part = FIRST_FRAME_PART, value = null) {
  const only = frameFormFilter(value)
  if (!only || !only.length) return false
  const have = new Set(frameQuestions(part).map((q) => q.form))
  return only.some((f) => have.has(f))
}

/**
 * **いま絞っている型の、画面に出す名前**(第5.187節)。
 *
 *   > 選んだ後に選んだものがどこかに明確に表示されてほしいと思います。
 *
 * 系(`系:◯◯`)なら系の名前、型ひとつならその型そのもの。
 * **画面で `value.startsWith('系:')` と書き分けない**
 * (**判断は1か所**・CLAUDE.md)。
 *
 * @returns 「ぜんぶ」や知らない値のときは **空**(`nowName()` が落とす)
 */
export function frameFormLabel(part = FIRST_FRAME_PART, value = null) {
  if (!value) return ''
  const groups = frameQrGroups(part)
  const g = groups.find((x) => x.value === value)
  if (g) return g.label
  const one = groups.flatMap((x) => x.rows).find((f) => f.form === value)
  return one ? one.form : ''
}

/**
 * 問 × 覚え具合 → `qr_items()` とそろえた行。
 *
 * **`nativeFlowRows()` と同じ形を返す。** ここがずれると、
 * `QrReview.jsx` が書き分けを持つことになる(**数え方を2通り持たない**)。
 *
 * **同じ英文は二度出さない**(落とすのは `frameQuestions()` 1か所)。
 * 重なると**同じ札が2枚出て、数も二重**になる。
 */
export function frameQrRows(
  seen = [], { today = '', part = FIRST_FRAME_PART, form = null } = {},
) {
  const map = new Map(
    (seen ?? []).map((r) => [String(r?.en_norm ?? ''), r]).filter(([k]) => k),
  )
  const title = framePartTitle(part)
  /* **型で絞る**(`null` ならぜんぶ)。**型ひとつでも、系ぜんぶでも同じ道**
     (`frameFormFilter()` が一覧に直す)。知らない型・知らない系を渡せば
     0問になる —— **黙って「ぜんぶ」に落とさない**
     (選んでいないものが出るほうが怖い)。
     画面の側が、出せる絞り方かどうかを先に見ている(`frameFormOk()`) */
  const only = form ? new Set(frameFormFilter(form) ?? []) : null
  const out = []
  for (const q of frameQuestions(part)) {
    if (only && !only.has(q.form)) continue
    const s = map.get(q.key) ?? null
    out.push({
      en_norm: q.key,
      en: q.en,
      ja: q.ja,
      /** **ヒント。** 文言は `frameHintOf()` 1か所(画面に書き写さない) */
      hint: frameHintOf(q.form),
      /* **話す人はいない。** 会話から溜めた問と違い、ここは1問ずつの表現である */
      speaker: null,
      status: s?.status ?? 'unknown',
      box: s?.box ?? 0,
      learn_streak: s?.learn_streak ?? 0,
      due_on: s?.due_on ?? today,
      added_at: s?.added_at ?? null,
      updated_at: s?.updated_at ?? null,
      /* **教材にしていない**ので、id は持たない(`materials` に行が無い) */
      material_id: null,
      material_title: title,
      material_industry: null,
      material_kind: null,
      material_genre: null,
      material_scene: null,
      material_level: null,
    })
  }
  return out
}

/** 中身ごとの問数。**画面で数え直さない**(札の数と出る問が食い違う) */
export const frameQrCounts = () => Object.fromEntries(
  FRAME_PARTS.map((p) => [p.id, frameQuestions(p.id).length]),
)

/** どの型で絞っていたかを覚える鍵。**2か所に書かない**(CLAUDE.md) */
export const FRAME_FORM_KEY = 'eas.frameQr.form'

/** ヒントを出しているかを覚える鍵。**同上** */
export const QR_HINT_KEY = 'eas.qrHint'

/** どの中身を開いていたかを覚える鍵。**2か所に書かない**(CLAUDE.md) */
export const FRAME_PART_KEY = 'eas.frameQr.part'
