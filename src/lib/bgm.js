/**
 * 自作の音楽(BGM)の出し入れと、鳴らす仕組み(0049)。
 *
 * 2026-09 利用者の指定。
 *
 *   > また、これからは自作の音楽が流れるようにしたいです。
 *
 * 置き場所は利用者が選んだ ——「**Supabase に置いて、画面から入れる**」。
 * リポジトリに MP3 を置かない(曲を足すたびに GitHub の操作が要る)。
 *
 * ============================================================================
 * 【置き場は2つに分かれている】(`learnerFiles.js`・0031 とまったく同じ形)
 *
 *   ・**中身**(バイト列)は Storage の `bgm` バケツ(**非公開**)
 *   ・**何があるか**(題・置き場所・入れた人)は `bgm_tracks` の表
 *
 * 【聴くのは全員、入れられるのはトレーナーだけ】
 *   曲は**スクールみんなのもの**である。ゲストごとに分けない
 *   (分けると、トレーナーが1人ずつ入れて回ることになる)。
 *   **判定は 0049 の RLS。画面に持たせない。**
 *
 * 【算段は `wordRadio.js`】
 *   「どこで流すか」「音の大きさ」はあちらが持っている
 *   (**素の node で確かめられる**形にしてある)。
 *   ここは Supabase と `<audio>` を触るところだけである。
 *
 * **例外を外に出さない。** 呼んだ側の `await` がそこで止まる。
 */
import { supabase, withTimeout } from './supabase.js'
import { BGM_VOLUME, bgmVolume } from './wordRadio.js'

const BUCKET = 'bgm'
const TABLE = 'bgm_tracks'

/** 1曲の上限(30MB)。**大きすぎるものは置かせない** */
export const MAX_TRACK_BYTES = 30 * 1024 * 1024
const OK_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg']

/**
 * **0049 を貼る前でも壊れない。** 一度断られたら覚えておき、
 * そのあとは呼びに行かない(`qrReviewSupported()` と同じ作法)。
 */
let noTable = false
export const bgmSupported = () => Boolean(supabase) && !noTable

const fail = (e) => {
  const m = String(e?.message ?? e ?? '')
  if (/relation .*bgm_tracks.* does not exist|Could not find the table/i.test(m)) {
    noTable = true
    return '曲の置き場(0049 の SQL)がまだ Supabase に入っていません'
  }
  if (/bucket not found/i.test(m)) {
    noTable = true
    return '曲のバケツ(bgm)がまだ作られていません(0049 の SQL を貼ってください)'
  }
  if (/row-level security|violates row-level/i.test(m)) {
    return '曲を入れられるのはトレーナーと管理者だけです'
  }
  return m || '失敗しました'
}

/** 置ける形か。**実行できるものは置かせない** */
function checkFile(file) {
  if (!file) return 'ファイルを選んでください'
  const ext = String(file.name || '').split('.').pop()?.toLowerCase()
  if (!OK_EXT.includes(ext)) {
    return `この形の音は置けません(置けるのは ${OK_EXT.join(' / ')})`
  }
  if (file.size > MAX_TRACK_BYTES) {
    return `1曲 ${Math.round(MAX_TRACK_BYTES / 1024 / 1024)}MB までです`
  }
  return null
}

/** 曲の一覧。新しいものが先 */
export async function listTracks() {
  if (!bgmSupported()) return { data: [], error: null }
  try {
    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .select('id, title, path, bytes, added_by, created_at')
        .order('created_at', { ascending: false }),
    )
    if (error) return { data: [], error: fail(error) }
    return { data: data ?? [], error: null }
  } catch (e) {
    return { data: [], error: fail(e) }
  }
}

/**
 * 1曲入れる。**中身 → 控え の順**(`learnerFiles.js` と同じ)。
 * 控えの書き込みに失敗したら、**置いた中身を消す** ——
 * どちらかだけが残るのがいちばん困る。
 */
export async function addTrack({ file, title, addedBy }) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  const bad = checkFile(file)
  if (bad) return { data: null, error: bad }
  const name = String(title || file.name || '').trim().slice(0, 120)
  if (!name) return { data: null, error: '曲の題を入れてください' }

  const ext = String(file.name).split('.').pop().toLowerCase()
  /* **道は推測できない形にする**(非公開のバケツだが、念のため)。
     元のファイル名は道に使わない —— 日本語や記号でつまずく */
  const path = `${crypto.randomUUID()}.${ext}`
  try {
    const up = await withTimeout(
      supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: false,
      }),
      120000,  // 曲は大きい。**ここだけ上限を延ばす**
    )
    if (up.error) return { data: null, error: fail(up.error) }

    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .insert({ title: name, path, bytes: file.size, added_by: addedBy })
        .select().single(),
    )
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
      return { data: null, error: fail(error) }
    }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}

/** 1曲消す。**控えと中身の両方** */
export async function deleteTrack(row) {
  if (!supabase || !row?.id) return { error: 'Supabase に接続していません' }
  try {
    const { error } = await withTimeout(supabase.from(TABLE).delete().eq('id', row.id))
    if (error) return { error: fail(error) }
    await withTimeout(supabase.storage.from(BUCKET).remove([row.path])).catch(() => {})
    return { error: null }
  } catch (e) {
    return { error: fail(e) }
  }
}

/**
 * 聴くための URL。**非公開のバケツなので、そのつど署名する。**
 *
 * 曲は数分あるので **1時間**もたせる(ファイルの5分より長い)。
 * **控えは持つ** —— 同じ曲を何周もするので、そのたびに署名しない。
 */
const urlCache = new Map()
export async function trackUrl(row) {
  if (!supabase || !row?.path) return null
  const hit = urlCache.get(row.path)
  if (hit && hit.until > Date.now()) return hit.url
  try {
    const { data, error } = await withTimeout(
      supabase.storage.from(BUCKET).createSignedUrl(row.path, 3600),
    )
    if (error || !data?.signedUrl) return null
    /* **期限より早く切る。** ぴったりで切ると、鳴らしている途中で
       期限が来て、そこで黙る */
    urlCache.set(row.path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 })
    return data.signedUrl
  } catch {
    return null
  }
}

/* ==========================================================================
 * 鳴らすところ
 *
 * **`<audio>` は1つだけ作り、作り直さない**(読み上げの `<audio>` と
 * 同じ作法・CLAUDE.md)。曲は読み上げとは別の流れなので、
 * **読み上げの `<audio>` は1ミリも触らない。**
 *
 * **音の通り道を変えない**(Web Audio に通さない)。あれは
 * 2026-09 にいちばん高くついた失敗である ——
 * 全部の声でバリバリ雑音が乗った。ここでも `volume` だけを動かす。
 * ========================================================================== */

let el = null
let list = []
let at = 0
let ducked = false
let ramp = null

function audio() {
  if (el) return el
  if (typeof Audio === 'undefined') return null
  el = new Audio()
  el.preload = 'auto'
  el.volume = BGM_VOLUME
  /* **次の曲へ。** 1曲で終わると、聞き流しの途中で静かになる */
  el.addEventListener('ended', () => { next() })
  /* **鳴らせない曲は飛ばす。** 止まると、そこで音楽が終わってしまう
     (行き止まりを作らない) */
  el.addEventListener('error', () => { next() })
  return el
}

/** 音量を、なだらかに動かす。**跳ぶと「プチッ」と鳴る**(`fadeGain` と同じ考え方) */
function to(v, ms = 400) {
  const a = audio()
  if (!a) return
  if (ramp) { clearInterval(ramp); ramp = null }
  const from = a.volume
  const steps = Math.max(1, Math.round(ms / 10))
  let i = 0
  ramp = setInterval(() => {
    i += 1
    const x = Math.min(1, i / steps)
    try { a.volume = from + (v - from) * x } catch { /* 端末が拒むことがある */ }
    if (x >= 1) { clearInterval(ramp); ramp = null }
  }, 10)
}

async function play(i) {
  const a = audio()
  if (!a || !list.length) return
  at = ((i % list.length) + list.length) % list.length
  const url = await trackUrl(list[at])
  if (!url) return
  /* **差し替える前に、止めて黙らせる**(CLAUDE.md)。
     鳴り終わったままの `<audio>` に新しい `src` を入れると段差ができる */
  try { a.pause() } catch { /* 何もしない */ }
  a.volume = 0
  a.src = url
  try { await a.play() } catch { return }
  to(bgmVolume(ducked), 700)
}

function next() { if (list.length) play(at + 1) }

/**
 * 音楽を流し始める。**曲が1つも無ければ、何もしない**(黙って始めない)。
 * @param {Array} tracks 曲の一覧
 * @param {boolean} shuffle 順を混ぜるか
 */
export async function startBgm(tracks, { shuffle = true } = {}) {
  const got = (tracks ?? []).filter((t) => t?.path)
  if (!got.length) return false
  list = shuffle ? [...got].sort(() => Math.random() - 0.5) : got
  await play(0)
  return true
}

/** 止める。**画面を離れるときは必ず呼ぶ** */
export function stopBgm() {
  if (ramp) { clearInterval(ramp); ramp = null }
  if (!el) return
  try { el.pause(); el.removeAttribute('src'); el.load() } catch { /* 何もしない */ }
  list = []
  at = 0
  ducked = false
}

export const bgmPlaying = () => Boolean(el && !el.paused && list.length)

/**
 * **声が鳴っているあいだは、曲を小さくする**(利用者が選んだ)。
 * 大きさそのものは `wordRadio.js` の `bgmVolume()` が決める。
 */
export function duckBgm(on) {
  if (ducked === on) return
  ducked = on
  if (el && !el.paused) to(bgmVolume(on), on ? 250 : 600)
}

/** いま鳴っている曲(画面に題を出すため)。無ければ `null` */
export const nowPlaying = () => (list.length ? list[at] : null)
