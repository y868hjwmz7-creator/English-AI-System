/**
 * **66 の型の問を作る**(2026-09 利用者の指定「画期的なトレーニングを作りたい」)。
 *
 * ============================================================================
 * 【なぜ `src/lib/` に、Supabase を引き連れずに置くのか】
 *
 *   `src/lib/*.js` の多くは Supabase と `import.meta.env` を引き連れており、
 *   **手元で一度も走らせられない**(CLAUDE.md「素の node で走らせられる形に
 *   切り出す」)。ここは**算段だけ**なので、`npm run test:shift` が
 *   素の node でそのまま走らせて確かめられる。
 *
 * 【採点はもう無い。**マイクごと消した**】(2026-09 利用者の指定)
 *
 *   > マイクで「話す」の機能は入りません。削除です。全ての型で削除してください。
 *   > そして、型のトレーニングの UI は廃止して、
 *   > quick response の UI にそのままコンテンツを移してください
 *
 *   言った文を聞き取って型を見分ける `judgeShift()` / `shiftSay()` は、
 *   **マイクのためだけに在った。** 画面ごと無くなったので、まとめて消した。
 *   **確かめてから出す**安全弁(`swapQuestions()` の中の `frameFormOf`)は
 *   残っている —— あちらは**出す前**の話で、採点ではない。
 *
 *   14 の組のカード(`shiftTrainings()`)・骨の札(`swapFrames()`)・
 *   端末の控え(`loadShiftDone()`)も、あの画面の持ちものだったので消した。
 *   覚え具合は **`qr_reviews`(0040)**に乗る(`frameQr.js`)——
 *   **数え方を2通り持たない**(CLAUDE.md)。
 *
 * 【`SAME_SHAPE` を、ここで吸収する】
 *
 *   `what 節`(②)と `What ~ is …`(③)は**同じ形**なので、
 *   `frameMatch` は見分けられないと宣言している(`SAME_SHAPE`)。
 *   狙いが `what 節` のとき、返ってくるのは `What ~ is …` である。
 *   **画面にこの事情を持ち込まない。** ここで読み替える。
 *
 * 【覚え具合は `qr_reviews` に乗せた】(2026-09・**前の決定を上書きしている**)
 *
 *   もとは「Quick Response 帳に 66 文が混ざる」ことを避けて、
 *   端末(localStorage)に持っていた。**冊が別になったので、混ざらない** ——
 *   Native Flow(690 問)がすでにそうしているのと、まったく同じ形である。
 *   置き場所は `frameQr.js` 1か所で、ここは問を作るだけになった。
 *
 * 例外は投げない。**空・null・知らない型でも落ちない。**
 * ============================================================================
 */
import { FRAME_SHIFTS } from '../data/frameShift.js'
import { SAY_BUNDLES } from '../data/frameSay.js'
import { NOUN_PHRASES } from '../data/nounPhrases.js'
import {
  SWAP_BLANK, SWAP_FRAMES, swapFrameOf, swapJa, swapSentence,
} from '../data/phraseSwap.js'
import { SUBJ_KINDS, SWAP_CLAUSES, SWAP_VERBS } from '../data/swapParts.js'
import { FRAME_INDEX, SAME_SHAPE, frameFormOf } from './frameMatch.js'

/**
 * 狙った型を、`frameMatch` が返しうる形に読み替える。
 * **`SAME_SHAPE` の事情を、ここだけが知っている。**
 */
export const shiftTargetOf = (form) => SAME_SHAPE.get(form)?.as ?? form

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

/** 名詞句を入れ替える練習の、id の頭。**2か所に書かない** */
export const SWAP_GROUP = 'swap'

/** 束から作った言い換えの、id の頭。**2か所に書かない** */
export const SAY_GROUP = 'say'

/**
 * **言い換えの束 → 1問ずつ**(2026-09 利用者の指定
 * 「日本語→英語 / 言い換え ともに型毎の問題数を大幅に増やしてください」)。
 *
 * 内容を1つ書けば、そこに乗る**型の数 × 肉の数**だけ問ができる
 * (`swapQuestions()` とまったく同じ掛け算)。
 *
 * **機械で確かめてから出す。** 組み立てた英文が狙いの型に見えないものは
 * **はじめから出さない** —— ここがこの練習の安全弁である。
 *
 * **日本語は型をまたいで同じ。** それが「言い換え」だからである
 * (どの型で言うかは、ヒントと型の絞り込みが伝える)。
 */
export function sayQuestions() {
  const out = []
  for (const b of SAY_BUNDLES) {
    /* **肉は `swapParts.js` から借りる。** 束だけの肉は `own` に書いてある */
    const meat = b.list === 'own' ? (b.own ?? [])
      : b.list === 'clause' ? SWAP_CLAUSES
      : b.list === 'noun' ? NOUN_PHRASES.map((x) => ({ en: x.p, ja: x.n }))
      : SWAP_VERBS
    for (const say of b.says ?? []) {
      const want = shiftTargetOf(say.form)
      for (const x of meat) {
        /* **原形か ~ing か。** 同じ動詞の別の形を、束の側が選ぶ ——
           `S involves ~ing` と `S requires 人 to do` は**同じ内容**だが、
           入る形が違う(**~ing を機械で作らない**・`swapParts.js`) */
        const filler = b.list === 'verb' ? (say.ing ? x.ing : x.bare) : x.en
        if (!filler) continue
        /* **文の頭に来た肉は、大文字にする。**
           `動名詞` の骨は `___ is important.` なので、
           そのままだと `working from home is important.` と小文字で始まる。
           **見分けはできてしまうので、検証では捕まらない** —— 実物を読んで
           初めて分かる類の崩れである(まず測る・CLAUDE.md) */
        const head = String(say.en).startsWith(SWAP_BLANK)
        const put = head ? filler.charAt(0).toUpperCase() + filler.slice(1) : filler
        const en = String(say.en).replace(SWAP_BLANK, put)
        /* **確かめてから出す。** ここが、この練習の安全弁である */
        if (frameFormOf(en) !== want) continue
        out.push({
          qid: `${SAY_GROUP}:${b.id}:${say.form}:${filler}`,
          id: b.id,
          scene: null,
          ja: String(b.ja).replace(SWAP_BLANK, x.ja),
          form: say.form,
          ex: en,
          groupId: SAY_GROUP,
        })
      }
    }
  }
  return out
}

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

/**
 * **日本語 → 英語の問**(2026-09 利用者の指定
 * 「5文だけでなく、そこを言い換える練習ができるようにしたい」)。
 *
 * 骨(`SWAP_FRAMES`)1つに、席の種類に合う肉を順に入れる。
 *
 * **機械で確かめてから出す。** 入れてみて狙いの型に見えない組み合わせは
 * **はじめから出さない** —— 出して「ちがう型です」と言ったら、
 * 正しく言えた人に嘘をつくことになる(この道具の根っこの決まり)。
 * 一覧を手で書いていないので、**部品を足したときも自動で付いてくる。**
 *
 * **骨の札(`GIVE`)は消した** —— 画面に骨を見せていたのは、
 * 廃止した型シフトの UI だけだった(2026-09 利用者の指定)。
 *
 * @param frame 骨の id(`null` なら先頭の骨)
 */
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
      /** 骨そのもの(`___` 入り)。**どこから作った問かが分かる** */
      base: f.en,
      form: f.form,
      /** 骨に入れた言葉。**検証が「本当に入っているか」を見る** */
      phrase: x.en,
      ex: en,
      groupId: SWAP_GROUP,
      groupLabel: '入れ替えて数をこなす',
      sectionNo: '④',
    })
  }
  return out
}
