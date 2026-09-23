/**
 * 教材を新しく作る画面。
 *
 * 【教材の形】(仕様書 第5.13節 / 実物のドリルに合わせた)
 *   教材 = 1つの文法ポイント
 *     └ 演習(和訳・穴埋め・英訳・リスニング…)
 *          └ 設問
 *
 * 【設計の要件】(仕様書 第5.5節)
 *   発行時に弱点タグを必須にする。タグの付いていない教材は
 *   二度と見つからず、資産にならない。
 *
 * 手入力は「AI 生成がまだ無い間のつなぎ」と「AI の下書きを直す土台」。
 * 1教材40問を毎回ここで打つことは想定していない。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { CEFR_LEVELS, cefrOption } from '../data/cefr.js'
import {
  EXERCISE_TYPES, FIELD_LABELS, MAX_ITEMS, SCALABLE_SECTIONS, amountsFor,
  defaultSectionsFor, exerciseLabel, exerciseType, grammarSource, isIncluded,
  isPassageSection, sectionLabel, sectionsFor,
} from '../data/exerciseTypes.js'
/* 文法解説を作るか(第5.213節)。**金額の見積もりも `grammarNote.js` 1か所** */
import { grammarGuessYen } from '../lib/grammarNote.js'
import { groupOf, industriesIn, industryLabel, kindsOf, parentOf } from '../data/industries.js'
import {
  cancelJob, clearJob, currentJob, startJob, takeJobResult, watchJob,
} from '../lib/generateJob.js'
import { weaknessTagLabel, weaknessTags } from '../data/weaknessTags.js'
/* **Speech練習**(2026-09 利用者の指定)。貼った原稿の切り方と、
   窓口へ渡す「スピーチとして書く」指定は、**素の node で確かめられる形**
   に切り出してある(`playMark.js` / `gamify.js` と同じ考え方) */
import { MAX_PARTS, pastedParagraphs, speechBrief } from '../lib/speechDraft.js'
import {
  scenesForStyle, speechStyleOf, stylesForScene,
} from '../data/speechStyles.js'
import {
  NEW_MATERIAL_KINDS, assignMaterial, countMaterialsLike, createMaterial, estimateCost,
  fillGrammar, generateChunkJa, generateSection,
  bodyWord, canPasteBody, freeFromSubject, generateSectionUnique,
  isDialogueKind, isPassageKind, isVocabKind,
  isDrillKind,
  kindLabel, usesScene,
  subjectLabel, subjectHint, subjectExample,
  loadRecentStories, loadUsedSentences, loadUsedSentencesLike, normEn,
  genGatewayNote,
} from '../lib/materials.js'
/* **話の切り口**(0046・2026-09 利用者の指定
     「選んだシチュエーションや場面が同じでも、全然違う感じになって欲しい」)。
   一覧も、窓口へ渡す文の組み立ても**画面が持つ**(`speechBrief` と同じ考え方)。
   窓口の中に置くと、切り口を1つ足すたびに置き直してもらうことになる */
import {
  angleBrief, angleWithSubject, anglesFor, pickAngle,
} from '../data/materialAngles.js'
import { chunkPlan } from '../lib/chunkJa.js'
import {
  genreHint, genreLabel, genresFor, sceneHint, sceneLabel, scenesFor,
  speechScenesFor,
} from '../data/genres.js'
import {
  CLIP_ACCENTS, DEFAULT_ACCENT, DEFAULT_READ_STYLE, MIN_MEETING_SPEAKERS,
  READ_STYLES, findVoice, pickVoices, readStyleHint, speakerCountsFor, styledVoiceId,
  voiceCountFor, voicePurposeFor, voicesOfAccent,
} from '../data/clipVoices.js'
/* **出来上がった名前に、声の並びを合わせる**(2026-09 利用者の指摘
     「男の役に女性の声、女性の役に男の声がアサインされることがほとんど」)。
   窓口へ性別を渡してはいたが、**そのあと一度も確かめていなかった。**
   算段は `voiceOrder.js` 1か所(素の node で確かめられる形にしてある) */
import { orderVoicesByNames } from '../lib/voiceOrder.js'
import { collectReviewWords, loadMyWordbook, normWord } from '../lib/vocab.js'
/* **文型ドリルで使う語を、単語帳から絞って指定する**(2026-09 利用者の指定)。
     > 文型トレーニングに、どの単語帳からどのレベルのどの品詞を使用するか、
     > を指定できるようにしたい。
   算段は `drillWords.js` 1か所(**素の node で確かめられる形**にしてある)。
   渡し先は**すでにある `mustUse`** なので、
   **SQL も、窓口の置き直しも要らない。** AI も1回も呼ばない(0円) */
import {
  BASIC_TIERS, DRILL_COUNTS, booksFor, narrowRows, optionsOf, pickWords, spreadWords,
} from '../lib/drillWords.js'
import { levelOf, posOf } from '../lib/wordbookFilter.js'
import { loadShelfWordbook } from '../lib/shelfReviews.js'
import { basicRows } from '../lib/basicsCourse.js'
import { shelfLabel, shelfList, shelfOf } from '../data/shelves.js'
import { startPrepare } from '../lib/prepareJob.js'

/** 弱点を混ぜられる上限。4つ以上は、1つあたりの問数が足りなくなる */
const MAX_TAGS = 3

/**
 * 弱点ごとの問題を交互に並べる。
 *
 * 弱点ごとにまとめて並べると、その塊の間は1つの弱点だけに注意すればよく、
 * 「意識が分散しても弱点に注意を保つ」練習にならない(利用者の狙い)。
 */
const interleave = (lists) => {
  const out = []
  const longest = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) if (list[i]) out.push(list[i])
  }
  return out
}

/** 今日の日付。教材名を自動で付けるのに使う。 */
const todayLabel = () => new Date().toISOString().slice(0, 10)

/**
 * **話し手の欄**(2026-09 利用者の指定)。
 *
 *   > その際に「会社名」「自分の名前」「役職」「部署名」なども任意で
 *   > 指定すればそれに沿って Speech(モノローグ)を作成してくれる機能です
 *
 * **どれも任意。** 1つも入れなくてもスピーチは作れる。
 * 並びは「自分 → 所属 → 立場」。名乗るときの順そのものにしてある。
 */
const SPEAKER_FIELDS = [
  { id: 'name',    label: '自分の名前', hint: '例: Taro Yamada' },
  { id: 'company', label: '会社名',     hint: '例: ABC Corporation' },
  { id: 'dept',    label: '部署名',     hint: '例: Sales Division' },
  { id: 'role',    label: '役職',       hint: '例: Head of Sales' },
]

/** 貼る欄の見本。**空行で段落が分かれる**ことを、見本そのもので示す */
const SCRIPT_HINT = `Good morning, everyone. Thank you for making time today.

I want to talk about one thing: how we shorten our delivery time.

Last quarter we shipped in twelve days on average. Our goal is eight.`

const newSection = (typeId = 'translate_en_ja') => ({
  exercise_type: typeId,
  instruction: exerciseType(typeId)?.instruction ?? '',
  items: [{}, {}, {}],
})

export default function MaterialForm({
  createdBy, learners = [], initial = {}, onCreated, onCancel,
}) {
  // さがす画面で選んだ条件を、そのまま引き継ぐ。
  // 引き継がないと、探して見つからなかったときに同じ指定をもう一度
  // 入れ直すことになる。実際に「先に選んだはずの弱点が選ばれていない」と
  // なってやり直しになった(2026-08)。
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState(initial.level || 'B1')
  // **種類も引き継ぐ。** さがす画面で「ダイアローグ」を選んで作成に移ったのに
  // 「文型トレーニング」に戻っていた(2026-08 の指摘)。
  // 引き継ぐのは、さがす画面にある指定すべて(弱点・レベル・業界・種類・
  // ジャンル・場面)。一部だけ引き継ぐと、どれが残ってどれが消えるのか
  // 利用者には見分けられない。
  const [kind, setKind] = useState(initial.kind || 'pattern')
  /**
   * 内容理解・語句を**どれだけ作るか**(2026-09 利用者の指定)。
   *
   *   > 内容理解の質問を増やしたいとき、語句を増やしたいときは
   *   > 教材作成のところで指定できるようにしてください。
   *   > ディフォルトの数またはその倍という感じの2パターン
   *
   * `{ comprehension: 'default' | 'double', vocab_note: … }`。
   * **本文(記事・会話)は増やさない。** あちらの数は段落・発言の数で、
   * 読み物の長さそのものが変わってしまう(`SCALABLE_SECTIONS`)。
   */
  /* さがす画面で「1つの演習の問数」を選んでいたら、その指定で始める
     (2026-09。**絞り込みの項目を足したら `initial` にも足す**・CLAUDE.md) */
  const [amounts, setAmounts] = useState(initial.amounts ?? {})
  /**
   * **その演習を入れるか**(2026-09 利用者の指定)。
   *
   *   > どの問題が何問必要なのかを都度選択できる設計にしてください。
   *   > 今は数だけ変更できる問題を、チェックによって入れるか入れないかも
   *   > 決めれるように。
   *
   * **外したものだけを持つ**(`{ listening: false }`)。既定は入れる。
   * 空のオブジェクトが「全部入れる」を意味するので、
   * 演習の種類を足しても、ここを触らずに済む。
   *
   * 外せるのは `SCALABLE_SECTIONS` だけ。**本文(記事・会話)は外せない。**
   * 内容の理解・ディスカッション・語句は本文から作るので、
   * 本文が無くなると、そもそも何も作れない。
   */
  const [include, setInclude] = useState(initial.include ?? {})
  const [instruction, setInstruction] = useState('')
  const [teachingPoint, setTeachingPoint] = useState('')
  const [visibility, setVisibility] = useState('school')
  const [industry, setIndustry] = useState(initial.industry || '')
  const [sections, setSections] = useState([newSection()])
  const [tagIds, setTagIds] = useState(initial.tagIds ?? [])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(null)   // 生成中の進み具合
  const [elapsed, setElapsed] = useState(0)            // 生成に掛かっている秒数
  const [showEditor, setShowEditor] = useState(false)  // 手で直す欄を出すか
  const [dropped, setDropped] = useState(0)            // 重複で外した数
  const [short, setShort] = useState(0)                // 作り直しても足りなかった数
  // 誰に出すか。**画面のいちばん上で、最初から選べる。**
  // 以前は全部指定し終えてからでないと選べず、やりにくかった(2026-08)。
  // ゲストの詳細から作るときは、**その1人が最初から選ばれている**
  // (他のゲストは候補にも出ない。画面共有で名前が見えないようにするため)
  const [shareWith, setShareWith] = useState(initial.shareWith ?? [])
  const [showDetails, setShowDetails] = useState(false)  // 記入欄を開くか
  // できあがったことを、押したボタンのすぐ下で知らせる。
  // 以前は「中身を見て直す」を押すまで、できたかどうか分からなかった
  // (2026-08 の指摘)。ボタンが元に戻るだけでは、失敗と区別がつかない。
  const [done, setDone] = useState(null)
  const [similarNotes, setSimilarNotes] = useState([]) // 意味が近すぎて外した文
  const [warning, setWarning] = useState(null)         // 効いていない仕組みの知らせ
  const errorRef = useRef(null)                        // 失敗の知らせまで画面を送る
  const tagRef = useRef(null)                          // 弱点タグの欄
  const doneRef = useRef(null)                         // できあがりの知らせ
  const submitRef = useRef(null)                       // 発行ボタン
  const [headline, setHeadline] = useState('')         // 記事の見出し / 会話の題名
  // 見出しの訳(0036・2026-09 利用者の指定「1番上のタイトルに小さな訳を」)。
  // **作るときに1回だけ控える。** 開くたびに訳させると課金が続く
  const [headlineJa, setHeadlineJa] = useState('')
  const [genre, setGenre] = useState(initial.genre || 'news')   // 記事のジャンル
  const [scene, setScene] = useState(initial.scene || 'casual')  // 会話の場面
  // 読み上げに使う声(0017)。
  //   ① 訛りを選ぶ(国籍で絞る)
  //   ② そのままなら**おまかせ**。人を指名したいときだけ選ぶ
  // 会話は2人、それ以外は1人。**選べる声は教材の種類で絞られる**
  // (会話なら会話向き、記事やドリルならナレーション向き)。
  // 単語帳から渡された「必ず使う語」(2026-08)。
  // **復習が宿題に化ける。** 単語帳で「知らなかった」と付いた語から
  // そのまま教材を作れる。消せるようにしておく(全部使う必要はない)
  const [mustUse, setMustUse] = useState(() => (initial.mustUse ?? []).slice(0, 20))
  const [accent, setAccent] = useState(initial.accent || DEFAULT_ACCENT)
  /*
   * **会話に出す人数**(2026-09 利用者の要望「会議というジャンルを作りたい」)。
   * 2人なら1対1の会話、3〜4人なら会議・打ち合わせになる。
   * **教材に人数の列は足さない。** `materials.voice_ids` の長さが
   * そのまま人数なので、表も列も増やさずに済む。
   */
  const [speakers, setSpeakers] = useState(initial.speakers ?? 2)
  // 指名した声。空文字のところは「おまかせ」
  const [picked, setPicked] = useState([])
  /* **読み方**(第5.196節・2026-09 利用者の指定「訛りと感情どちらを重視するか
     都度指定させてください」)。既定はこれまでどおり「訛りを活かす」。
     選んだ側は、保存する声の id の後ろに付いて回る(`styledVoiceId`) */
  const [readStyle, setReadStyle] = useState(initial.readStyle || DEFAULT_READ_STYLE)
  const [subject, setSubject] = useState('')           // 話題の指定(任意)
  /**
   * **文法解説も一緒に作るか**(第5.213節・2026-09 利用者の指定)。
   *
   *   > 文法解説をつけるかつけないかを教材を作る時に指定できると最高です
   *
   * **既定は「作る」。** いままで必ず作っていたので、
   * ここを既定で外すと**黙って機能が減る**(CLAUDE.md「既定を下げない」)。
   * 要らないときだけ外す。外せば**そのぶん課金されない。**
   */
  const [withGrammar, setWithGrammar] = useState(true)
  /* **話の切り口**(0046・2026-09 利用者の指定)。
     空なら「おまかせ」=**まだ使っていない切り口から1枚引く。**
     同じ場面でも、切り口が違えばまったく別の話になる */
  const [angle, setAngle] = useState(initial.angle ?? '')
  /* **実際に使った切り口と、何の話だったか。**
     入力の `angle`(おまかせのまま)とは別に持つ。
     ここへ入れてしまうと、「作り直す」を押したときに
     **同じ切り口に固定されてしまう**(おまかせが効かなくなる) */
  const [usedAngle, setUsedAngle] = useState('')
  const [gist, setGist] = useState('')
  /* **同じ組み合わせの教材が、もう何本あるか**(0046)。
     **そもそも新しく作らないのが、いちばん被らない。**
     数えられなかったら `null`(0 と取り違えると嘘の説明になる) */
  const [likeCount, setLikeCount] = useState(null)
  /* **Speech練習**(2026-09 利用者の指定)。
       > 内容は、自分で手入力が基本
     貼ってあれば、**本文は AI に作らせない**(そのぶん課金されない) */
  const [script, setScript] = useState(initial.script ?? '')
  /* 話し手(任意)。
       > その際に「会社名」「自分の名前」「役職」「部署名」なども任意で
       > 指定すればそれに沿って Speech(モノローグ)を作成してくれる機能です
     **入れなくても作れる。** 入れたぶんだけ、原稿がその人のものになる */
  /* **話し方の型**(2026-09 利用者の指定)。**保存しない** ——
     原稿の書き方に効くだけで、出来上がった本文は教材に残る */
  const [style, setStyle] = useState(initial.style ?? '')
  const [who, setWho] = useState(initial.who ?? {
    name: '', company: '', dept: '', role: '',
  })
  // ── 復習の材料(単語・フレーズの教材だけで使う)──────────────
  //   これまでの宿題に出た語のうち、ゲストが「知らなかった」と付けたものを
  //   混ぜる。**毎回まったく新しい語を出していては、定着しない**(第5.23節)。
  const [reviewPool, setReviewPool] = useState([])     // 混ぜられる語
  const [reviewCount, setReviewCount] = useState(0)    // そのうち何語混ぜるか
  const [reviewBusy, setReviewBusy] = useState(false)
  // **読めなかったことを「0語」と同じ見た目にしない。**
  // 0011 をまだ流していないときに「まだありません」と出ると、
  // 何が足りないのか分からなくなる(この失敗を何度もした)
  const [reviewError, setReviewError] = useState(null)

  /* ── 文型ドリルで使う語を、単語帳から絞って選ぶ(2026-09 利用者の指定)──
       > 文型トレーニングに、どの単語帳からどのレベルのどの品詞を使用するか、
       > を指定できるようにしたい。

     **入れ物も窓口も1つも増えていない。** 選んだ語は、そのまま
     **すでにある `mustUse`** に足される(窓口へは `reviewWords` として
     渡り、「それぞれ1回以上、問題文の中で使うこと」と伝わる)。
     だから **SQL も、窓口の置き直しも要らない。AI も1回も呼ばない。** */
  const [wordBook, setWordBook] = useState('basic')   // どの単語帳から
  const [wordShelf, setWordShelf] = useState('')      // 業種べつのとき、どの棚
  const [wordTier, setWordTier] = useState('core')    // 基礎単語のとき、どの段
  const [wordLevel, setWordLevel] = useState('')      // レベル(空=すべて)
  const [wordPos, setWordPos] = useState('')          // 品詞(空=すべて)
  const [wordCount, setWordCount] = useState(10)      // 何語足すか
  const [wordRows, setWordRows] = useState([])        // 引けた語
  const [wordBusy, setWordBusy] = useState(false)
  const [wordError, setWordError] = useState(null)
  const [wordNote, setWordNote] = useState('')        // 押した結果(その場に出す)

  /**
   * **「細かい指定」に書いたら、それが主になる**(第5.228節 → 第5.232節)。
   *
   * はじめはモノローグの場面だけだった(第5.228節)。
   * **同じ困り方が、会話・会議・記事でも起きていた**(第5.232節)。
   *
   *   > 唐揚げの加工工場の話だと指定したら、「悪い知らせをする」という
   *   > 切り口が強制的に選ばれ、そのような話になってしまいました
   *
   * **判断は `materialKinds.js` の `freeFromSubject()` 1か所。**
   * ここで `kind === 'speech' && …` と書かない(CLAUDE.md)。
   * **既定は「選ぶ」側** —— 細かい指定が空なら、これまでどおりである。
   */
  const subjectLeads = freeFromSubject(kind, subject)

  /* **細かい指定が空になったら、場面と話題を選び直す**(第5.228節 / 第5.232節)。
     どちらも空のままだと、**何の指定も無いまま**作ることになる。
     **黙って落とさない** —— 先頭に戻して、選んでいる状態にする */
  useEffect(() => {
    if (subjectLeads) return
    if (scene === '') {
      const list = kind === 'speech' ? speechScenesFor(industry) : scenesFor(industry)
      setScene(list[0]?.id ?? '')
    }
    if (genre === '') setGenre(genresFor(industry)[0]?.id ?? '')
  }, [subjectLeads, scene, genre, kind, industry])

  /* **分野を変えたら、場面もその分野のものに入れ替える**(2026-08 利用者の指定)。
     入れ替えないと、外科医の教材に「打ち合わせ前の雑談」が残る。
     いまの場面がその分野にもあれば、そのままにする */
  useEffect(() => {
    // **スピーチは別の一覧を持つ**(会話の場面を出すと噛み合わない)。
    // 種類を変えたときも入れ替えるので、`kind` も見る
    const list = kind === 'speech' ? speechScenesFor(industry) : scenesFor(industry)
    /* **「選ばない」を選んでいるなら、そのままにする**(第5.228節)。
       ここで書き戻すと、分野を変えただけで場面が復活する */
    if (!(scene === '' && subjectLeads) && !list.some((x) => x.id === scene)) {
      setScene(list[0]?.id ?? '')
    }
    const gl = genresFor(industry)
    /* **話題の側にも同じ守りが要る**(第5.232節)。
       ここで書き戻すと、分野を変えただけで話題が復活する */
    if (!(genre === '' && subjectLeads) && !gl.some((x) => x.id === genre)) {
      setGenre(gl[0]?.id ?? '')
    }
    // scene / genre を依存に入れると、選んだそばから書き換わってしまう
  }, [industry, kind])

  // 生成中は秒数を数える。1〜3分かかることがあるため、動いていることが
  // 分からないと「固まった」と思われる(実際にそう見えた)。
  //
  // **始めた時刻は仕事のほうが持っている**(`generateJob.js`)。
  // 別の画面から戻ってきたときも、押した時からの秒数が出る
  const startedAt = generating?.startedAt ?? null
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return undefined }
    const tick = () => setElapsed(Math.round((Date.now() - startedAt) / 1000))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  // 単語・フレーズの教材で、ゲストを1人だけ選んでいるときに材料を読む。
  // **複数人だと「誰の復習か」が決まらない**ので、そのときは出さない。
  // 声のこと。**教材の種類で、要る人数と選べる向きが決まる**
  const voicePurpose = voicePurposeFor(kind)
  const voiceCount = voiceCountFor(kind, speakers)
  const voicePool = voicesOfAccent(accent, voicePurpose)

  /**
   * 保存する声の並び。
   * 指名されていないところは、その場で**おまかせ**で埋める。
   * 声を1人も登録していないときは空のまま(標準の声で読み上げる)。
   *
   * **1回だけ決めて、作るときも保存するときも同じものを使う**
   * (2026-09 利用者の指摘「音声が女性なのに会話の中では男性役」)。
   *
   *   以前は呼ぶたびに `pickVoices()` を回していた。あれは**毎回混ぜる**ので、
   *   ①作るときに使った並びと ②保存した並びが**別物になりえた。**
   *   窓口へ性別を伝えても、保存された声がそれと違えば意味がない。
   *
   * 訛り・人数・指名が変わったときだけ選び直す(`useMemo`)。
   */
  const cast = useMemo(() => {
    if (!voicePool.length) return []
    const chosen = []
    for (let i = 0; i < voiceCount; i += 1) {
      const want = picked[i]
      if (want && voicePool.some((v) => v.id === want) && !chosen.includes(want)) {
        chosen.push(want)
      }
    }
    if (chosen.length >= voiceCount) return chosen
    // 足りないぶんをおまかせで足す。**すでに指名した人とは重ねない**
    for (const id of pickVoices(accent, voiceCount * 2, voicePurpose)) {
      if (chosen.length >= voiceCount) break
      if (!chosen.includes(id)) chosen.push(id)
    }
    return chosen
    /* **`voicePool` を見張りに入れない。** あれは `filter` の返り値なので
       **描き直すたびに別の配列**になり、そのたびにおまかせを引き直す
       (= 保存する声が毎回変わる)。中身は `accent` と `voicePurpose` で
       決まっているので、その2つを見ていれば足りる。
       「見張りに、自分が書き換えるものを入れない」と同じ落とし穴である */
  }, [accent, voiceCount, voicePurpose, picked])

  /**
   * 窓口へ渡す「話す人の性別」。**声の並びと同じ順**である。
   *
   * `castClipSpeakers()` は**最初に話す人から順に**声を当てるので、
   * ここで「1人目は男性、2人目は女性」と決めておけば、
   * **名前のほうが声に合う。**
   * 逆(名前から性別を読んで声を当て直す)はしない —
   * 名前で性別は当てられないし、指名した声が無視されることになる。
   */
  /* **並びを崩さない**(2026-09)。以前は `filter` で落としていたので、
     名簿に無い声が1つ混じるだけで**配列が縮み、2人目以降がずれた**
     (声の2人目に、3人目の性別が渡る)。
     長さは声の数のまま保ち、分からないものは空にする —— 窓口は
     「人数ぶん揃っているとき」だけ使うので、**ずれた指定は渡らない。** */
  const castGenders = () => cast.map((id) => findVoice(id)?.gender ?? '')

  const reviewLearner = isVocabKind(kind) && shareWith.length === 1
    ? shareWith[0] : null

  useEffect(() => {
    if (!reviewLearner) { setReviewPool([]); setReviewCount(0); return }
    let alive = true
    setReviewBusy(true)
    collectReviewWords(reviewLearner, { limit: 20 }).then(({ data, error: e }) => {
      if (!alive) return
      setReviewBusy(false)
      setReviewError(e ?? null)
      // **名指しで渡された語は、ここに二重に出さない。**
      // 同じ語が2つの欄に並ぶと、2回入るように見える(実際は1回)
      const named = new Set(mustUse.map(normWord))
      const pool = (data ?? []).filter((w) => !named.has(normWord(w.word)))
      setReviewPool(pool)
      // 既定は半分。全部を復習にすると新しい語が入らず、逆に0だと復習にならない
      setReviewCount(Math.min(pool.length, 10))
    })
    return () => { alive = false }
  }, [reviewLearner])

  /* ── 文型ドリルで使う語を引く(2026-09 利用者の指定)────────────

     **問い合わせは、冊を選んだときだけ。** 基礎単語はファイルなので
     **問い合わせ0回・0円**である。棚とゲストの単語帳は読むだけで、
     **窓口(AI・ElevenLabs)は1回も呼ばない。**

     **出せる冊だけを出す**(`booksFor`)。ゲストの単語帳は
     「**誰の**単語帳か」が決まらないと引けないので、
     ゲストを1人だけ選んでいるときにしか出さない
     (「これまでの宿題から復習する」とまったく同じ決まり)。 */
  const drillOn = isDrillKind(kind)
  const wordLearner = shareWith.length === 1 ? shareWith[0] : null
  const wordBooks = booksFor({ hasLearner: !!wordLearner })
  /** 選べなくなった冊は、黙って基礎単語へ落とす(**行き止まりを作らない**) */
  const book = wordBooks.some((b) => b.id === wordBook) ? wordBook : 'basic'
  /* **棚の既定は、この教材の業界。** トレーナーはもう業界を選んでいるので、
     そのぶんの語が出るのがいちばん素直である(選び直すこともできる) */
  const shelfId = wordShelf || shelfOf(industry) || shelfList()[0]?.id || ''

  useEffect(() => {
    if (!drillOn) { setWordRows([]); return undefined }
    let alive = true
    setWordBusy(true); setWordError(null)
    const read = () => {
      if (book === 'basic') {
        /* **ファイルから。問い合わせ0回。** 覚え具合は要らない ——
           ここで欲しいのは「どんな語があるか」だけである */
        return Promise.resolve({ data: basicRows(wordTier, [], {}), error: null })
      }
      if (book === 'shelf') {
        return loadShelfWordbook({ learnerId: null, shelves: shelfId ? [shelfId] : [] })
      }
      /* **`status` を渡さない**(`null` = ぜんぶ)。「まだ」だけに絞ると、
         その人がもう覚えた語で文型を練習できなくなる */
      return loadMyWordbook({ status: null, learnerId: wordLearner })
    }
    Promise.resolve(read()).then(({ data, error: e }) => {
      if (!alive) return
      setWordBusy(false)
      setWordError(e ?? null)
      setWordRows(data ?? [])
    }, () => {
      if (!alive) return
      setWordBusy(false); setWordError('単語帳を読めませんでした'); setWordRows([])
    })
    return () => { alive = false }
  }, [drillOn, book, shelfId, wordTier, wordLearner])

  /* **選択肢は、引けた語から作る**(`optionsOf`)。固定の一覧を持たない ——
     基礎単語はレベルを持たないので、レベルの欄がそもそも出ない */
  const wordLevels = useMemo(() => optionsOf(wordRows, levelOf), [wordRows])
  const wordPoss = useMemo(() => optionsOf(wordRows, posOf), [wordRows])
  /** **選べなくなった値は、黙って「すべて」に落とす**(行き止まりを作らない) */
  const lv = wordLevels.some((o) => o.key === wordLevel) ? wordLevel : ''
  const ps = wordPoss.some((o) => o.key === wordPos) ? wordPos : ''
  /** その条件に当てはまる語の数。**押す前に出す** */
  const wordHit = useMemo(
    () => narrowRows(wordRows, { level: lv || null, pos: ps || null }).length,
    [wordRows, lv, ps],
  )

  /**
   * 選んだ語を、上の一覧(`mustUse`)に**足す**。
   *
   * **入れ替えない。** 単語帳の画面から名指しで渡された語が先に入って
   * いることがあるので、消してしまうとトレーナーの選択が消える。
   * 重なった語は落とすので、**何度押しても安全**である。
   */
  const addDrillWords = () => {
    const picked = pickWords(wordRows, {
      level: lv || null, pos: ps || null, count: wordCount,
    })
    const have = new Set(mustUse.map(normWord))
    const add = picked.filter((w) => !have.has(normWord(w)))
    if (!add.length) {
      setWordNote(picked.length
        ? '選んだ語は、すべてもう上の一覧に入っています。'
        : 'この条件に当てはまる語がありません。')
      return
    }
    setMustUse([...mustUse, ...add])
    setWordNote(`${add.length} 語を上の一覧に足しました。`)
  }

  /* **同じ組み合わせの教材が、もう何本あるか**(0046・2026-09 利用者の指定)。

     **そもそも新しく作らないのが、いちばん被らない。**
     この仕組みは教材ライブラリの再利用が前提なので(CLAUDE.md)、
     「もう7本あります」と分かれば、別の場面を選ぶことも、
     すでにある教材を使い回すこともできる。

     **数えるだけ。表も列も増やさない。**
     数えられなかったら `null` のまま出さない(0 と取り違えると
     「まだ1本もありません」という嘘の説明になる)。 */
  useEffect(() => {
    if (!isPassageKind(kind)) { setLikeCount(null); return undefined }
    let alive = true
    countMaterialsLike(likeQuery()).then(({ data }) => {
      if (alive) setLikeCount(data)
    })
    return () => { alive = false }
    // **見張るのは、絞り込みに使う4つだけ。**(`likeQuery` は毎回作り直される
    // 関数なので、見張りに入れると数え直しが止まらなくなる)
  }, [kind, industry, genre, scene])

  const patchSection = (si, patch) =>
    setSections(sections.map((sec, i) => (i === si ? { ...sec, ...patch } : sec)))

  const patchItem = (si, ii, field, value) =>
    patchSection(si, {
      items: sections[si].items.map((it, j) => (j === ii ? { ...it, [field]: value } : it)),
    })

  const changeType = (si, typeId) =>
    patchSection(si, {
      exercise_type: typeId,
      instruction: exerciseType(typeId)?.instruction ?? '',
    })

  const totalItems = sections.reduce(
    (n, sec) => n + sec.items.filter((it) => Object.values(it).some((v) => String(v ?? '').trim())).length,
    0,
  )

  /**
   * AI に下書きを作らせる。
   *
   * 選んだ弱点タグとレベル・業界をそのまま渡す。トレーナーが打つのは
   * この2つだけで、40問は AI が作る(仕様書 第5.13.5節)。
   * **生成した内容は保存しない。** 発行を押すまでは下書きのままである。
   */
  /**
   * **生成の窓口には、業界の「日本語の名前」を渡す。**
   *
   * これまでは id(`it` `hospitality` …)をそのまま渡しており、
   * 窓口の指示文には `it の場面に寄せること` と入っていた。
   * **AI には何のことか伝わらない。**
   * 趣味を足して(2026-08)`listening` `watching` のような語が増えると、
   * 「聞き取りの場面」「見る場面」と読まれかねない。
   *
   * データベースに入れるのは**これまでどおり id**(`materials.industry`)。
   * 変えるのは、AI に渡す文言だけである。
   */
  const industryText = industry ? industryLabel(industry) : ''

  /* **選ぶ欄は2つ、入れ物は1つ**(2026-08 利用者の指定)。
     いま選んでいるものが「仕事」か「趣味」かは、ここで1回だけ決める。
     画面の2か所で別々に判断すると、必ず食い違う */
  const isHobby = groupOf(industry) === 'hobby'
  const isWork = Boolean(industry) && !isHobby

  /* **種類のある分野は、2段で選ぶ**(2026-09 利用者の指定)。
       > 同じ業種内に種類がある場合はさらにメニューが展開して
       > 選べるようにしてください。
     1つめの欄では**親**を選んだことにする(種類を選んでも親は選ばれたまま)。
     種類が無い分野では、2つめの欄そのものを出さない */
  const topIndustry = industry ? parentOf(industry) : ''
  const industryKinds = kindsOf(topIndustry)

  /* **場面は、選んだ分野で変わる**(2026-08 利用者の指定)。
       > 外科医を選んだら、手術前の説明、とか、手術方法についての話し合い、
       > とか、業界に特化した選択肢が出るようにしてください。
     登録の無い分野では「仕事全般」の場面に落ちる(`scenesFor`)。 */
  /* **スピーチの場面は、会話の場面とは別の一覧**(2026-09 利用者の指定
     「場面などはあなたが考えて実装して下さい」)。
     会話の場面は「相手がいて、やりとりが続く」ものなので、
     1人が話しきるスピーチには当てはまらない(`speechScenesFor`) */
  /* **貼った原稿の段落。** 何段落になるかを、貼った時点で出すために持つ。
     `useMemo` にしてあるのは、描き直すたびに切り直さないため
     (切り方そのものは `pastedParagraphs()` の中・素の node で確かめてある) */
  const scriptParts = useMemo(
    () => (canPasteBody(kind) ? pastedParagraphs(script) : []),
    [kind, script],
  )

  /* **場面と型は、互いに絞り込む**(2026-09 実機・利用者の指摘)。

       > 業界IT→面接→ここで話の型に「社長のように」とかがあること自体
       > ナンセンスです。選ぶものにより最適な選択肢だけが残るように。
       > これはシチュエーションから選ぼうと、話の型から選ぼうと同じです

     **どちらから選んでも同じように効く。** 対応表は
     `SCENE_STYLES`(`src/data/speechStyles.js`)1か所で、
     **画面には組み合わせの判断を持たせない。** */
  const speechScenes = kind === 'speech' ? speechScenesFor(industry) : []
  const sceneList = kind === 'speech'
    ? scenesForStyle(speechScenes, style)
    : scenesFor(industry)
  const styleList = stylesForScene(scene)

  /* 場面を選んだら、噛み合わない型は外す。
     **黙って残さない** —— 残すと、出ていない型で作られる */
  const pickScene = (id) => {
    setScene(id)
    if (style && !stylesForScene(id).some((s) => s.id === style)) setStyle('')
  }

  /* 型を選んだら、噛み合わない場面は入れ替える。
     **空にしない** —— 場面は必ず1つ選ばれている必要がある */
  const pickStyle = (id) => {
    setStyle(id)
    const ok = scenesForStyle(speechScenes, id)
    /* **「選ばない」は壊さない**(第5.228節)。型は場面が無くても選べる */
    if (scene === '' && subjectLeads) return
    if (!ok.some((x) => x.id === scene)) setScene(ok[0]?.id ?? scene)
  }

  const genreList = genresFor(industry)

  /* **その組み合わせで選べる切り口**(0046)。
     記事とスピーチは1人が書く / 話すので記事の側、
     会話と会議は相手がいるので会話の側。
     **`kind === 'dialogue'` と書かない**(会議で必ず抜ける)。
     **スピーチには出さない** —— あちらには話し方の型がすでにある */
  const angleList = anglesFor(kind)

  /* **いまの組み合わせを、そのまま渡すための1か所。**
     過去の話を引くのも、本数を数えるのも、同じ絞り方でなければ
     「7本あります」と言いながら別のものを避けさせることになる */
  const likeQuery = () => ({
    kind,
    industry,
    /* **保存しているとおりに絞る**(下の `createMaterial` と同じ形)。
       ここだけ広げても狭めても、「7本あります」と言いながら
       別のものを避けさせることになる。
       **スピーチの場面は、いまは保存していない** ——
       だから業界と種類だけで絞る(絞りすぎて0本になるより、
       同じ業界のスピーチを避けるほうが役に立つ) */
    genre: kind === 'reading' ? genre : '',
    scene: isDialogueKind(kind) ? scene : '',
  })

  /** 弱点タグを、AI に渡す文言にする */
  const topicOf = (id) => {
    const tag = weaknessTags.find((t) => t.id === id)
    return tag ? `${tag.label}${tag.hint ? `(${tag.hint})` : ''}` : id
  }

  /**
   * AI に渡す「必ず入れる語」をまとめる。
   *
   * 入り口は2つある。**どちらも同じ扱いにする。**
   *   ① 単語帳から名指しで渡された語(`initial.mustUse`)
   *   ② これまでの宿題から拾った語(`reviewPool` のうち選んだ数)
   * ①が先。トレーナーが見て選んだものだからである。
   * そろえた形で重複を落とす(`don't` と `Don't` を2語と数えない)。
   */
  const mergedReview = () => {
    const out = []
    const seen = new Set()
    const add = (w) => {
      const key = normWord(w)
      if (!key || seen.has(key)) return
      seen.add(key)
      out.push(w)
    }
    mustUse.forEach(add)
    reviewPool.slice(0, reviewCount).forEach((w) => add(w.word))
    return out
  }

  /**
   * 教材名を自動で付ける。手入力を減らすため(仕様書 第5.13.5節)。
   *
   * **見出し(headline)はここに入れない。** 見出しは題名として別に出るので、
   * 教材名にも入れると同じ英文が2行続けて並ぶ(2026-08 実機)。
   * 記事・会話の見出しはジャンル/場面の日本語にし、**弱点も必ず残す。**
   * 紙で復習するとき、何の練習だったのかが分からなくなるため。
   */
  const autoTitle = () => {
    const parts = [todayLabel()]
    if (kind === 'reading') parts.push(genreLabel(genre))
    else if (usesScene(kind)) parts.push(sceneLabel(scene))
    if (tagIds.length) parts.push(tagIds.map(weaknessTagLabel).join(' + '))
    parts.push(level)
    if (industry) parts.push(industryLabel(industry))
    // **ゲスト名は入れない**(2026-08 利用者の指定)。
    //
    //   > 教材の上の部分に表示されるゲスト名はいらないです。
    //   > 内部のタグでどのゲストに使用したかだけを過去ログしておけばOKです。
    //
    // 教材は**既定で全トレーナーが共有する**ものなので、名前が入っていると
    // 「その人専用」に見えて再利用されなくなる。誰に出したかは
    // `assignments` に残っており、さがす画面の「ゲスト」で引ける。
    return parts.filter(Boolean).join(' / ')
  }

  /**
   * いま作ろうとしている構成(演習と問数)。
   * **1か所に置く。** 数を出す場所が画面に4つあるので、
   * 別々に計算すると「40問 作ります」と実際の数が食い違う。
   */
  const planNow = () => sectionsFor(kind, amounts, include)

  /**
   * **文法解説を作る問は、いくつあるか**(第5.213節)。
   *
   * **どの演習に解説が付くかは `grammarSource()` 1か所**が決める
   * (`exerciseTypes.js` の `grammarFrom`)。ここで種類を見ない ——
   * 単語には付かず、フレーズには付く、といった違いはあちらが持っている。
   *
   * **1問を1文として数える。** 長い段落は数文に切れるので、
   * 実際はこれより増えることがある。だから画面には「およそ」と書く。
   */
  const grammarCount = () => planNow()
    .filter((p2) => grammarSource(p2.exercise_type))
    .reduce((n, p2) => n + p2.count, 0)

  /**
   * 作るものの並びを、そのまま文にする(「記事6 + 内容の理解5 + …」)。
   *
   * **本文の名前は、種類に合わせる。** 演習の名前は `article` なので
   * そのまま出すと Speech練習でも「記事6」と書かれる(実測)。
   * 何を作るのかを押す前に読めることが、この文言の役目である。
   */
  const planLabel = (plan) => plan
    .map((s2) => `${isPassageSection(s2.exercise_type)
      ? bodyWord(kind) : exerciseLabel(s2.exercise_type)}${s2.count}`)
    .join(' + ')

  /**
   * **スピーチとして書かせるための指定**(2026-09 利用者の指定)。
   *
   * 中身は `speechBrief()`(`src/lib/speechDraft.js`)が組み立てる。
   * ここに書かないのは、**素の node で確かめられなくなる**ためである。
   */
  const speechSubject = () => speechBrief({
    scene: sceneLabel(scene), hint: sceneHint(scene), who, subject,
    style: speechStyleOf(style),
  })

  /**
   * **貼った原稿から教材を作る**(2026-09 利用者の指定)。
   *
   *   > 自分でスピーチなどを考えてもらったものをそのままコピペして
   *   > 指定する音声で text to speech をして…
   *
   * **本文は AI に作らせない。** 貼ったものがそのまま本文になるので、
   * 一字一句、書いたとおりに読ませられる。
   *
   * 残りの演習(内容の理解・ディスカッション・語句)は、
   * **貼った本文をそのまま渡して**作る。AI が書いた本文のときと
   * まったく同じ道なので、書き分けは1つも増えていない。
   * 演習をぜんぶ外していれば、**AI は1回も呼ばれない**(0円)。
   *
   * 訳(`prompt_ja`)は付かない。**貼ったのは英文だけ**なので、
   * 無いものをあるように見せない —— スラッシュリーディングの
   * カタマリごとの訳は、下で作る。
   */
  const generateFromScript = async ({ step, cancelled }, plan, parts) => {
    const [bodyPlan, ...rest] = plan
    const made = [{
      exercise_type: bodyPlan.exercise_type,
      items: parts.map((en) => ({ prompt_en: en, prompt_ja: '' })),
    }]
    const spent = { input: 0, output: 0, cacheRead: 0 }
    const context = parts.join('\n\n')

    // 段落ごとの本文を渡して、設問と語句を作る(AI の本文のときと同じ)
    for (let i = 0; i < rest.length; i += 1) {
      if (cancelled()) return null
      step(i + 1, exerciseLabel(rest[i].exercise_type))
      const { data, error: e } = await generateSection({
        sectionType: rest[i].exercise_type,
        count: rest[i].count,
        topic: tagIds.map(topicOf).join(' / '),
        level, industry: industryText, context,
      })
      if (e) throw new Error(`${exerciseLabel(rest[i].exercise_type)}を作れませんでした。${e}`)
      spent.input += data.usage?.input ?? 0
      spent.output += data.usage?.output ?? 0
      spent.cacheRead += data.usage?.cacheRead ?? 0
      made.push(data.section)
    }

    /* カタマリごとの訳(0021)。**貼った原稿でも要る** ——
       スラッシュリーディングは、これが無いと半分しか使えない。
       ここで失敗しても教材は捨てない(訳が付かないだけ)。
       あとから「区切りの訳を作る」で足せる */
    const chunkTodo = chunkPlan(made[0].items)
    if (chunkTodo.length && !cancelled()) {
      step(plan.length, 'カタマリごとの訳')
      const { data: cj, error: cjError } = await generateChunkJa(
        chunkTodo.map((x) => ({ no: x.no, chunks: x.chunks })),
      )
      if (cjError) {
        console.warn(`カタマリごとの訳を作れませんでした: ${cjError}`)
      } else {
        const byNo = new Map(chunkTodo.map((x) => [x.no, x]))
        for (const part of cj.parts ?? []) {
          const src = byNo.get(part.no)
          const item = made[0].items[part.no - 1]
          if (src && item) item.chunks = { en: src.en, ja: part.ja, parts: src.chunks }
        }
        spent.input += cj.usage?.input ?? 0
        spent.output += cj.usage?.output ?? 0
        spent.cacheRead += cj.usage?.cacheRead ?? 0
      }
    }

    /* 文法解説(0051)。**貼った原稿でも要る** ——
       自分で書いた原稿ほど、文が長くて骨組みが見えにくい。
       ここで失敗しても教材は捨てない(解説が付かないだけ)。
       あとから「セッションで使う」で裏から足せる(`needsGrammar`) */
    // **外してあれば、窓口を1回も呼ばない**(第5.213節・そのぶん 0円)
    if (!cancelled() && withGrammar) {
      step(plan.length + 1, '文法解説')
      /* **演習ぜんぶを渡す**(2026-09 利用者の指定)。
         以前は `made[0].items`(本文だけ)だった。
         どの欄を解説するかは `grammarItems()` が演習ごとに決める */
      const { error: gError } = await fillGrammar(made)
      // **黙って落とさない。** 何が足りなかったのかは残しておく
      if (gError) console.warn(`文法解説を作れませんでした: ${gError}`)
    }

    return {
      made, spent,
      headline: null, headlineJa: null, teachingPoint: null,
      autoTitle: autoTitle(),
      form: formSnapshot(),
    }
  }

  /**
   * 記事・会話を作る。
   *
   * **本文は1本まるごと作る。** 段落や発言を弱点ごとに分けたり、
   * 重複で1つずつ落としたりしない。落とすと話がつながらなくなる。
   * 内容理解と語句は、できあがった本文を渡して作らせる。
   * そうしないと本文と噛み合わない設問ができる(第5.17節)。
   */
  const generatePassage = async ({ step, cancelled }) => {
    const plan = planNow()
    const [bodyPlan, ...rest] = plan

    /* ── **貼った原稿があれば、本文は作らない**(2026-09 利用者の指定)──
       > 内容は、自分で手入力が基本

       ここで AI を1回も呼ばないので、**本文ぶんの課金がまるごと無くなる。**
       段落の切り方は `pastedParagraphs()`(素の node で確かめてある)。
       残りの演習(内容の理解・語句など)は、**貼った本文をそのまま渡して**
       作る —— AI が書いた本文のときとまったく同じ道を通る。 */
    const pasted = canPasteBody(kind) ? pastedParagraphs(script) : []
    if (pasted.length) return generateFromScript({ step, cancelled }, plan, pasted)

    /* **①すでに使った英文を渡して避けさせる。**
       弱点タグからしか引けなかったので、**タグを付けない記事・会話では
       1本も渡っていなかった**(0046 で気づいた)。
       タグが無ければ、**同じ業界・同じ場面の教材**から集める */
    const { data: used } = tagIds.length
      ? await loadUsedSentences(tagIds)
      : await loadUsedSentencesLike(likeQuery())

    /* **同じ「話」を二度作らない**(0046・2026-09 利用者の指定)。

         > 選んだシチュエーションや場面が同じでも、
         > 全然違う感じになって欲しいわけです。

       上の `used` は**英文**である。英文が1つも一致しなくても、
       「会議に遅れた新人が上司に謝る話」と「打ち合わせに遅れた新人が
       先輩に謝る話」は、ゲストから見れば同じ話である。
       **見る単位を、文から話へ上げる。**

       渡すのは同じ業界・同じ場面の過去15本の筋(数百トークン=0.1円未満)。
       **0046 を貼る前でも効く** —— 見出しと話題は前から入っている */
    const { data: stories } = await loadRecentStories(likeQuery())
    const past = stories ?? []
    /* **切り口を1枚引く。** おまかせのときは、
       **その組み合わせでまだ使っていない切り口**から選ぶ。
       Sonnet 5 は `temperature` を指定できないので、
       **ばらつきは入力の側で作るしかない**(`materialAngles.js`)。

       **細かい指定が書いてあるときは、引かない**(第5.232節・利用者の指摘)。

         > 唐揚げの加工工場の話だと指定したら、「悪い知らせをする」という
         > 切り口が強制的に選ばれ、そのような話になってしまいました

       「おまかせ」は**そのときどきで決める**という意味であって、
       「必ず1つ付ける」ではない。**中身が書いてあるなら、
       それが答えである。** ばらつきは、書いた中身が作る。
       切り口を選びたければ、これまでどおり選べる(欄は残っている)。 */
    const angleId = angle
      || (subjectLeads ? '' : pickAngle(kind, past.map((x) => x.angle))?.id || '')

    step(0, exerciseLabel(bodyPlan.exercise_type))
    const { data: body, error: bodyError } = await generateSection({
      sectionType: bodyPlan.exercise_type,
      count: bodyPlan.count,
      topic: tagIds.map(topicOf).join(' / '),
      level, industry: industryText, isFirst: true,
      // 単語帳から渡された語は**本文に入れる**。
      // 内容の理解・語句は、できた本文から作るので渡さなくてよい
      reviewWords: mustUse,
      genre: kind === 'reading'
        ? [genreLabel(genre), genreHint(genre)].filter(Boolean).join(' — ')
        : '',
      scene: isDialogueKind(kind)
        ? [sceneLabel(scene), sceneHint(scene)].filter(Boolean).join(' — ')
        : '',
      /* **スピーチは「話題の指定」に、書き方ごと組み立てて渡す**(2026-09)。
         窓口(`generate-material`)は `article` の指示のままなので、
         何も言わないと**記事の文体**で書かれてしまう。
         窓口に手を入れずに済ませるため、画面が指定を作る
         (`speechBrief`・会議を `kind` の値1つで足したのと同じ考え方)。
         **`FN_REV` は進めない。窓口の置き直しは要らない。** */
      subject: kind === 'speech' ? speechSubject() : subject,
      // **会話に出す人数**(2026-09 利用者の要望「会議というジャンル」)。
      // 記事には要らないので、会話のときだけ渡す
      speakers: isDialogueKind(kind) ? voiceCount : undefined,
      /* **話す人の性別を、声の並びと同じ順で渡す**(2026-09 利用者の指摘)。
         これが無いと、窓口は名前を自由に付けるので
         「女性の声が男性役をしゃべる」が起きる。
         **声に名前を合わせる**(逆は当てられない) */
      speakerGenders: isDialogueKind(kind) ? castGenders() : undefined,
      avoid: (used ?? []).slice(-40),
      // **話の重複を避ける2つ**(0046)。窓口の置き直しが要る
      avoidTopics: past.map((x) => x.text).filter(Boolean),
      /* **両方選んだときは、話題のほうを強くする**(第5.232節)。
         窓口はどちらも命令として渡すので、噛み合わないと
         どちらへ転ぶか分からない。**窓口は置き直さない** ——
         切り口は画面が作る文字列なので、ここで足せば届く */
      angle: angleWithSubject(angleBrief(angleId), subject.trim().length > 0),
    })
    // **どの段階で失敗したのかを、必ず名前で言う。**
    // 記事・会話は「本文 → 内容の理解 → 語句」と3回に分けて作る。
    // どこで転んだのかが分からないと、利用者には直しようがない。
    const bodyName = exerciseLabel(bodyPlan.exercise_type)
    if (bodyError) throw new Error(`${bodyName}を作れませんでした。${bodyError}`)

    const spent = {
      input: body.usage?.input ?? 0,
      output: body.usage?.output ?? 0,
      cacheRead: body.usage?.cacheRead ?? 0,
    }
    const made = [body.section]
    // できた本文を、そのまま次の生成に渡す
    const context = (body.section?.items ?? [])
      .map((it) => [it.speaker, it.prompt_en].filter(Boolean).join(': '))
      .filter(Boolean).join('\n\n')

    // **本文が取れていないなら、ここで止める。**
    // 以前はそのまま次(内容の理解)へ進み、受付窓口から
    // 「本文が空です。先に記事か会話を作ってください」と返っていた。
    // 押したのは「会話を作る」なので、これでは何が起きたのか分からない
    // (2026-08 の指摘)。転んだ場所を、その名前で伝える。
    if (!context) {
      throw new Error(`${bodyName}の中身が空でした。もう一度お試しください。`
        + '何度も続くときは、この文言をそのままお知らせください。')
    }

    for (let i = 0; i < rest.length; i += 1) {
      // **止まるのはキャンセルを押したときだけ**(2026-09 利用者の指定)。
      // 段と段のあいだで見る。送ってしまった1回は取り消せない
      if (cancelled()) return null
      step(i + 1, exerciseLabel(rest[i].exercise_type))
      const { data, error: e } = await generateSection({
        sectionType: rest[i].exercise_type,
        count: rest[i].count,
        topic: tagIds.map(topicOf).join(' / '),
        level, industry: industryText, context,
      })
      if (e) throw new Error(`${exerciseLabel(rest[i].exercise_type)}を作れませんでした。${e}`)
      spent.input += data.usage?.input ?? 0
      spent.output += data.usage?.output ?? 0
      spent.cacheRead += data.usage?.cacheRead ?? 0
      made.push(data.section)
    }

    // ── カタマリごとの訳(0021)────────────────────────────
    // **スラッシュリーディングは、これが無いと半分しか使えない。**
    // 区切る場所は決まりで出せるが、そのカタマリを日本語で何と言うかは
    // 決まりでは書けない(仕様書 第5.29.3節)。
    // **作る時点で1回だけ作る。** 開くたびに作ると、同じ費用が
    // ゲストの人数 × 開いた回数だけかかる(発音記号・要点フレーズと同じ)。
    //
    // ここで失敗しても**教材は捨てない。** 訳が付かないだけで、
    // 本文も設問もそのまま使える。あとから「区切りの訳を作る」で足せる。
    const chunkTodo = chunkPlan(made[0]?.items ?? [])
    if (chunkTodo.length) {
      if (cancelled()) return null
      step(plan.length, 'カタマリごとの訳')
      const { data: cj, error: cjError } = await generateChunkJa(
        chunkTodo.map((x) => ({ no: x.no, chunks: x.chunks })),
      )
      if (cjError) {
        // **黙って落とさない。** 何が足りなかったのかは残しておく
        console.warn(`カタマリごとの訳を作れませんでした: ${cjError}`)
      } else {
        /* **足りなかった段落は、`generateChunkJa()` の中でやり直している。**
           それでも残ったものは、教材を使うとき(セッションで使う)に
           `needsChunkJa()` が拾って裏で作り直す。ここでは記録だけ残す */
        if (cj.skipped) {
          console.warn(`カタマリごとの訳が ${cj.skipped} 段落ぶん足りません`
            + '(セッションで使うときに、裏で作り直します)')
        }
        const byNo = new Map(chunkTodo.map((x) => [x.no, x]))
        for (const part of cj.parts ?? []) {
          const src = byNo.get(part.no)
          const item = made[0].items[part.no - 1]
          // **切れ目そのものも残す**(`parts`)。残しておけば、あとで
          // 区切りの決まりを直しても、すでに作った訳がずれない(2026-08)
          if (src && item) item.chunks = { en: src.en, ja: part.ja, parts: src.chunks }
        }
        spent.input += cj.usage?.input ?? 0
        spent.output += cj.usage?.output ?? 0
        spent.cacheRead += cj.usage?.cacheRead ?? 0
      }
    }

    // ── 文法解説(SVOC と修飾要素・0051)──────────────────
    // **作る時点で1回だけ作る。** 開くたびに作ると、同じ費用が
    // ゲストの人数 × 開いた回数だけかかる(カタマリの訳と同じ)。
    //
    // ここで失敗しても**教材は捨てない。** 解説が付かないだけで、
    // 本文も設問もそのまま使える。あとから裏で足せる(`needsGrammar`)。
    // **外してあれば、窓口を1回も呼ばない**(第5.213節・そのぶん 0円)
    if (!cancelled() && withGrammar) {
      step(plan.length + 1, '文法解説')
      // **演習ぜんぶを渡す**(すぐ上の道と同じ。本文だけに絞らない)
      const { data: gr, error: gError } = await fillGrammar(made)
      if (gError) {
        // **黙って落とさない。** 何が足りなかったのかは残しておく
        console.warn(`文法解説を作れませんでした: ${gError}`)
      } else {
        if (gr?.skipped) {
          console.warn(`文法解説が ${gr.skipped} 件ぶん足りません`
            + '(セッションで使うときに、裏で作り直します)')
        }
        spent.input += gr?.usage?.input ?? 0
        spent.output += gr?.usage?.output ?? 0
        spent.cacheRead += gr?.usage?.cacheRead ?? 0
      }
    }

    // **できあがったものは、その場では画面に入れない。**
    // 別の画面へ移っていることがあるので、いったん仕事の側に置いて、
    // 教材の画面が開いたときに受け取る(`src/lib/generateJob.js`)
    return {
      made, spent,
      headline: body.headline ?? null,
      headlineJa: body.headline_ja ?? null,
      /* **実際に使った切り口と、何の話だったか**(0046)。
         次に同じ場面で作るとき、これを渡して避けさせる。
         `gist` は窓口を置き直すまで返ってこない —— そのときは空のまま
         保存され、**見出しと話題で代わりに避けさせる** */
      angle: angleId || null,
      gist: body.gist ?? null,
      teachingPoint: body.teaching_point ?? null,
      autoTitle: autoTitle(),
      form: formSnapshot(),
    }
  }

  /**
   * 文型ドリル・単語・フレーズを作る。
   * 弱点が複数なら問数を分けて、1問ずつ交互に並べる(第5.16.1節)。
   */
  const generateDrill = async ({ step, cancelled }) => {
    // ① 生成の前に、すでに使った英文を渡して避けさせる(誘導)
    const { data: used } = await loadUsedSentences(tagIds)
    const usedSet = new Set((used ?? []).map(normEn))

    const plan = planNow()
    /* **語は、演習ごとに配る**(2026-09 利用者の指定)。

       これまで復習の語は**最初の演習にだけ**渡していた。
       単語・フレーズは1演習しかないのでそれでよかったが、
       **文型ドリルは4演習ある。** 20 語を選んでも10問ぶんの1演習に
       押し込まれ、窓口の「不自然に詰め込まない。入りきらなければ
       全部使わなくてよい」でほとんどが落ちていた。
       **配れば、40問ぜんぶに行き渡る。**

       **効くのは文型ドリルだけ。** 単語・フレーズは
       「先頭から順にこの語で作り」なので、これまでどおり最初の演習へ
       まとめて渡す(**言われた場所だけを直す**)。 */
    const share = isDrillKind(kind) ? spreadWords(mergedReview(), plan.length) : null
    const made = []
    const notes = []
    // 指導ポイントは最初の演習で1本だけ受け取る。演習ごとに集めていた
    // ころは、同じ内容が言い換えられて6本並んだ。
    let point = teachingPoint
    let warn = null
    let droppedCount = 0
    let shortCount = 0
    const spent = { input: 0, output: 0, cacheRead: 0 }

    for (let i = 0; i < plan.length; i += 1) {
      // **止まるのはキャンセルを押したときだけ**(2026-09 利用者の指定)
      if (cancelled()) return null
      step(i, exerciseLabel(plan[i].exercise_type))

      // ② 生成のあとに、既出と「意味が近すぎる文」を落とし、
      //    落ちた分は作り直す。ここが「被らない」の担保。
      //
      // 弱点が複数でも**1回にまとめて**作らせる。以前は弱点ごとに
      // 呼び分けていたため、弱点3つで 4演習 × 3 = 12回になり、
      // 費用が3倍かかっていた(第5.21節)。分け方と交互の並びは
      // 指示で伝え、返ってきた tag_no で並べ直す。
      const result = await generateSectionUnique(
        {
          sectionType: plan[i].exercise_type,
          count: plan[i].count,
          topic: topicOf(tagIds[0]),
          topics: tagIds.length > 1 ? tagIds.map(topicOf) : [],
          level, industry: industryText, isFirst: i === 0,
          /* **書いた中身を、ドリルにも渡す**(第5.190節・2026-09 利用者の指定
             「ほかのトレーニングにもその項目を追加してください」)。

             渡していなかったので、文型ドリルと単語 / フレーズでは
             **欄に書いても1文字も効かなかった。**
             **効かない欄を見せない**(CLAUDE.md)——
             欄を出すなら、届くところまで通す。
             窓口は `subject` を受け取ると「# 話題(指定あり)」として
             指示に入れる。**窓口も `FN_REV` も触っていない** */
          subject,
          // **単語帳から渡された語(mustUse)が先。** トレーナーが名指しで
          // 選んだものなので、自動で拾った語より優先する。
          // 文型ドリルは**4演習に配る**、単語・フレーズは最初の演習だけ
          reviewWords: share ? (share[i] ?? []) : (i === 0 ? mergedReview() : []),
        },
        { usedSet, learnerIds: shareWith, tagIds },
      )
      if (result.error) throw new Error(result.error)

      droppedCount += result.dropped
      shortCount += result.short
      notes.push(...(result.tooSimilar ?? []))
      warn = warn || result.warning
      spent.input += result.usage?.input ?? 0
      spent.output += result.usage?.output ?? 0
      spent.cacheRead += result.usage?.cacheRead ?? 0
      if (result.teaching_point && !point) point = result.teaching_point

      // 1問ごとに、どの弱点の問題かを持たせる。
      // 番号が返らなかった問は、順番で割り当てる(抜けを残さない)。
      let items = result.section.items.map((it, n) => ({
        ...it,
        tag_id: tagIds.length > 1
          ? (tagIds[(Number(it.tag_no) || 0) - 1] ?? tagIds[n % tagIds.length])
          : undefined,
        tag_no: undefined,
      }))

      // 交互に並んでいなければ、こちらで並べ直す。
      // 指示だけに頼ると、まとまって並ぶことがある。
      if (tagIds.length > 1) {
        items = interleave(tagIds.map((t) => items.filter((it) => it.tag_id === t)))
      }

      made.push({
        exercise_type: plan[i].exercise_type,
        instruction: result.section.instruction,
        items,
      })
    }

    /* ── 文法解説(SVOC と修飾要素・0051)──────────────────
     *
     * **文型ドリルにも作る**(2026-09 利用者の指定)。
     *
     *   > そして、文法も調べられません。…… 文法を見るのはそもそも
     *   > 集中モードでない場所で見れませんか？
     *
     * ここに1行も無かったので、**文型ドリルには解説がどこにも無かった。**
     * 本文を作る2つの道(`generatePassage` / `generateFromScript`)には
     * 入っていたのに、ドリルの道だけ抜けていた。
     *
     * **作る時点で1回だけ作る。** 開くたびに作ると、同じ費用が
     * ゲストの人数 × 開いた回数だけかかる(本文のときと同じ)。
     * ここで失敗しても**教材は捨てない。** 解説が付かないだけで、
     * 設問はそのまま使える。あとから裏で足せる(`needsGrammar`)。
     *
     * **単語(`vocabulary`)には作らない** —— `grammarFrom` が `null` で、
     * `fillGrammar()` が窓口を1回も呼ばずに戻る(**0円**)。
     */
    // **外してあれば、窓口を1回も呼ばない**(第5.213節・そのぶん 0円)
    if (!cancelled() && withGrammar) {
      step(plan.length, '文法解説')
      const { data: gr, error: gError } = await fillGrammar(made)
      if (gError) {
        // **黙って落とさない。** 何が足りなかったのかは残しておく
        console.warn(`文法解説を作れませんでした: ${gError}`)
      } else {
        if (gr?.skipped) {
          console.warn(`文法解説が ${gr.skipped} 件ぶん足りません`
            + '(セッションで使うときに、裏で作り直します)')
        }
        spent.input += gr?.usage?.input ?? 0
        spent.output += gr?.usage?.output ?? 0
        spent.cacheRead += gr?.usage?.cacheRead ?? 0
      }
    }

    return {
      made, spent, headline: null, headlineJa: null, teachingPoint: point,
      dropped: droppedCount, short: shortCount, notes, warn,
      autoTitle: autoTitle(),
      form: formSnapshot(),
    }
  }

  /**
   * できあがったことを知らせる。
   *
   * 問数だけでなく**最初の1問の英文**も出す。数字だけでは
   * 「本当に中身ができているのか」が分からないため。
   */
  const finish = (made, head, spent = null) => {
    const first = made.flatMap((sec) => sec.items)
      .map((it) => it.prompt_en || it.audio_text || it.answer || it.question)
      .find(Boolean)
    setDone({
      total: made.reduce((n, sec) => n + sec.items.length, 0),
      parts: made.map((sec) => ({
        // **本文の名前は種類に合わせる**(Speech練習で「記事」と出ていた)
        label: sectionLabel(kind, sec.exercise_type), count: sec.items.length,
      })),
      headline: head ?? null,
      sample: first ?? null,
      // かかった費用。見えないと、使いすぎに気づけない(第5.21節)
      spent,
    })
    window.setTimeout(() => {
      doneRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
  }

  /** 失敗の知らせを画面に出し、そこまで送る */
  const fail = (message) => {
    setGenerating(null)
    setError(message)
    // 描画を待ってから寄せる。すぐ呼ぶと、まだ要素が無い。
    window.setTimeout(() => {
      errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
  }

  const generate = async () => {
    // 記事と会話は、弱点を選ばなくても作れる(読み物として成立するため)。
    // 文型ドリルは、何の練習かが決まらないと作れない。
    if (!isPassageKind(kind) && tagIds.length === 0) {
      setError('弱点タグを選んでください。何の練習かが決まらないと作れません。')
      // 知らせを出すだけでなく、直す場所まで画面を送る。
      // どこを直せばよいか分からないと、探し回ることになる。
      window.setTimeout(() => {
        tagRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 50)
      return
    }
    if (tagIds.length > MAX_TAGS) {
      setError(`選べる弱点は ${MAX_TAGS} つまでです。`
        + `${tagIds.length} つだと1つあたりの問数が少なすぎて、練習量になりません。`)
      return
    }
    setError(null)
    setDropped(0)
    setShort(0)
    setSimilarNotes([])
    setWarning(null)
    setDone(null)
    // 前の下書きの控えを残さない(0046)。
    // 残すと、別の切り口で作り直したのに前の切り口が保存される
    setUsedAngle('')
    setGist('')

    /* **画面から切り離して走らせる**(2026-09 利用者の指定)。
         > 教材の作成中に別のところに飛んでもバックグラウンドで
         > 作業が続くようにしてください。
       ここで `await` すると、別の画面へ移った瞬間にこの部品ごと消え、
       返ってきた下書きの行き場が無くなる。仕事の状態は
       `src/lib/generateJob.js` に置く(あちらは画面が消えても残る)。 */
    const plan = planNow()
    const started = startJob({
      title: kindLabel(kind),
      /* 本文のときは、そのあとに**カタマリごとの訳(0021)と
         文法解説(0051)**の2段が続く。**足したらここも足す** ——
         足さないと、帯が 100% になったあとも動き続ける。
         **ドリルにも文法解説の1段が付いた**(2026-09)。
         カタマリごとの訳は本文にしか無いので、こちらは +1 である。
         **文法解説を外したら、その1段も引く**(第5.213節)——
         引かないと、作り終えても帯が最後まで行かない */
      total: (isPassageKind(kind) ? plan.length + 1 : plan.length)
        + (withGrammar && grammarCount() > 0 ? 1 : 0),
      run: (ctl) => (isPassageKind(kind) ? generatePassage(ctl) : generateDrill(ctl)),
    })
    if (!started) {
      setError('いま別の教材を作っています。'
        + '終わるまで待つか、「作るのをやめる」を押してください。')
    }
  }

  /** いまの入力を控える。**別の画面から戻ったときに、そのまま戻すため** */
  const formSnapshot = () => ({
    kind, level, industry, tagIds, genre, scene, subject,
    // 話の切り口(0046)。**選んだものだけを控える** ——
    // 実際に引いた切り口を入れると、戻ったときにおまかせが効かなくなる
    angle,
    visibility, instruction, mustUse,
    /* **文法解説を作るかどうかも控える**(第5.213節)。
       控えないと、別の画面から戻ったときに「作る」へ戻っており、
       **外したはずの解説が作られて課金される** */
    withGrammar,
    // 会話に出す人数(2026-09)。戻ってきたときに2人へ戻っていると、
    // 会議として作ったはずの教材が1対1の会話として保存される
    speakers,
    /* **どの演習をいくつ作ったのかも控える**(2026-09)。
       戻ってきたときにここが初期値へ戻っていると、
       外したはずの演習が「作った」ことになってしまう */
    amounts, include,
    // **貼った原稿と話し手も控える**(2026-09)。別の画面から戻ったときに
    // 空へ戻っていると、何を貼ったのか分からなくなる
    script, who, style,
  })

  /**
   * できあがった下書きを画面に入れる。
   *
   * **別の画面へ移っていても受け取れるようにしてある。**
   * 教材を作る画面が開いていなければ、仕事の側で待っている
   * (`takeJobResult`)。戻ってきたときに、入力ごと元に戻す。
   */
  const applyResult = (r) => {
    if (!r?.made) return
    const f = r.form ?? {}
    if (f.kind) setKind(f.kind)
    if (f.level) setLevel(f.level)
    setIndustry(f.industry ?? '')
    if (f.tagIds) setTagIds(f.tagIds)
    if (f.genre != null) setGenre(f.genre)
    if (f.scene != null) setScene(f.scene)
    if (f.subject != null) setSubject(f.subject)
    if (f.angle != null) setAngle(f.angle)
    if (f.speakers != null) setSpeakers(f.speakers)
    if (f.visibility) setVisibility(f.visibility)
    if (f.instruction != null) setInstruction(f.instruction)
    if (f.withGrammar != null) setWithGrammar(f.withGrammar)
    if (f.mustUse) setMustUse(f.mustUse)
    // **どの演習をいくつ作ったのか**も戻す。ここが初期値のままだと、
    // 外した演習が「作った」ことになり、保存の数と食い違う
    if (f.amounts) setAmounts(f.amounts)
    if (f.include) setInclude(f.include)
    if (f.script != null) setScript(f.script)
    if (f.who) setWho(f.who)
    if (f.style != null) setStyle(f.style)

    setSections(r.made)
    if (r.headline) setHeadline(r.headline)
    if (r.headlineJa) setHeadlineJa(r.headlineJa)
    /* **実際に使った切り口と筋**(0046)。入力の `angle` とは別に持つ。
       ここを入力へ入れてしまうと、「作り直す」で同じ切り口に固定される */
    setUsedAngle(r.angle ?? '')
    setGist(r.gist ?? '')
    if (r.teachingPoint) setTeachingPoint(r.teachingPoint)
    setDropped(r.dropped ?? 0)
    setShort(r.short ?? 0)
    setSimilarNotes(r.notes ?? [])
    setWarning(r.warn ?? null)
    setTitle((t) => (t.trim() ? t : (r.autoTitle ?? '')))
    finish(r.made, r.headline, r.spent)
  }

  /**
   * 走っている仕事を見張る。
   *
   * **この部品が消えても仕事は続く。** 戻ってきたら、ここが
   * 途中経過を映し直し、終わっていれば下書きを受け取る。
   */
  // **いつも最新のものを呼べるようにしておく。**
  // 見張りは1回だけ張る(毎回張り直すと、状態を入れ直すたびに
  // また描き直しになり、止まらなくなる)
  const applyRef = useRef(null)
  const failRef = useRef(null)
  applyRef.current = applyResult
  failRef.current = fail

  useEffect(() => {
    const sync = (j) => {
      setGenerating(j?.state === 'running'
        ? { done: j.done, total: j.total, label: j.label, startedAt: j.startedAt } : null)
      if (j?.state === 'done') applyRef.current?.(takeJobResult())
      if (j?.state === 'error') { failRef.current?.(j.error); clearJob() }
      if (j?.state === 'cancelled') clearJob()
    }
    sync(currentJob())
    return watchJob(sync)
  }, [])

  /**
   * 保存する声の並び。**出来上がった名前に合わせて入れ替える。**
   *
   * 窓口へ「1人目は男性、2人目は女性」と渡してはいるが、
   * ①窓口を置き直していない ②AI がその1行を守らなかった、のどちらでも
   * **黙ってずれる**(しかも音は鳴るので、聴くまで分からない)。
   * **頼むだけにせず、出来上がりを見て直す**(CLAUDE.md)。
   *
   * **声は1人も入れ替えない。並び順だけを変える**ので、
   * トレーナーが指名した声は必ず全員そのまま使われる。
   * 名前から性別が読めないときは、何もしない。
   */
  const orderedCast = () => (
    isDialogueKind(kind)
      ? orderVoicesByNames(
        cast,
        (sections.find((sec) => isPassageSection(sec.exercise_type))?.items ?? [])
          .map((it) => it.speaker),
        (id) => findVoice(id)?.gender,
      )
      : cast
  )

  /**
   * 保存する声の並びに、**読み方を付ける**(第5.196節)。
   *
   * **並べ替えが終わってから付ける。** 先に付けると、性別を引く
   * `findVoice()` に読み方付きの id が渡ることになる(引けはするが、
   * **並べ替えの中で1つでも素の id に戻されたら、その声だけ読み方が抜ける**)。
   * **付けるのは、いちばん最後の1回だけ**にしておく。
   */
  const styledCast = () => orderedCast().map((id) => styledVoiceId(id, readStyle))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    // **1回だけ決めて、作るときも支度のときも同じものを使う**
    const voiceIds = styledCast()
    // 教材名は空でよい。日付・弱点・レベルから組み立てる。
    // 必須にすると、AI に作らせるだけの人にも入力を強いることになる。
    const { data, error: message } = await createMaterial({
      title: title.trim() || autoTitle(),
      level, kind, instruction_ja: instruction, teaching_point: teachingPoint,
      visibility, industry, sections, tagIds, createdBy,
      headline, headlineJa,
      genre: kind === 'reading' ? genre : '', scene: isDialogueKind(kind) ? scene : '',
      /* **どの切り口で、何の話を書いたか**(0046)。
         次に同じ業界・場面で作るとき、これを渡して避けさせる。
         **0046 を貼る前は送らない**(`createMaterial` が外す) */
      angle: usedAngle || angle, gist,
      // **おまかせは、ここで1回だけ決めて保存する。**
      // 開くたびに選び直すと、同じ教材なのに毎回ちがう声になり、
      // そのたびに音声を作り直す(= 課金される)。
      // **並びは出来上がった名前に合わせてある**(`orderedCast`)
      voiceIds,
      topic: subject,
    })
    if (message) { setBusy(false); setError(message); return }

    // 上で選んでおいたゲストに、そのまま共有する。
    // 発行と共有が別の操作だと、作ったのに届いていない教材が生まれる。
    let shared = 0
    let addedWords = null
    if (shareWith.length) {
      const { data: shareInfo, error: shareError } = await assignMaterial({
        materialId: data.id, learnerIds: shareWith, assignedBy: createdBy,
      })
      if (shareError) {
        setBusy(false)
        setError(`教材はできましたが、共有できませんでした: ${shareError}`
          + ' 一覧から共有し直してください。')
        return
      }
      shared = shareWith.length
      /* **共有した語は、そのままゲストの単語帳に入る**(0047)。
         何語入ったかを、発行の知らせに添える(黙って入れない) */
      addedWords = shareInfo?.words ?? null
    }

    setBusy(false)

    /* ── 発行したら、**裏で支度しておく**(2026-09 利用者の指定)────
     *
     *   > 初めて再生するときの待ち時間が３０秒近くあり、これは、教材が
     *   > 完成した際にバックグランドで準備する仕様にできないでしょうか？
     *   > 単語の意味についても同様の仕様にできないでしょうか？
     *
     *   本文の音声は**1本にまとめて**作るようになったので、初めて
     *   「Listen (全体)」を押した人が、その場で 50 秒ぶんの生成を待っていた。
     *   トレーナーは発行のあと次の教材へ移ることが多いので、
     *   **その時間を支度に使う。** レッスンで開くころにはできている。
     *
     *   **待たない。** 支度は裏で走り、画面はすぐ次へ進む
     *   (`prepareJob.js` がモジュールに1つだけ持つので、画面が消えても続く)。 */
    startPrepare(
      { id: data.id, sections, voiceIds, tags: tagIds },
      { title: title.trim() || autoTitle(), level },
    )

    onCreated?.(data.id, shared, addedWords)
  }

  return (
    /* `card--form` … **欄を1本の柱にする**(2026-09・第2週)。
       幅の上限は `styles.css` が持つ。ここでは名前を付けるだけ */
    <form className="card card--form" onSubmit={handleSubmit}>
      {/* **説明の文は置かない**(2026-08 利用者の指定)。
          > ごちゃごちゃしすぎています。なくてもわかります。
          欄の名前だけで分かることを、文で言わない。 */}
      <h2 className="card-title">教材を新しく作る</h2>

      {/*
        誰に出すかは**最初に選ぶ**。あとから選ぶ形にしていたため、
        すべて指定し終えるまで選択肢が出てこず、やりにくかった。
        ここで選んでおくと、発行と同時に共有まで終わる。
      */}
      {/* **上から「レベル → トレーニングの種類 → 業界 / 趣味 →
          話題 / シチュエーション → ゲスト」**(2026-08 利用者の指定)。
          ゲストモードから作るときも同じ並びである
          (同じ部品を使っているので、1か所で決まる)。 */}
      <div className="material-fields">
      <label className="field">
        <span>レベル</span>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          {CEFR_LEVELS.map((l) => (
            <option key={l.id} value={l.id}>{cefrOption(l.id)}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>トレーニングの種類</span>
        <select value={kind}
                onChange={(e) => {
                  const next = e.target.value
                  setKind(next)
                  /* **会議に切り替えたら、人数を3人以上にそろえる**(2026-09)。
                     2人のままだと、選択肢に無い値がプルダウンに残り、
                     **空欄に見える。** 逆(会議 → 会話)は 3人のままでよい */
                  if (next === 'meeting' && speakers < MIN_MEETING_SPEAKERS) {
                    setSpeakers(MIN_MEETING_SPEAKERS)
                    setPicked([])
                  }
                }}>
          {NEW_MATERIAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>

      {/* **業界と趣味は、2つのプルダウンに分けて左右に並べる**
          (2026-08 利用者の指定)。

          > 業界を選ばない場合に選べるようにしたいのが、「趣味・娯楽」です。

          仕事で英語を使わない人もいるし、仕事の話ばかりでは続かない。
          **入れ物は1つのまま**(`materials.industry`)で、
          **選ぶ欄だけ2つに分ける。** 片方を選ぶと、もう片方は空に戻る
          — 教材に付く分野は1つだからである。 */}
      <div className="field-row">
        <label className="field">
          <span>
            業界
            <span className="field-hint">仕事の場面</span>
          </span>
          <select value={isWork ? topIndustry : ''}
                  onChange={(e) => setIndustry(e.target.value)}>
            <option value="">選ばない(汎用)</option>
            {industriesIn('work').map((i) => (
              <option key={i.id} value={i.id}>{i.label} — {i.hint}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            趣味
            <span className="field-hint">仕事以外の場面</span>
          </span>
          <select value={isHobby ? topIndustry : ''}
                  onChange={(e) => setIndustry(e.target.value)}>
            <option value="">選ばない(汎用)</option>
            {industriesIn('hobby').map((i) => (
              <option key={i.id} value={i.id}>{i.label} — {i.hint}</option>
            ))}
          </select>
        </label>
      </div>

      {/* **種類**(2026-09 利用者の指定)。分野に種類があるときだけ出す。
          先頭は「全般」(親そのもの)。種類を決めきれない人が
          行き止まりにならないようにしてある */}
      {industryKinds.length > 0 && (
        <label className="field">
          <span>
            {industryLabel(topIndustry)}の種類
          </span>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {industryKinds.map((k) => (
              <option key={k.id} value={k.id}>{k.short} — {k.hint}</option>
            ))}
          </select>
        </label>
      )}

      {kind === 'reading' && (
        <label className="field">
          <span>
            話題
          </span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {/* **細かい指定を書いたときだけ出す**(第5.232節・場面と同じ)。
                書いていないのに「選ばない」を選べると、
                **何の指定も無いまま**作れてしまう */}
            {subjectLeads && <option value="">話題は選ばない(細かい指定にまかせる)</option>}
            {genreList.map((g) => (
              <option key={g.id} value={g.id}>{g.label} — {g.hint}</option>
            ))}
          </select>
        </label>
      )}

      {/* **スピーチでも場面を選ぶ**(2026-09 利用者の指定)。
          出す一覧は会話とは別(`speechScenesFor`)。
          **`isDialogueKind` を流用しない** —— あれは「話す人が2人以上」の
          意味で、当てると人数の欄まで一緒に出てしまう */}
      {usesScene(kind) && (
        <label className="field">
          <span>
            シチュエーション
          </span>
          {/* **空の欄を出さない**(第5.183節・2026-09 利用者の指摘
              「以前ならスピーチの詳細を選べたのに、今は選べなくなっています」)。

              こちらでは再現しなかったが、**中身が0件のときに
              「押せるのに何も入っていない欄」が出る**形になっていた。
              それは**行き止まり**である(CLAUDE.md「黙って落とさない・
              黙って絞らない」)。

              **何が起きているかと、どうすればよいかを、その場に書く。**
              一覧そのものはファイルにあるので、ここが0になるのは
              **古い版が端末に残っている**ときである */}
          {sceneList.length === 0 ? (
            <p className="notice notice--warn" role="alert">
              場面の一覧が読めませんでした。
              画面を再読み込みしてください(古い版が残っている可能性があります)。
              直らないときは、画面のいちばん下にある版の番号をお知らせください。
            </p>
          ) : (
            <select value={scene} onChange={(e) => pickScene(e.target.value)}>
              {/* **細かい指定を書いたときだけ出す**(第5.228節)。
                  書いていないのに「選ばない」を選べると、
                  **何の指定も無いまま**作れてしまう
                  (効かない操作を見せない・CLAUDE.md) */}
              {subjectLeads && <option value="">場面は選ばない(細かい指定にまかせる)</option>}
              {sceneList.map((x) => (
                <option key={x.id} value={x.id}>{x.label} — {x.hint}</option>
              ))}
            </select>
          )}
        </label>
      )}

      {/* ── 話の切り口(0046・2026-09 利用者の指定)────────────────

            > 選んだシチュエーションや場面が同じでも、
            > 全然違う感じになって欲しいわけです。

          同じ場面でも、切り口が違えばまったく別の話になる。
          **既定は「おまかせ」** —— そのとき、まだ使っていない切り口から
          1枚引く。押すたびに違う話になるのは、ここが効いているためである。

          **スピーチには出さない**(話し方の型がその役をしている)。 */}
      {angleList.length > 0 && (
        <label className="field">
          <span>
            話の切り口
          </span>
          <select value={angle} onChange={(e) => setAngle(e.target.value)}>
            {/* **「おまかせ」は、そのときどきで決めるという意味**である
                (第5.232節)。細かい指定が書いてあるなら、
                **その答えは「付けない」**である ——
                書いた中身を上書きしないために、切り口は引かない。
                **値(`''`)は変えない。** 変えると、これまでの教材の
                控えと食い違う。出すのは**いまの状態**だけ */}
            <option value="">
              {subjectLeads
                ? '切り口は付けない(細かい指定にまかせる)'
                : 'おまかせ(毎回ちがう切り口)'}
            </option>
            {angleList.map((a) => (
              <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>
            ))}
          </select>
        </label>
      )}

      {/* **もう何本あるか。** そもそも新しく作らないのが、いちばん被らない。
          **数えられなかったときは出さない**(0 と取り違えさせない) */}
      {isPassageKind(kind) && likeCount != null && (
        <p className="field-hint">
          {likeCount > 0
            ? `この組み合わせの教材は、すでに ${likeCount} 本あります。`
              + '同じ話にならないよう、過去の内容を避けて作ります'
              + '(「教材をさがす」から使い回すこともできます)'
            : 'この組み合わせの教材は、まだありません'}
        </p>
      )}

      {/* ── Speech練習(2026-09 利用者の指定)────────────────────────

            > 自分でスピーチなどを考えてもらったものをそのままコピペして
            > 指定する音声で text to speech をして、オーバーラッピングや
            > シャドーイングのように練習できるモードが欲しいです。
            > 内容は、自分で手入力が基本、業界とシチュエーションなどを
            > 選べばそれに合わせた Speech を作ってくれるのも最高です。

          **貼るのが基本、AI は2番目。** だから貼る欄を先に置く。
          貼ってあれば本文は AI に作らせないので、**そのぶん課金されない。** */}
      {canPasteBody(kind) && (
        <>
          <label className="field">
            <span>
              自分の原稿(英語)
            </span>
            <textarea rows={8} value={script} placeholder={SCRIPT_HINT}
                      onChange={(e) => setScript(e.target.value)} />
          </label>
          {/* **何段落になるかを、貼った時点で出す。**
              段落は「Listen」「オーバーラッピング」「シャドーイング」の
              単位そのものなので、押す前に分かっていてほしい */}
          <p className="field-hint">
            {scriptParts.length
              ? `${scriptParts.length} 段落になります。`
                + 'この原稿をそのまま読ませるので、AI は本文を書き直しません'
                + `${scriptParts.length >= MAX_PARTS
                  ? `(段落は ${MAX_PARTS} までです)` : ''}`
              : '空のままなら、下の場面と話し手から AI がスピーチを作ります'}
          </p>

          {/* **話し方の型**(2026-09 利用者の指定)。

                > あと、著名人のスピーチなどを教材にできませんか?
                > イーロンマスク、スティーブ・ジョブスなどビジネスから
                > 映画スター、スポーツ選手など

              **原稿そのものには著作権がある。** だから入れるのは
              「どう話すか」だけにして、**中身は AI が新しく書く**
              (`src/data/speechStyles.js`)。学びたいのは文言ではなく
              話し方そのものなので、これで足りる。

              **場面と型は、互いに絞り込む**(2026-09 実機・利用者の指摘)。
              面接に「創業者のように大きな絵を語る」は出さない。
              対応表は `SCENE_STYLES` 1か所で、ここでは判断しない。
              **原稿を貼ったときは出さない** —— 貼ったものがすべてである */}
          {!scriptParts.length && (
            <label className="field">
              <span>
                話し方の型(任意)
              </span>
              <select value={style} onChange={(e) => pickStyle(e.target.value)}>
                {styleList.map((s) => (
                  <option key={s.id || 'none'} value={s.id}>
                    {s.label}{s.hint ? ` — ${s.hint}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* 話し手(任意)。
                > その際に「会社名」「自分の名前」「役職」「部署名」なども
                > 任意で指定すればそれに沿って Speech を作成してくれる機能です
              **原稿を貼ったときは使わない**(貼ったものがすべてである)ので、
              AI に作らせるときだけ出す。**効かない欄を見せない** */}

          {!scriptParts.length && (
            <fieldset className="field">
              <legend>
                話し手(任意)
              </legend>
              <div className="filter-row">
                {SPEAKER_FIELDS.map((f) => (
                  <label key={f.id} className="filter-label">
                    {f.label}
                    <input type="text" value={who[f.id]} placeholder={f.hint}
                           onChange={(e) => setWho({ ...who, [f.id]: e.target.value })} />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}

      {/* ── 自由に書く「中身」(第5.190節・2026-09 利用者の指定)────────

            > それとも、スピーチの場合は「話す内容(任意)」に追加すると
            > よいでしょうか? もしそうであれば、記事や会話、ほかの
            > トレーニングにもその項目を追加してください。

          **どの種類でも、同じ場所に、同じ1つ。**

          直す前はこうだった ——
          スピーチだけ**話し方の型のすぐ下**にあり、記事・会話・会議は
          **「詳しく設定する(任意)」の中**に畳まれていて、
          文型ドリルと単語 / フレーズには**そもそも無かった。**
          **同じことをするものが、3通りの出方をしていた**(CLAUDE.md)。

          いまは**選ぶ欄の最後**に、1つだけ置く ——
          「選び終わったら、最後にひとこと足す」という流れになる。

          **スピーチでは、話し方の型より下に出る**(2026-09 利用者の指定
          「自由テキスト入力欄は、話の型の下に置いてください」)。
          この場所はスピーチの塊(原稿・型・話し手)の**すぐ後ろ**なので、
          ほかの種類では切り口のすぐ下に、スピーチでは型の下に出る ——
          **どちらも「選び終わった最後」である。欄は1つのまま。** 

          **入れ物は `subject` 1つ**(欄は増やしていない)。
          **呼び名は `materialKinds.js` 1か所**から引く ——
          画面で `kind === 'speech' ? … : …` と書き分けない。

          **原稿を貼ったときは出さない**(貼ったものがすべてである・
          効かない欄を見せない)。 */}
      {!scriptParts.length && (
        <label className="field">
          <span>
            {subjectLabel(kind)}
            <span className="tip field-hint">{subjectHint(kind)}</span>
          </span>
          {/* **1行ではなく、書ける箱にする**(第5.213節・2026-09 利用者の指定)。

                > 記事や会話、会議も含めた全ての教材を作成する際に、
                > 細かい指定を書き込める欄を作ってください

              欄そのものは第5.190節で全種類に出ていた。出ていなかったのでは
              なく、**1行の入力だったので「ひとこと書く欄」に見えていた。**
              注文を2つ3つ書こうとすると、**書いた先から左へ流れて消える。**
              呼び名も種類ごとに違っていたので(話題 / 話す中身 / 文の中身)、
              **同じ欄だと分からなかった** —— そちらは
              `materialKinds.js` 1か所でそろえた。 */}
          <textarea rows={3} value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={subjectExample(kind)} />
        </label>
      )}

      {/* 読み上げの声(0017)。

          **置き場所は「トレーニングの種類」のすぐ下**(2026-09 利用者の指定)。

            > 話者(国・訛り)の指定が、記事・ダイアローグ、会議を選んだ
            > 時点で表示されるよう改良してください

          以前は「ゲスト」より**下**にあったので、記事や会話を選んでも
          そこから見えず、**送らないと気づけなかった。**
          種類を選んだ流れのまま、誰が読むかまで決められるようにする。
          **利用者が決めた並び(レベル → 業界・趣味 → 種類 → 話題 /
          シチュエーション → ゲスト)は崩していない** — その5つの順は
          そのままで、声をゲストの前に入れただけである。

          **相手の訛りが聞き取れないと仕事にならない。** インドやシンガポールの
          英語は、教科書のアメリカ英語しか聞いていないと歯が立たない。
          教材ごとに相手を変えられること自体に、練習の価値がある。

          選べる声は**教材の種類で絞る。** 会話には会話向きの声、
          記事やドリルにはナレーション向きの声しか出さない。
          記事の朗読に感情豊かな声を当てると芝居がかって聞きづらく、
          会話に淡々とした声を当てると人と話している感じがしない。 */}
      <fieldset className="field voice-pick">
        <legend>読み上げの声</legend>

        <div className="voice-row">
          {/* **「訛り(国籍)」の見出しは出さない**(2026-08 利用者の指定)。
              「読み上げの声」のすぐ下にあり、選ぶものが「アメリカ」「イギリス」
              なので、見れば分かる。
              **画面から消えても、読み上げソフト向けの名前は残す**
              (`aria-label`)。目の見えない人には見出しが唯一の手がかりである */}
          <label className="field">
            <select value={accent} aria-label="訛り(国籍)"
                    onChange={(e) => { setAccent(e.target.value); setPicked([]) }}>
              {CLIP_ACCENTS.map((a) => (
                <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>
              ))}
            </select>
          </label>

          {/* **会話に出す人数**(2026-09 利用者の要望)。
              2人なら1対1、3〜4人なら会議・打ち合わせになる。
              **会話のときだけ出す**(効かない操作を見せない)。
              上限が4人である理由は `clipVoices.js` の `SPEAKER_COUNTS` に書いた。
              **会議では 2人を出さない**(それはただの1対1の会話である)。
              **人数を変えたら、指名した声はいったん消す。**
              残すと、減らしたときに「見えていない4人目」が保存される */}
          {isDialogueKind(kind) && (
            <label className="field">
              <span>出てくる人数</span>
              <select value={speakers}
                      onChange={(e) => {
                        setSpeakers(Number(e.target.value))
                        setPicked([])
                      }}>
                {speakerCountsFor(kind).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}

          {voicePool.length > 0 && Array.from({ length: voiceCount }, (unused, i) => (
            <label className="field" key={i}>
              <span>{voiceCount > 1 ? `話す人 ${i + 1}` : '話す人'}</span>
              <select
                value={picked[i] ?? ''}
                onChange={(e) => setPicked((list) => {
                  const next = [...list]
                  next[i] = e.target.value
                  return next
                })}
              >
                <option value="">おまかせ</option>
                {voicePool.map((v) => (
                  <option key={v.id} value={v.id}
                          disabled={picked.some((x, j) => x === v.id && j !== i)}>
                    {v.label}({v.gender === 'male' ? '男性' : '女性'})
                  </option>
                ))}
              </select>
            </label>
          ))}

          {/* **読み方 —— 訛りを活かすか、感情を出すか**(第5.196節・
              2026-09 利用者の指定「発音について、訛りと感情どちらを重視するか
              都度指定させてください」)。

              **両方は選べない。** v3 の `stability` はとびとびの3つで、
              **訛りは「元の録音の特徴」そのもの**である。感情を前に出すほど
              元の録音から離れ、訛りは薄れる(第5.192節)。
              だから**選択肢の文に、失うほうも必ず書く** ——
              片方だけ書くと、もう片方は「黙って変えた」ことになる。

              **良い声が1人もいない訛りでは出さない**(効かない操作を
              見せない)。標準の段(Google / Azure)に `stability` は無く、
              どちらを選んでも同じ音が鳴る。

              **選んだ側は、保存する声の id の後ろに付いて回る**
              (`styledVoiceId`)。置き場所も指紋も別になるので、
              **同じ英文を2つの読み方で持てるし、混ざらない。**
              既定(訛りを活かす)は素の id のままなので、
              **すでに作った音声は1本も無駄にならない。** */}
          {voicePool.length > 0 && (
            <label className="field voice-style">
              <span>
                声の出し方
                {/* **いま選んでいる読み方が、何を諦めるのか。**
                    `tip` を付けない —— 説明の文を消している人にも必ず出す。
                    ここは飾りではなく、**片方を選べばもう片方を失う**という、
                    この欄そのものの意味である(第5.192節で黙って変えた) */}
                <span className="field-hint">{readStyleHint(readStyle)}</span>
              </span>
              {/* **選択肢は名前だけ。** ひとことまで入れると、
                  狭い画面で「訛りを活かす —」で切れて読めなくなる(実測) */}
              <select value={readStyle} onChange={(e) => setReadStyle(e.target.value)}>
                {READ_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* **声が1人も登録されていないときの断り書きは出さない**
            (2026-08 利用者の指定)。訛りだけを選べばよく、
            指名する欄が出ていなければ、おまかせで読み上げる。
            `src/data/clipVoices.js` は**仕組みの内側の名前**でもある */}
      </fieldset>
      {/* **選ぶ余地が無いときは、この欄ごと出さない**(2026-08 利用者の指定)。

            > 「読み上げの声」だけ残してその周辺のこれらも消して
            > (ゲスト / Airi / 訛り(国籍))

          ゲストのカードから作るときは、**候補がその人1人で、すでに
          選ばれている。** 押しても外れるだけで、選ぶことがない。

          **「ゲストのカードかどうか」では判断しない。**
          `候補が1人 かつ すでに選ばれている` で見る。そうすれば
          「教材」タブでゲストを絞ってから作りに来たときも同じように隠れ、
          複数から選ぶときは、これまでどおり出る。
          **画面の名前ではなく、選ぶ余地があるかで決める。** */}
      {!(learners.length === 1 && shareWith.length === 1) && (
      <fieldset className="field">
        <legend>ゲスト</legend>
        {learners.length === 0 ? (
          <p className="field-hint">
            担当しているゲストがまだいません。「ゲスト」タブから追加できます。
          </p>
        ) : (
          <>
            <div className="tagpicker-tags">
              {learners.map((l) => (
                <button
                  key={l.id} type="button"
                  className={`tagchip${shareWith.includes(l.id) ? ' is-on' : ''}`}
                  onClick={() => setShareWith(shareWith.includes(l.id)
                    ? shareWith.filter((x) => x !== l.id)
                    : [...shareWith, l.id])}
                >
                  {l.display_name}
                </button>
              ))}
            </div>
            {/* **1人だけ選んだときの断り書きは出さない**(2026-08 利用者の指定)。
                ゲストのカードから作るときは必ずこの形になるので、
                この1文だけがゲストモードに増えていた。
                しかも「教材名にもお名前が入ります」は**もう本当ではない**
                (教材名にゲスト名を入れない・CLAUDE.md)。
                同じ英文を二度出さない仕組みは、選んだ人数によらず働く。 */}
            {shareWith.length > 1 && (
              <p className="field-hint">
                {shareWith.length}人に出します。
                <strong>全員ぶんの「前に出した英文」と照合します。</strong>
              </p>
            )}
          </>
        )}
      </fieldset>
      )}

      {/* **弱点タグも、ほかの欄と同じ囲みの中に置く**(2026-08 利用者の指定)。
          > そして上の余白を他の部分と同じにして
          ここだけ `.material-fields` の外にあったので、上の余白も
          題と中身の隙間も、ほかの欄と違っていた。
          **説明の文は置かない。** 題だけで分かる */}
      <fieldset className="field" ref={tagRef}>
        <legend>弱点タグ</legend>
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} />
      </fieldset>
      </div>{/* .material-fields ここまで */}

      <div className="generate-box">
        <h3 className="card-title">AI に下書きを作らせる</h3>
        <p className="tip card-hint">
          {/* 記事・会話では弱点タグは任意。ここで「1つ選んでから」と書くと
              すぐ下の「任意です」と食い違い、どちらが本当か分からなくなる */}
          {isPassageKind(kind)
            ? '種類・場面・レベル・業界は、上で選んだものがそのまま反映されます。'
            : <>上の<strong>弱点タグを1つ</strong>選んでから押してください。 レベルと業界も自動で反映されます。</>}
          {isDrillKind(kind) && ' 文型ドリルは 4演習 × 10問 = 40問 作ります。'}
        </p>
        <p className="tip card-hint">
          {isPassageKind(kind)
            ? '弱点タグは任意です。選ぶと、その表現が本文の中に自然に何度も出るように作ります。'
              + '選ばなくても読み物としては成立します。'
            : `弱点は1〜${MAX_TAGS}つ選べます。`}
          {!isPassageKind(kind) && (tagIds.length <= 1
            ? '1つだけ選ぶと、その弱点に絞った教材になります(実物のドリルと同じ形)。'
            : `${tagIds.length}つ選んだので、混合ドリルになります。`)}
        </p>
        {!isPassageKind(kind) && tagIds.length > 1 && (
          <p className="card-hint">
            {planNow().reduce((n, s2) => n + s2.count, 0)} 問を
            {tagIds.map(weaknessTagLabel).join(' / ')} に分け、
            <strong>交互に並べます。</strong>
            まとめて並べると、その間は1つの弱点だけ見ていればよく、
            意識が分散した状態で注意を保つ練習になりません。
            どの問題がどの弱点かは、1問ごとに記録します。
          </p>
        )}
        {isPassageKind(kind) && (
          <p className="tip card-hint">
            {/* **貼った原稿があれば、そう言う。** 「作ります」と出ていると、
                書き直されるのではないかと思わせる */}
            {scriptParts.length ? (
              <>
                <strong>貼った原稿を、そのまま本文にします。</strong>
                {scriptParts.length} 段落。
                <strong>AI は本文を書き直しません。</strong>
                シャドーイングやオーバーラッピングは、この本文に対して行います。
              </>
            ) : (
              <>
                <strong>本文は1本まるごと作ります。</strong>
                短い英文を並べるのではなく、前を受けて話が進む
                {bodyWord(kind)}になります
                {/* **数え方は種類で変わる。** 会話だけが「発言」である */}
                (およそ {isDialogueKind(kind) ? '14発言' : '250〜350語'})。
                シャドーイングやオーバーラッピングは、この本文に対して行います。
              </>
            )}
          </p>
        )}

        {/* ── 内容理解・語句をどれだけ作るか ──────────────────────
            2026-09 利用者の指定。

              > 内容理解の質問を増やしたいとき、語句を増やしたいときは
              > 教材作成のところで指定できるようにしてください。
              > ディフォルトの数またはその倍という感じの2パターン

            **本文は増やさない。** あちらの数は段落・発言の数なので、
            増やすと読み物の長さそのものが変わる(`SCALABLE_SECTIONS`)。
            **細かい数は選ばせない。** 標準か倍かの2つで足りる。 */}
        {/* **入れるかどうかも選べる**(2026-09 利用者の指定)。

              > どの問題が何問必要なのかを都度選択できる設計にしてください。
              > 今は数だけ変更できる問題を、チェックによって入れるか
              > 入れないかも決めれるように。

            **並べるのは「既定の構成」のほう**(`defaultSectionsFor`)。
            `planNow()` は外したものが消えているので、そちらを並べると
            **一度外した演習が画面から消えて、戻せなくなる。** */}
        {defaultSectionsFor(kind).some((s2) => SCALABLE_SECTIONS.includes(s2.exercise_type)) && (
          <div className="amount-row">
            {defaultSectionsFor(kind)
              .filter((s2) => SCALABLE_SECTIONS.includes(s2.exercise_type))
              .map((s2) => {
                const base = s2.count
                const now = amounts[s2.exercise_type] ?? 'default'
                const on = isIncluded(s2.exercise_type, include)
                /* **最後の1つは外せない。** 全部外すと作るものが無くなる。
                   記事・会話は本文が必ず残るので、ここが効くのは
                   文型ドリル(4つとも外せる)のときだけである */
                const last = on && planNow().length <= 1
                return (
                  <div key={s2.exercise_type}
                       className={`amount-pick${on ? '' : ' is-off'}`}>
                    <label className="amount-label">
                      <input type="checkbox" checked={on} disabled={last}
                             onChange={() => setInclude({
                               ...include, [s2.exercise_type]: !on,
                             })} />
                      <span>{exerciseLabel(s2.exercise_type)}</span>
                    </label>
                    {/* **入れない演習に、問数の切り替えを出さない。**
                        効かない操作を見せると、押して確かめることになる */}
                    {on ? (
                      <div className="theme-switch" role="group"
                           aria-label={`${exerciseLabel(s2.exercise_type)}の数`}>
                        {/* **3倍(30問)が出るのは文型ドリルだけ**(2026-09)。
                            弱点が3つまで選べるので、1つあたり10問にすると30問になる */}
                        {amountsFor(s2.exercise_type).map((a) => (
                          <button key={a.id} type="button"
                                  className={`theme-btn${now === a.id ? ' is-active' : ''}`}
                                  aria-pressed={now === a.id}
                                  onClick={() => setAmounts({
                                    ...amounts, [s2.exercise_type]: a.id,
                                  })}>
                            {a.label}
                            <span className="amount-count">
                              {Math.min(base * a.times, MAX_ITEMS)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="amount-off">入れません</span>
                    )}
                  </div>
                )
              })}
          </div>
        )}
        <p className="tip field-hint">
          チェックを外した演習は作りません。
          {isPassageKind(kind)
            ? `${bodyWord(kind)}の本文は必ず入ります。`
            : '最後の1つは外せません(作るものが無くなるため)。'}
        </p>

        {/* ── **文法解説を作るかどうか**(第5.213節・2026-09 利用者の指定)──

              > 文法解説をつけるかつけないかを教材を作る時に指定できると最高です

            **既定は「作る」。** いままで必ず作っていたので、既定で外すと
            **黙って機能が減る**(CLAUDE.md「既定を下げない」)。

            **解説が1つも付かない構成では出さない**(効かない操作を見せない)。
            単語だけの教材がそれで —— 1語に S も V も無いためである
            (`grammarFrom` が `null`・第5.210節)。

            **押す前に、件数と金額を出す**(CLAUDE.md「見えない費用は
            管理できない」)。ここは作る前なので**1問1文として**の見積もりで、
            長い段落は数文に切れる。だから「およそ」と書く。 */}
        {grammarCount() > 0 && (
          <>
            <label className="amount-label">
              <input type="checkbox" checked={withGrammar}
                     onChange={() => setWithGrammar((v) => !v)} />
              <span>文法解説も作る(SVOC と修飾要素)</span>
            </label>
            <p className="tip field-hint">
              {withGrammar
                ? `${grammarCount()} 件ぶん、およそ ${grammarGuessYen(grammarCount())} 円`
                  + 'かかります(1問1文として見積もっています)。'
                  + '文ごとに S / V / O / C と修飾要素の札が付き、'
                  + 'レッスン表示の「文法を見る」から開けます'
                : '作りません。そのぶん課金されません。'
                  + 'あとから「セッションで使う」を開いたときに、裏で作られます'}
            </p>
          </>
        )}

        {/* ── 文型ドリルで使う語を、単語帳から絞って選ぶ ──────────
            2026-09 利用者の指定:
              > 文型トレーニングに、どの単語帳からどのレベルのどの品詞を
              > 使用するか、を指定できるようにしたい。

            **新しい仕組みを1つも作っていない。** 選んだ語は、すぐ下の
            「必ず入れます」の一覧(`mustUse`)に足されるだけである。
            **文型ドリルにだけ出す**(言われた場所だけを直す)。 */}
        {drillOn && (
          <div className="review-box">
            <p className="field-hint">
              <strong>単語帳から、使う語を選ぶ。</strong>
              レベルと品詞で絞って、その中から選んだ語を下の一覧に足します。
              <br />
              選んだ語は、4つの演習に分けて渡します。
              <strong>AI は1回も呼びません(0円)。</strong>
            </p>

            <div className="wbfilter">
              <label className="wbfilter-row">
                <span className="wbfilter-name">単語帳</span>
                <select className="wbfilter-ctl" value={book}
                        onChange={(e) => { setWordBook(e.target.value); setWordNote('') }}>
                  {wordBooks.map((b) => (
                    <option key={b.id} value={b.id} title={b.hint}>{b.label}</option>
                  ))}
                </select>
              </label>

              {/* **業種べつは、この教材の業界から始める。** 選び直せる */}
              {book === 'shelf' && (
                <label className="wbfilter-row">
                  <span className="wbfilter-name">業種</span>
                  <select className="wbfilter-ctl" value={shelfId}
                          onChange={(e) => { setWordShelf(e.target.value); setWordNote('') }}>
                    {shelfList().map((sh) => (
                      <option key={sh.id} value={sh.id}>{shelfLabel(sh.id)}</option>
                    ))}
                  </select>
                </label>
              )}

              {book === 'basic' && (
                <label className="wbfilter-row">
                  <span className="wbfilter-name">段</span>
                  <select className="wbfilter-ctl" value={wordTier}
                          onChange={(e) => { setWordTier(e.target.value); setWordNote('') }}>
                    {BASIC_TIERS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* **選べるものが1つ以下の欄は出さない**(`optionsOf`)。
                  基礎単語はレベルを持たないので、ここは出ない */}
              {wordLevels.length > 0 && (
                <label className="wbfilter-row">
                  <span className="wbfilter-name">レベル</span>
                  <select className="wbfilter-ctl" value={lv}
                          onChange={(e) => { setWordLevel(e.target.value); setWordNote('') }}>
                    <option value="">すべて</option>
                    {wordLevels.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}({o.count} 語)</option>
                    ))}
                  </select>
                </label>
              )}

              {wordPoss.length > 0 && (
                <label className="wbfilter-row">
                  <span className="wbfilter-name">品詞</span>
                  <select className="wbfilter-ctl" value={ps}
                          onChange={(e) => { setWordPos(e.target.value); setWordNote('') }}>
                    <option value="">すべて</option>
                    {wordPoss.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}({o.count} 語)</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="wbfilter-row">
                <span className="wbfilter-name">何語使うか</span>
                <select className="wbfilter-ctl" value={wordCount}
                        onChange={(e) => setWordCount(Number(e.target.value))}>
                  {DRILL_COUNTS.map((n) => (
                    <option key={n} value={n}>{n} 語</option>
                  ))}
                </select>
              </label>
            </div>

            {/* **押す前に、何語あるかを出す。** 0 なら押せない
                (効かない操作を見せない)。読めなかったことを
                「0語」と同じ見た目にしない */}
            {wordBusy ? (
              <p className="field-hint">単語帳を読んでいます…</p>
            ) : wordError ? (
              <p className="notice notice--warn">
                単語帳を読めませんでした。{String(wordError)}
              </p>
            ) : (
              <>
                <p className="field-hint">
                  この条件に当てはまる語は <strong>{wordHit} 語</strong>あります。
                  {wordHit > 0 && ` この中から ${Math.min(wordCount, wordHit)} 語を選びます。`}
                </p>
                <div className="btn-row">
                  <button type="button" className="btn btn--small btn--quiet"
                          disabled={wordHit === 0}
                          onClick={addDrillWords}>
                    この条件から語を足す
                  </button>
                </div>
                {wordNote && <p className="field-hint"><strong>{wordNote}</strong></p>}
              </>
            )}
          </div>
        )}

        {/* ── 単語帳から名指しで渡された語 ──────────────────────
            ゲストの単語帳で選んで「この語で教材を作る」を押すと、ここに並ぶ。
            **復習が、そのまま次の宿題になる。** これがこのアプリの要である。
            全部使う必要はないので、1語ずつ外せるようにしておく。
            記事・会話でも効く(本文の中に入れさせる)。 */}
        {mustUse.length > 0 && (
          <div className="review-box">
            <p className="field-hint">
              <strong>単語帳から選んだ {mustUse.length} 語を、必ず入れます。</strong>
              {isVocabKind(kind)
                ? ' 先頭から順に、この語で作らせます。'
                : isPassageKind(kind)
                  ? ' 本文の中で使わせます。'
                  : ' 問題文の中で使わせます。'}
              <br />
              外したい語は ✕ を押してください。
            </p>
            <div className="review-words">
              {mustUse.map((w) => (
                <button key={w} type="button" className="tagchip is-unknown"
                        title="この語を外す"
                        onClick={() => setMustUse(mustUse.filter((x) => x !== w))}>
                  {w} <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── これまでの宿題から復習する ──────────────────────
            毎回まったく新しい語を出していては、定着しない。
            そのゲストが「知らなかった」と付けた語を、先に入れる。
            ゲストを1人だけ選んでいるときにだけ出す。
            **複数人だと「誰の復習か」が決まらない。** */}
        {isVocabKind(kind) && (
          <div className="review-box">
            {shareWith.length !== 1 ? (
              <p className="field-hint">ゲストを1人だけ選ぶと出ます。</p>
            ) : reviewBusy ? (
              <p className="field-hint">これまでの宿題を調べています…</p>
            ) : reviewError ? (
              <p className="notice notice--warn">
                復習する語を読めませんでした。{reviewError}
                <br />
                <strong>0011_vocabulary.sql をまだ実行していないと、この知らせが出ます。</strong>
              </p>
            ) : reviewPool.length === 0 ? (
              <p className="field-hint">
                このゲストには、まだ復習できる語がありません。
                宿題の英文で<strong>「知らなかった」</strong>を付けてもらうと、ここに溜まります。
              </p>
            ) : (
              <>
                <p className="field-hint">
                  <strong>これまでの宿題から復習する。</strong>
                  「知らなかった」と付けた語と、まだ確かめていない語が
                  {reviewPool.length} 語あります。
                </p>
                <label className="review-count">
                  <span>混ぜる語の数</span>
                  <select value={reviewCount}
                          onChange={(e) => setReviewCount(Number(e.target.value))}>
                    {Array.from({ length: reviewPool.length + 1 }, (_, i) => (
                      <option key={i} value={i}>{i} 語</option>
                    ))}
                  </select>
                  <span className="field-hint">
                    残りの{Math.max(0, planNow()
                      .reduce((n, x) => n + x.count, 0) - mergedReview().length)} 語は新しく作ります
                  </span>
                </label>
                <div className="review-words">
                  {reviewPool.slice(0, reviewCount).map((w) => (
                    <span key={w.word}
                          title={w.source === 'due' ? '今日が復習の日です' : ''}
                          className={'tagchip is-static'
                            + (w.source === 'unknown' || w.source === 'due' ? ' is-unknown' : '')
                            + (w.source === 'due' ? ' is-due' : '')}>
                      {w.word}
                    </span>
                  ))}
                </div>
                <p className="field-hint">
                  色の付いた語が「知らなかった」と付けたものです。先に入ります。
                  <strong>★の付いた語は、今日が復習の日です。</strong>
                </p>
              </>
            )}
          </div>
        )}

        <div className="generate-chosen">
          <span className="field-hint">いま選んでいる弱点</span>
          {tagIds.length
            ? (
              <span className="tagpicker-tags">
                {tagIds.map((t) => (
                  <span key={t} className="tagchip is-static">{weaknessTagLabel(t)}</span>
                ))}
              </span>
            )
            : (
              <button
                type="button" className="btn btn--link"
                onClick={() => tagRef.current?.scrollIntoView({
                  block: 'center', behavior: 'smooth',
                })}
              >
                まだ選んでいません(押すと選ぶ場所へ移動します)
              </button>
            )}
        </div>

        {!isPassageKind(kind) && (
          <p className="tip card-hint">
            同じ英文は二度出しません。生成するたびにデータベースと照合し、
            すでに出した文が混じっていれば取り除いて<strong>その分を作り直します。</strong>
            意味が近すぎる文も弾きます。
          </p>
        )}

        <button type="button" className="btn btn--primary"
                onClick={generate} disabled={!!generating || busy}>
          {generating
            ? `作っています… ${generating.label}`
              + `(${generating.done + 1}/${generating.total})${elapsed ? ` ${elapsed}秒` : ''}`
            : done
              // 一度できたあとは「作り直す」。同じ文言のままだと、
              // 押してよいのか分からず、二重に作ってしまう。
              ? `作り直す(いまの下書きは消えます)`
              : isPassageKind(kind)
                /* **貼った原稿があるときは、本文を数に入れない。**
                   作らないものを「作る」と書くと、押す前に分からない。
                   演習をぜんぶ外していれば「この原稿で教材にする」になる */
                ? scriptParts.length
                  ? (planNow().length > 1
                    ? `この原稿で教材にする(${planLabel(planNow().slice(1))})`
                    : 'この原稿で教材にする')
                  : `${bodyWord(kind)}を作る(${planLabel(planNow())})`
                : `下書きを作る(${planNow().reduce((n, s2) => n + s2.count, 0)} 問)`}
        </button>
        {/* **止まるのは、ここを押したときだけ**(2026-09 利用者の指定)。
            画面を離れても、閉じても止まらない */}
        {generating && (
          <button type="button" className="btn btn--quiet generate-cancel"
                  onClick={cancelJob}>
            作るのをやめる
          </button>
        )}
        {generating && (
          <p className="tip field-hint">
            1〜3分かかります。
            <strong>ほかの画面へ移っても、作りつづけます。</strong>
            できあがったら音とお知らせでお伝えします。
          </p>
        )}

        {/*
          できたことを、押したボタンのすぐ下で知らせる。
          ボタンが元に戻るだけでは、失敗したのか成功したのか分からない。
          問数だけでなく最初の1問も出す。数字だけでは中身の有無が分からない。
        */}
        {/* **窓口が古いときは、押した場所で知らせる**(2026-09 実機)。

              > 記事、会話、会議の中で音声の性別と登場人物の性別が
              > あっていないことが多々あることです。

            声に名前を合わせる指定(`speakerGenders`)は渡しているが、
            **窓口を置き直していないと黙って捨てられる。**
            教材は普通にできあがるので、**言わないと誰も気づけない。**
            `speak` と同じ考え方(CLAUDE.md「窓口が古いを先に疑う」)。 */}
        {!generating && genGatewayNote() && (
          <div className="notice notice--warn" role="alert">{genGatewayNote()}</div>
        )}
        {done && !generating && (
          <div className="notice notice--ok generate-done" ref={doneRef}>
            <strong>✓ 下書きができました（全 {done.total} 問）</strong>
            {done.headline && (
              <div className="generate-done-headline" lang="en">{done.headline}</div>
            )}
            <div className="generate-done-parts">
              {done.parts.map((part, i) => (
                <span key={i} className="tagchip is-static">
                  {part.label} {part.count}
                </span>
              ))}
            </div>
            {done.spent && (done.spent.input + done.spent.output) > 0 && (
              <p className="generate-cost">
                この生成にかかった費用 <strong>約 ${estimateCost(done.spent).toFixed(2)}</strong>
                <span className="field-hint">
                  出力 {done.spent.output.toLocaleString()} /
                  入力 {done.spent.input.toLocaleString()}
                  {done.spent.cacheRead > 0
                    && `(うち再利用 ${done.spent.cacheRead.toLocaleString()})`}
                  {' — '}費用のほとんどは出力側です
                </span>
              </p>
            )}
            {done.sample && (
              <p className="generate-done-sample">
                <span className="field-hint">最初の1問</span>
                <span lang="en">{done.sample}</span>
              </p>
            )}
            <div className="btn-row">
              <button type="button" className="btn btn--ghost"
                      onClick={() => setShowEditor(true)}>
                中身をすべて見る
              </button>
              <button type="button" className="btn btn--primary"
                      onClick={() => submitRef.current?.scrollIntoView({
                        block: 'center', behavior: 'smooth',
                      })}>
                このまま発行へ進む
              </button>
            </div>
          </div>
        )}

        {/* 失敗の知らせは、押したボタンのすぐ下に出す。
            以前は画面のいちばん下にあり、スマホでは見えなかった。
            何が起きたか分からないまま終わるのが、いちばん困る。 */}
        {error && (
          <div className="notice notice--warn generate-error" role="alert" ref={errorRef}>
            <strong>作れませんでした。</strong>
            <div>{error}</div>
          </div>
        )}

        <p className="tip field-hint">
          作ったあと、<strong>必ず目を通して直してください。</strong>
          共有した教材は他のトレーナーのゲストにも届きます。
        </p>
      </div>

      {warning && (
        <div className="notice notice--warn">
          <strong>意味の近さの判定が働きませんでした。</strong>
          <div>{warning}</div>
          <p className="field-hint">
            一字一句同じ英文は、これまでどおり弾いています。
            働いていないのは「言い換えただけの文」の判定だけです。
          </p>
        </div>
      )}

      {similarNotes.length > 0 && (
        <div className="notice">
          <strong>意味が近すぎるとして {similarNotes.length} 問を外しました。</strong>
          <ul className="similar-list">
            {similarNotes.slice(0, 8).map((n, i) => (
              <li key={i}>
                <span className="similar-new">{n.sentence}</span>
                <span className="similar-vs">≒</span>
                <span className="similar-old">{n.matched}</span>
                <span className="similar-score">
                  {Math.round((n.similarity ?? 0) * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="field-hint">
            右が、前に出した文です。            近さの境目は調整できます。
          </p>
        </div>
      )}

      <fieldset className="field">
        <legend>
          演習
          <span className="field-hint">
            {sections.length} 種類 / 合計 {totalItems} 問
            {dropped > 0 && ` / 前と同じ・似すぎていた ${dropped} 問は作り直しました`}
            {short > 0 && ` / ${short} 問は足りません(この弱点で英文が出尽くしています)`}
          </span>
        </legend>

        {/* 手入力は「どうしても直したいとき」のためのもの。
            40問を毎回打つことは想定していないので、既定では隠す。 */}
        {!showEditor ? (
          <div className="editor-toggle">
            {totalItems > 0 ? (
              <>
                <p className="card-hint">
                  {sections.map((sec) => `${sectionLabel(kind, sec.exercise_type)} ${sec.items.length}問`)
                    .join(' / ')}
                </p>
                <button type="button" className="btn btn--small btn--ghost"
                        onClick={() => setShowEditor(true)}>
                  中身を見て直す
                </button>
              </>
            ) : (
              <>
                <p className="card-hint">まだ中身がありません。上のボタンで作ってください。</p>
                <button type="button" className="btn btn--link"
                        onClick={() => setShowEditor(true)}>
                  手で入力する
                </button>
              </>
            )}
          </div>
        ) : (
        <>

        {sections.map((sec, si) => {
          const type = exerciseType(sec.exercise_type)
          const fields = type?.fields ?? ['prompt_en']
          return (
            <div key={si} className="exercise-block">
              <div className="exercise-head">
                <span className="exercise-no">{si + 1}</span>
                <select value={sec.exercise_type} onChange={(e) => changeType(si, e.target.value)}>
                  {EXERCISE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                {!type?.audioFrom && (
                  <span className="field-hint">この演習には音声を作りません</span>
                )}
                {sections.length > 1 && (
                  <button type="button" className="btn btn--link"
                          onClick={() => setSections(sections.filter((_, i) => i !== si))}>
                    この演習を削除
                  </button>
                )}
              </div>

              <input className="exercise-instruction" value={sec.instruction}
                     onChange={(e) => patchSection(si, { instruction: e.target.value })}
                     placeholder="この演習の指示文" />

              {sec.items.map((it, ii) => (
                <div key={ii} className="exercise-item">
                  <span className="material-item-no">{ii + 1}</span>
                  <div className="exercise-fields">
                    {fields.map((f) => (
                      /* **選ぶ欄は、打たせない**(第5.230節)。
                         かたまりの分類は7つに決まっているので、
                         手で打つと綴りの違いで札が出なくなる
                         (**効かない操作を見せない**・CLAUDE.md)。
                         一覧は `FIELD_LABELS` 経由で `chunkKinds.js` 1か所から来る */
                      FIELD_LABELS[f]?.options ? (
                        <select key={f} value={it[f] ?? ''}
                                onChange={(e) => patchItem(si, ii, f, e.target.value)}>
                          <option value="">{FIELD_LABELS[f].label}</option>
                          {FIELD_LABELS[f].options.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                      <input key={f} value={it[f] ?? ''} lang={f.endsWith('_en') ? 'en' : undefined}
                             onChange={(e) => patchItem(si, ii, f, e.target.value)}
                             placeholder={`${FIELD_LABELS[f]?.label ?? f} — ${FIELD_LABELS[f]?.placeholder ?? ''}`} />
                      )
                    ))}
                  </div>
                  {sec.items.length > 1 && (
                    <button type="button" className="btn btn--link"
                            onClick={() => patchSection(si, {
                              items: sec.items.filter((_, j) => j !== ii),
                            })}>
                      削除
                    </button>
                  )}
                </div>
              ))}

              <button type="button" className="btn btn--small btn--quiet"
                      onClick={() => patchSection(si, { items: [...sec.items, {}] })}>
                ＋ 設問を追加
              </button>
            </div>
          )
        })}

        <div className="btn-row">
          <button type="button" className="btn btn--small btn--quiet"
                  onClick={() => setSections([...sections, newSection()])}>
            ＋ 演習を追加
          </button>
          <button type="button" className="btn btn--link" onClick={() => setShowEditor(false)}>
            折りたたむ
          </button>
        </div>
        </>
        )}
      </fieldset>

      {/*
        記入欄は既定で閉じておく。並んでいるだけで煩雑に見えるうえ、
        教材名は自動で付き、指導ポイントも生成で入るため、
        ふだんは触らなくてよい(2026-08 の指摘)。
      */}
      <div className="details-box">
        <button type="button" className="btn btn--link"
                onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? '▾ 詳しく設定する(任意)を閉じる' : '▸ 詳しく設定する(任意)'}
        </button>
        {!showDetails && (
          <p className="tip field-hint">
            教材名・取り組み方・指導ポイント
            {/* **「話題」は、もうこの中に無い**(第5.190節で上へ出した) */}
            {isPassageKind(kind) && '・見出し'}
            。ふだんは触らなくて構いません(自動で入ります)。
          </p>
        )}

        {showDetails && (
          <>
            <label className="field">
              <span>
                教材名
              </span>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                     placeholder="作ると自動で入ります" />
            </label>

            {/* **見出しは、スピーチでも要る**(教材の顔になる) */}
            {isPassageKind(kind) && (
              <label className="field">
                <span>
                  見出し
                  <span className="tip field-hint">作ると自動で入ります。直しても構いません</span>
                </span>
                <input type="text" value={headline} lang="en"
                       onChange={(e) => setHeadline(e.target.value)}
                       placeholder="作ると自動で入ります" />
              </label>
            )}

            <label className="field">
              <span>取り組み方(ゲストに見えます・任意)</span>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
                     placeholder="例: to不定詞を「〜すべき」という感覚で捉えること" />
            </label>

            <label className="field">
              <span>
                指導ポイント
              </span>
              <textarea rows={5} value={teachingPoint}
                        onChange={(e) => setTeachingPoint(e.target.value)}
                        placeholder="例: emails to reply to のように、reply to の to を落とさないこと" />
            </label>
          </>
        )}
      </div>

      <fieldset className="field">
        <legend>公開範囲</legend>
        <div className="btn-row">
          <button type="button"
                  className={`btn btn--toggle${visibility === 'school' ? ' is-active' : ''}`}
                  onClick={() => setVisibility('school')}>
            全トレーナーで共有(おすすめ)
          </button>
          <button type="button"
                  className={`btn btn--toggle${visibility === 'private' ? ' is-active' : ''}`}
                  onClick={() => setVisibility('private')}>
            自分だけ
          </button>
        </div>
        <p className="tip field-hint">
          共有すると他のトレーナーも使えます。
        </p>
      </fieldset>

      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={busy} ref={submitRef}>
          {busy
            ? '発行しています…'
            : shareWith.length
              ? `発行して ${shareWith.length}人と共有する`
              : '発行する(共有はあとで)'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>やめる</button>
      </div>
    </form>
  )
}
