/**
 * ============================================================================
 * 教材ができたら、**裏で「支度」しておく**(2026-09 利用者の指定)
 *
 *   > 初めて再生するときの待ち時間が３０秒近くあり、これは、教材が完成した際に
 *   > バックグランドで準備する仕様にできないでしょうか？
 *   > 単語の意味についても同様の仕様にできないでしょうか？
 *
 * 【なぜ 30 秒かかっていたか】
 *   本文の音声を**1本にまとめて作る**ようにしたので(第 5.97 節)、
 *   初めて「Listen (全体)」を押したときに、**その場で 50 秒ぶんの音声を
 *   ElevenLabs に作らせていた。** 押した人はそのあいだ待つことになる。
 *
 *   語の意味も同じで、開いてから 10 語ずつ引いていた。
 *
 * 【だから、発行した瞬間に用意する】
 *   トレーナーは発行したあと、たいてい次の教材を作るか、別の画面へ行く。
 *   **その時間を支度に使う。** レッスンで開いたときには、もうできている。
 *
 * 【費用は増えない。ただし「早くなる」だけではない】
 *   作る量は同じ(どのみち初回に作られる)ので、**課金は前倒しになるだけ**
 *   である。ただし**一度も使わなかった教材のぶんは、無駄になる。**
 *   教材はスクール全体で共有して使い回す前提なので、ふつうは使われる。
 *
 * 【止まる条件を持たせる】(CLAUDE.md)
 *   ・**1度に1つだけ。** 走っているあいだは、次の支度を始めない
 *   ・**やり直さない。** 失敗したら、そこで終わり
 *     (どのみち初めて押したときに作られる)
 *   ・**同じ教材の支度は1回だけ**(`done`)
 *   ・**教材の生成(`generateJob.js`)とは別の枠。**
 *     支度のせいで「次の教材を作る」が始められないのでは、本末転倒である
 * ============================================================================
 */
import { useEffect, useState } from 'react'
import { lastWholeDetail, wholeClip } from './audioClips.js'
import { materialAudioClips } from './audioPlaylist.js'
import { prefetchGlosses } from './vocab.js'
import { PREMIUM } from './voiceTier.js'

/**
 * **過去に作った教材も、裏で順に支度する**(2026-09 利用者の指定)。
 *
 *   > 過去に作成したものも常にバックグラウンドで再生準備を
 *   > 進められないでしょうか？
 *
 * 【費用が出ていくので、見えるようにする】(CLAUDE.md「見えない費用は管理できない」)
 *   ・**1本ずつしか走らせない。** まとめて投げると、いくらかかったのか
 *     分からないうちに終わる
 *   ・**あと何本かを、いつも帯に出す**(「支度 3 / 12 本」)
 *   ・**「やめる」を、その帯に置く。** 押せばそこで止まる
 *   ・**切り替えを用意する**(左のメニューの下)。既定は自動
 *   ・**すでに音声がある教材は、ただの問い合わせで終わる**(1円もかからない)
 */
const AUTO_KEY = 'eas.prepareAll'

export function prepareAllOn() {
  try {
    const v = window.localStorage.getItem(AUTO_KEY)
    return v === null ? true : v === '1'
  } catch { return true }
}

export function setPrepareAllOn(on) {
  try { window.localStorage.setItem(AUTO_KEY, on ? '1' : '0') } catch { /* 無視 */ }
}

/** いまの支度。**画面が消えても残る**(モジュールに1つだけ) */
let task = null

/** すでに支度した教材。**同じものを二度やらない** */
const done = new Set()

const subs = new Set()
const emit = () => { for (const fn of [...subs]) fn(task) }

/** 支度の様子を見張る。返った関数を呼べば見張りをやめる */
export function watchPrepare(fn) {
  subs.add(fn)
  fn(task)
  return () => { subs.delete(fn) }
}

export const currentPrepare = () => task
export const prepareRunning = () => task?.state === 'running'

/** 出来上がりの知らせを消す(押されたとき・次の支度が始まったとき) */
export function clearPrepare() {
  if (!task || task.state === 'running') return
  task = null
  emit()
}

/**
 * やめる。**通信そのものは取り消さない**(送った1回はどのみち課金される)。
 *
 * **順番待ちも空にする。** 押した人は「もうやらないで」と言っている。
 * 1本だけ止めて次が始まったら、止めた意味がない。
 */
export function cancelPrepare() {
  queue.length = 0
  if (!task) return
  task = { ...task, cancelled: true, state: 'done' }
  emit()
}

/**
 * 支度を始める。
 *
 * @param {object} material 発行した教材(`sections` と `voiceIds` を持つ形)
 * @param {object} o
 * @param {string} o.title 画面に出す名前
 * @param {string} o.level 語の意味を引くときのレベル
 * @returns {boolean} 始めたか
 */
export function startPrepare(material, { title = '', level = 'B1' } = {}) {
  const id = String(material?.id ?? '')
  if (!id || done.has(id)) return false
  /* **走っているあいだは、順番待ちにする**(2026-09 実機)。
     以前はここで `false` を返して**そのまま捨てて**いた。
     呼ぶ側(画面)は同じ条件では二度と呼ばないので、
     **その教材の支度は永久に行われない。** 落とさずに並べる */
  if (prepareRunning()) {
    if (!queue.some((q) => q.id === id)) queue.push({ material, title, level, id })
    return true
  }

  const clips = materialAudioClips(material)
  // 本文の無い教材(ドリル・単語・フレーズ)には、支度することが無い
  const words = clips.length ? clips : bodyTextsOf(material)
  if (!words.length) return false

  done.add(id)
  const mine = `${Date.now()}`
  task = {
    id: mine, materialId: id, title, state: 'running',
    step: 0, total: 2, label: '読み上げ音声', startedAt: Date.now(),
    cancelled: false, error: null,
    /* **何ができたのかを残す。** 「支度ができました」だけでは、
       **本当に用意できたのか、素通りしたのかが分からない**
       (成功と失敗を、同じ見た目で終わらせない・CLAUDE.md) */
    audio: null, words: 0, note: null,
  }
  emit()

  const alive = () => task?.id === mine && !task.cancelled
  const step = (n, label) => {
    if (!alive()) return
    task = { ...task, step: n, label }
    emit()
  }

  ;(async () => {
    let audio = 'skip'
    let note = null
    try {
      // ① 本文の音声を1本ぶん。**押す前に作っておく**
      if (clips.length >= 2 && clips[0].tier === PREMIUM) {
        const got = await wholeClip({
          texts: clips.map((c) => c.text),
          voiceIds: clips.map((c) => c.voiceId),
        })
        /* **できたかどうかを、必ず持ち帰る。** `wholeClip` は
           駄目なときに `null` を返すだけなので、そのままだと
           「支度ができました」と出しながら**何も用意できていない** */
        audio = got ? 'ok' : 'ng'
        if (!got) note = lastWholeDetail()
      }
      if (!alive()) return

      // ② 語の意味。**開いてから引くと、レッスン中に待つことになる**
      step(1, '語の意味')
      const list = (clips.length ? clips : words).map((c) => ({ text: c.text }))
      await prefetchGlosses(list, { level })
      if (!alive()) return
      task = { ...task, state: 'done', step: 2, label: '', audio, words: list.length, note }
      emit()
    } catch (e) {
      if (!alive()) return
      /* **やり直さない。** 失敗しても、初めて押したときに作られる。
         成功と失敗を同じ見た目で終わらせないため、理由は残す */
      task = { ...task, state: 'done', audio, error: e?.message ?? String(e), note }
      emit()
    }
    /* **やめると言われていたら、次を始めない。**
       `cancelPrepare()` が順番待ちも空にしているので、
       ここは念のための二重の歯止めである */
    if (task?.id === mine && !task.cancelled) runNext()
  })()
  return true
}

/** 順番待ち。**落とさない**(落とすと、その教材は永久に支度されない) */
const queue = []

/** あと何本待っているか。**帯がそのまま出す** */
export const prepareQueued = () => queue.length

/**
 * **一覧まるごとを、順番待ちに積む**(2026-09 利用者の指定)。
 *
 * すでに支度した教材と、本文の無い教材は積まない。
 * **1本ずつしか走らない**ので、押しっぱなしにはならない。
 *
 * @returns {number} 積んだ本数
 */
export function startPrepareAll(list, { level = 'B1' } = {}) {
  if (!prepareAllOn()) return 0
  let added = 0
  for (const m of list ?? []) {
    const id = String(m?.id ?? '')
    if (!id || done.has(id) || queue.some((q) => q.id === id)) continue
    /* **入れ物が膨らまないように上限を置く。** 積みきれなかったぶんは、
       次にこの画面を開いたときに続きから積まれる */
    if (queue.length >= 50) break
    queue.push({ material: m, title: m.title ?? '', level: m.level ?? level, id })
    added += 1
  }
  if (added && !prepareRunning()) runNext()
  return added
}

/** 待っている次のものを始める。**終わってから呼ぶ** */
function runNext() {
  const next = queue.shift()
  if (!next) return
  /* すでに `done` に入っているので、そのままでは始まらない。
     並べたときに一度だけ外す */
  done.delete(next.id)
  startPrepare(next.material, { title: next.title, level: next.level })
}

/** 本文の演習が無いときのための、英文の拾い方(語の意味だけ支度する) */
function bodyTextsOf(material) {
  const out = []
  for (const sec of material?.sections ?? []) {
    for (const it of sec.items ?? []) {
      const t = String(it?.prompt_en ?? '').trim()
      if (t) out.push({ text: t })
    }
  }
  return out
}

/** 画面に出す1行。**帯の文言は1か所で決める**(2か所に書き分けない) */
export function prepareLabel(t, secs = 0) {
  if (!t) return ''
  if (t.state === 'running') {
    const what = t.label || '読み上げ音声'
    const left = queue.length ? `　ほかにあと ${queue.length} 本` : ''
    return `${t.title ? `${t.title} の` : ''}${what}を用意しています…`
      + (secs > 2 ? `(${secs} 秒)` : '') + left
  }
  /* **何ができたのかを、数で出す。**「できました」だけでは、
     本当に用意できたのか素通りしたのかが分からない */
  const head = t.title ? `${t.title} の` : ''
  if (t.error) return `${head}支度でつまずきました(初めて押したときに作られます)`
  if (t.audio === 'ng') {
    return `${head}読み上げ音声を用意できませんでした`
      + `(初めて押したときに作られます)${t.note ? ` — ${t.note}` : ''}`
  }
  const made = [
    t.audio === 'ok' ? '読み上げ音声 1本' : null,
    t.words ? `語の意味 ${t.words} か所ぶん` : null,
  ].filter(Boolean).join(' / ')
  return `${head}支度ができました${made ? `(${made})` : ''}`
}

/** 進み具合(0〜1)。**終わった段 + 0.5** で出す(動いて見えるように) */
export function prepareRatio(t) {
  if (!t) return 0
  if (t.state !== 'running') return 1
  return Math.min(1, (t.step + 0.5) / Math.max(1, t.total))
}

/**
 * いまの支度を、画面から見る。**経過秒数も一緒に数える**
 * (`useJob()` とまったく同じ作法。走っていないあいだは数えない)。
 */
export function usePrepare() {
  const [current, setCurrent] = useState(currentPrepare)
  const [secs, setSecs] = useState(0)

  useEffect(() => watchPrepare(setCurrent), [])

  const running = current?.state === 'running'
  const startedAt = current?.startedAt ?? 0
  useEffect(() => {
    if (!running) { setSecs(0); return undefined }
    const tick = () => setSecs(Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [running, startedAt])

  return { prep: current, secs }
}
