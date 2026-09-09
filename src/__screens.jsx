/**
 * 検証のためだけの入り口(`npm run test:bar` が使う)。
 *
 * **利用者の画面には出ない。** `index.html` はこれを読み込まない。
 *
 * 【なぜ要るか】(2026-09 利用者の指定)
 *
 *   > 新しく何かを実装すると何か古いものが知らない間になくなることを
 *   > 防ぐようにできませんか?
 *
 *   帯に並ぶものは増え続ける(閉じる・ページ送り・解答・表示・書き込む・
 *   メモ・読み上げの操作盤・速さ・文字・幅・印刷…)。1つ足すたびに
 *   場所の取り合いになり、**折り返しや条件のかけ違いで、
 *   古いものが黙って消える。**
 *
 *   `npm run lint` にも `npm run build` にも引っかからない。
 *   **その画面を、その条件で開くまで分からない。**
 *   だから**実際に描かせて、並んでいるものを数える。**
 *
 * 【どの条件で描くかは、URL で渡す】
 *   `?role=trainer&who=g1` … トレーナーが、ゲストと一緒に開いている
 *   `?role=trainer`        … トレーナーが「教材」画面から開いている
 *   `?role=learner&who=g1` … ゲスト自身が開いている
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import LessonView from './components/LessonView.jsx'
import SessionResult from './components/SessionResult.jsx'
import CollectRows from './components/CollectRows.jsx'
import GoalBar from './components/GoalBar.jsx'
import MaterialForm from './components/MaterialForm.jsx'
import Wordbook from './components/Wordbook.jsx'
import IconButton from './components/IconButton.jsx'
import AppTabs from './components/AppTabs.jsx'
import QrCard from './components/QrCard.jsx'
import ReviewScope from './components/ReviewScope.jsx'
import ReviewStats from './components/ReviewStats.jsx'
import LearnerBar from './components/LearnerBar.jsx'
import { rememberLearner } from './lib/lastLearner.js'
import WordRadio from './components/WordRadio.jsx'
import WordbookFilter, { countNarrowed, emptyFilter } from './components/WordbookFilter.jsx'
import { QR_GROUPS, groupLead, qrTally } from './lib/reviewScope.js'
import FocusFrame from './components/FocusFrame.jsx'
import GrammarNote from './components/GrammarNote.jsx'
import BasicsCourse from './components/BasicsCourse.jsx'
import BasicWordsPick from './components/BasicWordsPick.jsx'
import JobBar from './components/JobBar.jsx'
import { AppTopbar } from './components/AppNav.jsx'
import CastChip from './components/CastChip.jsx'
import {
  BoltIcon, BookIcon, CardsIcon, DownloadIcon, EraserIcon, MicIcon,
  PrintIcon, RefreshIcon, ScreenIcon, TaskIcon,
} from './components/Icons.jsx'
import MaterialShare from './components/MaterialShare.jsx'
import SearchBar from './components/SearchBar.jsx'
import HomeworkFilter from './components/HomeworkFilter.jsx'
import { emptyHomeworkFilter } from './lib/homeworkFilter.js'
import { setViewerRole } from './lib/viewer.js'
import './styles.css'

const q = new window.URLSearchParams(window.location.search)
setViewerRole(q.get('role') || null)

/* **ゲスト名の箱**(2026-09 利用者の指定)。開いているゲストは
   `lastLearner.js` が控えている。**長い名前をわざと使う** ——
   短い名前だと、名前を切る指定をやめても**同じ幅になって緑のまま**になる */
if (q.get('who')) {
  rememberLearner(q.get('who'),
    { name: q.get('name') || '長谷川 あいり(テスト用の長い名前)', status: 'active' })
}

/* **Speech練習を確かめるとき**は、本文を1人の記事(`article`)にする。
   声は `?voice=us-4` のように渡す(名簿の id) */
const asSpeech = q.get('kind') === 'speech'
/* **文型ドリルの帯も確かめる**(2026-09 利用者の指定
   「文型トレーニングに上のバーのプレーヤーが出ません」)。
   本文が無い教材で、読み上げの操作盤が出るかどうかは
   **描かせないと分からない**(`npm run test:bar`) */
const asDrill = q.get('kind') === 'drill'
/* **長い段落**(`?kind=long`)。貼った原稿はこうなる —— 1段落が
   桁違いに長く、集中モードに入ってもそこで送ることになっていた
   (2026-09 利用者の指摘)。**この形でしか確かめられない** */
const asLong = q.get('kind') === 'long'

/** 検証に使う教材。**本文(会話)が1つあれば、帯はすべて出そろう** */
const material = asSpeech ? {
  id: 'test-speech', level: 'C1', title: '講演(考えを伝える)', kind: 'speech',
  headline: 'My research', tagIds: [],
  voiceIds: (q.get('voice') || 'us-4').split(','),
  sections: [{
    /* **貼った原稿と同じ形にしてある**(2026-09 実機)。
       1段落に文がいくつも入る —— 1文ずつの ◀ ▶ とくり返しは、
       **この形でしか確かめられない**(1文だけの段落では行き先が無い)。
       訳(`prompt_ja`)を付けていないのも、貼った原稿と同じである */
    id: 'sec-1', exercise_type: 'article', title: '記事',
    items: [
      {
        id: 'it-1',
        prompt_en: 'Good afternoon, everyone. First, I would like to thank you all '
          + 'for being here today. Before I talk about my research, I would like to '
          + 'introduce my background.',
      },
      {
        id: 'it-2',
        prompt_en: 'I am originally from Chiba in Japan. I graduated from Kanagawa '
          + 'Medical University in 2014. After that, I worked at a small clinic for '
          + 'three years.',
      },
    ],
  }, {
    /* **想定される質問**(0045・2026-09 利用者の指定)。
       話し終えたあとに聴衆から投げられる質問。**解答は持たない** */
    id: 'sec-2', exercise_type: 'audience_qa', title: '想定される質問',
    items: [
      {
        id: 'qa-1',
        question: 'How much would this cost us in the first year?',
        question_ja: '初年度、こちらの費用はどれくらいになりますか。',
        note: '数字が無ければ「まだ出せない」と言い切り、いつ出せるかを添える。'
          + 'I don\'t have the exact figure yet, but … / I can send you that by Friday.',
      },
      {
        id: 'qa-2',
        question: 'What happens if the schedule slips?',
        question_ja: '予定が遅れた場合はどうなりますか。',
        note: '遅れる前提で答える。何を先に守るかを1つ決めて言う。'
          + 'If that happens, we would … / Our first priority is …',
      },
    ],
  }],
} : asLong ? {
  /* 1段落が **129 語**。貼った原稿はこの形で来る(実機は 1,000 文字超)。
     2段落目はふつうの長さにしてある —— **短い段落は1つも切らない**
     ことを、同じ教材の中で確かめられるようにするため */
  id: 'test-long', level: 'B1', title: '長い原稿', kind: 'speech',
  headline: 'A long draft', tagIds: [],
  voiceIds: ['us-4'],
  sections: [{
    id: 'sec-1', exercise_type: 'article', title: '記事',
    items: [
      {
        id: 'lg-1',
        prompt_en: 'Good morning, everyone, and thank you for making time today. '
          + 'I want to start with a number that surprised me last quarter. '
          + 'Our support team handled four thousand tickets in ninety days, '
          + 'and almost a third of them came from the same three screens. '
          + 'When I first saw that, I assumed the screens were simply broken. '
          + 'They were not. They worked exactly as we had designed them. '
          + 'The problem was that nobody could tell what would happen next. '
          + 'People pressed a button, nothing moved, and they wrote to us. '
          + 'So this year we are changing how we measure a screen. '
          + 'We are not asking whether it works. We are asking whether a person '
          + 'can predict what it will do before they touch it. '
          + 'That single question has already changed four of our releases, '
          + 'and I would like to show you what it looked like in practice.',
        prompt_ja: 'みなさん、おはようございます。今日はお時間をいただきありがとうございます。',
      },
      {
        id: 'lg-2',
        prompt_en: 'Let me start with the first release. It shipped in March.',
        prompt_ja: '最初のリリースから始めます。3月に出したものです。',
      },
    ],
  }],
} : asDrill ? {
  /* **本文が1つも無い教材。** 文型ドリルは「問」が並ぶだけである。
     和文英訳を混ぜてあるのは、**読み上げるのが `answer`** だからで、
     `prompt_en` を直に見ていると1本も拾えない。
     誤り訂正は **`audioFrom: null`** —— 読み上げてはいけない演習である */
  id: 'test-drill', level: 'B1', title: '現在完了', kind: 'drill',
  headline: '', tagIds: ['present_perfect'],
  sections: [{
    id: 'sec-1', exercise_type: 'translate_en_ja', title: '英文和訳',
    items: [
      { id: 'd-1', prompt_en: 'She has just finished her report.', answer: '彼女はちょうど報告書を書き終えた。' },
      { id: 'd-2', prompt_en: 'They have known each other for ten years.', answer: '二人は10年来の知り合いだ。' },
      { id: 'd-3', prompt_en: 'I have never been to Osaka.', answer: '大阪へ行ったことがない。' },
    ],
  }, {
    id: 'sec-2', exercise_type: 'translate_ja_en', title: '和文英訳',
    items: [
      { id: 'd-4', prompt_ja: 'もう昼食は済ませましたか。', answer: 'Have you had lunch yet?' },
      { id: 'd-5', prompt_ja: '荷物はまだ届いていません。', answer: 'The package has not arrived yet.' },
    ],
  }, {
    id: 'sec-3', exercise_type: 'error_correction', title: '誤り訂正',
    items: [
      {
        id: 'd-6', prompt_en: 'I have went to the office already.',
        answer: 'I have gone to the office already.',
        note: 'have のうしろは過去分詞。went は過去形である',
      },
    ],
  }],
} : {
  id: 'test-material', level: 'B1', title: 'クラスに出る', kind: 'dialogue',
  headline: 'Going to class', tagIds: [],
  sections: [{
    id: 'sec-1', exercise_type: 'dialogue', title: '会話',
    items: [
      {
        id: 'it-1', speaker: 'Mika',
        prompt_en: 'Could you tell me where the away fans usually sit?',
        prompt_ja: 'アウェーのファンが普段どこに座るか教えてもらえますか?',
      },
      {
        id: 'it-2', speaker: 'Kenji',
        prompt_en: 'They are up in the corner behind the goal.',
        prompt_ja: 'ゴール裏の角の上の方です。',
      },
    ],
  }],
}

/**
 * **やり終えたときの1枚**(`?screen=result`)。
 *
 * 単語帳と Quick Response の終わりの画面は、どちらも `SessionResult` である。
 * ここに出せば、**Supabase に届かないこの環境でも見た目を確かめられる。**
 */
const RESULT = (
  <div style={{ maxWidth: 420, margin: '24px auto', padding: 16 }}>
    <SessionResult
      items={[
        { ok: true, main: 'deliberately' }, { ok: true, main: 'concern' },
        { ok: true, main: 'issue' }, { ok: false, main: 'retraction' },
        { ok: true, main: 'oversight' }, { ok: true, main: 'integrity' },
        { ok: true, main: 'misconduct' }, { ok: false, main: 'peer review' },
        { ok: true, main: 'replicate' }, { ok: true, main: 'flag' },
      ]}
      unit="語"
      week={{ days: 3, weeks: 5 }}
      extra={(
        <>
        {/* 週の目標(0042)。**達成の前と後**を見比べられるように、
            届いていない側を出しておく */}
        <GoalBar goal={50} done={38} unit="語" />
        <CollectRows rows={[
          { industry: 'med', known: 30, learning: 10 },
          { industry: 'it', known: 12, learning: 20 },
          { industry: 'golf', known: 4, learning: 12 },
        ]} />
        </>
      )}
    >
      <button type="button" className="btn btn--primary">つぎの 10 語</button>
    </SessionResult>
  </div>
)

/* Speech練習の欄を、実際に描いて確かめるための入り口(2026-09)。
   **利用者の画面には出ない**(`index.html` はこのファイルを読み込まない) */
const FORM = (
  <div className="app-main" style={{ padding: 16 }}>
    <MaterialForm createdBy="t1" initial={{ kind: q.get('kind') || 'speech' }}
                  onCreated={() => {}} onCancel={() => {}} />
  </div>
)

/* 単語帳の集中モードを、実際に描いて確かめるための入り口(2026-09)。
   語の中身は Playwright が窓口の応答を差し替えて渡す
   (**本物の部品と本物の CSS で測る**。写した HTML では測らない) */
/* **その教材の語だけに絞ったとき**(0047・`?only=a,b,c`)。
   絞れているか・札が出ているか・外す道があるかを、実際に描いて数える */
const only = (q.get('only') || '').split(',').map((w) => w.trim()).filter(Boolean)
const WORDBOOK = (
  <div className="app-main">
    <Wordbook learnerId="g1" learnerName="Airi"
              only={only.length ? only : null}
              onlyLabel={only.length ? '業界の語' : ''}
              onClearOnly={only.length ? () => {} : null} />
  </div>
)

/* 教材のカードの操作(`?screen=tools`・2026-09 利用者の指定)。

   > 「音声を作り直す」「学習の記録を消す」を教材を消すの左側に並べて、
   > 「印刷 / PDF」と「音声ダウンロード」アイコンを今の位置に並べて
   > ください。…「🖨️」だけでは PDF が出せることがわからないので、
   > 「印刷 / PDF」として、音声ダウンロードもそのまま「音声ダウンロード」
   > としましょう。

   **本物の部品と本物の CSS で測る**(写した HTML では測らない)。
   `TrainerMaterials` そのものは Supabase を引き連れていて、この環境からは
   1件も読めない。だから**行だけ**を同じ組み立てで描く。
   ずれないよう、`npm run test:bar` が
   **`TrainerMaterials` が本当に同じ形で書いているか**も見る。

   `?state=busy` … 言葉が要る状態(集めています… / 本当に消す)を出す */
const busy = q.get('state') === 'busy'
/* **押したら本当に効くか**を数える。`IconButton` は長押しのあとの
   `click` を1回捨てるので、ここを間違えると**どのボタンも押せなくなる。**
   絵にした日にいちばん怖い壊れ方なので、数で確かめられるようにしておく */
const hit = () => {
  const el = document.querySelector('.card-tools')
  el.dataset.hits = String(Number(el.dataset.hits ?? 0) + 1)
}
/* 写真とまったく同じ中身にしてある(2026-09 実機・利用者の指摘)。
   会話14発言 + 内容の理解5 + ディスカッション5 —— **390px では
   問数の行が2行に折り返す**ので、札の置き場所はここでしか測れない */
const CARD_MATERIAL = {
  id: '11111111-2222-3333-4444-555555555555',
  title: '2026-09-07 / 会議に出る / 業界の語',
  voiceIds: ['us-4', 'us-1'],
  sections: [{
    id: 's1', exercise_type: 'dialogue',
    items: [{ id: 'a', speaker: 'Mika' }, { id: 'b', speaker: 'Josh' }],
  }],
}

const TOOLS = (
  <div className="app-main" style={{ padding: 16 }}>
    <section className="card">
      {/* 問数の行。**写真と同じ中身**(390px では3つで 328px 使う) */}
      <div className="muted material-parts">
        <span>会話 14 発言</span>
        <span>内容の理解 5 問</span>
        <span>ディスカッション 5 問</span>
      </div>
      {/* ふだん使う2つ。**言葉つき**(絵だけでは「PDF も出せる」が読めない) */}
      <div className="btn-row card-tools" data-hits="0">
        <button type="button" className="btn btn--small" onClick={hit}>
          <PrintIcon />印刷 / PDF
        </button>
        <button type="button" className="btn btn--small" onClick={hit}>
          <DownloadIcon />
          {busy ? '集めています… 3 / 14' : '音声ダウンロード'}
        </button>
      </div>
      {/* 人に渡す2つ */}
      <div className="btn-row">
        <button type="button" className="btn btn--small btn--quiet">
          この教材をゲストと共有する
        </button>
        {/* **本物の部品で測る。**「メールで送る」「リンクをコピー」の
            2つが並んで出るか、狭い画面ではみ出さないかを見る */}
        <MaterialShare material={{ id: '11111111-2222-3333-4444-555555555555',
                                   title: '2026-09-07 / 会議に出る / 業界の語' }} />
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--primary">
          <ScreenIcon />セッションで使う(大きく表示)
        </button>
      </div>
      {/* めったに押さない3つ。**絵のまま**(言葉にすると1行に入らない) */}
      <div className="material-foot">
        {/* **いちばん下の行の左端に、小さく静かに**(2026-09 実機・利用者の指定)。
            問数の行にはスマホで入る幅が無かった(実測 390px で残り 18px) */}
        <CastChip material={CARD_MATERIAL} className="cast-chip--foot" />
        <IconButton icon={<RefreshIcon />} label="読み上げ音声を作り直す"
                    text={busy ? '作っています… 3 / 14' : null}
                    onClick={hit} />
        <IconButton icon={<EraserIcon />} label="練習の記録を消す"
                    text={busy ? '本当に消す' : null} pressed={busy}
                    onClick={hit} />
        <div className="btn-row material-danger">
          <button type="button" className="btn btn--small btn--ghost">教材を消す</button>
        </div>
      </div>
    </section>
  </div>
)

/* さがす帯(`?screen=search`・2026-09 利用者の指定)。
     > 宿題を探すも折りたたみ式にしてください。そして検索バーの下の「3件」は
     > 丸などで囲って何か配色してください。そして位置は宿題を探すの文字の
     > 反対側、検索バーの右端の上にしてください

   **同じ部品を2か所で使っている**(ゲストの「宿題をさがす」と
   トレーナーの「教材をさがす」)。畳めるのは前者だけなので、
   **両方を並べて描き、後者が1ドットも変わっていないこと**まで数える。
   「畳める」だけを見ると、**教材の画面まで畳んでも緑のまま**になる。

   `?open=1` … 開いた状態(検索の欄が出るか) */
const SEARCH = (
  <div className="app-main" style={{ padding: 16 }}>
    <div data-fold="1">
      <SearchBar
        title="宿題をさがす・しぼる"
        keyword="" onKeyword={() => {}}
        placeholder="教材名・見出しでさがす"
        count={3}
        collapsible
        open={q.get('open') === '1'}
        onOpenChange={() => {}}
      >
        {/* **さがすとしぼるは1つの箱**(2026-09 実機・利用者の指定)。
            取り組みの札が、検索の欄と**同じ箱の中**に入る */}
        <div className="chiprow">
          {[['すべて', 3], ['やった', 1], ['まだ', 2]].map(([label, n]) => (
            <button key={label} type="button"
                    className={`chip${label === 'すべて' ? ' chip--on' : ''}`}>
              {label} <span className="chip-count">{n}</span>
            </button>
          ))}
        </div>
      </SearchBar>
    </div>
    <div data-plain="1">
      <SearchBar
        keyword="" onKeyword={() => {}}
        placeholder="教材名・見出しでさがす"
        sort="new" onSort={() => {}}
        sortOptions={[{ id: 'new', label: '新しい順' }, { id: 'old', label: '古い順' }]}
        count={35}
      />
    </div>
    {/* ゲスト自身の「今週の宿題」(2026-09 利用者の指定
        「今日の宿題のところにも実装してください」)。
        **取り組みの札は入らない** —— カードの1行目の
        「やった / まだ」の札が同じことを言っている。
        **絞り込みは箱の中**(2026-09 実機・利用者の指定)。
        しぼり込み中の印も、ここで描いて確かめる */}
    <div data-hw="1">
      <SearchBar
        title="宿題をさがす・しぼる"
        keyword="" onKeyword={() => {}}
        placeholder="教材名・見出しでさがす"
        count={3}
        collapsible
        open={q.get('open') === '1'}
        onOpenChange={() => {}}
        mark="しぼり込み中"
      >
        <HwFilterDemo />
      </SearchBar>
    </div>
  </div>
)

/* 宿題の絞り込み。**選択肢は「その人に届いた宿題にあるもの」だけ**なので、
   分野・場面・苦手項目を2種類ずつ持たせないと、その行が出ない。
   **苦手項目の名前は、わざと長いものを混ぜてある** ——
   短い言葉ばかりだと、はみ出しても緑のままになる */
function HwFilterDemo() {
  const [filter, setFilter] = useState(emptyHomeworkFilter)
  const [sort, setSort] = useState('new')
  const rows = [
    { id: 'a', assigned_at: '2026-09-01T09:00:00.000Z', learner_done_at: null,
      material: { title: '朝の打ち合わせ', industry: 'it', scene: 'daily_standup',
        tagIds: ['fillers'] } },
    { id: 'b', assigned_at: '2026-09-03T09:00:00.000Z',
      learner_done_at: '2026-09-04T09:00:00.000Z',
      material: { title: 'Kickoff meeting', industry: 'const', scene: 'jobinterview',
        tagIds: ['articles'] } },
  ]
  return (
    <HomeworkFilter rows={rows} value={filter} onChange={setFilter}
                    sort={sort} onSort={setSort} />
  )
}

/* 画面の下の行き先(`?screen=tabs`・2026-09 利用者の指定)。

     > ゲストとしてログインするとメニューにたどり着く方法が
     > 1番上までスクロールしてハンバーガーを押すしかないのが
     > かなり不便かつ分かりにくいです

   **行き先そのまま4つ**を並べる(`App.jsx` の `TAB_IDS` が
   出すものと同じ順・同じ名前)。狭い画面で1行に収まるか・
   押せる大きさを割っていないか・名前が切れていないかは、
   **描かせないと分からない。**

   **トレーナーにも出す**(2026-09 利用者の指定)。
   > 教材、単語帳、Quick Response、スピーチ この四つにしてください
   ちがうのは**先頭の1つ**だけ(今週の宿題 / 教材)なので、
   `?role=trainer` で切り替えて**両方を測る。**
   片方だけ測ると、もう片方で名前があふれても緑のままになる。

   **本物の部品と本物の CSS で測る**(写した HTML では測らない)。
   `App.jsx` が本当にこれを出しているかは、`npm run test:bar` が
   ソースの形で別に見る —— ここだけ緑でも利用者の画面は変わらない。 */
const TABS = (
  /* **本物の骨組みで包む**(2026-09 実機)。「＋ 教材を作る」の浮きボタン
     (`.finder-float`)を帯の上へ逃がす指定は `.app-shell.has-tabs` で
     効かせてあるので、**包まないと測れない**(素通りする) */
  <div className="app-shell is-narrow has-tabs">
    <div className="app-body">
      <div className="app">
        <div style={{ height: '1200px' }} />
        {/* 一覧の途中に出る「＋ 教材を作る」。**帯に被っていないか**を測る */}
        <button type="button" className="btn btn--small finder-float">
          ＋ 教材を作る
        </button>
      </div>
    </div>
    <AppTabs
      pages={[
        q.get('role') === 'trainer'
          ? { id: 'materials', label: '教材', icon: BookIcon }
          : { id: 'homework', label: '今週の宿題', icon: TaskIcon },
        { id: 'wordbook', label: '単語帳', icon: CardsIcon },
        { id: 'qr', label: 'Quick Response', icon: BoltIcon },
        /* **「発音練習」から改名**(2026-09 利用者の指定)。
           id は変えていない —— 覚えている画面も記録もこの id である */
        { id: 'pronunciation', label: 'スピーチ練習', icon: MicIcon },
      ]}
      view={q.get('view') || (q.get('role') === 'trainer' ? 'materials' : 'homework')}
      onChange={(id) => {
        document.querySelector('.app-tabs').dataset.picked = id
      }}
    />
  </div>
)

/* Quick Response の1問(`?screen=qr`・2026-09 利用者の指定)。

     > quick reponse内の表示だが、単語帳と同じにしてくれ

   **単語帳と同じで、答えは「足す」のではなく入れ替える。**
   だから「英語を見る」を押しても**ボタンは1px も動かない。**
   長い英文で確かめる —— 短い文では、足しても動かないので分からない。

   **本物の部品と本物の CSS で測る**(写した HTML では測らない)。
   しかも**本物の置かれ方**にする —— `FocusFrame` の中に
   `<section className="qr">` を入れる形は、`QuickResponse.jsx` と
   `QrReview.jsx` がそのまま書いているものである。

   **裸の `<div>` に置いて測らない。** 高さの決まりは置かれ方で変わるので、
   本物と違う入れ物で測ると**壊れていても緑になる**(実際、はじめ
   `div.app-main` に置いていたので、集中モードで枠が伸びることに
   気づけるまでに一手よけいにかかった)。 */
const QR_PAIR = {
  key: 'q1',
  ja: '会議に遅れそうなときは、できるだけ早く連絡してください。',
  en: 'If you think you are going to be late for the meeting, '
    + 'please let us know as early as you possibly can, '
    + 'so that we can move the agenda around and start with '
    + 'the items that do not need you in the room.',
  speaker: 'Mika',
}

/* 2つの Quick Response を、**それぞれ本物の置かれ方**で描く。

   | どこ | `?screen=` | 形 |
   |---|---|---|
   | 教材の中(`QuickResponse.jsx`) | `qr` | **紙のある集中モード**(黒い地・`qr--paper`) |
   | 復習(`QrReview.jsx`) | `qrrev` | **紙を持たない**(`plain`・明るい地) |

   **片方だけ描かない。** 復習を明るくしたついでに教材の中まで明るく
   してしまっても、`?screen=qr` しか無ければ**緑のまま**になる
   (「出る」と「出ない」の両方を見る・CLAUDE.md)。 */
const qrScreen = (plain) => (
  <FocusFrame className="qrfocus" width="w100" page="qr" plain={plain} onClose={() => {}}
              /* 「◯ / ◯」は本物と同じく上の帯に置く。
                 **明るい帯で読める色になっているか**を、ここで測る */
              top={<span className="focus-count">2 / 25</span>}>
    <section className={`qr${plain ? '' : ' qr--paper'}`}>
      <div className="qr-bar" aria-hidden="true"><span style={{ width: '20%' }} /></div>
      <QrCard pair={QR_PAIR} no={2} onAnswer={() => {}} />
    </section>
  </FocusFrame>
)

/* 復習の「いつのぶん・何問ずつ」(`?screen=rscope`・2026-09 利用者の指定)。

     > 結局ただランダムに出てくるだけですごく仕組みが分かりにくい。
     > …これを直感的に選択できる仕組みを作り上げたい。

   **札そのものを、本物の部品と本物の CSS で測る。**
   写した HTML では、狭い画面で何行になるかが分からない。

   日付は**測る日から数えて**作る。決め打ちにすると、
   日が変わった翌日に「1週間以内」が 0 件になって赤くなる。 */
const RSCOPE = (() => {
  const day = (n) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  /* **絞り込みの手がかりも持たせる。** 分野・場面・教材名・レベル・品詞が
     2種類ずつ無いと、その行は出ない(選べるものしか出さない)。
     **教材名だけをわざと長くしてある** —— 欄の幅をそろえるのをやめても、
     短い言葉ばかりだと**同じ幅になって緑のまま**になるためである。

     **品詞は、2通りの言葉を混ぜてある**(2026-09)。`pos` に入るのは
     窓口が引いた**日本語**(「他動詞」)と、基礎単語の**短い印**(`n`)の
     2通りで、片方だけで測ると `posGroupOf()` を壊しても緑のままになる。
     しかも「他動詞」は**そのままの言葉では一覧に無い** ——
     まとめ方(動詞へ寄せる)まで通らないと、この行は出ない */
  const FACET = [
    { material_industry: 'it', material_scene: 'daily_standup',
      material_title: '2026-09-07 / 仕入れ先との交渉 / B1', material_level: 'B1',
      pos: '他動詞' },
    { material_industry: 'med', material_scene: 'jobinterview',
      material_title: '会議', material_level: 'A2', pos: 'n' },
  ]
  const row = (n, dueIn) => ({
    word_norm: `w${n}`,
    added_at: `${day(n)}T09:00:00`,
    due_on: day(-dueIn),
    /* **箱もばらす。** 段の札(まだ / 言えかけ / 言える)を数えるため */
    box: n % 3 === 0 ? 0 : n % 3 === 1 ? 3 : 6,
    ...FACET[n % 2],
  })
  /* **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
     `?rows=old` は**ぜんぶ古くて、今日出すものが1つも無い**状態。
     0件の札が押せなくなることを、ここで測る */
  const rows = q.get('rows') === 'old'
    // ぜんぶ半年より前。「ぜんぶ」以外はすべて0件になる
    ? [row(300, 30), row(400, 30)]
    // 今日が期限のもの2件 + 先取りをいろいろな日に
    : [
      row(0, 0), row(2, 0),
      row(4, 30), row(9, 30), row(17, 30), row(40, 30), row(120, 30),
    ]
  return (
    <section className="card">
      <h2 className="card-title">復習</h2>
      <RScopeDemo rows={rows} />
    </section>
  )
})()

/* 聞き流し(`?screen=radio`・2026-09 利用者の指定)。

     > 音楽を流しながらどんどん登録されている単語が読まれるモード

   **本物の部品と本物の CSS で測る。** 1語だけに向き合う画面なので、
   狭い端末で**送るものが出ていないか**を見るには描くしかない。

   **長い語と長い訳をわざと混ぜてある** —— 短い語ばかりだと、
   折り返しをやめても**同じ高さになって緑のまま**になる。
   曲は渡さない(0本でも聞き流しは始まる・行き止まりを作らない)。 */
const RADIO = (
  <WordRadio
    rows={[
      {
        word_norm: 'take on', display: 'take on',
        meaning_ja: '引き受ける、相手にする',
        seen_in: 'We decided to take on the project even though the deadline was tight.',
      },
      { word_norm: 'gist', display: 'gist', meaning_ja: '要点' },
    ]}
    tracks={[]}
    onClose={() => {}}
  />
)

/* Quick Response の聞き流し(`?screen=qrradio`・2026-09 利用者の指定)。

     > Quick Responseにも聞き流しを作ってくれ。
     > 英語だけ・日本語→英語 この２種類だ。

   **部品は単語帳とまったく同じ `WordRadio`。** 渡すのは
   「どの画面から来たか」(`where="qr"`)だけである。

   **わざと長い文を入れてある** —— 短い文ばかりだと、
   字を落とすのをやめても**同じ高さになって緑のまま**になる
   (`?screen=radio` に長い語と長い訳を混ぜてあるのと同じ理由)。 */
const QRRADIO = (
  <WordRadio
    where="qr"
    rows={[
      {
        en: 'We decided to take on the project even though the deadline was extremely tight.',
        ja: '締め切りが非常に厳しかったにもかかわらず、私たちはその案件を引き受けることにしました。',
      },
      {
        en: 'Could you walk me through the numbers one more time?',
        ja: '数字をもう一度説明していただけますか。',
      },
    ]}
    tracks={[]}
    onClose={() => {}}
  />
)

/* 支度の帯(`?screen=jobbar&role=…`・2026-09 実機・利用者の指定)。

     > そもそもゲストには出さない(役割で判定する)

   **ゲストの画面のいちばん上に、支度の帯が残っていた。**
   教材を作るのも支度を始めるのもトレーナーだけなのに、
   帯そのものには役割の判定が1つも無かった。

   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。
   「出ない」だけを見ると**誰にも出さない形に壊しても緑のまま**になる。
   だから `?role=` を変えて2回描き、トレーナーには出ることも数える。

   支度の中身は**終わった状態**にしてある —— 利用者の写真がその形で、
   しかも「閉じる」を押すまで居座るぶん、いちばん目に触れる。 */
const JOBBAR = (
  <JobBar
    job={null}
    secs={0}
    prep={{
      state: 'done', title: '2026-09-04 / 食事の話 / 決まり文句',
      audio: 'ok', words: 12,
    }}
    prepSecs={0}
  />
)

/* 上の帯と支度の帯を、**本物の骨組みのまま**重ねて描く
   (`?screen=sticky`・2026-09 実機・利用者の指摘)。

     > 上部バーは消えていなかったのですが、このバックグラウンドロード中の
     > 表示のバーがスクロールするとかぶってしまっているのが原因でした。

   **どちらも `position: sticky; top: 0`** だったので、あとに置いた
   支度の帯が上の帯を**まるごと覆っていた。** 送る前は縦に並ぶので、
   **送ってみるまで分からない。**

   だから `.app-shell` → `.app-body` → 帯2つ → 背の高い中身、という
   **利用者の画面とまったく同じ形**で描く(ソースを読むだけでは
   重なりは分からない・CLAUDE.md)。 */
const STICKY = (
  <div className="app-shell is-wide">
    <div className="app-body">
      <div className="app-stick">
        <AppTopbar onToggle={() => {}} open wide pageLabel="教材" icon={BookIcon} />
        {/* **ゲスト名の箱も、同じ箱の中に入れる**(2026-09 利用者の指定)。
            帯が3つになっても ☰ が押せることを、**送ってから**測る ——
            送る前は縦に並ぶので、重なっても緑のままになる */}
        <LearnerBar />
        {JOBBAR}
      </div>
      <div className="app">
        <p style={{ height: '2400px', margin: 0 }}>送るための高さ</p>
      </div>
    </div>
  </div>
)

function RScopeDemo({ rows }) {
  const [scope, setScope] = useState('due')
  const [size, setSize] = useState(10)
  /* **段の札**(2026-09 利用者の指定「タッチすればそれらを復習できるように」)。
     押せるか・押した印が出るか・0件の札が押せないかを、実際に描いて測る */
  const [group, setGroup] = useState(null)
  const [filter, setFilter] = useState(emptyFilter)
  const tally = qrTally(rows)
  return (
    <>
    <ReviewStats
      items={QR_GROUPS.map((g) => ({ ...g, n: tally[g.id] ?? 0 }))}
      value={group}
      onPick={setGroup}
      dueId="yet"
      lead={groupLead(QR_GROUPS, group, '問')}
    />
    <ReviewScope
      rows={rows} unit="問" scope={scope} size={size}
      narrowed={countNarrowed(filter)}
      onScope={setScope} onSize={setSize} onStart={() => {}}
    >
      {/* **絞り込みも「出しかた」の中**(2026-09 利用者の指定)。
          名前を左・欄を右にそろえた行が、同じ幅で並ぶかを測る。

          **中身の長さは、わざとばらばらにしてある。**
          「すべて」だけを並べると、幅をそろえるのをやめても
          **同じ幅になってしまい、壊れたままでも緑になる**
          (実際にそうなった)。利用者の画面では「すべて」と
          長い教材名が混ざり、実測で 84 / 152 / 178 / 233 / 161px と
          ばらついていた —— **その形で測る** */}
      {/* **本物の絞り込みを描く。** 手で書いた行を並べていたが、それだと
          **レベルの行を消しても緑のまま**になる(0048)。
          中身は上の `rows` が持っており、教材名だけがわざと長い */}
      <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
    </ReviewScope>
    </>
  )
}

/* 文法解説(`?screen=gnote`・0051・2026-09 利用者の指定)。

     > 文章ごとにSVOCと修飾要素についての解説をしてくれる、
     > 文法解説モードが欲しい。

   **本物の置かれ方で測る** —— 集中モードの紙(`FocusFrame` の中)である。
   ここは**紙の島**なので、色を決め打ちすると暗い配色で読めなくなる。

   **わざと長い文を混ぜてある。** 短い文だけだと、かたまりが折り返さず
   **横にはみ出しても緑のまま**になる(「中身の長さまでまねる」)。 */
const GNOTE_SENTENCES = [
  {
    en: 'The office bought a new coffee machine last week.',
    pattern: 'SVO',
    parts: [
      { t: 'The office', r: 'S' }, { t: 'bought', r: 'V' },
      { t: 'a new coffee machine', r: 'O' }, { t: 'last week.', r: 'M' },
    ],
    note: '「誰が どうする 何を」の第3文型です。last week は「いつ」を足す飾りで、無くても文は成り立ちます。',
  },
  {
    en: 'If the supplier cannot deliver the replacement parts before the end of '
      + 'this quarter, the operations team in Osaka will have to reschedule '
      + 'every installation that is already booked for next month.',
    pattern: 'SVO',
    parts: [
      { t: 'If the supplier cannot deliver the replacement parts before the end of this quarter,', r: 'M' },
      { t: 'the operations team in Osaka', r: 'S' },
      { t: 'will have to reschedule', r: 'V' },
      { t: 'every installation that is already booked for next month.', r: 'O' },
    ],
    note: 'If 〜 は「どんなときか」を足す飾りです。骨組みは「大阪の運用チームが 取り付けの予定を 組み直す」だけになります。',
  },
]

const GNOTE = (
  <FocusFrame width="w100" page="gnote" onClose={() => {}}
              top={<span className="focus-count">1 / 6 段落</span>}>
    <GrammarNote sentences={GNOTE_SENTENCES} unit="段落" />
  </FocusFrame>
)

/* 30日講座(`?screen=course`・0052・2026-09 利用者の指定)。

   **本物の部品を描いて測る。** 30日ぶんのカードが並ぶ画面なので、
   狭い端末で**押せる大きさを割っていないか**と
   **横にはみ出していないか**は、ソースを読んでも分からない。

   `me` に id を渡さないので、**サーバーは1度も呼ばない**
   (`loadCourseDays` は `supabase` が無ければ空を返す)。 */
const COURSE = <BasicsCourse me={{ id: null, level: 'Pre-Basic' }} />

/* 基礎単語(`?screen=basicpick`・0053・2026-09 利用者の指定)。

     > 講座の中の単語はそれぞれ基本360語、標準1200語、として
     > そもそもが独立して選べる単語帳にしてください

   **本物の部品を描いて測る。** 押せる大きさ・はみ出し・
   「何が起きるかを押す前に書いてあるか」は、ソースを読んでも分からない。

   押しても `addBasicWords()` は Supabase が無いので何も起きない
   (**外へは1度も出ない**)。ここで見るのは、開いたときの姿である。 */
const BASICPICK = (
  <section className="card">
    <BasicWordsPick onPicked={() => {}} />
  </section>
)

createRoot(document.getElementById('root')).render(
  q.get('screen') === 'basicpick'
    ? BASICPICK
    : q.get('screen') === 'course'
    ? COURSE
    : q.get('screen') === 'gnote'
    ? GNOTE
    : q.get('screen') === 'radio'
    ? RADIO
    : q.get('screen') === 'qrradio'
    ? QRRADIO
    : q.get('screen') === 'sticky'
    ? STICKY
    : q.get('screen') === 'rscope'
    ? RSCOPE
    : q.get('screen') === 'jobbar'
    ? JOBBAR
    : q.get('screen') === 'qr'
    ? qrScreen(false)
    : q.get('screen') === 'qrrev'
    ? qrScreen(true)
    : q.get('screen') === 'tabs'
    ? TABS
    : q.get('screen') === 'search'
    ? SEARCH
    : q.get('screen') === 'wordbook'
    ? WORDBOOK
    : q.get('screen') === 'form'
      ? FORM
      : q.get('screen') === 'result'
        ? RESULT
        : q.get('screen') === 'tools'
          ? TOOLS
          : <LessonView material={material} learnerId={q.get('who') || null} onClose={() => {}} />,
)
