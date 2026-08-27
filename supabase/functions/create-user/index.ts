// ============================================================================
// アカウントを発行する受付窓口(Supabase Edge Function)
//
// 【なぜこれが必要か】
//   アカウントを作るには「管理者の鍵(service_role)」が要る。
//   その鍵をブラウザのアプリに入れると、アプリを開いた誰もが
//   全生徒のデータを読めるようになるため、絶対に入れられない。
//
//   そこで Supabase のサーバー上でだけ動くこのプログラムに鍵を持たせる。
//   ブラウザは「誰を作りたいか」を送るだけで、鍵には触れない。
//
// 【この窓口が必ず確認すること】
//   1. 送ってきた人が本当にログインしているか
//   2. その人がトレーナーか管理者か(生徒は誰も作れない)
//   3. トレーナーは「生徒」しか作れない(トレーナーや管理者は作れない)
//   4. トレーナーが作った生徒は、自動でそのトレーナーの担当になる
//
//   ここを飛ばすと、生徒が自分を管理者にするアカウントを作れてしまう。
//
// 【呼び出し方(アプリ側)】
//   supabase.functions.invoke('create-user', {
//     body: { loginId: 'tanaka01', password: '••••••••',
//             displayName: '田中 みなみ', role: 'learner' }
//   })
//   ログイン中の利用者の情報は supabase-js が自動で添えてくれる。
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ログインIDから作る、実在しないメールアドレスの後ろ側。
//
// **src/lib/auth.js の LOGIN_DOMAIN と同じ値である。**
// 片方だけ変えると、ここで発行したアカウントでログインできなくなる。
// Edge Function からアプリのファイルは読めないため、同じ値を2か所に置いている。
// Supabase のログインはメールアドレスの形を要求するため、
// 「ID だけで登録したい」という要望に合わせてこちらで組み立てる。
// 実際にメールは送らない(作成時に確認済みにするため)。
const LOGIN_DOMAIN = 'users.english-ai-system.local'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

/** ログインIDに使ってよい文字か。空白や記号を弾く。 */
const isValidLoginId = (id: string) => /^[a-zA-Z0-9._-]{3,64}$/.test(id)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST で呼んでください' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── 1. 送ってきた人が誰かを確かめる ──────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return reply({ error: 'ログインしていません' }, 401)

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await asCaller.auth.getUser()
  if (!caller) return reply({ error: 'ログインの情報が確認できませんでした' }, 401)

  // ── 2. その人の役割を確かめる ────────────────────────────
  // 管理者の鍵で読む。呼び出した人自身の行なので、RLS を通しても読めるが、
  // 「役割の判定」は必ずサーバー側で行う(ブラウザから送られた値は信用しない)。
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', caller.id).maybeSingle()

  const callerRole = callerProfile?.role
  if (callerRole !== 'trainer' && callerRole !== 'owner') {
    return reply({ error: 'アカウントを発行する権限がありません' }, 403)
  }

  // ── 3. 送られてきた内容を確かめる ────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply({ error: '送られた内容を読めませんでした' }, 400)
  }

  const loginId = String(body.loginId ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const displayName = String(body.displayName ?? '').trim()
  const role = String(body.role ?? 'learner')

  if (!isValidLoginId(loginId)) {
    return reply({
      error: 'ログインIDは、半角の英数字と . _ - だけで3文字以上にしてください',
    }, 400)
  }
  if (password.length < 8) {
    return reply({ error: 'パスワードは8文字以上にしてください' }, 400)
  }
  if (!displayName) {
    return reply({ error: '表示名を入れてください' }, 400)
  }
  if (!['learner', 'trainer', 'owner'].includes(role)) {
    return reply({ error: '役割の指定が正しくありません' }, 400)
  }

  // ── 4. トレーナーは「生徒」しか作れない ──────────────────
  //    ここが最も大事な確認。これが無いと、トレーナーが自分で
  //    管理者アカウントを作って全生徒の集計を見られるようになる。
  if (callerRole === 'trainer' && role !== 'learner') {
    return reply({ error: 'トレーナーが作れるのは生徒のアカウントだけです' }, 403)
  }

  // ── 5. アカウントを作る ──────────────────────────────────
  const email = `${loginId}@${LOGIN_DOMAIN}`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // 確認メールを送らずに使える状態にする
    user_metadata: { display_name: displayName, login_id: loginId },
  })

  if (createError) {
    const already = /already registered|already been registered|duplicate/i
      .test(createError.message)
    return reply({
      error: already
        ? `ログインID「${loginId}」はすでに使われています。別のIDにしてください。`
        : createError.message,
    }, already ? 409 : 400)
  }

  const newUserId = created.user!.id

  // ── 6. 表示名と役割を入れる ──────────────────────────────
  //    profiles の行はサインアップのトリガーが作っている。
  //    役割は必ずここ(サーバー側)で決める。
  const { error: profileError } = await admin
    .from('profiles')
    .update({ display_name: displayName, role })
    .eq('id', newUserId)

  if (profileError) {
    // 中途半端な状態を残さない。作ったアカウントを消して失敗を返す。
    await admin.auth.admin.deleteUser(newUserId)
    return reply({ error: `登録に失敗しました: ${profileError.message}` }, 500)
  }

  // ── 7. 生徒なら、作った本人の担当にする ──────────────────
  if (role === 'learner') {
    const { error: linkError } = await admin
      .from('learner_admins')
      .insert({ admin_id: caller.id, learner_id: newUserId })
    if (linkError) {
      await admin.auth.admin.deleteUser(newUserId)
      return reply({ error: `担当の登録に失敗しました: ${linkError.message}` }, 500)
    }
  }

  return reply({
    ok: true,
    user: { id: newUserId, loginId, displayName, role },
  })
})
