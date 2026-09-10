/**
 * 単語帳 — 覚えるための画面。
 *
 * ============================================================================
 * 【考え方】(2026-08 の調査と、利用者の指定)
 *
 *   記憶は**思い出そうとしたときに**強くなる。読み返した回数ではない。
 *   だから語と意味を同時には出さない。**答えを見る前に、必ず1回考える。**
 *
 *   売れている単語アプリの中核は**4択の高速タップ**である(1語2秒)。
 *   ただし4択は「見て分かる」であって、「口から出る」より弱い。
 *   **どちらか一方では足りない。**
 *
 *   そこで **同じ語が、覚えるにつれて勝手に難しくなる**ようにした。
 *   0015 で入れた箱(0〜6)を、間隔だけでなく出題の形にも使う
 *   (`src/lib/wordQuiz.js`)。
 *
 *     箱 0〜1 → 4択      触れる回数を稼ぐ
 *     箱 2〜3 → 思い出す  意味を引き出す
 *     箱 4〜5 → 日本語→英語 話すときに出てくる
 *     箱 6    → つづり    メールで書ける
 *
 * 【10語で区切る】
 *   **終わりの見えない作業は続かない。** 残り全部ではなく10語で区切り、
 *   終わったら結果を出す。もう一度押せば次の10語。
 *
 * 【続けた記録は「週」で数える】(0019)
 *   日ごとの連続記録は1日休んだだけで途切れる。**途切れる記録は、
 *   途切れた瞬間にやめる理由になる。** レッスンが週2回なのだから週が自然。
 *
 * 【トレーナーが見ている】
 *   人が見ていると分かることが、どんなバッジより効く。
 *   トレーナーが単語帳を開いた記録を、ここに出す(0019)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Loading from './Loading.jsx'
import SessionResult from './SessionResult.jsx'
import CollectRows from './CollectRows.jsx'
import GoalBar from './GoalBar.jsx'
import {
  KNOWN_AFTER, canMarkKnown,
  loadGlossDetail, loadMyWordbook, loadVocabWeek, loadVocabByIndustry,
  loadWordbookCounts, loadWordbookViewers, learningSupported,
  noteWordbookView, normWord, setWordStatus,
} from '../lib/vocab.js'
import {
  QUIZ_FORMS, buildSession, isSelfGraded, makeChoices, pickForm, spellMatches,
} from '../lib/wordQuiz.js'
import ReviewScope from './ReviewScope.jsx'
import ReviewStats from './ReviewStats.jsx'
import WordRadio from './WordRadio.jsx'
import { listTracks } from '../lib/bgm.js'
import { loadRateId, rateOf } from '../lib/speechRate.js'
import {
  SCOPES, WORD_GROUPS, groupLead, loadScope, loadSize, runKeyOf, saveScope, saveSize,
  scopeCounts, scopePool, shouldRecord, takeCount, todayKey,
} from '../lib/reviewScope.js'
import { clozeAt } from '../lib/clozeSentence.js'
import { NO_GOAL, loadWeeklyGoal } from '../lib/goals.js'
import { shortDate } from '../lib/format.js'
import { useWide } from '../lib/nav.js'
import SpeakButton from './SpeakButton.jsx'
import { usePracticeLog } from '../lib/practice.js'
import WordbookFilter, { applyWordbookFilter, countNarrowed, emptyFilter } from './WordbookFilter.jsx'
import { answerFeedback } from '../lib/haptics.js'
import WordbookAdd from './WordbookAdd.jsx'
import BasicWordsPick from './BasicWordsPick.jsx'
import { basicJaOf, basicPosOf } from '../lib/basicsCourse.js'
import { posGroupOf, posLabel } from '../lib/posGroups.js'
import { CloseIcon, FocusIcon, MusicIcon } from './Icons.jsx'
import { lockScroll } from '../lib/scrollLock.js'

/**
 * 画面の切り替え(2026-08 利用者の指定・0027)。
 *
 *   > 今日の復習というボタンにせず、復習にし、選んだら基本は今日のものから
 *   > 出題するようにそして日付ボタンも入れます。知らなかったボタンは
 *   > 必要ありません。
 *
 * 「復習」は**日を絞らなければ今日の分**を出す。日付を選ぶと、
 * その日に単語帳へ入った語から出す。
 * 「知らなかった」は外した(復習と役割が重なっていた)。
 */
/**
 * 何を読み込むか。**id は札(`WORD_GROUPS`)の id とそろえてある。**
 *
 * `due` だけが既定で、まだ + 覚えかけ をまとめて読む(0027 の 'todo')。
 * 残りの3つは**札を押したときの段**である(2026-09 利用者の指定)。
 *
 *   > それぞれ数を示すだけではなく、
 *   > タッチすればそれらを復習できるようにしたいです。
 *
 * **どれでも復習できる。** 以前は `due` だけが出題で、
 * 覚えかけ・覚えた は**見返すだけの一覧**だった。
 */
const VIEWS = [
  { id: 'due', label: '復習', status: 'todo', dueOnly: false },
  { id: 'unknown', label: 'まだ', status: 'unknown', dueOnly: false },
  { id: 'learning', label: '覚えかけ', status: 'learning', dueOnly: false },
  { id: 'known', label: '覚えた', status: 'known', dueOnly: false },
  // **「積み上がり」はここから外した**(2026-08 利用者の指定)。
  //   > 積み上がりは一旦そこからは削除です。
]

/* **`todayKey` と `isDueNow` は `reviewScope.js` から来る**(2026-09)。
   ここに同じものを書いていたが、Quick Response の復習でも同じ判定が要る。
   **数え方を2通り持たない**(CLAUDE.md)。 */


/** 出会った文。その語のところを太字に。伏せるときは下線に置き換える */
function SeenIn({ sentence, word, hide = false }) {
  if (!sentence) return null
  /* **どこを伏せるかは `clozeAt()` 1か所**(`clozeSentence.js`)。
     ここで `indexOf` を使っていたので、`in` が **`internal` の中**に当たり、
     `___ternal` という問題にならない伏せ方になっていた(2026-09)。
     穴埋めの形を足したついでに、探し方を1つにそろえてある */
  const found = clozeAt(sentence, word)
  if (!found) return <p className="wordbook-seen" lang="en">{sentence}</p>
  return (
    <p className="wordbook-seen" lang="en">
      {found.before}
      {hide
        ? <span className="wordbook-blank" aria-label="ここに入る語">　　　</span>
        : <strong>{found.hit}</strong>}
      {found.after}
    </p>
  )
}

/**
 * **穴埋めの出題**(2026-09 利用者の指定)。
 *
 * 出会った文(`seen_in`)の、その語だけを伏せて出す。
 * **答えは足すのではなく、同じ場所で入れ替える**(カードが伸びない・
 * CLAUDE.md)。開いたら、伏せていたところに語が戻り、意味が下に付く。
 *
 * **材料は新しく作らない。** `seen_in` は 0018 から入っているので、
 * **AI を1回も呼ばず、費用は1円もかからない。**
 */
function ClozeFace({ sentence, word, meaning, shown }) {
  const found = clozeAt(sentence, word)
  // ここへ来るのは `pickForm()` が落とし損ねたときだけ。**当てずっぽうで出さない**
  if (!found) return null
  return (
    <div className="wordcard-cloze">
      <p className="wordcard-cloze-en" lang="en">
        {found.before}
        {shown
          ? <strong className="wordcard-cloze-hit">{found.hit}</strong>
          : <span className="wordbook-blank" aria-label="ここに入る語">　　　</span>}
        {found.after}
      </p>
      {shown && (
        <p className="wordcard-cloze-ja">{meaning || '(意味の控えがありません)'}</p>
      )}
    </div>
  )
}

/** 単語帳から深掘りする。**控えを読むだけ。AI に尋ね直さない** */
function Detail({ wordNorm }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let alive = true
    loadGlossDetail(wordNorm).then(({ data }) => { if (alive) setRows(data ?? []) })
    return () => { alive = false }
  }, [wordNorm])
  if (rows === null) return <Loading />
  const senses = rows.flatMap((r) => (Array.isArray(r.senses) && r.senses.length
    ? r.senses : [{ pos: r.pos || posLabel(posGroupOf(basicPosOf(r.word_norm))), meaning_ja: r.meaning_ja }]))
  if (!senses.length) return <p className="hint">くわしい控えはまだありません。</p>
  return (
    <ul className="wordbook-detail">
      {senses.map((se, i) => (
        <li key={i}>
          {se.pos && <span className="etext-pos">{se.pos}</span>}
          <span className="wordbook-detail-mean">{se.meaning_ja}</span>
          {se.example_en && <span className="wordbook-detail-ex" lang="en">{se.example_en}</span>}
          {se.note && <span className="wordbook-detail-note">{se.note}</span>}
        </li>
      ))}
    </ul>
  )
}

/* `level`(CEFR)は「積み上がり」で使っていた。いったん外したので受け取らない
   (2026-08 利用者の指定)。戻すときは App からまた渡す */
/**
 * @param learnerId    **誰の単語帳か。** 渡さなければ自分のもの。
 *   トレーナーがゲストのカードから開くときは、そのゲストの id を渡す
 * @param learnerName  題に出す名前(ゲストのときだけ)
 * @param onMakeMaterial 語を選んで教材を作る(トレーナーのときだけ)
 */
/**
 * 名前に「さん」を付ける。**すでに付いていれば付けない**(2026-09 実機)。
 * 実際の名前が「田内さん」で、「田内さん さんの単語帳」と出ていた。
 */
const honor = (name) => {
  const s = String(name ?? '').trim()
  if (!s) return ''
  return /(さん|様|先生)$/.test(s) ? s : `${s} さん`
}

export default function Wordbook({
  learnerId = null, learnerName = '', onMakeMaterial = null,
  /**
   * **その教材の語だけに絞る**(0047・2026-09 利用者の指摘)。
   *
   *   > とりあえずその単語とフレーズだけに取り組めるよう(任意)に
   *   > しないと、今のままでは何も気づかない
   *
   * 「今週の宿題」から「この教材の語だけ練習する」を押すと、ここへ来る。
   * **教材の id では絞れない** —— すでに単語帳にあった語は
   * `add_material_words()` が触らないので(箱を戻さないため)、
   * **前の教材の名前を持ったまま**である。だから**語そのもの**で絞る。
   *
   * `only`(教材に並んでいる語句)と `onlyLabel`(教材名)。
   * **絞っていることは必ず画面に出し、外す道もその場に置く**(行き止まりを作らない)。
   */
  only = null, onlyLabel = '', onClearOnly = null,
  /**
   * **何で絞っているのか**(2026-09)。既定は教材である。
   * 基礎単語(基本360語 / 標準1200語)から絞ったときは
   * 「この教材の語だけ」と出すと**嘘になる**ので、呼ぶ側が言葉を渡す。
   */
  onlyWhat = 'この教材の語',
  /**
   * **基礎単語の段だけを練習する**(0053・2026-09 利用者の指定)。
   *
   *   > 講座の中の単語はそれぞれ基本360語、標準1200語、として
   *   > そもそもが独立して選べる単語帳にしてください
   *
   * 絞り込みそのものは **`App.jsx` が1つだけ持っている**(`onlyWords`)。
   * ここで別の絞り込みを持つと、**同じことをする道が2つ**になる。
   * だから「この語だけにしてください」と外へ知らせるだけにする
   * (「今週の宿題」の `onPracticeWords` とまったく同じ形)。
   */
  onPickWords = null,
}) {
  /* **画面は1つだけ。** 以前はトレーナー用に別の部品を持っていたが、
     2つあると必ず片方が古くなる。実際、見た目をそろえたつもりで
     「おまかせ」も出題もゲスト側に無いままだった(2026-09 実機)。
     **同じ部品に、誰の単語帳かを渡すだけにする。** */
  const mine = !learnerId

  /* **その教材の語だけに絞る**(0047)。そろえ方は `normWord` 1か所を通す
     (SQL / 窓口 / 画面の3か所でそろえてある規則を、ここで書き写さない)。

     **見張りは「つないだ文字列」にする。** 親から毎回 `[...]` が
     渡ってくると、配列そのものは描き直すたびに別のものになり、
     読み直しが止まらなくなる(`useMemo` の見張りに `voicePool` を
     入れて引き直しが止まらなくなったのと同じ落とし穴)。 */
  const onlyKey = (only ?? []).join('\u0000')
  const onlySet = useMemo(
    () => {
      const norms = (only ?? []).map(normWord).filter(Boolean)
      return norms.length ? new Set(norms) : null
    },
    [onlyKey],
  )

  // 取り組みを**裏で数える**(0022)。
  // レッスン中に一緒に取り組んだぶんは**ゲストの記録**にする(0025)
  usePracticeLog('wordbook', true, learnerId)

  const [view, setView] = useState('due')
  /**
   * **復習を、集中モードと同じ形で出しているか**(2026-09 利用者の指定
   * 「単語帳モード、集中モードにしよう」)。
   *
   * 単語帳は上に札・プルダウン・絞り込みが積み重なっていて、
   * スマホでは**カードが画面の下のほうから始まっていた。**
   * 出題を画面ぴったりの1枚にすれば、送るものが無くなり、
   * **1語だけに向き合える**(`FocusReader` と同じ考え方)。
   *
   * **既定は「出す」。** 復習の札を押した人は、もう答える気で来ている。
   * 入口をもう1つ挟むと、そのぶん遠くなる
   * (利用者の言葉「そもそも集中モードというものをおかずに
   *  集中モードのように表示されるのが理想」)。
   * 「とじる」で一覧に戻れる。
   *
   * **既定は「まだ始めていない」に変えた**(2026-09 利用者の指定)。
   *
   *   > 結局ただランダムに出てくるだけですごく仕組みが分かりにくい。
   *   > ここを意図をもって練習できるように変更したい。
   *
   * 開いた瞬間に出題が始まると、**何が出ているのかを選ぶ機会がない。**
   * いまは範囲と語数の札(`ReviewScope`)を先に出し、押したらそのまま
   * 集中モードに入る。**入口が2つになったわけではない** ——
   * 「集中モードを開く」という段は、いまも1つも挟んでいない。
   */
  const [running, setRunning] = useState(false)
  /* **聞き流し**(2026-09 利用者の指定「音楽を流しながらどんどん登録されて
     いる単語が読まれるモード」)。答える練習ではないので、
     **記録は1ミリも動かさない**(`WordRadio` の中でも呼んでいない) */
  const [radio, setRadio] = useState(null)      // 読む語の一覧。null なら出さない
  const [tracks, setTracks] = useState([])      // 曲(無ければ音楽は流れない)
  const [want, setWant] = useState('auto')      // 出題の形。auto は箱に合わせる
  const [rows, setRows] = useState([])          // その一覧ぜんぶ
  /* **入った日と教材で絞る**(0024・2026-08 利用者の指定)。
     絞り込みは手元で行う。選ぶたびに聞き直さない */
  const [filter, setFilter] = useState(emptyFilter)
  const [queue, setQueue] = useState([])        // いまの10語
  const [result, setResult] = useState(null)    // 終わったときの結果
  const [counts, setCounts] = useState({ due: 0, unknown: 0, learning: 0, known: 0 })
  const [week, setWeek] = useState({ days: 0, answered: 0, correct: 0, weeks: 0 })
  const [viewers, setViewers] = useState([])
  /** 業界別のそろい具合(0019 の `vocab_by_industry`)。**集める楽しみ** */
  const [fields, setFields] = useState([])
  /** 週の目標(0042)。**決めるのはトレーナー。** ここは出すだけ */
  const [goal, setGoal] = useState(NO_GOAL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [shown, setShown] = useState(false)     // 答えを出したか
  /* **出会った文は、畳んでおく**(2026-08 利用者の指定)。
       > 例文は折りたたみ式で、基本はスマホで見た時に4択の全てが
       > 画面内に収まるようにしたいです。
     長い文が開いたままだと、答えの4択が画面の外へ出てしまう。 */
  const [seenOpen, setSeenOpen] = useState(false)
  const [deep, setDeep] = useState(false)
  const [typed, setTyped] = useState('')        // つづりの入力
  const [judged, setJudged] = useState(null)    // 4択・つづりの判定
  /** 4択で押した選択肢。**まちがいを赤くする相手**を見分けるために持つ */
  const [pickedChoice, setPickedChoice] = useState(null)
  const doneRef = useRef([])                    // この10語の結果
  /** いま出している1語のカード。**画面のまん中に置く**ために場所を測る */
  const cardRef = useRef(null)
  /** 進み具合の行。狭い画面では、ここを画面の上にそろえる */
  const runRef = useRef(null)
  /** 10語やり終えたときの結果。**ここも同じ場所に置く** */
  const resultRef = useRef(null)
  /* **いまの一覧の控え。** 出題を組むときだけ使う。
     見張りに `rows` そのものを入れると、1語答えるたびに組み直してしまう */
  const rowsRef = useRef([])
  rowsRef.current = rows
  /** 出題を組み直す合図。読み直したときだけ1つ進む */
  const [deal, setDeal] = useState(0)
  /**
   * **出題範囲と、1回ぶんの語数**(2026-09 利用者の指定)。
   *
   *   > 出題範囲の時系列での絞りかた(例:１週間以内・２週間以内…)、
   *   > その時に復習したい単語やフレーズ、文章の個数だ。
   *
   * もとは**カレンダーで1日**しか選べず、語数は10で固定だった。
   * 「先週ぜんぶ」を選ぶ道が、どこにも無かった。
   *
   * 算段は `reviewScope.js`、見た目は `ReviewScope.jsx` **1か所**。
   * Quick Response の復習とまったく同じものを使う。**書き写さない。**
   *
   * 【「おさらい」は、この札の「ぜんぶ」に吸収した】
   *   あちらは「期限を見ずに、単語帳ぜんぶからランダム」で、
   *   **`scope = 'all'` とまったく同じもの**である。
   *   ボタンを別に置くと**同じことをするものが2つ**になる。
   *   機能は消えていない —— これまでは**0件になるまで見えなかった**ので、
   *   むしろ届きやすくなる。
   */
  const [scope, setScope] = useState(() => loadScope('word'))
  const [size, setSize] = useState(() => loadSize('word'))
  /** 始めたか。**札を選んでから始める**ので、開いた瞬間には出さない */
  const [started, setStarted] = useState(false)
  /**
   * **この回で「覚えかけ」を記録した語。**
   *
   * 同じ範囲を続けて回したときに、同じ語を二度進めないための控え
   * (`shouldRecord` の `already`)。読み直せば消える —— そのときには
   * `due_on` が新しくなっているので、控えが無くても正しく判定できる。
   */
  const gradedRef = useRef(new Set())
  /* **選んだ語で、その場で教材を作る**(ここが循環の要)。
     トレーナーがゲストのカードから開いたときだけ使う。
     絞り込みを変えても選択は消さない(集めて教材にするため) */
  const [picked, setPicked] = useState([])

  /* **0027 を貼る前の Supabase には「覚えかけ」が無い**(2026-09 実機)。
     一度断られたら、その画面のあいだは出さない。
     **効かないボタンを出さない**(CLAUDE.md)。`noLearning` は
     `vocab.js` に1つだけ置いてあり、押して初めて分かる */
  /** 広い画面か。**判断は幅だけ**(`useWide`・CLAUDE.md)。UA は見ない */
  const wide = useWide()
  const canLearning = learningSupported()
  // 「覚えかけ」を見ている最中に使えないと分かったら、復習へ戻す。
  // 選択肢から消えたのに選ばれたままだと、プルダウンが空欄になる
  const current = (!canLearning && view === 'learning')
    ? VIEWS[0]
    : VIEWS.find((v) => v.id === view) ?? VIEWS[0]
  /* **どの段でも出題する**(2026-09 利用者の指定)。
     以前は `current.id === 'due'` で、覚えかけ・覚えた は
     **見返すだけ**だった。押せる札にした以上、押した先で復習できないと
     意味がない。一覧のほうは `due` 以外でこれまでどおり下に出る */
  const isQuiz = true
  /** いま押している段。`due`(既定)なら、押していない */
  const group = current.id === 'due' ? null : current.id

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, tally, wk, seen, byField, aim] = await Promise.all([
      current.status
        ? loadMyWordbook({
          status: current.status, dueOnly: current.dueOnly, limit: 200, learnerId,
        })
        : Promise.resolve({ data: [] }),
      loadWordbookCounts(learnerId), loadVocabWeek(learnerId),
      // 「トレーナーが見ました」は**ゲスト本人にだけ**出す知らせである
      mine ? loadWordbookViewers() : Promise.resolve({ data: [] }),
      /* **集める楽しみ**(2026-09 利用者の指定)。0019 からある窓口だが、
         **どこからも呼んでいなかった。** 読むのは開いたときの1回だけ */
      loadVocabByIndustry(learnerId),
      /* **週の目標**(0042)。0042 を貼る前は 0 が返るので、何も出ない */
      loadWeeklyGoal(learnerId),
    ])
    setLoading(false)
    if (tally.data) setCounts(tally.data)
    if (wk.data) setWeek(wk.data)
    if (seen.data) setViewers(seen.data)
    if (byField.data) setFields(byField.data)
    if (aim.data) setGoal(aim.data)
    if (list.error) { setError(list.error); return }
    setError(null)
    /* **絞るのは、ここ1か所**(0047)。読み込んだ直後に落としておけば、
       出題(`buildSession`)も4択のまちがいも札の数え上げも、
       **下流はいっさい触らずに**その教材の語だけになる。
       画面のあちこちで `rows` を絞り直すと、必ずどこかが食い違う */
    /* **意味の控えが無い基礎単語には、ファイルの訳を出す**(0053)。
       段まるごと(360〜1,200語)を入れると、そのどれにも
       `word_glosses` の控えが無い。そのままでは
       「(意味の控えがありません)」が並び、**4択も作れない**
       (まちがいの選択肢は意味から作るため)。

       **窓口(AI)は1回も呼ばない = 0円。** 訳は `basicWords.js` に
       もう書いてある。`review_words()`(0047)が教材の `prompt_ja` を
       出すのと**まったく同じ考え方**である。

       **当てるのはここ1か所。** 下流(出題・4択・一覧・聞き流し)は
       いっさい触らない。控えがある語は**1文字も書き換えない** */
    const filtered = onlySet
      ? (list.data ?? []).filter((r) => onlySet.has(r.word_norm))
      : (list.data ?? [])
    const got = filtered.map((r) => {
      /* 訳も品詞も、**控えがある語は1文字も書き換えない**(0053)。
         品詞まで当てるのは 2026-09 利用者の指定
         「全ての単語に対して効くようにして欲しいのが、
          品詞ごとに分ける絞り込み機能です」——
         基礎単語には控えが無いので、当てないと **1,200 語がまるごと
         「品詞で絞れない語」**になり、「全ての単語に効く」にならない */
      if (r.meaning_ja && r.pos) return r
      return {
        ...r,
        meaning_ja: r.meaning_ja || basicJaOf(r.word_norm),
        /* **画面には日本語で出す。** 基礎単語の印は `n` / `v` なので、
           そのまま入れると札に「n」と出る(語の上の小さな札・CLAUDE.md)。
           **対応表はここに書かない** —— `posGroups.js` の名前を借りる */
        pos: r.pos || posLabel(posGroupOf(basicPosOf(r.word_norm))),
      }
    })
    setRows(got)
    rowsRef.current = got
    setQueue([])
    doneRef.current = []
    setResult(null)
    setShown(false); setDeep(false); setTyped(''); setJudged(null); setSeenOpen(false)
    setPickedChoice(null)
    // **読み直したときだけ組み直す。** 答えたときには組み直さない
    setDeal((n) => n + 1)
  }, [current.status, current.dueOnly, learnerId, mine, onlySet])

  useEffect(() => { reload() }, [reload])

  /* **トレーナーが見たことを残す**(0019)。ゲストの画面に
     「担当トレーナーが 8/29 にこの単語帳を見ました」と出る。
     **人が見ていると分かることが、どんなバッジより効く。**
     ゲストを切り替えたときだけ。開くたびに何度も残さない */
  useEffect(() => {
    if (learnerId) noteWordbookView(learnerId)
    setPicked([])
  }, [learnerId])

  /* 「今日出すもの」の判定は **`isDueNow()`(`reviewScope.js`)1か所。**
     入れたばかりの語もその日のうちに出す、という決まりもそちらにある
     (2026-09 実機「単語を手打ちで登録しても反映されません」)。
     Quick Response の復習でもまったく同じ判定が要るので、
     **数え方を2通り持たない**(CLAUDE.md)。 */

  const shownRows = applyWordbookFilter(rows, filter)

  /* **札に出す「今日出す数」は、実際に出るものと同じ数え方にする。**
     数え上げ(`counts.due`)は表を直に見ているので、0030 を貼る前は
     「入れたばかりの語」を数えない。**出るのに 0 と書いてあると、
     やり切ったと思ってしまう**(2026-09 実機と同じ食い違い) */
  /* **「復習(N)」は、プルダウンごと消えた**(2026-09)。
     「今日出す」の数は、下の範囲の札(`ReviewScope`)がそのまま出している。
     **同じ数を2か所に出さない**(CLAUDE.md)。
     期限の判定そのもの(`isDueNow`)は `scopeCounts` の中で今も効いている */

  /**
   * 復習に出す10語を組む(2026-08 利用者の指定・0027)。
   *
   *   > 復習にし、選んだら基本は今日のものから出題するように
   *   > そして日付ボタンも入れます。
   *
   * **日を選んでいなければ、今日出すもの**(`due_on` が今日まで)。
   * 日を選んだら、**その日に単語帳へ入った語**から出す。
   * 並びは `buildSession()` が決める(まだ → 覚えかけ)。
   *
   * **絞り込みを変えたら組み直す。** 変えても前の10語のままだと、
   * 何のために選んだのか分からない。
   */
  /** 何かで絞っているか。**1つでも絞っていれば、日で切らない** */
  /**
   * **「その教材の語だけ」を出していることを、必ず画面に出す**(0047)。
   *
   * 黙って絞ると、単語帳がまるごと減ったように見える。
   * **外す道も、その場に置く**(行き止まりを作らない・CLAUDE.md)。
   * 中身は1つだけ書き、**集中モードの帯と一覧の2か所に置く。**
   */
  const onlyNote = onlySet ? (
    <p className="wb-only">
      <span className="wb-only-label">
        {/* **何で絞っているのかは、呼ぶ側が言う**(0053)。
            基礎単語で絞ったときに「この教材の語だけ」と出すと嘘になる */}
        {onlyWhat}だけ
        <span className="wb-only-n">{rows.length} 語</span>
      </span>
      {/* **教材の名前は、札の外に置く。** AI が付ける名前は長いことがあり、
          札の中に入れると狭い画面で折り返して読めなくなる
          (弱点の札で踏んだのと同じ話・CLAUDE.md) */}
      {onlyLabel && <span className="wb-only-name">{onlyLabel}</span>}
      {onClearOnly && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onClearOnly}>
          単語帳ぜんぶに戻す
        </button>
      )}
    </p>
  ) : null

  /* **「その教材の語だけ」に絞っているときは、期限で切らない**(0047)。
     20語のうち今日出るのが2語だと、押した人には
     「その教材の語を練習する」に見えないためである。
     いまは**範囲の札そのもの**が期限を見るかどうかを決めるので、
     ここでは**開いた瞬間の札**を「ぜんぶ」にしておくだけでよい */
  useEffect(() => {
    setScope(onlySet ? 'all' : loadScope('word'))
  }, [onlySet])

  /** 絞り込みを当てたあとの一覧。**範囲の数え上げも出題も、ここから** */
  /** いくつ絞っているか。**畳んでいても分かるように**札の数として渡す */
  const narrowed = countNarrowed(filter)
  const forScope = shownRows

  /**
   * 段の札を押したとき。**範囲は「ぜんぶ」に移す**(2026-09 利用者の指定)。
   *
   * 「覚えた」語は次に出る日が先なので、範囲が「今日出す」のままだと
   * **押した瞬間に0件**になる。押せたのに何も出ないのは、
   * いちばん分かりにくい形である。外したら、覚えている範囲へ戻す。
   */
  const pickGroup = (id) => {
    setView(id ?? 'due')
    setScope(id ? 'all' : loadScope('word'))
  }

  /* **選んでいた札が0件になったら、押せる札へ移す。**
     黙って空のまま置くと「出すものがありません」だけが残る
     (`pickScene` と同じ作法・CLAUDE.md) */
  const scopeN = scopeCounts(forScope, todayKey())
  /** いま選んでいる範囲の残り。**札の数え上げと同じ道を通す**(2通り持たない) */
  const restInScope = scopeN[scope] ?? 0
  useEffect(() => {
    if (!isQuiz || loading || forScope.length === 0) return
    if ((scopeN[scope] ?? 0) > 0) return
    const next = SCOPES.find((s) => (scopeN[s.id] ?? 0) > 0)
    if (next) setScope(next.id)
  }, [isQuiz, loading, forScope.length, scopeN[scope], scope])

  /**
   * **選んだ範囲から、選んだ語数だけ組む**(2026-09 利用者の指定)。
   *
   * **答えるたびに組み直さない**(2026-09 実機で見つけた)。
   * 以前は `useEffect` の見張りに `rows` を入れていた。ところが答えると
   * `answer()` が答えた語を `rows` から外すので、**1語答えるたびに
   * 組み直されていた。**「1 / 10 語」から先へ進まず、結果も出なかった。
   * いまの `rows` は控え(`rowsRef`)から読む。
   *
   * **並びは、期限で出すときだけ「まだ」を先にする。**
   * 範囲で出すときは何度も回すものなので、まるごと混ぜないと
   * **毎回おなじ「まだ」の語ばかり**が出る(おさらいで踏んだのと同じ)。
   */
  const poolNow = useCallback(
    () => scopePool(applyWordbookFilter(rowsRef.current, filter), scope, todayKey()),
    /* **絞り込みの欄を足したら、ここも一緒に効く。** 鍵を並べ直さない
       (`filter.day, filter.material, …` と書いていたので、レベルを
       足したときに**そこだけ反映されなかった**) */
    [runKeyOf({ scope, size, filter }), scope],
  )

  const start = useCallback(() => {
    const pool = poolNow()
    setQueue(buildSession(pool, takeCount(size, pool.length), { shuffleAll: scope !== 'due' }))
    doneRef.current = []
    setResult(null)
    setShown(false); setDeep(false); setTyped(''); setJudged(null); setSeenOpen(false)
    setPickedChoice(null)
    setStarted(true)
    setRunning(true)
  }, [poolNow, scope, size])

  /**
   * **聞き流しを始める**(2026-09 利用者の指定)。
   *
   *   > 音楽を流しながらどんどん登録されている単語が読まれるモード
   *
   * **読む語は、出題とまったく同じ道で選ぶ**(`poolNow()`)——
   * 範囲の札も絞り込みも、そのまま効く。**数え方を2通り持たない。**
   * ただし**語数では切らない。** 聞き流しは終わりを決めずに回すものである。
   *
   * 曲は**押したときに引く**(開いた瞬間ではない)。押さない人には
   * 1回も問い合わせが飛ばない。**曲が0本でも聞き流しは始まる**
   * (音楽が鳴らないだけ・**行き止まりを作らない**)。
   */
  const listen = useCallback(async () => {
    const pool = poolNow()
    if (!pool.length) return
    setRadio(pool)
    const { data } = await listTracks()
    setTracks(data ?? [])
  }, [poolNow])

  /**
   * **復習の最中に「出しかた」を変えたら、その場で組み直す**
   * (2026-09 利用者の指定「中に入ってからも絞り込みができるように」)。
   *
   * 変わったかどうかは **`runKeyOf()` 1か所**(`reviewScope.js`)。
   * `setFilter` のすぐあとでは古い値しか読めないので、
   * **値そのものを見張って、変わったら組み直す。**
   */
  const runKey = runKeyOf({ scope, size, filter, group })
  const runKeyRef = useRef(runKey)
  useEffect(() => {
    if (!running || !started) { runKeyRef.current = runKey; return }
    if (runKeyRef.current === runKey) return
    runKeyRef.current = runKey
    start()
  }, [runKey, running, started])

  /* **読み直したあとは、そのまま次の回へ進む。**「つぎの ◯ 語」を押した人に、
     もう一度「始める」を押させない(押すものが2つになる) */
  useEffect(() => {
    if (!isQuiz || loading || !started) return
    if (queue.length || result) return
    start()
  }, [isQuiz, loading, started, deal])
  const card = isQuiz ? queue[0] : null

  /**
   * **カードを画面のまん中に置く**(2026-09 利用者の指定)。
   *
   *   > 単語は、「覚える」や「まだ」「覚えかけ」などを押し出したら
   *   > 画面に固定になり、単語や解答の長さに関わらず、しっかり中央に
   *   > 居座るようにしてください。(特にスマホで)
   *
   * 単語帳の画面は、上に札・プルダウン・絞り込みが積まれている。
   * スマホではカードが画面の下のほうから始まるので、**4択が画面の外**に
   * 出てしまうことが多かった。
   *
   * 1語ぶん答えるたびに、そのカードを画面のまん中へ寄せる。
   * **場所が毎回同じ**になるので、押す場所を探さなくてよい。
   * 動きは付けない(`behavior: 'auto'`)。滑る動きが苦手な人がいる。
   */
  /* 集中モードで出しているあいだは、**うしろの画面を動かさない**
     (`FocusReader` と同じ作法)。これが無いと外側が指で送れてしまう */
  useEffect(() => {
    if (!running || !isQuiz) return undefined
    return lockScroll()
  }, [running, isQuiz])

  useEffect(() => {
    // **集中モードでは送らない。** 画面ぴったりなので、送るものが無い
    if (running) return
    if (!card || !cardRef.current) return
    /* **押した跡を持ち越さない。** iPhone では押したボタンに焦点が残り、
       次の問題でも黒い枠が見えていた(2026-09 実機)。
       外すのは4択のボタンだけ。入力欄からは焦点を奪わない */
    const now = document.activeElement
    if (now?.classList?.contains('wordbook-choice')) now.blur()
    /* **狭い画面では、進み具合の行を画面の上へ持ってくる**
       (2026-09 利用者の指定)。まん中に寄せると、上に空きができるぶん
       4択の下が画面の外へ出やすい。上にそろえれば、
       **進み具合・出題の形・カードが1画面に収まる。**
       広い画面は空きが多いので、これまでどおりまん中に置く。
       スクロールの余白は CSS の `scroll-margin-top` が受け持つ(帯のぶん) */
    const toTop = !wide && runRef.current
    const target = toTop ? runRef.current : cardRef.current
    target.scrollIntoView({ block: toTop ? 'start' : 'center', behavior: 'auto' })
    // 語が変わったときだけ。中身(意味を見たなど)では動かさない
  }, [card?.word_norm, wide])

  /**
   * **10語やり終えた結果も、同じ場所に置く**(2026-09 利用者の指定)。
   *
   *   > 単語を全て終えた後の表示ですが、スマホの時はこの配置に
   *   > なるようにしてください。
   *
   * 最後の1語に答えた時点で、画面はその語のカードに合わせて送ってある。
   * ところが結果の箱は**それより短い**ので、そのままだと
   * 画面のずっと下に出たり、上に空きができたりしていた。
   * **語のカードと同じ決まりで置き直す**(狭い画面は上、広い画面はまん中)。
   */
  useEffect(() => {
    if (running) return
    if (!result || !resultRef.current) return
    resultRef.current.scrollIntoView({
      block: wide ? 'center' : 'start', behavior: 'auto',
    })
  }, [result, wide])
  const word = card ? (card.display || card.word_norm) : ''
  const form = card ? pickForm(card, rows, want) : 'recall'
  /* **答えは、出題と同じ場所に入れ替える**(2026-09 利用者の指定)。
     足すのではなく入れ替えるので、カードの高さが変わらない。

     はじめは「日本語 → 英語」だけにしていたが、
     **「思い出す」も同じ要領で**という指定を受けた(利用者の言葉)。
     どちらも「出題を見て、答えを思い出し、確かめる」形なので、
     **同じものは同じ動きにする。** */
  const swapped = shown && form !== 'choice'
  /**
   * 答えを開いたときに出す、うしろ側。
   *
   * **置き場所が2つある。** 日本語 → 英語では**問題の枠の中**(高さが
   * 決まっている箱)に入れ、それ以外ではこれまでどおりカードの下に置く。
   *
   * 枠の外に置くと、開いた瞬間にカードが 49px 伸びる。カードは上下の
   * まん中に置いてあるので、**その半分だけ全体が上へ動き**、
   * いま押そうとしている「まだ / 覚えかけ」がずれる(実測 24px)。
   * 高さの決まった枠の中なら、はみ出したぶんはその中で送れるだけで、
   * **カードは 1px も動かない。**
   */
  const backBlock = card && shown ? (
    <div className="wordcard-back">
      {/* **答えそのものは、ここに出さない。**
          上の枠が答えと入れ替わっているので、ここにも出すと
          **同じ答えが2か所**に出る(2026-09)。
          残すのは、文の訳と「くわしく」だけである */}
      {card.seen_in_ja && <p className="wordcard-seen-ja">{card.seen_in_ja}</p>}
      <button type="button" className="btn btn--link"
              onClick={() => setDeep((v) => !v)}>
        {deep ? 'とじる' : 'くわしく'}
      </button>
      {deep && <Detail wordNorm={card.word_norm} />}
    </div>
  ) : null
  /**
   * 4択の選択肢。**1問のあいだ、並びを変えない**(2026-09 利用者の指定)。
   *
   *   > 正解の時に、元々の正解の選択肢のあった場所から対角線上に
   *   > 移動してから緑になったり、ランダムに移動して緑に光るから
   *   > 変な感じがして落ち着きません
   *
   * `makeChoices()` は**呼ぶたびに混ぜる。** ところが以前はレンダーのたびに
   * 呼んでいたので、**答えた瞬間の描き直しで並びが変わり**、
   * 正解が別の場所へ動いてから緑になっていた。
   *
   * 語(と出題の形)が変わったときだけ作り直す。
   * **`rows` は見ない。** 答えると `rows` から1語外れるので、
   * 見ていると同じことが起きる(出題を組み直さないのと同じ理由)。
   */
  const choices = useMemo(
    () => (card && form === 'choice' ? makeChoices(card, rowsRef.current) : null),
    [card?.word_norm, form],
  )

  /** 1語ぶん答える。**押した語はすぐ消す。** 待たされると手ごたえが無い */
  /** 選べる語の上限。これ以上入れても1つの教材には収まらない */
  const MAX_PICK = 20
  const togglePick = (word) => {
    setPicked((prev) => (prev.includes(word)
      ? prev.filter((w) => w !== word)
      : prev.length >= MAX_PICK ? prev : [...prev, word]))
  }

  const answer = async (row, status) => {
    /* **押した手応えを返す**(2026-09 利用者の指定)。
       思い出せたら**ピンポン**、「まだ」は低く1つだけ。
       **送る前に鳴らす。** 通信を待つと、押してから間が空いて
       「効いたのか分からない」になる。

       **「覚えた」を外した(2026-09)ので、`known` だけを見ない。**
       見ていると、いちばんよく押す「覚えかけ」でピンポンが鳴らなくなる */
    answerFeedback(status !== 'unknown')
    setBusy(row.word_norm)
    /* **投げられたら、そこで止まる。**
       `try` が無いと、思わぬ失敗のときに知らせも出ず、次へも進まない。
       **成功と失敗が、同じ見た目で終わってはいけない**(CLAUDE.md) */
    let e = null
    try {
      /* **記録するかどうかは `shouldRecord()` 1か所**(`reviewScope.js`)。
         「まだ」はいつでも、それ以外は**期限が来ていて、この回でまだ
         進めていないとき**だけ。**遅く出す方へは動かさない** ——
         同じ範囲を1日に何度も回すと、明日の復習が空になるためである */
      const ok = status !== 'unknown'
      if (shouldRecord(ok, {
        dueOn: row.due_on,
        addedAt: row.added_at,
        already: gradedRef.current.has(row.word_norm),
      })) {
        if (ok) gradedRef.current.add(row.word_norm)
        ;({ error: e } = await setWordStatus(row.word_norm, status,
          { kind: row.kind, learnerId }))
      }
    } catch (err) {
      e = String(err?.message ?? err ?? '記録できませんでした')
    }
    setBusy(null)
    if (e) { setError(e); return }
    setError(null)
    /* 結果の ○ × は「思い出せたか」で付ける。**`known` だけを見ない**
       (2026-09 に「覚えた」を外したので、見ていると全部 × になる) */
    doneRef.current.push({ word: row.display || row.word_norm, ok: status !== 'unknown' })
    setRows((list) => list.filter((r) => r.word_norm !== row.word_norm))
    setShown(false); setDeep(false); setTyped(''); setJudged(null); setSeenOpen(false)
    setPickedChoice(null)
    /* **3枚の札は、押したとおりに動かす。**
       「覚えかけ」を押したのに数が動かないと、記録されていないように見える。
       いま何だったか(`row.status`)と、何にしたか(`status`)の
       両方を見ないと、同じ札を二度押したときに数が増えつづける */
    setCounts((c) => {
      // いま何だったか(`row.status`)から1つ引き、何にしたか(`status`)へ1つ足す。
      // 同じ札を二度押しても、引いてから足すので数は動かない
      const move = (n, key) => Math.max(0,
        n - (row.status === key ? 1 : 0) + (status === key ? 1 : 0))
      return {
        ...c,
        due: Math.max(0, c.due - 1),
        unknown: move(c.unknown, 'unknown'),
        learning: move(c.learning, 'learning'),
        known: move(c.known, 'known'),
      }
    })
    setQueue((q) => {
      const rest = q.slice(1)
      // **10語で区切る。** 終わったら結果を出す
      if (!rest.length) setResult([...doneRef.current])
      return rest
    })
  }

  /**
   * 4択・つづりは機械が判定する。**自己申告より正直な記録になる。**
   *
   * **答えは、下ではなく「その場」で返す**(2026-09 利用者の指定)。
   *
   *   > 解答が下に出るので非常に見にくいです。上の太字の単語が日本語に
   *   > 変わるとか、真ん中に吹き出しで答えが出る、またはピンポン!て音で
   *   > わかりやすく、選択したボタンが正解なら緑、不正解なら赤などに
   *   > なる方がわかりやすいです
   *
   * 3つを同時に返す。**色だけに頼らない**(CLAUDE.md)。
   *   ① 押したボタン … 正解=緑 / まちがい=赤(✓ ✗ の印も付ける)
   *   ② 上の太字      … 英語から**日本語の意味**に変わる
   *   ③ 音            … ピンポン(正解)/ 低く1つ(まちがい)
   *
   * @param ok      合っていたか
   * @param chosen  4択で押した選択肢の文(色を付ける相手を見分けるため)
   */
  const judge = (ok, chosen = null) => {
    setJudged(ok)
    setPickedChoice(chosen)
    /* **4択では、下の答えの欄を開かない。** 上の太字が意味に変わるので、
       同じことが2か所に出る。つづりのときは正解の綴りが要るので開く */
    if (form !== 'choice') setShown(true)
    // 音とふるえ。**押した瞬間に返す**(通信を待たない)
    answerFeedback(ok)
    /* 少しだけ見せてから次へ。すぐ消えると、何が正解だったか分からない。

       **合っていたら「覚えかけ」として残す**(2026-09)。
       「覚えた」を外したので、ここだけ `known` を書いていると
       **4択で当たった語だけが卒業の数え(0038)から外れる。**
       0027 を貼っていない Supabase では、これまでどおり `known` */
    window.setTimeout(
      () => answer(card, ok ? (canLearning ? 'learning' : 'known') : 'unknown'),
      ok ? 900 : 1800,
    )
  }

  return (
    <section className="card">
      {/* **題と、続いている記録は同じ行**(2026-08 利用者の指定)。
            > 単語帳、もっと洗練して直観的にしてください。
            > 現代的、分かりやすく使いやすい、シンプルに変更して。 */}
      <div className="wb-head">
        <h2 className="card-title">
          {learnerName ? `${honor(learnerName)}の単語帳` : '単語帳'}
        </h2>
        {week.weeks > 0 && (
          <span className="wb-streak" title="続けている週の数">
            {week.weeks} 週つづけて<span className="wb-streak-sub">今週 {week.days} 日</span>
          </span>
        )}
      </div>

      {/* 数は**3枚の札**にする。以前は1行に流していたので、
          どれが「いま何をすればよいか」なのか分からなかった。
          **「今日出す」だけを目立たせる。** そこが行動につながる数である */}
      {/* **札は「状態」そのものにする**(2026-08 利用者の指定・0027)。
            > 覚えかけ、の定義をはっきりさせましょう。
          以前は「覚えかけ」と書いておきながら、中身は「まだ」の数だった。
          **言葉と中身が食い違っていた。**
          いまはカードの3つのボタンと、この3枚の札が1対1で対応する。
          「今日出す」の数は、復習のタブに付く */}
      {/* **押せる**(2026-09 利用者の指定)。

            > 学習者の心理としては、覚えた、を押すのは少し勇気がいるものです。
            > なので、それぞれ数を示すだけではなく、
            > タッチすればそれらを復習できるようにしたいです。

          数だけ出して押せない札は、**そこに何があるかを見せておいて、
          触らせない**という形になっていた。「覚えた」を押すのに勇気が
          要るのは、押したらもう出てこないと思うからである。
          いつでも呼び出して確かめられるなら、押すのは怖くない。

          見た目は `ReviewStats` 1つで、Quick Response の復習とまったく同じ。
          **書き写さない**(CLAUDE.md)。段の一覧は `WORD_GROUPS`
          (`reviewScope.js`)が持っており、**id は `VIEWS` の id そのもの**
          なので、押したら読み込む `status` がそのまま決まる。

          **見るものの切り替え(プルダウン)は、この札に吸収した。**
          あちらの「覚えかけ / 覚えた」と、この札の2つは
          **まったく同じもの**だった(同じものを2か所に出さない)。 */}
      <ReviewStats
        items={WORD_GROUPS
          .filter((g) => g.id !== 'learning' || canLearning)
          .map((g) => ({ ...g, n: counts[g.id] ?? 0 }))}
        value={group}
        onPick={pickGroup}
        dueId="unknown"
        lead={groupLead(WORD_GROUPS, group, '語')}
      />

      {/* トレーナーが見た。**人が見ていると分かることが、いちばん効く** */}
      {viewers.length > 0 && (
        <p className="wordbook-seenby">
          {/* `viewed_at` は時刻まで入った値なので、**日付だけに切ってから渡す。**
              そのまま渡すと "8/NaN" になる(実際にそう出した) */}
          担当トレーナーが {shortDate(String(viewers[0].viewed_at).slice(0, 10))}
          {' '}にこの単語帳を見ました。
        </p>
      )}

      {/* **タブと「出題の形」を同じ行に**(2026-08 利用者の指定)。
            > 復習、覚えかけ、覚えた、は同じ位置でタブにしてください。
            > 積み上がりは一旦そこからは削除です。
            > その右におまかせのタブを置いてください。
          「おまかせ」は出題の形。**復習のときだけ効く**ので、
          そのときだけ出す(効かない操作を見せない・CLAUDE.md)。 */}
      {/* **切り替えもプルダウンにする**(2026-08 利用者の指定)。

            > 復習がプルダウンになっていません。やり直してください

          タブにしたところ、スマホでは3つのタブが「おまかせ」に押されて
          **「覚」で切れ、重なって出た**(実機)。タブは折り返さず横に流れる
          決まりなので、右に別のものを置くと必ずこうなる。

          **同じ行に2つ置くなら、両方ともプルダウンにする。**
          幅が中身なりに決まるので、狭い画面でも重ならない。 */}

      {/* **手で入れる**(2026-09 利用者の指定「単語帳に手打ちで入力できる
          機能をつけてくれ」)。教材の外で出会った語も、その場で入れられる。
          畳んであるのは、ふだん開く画面ではないため。
          入れたら数え直す(`reload`)ので、札の数もすぐ合う */}
      <WordbookAdd learnerId={learnerId} learnerName={learnerName} onAdded={reload} />

      {/* **基礎単語**(0053・2026-09 利用者の指定)。

            > 講座の中の単語はそれぞれ基本360語、標準1200語、として
            > そもそもが独立して選べる単語帳にしてください

          30日講座の中にしか無かった語を、**単語帳の側から**入れて
          その段だけを練習できるようにする。手で入れる欄のとなりに置く ——
          どちらも「単語帳に語を入れる」道で、**ふだん開く欄ではない**ので
          畳んである。**絞り込みは `App.jsx` の1つを使う**(`onPickWords`) */}
      {onPickWords && (
        <BasicWordsPick learnerId={learnerId} learnerName={learnerName}
                        onPicked={onPickWords} />
      )}

      {error && <p className="notice notice--error">{error}</p>}
      {loading && <p className="hint">読み込み中…</p>}

      {/* 「積み上がり」は、いったんタブから外した(2026-08 利用者の指定)。
             > 積み上がりは一旦そこからは削除です。
          描いていた中身(CEFR のめやす・業界べつ)も一緒に外した。
          **効かない画面のコードを残さない。** 戻すときは git から取り出す */}

      {/* ── 今日の復習(10語ずつ)────────────────────────────── */}
      {isQuiz && !loading && result && running && (
      <div className="focus wbfocus" role="dialog" aria-modal="true" aria-label="今日の復習">
        <div className="focus-top">
          <button type="button" className="btn btn--small btn--ghost"
                  onClick={() => setRunning(false)}>
            <CloseIcon />とじる
          </button>
          <span className="focus-count">おつかれさまでした</span>
        </div>
        <div className="focus-body">
        <div className="wordcard wordcard--result" ref={resultRef}>
          {/* **終わりの1枚は、Quick Response とまったく同じ部品**
              (`SessionResult`・2026-09 利用者の指定「ゲーミフィケーションを
              追加したいです」)。点数・声かけ・連続・週の続き・
              できなかったものを、**書き写さずに1か所で持つ** */}
          <SessionResult
            items={result.map((r) => ({ ok: r.ok, main: r.word }))}
            unit="語"
            week={week}
            missLead="上に出ているのが、思い出せなかった語です。また明日出ます。"
            extra={(
              <>
                {/* **週の目標**(0042)。決めていなければ、行ごと出ない */}
                <GoalBar goal={goal.wordsGoal} done={goal.wordsDone} unit="語" />
                <CollectRows rows={fields} />
              </>
            )}
          >
            {/* **選んだ範囲の残りから、選んだ語数だけ続ける。**
                読み直してから組み直すので、箱が動いたぶんも映る */}
            {restInScope > 0
              ? (
                <button type="button" className="btn btn--primary" onClick={reload}>
                  つぎの {takeCount(size, restInScope)} 語
                </button>
              )
              : <p className="hint">この範囲は終わりです。</p>}
          </SessionResult>
        </div>
        </div>
      </div>
      )}

      {isQuiz && !loading && !card && (
        /* **「ありません」と「読めていません」を、同じ見た目で終わらせない**
           (CLAUDE.md)。数え上げは表を直に見ているので、
           「復習 118」と出ているのに1語も出せないなら、それは
           **やり切ったのではなく、読めていない。** */
        rows.length === 0
          ? <p className="hint">その絞り込みに当てはまる語はありません。</p>
          : (
            /* **いつのぶんを、何語ずつ**(2026-09 利用者の指定)。
               Quick Response の復習とまったく同じ部品。**書き写さない。**

               **「おさらい」のボタンは、この札の「ぜんぶ」に吸収した。**
               あちらは「期限を見ずに単語帳ぜんぶからランダム」で、
               `scope = 'all'` とまったく同じものである。
               しかも**0件になるまで見えなかった**ので、
               ここに常に出るほうが届きやすい(行き止まりも作らない)。 */
            <ReviewScope
              rows={forScope}
              unit="語"
              scope={scope}
              size={size}
              narrowed={narrowed}
              onScope={(id) => { setScope(id); saveScope('word', id) }}
              onSize={(sz) => { setSize(sz); saveSize('word', sz) }}
              onStart={start}
            >
              {/* **絞り込みも「出しかた」の中へ**(2026-09 利用者の指定)。
                  画面に散らばっていたので、設定は1か所にまとめた。
                  日付の絞り込みは 2026-08 の指定で置いたもので、
                  **消していない** —— 場所が変わっただけである */}
              <WordbookFilter rows={rows} value={filter} onChange={setFilter} />
            </ReviewScope>
          )
      )}

      {/* **聞き流し**(2026-09 利用者の指定)。「出す」のとなりに置く ——
          同じ語を、答えるか・聴くだけかの違いなので、選ぶのはここである。
          **範囲の札と絞り込みは、そのまま効く**(`poolNow()` 1か所) */}
      {isQuiz && !loading && !card && rows.length > 0 && (
        <button type="button" className="btn btn--quiet wb-listen"
                disabled={restInScope === 0}
                onClick={listen}>
          <MusicIcon />聞き流す({restInScope} 語)
        </button>
      )}

      {radio && (
        <WordRadio
          rows={radio}
          tracks={tracks}
          rate={rateOf(loadRateId())}
          learnerId={learnerId}
          onClose={() => setRadio(null)}
        />
      )}

      {/* **とじたあとの戻り道**(2026-09)。集中モードは画面ぴったりなので、
          出ていると一覧が見えない。出ていないときは、ここから入り直す */}
      {isQuiz && !loading && !running && card && (
        <button type="button" className="btn btn--primary wb-start"
                onClick={() => setRunning(true)}>
          <FocusIcon />つづける
        </button>
      )}

      {card && running && (
        <div className="focus wbfocus" role="dialog" aria-modal="true" aria-label="今日の復習">
          {/* **この回の進み具合**(2026-08 利用者の指定)。
                > あと10語みたいなのも、入れるのであればしっかりメリハリを
                > つけて存在意義があるように。
              「のこり 10 語」という小さな文字は、あってもなくても同じだった。
              **何問目かを数で出し、帯で見せる。**
              終わりが見えるから、あと3つなら続ける気になる。

              出題の形は**プルダウン1つ**にした。札を5つ並べていたので、
              いちばん押す「答える」ボタンより目立っていた。
              既定の「おまかせ」は、覚えの深さ(箱)から自動で決まる */}
          {(() => {
            const done = doneRef.current.length
            const total = done + queue.length
            return (
              <div className="wb-run" ref={runRef}>
                {/* 出題の形は**タブの右**へ移した(2026-08 利用者の指定)。
                    ここに残すと、同じものが2か所に出る */}
                <div className="wb-run-head">
                  {/* **戻る道は、いちばん先に置く**(集中モードと同じ作法)。
                      画面ぴったりなので、無いと閉じ方を探すことになる */}
                  <button type="button" className="btn btn--small btn--ghost"
                          onClick={() => setRunning(false)}>
                    <CloseIcon />とじる
                  </button>
                  {/* **「◯ / ◯ 語」は出さない**(2026-09 利用者の指定)。
                      どこまで来たかは、すぐ下の点(`.wb-run-bar`)が
                      同じことを言っている。**同じことを2つ見せない** */}
                  {/* **出題の形は、進み具合の右**(2026-09 利用者の指定)。
                      画面のはるか上にあったので、訊き方を変えるたびに
                      上まで送り戻す必要があった */}
                  {/* **中に入ってからも絞り込める**(2026-09 利用者の指定)。
                      始める前とまったく同じ「出しかた」を開く。
                      **中身は書き写さない** —— `ReviewScope` の畳んだ形 */}
                  <ReviewScope
                    compact
                    rows={forScope}
                    unit="語"
                    scope={scope}
                    size={size}
                    narrowed={narrowed}
                    onScope={(id) => { setScope(id); saveScope('word', id) }}
                    onSize={(sz) => { setSize(sz); saveSize('word', sz) }}
                    onStart={start}
                  >
                    <WordbookFilter rows={rows} value={filter} onChange={setFilter} />
                  </ReviewScope>
                  <label className="wb-formpick">
                    <span className="sr-only">出題の形</span>
                    <select value={want}
                            onChange={(e) => {
                              setWant(e.target.value)
                              setShown(false); setJudged(null); setPickedChoice(null)
                            }}>
                      <option value="auto">おまかせ</option>
                      {QUIZ_FORMS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="wb-run-bar" role="presentation">
                  {Array.from({ length: total }, (unused, i) => (
                    <span key={i} className={i < done ? 'is-done' : i === done ? 'is-now' : ''} />
                  ))}
                </div>
                {/* **絞っていることを、絞った画面に出す**(0047) */}
                {onlyNote}
              </div>
            )
          })()}

          {/* **出題は、画面の残りいっぱいの中でまん中に置く**
              (集中モードと同じ `.focus-body`)。
              上に積まれた札や絞り込みは、この裏に隠れている */}
          <div className="focus-body">
          {/* **「思い出す」と「日本語 → 英語」だけ、カードで画面を使い切る**
              (2026-09 利用者の指定)。この2つは答えが**2つのボタンだけ**
              なので、下がまるごと空いていた。4択とつづりは、下に
              選択肢や入力欄があるので**もともと空いていない** ——
              伸ばすと語と選択肢が数百 px 離れて、目が行き来する。
              **判断は `isSelfGraded()` 1か所**(形の一覧を2か所に持たない) */}
          <div className={`wordcard${isSelfGraded(form) ? ' wordcard--recall' : ''}`}
               ref={cardRef}>

            {/* **出題は、高さの決まった枠に入れる**(2026-09 利用者の指定)。
                  > 単語や解答の長さに関わらず、しっかり中央に居座るように
                  > してください。(特にスマホで)
                  > ４択の回答は中央に表示してください。下に表示されて
                  > 切れてしまっている時が多いです。

                語の長さも、出会った文の長さも教材によって桁が違う。
                そのままだと**答えのボタンが上下に動き**、押す場所を
                探すことになる。枠の高さを決めれば、ボタンは動かない。

                **下限は必ず置く**(`min-height`)。0 にすると窓が低いとき
                高さ 0 まで縮み、問題が真っ白になる(Quick Response で
                一度やった・CLAUDE.md)。
                **上限も置く。** 長い文で4択が画面の外へ押し出されるのを
                防ぐため、はみ出したぶんはこの枠の中だけで送る。 */}
            <div className="wordcard-q">

            {/* **種類と品詞は、いちばん上**(2026-09 利用者の指定
                  「言い回し、名詞というのは上に持ってこう」)。

                以前は語の**下**にあったので、目が語 → 下の札 → また上の
                ボタン、と行き来していた。上に置けば
                **「何の語か」を先に受け取ってから本題に入れる。**

                塗りつぶした札にすると、語より目立ってしまう。
                **細い字と中黒だけ**で並べる。

                **控えにあるのは `word` か `phrase` の2つだけ。**
                コロケーションとイディオムは、いまのデータでは見分けられない
                (どちらも `phrase` として入る)。
                **あやふやなことを言わない**(CLAUDE.md)ので、
                見分けられるようになるまでは「言い回し」とだけ書く。 */}
            <p className="wordcard-tags">
              <span className="wc-tag wc-tag--kind">
                {card.kind === 'phrase' ? '言い回し' : '単語'}
              </span>
              {card.pos && <span className="wc-tag wc-tag--pos">{card.pos}</span>}
            </p>

            {/* 出す側。
                **答えを出しておいて答えさせない。** つづりを書く形で英語を
                そのまま見せていたので、写すだけで正解できた(2026-08 の実測)。
                日本語 → 英語と同じく、意味だけを出す。

                **日本語 → 英語では、答えを「同じ場所」に入れ替える**
                (2026-09 利用者の指定)。

                  > 英語を見るにすると日本語と入れ替えで同じ場所に
                  > 表示してください。

                以前は日本語の下に英語を**足して**いたので、
                そのぶんカードが伸びて答えのボタンが下へ動いていた。
                入れ替えなら**箱の高さが変わらない**ので、
                押す場所も、目を向ける場所も動かない
                (集中モードの「訳は並べるのではなく入れ替える」と同じ考え方)。 */}
            <div className={`wordcard-face${form === 'cloze' ? ' wordcard-face--cloze' : ''}`}>
              {/* **穴埋め**(2026-09)。出会った文の、その語だけを伏せる。
                  下の「出会った文」は出さない —— 同じ文が2つ並ぶうえ、
                  そちらには答えがそのまま見えている */}
              {form === 'cloze'
                ? (
                  <ClozeFace sentence={card.seen_in} word={word}
                             meaning={card.meaning_ja} shown={swapped} />
                )
                : form === 'ja2en' || form === 'spell'
                ? (swapped
                  ? (
                    /* つづりを書く形では、**合っていたかも同じ場所で返す。**
                       ✗ と綴りを並べただけだと、**その綴りが
                       まちがいのように読める**ので「正解は」を添える
                       (4択と同じ作法・CLAUDE.md) */
                    <span className={`wordcard-word wordcard-word--en${
                      form === 'spell' && judged !== null
                        ? (judged ? ' wordcard-judged is-ok' : ' wordcard-judged is-ng') : ''}`}>
                      {form === 'spell' && judged !== null && (
                        <span className="wordcard-mark" aria-hidden="true">
                          {judged ? '✓' : '✗'}
                        </span>
                      )}
                      {form === 'spell' && judged === false && (
                        <span className="wordcard-lead">正解は</span>
                      )}
                      <span lang="en">{word}</span>
                    </span>
                  )
                  : <span className="wordcard-word">{card.meaning_ja || '(意味の控えがありません)'}</span>)
                : form === 'choice' && judged !== null ? (
                  /* **答えたら、上の太字が日本語に変わる**(2026-09 利用者の指定)。
                       > 解答が下に出るので非常に見にくいです。
                       > 上の太字の単語が日本語に変わるとか…
                     いちばん目が行っている場所で答えを返す。
                     **色だけに頼らない。** ✓ / ✗ の印も添える(CLAUDE.md) */
                  <span className={`wordcard-word wordcard-judged${
                    judged ? ' is-ok' : ' is-ng'}`}>
                    <span className="wordcard-mark" aria-hidden="true">
                      {judged ? '✓' : '✗'}
                    </span>
                    {/* まちがえたときは「正解は」と添える。
                        ✗ と意味を並べただけだと、**その意味が
                        まちがいのように読める** */}
                    {!judged && <span className="wordcard-lead">正解は</span>}
                    {card.meaning_ja || '(意味の控えがありません)'}
                  </span>
                ) : swapped ? (
                  /* **「思い出す」も、日本語 → 英語と同じ要領**(2026-09 利用者の指定)。
                     英語のあった場所が、そのまま意味に入れ替わる */
                  <span className="wordcard-word">
                    {card.meaning_ja || '(意味の控えがありません)'}
                  </span>
                ) : (
                  <>
                    <span className="wordcard-word" lang="en">{word}</span>
                    {/* **4択では、ここに Listen を置く。**
                        「思い出す」は入れ替わるので、Listen は下の行にある
                        (入れ替わったときに、押すものが消えないようにするため) */}
                    {form === 'choice' && (
                      <SpeakButton text={word} className="etext-listen" />
                    )}
                  </>
                )}
            </div>

            {/* 出会った文。訳なしで先に出す。日本語→英語のときは答えを伏せる。

                **畳んでおく**(2026-08 利用者の指定)。長い文が開いたままだと、
                答えの4択が画面の外へ出る。

                **Listen は文の横に置かない。**
                  > 例文の横のlistenのせいで例文の折り返しがかなり
                  > 窮屈になってしまってます。
                横に置くとスマホで文の幅が半分になり、1行3語ほどで折り返す。
                開け閉めの行へ移し、**文には幅をぜんぶ渡す。** */}
            {card.seen_in && form !== 'cloze' && (
              <div className="wordcard-seenbox">
                <div className="wordcard-seenbar">
                  <button type="button" className="btn btn--ghost btn--small"
                          aria-expanded={seenOpen}
                          onClick={() => setSeenOpen((v) => !v)}>
                    {seenOpen ? '▾ 出会った文' : '▸ 出会った文'}
                  </button>
                  {/* 答えが聞こえてしまう形では、出す前に鳴らさない */}
                  {seenOpen && ((form !== 'ja2en' && form !== 'spell') || shown) && (
                    <SpeakButton text={card.seen_in} className="etext-listen" />
                  )}
                </div>
                {seenOpen && (
                  <SeenIn sentence={card.seen_in} word={word}
                          hide={(form === 'ja2en' || form === 'spell') && !shown} />
                )}
              </div>
            )}

            {/* **答えは、どの形でも「この枠の中」に出す**(2026-09 利用者の指定)。

                  > この意味を元々の日本語の下、または日本語も含めた意味に
                  > 入れ替えて同じ場所に表示してください。下に出るのはみづらいです

                以前は「意味を見る」で開いた答えを**ボタンの下**に足していた。
                目は出題(いちばん上の太字)にあるので、そこから離れた場所に
                出しても見ない。しかも下に足すぶんカードが伸び、
                **いま押そうとしているボタンが動く。**

                枠の高さは決まっているので、ここに入れれば**カードは伸びない。**
                はみ出したぶんは、この枠の中だけで送れる。 */}
            {backBlock}

            </div>

            {/* ── 4択 ───────────────────────────────────────── */}
            {form === 'choice' && choices && (
              <ul className="wordbook-choices">
                {choices.map((c) => (
                  /* **`key` に語も入れる。** 番号だけにしていたので、次の語でも
                     React が同じボタンを使い回し、**押した跡(黒い枠)が
                     残ったまま**次の問題に出ていた(2026-09 実機)。
                     同じ選択肢の文が次の問でも出ることがあるので、
                     **文だけでは足りない。** 語と組にして、
                     問が変わったら必ず作り直されるようにする */
                  <li key={`${card.word_norm}:${c.text}`}>
                    <button type="button" disabled={judged !== null || busy}
                            className={`btn wordbook-choice${
                              judged === null ? ''
                                : c.correct ? ' is-right'
                                  : c.text === pickedChoice ? ' is-wrong' : ''}`}
                            onClick={(e) => {
                              // **押した跡を残さない。** iPhone では押したボタンに
                              // 焦点が残り、黒い枠が次の問題まで見えていた
                              e.currentTarget.blur()
                              judge(c.correct, c.text)
                            }}>
                      {c.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── つづりを書く ───────────────────────────────── */}
            {form === 'spell' && (
              <form className="wordbook-spell"
                    onSubmit={(e) => { e.preventDefault(); judge(spellMatches(typed, word)) }}>
                <input type="text" value={typed} lang="en" autoCapitalize="off"
                       autoCorrect="off" spellCheck="false" placeholder="英語で書く"
                       disabled={judged !== null}
                       onChange={(e) => setTyped(e.target.value)} />
                <button type="submit" className="btn btn--primary"
                        disabled={judged !== null || !typed.trim()}>答える</button>
                {/* **「正しくは …」は、ここに出さない**(2026-09)。
                    答えたとたんに、上の枠が正しい綴りと入れ替わる。
                    ここにも出すと**同じ答えが2か所**に出る */}
              </form>
            )}

            {/* ── 思い出す / 日本語 → 英語 ───────────────────── */}
            {isSelfGraded(form) && (
              <div className="wordcard-actions">
                {/* **「見る」と「聴く」は、問題のすぐ下に2つ並べる**
                    (2026-09 利用者の指定)。

                      > 英語をみる、英語を聴くの２つを日本語の問題の下に。
                      > その際も聴くボタンをすぐ下に。

                    どちらも**答えそのものではなく、答えを確かめる道**なので
                    同じ段に置く(Quick Response と同じ考え方)。
                    答えの2つ(まだ / 覚えかけ)は1段下にある。

                    **日本語 → 英語でも音を鳴らす**(2026-09 利用者の指定・
                    **方針の変更**)。もとは「鳴らせば答えが聞こえてしまう」
                    ので伏せていたが、この向きは**口に出して言う**練習なので、
                    自分で言ってから**耳で答え合わせをする**ほうが素直である
                    (Quick Response で同じ判断をしている)。 */}
                <div className="wordcard-peek">
                  <button type="button" className="btn btn--ghost btn--small"
                          aria-expanded={shown}
                          onClick={() => setShown((v) => !v)}>
                    {/* **穴埋めも「英語を見る」**(2026-09)。
                        伏せてあるのは語そのものなので、出てくるのは英語である */}
                    {form === 'ja2en' || form === 'cloze'
                      ? (shown ? '英語を隠す' : '英語を見る')
                      : (shown ? '意味を隠す' : '意味を見る')}
                  </button>
                  {/* 「思い出す」の向きは英語が出ているので、
                      Listen は語のとなりにある。**同じものを2つ見せない** */}
                  {/* **見た目は「英語を見る」とそろえる**(どちらも枠線だけ)。
                      答えそのものではない操作は `btn--ghost`(CLAUDE.md)。
                      `etext-listen` は本文の中に埋める用の小さい形なので、
                      ここで使うと**2つの背丈がそろわない**。

                      **「思い出す」の Listen も、ここに置く**(2026-09)。
                      上の枠は意味と入れ替わるので、そこに置いたままだと
                      **意味を見たとたんに Listen が消える。** */}
                  {/* ★ **文言は「英語を聴く」**(2026-09 利用者の指定)。
                      となりが「英語を見る」なので、「Listen」だけでは
                      **何の音か**が分からない。ここは英語が伏せてある
                      場所なので、「英語」と名指しする。
                      鳴っているあいだ `Stop` に変わるのは、どの画面とも同じ */}
                  <SpeakButton text={word} label="英語を聴く" className="btn--ghost" />
                </div>
                {/* **答えは2つ**(2026-09 利用者の指定「『覚えた』はなくしましょう」)。
                    まだ / 覚えかけ。

                    自分で「覚えた」と申告する道をなくし、代わりに
                    **「覚えかけ」を続けて押した回数**で卒業を決める(0038)。
                    申告は当てにならない — 1回思い出せただけで押してしまうし、
                    押した瞬間に30日先へ飛んでいた。

                    **0027 を貼っていない Supabase では「覚えかけ」が使えない。**
                    そのときだけ、これまでの「覚えた」を出す
                    (**貼る前でも動く道を残す**・CLAUDE.md)。 */}
                <div className="wordcard-answers">
                  <button type="button" className="btn btn--quiet"
                          disabled={busy === card.word_norm}
                          onClick={() => answer(card, 'unknown')}>まだ</button>
                  {canLearning
                    ? (
                      <button type="button" className="btn btn--primary"
                              disabled={busy === card.word_norm}
                              onClick={() => answer(card, 'learning')}>覚えかけ</button>
                    )
                    : (
                      <button type="button" className="btn btn--primary"
                              disabled={busy === card.word_norm}
                              onClick={() => answer(card, 'known')}>覚えた</button>
                    )}
                </div>
              </div>
            )}

            {/* **答えをボタンの下に出さない**(2026-09 利用者の指定
                「下に出るのはみづらいです」)。答えは出題と同じ枠の中にある */}

            {/* **「箱 0 / 次は今日」は出さない**(2026-08 利用者の指定)。
                > 単語帳内の「箱0 / 次は今日」はバックグラウンドのデータとして
                > 表には出さないでください。
                箱と次に出す日は、**この仕組みが内側で使う数字**である。
                ゲストにできることは何も無く、覚える助けにもならない。 */}
          </div>
          </div>
        </div>
      )}

      {/* ── 見返す用の一覧 ──────────────────────────────────────
          **既定(復習)では出さない。** 段を押したときだけ、その段の語を
          下に並べる(「覚えた」を押して中身を眺める、という使い方)。
          **一覧は消していない** —— 場所が変わっただけである */}
      {group && !loading && (
        <>
          {onlyNote}
          {/* **絞り込みはここに置かない。** すぐ上の「出しかた」の中に
              同じものがある(同じものを2か所に出さない・CLAUDE.md) */}
          {!rows.length && <p className="hint">まだありません。</p>}
          {rows.length > 0 && !shownRows.length && (
            <p className="hint">その絞り込みに当てはまる語はありません。</p>
          )}
          <ul className="wordbook">
            {shownRows.map((row) => (
              <li key={row.word_norm}
                  className={`wordbook-row${
                    picked.includes(row.display || row.word_norm) ? ' is-picked' : ''}`}>
                <div className="wordbook-main">
                  {onMakeMaterial && (
                    <label className="wordbook-pick">
                      <input type="checkbox"
                             checked={picked.includes(row.display || row.word_norm)}
                             onChange={() => togglePick(row.display || row.word_norm)} />
                      <span className="sr-only">
                        {row.display || row.word_norm} を教材に入れる
                      </span>
                    </label>
                  )}
                  <span className="wordbook-word" lang="en">{row.display || row.word_norm}</span>
                  {row.kind === 'phrase' && <span className="wordbook-kind">言い回し</span>}
                  {row.pos && <span className="etext-pos">{row.pos}</span>}
                  <SpeakButton text={row.display || row.word_norm} className="etext-listen" />
                </div>
                {row.meaning_ja && <div className="wordbook-mean">{row.meaning_ja}</div>}
                <SeenIn sentence={row.seen_in} word={row.display || row.word_norm} />
                {row.seen_in_ja && <p className="wordcard-seen-ja">{row.seen_in_ja}</p>}
                <div className="wordbook-actions">
                  {/* ★ **「覚えた」は、積んだ語にだけ出す**
                      (2026-09 利用者の指定「ある程度の回数『覚えかけ』を
                      押さないと『覚えた』は出ない仕様にしましょう」)。

                      復習のカードからは「覚えた」を外してある(0038)。
                      **自分で申告する道は当てにならない**からである。
                      ところが一覧に残っていると、そこから1回で卒業でき、
                      外した意味がなくなっていた。
                      判断は `canMarkKnown()` 1か所(`vocab.js`)。
                      **効かないボタンを出さない**ので、足りない語では
                      「まだ」だけになる。 */}
                  {canMarkKnown(row) ? (
                    <button type="button" className="btn btn--small"
                            disabled={busy === row.word_norm}
                            onClick={() => answer(row, 'known')}>覚えた</button>
                  ) : (
                    /* **なぜ出ないのかを、その場に書く。** 何も無いと
                       「消えた」のか「まだなのか」が分からない */
                    <span className="wordbook-streak">
                      覚えかけ {Number(row.learn_streak) || 0} / {KNOWN_AFTER} 回
                    </span>
                  )}
                  <button type="button" className="btn btn--small btn--quiet"
                          disabled={busy === row.word_norm}
                          onClick={() => answer(row, 'unknown')}>まだ</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 選んだ語で教材を作る。**画面の下に貼り付けて、常に見えるようにする。**
          200語まで並ぶので、下まで送ってから押すのでは遠い。
          **ここが循環の要**(復習が、そのまま次の宿題になる) */}
      {onMakeMaterial && picked.length > 0 && (
        <div className="wordbook-pickbar">
          <span>
            <strong>{picked.length} 語</strong>選んでいます
            {picked.length >= MAX_PICK && <>(ここまで)</>}
          </span>
          <button type="button" className="btn btn--link" onClick={() => setPicked([])}>
            選び直す
          </button>
          <button type="button" className="btn btn--primary"
                  onClick={() => onMakeMaterial(picked)}>
            この語で教材を作る
          </button>
        </div>
      )}
    </section>
  )
}
