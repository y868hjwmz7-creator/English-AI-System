/**
 * ゲストに関するファイルの置き場(0031)。
 *
 * 2026-09 利用者の指定:
 *   > 各ゲストの情報内に、ゲストに関するファイルをアップロードできる
 *   > ようにできないですか?
 *
 * 会社からもらった英文メール、受けたテストの結果、宿題の写真。
 * いまはメールや LINE で送り合っていて、**どこに何があるか分からなくなる。**
 * ゲストのカードの中に置ければ、次のレッスンで必ず見つかる。
 *
 * 【誰に見えるかを、画面にも書く】
 *   見えるのは**本人と、いま担当しているトレーナー(と管理者)だけ**である。
 *   守っているのは SQL(0031 の RLS)だが、**それは利用者には見えない。**
 *   ファイルを置く人が不安なままでは、置いてもらえない。
 *
 * 【開くときに、そのつど期限付きの URL を作る】
 *   置き場は非公開なので、一覧に URL を持たせられない
 *   (持たせても、開いたままにしているうちに期限が切れる)。
 *   押した瞬間に作って、新しい窓で開く。
 *
 * 【消すのは2段】
 *   1回目で「本当に消す」に変わる。**押し間違いで消えない。**
 *   教材の練習の記録を消すボタンと同じ作法。
 */
import { useEffect, useRef, useState } from 'react'
import {
  MAX_FILE_BYTES, checkFile, deleteLearnerFile, fileUrl,
  listLearnerFiles, prettySize, uploadLearnerFile,
} from '../lib/learnerFiles.js'
import { getSession } from '../lib/auth.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { FileIcon, UploadIcon } from './Icons.jsx'

/** 「田内さん さん」にならないようにする(`WordbookAdd` と同じ作法) */
const honor = (name) => {
  const n = String(name ?? '').trim()
  if (!n) return ''
  return /(さん|様|先生)$/.test(n) ? n : `${n} さん`
}

const stamp = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function LearnerFiles({ learnerId, learnerName = '' }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [picked, setPicked] = useState(null)
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const [confirmId, setConfirmId] = useState(null)
  const [me, setMe] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    getSession().then((s) => setMe(s?.user?.id ?? null))
  }, [])

  const reload = async () => {
    setLoading(true)
    const { data, error: e } = await listLearnerFiles(learnerId)
    setRows(data)
    setError(e)
    setLoading(false)
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    listLearnerFiles(learnerId).then(({ data, error: e }) => {
      if (!alive) return
      setRows(data)
      setError(e)
      setLoading(false)
    })
    return () => { alive = false }
  }, [learnerId])

  /* **経過秒数を出す。** 動いているのか固まったのか分からないと、
     利用者は同じボタンを何度も押す(CLAUDE.md) */
  useEffect(() => {
    if (!busy) { setSecs(0); return undefined }
    const t = setInterval(() => setSecs((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  const pick = (e) => {
    const f = e.target.files?.[0] ?? null
    setNote(null)
    setError(null)
    if (!f) { setPicked(null); return }
    const bad = checkFile(f)
    if (bad) { setPicked(null); setError(`${f.name} は置けません。${bad}`); return }
    setPicked(f)
  }

  const send = async () => {
    if (!picked) return
    setBusy(true)
    setNote(null)
    setError(null)
    const { data, error: e } = await uploadLearnerFile({
      learnerId, file: picked, note: memo, uploadedBy: me,
    })
    setBusy(false)
    if (e) { setError(e); return }
    // **何が置けたのかを、押した場所のすぐ下に出す**(CLAUDE.md)
    setNote(`「${data?.name ?? picked.name}」(${prettySize(picked.size)})を置きました。`)
    setPicked(null)
    setMemo('')
    if (inputRef.current) inputRef.current.value = ''
    reload()
  }

  const open = async (row, download = false) => {
    setError(null)
    const { url, error: e } = await fileUrl(row.path, { download })
    if (e || !url) { setError(e ?? '開けませんでした'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const remove = async (row) => {
    if (confirmId !== row.id) { setConfirmId(row.id); return }
    setConfirmId(null)
    setError(null)
    const { error: e } = await deleteLearnerFile(row)
    if (e) { setError(e); return }
    setNote(`「${row.name}」を消しました。`)
    reload()
  }

  /* 「Airi さんの本人」にならないようにする。
     名前があれば「Airi さん本人」、無ければ「ご本人」 */
  const who = learnerName ? `${honor(learnerName)}本人` : 'ご本人'

  if (!isSupabaseConfigured) {
    return (
      <section className="card">
        <h3 className="card-title">ファイル</h3>
        <p className="notice">
          Supabase に接続していないため、ファイルは置けません。
        </p>
      </section>
    )
  }

  return (
    <section className="card lfiles">
      <h3 className="card-title">
        <FileIcon />
        ファイル
      </h3>

      {/* **誰に見えるのかを、はっきり書く。** SQL で守っていることは
          利用者には見えない。不安なままでは置いてもらえない */}
      <p className="field-hint lfiles-who">
        ここに置いたものが見えるのは、<strong>{who}と、いま担当している
        トレーナー</strong>だけです。ほかのゲストからは、あることさえ見えません。
      </p>

      <div className="lfiles-add">
        {/* **「Choose File」を出さない。** ファイルを選ぶ欄の文字は
            ブラウザが決めるので英語のままになり、しかも端末ごとに違う。
            欄そのものは隠し(キーボードでは選べるように残す)、
            ふだんのボタンと同じ見た目の札から開く */}
        <p className="field-label" id="lfiles-pick-label">
          置くファイル
          <span className="field-hint">
            PDF・写真・文書・音声。1つ {prettySize(MAX_FILE_BYTES)} まで
          </span>
        </p>
        <div className="lfiles-pick">
          <input ref={inputRef} id="lfiles-input" type="file"
                 className="sr-only" onChange={pick}
                 aria-labelledby="lfiles-pick-label" />
          <label htmlFor="lfiles-input" className="btn btn--ghost">
            ファイルを選ぶ
          </label>
          <span className="lfiles-picked">
            {picked ? `${picked.name}(${prettySize(picked.size)})` : 'まだ選ばれていません'}
          </span>
        </div>

        <label className="field">
          <span>
            メモ
            <span className="field-hint">任意。何のファイルかを一言で</span>
          </span>
          <input type="text" value={memo} placeholder="8月のTOEICの結果"
                 onChange={(e) => setMemo(e.target.value)} />
        </label>

        <div className="btn-row">
          <button type="button" className="btn btn--primary"
                  disabled={!picked || busy} onClick={send}>
            <UploadIcon />
            {busy ? `置いています…(${secs}秒)` : 'このファイルを置く'}
          </button>
        </div>

        {/* **押したボタンのすぐ下に出す。** 画面の下に出すと、
            スマホでは見えず「何も起きずにボタンが戻る」ように見える */}
        {note && <p className="notice notice--ok">{note}</p>}
        {error && <p className="notice notice--error">{error}</p>}
      </div>

      {loading && <p className="muted">読み込んでいます…</p>}

      {!loading && rows.length === 0 && (
        <p className="muted">まだファイルはありません。</p>
      )}

      {rows.length > 0 && (
        <ul className="lfiles-list">
          {rows.map((row) => (
            <li key={row.id} className="lfiles-item">
              <div className="lfiles-main">
                <p className="lfiles-name">{row.name}</p>
                <p className="lfiles-meta">
                  <span>{stamp(row.created_at)}</span>
                  <span>{prettySize(row.size)}</span>
                  {row.uploaded_by === row.learner_id && <span>ゲストが置いた</span>}
                </p>
                {row.note && <p className="lfiles-note">{row.note}</p>}
              </div>
              <div className="lfiles-tools">
                <button type="button" className="btn btn--ghost btn--small"
                        onClick={() => open(row)}>開く</button>
                <button type="button" className="btn btn--ghost btn--small"
                        onClick={() => open(row, true)}>保存</button>
                {/* **2段にする。** 押し間違いで消えない */}
                <button type="button"
                        className={`btn btn--small ${confirmId === row.id ? 'btn--quiet' : 'btn--ghost'}`}
                        onClick={() => remove(row)}
                        onBlur={() => setConfirmId((v) => (v === row.id ? null : v))}>
                  {confirmId === row.id ? '本当に消す' : '消す'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
