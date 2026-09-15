/**
 * **教材を渡す道は、ボタン1つにまとめる**(2026-09 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 *   > 「教材をシェア」と「教材をゲストと共有」はボタンをひとつにして
 *   > その中でゲストと共有なのか普通の共有なのかを選べるように
 *   > してください。省スペースです。
 *
 * 【もとは2つのボタンだった。経緯ごと残す】
 *
 *   | | ボタン | 開くもの |
 *   |---|---|---|
 *   | 前 | この教材をゲストと共有する | `.assign-box`(ゲストを選ぶ) |
 *   | 前 | 教材をシェア | `.share-box`(メール / リンク) |
 *   | **いま** | **共有** | **`.share-box` 1つ。中で2つから選ぶ** |
 *
 *   どちらも**「この教材を、誰かへ渡す」**という1つのことで、
 *   **違うのは渡す相手だけ**である(ゲスト / トレーナー)。
 *   ボタンを2つ並べると、そのぶん**場所を取り**、しかも
 *   狭い画面では「印刷 / PDF」「音声」と1行に並べられない。
 *
 * 【ここでは「どちらにしますか」を先に訊く】
 *   この部品には**逆の決まりが書いてあった** ——
 *   「2つとも出しておけば、選ぶことがそのまま操作になる」。
 *   あれは**メール / リンクという小さな2つ**の話で、いまも守っている
 *   (`way === 'link'` の中は、2つとも並べてある)。
 *
 *   **ゲストを選ぶ欄は大きい**(担当25人ぶんのチェックが並ぶ)ので、
 *   両方を開くと箱が画面2枚ぶんになる。利用者が挙げた目的は
 *   **省スペース**であり、言葉も「**選べるように**」である。
 *
 * 【既定は「ゲストと共有」】
 *   このアプリの中心は「弱点から教材を作り、**指定したゲストに配る**」
 *   循環である(CLAUDE.md 冒頭)。リンクを渡すのは、そのあとの話。
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
 * 【開け閉めは、呼ぶ側が持つ】
 *   ゲストと共有する道は `assigningId` / `picked` を使う。
 *   **共有し終わったらその場で閉じたい**ので、開いているかどうかを
 *   ここに閉じ込めると、閉じる合図をもう1本渡すことになる。
 *   `open` / `onOpen` / `onClose` で**外から決める。**
 * ════════════════════════════════════════════════════════════════
 */
import { useRef, useState } from 'react'
import { ShareIcon } from './Icons.jsx'
/* **宛先の形を、画面で見分けない。** `mailtoFor()` が形の違う宛先には
   `null` を返すので、それをそのまま「押せない」の合図に使う
   (判断を2か所に置かない・`remakeModeOf()` と同じ考え方) */
import { mailtoFor, materialLinkFor } from '../lib/materialLink.js'

export default function MaterialShare({ material, guest = null, open, onOpen, onClose }) {
  /** どちらの道か。**ゲストを渡されていなければ、リンクしかない** */
  const [way, setWay] = useState(guest ? 'guest' : 'link')
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

  const shut = () => { setCopied(null); onClose?.() }
  const toggle = () => {
    if (open) { shut(); return }
    /* **開くたびに、既定から始める。** 前に「リンクを渡す」を見ていた人が、
       次の教材でもそこから始まると、ゲストに配る道が隠れて見える */
    setWay(guest ? 'guest' : 'link')
    setCopied(null)
    onOpen?.()
  }

  /* **ゲストを渡されていなければ、その道は無い**(効かない操作を見せない)。
     `way` が取り残されても、ここで必ずリンクに落ちる */
  const now = guest ? way : 'link'

  return (
    <>
      {/* **言葉は「共有」1語。** 絵(点と点をつなぐ)が「渡す」を言うので、
          残すのは「誰に」ではなく「何をするか」だけでよい。
          長い名前だと、狭い画面で「印刷 / PDF」「音声」と3つ並ばない */}
      <button type="button"
              className={`btn btn--small share-open${open ? ' is-on' : ''}`}
              aria-expanded={open}
              onClick={toggle}>
        <ShareIcon />共有
      </button>

      {open && (
        <div className="share-box">
          {/* ── 渡す相手を選ぶ ─────────────────────────────────
              **色だけに頼らない**(うすい地色 + 同じ色の文字 + 枠線 + 太字)。
              札の見た目は `.chip` を使い回す —— ここで新しい配色を作らない */}
          {guest && (
            <div className="chiprow share-pick" role="group"
                 aria-label="共有のしかた">
              {[['guest', 'ゲストと共有'], ['link', 'リンクを渡す']].map(([id, name]) => (
                <button key={id} type="button"
                        className={`chip${now === id ? ' chip--on' : ''}`}
                        aria-pressed={now === id}
                        onClick={() => { setWay(id); setCopied(null) }}>
                  {name}
                </button>
              ))}
            </div>
          )}

          {now === 'guest' ? (
            /* **中身は呼ぶ側が持つ。** 誰が担当ゲストかも、何人選んだかも、
               共有したときに何語が単語帳へ入るかも、あちらが知っている */
            guest
          ) : url === null ? (
            /* **当てずっぽうの URL を出さない。**
               作れないときは、そう言う(黙って空欄を出さない) */
            <p className="notice notice--warn">リンクを作れませんでした。</p>
          ) : (
            <>
              {/* **何が起きるのかを、先に1行で書く。**
                  同じ箱の中に「ゲストと共有」があるので、取り違えを防ぐ */}
              <p className="field-hint">
                この教材の<strong>リンクを渡します</strong>(トレーナー間)。
                教材そのものは配られません。
              </p>

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
              画面を送るとそこは見えなくなる。
              **どちらの道でも同じ場所**にある(箱が持つ) */}
          <div className="btn-row">
            <button type="button" className="btn btn--small btn--ghost"
                    onClick={shut}>
              やめる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
