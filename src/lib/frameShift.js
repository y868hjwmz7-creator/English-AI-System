/**
 * **型シフトの判定と出題**(2026-09 利用者の指定「画期的なトレーニングを作りたい」)。
 *
 * ============================================================================
 * 【なぜ `src/lib/` に、Supabase を引き連れずに置くのか】
 *
 *   `src/lib/*.js` の多くは Supabase と `import.meta.env` を引き連れており、
 *   **手元で一度も走らせられない**(CLAUDE.md「素の node で走らせられる形に
 *   切り出す」)。ここは**算段だけ**なので、`npm run test:shift` が
 *   素の node でそのまま走らせて確かめられる。
 *
 * 【判定は、ここ1か所だけが持つ】
 *
 *   画面の中で `frameFormOf(...) === '…'` と書かない。
 *   **置く場所の数だけ食い違う**(`remakeModeOf()` / `canAskReview()` /
 *   `isDialogueKind()` と同じ作法)。画面が呼ぶのは `judgeShift()` だけで、
 *   `npm run test:shift` が「画面が `frameMatch` を直に触っていないか」を見張る。
 *
 * 【×を付けない —— いちばん大事な決まり】
 *
 *   `frameMatch` は**迷ったら黙る**(取り違えるくらいなら、見落とすほう)。
 *   だから「見分けられなかった」は「**間違っている**」ではない。
 *
 *   実際、`It is not cost but timing.` は正しい英語だが見分けられない
 *   (`but` のうしろが冠詞の無い裸の名詞のため)。
 *   これを「×」と出したら、**正しく言えた人に嘘をつくことになる。**
 *
 *   返す答えは4つ。**`unsure` は ✕ ではない。**
 *
 *   | 返り | いつ | 画面での見せ方 |
 *   |---|---|---|
 *   | `ok`     | 狙った型で言えている | ○ |
 *   | `other`  | **別の型**になっている | 型の名前を出して知らせる(✕ではない) |
 *   | `unsure` | 型として見分けられない | 「たしかめられませんでした」+ お手本 |
 *   | `empty`  | 何も言っていない | 何も出さない |
 *
 * 【`SAME_SHAPE` を、ここで吸収する】
 *
 *   `what 節`(②)と `What ~ is …`(③)は**同じ形**なので、
 *   `frameMatch` は見分けられないと宣言している(`SAME_SHAPE`)。
 *   狙いが `what 節` のとき、返ってくるのは `What ~ is …` である。
 *   **画面にこの事情を持ち込まない。** ここで読み替える。
 *
 * 【覚え具合を `qr_reviews` に入れない】
 *
 *   Native Flow は `qr_reviews`(0040)に溜めている。あちらは
 *   **Quick Response の問そのもの**だからである。
 *   型シフトの答えを同じところへ入れると、**Quick Response 帳に 66 文が混ざる。**
 *   利用者の指定「最終的には単語帳も Quick Response 帳もすっきり見やすく
 *   まとめたい」(2026-09)と正面からぶつかる。
 *
 *   **だからこの段では、端末(localStorage)に持つ。**
 *   置き場所を Supabase に移すかどうかは、次の段(型の地図)で
 *   利用者に確かめる ——
 *   **データの置き場を変えるのは方針の転換**であり、勝手にやらない
 *   (`.claude/rules/common.md`)。
 *
 * 例外は投げない。**空・null・知らない型でも落ちない。**
 * ============================================================================
 */
import { FRAME_SHIFTS, SHIFT_SCENES } from '../data/frameShift.js'
import { FRAME_INDEX, SAME_SHAPE, frameFormOf } from './frameMatch.js'

/** 判定の4つ。**文字列を画面に書き写さない**(`===` で比べるのはここだけ) */
export const SHIFT_OK = 'ok'
export const SHIFT_OTHER = 'other'
export const SHIFT_UNSURE = 'unsure'
export const SHIFT_EMPTY = 'empty'

/**
 * 狙った型を、`frameMatch` が返しうる形に読み替える。
 * **`SAME_SHAPE` の事情を、ここだけが知っている。**
 */
export const shiftTargetOf = (form) => SAME_SHAPE.get(form)?.as ?? form

/**
 * **言い直した文が、狙った型になっているか。**
 *
 * @param said 言った文(声でも手入力でも同じ)
 * @param form 狙った型(`sentenceFrames.js` の `form`)
 * @returns `{ verdict, got, want }` —— `got` は見分けた型(無ければ null)
 */
export function judgeShift(said, form) {
  const text = String(said ?? '').trim()
  const want = shiftTargetOf(form)
  if (!text) return { verdict: SHIFT_EMPTY, got: null, want }
  const got = frameFormOf(text)
  if (!got) return { verdict: SHIFT_UNSURE, got: null, want }
  if (got === want) return { verdict: SHIFT_OK, got, want }
  return { verdict: SHIFT_OTHER, got, want }
}

/**
 * 判定を、画面に出す言葉にする。**文言もここ1か所。**
 * **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)ので、
 * `tone` を添える(画面が色と枠を決める手がかり)。
 */
export function shiftSay({ verdict, got, want }) {
  if (verdict === SHIFT_OK) return { tone: 'ok', head: 'その型で言えています', body: `「${want}」` }
  if (verdict === SHIFT_OTHER) {
    return {
      tone: 'other',
      head: 'ちがう型になっています',
      /* **「間違い」と書かない。** 英語として正しいことは多い */
      body: `いま言えているのは「${got}」です。狙いは「${want}」です。`,
    }
  }
  if (verdict === SHIFT_UNSURE) {
    return {
      tone: 'unsure',
      head: 'たしかめられませんでした',
      /* **なぜ確かめられないのかを書く。** 黙って落とさない */
      body: '型として見分けられませんでした。'
        + '言い方によっては、正しくても見分けられないことがあります。'
        + 'お手本と見くらべてください。',
    }
  }
  return { tone: 'empty', head: '', body: '' }
}

/** 場面の id から札の名前を引く。知らない id は `null`(**当てずっぽうで返さない**) */
export const shiftSceneOf = (id) => SHIFT_SCENES.find((s) => s.id === id) ?? null

/**
 * お題を**1問ずつの形**にほどく。
 *
 * 画面は「お題 → 型がいくつ」という入れ子を知らなくてよい。
 * **数え方を2通り持たない**(CLAUDE.md)ため、数えるのもここ。
 *
 * @param scene 場面で絞る(`null` ならぜんぶ)
 * @param group `sentenceFrames.js` の組で絞る(`null` ならぜんぶ)
 */
export function shiftQuestions({ scene = null, group = null } = {}) {
  const out = []
  for (const t of FRAME_SHIFTS) {
    if (scene && t.scene !== scene) continue
    for (const s of t.shifts) {
      const found = FRAME_INDEX.get(shiftTargetOf(s.form)) ?? null
      if (group && found?.groupId !== group) continue
      out.push({
        qid: `${t.id}:${s.form}`,
        id: t.id,
        scene: t.scene,
        ja: t.ja,
        base: t.base,
        form: s.form,
        ex: s.ex,
        /* **組と節は `sentenceFrames.js` から引く。書き写さない。**
           書き写すと、あちらを直した日に片方だけ古くなる */
        groupId: found?.groupId ?? null,
        groupLabel: found?.groupLabel ?? null,
        sectionNo: found?.sectionNo ?? null,
      })
    }
  }
  return out
}

/** 組の札(絞り込みに出す)。**出てくる順のまま。並べ替えない** */
export function shiftGroups() {
  const seen = new Map()
  for (const q of shiftQuestions()) {
    if (!q.groupId || seen.has(q.groupId)) continue
    seen.set(q.groupId, { id: q.groupId, label: `${q.sectionNo} ${q.groupLabel}` })
  }
  return [...seen.values()]
}

/* ------------------------------------------------------------------ *
 * 言えた型の控え(端末に持つ)
 * ------------------------------------------------------------------ */

/** localStorage の鍵。**2か所に書かない**(CLAUDE.md「鍵の名前を2か所に書かない」) */
export const SHIFT_DONE_KEY = 'eas.frameShift.done'

/** 控えを読む。**読めなくても落ちない**(private window・容量切れ) */
export function loadShiftDone() {
  try {
    const raw = globalThis.localStorage?.getItem(SHIFT_DONE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.map(String) : [])
  } catch {
    return new Set()
  }
}

/** 言えた問を1つ足して、足したあとの集合を返す。**書けなくても落ちない** */
export function saveShiftDone(done) {
  try {
    globalThis.localStorage?.setItem(SHIFT_DONE_KEY, JSON.stringify([...done]))
  } catch { /* 書けないだけ。練習は続けられる(**行き止まりを作らない**) */ }
  return done
}

/**
 * **型ごとの到達度**(次の段「型の地図」の土台)。
 *
 * 型1つに答えが2つ以上あることがあるので、**問で数えず、型で数える。**
 * 「1問でも言えたら、その型は言えた」とする。
 */
export function shiftMap(done) {
  const has = done instanceof Set ? done : new Set()
  const map = new Map()
  for (const q of shiftQuestions()) {
    const cur = map.get(q.form) ?? { form: q.form, total: 0, done: 0 }
    cur.total += 1
    if (has.has(q.qid)) cur.done += 1
    map.set(q.form, cur)
  }
  return [...map.values()]
}
