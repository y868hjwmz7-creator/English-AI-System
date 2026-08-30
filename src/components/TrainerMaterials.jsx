/**
 * トレーナーの教材画面。
 *
 * 【設計の要件】(仕様書 第5.5節)
 *   既定の動線は「ライブラリから探す」。新しく作るのは2番目に置く。
 *   逆にすると毎回作ってしまい、再利用率が上がらない。
 *   トレーナー1人あたり週60レッスンを抱えるため、再利用が効かないと
 *   教材づくりに週9時間かかり、この仕組みは回らない。
 */
import { useEffect, useState } from 'react'
import MaterialForm from './MaterialForm.jsx'
import TeachingNote from './TeachingNote.jsx'
import Tabs from './Tabs.jsx'
import SpeakButton from './SpeakButton.jsx'
import { printElement } from '../lib/print.js'
import LessonView from './LessonView.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import { countLabel, exerciseLabel, exerciseType, isPassageSection } from '../data/exerciseTypes.js'
import { storedChunks } from '../lib/chunkJa.js'
import { INDUSTRIES, industryLabel } from '../data/industries.js'
import {
  NEW_MATERIAL_KINDS, addChunkJa, assignMaterial, estimateCost,
  kindLabel, loadMyLearners, searchMaterials,
} from '../lib/materials.js'
import { DIALOGUE_SCENES, READING_GENRES } from '../data/genres.js'
import { PrintIcon, ScreenIcon } from './Icons.jsx'
import EnglishText from './EnglishText.jsx'
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import useWordStatuses from '../lib/useWordStatuses.js'

export default function TrainerMaterials({ me }) {
  const [mode, setMode] = useState('search')      // 'search' | 'create'
  const [tagIds, setTagIds] = useState([])
  const [level, setLevel] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [industry, setIndustry] = useState('')
  const [kind, setKind] = useState('')         // 教材の種類で絞る
  const [genre, setGenre] = useState('')       // 記事のジャンル
  const [scene, setScene] = useState('')       // 会話の場面
  const [sort, setSort] = useState('new')      // 並び順
  // **このゲストに出したことがある教材**で絞る(2026-08 利用者の指定)。
  // 記録は `assignments` にある。教材名にゲスト名を入れる代わりの仕組み
  const [learnerId, setLearnerId] = useState('')
  const [openId, setOpenId] = useState(null)   // 中身を開いている教材
  const [openSection, setOpenSection] = useState({})  // 教材ごとに開いている演習
  // **トレーナー自身の語の記録。** トレーナーも日々英語を学んでいる
  // (2026-08 利用者の指定)。担当ゲストの記録には触れない
  const { statuses: wordStatuses, mark: markWord } = useWordStatuses()
  const [lessonOf, setLessonOf] = useState(null)      // レッスン表示で開いている教材

  const [materials, setMaterials] = useState([])
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // カタマリごとの訳を作っている教材(0021)と、その結果
  const [makingJa, setMakingJa] = useState(null)
  const [jaDone, setJaDone] = useState({})

  const [assigningId, setAssigningId] = useState(null)   // 配信先を選んでいる教材
  const [picked, setPicked] = useState([])
  const [message, setMessage] = useState(null)

  const search = async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await searchMaterials({
      tagIds, level, keyword, industry,
      kind: kind || null,
      genre: kind === 'reading' ? (genre || null) : null,
      scene: kind === 'dialogue' ? (scene || null) : null,
      learnerId: learnerId || null,
    })
    setLoading(false)
    if (e) { setError(e); return }
    setMaterials(data)
  }

  // 絞り込みが変わったら探し直す。search 自体は毎回作り直されるので依存に入れない。
  useEffect(() => { search() }, [tagIds, level, industry, kind, genre, scene, learnerId])

  /** 本文があって、まだカタマリごとの訳が入っていない教材か(0021) */
  const needsChunkJa = (m) => (m.sections ?? [])
    .filter((sec) => isPassageSection(sec.exercise_type))
    .flatMap((sec) => sec.items ?? [])
    .some((it) => String(it.prompt_en ?? '').trim() && !storedChunks(it))

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
    if (e) { setJaDone((v) => ({ ...v, [m.id]: { ng: true, text: e } })); return }
    setJaDone((v) => ({
      ...v,
      [m.id]: {
        text: `${data.made} か所に訳を付けました`
          + (data.skipped ? `(${data.skipped} か所は数が合わず見送りました)` : '')
          + (data.spent ? ` / 費用 約 $${estimateCost(data.spent).toFixed(2)}` : ''),
      },
    }))
    await search()   // 控えたものを画面に反映する
  }

  useEffect(() => {
    loadMyLearners().then(({ data, error: e }) => {
      if (e) setError(e)
      else setLearners(data)
    })
  }, [])

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
        initial={{ tagIds, level: level ?? '', industry, kind, genre, scene,
          // **絞り込みの項目を足したら、`initial` にも必ず足す**(CLAUDE.md)。
          // ゲストで絞っていたなら、そのゲストに共有する前提で作る
          shareWith: learnerId ? [learnerId] : [] }}
        onCancel={() => setMode('search')}
        onCreated={(id, shared) => {
          setMode('search')
          setMessage(shared
            ? `教材を発行し、${shared}人と共有しました。`
            : '教材を発行しました。一覧から共有できます。')
          search()
        }}
      />
    )
  }

  // 並べ替え。探しやすさは、絞り込みと並び順の両方で決まる。
  const sorted = [...materials].sort((a, b) => {
    if (sort === 'items') return b.itemCount - a.itemCount
    if (sort === 'title') return a.title.localeCompare(b.title, 'ja')
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const active = learners.filter((l) => l.status === 'active')
  const notActive = learners.filter((l) => l.status !== 'active')

  return (
    <div className="stack">
      {lessonOf && (
        <LessonView material={lessonOf} onClose={() => setLessonOf(null)}
                    wordStatuses={wordStatuses} onMarkWord={markWord} />
      )}
      <div className="card">
        <h2 className="card-title">教材をさがす</h2>
        <p className="card-hint">
          レッスンで指摘した弱点を選ぶと、その弱点の教材が出ます。
          <strong>あればそのまま配信できます。</strong>作るより速く、ゲストには同じ価値が届きます。
        </p>

        {/* さがす場面では基礎練習(子音全般・母音全般)も選べる。
            弱点として指摘する場面では出さない(粒度が違うため)。 */}
        <WeaknessTagPicker selected={tagIds} onChange={setTagIds} includeDrills />

        <div className="filter-row material-filter">
          <span className="filter-label">レベル</span>
          <select value={level ?? ''} onChange={(e) => setLevel(e.target.value || null)}>
            <option value="">すべて</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{l.label} — {l.ja}</option>
            ))}
          </select>
          <span className="filter-label">種類</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">すべて</option>
            {NEW_MATERIAL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          {/* **このゲストに出したことがある教材**(2026-08 利用者の指定)。
              教材名にゲスト名を入れるのをやめた代わりに、ここで引く。
              > 同じようなレベルのゲストに再利用する際に便利です */}
          <span className="filter-label">ゲスト</span>
          <select value={learnerId} onChange={(e) => setLearnerId(e.target.value)}
                  title="このゲストに出したことがある教材だけを出す">
            <option value="">すべて</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>{l.display_name}</option>
            ))}
          </select>
          {kind === 'reading' && (
            <>
              <span className="filter-label">ジャンル</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">すべて</option>
                {READING_GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </>
          )}
          {kind === 'dialogue' && (
            <>
              <span className="filter-label">場面</span>
              <select value={scene} onChange={(e) => setScene(e.target.value)}>
                <option value="">すべて</option>
                {DIALOGUE_SCENES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </>
          )}
          <span className="filter-label">業界</span>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">すべて</option>
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <input className="material-keyword" value={keyword} placeholder="教材名・見出しで絞る"
                 onChange={(e) => setKeyword(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} />
          <button type="button" className="btn btn--small" onClick={search}>さがす</button>
          <span className="filter-label">並び順</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">新しい順</option>
            <option value="items">問数の多い順</option>
            <option value="title">名前順</option>
          </select>
        </div>
      </div>

      {message && <div className="notice notice--ok">{message}</div>}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : materials.length === 0 ? (
        <div className="card">
          <p className="card-hint">
            {tagIds.length
              ? 'この弱点の教材はまだありません。最初の1つを作ると、次からは全トレーナーがすぐ使えます。'
              : '教材がまだありません。'}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setMode('create')}>
            この弱点の教材を新しく作る
          </button>
        </div>
      ) : (
        <>
          <p className="muted">{materials.length} 件</p>
          {sorted.map((m) => (
            <div key={m.id} className="card material-card">
              {/* **行そのものを押して開く**(2026-08 利用者の指定)。
                  下に「中身を見る」ボタンを置いていたが、1行ぶん場所を取る。
                  宿題の一覧で一度学んだ形にそろえた(▸ / ▾ の印を出す)。 */}
              <div className="material-head">
                <div className="material-open" role="button" tabIndex={0}
                     aria-expanded={openId === m.id}
                     onClick={() => setOpenId(openId === m.id ? null : m.id)}
                     onKeyDown={(e) => {
                       if (e.key !== 'Enter' && e.key !== ' ') return
                       e.preventDefault()
                       setOpenId(openId === m.id ? null : m.id)
                     }}>
                  <span className="material-open-mark" aria-hidden="true">
                    {openId === m.id ? '▾' : '▸'}
                  </span>
                  {/* 見出しは弱点だけ。レベル・業界は小さな札、日付は右上。

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
                    fallbackTags={[m.tagIds.map(weaknessTagLabel).join(' + '),
                      cefrLabel(m.level), kindLabel(m.kind), industryLabel(m.industry)]}
                  />
                </div>
                <span className="muted">
                  {kindLabel(m.kind)}
                  {m.visibility === 'private' && ' / 自分だけ'}
                </span>
              </div>

              {m.instruction_ja && <p className="card-hint">{m.instruction_ja}</p>}

              {m.teaching_point && (
                <TeachingNote text={m.teaching_point} />
              )}

              {/* **中身の抜き書きは出さない**(2026-08 利用者の指定)。

                  > 教材の内容の要約のような部分、いらないです。場所を取りすぎです。

                  記事の1段落目をそのまま並べていたので、1件で画面ぜんぶを
                  食っていた。さがす画面は**見比べる**ためのものなので、
                  1件が長いほど見比べにくくなる。
                  中身は、行そのものを押せば開く(▸ / ▾)。

                  何の演習が何問あるかは、教材を選ぶのに要る。
                  **1行に畳んで残す**(2行あった数の行も、これに1本化する)。 */}
              <p className="muted material-parts">
                {m.sections.map((sec) => (
                  <span key={sec.id}>
                    {exerciseLabel(sec.exercise_type)}
                    {' '}{countLabel(sec.exercise_type, sec.items.length)}
                  </span>
                ))}
              </p>

              {openId === m.id ? (
                <div className="material-detail" id={`material-${m.id}`}>
                  {/* 紙に出したときだけ出る見出し。何の教材か分からない
                      紙が配られると、あとで整理できない */}
                  <div className="print-only print-head">
                    <MaterialTitle title={m.title} headline={m.headline} as="strong" size="sheet"
                                   fallbackTags={[cefrLabel(m.level), kindLabel(m.kind),
                                     industryLabel(m.industry)]} />
                    <div className="print-meta">
                      {cefrLabel(m.level)} / {kindLabel(m.kind)} / {industryLabel(m.industry)}
                      {' / '}全 {m.itemCount} 問
                      {m.tagIds.length ? ` / ${m.tagIds.map(weaknessTagLabel).join('・')}` : ''}
                    </div>
                  </div>
                  {/* **「セッションで使う」はここに置かない。**
                      開いていない行にも出しているので、開くと2つ並んでしまう。
                      **同じことをするボタンを2つ見せない**(CLAUDE.md)。 */}
                  <div className="btn-row no-print">
                    <button type="button" className="btn btn--small"
                            onClick={() => printElement(document.getElementById(`material-${m.id}`))}>
                      <PrintIcon />印刷 / PDFで保存
                    </button>
                    {/* **0021 より前に作った教材にも、あとから足せる道**を用意する。
                        カタマリごとの訳は本来「作るときに一緒に」だが、
                        すでにある教材を作り直させるのはもったいない。
                        0020(発音記号)で「作り直してください」としか
                        言えなかった反省である。
                        **すでに訳が入っているものには、もう一度課金しない** */}
                    {needsChunkJa(m) && (
                      <button type="button" className="btn btn--small"
                              disabled={makingJa === m.id}
                              title="スラッシュリーディングで、カタマリの上に訳を出せるようになります"
                              onClick={() => makeChunkJa(m)}>
                        {makingJa === m.id ? '区切りの訳を作っています…' : '区切りの訳を作る'}
                      </button>
                    )}
                  </div>
                  {/* **結果は、押した場所のすぐ下に出す**(2026-08 の指摘)。
                      画面のいちばん下に出すとスマホでは見えず、
                      「何も起きずにボタンが戻る」ようにしか見えない */}
                  {jaDone[m.id] && (
                    <p className={`notice no-print ${jaDone[m.id].ng ? 'notice--warn' : 'notice--ok'}`}>
                      {jaDone[m.id].text}
                    </p>
                  )}
                  <Tabs
                    variant="sub"
                    ariaLabel="演習の切り替え"
                    value={openSection[m.id] ?? null}
                    onChange={(id) => setOpenSection((x) => ({
                      ...x, [m.id]: x[m.id] === id ? null : id,
                    }))}
                    items={m.sections.map((sec) => ({
                      id: sec.id,
                      label: exerciseLabel(sec.exercise_type),
                      count: sec.items.length,
                    }))}
                  />
                  {m.sections
                    /* はじめはどれも開かない。演習が1種類のときだけ開く
                       (Tabs は2つ未満だと描かないため、押す先が無い) */
                    .filter((sec, i) => sec.id === openSection[m.id]
                      || (m.sections.length < 2 && i === 0))
                    .map((sec) => {
                    const type = exerciseType(sec.exercise_type)
                    return (
                      <section key={sec.id} className="exercise-view">
                        <h4 className="section-title">
                          {exerciseLabel(sec.exercise_type)}({countLabel(sec.exercise_type, sec.items.length)})
                          {!type?.audioFrom && <span className="field-hint"> 音声なし</span>}
                        </h4>
                        {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
                        <ol className="material-preview">
                          {sec.items.map((it) => (
                            <li key={it.id}>
                              {it.tag_id && (
                                <span className="item-tag">{weaknessTagLabel(it.tag_id)}</span>
                              )}
                              {it.speaker && (
                                <div className="passage-speaker" lang="en">{it.speaker}</div>
                              )}
                              {type?.audioFrom && it[type.audioFrom] && (
                                <div className="item-audio">
                                  <SpeakButton
                                    text={it[type.audioFrom]}
                                    clipVoice={resolveVoices(m.voiceIds)[0]}
                                    tier={voiceTierFor({
                                      exerciseType: sec.exercise_type,
                                      tags: m.tagIds,
                                    })}
                                  />
                                </div>
                              )}
                              {/* 語に触れると意味が出る。**トレーナー自身も
                                  「知っていた / 知らなかった」を付けられる**
                                  (2026-08 利用者の指定)。付けた記録は
                                  トレーナー自身のもので、ゲストのものには触れない */}
                              {it.prompt_en && (
                                <div>
                                  <EnglishText text={it.prompt_en} textJa={it.prompt_ja} level={m.level}
                                               statuses={wordStatuses} onMark={markWord} />
                                  <Phonetic value={it.phonetic} />
                                  <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                               level={m.level}
                                               statuses={wordStatuses} onMark={markWord} />
                                </div>
                              )}
                              {it.prompt_ja && <div>{it.prompt_ja}</div>}
                              {it.question && (
                                <div><EnglishText text={it.question} level={m.level}
                                                  statuses={wordStatuses} onMark={markWord} /></div>
                              )}
                              {it.hint && <div className="field-hint">与える語: {it.hint}</div>}
                              {it.audio_text && !it.prompt_en && (
                                <div lang="en" className="muted">読み上げ: {it.audio_text}</div>
                              )}
                              {it.answer && <div className="detail-answer">→ {it.answer}</div>}
                              {it.answer_alt && (
                                <div className="muted">別解: {it.answer_alt}</div>
                              )}
                              {it.note && <div className="field-hint">{it.note}</div>}
                            </li>
                          ))}
                        </ol>
                      </section>
                    )
                  })}
                  <button type="button" className="btn btn--link" onClick={() => setOpenId(null)}>
                    中身を閉じる
                  </button>
                </div>
              ) : null}

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
              ) : (
                /* **共有は、一段うしろに置く**(2026-08 利用者の指定)。
                   小さく、灰色の塗りつぶし(`btn--quiet`)にする。
                   青の塗りつぶしは「セッションで使う」に譲った */
                <button type="button" className="btn btn--small btn--quiet"
                        onClick={() => startAssign(m.id)}>
                  この教材をゲストと共有する
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {/* 新しく作るのは2番目の動線。目立たせすぎない。 */}
      <div className="card">
        <p className="card-hint">さがしても見つからなかったときは、新しく作ります。</p>
        <button type="button" className="btn" onClick={() => setMode('create')}>
          ＋ 教材を新しく作る
        </button>
      </div>
    </div>
  )
}
