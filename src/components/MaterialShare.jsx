/**
 * **教材へのリンクを渡す。渡し方は2つ**(2026-09 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 *   > シェアする際はメールアドレスを入れる、またはリンクを生成して
 *   > 好きなところに貼り付けれるように、2つから選べると良いですね
 *
 * はじめは押した瞬間に端末の共有シートを開いていたが、
 * **何が起きるのか押す前に分からなかった。** いまは欄を開いて、
 * **2つを並べて見せる。**
 *
 *   ① メールで送る … 宛先を書いて、**利用者自身のメールソフト**を開く
 *   ② リンクをコピー … リンクをそのまま出す。好きなところに貼れる
 *
 * 【選ぶ手間を、もう1回増やさない】
 *   「どちらにしますか」を先に訊いてから欄を出すと、押す回数が1つ増える。
 *   **2つとも出しておけば、選ぶことがそのまま操作になる。**
 *
 * 【こちらからメールは送らない】
 *   送るには外の送信サービスとその鍵が要る。**鍵は扱わない**という
 *   決まりを、この機能のために曲げない(`erase_learner()` が
 *   `auth.users` を消さなかったのと同じ考え方)。
 *   開くのは利用者のメールソフトで、宛先・件名・リンクは入れてある。
 *   **そのことを画面にも書く** —— 送ったつもりで送れていない、が
 *   いちばん困る。
 *
 * 【リンクは、いつも見えるところに出す】
 *   コピーを断る端末(古い Safari・http)があるので、
 *   **欄そのものに出して手でも選べるようにする。**
 *   行き止まりを作らない(CLAUDE.md)。
 *
 * 【「ゲストと共有する」とは別物】
 *   あちらは宿題として配る(`assignments`)。こちらは**リンクを渡すだけ**で、
 *   何も配らない。取り違えると事故になるので、欄の頭に1行書く。
 * ════════════════════════════════════════════════════════════════
 */
import { useRef, useState } from 'react'
import { LinkIcon } from './Icons.jsx'
/* **宛先の形を、画面で見分けない。** `mailtoFor()` が形の違う宛先には
   `null` を返すので、それをそのまま「押せない」の合図に使う
   (判断を2か所に置かない・`remakeModeOf()` と同じ考え方) */
import { mailtoFor, materialLinkFor } from '../lib/materialLink.js'

export default function MaterialShare({ material }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  /** コピーの結果。**成功と失敗を、同じ見た目で終わらせない**(CLAUDE.md) */
  const [copied, setCopied] = useState(null)   // 'ok' | 'ng' | null
  const urlRef = useRef(null)

  // **リンクの作り方は `materialLink.js` 1か所。** 画面で組み立てない
  const url = materialLinkFor(material.id, window.location)
  const mail = mailtoFor({ to, title: material.title, url })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('ok')
    } catch {
      // 断られた。**欄のリンクは見えているので、手で選べる**
      setCopied('ng')
      urlRef.current?.select()
    }
  }

  return (
    <>
      <button type="button"
              className={`btn btn--small btn--quiet${open ? ' is-on' : ''}`}
              onClick={() => { setOpen(!open); setCopied(null) }}>
        <LinkIcon />教材をシェア
      </button>

      {open && (
        <div className="share-box">
          {/* **何が起きるのかを、先に1行で書く。**
              すぐ左に「ゲストと共有する」があるので、取り違えを防ぐ */}
          <p className="field-hint">
            この教材の<strong>リンクを渡します</strong>。
            教材そのものは配られません(ゲストへ配るのは、
            左の「この教材をゲストと共有する」です)。
          </p>

          {url === null ? (
            /* **当てずっぽうの URL を出さない。**
               作れないときは、そう言う(黙って空欄を出さない) */
            <p className="notice notice--warn">リンクを作れませんでした。</p>
          ) : (
            <>
              {/* ── ① メールで送る ───────────────────────────── */}
              <p className="field-label">① メールで送る</p>
              <div className="share-row">
                <input type="email" className="input" value={to}
                       placeholder="宛先(メールアドレス)"
                       autoComplete="email" inputMode="email"
                       onChange={(e) => setTo(e.target.value)} />
                {/* **選ばせてから断らない。** 宛先の形が違ううちは押せない */}
                <a className={`btn btn--small${mail ? '' : ' is-off'}`}
                   href={mail ?? undefined}
                   aria-disabled={mail ? undefined : 'true'}
                   onClick={(e) => { if (!mail) e.preventDefault() }}>
                  メールを開く
                </a>
              </div>
              <p className="field-hint">
                <strong>お使いのメールソフトが開きます</strong>(このアプリからは
                送りません)。宛先・件名・リンクは入れてあります。
                コンマで区切ると、複数の宛先に書けます。
              </p>

              {/* ── ② リンクをコピーする ─────────────────────── */}
              <p className="field-label">② リンクをコピーして、好きなところに貼る</p>
              <div className="share-row">
                {/* **読み取り専用で、いつも見えるところに出す。**
                    コピーを断る端末でも、手で選んで写せる */}
                <input type="text" className="input share-url" ref={urlRef}
                       value={url} readOnly aria-label="教材のリンク"
                       onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn--small" onClick={copy}>
                  コピーする
                </button>
              </div>
              {copied === 'ok' && (
                <p className="notice notice--ok">
                  リンクをコピーしました。
                  <strong>トレーナーがこのリンクを開くと、この教材が出ます。</strong>
                </p>
              )}
              {copied === 'ng' && (
                <p className="notice notice--warn">
                  この端末ではコピーできませんでした。
                  上の欄のリンクを選んで写してください。
                </p>
              )}
            </>
          )}

          {/* **「やめる」を、走らせるボタンのとなりに置く**(CLAUDE.md)。
              上のボタンをもう一度押しても閉じるが、
              画面を送るとそこは見えなくなる */}
          <div className="btn-row">
            <button type="button" className="btn btn--small btn--ghost"
                    onClick={() => { setOpen(false); setCopied(null) }}>
              やめる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
