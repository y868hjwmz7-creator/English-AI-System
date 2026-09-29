/**
 * **スピーチの画面の、描くところだけ**(第5.305節・2026-09-29 利用者の指定)。
 *
 *   > 4. `npm run test:bar` は `SpeechBoard`(トレーナーのスピーチ画面)を
 *   >    1度も描いていません。測れる形に切り出しますか →はい
 *
 * ============================================================================
 * 【なぜ切り出したか】
 *
 *   `SpeechBoard` は**自分で `loadSpeeches()` を呼ぶ。**
 *   この環境からは Supabase に届かないので、骨組みに置いても
 *   **「読み込んでいます…」のまま1つも描かれない。**
 *   つまり **`npm run test:bar` は、この画面を1度も見ていなかった** ——
 *   すき間ゼロも、はみ出しも、押せる大きさも、**誰も測っていない。**
 *
 *   **描けないものは測れない**(CLAUDE.md)。だから
 *   `SpeechPractice` / `QrCard` / `ShelfAssign` / `VolumeRow` と同じように、
 *   **props で受け取るだけ**の形へ出した。
 *
 * 【読む側は1行も変わっていない】
 *
 *   JSX は**そのまま移しただけ**である。
 *   `patchRow` / `later` を呼んでいたところは `onTitle` / `onDraft` に
 *   置き換わっただけで、**見た目も並びも1ドットも変えていない**
 *   (**寄せたついでに直さない**・CLAUDE.md)。
 *
 * 【練習は `children` で受ける】
 *
 *   `SpeechPractice` は `speech` を渡せば描けるが、
 *   **添削が済んだときだけ出す**という判断は `SpeechBoard` が持っている。
 *   ここへ持ち込むと**判断が2か所**になる。
 * ============================================================================
 */
import { WRITING_TONES } from '../data/writingTones.js'
import { MAX_SPEECH_CHARS, isBlankDraft, isReviewed, speechCostYen, speechText, speechTitleOf, tooLongDraft } from '../lib/speechPractice.js'
import { PlusIcon } from './Icons.jsx'

export default function SpeechBoardView({
  /** 「◯◯のスピーチ」の ◯◯(呼ぶ側が組み立てる) */
  whose = 'わたし',
  /** 添削を走らせられるか(`canAskReview()`)。**判断はここで作らない** */
  mayAsk = false,
  busy = false,
  loading = false,
  rows = [],
  openId = null,
  onPick = null,
  onAdd = null,
  error = null,
  note = null,
  /** いま開いているスピーチ(無ければ欄ごと出ない) */
  open = null,
  reviewed = false,
  bodyOpen = false,
  onBodyOpen = null,
  draftOpen = false,
  onDraftOpen = null,
  onTitle = null,
  onDraft = null,
  /** 読み上げの声 */
  accents = [],
  accent = '',
  onAccent = null,
  pool = [],
  onVoice = null,
  /** 添削 */
  tone = '',
  onTone = null,
  secs = 0,
  onAsk = null,
  /** 消す(2段で押させる) */
  askDelete = false,
  onAskDelete = null,
  onRemove = null,
  /** 練習(`SpeechPractice`)。**出す / 出さないの判断は呼ぶ側** */
  children = null,
}) {
  /* **原稿の欄は1つだけ作る。** 畳むときも、そのまま出すときも、これを置く ——
     **書き写すと、片方だけ古くなる**(CLAUDE.md) */
  const draftBox = open && (
    <label className="field">
      <span>
        スピーチの原稿(英語)
        <span className="field-hint">{MAX_SPEECH_CHARS} 文字まで</span>
      </span>
      <textarea lang="en" rows={10} value={open.draft ?? ''} disabled={busy}
                placeholder={'Good morning, everyone. Thank you for making time today.\n'
                  + 'I want to talk about ...'}
                onChange={(e) => onDraft?.(e.target.value)} />
    </label>
  )

  return (
    <div className="stack speechboard">
      <div className="card">
        <h3 className="card-title">{whose}のスピーチ</h3>
        <p className="tip card-hint">
          スピーチの原稿を書いて出すと、<strong>トレーナーが添削</strong>します。
          直った英文は<strong>1文ずつ音で聴けて</strong>、そのまま練習できます。
          {/* **黙って消さない。** ゲストにも、どこへ行くのかを言う */}
          {!mayAsk && <><br />書いたものは<strong>そのままトレーナーに届きます。</strong></>}
        </p>

        <div className="btn-row">
          <button type="button" className="btn btn--primary btn--small"
                  disabled={busy} onClick={() => onAdd?.()}>
            <PlusIcon />新しいスピーチ
          </button>
        </div>

        {loading ? (
          <p className="muted">読み込んでいます…</p>
        ) : !rows.length ? (
          /* **行き止まりを作らない。** 1本も無いことも1行で言う */
          <p className="muted">まだスピーチがありません。「新しいスピーチ」から始められます。</p>
        ) : (
          <ul className="speech-list">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button"
                        className={`speech-pick${r.id === openId ? ' is-on' : ''}`}
                        aria-pressed={r.id === openId}
                        onClick={() => onPick?.(r.id)}>
                  <span className="speech-pick-name">{speechTitleOf(r)}</span>
                  {/* **色だけに頼らない**(CLAUDE.md)。言葉でも言う */}
                  <span className={`speech-flag${isReviewed(r) ? ' is-done' : ''}`}>
                    {isReviewed(r) ? '添削ずみ' : '下書き'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* **押した場所のすぐ下に出す**(CLAUDE.md) */}
        {error && <p className="notice notice--error">{error}</p>}
        {note && <p className="notice notice--ok">{note}</p>}
      </div>

      {open && (
        <div className="card speech-edit">
          <label className="field">
            <span>
              題名
              <span className="tip field-hint">空でもよい(原稿の1行目から作ります)</span>
            </span>
            <input type="text" value={open.title ?? ''} disabled={busy}
                   placeholder="来週の全社集会であいさつ"
                   onChange={(e) => onTitle?.(e.target.value)} />
          </label>

          {/* ── **添削が済んだら、出すのは「直した本文」のほう**(第5.301節)──
               2026-09-28 利用者の指定。

                 > 一度添削が済んだらこのグレーの部分はもう必要ないですよね。
                 > 本文として一本化したきれいな表示を用意し、
                 > 閉じたり開いたりできるようにすべきです

               ・**一本化した文章は `speechText()` 1か所**
                 (数え方を2通り持たない・CLAUDE.md)
               ・**原稿も消さない。** 「もう一度 添削してもらう」は
                 原稿から作るので、**開けば直せる**ようにしておく
                 (行き止まりを作らない)
               ・`<details>` そのものに `display` を書かない ——
                 **畳んでも中身が場所を取り続ける**(共通ルール) */}
          {reviewed && (
            <details className="details-box speech-body" open={bodyOpen}
                     onToggle={(e) => onBodyOpen?.(e.currentTarget.open)}>
              <summary>
                直した本文
                <span className="field-hint">
                  {speechText(open).trim().length.toLocaleString()} 文字
                </span>
              </summary>
              <p className="speech-body-text" lang="en">{speechText(open)}</p>
            </details>
          )}

          {/* **原稿の欄。** 添削が済むまでは、これが中身そのものなので、そのまま出す。
               済んだら畳んでおく —— **もう読む必要がない** */}
          {reviewed ? (
            <details className="details-box" open={draftOpen}
                     onToggle={(e) => onDraftOpen?.(e.currentTarget.open)}>
              <summary>
                原稿を直す
                <span className="field-hint">
                  {String(open.draft ?? '').trim().length.toLocaleString()}
                  {' / '}{MAX_SPEECH_CHARS} 文字
                </span>
              </summary>
              {draftBox}
            </details>
          ) : (
            <>
              {draftBox}
              <p className="speech-count">
                {String(open.draft ?? '').trim().length.toLocaleString()}
                {' / '}{MAX_SPEECH_CHARS} 文字
              </p>
            </>
          )}
          {/* **長すぎの知らせは、畳みの外に出す。** 中に入れると、
              閉じているあいだ**押せないボタンの理由が見えなくなる** */}
          {tooLongDraft(open.draft) && (
            <p className="notice notice--error">
              長すぎます。{MAX_SPEECH_CHARS} 文字までにしてください
              (<strong>こちらでは切りません</strong> —— 切ると原稿が変わってしまいます)。
            </p>
          )}

          {/* ── 読み上げの声 ──────────────────────────────
              **1人が最後まで話しきる**ので、選ぶのは1人だけ。
              名簿と選び方は `clipVoices.js` に任せる(**判断を2か所に置かない**) */}
          <div className="voice-row">
            <label className="field">
              <span>読み上げの国</span>
              <select value={accent} disabled={busy}
                      onChange={(e) => onAccent?.(e.target.value)}>
                {accents.map((a) => (
                  <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>話す人</span>
              <select value={open.voice_id ?? ''} disabled={busy}
                      onChange={(e) => onVoice?.(e.target.value)}>
                {pool.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}({v.gender === 'male' ? '男性' : '女性'})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* ── 添削 ────────────────────────────────────
              **走らせるのはトレーナーと管理者だけ**(利用者の指定)。
              ゲストにはボタンも調子の欄も出さない(効かない操作を見せない) */}
          {mayAsk ? (
            <div className="writing-tools">
              <label className="writing-tone">
                <span>添削の調子</span>
                <select value={tone} disabled={busy}
                        onChange={(e) => onTone?.(e.target.value)}>
                  {WRITING_TONES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} — {t.hint}</option>
                  ))}
                </select>
              </label>
              {/* **費用を出す**(見えない費用は管理できない・CLAUDE.md) */}
              <button type="button" className="btn btn--primary btn--small"
                      disabled={busy || isBlankDraft(open.draft) || tooLongDraft(open.draft)}
                      onClick={() => onAsk?.()}>
                {busy ? `添削してもらっています…（${secs} 秒）`
                  : `${reviewed ? 'もう一度 ' : ''}添削してもらう`
                    + `（およそ ${speechCostYen(open.draft)} 円）`}
              </button>
            </div>
          ) : (
            <p className="field-hint writing-handoff">
              添削は<strong>トレーナーが行います。</strong>
              書いた原稿はトレーナーに届いています。
            </p>
          )}

          {/* **消す道を、その場に置く。** 2段で押させる(元に戻せない) */}
          <div className="btn-row speech-danger">
            {askDelete ? (
              <>
                <button type="button" className="btn btn--small btn--quiet"
                        disabled={busy} onClick={() => onRemove?.()}>
                  本当に消す
                </button>
                <button type="button" className="btn btn--small btn--ghost"
                        disabled={busy} onClick={() => onAskDelete?.(false)}>
                  やめる
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--small btn--ghost"
                      disabled={busy} onClick={() => onAskDelete?.(true)}>
                このスピーチを消す
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 練習 ────────────────────────────────────────
          **添削が済むまで出さない。** 直す前の英文を読み上げると、
          まちがった英語を手本として聞かせることになる。
          **その判断は呼ぶ側**(`SpeechBoard`)が持っている */}
      {children}
    </div>
  )
}
