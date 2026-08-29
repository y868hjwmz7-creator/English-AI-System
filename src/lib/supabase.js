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
 * 接続できるかを実際に確かめます。設定ミスの切り分け用。
 * 例外は投げず、必ず結果オブジェクトを返します。
 */
export async function checkConnection() {
  if (!supabase) {
    return { ok: false, reason: 'unconfigured', message: '接続情報(URLと鍵)が設定されていません' }
  }
  try {
    // 誰でも読める weakness_tags を1件だけ引いて、往復できるかを見る
    const { error } = await supabase.from('weakness_tags').select('id').limit(1)
    if (error) {
      const missingTable = error.code === '42P01' || /does not exist/i.test(error.message)
      return {
        ok: false,
        reason: missingTable ? 'no-schema' : 'error',
        message: missingTable
          ? 'つながりましたが、テーブルがまだありません(SQL の実行が必要です)'
          : error.message,
      }
    }
    return { ok: true, message: '接続できました' }
  } catch (e) {
    return { ok: false, reason: 'network', message: e?.message ?? '通信に失敗しました' }
  }
}

/** 画面に出すための、接続先の短い表示(鍵は出しません)。 */
export const supabaseProjectRef = url ? new URL(url).hostname.split('.')[0] : null
