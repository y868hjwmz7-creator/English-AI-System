/**
 * ログインまわり。
 *
 * 【方針】アカウントはトレーナーが Supabase の管理画面から発行する。
 * 自由登録(サインアップ)は作らない。ゲストが勝手に登録できてはいけないため
 * (`docs/PROJECT_SPEC.md` 第 1.2 節)。
 * したがってここには「ログイン」と「ログアウト」しかない。
 *
 * Supabase が未設定のときは、すべて何もせずに null を返す。
 * アプリはこれまでどおり端末内のデータで動く。
 */
import { supabase } from './supabase.js'

/** いまログインしている人の情報。していなければ null。 */
export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

/** ログイン状態が変わったときに呼ばれる。戻り値を呼ぶと監視をやめる。 */
export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null)
  })
  return () => data.subscription.unsubscribe()
}

/**
 * Supabase が返すエラーは英語なので、よくあるものを日本語に置き換える。
 * 当てはまらないものは原文を出す(隠すと原因が追えなくなるため)。
 */
function toJapanese(message) {
  const m = String(message ?? '')
  if (/invalid login credentials/i.test(m)) {
    // 画面の項目名は「ログインID」なので、言葉をそろえる。
    // ここだけ「メールアドレス」と出ると、何を間違えたのか分からなくなる。
    return 'ログインID(またはメールアドレス)か、パスワードが違います。'
  }
  if (/email not confirmed/i.test(m)) {
    return 'このアカウントはまだ確認されていません。Supabase の Authentication → Users で、'
      + '該当の利用者を確認済みにしてください(作成時に Auto Confirm User を入れ忘れた場合に起きます)。'
  }
  if (/too many requests|rate limit/i.test(m)) {
    return '試行が多すぎます。しばらく待ってからもう一度お試しください。'
  }
  if (/failed to fetch|network/i.test(m)) {
    return 'Supabase に接続できませんでした。通信の状態をご確認ください。'
  }
  return m
}

/**
 * ログインIDから組み立てる、実在しないメールアドレスの後ろ側。
 *
 * Supabase のログインはメールアドレスの形を要求するが、ゲストとトレーナーに
 * メールアドレスを用意させるのは現実的ではない(仕様書 第5.8節)。そこで
 * ID だけで登録し、こちらで形を整える。実際にメールは送らない。
 *
 * **supabase/functions/create-user/index.ts の LOGIN_DOMAIN と同じ値である。**
 * 片方だけ変えると、発行したアカウントでログインできなくなる。
 * Edge Function からはこのファイルを読めないため、同じ値を2か所に置いている。
 */
export const LOGIN_DOMAIN = 'users.english-ai-system.local'

/**
 * 入力された文字列を、ログインに使う形にする。
 *
 * ゲストは「tanaka01」のようなIDを渡される。@ が入っていればそのまま
 * メールアドレスとして扱う(Supabase の画面から作った最初の管理者など、
 * 本物のメールアドレスで登録されている人のため)。
 */
export const toLoginEmail = (input) => {
  const value = String(input ?? '').trim()
  return value.includes('@') ? value : `${value.toLowerCase()}@${LOGIN_DOMAIN}`
}

/** ログインする。成功なら { error: null }。 */
export async function signIn(idOrEmail, password) {
  if (!supabase) return { error: 'Supabase が設定されていません。' }
  const { error } = await supabase.auth.signInWithPassword({
    email: toLoginEmail(idOrEmail),
    password,
  })
  return { error: error ? toJapanese(error.message) : null }
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

/**
 * その人の表示名と役割を取る。
 * RLS により、自分の行(と、トレーナーなら全員分)しか読めない。
 */
export async function loadProfile(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.warn('プロフィールを読めませんでした:', error.message)
    return null
  }
  return data
}
