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
import { NET_TIMEOUT_MS, TIMEOUT_MARK, supabase, withTimeout } from './supabase.js'

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
  // Safari は `Load failed`、Chrome は `Failed to fetch` と言う
  if (/failed to fetch|load failed|network/i.test(m)) {
    return 'Supabase に接続できませんでした。通信の状態(電波・Wi-Fi・機内モード)を'
      + 'ご確認のうえ、もう一度お試しください。'
  }
  // **黙って固まらないための知らせ**(2026-08 実機)。
  // 押しても何も起きず「ログインしています…」のまま止まる、という報告があった
  if (m === TIMEOUT_MARK) {
    return `Supabase から ${Math.round(NET_TIMEOUT_MS / 1000)} 秒待っても返事がありませんでした。`
      + '通信の状態(電波・Wi-Fi・機内モード)をご確認のうえ、もう一度お試しください。'
      + '下の「接続を確かめる」を押すと、どこで止まっているか分かります。'
  }
  // 端末が保存を許していないとき(プライベートブラウズなど)。
  // ログイン自体は通っても、次の画面へ進めない
  if (/localstorage|quotaexceeded|securityerror|access is denied/i.test(m)) {
    return 'この端末では、ログインの記録を保存できませんでした。'
      + 'プライベートブラウズを使っている場合は、ふつうのタブで開いてください。'
  }
  return m || '原因の分からない失敗です。もう一度お試しください。'
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

/**
 * ログインする。成功なら { error: null }。
 *
 * **返事が来ないときに、いつまでも待たない**(2026-08 実機)。
 *
 *   > もらったアプリ本体へのURL、スマホからだとログインできないぞ
 *   > (押しても何も起きない・止まる)
 *
 * `fetch` は待ち時間の上限を持たない。電波が切れかけているときなど、
 * 返事が来ないまま**永久に待つ**ことがある。画面は
 * 「ログインしています…」のまま動かず、**何が起きたのか分からない。**
 * 待ち時間の上限は `supabase.js` に1つだけ置いてある。
 *
 * **例外を外に出さない。** 投げると `SignIn` の `await` がそこで止まり、
 * ボタンが「ログインしています…」のまま戻らず、知らせも出ない。
 * **成功と失敗が、同じ見た目で終わってはいけない**(CLAUDE.md)。
 */
export async function signIn(idOrEmail, password) {
  if (!supabase) {
    return { error: 'この版には Supabase の接続情報が入っていません。トレーナーにお知らせください。' }
  }
  try {
    const { error } = await withTimeout(supabase.auth.signInWithPassword({
      email: toLoginEmail(idOrEmail),
      password,
    }), NET_TIMEOUT_MS)
    return { error: error ? toJapanese(error.message) : null }
  } catch (e) {
    return { error: toJapanese(e?.message) }
  }
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
    // cefr も読む。単語帳が「B1 のめやすに対して何%」を出すのに使う(0019)
    .select('id, display_name, role, cefr')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.warn('プロフィールを読めませんでした:', error.message)
    return null
  }
  return data
}
