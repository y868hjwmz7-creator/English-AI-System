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
import { setViewerRole } from './lib/viewer.js'
import './styles.css'

const q = new window.URLSearchParams(window.location.search)
setViewerRole(q.get('role') || null)

/* **Speech練習を確かめるとき**は、本文を1人の記事(`article`)にする。
   声は `?voice=us-4` のように渡す(名簿の id) */
const asSpeech = q.get('kind') === 'speech'

/** 検証に使う教材。**本文(会話)が1つあれば、帯はすべて出そろう** */
const material = asSpeech ? {
  id: 'test-speech', level: 'C1', title: '講演(考えを伝える)', kind: 'speech',
  headline: 'My research', tagIds: [],
  voiceIds: (q.get('voice') || 'us-4').split(','),
  sections: [{
    id: 'sec-1', exercise_type: 'article', title: '記事',
    items: [
      { id: 'it-1', prompt_en: 'Good afternoon, everyone.', prompt_ja: 'みなさん、こんにちは。' },
      { id: 'it-2', prompt_en: 'I would like to thank you for being here.', prompt_ja: '来てくださって、ありがとうございます。' },
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
const WORDBOOK = <div className="app-main"><Wordbook learnerId="g1" learnerName="Airi" /></div>

createRoot(document.getElementById('root')).render(
  q.get('screen') === 'wordbook'
    ? WORDBOOK
    : q.get('screen') === 'form'
      ? FORM
      : q.get('screen') === 'result'
        ? RESULT
        : <LessonView material={material} learnerId={q.get('who') || null} onClose={() => {}} />,
)
