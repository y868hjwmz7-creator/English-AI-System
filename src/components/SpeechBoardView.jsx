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
import { isReviewed, speechTitleOf } from '../lib/speechPractice.js'
import { PlusIcon } from './Icons.jsx'
import SpeechEditCard from './SpeechEditCard.jsx'

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

      {/* ★ **原稿と添削のカードは `SpeechEditCard` へ切り出した**
             (2026-09-30・第5.323節)。**添削が済んだスピーチでは、
             教材の画面の中に畳んで入れる**ので、両方から呼べる形が要る。
             **JSX は1行も変えていない** */}
      <SpeechEditCard
        open={open} mayAsk={mayAsk} busy={busy} reviewed={reviewed}
        bodyOpen={bodyOpen} onBodyOpen={onBodyOpen}
        draftOpen={draftOpen} onDraftOpen={onDraftOpen}
        onTitle={onTitle} onDraft={onDraft}
        accents={accents} accent={accent} onAccent={onAccent}
        pool={pool} onVoice={onVoice}
        tone={tone} onTone={onTone} secs={secs} onAsk={onAsk}
        askDelete={askDelete} onAskDelete={onAskDelete} onRemove={onRemove}
      />

      {/* ── 練習 ────────────────────────────────────────
          **添削が済むまで出さない。** 直す前の英文を読み上げると、
          まちがった英語を手本として聞かせることになる。
          **その判断は呼ぶ側**(`SpeechBoard`)が持っている */}
      {children}
    </div>
  )
}
