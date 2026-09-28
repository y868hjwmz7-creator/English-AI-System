/**
 * ゲストに関するファイルの出し入れ(0031)。
 *
 * 2026-09 利用者の指定:
 *   > 各ゲストの情報内に、ゲストに関するファイルをアップロードできる
 *   > ようにできないですか?
 *
 * 【置き場は2つに分かれている】
 *   ・**中身**(バイト列)は Storage の `learner-files` バケット(**非公開**)
 *   ・**何があるか**(名前・大きさ・入れた人・メモ)は `learner_files` の表
 *
 *   置き場だけでは「誰のものか」を SQL で絞れない。表を1つ持てば
 *   RLS で確実に守れるし、一覧も速い。
 *
 * 【道は必ず `<ゲストの id>/…` で始める】
 *   表の側にも置き場の側にも、同じ決まりが書いてある(0031)。
 *   **ここを画面の都合で崩さない。** 崩すと、置いた瞬間に断られる。
 *
 * 【開くときは、そのつど期限付きの URL を作る】
 *   読み上げ音声(`tts`)は公開のバケットだが、こちらは違う。
 *   URL を知っていれば誰でも取れる状態にはしない。
 *
 * **例外を外に出さない。** 呼んだ側の `await` がそこで止まる
 * (`supabase.js` の決まりと同じ)。必ず `{ data, error }` の形で返す。
 */
import { supabase, withTimeout, TIMEOUT_MARK } from './supabase.js'

const BUCKET = 'learner-files'
const TABLE = 'learner_files'

/** 1つあたりの大きさの上限。**大きすぎるものは置かせない**(20MB) */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

/** 置ける形。写真・PDF・文書・音声まで。**実行できるものは置かせない** */
const OK_EXT = [
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif',
  'txt', 'md', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'm4a', 'wav', 'mp4', 'mov',
]

export const extOf = (name) => String(name ?? '').split('.').pop()?.toLowerCase() ?? ''

/** 置いてよいファイルか。断る理由まで返す(**成功と失敗を同じ見た目で終えない**) */
export function checkFile(file) {
  if (!file) return '選ばれていません'
  if (file.size > MAX_FILE_BYTES) {
    return `大きすぎます(${prettySize(file.size)})。${prettySize(MAX_FILE_BYTES)} までにしてください`
  }
  if (file.size === 0) return '中身が空です'
  if (!OK_EXT.includes(extOf(file.name))) {
    return `この種類のファイルは置けません(.${extOf(file.name) || '不明'})`
  }
  return null
}

/** 大きさを読める形に。**数字だけでは大きいのか分からない** */
export function prettySize(bytes) {
  const n = Number(bytes ?? 0)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 置き場の中の道を決める。**必ずゲストの id から始める。**
 * 同じ名前を二度置いても上書きにならないよう、時刻を頭に付ける。
 * 日本語のファイル名は Storage の道に使えないので、安全な字だけに直す
 * (**画面に出す名前は表のほうに元のまま残す**)。
 */
export function pathFor(learnerId, fileName) {
  const ext = extOf(fileName)
  const safe = String(fileName ?? '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const stem = safe || 'file'
  return `${learnerId}/${Date.now()}-${stem}${ext ? `.${ext}` : ''}`
}

const fail = (e) => {
  const m = String(e?.message ?? e ?? '')
  if (m === TIMEOUT_MARK) return '時間内に返事がありませんでした。通信を確かめてください'
  if (/failed to fetch|load failed|networkerror/i.test(m)) {
    return 'サーバーに届きませんでした。通信を確かめてください'
  }
  if (/relation .* does not exist|42P01|schema cache/i.test(m)) {
    return 'ファイルの置き場がまだ用意されていません(0031 の SQL を貼ってください)'
  }
  if (/bucket not found/i.test(m)) {
    return 'ファイルの置き場(learner-files)がまだ作られていません(0031 の SQL を貼ってください)'
  }
  return m || '失敗しました'
}

/** そのゲストのファイルの一覧。新しいものが先 */
export async function listLearnerFiles(learnerId) {
  if (!supabase || !learnerId) return { data: [], error: null }
  try {
    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .select('id, learner_id, path, name, mime, size, note, uploaded_by, created_at')
        .eq('learner_id', learnerId)
        .order('created_at', { ascending: false }),
    )
    if (error) return { data: [], error: fail(error) }
    return { data: data ?? [], error: null }
  } catch (e) {
    return { data: [], error: fail(e) }
  }
}

/**
 * 1つ置く。**中身 → 控え の順**に行う。
 * 控えを先に入れると、置き場に無いものが一覧に並ぶ。
 * 逆に、控えの書き込みに失敗したときは**置いた中身を消す**
 * (どちらかだけが残ると、次に何をすればよいか分からなくなる)。
 */
export async function uploadLearnerFile({ learnerId, file, note = '', uploadedBy }) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  if (!learnerId) return { data: null, error: 'どのゲストのファイルか分かりません' }
  const bad = checkFile(file)
  if (bad) return { data: null, error: bad }

  const path = pathFor(learnerId, file.name)
  try {
    const up = await withTimeout(
      supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      }),
      60000,   // 中身の送信は時間がかかる。**ここだけ上限を延ばす**
    )
    if (up.error) return { data: null, error: fail(up.error) }

    const row = {
      learner_id: learnerId,
      path,
      name: file.name,
      mime: file.type || null,
      size: file.size,
      note: note?.trim() ? note.trim() : null,
      uploaded_by: uploadedBy ?? null,
    }
    const { data, error } = await withTimeout(
      supabase.from(TABLE).insert(row).select().single(),
    )
    if (error) {
      // **片方だけ残さない。** 置いた中身を消してから断る
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
      return { data: null, error: fail(error) }
    }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}

/**
 * 開くための、期限付きの URL を作る(既定 5 分)。
 * **押したその場で作る。** 一覧に URL を持たせると、
 * 画面を開いたまま置いておくうちに期限が切れる。
 */
export async function fileUrl(path, { seconds = 300, download = false } = {}) {
  if (!supabase || !path) return { url: null, error: 'Supabase に接続していません' }
  try {
    const { data, error } = await withTimeout(
      supabase.storage.from(BUCKET).createSignedUrl(path, seconds,
        download ? { download: true } : undefined),
    )
    if (error) return { url: null, error: fail(error) }
    return { url: data?.signedUrl ?? null, error: null }
  } catch (e) {
    return { url: null, error: fail(e) }
  }
}

/** 1つ消す。**控えと中身の両方**を消す */
export async function deleteLearnerFile(row) {
  if (!supabase || !row?.id) return { error: 'Supabase に接続していません' }
  try {
    const { error } = await withTimeout(
      supabase.from(TABLE).delete().eq('id', row.id),
    )
    if (error) return { error: fail(error) }
    // 控えが消せたら中身も消す。ここで失敗しても一覧からは消えている
    await withTimeout(supabase.storage.from(BUCKET).remove([row.path])).catch(() => {})
    return { error: null }
  } catch (e) {
    return { error: fail(e) }
  }
}

/**
 * ============================================================================
 * **そのゲストの置き場を、まるごと空にする**(第5.299節・2026-09-28 実機)
 * ============================================================================
 *
 * ゲストを消そうとして、こう出て止まった。
 *
 *     記録を消せませんでした:
 *     Direct deletion from storage tables is not allowed.
 *     Use the Storage API instead.
 *
 * `erase_learner()` は 0041 から 0058 まで、SQL の中で
 * `delete from storage.objects` をやっていた。**Supabase がそれを断る
 * ようになった。** 関数は1行でも失敗すると丸ごと巻き戻るので、
 * **ゲストは1人も消せない状態**だった。
 *
 * 【消す順】**中身が先。表はあと**
 *   ・中身を消せなければ、**表には手をつけない**(何も失われない)
 *   ・中身が消えて表が残っても、**もう一度押せば続きからやり直せる**
 *   逆にすると、表が消えたあとに道が分からなくなり、
 *   **置き場に中身だけが残って、誰も消せなくなる**
 *
 * 【全部めくる】
 *   `list()` は**既定で 100 件**しか返さない。
 *   1回だけ読んで消すと、**101 件目から先が静かに残る**
 *   (**黙って消さない・黙って絞らない**・CLAUDE.md)。
 *
 * 【道は1段だけ】
 *   `pathFor()` が `<ゲストの id>/<名前>` を作るので、
 *   入れ子のフォルダは無い。**上の関数と同じ形**を使う
 *   (**呼び名を2か所に書かない**)。
 *
 * @returns {{data: number|null, error: string|null}} 消した本数
 * ============================================================================
 */
export async function removeAllLearnerFiles(learnerId) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  if (!learnerId) return { data: null, error: 'どのゲストか分かりません' }
  const folder = String(learnerId)
  const PAGE = 100
  const paths = []
  try {
    for (let page = 0; ; page += 1) {
      const { data, error } = await withTimeout(
        supabase.storage.from(BUCKET).list(folder, {
          limit: PAGE, offset: page * PAGE,
        }),
      )
      if (error) return { data: null, error: fail(error) }
      const rows = data ?? []
      for (const f of rows) {
        /* **フォルダは消さない。** `list()` は入れ子の入れ物も返すが、
           あれは `id` を持たない(消す相手ではない) */
        if (f?.id && f.name) paths.push(`${folder}/${f.name}`)
      }
      if (rows.length < PAGE) break
    }
    if (!paths.length) return { data: 0, error: null }
    const { error } = await withTimeout(
      supabase.storage.from(BUCKET).remove(paths),
    )
    if (error) return { data: null, error: fail(error) }
    return { data: paths.length, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}
