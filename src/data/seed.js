/**
 * 初回に入っているサンプルデータ。
 * 画面が空っぽだと動きが分からないため、デモ用に3人分の学習記録を入れています。
 * 画面右上の「サンプルデータに戻す」でいつでもこの状態に戻せます。
 */
import { toDateKey } from '../lib/format.js'
import { createId } from '../lib/store.js'

const learners = [
  { id: 'learner-1', name: '田中 みなみ', grade: '中級', joinedAt: '2026-05-10' },
  { id: 'learner-2', name: '佐藤 けんた', grade: '初級', joinedAt: '2026-06-02' },
  { id: 'learner-3', name: '鈴木 あおい', grade: '上級', joinedAt: '2026-04-18' },
]

const categoryIds = ['reading', 'vocab', 'grammar', 'listening', 'speaking']
const materials = ['速読英単語', 'NHKラジオ英会話', 'TOEIC公式問題集', 'Podcast: Daily News', '英会話レッスン']

/** サンプルの学習記録を作る(ランダムだが、それらしい分布になるようにしている) */
function buildStudyLogs() {
  const logs = []
  const now = new Date()

  learners.forEach((learner, learnerIndex) => {
    // 学習者ごとに「よく学習する人 / たまにサボる人」の差をつける
    const diligence = [0.85, 0.5, 0.7][learnerIndex]

    for (let daysAgo = 27; daysAgo >= 0; daysAgo -= 1) {
      if (Math.random() > diligence) continue // この日はお休み

      const date = new Date(now)
      date.setDate(date.getDate() - daysAgo)

      const sessions = Math.random() < 0.3 ? 2 : 1
      for (let s = 0; s < sessions; s += 1) {
        logs.push({
          id: createId(),
          learnerId: learner.id,
          studiedOn: toDateKey(date),
          minutes: [10, 15, 20, 25, 30, 40, 45, 60][Math.floor(Math.random() * 8)],
          category: categoryIds[Math.floor(Math.random() * categoryIds.length)],
          material: materials[Math.floor(Math.random() * materials.length)],
          note: '',
          createdAt: date.toISOString(),
        })
      }
    }
  })

  return logs.sort((a, b) => (a.studiedOn < b.studiedOn ? 1 : -1))
}

/** サンプルの発音練習の記録を作る(※点数はシミュレーション値) */
function buildPronunciationAttempts() {
  const attempts = []
  const now = new Date()
  const phrases = [
    'Could you say that again, please?',
    'I usually walk to the station in the morning.',
    'She has been working on this project for three months.',
  ]

  learners.forEach((learner, learnerIndex) => {
    for (let daysAgo = 20; daysAgo >= 0; daysAgo -= 2) {
      if (Math.random() > 0.6) continue
      const date = new Date(now)
      date.setDate(date.getDate() - daysAgo)
      // 日が経つにつれて少しずつ上達していく形にする
      const progress = (20 - daysAgo) * 0.6
      attempts.push({
        id: createId(),
        learnerId: learner.id,
        targetText: phrases[learnerIndex % phrases.length],
        score: Math.round(Math.min(97, 60 + progress + Math.random() * 12)),
        recognizedText: null,
        engine: 'mock', // ← シミュレーションで作られた点数であることの印
        attemptedAt: date.toISOString(),
      })
    }
  })

  return attempts.sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1))
}

export function buildSeed() {
  return {
    learners,
    studyLogs: buildStudyLogs(),
    pronunciationAttempts: buildPronunciationAttempts(),
  }
}
