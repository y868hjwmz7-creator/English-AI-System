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
import { createRoot } from 'react-dom/client'
import LessonView from './components/LessonView.jsx'
import SessionResult from './components/SessionResult.jsx'
import CollectRows from './components/CollectRows.jsx'
import GoalBar from './components/GoalBar.jsx'
import MaterialForm from './components/MaterialForm.jsx'
import Wordbook from './components/Wordbook.jsx'
import IconButton from './components/IconButton.jsx'
import {
  DownloadIcon, EraserIcon, PrintIcon, RefreshIcon, ScreenIcon,
} from './components/Icons.jsx'
import { setViewerRole } from './lib/viewer.js'
import './styles.css'

const q = new window.URLSearchParams(window.location.search)
setViewerRole(q.get('role') || null)

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

/* 教材のカードの操作の行(`?screen=tools`・2026-09 利用者の指定)。

   > この4つはアイコン化して省スペースしてください。無理やり並べすぎて
   > いてプロの仕事とは思えません。

   **本物の `IconButton` と本物の CSS で測る**(写した HTML では測らない)。
   `TrainerMaterials` そのものは Supabase を引き連れていて、この環境からは
   1件も読めない。だから**行だけ**を同じ組み立てで描く。
   ずれないよう、`npm run test:bar` が
   **`TrainerMaterials` が本当に `IconButton` を使っているか**も見る。

   `?state=busy` … 言葉が要る状態(集めています… / 本当に消す)を出す */
const busy = q.get('state') === 'busy'
/* **押したら本当に効くか**を数える。`IconButton` は長押しのあとの
   `click` を1回捨てるので、ここを間違えると**どのボタンも押せなくなる。**
   絵にした日にいちばん怖い壊れ方なので、数で確かめられるようにしておく */
const hit = () => {
  const el = document.querySelector('.card-tools')
  el.dataset.hits = String(Number(el.dataset.hits ?? 0) + 1)
}
const TOOLS = (
  <div className="app-main" style={{ padding: 16 }}>
    <section className="card">
      <div className="btn-row card-tools" data-hits="0">
        <IconButton icon={<PrintIcon />} label="印刷 / PDFで保存" onClick={hit} />
        <IconButton icon={<EraserIcon />} label="練習の記録を消す"
                    text={busy ? '本当に消す' : null} pressed={busy}
                    onClick={hit} />
        <IconButton icon={<DownloadIcon />} label="音声をダウンロード"
                    text={busy ? '集めています… 3 / 14' : null}
                    onClick={hit} />
        <IconButton icon={<RefreshIcon />} label="読み上げ音声を作り直す"
                    onClick={hit} />
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--small btn--quiet">
          この教材をゲストと共有する
        </button>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--primary">
          <ScreenIcon />セッションで使う(大きく表示)
        </button>
      </div>
    </section>
  </div>
)

createRoot(document.getElementById('root')).render(
  q.get('screen') === 'wordbook'
    ? WORDBOOK
    : q.get('screen') === 'form'
      ? FORM
      : q.get('screen') === 'result'
        ? RESULT
        : q.get('screen') === 'tools'
          ? TOOLS
          : <LessonView material={material} learnerId={q.get('who') || null} onClose={() => {}} />,
)
