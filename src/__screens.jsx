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
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTips, loadTips } from './lib/tips.js'
import LessonView from './components/LessonView.jsx'
import SessionResult from './components/SessionResult.jsx'
import CollectRows from './components/CollectRows.jsx'
import GoalBar from './components/GoalBar.jsx'
import MaterialForm from './components/MaterialForm.jsx'
import VoiceRemake from './components/VoiceRemake.jsx'
import MaterialFill from './components/MaterialFill.jsx'
import QuickResponse from './components/QuickResponse.jsx'
import { CHUNK_BOOK_LABEL } from './lib/quickResponse.js'
import { styledVoiceId } from './data/clipVoices.js'
import Wordbook from './components/Wordbook.jsx'
import IconButton from './components/IconButton.jsx'
import AppTabs from './components/AppTabs.jsx'
import QrCard from './components/QrCard.jsx'
import FrameParts from './components/FrameParts.jsx'
import BookShelf from './components/BookShelf.jsx'
import BookPick from './components/BookPick.jsx'
import DrillTitle from './components/DrillTitle.jsx'
import { nowName } from './lib/bookNow.js'
import ReviewScope from './components/ReviewScope.jsx'
import SessionOwner from './components/SessionOwner.jsx'
import AssignShelf from './components/AssignShelf.jsx'
import AssignRizap from './components/AssignRizap.jsx'
import { RIZAP_BOOKS, RIZAP_LABEL, rizapPickLabel } from './data/rizapBooks.js'
import { rizapDoneText } from './lib/assignBooks.js'
/* まとめて共有したときの1行。**文言はあちら1か所**(第5.238節) */
import { manyDoneText } from './lib/assignMany.js'
import { BASICS, FRAME_QR } from './data/learnerFeatures.js'
import { nfUnitTitle, shelfTitle } from './lib/assignBooks.js'
import { QUIZ_FORMS, WORD_ORDERS } from './lib/wordQuiz.js'
import ReviewStats from './components/ReviewStats.jsx'
import LearnerBar from './components/LearnerBar.jsx'
import { rememberLearner } from './lib/lastLearner.js'
import WordRadio from './components/WordRadio.jsx'
import ReviewSheet from './components/ReviewSheet.jsx'
import { sheetNote, sheetTitle, wordSheetPairs, wordSheetSections } from './lib/reviewSheet.js'
import { SHEET_ID } from './lib/printSheet.js'
import { markPrint } from './lib/print.js'
import WordbookFilter, { emptyFilter } from './components/WordbookFilter.jsx'
/* ★ **本物と同じ判断を呼ぶ**(第5.414節)。札の光り方も、絞り込みの数も、
   **書き写さずに `reviewScope.js` から引く** */
import { narrowedCount, pickIdOf, pickOf } from './lib/reviewScope.js'
import { LEARN_STAGES, stageLead, stageTally } from './lib/learnStage.js'
import FocusFrame from './components/FocusFrame.jsx'
import GrammarNote from './components/GrammarNote.jsx'
import BasicsCourse from './components/BasicsCourse.jsx'
import BasicWordsPick from './components/BasicWordsPick.jsx'
import ShelfBooks from './components/ShelfBooks.jsx'
import NativeFlowUnits from './components/NativeFlowUnits.jsx'
import { NATIVE_FLOW_UNITS } from './data/nativeFlow.js'
import QrReview from './components/QrReview.jsx'
import {
  FIRST_FRAME_PART, FRAME_BOOK_LABEL, FRAME_PARTS, frameQrCounts, frameQrGroups,
} from './lib/frameQr.js'
import { shelfList } from './data/shelves.js'
import SpeechPractice from './components/SpeechPractice.jsx'
import SpeechEditCard from './components/SpeechEditCard.jsx'
/* 添削ずみのスピーチは、モノローグ教材の形にして同じ画面で開く(第5.323節) */
import { speechAsMaterial } from './lib/speechPractice.js'
import SpeechBoardView from './components/SpeechBoardView.jsx'
import { accentsWithVoices, voicesOfAccent } from './data/clipVoices.js'
import NavSettings from './components/NavSettings.jsx'
import { BUDDY_KIND_DEFAULT } from './lib/buddyKind.js'
/* **ゲストの持ちものからテストを作る**(第5.260節)。AI は呼ばない(0円) */
import ExamMaker from './components/ExamMaker.jsx'
/* セッションの記録(第5.267節)。**本物をそのまま描く** */
import LessonNotes from './components/LessonNotes.jsx'
import NotesDigest from './components/NotesDigest.jsx'
import { noteSections, noteWords } from './lib/noteDigest.js'
import { bgmLevel, setVoiceLevel, voiceLevel } from './lib/mixVolume.js'
import { setBgmVolume, stopBgm } from './lib/bgm.js'
/* 音楽を流すか / どの曲か(第5.257節)。**本物と同じ3つを渡すため** */
import { bgmOn, setBgmOn } from './lib/wordRadio.js'
import { bgmChoices, bgmPickOf, loadBgmPick, saveBgmPick } from './lib/bgmPick.js'
import { loadTheme } from './lib/theme.js'
import { loadPalette } from './lib/palette.js'
import { soundOn } from './lib/sfx.js'
import { prepareAllOn } from './lib/prepareJob.js'
import JobBar from './components/JobBar.jsx'
import { AppTopbar } from './components/AppNav.jsx'
import CastChip from './components/CastChip.jsx'
import {
  BoltIcon, BookIcon, CardsIcon, DownloadIcon, EraserIcon, MicIcon,
  PrintIcon, RefreshIcon, ScreenIcon, TaskIcon,
} from './components/Icons.jsx'
/* ★ **ホーム**(第5.431節)。`pages` を props で受け取るだけなので、
     本物の部品をそのまま描いて測れる */
import AppHome, { HOME_GROUPS } from './components/AppHome.jsx'
import { ChartIcon, PeopleIcon, ShareIcon } from './components/Icons.jsx'
import MaterialShare from './components/MaterialShare.jsx'
import SearchBar from './components/SearchBar.jsx'
/* **アサインの手順**(第5.238節)。本物の部品をそのまま描く ——
   どれも props で受け取るだけなので Supabase が要らない */
import LearnerPick from './components/LearnerPick.jsx'
/* 6Steps の帯(第5.239節)。props だけなので、そのまま描いて測れる */
import StepBar from './components/StepBar.jsx'
/* **文言は書き写さない。**本物と同じものを取り込む(第5.238節) */
import { NO_ACTIVE_TEXT, PICK_LABEL } from './lib/learnerPick.js'
import MaterialTitle from './components/MaterialTitle.jsx'
import AssignNote from './components/AssignNote.jsx'
import Loading from './components/Loading.jsx'
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
/* ★ **テスト対策(TOEIC L&R Part 2 の形)**(`?kind=exam`・第5.329節)。
     2026-09-30 実機・利用者の指摘「シャッフルボタンをオンにしていても
     番号順に進み、シャッフルされません」を**測るために足した。**
     **骨組みにテスト対策の教材が1本も無かった**ので、
     `canShuffleKind()` が真になる道のうち、**exam のほうを
     誰も描いていなかった**(文型ドリルだけが描かれていた)。 */
const asExam = q.get('kind') === 'exam'
/* ★ **応答問題**(`?kind=response`・0073・第5.334節)。
     2026-10-01 利用者の指定「応答問題には正解の聞き流しモードを作ります」を
     **測るために足した。** 形は TOEIC L&R Part 2 と同じだが、
     **正解が Native Flow の表現**である。
     **骨組みに応答問題の教材が1本も無いと、「正解を聞き流す」が
     1度も描かれない**(= 出ていなくても緑のまま・第5.325節で踏んだ形)。 */
const asResponse = q.get('kind') === 'response'

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
} : asResponse ? {
  /* ★ **応答問題**(0073・第5.334節)。段は `listening` 1つで、
     **解答こそが覚えたい表現**である。
     **訳(`answer_ja`)を半分にしてある** —— 無い問が混ざったときに、
     聞き流しの札が片方だけになることを測るため(exam と同じ作法)。
     **英文の無い問を1つ混ぜてある**(`r-4`)—— 正解の聞き流しは
     そこを**落とさなければならない**(いちばん危ない形・CLAUDE.md) */
  id: 'test-response', level: 'B1', title: 'Native Flow Vol.1 / UNIT 3', kind: 'response',
  headline: '', tagIds: [],
  sections: [{
    id: 'sec-1', exercise_type: 'listening', title: 'リスニング + 理解',
    instruction: '英文は見ずに聞くこと。聞いたあとの質問に答えなさい。',
    items: [
      { id: 'r-1', audio_text: 'Could you give me a hand with these boxes?',
        /* ★ **読み上げた英文の訳**（第5.346節）。欄は `prompt_ja` */
        prompt_ja: 'この箱、手伝ってもらえますか。',
        question: 'Choose the best response. (A) I appreciate your help. '
          + '(B) The museum closes at six. (C) My brother plays the violin.',
        answer: 'I appreciate your help.',
        answer_ja: '助かります。' },
      { id: 'r-2', audio_text: 'Shall we go over the numbers one more time?',
        prompt_ja: '数字をもう一度見ておきましょうか。',
        question: 'Choose the best response. (A) The rain stopped an hour ago. '
          + "(B) That's exactly what I had in mind. (C) She lives near the station.",
        answer: "That's exactly what I had in mind.",
        answer_ja: 'まさにそう考えていました。' },
      /* ★ **2文の問を1つ混ぜてある**(第5.335節)。
           第5.333節は「文が2つ以上なら控える」と当てたので、
           **この形だけが途中から鳴っていた。**
           **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md) */
      { id: 'r-3', audio_text: 'Do you have a moment? I would like to ask about the schedule.',
        question: 'Choose the best response. (A) It went better than expected. '
          + '(B) Two coffees, please. (C) The bridge is under construction.',
        answer: 'It went better than expected.' },
      { id: 'r-4', audio_text: 'Do you have a moment to talk?',
        question: 'Choose the best response. (A) …… (B) …… (C) ……',
        answer: '' },
    ],
  }],
} : asExam ? {
  /* ★ **TOEIC L&R Part 2 の形**(`examPrep.js` の `toeic_lr` / `p2`)。
     `listening` の段が1つ、その中に問が並ぶ。
     **設問は1本の文字列**で、同じ指示文 + 3つの選択肢が入っている
     —— 実機の教材とまったく同じ形にしてある(第5.329節)。
     `answer_ja`(解答の訳)は**2026-09-30 から作らせているもの**なので、
     **半分の問にだけ入れてある** —— 訳のある問と無い問が混ざったときに、
     訳の行とまるごとなぞる道が**片方だけに出る**ことを測るためである。 */
  id: 'test-exam', level: 'B1', title: 'TOEIC L&R Part 2', kind: 'exam',
  headline: '', tagIds: [],
  sections: [{
    id: 'sec-1', exercise_type: 'listening', title: 'リスニング + 理解',
    instruction: '英文は見ずに聞くこと。聞いたあとの質問に答えなさい。',
    items: [
      { id: 'x-1', audio_text: 'When does the new branch open downtown?',
        /* ★ **読み上げた英文の訳**（第5.346節）。欄は `prompt_ja` */
        prompt_ja: '街の新しい支店は、いつ開きますか。',
        question: 'Choose the best response. (A) Next Monday morning. '
          + "(B) It's on the second floor. (C) She opened the door.",
        answer: '(A) Next Monday morning.',
        answer_ja: '(A) 来週の月曜の朝です。' },
      { id: 'x-2', audio_text: 'Who is going to lead the training session?',
        prompt_ja: '研修は誰が進めますか。',
        question: 'Choose the best response. (A) In the main hall. '
          + '(B) Ms. Tanaka from human resources. (C) Twice a week.',
        answer: '(B) Ms. Tanaka from human resources.',
        answer_ja: '(B) 人事部の田中さんです。' },
      { id: 'x-3', audio_text: "You've already sent the invoice, haven't you?",
        question: 'Choose the best response. (A) A new invoice form. '
          + '(B) Yes, this morning. (C) The voice was too loud.',
        answer: '(B) Yes, this morning.' },
      { id: 'x-4', audio_text: 'Would you like the report by email or by post?',
        question: 'Choose the best response. (A) Email is fine. '
          + '(B) I reported it already. (C) About thirty pages.',
        answer: '(A) Email is fine.' },
      { id: 'x-5', audio_text: 'Why was the shipment delayed again?',
        question: 'Choose the best response. (A) To the west warehouse. '
          + '(B) The truck broke down. (C) Yes, it was shipped.',
        answer: '(B) The truck broke down.',
        answer_ja: '(B) トラックが故障したからです。' },
      { id: 'x-6', audio_text: 'I think we should move the meeting to Thursday.',
        question: 'Choose the best response. (A) That works for me. '
          + '(B) On the third floor. (C) He moved last year.',
        answer: '(A) That works for me.' },
    ],
  }],
} : asDrill ? {
  /* **本文が1つも無い教材。** 文型ドリルは「問」が並ぶだけである。
     和文英訳を混ぜてあるのは、**読み上げるのが `answer`** だからで、
     `prompt_en` を直に見ていると1本も拾えない。
     誤り訂正は **`audioFrom: null`** —— 読み上げてはいけない演習である */
  /* ★ **`kind` は `'pattern'`**(2026-09-30・第5.325節)。
     もとは `'drill'` と書いてあったが、**`materials.kind` にそんな値は無い**
     (文型ドリルは `'pattern'`・`materialKinds.js`)。
     **骨組みは、本物と1文字も違えない**(CLAUDE.md)——
     食い違っていたので、`isDrillKind()` で決まるもの
     (シャッフル)が骨組みでは1度も描かれなかった。 */
  id: 'test-drill', level: 'B1', title: '現在完了', kind: 'pattern',
  headline: '', tagIds: ['present_perfect'],
  sections: [{
    id: 'sec-1', exercise_type: 'translate_en_ja', title: '英文和訳',
    items: [
      {
        /* **実機で消えていた形**(第5.211節・2026-09 利用者の写真)。
           `. . .` を文に切ると `"."` だけの「文」ができ、
           S も V も無いので札を付けようがない。**窓口の控えにも
           その1文が入っている**(実機と同じ形にしてある) */
        id: 'd-0', prompt_en: "Let's see . . . there's a 7:15 departure in the morning.",
        answer: 'ええと……朝7時15分発があります。',
        grammar: {
          en: "Let's see . . . there's a 7:15 departure in the morning.",
          sentences: [
            {
              en: "Let's see .",
              pattern: '',
              parts: [{ t: "Let's", r: 'V' }, { t: 'see .', r: 'M' }],
              note: '',
            },
            // 札を付けようがない「文」。**ここだけ落ちる**
            { en: '.', pattern: '', parts: [{ t: '.', r: 'M' }], note: '' },
            {
              en: ". there's a 7:15 departure in the morning.",
              pattern: 'SVC',
              parts: [
                { t: '.', r: 'M' }, { t: "there's", r: 'V' },
                { t: 'a 7:15 departure', r: 'S' }, { t: 'in the morning.', r: 'M' },
              ],
              note: '朝の便が1本あります、と言っています。',
            },
          ],
        },
      },
      {
        id: 'd-1', prompt_en: 'She has just finished her report.',
        answer: '彼女はちょうど報告書を書き終えた。',
        /* **英文和訳の解説は、問題文(`prompt_en`)に付く**(第5.210節)。
           `d-2` にはわざと付けていない —— 解説が無い問に
           「文法を見る」が出ていないことも見るためである */
        grammar: {
          en: 'She has just finished her report.',
          sentences: [{
            en: 'She has just finished her report.',
            pattern: 'SVO',
            parts: [
              { t: 'She', r: 'S' }, { t: 'has just finished', r: 'V' },
              { t: 'her report.', r: 'O' },
            ],
            note: '「誰が どうする 何を」の第3文型です。',
          }],
        },
      },
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
        /* **誤り訂正の解説は、直した英文(`answer`)に付く**(第5.210節)。
           控えの `en` も `answer` と同じ文である。
           `prompt_en`(誤った文)のほうを見に行くと、ここが
           食い違って**解説がまるごと消える** —— それが見張りになる */
        grammar: {
          en: 'I have gone to the office already.',
          sentences: [{
            en: 'I have gone to the office already.',
            pattern: 'SV',
            parts: [
              { t: 'I', r: 'S' }, { t: 'have gone', r: 'V' },
              { t: 'to the office', r: 'M' }, { t: 'already.', r: 'M' },
            ],
            note: 'have のうしろは過去分詞です。',
          }],
        },
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
        /* **カタマリの訳の控え**(0021)。**ここに1つも無かった**(第5.242節)。
           そのため ② の**本物の道は、一度も描かれていなかった** ——
           検証はずっと逃げ道(文まるごとの訳)を測っていたことになる。
           `parts` は `baseChunks()` が出す切れ目そのまま。
           **`it-2` にはわざと置いていない** —— 控えの無い教材で
           逃げ道(`.slash-ja`)が出ることも、同じ画面で測るためである
           (「無ければ素通り」する形を、検証の中に必ず置く) */
        chunks: {
          en: 'Could you tell me where the away fans usually sit?',
          parts: ['Could you tell', 'me', 'where the away fans', 'usually sit?'],
          ja: ['教えてもらえますか', '私に', 'アウェーのファンがどこで', 'ふだん座るのか'],
        },
        /* **「この文の要点」を持たせてある**(2026-09 利用者の指定
           「印刷すると『この文の要点』が消えてしまいます」)。
           札は1つずつ `<button>` なので、紙の指定を1つ間違えると
           **見出しだけが残って札が消える。** 描かないと分からない */
        phrases: [
          { text: 'away fans', note: 'アウェー側のサポーター' },
          { text: 'usually sit', note: 'ふだん座る' },
        ],
      },
      {
        id: 'it-2', speaker: 'Kenji',
        prompt_en: 'They are up in the corner behind the goal.',
        prompt_ja: 'ゴール裏の角の上の方です。',
        phrases: [{ text: 'behind the goal', note: 'ゴールの裏に' }],
      },
    ],
  }, {
    /* **本文から拾った かたまり**(第5.230節・2026-09 利用者の設計)。

       **いちばん危ない形を、必ず1つ置く**(CLAUDE.md)。

       ・`ch-2` … **分類も本文の文章も練習も無い**(0065 を貼る前・
         窓口を置き直す前に作った教材)。札が出ず、引用が出ず、
         「練習する」も出ないこと ——
         **「無ければ素通り」する形を、検証の中に必ず置く**
       ・`ch-3` … **長いかたまりと長い日本語**。狭い画面で
         「解答を見る」が押し出されないか(短い語だけだと、
         幅の指定をやめても同じ見た目になって緑のまま)
       ・練習は**片方しか無い問**を1つ混ぜてある(`chunkDrills` が落とす) */
    id: 'sec-2', exercise_type: 'vocab_note', title: '覚えておきたい表現',
    instruction: '本文に出てきた かたまり です。練習して、言えるようにしてください。',
    items: [
      {
        id: 'ch-1',
        prompt_en: 'come up with',
        prompt_ja: '〜を思いつく',
        chunk_kind: 'phrasal_verb',
        note: '「上がってくる」= 考えが浮かぶ。think of より「ひねり出す」感じが強い。',
        source_en: 'We need to come up with a plan before Friday.',
        practice: [
          { ja: 'いい案を思いつきました。', en: 'I came up with a good idea.' },
          { ja: '何も思いつかなかった。', en: "I couldn't come up with anything." },
          { ja: '名前を思いついてくれますか。', en: 'Could you come up with a name?' },
          { ja: 'チームで案を出し合いました。', en: 'Our team came up with some ideas.' },
          { ja: '締め切りまでに案を出さないといけません。',
            en: 'We have to come up with a plan by the deadline.' },
          /* **片方しか無い問**。落とされて、6問ではなく5問になる */
          { ja: '落とされる問', en: '' },
        ],
      },
      {
        id: 'ch-2',
        prompt_en: 'behind the goal',
        prompt_ja: 'ゴールの裏に',
        note: '場所を言うときの前置詞。behind = 〜の後ろに。',
      },
      {
        id: 'ch-3',
        prompt_en: 'to put it another way',
        prompt_ja: '別の言い方をすると / つまり',
        chunk_kind: 'paraphrase',
        note: '前に言ったことを、相手に分かる言葉へ置き換えるときの前置き。',
        source_en: 'To put it another way, the seats behind the goal are for away fans.',
        practice: [
          { ja: '別の言い方をすると、この案は費用がかかりすぎるということです。',
            en: 'To put it another way, this plan costs too much.' },
          { ja: 'つまり、私たちには時間が足りません。',
            en: 'To put it another way, we do not have enough time.' },
        ],
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
    {/* `?accent=` … **良い声が1人もいない訛り**を測るために渡す
        (第5.196節。読み方の欄は、そこでは出ない) */}
    <MaterialForm createdBy="t1"
                  /* ★ **ゲストを渡す**(第5.398節)。渡さないと
                       えらぶ欄が「まだいません」の1行になり、
                       **既定で畳まれているかを1度も測れない。**
                       担当は1人25人なので、その数で置く */
                  learners={Array.from({ length: 25 }, (_, i) => ({
                    id: `l${i + 1}`, display_name: `検証ゲスト${i + 1}`, status: 'active',
                  }))}
                  initial={{ kind: q.get('kind') || 'speech',
                    ...(q.get('accent') ? { accent: q.get('accent') } : {}) }}
                  onCreated={() => {}} onCancel={() => {}} />
  </div>
)

/* **読み上げ音声を作り直す欄**(`?screen=remake`・第5.196節)。

   ここでも読み方(訛り / 感情)をえらべる。**描かないと測れない** ——
   `VoiceRemake` は props で受け取るだけなので Supabase が要らない。

   `?style=emotion` … **いまの教材が「感情を出す」で作られている**形。
   開いたときに**その読み方が入っているか**を見る
   (既定に戻っていると、押しただけで読み方が変わり、課金される)。 */
const REMAKE = (
  <div className="app-main" style={{ padding: 16 }}>
    <VoiceRemake
      material={{
        id: 'm1',
        kind: 'dialogue',
        /* **本物と同じ形**(`castList` が話す人の数を数える) */
        sections: [{ exercise_type: 'dialogue', items: [
          { speaker: 'Mika', en: 'Could you send the file?' },
          { speaker: 'Ken', en: 'Sure, right away.' },
        ] }],
        /* **読み方付きの id を書き写さない**(CLAUDE.md「値を書き写さない」)。
           印を変えた日に、この骨組みだけが黙って「訛り」側に戻る */
        voiceIds: ['us-1', 'us-2'].map(
          (id) => styledVoiceId(id, q.get('style') === 'emotion' ? 'emotion' : 'accent')),
      }}
      clipCount={14} clipChars={1820} mine busy={false}
      onRun={() => {}} onCancel={() => {}} />
  </div>
)

/* **足りない演習を足す欄**(`?screen=fill`・第5.234節)。

   `MaterialFill` は props で受け取るだけなので Supabase が要らない。
   **足りないものが本当に出るか**・**選び直すと金額が動くか**を、
   本物の部品と本物の CSS で測る。

   ここに置いてある教材は「会話 + 内容の理解 + ディスカッション」で、
   **「覚えておきたい表現」だけが無い**形である ——
   利用者の「Booking a Bus」がまさにこれだった。

   `?full=1` … **ぜんぶ揃っている**形(欄そのものが出ない)。
   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。 */
const FILL = (
  <div className="app-main" style={{ padding: 16 }}>
    <MaterialFill
      material={{
        id: 'm1',
        kind: 'dialogue',
        /* **本物と同じ形**(`bodyTextOf` は `prompt_en` を読む) */
        sections: [
          { exercise_type: 'dialogue', items: [
            { speaker: 'Mika', prompt_en: "Hi, I'd like to book a bus for our team trip." },
            { speaker: 'Ken', prompt_en: 'Sure. How many people are coming?' },
          ] },
          { exercise_type: 'comprehension', items: [{ prompt_en: 'Why did Mika call?' }] },
          { exercise_type: 'discussion', items: [{ prompt_en: 'How do you book a bus?' }] },
          ...(q.get('full') === '1'
            ? [{ exercise_type: 'vocab_note', items: [{ prompt_en: 'book a bus' }] }]
            : []),
        ],
      }}
      busy={false}
      onRun={() => {}} onCancel={() => {}} />
  </div>
)

/* **教材の中の Quick Response**(`?screen=qrmode`・第5.235節)。

   **取り組み方が3つになった**(文章 / フレーズ・単語 / 覚えておきたい表現)。
   ここは**本物の `QuickResponse`** を描く —— `QrCard` だけを描いた
   `?screen=qr` には**切り替えの行そのものが無く、誰も測っていなかった。**

   3つ並ぶと**帯からはみ出しやすい。** いちばん長い呼び名
   (「覚えておきたい表現」)を入れてあるので、狭い画面で切れれば分かる。

   `?groups=one` … **文章しか無い形**(切り替えの行ごと出ない)。
   **「出る」と「出ない」の両方を見る**(CLAUDE.md)。 */
const QRMODE = (
  <div className="app-main">
    <QuickResponse
      material={{
        id: 'm1',
        kind: 'dialogue',
        sections: [
          { id: 's1', exercise_type: 'dialogue', items: [
            { id: 'i1', speaker: 'Mika',
              prompt_en: "Hi, I'd like to book a bus for our team trip.",
              prompt_ja: 'こんにちは、社員旅行のバスを予約したいのですが。' },
            { id: 'i2', speaker: 'Ken',
              prompt_en: 'Sure. How many people are coming?',
              prompt_ja: 'かしこまりました。何名様ですか?' },
          ] },
          ...(q.get('groups') === 'one' ? [] : [
            { id: 's2', exercise_type: 'vocabulary', items: [
              { id: 'i3', prompt_en: 'reservation', prompt_ja: '予約' },
            ] },
            /* **かたまりそのものと、その練習の両方**が出る形
               (第5.235節・「すべての日本語と英語」) */
            { id: 's3', exercise_type: 'vocab_note', items: [
              { id: 'i4', prompt_en: 'book a bus', prompt_ja: 'バスを予約する',
                chunk_kind: 'collocation',
                source_en: "I'd like to book a bus for our team trip.",
                practice: [
                  { ja: '来週のバスを予約したいです。', en: "I'd like to book a bus for next week." },
                  { ja: 'もうバスは予約しましたか。', en: 'Have you booked a bus yet?' },
                ] },
            ] },
          ]),
        ],
      }}
      onClose={() => {}} />
  </div>
)

/* 単語帳の集中モードを、実際に描いて確かめるための入り口(2026-09)。
   語の中身は Playwright が窓口の応答を差し替えて渡す
   (**本物の部品と本物の CSS で測る**。写した HTML では測らない) */
/* **その教材の語だけに絞ったとき**(0047・`?only=a,b,c`)。
   絞れているか・札が出ているか・外す道があるかを、実際に描いて数える */
const only = (q.get('only') || '').split(',').map((w) => w.trim()).filter(Boolean)
/* ★ **ゲストの単語帳も `WithMenuTools` で包む**(第5.414節)。
     チャンク集の見張りは `?screen=wordbook&chunk=1` を開くので、
     ここが受け取った道具を描かないと、**紙のボタンが1つも無い。**
     `?screen=mybook` だけ直して、こちらを忘れていた
     (**同じ作りの場所を、数えずに1つだけ直していた**)。 */
/* **棚も基礎単語も渡さない。** これが「出ない」側である ——
   0055 で基礎単語を外されたゲストの単語帳がこの形になる
   (冊が1つしか無いので、切り替えごと出ない)。

   **ビジネス必須チャンク集は `?chunk=1` のときだけ**(第5.199節)。
   既定で出すと、**「冊が1つしか無い画面には、えらぶ場所ごと出さない」**
   を見ている検証が、永久に赤くなる —— あの決まりはいまも生きている。
   3つとも同じ値で渡す(冊に出す決まりは `showCol || showNp || showAdv`)。
   **本物と1文字も違えない**(骨組みが食い違うと、検証は何も守らない) */
const WORDBOOK = (
  <WithMenuTools>
    {(setTools) => (
      <Wordbook learnerId="g1" learnerName="Airi" showBasics={false}
                showCol={q.get('chunk') === '1'}
                showNp={q.get('chunk') === '1'}
                showAdv={q.get('chunk') === '1'}
                only={only.length ? only : null}
                onlyLabel={only.length ? '業界の語' : ''}
                onClearOnly={only.length ? () => {} : null}
                onMenu={(t) => setTools(t ?? null)} />
    )}
  </WithMenuTools>
)

/* **トレーナー自身の単語帳**(`?screen=mybook`・2026-09 利用者の指定)。

     > これらの単語帳はトレーナーアカウントでは独立した単語帳として
     > 自由に学習できるようにして下さい。

   `learnerId` を渡さない = 自分の単語帳である。棚は `shelvesFor()` が
   トレーナーには**35冊ぜんぶ**を返すので、ここでも `shelfList()` を渡す
   (**判断は画面に持たせない**ので、渡すものは同じ形になる)。

   上の `?screen=wordbook` は**ゲストの単語帳を開いたとき**で、
   棚も基礎単語も渡していない。**「出る」と「出ない」の両方を見る**ために、
   2つとも残してある。

   **基礎単語(3冊目)もここで測る**(2026-09 利用者の指定
   「基礎単語360/1200も業種別の横に置いてください」)。
   `showBasics` の既定は真なので、渡さなくても出る。 */
/* **☰ を渡す。本物(`App.jsx`)がそうしている**(第5.278節・2026-09-27)。

   渡さなければ `Wordbook` は「✕ とじる」を出す。あちらも本物ではある
   (トレーナーがゲストの単語帳を開くとき = `?screen=wordbook` の側)が、
   **自分の単語帳はメニューから開くので、本物は必ず ☰ である。**
   渡していなかったので、**利用者が毎日見ている帯を、検証は1度も
   描いていなかった**(第5.276節で `?screen=qrradio` に踏んだのと同じ)。

   **骨組みは、本物と1文字も違えない**(CLAUDE.md)。 */
/* ★ **☰ が受け取った道具を、ここで描く**(第5.414節・段階3)。
     本物は `AppNav` の `tools` が描いている(`App.jsx` が預かって渡す)。
     **受け取るだけで捨てると、骨組みでは1ミリも測れない** ——
     紙に出す道具が ☰ の中へ移ったので、ここが無いと
     「印刷のボタンに語数が出ていない」と**誤って赤くなる**。 */
function WithMenuTools({ children }) {
  const [tools, setTools] = useState(null)
  return (
    <div className="app-main">
      {tools && (
        <>
          <div className="app-nav-tools">{tools}</div>
          {/* ★ **閉じたら捨てる。本物とまったく同じ**(第5.414節)。
                `App.jsx` は閉じるときに `setFocusTools(null)` している。
                **捨てないと、押した瞬間の道具が居座る** ——
                絞り込みを変えても**古い語数のボタンがそのまま出ている**ので、
                見張りは ☰ を押し直さず、**絞る前の数を読んで赤くなった**
                (3092 問のまま・2026-10-07)。
                **骨組みは、本物と1文字も違えない**(CLAUDE.md)。 */}
          <div className="nav-scrim" onClick={() => setTools(null)} />
        </>
      )}
      {children(setTools)}
    </div>
  )
}

const MYBOOK = (
  <WithMenuTools>
    {(setTools) => (
      <Wordbook shelves={shelfList()} showCol onMenu={(t) => setTools(t ?? null)} />
    )}
  </WithMenuTools>
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

/** 仮の担当ゲスト。**「ゲストと共有」の中身を描くのに要る** */
const CARD_LEARNERS = [
  { id: 'g1', display_name: 'Airi' },
  { id: 'g2', display_name: 'テスト太郎' },
  { id: 'g3', display_name: '佐藤ひかる' },
]

/* **アサインする**(`?screen=assign`・第5.181節)。

   2026-09 利用者の指定。

     > 新しい冊をアサインするのは各ゲストの単語帳もquick response帳、
     > もしくは「アサインする」の機能を作り…

   **本物の部品を、そのまま描く**(`AssignShelf`)。
   `AssignBooks` そのものは Supabase を引き連れているので、
   **骨組みからは1ドットも描けない**(**描けないものは測れない**)。
   だから**中に並ぶ行**を、ここで測れるようにしてある。

   **「欄がある」だけを見ない**(第5.186節)。選んでも何も起きない形に
   戻しても緑のままになるので、**押したら本当に印が変わるか・札が増えるか・
   結果がこの場に出るか**まで数えられるよう、**持ちものを持たせてある。**

   **いちばん危ない形を、必ず1つ置く。**
   ・**出している冊と、出していない冊**を混ぜる(印が読み取れるか)
   ・`?busy=on` で**決めている最中**(二度押しさせない)
   ・`?assign=none` で**1つも出していないとき**(○ だけになる)
   ・単語帳の冊と Quick Response の冊を**2つとも**出す
     (片方だけ描くと、振り分け(`featuresIn`)を壊しても緑になる)
   ・**中に区切りがある冊(業種べつ・Native Flow)も、そのまま描く** ——
     畳んであるので、測る側が開く */
function AssignScreen() {
  const busy = q.get('busy') === 'on' ? BASICS : null
  const empty = q.get('assign') === 'none'
  /* **業種べつの単語帳を作る欄**(第5.246節)。本物と同じく、既定は閉じている */
  const [buildOpen, setBuildOpen] = useState(false)
  const all = shelfList()
  /** **出している冊**。押すと本当に変わる —— 印だけ描いても意味がない */
  const [features, setFeatures] = useState(new Set(empty ? [] : [FRAME_QR]))
  /* **はじめから1冊出してある** —— 実機の写真がその形だった
     (「ビジネス全般 外す」の札が1つ) */
  const [on, setOn] = useState(empty ? [] : ['business'])
  const [units, setUnits] = useState(empty ? [] : [1, 4])
  const [wordNote, setWordNote] = useState(null)
  const [qrNote, setQrNote] = useState(null)
  /* **RIZAP ENGLISH の教材**(第5.202節)。3つの形を1画面に置く ——
     UNIT が在る / 0 UNIT / **まだ読めていない**(`undefined`) */
  const [rzPick, setRzPick] = useState({})
  const [rzNote, setRzNote] = useState(null)
  /* **①誰に**(第5.238節)。**1人だけ選ぶ形**(`single`)。
     **長い名前を1つ混ぜる** —— 短い名前だけだと、はみ出すのを見逃す */
  const [picked, setPicked] = useState('g1')
  const people = empty ? [] : [
    { id: 'g1', display_name: '山田はなこ' },
    { id: 'g2', display_name: '西大路おさむ(製造・品質保証)' },
    { id: 'g3', display_name: '佐藤' },
  ]
  /* **その他の教材**(第5.238節)。**いちばん危ない形を1つ置く** ——
     `?mats=none` で**当てはまらない**、`?mats=wait` で**読み込み中**
     (`null` を「無い」と取り違えると、黙って空になる) */
  const [matOpen, setMatOpen] = useState(q.get('mats') !== 'shut')
  const [matQ, setMatQ] = useState('')
  const [matPicked, setMatPicked] = useState(q.get('mats') === 'none' ? [] : ['m1'])
  const [matNote, setMatNote] = useState(null)
  const matBusy = q.get('busy') === 'on'
  const mats = q.get('mats') === 'wait' ? null
    : q.get('mats') === 'none' ? []
      : [
        { id: 'm1', title: '2026-09-20 / 数の表現 + 数字 / B1 / 製造' },
        /* **長い題を1つ混ぜる**(折り返しで印がずれるのを見逃さない) */
        { id: 'm2', title: '2026-09-18 / 受け身の言い回しと、ていねいな依頼 / B2 / 医薬品・医療機器' },
        { id: 'm3', title: 'Native Flow Vol.1 UNIT 3' },
      ]
  const rzUnits = empty ? {} : {
    [RIZAP_BOOKS[0].id]: [
      { id: 'u1', unit_no: 1, headline: 'Booking a Bus' },
      { id: 'u2', unit_no: 2, headline: 'At the Hotel' },
      { id: 'u3', unit_no: 3, headline: 'Ordering Lunch' },
    ],
    [RIZAP_BOOKS[1].id]: [],          // **0 UNIT**(押せる操作を出さない)
    // RIZAP_BOOKS[2] 以降は入れない = **まだ読めていない**
  }

  /** 出す / 外すを、本物と同じように折り返す */
  const flip = (set, id) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }
  const say = (setNote, name, added) => setNote({
    kind: 'ok',
    text: added ? `元 さんの画面に「${name}」を出しました。`
      : `元 さんの画面から「${name}」を外しました。`,
  })

  return (
    <div className="app-main" style={{ padding: 16 }}>
      {/* ── ①誰に(第5.238節)。**本物と1文字も違えない** ── */}
      <section className="card">
        <h2 className="card-title">アサインする</h2>
        <LearnerPick
          people={people} picked={picked ? [picked] : []} single
          onPick={(ids) => setPicked(ids[0] ?? '')} />
      </section>
      <section className="card">
        <h3 className="card-title">単語帳の冊</h3>
        <AssignShelf
          group="word" features={features} busy={busy} note={wordNote}
          onFeature={(f) => {
            setFeatures(flip(features, f.id))
            say(setWordNote, f.label, !features.has(f.id))
          }}
          /* **出している棚と、出していない棚の両方**(片方だけだと、
             「外す」の札も、足すプルダウンも、どちらかが測れない) */
          shelfOn={all.filter((x) => on.includes(x.id))}
          shelfOff={all.filter((x) => !on.includes(x.id))}
          onShelf={(sh) => {
            const had = on.includes(sh.id)
            setOn(had ? on.filter((x) => x !== sh.id) : [...on, sh.id])
            say(setWordNote, shelfTitle(sh), !had)
          }} />
      </section>
      <section className="card">
        <h3 className="card-title">Quick Response の冊</h3>
        <AssignShelf
          group="qr" features={features} busy={busy} note={qrNote}
          onFeature={(f) => {
            setFeatures(flip(features, f.id))
            say(setQrNote, f.label, !features.has(f.id))
          }}
          units={NATIVE_FLOW_UNITS} unitsOn={units}
          onUnit={(u) => {
            const had = units.includes(u.id)
            setUnits(had ? units.filter((x) => x !== u.id) : [...units, u.id])
            say(setQrNote, nfUnitTitle(u), !had)
          }}
          /* **丸ごとの行も描く**(2026-09 利用者の指定
             「ユニット毎、または丸ごとアサイン出来るように」)。
             **本物と1文字も違えない** —— 渡さないと、
             骨組みにだけ無い行ができて、検証が何も守らない */
          onAll={(v) => setUnits(v ? NATIVE_FLOW_UNITS.map((u) => u.id) : [])} />
      </section>
      {/* **RIZAP ENGLISH の教材**(第5.202節・利用者の指定)。

          **いちばん危ない形を、必ず1つ置く**(CLAUDE.md)——
          ・UNIT が入っている冊(プルダウンと「出す」が出る)
          ・**UNIT が0の冊**(押せる操作を出さない)
          ・**まだ読めていない冊**(`undefined`)——
            0 と取り違えると「まだ入っていません」と嘘をつく。
            **3つとも描かないと、その書き分けを壊しても緑のまま**になる */}
      <section className="card">
        <h3 className="card-title">{RIZAP_LABEL}</h3>
        <AssignRizap
          books={RIZAP_BOOKS} units={rzUnits} picked={rzPick}
          busy={q.get('busy') === 'on' ? RIZAP_BOOKS[0].id : null}
          note={rzNote}
          onPick={(id, unit) => setRzPick({ ...rzPick, [id]: unit })}
          onSend={(id) => setRzNote({
            kind: 'ok',
            text: rizapDoneText('元',
              rizapPickLabel(id, rzPick[id] ?? '', (rzUnits[id] ?? []).length),
              rzPick[id] ? 1 : (rzUnits[id] ?? []).length),
          })} />
      </section>

      {/* ── **その他の教材**(第5.238節)。**本物と1文字も違えない** ──
          畳みの札は**見出しの行**に置く(一覧の末尾に置かない・共通ルール) */}
      <section className="card">
        <div className="assign-mats-head">
          <h3 className="card-title">その他の教材</h3>
          <button type="button" className="btn btn--small btn--ghost"
                  aria-expanded={matOpen}
                  onClick={() => setMatOpen(!matOpen)}>
            {matOpen ? 'とじる' : 'さがす'}
          </button>
        </div>

        {matOpen && (
          <>
            <SearchBar keyword={matQ} onKeyword={setMatQ}
                       placeholder="教材の名前で探す" />

            {mats === null && <Loading />}
            {mats !== null && mats.length === 0 && (
              <p className="card-hint">当てはまる教材がありません。</p>
            )}

            {mats !== null && mats.length > 0 && (
              <div className="assign-mats">
                {mats.map((m) => (
                  <label key={m.id} className="toggle">
                    <input type="checkbox" checked={matPicked.includes(m.id)}
                           disabled={matBusy}
                           onChange={() => setMatPicked((now) => (
                             now.includes(m.id)
                               ? now.filter((x) => x !== m.id) : [...now, m.id]))} />
                    <MaterialTitle title={m.title} material={m} as="span" size="row" hideDate />
                  </label>
                ))}
              </div>
            )}

            {matPicked.length > 0 && (
              <div className="btn-row">
                <button type="button" className="btn btn--primary"
                        disabled={matBusy}
                        onClick={() => setMatNote({
                          kind: 'ok',
                          text: manyDoneText(matPicked.length, 1, ' 単語帳に 12 語入れました。'),
                        })}>
                  {matBusy ? '共有しています…' : `${matPicked.length} 件を共有する`}
                </button>
              </div>
            )}
          </>
        )}

        <AssignNote note={matNote} />
      </section>

      {/* ── **業種べつの単語帳を作る**(第5.246節)。**本物と1文字も違えない** ──
          左メニューの行き先を1つ減らして、ここへ移した。
          **既定では閉じている**(「その他の教材」と同じ作法)。
          中身(`ShelfBuilder`)は Supabase を引き連れているので、
          骨組みでは**閉じた形だけ**を置く —— 本物も既定では閉じている */}
      <section className="card">
        <div className="assign-mats-head">
          <h3 className="card-title">業種べつの単語帳を作る</h3>
          <button type="button" className="btn btn--small btn--ghost"
                  aria-expanded={buildOpen}
                  onClick={() => setBuildOpen(!buildOpen)}>
            {buildOpen ? 'とじる' : 'ひらく'}
          </button>
        </div>
      </section>
    </div>
  )
}


/**
 * **カードの「共有」でゲストを選ぶ**(`?screen=pick`)。
 *
 * **まとめて共有する帯とチェックは、第5.248節で排除した**
 * (2026-09-23 利用者の指定「教材の一括共有用のチェック☑️、
 * やはり排除しましょう。不細工です」)。
 *
 * **ゲストを選ぶ欄そのものは残っている** —— カードの「共有」を押すと
 * 出るのがこれで、`TrainerMaterials` の本物と**1文字も違えず**に置く。
 * 帯を消したついでに、ここの見張りまで落とすと
 * **25人ぶんのチェックが常に並ぶ形に戻しても緑のまま**になる。
 *
 * ・`?pick=shut` … 押す前(まだ一覧を開いていない)
 * ・`?pick=busy` … 送っている最中(押せない)
 * ・名前は**長いもの**を混ぜる / **休会中の人がいる**1行も出す
 */
/**
 * **6Steps の帯**(`?screen=steps`・第5.239節)。
 *
 * 本物の `StepBar` をそのまま描く。**1文字も違えない。**
 * `?steps=last` で**いちばん後ろを選んでいる形**も測れる
 * (端が切れていないか・折り返していないか)。
 */
function StepsScreen() {
  const [step, setStep] = useState(q.get('steps') === 'last' ? 'repeat' : 'dictation')
  return (
    <div className="app-main" style={{ padding: 16 }}>
      <section className="card">
        <StepBar step={step} onChange={setStep} />
      </section>
    </div>
  )
}

function PickScreen() {
  const [picked, setPicked] = useState([])
  const manyBusy = q.get('pick') === 'busy'
  const active = [
    { id: 'g1', display_name: '山田はなこ' },
    { id: 'g2', display_name: '西大路おさむ(製造・品質保証)' },
    { id: 'g3', display_name: '佐藤' },
  ]
  const notActive = [{ id: 'g9', display_name: '休会 ちから' }]

  return (
    <div className="app-main" style={{ padding: 16 }}>
      <div className="card material-card">
        <LearnerPick people={active} picked={picked} onPick={setPicked}
                     disabled={manyBusy}
                     label={PICK_LABEL} emptyText={NO_ACTIVE_TEXT} />
        {notActive.length > 0 && (
          <p className="field-hint">
            休会中・退会済の {notActive.length} 人とは共有できません。
          </p>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn--primary"
                  disabled={!picked.length || manyBusy}
                  onClick={() => {}}>
            {picked.length ? `${picked.length} 人と共有する` : '共有する'}
          </button>
        </div>
      </div>
    </div>
  )
}




/* **いま誰の記録として残るか**(`?screen=owner`・第5.178節)。

   2026-09 利用者の指摘。

     > 明らかに他のゲストが登録した単語などが入っていることがあります。
     > しっかり分けて管理する体制にしてください。

   **本物の部品を、そのまま描く**(`SessionOwner`)。props で受け取るだけ
   なので Supabase が要らない —— レッスン表示の中では担当ゲストを
   **窓口から読む**ので、骨組みからは一覧を入れられない
   (**描けないものは測れない**・CLAUDE.md)。

   **いちばん危ない形を、必ず1つ置く。**
   ・名前は**長いもの**を混ぜる(帯からはみ出すのを見逃さない)
   ・`?owner=fixed` で**押せない名札**(ゲストのページから開いたとき)
   ・`?owner=empty` で**担当ゲストがいない**(黙って空にしない) */
function OwnerScreen({ fixed = false, people = null }) {
  const [who, setWho] = useState(null)
  return (
    <div className="lesson" style={{ position: 'static' }}>
      {/* **本物と同じ入れ物に入れる**(`.lesson-bar` の直の子)。
          ここを変えると、名札の見た目も折り返し方も本物と変わる ——
          **骨組みが本物と食い違うと、検証は何も守らない**(CLAUDE.md)。
          **幅の詰まり方は、ここでは測らない。** 帯の中身(閉じる・
          ページ送り・解答・表示)が無いので、どんな幅でも入ってしまう ——
          **「無ければ素通り」する形**である。潰れないことは
          `?role=trainer&who=g1`(本物のレッスン表示)で測る */}
      <div className="lesson-bar no-print">
        <SessionOwner
          learnerId={who}
          name={(people ?? []).find((p) => p.id === who)?.display_name ?? ''}
          people={people}
          /* **受け止める親がいるときだけ押せる**(本物と同じ判断) */
          onPick={fixed ? null : setWho}
          onOpen={() => {}} />
      </div>
    </div>
  )
}

/* **部品にしてある。** 「共有」の開け閉めは呼ぶ側が持つ形にしたので
   (`open` / `onOpen` / `onClose`)、ここでも本物と同じように持つ。
   **本物の部品・本物の CSS で測る**(写した HTML では測らない) */
function ToolsScreen() {
  const [shareOpen, setShareOpen] = useState(false)
  const [picked, setPicked] = useState([])
  return (
    <div className="app-main" style={{ padding: 16 }}>
      <section className="card">
        {/* 問数の行。**写真と同じ中身**(390px では3つで 328px 使う)。

            **ここには `tip` を付けない。** 本物の画面では畳んであるが、
            この行は「読み上げの声」の札が**その下にいるか**を測るための
            物差しである。畳むと高さが 0 になり、
            **測れないものは測れない**(検証が「描かれない」で赤くなる) */}
        <div className="muted material-parts">
          <span>会話 14 発言</span>
          <span>内容の理解 5 問</span>
          <span>ディスカッション 5 問</span>
        </div>
        {/* ふだん使う**3つ**(2026-09 利用者の指定)。
            > 「印刷/PDF」「音声ダウンロード」「教材をシェア」を適宜言葉を
            > 減らしてアイコンを活かすことで３つ並ぶようにしてください

            **絵だけには戻さない。** 何のボタンかを言う語は1つずつ残す */}
        <div className="btn-row card-tools" data-hits="0">
          <button type="button" className="btn btn--small btn--quiet" onClick={hit}>
            <PrintIcon />PDF
          </button>
          <button type="button" className="btn btn--small btn--quiet" onClick={hit}>
            <DownloadIcon />
            {/* **集めているあいだも、数は1文字も削らない**(CLAUDE.md) */}
            {busy ? '3 / 14' : '音声'}
          </button>
          {/* **本物の部品で測る。** 中で「ゲストと共有」「リンクを渡す」の
              2つから選べるか、狭い画面ではみ出さないかを見る */}
          <MaterialShare
            material={{ id: '11111111-2222-3333-4444-555555555555',
                        title: '2026-09-07 / 会議に出る / 業界の語' }}
            open={shareOpen}
            onOpen={() => { setShareOpen(true); setPicked([]) }}
            onClose={() => setShareOpen(false)}
            guest={(
              <>
                <p className="field-label">共有するゲストを選んでください(複数可)</p>
                <div className="assign-list">
                  {CARD_LEARNERS.map((l) => (
                    <label key={l.id} className="toggle">
                      <input type="checkbox" checked={picked.includes(l.id)}
                             onChange={() => setPicked(picked.includes(l.id)
                               ? picked.filter((x) => x !== l.id)
                               : [...picked, l.id])} />
                      <span>{l.display_name}</span>
                    </label>
                  ))}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn--primary"
                          disabled={!picked.length}>
                    {picked.length ? `${picked.length} 人と共有する` : '共有する'}
                  </button>
                </div>
              </>
            )}
          />
        </div>
        {/* **本物と同じく、素の `<button>` にする**(2026-09 実機)。
            ここを `.btn-row` で包んでいたせいで、**骨組みだけ 8px 空き**
            (`.card-tools + .btn-row`)、本物の 0px を素通りさせていた。
            **骨組みが本物と食い違うと、検証は何も守らない** */}
        <button type="button" className="btn btn--primary">
          <ScreenIcon />セッションで使う(大きく表示)
        </button>
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
}

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
/* ★ **本物の骨組みで包む**(2026-09 実機 / 第5.405節で関数にした)。

   「＋ 教材を作る」の浮きボタン(`.finder-float`)を帯の上へ逃がす指定は
   `.app-shell.has-tabs` で効かせてあるので、**包まないと測れない**。

   **包み方は、ここ1か所**(第5.405節)。練習中(集中モード)も下の
   メニューを出すようになったので、**`?screen=qrrev&tabs=1` /
   `?screen=mybook&tabs=1` も、まったく同じ包みで測る** ——
   包みを2つ書くと、片方だけ本物と違っていても緑になる。 */
const 帯つき = (中身) => (
  <div className="app-shell is-narrow has-tabs">
    <div className="app-body">
      <div className="app">{中身}</div>
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

/* ★ ── ホーム(`?screen=home`・第5.431節・2026-10-09 利用者の指定)──

     > 情報の見せ方、余白、文字の階層、カードの配置を改善してください
     > 各カードの説明文も不要です

   **組の呼び名は書き写さない。** `HOME_GROUPS` から引く ——
   書き写すと、呼び名を変えた日に骨組みだけが古くなる(CLAUDE.md)。

   **`?one=1` は「組が1つだけ」の形**(ゲストのアカウント)。
   そこでは見出しを出さない —— 何も分けていない見出しを置かない。
   **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)ので、
   **どの組にも入っていない1つ**(`group` 無し)も混ぜてある。 */
const [組ゲスト, 組学習] = HOME_GROUPS.map((g) => g.id)
const HOME_PAGES = [
  { id: 'learners', label: 'ゲスト', icon: PeopleIcon, group: 組ゲスト },
  { id: 'assign', label: 'アサインする', icon: ShareIcon, group: 組ゲスト },
  { id: 'admin', label: '集計', icon: ChartIcon, group: 組ゲスト },
  { id: 'materials', label: '教材', icon: BookIcon, group: 組学習 },
  { id: 'wordbook', label: '単語帳', icon: CardsIcon, group: 組学習 },
  { id: 'qr', label: 'Quick Response', icon: BoltIcon, group: 組学習 },
  { id: 'pronunciation', label: 'スピーチ練習', icon: MicIcon, group: 組学習 },
  /* **どの組にも入っていないもの。** 黙って消えないことを測る */
  { id: 'homework', label: '今週の宿題', icon: TaskIcon },
]
const homeScreen = (ひと組) => {
  const 渡す = ひと組 ? HOME_PAGES.filter((x) => x.group === 組学習) : HOME_PAGES
  /* **渡した数を、そのまま外に書いておく。**
     見張りは「描かれたカードの数」とこれを突き合わせる ——
     数を見張りの側に書き写すと、骨組みを増やした日に古くなる */
  return 帯つき(
    <div data-home-pages={渡す.length}>
      <AppHome pages={渡す}
               onPick={(id) => { document.querySelector('.home').dataset.picked = id }} />
    </div>,
  )
}

const TABS = 帯つき(
  <>
    <div style={{ height: '1200px' }} />
    {/* 一覧の途中に出る「＋ 教材を作る」。**帯に被っていないか**を測る */}
    <button type="button" className="btn btn--small finder-float">
      ＋ 教材を作る
    </button>
  </>,
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
  /* **ヒント**(2026-09)。**いちばん長い実物の型の名前**(30 字)を入れる ——
     短い名前だと、狭い画面ですき間が詰まっても緑のままになる
     (**いちばん危ない形を、検証の中に必ず置く**・CLAUDE.md) */
  hint: 'I was wondering if you could ~',
}

/* **言い換えの1問**(`?say=1`・第5.198節・利用者の指摘)。

     > 「言い換え」は英語が書いてあり、それを型に則って
     > 別の形の英語で言い換えるトレーニングです

   **同じ問の、英文が出題になった形**である。`askEn` を持つ行だけが
   こうなるので、**持つ形と持たない形の両方を描く** ——
   片方だけだと、**どの問でも英文を出す形**に書き換えても緑のままになる
   (「出る」と「出ない」の両方を見る・CLAUDE.md)。

   **素の英文も、実物どおり長いものを入れる** —— 短い文では、
   枠からあふれるのも、訳を開いてボタンが押し出されるのも測れない。 */
const QR_SAY_PAIR = {
  ...QR_PAIR,
  key: 'q1-say',
  askEn: 'If you cannot make it to the meeting on time, '
    + 'tell us as soon as you can, so that we can change the order '
    + 'of the agenda and start with the parts that do not need you.',
}

/* 2つの Quick Response を、**それぞれ本物の置かれ方**で描く。

   | どこ | `?screen=` | 形 |
   |---|---|---|
   | 教材の中(`QuickResponse.jsx`) | `qr` | **紙のある集中モード**(黒い地・`qr--paper`) |
   | 復習(`QrReview.jsx`) | `qrrev` | **紙を持たない**(`plain`・明るい地) |

   **片方だけ描かない。** 復習を明るくしたついでに教材の中まで明るく
   してしまっても、`?screen=qr` しか無ければ**緑のまま**になる
   (「出る」と「出ない」の両方を見る・CLAUDE.md)。 */
/* **本物の Quick Response を、そのまま描く**(`?screen=qrreal`・第5.191節)。

     > quick responseの冊の絞り込みが全く機能していません。
     > また、聞き流しも機能していません。

   上の `?screen=qr` / `?screen=qrrev` は**写した骨組み**なので、
   **本物の持ちもの(いつ組み直すか・どこに描くか)を1つも測れない。**
   実際、この2つの不具合はどちらも**持ちものの側**にあった ——
   ①絞っても、新しい中身が届く前に古い問で組んでいた
   ②聞き流しを描く場所が「始める前」の枝にしか無かった

   **だから本物を置く。** `frameOn` の冊(66 の型)は
   **ファイルに書いてあり、Supabase を1回も呼ばない**ので、
   骨組み(接続なし)でもそのまま動く。 */
const QRREAL = (
  <WithMenuTools>
    {(setTools) => (
      <QrReview nfUnits={NATIVE_FLOW_UNITS} frameOn onClose={() => {}}
                onMenu={(t) => setTools(t ?? null)} />
    )}
  </WithMenuTools>
)

/* ★ **終わりの1枚**(第5.387節・2026-10-05 実測)。

     利用者「以前直したはずなのですが、改善していません」。
     測ったら、**終わりの一覧 2906px が、地の色を塗っている紙 809px の中**
     にいた —— 7行目くらいから下は紙の外に乗り、途中で背景が切り替わっていた。

   **本物の `QuickResponse` をそのまま置く。** ここで手書きの骨組みを作ると、
   **骨組みだけが直っていて本物は壊れている**が起きる(CLAUDE.md)。
   こちらが渡すのは**中身(データ)だけ**である。

   **30 問。** 短い一覧では画面に収まってしまい、**はみ出しを測れない。** */
const QRDONE_ITEMS = Array.from({ length: 30 }, (_, i) => ({
  id: `qd${i}`, seq: i + 1,
  prompt_ja: `${i + 1} 番目の日本語の文です。これを英語で言います。`,
  prompt_en: `This is sentence number ${i + 1} for the quick response drill.`,
}))
const QRDONE = (
  <QuickResponse
    material={{
      id: 'qd', title: '2026-10-05 / 終わりの1枚', level: 'B1', kind: 'reading',
      sections: [{ id: 'qds', seq: 1, exercise_type: 'article', instruction: '', items: QRDONE_ITEMS }],
    }}
    focus onFocusClose={() => {}} onClose={() => {}}
  />
)

const qrScreen = (plain) => (
  <FocusFrame className="qrfocus" width="w100" page="qr" plain={plain} onClose={() => {}}
              /* **左上が ☰ になるのは、復習(`plain`)だけ**(第5.172節)。
                 教材の中の Quick Response は、閉じたら**読んでいた教材に戻る**
                 ので ✕ のままである。**本物と1文字も違えない**(CLAUDE.md)——
                 片方だけ描くと、間違えて両方 ☰ にしても緑のままになる */
              onMenu={plain ? () => {} : null}
              /* **冊名 ▾ は帯に置く**(第5.176節)。**復習だけ** ——
                 教材の中の Quick Response には冊という区切りが無い。
                 **いちばん長い冊名を入れてある** —— 短い名前だと、
                 帯からはみ出すのを見逃す(利用者の画面はこれである) */
              top={plain ? (
                <BookPick books={[
                  { id: 'my', label: '自分の Quick Response 帳' },
                  { id: 'nf', label: 'Native Flow', hasSub: true },
                  { id: 'frame', label: FRAME_BOOK_LABEL, hasSub: true },
                  /* **覚えておきたい表現集**(0066・第5.237節)。
                     **本物と同じ冊数にしておく** —— 冊が増えると
                     選ぶ一覧の高さが変わる(CLAUDE.md「骨組みは本物と
                     1文字も違えない」)。**呼び名は書き写さない** */
                  { id: 'chunk', label: CHUNK_BOOK_LABEL },
                ]} book="my" unit="問" onPick={() => {}} />
              ) : null}
              /* **「出しかた」も本物と同じく帯に置く**(第5.176節)。
                 **3つそろえないと、帯からはみ出すのを測れない** ——
                 利用者が見たのは「☰ / 冊名 ▾ / …… / 出しかた」の行である */
              topEnd={plain ? (
                <ReviewScope
                  compact
                  rows={[]}
                  unit="問"
                  pick="due"
                  size={10}
                  onPick={() => {}}
                  onSize={() => {}}
                  onStart={() => {}}
                />
              ) : null}>
    <section className={`qr${plain ? '' : ' qr--paper'}`}>
      {/* **いま出しているものの名前を、全文で出す**(第5.176節 / 第5.187節)。
          **復習(`plain`)にだけ出す** —— 教材の中の Quick Response には
          冊という区切りが無い。**本物と1文字も違えない**(CLAUDE.md)。

          **いちばん長い形を入れてある**(第5.187節・利用者の指定
          「選んだ後に選んだものがどこかに明確に表示されてほしい」)。
          冊 / 中身 / 型 の3つがつながると、ここまで長くなる ——
          短い名前だと、**折り返しも切れ方も測れない。**
          つなぐのは本物と同じ `nowName()` で、**書き写さない** */}
      {plain && <DrillTitle label={nowName([
        FRAME_BOOK_LABEL, '日本語 → 英語', '① 1. させる(背中を押す)',
      ])} />}
      <div className="qr-bar" aria-hidden="true"><span style={{ width: '20%' }} /></div>
      {/* **本物と1文字も違えない**(CLAUDE.md)。
          型の札を出すのは**復習(`plain`)のときだけ** —— 教材の中の
          Quick Response(紙・集中モード)には `showFrame` を渡していない。
          骨組みだけが本物と食い違うと、検証は何も守らない */}
      {/* **ヒントも、本物と同じ渡し方で**(2026-09 実機・利用者の指摘
          「ヒント内の『ヒント』の表示が崩れている」)。
          押した状態は本物でも呼ぶ側が持つので、ここでも props で渡す */}
      {/* `?say=1` … **言い換え**(英文が出題・第5.198節) */}
      <QrCard pair={q.get('say') === '1' ? QR_SAY_PAIR : QR_PAIR}
              no={2} onAnswer={() => {}} showFrame={plain}
              hintOn={plain} onHint={() => {}} />
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
    /* ★ **答えたことがあるかも、ばらす**(第5.406節)。
         箱 0 は**2つの意味**を持つ —— 入れただけ(未学習)と、
         答えて戻った(苦手)。見分けるのは**2つの時刻の差**なので、
         どちらも作っておかないと**「苦手」が1枚も出ず、
         `answeredYet()` を壊しても緑のまま**になる。
         **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)。 */
    updated_at: n % 2 === 1
      // 答えたぶん。**時刻が進んでいる** = 苦手
      ? `${day(Math.max(0, n - 1))}T10:00:00`
      // 入れただけ。**2つの時刻が同じ** = 未学習
      : `${day(n)}T09:00:00`,
    due_on: day(-dueIn),
    /* **箱もばらす。** 覚え具合の4段階を数えるため(第5.406節) */
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
    /* **何を聞き流しているのか**(第5.264節)。本物は練習の画面に
       出している題(`shownLabel`)をそのまま渡す。
       **長い題にしてある** —— 短い題だと、縮む指定をやめても
       同じ見た目になって緑のままになる */
    label="自分の単語帳 / 製造業 / 動詞だけ 12 語"
    rows={[
      {
        word_norm: 'take on', display: 'take on',
        meaning_ja: '引き受ける、相手にする',
        seen_in: 'We decided to take on the project even though the deadline was tight.',
      },
      { word_norm: 'gist', display: 'gist', meaning_ja: '要点' },
    ]}
    /* **聞き流しの中でも教材をえらべる**(第5.283節)。本物(`Wordbook`)は
       3つとも渡している —— **骨組みは本物と1文字も違えない**(CLAUDE.md)。
       **2冊以上入れておく**(1冊だと欄そのものが出ないので、
       欄を消しても緑のまま)。**長い冊名を1つ混ぜる**(第5.176節) */
    /* ★ **いま鳴っている冊を、先頭に置かない**(2026-09-27 の赤チェックで
       分かった)。`<select>` は **`value` がどの札にも合わないとき、
       先頭の札を見せる** —— いまの冊が先頭だと、
       **`value` を空にしても同じ見た目**になり、見張りが素通りする */
    books={[
      { id: 'basic', label: '基礎単語(標準1200語)' },
      { id: 'my', label: '自分の単語帳' },
      { id: 'keep', label: '覚えておきたい表現集(会議・交渉・雑談)' },
    ]}
    book="my"
    onBook={() => {}}
    /* ★ **冊の中の区切り**(第5.288節)。本物(`Wordbook`)は `bookSub` ——
       基礎単語なら段、棚なら冊、チャンク集なら段と組である。
       ここは**札の行**(`chiprow`)を1つ置く */
    sub={(
      <div className="chiprow" role="group" aria-label="基礎単語の段">
        <button type="button" className="chip chip--on">基本360語</button>
        <button type="button" className="chip">標準1200語</button>
      </div>
    )}
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
    /* **何を聞き流しているのか**(第5.264節)。本物は `drillLabel` ——
       冊の名前と、絞り込んでいれば Unit・中身・型まで入る */
    label="Native Flow Vol.1 / UNIT 3 / S V O to do"
    /* **「出しかた」で選んでいる数を持ち込む**(第5.262節・
       2026-09-26 利用者の指定)。`?screen=qrradio&size=10` で、
       **10問に絞って練習していた人が開いた形**を測れる。
       渡さなければ「ぜんぶ」(本物の既定と同じ)。

       ★ **値は書き写さず、そのまま渡す**(第5.414節)。
         `=== '5' ? 5 : 'all'` と書いてあったが、段階3で
         **一覧が 10 / 20 / ぜんぶになり、5 が無くなった** ——
         `sizeOfValue()` が既定へ落とすので、
         **「絞っていた人」と「絞っていない人」が同じ数になり、
         この見張りは何も測らなくなっていた。**
         いまは生の値を渡し、**正しいかどうかは本物(`WordRadio` の
         `sizeOfValue()`)に決めさせる** —— 一覧を変えた日に、
         骨組みを直さなくても付いてくる。 */
    size={q.get('size') || 'all'}
    /* **いちばん小さい数より多い文を入れておく**(CLAUDE.md「無ければ
       素通りする形の検証を書かない」)—— 絞っても減らない数しか無いと、
       絞りを外しても緑のままになる。
       ★ **一覧の最小が 10 になった**(段階3)ので、8本では足りない。
         **いちばん大きい数(20)より多く**してある。 */
    rows={[
      {
        en: 'We decided to take on the project even though the deadline was extremely tight.',
        ja: '締め切りが非常に厳しかったにもかかわらず、私たちはその案件を引き受けることにしました。',
      },
      {
        en: 'Could you walk me through the numbers one more time?',
        ja: '数字をもう一度説明していただけますか。',
      },
      { en: 'Let me get back to you on that.', ja: 'その件は、あらためてご連絡します。' },
      { en: 'I am afraid that will not work for us.', ja: '申し訳ありませんが、それでは難しいです。' },
      { en: 'Could you put that in writing?', ja: '書面にしていただけますか。' },
      { en: 'We are running behind schedule.', ja: '予定より遅れています。' },
      { en: 'That makes a lot of sense.', ja: 'とても納得できます。' },
      { en: 'I will look into it right away.', ja: 'すぐに調べます。' },
      { en: 'Let us circle back to this next week.', ja: 'この件は来週あらためましょう。' },
      { en: 'I am not sure I follow you.', ja: 'すみません、話が追えていません。' },
      { en: 'Would Thursday morning work for you?', ja: '木曜の午前はご都合いかがですか。' },
      { en: 'We will need a bit more time.', ja: 'もう少し時間が必要です。' },
      { en: 'Thank you for bearing with us.', ja: 'お待たせして申し訳ありません。' },
      { en: 'Let me double-check the figures.', ja: '数字をもう一度確かめます。' },
      { en: 'That is outside our budget.', ja: 'それは予算を超えています。' },
      { en: 'Could you send over the latest draft?', ja: '最新の原稿を送っていただけますか。' },
      { en: 'I will keep you posted.', ja: '進み次第お知らせします。' },
      { en: 'We are on the same page.', ja: '認識は合っています。' },
      { en: 'Let me take that offline.', ja: 'その件は個別に話しましょう。' },
      { en: 'I would rather hold off for now.', ja: 'いまは見送りたいです。' },
      { en: 'Shall we wrap up here?', ja: 'ここで終わりにしましょうか。' },
      { en: 'That is a fair point.', ja: 'それはもっともです。' },
      { en: 'I will take care of it.', ja: '私が引き受けます。' },
      { en: 'Could you clarify what you mean?', ja: 'どういう意味か教えていただけますか。' },
      { en: 'We appreciate the quick turnaround.', ja: '早いご対応に感謝します。' },
    ]}
    /* **曲を2つ以上入れておく**(第5.194節・2026-09 利用者の指定
       「複数登録した曲から選べるようにしてください」)。
       **1つだと選ぶ欄そのものが出ない**(`bgmChoices`)ので、
       欄を消しても緑のままになる —— **いちばん危ない形を置く。**
       **長い題を1つ混ぜる** —— 短い題ばかりだと、帯からはみ出すのを
       見逃す(第5.176節で踏んだところ) */
    tracks={q.get('songs') === 'one'
      ? [{ id: 't1', title: '朝の光', path: 'a.mp3' }]
      : [
        { id: 't1', title: '朝の光', path: 'a.mp3' },
        { id: 't2', title: '雨あがりの街をゆっくり歩くときのためのピアノ', path: 'b.mp3' },
        { id: 't3', title: '', path: 'c.mp3' },
      ]}
    /* **本物は ☰ を渡す**(第5.172節・`QrReview` が `onMenu` を渡している)。
       骨組みが渡していなかったので、**やめる道が1度も描かれていなかった**
       —— 骨組みは本物と1文字も違えない(CLAUDE.md・第5.276節で気づいた) */
    onMenu={() => {}}
    /* **聞き流しの中でも教材をえらべる**(第5.283節)。
       本物(`QrReview` / `Wordbook`)は3つとも渡している。

       **2冊以上入れておく** —— 1冊だと欄そのものが出ないので、
       **欄を消しても緑のまま**になる(いちばん危ない形を置く・CLAUDE.md)。
       **長い冊名を1つ混ぜる**(第5.176節で踏んだところ)。
       `?books=one` で、**冊が1つのとき**(欄が出ない側)も測れる */
    books={q.get('books') === 'one'
      ? [{ id: 'nf', label: 'Native Flow Vol.1' }]
      /* ★ **いま鳴っている冊(`nf`)を先頭に置かない**(上の `?screen=radio`
         と同じ理由。`value` を空にしても先頭の札が見えてしまう) */
      : [
        { id: 'my', label: '自分の Quick Response 帳' },
        { id: 'nf', label: 'Native Flow Vol.1' },
        { id: 'keep', label: '覚えておきたい表現集(会議・交渉・雑談)' },
      ]}
    book="nf"
    onBook={() => {}}
    /* ★ **冊の中の区切り**(第5.288節・2026-09-27 利用者の指摘
       「冊の中のUNITなどが選べません」)。本物(`QrReview`)は
       `bookSub` —— Native Flow の冊なら **UNIT の欄**である。
       **骨組みは本物と1文字も違えない**ので、同じ部品をそのまま渡す。
       `?sub=none` で、**区切りの無い冊**(欄が出ない側)も測れる */
    sub={q.get('sub') === 'none' ? null : (
      <NativeFlowUnits units={NATIVE_FLOW_UNITS} picked={null} onPick={() => {}} />
    )}
    onClose={() => {}}
  />
)

/* セッションの記録(`?screen=notes&role=…`・第5.267節・2026-09-26 利用者の指定)。

     > ゲストログインしたさいの「セッションの記録」を、
     > ゲストも入力、編集できるようにしたいです。
     > セッション中に…画面いっぱい、または半分などに大きくして

   **本物の `LessonNotes` をそのまま描く**(骨組みを写さない・CLAUDE.md)。
   Supabase は繋がらないので中身は空だが、**測りたいのは並びと大きさ**である。

   `?role=trainer` でトレーナーの欄が書ける形、`?role=learner` で
   ゲストの側 —— **出る / 出ないの両方**を測れる。 */
const NOTES = (
  <LessonNotes learnerId="g1" learnerName="山田はなこ" />
)

/* セッションの記録を**まとめて一本化**(`?screen=notesdigest&role=…`・
   第5.303節・2026-09-28 利用者の指定)。

     > 日付と内容を見出しをつけてまとめて出力する機能や、
     > セッションの記録内の単語やフレーズを元に教材を作れたりすると最高です

   **本物の `NotesDigest` を、本物の `noteSections()` / `noteWords()` で
   描く**(骨組みを写さない・CLAUDE.md)。`LessonNotes` は Supabase から
   読むので、この環境では**中身が1つも描かれない** —— だから並べる側だけを
   props で受け取る形に切り出してある。

   `?role=trainer` で語句の欄が出る形、`?role=learner` で出ない側 ——
   **出る / 出ないの両方**を測れる。 */
const DIGEST_ROWS = [
  {
    on_date: '2026-09-27',
    body: '"run into trouble" が出てこなかった。\n次回は言い換えから。',
    learner_body: 'make time の使い方を聞きたいです。',
  },
  {
    on_date: '2026-09-24',
    body: 'would rather を使えていない。\nHe go to school → goes',
    learner_body: '',
  },
]
const digestScreen = (trainer) => {
  const rows = DIGEST_ROWS
  return (
    <NotesDigest
      sections={noteSections(rows)}
      words={trainer ? noteWords(rows) : []}
      /* **選んでいる形も測る** —— 選ぶと「この語で教材を作る」が出る */
      picked={trainer ? ['run into trouble'] : []}
      wordsOpen={trainer}
      onWordsOpen={() => {}}
      onPick={() => {}}
      onClear={() => {}}
      onMake={trainer ? () => {} : null}
      onPrint={() => {}}
      onBack={() => {}}
    />
  )
}

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
  /* **出題の形・並べ方・繰り返す**(2026-09 実機・利用者の指定)。
     渡さなければ、その行ごと出ない —— **渡した形で測る** */
  const [form, setForm] = useState('choice')
  const [order, setOrder] = useState('')
  const [shuffle, setShuffle] = useState(true)
  const [repeat, setRepeat] = useState(false)
  const tally = stageTally(rows)
  /** ★ いま光っている札。**本物と同じ `pickIdOf()` から**(第5.414節) */
  const pick = pickIdOf(scope, group)
  return (
    <>
    <ReviewStats
      items={LEARN_STAGES.map((g) => ({ ...g, n: tally[g.id] ?? 0 }))}
      value={group}
      onPick={setGroup}
      dueId="weak"
      lead={stageLead(group)}
    />
    <ReviewScope
      /* ★ **本物と1文字も違えない**(第5.414節・段階3)。
         「何を出す」は `pick`、段階は `stage`、
         シャッフルは `shuffle` である */
      rows={rows} unit="問" pick={pick} size={size}
      narrowed={narrowedCount({ filter, stage: group })}
      onPick={(id) => { const p = pickOf(id); setGroup(p.stage); setScope(p.scope) }}
      onSize={setSize} onStart={() => {}}
      stage={group} onStage={setGroup}
      onClearAll={() => { setFilter(emptyFilter()); setGroup(null) }}
      forms={QUIZ_FORMS} form={form} onForm={setForm}
      orders={WORD_ORDERS} order={order} onOrder={setOrder}
      shuffle={shuffle} onShuffle={setShuffle}
      repeat={repeat} onRepeat={setRepeat}
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

/* **集中モードの帯に、いま見ている版が出るか**(`?screen=focusver`・第5.207節)。

   2026-09 実機・利用者の指定。集中モードは画面をまるごと覆うので、
   **フッターの版が見えない。**「直したはずのものが直っていない」の多くは
   端末に残った古い内容なので、**閉じずに確かめられる**ようにした。

   **ここで測るのは `FocusFrame` そのもの**である ——
   版は `settings` と同じかたまり(「表示」)の中に入るので、
   **`settings` を渡した形**にしないと、その道を一度も通れない
   (`FocusReader` は渡す。`QrReview` は渡さない)。
   中身は本物と同じ `.btn btn--small` の並びにしてある。 */
const FOCUSVER = (
  <FocusFrame width="w100" page="ver" onClose={() => {}}
              settings={(
                <>
                  <button type="button" className="btn btn--small">速さ</button>
                  <button type="button" className="btn btn--small">文字</button>
                </>
              )}>
    <p>集中モードの中身。</p>
  </FocusFrame>
)

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
   (**外へは1度も出ない**)。ここで見るのは、開いたときの姿である。

   **2026-09 に役目が1つになった**(利用者の指定「基礎単語360/1200も
   業種別の横に置いてください」)。段の札は冊の側(`.wb-tiers`)へ移り、
   ここは**「自分の単語帳にも入れる」だけ**になった —— だから
   段は外から受け取る。 */
const BASICPICK = (
  <section className="card">
    <BasicWordsPick tier="core" />
  </section>
)

/* 業種べつの単語帳(棚・`?screen=shelfpick`・0057・2026-09 利用者の指定)。

     > 何冊も違う単語帳を持てるようにしてほしいんです。…
     > 「自分の単語帳に追加する」みたいのを押したものだけ

   **本物の部品を描いて測る。** 選択肢が 35 冊そろっているか・
   お仕事と趣味に分かれているか・押せる大きさ・はみ出しは、
   ソースを読んでも分からない。

   Supabase が無いので `loadShelfWords()` は空を返す ——
   **外へは1度も出ない。**

   **わざと `shelves` をぜんぶ渡してある** —— 1冊だけにすると、
   プルダウンが横に伸びないので**はみ出しを見逃す。** */
const SHELFPICK = (
  <section className="card">
    {/* **語数は props で渡す**(0058)。
        `ShelfBooks` は自分では何も読まない部品なので、
        Supabase の無い骨組みでも**そのまま描ける**。

        **`Map` で渡す。本物と1文字も違えない**(2026-09 実機)——
        ここを `Object.fromEntries(...)` にしていたので、
        画面が `counts[s.id]`(オブジェクトの読み方)のままでも
        **骨組みでは正しく数が出て、検証が何も守っていなかった。**
        利用者の画面では **35 冊ぜんぶが「0 語」**だった */}
    <ShelfBooks shelves={shelfList()}
                counts={new Map(shelfList().map((s, i) => [s.id, 12 * (i % 5)]))}
                picked={q.get('picked') === 'none' ? [] : ['it']}
                onPicked={() => {}} />
  </section>
)

/* Native Flow の Unit(`?screen=nfunits`・
   2026-09 利用者の指定「UNIT毎に分けて」「指定したゲストだけに届くように」)。

   **本物の部品を描いて測る。** 6つの札が1行に収まるか・
   長い Unit 名でプルダウンがはみ出さないか・押せる大きさは、
   ソースを読んでも分からない(`ShelfBooks` と同じ話)。

   **わざと Unit をぜんぶ渡してある** —— 1つだけにすると、
   札の行が折り返さないので**はみ出しを見逃す。** */
const NFUNITS = (
  <section className="card">
    <NativeFlowUnits units={NATIVE_FLOW_UNITS}
                     picked={q.get('picked') === 'none' ? null : 4}
                     onPick={() => {}} />
  </section>
)

/* **型の冊の、中身をえらぶ欄**(2026-09)。**本物の部品を、そのまま描く。**

   型シフトの画面は廃止した(利用者の指定「型のトレーニングの UI は廃止して、
   quick response の UI にそのままコンテンツを移してください」)。
   残ったのはこの欄だけで、`FrameParts` は props で受け取るだけなので
   Supabase が要らない ——**骨組みと本物が食い違いようがない**(CLAUDE.md
   「骨組みは、本物と1文字も違えない」で何度も転んだところ)。

   **問数も本物から数える**(`frameQrCounts()`)—— 書き写すと、
   部品を足した日にここだけ古くなる */
const SHIFT = (
  <div className="app-main" style={{ padding: 16 }}>
    <section className="card">
      <h2 className="card-title">Quick Response(復習)</h2>
      <FrameParts parts={FRAME_PARTS} counts={frameQrCounts()}
                  picked={q.get('picked') === 'say' ? 'say' : FIRST_FRAME_PART}
                  onPick={() => {}}
                  /* **わざと型をぜんぶ渡す** —— 1つだけにすると、
                     長い型の名前でプルダウンがはみ出すのを見逃す */
                  groups={frameQrGroups(q.get('picked') === 'say' ? 'say' : FIRST_FRAME_PART)}
                  form={q.get('form') === 'none' ? null : 'S allows 人 to do'}
                  onForm={() => {}} />
    </section>
  </div>
)

/* **冊をえらぶ「本棚」**(`?screen=shelf`・第5.167節)。

   トップ画面を無くしたので、冊をえらぶのは**この1枚だけ**になった。
   ここが崩れると、**どの帳面をやるかを決める場所が無くなる。**

   **本物の部品を、そのまま描く**(`BookShelf` + `FrameParts`)。
   どちらも props で受け取るだけなので Supabase が要らない ——
   **骨組みと本物が食い違いようがない**(CLAUDE.md
   「骨組みは、本物と1文字も違えない」で何度も転んだところ)。

   **いちばん危ない形を、必ず1つ置く**(CLAUDE.md)。
   ・冊は**長い名前**(「自分の Quick Response 帳」)を含める
   ・件数のある冊と**無い冊**を混ぜる(`0 語` と嘘をつかないほう)
   ・**いま開いている冊の行の中**に、中の区切り(`sub`)を入れる ——
     ここが本体と 0px で接していないかを測る
   ・`?books=one` で**冊が1つだけ**(えらぶ場所そのものが出ない)  */
const SHELF = (
  <div className="app-main" style={{ padding: 16 }}>
    <section className="card">
      <h2 className="card-title">どの帳面をやりますか</h2>
      <BookShelf
        books={q.get('books') === 'one'
          ? [{ id: 'my', label: '自分の Quick Response 帳' }]
          : [
            { id: 'my', label: '自分の Quick Response 帳' },
            { id: 'nf', label: 'Native Flow' },
            { id: 'frame', label: FRAME_BOOK_LABEL },
          ]}
        book="frame"
        unit="問"
        /* **数の無い冊を混ぜる。** 全部に数があると、
           「数えられなかったら出さない」を壊しても緑のままになる */
        counts={{ my: 128, frame: 2872 }}
        sub={(
          <FrameParts parts={FRAME_PARTS} counts={frameQrCounts()}
                      picked={FIRST_FRAME_PART} onPick={() => {}}
                      groups={frameQrGroups(FIRST_FRAME_PART)}
                      form={null} onForm={() => {}} />
        )}
        onPick={() => {}} />
    </section>
  </div>
)


/* スピーチ練習(`?screen=speech`・0054・2026-09 利用者の指定)。

     > ゲストアカウントのスピーチ内から受け取ったスピーチの原稿をAIにより
     > 添削し、そしてその文の音声を作成、ゲスト側で練習できる機能です。

   **本物の部品と本物の CSS で測る。** 1文ずつのカードが縦に並ぶので、
   狭い端末で**押せる大きさを割っていないか**と
   **横にはみ出していないか**は、ソースを読んでも分からない。

   `SpeechBoard` ではなく `SpeechPractice` を描く ——
   あちらは**自分で読み込む**部品なので、Supabase の無いここでは
   **中身が1つも描かれない**(描けないものは測れない)。

   **わざと長い文と長い訳を混ぜてある** —— 短い文ばかりだと、
   折り返しをやめても**同じ高さになって緑のまま**になる
   (`?screen=radio` に長い語を混ぜてあるのと同じ理由)。 */
/* 単語帳 / Quick Response 帳の紙(`?screen=sheet`・2026-09 利用者の指定)。

     > フォーマットは、左に日本語、右に英語が来るようにしてください。
     > 教材を印刷、PDFにした時のクイックレスポンの部分と同じ仕様です

   **描いて測るしかない。** 「左が日本語・右が英語」は CSS の格子で
   決まっており、しかも `@media print` の中にしか無い。
   ソースを読んでも、その指定が本当に当たっているかは分からない。

   **わざと長い訳と長い英文を混ぜてある** —— 短いものばかりだと、
   横に並べるのをやめて縦に積んでも**同じに見えて緑のまま**になる
   (`?screen=radio` に長い語を混ぜてあるのと同じ理由)。
   **訳の無い語も1つ入れてある**(控えがまだ引けていない語は落とさない)。

   **品詞とレベルは、あえて欠けたものを混ぜてある**(2026-09)——
   ぜんぶに付いていると、**無い語にも空の札を出す形に書き換えても
   緑のまま**になる。題も **`sheetTitle()` を通す** ——
   ここで「Airi さんの単語帳 — ビジネス全般」と直に書くと、
   組み立てを壊しても骨組みだけが正しく描かれてしまう。 */
const SHEET_ROWS = [
  {
    word_norm: 'take on',
    display: 'take on',
    meaning_ja: '引き受ける',
    pos: '熟語',
    material_level: 'B1',
    // 例文(出会った文)。**訳つき**のものと、訳の無いものを混ぜてある
    seen_in: 'She agreed to take on the project after the meeting.',
    seen_in_ja: '彼女は会議のあと、その案件を引き受けることに同意した。',
  },
  {
    word_norm: 'contingency',
    display: 'contingency',
    meaning_ja: '不測の事態にそなえた予備の枠。予算や日程に、あらかじめ見込んでおくもの',
    pos: '名詞',
    material_level: 'B2',
    seen_in: 'We kept a contingency in the budget.',
  },
  // **品詞もレベルも例文も無い語。** 空の札・空の行を並べないことを、ここで測る
  { word_norm: 'gist', display: 'gist', meaning_ja: '' },
  // 品詞だけある語(レベルは分からない)。**同じ品詞が2語**あると、
  // 小見出しの下に2行まとまることまで測れる
  { word_norm: 'wrap up', display: 'wrap up', meaning_ja: '締めくくる', pos: '熟語' },
  /* **品詞の違う語を混ぜてある。** 1つの品詞しか無いと、
     **分けるのをやめても小見出しが1つ出て緑のまま**になる。
     `pos` は**日本語**で持つ —— 本物の `Wordbook` は、読み込みの
     1か所で基礎単語の短い印(`v`)を `posLabel()` で日本語にそろえてから
     渡す(**骨組みは本物と1文字も違えない**・CLAUDE.md) */
  { word_norm: 'postpone', display: 'postpone', meaning_ja: '延期する', pos: '動詞' },
]

/* **例文の有無は、本物と同じ道で切り替える**(`?ex=off`)。
   骨組みだけ別の組み立てにすると、**本物を壊しても緑のまま**になる
   (CLAUDE.md「骨組みは、本物と1文字も違えない」) */
const SheetBody = ({ example = true, frames = true }) => (
  <div className="app">
    <ReviewSheet
      title={sheetTitle({ owner: 'Airi さん', book: 'shelf', shelves: ['business'] })}
      note={sheetNote({ count: 5, unit: '語', group: '覚えかけ', narrowed: 2, date: '2026-09-12' })}
      lead="左の日本語を見て、すぐに英語で言いましょう。右が答えです。"
      sections={wordSheetSections(wordSheetPairs(SHEET_ROWS, { example }))}
      frames={frames}
    />
  </div>
)

function SheetScreen() {
  /* **印は `markPrint()` に付けてもらう**(`print.js`)。
     紙の見え方は `@media print` の `.print-target …` にしか無いので、
     **印が無いと1つも当たらない。** ここで自前に付けると、
     付け方を2通り持つことになる(CLAUDE.md) */
  useEffect(() => markPrint(document.getElementById(SHEET_ID)), [])
  return <SheetBody example={q.get('ex') !== 'off'} frames={q.get('frames') !== 'off'} />
}

const SPEECH = (
  <SpeechPractice
    speech={{
      id: 'sp1',
      voice_id: 'us-1',
      review: {
        good: '話し出しの呼びかけが自然で、聞き手のほうを向いています。',
        sentences: [
          {
            en: 'Good morning, everyone, and thank you very much for making time '
              + 'in your busy schedule to be here with us today.',
            ja: 'みなさん、おはようございます。'
              + 'お忙しいなか、本日はお時間をいただきありがとうございます。',
          },
          { en: 'I want to talk about our new plan.', ja: '新しい計画についてお話しします。' },
        ],
        notes: [{
          before: 'thank you for your time to be here',
          after: 'thank you for making time to be here',
          why: '「時間をつくる」は make time と言います。for のあとは動名詞にします。',
        }],
        phrases: [
          { en: 'make time', ja: '時間をつくる' },
          { en: 'busy schedule', ja: '立て込んだ予定' },
        ],
      },
    }}
  />
)

/* **トレーナーのスピーチの画面**(`?screen=speechboard&…`・第5.305節・
   2026-09-29 利用者の指定「測れる形に切り出しますか →はい」)。

   **`npm run test:bar` は、この画面を1度も描いていなかった** ——
   `SpeechBoard` は自分で `loadSpeeches()` を呼ぶので、Supabase の無い
   この環境では「読み込んでいます…」のままだったからである。
   描くところを `SpeechBoardView` に出したので、**本物のまま**測れる。

   ・`?done=no` … **まだ添削していない**形(原稿がそのまま出て、畳みが無い)
   ・`?role=learner` … **ゲストの側**(添削のボタンも調子の欄も出ない)
   ・`?long=1` … **長すぎる原稿**(押せないボタンと、その理由の行が出る) */
const SB_REVIEW = {
  good: '話し出しの呼びかけが自然で、聞き手のほうを向いています。',
  sentences: [
    {
      en: 'Good morning, everyone, and thank you very much for making time '
        + 'in your busy schedule to be here with us today.',
      ja: 'みなさん、おはようございます。'
        + 'お忙しいなか、本日はお時間をいただきありがとうございます。',
    },
    { en: 'I want to talk about our new plan.', ja: '新しい計画についてお話しします。' },
  ],
  notes: [{
    before: 'thank you for your time to be here',
    after: 'thank you for making time to be here',
    why: '「時間をつくる」は make time と言います。for のあとは動名詞にします。',
  }],
  phrases: [
    { en: 'make time', ja: '時間をつくる' },
    { en: 'busy schedule', ja: '立て込んだ予定' },
  ],
}
function speechBoardScreen() {
  const done = q.get('done') !== 'no'
  const trainer = q.get('role') !== 'learner'
  /* **長すぎる原稿も描く** —— 押せないボタンと、畳みの外に出した
     長すぎの知らせが、下の物と接していないかを測る */
  const draft = q.get('long')
    ? 'Good morning. '.repeat(600)
    : 'Good morning, everyone. Thank you for your time to be here.\n'
      + 'I want to talk about our new plan.'
  const rows = [
    { id: 'sp1', title: '来週の全社集会であいさつ', draft, voice_id: 'us-1',
      review: done ? SB_REVIEW : null },
    /* **題の無い下書き**も混ぜる(`speechTitleOf()` が原稿から作る) */
    { id: 'sp2', title: '', draft: 'Thanks for coming.', voice_id: 'uk-1', review: null },
  ]
  /* ★ **開いていない形も描く**(2026-09-30・第5.325節のつづき)。
       本物(`SpeechBoard`)は**添削ずみのスピーチを開くと、教材の画面を
       返してそこで終わる**(`if (asMaterial) return …`)。
       つまり**一覧と教材の画面が、同時に出ることは無い。**
       骨組みが両方を並べて描いていたので、
       **本物には無い画面**を測っていた(**骨組みは本物と1文字も違えない**)。 */
  const open = q.get('open') === 'no' ? null : rows[0]
  /* **判断は1つ**(`speechAsMaterial()`)。本物とまったく同じ書き方 */
  const asMaterial = open ? speechAsMaterial(open, { level: 'B1' }) : null
  if (asMaterial) {
    return (
      <div className="app">
        {/* 添削ずみのときは、**モノローグ教材とまったく同じ画面**。
            `SpeechBoard` が渡すのと同じものを、そのまま渡す */}
        <LessonView
          material={asMaterial}
          /* **誰の記録として残るか**(第5.178節)。本物も渡している */
          learnerId={q.get('who') || null} learnerName="山田はなこ"
          onClose={() => {}}
          extraPage={{
            label: '添削の結果',
            node: (
              <>
                <SpeechPractice speech={open} />
                <SpeechEditCard
                  open={open} mayAsk={trainer} reviewed={done}
                  bodyOpen draftOpen
                  accents={accentsWithVoices('narration')} accent="us"
                  pool={voicesOfAccent('us', 'narration')} tone="formal"
                />
              </>
            ),
          }}
        />
      </div>
    )
  }
  return (
    <div className="app">
      <SpeechBoardView
        whose="山田はなこ さん" mayAsk={trainer}
        rows={rows} openId={open?.id ?? null} open={open} reviewed={done}
        /* **畳みは開いた形でも測る** —— 閉じた箱は測れない(共通ルール) */
        bodyOpen draftOpen
        accents={accentsWithVoices('narration')} accent="us"
        pool={voicesOfAccent('us', 'narration')} tone="formal"
      >
        {/* ★ **添削が済んだスピーチは、教材の画面へ移った**(第5.323節)。
               ここに残るのは**下書きだけ**である(`SpeechBoard` と同じ判断) */}
      </SpeechBoardView>
    </div>
  )
}

/* **テストを作る**(`?screen=exam`・第5.260節 → **第5.263節で作り直した**)。

     > ゲストのページに教材や彼らの単語帳、quick response 帳があります。
     > それらのデータを基にテストを作りたいです。
     > (2026-09-26)テストは、ひとつの教材としてちゃんと作ってください。

   **本物の `ExamMaker` をそのまま描く**(骨組みを写さない・CLAUDE.md)。
   ちがうのは**えらべる教材を props で渡している**ところだけで、
   本物は過去の宿題から作った同じ形の一覧を渡す。

   **問題はこの画面に並ばない**(第5.263節)—— 押すと教材が1本できて、
   過去の宿題へ移る。だから骨組みで測れるのは**えらぶところ**だけである。

   **長い題を1つ混ぜる** —— 短い題ばかりだと、
   札が横にはみ出すのを見逃す(第5.176節で踏んだところ)。
   `?screen=exam&materials=none` で、**1本も出していない形**も測れる ——
   **「無ければ素通りする形」を作らない**(CLAUDE.md)。 */
const EXAM = (
  <ExamMaker
    learnerId="g1" learnerName="山田はなこ" level="B1" createdBy="t1"
    materials={q.get('materials') === 'none' ? [] : [
      { id: 'm1', title: 'トラブル対応' },
      { id: 'm2', title: '風力タービンの過熱トラブルに立ち会ったときの引き継ぎ' },
      { id: 'm3', title: '朝のあいさつ' },
    ]} />
)

/* 左のメニューのいちばん下(`?screen=navfoot`・2026-09 利用者の指定)。

     > サイドバーの「配色」から「教材の支度」までの項目をすべてまとめて
     > 「設定」としてサイドバーの一番下に配置してください。

   **本物(`App.jsx` の `navFooter`)と1文字も違えない。**
   包み(`.app-nav-foot`)も、並び(**設定 → 自分の欄**・第5.189節)も、
   押したときに呼ぶものも同じにする —— 骨組みが本物と食い違うと、
   **検証は何も守らない**(「セッションで使う」を `.btn-row` で包んでいて、
   CSS のバグを何日も素通りさせた・CLAUDE.md)。

   **本物のメニュー(行き先の一覧)は、ここには描けない。** あちらは
   ログインした `App` の中にあり、この骨組みは Supabase 未設定で描いている。
   だから**下の部分だけ**を、同じ形で置く(`QrCard` / `WordRadio` と同じ作法)。
   **画面が本当に呼んでいるか**は `npm run test:play` が見張る。 */
function NavFootScreen() {
  const [theme, setTheme] = useState(loadTheme)
  const [palette, setPalette] = useState(loadPalette)
  const [tips, setTips] = useState(loadTips)
  const [sound, setSound] = useState(soundOn)
  const [prepAll, setPrepAll] = useState(prepareAllOn)
  const [voiceVol, setVoiceVol] = useState(voiceLevel)
  const [bgmVol, setBgmVol] = useState(bgmLevel)
  /* **音楽を流すか / どの曲か**(第5.257節・2026-09-25 利用者の指定)。
     **渡す3つも、押したときに呼ぶものも、`App.jsx` とまったく同じ**にする
     —— 骨組みが本物と食い違うと、検証は何も守らない(CLAUDE.md)。

     曲の一覧だけは Supabase から読めないので、ここに置いてある。
     **2曲入れてある** —— **1曲だと選ぶ欄そのものが出ない**(`bgmChoices`)
     ので、欄を消しても緑のままになる(`?screen=navfoot&songs=one` で
     その1曲の形も測れる)。**長い題を1つ混ぜる**(帯からのはみ出し) */
  const [music, setMusic] = useState(bgmOn)
  const [song, setSong] = useState(loadBgmPick)
  const tracks = q.get('songs') === 'one'
    ? [{ id: 't1', title: '朝の光', path: 'a.mp3' }]
    : [
      { id: 't1', title: '朝の光', path: 'a.mp3' },
      { id: 't2', title: '雨あがりの街をゆっくり歩くときのためのピアノ', path: 'b.mp3' },
    ]
  const songs = bgmChoices(tracks)
  const songNow = bgmPickOf(tracks, song)
  const [buddyNow, setBuddyNow] = useState(BUDDY_KIND_DEFAULT)
  return (
    <div className="app-nav-foot" style={{ width: '248px' }}>
      <NavSettings
        theme={theme} onTheme={setTheme}
        palette={palette} onPalette={setPalette}
        tips={tips} onTips={setTips}
        sound={sound} onSound={setSound}
        voiceVol={voiceVol} onVoiceVol={(v) => setVoiceVol(setVoiceLevel(v))}
        bgmVol={bgmVol} onBgmVol={(v) => setBgmVol(setBgmVolume(v))}
        music={music} onMusic={(v) => {
          setMusic(v); setBgmOn(v)
          if (!v) stopBgm()
        }}
        songs={songs} song={songNow} onSong={(v) => { setSong(v); saveBgmPick(v) }}
        showPrepare
        prepare={prepAll} onPrepare={setPrepAll}
        /* ★ オフラインの音声(第5.372節)。**本物と同じ形で描く** ——
             数を渡さないと行ごと出ず、すき間を測れない */
        clipsKept={12} onClipsClear={() => {}}
        /* ★ 相棒(第5.381節)。**本物と同じ形で描く** */
        buddy={buddyNow} onBuddy={setBuddyNow}
        /* ★ 曲を入れる(第5.432節)。**渡さないと行ごと出ず、測れない** */
        onMusicRoom={() => {}}
      />
      {/* **いちばん下は自分の欄**(第5.189節・利用者の指定
          「位置を Hisato Nakajima の要素の上にしてください」) */}
      <div className="nav-account">
        <div className="nav-account-text">
          <span className="nav-account-name">Hisato Nakjaima</span>
          <div className="nav-account-row">
            <span className="badge badge--admin">トレーナー</span>
            <button type="button" className="btn btn--link">ログアウト</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* **本文から拾った かたまり**(`?screen=chunk`・第5.230節)。

   **本物のレッスン表示を、そのまま描く。**「かたまり」の演習だけを
   1つ残した教材を渡しているので、**開いた1ページ目がその演習**になる
   (本物は2ページ目にあり、送らないと測れない)。

   **写した骨組みを作らない** —— `ChunkCard` を素の `<div>` に入れて
   描くと、紙の地色も文字の大きさも本物と変わり、
   **骨組みだけ隙間が空いて緑のまま**になる(CLAUDE.md で何度も転んだ形)。 */
const CHUNK = (
  <LessonView
    material={{ ...material, sections: [material.sections[1]] }}
    learnerId={null} learnerName=""
    onLearnerChange={() => {}}
    onClose={() => {}} />
)

/* **説明の文を出すかどうかも、本物と同じ道を通す**(2026-09)。
   `App.jsx` がやっていることをここでもやらないと、
   `data-tips` が付かず、**既定で畳んであることを測れない。** */
applyTips(loadTips())

createRoot(document.getElementById('root')).render(
  q.get('screen') === 'home'
    ? homeScreen(!!q.get('one'))
    : q.get('screen') === 'qrmode'
    ? QRMODE
    : q.get('screen') === 'fill'
    ? FILL
    : q.get('screen') === 'chunk'
    ? CHUNK
    : q.get('screen') === 'shelf'
    ? SHELF
    : q.get('screen') === 'shift'
    ? SHIFT
    : q.get('screen') === 'exam'
    ? EXAM
    : q.get('screen') === 'navfoot'
    ? <NavFootScreen />
    : q.get('screen') === 'sheet'
    ? <SheetScreen />
    : q.get('screen') === 'shelfpick'
    ? SHELFPICK
    : q.get('screen') === 'nfunits'
    ? NFUNITS
    : q.get('screen') === 'speech'
    ? SPEECH
    : q.get('screen') === 'basicpick'
    ? BASICPICK
    : q.get('screen') === 'course'
    ? COURSE
    : q.get('screen') === 'gnote'
    ? GNOTE
    : q.get('screen') === 'radio'
    ? RADIO
    /* ★ `&tabs=1` … **聞き流しの最中も、下のメニューと一緒に**描く
         (第5.417節・段階4の案C-1「聞き流し中もタブバーを出す」)。
         **ここが無いと、聞き流しの画面だけ1度も測れない** ——
         `.focus.radio` を短くする決まりは CSS にあるが、
         「決まりがある」では見張ったことにならない(CLAUDE.md `test:feel`) */
    : q.get('screen') === 'qrradio'
    ? (q.get('tabs') ? 帯つき(QRRADIO) : QRRADIO)
    : q.get('screen') === 'notes'
    ? NOTES
    : q.get('screen') === 'notesdigest'
    ? digestScreen(q.get('role') !== 'learner')
    : q.get('screen') === 'speechboard'
    ? speechBoardScreen()
    : q.get('screen') === 'sticky'
    ? STICKY
    : q.get('screen') === 'rscope'
    ? RSCOPE
    : q.get('screen') === 'jobbar'
    ? JOBBAR
    : q.get('screen') === 'qr'
    ? qrScreen(false)
    : q.get('screen') === 'qrrev'
    /* ★ `&tabs=1` … **下のメニューと一緒に**描く(第5.405節)。
         本物の `App.jsx` も、画面と帯を並べて描いている */
    ? (q.get('tabs') ? 帯つき(qrScreen(true)) : qrScreen(true))
    : q.get('screen') === 'focusver'
    ? FOCUSVER
    : q.get('screen') === 'qrreal'
    ? QRREAL
    : q.get('screen') === 'qrdone'
    ? QRDONE
    : q.get('screen') === 'tabs'
    ? TABS
    : q.get('screen') === 'search'
    ? SEARCH
    : q.get('screen') === 'mybook'
    ? (q.get('tabs') ? 帯つき(MYBOOK) : MYBOOK)
    : q.get('screen') === 'wordbook'
    ? WORDBOOK
    : q.get('screen') === 'remake'
    ? REMAKE
    : q.get('screen') === 'form'
      ? FORM
      : q.get('screen') === 'result'
        ? RESULT
        : q.get('screen') === 'assign'
      ? <AssignScreen />
    : q.get('screen') === 'pick'
      ? <PickScreen />
    : q.get('screen') === 'steps'
      ? <StepsScreen />
    : q.get('screen') === 'owner'
      ? (
        <OwnerScreen
          fixed={q.get('owner') === 'fixed'}
          people={q.get('owner') === 'empty' ? [] : [
            { id: 'g1', display_name: '山田はなこ' },
            /* **長い名前を1つ混ぜる**(第5.176節で踏んだところ) */
            { id: 'g2', display_name: '西大路おさむ(製造・品質保証)' },
            { id: 'g3', display_name: '佐藤' },
          ]} />
      )
    : q.get('screen') === 'tools'
          ? <ToolsScreen />
          : (
            <LessonView
              material={material} learnerId={q.get('who') || null}
              /* **いま誰の記録として残るか**(第5.178節)。
                 **いちばん長い名前を入れてある** —— 短い名前だと、
                 帯からはみ出すのを見逃す(第5.176節で踏んだところ) */
              learnerName={q.get('who') ? '山田はなこ' : ''}
              /* **教材の画面から開いたときだけ切り替えられる。**
                 ゲストのページから開いたときは名札だけ(本物と同じ) */
              onLearnerChange={q.get('who') ? null : () => {}}
              onClose={() => {}} />
          ),
)
