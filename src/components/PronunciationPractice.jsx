/**
 * 発音練習 — 独立した機能(2026-08 利用者の指定)。
 *
 * > 「発音練習」だけは独立した機能としてメニューに追加してください。
 *
 * 【いまは「器」だけ】(利用者の指定)
 *   採点は入れていない。いまある発音スコア(`pronunciation.js`)は
 *   **録音を解析していない仮の数値**で、実力を測るものではない。
 *   仮の点数を独立した機能の看板にすると、**測れていないものを
 *   測れているように見せる**ことになる。
 *
 *   だからここに置くのは、**練習に要るものだけ**である。
 *     ・発音の練習に使う英語(単語・フレーズ・発音の弱点の教材)を1か所に集める
 *     ・**発音記号**を出す(0020)
 *     ・**お手本を聴く。** 速さを落として聴ける
 *     ・語に触れれば意味も引ける
 *
 *   採点(音声認識で突き合わせる / 外の窓口に送る)は、
 *   **やり方が決まってから**足す。録音を外に送るのは方針の転換にあたるので、
 *   勝手には行わない(仕様書 3.2)。
 *
 * 【どこから材料を持ってくるか】
 *   ゲストは**自分に共有された教材**から、トレーナーは**ライブラリ**から。
 *   どちらも既存の読み出しをそのまま使う。**新しい表も窓口も作らない。**
 */
import { useEffect, useMemo, useState } from 'react'
import { cefrLabel } from '../data/cefr.js'
import { weaknessTagLabel, weaknessTags } from '../data/weaknessTags.js'
import { loadMyAssignments, searchMaterials } from '../lib/materials.js'
import { usePracticeLog } from '../lib/practice.js'
import useWordStatuses from '../lib/useWordStatuses.js'
import { viewerRoleOf } from '../lib/viewer.js'
import EnglishText from './EnglishText.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import Phonetic from './Phonetic.jsx'
import SpeakButton from './SpeakButton.jsx'
import { SPEECH_RATES, loadRateId, rateOf, saveRateId } from '../lib/speechRate.js'

/** 発音の練習に使える演習。**英語1つずつが短い**ものだけ */
const SPEAK_TYPES = new Set(['vocabulary', 'phrase'])

/** 発音の弱点タグか。**見出し(category)で決める。** id の形に頼らない */
const PRON_TAGS = new Set(weaknessTags
  .filter((t) => t.category === 'pronunciation').map((t) => t.id))
const isPronunciationTag = (id) => PRON_TAGS.has(id)

export default function PronunciationPractice() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rateId, setRateId] = useState(loadRateId)
  const { statuses, mark } = useWordStatuses()

  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ
  usePracticeLog('pronunciation')

  useEffect(() => {
    let alive = true
    const isLearner = viewerRoleOf() === 'learner'
    const run = isLearner
      ? loadMyAssignments().then(({ data, error: e }) => ({
        data: (data ?? []).map((a) => a.material).filter(Boolean), error: e,
      }))
      : searchMaterials({})
    run.then(({ data, error: e }) => {
      if (!alive) return
      setLoading(false)
      if (e) { setError(e); return }
      setMaterials(data ?? [])
    })
    return () => { alive = false }
  }, [])

  /**
   * 発音の練習に使えるものだけを取り出す。
   * **単語・フレーズの演習**か、**発音の弱点が付いた教材**の短い英語。
   */
  const cards = useMemo(() => materials
    .map((m) => {
      const forPron = (m.tagIds ?? []).some(isPronunciationTag)
      const items = (m.sections ?? [])
        .filter((sec) => SPEAK_TYPES.has(sec.exercise_type) || forPron)
        .flatMap((sec) => (sec.items ?? [])
          .filter((it) => SPEAK_TYPES.has(sec.exercise_type) && String(it.prompt_en ?? '').trim()))
      return { material: m, items }
    })
    .filter((x) => x.items.length), [materials])

  const total = cards.reduce((n, c) => n + c.items.length, 0)

  return (
    <div className="stack">
      <div className="card">
        <h2 className="card-title">発音練習</h2>
        <p className="card-hint">
          単語とフレーズを、<strong>発音記号を見ながらお手本と同じ音で</strong>言う練習です。
          <br />
          お手本は速さを落として聴けます。語に触れると意味も出ます。
        </p>
        <label className="rate-pick">
          <span>お手本の速さ</span>
          <select value={rateId}
                  onChange={(e) => { setRateId(e.target.value); saveRateId(e.target.value) }}>
            {SPEECH_RATES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}({r.id}%)</option>
            ))}
          </select>
        </label>
        {/* **測れていないものを、測れているように見せない。**
            採点はまだ入れていないことを、はっきり書いておく */}
        <p className="notice notice--info">
          いまは<strong>聴いて、まねて、言う</strong>ところまでです。
          点数は付きません(録音を解析する仕組みが決まってから足します)。
        </p>
      </div>

      {error && <p className="notice notice--warn">{error}</p>}

      {loading ? (
        <p className="muted">読み込んでいます…</p>
      ) : !total ? (
        <div className="card">
          <p className="muted">
            発音の練習に使える教材(単語・フレーズ)がまだありません。
          </p>
        </div>
      ) : (
        <>
          <p className="muted">{total} 語・フレーズ</p>
          {cards.map(({ material: m, items }) => (
            <div key={m.id} className="card">
              <MaterialTitle
                title={m.title}
                headline={m.headline}
                fallbackTags={[(m.tagIds ?? []).map(weaknessTagLabel).join(' + '),
                  cefrLabel(m.level)]}
              />
              <ol className="pron-list">
                {items.map((it) => (
                  <li key={it.id} className="qa-row pron-row">
                    <div className="row-head">
                      <span className="row-tools">
                        <SpeakButton text={it.prompt_en} className="etext-listen"
                                     clipVoice={(m.voiceIds ?? [])[0]}
                                     rate={rateOf(rateId)} />
                      </span>
                    </div>
                    <p className="pron-en">
                      <EnglishText text={it.prompt_en} textJa={it.prompt_ja}
                                   level={m.level} statuses={statuses} onMark={mark} />
                    </p>
                    {/* **発音記号は、教材を作るときに一緒に作ってある**(0020)。
                        開くたびに引かない。0020 より前の教材では出ないだけ */}
                    <Phonetic value={it.phonetic} />
                    {it.prompt_ja && <p className="muted pron-ja">{it.prompt_ja}</p>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
