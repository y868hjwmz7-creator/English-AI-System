/**
 * Quick Response(復習)— 「まだ」を押した文が、ここに溜まる(0040)。
 *
 * 【何のためか】(2026-09 利用者の指定)
 *
 *   > 教材の中で取り組んだ Quick Response の中で「まだ」を押したものは、
 *   > Quick Response という復習用の機能を独立して作り、
 *   > ひとつのアカウントにつきひとつ持たせてください。
 *   > UI は通常の Quick Response の画面と同じです。
 *   > 単語と同じく、「テキスト」「日付」「業界」「シチュエーション」などから
 *   > 絞り込んで練習できるようにしてください。
 *   > 「まだ」「おぼえかけ」の仕組みは同じです。
 *
 *   教材の中の Quick Response は**その教材の通し**である。だから
 *   言えなかった文は、その教材を開き直さないと二度と出てこない。
 *   ここは**教材をまたいだ、その人ひとりぶんの復習**である。
 *   単語帳が**語**に対してしていることを、こちらは**文**に対してする。
 *
 * 【1問ぶんの見た目は `QrCard` 1つ】
 *   教材の中の Quick Response と**同じ部品**を使う。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   ちがうのはボタンの言葉づかいだけ(「まだ」/「言える」)。
 *
 * 【誰の復習か】(単語帳と同じ)
 *   `learnerId` を渡さなければ、ログインしている本人のもの。
 *   トレーナーがゲストのページから開いたときは、そのゲストのもの。
 *   **見てよいかどうかは SQL(`qr_items`)が決める。** 画面で判定しない。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  QR_ORDERS, loadQrReviews, markQr, orderQrPairs, qrPairOf, qrReviewSupported,
} from '../lib/qrReviews.js'
import Loading from './Loading.jsx'
import WordbookFilter, { applyWordbookFilter, countNarrowed, emptyFilter } from './WordbookFilter.jsx'
import BookPick from './BookPick.jsx'
import DrillTitle from './DrillTitle.jsx'
import ReviewScope from './ReviewScope.jsx'
import FrameParts from './FrameParts.jsx'
import ReviewStats from './ReviewStats.jsx'
import {
  QR_GROUPS, SCOPES, groupLead, loadScope, loadSize, qrGroupPool, qrTally,
  runKeyOf, saveScope, saveSize, scopeCounts, scopePool, shouldRecord,
  takeCount, todayKey,
} from '../lib/reviewScope.js'
import { loadNativeFlowQr } from '../lib/nativeFlowQr.js'
import {
  FIRST_FRAME_PART, FRAME_BOOK_LABEL, FRAME_FORM_KEY, FRAME_PARTS,
  FRAME_PART_KEY, QR_HINT_KEY, frameFormOk, frameQrCounts, frameQrGroups,
} from '../lib/frameQr.js'
import { loadFrameQr } from '../lib/frameQrLoad.js'
import { NF_UNIT_KEY } from '../data/nativeFlow.js'
import NativeFlowUnits from './NativeFlowUnits.jsx'
import QrCard from './QrCard.jsx'
import SessionResult from './SessionResult.jsx'
import GoalBar from './GoalBar.jsx'
import FocusFrame from './FocusFrame.jsx'
import WordRadio from './WordRadio.jsx'
import { MusicIcon, PrintIcon } from './Icons.jsx'
import ReviewSheet from './ReviewSheet.jsx'
import { usePrintSheet } from '../lib/printSheet.js'
import { qrSheetPairs, sheetNote, wordSheetSections } from '../lib/reviewSheet.js'
import { listTracks } from '../lib/bgm.js'
import { NO_GOAL, NO_WEEK, loadQrWeek, loadWeeklyGoal } from '../lib/goals.js'
import { stopReading } from '../lib/readAloud.js'
import { usePracticeLog } from '../lib/practice.js'
import { answerFeedback } from '../lib/haptics.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

/** 並べ方は覚えておく。**一度決めれば、毎回選ぶものではない**
    (紙の幅・文字の大きさと同じ作法。`slashLevel.js` と同じ書き方) */
const ORDER_KEY = 'eas.qrOrder'
const loadOrder = () => {
  try {
    const saved = localStorage.getItem(ORDER_KEY)
    return QR_ORDERS.some((o) => o.id === saved) ? saved : 'shuffle'
  } catch { return 'shuffle' }
}
const saveOrder = (id) => {
  try { localStorage.setItem(ORDER_KEY, id) } catch { /* 使えなくても困らない */ }
}

export default function QrReview({
  learnerId = null, learnerName = '',
  /**
   * **この人に出す Native Flow の Unit**(2026-09 利用者の指定)。
   *
   *   > UNIT毎に分けて quick response が出来るようにしてください。
   *   > そして、これも指定したゲストだけに届くように、
   *   > トレーナーにはデフォルトで表示されるように
   *
   * **判断はここでしない。** `nfUnitsFor()`(`src/data/nativeFlow.js`)が
   * 済ませたものを受け取るだけである(単語帳の `shelves` とまったく同じ作法)。
   *
   * **既定は空 = 冊ごと出さない。** トレーナーがゲストのページから開く
   * Quick Response 帳を1ドットも変えないため、渡さない場所では
   * これまでどおり何も出ない。
   *
   * **`showNf` はこれに置き換えた** —— 「出すか」と「どれを出すか」を
   * 2つ持つと、片方だけ古くなる(**同じことをするものを2つ持たない**)。
   */
  nfUnits = [],
  /**
   * **とじたときの行き先**(第5.167節・2026-09 利用者の指定)。
   *
   *   > 達成具合を確認するには別の専用ページに飛んで出来るようにすれば良いので
   *
   * トップ画面が無くなったので、**閉じたときの戻り先が無い。**
   * 呼ぶ側が「達成具合」のページを渡す。**単語帳とまったく同じ形。**
   * **渡さなければ、これまでどおり一覧へ戻る。**
   */
  onClose = null,
  /**
   * **左上の ☰**(第5.172節・2026-09 利用者の指定)。
   *
   *   > quick response も単語帳も左上は閉じる「❌」ボタンではなく、
   *   > 他のところと同じくハンバーガーをおいてサイドバーが出せるように
   *
   * **渡さなければ、これまでどおり ✕ 閉じる**(トレーナーがゲストの
   * ページから開く画面には、かぶせるサイドバーそのものが無い)。
   */
  onMenu = null,
}) {
  /**
   * **いま開いている Quick Response 帳**(2026-09 利用者の指定)。
   *
   *   > これらを教材として独立させて登録せよ。
   *   > Native flow は Quick Response 教材、コロケーション基本動詞は単語帳だ。
   *
   * `'my'`(自分の Quick Response 帳)/ `'nf'`(Native Flow Vol.1)。
   * **単語帳の冊(`Wordbook.jsx` の `books`)とまったく同じ形**である。
   *
   * **同時には出さない** —— 混ざらないことが、この機能の要である。
   * 行の形をそろえてあるので(`nativeFlowRows()`)、出題も絞り込みも
   * 聞き流しも紙も、**1文字も書き分けていない。**
   *
   * **Unit の切り替えは、冊の中に置く**(2026-09 利用者の指定
   * 「UNIT毎に分けて」)。冊を6つに割ると、札の行が
   * 「自分の帳 + 6」になって何を選ぶ場所なのか分からなくなる。
   * 冊は2つのまま、**中で Unit を選ぶ**(棚とまったく同じ形)。
   */
  const books = [
    { id: 'my', label: '自分の Quick Response 帳' },
    /* **出す Unit が1つも無ければ、冊ごと出さない**(2026-09 利用者の指定
       「指定したゲストだけに届くように」)。判断は `nfUnitsFor()` 1か所で
       済ませてあり、ここでは数を見るだけである。
       **既定は空**なので、渡さない画面はこれまでどおり何も出ない */
    /* **`hasSub`** … Unit を行の中で選ぶ(第5.173節)。
       選んでも本棚を閉じない —— 閉じると、開き直さないと Unit を選べない */
    ...(nfUnits.length ? [{ id: 'nf', label: 'Native Flow', hasSub: true }] : []),
    /* **66 の型**(2026-09 利用者の指定
       「型シフトはサイドバーからなくして、quick response 内に
       『66の型のQR』としてその中に『日本語→英語』と『言い換え』を
       コンテンツとして追加します」)。

       **誰にでも出す** —— 66 型はファイル(`sentenceFrames.js` /
       `phraseSwap.js`)に書いてあり、ゲストごとに出し分ける理由がいまは無い
       (絞りたくなったら `learnerFeatures.js` に1つ足すだけである)。
       **後ろへ足す。並べ替えない**(docs/notes/22 の決まり) */
    /* 中身(日本語 → 英語 / 言い換え)と型を、行の中で選ぶ。
       **名前は `frameQr.js` 1か所**(`FRAME_BOOK_LABEL`)。
       型を足した日に、ここだけ古い数が残らないようにする(第5.177節) */
    { id: 'frame', label: FRAME_BOOK_LABEL, hasSub: true },
  ]
  const [bookWanted, setBookWanted] = useState('my')
  const book = books.some((b) => b.id === bookWanted) ? bookWanted : 'my'
  const nfBook = book === 'nf'
  /** 66 の型を開いているか。**画面の中で id を比べるのはここだけ** */
  const frameBook = book === 'frame'

  /**
   * **いま開いている Unit**(`null` ならぜんぶ)。
   *
   * **覚える** —— 毎回選び直させない(棚の `SHELF_PICK_KEY` と同じ作法)。
   * **鍵の名前は `nativeFlow.js` 1か所。** ここに書き写さない。
   */
  const [unitWanted, setUnitWanted] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(NF_UNIT_KEY))
      return Number.isInteger(saved) && saved > 0 ? saved : null
    } catch { return null }
  })
  /* **出せなくなった Unit は、黙って落ちる。** トレーナーが指定を外した
     Unit が残っていると、**見えていないはずの問が出題に混ざる**
     (棚の `pickedShelves` とまったく同じ落とし穴) */
  const unit = nfUnits.some((u) => u.id === unitWanted) ? unitWanted : null
  const nfUnitIds = nfUnits.map((u) => u.id)

  /**
   * **66 の型の、どの中身を開いているか**(2026-09 利用者の指定
   * 「型のトレーニングの UI は廃止して、quick response の UI に
   * そのままコンテンツを移してください」)。
   *
   * `'swap'`(日本語 → 英語)/ `'say'`(言い換え)。
   * **Native Flow の Unit とまったく同じ作法**である ——
   * 覚える・知らない id は落とす・変えたら読み直す。
   * **鍵の名前は `frameQr.js` 1か所。** ここに書き写さない。
   */
  const [partWanted, setPartWanted] = useState(() => {
    try {
      const saved = localStorage.getItem(FRAME_PART_KEY)
      return FRAME_PARTS.some((x) => x.id === saved) ? saved : FIRST_FRAME_PART
    } catch { return FIRST_FRAME_PART }
  })
  const part = FRAME_PARTS.some((x) => x.id === partWanted) ? partWanted : FIRST_FRAME_PART
  /** 中身ごとの問数。**画面で数え直さない**(`frameQr.js` 1か所) */
  const partCounts = useMemo(() => frameQrCounts(), [])

  /**
   * **どの型だけを練習するか**(2026-09 利用者の指定
   * 「quick response 内で型のトレーニングをする際に、絞り込めるようにして欲しい」)。
   *
   * `null` ならぜんぶ。**Native Flow の Unit とまったく同じ作法**である ——
   * 覚える・出せない型は黙って落とす・変えたら読み直す。
   * 一覧も並びも `frameQrGroups()`(`sentenceFrames.js` の並び)が持つ。
   *
   * **型ひとつでも、系ぜんぶ(`系:◯◯`)でも、同じ1つの値**である
   * (第5.177節)。画面は中身を見ない —— 出せるかどうかも
   * `frameFormOk()` に聞く(**判断を2か所に持たない**)。
   */
  const [formWanted, setFormWanted] = useState(() => {
    try { return localStorage.getItem(FRAME_FORM_KEY) || null } catch { return null }
  })
  const partGroups = useMemo(() => frameQrGroups(part), [part])
  /* **出せない絞り方が残っていても、「ぜんぶ」に落ちる。**
     中身を切り替えたときに、向こうに無い型が残っていると0問になる */
  const form = frameFormOk(part, formWanted) ? formWanted : null

  /**
   * **ヒントを出しているか**(2026-09 利用者の指定)。
   *
   *   > 一度ボタンを押したら問題を跨いでも、
   *   > もう一度ヒントボタンを押すまでヒントが出続けるようにして欲しい。
   *
   * **カードではなく、ここに持つ。** `QrCard` は問ごとに描き直されるので、
   * あちらに持つと1問で消える(「問題を跨いでも」が成り立たない)。
   * **覚える** —— 押したままにしたいものなので、開き直しても消さない。
   */
  const [hintOn, setHintOn] = useState(() => {
    try { return localStorage.getItem(QR_HINT_KEY) === 'on' } catch { return false }
  })
  const pickHint = (on) => {
    setHintOn(on)
    try { localStorage.setItem(QR_HINT_KEY, on ? 'on' : 'off') }
    catch { /* 使えなくても困らない */ }
  }

  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(emptyFilter)
  const [order, setOrder] = useState(loadOrder)
  /**
   * **出題範囲と、1回ぶんの個数**(2026-09 利用者の指定)。
   *
   *   > 出題範囲の時系列での絞りかた…その時に復習したい単語やフレーズ、
   *   > 文章の個数だ。これを直感的に選択できる仕組みを作り上げたい。
   *
   * もとは「今日出すぶん / 溜まっているぶん全部」のプルダウン1つで、
   * **1回ぶんの区切りが無かった。** 87問溜まっていれば87問続く
   * (単語帳には10語で区切る決まりがあるのに、こちらで破っていた)。
   *
   * 算段は `reviewScope.js`、見た目は `ReviewScope.jsx` **1か所**。
   * 単語帳とまったく同じものを使う。**書き写さない。**
   * 選んだものは覚える(`eas.review.qr.*`)。
   */
  const [scope, setScope] = useState(() => loadScope('qr'))
  const [size, setSize] = useState(() => loadSize('qr'))
  /**
   * **いま選んでいる段**(まだ / 言えかけ / 言える)。`null` ならぜんぶ。
   *
   * 2026-09 利用者の指定「タッチすればそれらを復習できるように」。
   * **覚えない** —— その場の選択なので、次に開いたときは「ぜんぶ」に戻す
   * (覚えていると、なぜ言える文ばかり出るのか分からなくなる)。
   */
  const [group, setGroup] = useState(null)
  /** いま解いている一覧(**この回のぶんだけ**)。`null` なら、まだ始めていない */
  const [run, setRun] = useState(null)
  /**
   * **一度でも始めたか**(第5.167節)。
   *
   * 「開いた瞬間に1問目」を**一度しか走らせない**ための印である。
   * これが無いと、「とじる」で一覧へ戻った人をそのまま押し戻してしまう。
   * 冊・Unit・中身・型を変えたときは `dropRun()` が戻すので、
   * **新しい冊の1問目がそのまま出る。**
   */
  /**
   * **1問目を出すかどうかの判断が済んだか**(第5.172節)。
   *
   *   > 単語帳と quick response を開く際に、変な画面切り替えが出ないよう、
   *   > ローディングバーでスタイリッシュにしてください
   *
   * 押した直後は、まだ何問あるか分からない。そのあいだ一覧の画面を
   * 描いてしまうと、**空の札がちらりと出てから出題に入れ替わる。**
   * 判断が済むまでは**帯1本(`Loading`)だけ**を出す。
   *
   * **「始めたか」と分けない**(2026-09・第5.172節)。
   * 以前は `started`(始めたか)で見張っていたが、それだと
   * **1問も無くて始められなかったとき**に立たず、
   * 空の帳面が**永遠に読み込み中**に見える。
   * 立てるのは「判断が済んだ」ときで、始めたかどうかではない。
   */
  const [opened, setOpened] = useState(false)
  /**
   * **出題の箱(集中モード)が画面に出ているか**(第5.173節)。
   *
   *   > どの冊をやるのかを切り替える際に画面がチラつくのと、
   *   > 冊の中にさらに選択肢があるはずなのに選択肢が出ずに切り替わり…
   *
   * 以前は「問が入っているか」(`run`)で箱を出していた。だから冊を
   * 替えた瞬間に**箱ごと消え、その中にある本棚のシートまで一緒に消えて**
   * いた。中の選択肢(Unit・型)が出ないのも、開き直す手間になるのも、
   * **根は1つ**である。
   *
   * 箱を出すかどうかと、中に何を描くかを**分ける。**
   * 替えている最中は、**帯はそのまま・中身だけが帯1本**になる。
   */
  const [live, setLive] = useState(false)
  /** 冊(Unit・中身・型)を替えている最中か。**帯を残すための印** */
  const [switching, setSwitching] = useState(false)
  /* **聞き流し**(2026-09 利用者の指定「Quick Responseにも聞き流しを作ってくれ」)。
     答える練習ではないので、**箱も次に出す日も1ミリも動かさない**
     (単語帳とまったく同じ決まり。`WordRadio` の中でも呼んでいない) */
  const [radio, setRadio] = useState(null)   // 読む文。null なら出さない
  const [tracks, setTracks] = useState([])   // 曲(無ければ音楽は流れない)
  /* **紙に出しているあいだだけ真**(2026-09 利用者の指定)。
     中身は刷る一瞬だけ描く(単語帳とまったく同じ作法) */
  const [printing, setPrinting] = useState(false)
  /** まだ出していない残り。「つづける」で次の区切りへ進む */
  const [pending, setPending] = useState([])
  const [at, setAt] = useState(0)
  const [done, setDone] = useState([])
  /**
   * **この回で「言える」を記録した文。**
   *
   * 同じ範囲を続けて回したときに、同じ文を二度進めないための控えである
   * (`shouldRecord` の `already`)。読み直せば消える —— そのときには
   * `due_on` が新しくなっているので、控えが無くても正しく判定できる。
   */
  const gradedRef = useRef(new Set())
  /* **続けた記録と、週の目標**(0042・2026-09 利用者の指定)。
     単語帳と**同じ形**にそろえてある。**日ではなく週で数える** */
  const [week, setWeek] = useState(NO_WEEK)
  const [goal, setGoal] = useState(NO_GOAL)

  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ数える
  usePracticeLog('quick_response', Boolean(run), learnerId)

  const reload = async () => {
    setBusy(true)
    const [list, wk, aim] = await Promise.all([
      /* **Native Flow は、ファイル × 覚え具合。** 行の形はそろえてあるので
         (`nativeFlowRows()`)、ここから下は1文字も書き分けていない。
         **状態で絞らない** —— 3枚の札(まだ / 言えかけ / 言える)も
         読んだ行から数えるので、分けて読むと札と中身が食い違う */
      /* **Unit で絞るのは `nativeFlowRows()` 1か所。**
         覚え具合の側は絞らない —— あちらは英文で引くので、
         Unit を切り替えるたびに読み直す理由がない。
         **出してよい Unit の外は、そもそも渡さない**(`nfUnitIds`)——
         「ぜんぶ」を選んでいても、指定されていない Unit は出ない */
      /* **66 の型も、行の形をそろえてある**(`frameQrRows()`)。
         だからここから下は、Native Flow と1文字も書き分けていない */
      frameBook
        ? loadFrameQr({ learnerId, part, form })
        : nfBook
        ? loadNativeFlowQr({ learnerId, units: unit ? [unit] : nfUnitIds })
        : loadQrReviews(learnerId, { status: 'todo', limit: 500 }),
      /* 0042 を貼る前は 0 が返る。**数が出ないだけで、復習はできる** */
      loadQrWeek(learnerId),
      loadWeeklyGoal(learnerId),
    ])
    if (list.error) setError(list.error); else setError(null)
    setRows(list.data ?? [])
    if (wk.data) setWeek(wk.data)
    if (aim.data) setGoal(aim.data)
    setBusy(false)
  }

  /* **Unit を変えたら読み直す。** 出す問が丸ごと変わるためである。
     見張りには**数えられる形**(つないだ文字列)を入れる ——
     `nfUnits`(配列)そのものを入れると、描き直すたびに別のものになり、
     読み直しが止まらない(`onlyKey` / `shelfKey` と同じ落とし穴) */
  const nfKey = nfUnitIds.join(',')
  useEffect(() => { reload() }, [learnerId, book, unit, nfKey, part, form])

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  const today = todayKey()
  /* 絞り込みは**手元で行う**(単語帳と同じ)。`qr_items()` は 500 件まで
     返しているので、選ぶたびに Supabase へ聞き直さない。待ち時間も費用も増えない */
  /* **段で絞ってから、絞り込みを当てる。** 順はどちらでも同じものが残るが、
     **数え上げ(`tally`)は段で絞る前の `rows` から出す** ——
     押すたびに札の数が変わっては、何を選んでいるのか分からなくなる */
  const filtered = useMemo(
    () => applyWordbookFilter(qrGroupPool(rows, group), filter),
    [rows, group, filter],
  )
  /** いま選んでいる範囲にあてはまるもの。**数え上げと同じ道を通す** */
  const shown = useMemo(() => scopePool(filtered, scope, today), [filtered, scope, today])

  /**
   * 3つの数(2026-09 実機・利用者の指定で「今日出す / 溜まっている」から改めた)。
   *
   * **SQL は1行も要らない。** `qr_items` は箱(`box`)を返しているので、
   * 読み込んだ行から数えられる。数え方は **`qrTally()` 1か所**
   * (`qrReviews.js`)—— 画面で数え直すと、単語帳とずれる。
   */
  const tally = useMemo(() => qrTally(rows), [rows])
  /** いくつ絞っているか。**畳んでいても分かるように**札の数として渡す */
  const narrowed = countNarrowed(filter)

  /**
   * **紙に出す対**(2026-09 利用者の指定「クイックレスポン帖の内容を印刷」)。
   *
   * 刷るのは**段の札と絞り込みを当てたもの**(`filtered`)である。
   * **範囲の札(いつのぶん)は当てない** —— あれは出題の話であって、
   * 帳面の中身ではない(単語帳とまったく同じ考え方)。
   * 対に直すのは `qrSheetPairs()` 1か所(`reviewSheet.js`)。
   */
  const sheetPairs = qrSheetPairs(filtered)
  usePrintSheet(printing, () => setPrinting(false))

  /**
   * 段を押したとき。**範囲は「ぜんぶ」に移す**(2026-09 利用者の指定)。
   *
   * 「言える」文は箱6なので、次に出る日が30日先である。範囲が
   * 「今日出す」のままだと**押した瞬間に0件**になり、押せたのに
   * 何も出ないという、いちばん分かりにくい形になる。
   * 段を外したら、覚えている範囲へ戻す(`onlySet` と同じ作法)。
   */
  const pickGroup = (id) => {
    setGroup(id)
    setScope(id ? 'all' : loadScope('qr'))
  }

  /* **選んでいた札が0件になったら、押せる札へ移す**(絞り込みを変えたとき)。
     黙って空のまま置くと、「出すものがありません」だけが残って
     何を押せばよいのか分からない(`pickScene` と同じ作法・CLAUDE.md) */
  const counts = scopeCounts(filtered, today)
  useEffect(() => {
    if (busy || filtered.length === 0) return
    if ((counts[scope] ?? 0) > 0) return
    const next = SCOPES.find((s) => (counts[s.id] ?? 0) > 0)
    if (next) setScope(next.id)
  }, [busy, filtered.length, counts[scope], scope])

  const start = () => {
    setLive(true)
    const list = orderQrPairs(shown.map(qrPairOf), order)
    const take = takeCount(size, list.length)
    setRun(list.slice(0, take))
    /* **残りは捨てない。**「つづける」で次の区切りへ進む。
       ここで切り落とすと、「教材の順」を選んだ人は
       **いつまでも先頭の10問しか出てこない** */
    setPending(list.slice(take))
    setAt(0)
    setDone([])
  }

  /**
   * **開いた瞬間に1問目**(第5.167節・2026-09 利用者の提案)。
   *
   *   > サイドバーや下のタブからクリックしたらすぐに実際のトレーニングの
   *   > 画面に飛び、その画面にメニューを足す。
   *
   * **一度しか走らない**(`opened`)。「とじる」で一覧へ戻った人を
   * 押し戻さない。**1問も無ければ入らない** —— 空の画面をそのまま使う。
   */
  useEffect(() => {
    if (busy || opened) return
    /* **判断が済んだことを、必ず先に立てる。** ここを「始めたときだけ」に
       すると、1問も無い帳面で**帯1本のまま止まる** */
    setOpened(true)
    setSwitching(false)
    if (shown.length === 0) {
      /* **出す問が無い冊に替えたときは、一覧の画面へ戻す**(第5.173節)。
         帯のまま止めると、読み込み中に見えて終わらない */
      setLive(false)
      return
    }
    start()
  }, [busy, opened, shown.length])

  /**
   * **聞き流しを始める**(2026-09 利用者の指定)。
   *
   *   > Quick Responseにも聞き流しを作ってくれ。
   *   > 英語だけ・日本語→英語 この２種類だ。
   *
   * **読む文は、出題とまったく同じ道で選ぶ**(`shown` → `qrPairOf` →
   * `orderQrPairs`)—— 範囲の札も絞り込みも並べ方も、そのまま効く。
   * **数え方を2通り持たない。** ただし**問数では切らない**
   * (聞き流しは終わりを決めずに回すもの・単語帳と同じ)。
   *
   * 曲は**押したときに引く。** 押さない人には1回も問い合わせが飛ばない。
   * **曲が0本でも聞き流しは始まる**(音楽が鳴らないだけ・行き止まりを作らない)。
   */
  const listen = async () => {
    const pool = orderQrPairs(shown.map(qrPairOf), order)
    if (!pool.length) return
    setRadio(pool)
    const { data } = await listTracks()
    setTracks(data ?? [])
  }

  /**
   * **復習の最中に「出しかた」を変えたら、その場で組み直す**
   * (2026-09 利用者の指定「中に入ってからも絞り込みができるように」)。
   * 変わったかどうかは **`runKeyOf()` 1か所**(単語帳と同じもの)。
   */
  const runKey = runKeyOf({ scope, size, filter, group })
  const runKeyRef = useRef(runKey)
  useEffect(() => {
    if (!run) { runKeyRef.current = runKey; return }
    if (runKeyRef.current === runKey) return
    runKeyRef.current = runKey
    start()
  }, [runKey, Boolean(run)])

  /** 次の区切りへ。**読み直さない** —— 並びと残りをそのまま持っている */
  const next = () => {
    const take = takeCount(size, pending.length)
    setRun(pending.slice(0, take))
    setPending(pending.slice(take))
    setAt(0)
    setDone([])
  }

  const stop = () => {
    stopReading()
    setLive(false)
    setRun(null)
    setPending([])
    gradedRef.current = new Set()
    // **答えた結果を映し直す。** 箱が動いているので、残り数が変わる
    reload()
    /* **とじたら達成具合へ**(第5.167節)。トップ画面が無くなったので、
       戻り先をそこにする。**渡されなければ一覧へ戻る** */
    onClose?.()
  }

  const answer = async (ok) => {
    const card = run[at]
    /* **押した手応えを返す。** 言えたらピンポン、まだなら低く1つだけ */
    answerFeedback(ok)
    /* 「まだ」は箱を 0 に戻して翌日、「言える」は箱を1つ上げる。
       **何日後に出すかは SQL(`mark_qr`)が決める。** 画面には持たない

       **記録するかどうかは `shouldRecord()` 1か所**(`reviewScope.js`)。
       「まだ」はいつでも、「言える」は**期限が来ていて、この回でまだ
       進めていないとき**だけ。**遅く出す方へは動かさない** ——
       同じ範囲を1日に何度も回すと、明日の復習が空になるためである */
    const key = card.key || card.en
    if (shouldRecord(ok, {
      dueOn: card.due_on, addedAt: card.added_at, today, already: gradedRef.current.has(key),
    })) {
      if (ok) gradedRef.current.add(key)
      await markQr(card, ok ? 'learning' : 'unknown', { learnerId })
    }
    setDone((d) => [...d, { ...card, ok }])
    setAt((i) => i + 1)
  }

  /** **もう出さない**(間違えて溜めた文・すっかり言えるようになった文) */
  const retire = async () => {
    const card = run[at]
    await markQr(card, 'known', { learnerId })
    setDone((d) => [...d, { ...card, ok: true }])
    setAt((i) => i + 1)
  }

  /**
   * **やりかけを捨てる。** 冊・Unit・中身・型のどれを変えても、
   * 出す問が丸ごと変わるので持ち越せない。
   * **4か所に書き写さない**(CLAUDE.md)—— 1つ足し忘れると、
   * **前の冊の問が次の冊で出続ける**。
   */
  const dropRun = () => {
    setRun(null); setPending([]); setAt(0); setDone([])
    setRadio(null); setGroup(null); setFilter(emptyFilter)
    /* **「開いた瞬間に1問目」をもう一度走らせる**(第5.167節)。
       冊を変えた人は、その冊の1問目をやりに来ている。
       冊が変われば問も変わるので、**判断からやり直す** */
    setOpened(false)
    /* **`live` は倒さない**(第5.173節)。倒すと箱ごと消えて、
       **その中にある本棚のシートまで一緒に消える** */
    setSwitching(true)
    gradedRef.current = new Set()
  }

  const who = learnerName ? `${learnerName} さんの` : ''

  /**
   * **冊の中の区切り**(Unit・中身・型)。**その冊の行の中**に出す(第5.167節)。
   * 「どの帳面の、どこ」が**1か所で決まる。**
   */
  const bookSub = nfBook ? (
    /* **どの Unit を練習するか**(2026-09 利用者の指定「UNIT毎に分けて」)。
       並ぶのは**その人に出してよい Unit だけ**で、判断は
       `nfUnitsFor()` が済ませてある */
    <NativeFlowUnits
      units={nfUnits}
      picked={unit}
      onPick={(id) => {
        setUnitWanted(id)
        try {
          if (id) localStorage.setItem(NF_UNIT_KEY, String(id))
          else localStorage.removeItem(NF_UNIT_KEY)
        } catch { /* 使えなくても困らない */ }
        dropRun()
      }}
    />
  ) : frameBook ? (
    /* **66 の型の、どの中身を練習するか**(2026-09 利用者の指定)。
       見た目も置き場所も、**Unit の欄とまったく同じ**(`FrameParts`) */
    <FrameParts
      parts={FRAME_PARTS}
      counts={partCounts}
      picked={part}
      onPick={(id) => {
        setPartWanted(id)
        try { localStorage.setItem(FRAME_PART_KEY, id) }
        catch { /* 使えなくても困らない */ }
        dropRun()
      }}
      /* **型で絞る**(2026-09 利用者の指定)。一覧も並びも系ごとの数も
         `frameQrGroups()` が持つ —— 画面で型を書き写さない */
      groups={partGroups}
      form={form}
      onForm={(f) => {
        setFormWanted(f)
        try {
          if (f) localStorage.setItem(FRAME_FORM_KEY, f)
          else localStorage.removeItem(FRAME_FORM_KEY)
        } catch { /* 使えなくても困らない */ }
        dropRun()
      }}
    />
  ) : null

  /**
   * **どの Quick Response 帳か**(第5.167節で帯へ移した)。
   *
   * 札を横に並べる形は、冊3つでも**2行に折り返していた**
   * (「自分の Quick Response 帳」が長い・390px で実測)。
   * **縦1列の本棚**にすれば、冊が増えても見た目が変わらない。
   *
   * **1つの `bookPick` を、始める前と復習の帯の両方で使う。**
   * 書き写すと、必ず片方だけ古くなる(CLAUDE.md)。
   */
  /**
   * **いま開いている帳面の名前(全文)**(第5.176節)。
   * 帯の札は「…」で切れるので、**切れない名前をここが受け止める。**
   * 名前は `books` 1か所から引く —— 画面で書き写さない。
   */
  const drillTitle = <DrillTitle label={books.find((b) => b.id === book)?.label ?? ''} />

  const bookPick = (
    <BookPick books={books} book={book} unit="問" sub={bookSub}
              title="どの Quick Response 帳をやりますか"
              onPick={(id) => { setBookWanted(id); dropRun() }} />
  )

  /**
   * **ほかの道具**(言う練習・聞き流し・紙に出す)。
   *
   * トップ画面が無くなったので(第5.167節)、復習の最中に開ける
   * 「出しかた」の中へ入れる。**中身は書き写さない** ——
   * 始める前の `.wb-tools` とまったく同じものを、ここ1か所から渡す。
   */
  const toolsBox = (
    <div className="wb-tools">
      <button type="button" className="btn btn--quiet wb-listen"
              disabled={shown.length === 0}
              onClick={listen}>
        {/* **言葉と中身を食い違わせない**(2026-09)。
            ここは**聞き流しだけの場所ではない** —— パタプラの
            「言う練習」「チャンクで積む」も、この中にある */}
        <MusicIcon />言う練習・聞き流し({shown.length} 問)
      </button>
      {/* 何問ぶん刷るのかを、**押す前に**出す(紙は戻せない) */}
      <button type="button" className="btn btn--quiet wb-listen"
              disabled={sheetPairs.length === 0 || printing}
              onClick={() => setPrinting(true)}>
        <PrintIcon />{printing ? '紙に出しています…' : `印刷 / PDFで保存(${sheetPairs.length} 問)`}
      </button>
    </div>
  )

  /* **Supabase が無くても、66 の型は開ける**(2026-09)。
     あちらはファイル(`phraseSwap.js` / `frameShift.js`)に書いてあり、
     **問を出すのにサーバーを1回も呼ばない**(覚え具合が付かないだけ)。
     ここで丸ごと打ち切ると、会社のネットワークが塞がった日に
     **開く道が無くなる**(**行き止まりを作らない**・CLAUDE.md)。

     **打ち切らずに、そのまま下の本体へ通す** —— 別の見た目を用意すると、
     **設定のある人と無い人で画面が2つ**になり、片方だけ古くなる */
  if (!isSupabaseConfigured && !frameBook) {
    return (
      <section className="card">
        <h2 className="card-title">Quick Response(復習)</h2>
        {bookPick}
        <p className="hint">
          Supabase が設定されていないため、復習は溜まりません。
          「{FRAME_BOOK_LABEL}」は、設定が無くてもそのまま使えます。
        </p>
      </section>
    )
  }

  // ── 解いているあいだ ───────────────────────────────────────
  //
  // **集中モードで出す**(2026-09 利用者の指定)。
  //
  //   > Quick Response は集中モード扱いなので、
  //   > 上下の余計な情報は表示しないでください。
  //
  // これまでは**ふつうのページの中**に置いていたので、上には左メニュー・
  // 上の帯・接続の知らせ・試作版の断り書き、下には版とサンプルデータの
  // ボタンが残っていた。**1問だけに向き合う場所なのに、まわりが騒がしい。**
  //
  // 骨組みは `FocusFrame` 1つ(`FocusReader` / `StepFocus` /
  // 教材の中の Quick Response と同じもの)。**書き写さない。**
  // portal で body の直下に出るので、**まわりのものは自動的に消える。**
  /* **中身が無くても、箱は残す**(第5.173節)。冊を替えたときにここを
     畳むと、帯も本棚も一緒に消える —— 本棚のシートは `BookPick`
     (この中)が持っているので、消えたぶんだけ開き直す手間になる */
  if (live) {
    const n = run?.length ?? 0
    const finished = n > 0 && at >= n
    const body = (
      /* **`qr--paper` は付けない**(2026-09 実機・利用者の指定)。
         あれは**紙の上の色**に差し替えるもので、地が白くなった
         この画面では要らない —— 何も足さなければアプリの配色に従い、
         単語帳の復習とそろう(`.focus-paper` の吹き出しと同じ考え方) */
      <section className="qr">
        {/**
          * **いま開いている帳面の名前を、全文で出す**
          * (第5.176節・2026-09 実機・利用者の指定)。
          *
          *   > タブが画面幅に収まるようにすると、冊のタイトルが長いものは、
          *   > 省略されて表示されることになる。
          *   > その分コンテンツの方にタイトルとして全文をきちんと表示する。
          *
          * 帯の `冊名 ▾` は**押すもの**なので、幅に収まるところで
          * 「…」に切れる。**切れた名前を、ここが受け止める。**
          * 単語帳とまったく同じ場所・同じ形である(`drillTitle` 1か所)。
          */}
        {drillTitle}
        {/**
          * **「1 / 30」はやめて、進み具合の帯にした**(第5.176節)。
          *
          *   > 1/30などは進捗バーにしましょう
          *
          * 帯はもともとここに在る。**数を消しただけ**で、
          * 単語帳(点が並ぶ)とも「数字を出さない」で そろう。
          */}
        <div className="qr-bar" aria-hidden="true">
          <span style={{ width: `${n ? Math.round((Math.min(at, n) / n) * 100) : 0}%` }} />
        </div>
        {n === 0 ? (
          /* **冊を替えている最中は、ここだけが帯になる**(第5.173節)。
             上の冊名も進み具合も残るので、**画面のどこも動かない** */
          <Loading />
        ) : (<>

        {finished ? (
          /* **終わりの1枚は、単語帳とまったく同じ部品**(`SessionResult`・
             2026-09 利用者の指定「ゲーミフィケーションを追加したいです」)。
             点数・声かけ・連続・できなかったものを、
             **書き写さずに1か所で持つ**(単語帳で踏んだ失敗) */
          <div className="qr-result">
            <SessionResult
              items={done.map((x) => ({ ok: x.ok, main: x.en, sub: x.ja }))}
              unit="文"
              week={week}
              extra={<GoalBar goal={goal.sentGoal} done={goal.sentDone} unit="文" />}
              missLead="上に出ているのが、言えなかった文です。また明日出ます。"
            >
              {/* **行き止まりを作らない。** 範囲に残りがあれば、
                  読み直さずにそのまま次の区切りへ進める(並びも保たれる) */}
              <div className="btn-row">
                {pending.length > 0 && (
                  <button type="button" className="btn btn--primary" onClick={next}>
                    つぎの {takeCount(size, pending.length)} 問
                  </button>
                )}
                <button type="button"
                        className={`btn ${pending.length > 0 ? 'btn--quiet' : 'btn--primary'}`}
                        onClick={stop}>
                  おわる
                </button>
              </div>
              {pending.length > 0 && (
                <p className="card-hint">この範囲に、あと {pending.length} 問あります。</p>
              )}
            </SessionResult>
          </div>
        ) : (
          /* **1問ぶんは、教材の中の Quick Response とまったく同じ部品**(`QrCard`)。
             ちがうのはボタンの言葉だけ(2026-09 利用者の指定)。
             教材の中は「その場で言えたか」、こちらは「これから言えるか」を訊く */
          <QrCard
            pair={run[at]} no={at + 1}
            onAnswer={answer}
            yetLabel="まだ" okLabel="言える"
            /* **ヒント**(2026-09 利用者の指定)。押した状態は**ここが持つ** ——
               カードは問ごとに描き直されるので、あちらに持つと1問で消える。
               **ヒントを持たない行にはボタンが出ない**(`QrCard` が見ている) */
            hintOn={hintOn} onHint={pickHint}
            /* **型を出すのは、この復習の画面だけ**(2026-09 利用者の指定
               「型の見分け、使い分けは必ず実現したいトレーニングです」)。
               教材の中の Quick Response には**渡していない** ——
               あちらは集中モードや紙にも出るので、
               **言われていない場所を勝手に変えない**(CLAUDE.md) */
            showFrame
            extra={(
              /* **消す道を必ず用意する。** 溜まる一方だと、押し間違えた1問が
                 ずっと出続ける。答えではない操作なので、枠線だけのボタンにする */
              <button type="button" className="btn btn--ghost btn--small" onClick={retire}>
                もう出さない
              </button>
            )}
          />
        )}
        </>)}
      </section>
    )

    /* **下の帯は渡さない。** Quick Response は「まだ / 言える」で進むので、
       ◀ 前 / 次 ▶ を置くと進め方が2つになる(教材の中の Quick Response と同じ) */
    return (
      <FocusFrame
        className="qrfocus"
        /* **紙を持たない集中モードにする**(2026-09 実機・利用者の指定)。
             > あくまでバックグラウンドの色を白くして、
             > 集中モードではなくしてください
           単語帳の復習と**並ぶ画面**なので、見た目もそろえる。
           **幅は1ドットも変えていない**(「幅は変えないでくださいよ」) */
        plain
        learnerId={learnerId}
        page={`qrrev:${at}`}
        scrollKey={`qrrev:${at}`}
        onClose={stop}
        /* **左上は ☰**(第5.172節)。渡されなければ ✕ 閉じるのまま */
        onMenu={onMenu}
        /**
         * **冊名 ▾ は帯に置く。単語帳とまったく同じ並び**
         * (第5.176節・2026-09 実機・利用者の指定)。
         *
         *   > quick response 帳、ダサくなったので、単語帳と同じ仕様に
         *   > 戻してください。…選択肢のタブをそのまま下に移すのは
         *   > ダサいと思います。つまり、タブが画面幅に収まるようにすると、
         *   > 冊のタイトルが長いものは、省略されて表示されることになる。
         *   > その分コンテンツの方にタイトルとして全文をきちんと表示する。
         *
         * **はみ出していた本当の中身は「1 / 30」だった。**
         * あれを進み具合の帯にすれば、帯は ☰ / 冊名 ▾ / 出しかた の3つ ——
         * **単語帳とまったく同じ**になり、収まる。
         * 長い冊名は**帯の中で「…」に切れてよい** ——
         * **全文は、すぐ下にタイトルとして出す。**
         */
        top={bookPick}
        /* **中に入ってからも絞り込める**(2026-09 利用者の指定)。
           始める前とまったく同じ「出しかた」を、帯の右端から開く。
           **中身は書き写さない** —— `ReviewScope` の畳んだ形である */
        topEnd={(
          <ReviewScope
            compact
            rows={filtered}
            unit="問"
            scope={scope}
            size={size}
            narrowed={narrowed}
            onScope={(id) => { setScope(id); saveScope('qr', id) }}
            onSize={(sz) => { setSize(sz); saveSize('qr', sz) }}
            onStart={start}
            /* **言う練習・聞き流し・紙に出すも、この中**(第5.167節)。
               トップ画面が無くなったので、置き場所がここだけになった */
            tools={toolsBox}
          >
            <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
          </ReviewScope>
        )}
      >
        {body}
      </FocusFrame>
    )
  }

  /**
   * **開くときに、変な画面の入れ替わりを出さない**(第5.172節)。
   *
   * 判断が済むまでは**帯1本だけ**を出す。カードの題も札も描かない ——
   * 描いてしまうと、**一瞬だけ出て、すぐ出題に入れ替わる。**
   * 出題に入っているあいだ(`run`)は、ここまで来ない。
   */
  /* **はじめて開いたときだけ、帯1本だけを出す**(第5.172節)。
     冊を替えたときは題も `冊名 ▾` も残す(第5.173節)—— 消すと、
     **本棚のシートまで一緒に消えて**、開き直す手間になる */
  if ((busy || !opened) && !switching) return <Loading />

  // ── 始める前 ───────────────────────────────────────────────
  return (
    <section className="card">
      {/* **上の説明は出さない**(2026-09 実機・利用者の指定
          「上下の説明が不要です。これはquick response、単語帳に共通です」)。
          一度読めば足りるものが、毎日いちばん上に居座っていた */}
      <h2 className="card-title">{who}Quick Response(復習)</h2>

      {!qrReviewSupported() && (
        <p className="notice notice--warn">
          この Supabase にはまだ復習の入れ物(0040 の SQL)が入っていません。
          貼るまでは、教材の Quick Response はこれまでどおり使えますが、
          「まだ」を押した文は溜まりません。
        </p>
      )}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {/* **どの Quick Response 帳か**(第5.167節で帯へ移した)。
          いまは**縦1列の本棚**を、`冊名 ▾` から開く。
          中身は `bookPick` 1か所 —— **復習の帯と同じものを出す** */}
      {bookPick}

      {/* **冊の札は、読み込みや「まだ1問も溜まっていません」より前**に置く。
          うしろに置くと、まだ溜まっていない人は札そのものが見えず、
          **ほかの冊を開く道が無くなる**(行き止まり)。

          **「まだ1問も溜まっていません」は自分の帳だけに出る** ——
          Native Flow と 66 の型はファイルに問を持っているので、
          `rows` が空になることがない(この道には入らない) */}
      {/* **冊を替えている最中は、ここから下だけが帯になる**(第5.173節)。
          題も `冊名 ▾` も残るので、**画面のどこも動かない** */}
      {busy || !opened ? <Loading /> : rows.length === 0 ? (
        <p className="hint">
          まだ1問も溜まっていません。教材の Quick Response で「まだ」を押すと、
          その文がここに入ります。
        </p>
      ) : (
        <>
          {/* **数え方を、単語帳とそろえる**(2026-09 実機・利用者の指定)。

                > 「今日出す」「溜まっている」の意味が私にも分からないので、
                > そもそも文言を変えたいですね。

              調べたところ、Anki(新規 / 学習中 / 復習)も WaniKani も
              mikan(今日の目標 / 覚えた単語数)も、**「帳面ぜんぶの数」を
              大きく出しているアプリはほとんど無かった。** 出しているのは
              「今日やる数」か「覚えた数」(=進み具合)である。

              しかも**このアプリの単語帳には、すでに
              「まだ / 覚えかけ / 覚えた」**があった。こちらだけが
              「今日出す / 溜まっている」という**別の数え方**をしていた。
              利用者が単語帳にそろえることを選んだ。

              **「今日いくつやるか」は、すぐ下の「6 問を出す」が言っている。**
              だからここでは言わない(同じものを2か所に出さない)。

              箱(0〜6)は**仕組みの内側の数字なので画面に出さない**が、
              **どの段にいるか**を3つに束ねて言うことはできる。
              言葉は Quick Response の言い方にそろえる(「覚えた」ではなく
              「言える」)—— あちらは語、こちらは文である。

              **押せる**(2026-09 利用者の指定「タッチすればそれらを
              復習できるようにしたい」)。見た目は `ReviewStats` 1つで、
              単語帳とまったく同じもの。**書き写さない** */}
          {/* **Unit と、66 の型の中身・型は、本棚の行の中へ移した**
              (第5.167節)。「どの帳面の、どこ」が**1か所で決まる** */}

          <ReviewStats
            items={QR_GROUPS.map((g) => ({ ...g, n: tally[g.id] ?? 0 }))}
            value={group}
            onPick={pickGroup}
            dueId="yet"
            lead={groupLead(QR_GROUPS, group, '問')}
          />

          {/* **いつのぶんを、何問ずつ、何で絞るか**(2026-09 利用者の指定)。
              単語帳とまったく同じ部品。**書き写さない。**
              絞り込みと並べ方も、**この中(「出しかた」)に入れる** ——
              設定が画面の3か所に散っていたのを1か所にまとめた */}
          <ReviewScope
            rows={filtered}
            unit="問"
            scope={scope}
            size={size}
            narrowed={narrowed}
            onScope={(id) => { setScope(id); saveScope('qr', id) }}
            onSize={(s) => { setSize(s); saveSize('qr', s) }}
            onStart={start}
          >
            {/* **絞り込みは単語帳と同じ部品**(`WordbookFilter`)。
                ちがうのは、**教材名のプルダウンを出す**という1点だけ
                (2026-09 利用者の指定「『テキスト』= 教材の名前で絞る」) */}
            <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
            <label className="wbfilter-row">
              <span className="wbfilter-name">並べ方</span>
              <select className="wbfilter-ctl" value={order}
                      onChange={(e) => { setOrder(e.target.value); saveOrder(e.target.value) }}>
                {QR_ORDERS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </ReviewScope>

          {/* **聞き流し**と**紙に出す**。中身は `toolsBox` 1か所 ——
              復習の「出しかた」にも、同じものが出る(書き写さない) */}
          {toolsBox}

          {shown.length === 0 && filtered.length === 0 && (
            <p className="hint">この絞り込みに当てはまる文がありません。</p>
          )}
        </>
      )}

      {/* **部品は `WordRadio` 1つ。** 単語帳とまったく同じものを使い、
          渡すのは「どの画面から来たか」だけ(`where`)。
          読み方の一覧も、覚える鍵も `wordRadio.js` が持っている ——
          **書き写すと、必ず片方だけ古くなる**(CLAUDE.md) */}
      {radio && (
        <WordRadio
          rows={radio}
          where="qr"
          tracks={tracks}
          learnerId={learnerId}
          /* **聞き流しの左上も ☰**(第5.172節・利用者の指定) */
          onMenu={onMenu}
          onClose={() => setRadio(null)}
        />
      )}

      {/* **中身は、紙に出す一瞬だけ描く**(単語帳とまったく同じ作法)。
          見た目は**教材の紙の Quick Response と同じ指定**に乗っている ——
          利用者の言う「教材を印刷、PDFにした時のクイックレスポンの部分と
          同じ仕様」そのものである */}
      {printing && (
        <ReviewSheet
          title={`${who}Quick Response 帳`}
          note={sheetNote({
            count: sheetPairs.length,
            unit: '問',
            group: QR_GROUPS.find((g) => g.id === group)?.label ?? '',
            narrowed,
            date: today,
          })}
          lead="左の日本語を見て、すぐに英語で言いましょう。右が答えです。"
          /* **品詞では分けない**(`byPos: false`)。ここに並ぶのは**文**で、
             文に品詞は無い。小見出しの無い節を1つ渡すので、
             **紙は1ドットも変わらない**(小見出しはそのときだけ出る)。
             **巻末のレクチャーも出さない** —— 言われたのは単語帳である */
          sections={wordSheetSections(sheetPairs, { byPos: false })}
        />
      )}
    </section>
  )
}
