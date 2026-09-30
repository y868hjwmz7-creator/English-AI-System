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
import { reviewWriting } from '../lib/materials.js'
import { createSpeech, deleteSpeech, loadSpeeches, saveSpeech, speechesSupported } from '../lib/speeches.js'
import {
  MAX_SPEECH_CHARS, isBlankDraft, isReviewed, sortSpeeches,
  speechAsMaterial, speechLevelOf, tooLongDraft,
} from '../lib/speechPractice.js'
/* **語に触れた記録は、スピーチでも残す**(0025)。
   これまで `SpeechPractice` が持っていたが、語をタップするところが
   教材の画面へ移ったので、**渡す側もここへ上がってきた** */
import useWordStatuses from '../lib/useWordStatuses.js'
import {
  canAskReview, loadWritingTone, normalizeReview, saveWritingTone, toneBrief,
} from '../lib/writingReview.js'
import SpeechPractice from './SpeechPractice.jsx'
import SpeechBoardView from './SpeechBoardView.jsx'
import SpeechEditCard from './SpeechEditCard.jsx'
/* ★ **添削ずみのスピーチは、モノローグ教材とまったく同じ画面で開く**
     (2026-09-30 利用者の指定・第5.323節)。
   **同じ `LessonView` をそのまま使う** —— 部品を作り直さない */
import LessonView from './LessonView.jsx'

/** スピーチは1人が最後まで話しきる。**声の向きは朗読** */
const PURPOSE = 'narration'

/** 書いてから送るまでの間合い。**「保存」を押させない**(`LessonNotes` と同じ) */
const SAVE_AFTER_MS = 1200

/**
 * **調子を覚える場面の名前**(2026-09 利用者の指定「スピーチだけ別に覚える」)。
 *
 * ディスカッションの答え(`WritingAnswer`)とは**別に覚える。**
 * あちらは口に出して話す練習で既定は「カジュアル」だが、
 * スピーチは全社集会・学会・乾杯など、たいてい**もっと改まった場**である。
 * 同じ鍵で覚えると、**片方を直すともう片方まで変わる。**
 *
 * **鍵の名前はここに書かない** —— `writingReview.js` の `TONE_KEYS` が持つ。
 */
const TONE_WHERE = 'speech'

/**
 * @param learnerId  誰のスピーチか。渡さなければ自分のもの
 * @param learnerName 題に出す名前(ゲストのときだけ)
 * @param level      **そのゲストのレベル**(`profiles.cefr`・2026-09 利用者の指定)。
 *   添削も、語の意味も、この段に合わせて頼む。
 *   **既定の落とし先は `speechLevelOf()` 1か所**(画面で `'B1'` と書かない)
 */
export default function SpeechBoard({ learnerId = null, learnerName = '', level = null }) {
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
  /* 語に触れた記録(教材の画面へそのまま渡す) */
  const { statuses: wordStatuses, mark: markWord } = useWordStatuses(learnerId)
  const [tone, setTone] = useState(() => loadWritingTone(TONE_WHERE))
  const timer = useRef(null)

  /* **添削を走らせられるのはトレーナーと管理者だけ**(2026-09 利用者の指定)。
     判断は `canAskReview()` 1か所(`WritingAnswer` と同じもの) */
  const mayAsk = canAskReview()

  const open = rows.find((r) => r.id === openId) ?? null
  const reviewed = isReviewed(open)
  /* **添削が済んだら、原稿は畳んでおく**(第5.301節・利用者の指定)。
     直した本文のほうも畳んでおく —— **開けば読める**ので、
     画面のいちばん上が原稿で埋まらない */
  const [bodyOpen, setBodyOpen] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)

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
      /* **ゲストのレベルに合わせる**(2026-09 利用者の指定)。
         ベタ書きにすると、Pre-Basic の人にも C2 の人にも
         **同じ難しさの英語**で直してくることになる */
      level: speechLevelOf(level),
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

  /* ★ **添削が済んだスピーチは、モノローグ教材の画面で開く**
       (2026-09-30 利用者の指定・第5.323節)

       > 普通の他の教材の画面、つまり1枚目の写真と同じ仕様にする様に
       > してください。仕組みも同じです。つまり、モノローグの教材と
       > 全て同じです。quick response もあります。

     **教材の形に組み立てて、同じ `LessonView` に渡すだけ**である
     (`speechAsMaterial()`)。6Steps も Quick Response も集中モードも、
     語のタップも、1文ずつの聴くも、**書き写さずに付いてくる。**

     **音声は1円もかからない** —— 声も英文も同じなので鍵が変わらない
     (`speechAsMaterial()` の説明)。

     添削の結果と、原稿・声・消すは、**畳んだ札の中**に入れる
     (利用者が選んだ案「添削の結果は畳んでおく」)。 */
  /* **`reviewed &&` と書かない。** `speechAsMaterial()` が
     「直した文があるか」で `null` を返す —— **判断は1か所** */
  const asMaterial = open ? speechAsMaterial(open, { level }) : null
  if (asMaterial) {
    return (
      <LessonView
        material={asMaterial}
        learnerId={learnerId}
        learnerName={learnerName}
        wordStatuses={wordStatuses}
        onMarkWord={markWord}
        /* 閉じたら、スピーチの一覧へ戻る(行き止まりを作らない) */
        onClose={() => setOpenId(null)}
        /* ★ **添削の結果は、教材の2ページ目**(2026-09-30 利用者の指定)
             > というよりも教材の中の2ページ目に添削の結果を入れます */
        extraPage={{
          label: '添削の結果',
          node: (
          <>
            <SpeechPractice speech={open} learnerId={learnerId} level={level} />
            <SpeechEditCard
              open={open} mayAsk={mayAsk} busy={busy} reviewed={reviewed}
              bodyOpen={bodyOpen} onBodyOpen={setBodyOpen}
              draftOpen={draftOpen} onDraftOpen={setDraftOpen}
              onTitle={(v) => { patchRow(open.id, { title: v }); later(open.id, { title: v }) }}
              onDraft={(v) => { patchRow(open.id, { draft: v }); later(open.id, { draft: v }) }}
              accents={accents} accent={accent} pool={pool}
              onAccent={(id) => {
                const v = pickVoices(id, 1, PURPOSE)[0] ?? null
                patchRow(open.id, { voice_id: v })
                flush(open.id, { voiceId: v })
              }}
              onVoice={(id) => { patchRow(open.id, { voice_id: id }); flush(open.id, { voiceId: id }) }}
              tone={tone} onTone={(v) => { setTone(v); saveWritingTone(v, TONE_WHERE) }}
              secs={secs} onAsk={ask}
              askDelete={askDelete} onAskDelete={setAskDelete} onRemove={remove}
            />
            {/* **押した場所のすぐ下に出す**(CLAUDE.md) */}
            {error && <p className="notice notice--error">{error}</p>}
            {note && <p className="notice notice--ok">{note}</p>}
          </>
          ),
        }}
      />
    )
  }

  return (
    <SpeechBoardView
      whose={whose} mayAsk={mayAsk} busy={busy} loading={loading}
      rows={rows} openId={openId} error={error} note={note}
      onPick={(id) => setOpenId(id === openId ? null : id)}
      onAdd={add}
      open={open} reviewed={reviewed}
      bodyOpen={bodyOpen} onBodyOpen={setBodyOpen}
      draftOpen={draftOpen} onDraftOpen={setDraftOpen}
      /* **打っているそばから消えないように、控えを先に書き換える。**
         送るのは 1.2 秒だまってから(**「保存」を押させない**) */
      onTitle={(v) => { patchRow(open.id, { title: v }); later(open.id, { title: v }) }}
      onDraft={(v) => { patchRow(open.id, { draft: v }); later(open.id, { draft: v }) }}
      accents={accents} accent={accent} pool={pool}
      /* **国を変えたら、その国の1人目に付け替える**(空の欄を作らない) */
      onAccent={(id) => {
        const v = pickVoices(id, 1, PURPOSE)[0] ?? null
        patchRow(open.id, { voice_id: v })
        flush(open.id, { voiceId: v })
      }}
      onVoice={(id) => { patchRow(open.id, { voice_id: id }); flush(open.id, { voiceId: id }) }}
      tone={tone}
      onTone={(v) => { setTone(v); saveWritingTone(v, TONE_WHERE) }}
      secs={secs} onAsk={ask}
      askDelete={askDelete} onAskDelete={setAskDelete} onRemove={remove}
    >
      {/* ★ **添削が済んだスピーチは、ここまで来ない**(第5.323節)。
             上で教材の画面を返している。ここに残るのは**下書きだけ**で、
             下書きには読み上げる英文がまだ無い
             (直す前の英文を手本として聞かせない・もとからの決まり) */}
    </SpeechBoardView>
  )
}
