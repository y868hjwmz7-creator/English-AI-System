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
import { useEffect, useRef, useState } from 'react'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import {
  EXERCISE_TYPES, FIELD_LABELS, defaultSectionsFor, exerciseLabel, exerciseType,
} from '../data/exerciseTypes.js'
import { INDUSTRIES, industryLabel } from '../data/industries.js'
import { weaknessTagLabel, weaknessTags } from '../data/weaknessTags.js'
import {
  NEW_MATERIAL_KINDS, createMaterial, generateSection, generateSectionUnique,
  isPassageKind, loadUsedSentences, normEn,
} from '../lib/materials.js'
import { DIALOGUE_SCENES, READING_GENRES } from '../data/genres.js'

/** 弱点を混ぜられる上限。4つ以上は、1つあたりの問数が足りなくなる */
const MAX_TAGS = 3

/**
 * 問数を弱点で分ける。
 *
 * 10問を3つの弱点に分けると 4/3/3 になる。どの弱点が4問になるかは
 * 演習ごとにずらす。ずらさないと、いつも同じ弱点だけ1問多くなる。
 */
const splitCount = (total, parts, offset = 0) => {
  const base = Math.floor(total / parts)
  const rest = total % parts
  return Array.from({ length: parts }, (_, i) => base + (((i + offset) % parts) < rest ? 1 : 0))
}

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
  const [kind, setKind] = useState('pattern')
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
  const [forLearner, setForLearner] = useState('')     // 誰に出す教材か(任意)
  const [similarNotes, setSimilarNotes] = useState([]) // 意味が近すぎて外した文
  const [warning, setWarning] = useState(null)         // 効いていない仕組みの知らせ
  const errorRef = useRef(null)                        // 失敗の知らせまで画面を送る
  const tagRef = useRef(null)                          // 弱点タグの欄
  const [headline, setHeadline] = useState('')         // 記事の見出し / 会話の題名
  const [genre, setGenre] = useState('news')           // 記事のジャンル
  const [scene, setScene] = useState('casual')         // 会話の場面
  const [subject, setSubject] = useState('')           // 話題の指定(任意)

  // 生成中は秒数を数える。1〜3分かかることがあるため、動いていることが
  // 分からないと「固まった」と思われる(実際にそう見えた)。
  useEffect(() => {
    if (!generating) { setElapsed(0); return undefined }
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [generating])

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
  /** 弱点タグを、AI に渡す文言にする */
  const topicOf = (id) => {
    const tag = weaknessTags.find((t) => t.id === id)
    return tag ? `${tag.label}${tag.hint ? `(${tag.hint})` : ''}` : id
  }

  /** 教材名を自動で付ける。手入力を減らすため(仕様書 第5.13.5節) */
  const autoTitle = (head) => {
    const parts = [todayLabel()]
    if (head) parts.push(head)
    else if (kind === 'reading') parts.push(READING_GENRES.find((g) => g.id === genre)?.label ?? '')
    else if (kind === 'dialogue') parts.push(DIALOGUE_SCENES.find((x) => x.id === scene)?.label ?? '')
    else parts.push(tagIds.map(weaknessTagLabel).join(' + '))
    parts.push(level)
    if (industry) parts.push(industryLabel(industry))
    const name = learners.find((l) => l.id === forLearner)?.display_name
    if (name) parts.push(name)
    return parts.filter(Boolean).join(' / ')
  }

  /**
   * 記事・会話を作る。
   *
   * **本文は1本まるごと作る。** 段落や発言を弱点ごとに分けたり、
   * 重複で1つずつ落としたりしない。落とすと話がつながらなくなる。
   * 内容理解と語句は、できあがった本文を渡して作らせる。
   * そうしないと本文と噛み合わない設問ができる(第5.17節)。
   */
  const generatePassage = async () => {
    const plan = defaultSectionsFor(kind)
    const [bodyPlan, ...rest] = plan
    const { data: used } = await loadUsedSentences(tagIds)

    setGenerating({ done: 0, total: plan.length, label: exerciseLabel(bodyPlan.exercise_type) })
    const { data: body, error: bodyError } = await generateSection({
      sectionType: bodyPlan.exercise_type,
      count: bodyPlan.count,
      topic: tagIds.map(topicOf).join(' / '),
      level, industry, isFirst: true,
      genre: kind === 'reading'
        ? [READING_GENRES.find((g) => g.id === genre)?.label,
           READING_GENRES.find((g) => g.id === genre)?.hint].filter(Boolean).join(' — ')
        : '',
      scene: kind === 'dialogue'
        ? [DIALOGUE_SCENES.find((x) => x.id === scene)?.label,
           DIALOGUE_SCENES.find((x) => x.id === scene)?.hint].filter(Boolean).join(' — ')
        : '',
      subject,
      avoid: (used ?? []).slice(-40),
    })
    if (bodyError) { fail(bodyError); return }

    const made = [body.section]
    // できた本文を、そのまま次の生成に渡す
    const context = (body.section.items ?? [])
      .map((it) => (it.speaker ? `${it.speaker}: ${it.prompt_en}` : it.prompt_en))
      .filter(Boolean).join('\n\n')

    for (let i = 0; i < rest.length; i += 1) {
      setGenerating({ done: i + 1, total: plan.length, label: exerciseLabel(rest[i].exercise_type) })
      const { data, error: e } = await generateSection({
        sectionType: rest[i].exercise_type,
        count: rest[i].count,
        topic: tagIds.map(topicOf).join(' / '),
        level, industry, context,
      })
      if (e) { fail(e); return }
      made.push(data.section)
    }

    setGenerating(null)
    setSections(made)
    if (body.headline) setHeadline(body.headline)
    if (body.teaching_point && !teachingPoint) setTeachingPoint(body.teaching_point)
    if (!title.trim()) setTitle(autoTitle(body.headline))
  }

  /**
   * 文型ドリル・単語・フレーズを作る。
   * 弱点が複数なら問数を分けて、1問ずつ交互に並べる(第5.16.1節)。
   */
  const generateDrill = async () => {
    // ① 生成の前に、すでに使った英文を渡して避けさせる(誘導)
    const { data: used } = await loadUsedSentences(tagIds)
    const usedSet = new Set((used ?? []).map(normEn))

    const plan = defaultSectionsFor(kind)
    const made = []
    const notes = []
    // 指導ポイントは**弱点1つにつき1本**だけ採る。演習ごとに集めていたため、
    // 同じ内容が言い換えられて何本も並んでいた(実際に6本並んだ)。
    const pointOfTag = new Map()
    let warn = null
    let droppedCount = 0
    let shortCount = 0
    const totalSteps = plan.length * tagIds.length
    let step = 0

    for (let i = 0; i < plan.length; i += 1) {
      // 弱点が1つなら 10問すべて、3つなら 4/3/3 のように分ける
      const counts = splitCount(plan[i].count, tagIds.length, i)
      const perTag = []
      let instruction = ''

      for (let t = 0; t < tagIds.length; t += 1) {
        if (counts[t] === 0) { perTag.push([]); continue }
        setGenerating({
          done: step, total: totalSteps,
          label: `${exerciseLabel(plan[i].exercise_type)}${
            tagIds.length > 1 ? ` / ${weaknessTagLabel(tagIds[t])}` : ''}`,
        })
        step += 1

        // ② 生成のあとに、既出と「意味が近すぎる文」を落とし、
        //    落ちた分は作り直す。ここが「被らない」の担保。
        const result = await generateSectionUnique(
          {
            sectionType: plan[i].exercise_type,
            count: counts[t],
            topic: topicOf(tagIds[t]),
            level, industry, isFirst: i === 0 && t === 0,
          },
          { usedSet, learnerId: forLearner || null, tagIds },
        )
        if (result.error) { fail(result.error); return }

        droppedCount += result.dropped
        shortCount += result.short
        notes.push(...(result.tooSimilar ?? []))
        warn = warn || result.warning
        if (result.teaching_point && !pointOfTag.has(tagIds[t])) {
          pointOfTag.set(tagIds[t], result.teaching_point)
        }
        instruction = instruction || result.section.instruction
        // 1問ごとに、どの弱点の問題かを持たせる(混ぜたときに必要)
        perTag.push(result.section.items.map((it) => ({
          ...it, tag_id: tagIds.length > 1 ? tagIds[t] : undefined,
        })))
      }

      made.push({
        exercise_type: plan[i].exercise_type,
        instruction,
        items: interleave(perTag),
      })
    }

    // 弱点が複数なら【弱点名】を頭に付けて、1行ずつ並べる。
    // 見出しが無いと、どの説明がどの弱点のものか分からない。
    const point = teachingPoint || [...pointOfTag.entries()]
      .map(([tagId, text]) => (tagIds.length > 1
        ? `【${weaknessTagLabel(tagId)}】${String(text).trim()}`
        : String(text).trim()))
      .join('\n')

    setGenerating(null)
    setSections(made)
    setTeachingPoint(point)
    setDropped(droppedCount)
    setShort(shortCount)
    setSimilarNotes(notes)
    setWarning(warn)
    if (!title.trim()) setTitle(autoTitle(null))
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

    if (isPassageKind(kind)) await generatePassage()
    else await generateDrill()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const { data, error: message } = await createMaterial({
      title, level, kind, instruction_ja: instruction, teaching_point: teachingPoint,
      visibility, industry, sections, tagIds, createdBy,
      headline, genre: kind === 'reading' ? genre : '', scene: kind === 'dialogue' ? scene : '',
      topic: subject,
    })
    setBusy(false)
    if (message) { setError(message); return }
    onCreated?.(data.id)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card-title">教材を新しく作る</h2>
      <p className="card-hint">
        まずライブラリを探して、無いときにここへ来てください。
        既にある教材を使うほうが、作るよりずっと速く配信できます。
      </p>

      <label className="field">
        <span>教材名</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="例: 名詞 + to不定詞 =「〜すべき / 〜する必要のある」" required />
      </label>

      <div className="field-row material-form-row">
        <label className="field">
          <span>レベル</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {CEFR_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{cefrLabel(l.id)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>種類</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {NEW_MATERIAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      </div>
      <p className="field-hint material-kind-hint">
        {NEW_MATERIAL_KINDS.find((k) => k.id === kind)?.hint}
      </p>

      {kind === 'reading' && (
        <label className="field">
          <span>
            記事のジャンル
            <span className="field-hint">業界と組み合わせて、何の記事にするかが決まります</span>
          </span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {READING_GENRES.map((g) => (
              <option key={g.id} value={g.id}>{g.label} — {g.hint}</option>
            ))}
          </select>
        </label>
      )}

      {kind === 'dialogue' && (
        <label className="field">
          <span>
            会話の場面
            <span className="field-hint">
              場面によって丁寧さと言い回しが変わります。同じ話題でも別の教材になります
            </span>
          </span>
          <select value={scene} onChange={(e) => setScene(e.target.value)}>
            {DIALOGUE_SCENES.map((x) => (
              <option key={x.id} value={x.id}>{x.label} — {x.hint}</option>
            ))}
          </select>
        </label>
      )}

      {isPassageKind(kind) && (
        <>
          <label className="field">
            <span>
              話題(任意)
              <span className="field-hint">
                空のままなら、業界とジャンルに合う話題を AI が決めます。
                「今週これを読ませたい」があるときだけ書いてください
              </span>
            </span>
            <input
              type="text" value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例: 生成AIを社内で使うときのルール作り"
            />
          </label>

          <label className="field">
            <span>
              見出し
              <span className="field-hint">作ると自動で入ります。直しても構いません</span>
            </span>
            <input
              type="text" value={headline} lang="en"
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="作ると自動で入ります"
            />
          </label>
        </>
      )}

      <label className="field">
        <span>
          業界
          <span className="field-hint">選ばなければ「汎用」。どのゲストにも使えます</span>
        </span>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">汎用(全員)</option>
          {INDUSTRIES.map((i) => (
            <option key={i.id} value={i.id}>{i.label} — {i.hint}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>取り組み方(ゲストに見えます・任意)</span>
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
               placeholder="例: to不定詞を「〜すべき」という感覚で捉えること" />
      </label>

      <label className="field">
        <span>
          指導ポイント
          <span className="field-hint">この文法全体の勘所。1問ごとではなく教材全体にかかるもの</span>
        </span>
        <textarea rows={5} value={teachingPoint}
                  onChange={(e) => setTeachingPoint(e.target.value)}
                  placeholder="例: emails to reply to のように、reply to の to を落とさないこと" />
      </label>

      <fieldset className="field" ref={tagRef}>
        <legend>
          弱点タグ
          <span className="field-hint">
            {isPassageKind(kind)
              ? '任意。付けると、その表現が本文に自然に出てくるように作ります'
              : '必須。ここで付けておかないと、次に同じ弱点のゲストが来たときに見つけられません'}
          </span>
        </legend>
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} />
      </fieldset>

      <div className="generate-box">
        <h3 className="card-title">AI に下書きを作らせる</h3>
        <p className="card-hint">
          上の<strong>弱点タグを1つ</strong>選んでから押してください。
          レベルと業界も自動で反映されます。
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
            {defaultSectionsFor(kind).reduce((n, s2) => n + s2.count, 0)} 問を
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
            {kind === 'reading' ? '記事' : '会話'}になります
            (およそ {kind === 'reading' ? '250〜350語' : '14発言'})。
            シャドーイングやオーバーラッピングは、この本文に対して行います。
          </p>
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

        <label className="field">
          このゲスト向けに作る(任意)
          <select value={forLearner} onChange={(e) => setForLearner(e.target.value)}>
            <option value="">指定しない</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>{l.display_name}</option>
            ))}
          </select>
          <span className="field-hint">
            指定すると、<strong>そのゲストがこれまでに受け取った英文を1文も使いません</strong>
            (弱点を問わず、共有済みの教材すべてと照合します)。教材名にもお名前が入ります。
          </span>
        </label>

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
            : isPassageKind(kind)
              ? `${kind === 'reading' ? '記事' : '会話'}を作る(`
                + defaultSectionsFor(kind)
                  .map((s2) => `${exerciseLabel(s2.exercise_type)}${s2.count}`).join(' + ')
                + ')'
              : `下書きを作る(${defaultSectionsFor(kind).reduce((n, s2) => n + s2.count, 0)} 問)`}
        </button>
        {generating && (
          <p className="field-hint">
            1〜3分かかります。<strong>この画面を閉じないでください。</strong>
          </p>
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
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '発行しています…' : '発行する'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>やめる</button>
      </div>
    </form>
  )
}
