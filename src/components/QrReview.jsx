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
  qrSourceSupported,
} from '../lib/qrReviews.js'
import Loading from './Loading.jsx'
/* ★ **いくつ絞っているかは `narrowedCount()`**(第5.414節)——
   段階も一緒に数えるので、`countNarrowed()` を直に呼ばない */
import WordbookFilter, { applyWordbookFilter, emptyFilter } from './WordbookFilter.jsx'
import BookPick from './BookPick.jsx'
import DrillHead from './DrillHead.jsx'
/* ★ **送る / 判定する操作**(第5.417節・段階4)。単語帳と同じ部品 */
import CardMove from './CardMove.jsx'
import { isCoarse, keyLabel } from '../lib/cardMove.js'
import ReviewScope from './ReviewScope.jsx'
import FrameParts from './FrameParts.jsx'
import ReviewStats from './ReviewStats.jsx'
/* ★ **出しかたは「何を出す」4つ + 問数3つ + スイッチ2つ**(第5.414節・段階3)。
     単語帳とまったく同じものを使う —— 書き写さない */
import {
  PICKS, loadRepeat, loadScope, loadShuffle, loadSize,
  narrowedCount, orderToUse, pickCounts, pickIdOf, pickName, pickOf,
  runKeyOf, saveRepeat, saveScope, saveShuffle, saveSize, scopePool, shouldRecord,
  takeCount, todayKey,
} from '../lib/reviewScope.js'
/* ★ **覚え具合は4段階**(第5.406節・2026-10-07 利用者の指定)。
     単語帳とまったく同じものを使う —— 分け方を2か所に書かない */
import {
  LEARN_STAGES, stageLead, stageOrDefaultPool, stageTally,
} from '../lib/learnStage.js'
import { loadNativeFlowQr } from '../lib/nativeFlowQr.js'
import { nextFilledBook } from '../lib/bookOpen.js'
import { nowName } from '../lib/bookNow.js'
import {
  FIRST_FRAME_PART, FRAME_BOOK_LABEL, FRAME_FORM_KEY, FRAME_PARTS,
  FRAME_PART_KEY, QR_HINT_KEY, frameFormLabel, frameFormOk, framePartOf,
  frameQrCounts, frameQrGroups,
} from '../lib/frameQr.js'
import { loadFrameQr } from '../lib/frameQrLoad.js'
/* 覚えておきたい表現集(0066・第5.237節)。**呼び名と、どの冊が何を読むかは
   あちら1か所**。ここで冊の id を比べたり、名前を書き写したりしない */
import { CHUNK_BOOK_LABEL, qrSourceOfBook } from '../lib/quickResponse.js'
import { NF_BOOK_LABEL, NF_UNIT_KEY, unitName, unitOf } from '../data/nativeFlow.js'
import NativeFlowUnits from './NativeFlowUnits.jsx'
import QrCard from './QrCard.jsx'
import SessionResult from './SessionResult.jsx'
import GoalBar from './GoalBar.jsx'
import FocusFrame from './FocusFrame.jsx'
import WordRadio from './WordRadio.jsx'
import { MusicIcon, PrintIcon, RepeatIcon, SpeakerIcon } from './Icons.jsx'
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
   * **型の Quick Response 帳を出すか**(第5.179節・2026-09 利用者の指定)。
   *
   *   > Native Flow や 14 の型は指定したゲストにだけ出るようにしたいです。
   *
   * **判断はここでしない。** `showsFrameQr()`(`src/data/learnerFeatures.js`)が
   * 済ませたものを受け取るだけである(`nfUnits` とまったく同じ作法)。
   *
   * **既定は出さない。** 渡さない場所(トレーナーがゲストのページから開く
   * Quick Response 帳)は、これまでどおり自分の帳だけである。
   */
  frameOn = false,
  /**
   * **とじたときの行き先**(第5.167節)。
   *
   * 開いた瞬間に始まる形にしたとき、トップ画面が無くなったので
   * **閉じたときの戻り先が無い。** 呼ぶ側が渡す。
   * **単語帳とまったく同じ形。**
   *
   * **いまの行き先はホーム**(第5.246節)。もとは「達成具合」の
   * ページだったが、**そのページごと廃止した。**
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
    ...(nfUnits.length ? [{ id: 'nf', label: NF_BOOK_LABEL, hasSub: true }] : []),
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
       型を足した日に、ここだけ古い数が残らないようにする(第5.177節)。

       **指定したゲストにだけ出す**(第5.179節・2026-09 利用者の指定)。
       判断は `showsFrameQr()` 1か所で、ここでは受け取るだけである ——
       Native Flow(`nfUnits`)とまったく同じ作法にしてある */
    ...(frameOn ? [{ id: 'frame', label: FRAME_BOOK_LABEL, hasSub: true }] : []),
    /* **覚えておきたい表現集**(0066・第5.237節・2026-09 利用者の指定)。

         > 「覚えておきたい表現」から「まだ」を押して…加えられたものは、
         > 「覚えておきたい表現集」のタグをつけておき、自分の quick response
         > とは別に、**単体の冊として**ためていけないですか?

       **中身は `qr_reviews` の `source = 'chunk'`。** 自分の Quick Response 帳
       (`sentence`)とは、同じ表の中で冊だけが分かれている。

       **0066 を貼る前は出さない** —— あの引数が無い Supabase では冊で
       絞れず、**自分の Quick Response 帳とまったく同じ中身が2つ並ぶ。**
       判断は `qrSourceSupported()` 1か所(`qrReviews.js`)。
       **後ろへ足す。並べ替えない**(docs/notes/22 の決まり) */
    ...(qrSourceSupported() ? [{ id: 'chunk', label: CHUNK_BOOK_LABEL }] : []),
  ]
  /**
   * **冊を替えても、聞き流しを続ける**(第5.283節・2026-09-27 利用者の指定)。
   *
   * `dropRun()` は `setRadio(null)` を含むので、冊を替えると
   * **聞き流しから放り出される。** 替えたのは「次はあの冊を聴きたい」
   * からであって、やめたいわけではない。
   *
   * **`dropRun()` は変えない** —— 帯の `冊名 ▾` から替えた人は、
   * これまでどおり練習へ降りる。**どちらから替えたかを、この印で分ける。**
   */
  const keepRadioRef = useRef(false)
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
  /* ★ **シャッフルは別のスイッチ**(第5.414節)。「ランダム」は
       並べ方の一覧から出て、こちらが持つ。**どれがランダムかは
       `QR_ORDERS` が言う** —— id(`shuffle`)を書き写さない */
  const [shuffle, setShuffle] = useState(() => loadShuffle('qr', QR_ORDERS))
  /* **繰り返すか**(第5.244節・2026-09-23 利用者の指摘
     「個数を指定して繰り返す指定もなくなってしまっていませんか?」)。

     **仕組みは前からあった**(`reviewScope.js` の `loadRepeat`)。
     単語帳は使っていたのに、**こちらが `ReviewScope` へ渡していなかった**
     ので、画面のどこにも出ていなかった。
     鍵は `'qr'`(単語帳は `'word'`)—— 別々に覚える */
  const [repeat, setRepeat] = useState(() => loadRepeat('qr'))
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
   * **冊を変えたときだけ** `dropRun()` が戻すので、新しい冊の1問目が
   * そのまま出る。**冊の中で絞っただけのとき(Unit・中身・型)は戻さない**
   * (第5.191節)—— 戻すと絞るたびに練習が始まり直し、
   * **本棚のシートごと畳まれて、2つめを選べない。**
   * そちらは `runKey` が**その場で組み直す。**
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
  /** ★ 曲を読めなかった理由(第5.396節)。**空と取り違えない** */
  const [tracksError, setTracksError] = useState(null)
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

  /**
   * **いま読んである中身が、どの選び方のものか**(第5.191節・2026-09 実機)。
   *
   * ============================================================================
   *   > quick responseの冊の絞り込みが全く機能していません。
   *
   * 【何が起きていたか】
   *
   *   型(や Unit・中身)を選ぶと、こうなっていた。
   *
   *     1. `dropRun()` が `opened` を false に戻す
   *     2. **同じ描き直しの中で**「開いた瞬間に1問目」が走る
   *     3. そのとき `rows` は**まだ前の冊のまま**(読み直しは非同期)
   *     4. → **古い中身から10問を組んで、すぐ始まってしまう**
   *     5. 新しい中身が届いても `opened` はもう true なので、
   *        **組み直されない**
   *
   *   画面には「14 の型 / 日本語 → 英語 / S enables 人 to do」と出るのに、
   *   出てくる問は**絞る前のまま。** 描いて、選んで、出た問を読んで確かめた。
   *
   * 【直し方 —— 届いてから組む】
   *
   *   **「いま読んである中身の鍵」を持つ。** 選び方から作る鍵と
   *   突き合わせて、**合っているときだけ**組む。
   *   `busy` を見るだけでは足りない —— あれは**次の描き直しまで
   *   立たない**ので、その1回をすり抜ける。
   *
   * **`nfKey` と同じ理由で、文字列にする**(配列のままだと、
   * 描き直すたびに別のものになって止まらない)。
   * ============================================================================
   */
  const poolKey = [learnerId ?? '', book, unit ?? '', nfUnitIds.join(','),
    part, form ?? ''].join('|')
  /** 読み終わった中身の鍵。**まだ1度も読んでいなければ空** */
  const [loaded, setLoaded] = useState('')
  /** **あとから始めた読み込みが勝つ**(順番が入れ替わっても食い違わない) */
  const poolRef = useRef('')

  const reload = async () => {
    const key = poolKey
    poolRef.current = key
    setBusy(true)
    const [list, wk, aim] = await Promise.all([
      /* **Native Flow は、ファイル × 覚え具合。** 行の形はそろえてあるので
         (`nativeFlowRows()`)、ここから下は1文字も書き分けていない。
         **状態で絞らない** —— 覚え具合の札(**4段階**・第5.406節)も
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
        /* **冊で絞る**(0066・第5.237節)。どの冊が何を読むかは
           `qrSourceOfBook()` 1か所 —— ここで冊の id を比べない */
        : loadQrReviews(learnerId, {
          status: 'todo', limit: 500, source: qrSourceOfBook(book),
        }),
      /* 0042 を貼る前は 0 が返る。**数が出ないだけで、復習はできる** */
      loadQrWeek(learnerId),
      loadWeeklyGoal(learnerId),
    ])
    /* **追い越された読み込みは、捨てる。**
       速く終わったほうの中身で上書きすると、選んだものと食い違う */
    if (poolRef.current !== key) return
    if (list.error) setError(list.error); else setError(null)
    setRows(list.data ?? [])
    if (wk.data) setWeek(wk.data)
    if (aim.data) setGoal(aim.data)
    setLoaded(key)
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
  /* ★ **段をえらんでいないときは、「覚えた」を出さない**(第5.414節)。
       もとは `stagePool()` を直に呼んでいたので、**Quick Response だけ
       「ぜんぶ」に「覚えた」が混ざっていた** —— 単語帳は混ざらない。
       **札の数(`pickCounts`)と実際に出るものが食い違う**ので、
       **判断を `learnStage.js` 1か所にそろえた。**
       「覚えた」は「詳しくしぼる」の段階からいつでも出せる */
  const filtered = useMemo(
    () => applyWordbookFilter(stageOrDefaultPool(rows, group), filter),
    [rows, group, filter],
  )
  /** いま選んでいる範囲にあてはまるもの。**数え上げと同じ道を通す** */
  const shown = useMemo(() => scopePool(filtered, scope, today), [filtered, scope, today])

  /**
   * 3つの数(2026-09 実機・利用者の指定で「今日出す / 溜まっている」から改めた)。
   *
   * **SQL は1行も要らない。** `qr_items` は箱(`box`)を返しているので、
   * 読み込んだ行から数えられる。数え方は **`stageTally()` 1か所**
   * (`learnStage.js`)—— 画面で数え直すと、単語帳とずれる。
   */
  const tally = useMemo(() => stageTally(rows), [rows])
  /** いくつ絞っているか。**畳んでいても分かるように**札の数として渡す */
  /* ★ **段階も「絞っている」に数える**(第5.414節) */
  const narrowed = narrowedCount({ filter, stage: group })

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
  /* ══════════════════════════════════════════════════════════════
     ★ **「何を出す」の4つ**(第5.414節・段階3)。単語帳と同じ。

     **札の数は、段を当てる*前*の一覧から数える**(`forPick`)——
     段を当てたあと(`filtered`)で数えると、「苦手」をえらんだ
     とたんに**ほかの3つが 0 になって押せなくなる** */
  const forPick = useMemo(
    () => applyWordbookFilter(rows, filter),
    [rows, filter],
  )
  /** いま光っている札。**決めるのは `pickIdOf()` 1か所** */
  const pick = pickIdOf(scope, group)
  const counts = pickCounts(forPick, today)

  /** 札を押したとき。**範囲と段階を、いっぺんに動かす**(`PICKS` 表1か所) */
  const pickWhat = (id) => {
    const p = pickOf(id)
    setGroup(p.stage)
    setScope(p.scope)
    if (!p.stage) saveScope('qr', p.scope)
  }

  useEffect(() => {
    if (busy || forPick.length === 0) return
    if ((counts[pick] ?? 0) > 0) return
    const next = PICKS.find((p) => (counts[p.id] ?? 0) > 0)
    if (next) pickWhat(next.id)
  }, [busy, forPick.length, counts[pick], pick])

  const start = () => {
    setLive(true)
    /* ★ **並びは `orderToUse()` 1か所**(第5.414節)。
         シャッフルはスイッチが持ち、並べ方は切のときだけ効く */
    const list = orderQrPairs(shown.map(qrPairOf), orderToUse(QR_ORDERS, { shuffle, order }))
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
   * **冊ごとの、中身の数**(第5.200節)。開いた冊が空のときに
   * 「代わりにどこを開くか」を決めるためだけに使う。
   * **単語帳の `bookSizeOf()` とまったく同じ作法**である。
   *
   * **数えられない冊は `null`**(CLAUDE.md「**0 と `null` を
   * 取り違えない**」)。
   *
   * - `my`    … **数えない。** ここが空だから移ろうとしている
   * - `nf`    … 名簿が持っている問数(**0円**・窓口を呼ばない)。
   *             Unit を選んでいれば、その Unit のぶんだけ
   * - `frame` … ファイルを数えるだけ(`frameQr.js` 1か所)
   */
  const bookSizeOf = (id) => {
    if (id === 'nf') {
      const list = unit ? nfUnits.filter((u) => u.id === unit) : nfUnits
      return list.reduce((n, u) => n + (u.n ?? 0), 0)
    }
    if (id === 'frame') return partCounts[part] ?? null
    return null
  }

  /**
   * **もう試した冊**(第5.200節)。**単語帳とまったく同じ作法**である ——
   * 空だった冊を控えておき、二度と行かない。
   */
  const triedBooksRef = useRef(new Set())

  /**
   * **自分で冊をえらんだか**(第5.200節)。
   *
   * **えらんだ冊からは、勝手に移らない。** 空と分かっていて開く人がいる
   * (分野をまだ選んでいない「業種べつ」など)。そこで移すと、
   * **押したものと違う画面が出る** —— いちばんしてはいけないことである。
   * 移ってよいのは、**まだ一度も自分でえらんでいないとき**だけ。
   *
   * 既存の見張り(`test:bar` の「本棚」)が、これを捕まえた。
   */
  const pickedBookRef = useRef(false)

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
    /* **新しい中身が届くまで待つ**(第5.191節・実機で見つけた)。
       `busy` は**次の描き直しまで立たない**ので、冊や型を替えた直後の
       1回をすり抜け、**前の冊の問で始まってしまう。**
       鍵が合っているかどうかで見る */
    if (loaded !== poolKey) return
    /* **判断が済んだことを、必ず先に立てる。** ここを「始めたときだけ」に
       すると、1問も無い帳面で**帯1本のまま止まる** */
    setOpened(true)
    setSwitching(false)
    if (shown.length === 0) {
      /* **空の冊に降ろさない。中身のある冊へ移って、そのまま始める**
         (第5.200節)。**単語帳とまったく同じ直し方**である ——
         既定の冊は自分の Quick Response 帳で、入りたてのゲストは
         ここが 0 問だから、開くたびに昔のトップ画面が出ていた。
         判断は `nextFilledBook()` 1か所。**一度だけ** */
      const tried = triedBooksRef.current
      /* **自分でえらんだ冊からは移らない**(上の `pickedBookRef`) */
      const next = pickedBookRef.current
        ? null : nextFilledBook(books, book, bookSizeOf, tried)
      if (next) {
        /* **いまの冊も、移る先も「試した」に入れる**(単語帳と同じ) */
        tried.add(book); tried.add(next)
        setBookWanted(next)
        dropRun()
        return
      }
      /* **出す問が無い冊に替えたときは、一覧の画面へ戻す**(第5.173節)。
         帯のまま止めると、読み込み中に見えて終わらない */
      /* **聞き流しへ戻れないなら、印も下ろす**(持ち越すと、
         次に冊を替えたときに勝手に聞き流しが始まる) */
      keepRadioRef.current = false
      setLive(false)
      return
    }
    /* ★ **聞き流しの中で冊を替えた人は、聞き流しのまま**(第5.283節)。
         新しい冊の問が届いたので、ここで開き直す。
         **`listen()` を呼ぶ** —— 読む文の選び方を書き写さない */
    if (keepRadioRef.current) {
      keepRadioRef.current = false
      listen()
      return
    }
    start()
  }, [busy, opened, shown.length, loaded, poolKey])

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
    /* ★ **並びは `orderToUse()` 1か所**(第5.436節)。
       ここだけ生の `order` を渡していたので、**シャッフルのスイッチが
       聞き流しに効いていなかった**(出題とは別の道を通っていた) */
    const pool = orderQrPairs(shown.map(qrPairOf), orderToUse(QR_ORDERS, { shuffle, order }))
    if (!pool.length) return
    setRadio(pool)
    /* ★ **読めなかったことを、0 曲として出さない**(第5.396節)。
       `error` を捨てると、**曲が1つも登録されていないのと同じ見た目**になる */
    const { data, error: 曲error } = await listTracks()
    setTracks(data ?? [])
    setTracksError(曲error ?? null)
  }

  /**
   * **復習の最中に「出しかた」を変えたら、その場で組み直す**
   * (2026-09 利用者の指定「中に入ってからも絞り込みができるように」)。
   * 変わったかどうかは **`runKeyOf()` 1か所**(単語帳と同じもの)。
   */
  /* **冊の中の区切り(Unit・中身・型)も、ここに入れる**(第5.191節)。
     入れていなかったので、練習の最中に型を選んでも組み直されなかった ——
     **絞ったのに、出る問が前のまま**だった */
  /* **並べ方も鍵に入れる**(第5.244節)。入っていなかったので、
     練習の最中に「ランダム / 教材ごと」を変えても**組み直されなかった**
     —— 第5.191節で「絞ったのに出る問が前のまま」を直したときと、
     まったく同じ抜け方である */
  /* ★ **シャッフルも鍵に入れる**(第5.436節)。`order` を足した第5.244節と
     まったく同じ抜け方で、入り切りを変えても組み直されなかった */
  const runKey = `${runKeyOf({ scope, size, filter, group, shuffle })}|${order}|${poolKey}`
  const runKeyRef = useRef(runKey)
  useEffect(() => {
    if (!run) { runKeyRef.current = runKey; return }
    if (runKeyRef.current === runKey) return
    /* **届いてから組む。** 鍵だけ先に合わせると、
       古い中身で組んだものを「組み直した」ことにしてしまう */
    if (loaded !== poolKey) return
    runKeyRef.current = runKey
    start()
  }, [runKey, Boolean(run), loaded, poolKey])

  /** 次の区切りへ。**読み直さない** —— 並びと残りをそのまま持っている */
  const next = () => {
    const take = takeCount(size, pending.length)
    setRun(pending.slice(0, take))
    setPending(pending.slice(take))
    setAt(0)
    setDone([])
  }

  /**
   * ★ **いま回した問を、もう一度**(第5.436節・2026-10-09 利用者の指摘)。
   *
   *   > 10問を選んで「繰り返す」を選んでいるのに終了すると
   *   > 「次の10後に進む」となり、この時点でおかしいです。
   *   > そして、シャッフルが機能しているかは同じ範囲が繰り返されないと
   *   > 機能しているか分かりません
   *
   * **残り(`pending`)には手を付けない。** 回すのは `run` そのもので、
   * 並べ替えは `start()` とまったく同じ道(`orderQrPairs` + `orderToUse`)を
   * 通す —— シャッフルが入っていれば並び替わる。
   * **間隔の決まりは壊れない**(先取りしたぶんは `shouldRecord()` が
   * 記録しない。単語帳とまったく同じ)。
   */
  const again = () => {
    const list = orderQrPairs(run ?? [], orderToUse(QR_ORDERS, { shuffle, order }))
    if (!list.length) return
    setRun(list)
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
    /* **とじたらホームへ**(第5.246節)。トップ画面が無くなったので、
       呼ぶ側が戻り先を渡す。**渡されなければ一覧へ戻る** */
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

  /* ★ **前へ / 次へ**(第5.417節・2026-10-07 利用者の指定・段階4)。
       矢印キー ← → と、紙の左右の余白クリックから来る。

       **記録は1ミリも動かさない。** 送るだけである ——
       箱も期限も、`answer()` を通ったときにだけ変わる
       (**復習の仕組みは変えない**・指示書の約束)。

       **端まで行ったら回り込む。** 聞き流しの「前へ」とまったく同じ作法
       である(1問目から前へ押すと、末尾へ回る)——
       **行き止まりを作らない**(CLAUDE.md)。
       **1問しかないときは、何も起きない。** */
  /* **指の端末か**(第5.236節)。**幅で見分けない。** 判断は
     `isCoarse()` 1か所で、ここはキーの印を出すかどうかにだけ使う */
  const coarse = isCoarse()
  const 回す = (d) => setAt((i) => {
    const n = run.length
    if (n < 2) return i
    return ((i + d) % n + n) % n
  })

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
    /* ★ **聞き流しの中から替えたときは、聞き流しのまま続ける**
       (第5.288節)。**印はここ1か所で立てる** —— 呼ぶ側それぞれに
       書くと、道を1つ足した日にそこだけ落ちる(単語帳と同じ作法)。
       聞き流しが開いていないときは、これまでどおり(印は立たない) */
    if (radio) keepRadioRef.current = true
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

  /**
   * **冊の中で絞った**(Unit・中身・型)(第5.191節・2026-09 実機)。
   *
   *   > quick responseの冊の絞り込みが全く機能していません。
   *
   * **いまの回はやめない。** もとは `dropRun()` を呼んでいたが、あれは
   * 「開いた瞬間に1問目」をもう一度走らせるので、**選んだ瞬間に練習が
   * 始まり直し、本棚のシートごと畳まれた** —— つまり
   * **中身と型の2つを続けて選べなかった。**
   *
   * いまは持ちものを変えるだけ。新しい中身が届いたら
   * `runKey`(`poolKey` を含む)が**その場で組み直す。**
   * 冊そのものを替えたときだけ `dropRun()` で始めからやり直す ——
   * **冊が変われば、やりに来たものが変わる**からである(第5.173節)。
   *
   * 聞き流しは止める(前の冊の文を読み続けない)。
   */
  const afterNarrow = () => {
    /* ★ **聞き流しは、もう止めない**(第5.288節・2026-09-27 利用者の指摘
       「聞き流し内のモードのソート内で冊の中のUNITなどが選べません」)。

       止めていたのは、鳴らす一覧が**絞る前の控え**だったからである。
       いまは下の「組み直す」仕掛けが、**新しい中身が届いた時点で**
       一覧を入れ替える —— 聞いたまま UNIT や型を選び直せる。 */
    gradedRef.current = new Set()
  }

  /**
   * ★ **聞き流しの一覧を、絞り込みに合わせて組み直す**(第5.288節)。
   *
   * 鳴らす一覧は**控え**である(`orderQrPairs` は呼ぶたびに混ぜ直すので、
   * 描くたびに作ると順が毎回変わってしまう)。だから
   * **変わったときだけ**組み直す —— 鍵は練習と同じ `runKey`
   * (`poolKey` を含む)で、**数え方を2通り持たない。**
   *
   * **届いてから組む**(`loaded !== poolKey` のあいだは待つ)——
   * 先に組むと、**絞る前の文をもう一周**鳴らすことになる。
   */
  const radioKeyRef = useRef(runKey)
  useEffect(() => {
    if (!radio) { radioKeyRef.current = runKey; return }
    if (radioKeyRef.current === runKey) return
    if (loaded !== poolKey) return
    radioKeyRef.current = runKey
    setRadio(orderQrPairs(shown.map(qrPairOf), orderToUse(QR_ORDERS, { shuffle, order })))
  }, [runKey, radio, loaded, poolKey, shown, order, shuffle])

  const who = learnerName ? `${learnerName} さんの` : ''

  /* **この冊を誰に出すかは、ここでは決めない**(第5.185節・
     2026-09 利用者の指定「トレーナーの単語帳と quick response 帳から
     消してください」)。

     決める場所は**2つだけ**にした ——
     ①ゲストのページ(単語帳のタブ / Quick Response のタブ)
     ②左メニューの「アサインする」

     **同じことをするものを3つ持たない**(CLAUDE.md)。
     ここは「自分が練習する画面」であって、配る画面ではない。 */

  /** いま開いている冊の名前。**`books` 1か所から引く**(書き写さない) */
  const bookLabel = books.find((b) => b.id === book)?.label ?? ''
  /**
   * **いま出しているものの名前**(第5.187節・2026-09 実機・利用者の指定)。
   *
   *   > 選んだ後に選んだものがどこかに明確に表示されてほしいと思います。
   *
   * 冊の名前だけだと、**Unit も中身も型も、吹き出しを開き直さないと
   * 分からない。** つなぐ決まりは `nowName()` 1か所で、
   * **呼び名もそれぞれ1か所から引く**(`unitName()` / `framePartOf()` /
   * `frameFormLabel()`)—— ここで書き写さない。
   *
   * **選んでいないものは並ばない**(「ぜんぶ」のときは冊の名前だけ)。
   */
  /* ★ **いちばん前に「いま出している範囲」を足す**(第5.417節・
       2026-10-07 利用者の指定・段階4の案A-3「ぜんぶ1行にまとめる」)。

         今日の復習 / コロケーション基本動詞
         苦手 / Native Flow Vol.1 / UNIT 3

       **足すのは言葉1つ。行も箱も増やしていない** ——
       段階3で「項目が多すぎる」を削ったばかりなので、
       ここに札や帯を積むと元に戻る。
       **「ぜんぶ」のときは足さない**(`pickName()` が空を返す)。
       **言葉は `PICKS` 1か所**(書き写さない)。 */
  const drillLabel = nowName([pickName(pick), ...(nfBook
    ? [bookLabel, unit ? unitName(unitOf(unit)) : '']
    : frameBook
    ? [bookLabel, framePartOf(part)?.label ?? '', frameFormLabel(part, form)]
    : [bookLabel])])

  /**
   * **冊の中の区切り**(Unit・中身・型)。**その冊の行の中**に出す(第5.167節)。
   * 「どの帳面の、どこ」が**1か所で決まる。**
   */
  const bookSub = nfBook ? (
    <>
    {/* **どの Unit を練習するか**(2026-09 利用者の指定「UNIT毎に分けて」)。
       並ぶのは**その人に出してよい Unit だけ**で、判断は
       `nfUnitsFor()` が済ませてある */}
    <NativeFlowUnits
      units={nfUnits}
      picked={unit}
      onPick={(id) => {
        setUnitWanted(id)
        try {
          if (id) localStorage.setItem(NF_UNIT_KEY, String(id))
          else localStorage.removeItem(NF_UNIT_KEY)
        } catch { /* 使えなくても困らない */ }
        afterNarrow()
      }}
    />
    </>
  ) : frameBook ? (
    <>
    {/* **型の冊の、どの中身を練習するか**(2026-09 利用者の指定)。
       見た目も置き場所も、**Unit の欄とまったく同じ**(`FrameParts`) */}
    <FrameParts
      parts={FRAME_PARTS}
      counts={partCounts}
      picked={part}
      onPick={(id) => {
        setPartWanted(id)
        try { localStorage.setItem(FRAME_PART_KEY, id) }
        catch { /* 使えなくても困らない */ }
        afterNarrow()
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
        afterNarrow()
      }}
    />
    </>
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

  const bookPick = (
    <BookPick books={books} book={book} unit="問" sub={bookSub}
              title="どの Quick Response 帳をやりますか"
              onPick={(id) => {
                /* **ここから先は、勝手に移らない**(第5.200節) */
                pickedBookRef.current = true
                setBookWanted(id); dropRun()
              }} />
  )

  /**
   * **帯から、そのまま聞き流しへ**(第5.262節・2026-09-26 利用者の指定)。
   *
   *   > quick response の冊のタブの右側に「聞き流し」ボタンをつけてください。
   *   > 一番右端にソートボタンを配置します。
   *
   * それまでは「出しかた」(じょうご)を開いて、中の
   * 「言う練習・聞き流し」を押す **2手** だった。
   * 練習の途中で「今日は聴くだけにしよう」と思ったときに、
   * **毎回そこを開くことになる。**
   *
   * **押すのは `listen()` 1か所** —— 「出しかた」の中のボタンと
   * まったく同じものを呼ぶ(**同じことをする道を2つ作らない**・CLAUDE.md)。
   *
   * ── **絵だけにするのをやめた**(2026-09-26 実機・利用者の指定)──
   *
   *   > 「🎵マーク」はダサすぎるので、「🔊聞き流し」にしてください
   *
   *   はじめは音符の絵だけにしていた。帯に ☰ / 冊名 ▾ / これ / じょうご の
   *   4つが並ぶので、**文字を入れると 390px で冊名が押し出される**と
   *   考えたためである。**そこは測っていなかった。**
   *   実際には `.focus-top` が `flex-wrap: wrap` なので、
   *   狭いときは**2段目に落ちるだけ**で、冊名は消えない
   *   (`npm run test:bar` が 390px で測っている)。
   *
   *   絵も**音符から `SpeakerIcon`(🔊)へ**変えた ——
   *   音符は「曲を選ぶ」の絵で、**BGM の欄が同じ音符を使っている。**
   *   **違うものに、同じ絵を付けない**(共通ルール)。
   *
   * **`aria-label` は残す。** 見えている文字より詳しく、
   * **いま何問あるか**まで言う(見えている「聞き流し」も含んでいる)。
   */
  const listenBtn = (
    <button type="button" className="btn btn--ghost btn--small qr-top-listen"
            disabled={shown.length === 0}
            aria-label={`言う練習・聞き流し(${shown.length} 問)`}
            title={`言う練習・聞き流し(${shown.length} 問)`}
            onClick={listen}>
      <SpeakerIcon />聞き流し
    </button>
  )

  /**
   * **ほかの道具**(言う練習・聞き流し・紙に出す)。
   *
   * トップ画面が無くなったので(第5.167節)、復習の最中に開ける
   * 「出しかた」の中へ入れる。**中身は書き写さない** ——
   * 始める前の `.wb-tools` とまったく同じものを、ここ1か所から渡す。
   */
  /* ★ **紙に出すのは、右上の「出しかた」の中**(2026-10-09 利用者の指定)。

       > Quick Responseや単語帳のPDF/印刷の機能を左のハンバーガーに
       > 入れるのをやめてください。右上のメニューに入れてください。

       第5.414節で左の ☰ へ出していたが、**左の☰は「どこへ行くか」**で
       あって「いまの画面で何をするか」ではない。
       **中身はここ1か所**(一覧の下にも、右上の中にも、これを置く) */
  const paperBox = (
    <>
      {/* 何問ぶん刷るのかを、**押す前に**出す(紙は戻せない) */}
      {/* ★ **名前は `wb-paper`**(第5.436節・2026-10-09)。
             もとは聞き流しと同じ `wb-listen` を着せていたので、
             **「出しかたの中に聞き流しが残っていないか」を見ていた見張りが、
             紙のボタンを聞き流しと取り違えて赤くなった。**
             **違うものに、同じ名前を付けない**(`.claude/rules/common.md`) */}
      <button type="button" className="btn btn--quiet wb-paper"
              disabled={sheetPairs.length === 0 || printing}
              onClick={() => setPrinting(true)}>
        <PrintIcon />{printing ? '紙に出しています…' : `印刷 / PDFで保存(${sheetPairs.length} 問)`}
      </button>
    </>
  )

  const toolsBox = (
    <div className="wb-tools">
      <button type="button" className="btn btn--quiet wb-listen"
              disabled={shown.length === 0}
              onClick={listen}>
        {/* **言葉と中身を食い違わせない**(2026-09)。
            ここは**聞き流しだけの場所ではない** —— 中に2つあり、
            もう1つが「日本語→英語」である(第5.251・5.253節)。
            **「チャンクで積む」は無くなった**(第5.251節) */}
        <MusicIcon />言う練習・聞き流し({shown.length} 問)
      </button>
      {paperBox}
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
  /**
   * **画面ぜんぶを覆うもの**(聞き流し・紙に出す)。
   *
   * ============================================================================
   *   > また、聞き流しも機能していません。(2026-09 実機・利用者の指摘)
   *
   * **押すボタンは2か所にあるのに、描く側は1か所にしか無かった。**
   * 「言う練習・聞き流し」と「印刷 / PDFで保存」は `toolsBox` 1つで、
   * **始める前のカード**にも、**練習の最中の「出しかた」**にも出る。
   * ところが受け取る側(`WordRadio` / `ReviewSheet`)は、
   * **`live` で早く返る手前**、つまり「始める前」の枝にしか描いていなかった。
   *
   * 第5.167節でトップ画面を無くしてから、利用者はほぼ**ずっと `live`** に
   * いる。だから**押しても何も起きない**——「聞き流しが機能しない」の正体。
   *
   * **`FocusFrame` は portal で body の直下に出る**ので、
   * どちらの枝に置いても見え方は同じである。だから**1つ作って、
   * 両方の枝に置く**(書き写さない)。
   *
   * **押す場所と、受け取る場所は、同じ数だけ要る**(CLAUDE.md
   * 「効かない操作を見せない」)。
   * ============================================================================
   */
  const overlays = (
    <>
      {/* **部品は `WordRadio` 1つ。** 単語帳とまったく同じものを使い、
          渡すのは「どの画面から来たか」だけ(`where`)。
          読み方の一覧も、覚える鍵も `wordRadio.js` が持っている ——
          **書き写すと、必ず片方だけ古くなる**(CLAUDE.md) */}
      {radio && (
        <WordRadio
          rows={radio}
          where="qr"
          /* **練習の画面に出している題を、そのまま渡す**(第5.264節)。
             ここで組み直さない —— 練習と聞き流しで題が食い違うと、
             「いま何を聞いているのか」が分からなくなる */
          label={drillLabel}
          /* **聞き流しの中でも、教材(冊)をえらべる**(第5.283節)。
             **一覧は `books` 1つ**(帯の `冊名 ▾` と同じもの・書き写さない) */
          books={books}
          book={book}
          /* ★ **冊の中の区切りも、そのまま渡す**(第5.288節)。
             帯の `冊名 ▾` の中で使っているものと**同じ1つ**である ——
             UNIT・中身・型を、聞きながら選び直せる */
          sub={bookSub}
          onBook={(id) => {
            /* **聞き流しのまま、次の冊へ** —— 印は `dropRun()` が立てる
               (第5.288節・1か所に寄せた)。
               ここから先は勝手に移らない(第5.200節・`pickedBookRef`) */
            pickedBookRef.current = true
            setBookWanted(id); dropRun()
          }}
          /* **「出しかた」で選んでいる数を、そのまま持ち込む**
             (第5.262節・2026-09-26 利用者の指定)。
             5問に絞って練習していた人には、そのまま5問が回る。
             **聞き流しの中で変えられる**ので、ここは始めの値だけである */
          size={size}
          tracks={tracks}
          tracksError={tracksError}
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
          /* **いま絞っているものを、紙の題にも出す**(第5.199節・
             2026-09 利用者の指定「絞り込んだ上での印刷、PDF出力ともに
             ちゃんと出来るようにしてください」)。

             **行はもともと絞れていた** —— 足りなかったのは題のほうで、
             「14 の型 / 言い換え / S enables 人 to do」で刷っても
             紙には「Quick Response 帳」としか出ず、
             **何を絞って刷ったのかが残らなかった。**

             名前は `drillLabel` —— **画面の題とまったく同じもの**である
             (同じ名前を2か所で組み立てない・CLAUDE.md) */
          title={`${who}Quick Response 帳${drillLabel ? ` — ${drillLabel}` : ''}`}
          note={sheetNote({
            count: sheetPairs.length,
            unit: '問',
            group: LEARN_STAGES.find((g) => g.id === group)?.label ?? '',
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
    </>
  )

  if (live) {
    const n = run?.length ?? 0
    const finished = n > 0 && at >= n
    const body = (
      /* **`qr--paper` は付けない**(2026-09 実機・利用者の指定)。
         あれは**紙の上の色**に差し替えるもので、地が白くなった
         この画面では要らない —— 何も足さなければアプリの配色に従い、
         単語帳の復習とそろう(`.focus-paper` の吹き出しと同じ考え方)。

         **終わりの1枚は、中身なりに伸ばす**(第5.193節・2026-09 実機・
         利用者の指摘「終わった後のリストの背景の色が途中から切り替わって
         います」)。問を出しているあいだは**画面いっぱいに広げる**が、
         終わりの一覧は**長さが分からない** —— 広げたままだと、
         白い箱の高さが画面ぶんで止まり、**そこから下は地の色**になる。
         暗い配色では**同じ色の字**が乗るので読めなくなる。
         単語帳はすでに `.wordcard--result` で同じ手当てをしてある */
      <section className={`qr${finished ? ' qr--done' : ''}`}>
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
          * 単語帳とまったく同じ場所・同じ形である(`DrillHead` 1つ)。
          *
          * **進み具合と並びで1つ**にした(第5.180節・2026-09 利用者の指定)。
          * 名前だけを部品にして、バーを画面ごとに書いていたので、
          * **単語帳と形が割れた** —— 並びで1つなら、入れ物ごと1つにする。
          */}
        {/**
          * **「1 / 30」はやめて、進み具合のバーにした**(第5.176節)。
          *
          *   > 1/30などは進捗バーにしましょう
          *
          * **1問 = 1つの区切り**に変えた(第5.180節・利用者の指定
          * 「単語帳のように個数のバーを」)。ひと続きの帯は
          * 「だいたい半分」までしか言えず、**残り何問かが数えられない。**
          */}
        <DrillHead label={drillLabel} total={n} done={at} />
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
                  読み直さずにそのまま次の区切りへ進める(並びも保たれる)。

                  **残りが無くても、「繰り返す」が入っていれば回す**
                  (第5.244節・2026-09-23 利用者の指摘)——
                  単語帳にはこれがあったのに、こちらには無かった。
                  **間隔の決まりは壊れない。** 先取りしたぶんは
                  `shouldRecord()` が記録しないので、何周しても
                  明日の復習は空にならない(単語帳とまったく同じ) */}
              <div className="btn-row">
                {/* ★ **「繰り返す」は、いま回した問をもう一度**(第5.436節)。
                     残りがあっても**こちらが先**である。
                     もとは残りが 0 のときだけ出していたので、
                     10 問を選んで入れていても「つぎの 10 問」しか出なかった */}
                {repeat && (
                  <button type="button" className="btn btn--primary" onClick={again}>
                    <RepeatIcon />
                    この {run?.length ?? 0} 問をもう一度
                  </button>
                )}
                {pending.length > 0 && (
                  <button type="button"
                          className={`btn ${repeat ? 'btn--quiet' : 'btn--primary'}`}
                          onClick={next}>
                    つぎの {takeCount(size, pending.length)} 問
                  </button>
                )}
                <button type="button"
                        className={`btn ${pending.length > 0 || repeat ? 'btn--quiet' : 'btn--primary'}`}
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
          /* ★ **送る / 判定する操作**(第5.417節・段階4)。
               単語帳とまったく同じ部品・同じ決まりである(書き写さない) */
          <CardMove
            /* ★ **聞き流しが開いているあいだは、1つも効かせない** ——
                 矢印キーを聞いているのは窓(`window`)なので、
                 上に重ねた画面で ← → を押しても**裏のカードが飛ぶ。**
                 **既定は「できない」側**にする(CLAUDE.md) */
            on={!radio}
            onPrev={() => 回す(-1)} onNext={() => 回す(1)}
            onOk={() => answer(true)} onYet={() => answer(false)}>
          <QrCard
            pair={run[at]} no={at + 1}
            onAnswer={answer}
            /* ★ **キーの印は、ボタンの中に出す**(第5.417節)。
               **印を足すのは `keyLabel()` 1か所**で、
               **キーの無い端末には出さない**(効かない操作を見せない) */
            yetLabel={keyLabel('まだ', 'yet', { keys: !coarse })}
            okLabel={keyLabel('言える', 'ok', { keys: !coarse })}
            /* ★ **◀▶ は指の端末だけ**(2026-10-08 利用者の指定・段階4)。
               スワイプをやめた代わりである。**パソコンは1ミリも変えていない**
               (紙の左右の余白と、矢印キー)。
               **キーの印と、まったく同じ見分け方**(`coarse`)を使う ——
               数え方を2通り持たない(CLAUDE.md) */
            arrows={coarse}
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
            /* ★ **「もう出さない」はカードの右上へ**(第5.417節・
                 2026-10-07 利用者の指定・段階4の案B-2)。
                 もとは `extra`(答えの行)だったので、**判定のすぐ下に
                 横幅いっぱいで並び、押し間違えやすかった。**
                 **消す道そのものは1つも減らしていない** —— 置き場所だけ移した */
            /* ★ **「聴く」「リピート」と同じ行の、右端に置く**
                 (第5.417節・2026-10-08 利用者の指定)。

                 カードの右上(案B-2)に浮かせていたが、**話し手の名前
                 (「Naomi (Backend Engineer)」)に重なった** ——
                 問によって名前の長さが違うので、**重なるかどうかが
                 問ごとに変わる**(浮かせたものは、下に何が来ても避けない)。

                 この行なら**流れの中**なので、重なりようがない。
                 判定のボタンからも1段離れたまま(案B-2 のねらいは保つ)。 */
            extra={(
              <button type="button" className="btn btn--ghost btn--small qr-retire"
                      onClick={retire}>
                もう出さない
              </button>
            )}
          />
          </CardMove>
        )}
        </>)}
      </section>
    )

    /* **下の帯は渡さない。** Quick Response は「まだ / 言える」で進むので、
       ◀ 前 / 次 ▶ を置くと進め方が2つになる(教材の中の Quick Response と同じ) */
    return (
      <FocusFrame
        /* ★ **終わったら、入れ物も中身なりに伸ばす**(第5.387節)。
             伸ばさないと、終わりの一覧が**地の色を塗っている箱からはみ出し**、
             途中から背景が切り替わる(実測 2906px の一覧が 809px の紙の中にいた) */
        className={`qrfocus${finished ? ' is-done' : ''}`}
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
        /* **左上は ☰**(第5.172節)。渡されなければ ✕ 閉じるのまま。
           ★ **左の ☰ には、道具を1つも渡さない**(2026-10-09 利用者の指定
              「左のハンバーガーメニューに余計なものを追加しないで
              ください」)。渡す口そのものを無くしてある */
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
        /* **冊名 ▾ のとなりに、聞き流しを置く**(第5.262節)。
           いちばん右端(`topEnd`)は、これまでどおり「出しかた」である */
        top={<>{bookPick}{listenBtn}</>}
        /* **中に入ってからも絞り込める**(2026-09 利用者の指定)。
           始める前とまったく同じ「出しかた」を、帯の右端から開く。
           **中身は書き写さない** —— `ReviewScope` の畳んだ形である */
        topEnd={(
          <ReviewScope
            compact
            /* ★ **段を当てる前の一覧を渡す**(第5.414節)。札の数は
               「押したら何件出るか」なので、いま選んでいる段で
               絞ったものを渡してはいけない */
            rows={forPick}
            unit="問"
            pick={pick}
            onPick={pickWhat}
            size={size}
            narrowed={narrowed}
            onSize={(sz) => { setSize(sz); saveSize('qr', sz) }}
            /* ★ **段階は「詳しくしぼる」の中**(第5.414節)。
               押す先は札とまったく同じ `pickGroup` である */
            stage={group}
            onStage={pickGroup}
            onClearAll={() => { setFilter(emptyFilter()); pickGroup(null) }}
            /* **単語帳とまったく同じ札を出す**(第5.244節) */
            orders={QR_ORDERS}
            order={order}
            onOrder={(id) => { setOrder(id); saveOrder(id) }}
            shuffle={shuffle}
            onShuffle={(on) => { setShuffle(on); saveShuffle('qr', on) }}
            repeat={repeat}
            onRepeat={(on) => { setRepeat(on); saveRepeat('qr', on) }}
            onStart={start}
            /* ★ **紙に出すのは、ここ(右上)の中**(2026-10-09) */
            tools={paperBox}
          >
            <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
          </ReviewScope>
        )}
      >
        {body}
        {/* **聞き流しと紙は、ここからも開ける**(第5.191節)。
            「出しかた」の中に同じボタンがあるのに、描く側が
            「始める前」の枝にしか無く、**押しても何も起きなかった** */}
        {overlays}
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
            items={LEARN_STAGES.map((g) => ({ ...g, n: tally[g.id] ?? 0 }))}
            value={group}
            onPick={pickGroup}
            /* **いちばん手前の段を目立たせる**(もとの「まだ」と同じ役) */
            dueId="weak"
            lead={stageLead(group)}
          />

          {/* **いつのぶんを、何問ずつ、何で絞るか**(2026-09 利用者の指定)。
              単語帳とまったく同じ部品。**書き写さない。**
              絞り込みと並べ方も、**この中(「出しかた」)に入れる** ——
              設定が画面の3か所に散っていたのを1か所にまとめた */}
          <ReviewScope
            rows={forPick}
            unit="問"
            pick={pick}
            onPick={pickWhat}
            size={size}
            narrowed={narrowed}
            onSize={(s) => { setSize(s); saveSize('qr', s) }}
            stage={group}
            onStage={pickGroup}
            onClearAll={() => { setFilter(emptyFilter()); pickGroup(null) }}
            /* **並べ方は札にする**(第5.244節・2026-09-23 利用者の指摘)。
               「しぼる」の中の小さなプルダウンだったので、
               **単語帳と同じ札を探した人には見つからなかった** */
            orders={QR_ORDERS}
            order={order}
            onOrder={(id) => { setOrder(id); saveOrder(id) }}
            shuffle={shuffle}
            onShuffle={(on) => { setShuffle(on); saveShuffle('qr', on) }}
            repeat={repeat}
            onRepeat={(on) => { setRepeat(on); saveRepeat('qr', on) }}
            onStart={start}
          >
            {/* **絞り込みは単語帳と同じ部品**(`WordbookFilter`)。
                ちがうのは、**教材名のプルダウンを出す**という1点だけ
                (2026-09 利用者の指定「『テキスト』= 教材の名前で絞る」) */}
            <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
          </ReviewScope>

          {/* **聞き流し**と**紙に出す**。中身は `toolsBox` 1か所 ——
              復習の「出しかた」にも、同じものが出る(書き写さない) */}
          {toolsBox}

          {shown.length === 0 && filtered.length === 0 && (
            <p className="hint">この絞り込みに当てはまる文がありません。</p>
          )}
        </>
      )}

      {overlays}

    </section>
  )
}
