/**
 * **スピーチの原稿を出し、添削してもらい、その音で練習する**
 * (2026-09 利用者の指定)。
 *
 *   > スピーチ練習を実装しましょう。
 *   > これは、ゲストアカウントのスピーチ内から受け取ったスピーチの原稿を
 *   > AIにより添削し、そしてその文の音声を作成、ゲスト側で練習できる
 *   > 機能です。トレーナー側からもゲスト毎にスピーチを登録できます。
 *   > そして、単語帳にはスピーチの単語帳も作ります。
 *
 * ============================================================================
 * 【出す場所は2つ。部品は1つ】
 *
 *   ・**スピーチ練習**の画面(`PronunciationPractice`)… 自分のスピーチ
 *   ・**ゲストのページ**(`TrainerLearners` の「スピーチ」)… そのゲストのもの
 *
 *   ちがうのは **`learnerId` を渡すかどうかだけ**である。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md。単語帳で
 *   `LearnerWordbook` を別に持って踏んだ失敗)。
 *
 * 【添削を走らせるのは、トレーナーと管理者だけ】
 *
 *   判断は **`canAskReview()`(`writingReview.js`)1か所。**
 *   画面の中で `viewerRoleOf() === 'learner'` と書かない。
 *   **ゲストには、ボタンも調子の欄も出さない**(効かない操作を見せない)。
 *   代わりに**書いたものがどこへ行くのか**を1行で伝える ——
 *   **黙って消さない**(CLAUDE.md)。
 *
 * 【直す前の原稿は、読み上げない】
 *
 *   まちがった英語を**手本として聞かせる**ことになる
 *   (誤り訂正の英文に音声を付けないのと、まったく同じ考え方)。
 *   だから練習の場所は**添削が済んでから**出す。
 *
 * 【新しい仕組みを1つも作っていない】
 *   添削は `mode: 'review_writing'`、音は `useBodyAudio` → `speak`、
 *   語句は `lookupWord` → `setWordStatus`。**足したのは置き場所だけ**
 *   (`speeches`・0054)。
 */
import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ACCENT, accentsWithVoices, findVoice, pickVoices, voicesOfAccent,
} from '../data/clipVoices.js'
import { WRITING_TONES } from '../data/writingTones.js'
import { reviewWriting } from '../lib/materials.js'
import { createSpeech, deleteSpeech, loadSpeeches, saveSpeech, speechesSupported } from '../lib/speeches.js'
import {
  MAX_SPEECH_CHARS, isBlankDraft, isReviewed, sortSpeeches, speechCostYen,
  speechTitleOf, tooLongDraft,
} from '../lib/speechPractice.js'
import {
  canAskReview, loadWritingTone, normalizeReview, saveWritingTone, toneBrief,
} from '../lib/writingReview.js'
import { PlusIcon } from './Icons.jsx'
import SpeechPractice from './SpeechPractice.jsx'

/** スピーチは1人が最後まで話しきる。**声の向きは朗読** */
const PURPOSE = 'narration'

/** 書いてから送るまでの間合い。**「保存」を押させない**(`LessonNotes` と同じ) */
const SAVE_AFTER_MS = 1200

export default function SpeechBoard({ learnerId = null, learnerName = '' }) {
  const name = String(learnerName ?? '').trim()
  const honored = /(さん|様|先生)$/.test(name) ? name : `${name} さん`
  const whose = learnerId ? (name ? honored : 'このゲスト') : 'わたし'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [askDelete, setAskDelete] = useState(false)
  const [tone, setTone] = useState(loadWritingTone)
  const timer = useRef(null)

  /* **添削を走らせられるのはトレーナーと管理者だけ**(2026-09 利用者の指定)。
     判断は `canAskReview()` 1か所(`WritingAnswer` と同じもの) */
  const mayAsk = canAskReview()

  const open = rows.find((r) => r.id === openId) ?? null
  const reviewed = isReviewed(open)

  const reload = async (keep = null) => {
    const { data, error: e } = await loadSpeeches(learnerId)
    setLoading(false)
    if (e) { setError(e); return }
    const list = sortSpeeches(data)
    setRows(list)
    /* **開いていたものは開いたまま。** 読み直しただけで閉じない */
    setOpenId((id) => (keep ?? (list.some((r) => r.id === id) ? id : null)))
  }

  useEffect(() => {
    setLoading(true)
    setOpenId(null)
    reload()
    return () => window.clearTimeout(timer.current)
  }, [learnerId])

  /* **経過秒数を出す。** 動いていることが分からないと固まったと思われる */
  useEffect(() => {
    if (!busy) { setSecs(0); return undefined }
    const t = window.setInterval(() => setSecs((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [busy])

  /* 開くスピーチが変わったら、「本当に消す」は畳んだ状態に戻す。
     **押しかけのまま別のスピーチへ移らせない** */
  useEffect(() => { setAskDelete(false) }, [openId])

  /** 画面の控えだけ先に書き換える(打っているそばから消えないように) */
  const patchRow = (id, patch) => setRows((list) =>
    list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  /**
   * **「保存」を押させない。** 1.2 秒だまったら送る(`LessonNotes` と同じ間合い)。
   * **送り切る前に添削へ進まない**ように、`flush()` を必ず通す。
   */
  const later = (id, patch) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { saveSpeech(id, patch) }, SAVE_AFTER_MS)
  }
  const flush = async (id, patch) => {
    window.clearTimeout(timer.current)
    if (id && patch) await saveSpeech(id, patch)
  }

  /**
   * 新しい1本を置く。
   *
   * **押した時点で行を作る。** 「書き始めたら作る」にすると、
   * 打っているあいだに何本も作ってしまう競争が起きる。
   * 何も書かずにやめた行は「書きかけのスピーチ」として残り、
   * **その場で消せる**(行き止まりを作らない)。
   */
  const add = async () => {
    setError(null)
    setNote(null)
    setBusy(true)
    const { data, error: e } = await createSpeech({
      learnerId,
      /* **声は初めから入れておく。** 空のままだと、練習のときに
         おまかせが引き直されて**毎回ちがう声**になる(そのたびに課金) */
      voiceId: pickVoices(DEFAULT_ACCENT, 1, PURPOSE)[0] ?? null,
    })
    setBusy(false)
    if (e) { setError(e); return }
    setRows((list) => sortSpeeches([data, ...list]))
    setOpenId(data.id)
  }

  const remove = async () => {
    if (!open) return
    setError(null)
    setBusy(true)
    const { error: e } = await deleteSpeech(open.id)
    setBusy(false)
    if (e) { setError(e); return }
    setRows((list) => list.filter((r) => r.id !== open.id))
    setOpenId(null)
    setNote('スピーチを消しました。')
  }

  /** 添削してもらう。**窓口は `mode: 'review_writing'` をそのまま使う** */
  const ask = async () => {
    if (!open) return
    setError(null)
    setNote(null)
    const draft = String(open.draft ?? '')
    if (isBlankDraft(draft)) { setError('先にスピーチの原稿を書いてください。'); return }
    if (tooLongDraft(draft)) {
      setError(`長すぎます(${draft.trim().length} 文字)。`
        + `${MAX_SPEECH_CHARS} 文字までにしてください。`)
      return
    }
    /* **書きかけを送り切ってから頼む。** 待ち時間の途中で押されると、
       いま画面にあるものと窓口へ渡すものが食い違う */
    await flush(open.id, { draft, title: String(open.title ?? '') })
    setBusy(true)
    const { data, error: e } = await reviewWriting({
      answer: draft.trim(),
      toneBrief: toneBrief(tone),
      /* **設問は無い。** スピーチは問われて答えるものではないので、
         「何を訊かれているか」の代わりに**どういう場で話すのか**を渡す */
      question: 'This is a speech the learner will deliver aloud.',
      questionJa: '声に出して話すスピーチの原稿です。'
        + '聞いて分かる言い方に直してください。',
      level: 'B1',
    })
    setBusy(false)
    if (e) { setError(e); return }
    const got = normalizeReview({ ...(data.review ?? {}), tone })
    if (!got) { setError('添削の結果を読み取れませんでした。もう一度お試しください。'); return }
    patchRow(open.id, { review: got, tone })
    const { error: se } = await saveSpeech(open.id, { review: got, tone })
    if (se) { setError(se); return }
    setNote(`添削できました(${got.sentences.length} 文)。`)
  }

  const accents = accentsWithVoices(PURPOSE)
  const voice = findVoice(open?.voice_id)
  const accent = voice?.accent ?? DEFAULT_ACCENT
  /* **いま使っている声が名簿から外れていても、選択肢に残す**
     (`retired` を付けた声など・`VoiceRemake` と同じ作法)。
     外すと、その欄が**空白に見える** —— 声は選んであるのに、
     何で鳴っているのか分からなくなる */
  const pool = (() => {
    const list = voicesOfAccent(accent, PURPOSE)
    return (voice && !list.some((v) => v.id === voice.id)) ? [...list, voice] : list
  })()

  if (!speechesSupported()) {
    return (
      <div className="card">
        <h3 className="card-title">スピーチ</h3>
        <p className="notice notice--warn">
          スピーチの置き場がまだ用意されていません(0054 の SQL を貼ってください)。
        </p>
      </div>
    )
  }

  return (
    <div className="stack speechboard">
      <div className="card">
        <h3 className="card-title">{whose}のスピーチ</h3>
        <p className="card-hint">
          スピーチの原稿を書いて出すと、<strong>トレーナーが添削</strong>します。
          直った英文は<strong>1文ずつ音で聴けて</strong>、そのまま練習できます。
          {/* **黙って消さない。** ゲストにも、どこへ行くのかを言う */}
          {!mayAsk && <><br />書いたものは<strong>そのままトレーナーに届きます。</strong></>}
        </p>

        <div className="btn-row">
          <button type="button" className="btn btn--primary btn--small"
                  disabled={busy} onClick={add}>
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
                        onClick={() => setOpenId(r.id === openId ? null : r.id)}>
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
              <span className="field-hint">空でもよい(原稿の1行目から作ります)</span>
            </span>
            <input type="text" value={open.title ?? ''} disabled={busy}
                   placeholder="来週の全社集会であいさつ"
                   onChange={(e) => {
                     patchRow(open.id, { title: e.target.value })
                     later(open.id, { title: e.target.value })
                   }} />
          </label>

          <label className="field">
            <span>
              スピーチの原稿(英語)
              <span className="field-hint">
                {MAX_SPEECH_CHARS} 文字まで。書いたものは残ります
              </span>
            </span>
            <textarea lang="en" rows={10} value={open.draft ?? ''} disabled={busy}
                      placeholder={'Good morning, everyone. Thank you for making time today.\n'
                        + 'I want to talk about ...'}
                      onChange={(e) => {
                        patchRow(open.id, { draft: e.target.value })
                        later(open.id, { draft: e.target.value })
                      }} />
          </label>
          <p className="speech-count">
            {String(open.draft ?? '').trim().length.toLocaleString()} / {MAX_SPEECH_CHARS} 文字
          </p>
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
                      onChange={(e) => {
                        const id = pickVoices(e.target.value, 1, PURPOSE)[0] ?? null
                        patchRow(open.id, { voice_id: id })
                        flush(open.id, { voiceId: id })
                      }}>
                {accents.map((a) => (
                  <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>話す人</span>
              <select value={open.voice_id ?? ''} disabled={busy}
                      onChange={(e) => {
                        patchRow(open.id, { voice_id: e.target.value })
                        flush(open.id, { voiceId: e.target.value })
                      }}>
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
                        onChange={(e) => { setTone(e.target.value); saveWritingTone(e.target.value) }}>
                  {WRITING_TONES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} — {t.hint}</option>
                  ))}
                </select>
              </label>
              {/* **費用を出す**(見えない費用は管理できない・CLAUDE.md) */}
              <button type="button" className="btn btn--primary btn--small"
                      disabled={busy || isBlankDraft(open.draft) || tooLongDraft(open.draft)}
                      onClick={ask}>
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
                        disabled={busy} onClick={remove}>
                  本当に消す
                </button>
                <button type="button" className="btn btn--small btn--ghost"
                        disabled={busy} onClick={() => setAskDelete(false)}>
                  やめる
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--small btn--ghost"
                      disabled={busy} onClick={() => setAskDelete(true)}>
                このスピーチを消す
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 練習 ────────────────────────────────────────
          **添削が済むまで出さない。** 直す前の英文を読み上げると、
          まちがった英語を手本として聞かせることになる。

          中身は `SpeechPractice` が持つ —— **props で受け取る形**に
          しておくと、`npm run test:bar` が本物の部品のまま測れる
          (この部品は自分で読み込むので、Supabase の無い骨組みでは
          何も描かれない) */}
      {open && reviewed && (
        <SpeechPractice speech={open} learnerId={learnerId} />
      )}
    </div>
  )
}
