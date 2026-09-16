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
import { NOUN_PHRASES } from '../data/nounPhrases.js'
import { SWAP_FRAMES, swapFrameOf, swapJa, swapSentence } from '../data/phraseSwap.js'
import { SUBJ_KINDS, SWAP_CLAUSES, SWAP_VERBS } from '../data/swapParts.js'
import { FRAME_SECTIONS } from '../data/sentenceFrames.js'
import { moveOfGroup } from '../data/frameTraining.js'
import { FRAME_INDEX, SAME_SHAPE, frameFormOf } from './frameMatch.js'

/** 判定の4つ。**文字列を画面に書き写さない**(`===` で比べるのはここだけ) */
export const SHIFT_OK = 'ok'
export const SHIFT_OTHER = 'other'
export const SHIFT_UNSURE = 'unsure'
export const SHIFT_EMPTY = 'empty'
/** 型は合っているが、入れるはずの名詞句が入っていない(入れ替えの練習だけ) */
export const SHIFT_NOPHRASE = 'nophrase'

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
export function judgeShift(said, form, { phrase = null } = {}) {
  const text = String(said ?? '').trim()
  const want = shiftTargetOf(form)
  if (!text) return { verdict: SHIFT_EMPTY, got: null, want, phrase }
  const got = frameFormOf(text)
  if (!got) return { verdict: SHIFT_UNSURE, got: null, want, phrase }
  if (got !== want) return { verdict: SHIFT_OTHER, got, want, phrase }
  /* **名詞句を入れ替える練習だけ、もう1つ見る。**
     骨が合っていても、入れるはずの名詞句が入っていなければ
     その練習をしたことにならない。**大文字小文字は見ない**
     (文頭に来ると `A lack of …` になる) */
  if (phrase && !text.toLowerCase().includes(String(phrase).toLowerCase())) {
    return { verdict: SHIFT_NOPHRASE, got, want, phrase }
  }
  return { verdict: SHIFT_OK, got, want, phrase }
}

/**
 * 判定を、画面に出す言葉にする。**文言もここ1か所。**
 * **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)ので、
 * `tone` を添える(画面が色と枠を決める手がかり)。
 */
export function shiftSay({ verdict, got, want, phrase = null }) {
  if (verdict === SHIFT_OK) return { tone: 'ok', head: 'その型で言えています', body: `「${want}」` }
  if (verdict === SHIFT_OTHER) {
    return {
      tone: 'other',
      head: 'ちがう型になっています',
      /* **「間違い」と書かない。** 英語として正しいことは多い */
      body: `いま言えているのは「${got}」です。狙いは「${want}」です。`,
    }
  }
  if (verdict === SHIFT_NOPHRASE) {
    return {
      tone: 'nophrase',
      head: '型は合っています。名詞句が入っていません',
      /* **✕ にしない。** 骨は言えているのだから、あと1つである */
      body: `この練習で入れるのは「${phrase}」です。`
        + 'もう一度、そこを入れて言ってみてください。',
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
      /* **組は、書いたほうの型から引く。** 読み替え先(`shiftTargetOf`)から
         引くと、`what 節`(②)の問が `What ~ is …`(③)の組に入ってしまう ——
         実際そうなっており、② が 5 問・③焦点が 6 問になっていた(2026-09)。
         **読み替えは採点のためだけのもの**で、どのカテゴリーの練習かとは別である */
      const found = FRAME_INDEX.get(s.form) ?? null
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

/**
 * **カテゴリーごとのトレーニングの一覧**(2026-09 利用者の指定
 * 「これら 66 の型をカテゴリー別に分け、それぞれを活用するための
 * トレーニングを作りたい」)。
 *
 * **並びは `sentenceFrames.js` のまま。** 問から数え上げると、
 * お題を書いた順に並んでしまう —— 型の一覧は
 * **一覧を勝手に並べ替えない**(`.claude/rules/common.md`)。
 *
 * **問が1問も無い組は出さない。** 出すと、開いた先が空になる
 * (**行き止まりを作らない**)。いまは 14 組すべてに問がある。
 *
 * @param done 言えた問の id(`Set`)。渡さなければ 0 として数える
 */
export function shiftTrainings(done = null) {
  const has = done instanceof Set ? done : new Set()
  const qs = shiftQuestions()
  const out = []
  for (const sec of FRAME_SECTIONS) {
    for (const g of sec.groups) {
      const mine = qs.filter((q) => q.groupId === g.id)
      if (!mine.length) continue
      out.push({
        id: g.id,
        no: sec.no,
        sectionLabel: sec.label,
        label: g.label,
        /* **やることは `frameTraining.js` 1か所。** 画面で書き分けない */
        move: moveOfGroup(g.id),
        /* **その組に入っている型の名前。** 一覧のカードに出す ——
           ①の7組は「やること」が同じなので、**名前だけが手がかり**になる
           (同じ一言を7回くり返さない・**同じことをするものを2つ見せない**)。
           **並びは `sentenceFrames.js` のまま**(問を書いた順ではない) */
        forms: g.rows.map((r) => r.form).filter((f) => mine.some((q) => q.form === f)),
        total: mine.length,
        done: mine.filter((q) => has.has(q.qid)).length,
      })
    }
  }
  /* **④ 名詞句を入れ替える**(2026-09 利用者の指定)。
     `sentenceFrames.js` の組ではないので、**いちばん後ろに足す** ——
     冊と同じで、**前へ割り込ませない**(docs/notes/22 の決まり)。
     数は骨ごとに変わるので、**先頭の骨で数えず、ぜんぶ足す** */
  const swapAll = SWAP_FRAMES.flatMap((f) => swapQuestions({ frame: f.id }))
  out.push({
    id: SWAP_GROUP,
    no: '④',
    sectionLabel: '入れ替えて数をこなす(骨は固定、肉だけ変える)',
    label: '入れ替えて数をこなす',
    move: moveOfGroup(SWAP_GROUP),
    /* **66 本ぶんの名前は並べても読めない。** 覆っている数を出す */
    forms: [`66 型ぜんぶに骨があります`],
    total: swapAll.length,
    done: swapAll.filter((q) => has.has(q.qid)).length,
  })
  return out
}

/** 名詞句を入れ替える練習の、id の頭。**2か所に書かない** */
export const SWAP_GROUP = 'swap'

/**
 * **名詞句を入れ替える練習の問**(2026-09 利用者の指定
 * 「5文だけでなく、そこを言い換える練習ができるようにしたい」)。
 *
 * 骨(`SWAP_FRAMES`)1つに、名詞句 80 件を順に入れる。
 *
 * **機械で確かめてから出す。** 入れてみて狙いの型に見えない組み合わせは
 * **はじめから出さない** —— 出して「ちがう型です」と言ったら、
 * 正しく言えた人に嘘をつくことになる(この道具の根っこの決まり)。
 * 一覧を手で書いていないので、**名詞句を足したときも自動で付いてくる。**
 *
 * @param frame 骨の id(`null` なら先頭の骨)
 */
/**
 * **骨に入れる肉**を、席の種類(`slot`)から引く。
 *
 * **席の種類ごとに部品表が1つ。** 骨ごとに書き分けない ——
 * 書き分けると、部品を足したときに**足した先だけが増える。**
 */
export function swapFillers(f) {
  if (!f) return []
  if (f.slot === 'own') return (f.own ?? []).map((x) => ({ en: x.en, ja: x.ja }))
  if (f.slot === 'subj') {
    /* **性格の合う主語だけ**(`The price helps us …` を出さないため) */
    return (SUBJ_KINDS.get(f.pick) ?? []).map((x) => ({ en: x.en, ja: x.ja }))
  }
  if (f.slot === 'vp') return SWAP_VERBS.map((x) => ({ en: x.bare, ja: x.ja }))
  if (f.slot === 'ving') return SWAP_VERBS.map((x) => ({ en: x.ing, ja: x.ja }))
  if (f.slot === 'clause') return SWAP_CLAUSES.map((x) => ({ en: x.en, ja: x.ja }))
  return NOUN_PHRASES.map((x) => ({ en: x.p, ja: x.n }))
}

/** 席の種類ごとに、渡すものの札を変える。**文言はここ1か所** */
const GIVE = {
  subj: '骨(ここに主語を入れる)',
  vp: '骨(ここに動詞のかたまりを入れる)',
  ving: '骨(ここに動詞の ~ing を入れる)',
  np: '骨(ここに名詞句を入れる)',
  clause: '骨(ここに短い文を入れる)',
  own: '骨(ここに言葉を入れる)',
}

export function swapQuestions({ frame = null } = {}) {
  const f = swapFrameOf(frame) ?? SWAP_FRAMES[0]
  const want = shiftTargetOf(f.form)
  const out = []
  for (const x of swapFillers(f)) {
    const en = swapSentence(f, x.en)
    /* **確かめてから出す。** ここが、この練習の安全弁である */
    if (frameFormOf(en) !== want) continue
    out.push({
      qid: `${SWAP_GROUP}:${f.id}:${x.en}`,
      id: f.id,
      scene: null,
      ja: swapJa(f, x.ja),
      /* **渡すのは骨。** 「もとの言い方」ではないので、呼ぶ側が札を変える */
      base: f.en,
      give: GIVE[f.slot] ?? GIVE.own,
      form: f.form,
      /* **入れるはずの言葉。** 判定がもう1つ見る */
      phrase: x.en,
      ex: en,
      groupId: SWAP_GROUP,
      groupLabel: '入れ替えて数をこなす',
      sectionNo: '④',
    })
  }
  return out
}

/**
 * 骨の札(入れ替えの練習で出す)。**出てくる順のまま。並べ替えない。**
 *
 * **問が1つも出ない骨は出さない**(行き止まりを作らない)。
 * 組も添えるので、画面は 66 本を組ごとにまとめて出せる。
 */
export const swapFrames = () => SWAP_FRAMES
  .map((f) => {
    const found = FRAME_INDEX.get(shiftTargetOf(f.form)) ?? FRAME_INDEX.get(f.form) ?? null
    return {
      id: f.id,
      label: f.form,
      groupId: found?.groupId ?? null,
      groupLabel: found ? `${found.sectionNo} ${found.groupLabel}` : '',
      count: swapQuestions({ frame: f.id }).length,
    }
  })
  .filter((f) => f.count > 0)

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
