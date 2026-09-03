/**
 * 教材の生成を、**画面から切り離して走らせる**(2026-09 利用者の指定)。
 *
 *   > 教材の作成中に別のところに飛んでもバックグラウンドで作業が続くように
 *   > してください。止まるのはキャンセルボタンを作成し、それを押したときのみに
 *   > してください。バックグラウンドでの作成が終わったら音やポップアップでの
 *   > 通知してください。
 *
 * 【なぜ画面の中に置けないのか】
 *   生成は React の部品(`MaterialForm`)の中で `await` していた。
 *   別の画面へ移ると**部品ごと消える**ので、返ってきた下書きの行き場が
 *   無くなり、待った時間(記事なら3分近い)がまるごと無駄になっていた。
 *   通信そのものは続いているのに、**受け取る人がいなくなる**のである。
 *
 *   だから仕事の状態を**この書類(モジュール)に1つだけ**置く。
 *   ここは画面が消えても残る。部品は「いまどうなっているか」を
 *   見に来るだけにする。
 *
 * 【1度に1つだけ】
 *   同時に2本走らせない。**費用が2倍になる**うえ、どちらの下書きが
 *   画面に入るのか決められない。走っているあいだは、始める側が断る。
 *
 * 【止まるのはキャンセルだけ】
 *   画面を離れても、閉じても止まらない。`cancel()` を押したときだけ
 *   `cancelled` が立ち、生成の各段のあいだで止まる。
 *   **通信そのものは取り消さない。** 送ってしまった1回はどのみち
 *   課金されているので、次の段へ進まないことで止める。
 *
 * 【終わったら知らせる】
 *   `done` になったら、画面側(`App.jsx`)が音とポップアップで知らせる。
 *   **知らせるのは1回だけ。** `seen` を立てて二度出さない。
 */

import { useEffect, useState } from 'react'

/**
 * いまの仕事。無ければ `null`。
 *
 * @property {string}  id        仕事ごとの番号
 * @property {string}  title     何を作っているか(画面に出す)
 * @property {number}  done      いくつ終わったか
 * @property {number}  total     いくつあるか
 * @property {string}  label     いまの段の名前(「内容の理解」など)
 * @property {number}  startedAt 始めた時刻(経過秒数を出すため)
 * @property {boolean} cancelled キャンセルされたか
 * @property {string}  state     `'running' | 'done' | 'error' | 'cancelled'`
 * @property {object}  result    できあがったもの(画面が受け取るまで持つ)
 * @property {string}  error     失敗の理由(日本語)
 * @property {boolean} seen      終わったことを知らせ終えたか
 */
let job = null

const subs = new Set()
const emit = () => { for (const fn of [...subs]) fn(job) }

/** 変化を見張る。**返ってくる関数を呼ぶと、見張りをやめる** */
export function watchJob(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

/**
 * いまの仕事を、画面から見る。**経過秒数も一緒に数える。**
 *
 * 走っているあいだは1秒ごとに数え直す。**止まっているあいだは数えない**
 * (仕事が無いのに毎秒描き直すと、そのぶん無駄になる)。
 *
 * @returns {{job: object|null, secs: number}}
 */
export function useJob() {
  const [current, setCurrent] = useState(currentJob)
  const [secs, setSecs] = useState(0)

  useEffect(() => watchJob(setCurrent), [])

  const running = current?.state === 'running'
  const startedAt = current?.startedAt ?? 0
  useEffect(() => {
    if (!running) { setSecs(0); return undefined }
    const tick = () => setSecs(Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [running, startedAt])

  return { job: current, secs }
}

/**
 * 進み具合の文言。**1か所に置く**(帯と、作る画面のボタンの両方が使う)。
 * 3か所に書き分けると、必ずどれかが古くなる(「用意しています…」と同じ作法)。
 */
export const jobProgressLabel = (j, secs = 0, { showLabel = true } = {}) => {
  if (!j) return ''
  // **名前を二度書かない。** 帯はすでに「記事を作っています…」と出しているので、
  // そこへ `記事(1/3)` を続けると「記事…記事」になる(2026-09 実測)
  const name = showLabel && j.label && j.label !== j.title ? j.label : ''
  return `${name}(${Math.min(j.done + 1, j.total)}/${j.total})${secs ? ` ${secs}秒` : ''}`
}

/**
 * 進み具合を 0〜1 で返す。**まだ終わっていない段は、半分だけ進んだものとみなす。**
 * `done` は「終わった段の数」なので、そのままだと最初の段のあいだ
 * ずっと 0 のままになり、動いていないように見える。
 */
export function jobRatio(j) {
  if (!j || !j.total) return 0
  if (j.state === 'done') return 1
  return Math.min((j.done + 0.5) / j.total, 0.98)
}

/** いまの仕事(無ければ null) */
export const currentJob = () => job

/** 走っている最中か */
export const jobRunning = () => job?.state === 'running'

/** いま走っている仕事を止める。**押したときだけ止まる** */
export function cancelJob() {
  if (!job || job.state !== 'running') return
  job = { ...job, cancelled: true, state: 'cancelled' }
  emit()
}

/** 終わったことを知らせ終えた印(二度出さない) */
export function markJobSeen() {
  if (!job || job.seen) return
  job = { ...job, seen: true }
  emit()
}

/** 仕事を片づける(結果を受け取ったあと) */
export function clearJob() {
  job = null
  emit()
}

/**
 * できあがったものを受け取る。**受け取ったら仕事は消える。**
 * 同じ下書きを2回入れないため。
 */
export function takeJobResult() {
  if (job?.state !== 'done') return null
  const { result } = job
  job = null
  emit()
  return result
}

/**
 * 仕事を始める。
 *
 * @param {object} opts
 * @param {string} opts.title 何を作っているか(画面に出す)
 * @param {number} opts.total 段の数
 * @param {Function} opts.run
 *   `({ step, cancelled })` を受け取る。
 *   ・`step(done, label)` … 進み具合を伝える
 *   ・`cancelled()`       … キャンセルされたら true。**各段のあいだで見る**
 *   返した値が `result` になる。投げた例外は `error` になる
 * @returns {boolean} 始められたか(すでに走っていれば false)
 */
export function startJob({ title, total, run }) {
  if (jobRunning()) return false
  const id = `${Date.now()}`
  job = {
    id, title, done: 0, total, label: '', startedAt: Date.now(),
    cancelled: false, state: 'running', result: null, error: null, seen: false,
  }
  emit()

  const step = (done, label) => {
    // **終わった仕事の進み具合は書き換えない**(取り消したあとに来る)
    if (job?.id !== id || job.state !== 'running') return
    job = { ...job, done, label }
    emit()
  }
  const cancelled = () => job?.id !== id || job.cancelled

  ;(async () => {
    try {
      const result = await run({ step, cancelled })
      if (job?.id !== id) return           // すでに片づけられている
      if (job.cancelled) return            // キャンセル済み。結果は捨てる
      job = { ...job, state: 'done', result, done: job.total }
      emit()
    } catch (e) {
      if (job?.id !== id || job.cancelled) return
      job = { ...job, state: 'error', error: e?.message ?? String(e) }
      emit()
    }
  })()
  return true
}
