/**
 * 集計 — **管理者(owner)だけが見る、スクール全体の眺め**。
 *
 * 【何を数えるか】(2026-08 利用者の指定で作り直した)
 *
 *   > 集計だけは残してください。しかし今のままでは見にくすぎるので、
 *   > 教材の種類と内容に準じたものに変えてください。
 *
 *   前は「ゲストが自分で入力した学習時間」を並べていた。その入力欄は
 *   0022 の設計変更で無くなっている(「回数や時間を裏で記録し」)。
 *   **入らなくなった数字のグラフを置き続けると、いつまでも 0 が並ぶ。**
 *
 *   数えるものを、いま実際にあるものへ移した。
 *
 *   | 何 | どこから |
 *   |---|---|
 *   | **種類**   | `materials.kind`(文型ドリル / 記事 / 会話 / 単語 / フレーズ) |
 *   | **内容**   | 弱点タグと CEFR レベル |
 *   | **届き方** | `assignments`(共有した回数・ゲストが済ませた回数) |
 *   | **取り組み** | `practice_days`(0022。裏で数えたもの) |
 *
 * 【この画面がいちばん見せたいのは「ライブラリの穴」】
 *   仕様書 第5.6.2節のとおり、この仕組みは**教材の再利用**が前提である。
 *   だから管理者が見るべきなのは合計の棒グラフではなく、
 *   **まだ1本も教材が無い弱点**と、**ゲストがいるのに教材が無いレベル**である。
 *   0 の行を隠さない。隠すと穴が見えない。
 *
 * 【数え方は画面に持たない】
 *   合計も割合も DB(0023)が返す。画面で足し直すと、期間の切り方や
 *   端末の時差で食い違う。
 *
 * 【Supabase が無いときは、それをそのまま言う】
 *   見本の数字を置かない。**測っていないものを、測れているように見せない。**
 */
import { useEffect, useMemo, useState } from 'react'
import { weaknessCategoryLabel } from '../data/weaknessTags.js'
import { kindLabel } from '../lib/materials.js'
import { PRACTICE_KINDS } from '../lib/practice.js'
import { NOT_APPLIED, STAT_RANGES, loadSchoolStats, rateOf } from '../lib/schoolStats.js'
import { formatMinutes } from '../lib/format.js'
import HBarChart from './charts/HBarChart.jsx'

/**
 * 棒グラフの札は**短くする。** 「リーディング(記事)」は途中で切れて
 * 「リーディン…」になり、何の行か分からなくなった(実測)。
 */
const kindShort = (id) => kindLabel(id).replace(/[((].*$/, '')

/** 種類ごとの「中身」の数え方。記事は段落、会話は発言、あとは問 */
const itemUnit = (kind) => (kind === 'reading' ? '段落' : kind === 'dialogue' ? '発言' : '問')

/** 割合を「78%」か「—」で出す。**母数が 0 のときに 0% と書かない** */
const pct = (part, whole) => {
  const r = rateOf(part, whole)
  return r === null ? '—' : `${r}%`
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [holesOnly, setHolesOnly] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadSchoolStats(days).then(({ data, error: e }) => {
      if (!alive) return
      setLoading(false)
      setError(e)
      setStats(data)
    })
    return () => { alive = false }
  }, [days])

  const s = stats?.summary ?? null

  /** 教材がまだ1本も無い弱点。**ここが穴である** */
  const holes = useMemo(
    () => (stats?.byTag ?? []).filter((t) => !t.materials), [stats])
  const tagRows = useMemo(
    () => (holesOnly ? holes : (stats?.byTag ?? [])), [stats, holes, holesOnly])

  /** ゲストがいるのに教材が足りないレベル */
  const levelGaps = useMemo(
    () => (stats?.byLevel ?? []).filter((l) => l.learners > 0 && l.materials === 0), [stats])

  if (error === 'unset') {
    return (
      <div className="card">
        <h2 className="card-title">集計</h2>
        <p className="notice notice--info">
          Supabase につながっていないため、集計は出せません。
          <br />
          集計はスクール全体の数字なので、<strong>見本の数字は出しません</strong>
          (実際と食い違うため)。
        </p>
      </div>
    )
  }

  if (error === NOT_APPLIED) {
    return (
      <div className="card">
        <h2 className="card-title">集計</h2>
        <p className="notice notice--warn">
          集計の数え方(0023)が、まだ Supabase に入っていません。
        </p>
        <p className="card-hint">
          GitHub のリポジトリにあるファイル
          <code> supabase/apply/pending_2026-08-29.sql </code>
          を、Supabase の 左メニュー <strong>SQL Editor</strong> →{' '}
          <strong>New query</strong> に貼って <strong>Run</strong> を押すと出るようになります。
          <br />
          手順は <code>docs/APPLY.md</code> にあります。
        </p>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <div className="filter-row">
        <span className="filter-label">表示期間</span>
        {STAT_RANGES.map((r) => (
          <button key={r.id} type="button"
                  className={`btn btn--toggle${days === r.id ? ' is-active' : ''}`}
                  onClick={() => setDays(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {error && error !== 'unset' && error !== NOT_APPLIED
        && <p className="notice notice--warn">{error}</p>}
      {loading && <p className="muted">読み込んでいます…</p>}

      {/* ── 全体の数 ─────────────────────────────────────────── */}
      <div className="stat-row">
        <Stat label="ライブラリの教材" value={s?.material_count ?? 0} unit="本"
              note="発行済み" />
        <Stat label="この期間に作った" value={s?.material_new ?? 0} unit="本" />
        <Stat label="この期間に共有" value={s?.assigned_count ?? 0} unit="回" />
        <Stat label="ゲストが済ませた割合"
              value={s?.done_rate == null ? '—' : `${s.done_rate}%`}
              note={`${s?.done_count ?? 0} / ${s?.assigned_count ?? 0} 回`} />
      </div>
      <div className="stat-row">
        <Stat label="受講中のゲスト" value={s?.learner_active ?? 0} unit="人"
              note={`休会 ${s?.learner_paused ?? 0} / 退会 ${s?.learner_withdrawn ?? 0}`} />
        <Stat label="トレーナー" value={s?.trainer_count ?? 0} unit="人" />
        <Stat label="ゲスト1人あたり"
              value={s?.practice_minutes_weekly == null ? '—' : `${s.practice_minutes_weekly}分`}
              note="アプリでの取り組み・週あたり" />
      </div>

      {/* ── 教材の種類ごと ───────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">教材の種類ごと</h2>
        <p className="card-hint">
          <strong>作った数と配った数は別物です。</strong>
          再利用が効いていれば、共有した回数は教材の数よりずっと多くなります。
        </p>

        <HBarChart unit="count"
                   data={(stats?.byKind ?? []).map((k) => ({
                     key: k.kind, label: kindShort(k.kind), value: k.materials,
                   }))}
                   emptyMessage="まだ教材がありません。" />

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>種類</th>
                <th className="num">教材</th>
                <th className="num">この期間に作った</th>
                <th className="num">中身</th>
                <th className="num">共有</th>
                <th className="num">済ませた</th>
                <th className="num">達成率</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.byKind ?? []).map((k) => (
                <tr key={k.kind}>
                  <td>{kindLabel(k.kind)}</td>
                  <td className="num">{k.materials} 本</td>
                  <td className="num">{k.fresh} 本</td>
                  <td className="num">{k.items} {itemUnit(k.kind)}</td>
                  <td className="num">{k.assigned} 回</td>
                  <td className="num">{k.done} 回</td>
                  <td className="num">{pct(k.done, k.assigned)}</td>
                </tr>
              ))}
              {!(stats?.byKind ?? []).length && !loading && (
                <tr><td colSpan={7} className="muted">まだ教材がありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 内容(弱点)ごと ─────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">弱点ごと(教材の中身)</h2>
        <p className="card-hint">
          レッスンで弱点を指摘しても、<strong>その弱点の教材が無ければ宿題が出せません。</strong>
          まず「0 本」の行を埋めていくのが早道です。
        </p>

        {holes.length > 0 ? (
          <p className="notice notice--warn">
            教材がまだ 1 本も無い弱点が <strong>{holes.length} 件</strong>あります。
          </p>
        ) : (
          <p className="notice notice--ok">すべての弱点に教材があります。</p>
        )}

        <div className="filter-row">
          <button type="button"
                  className={`btn btn--toggle${holesOnly ? ' is-active' : ''}`}
                  onClick={() => setHolesOnly(true)}>
            教材が無いものだけ({holes.length})
          </button>
          <button type="button"
                  className={`btn btn--toggle${holesOnly ? '' : ' is-active'}`}
                  onClick={() => setHolesOnly(false)}>
            すべて({(stats?.byTag ?? []).length})
          </button>
        </div>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>弱点</th>
                <th>見出し</th>
                <th className="num">教材</th>
                <th className="num">共有</th>
                <th className="num">達成率</th>
              </tr>
            </thead>
            <tbody>
              {tagRows.map((t) => (
                <tr key={t.tagId}>
                  <td>{t.label}</td>
                  <td className="muted">{weaknessCategoryLabel(t.category)}</td>
                  <td className="num">
                    {t.materials} 本
                    {!t.materials && <span className="badge badge--alert">無し</span>}
                  </td>
                  <td className="num">{t.assigned} 回</td>
                  <td className="num">{pct(t.done, t.assigned)}</td>
                </tr>
              ))}
              {!tagRows.length && !loading && (
                <tr><td colSpan={5} className="muted">該当する弱点はありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── レベルごと ───────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">レベルごと(教材とゲストの数)</h2>
        <p className="card-hint">
          <strong>ゲストがいるのに教材が無いレベル</strong>が、次に作るべきところです。
        </p>

        {levelGaps.length > 0 && (
          <p className="notice notice--warn">
            ゲストがいるのに教材が 0 本のレベル:{' '}
            <strong>{levelGaps.map((l) => l.level).join(' / ')}</strong>
          </p>
        )}

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>レベル</th>
                <th className="num">教材</th>
                <th className="num">受講中のゲスト</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.byLevel ?? []).map((l) => (
                <tr key={l.level}>
                  <td>{l.level}</td>
                  <td className="num">
                    {l.materials} 本
                    {l.learners > 0 && !l.materials
                      && <span className="badge badge--alert">無し</span>}
                  </td>
                  <td className="num">{l.learners} 人</td>
                </tr>
              ))}
              {!(stats?.byLevel ?? []).length && !loading && (
                <tr><td colSpan={3} className="muted">まだ教材もゲストもありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── アプリでの取り組み(0022 が裏で数えたもの)──────────── */}
      <section className="card">
        <h2 className="card-title">アプリでの取り組み</h2>
        <p className="card-hint">
          ゲストは何も入力していません。<strong>開いていた時間をこちらで数えています</strong>
          (裏に回した端末の時間は数えません)。
        </p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>何に</th>
                <th className="num">人数</th>
                <th className="num">回数</th>
                <th className="num">時間</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.practice ?? []).map((p) => (
                <tr key={p.kind}>
                  <td>{PRACTICE_KINDS[p.kind] ?? p.kind}</td>
                  <td className="num">{p.learners} 人</td>
                  <td className="num">{p.times} 回</td>
                  <td className="num">{formatMinutes(Math.round(p.seconds / 60))}</td>
                </tr>
              ))}
              {!(stats?.practice ?? []).length && !loading && (
                <tr>
                  <td colSpan={4} className="muted">
                    この期間に取り組みの記録がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, unit = '', note = '' }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </p>
      {note && <p className="stat-note">{note}</p>}
    </div>
  )
}
