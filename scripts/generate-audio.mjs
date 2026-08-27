/**
 * お手本音声を事前に生成する道具。
 *
 * ★何をするか
 *   src/data/practicePhrases.js の英文を、4人の話者それぞれで読み上げた
 *   音声ファイルを作り、public/audio/ に保存します。
 *   あわせて目録(manifest.json)を作ります。
 *
 * ★使い方
 *   1. Azure のポータルで「音声サービス」を作り、鍵とリージョンを控える
 *   2. .env に次を書く(このファイルは Git に入りません)
 *        AZURE_SPEECH_KEY=xxxxxxxx
 *        AZURE_SPEECH_REGION=japaneast
 *   3. npm run audio
 *
 *   すでにある音声は作り直しません。英文を足したときだけ差分が作られます。
 *
 * ★費用
 *   1文字あたりで課金され、毎月50万文字までは無料です。
 *   例文が数百件でも無料枠に収まります(仕様書 5.2)。
 *
 * ★なぜ事前に作るのか
 *   端末に入っている音声は品質がばらばらで、iPhone では簡易版しか
 *   使えません。あらかじめ作って配れば、全端末で同じ品質になります。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.join(process.cwd(), 'public', 'audio')

/**
 * 話者の定義。src/data/speakers.js と id を揃えること。
 * voice は Azure の音声名。
 */
const SPEAKERS = [
  { id: 'us-female', voice: 'en-US-EmmaMultilingualNeural', lang: 'en-US' },
  { id: 'us-male', voice: 'en-US-RyanMultilingualNeural', lang: 'en-US' },
  { id: 'uk-female', voice: 'en-GB-SoniaNeural', lang: 'en-GB' },
  { id: 'uk-male', voice: 'en-GB-RyanNeural', lang: 'en-GB' },
]

/** 学習用にやや遅めで読ませる */
const SPEAKING_RATE = '-8%'

/** .env を読む(この道具のためだけの簡単な読み取り) */
async function loadEnv() {
  try {
    const text = await readFile(path.join(process.cwd(), '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  } catch {
    /* .env が無くても、環境変数が設定されていれば動く */
  }
}

/** 練習用の英文を取り出す(この道具からは素直に読めないため正規表現で拾う) */
async function loadPhrases() {
  const source = await readFile(path.join(process.cwd(), 'src', 'data', 'practicePhrases.js'), 'utf8')
  const phrases = []
  const pattern = /\{\s*id:\s*'([^']+)'[^}]*?text:\s*'([^']+)'/g
  let match
  while ((match = pattern.exec(source))) {
    phrases.push({ id: match[1], text: match[2] })
  }
  return phrases
}

/** 記号を安全な形に置き換える(SSML に埋め込むため) */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Azure に音声を作らせる */
async function synthesize({ text, speaker, key, region }) {
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${speaker.lang}">` +
    `<voice name="${speaker.voice}">` +
    `<prosody rate="${SPEAKING_RATE}">${escapeXml(text)}</prosody>` +
    `</voice></speak>`

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'english-ai-system',
    },
    body: ssml,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`音声を生成できませんでした (${res.status}) ${detail.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  await loadEnv()
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION

  const phrases = await loadPhrases()
  if (!phrases.length) {
    console.error('練習用の英文を読み取れませんでした。')
    process.exit(1)
  }

  if (!key || !region) {
    console.error('AZURE_SPEECH_KEY と AZURE_SPEECH_REGION が設定されていません。')
    console.error('.env に書くか、環境変数として渡してください。')
    console.error('')
    console.error(`対象: 英文 ${phrases.length}件 × 話者 ${SPEAKERS.length}人 = ${phrases.length * SPEAKERS.length}ファイル`)
    const chars = phrases.reduce((sum, p) => sum + p.text.length, 0) * SPEAKERS.length
    console.error(`文字数の合計: 約 ${chars.toLocaleString()} 文字(毎月50万文字まで無料)`)
    process.exit(1)
  }

  let created = 0
  let skipped = 0
  const manifest = { speakers: SPEAKERS.map((s) => s.id), phrases: {} }

  for (const phrase of phrases) {
    manifest.phrases[phrase.id] = []
    for (const speaker of SPEAKERS) {
      const dir = path.join(OUT_DIR, speaker.id)
      const file = path.join(dir, `${phrase.id}.mp3`)

      if (existsSync(file)) {
        skipped += 1
        manifest.phrases[phrase.id].push(speaker.id)
        continue
      }

      await mkdir(dir, { recursive: true })
      const audio = await synthesize({ text: phrase.text, speaker, key, region })
      await writeFile(file, audio)
      manifest.phrases[phrase.id].push(speaker.id)
      created += 1
      console.log(`  作成: ${speaker.id}/${phrase.id}.mp3 (${Math.round(audio.length / 1024)}KB)`)
    }
  }

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n完了: 新規 ${created}件 / 既存 ${skipped}件`)
  console.log(`目録: public/audio/manifest.json`)
}

main().catch((err) => {
  console.error('失敗しました:', err.message)
  process.exit(1)
})
