/**
 * **段1「見分ける」** —— 文を見て、どの型かを4択で当てる(2026-09 利用者の指定)。
 *
 *   > それぞれの型でどのように量をこなし……
 *
 * ============================================================================
 * 【なぜ「見分ける」が要るのか】
 *
 *   型シフト(言い直す)は1問 20 秒かかる。**量をこなす受け皿にならない。**
 *   見分けるだけなら**1問3秒**で、移動中でも押せる。
 *   そして「その型だと気づける」ことは、「その型で言える」ことの手前にある。
 *
 * 【素材を1文も書いていない】
 *
 *   すでにある文を、そのまま使う ——
 *   66 型の見本(`sentenceFrames.js`)・型シフトの答え(`frameShift.js`)・
 *   名詞句を入れ替えた文(`phraseSwap.js`)。
 *   **答えは機械が知っている**(`frameMatch.js`)ので、正解を書く必要もない。
 *
 *   **素材を足すと、この段の問も自動で増える。**
 *
 * 【型ごとに上限を置く理由】(**数えて分かったこと**)
 *
 *   生の文は 660 あるが、**7つの型に 80 文ずつ偏っている**
 *   (名詞句の入れ替えが、その7つの骨で作られているため)。
 *   そのまま混ぜると、**同じ型ばかり出る。**
 *   だから**型ごとに最大 `QUIZ_MAX_PER_FORM` 問**にそろえる。
 *   いまは **113 問 / 65 型**になる。
 *
 * 【見分けられない型は、答えにも選択肢にも出さない】
 *
 *   `what 節`(②)と `What ~ is …`(③)は**同じ形**である
 *   (`SAME_SHAPE`)。どちらも正しい問になってしまうので、
 *   **宣言してあるほうを丸ごと外す。** 65 型になるのはこのためである。
 *
 * 【まぎらわしい選択肢を出す】
 *
 *   でたらめな3つを混ぜると、**組さえ分かれば当たる。**
 *   だから**同じ組**から選ぶ(させる / させない / 要る…)。
 *   足りなければ同じ節、それでも足りなければ全体から補う。
 *
 * 【並びは、問ごとに決まる】
 *
 *   毎回 `Math.random()` で混ぜると、**描き直すたびに選択肢が動く**
 *   (押そうとした先が変わる)。問の id から決めるので、
 *   **同じ問なら必ず同じ並び**になる。
 *
 * 例外は投げない。**空・null でも落ちない。**
 * ============================================================================
 */
import { FRAME_SECTIONS } from '../data/sentenceFrames.js'
import { FRAME_SHIFTS } from '../data/frameShift.js'
import { FRAME_INDEX, SAME_SHAPE, frameFormOf } from './frameMatch.js'
import { swapFrames, swapQuestions } from './frameShift.js'
import { moveOfGroup } from '../data/frameTraining.js'

/** 見分ける練習の id の頭。**2か所に書かない** */
export const QUIZ_GROUP = 'quiz'

/** 型ごとに、何問まで出すか。**偏りをここでそろえる** */
export const QUIZ_MAX_PER_FORM = 3

/** 選択肢の数 */
export const QUIZ_CHOICES = 4

/** **見分けられないと宣言してある型**(`what 節`)。答えにも選択肢にも出さない */
const HIDDEN = new Set(SAME_SHAPE.keys())

/** 問の id から決まる数。**同じ問なら必ず同じ数**(描き直しても動かない) */
function seedOf(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** 種から決まる並べ替え。**`Math.random()` を使わない** */
function shuffled(list, seed) {
  const out = list.slice()
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 型 → その型の文。**機械で確かめた文だけ**を集める */
function byForm() {
  const map = new Map()
  const add = (en, form) => {
    const text = String(en ?? '').trim()
    if (!text || HIDDEN.has(form)) return
    /* **確かめてから入れる。** 確かめられない文を出して
       「ちがいます」と言ったら、正しく選んだ人に嘘をつくことになる */
    if (frameFormOf(text) !== form) return
    if (!map.has(form)) map.set(form, [])
    const mine = map.get(form)
    if (!mine.includes(text)) mine.push(text)
  }
  for (const sec of FRAME_SECTIONS) for (const g of sec.groups) for (const r of g.rows) add(r.ex, r.form)
  for (const t of FRAME_SHIFTS) for (const x of t.shifts) add(x.ex, x.form)
  for (const f of swapFrames()) for (const q of swapQuestions({ frame: f.id })) add(q.ex, q.form)
  return map
}

/**
 * **見分ける問**を組み立てる。
 *
 * @param group 型の組で絞る(`null` ならぜんぶ)
 * @param max   型ごとの上限(既定 `QUIZ_MAX_PER_FORM`)
 */
export function quizQuestions({ group = null, max = QUIZ_MAX_PER_FORM } = {}) {
  const mine = byForm()
  /** 選択肢に出せる型。**組と節が分かるものだけ** */
  const all = [...mine.keys()].map((f) => FRAME_INDEX.get(f)).filter(Boolean)
  const out = []
  /* **並びは `sentenceFrames.js` のまま**(型の一覧を並べ替えない) */
  for (const sec of FRAME_SECTIONS) {
    for (const g of sec.groups) {
      if (group && g.id !== group) continue
      for (const r of g.rows) {
        const list = mine.get(r.form)
        if (!list) continue
        const here = FRAME_INDEX.get(r.form)
        /* まぎらわしい順に3つの受け皿を作る。**まとめて混ぜない** ——
           まとめて混ぜて上から取ると、同じ組に十分あっても
           よその組から出てしまう(実際そうなっており、
           **同じ組から出せていたのは 113 問中 16 問だけ**だった・2026-09)。
           **同じ組を使い切ってから、次の受け皿へ移る** */
        const sameG = all.filter((x) => x.form !== r.form && x.groupId === here.groupId)
        const sameS = all.filter((x) => x.form !== r.form && x.groupId !== here.groupId
          && x.sectionId === here.sectionId)
        const rest = all.filter((x) => x.form !== r.form && x.sectionId !== here.sectionId)
        list.slice(0, Math.max(1, max)).forEach((en, i) => {
          const qid = `${QUIZ_GROUP}:${r.form}:${i}`
          const seed = seedOf(qid)
          /* **同じ問なら、まぎらわしい3つも並びも動かない** */
          const need = QUIZ_CHOICES - 1
          const pool = shuffled(sameG, seed).slice(0, need)
          if (pool.length < need) pool.push(...shuffled(sameS, seed + 2).slice(0, need - pool.length))
          if (pool.length < need) pool.push(...shuffled(rest, seed + 3).slice(0, need - pool.length))
          const wrong = pool.map((x) => x.form)
          out.push({
            qid,
            en,
            form: r.form,
            groupId: here.groupId,
            groupLabel: here.groupLabel,
            sectionNo: here.sectionNo,
            choices: shuffled([r.form, ...wrong], seed + 1),
          })
        })
      }
    }
  }
  return out
}

/** 型の組の札。**問がある組だけ**(行き止まりを作らない) */
export function quizGroups() {
  const seen = new Map()
  for (const q of quizQuestions()) {
    if (seen.has(q.groupId)) continue
    seen.set(q.groupId, { id: q.groupId, label: `${q.sectionNo} ${q.groupLabel}` })
  }
  return [...seen.values()]
}

/**
 * 選んだ型が合っているか。
 *
 * **判断はここ1か所。** 画面の中で `picked === q.form` と書かない
 * (置く場所の数だけ食い違う・CLAUDE.md)。
 */
export function judgeQuiz(picked, question) {
  const want = question?.form ?? null
  if (!picked || !want) return { right: false, answered: false, want }
  return { right: picked === want, answered: true, want }
}

/**
 * **トレーニングの一覧に出す1枚。**
 *
 * `shiftTrainings()` と同じ形にそろえてある(画面が書き分けないため)。
 * **あちらに足さない** —— `frameShift.js` からここを読むと、
 * 読み込みが輪になる(`frameQuiz` → `frameShift` → `frameQuiz`)。
 *
 * @param done 言えた問の id(`Set`)
 */
export function quizTraining(done = null) {
  const has = done instanceof Set ? done : new Set()
  const qs = quizQuestions()
  return {
    id: QUIZ_GROUP,
    no: '⑤',
    sectionLabel: '見分ける(1問3秒・いちばん速い)',
    label: '見分ける',
    move: moveOfGroup(QUIZ_GROUP),
    /* **札に出すのは型の名前ではなく、覆っている数。**
       65 型ぶんあるので、名前を並べても読めない */
    forms: [`${new Set(qs.map((q) => q.form)).size} 型を覆っています`],
    total: qs.length,
    done: qs.filter((q) => has.has(q.qid)).length,
  }
}
