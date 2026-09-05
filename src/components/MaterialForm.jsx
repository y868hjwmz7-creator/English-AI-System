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
  defaultSectionsFor, exerciseLabel, exerciseType, isIncluded, sectionsFor,
} from '../data/exerciseTypes.js'
import { groupOf, industriesIn, industryLabel, kindsOf, parentOf } from '../data/industries.js'
import {
  cancelJob, clearJob, currentJob, startJob, takeJobResult, watchJob,
} from '../lib/generateJob.js'
import { weaknessTagLabel, weaknessTags } from '../data/weaknessTags.js'
import {
  NEW_MATERIAL_KINDS, assignMaterial, createMaterial, estimateCost,
  generateChunkJa, generateSection,
  bodyWord, generateSectionUnique, isDialogueKind, isPassageKind, kindLabel,
  loadUsedSentences, normEn,
} from '../lib/materials.js'
import { chunkPlan } from '../lib/chunkJa.js'
import {
  genreHint, genreLabel, genresFor, sceneHint, sceneLabel, scenesFor,
} from '../data/genres.js'
import {
  CLIP_ACCENTS, DEFAULT_ACCENT, MIN_MEETING_SPEAKERS, findVoice, pickVoices,
  speakerCountsFor, voiceCountFor, voicePurposeFor, voicesOfAccent,
} from '../data/clipVoices.js'
import { collectReviewWords, normWord } from '../lib/vocab.js'
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
  const [subject, setSubject] = useState('')           // 話題の指定(任意)
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

  /* **分野を変えたら、場面もその分野のものに入れ替える**(2026-08 利用者の指定)。
     入れ替えないと、外科医の教材に「打ち合わせ前の雑談」が残る。
     いまの場面がその分野にもあれば、そのままにする */
  useEffect(() => {
    const list = scenesFor(industry)
    if (!list.some((x) => x.id === scene)) setScene(list[0]?.id ?? '')
    const gl = genresFor(industry)
    if (!gl.some((x) => x.id === genre)) setGenre(gl[0]?.id ?? '')
    // scene / genre を依存に入れると、選んだそばから書き換わってしまう
  }, [industry])

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
  const castGenders = () => cast
    .map((id) => findVoice(id)?.gender)
    .filter((g) => g === 'male' || g === 'female')

  const reviewLearner = (kind === 'word' || kind === 'phrase') && shareWith.length === 1
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
  const sceneList = scenesFor(industry)
  const genreList = genresFor(industry)

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
    else if (isDialogueKind(kind)) parts.push(sceneLabel(scene))
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
    const { data: used } = await loadUsedSentences(tagIds)

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
      subject,
      // **会話に出す人数**(2026-09 利用者の要望「会議というジャンル」)。
      // 記事には要らないので、会話のときだけ渡す
      speakers: isDialogueKind(kind) ? voiceCount : undefined,
      /* **話す人の性別を、声の並びと同じ順で渡す**(2026-09 利用者の指摘)。
         これが無いと、窓口は名前を自由に付けるので
         「女性の声が男性役をしゃべる」が起きる。
         **声に名前を合わせる**(逆は当てられない) */
      speakerGenders: isDialogueKind(kind) ? castGenders() : undefined,
      avoid: (used ?? []).slice(-40),
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

    // **できあがったものは、その場では画面に入れない。**
    // 別の画面へ移っていることがあるので、いったん仕事の側に置いて、
    // 教材の画面が開いたときに受け取る(`src/lib/generateJob.js`)
    return {
      made, spent,
      headline: body.headline ?? null,
      headlineJa: body.headline_ja ?? null,
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
          // 復習の語は最初の演習にだけ渡す。単語・フレーズは1演習しかない。
          // **単語帳から渡された語(mustUse)が先。** トレーナーが名指しで
          // 選んだものなので、自動で拾った語より優先する
          reviewWords: i === 0 ? mergedReview() : [],
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
        label: exerciseLabel(sec.exercise_type), count: sec.items.length,
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

    /* **画面から切り離して走らせる**(2026-09 利用者の指定)。
         > 教材の作成中に別のところに飛んでもバックグラウンドで
         > 作業が続くようにしてください。
       ここで `await` すると、別の画面へ移った瞬間にこの部品ごと消え、
       返ってきた下書きの行き場が無くなる。仕事の状態は
       `src/lib/generateJob.js` に置く(あちらは画面が消えても残る)。 */
    const plan = planNow()
    const started = startJob({
      title: kindLabel(kind),
      total: isPassageKind(kind) ? plan.length + 1 : plan.length,
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
    visibility, instruction, mustUse,
    // 会話に出す人数(2026-09)。戻ってきたときに2人へ戻っていると、
    // 会議として作ったはずの教材が1対1の会話として保存される
    speakers,
    /* **どの演習をいくつ作ったのかも控える**(2026-09)。
       戻ってきたときにここが初期値へ戻っていると、
       外したはずの演習が「作った」ことになってしまう */
    amounts, include,
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
    if (f.speakers != null) setSpeakers(f.speakers)
    if (f.visibility) setVisibility(f.visibility)
    if (f.instruction != null) setInstruction(f.instruction)
    if (f.mustUse) setMustUse(f.mustUse)
    // **どの演習をいくつ作ったのか**も戻す。ここが初期値のままだと、
    // 外した演習が「作った」ことになり、保存の数と食い違う
    if (f.amounts) setAmounts(f.amounts)
    if (f.include) setInclude(f.include)

    setSections(r.made)
    if (r.headline) setHeadline(r.headline)
    if (r.headlineJa) setHeadlineJa(r.headlineJa)
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    // 教材名は空でよい。日付・弱点・レベルから組み立てる。
    // 必須にすると、AI に作らせるだけの人にも入力を強いることになる。
    const { data, error: message } = await createMaterial({
      title: title.trim() || autoTitle(),
      level, kind, instruction_ja: instruction, teaching_point: teachingPoint,
      visibility, industry, sections, tagIds, createdBy,
      headline, headlineJa,
      genre: kind === 'reading' ? genre : '', scene: isDialogueKind(kind) ? scene : '',
      // **おまかせは、ここで1回だけ決めて保存する。**
      // 開くたびに選び直すと、同じ教材なのに毎回ちがう声になり、
      // そのたびに音声を作り直す(= 課金される)
      voiceIds: cast,
      topic: subject,
    })
    if (message) { setBusy(false); setError(message); return }

    // 上で選んでおいたゲストに、そのまま共有する。
    // 発行と共有が別の操作だと、作ったのに届いていない教材が生まれる。
    let shared = 0
    if (shareWith.length) {
      const { error: shareError } = await assignMaterial({
        materialId: data.id, learnerIds: shareWith, assignedBy: createdBy,
      })
      if (shareError) {
        setBusy(false)
        setError(`教材はできましたが、共有できませんでした: ${shareError}`
          + ' 一覧から共有し直してください。')
        return
      }
      shared = shareWith.length
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
      { id: data.id, sections, voiceIds: cast, tags: tagIds },
      { title: title.trim() || autoTitle(), level },
    )

    onCreated?.(data.id, shared)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
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
            <span className="field-hint">場面と話題が、その種類のものに変わります</span>
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
            <span className="field-hint">業界・趣味と組み合わせて、何の記事にするかが決まります</span>
          </span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {genreList.map((g) => (
              <option key={g.id} value={g.id}>{g.label} — {g.hint}</option>
            ))}
          </select>
        </label>
      )}

      {isDialogueKind(kind) && (
        <label className="field">
          <span>
            シチュエーション
            <span className="field-hint">
              場面によって丁寧さと言い回しが変わります。同じ話題でも別の教材になります
            </span>
          </span>
          <select value={scene} onChange={(e) => setScene(e.target.value)}>
            {sceneList.map((x) => (
              <option key={x.id} value={x.id}>{x.label} — {x.hint}</option>
            ))}
          </select>
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
        <p className="card-hint">
          {/* 記事・会話では弱点タグは任意。ここで「1つ選んでから」と書くと
              すぐ下の「任意です」と食い違い、どちらが本当か分からなくなる */}
          {isPassageKind(kind)
            ? '種類・場面・レベル・業界は、上で選んだものがそのまま反映されます。'
            : <>上の<strong>弱点タグを1つ</strong>選んでから押してください。 レベルと業界も自動で反映されます。</>}
          {kind === 'pattern' && ' 文型ドリルは 4演習 × 10問 = 40問 作ります。'}
        </p>
        <p className="card-hint">
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
          <p className="card-hint">
            <strong>本文は1本まるごと作ります。</strong>
            短い英文を並べるのではなく、前を受けて話が進む
            {bodyWord(kind)}になります
            (およそ {kind === 'reading' ? '250〜350語' : '14発言'})。
            シャドーイングやオーバーラッピングは、この本文に対して行います。
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
        <p className="field-hint">
          チェックを外した演習は作りません。
          {isPassageKind(kind)
            ? `${bodyWord(kind)}の本文は必ず入ります。`
            : '最後の1つは外せません(作るものが無くなるため)。'}
        </p>

        {/* ── 単語帳から名指しで渡された語 ──────────────────────
            ゲストの単語帳で選んで「この語で教材を作る」を押すと、ここに並ぶ。
            **復習が、そのまま次の宿題になる。** これがこのアプリの要である。
            全部使う必要はないので、1語ずつ外せるようにしておく。
            記事・会話でも効く(本文の中に入れさせる)。 */}
        {mustUse.length > 0 && (
          <div className="review-box">
            <p className="field-hint">
              <strong>単語帳から選んだ {mustUse.length} 語を、必ず入れます。</strong>
              {kind === 'word' || kind === 'phrase'
                ? ' 先頭から順に、この語で作らせます。'
                : kind === 'reading' || isDialogueKind(kind)
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
        {(kind === 'word' || kind === 'phrase') && (
          <div className="review-box">
            {shareWith.length !== 1 ? (
              <p className="field-hint">
                これまでの宿題から復習する語を混ぜられます。
                <strong>上でゲストを1人だけ選んでください。</strong>
              </p>
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
          <p className="card-hint">
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
                ? `${bodyWord(kind)}を作る(`
                  + planNow()
                    .map((s2) => `${exerciseLabel(s2.exercise_type)}${s2.count}`).join(' + ')
                  + ')'
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
          <p className="field-hint">
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
              <button type="button" className="btn"
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

        <p className="field-hint">
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
            右が、前に出した文です。外しすぎだと感じたら教えてください。
            近さの境目は調整できます。
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
                  {sections.map((sec) => `${exerciseLabel(sec.exercise_type)} ${sec.items.length}問`)
                    .join(' / ')}
                </p>
                <button type="button" className="btn btn--small"
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
                      <input key={f} value={it[f] ?? ''} lang={f.endsWith('_en') ? 'en' : undefined}
                             onChange={(e) => patchItem(si, ii, f, e.target.value)}
                             placeholder={`${FIELD_LABELS[f]?.label ?? f} — ${FIELD_LABELS[f]?.placeholder ?? ''}`} />
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

              <button type="button" className="btn btn--small"
                      onClick={() => patchSection(si, { items: [...sec.items, {}] })}>
                ＋ 設問を追加
              </button>
            </div>
          )
        })}

        <div className="btn-row">
          <button type="button" className="btn btn--small"
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
          <p className="field-hint">
            教材名・取り組み方・指導ポイント
            {isPassageKind(kind) && '・話題・見出し'}
            。ふだんは触らなくて構いません(自動で入ります)。
          </p>
        )}

        {showDetails && (
          <>
            <label className="field">
              <span>
                教材名
                <span className="field-hint">空のままなら、日付と弱点から自動で付きます</span>
              </span>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                     placeholder="作ると自動で入ります" />
            </label>

            {isPassageKind(kind) && (
              <>
                <label className="field">
                  <span>
                    話題(任意)
                    <span className="field-hint">
                      空のままなら、業界とジャンルに合う話題を AI が決めます
                    </span>
                  </span>
                  <input type="text" value={subject}
                         onChange={(e) => setSubject(e.target.value)}
                         placeholder="例: 生成AIを社内で使うときのルール作り" />
                </label>

                <label className="field">
                  <span>
                    見出し
                    <span className="field-hint">作ると自動で入ります。直しても構いません</span>
                  </span>
                  <input type="text" value={headline} lang="en"
                         onChange={(e) => setHeadline(e.target.value)}
                         placeholder="作ると自動で入ります" />
                </label>
              </>
            )}

            <label className="field">
              <span>取り組み方(ゲストに見えます・任意)</span>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
                     placeholder="例: to不定詞を「〜すべき」という感覚で捉えること" />
            </label>

            <label className="field">
              <span>
                指導ポイント
                <span className="field-hint">
                  この文法全体の勘所。作ると自動で入ります
                </span>
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
        <p className="field-hint">
          共有すると他のトレーナーも使えます。50人で共有すれば、必要な教材が7週でそろいます。
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
        <button type="button" className="btn" onClick={onCancel}>やめる</button>
      </div>
    </form>
  )
}
