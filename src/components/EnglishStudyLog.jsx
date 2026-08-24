import { useEffect, useMemo, useState } from 'react'
import { categories, categoryColor, categoryLabel } from '../data/categories.js'
import { practicePhrases } from '../data/practicePhrases.js'
import { calculateStreak, formatMinutes, lastNDays, shortDate, today } from '../lib/format.js'
import { addPronunciationAttempt, addStudyLog, removeStudyLog } from '../lib/store.js'
import { scorePronunciation } from '../lib/pronunciation.js'
import {
  hasGoodVoice,
  isRecordingSupported,
  isSpeechSupported,
  loadEnglishVoices,
  speak,
  startRecording,
  stopSpeaking,
  voiceAccentLabel,
  voiceQualityLabel,
} from '../lib/speech.js'
import BarChart from './charts/BarChart.jsx'
import HBarChart from './charts/HBarChart.jsx'

/** 学習者向けの画面 */
export default function EnglishStudyLog({ state, setState, learnerId }) {
  const logs = useMemo(
    () => state.studyLogs.filter((log) => log.learnerId === learnerId),
    [state.studyLogs, learnerId],
  )
  const attempts = useMemo(
    () => state.pronunciationAttempts.filter((a) => a.learnerId === learnerId),
    [state.pronunciationAttempts, learnerId],
  )

  return (
    <div className="stack-lg">
      <SummaryRow logs={logs} attempts={attempts} />
      <div className="grid-2">
        <StudyLogForm state={state} setState={setState} learnerId={learnerId} />
        <PronunciationPractice state={state} setState={setState} learnerId={learnerId} />
      </div>
      <div className="grid-2">
        <DailyChart logs={logs} />
        <CategoryChart logs={logs} />
      </div>
      <HistoryTable logs={logs} state={state} setState={setState} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 上部のサマリー(数字を大きく見せる部分)                             */
/* ------------------------------------------------------------------ */

function SummaryRow({ logs, attempts }) {
  const totalMinutes = logs.reduce((sum, log) => sum + log.minutes, 0)
  const streak = calculateStreak(logs.map((log) => log.studiedOn))
  const thisWeek = lastNDays(7)
  const weekMinutes = logs
    .filter((log) => thisWeek.includes(log.studiedOn))
    .reduce((sum, log) => sum + log.minutes, 0)
  const latestScore = attempts[0]?.score ?? null

  return (
    <div className="stat-row">
      <Stat label="連続学習日数" value={streak} unit="日" />
      <Stat label="今週の学習時間" value={formatMinutes(weekMinutes)} />
      <Stat label="累計学習時間" value={formatMinutes(totalMinutes)} />
      <Stat
        label="最新の発音スコア"
        value={latestScore === null ? '—' : latestScore}
        unit={latestScore === null ? '' : '点'}
        note={latestScore === null ? '' : '※シミュレーション値'}
      />
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

/* ------------------------------------------------------------------ */
/* 学習記録の入力フォーム                                              */
/* ------------------------------------------------------------------ */

function StudyLogForm({ state, setState, learnerId }) {
  const [form, setForm] = useState({
    studiedOn: today(),
    minutes: 30,
    category: 'reading',
    material: '',
    note: '',
  })
  const [message, setMessage] = useState('')

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    const minutes = Number(form.minutes)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setMessage('学習時間は1分以上で入力してください。')
      return
    }
    setState((prev) => addStudyLog(prev, { ...form, minutes, learnerId }))
    setMessage('記録しました。')
    setForm((prev) => ({ ...prev, material: '', note: '' }))
    setTimeout(() => setMessage(''), 2500)
  }

  return (
    <section className="card">
      <h2 className="card-title">今日の学習を記録する</h2>

      <form onSubmit={handleSubmit} className="form">
        <div className="field-row">
          <label className="field">
            <span>学習日</span>
            <input type="date" value={form.studiedOn} onChange={update('studiedOn')} required />
          </label>
          <label className="field">
            <span>学習時間(分)</span>
            <input type="number" min="1" max="600" value={form.minutes} onChange={update('minutes')} required />
          </label>
        </div>

        <fieldset className="field">
          <legend>カテゴリ</legend>
          <div className="chip-row">
            {categories.map((cat) => (
              <label key={cat.id} className={`chip${form.category === cat.id ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="category"
                  value={cat.id}
                  checked={form.category === cat.id}
                  onChange={update('category')}
                />
                <span className="chip-dot" style={{ background: cat.color }} aria-hidden="true" />
                {cat.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>教材名</span>
          <input
            type="text"
            value={form.material}
            onChange={update('material')}
            placeholder="例: NHKラジオ英会話 8月号"
          />
        </label>

        <label className="field">
          <span>メモ(任意)</span>
          <textarea
            rows="2"
            value={form.note}
            onChange={update('note')}
            placeholder="覚えた表現、つまずいたところなど"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary">記録する</button>
          {message && <span className="form-message">{message}</span>}
        </div>
      </form>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 発音練習                                                            */
/* ------------------------------------------------------------------ */

function PronunciationPractice({ state, setState, learnerId }) {
  const [phraseId, setPhraseId] = useState(practicePhrases[0].id)
  const [voices, setVoices] = useState([])
  const [voiceName, setVoiceName] = useState(() => {
    try {
      return localStorage.getItem('english-ai-system:voice') || ''
    } catch {
      return ''
    }
  })
  const [rate, setRate] = useState(() => {
    try {
      return Number(localStorage.getItem('english-ai-system:rate')) || 0.85
    } catch {
      return 0.85
    }
  })
  const [recorder, setRecorder] = useState(null)
  const [recordedUrl, setRecordedUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('') // '' | 'recording' | 'scoring'
  const [error, setError] = useState('')

  const phrase = practicePhrases.find((p) => p.id === phraseId)

  useEffect(() => {
    loadEnglishVoices().then((list) => {
      setVoices(list)
      // 記憶した声が今の端末にない場合は、いちばん品質の良い声に戻す
      // (list は品質の良い順に並んでいる)
      setVoiceName((prev) => (list.some((v) => v.name === prev) ? prev : list[0]?.name || ''))
    })
    return () => stopSpeaking()
  }, [])

  // 選んだ声と速さを覚えておく
  useEffect(() => {
    try {
      if (voiceName) localStorage.setItem('english-ai-system:voice', voiceName)
      localStorage.setItem('english-ai-system:rate', String(rate))
    } catch {
      /* 保存できなくても読み上げ自体は動く */
    }
  }, [voiceName, rate])

  const selectedVoice = voices.find((v) => v.name === voiceName) || voices[0]

  // 録音の途中で画面を離れた場合に、マイクを解放する。
  // 解放し忘れると録音マークが消えず、次に戻ってきたとき録音を開始できない。
  useEffect(() => {
    return () => {
      if (recorder) recorder.cancel()
    }
  }, [recorder])

  // 録音した音声のURLは、使い終わったらメモリから解放する
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
  }, [recordedUrl])

  const handleSpeak = () => {
    if (!isSpeechSupported()) {
      setError('このブラウザは読み上げに対応していません。')
      return
    }
    setError('')
    speak(phrase.text, { voice: selectedVoice, rate })
  }

  const handleRecordStart = async () => {
    setError('')
    setResult(null)
    // 前回の録音を破棄してから始める(録り直しを何度でもできるようにするため)
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    try {
      const rec = await startRecording()
      setRecorder(rec)
      setStatus('recording')
    } catch (err) {
      console.error(err)
      setError(
        'マイクを使えませんでした。ブラウザのマイク許可を確認してください。' +
          '(セキュリティ上、https:// のページか localhost でないとマイクは使えません)',
      )
    }
  }

  const handleRecordStop = async () => {
    if (!recorder) return
    setStatus('scoring')
    const { blob, url } = await recorder.stop()
    setRecorder(null)
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })

    // ★ここで採点しています。現在はシミュレーションです(lib/pronunciation.js 参照)
    const scored = await scorePronunciation({ targetText: phrase.text, audioBlob: blob })
    setResult(scored)
    setStatus('')

    // 保存するのは点数と英文だけ。音声そのものは保存しません。
    setState((prev) =>
      addPronunciationAttempt(prev, {
        learnerId,
        targetText: phrase.text,
        score: scored.score,
        recognizedText: scored.recognizedText,
        engine: scored.engine,
      }),
    )
  }

  const recentScores = state.pronunciationAttempts
    .filter((a) => a.learnerId === learnerId)
    .slice(0, 10)
    .reverse()

  return (
    <section className="card">
      <h2 className="card-title">発音練習</h2>

      <div className="notice notice--warn">
        <strong>お知らせ:</strong> ここに出る発音スコアは、音声を解析した結果ではなく
        <strong>仮の数値(シミュレーション)</strong>です。画面の流れを確認するための暫定実装です。
      </div>

      <label className="field">
        <span>練習する英文</span>
        <select value={phraseId} onChange={(e) => setPhraseId(e.target.value)}>
          {practicePhrases.map((p) => (
            <option key={p.id} value={p.id}>
              [{p.level}] {p.text}
            </option>
          ))}
        </select>
      </label>

      <blockquote className="phrase">
        <p className="phrase-en">{phrase.text}</p>
        <p className="phrase-ja">{phrase.ja}</p>
      </blockquote>

      {voices.length > 0 && (
        <div className="field-row">
          <label className="field">
            <span>
              お手本の声
              <small className="field-hint">品質の良い順に並んでいます</small>
            </span>
            <select value={selectedVoice?.name ?? ''} onChange={(e) => setVoiceName(e.target.value)}>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  [{voiceQualityLabel(v)}] {v.name} — {voiceAccentLabel(v)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>読み上げの速さ</span>
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              <option value={0.7}>ゆっくり</option>
              <option value={0.85}>やや ゆっくり</option>
              <option value={1}>ふつう</option>
              <option value={1.15}>やや 速い</option>
            </select>
          </label>
        </div>
      )}

      {voices.length > 0 && !hasGoodVoice(voices) && (
        <div className="notice notice--warn">
          <strong>この端末には、お手本に適した音声が入っていません。</strong>
          <br />
          いま選べるのは簡易な音声のみです。より自然な音声を追加できます。
          <br />
          <small>
            iPhone / iPad: 設定 → アクセシビリティ → 読み上げコンテンツ → 声 → 英語 から、
            「高品質」と表示された声をダウンロード
            <br />
            Mac: システム設定 → アクセシビリティ → 読み上げコンテンツ → システムの声 → 声を管理
          </small>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={handleSpeak}>
          お手本を聞く
        </button>

        {status !== 'recording' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleRecordStart}
            disabled={status === 'scoring' || !isRecordingSupported()}
          >
            {status === 'scoring' ? '採点中…' : result || recordedUrl ? 'もう一度録音する' : '録音する'}
          </button>
        ) : (
          <button type="button" className="btn btn--danger" onClick={handleRecordStop}>
            録音を止めて採点
          </button>
        )}
      </div>

      {!isRecordingSupported() && (
        <p className="hint">このブラウザ・環境では録音を使えません。お手本の読み上げのみ利用できます。</p>
      )}
      {status === 'recording' && <p className="recording-indicator">● 録音中… 英文を声に出して読んでください</p>}
      {error && <p className="error">{error}</p>}

      {recordedUrl && (
        <div className="field">
          <span className="field-label">自分の録音を聞き返す</span>
          <audio src={recordedUrl} controls />
          <p className="hint">
            納得いくまで何度でも録り直せます。「もう一度録音する」を押すと、前の録音は破棄されます。
            <br />
            録音した音声はこの端末の中だけにあり、サーバーには送っていません。ページを閉じると消えます。
          </p>
        </div>
      )}

      {result && (
        <div className="score">
          <div className="score-main">
            <span className="score-value">{result.score}</span>
            <span className="score-unit">点</span>
            {result.isSimulated && <span className="badge badge--warn">シミュレーション</span>}
          </div>
          <HBarChart
            unit="score"
            data={[
              { key: 'accuracy', label: '正確さ', value: result.breakdown.accuracy, color: 'var(--series-1)' },
              { key: 'fluency', label: '流暢さ', value: result.breakdown.fluency, color: 'var(--series-1)' },
              { key: 'intonation', label: '抑揚', value: result.breakdown.intonation, color: 'var(--series-1)' },
            ]}
          />
        </div>
      )}

      {recentScores.length > 1 && (
        <div className="chart-block">
          <h3 className="chart-title">発音スコアの推移(直近10回)</h3>
          <BarChart
            unit="score"
            height={100}
            labelEnds
            data={recentScores.map((a, i) => ({
              key: a.id,
              label: `${i + 1}回目`,
              axisLabel: '',
              value: a.score,
            }))}
          />
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* グラフ                                                              */
/* ------------------------------------------------------------------ */

function DailyChart({ logs }) {
  const days = lastNDays(14)
  const data = days.map((day) => ({
    key: day,
    label: shortDate(day),
    axisLabel: shortDate(day),
    value: logs.filter((log) => log.studiedOn === day).reduce((sum, log) => sum + log.minutes, 0),
  }))

  return (
    <section className="card">
      <h2 className="card-title">直近14日間の学習時間</h2>
      <BarChart data={data} emptyMessage="まだ記録がありません。上のフォームから記録してみましょう。" />
    </section>
  )
}

function CategoryChart({ logs }) {
  const data = categories.map((cat) => ({
    key: cat.id,
    label: cat.label,
    color: cat.color,
    value: logs.filter((log) => log.category === cat.id).reduce((sum, log) => sum + log.minutes, 0),
  }))

  return (
    <section className="card">
      <h2 className="card-title">カテゴリ別の学習時間(累計)</h2>
      <HBarChart data={data} emptyMessage="まだ記録がありません。" />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 履歴一覧                                                            */
/* ------------------------------------------------------------------ */

function HistoryTable({ logs, setState }) {
  const [limit, setLimit] = useState(10)
  const visible = logs.slice(0, limit)

  const handleDelete = (id) => {
    if (!window.confirm('この記録を削除しますか?')) return
    setState((prev) => removeStudyLog(prev, id))
  }

  return (
    <section className="card">
      <h2 className="card-title">学習の履歴</h2>

      {logs.length === 0 ? (
        <p className="chart-empty chart-empty--block">まだ記録がありません。</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>学習日</th>
                  <th>カテゴリ</th>
                  <th className="num">時間</th>
                  <th>教材</th>
                  <th>メモ</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {visible.map((log) => (
                  <tr key={log.id}>
                    <td>{log.studiedOn}</td>
                    <td>
                      <span className="chip-dot" style={{ background: categoryColor(log.category) }} aria-hidden="true" />
                      {categoryLabel(log.category)}
                    </td>
                    <td className="num">{formatMinutes(log.minutes)}</td>
                    <td>{log.material || '—'}</td>
                    <td className="note-cell">{log.note || '—'}</td>
                    <td>
                      <button type="button" className="btn btn--link" onClick={() => handleDelete(log.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {limit < logs.length && (
            <button type="button" className="btn" onClick={() => setLimit((n) => n + 20)}>
              もっと見る(残り {logs.length - limit} 件)
            </button>
          )}
        </>
      )}
    </section>
  )
}
