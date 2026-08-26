/**
 * データの保存・読み出しをまとめた場所。
 *
 * いまは「ブラウザの localStorage」に保存しています。
 * サーバーは使っていないので、そのブラウザの中だけにデータが残ります。
 *
 * ★ここが Supabase への差し替えポイントです。
 *   将来 Supabase をつなぐときは、この1ファイルの中身を
 *   Supabase への読み書きに置き換えるだけで済むように作ってあります。
 *   画面側(components/)はこのファイルの関数しか呼んでいません。
 */

const STORAGE_KEY = 'english-ai-system:v1'

/** ランダムなIDを作る(データを1件ずつ区別するため) */
export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

/** localStorage から全データを読み出す */
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('保存データの読み込みに失敗しました。初期状態から始めます。', err)
    return null
  }
}

/** localStorage に全データを書き込む */
function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.error('保存に失敗しました。ブラウザの保存容量が上限に達している可能性があります。', err)
    return false
  }
}

const emptyState = {
  learners: [],
  studyLogs: [],
  pronunciationAttempts: [],
}

/**
 * データを読み込む。まだ何もなければ初期データ(サンプル)を入れて返す。
 * @param {object} seed 初期データ
 */
export function loadState(seed) {
  const saved = readAll()
  if (saved) {
    // 保存済みデータに足りない項目があっても落ちないように補う
    return { ...emptyState, ...saved }
  }
  const initial = { ...emptyState, ...seed }
  writeAll(initial)
  return initial
}

/** データを保存する */
export function saveState(state) {
  return writeAll(state)
}

/** 保存データを全部消して初期状態に戻す */
export function resetState(seed) {
  const initial = { ...emptyState, ...seed }
  writeAll(initial)
  return initial
}

/** 学習記録を1件追加した新しい state を返す */
export function addStudyLog(state, log) {
  return {
    ...state,
    studyLogs: [{ ...log, id: createId(), createdAt: new Date().toISOString() }, ...state.studyLogs],
  }
}

/** 学習記録を1件削除した新しい state を返す */
export function removeStudyLog(state, id) {
  return { ...state, studyLogs: state.studyLogs.filter((log) => log.id !== id) }
}

/**
 * 発音練習の結果を1件追加した新しい state を返す。
 *
 * ★重要: ここに保存するのは「点数と練習した英文」だけです。
 *   録音した音声そのものは保存しません(仕様書 3.2 の方針)。
 */
export function addPronunciationAttempt(state, attempt) {
  return {
    ...state,
    pronunciationAttempts: [
      // id は呼び出し側で指定できる。端末に保存した録音と結びつけるため。
      { id: createId(), ...attempt, attemptedAt: new Date().toISOString() },
      ...state.pronunciationAttempts,
    ],
  }
}
