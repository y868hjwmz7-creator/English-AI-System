/**
 * Supabase への接続。
 *
 * 接続情報は .env(ローカル)と GitHub Actions のシークレット(公開版)から
 * 読み込みます。ソースコードには書きません。
 *
 *   VITE_SUPABASE_URL      … https://<Project ID>.supabase.co
 *   VITE_SUPABASE_ANON_KEY … sb_publishable_... または eyJ...
 *
 * この鍵は「公開されることを前提に作られた鍵」です。ブラウザに配られる
 * JavaScript の中に必ず入るため、そもそも隠せません。安全なのは
 * RLS(Row Level Security)がデータベース側で「誰がどの行を読めるか」を
 * 決めているからです。RLS を切ると、この鍵だけで全データが読めてしまいます。
 *
 * 設定がまだ無いときは null を返します。アプリは落ちず、
 * これまでどおり端末内(localStorage)のデータで動きます。
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** 接続情報がそろっているか。画面に案内を出すときに使います。 */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * プロジェクトの URL。
 * Storage に置いた読み上げ音声を `<audio src>` に直接渡すために使います
 * (`src/lib/audioClips.js`)。SDK からは取り出せないので、ここで公開します。
 */
export const supabaseUrl = url ?? ''

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,      // 一度ログインしたら次回も維持する
        autoRefreshToken: true,
        detectSessionInUrl: true,  // メールのリンクから戻ってきたときに拾う
      },
    })
  : null

/**
 * **返事が来ないときに、いつまでも待たない**(2026-08 実機)。
 *
 * `fetch` は待ち時間の上限を持たない。Supabase まで届かない状況
 * (電波が切れかけている・会社のネットワークが塞いでいる)では、
 * **エラーにならず、ただ返ってこない。** 画面は「…しています」のまま止まり、
 * **何が起きたのか分からない。**
 * 失敗と分かるだけでも、次に何をすればよいかが決まる。
 *
 * **この決まりは1か所に置く。** 画面ごとに書くと、必ずどこかが抜ける。
 */
export const NET_TIMEOUT_MS = 15000
export const TIMEOUT_MARK = '__timeout__'

export const withTimeout = (promise, ms = NET_TIMEOUT_MS) => Promise.race([
  promise,
  new Promise((_, reject) => { setTimeout(() => reject(new Error(TIMEOUT_MARK)), ms) }),
])

/**
 * 接続できるかを実際に確かめます。設定ミスの切り分け用。
 * 例外は投げず、必ず結果オブジェクトを返します。
 */
export async function checkConnection() {
  if (!supabase) {
    return { ok: false, reason: 'unconfigured', message: '接続情報(URLと鍵)が設定されていません' }
  }
  try {
    // 誰でも読める weakness_tags を1件だけ引いて、往復できるかを見る。
    // **返事が来ないときのために、待ち時間の上限を置く**(2026-08 実機)
    const { error } = await withTimeout(
      supabase.from('weakness_tags').select('id').limit(1),
    )
    if (error) {
      const missingTable = error.code === '42P01' || /does not exist/i.test(error.message)
      // **通信が届いていない失敗は、例外ではなく `error` で返ってくる**
      // (2026-08 実測)。ここで見分けないと「つながりましたが断られました」と
      // 出てしまい、**電波の話なのに設定の話だと思わせる。**
      // Safari は `Load failed`、Chrome は `Failed to fetch` と言う
      const offline = /failed to fetch|load failed|networkerror|network request failed/i
        .test(error.message ?? '')
      return {
        ok: false,
        reason: missingTable ? 'no-schema' : (offline ? 'network' : 'error'),
        message: missingTable
          ? 'つながりましたが、テーブルがまだありません(SQL の実行が必要です)'
          : error.message,
      }
    }
    return { ok: true, message: '接続できました' }
  } catch (e) {
    const timedOut = e?.message === TIMEOUT_MARK
    return {
      ok: false,
      reason: timedOut ? 'timeout' : 'network',
      message: timedOut
        ? `${Math.round(NET_TIMEOUT_MS / 1000)} 秒待っても返事がありませんでした`
          + '(通信が届いていません)'
        : (e?.message ?? '通信に失敗しました'),
    }
  }
}

/** 画面に出すための、接続先の短い表示(鍵は出しません)。 */
export const supabaseProjectRef = url ? new URL(url).hostname.split('.')[0] : null
