/**
 * ゲストの「今週の宿題」画面。
 *
 * 共有された教材を並べ、取り組んだら「やった」を記録する。
 * ゲストが書き換えられるのはこの記録だけで、
 * 提出期限やトレーナーの確認印には触れられない(列単位の権限で絞ってある)。
 */
import { useEffect, useState } from 'react'
import Loading from './Loading.jsx'
import { cefrLabel } from '../data/cefr.js'
import { exerciseType, isPassageSection, sectionLabel } from '../data/exerciseTypes.js'
import PassagePractice from './PassagePractice.jsx'
import TeachingNote from './TeachingNote.jsx'
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import SpeakButton from './SpeakButton.jsx'
import AnswerEn from './AnswerEn.jsx'
import { printElement } from '../lib/print.js'
import MaterialTitle from './MaterialTitle.jsx'
import LessonView from './LessonView.jsx'
import { kindLabel, loadMyAssignments, markAssignmentDone } from '../lib/materials.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { PrintIcon, ScreenIcon } from './Icons.jsx'
import useWordStatuses from '../lib/useWordStatuses.js'
import EnglishText from './EnglishText.jsx'
import { normWord, prefetchGlosses } from '../lib/vocab.js'
/* **その教材に並んでいる語句**(0047)。素の node で確かめられる形にしてある */
import { materialWordsOf } from '../lib/materialWords.js'
import { markIn } from '../lib/useWordStatuses.js'
import { loadMyReminder, markReminderSeen, usePracticeLog } from '../lib/practice.js'
import LessonNotes from './LessonNotes.jsx'
/* **さがす・しぼるは、トレーナーの画面とまったく同じ部品**(2026-09
   利用者の指定「今日の宿題のところにも実装してください」)。
   帯は `SearchBar`、絞り込みは `HomeworkFilter`、
   絞る・引く・並べるは `narrowHomework()` —— どれも
   トレーナーの「過去の宿題」と分け合っている。**書き写さない** */
import SearchBar from './SearchBar.jsx'
import HomeworkFilter from './HomeworkFilter.jsx'
import { emptyHomeworkFilter, homeworkFilterOn, narrowHomework } from '../lib/homeworkFilter.js'
import { loadHwSearchOpen, saveHwSearchOpen } from '../lib/slashLevel.js'

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

export default function LearnerHomework({ me = null, onPracticeWords = null }) {
  /* **書き込んだものは、ゲスト自身の記録として残す**(0025)。
     トレーナーがレッスンで書いたものと同じ置き場所になるので、
     どちらから開いても続きから始められる */
  const learnerId = me?.id ?? null
  // 担当トレーナーからのリマインド(0022)。
  // **トレーナーが押したときだけ届く。** 自動では飛ばないので、
  // 「トレーナーから」と書いても嘘にならない(2026-08 利用者の指定)
  const [reminder, setReminder] = useState(null)
  useEffect(() => {
    loadMyReminder().then(({ data }) => setReminder(data))
  }, [])

  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ。
  // 記録が付かなくても練習は止まらない(貼る前でも動く)
  usePracticeLog('homework')

  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lessonOf, setLessonOf] = useState(null)   // レッスン表示で開いている教材
  /**
   * **いま紙に出している宿題**(null なら印刷していない)。
   *
   * 【なぜ状態が要るか】(2026-08 実機「PDFを出力すると中身が白紙になります」)
   *   画面では、押したタブの演習だけを描いている。だからタブを1つも
   *   押さずに印刷すると、**見出しだけの紙**が出ていた。
   *
   * 【なぜ「隠して描いておく」だけで済ませないか】
   *   ここの演習には `PassagePractice` が入っている。あれは
   *   `usePracticeLog('six_steps')` で**取り組みの時間を数えている**ので、
   *   隠したまま置いておくと、やってもいない練習が記録されてしまう。
   *   **印刷する一瞬だけ**すべての演習を描き、終わったら元に戻す。
   */
  const [printId, setPrintId] = useState(null)
  /* **読み上げの速さの欄は置かない**(2026-09 利用者の指定で箱ごと外した)。
     この画面では演習が印刷の一瞬しか描かれないので、**1つも効いていなかった。**
     速さは「大きく表示する」の中の帯で選ぶ(選んだ値は覚える) */
  /* ── さがす・しぼる(2026-09 利用者の指定)──────────────────────
     宿題は溜まっていく(50件まで読む)。並んでいるだけでは、
     先週の記事をもう一度やり直したくても探せない。
     **トレーナーの「過去の宿題」とまったく同じ形**にする */
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState(emptyHomeworkFilter)
  const [sort, setSort] = useState('new')            // new | old
  const [searchOpen, setSearchOpen] = useState(loadHwSearchOpen)
  // 語の「知っていた / 知らなかった」。**画面を開いたときに1回だけ読む。**
  // 語ごとに問い合わせると、1画面で何十回も往復することになる。
  // 「知っていた / 知らなかった」。中身は useWordStatuses.js にある
  const { statuses: wordStatuses, mark: markWord, error: wordError } = useWordStatuses()

  const reload = async () => {
    const { data, error: e } = await loadMyAssignments()
    setLoading(false)
    if (e) { setError(e); return }
    setError(null)
    setAssignments(data)
  }

  useEffect(() => { reload() }, [])

  useEffect(() => { if (wordError) setError(wordError) }, [wordError])

  /**
   * 印刷。**すべての演習を描き終えてから**紙に送る。
   *
   * `printElement()` をボタンの中で直接呼ぶと、まだ描き替わる前の
   * 画面が紙になる(React は押した直後には描き直さない)。
   * 状態を立てて、描き終わったこの effect で送る。
   * 終わったら元の1演習だけの表示に戻す(`afterprint`。
   * Safari は返さないことがあるので、時間でも戻す)。
   */
  useEffect(() => {
    if (!printId) return undefined
    const el = document.getElementById(`homework-${printId}`)
    if (!el) { setPrintId(null); return undefined }
    const done = () => setPrintId(null)
    window.addEventListener('afterprint', done)
    const timer = window.setTimeout(done, 60000)
    printElement(el, { worksheet: true })
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
    }
  }, [printId])

  /**
   * **「大きく表示する」で開いたら、まだ控えに無い語を裏で引いておく**
   * (2026-08 実機)。
   *
   *   > 単語の意味ですが、やはり初めて調べた時に3-5秒ほどかかるので
   *   > レッスンの時間が無駄になります。
   *
   * カードの開閉をやめたので(2026-09)、拾うのは**開いたとき**にした。
   * 語に触れるのは、そこから先である。
   */
  useEffect(() => {
    const m = lessonOf
    if (!m) return
    const texts = (m.sections ?? []).flatMap((sec) => (sec.items ?? [])
      .map((it) => it.prompt_en || it.question || '')
      .filter(Boolean)
      .map((text) => ({ text })))
    prefetchGlosses(texts, { level: m.level })
  }, [lessonOf])

  /**
   * **取り組んだことを、こちらで記録する**(2026-09 利用者の指定)。
   *
   *   > やった もいらないです
   *   > やればトレーナー側でわかる仕組みにしてください
   *
   * これまではゲストが「やった」を押す申告だった。
   * **押し忘れれば「まだ」のまま**で、押しただけでも「やった」になる。
   * どちらにしてもトレーナーには本当のところが分からない。
   *
   * いまは**実際に開いたときに記録する。**
   * 記録するのは次の2つ。どちらも「宿題に取り組む」ための操作である。
   *
   *   ・「大きく表示する」で教材を開いた(取り組む場所はここだけになった)
   *   ・「印刷 / PDFで保存」で紙にした(紙で解く人はこちら)
   *
   * **1度だけ書く。** すでに日付が入っていれば触らない
   * (最初に取り組んだ日を残すため)。
   * **取り消す道は作らない。** 申告ではなく、起きたことの記録である。
   */
  const recordWorked = async (assignment) => {
    if (assignment.learner_done_at) return
    // 画面はすぐ変える。失敗したら読み直して元に戻す
    setAssignments((list) => list.map((a) =>
      a.id === assignment.id
        ? { ...a, learner_done_at: new Date().toISOString() } : a))
    const { error: e } = await markAssignmentDone(assignment.id, true)
    if (e) { setError(e); reload() }
  }

  if (loading) return <Loading />

  /* **絞る・引く・並べるは `narrowHomework()` 1か所**(トレーナーの
     画面と分け合っている)。ここで数え直すと必ず食い違う */
  const shown = narrowHomework(assignments, { filter, keyword, sort })
  const todo = shown.filter((a) => !a.learner_done_at)
  const done = shown.filter((a) => a.learner_done_at)
  /* 絞り込みで1件も残らなかったのか、そもそも宿題が無いのかを分ける。
     **黙って空にしない** */
  const narrowed = assignments.length > 0 && shown.length === 0

  return (
    <div className="stack">
      {/* **人が見てくれていると分かることが、どんなバッジより効く**
          (単語帳の「トレーナーが見ました」と同じ考え方・第5.26節)。
          これはトレーナーが**実際に押したとき**だけ出る */}
      {reminder && (
        <div className="notice notice--warn reminder" role="status">
          <strong>担当トレーナーからのリマインドです。</strong>
          {reminder.message ? ` ${reminder.message}` : ' 今週の宿題に取り組みましょう。'}
          <button type="button" className="btn btn--link reminder-close"
                  onClick={() => { markReminderSeen(reminder.id); setReminder(null) }}>
            わかりました
          </button>
        </div>
      )}
      {lessonOf && (
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    learnerId={learnerId}
                    wordStatuses={wordStatuses} onMarkWord={markWord} />
      )}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {/* **「今週の宿題」の箱は置かない**(2026-09 利用者の指定)。
            > ゲストログインしている画面のトップ、
            > 「今週の宿題」のボックスを排除します。

          中に入っていた3つは、どれも**別の場所が同じことを言っていた。**

            ・見出し「今週の宿題」 … 上の帯が画面の名前として出している
            ・「残り 3 件 / 全 8 件」 … さがす帯の札(◯ 件)と、
              カードごとの「やった / まだ」の札
            ・読み上げの速さ … **この画面では1つも効いていなかった**
              (演習は印刷の一瞬しか描かれない)。選んだ値は
              `eas.speechRate` に残るだけで、実際に使うのは
              「大きく表示する」の中の帯である。そちらで選べる

          **届いていないときの案内だけは残す。** これを消すと、
          宿題が1件も無いゲストの画面が**まっさら**になる
          (行き止まりを作らない・CLAUDE.md)。 */}
      {assignments.length === 0 && (
        <p className="card-hint">
          まだ宿題は届いていません。次のレッスンのあとに届きます。
        </p>
      )}

      {/* ── さがす・しぼる(2026-09 利用者の指定)──────────────────
            > ③ ゲストのページの中で、教材をさがせます(中略)
            > これを、ゲストとしてログインし、
            > 今日の宿題のところにも実装してください

          **トレーナーの画面をそのまま持ってこない。**
          あちらは**スクールの教材ライブラリぜんぶ**を引く画面で、
          中には**押すと課金になる操作**(読み上げ音声を作り直す)や、
          ゲストにできない操作(教材を作る・ゲストと共有する)が並んでいる。
          しかもこの画面には、同じ教材のカードが**もう出ている** ——
          並べると**同じものが2か所に出る**(CLAUDE.md)。

          だから**いま並んでいる宿題の上に、同じ形のさがす・しぼるを置く。**
          部品はトレーナーの「過去の宿題」と同じ(`SearchBar` /
          `HomeworkFilter`)なので、**見た目も操作もそろっている。**

          **取り組みの札(すべて / やった / まだ)は置かない。**
          カードの1行目に「やった / まだ」の札が出ており、
          しかも**まだのものが先に並ぶ**ので、同じことを二度言うことになる
          (同じものを2か所に出さない)。 */}
      {assignments.length > 0 && (
        <SearchBar
          title="宿題をさがす・しぼる"
          keyword={keyword}
          onKeyword={setKeyword}
          placeholder="教材名・見出しでさがす"
          count={shown.length}
          collapsible
          open={searchOpen}
          onOpenChange={(v) => { setSearchOpen(v); saveHwSearchOpen(v) }}
          /* **黙って絞らない。** 欄は畳むと見えなくなるので、
             掛かっているときだけ題のとなりに印を出す(CLAUDE.md) */
          mark={homeworkFilterOn(filter) ? 'しぼり込み中' : null}
        >
          {/* 日付・分野・場面・苦手項目。**並び順は日付の吹き出しの中**。
              選択肢は**自分に届いた宿題にあるものだけ**が出るので、
              押しても0件、ということが起きない。

              **箱の中に入れる**(2026-09 実機・利用者の指定)。
                > 日付や絞り込みのプルダンは
                > 「宿題をさがす・しぼる」の中にしまって欲しいです
              外に並べていたので、**畳んでも欄だけが残って**いた。
              「さがす」と「しぼる」は**どちらも一覧を狭める1つのこと**
              なので、開け閉めも1つでよい */}
          <HomeworkFilter
            rows={assignments}
            value={filter}
            onChange={setFilter}
            sort={sort}
            onSort={setSort}
          />
        </SearchBar>
      )}
      {narrowed && (
        <p className="card-hint">
          この条件に当てはまる宿題はありません。しぼり込みを外してください。
        </p>
      )}

      {/* **見出し(「取り組む」「やったもの」)は、1つも出さない**
            (2026-09 利用者の指定。「やったもの」→「取り組む」の順に外した)。

          **カードの1行目が、自分で名乗っている** —— 日付のとなりに
          「やった / まだ」の札があり、やったカードは全体を薄くしてある
          (`.homework-card.is-done`)。見出しは同じことを二度言っていた。
          数のほうも**さがす帯の札(◯ 件)**が同じことを言っている。

          **並びは変えていない**(取り組むものが先、やったものがあと)。
          **カードそのものは消していない** —— 消すと、一度やった宿題に
          もう一度取り組む道が無くなる(行き止まりを作らない・CLAUDE.md)。 */}
      {[
        { id: 'todo', list: todo },
        { id: 'done', list: done },
      ].map(({ id, list }) => (
        list.length > 0 && (
          <section key={id} className="stack">
            {list.map((a) => (
              <div key={a.id}
                   className={`card material-card homework-card${
                     a.learner_done_at ? ' is-done' : ''}`}>
                {/* **トレーナー側の教材カードと同じ形にする**(2026-08 利用者の指定)。
                      > ゲストエンド側の教材リストのUIデザインを
                      > トレーナーエンド側と統一してください。

                    押せることは、**押す前から**分かるようにする
                    (グレーの囲み +「中身を見る」の行・CLAUDE.md)。
                    中の並びも同じ … 日付と状態 → 見出し → カテゴリー名と日付
                    → 中身を見る。 */}
                <div className="material-head no-print">
                  {/* **開く・閉じるはやめた**(2026-09 利用者の指定)。
                      押すものははじめから出ており、囲みはただの見出しである。
                      **教材が出るところは全部同じ形にする** */}
                  <div className="material-open">
                    <div className="past-head">
                      <span className="past-date">{formatDate(a.assigned_at)}</span>
                      <span className={`badge ${a.learner_done_at
                        ? 'badge--admin' : 'badge--warn'}`}>
                        {a.learner_done_at ? 'やった' : 'まだ'}
                      </span>
                      {a.due_on && (
                        <span className="past-date">次のレッスン {a.due_on}</span>
                      )}
                    </div>
                    {/* **弱点タグを2回出さない。** 弱点は教材名の中にすでにあり、
                        `MaterialTitle` が出す(トレーナー側と同じ決まり) */}
                    <MaterialTitle
                      title={a.material?.title ?? '(教材が見つかりません)'}
                      headline={a.material?.headline}
                      hideDate
                      weakness={(a.material?.tagIds ?? []).map(weaknessTagLabel).join(' + ')}
                      fallbackTags={a.material
                        ? [(a.material.tagIds ?? []).map(weaknessTagLabel).join(' + '),
                           cefrLabel(a.material.level)] : []}
                    />
                    <div className="material-meta">
                      <span className="material-kind">{kindLabel(a.material?.kind)}</span>
                      <span className="material-when">
                        {a.material?.itemCount ? `全 ${a.material.itemCount} 問` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* **語句が単語帳に届いたことを、必ず出す**(0047・2026-09
                      利用者の指摘「今のままでは何も気づかない」)。

                    共有した時点で `add_material_words()` が単語帳へ入れて
                    いるのに、**ゲストの画面には1文字も出していなかった。**
                    「黙って入れない」を、こちら側で破っていた。

                    **数えるのは、教材の項目数ではなく自分の単語帳。**
                    0047 を貼る前は1語も入っていないので、
                    教材の数をそのまま書くと**嘘になる**(CLAUDE.md)。
                    `wordStatuses` は同じ画面がすでに読んでいるので、
                    **問い合わせは1つも増えない。** */}
                {(() => {
                  const words = materialWordsOf(a.material)
                  if (!words.length) return null
                  const norms = words.map((w) => normWord(w.en)).filter(Boolean)
                  const inBook = norms.filter((n) => wordStatuses.has(n))
                  // **入っていなければ黙る。** 0 を「0 語入りました」と言わない
                  if (!inBook.length) return null
                  const todo = inBook.filter((n) => wordStatuses.get(n) !== 'known').length
                  return (
                    <div className="hw-words no-print">
                      <p className="hw-words-line">
                        この教材の <strong>{inBook.length} 語</strong>が、
                        あなたの単語帳に入っています。
                        {todo > 0 && <> まだ <strong>{todo} 語</strong>あります。</>}
                      </p>
                      {/* **とりあえずこの語だけ、という道を置く**(利用者の指定)。
                          単語帳ぜんぶに混ざると、どれが届いた語か分からない */}
                      {onPracticeWords && (
                        <button type="button" className="btn btn--small btn--primary"
                                onClick={() => onPracticeWords(
                                  words.map((w) => w.en), a.material?.title ?? '',
                                )}>
                          この教材の語だけ練習する
                        </button>
                      )}
                    </div>
                  )
                })()}

                {a.material?.instruction_ja && (
                  <TeachingNote text={a.material.instruction_ja} title="やること" tone="todo" defaultOpen />
                )}

                <div id={`homework-${a.id}`}>
                    <div className="print-only print-head">
                      <MaterialTitle title={a.material?.title} headline={a.material?.headline}
                                     as="strong" size="sheet" />
                      <div className="print-meta">
                        {cefrLabel(a.material?.level)} / {kindLabel(a.material?.kind)}
                        {' / '}共有 {formatDate(a.assigned_at)}
                        {a.due_on && ` / 次のレッスン ${a.due_on}`}
                        {/* 何の練習だったのかを、紙にも残す。
                            トレーナー側の紙には入っていて、ゲスト側だけ
                            抜けていた(2026-08 の見直し) */}
                        {a.material?.tagIds?.length
                          ? ` / ${a.material.tagIds.map(weaknessTagLabel).join('・')}` : ''}
                      </div>
                    </div>
                    {/* **印刷を、大きく表示するの上に置く**(2026-09 利用者の指定)。
                          > 印刷する/PDFで保存するを大きく表示するの上に
                          > 置いてください
                        紙にして手元で解くほうが先に来る、という順序である */}
                    <div className="btn-row no-print">
                      <button type="button" className="btn btn--small"
                              onClick={() => { setPrintId(a.id); recordWorked(a) }}>
                        <PrintIcon />印刷 / PDFで保存(問題のみ)
                      </button>
                      <button type="button" className="btn btn--small btn--primary"
                              onClick={() => { setLessonOf(a.material); recordWorked(a) }}>
                        <ScreenIcon />大きく表示する
                      </button>
                    </div>
                    {/* **「ここに注意」は出さない**(2026-09 利用者の指定)。
                        > 赤で囲った部分は必要ないです。
                        > 教材のあるところ全てで適用してください。
                        **`TeachingNote` の見た目は変えていない。** 出す場所だけの話 */}

                    {/* **演習のタブは置かない**(2026-09 利用者の指定)。
                        > 赤で囲った部分は必要ないです。
                        > 教材のあるところ全てで適用してください。(ゲストエンドでも同じ)

                        取り組むのは「大きく表示する」、持ち出すのは「印刷」。
                        カードの中では、日付・教材名・何問あるかだけが分かればよい。

                        **描くのは、紙に出す一瞬だけ**(`printId`)。
                        隠したまま置いておくと、`PassagePractice` が
                        **やってもいない練習の時間を数えてしまう**(CLAUDE.md)。 */}
                    {a.material?.sections
                      .filter(() => printId === a.id)
                      .map((sec) => {
                      const cls = 'exercise-view is-closed'
                      const type = exerciseType(sec.exercise_type)
                      // 記事・会話は「問」ではなく1本の読み物。
                      // 声に出す練習は、この中で取り組み方を切り替える。
                      if (isPassageSection(sec.exercise_type)) {
                        return (
                          <section key={sec.id} className={cls}>
                            {/* **本文の名前は種類に合わせる**(Speech練習で「記事」と出ていた) */}
                            <h5 className="section-title">
                              {sectionLabel(a.material?.kind, sec.exercise_type)}
                            </h5>
                            {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                            <PassagePractice
                              section={sec}
                              /* 途中経過を教材ごとにまとめて消せるようにするため、
                                 教材の id も渡す(`src/lib/progress.js`) */
                              materialId={a.material?.id}
                              learnerId={learnerId}
                              tags={a.material?.tagIds}
                              voiceIds={a.material?.voiceIds}
                              headline={a.material?.headline}
                              isDialogue={sec.exercise_type === 'dialogue'}
                              level={a.material?.level}
                              wordStatuses={wordStatuses}
                              onMarkWord={markWord}
                            />
                          </section>
                        )
                      }
                      return (
                        <section key={sec.id} className={cls}>
                          <h5 className="section-title">
                            {sectionLabel(a.material?.kind, sec.exercise_type)}({sec.items.length} 問)
                          </h5>
                          {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                          {/* 解答を隠す演習は、紙に書き込む余白を出す */}
                          <ol className={`material-preview${
                            type?.hideAnswerFromLearner ? ' writable' : ''}`}>
                            {sec.items.map((it) => (
                              <li key={it.id}>
                                {/* 混合ドリルでは、どの弱点の問題かを見せる。
                                    何に注意して解くかが分からないと練習にならない。 */}
                                {it.tag_id && (
                                  <span className="item-tag">{weaknessTagLabel(it.tag_id)}</span>
                                )}
                                {/* 読み上げ。リスニングは英文を見せずに音だけ出す。
                                    聞く手段が無いと、この演習は解きようがない。 */}
                                {type?.audioFrom && it[type.audioFrom] && (
                                  <div className="item-audio">
                                    <SpeakButton
                                      text={it[type.audioFrom]}
                                      clipVoice={resolveVoices(a.material?.voiceIds)[0]}
                                      tier={voiceTierFor({
                                        exerciseType: sec.exercise_type,
                                        tags: a.material?.tagIds,
                                      })}
                                    />
                                  </div>
                                )}
                                {/* リスニングは英文を見せない。聞いて答えるため。 */}
                                {!type?.hidePromptFromLearner && it.prompt_en && (
                                  <div className="homework-en">
                                    <EnglishText text={it.prompt_en} textJa={it.prompt_ja} level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markIn(markWord, a.material?.id)} />
                                    <Phonetic value={it.phonetic} />
                                    <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                                 level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markIn(markWord, a.material?.id)} />
                                  </div>
                                )}
                                {it.prompt_ja && <div>{it.prompt_ja}</div>}
                                {it.question && (
                                  <div className="homework-en">
                                    <EnglishText text={it.question} level={a.material?.level}
                                                 statuses={wordStatuses} onMark={markIn(markWord, a.material?.id)} />
                                  </div>
                                )}
                                {/* 設問の訳(0035)。**伏せない。**
                                    設問は「何を訊かれているか」であって、答えではない */}
                                {it.question_ja && <div className="answer-ja">{it.question_ja}</div>}
                                {it.hint && <div className="field-hint">与える語: {it.hint}</div>}
                                {/* 解答は、答えを考える前に見えてはいけない */}
                                {it.answer && type?.hideAnswerFromLearner ? (
                                  <details className="answer">
                                    <summary>解答を見る</summary>
                                    {/* 解答も**語に触れれば意味が出て、単語帳に入れられる。**
                                        訳と読み上げも付く(2026-09 利用者の指定)。
                                        **`<details>` の中なので、開くまでは鳴らせない。**
                                        答えが先に耳から入ることはない */}
                                    <AnswerEn
                                      text={it.answer} ja={it.answer_ja} level={a.material?.level}
                                      statuses={wordStatuses}
                                      onMark={markIn(markWord, a.material?.id)}
                                      clipVoice={resolveVoices(a.material?.voiceIds)[0]}
                                      tier={voiceTierFor({
                                        exerciseType: sec.exercise_type,
                                        tags: a.material?.tagIds,
                                      })}
                                    />
                                    {it.answer_alt && (
                                      <div className="muted">別解: {it.answer_alt}</div>
                                    )}
                                    {it.note && <div className="field-hint">{it.note}</div>}
                                  </details>
                                ) : (
                                  it.note && <div className="field-hint">{it.note}</div>
                                )}
                              </li>
                            ))}
                          </ol>
                        </section>
                      )
                    })}
                </div>

                {/* **「やった」のボタンは置かない**(2026-09 利用者の指定)。
                    開いた時点で記録されるので、押してもらう必要がない。
                    ただし**黙って記録しない。** 記録されたことは静かに出す */}
                {a.learner_done_at && (
                  <p className="muted homework-worked">
                    {formatDate(a.learner_done_at)} に取り組みました
                  </p>
                )}
              </div>
            ))}
          </section>
        )
      ))}

      {/* ── セッションの記録(0032・2026-09 利用者の判断「ゲストにも見せる」)
          レッスンでトレーナーが書いた記録。**ここでは読むだけ。**
          畳んである。開いたときに初めて読みに行くので、
          見ない人には通信も起きない */}
      {learnerId && (
        <details className="card notes-card">
          <summary className="card-title">セッションの記録</summary>
          <p className="card-hint">
            レッスンで担当トレーナーが書いた記録です。日付ごとに残ります。
          </p>
          <LessonNotes learnerId={learnerId} />
        </details>
      )}
    </div>
  )
}
