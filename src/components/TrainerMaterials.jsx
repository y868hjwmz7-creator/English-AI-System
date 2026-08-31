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
import TeachingNote from './TeachingNote.jsx'
import { parseMaterialTitle } from '../lib/format.js'
import { loadSearchOpen, saveSearchOpen } from '../lib/slashLevel.js'
import LessonView from './LessonView.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import MaterialBody from './MaterialBody.jsx'
import { ScreenIcon } from './Icons.jsx'
import WeaknessTagPicker from './WeaknessTagPicker.jsx'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { CEFR_LEVELS, cefrLabel } from '../data/cefr.js'
import { countLabel, exerciseLabel, isPassageSection } from '../data/exerciseTypes.js'
import { needsChunkJa } from '../lib/chunkJa.js'
import { INDUSTRIES, industryLabel } from '../data/industries.js'
import {
  NEW_MATERIAL_KINDS, addChunkJa, assignMaterial,
  kindLabel, loadMyLearners, searchMaterials,
} from '../lib/materials.js'
import { DIALOGUE_SCENES, READING_GENRES } from '../data/genres.js'
import useWordStatuses, { markIn } from '../lib/useWordStatuses.js'
import { prefetchGlosses } from '../lib/vocab.js'

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
  // さがす欄を開いているか。**一度決める設定は覚える**(2026-08 利用者の指定)
  const [searchOpen, setSearchOpen] = useState(loadSearchOpen)
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
  const triedJa = useRef(new Set())
  useEffect(() => {
    // **開いたときと、セッションで使うときの両方で拾う**(2026-08 実機)。
    // 行を開かずに「セッションで使う」を押す使い方だと、
    // 作り直しの機会が一度も来ず、**古い訳のまま出ていた。**
    const id = openId || lessonOf?.id
    if (!id) return
    const m = materials.find((x) => x.id === id) ?? (lessonOf?.id === id ? lessonOf : null)
    if (!m || !needsJa(m) || triedJa.current.has(m.id)) return
    triedJa.current.add(m.id)
    makeChunkJa(m)
  }, [openId, lessonOf, materials])

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
    const m = materials.find((x) => x.id === openId)
    if (!m) return
    const texts = m.sections.flatMap((sec) => sec.items
      .map((it) => it.prompt_en || it.question || '')
      .filter(Boolean)
      .map((text) => ({ text })))
    prefetchGlosses(texts, { level: m.level })
  }, [openId, materials])

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
      {/* **たたんでおける**(2026-08 利用者の指定)。
          > 教材をさがすのところは「教材をさがす・作る」に変えて、
          > クリックしたら展開するようにしてください。

          絞り込みは毎回触るものではない。畳んでおけば、教材の一覧が
          そのぶん上に来る。**開け閉めは覚える**(一度決める設定は覚える)。 */}
      <details className="card material-search" open={searchOpen}
               onToggle={(e) => {
                 setSearchOpen(e.currentTarget.open)
                 saveSearchOpen(e.currentTarget.open)
               }}>
        <summary className="card-title material-search-sum">教材をさがす・作る</summary>
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
      </details>

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
              <div className="material-head">
                <div className="material-open" role="button" tabIndex={0}
                     aria-expanded={openId === m.id}
                     aria-controls={`material-${m.id}`}
                     onClick={() => setOpenId(openId === m.id ? null : m.id)}
                     onKeyDown={(e) => {
                       if (e.key !== 'Enter' && e.key !== ' ') return
                       e.preventDefault()
                       setOpenId(openId === m.id ? null : m.id)
                     }}>
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
                  {/* **何を押せばよいかを、言葉で書く**(2026-08 利用者の指定)。
                      印刷も中身を開いた先にあるので、ここに書いておく */}
                  <span className="material-open-cta">
                    <span className="material-open-mark" aria-hidden="true">
                      {openId === m.id ? '▾' : '▸'}
                    </span>
                    {openId === m.id ? '中身を閉じる' : '中身を見る・印刷する'}
                  </span>
                </div>
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

              {/* **中身は部品にしてある**(`MaterialBody.jsx`)。
                  ゲストの情報の中の「過去の宿題」からも同じものを開くので、
                  **同じ見た目を2か所に書き写さない**(2026-08 利用者の指定)。 */}
              {openId === m.id && (
                <MaterialBody
                  material={m}
                  openSection={openSection[m.id] ?? null}
                  onSection={(id) => setOpenSection((x) => ({ ...x, [m.id]: id }))}
                  wordStatuses={wordStatuses}
                  /* どの教材で会ったかを添える(0024) */
                  onMarkWord={markIn(markWord, m.id)}
                  onClose={() => setOpenId(null)}
                  showReset
                  busyNote={makingJa === m.id ? '区切りの訳を作っています…' : null}
                  errorNote={jaDone[m.id]?.ng ? jaDone[m.id].text : null}
                />
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
