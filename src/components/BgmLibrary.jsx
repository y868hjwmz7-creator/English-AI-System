/**
 * 音楽 —— **自作の曲を入れて、どこで流すかを決める**(0049)。
 *
 * 2026-09 利用者の指定。
 *
 *   > また、これからは自作の音楽が流れるようにしたいです。
 *
 * 置き場所は利用者が選んだ ——「Supabase に置いて、画面から入れる」。
 *
 * ============================================================================
 * 【入れられるのはトレーナーと管理者だけ。聴くのは全員】
 *
 *   曲は**スクールみんなのもの**である。ゲストごとに分けない。
 *   **守っているのは 0049 の RLS。** 画面が間違えても、
 *   ゲストのアカウントからは入れられない。
 *   ただし**効かない操作を見せない**ので、ゲストには欄そのものを出さない。
 *
 * 【0049 を貼る前でも壊れない】
 *   一度断られたら覚えておき、そのあとは呼びに行かない
 *   (`bgmSupported()`)。**何をすればよいかまで書く。**
 *
 * 【費用】
 *   Supabase の置き場に置くだけなので、**AI にも読み上げにも1円もかからない。**
 *   容量だけが増える(1曲 30MB まで)。
 */
import { useEffect, useRef, useState } from 'react'
import {
  MAX_TRACK_BYTES, addTrack, bgmSupported, deleteTrack, listTracks,
} from '../lib/bgm.js'
import { BGM_PLACES, bgmPlaceOf, loadBgmPlace, saveBgmPlace } from '../lib/wordRadio.js'
import { CloseIcon, MusicIcon, UploadIcon } from './Icons.jsx'
import { canSeeSystemDetail } from '../lib/viewer.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

const mb = (n) => `${Math.round((Number(n) || 0) / 1024 / 1024 * 10) / 10}MB`

export default function BgmLibrary({ userId = null }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [place, setPlace] = useState(loadBgmPlace)
  /** 2段で押させる(消したら戻せない)。`MaterialDelete` と同じ作法 */
  const [sure, setSure] = useState(null)
  const inputRef = useRef(null)

  const reload = async () => {
    setBusy(true)
    const { data, error: e } = await listTracks()
    setRows(data ?? [])
    setError(e)
    setBusy(false)
  }
  useEffect(() => { reload() }, [])

  const send = async () => {
    if (!file) return
    setSending(true)
    setNote('')
    const { error: e } = await addTrack({ file, title: title || file.name, addedBy: userId })
    setSending(false)
    if (e) { setError(e); return }
    setError(null)
    /* **成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md)。
       何が入ったのかを、押した場所のすぐ下に出す */
    setNote(`「${title || file.name}」を入れました。`)
    setTitle('')
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
    reload()
  }

  const remove = async (row) => {
    if (sure !== row.id) { setSure(row.id); return }
    setSure(null)
    const { error: e } = await deleteTrack(row)
    if (e) { setError(e); return }
    setNote(`「${row.title}」を消しました。`)
    reload()
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="card">
        <h2 className="card-title">音楽</h2>
        <p className="hint">Supabase が設定されていないため、曲を入れられません。</p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="card-title"><MusicIcon />音楽</h2>

      {/* **どこで流すかは、ここで決める**(2026-09 利用者の指定
          「選べるようにしたい」)。**切る場所を必ず用意する** ——
          レッスン中は画面を共有するので、鳴っていては困る場面がある */}
      <label className="field">
        <span className="field-label">流す場所</span>
        <select className="input" value={place}
                onChange={(e) => { setPlace(e.target.value); saveBgmPlace(e.target.value) }}>
          {BGM_PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <span className="field-hint">
          {bgmPlaceOf(place).id === 'off'
            ? '曲は流れません。'
            : '声が鳴っているあいだは、曲を自動で小さくします。'}
        </span>
      </label>

      {!bgmSupported() && (
        <p className="notice notice--warn">
          この Supabase にはまだ曲の置き場(0049 の SQL)が入っていません。
          {canSeeSystemDetail()
            ? '　GitHub の supabase/apply/pending_matome.sql を、'
              + 'Supabase → SQL Editor → New query に貼って Run してください。'
            : ''}
        </p>
      )}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {note && <p className="notice notice--ok">{note}</p>}

      {/* ── 入れる ────────────────────────────────────────── */}
      <div className="card-sub">
        <p className="field-label">曲を入れる</p>
        <label className="field">
          <span className="field-label">題(画面に出る名前)</span>
          <input className="input" type="text" value={title} maxLength={120}
                 placeholder="朝のピアノ"
                 onChange={(e) => setTitle(e.target.value)} />
        </label>
        <input ref={inputRef} type="file" accept="audio/*"
               onChange={(e) => {
                 const f = e.target.files?.[0] ?? null
                 setFile(f)
                 // **題を書いていなければ、ファイル名を入れておく**(空で断らない)
                 if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
               }} />
        <div className="btn-row">
          <button type="button" className="btn btn--primary"
                  disabled={!file || sending || !bgmSupported()}
                  onClick={send}>
            <UploadIcon />{sending ? '入れています…' : '入れる'}
          </button>
          {/* **「やめる」を、走らせるボタンのとなりに置く**(CLAUDE.md) */}
          {file && (
            <button type="button" className="btn btn--ghost" disabled={sending}
                    onClick={() => {
                      setFile(null); setTitle('')
                      if (inputRef.current) inputRef.current.value = ''
                    }}>
              やめる
            </button>
          )}
        </div>
        <p className="field-hint">
          MP3・M4A・WAV など。1曲 {Math.round(MAX_TRACK_BYTES / 1024 / 1024)}MB まで。
          入れた曲は<strong>ゲスト全員に流れます</strong>(消せるのはトレーナーだけです)。
        </p>
      </div>

      {/* ── 一覧 ──────────────────────────────────────────── */}
      {busy ? <p className="hint">読み込み中…</p> : rows.length === 0 ? (
        <p className="hint">
          まだ1曲も入っていません。上の欄から入れると、聞き流しのときに流れます。
        </p>
      ) : (
        <ul className="bgm-list">
          {rows.map((r) => (
            <li key={r.id} className="bgm-row">
              <span className="bgm-title">{r.title}</span>
              <span className="bgm-size">{mb(r.bytes)}</span>
              <button type="button"
                      className={`btn btn--small ${sure === r.id ? 'btn--quiet' : 'btn--ghost'}`}
                      onClick={() => remove(r)}
                      onBlur={() => setSure((x) => (x === r.id ? null : x))}>
                <CloseIcon />{sure === r.id ? '本当に消す' : '消す'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
