/**
 * トレーナーの教材画面。
 *
 * 【設計の要件】(仕様書 第5.5節)
 *   既定の動線は「ライブラリから探す」。新しく作るのは2番目に置く。
 *   逆にすると毎回作ってしまい、再利用率が上がらない。
 *   トレーナー1人あたり週60レッスンを抱えるため、再利用が効かないと
 *   教材づくりに週9時間かかり、この仕組みは回らない。
 */
import { useEffect, useRef, useState } from 'react'
import MaterialForm from './MaterialForm.jsx'
import { parseMaterialTitle } from '../lib/format.js'
import { loadSearchOpen, saveSearchOpen } from '../lib/slashLevel.js'
import LessonView from './LessonView.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import MaterialBody from './MaterialBody.jsx'
import SearchBar from './SearchBar.jsx'
import { CloseIcon, PlusIcon, PrintIcon, ScreenIcon } from './Icons.jsx'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { CEFR_LEVELS, cefrLabel, cefrOption } from '../data/cefr.js'
import {
  SCALABLE_SECTIONS, amountsFor, countLabel, drillBucket,
  exerciseLabel, isPassageSection,
} from '../data/exerciseTypes.js'
import { needsChunkJa } from '../lib/chunkJa.js'
import CastChip from './CastChip.jsx'
import { groupOf, industriesIn, industryLabel, kindsOf, parentOf } from '../data/industries.js'
import {
  NEW_MATERIAL_KINDS, addChunkJa, assignMaterial, duplicateMaterial, isDialogueKind,
  kindLabel, loadMyLearners, searchMaterials, setMaterialVoices,
} from '../lib/materials.js'
import { genresFor, scenesFor } from '../data/genres.js'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import { prefetchGlosses } from '../lib/vocab.js'
import { startPrepare, startPrepareAll } from '../lib/prepareJob.js'
import { printElement } from '../lib/print.js'
import { clearMaterialProgress, hasMaterialProgress } from '../lib/progress.js'
/* **読み上げ音声を作り直す**(2026-09 実機)。良い段の場所に標準の声が
   居座っている英文を、こちらから作り直させる(`remakeClips.js` の冒頭) */
import { premiumClipsOf, remakeMaterialClips } from '../lib/remakeClips.js'
import VoiceRemake from './VoiceRemake.jsx'
/* **音声を1本にまとめて渡す**(2026-09 利用者の指定)。
   すでにある MP3 を集めてつなぐだけで、窓口は呼ばない(課金しない) */
import { downloadMaterialAudio, materialAudioClips } from '../lib/downloadAudio.js'
import { lastClipDetail } from '../lib/audioClips.js'

/** 絞り込みの「問数」と、作る画面の増やし方の対応。**2か所に持たない** */
const AMOUNT_BY_SIZE = { 20: 'double', 30: 'triple' }

export default function TrainerMaterials({ me, askCreate = 0 }) {
  const [mode, setMode] = useState('search')      // 'search' | 'create'
  /* **発行した直後の教材**(2026-09 利用者の指定)。
       > 教材を発行した直後、発行した教材が画面上に来るように調整して
       > ください。今は全然違う場所に飛ばされ、上までスクロールして
       > 戻る必要があります。
     一覧は新しい順に並ぶが、**絞り込みや並び順によっては下のほうに出る。**
     id を控えて、読み直したあとにそこまで送る */
  const [justId, setJustId] = useState(null)
  const [tagIds, setTagIds] = useState([])
  const [level, setLevel] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [industry, setIndustry] = useState('')
  const [kind, setKind] = useState('')         // 教材の種類で絞る
  const [genre, setGenre] = useState('')       // 記事のジャンル
  const [scene, setScene] = useState('')       // 会話の場面
  const [sort, setSort] = useState('new')      // 並び順
  /* **1つの演習の問数で絞る**(2026-09 利用者の指定)。
       > 各ページの問題数を10、20の2つで調整(中略)絞り込みでも指定できるように
     手元で絞る。**表も列も増やさない**(数は取ってきた教材から数えられる) */
  const [size, setSize] = useState('')         // '' | '10' | '20'

  /**
   * **いくつ条件が付いているか**(2026-09 利用者の指定)。
   *
   * 絞り込みを畳んだままにしていると、**なぜ1件しか出ないのかが
   * 分からない。** 数だけでも見えていれば、「何かで絞っている」と気づける。
   * 名前で引く言葉(`keyword`)は入力欄がいつも見えているので数えない。
   */
  const filterCount = tagIds.length
    + (level ? 1 : 0) + (kind ? 1 : 0)
    + (industry ? 1 : 0) + (genre ? 1 : 0) + (scene ? 1 : 0)
    + (size ? 1 : 0)

  /** 絞り込みをぜんぶ外す。**1つずつ「すべて」に戻して回らせない** */
  const clearFilters = () => {
    setTagIds([])
    setLevel(null)
    setKind('')
    setIndustry('')
    setGenre('')
    setScene('')
    setSize('')
  }
  /* **開く・閉じるはやめた**(2026-09 利用者の指定)。
     いま持つのは「紙に出している教材」と、記録を消すときの2段だけ */
  const [printId, setPrintId] = useState(null)   // 紙に出している教材
  const [resetAsk, setResetAsk] = useState(null) // 「本当に消す」に変わっている教材
  const [resetDone, setResetDone] = useState(null)
  /* **読み上げ音声を作り直す**(2026-09 実機)。
     「本当に作り直す」の2段にしてある — 押し間違いがそのまま課金になる */
  const [voiceAsk, setVoiceAsk] = useState(null)
  const [voiceBusy, setVoiceBusy] = useState(null)   // {id, done, total}
  const [voiceDone, setVoiceDone] = useState(null)   // {id, done, failed, total}
  /* **音声のダウンロード**(2026-09 利用者の指定)。
     {id, done, total} と、終わったときの知らせ */
  const [dlBusy, setDlBusy] = useState(null)
  const [dlDone, setDlDone] = useState(null)
  // **トレーナー自身の語の記録。** トレーナーも日々英語を学んでいる
  // (2026-08 利用者の指定)。担当ゲストの記録には触れない
  const { statuses: wordStatuses, mark: markWord } = useWordStatuses()
  const [lessonOf, setLessonOf] = useState(null)      // レッスン表示で開いている教材

  const [materials, setMaterials] = useState([])
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * **一覧が長いときも、「作る」に手が届くようにする**(2026-09 利用者の指定)。
   *
   *   > 探した、または絞り込んだ結果が膨大な場合には下までスクロールしないと
   *   > 「新しく作る」ボタンがないのは辛いです。1番下には確保したまま
   *   > 改善してください
   *
   * 「作る」は2か所にある。**さがす箱の中(いちばん上)**と、
   * **一覧のいちばん下**である。ところが36件もあると、どちらも
   * 画面の外に出てしまう時間が長い。
   *
   * そこで、**そのどちらも見えていないあいだだけ**、画面の隅に小さく出す。
   * 見えているときに出すと、同じボタンが2つ並ぶ
   * (**同じことをするボタンを2つ見せない**・CLAUDE.md)。
   *
   * 見えているかどうかは `IntersectionObserver` に数えさせる。
   * **画面を送るたびに位置を測らない**(送るたびの計算は重い)。
   */
  const finderRef = useRef(null)
  const moreRef = useRef(null)
  const [floatMake, setFloatMake] = useState(false)
  useEffect(() => {
    const els = [finderRef.current, moreRef.current].filter(Boolean)
    // 見張れない環境では出さない。**当てにしすぎない**(CLAUDE.md)
    if (!els.length || !window.IntersectionObserver) return undefined
    const seen = new Map()
    const io = new window.IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting))
      setFloatMake(![...seen.values()].some(Boolean))
    })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  /* **`shown` はここでは使えない**(まだ宣言していない・下で作る)。
     見張り直したいのは「いちばん下の作るが出たり消えたりしたとき」なので、
     元になる数と絞り込みを見ておけば足りる */
  }, [loading, materials.length, size])

  // カタマリごとの訳を作っている教材(0021)と、その結果
  const [makingJa, setMakingJa] = useState(null)
  // さがす欄を開いているか。**一度決める設定は覚える**(2026-08 利用者の指定)
  const [searchOpen, setSearchOpen] = useState(loadSearchOpen)
  const [jaDone, setJaDone] = useState({})

  const [assigningId, setAssigningId] = useState(null)   // 配信先を選んでいる教材
  const [picked, setPicked] = useState([])
  const [message, setMessage] = useState(null)

  /* **選ぶ欄は2つ、入れ物は1つ**(作る画面と同じ考え方)。
     いま選んでいるものが「仕事」か「趣味」かは、ここで1回だけ決める */
  /* 分野を変えたら、**その分野に無い場面の絞り込みは外す。**
     残すと、当てはまる教材が1件も無い状態のまま固まる */
  useEffect(() => {
    if (scene && !scenesFor(industry).some((x) => x.id === scene)) setScene('')
    if (genre && !genresFor(industry).some((x) => x.id === genre)) setGenre('')
    // scene / genre を依存に入れると、選んだそばから消えてしまう
  }, [industry])

  const isHobbyFilter = groupOf(industry) === 'hobby'
  /* **種類のある分野は2段で選ぶ**(作る画面と同じ形)。
     「全般」を選ぶと、その中の種類の教材もまとめて出る
     (`searchMaterials`)。コンサルを選んで建設・車が出てこないのでは
     全般を選んだ意味がない */
  const topIndustry = industry ? parentOf(industry) : ''
  const industryKinds = kindsOf(topIndustry)
  const isWorkFilter = Boolean(industry) && !isHobbyFilter

  const search = async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await searchMaterials({
      tagIds, level, keyword, industry,
      kind: kind || null,
      genre: kind === 'reading' ? (genre || null) : null,
      scene: isDialogueKind(kind) ? (scene || null) : null,
    })
    setLoading(false)
    if (e) { setError(e); return }
    setMaterials(data)
  }

  // 絞り込みが変わったら探し直す。search 自体は毎回作り直されるので依存に入れない。
  useEffect(() => { search() }, [tagIds, level, industry, kind, genre, scene])

  /* **「発行する画面へ」で来たら、作る画面を開く**(2026-09 利用者の指定)。
     下書きは `MaterialForm` が受け取る(走っている仕事を見張っている)ので、
     ここは**開くだけ**でよい。開いたあと、あちらが
     「できました」の知らせまで画面を送る。
     **0 のときは何もしない**(ふつうに教材の画面を開いただけのとき) */
  useEffect(() => {
    if (!askCreate) return
    setMode('create')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [askCreate])

  /* **発行した教材まで画面を送る**(2026-09 利用者の指定)。
     一覧を読み直したあとに動かす — 読み直す前に送っても、
     まだそのカードが描かれていない。
     **送ったら印を消す**(次に一覧を読み直したときにまた飛ばない) */
  useEffect(() => {
    if (!justId || loading) return
    const el = document.querySelector(`[data-mid="${justId}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // **どれが今のものか、目でも分かるようにする。**
    // 送っただけでは、同じ形のカードが並ぶ中で見分けられない
    const timer = window.setTimeout(() => setJustId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [justId, loading, materials])

  /* 「誰がどの声で読むか」は **`CastChip`(`castList()`)1か所。**
     画面に書くと、素の node で一度も確かめられない
     (`npm run test:voice` が見張っている) */

  /** 本文があって、まだカタマリごとの訳が入っていない教材か(0021) */
  // **判断は `chunkJa.js` の `needsChunkJa()` 1か所。** 画面に持たない
  const needsJa = (m) => (m.sections ?? [])
    .filter((sec) => isPassageSection(sec.exercise_type))
    .flatMap((sec) => sec.items ?? [])
    .some(needsChunkJa)

  /**
   * カタマリごとの訳を作って控える(0021)。
   *
   * **何が起きるか**を、押す前に title で、押したあとに結果で伝える。
   * 触るのは `material_items.chunks` の1列だけで、本文・設問・配信には触れない。
   */
  const makeChunkJa = async (m) => {
    setMakingJa(m.id)
    setJaDone((v) => ({ ...v, [m.id]: null }))
    const { data, error: e } = await addChunkJa(m)
    setMakingJa(null)
    // **失敗したときだけ知らせる。** うまくいったときは、
    // ただ訳が出るようになるだけでよい(押していないので、報告する相手がいない)
    if (e) { setJaDone((v) => ({ ...v, [m.id]: { ng: true, text: e } })); return }
    if (!data.made) return
    await search()   // 控えたものを画面に反映する
  }

  /**
   * **カタマリごとの訳は、押させない。開いたら裏で作る**(2026-08 利用者の指定)。
   *
   *   > 「区切りの訳を作る」はそもそも無くしてください。教材を作った時点で
   *   > 区切りの訳がバックグラウンドで生成されるデザインの方が良いです。
   *
   * 作るときには `MaterialForm` が一緒に作っている。ここで拾うのは
   * **それより前に作った教材**だけである(0021 より前のもの)。
   *
   * 【止まる条件を持たせる】(CLAUDE.md)
   *   1つの教材につき**この画面を開いているあいだ1回だけ。**
   *   失敗しても繰り返さない。残高が切れているときに、開くたび呼び続けない。
   */
  /**
   * **紙に出す。** 中身は印刷する一瞬だけ描いてあるので、
   * 描き終わってから `printElement` を呼ぶ(`useEffect`)。
   * ボタンの中で直接呼ぶと、描き替わる前の画面が紙になる(CLAUDE.md)。
   */
  useEffect(() => {
    if (!printId) return undefined
    const el = document.getElementById(`material-${printId}`)
    if (!el) { setPrintId(null); return undefined }
    const done = () => setPrintId(null)
    window.addEventListener('afterprint', done)
    const timer = window.setTimeout(done, 60000)
    printElement(el)
    return () => {
      window.removeEventListener('afterprint', done)
      window.clearTimeout(timer)
    }
  }, [printId])

  const triedJa = useRef(new Set())
  useEffect(() => {
    // **開閉が無くなったので、使うとき(セッションで使う・印刷)に拾う**
    // (2026-09)。以前は「開いたとき」も見ていたが、開くこと自体が無くなった
    const id = printId || lessonOf?.id
    if (!id) return
    const m = materials.find((x) => x.id === id) ?? (lessonOf?.id === id ? lessonOf : null)
    if (!m || !needsJa(m) || triedJa.current.has(m.id)) return
    triedJa.current.add(m.id)
    makeChunkJa(m)
  }, [printId, lessonOf, materials])

  /**
   * **中身を開いた時点で、まだ控えに無い語を裏で引いておく**(2026-08 実機)。
   *
   *   > 単語の意味ですが、やはり初めて調べた時に3-5秒ほどかかるので
   *   > レッスンの時間が無駄になります。
   *
   * 先読みは「レッスンで使う」(`LessonView`)と「本文の練習」
   * (`PassagePractice`)にしか入っておらず、**この画面には無かった。**
   * 英文が出る場所は4つある(CLAUDE.md)。ここもその1つである。
   *
   * `prefetchGlosses` の側が「同じ語を二度引かない」を見ているので、
   * ここでは開いた教材を渡すだけでよい。
   */
  useEffect(() => {
    // **開閉をやめたので、「セッションで使う」で開いたときに拾う**(2026-09)。
    // `LessonView` の中でも先読みしているが、ここで先に始めておくと、
    // 開いた直後に触れた語でも待たされない
    const m = materials.find((x) => x.id === lessonOf?.id)
    if (!m) return
    const texts = m.sections.flatMap((sec) => sec.items
      .map((it) => it.prompt_en || it.question || '')
      .filter(Boolean)
      .map((text) => ({ text })))
    prefetchGlosses(texts, { level: m.level })
    /* **読み上げ音声も、ここで支度しておく**(2026-09 利用者の指定)。
     *
     *   > 初めて再生するときの待ち時間が３０秒近くあり…
     *
     * 発行のときにも支度している(`MaterialForm`)が、
     * **それより前に作った教材には、まだ音声が無い。**
     * 「セッションで使う」は「これから使う」という合図なので、
     * ここで用意しておけば、Listen を押したときには鳴り始められる。
     *
     * **費用は増えない。** どのみち初めて押したときに作られるものを、
     * 早めに作っているだけである(`prepareJob.js` が同じ教材を二度やらない)。 */
    startPrepare(m, { title: m.title, level: m.level })
  }, [lessonOf, materials])

  /* **過去に作った教材も、裏で順に支度する**(2026-09 利用者の指定)。
   *
   *   > 過去に作成したものも常にバックグラウンドで再生準備を
   *   > 進められないでしょうか？
   *
   * いま一覧に出ているものを、まるごと順番待ちに積む。
   * **1本ずつしか走らない**ので、押しっぱなしにはならないし、
   * **すでに音声がある教材は問い合わせだけで終わる**(1円もかからない)。
   *
   * **止めたいときは帯の「支度をやめる」**、そもそも自動でやりたくない
   * ときは**左のメニューの下**で切り替えられる(`prepareAllOn`)。 */
  useEffect(() => {
    if (loading || !materials.length) return
    startPrepareAll(materials)
  }, [loading, materials])

  // 訳を作り直したら、**開いたままのレッスン表示にも反映する。**
  // 反映しないと、閉じて開き直すまで古い訳のままになる(2026-08)
  useEffect(() => {
    if (!lessonOf) return
    const fresh = materials.find((x) => x.id === lessonOf.id)
    if (fresh && fresh !== lessonOf) setLessonOf(fresh)
  }, [materials, lessonOf])

  useEffect(() => {
    loadMyLearners().then(({ data, error: e }) => {
      if (e) setError(e)
      else setLearners(data)
    })
  }, [])

  /**
   * その教材の読み上げ音声を作り直す(2026-09 実機 → 利用者の指定で作り替え)。
   *
   *   > 音声を作り直す際も、国とスピーカーを選択できるようにしてください。
   *   > そして、元あるものも残せるようにしたいです。
   *
   * **2段のままである。** 1回目で欄が開き(`VoiceRemake`)、
   * 国と話す人を選んでから、その中のボタンで走り出す。
   * 押し間違いがそのまま課金になるので、**1回では走らせない。**
   */
  const runRemake = async (m, { voiceIds, mode, accentName }) => {
    setVoiceAsk(null)
    setVoiceDone(null)
    setVoiceBusy({ id: m.id, done: 0, total: premiumClipsOf(m).length })

    /* **声を先に決めてから、音声を作る。**
       逆にすると、作った音声の置き場所と教材の声が食い違う。
       `refresh`(声を変えていない)のときは、教材に手を触れない */
    let target = { ...m, voiceIds }
    if (mode === 'copy') {
      const { data, error: e } = await duplicateMaterial(m, {
        voiceIds, accentName, createdBy: me.id,
      })
      if (e) { setVoiceBusy(null); setVoiceDone({ id: m.id, done: 0, failed: 0, total: 0, detail: e }); return }
      target = { ...m, id: data.id, voiceIds }
    } else if (mode === 'replace') {
      const { error: e } = await setMaterialVoices(m.id, voiceIds)
      if (e) { setVoiceBusy(null); setVoiceDone({ id: m.id, done: 0, failed: 0, total: 0, detail: e }); return }
    }

    const r = await remakeMaterialClips(target, ({ done, total }) => {
      setVoiceBusy({ id: m.id, done, total })
    })
    setVoiceBusy(null)
    /* **1本も作り直せなかったときは、理由まで出す。**
       トレーナーの画面なので、どこで何をすればよいかまで書いてよい
       (ゲストには出さない・CLAUDE.md) */
    setVoiceDone({
      id: m.id, ...r, copied: mode === 'copy',
      detail: r.done === 0 ? lastClipDetail() : null,
    })
    /* **一覧を読み直して、できたものを目の前に出す**(発行と同じ作法)。
       複製は新しい1本なので、読み直さないと画面に出てこない */
    if (mode === 'copy') setJustId(target.id)
    await search()
  }

  /**
   * その教材の音声を、**1本の MP3 にまとめて渡す**(2026-09 利用者の指定)。
   *
   *   > 各教材の音声をダウンロード出来るようにしてください。
   *   > 全体の音声をひとつ。
   *
   * **すでにある MP3 を集めてつなぐだけ。** 窓口(`speak`)は呼ばないので
   * **1円もかからない。** まだ作られていない英文があったら、その場では
   * こしらえず、**何本足りないかを伝える**(見えない費用は管理できない)。
   */
  const downloadAudio = async (m) => {
    setDlDone(null)
    setDlBusy({ id: m.id, done: 0, total: materialAudioClips(m).length })
    let r
    try {
      r = await downloadMaterialAudio(m, ({ done, total }) => {
        setDlBusy({ id: m.id, done, total })
      })
    } catch (e) {
      r = { ok: false, total: 0, missing: 0, error: String(e?.message ?? e) }
    }
    setDlBusy(null)
    setDlDone({ id: m.id, ...r })
  }

  const startAssign = (materialId) => {
    setAssigningId(materialId)
    setPicked([])
    setMessage(null)
  }

  const doAssign = async () => {
    const { data, error: e } = await assignMaterial({
      materialId: assigningId, learnerIds: picked, assignedBy: me.id,
    })
    if (e) { setError(e); return }
    setError(null)
    setMessage(`${data.count} 人と共有しました。`)
    setAssigningId(null)
    setPicked([])
  }

  if (mode === 'create') {
    return (
      // さがすときに選んだ条件を、そのまま作成画面へ引き継ぐ。
      // 「探して → 無ければ作る」が既定の動線なので(第5.5節)、
      // ここで指定が消えると、同じことを2度入力させることになる。
      // **この画面にある指定は全部渡す。** 弱点だけ渡して種類を渡さなかったため、
      // ダイアローグを選んで作成に移ると文型トレーニングに戻っていた(2026-08)。
      <MaterialForm
        createdBy={me.id}
        learners={learners.filter((l) => l.status === 'active')}
        // **絞り込みの項目を足したら、`initial` にも必ず足す**(CLAUDE.md)
        initial={{
          tagIds, level: level ?? '', industry, kind, genre, scene,
          /* 「20問」で絞っていたなら、作る画面も20問で始める。
             **絞り込みの項目を足したら `initial` にも足す**(CLAUDE.md) */
          /* **その演習で選べない増やし方は渡さない。**
             3倍(30問)は文型ドリルだけなので、記事・会話の設問には
             倍までにする(選べるかどうかは `amountsFor()` 1か所) */
          amounts: AMOUNT_BY_SIZE[size]
            ? Object.fromEntries(SCALABLE_SECTIONS.map((t) => {
              const want = AMOUNT_BY_SIZE[size]
              const ok = amountsFor(t).some((a) => a.id === want)
              return [t, ok ? want : 'double']
            }))
            : {},
        }}
        onCancel={() => setMode('search')}
        onCreated={(id, shared) => {
          setMode('search')
          setMessage(shared
            ? `教材を発行し、${shared}人と共有しました。`
            : '教材を発行しました。一覧から共有できます。')
          /* **発行したものを、目の前に出す**(2026-09 利用者の指定)。
             読み直しが終わってから送るので、ここでは印を付けるだけ */
          setJustId(id)
          search()
        }}
      />
    )
  }

  /* 1つの演習の問数で絞る(2026-09 利用者の指定)。**手元で絞る。**
     数は取ってきた教材から数えられるので、表も列も増やさない。
     数え方は `drillBucket()` 1か所(`exerciseTypes.js`)。 */
  const shown = size
    ? materials.filter((m) => drillBucket(m.sections) === size)
    : materials

  // 並べ替え。探しやすさは、絞り込みと並び順の両方で決まる。
  const sorted = [...shown].sort((a, b) => {
    if (sort === 'items') return b.itemCount - a.itemCount
    if (sort === 'title') return a.title.localeCompare(b.title, 'ja')
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const active = learners.filter((l) => l.status === 'active')
  const notActive = learners.filter((l) => l.status !== 'active')

  return (
    <div className="stack">
      {lessonOf && (
        /* **「教材」画面はトレーナー自身のもの**(2026-08 利用者の確認)。
           > トレーナーが「教材」画面で自分のために触った語は、
           > これまでどおりトレーナー自身の記録でよいですか → はい */
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    wordStatuses={wordStatuses} onMarkWord={markWord} />
      )}
      {/* ── 教材をさがす箱(2026-09 利用者の指定)──────────────────

            > 教材をさがす、作るの欄で条件を入れると教材が絞り込まれますが、
            > UIがわかりにくいです。「探す🔍」「条件で絞り込む」「作る」の
            > 3つをベースにしつつ、絞り込み、検索結果内にも
            > 「ないので作る」のボタンを配置してください

          **できることを3つに言い切る。**
            ① 探す      … 名前・見出しで引く(いつも見えている)
            ② 条件で絞り込む … レベル・種類・分野・弱点(畳める)
            ③ 作る      … 見つからなかったときに押す

          以前は「教材をさがす・作る」という1つの箱の中に条件の欄が入り、
          さがす入力欄はその外にあった。**同じ「さがす」が2か所に分かれ、
          「作る」は名前だけあってボタンが無い**ので、何をする欄なのかが
          読み取れなかった。3つを1つの箱にまとめ、名前を付けて並べる。 */}
      <section className="card finder" ref={finderRef}>
        <div className="finder-head">
          <h2 className="card-title">教材をさがす</h2>
          {/* ③ 作る。**いつも見えるところに置く**(押せる場所が分かる) */}
          <button type="button" className="btn btn--small"
                  onClick={() => setMode('create')}>
            <PlusIcon />教材を作る
          </button>
        </div>

        {/* ① 探す。**いちばんよく使う操作なので、畳まない** */}
        <SearchBar
          keyword={keyword}
          onKeyword={setKeyword}
          onSearch={search}
          placeholder="教材名・見出しでさがす"
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { id: 'new', label: '新しい順' },
            { id: 'items', label: '問数の多い順' },
            { id: 'title', label: '名前順' },
          ]}
          count={loading ? null : shown.length}
        />

        {/* ② 条件で絞り込む。**畳める。開け閉めは覚える**
            (一度決める設定は覚える・CLAUDE.md)。
            **いくつ条件が付いているかを、畳んだままでも見せる。**
            そうしないと「なぜ1件しか出ないのか」が分からない */}
        <details className="finder-filters" open={searchOpen}
                 onToggle={(e) => {
                   setSearchOpen(e.currentTarget.open)
                   saveSearchOpen(e.currentTarget.open)
                 }}>
          <summary className="finder-sum">
            条件で絞り込む
            {filterCount > 0 && <span className="finder-badge">{filterCount}</span>}
          </summary>
          {/* **条件を外す道を、条件が付いているときだけ出す。**
              1つずつ「すべて」に戻して回らせない */}
          {filterCount > 0 && (
            <div className="finder-clear">
              <button type="button" className="btn btn--ghost btn--small"
                      onClick={clearFilters}>
                <CloseIcon />絞り込みをぜんぶ外す
              </button>
            </div>
          )}
        {/* **説明の文は置かない**(2026-08 利用者の指定)。
              > 目指すのはUIを見れば何ができるのかが直観的にわかるアプリです。
            欄の名前とプルダウンを見れば、何ができるかは分かる。 */}
        {/* **作る画面(`MaterialForm`)とまったく同じ構成にする**
            (2026-08 利用者の指定)。

              > 教材モードの方のプルダウン周辺の構成はこれと同じにしてください。
              > あと、プルダウンのタイトルも全て同じに。

            以前は `.filter-row` で横に流していたので、題とプルダウンが
            作る画面と別の並びになっていた。**決まりは `.material-fields`
            1か所**(styles.css)なので、片方だけ動くことがない。
            題も「種類」→「トレーニングの種類」にそろえてある。 */}
        <div className="material-fields material-filter">
          <label className="field">
            <span>レベル</span>
            <select value={level ?? ''} onChange={(e) => setLevel(e.target.value || null)}>
              <option value="">すべて</option>
              {CEFR_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>{cefrOption(l.id)}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>トレーニングの種類</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">すべて</option>
              {NEW_MATERIAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>

          {/* **1つの演習の問数**(2026-09 利用者の指定)。
                > 各ページの問題数を10、20の2つで調整できるように(中略)
                > また、絞り込みでも指定できるように
              数は取ってきた教材から数えるので、表も列も増やさない。
              **本文(記事・会話)の段落数・発言数は数えない** */}
          <label className="field">
            <span>
              1つの演習の問数
              <span className="field-hint">記事・会話の段落数は数えません</span>
            </span>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">すべて</option>
              <option value="10">10 問(標準)</option>
              <option value="20">20 問</option>
              <option value="30">30 問</option>
            </select>
          </label>

          {/* **業界と趣味は、プルダウンを2つに分けて左右に並べる**
              (2026-08 利用者の指定)。作る画面と同じ形。
              **入れ物は `materials.industry` の1列のまま。**
              教材が持つ場面は1つなので、片方を選ぶともう片方は空に戻る。 */}
          <div className="field-row">
            <label className="field">
              <span>
                業界
                <span className="field-hint">仕事の場面</span>
              </span>
              <select value={isWorkFilter ? topIndustry : ''}
                      onChange={(e) => setIndustry(e.target.value)}>
                <option value="">すべて</option>
                {industriesIn('work').map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                趣味
                <span className="field-hint">仕事以外の場面</span>
              </span>
              <select value={isHobbyFilter ? topIndustry : ''}
                      onChange={(e) => setIndustry(e.target.value)}>
                <option value="">すべて</option>
                {industriesIn('hobby').map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* 種類。**作る画面と同じ形にそろえる**(2026-09 利用者の指定) */}
          {industryKinds.length > 0 && (
            <label className="field">
              <span>{industryLabel(topIndustry)}の種類</span>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {industryKinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.short}{k.id === topIndustry ? '(種類をまとめて)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* **ゲストで絞る欄は置かない**(2026-08 利用者の指定)。
                > 「ゲスト」の選択はここではしないです。
                > 教材ができてから「ゲストと共有する」があれば十分です */}
          {kind === 'reading' && (
            <label className="field">
              <span>話題</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">すべて</option>
                {/* **話題も、選んだ分野で変わる**(2026-08 利用者の指定)。
                    作る画面と同じ `genresFor()` を使う。2か所に持たない */}
                {genresFor(industry).map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </label>
          )}
          {isDialogueKind(kind) && (
            <label className="field">
              <span>シチュエーション</span>
              <select value={scene} onChange={(e) => setScene(e.target.value)}>
                <option value="">すべて</option>
                {/* **場面は、選んだ分野で変わる**(2026-08 利用者の指定)。
                    作る画面と同じ `scenesFor()` を使う。2か所に持たない */}
                {scenesFor(industry).map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
            </label>
          )}

          {/* **弱点タグは、プルダウンの下に置く**(2026-08 利用者の指定)。
                > 教材モードも弱点タグがプルダウン群の下に来るように。
                > ゲストモードと同じにして
              作る画面(`MaterialForm`)と同じ並びである。
              さがす場面では基礎練習(子音全般・母音全般)も選べる。
              弱点として指摘する場面では出さない(粒度が違うため)。 */}
          <fieldset className="field">
            <legend>弱点タグ</legend>
            <WeaknessTagPicker selected={tagIds} onChange={setTagIds} includeDrills />
          </fieldset>
        </div>
        </details>
      </section>

      {message && <div className="notice notice--ok">{message}</div>}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : shown.length === 0 ? (
        /* **無いときは、作る道をいちばん強く出す**(2026-09 利用者の指定)。
           何も無い画面で「作る」を探させない */
        <div className="card finder-empty">
          <p className="card-hint">
            {filterCount
              ? 'この条件に合う教材はまだありません。最初の1つを作ると、次からは全トレーナーがすぐ使えます。'
              : '教材がまだありません。'}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setMode('create')}>
            <PlusIcon />{filterCount ? 'この条件で教材を作る' : '教材を作る'}
          </button>
        </div>
      ) : (
        <>
          {sorted.map((m) => (
            /* `data-mid` … **発行した直後に、ここまで画面を送る**ための目印
               (2026-09 利用者の指定)。`is-just` は少しのあいだだけ光る */
            <div key={m.id} data-mid={m.id}
                 className={`card material-card${justId === m.id ? ' is-just' : ''}`}>
              {/* **行そのものを押して開く**(2026-08 利用者の指定)。
                  下に「中身を見る」ボタンを置いていたが、1行ぶん場所を取る。
                  宿題の一覧で一度学んだ形にそろえた(▸ / ▾ の印を出す)。 */}
              {/* **見出しのまわりは、押す前からグレーの囲みにする**
                  (2026-08 利用者の指定)。

                  > タップした時にタイトル周りが薄いグレーで囲まれますが、
                  > タップする前からその仕様にしてください。
                  > A2 の下にフレーズ、フレーズと同じ行の右端に日付を入れ、
                  > グレーの囲みに一緒に入れてください。
                  > 上部のグレーの部分を押して開くことは押してみるまで
                  > 分かりません。

                  触る端末では、押したときの色が**押したあとも残る**ため、
                  「押せる場所」が押すまで分からなかった。
                  はじめから囲んでおけば、囲みそのものが目印になる。
                  そのうえで、**何が起きるかを言葉で書く**
                  (「▸ 中身を見る・印刷する」)。囲みだけでは、
                  押すと何が出るのかまでは分からない。 */}
              {/* **開く・閉じるはやめた**(2026-09 利用者の指定)。
                    > わざわざ開いて「印刷・PDFで保存」のボタンを出す
                    > 必要がない、閉じる・開く機能を排除

                  開いても出るのは印刷のボタンだけになっていたので、
                  **開くこと自体が回り道**だった。いまはボタンを
                  はじめから出し、囲みは**ただの見出し**にしてある。 */}
              <div className="material-head">
                <div className="material-open">
                  {/* 見出しは弱点だけ。レベル・業界は小さな札。

                      **弱点を2回出さない**(2026-08 利用者の指定)。
                      以前は下に白い札の行を別に並べていたが、
                      弱点は**教材名の中にすでに入っている。**
                      文型ドリルでは見出しそのもの、記事では小さな札になる。
                      > 弱点ポイントが2回表示されています。
                      > 記事の時に表示されているグレーの部分だけに表示されるよう統一

                      手で名前を付けた教材だけは、教材名から読み取れない。
                      そのときのために `fallbackTags` の先頭に弱点を渡す。 */}
                  <MaterialTitle
                    title={m.title}
                    headline={m.headline}
                    hideDate
                    weakness={m.tagIds.map(weaknessTagLabel).join(' + ')}
                    fallbackTags={[m.tagIds.map(weaknessTagLabel).join(' + '),
                      cefrLabel(m.level), kindLabel(m.kind), industryLabel(m.industry)]}
                  />
                  {/* **カテゴリー名は札の下、日付は同じ行の右端**
                      (2026-08 利用者の指定)。日付は `MaterialTitle` にも
                      出せるが、**2か所に出さない**(`hideDate` を渡してある)。 */}
                  <div className="material-meta">
                    <span className="material-kind">
                      {kindLabel(m.kind)}
                      {m.visibility === 'private' && ' / 自分だけ'}
                    </span>
                    <span className="material-when">{parseMaterialTitle(m.title).date}</span>
                  </div>
                </div>
              </div>

              {m.instruction_ja && <p className="card-hint">{m.instruction_ja}</p>}

              {/* **指導ポイント(ここに注意)は、カードに出さない**
                  (2026-09 利用者の指定)。
                    > 赤で囲った部分は必要ないです。
                    > 教材のあるところ全てで適用してください。(ゲストエンドでも同じ)
                  中身は「セッションで使う(大きく表示)」か印刷で見る。
                  **`TeachingNote` そのものの見た目は変えていない**
                  (2026-08「指示があるまで絶対に変えない」)。出す場所だけの話 */}

              {/* **中身の抜き書きは出さない**(2026-08 利用者の指定)。

                  > 教材の内容の要約のような部分、いらないです。場所を取りすぎです。

                  記事の1段落目をそのまま並べていたので、1件で画面ぜんぶを
                  食っていた。さがす画面は**見比べる**ためのものなので、
                  1件が長いほど見比べにくくなる。
                  中身は、行そのものを押せば開く(▸ / ▾)。

                  何の演習が何問あるかは、教材を選ぶのに要る。
                  **1行に畳んで残す**(2行あった数の行も、これに1本化する)。 */}
              {/* **`<div>` にしてある。** 中に札(`CastChip`)を入れるので、
                  `<p>` のままだと**中身がはみ出して**並びが崩れる
                  (`<p>` に箱を入れると、ブラウザがそこで段落を閉じる) */}
              <div className="muted material-parts">
                {m.sections.map((sec) => (
                  <span key={sec.id}>
                    {exerciseLabel(sec.exercise_type)}
                    {' '}{countLabel(sec.exercise_type, sec.items.length)}
                  </span>
                ))}
                {/* ── 誰がどの声で読むか(2026-09 実機・利用者の指定)────
                      > 読み上げの声、のタブはこの場所ではなく、
                      > 会話14発言の右に、同じ高さくらいのタブで十分です。

                    はじめはグレーの囲みのいちばん上に置いていたが、
                    **教材名より先に目が行っていた。** ふだん読むものではないので、
                    問数の行の右端へ寄せ、**その行と同じ背丈**にする。
                    押して開いたときだけ、次の行に名前が出る */}
                <CastChip material={m} className="cast-chip--inline" />
              </div>

              {/* **押すものは、はじめから出す**(2026-09 利用者の指定)。
                  **強い見た目(青)は「セッションで使う」に譲る**
                  (2026-08 の指定は生きている)。

                  **並びは 印刷 → 練習の記録を消す → 共有**
                  (2026-09 利用者の指定「練習の記録を消す、を印刷ボタンの
                  右に置いてください」)。前の2つは**同じ教材を手元で扱う**
                  操作(紙にする / この端末の書きかけを消す)で、
                  共有だけが**人に渡す**操作である。だから前の2つを1つの行に
                  まとめ、共有はその下に置く(`.card-tools`)。 */}
              <div className="btn-row card-tools">
                <button type="button" className="btn btn--small"
                        onClick={() => setPrintId(m.id)}>
                  <PrintIcon />印刷 / PDFで保存
                </button>
                {/* **やりかけが残っているときだけ出す。**
                    効かないボタンを出さない(CLAUDE.md) */}
                {hasMaterialProgress(m.id) && (
                  <button type="button"
                          className={`btn btn--small ${resetAsk === m.id ? 'btn--quiet' : 'btn--ghost'}`}
                          onClick={() => {
                            if (resetAsk !== m.id) { setResetAsk(m.id); return }
                            const n = clearMaterialProgress(m.id)
                            setResetAsk(null)
                            setResetDone({ id: m.id, n })
                          }}>
                    {resetAsk === m.id ? '本当に消す' : '練習の記録を消す'}
                  </button>
                )}
                {/* **読み上げ音声を作り直す**(2026-09 実機)。

                      > Mika のひとつ目の発言だけ、明らかに ElevenLabs では
                      > ない酷い音声になってしまいます。

                    直す前の窓口が、良い声で作れなかった MP3 を
                    **良い段の場所に置いていた**ため、その英文だけ
                    永久に標準の声のままになる(`remakeClips.js`)。
                    画面は「ある」ものを鳴らすだけなので、放っておいても
                    直らない。**こちらから作り直させる道**を置く。

                    **良い声を使う教材のときだけ出す**(効かない操作を
                    見せない)。**2段にする** — 押し間違いがそのまま課金になる */}
                {/* **音声を1本にまとめて落とす**(2026-09 利用者の指定)。
                    > 各教材の音声をダウンロード出来るようにしてください。
                    > 全体の音声をひとつ。

                    **本文がある教材だけ**に出す(効かない操作を見せない)。
                    すでにある MP3 を集めてつなぐだけなので、**課金されない** */}
                {materialAudioClips(m).length > 0 && (
                  <button type="button" className="btn btn--small btn--ghost"
                          disabled={!!dlBusy}
                          onClick={() => downloadAudio(m)}>
                    {dlBusy?.id === m.id
                      ? `集めています… ${dlBusy.done} / ${dlBusy.total}`
                      : '音声をダウンロード'}
                  </button>
                )}
                {premiumClipsOf(m).length > 0 && (
                  <button type="button"
                          className={`btn btn--small ${voiceAsk === m.id ? 'btn--quiet' : 'btn--ghost'}`}
                          disabled={!!voiceBusy}
                          onClick={() => {
                            setVoiceDone(null)
                            setVoiceAsk(voiceAsk === m.id ? null : m.id)
                          }}>
                    {voiceBusy?.id === m.id
                      ? `作っています… ${voiceBusy.done} / ${voiceBusy.total}`
                      : voiceAsk === m.id ? '閉じる' : '読み上げ音声を作り直す'}
                  </button>
                )}
              </div>
              <div className="btn-row">
                {assigningId !== m.id && (
                  <button type="button" className="btn btn--small btn--quiet"
                          onClick={() => startAssign(m.id)}>
                    この教材をゲストと共有する
                  </button>
                )}
                {makingJa === m.id && <span className="muted">区切りの訳を作っています…</span>}
              </div>
              {/* **押した場所のすぐ下に出す**(CLAUDE.md)。
                  作り直しは課金になるので、**押す前に本数と費用を書く** */}
              {/* **国と話す人を選んでから走らせる**(2026-09 利用者の指定)。
                  1回目の押下でこの欄が開き、中のボタンで走り出す。
                  **2段のままである** — 押し間違いがそのまま課金になる */}
              {voiceAsk === m.id && !voiceBusy && (
                <VoiceRemake material={m}
                             clipCount={premiumClipsOf(m).length}
                             mine={m.created_by === me.id}
                             busy={!!voiceBusy}
                             onRun={(opt) => runRemake(m, opt)}
                             onCancel={() => setVoiceAsk(null)} />
              )}
              {/* **押した場所のすぐ下に出す**(CLAUDE.md)。
                  **足りないときは、どうすればよいかまで書く** */}
              {dlDone?.id === m.id && (
                <p className={`notice${dlDone.ok ? ' notice--ok' : ' notice--warn'}`}>
                  {dlDone.ok
                    ? <>音声 <strong>{dlDone.total} 本</strong>を1つにまとめました
                        ({Math.round(dlDone.bytes / 1024 / 102.4) / 10} MB)。
                        端末の「ダウンロード」に入っています。</>
                    : dlDone.missing > 0
                      ? <>まだ作られていない音声が <strong>{dlDone.missing} 本</strong>あります
                          (全 {dlDone.total} 本)。
                          <br />
                          先に「セッションで使う(大きく表示)」で
                          <strong>Listen (全体)</strong> を通して聴くか、
                          「読み上げ音声を作り直す」で作ってから、もう一度押してください。</>
                      : <>音声をまとめられませんでした。{dlDone.error}</>}
                </p>
              )}
              {voiceDone?.id === m.id && (
                <p className={`notice${voiceDone.done === 0 ? ' notice--error' : ''}`}>
                  {voiceDone.copied && voiceDone.done > 0
                    && <><strong>別の教材として複製しました。</strong>いまの教材はそのまま残っています。<br /></>}
                  読み上げ音声を <strong>{voiceDone.done} 本</strong>作りました。
                  {voiceDone.failed > 0 && `(${voiceDone.failed} 本は作れませんでした)`}
                  {voiceDone.detail && <><br />{voiceDone.detail}</>}
                </p>
              )}
              {/* **押した場所のすぐ下に出す**(CLAUDE.md) */}
              {resetAsk === m.id && (
                <p className="card-hint">
                  この端末に残っている、この教材の
                  <strong>スラッシュの区切り・ディクテーションの書きかけ・
                  Quick Response の進み具合</strong>を消します。
                  <strong>単語帳に登録した語は消えません。</strong>
                </p>
              )}
              {resetDone?.id === m.id && (
                <p className="notice notice--ok">
                  {resetDone.n > 0
                    ? `練習の記録を消しました(${resetDone.n} 件)。`
                    : '消すものはありませんでした。'}
                </p>
              )}
              {jaDone[m.id]?.ng && <p className="notice notice--warn">{jaDone[m.id].text}</p>}

              {/* **中身は、紙に出す一瞬だけ描く。**
                  描かないでいると、見出しだけの紙が出る(2026-08 実機)。
                  かといって35件ぶんをいつも描くと、語は1つずつ
                  ボタンで描いているので画面が重くなる */}
              {printId === m.id && (
                <div className="print-holder">
                  <MaterialBody
                    material={m}
                    wordStatuses={wordStatuses}
                    /* どの教材で会ったかを添える(0024) */
                    onMarkWord={markIn(markWord, m.id)}
                  />
                </div>
              )}

              {/* **「中身を見る」があった場所には「セッションで使う」を置く**
                  (2026-08 利用者の指定)。さがした教材に対してすぐしたいのは
                  「中身を眺める」ことではなく「セッションで使う」ことである。
                  中身は、行そのものを押せば開く(▸ / ▾)。

                  **開いていても閉じていても、いつも出す。** 開くと消える
                  のでは、いちいち閉じてから押すことになる。
                  そのぶん、中身の中には置かない(2つ並んでしまう)。

                  **いちばん強い見た目はこちらに置く**(利用者の指定)。
                  共有は、すでに教材が決まってからの操作である。 */}
              <button type="button" className="btn btn--primary"
                      onClick={() => setLessonOf(m)}>
                <ScreenIcon />セッションで使う(大きく表示)
              </button>

              {assigningId === m.id ? (
                <div className="assign-box">
                  <p className="field-label">共有するゲストを選んでください(複数可)</p>
                  {active.length === 0 && (
                    <p className="muted">受講中のゲストがいません。</p>
                  )}
                  <div className="assign-list">
                    {active.map((l) => (
                      <label key={l.id} className="toggle">
                        <input type="checkbox" checked={picked.includes(l.id)}
                               onChange={() => setPicked(
                                 picked.includes(l.id)
                                   ? picked.filter((x) => x !== l.id)
                                   : [...picked, l.id])} />
                        <span>{l.display_name}</span>
                      </label>
                    ))}
                  </div>
                  {notActive.length > 0 && (
                    <p className="field-hint">
                      休会中・退会済の {notActive.length} 人とは共有できません。
                    </p>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn btn--primary"
                            onClick={doAssign} disabled={!picked.length}>
                      {picked.length ? `${picked.length} 人と共有する` : '配信する'}
                    </button>
                    <button type="button" className="btn" onClick={() => setAssigningId(null)}>
                      やめる
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}

      {/* **さがした結果の中にも「無いので作る」を置く**(2026-09 利用者の指定)。
          一覧を上から見ていって、無いと分かるのは**いちばん下**である。
          そこで画面のはるか上まで戻らせない。
          新しく作るのは2番目の動線なので、見た目は強くしない */}
      {!loading && shown.length > 0 && (
        <div className="card finder-more" ref={moreRef}>
          <p className="card-hint">
            {filterCount
              ? 'この中に使えるものが無ければ、いまの条件のまま作れます。'
              : 'さがしても見つからなかったときは、新しく作ります。'}
          </p>
          <button type="button" className="btn" onClick={() => setMode('create')}>
            <PlusIcon />{filterCount ? 'この条件で教材を作る' : '教材を作る'}
          </button>
        </div>
      )}

      {/* 一覧の途中にいるあいだだけ、画面の隅に小さく出す。
          **上の箱といちばん下は、これまでどおり残してある**(利用者の指定)。
          紙には出さない */}
      {floatMake && (
        <button type="button" className="btn finder-float no-print"
                onClick={() => setMode('create')}>
          <PlusIcon />{filterCount ? 'この条件で作る' : '教材を作る'}
        </button>
      )}
    </div>
  )
}
