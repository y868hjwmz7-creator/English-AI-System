/**
 * 録音した音声を「この端末の中だけ」に保存する場所。
 *
 * ★保存先について
 *   ブラウザの IndexedDB を使います。音声はファイルとして大きいため、
 *   文字しか入らない localStorage では扱えません。
 *
 * ★サーバーには一切送りません(仕様書 3.2)
 *   保存されるのはこの端末の中だけです。別の端末では聞けません。
 *   ブラウザの「サイトデータを削除」を行うと消えます。
 *
 * ★保存するかどうかは利用者が選べます
 *   保存しない設定にしていても、「いま録音したもの」はその場で
 *   聞き返せます(画面を離れるまでメモリ上に置くため)。
 */

const DB_NAME = 'english-ai-system'
const DB_VERSION = 1
const STORE = 'recordings'

/** 端末に残す件数の上限。古いものから消していく。 */
export const MAX_RECORDINGS = 20

/** この環境で保存できるか */
export function isStorageSupported() {
  return typeof indexedDB !== 'undefined'
}

/** データベースを開く(無ければ作る) */
function openDb() {
  return new Promise((resolve, reject) => {
    if (!isStorageSupported()) {
      reject(new Error('この環境では録音を保存できません。'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        // 学習者ごと・日時順に取り出せるようにしておく
        store.createIndex('learnerId', 'learnerId', { unique: false })
        store.createIndex('savedAt', 'savedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** 1つの取引を実行する小さな道具 */
function run(mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        let result
        try {
          result = work(store)
        } catch (err) {
          reject(err)
          return
        }
        tx.oncomplete = () => {
          db.close()
          resolve(result && result.__request ? result.__request.result : result)
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

/**
 * 録音を1件保存する。
 * 保存できなくても発音練習そのものは続けられるよう、失敗しても例外にしない。
 */
export async function saveRecording({ id, learnerId, targetText, blob }) {
  try {
    await run('readwrite', (store) => {
      store.put({ id, learnerId, targetText, blob, savedAt: new Date().toISOString() })
    })
    await pruneOld(learnerId)
    return true
  } catch (err) {
    // 保存容量が足りない場合などはここに来る
    console.warn('録音を端末に保存できませんでした。', err)
    return false
  }
}

/** 保存した録音を取り出す。無ければ null。 */
export async function loadRecording(id) {
  try {
    const record = await run('readonly', (store) => ({ __request: store.get(id) }))
    return record?.blob ?? null
  } catch (err) {
    console.warn('録音を読み出せませんでした。', err)
    return null
  }
}

/** その学習者の保存済み録音の一覧(新しい順)。音声本体は含めない。 */
export async function listRecordingIds(learnerId) {
  try {
    const all = await run('readonly', (store) => ({ __request: store.getAll() }))
    return (all ?? [])
      .filter((r) => r.learnerId === learnerId)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
      .map((r) => r.id)
  } catch (err) {
    console.warn('録音の一覧を読み出せませんでした。', err)
    return []
  }
}

/** 上限を超えた分を古いものから消す */
async function pruneOld(learnerId) {
  const ids = await listRecordingIds(learnerId)
  const excess = ids.slice(MAX_RECORDINGS)
  if (!excess.length) return
  await run('readwrite', (store) => {
    excess.forEach((id) => store.delete(id))
  })
}

/** 保存した録音を1件消す */
export async function deleteRecording(id) {
  try {
    await run('readwrite', (store) => store.delete(id))
    return true
  } catch (err) {
    console.warn('録音を削除できませんでした。', err)
    return false
  }
}

/** その学習者の保存済み録音をすべて消す */
export async function deleteAllRecordings(learnerId) {
  const ids = await listRecordingIds(learnerId)
  if (!ids.length) return 0
  try {
    await run('readwrite', (store) => {
      ids.forEach((id) => store.delete(id))
    })
    return ids.length
  } catch (err) {
    console.warn('録音をまとめて削除できませんでした。', err)
    return 0
  }
}
