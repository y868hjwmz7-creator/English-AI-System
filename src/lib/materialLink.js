/**
 * **教材へのリンク**(2026-09 利用者の指定)。
 *
 * ════════════════════════════════════════════════════════════════
 *   > 「教材をシェア」ボタンをつけてトレーナー間でシェアできるように
 *   > してください。これで教材へのリンクをシェアできるようにします。
 *
 * 教材は既定で**全トレーナーの共有物**(`materials.visibility = 'school'`)
 * だが、**その1本を名指しで指す道が無かった。** 「あの記事の教材」と
 * 伝えても、受け取った人はさがす画面で同じものを見つけ直すことになる。
 *
 * 【このアプリにはルーティングが無い】(CLAUDE.md「構成」)
 *   画面は `App.jsx` がタブで切り替えている。だから**道(パス)は
 *   増やさない。** 印を1つ、`?m=<教材の id>` として付けるだけにする。
 *
 *   - 入り口の URL はこれまでどおり1つ(GitHub Pages の設定を触らない)
 *   - **`?v=<コミット番号>` と一緒に付いていてもよい**
 *     (`urlWithoutMaterial()` は `m` だけを外し、ほかの印は残す)
 *
 * 【id の形を、受け取った側で確かめる】
 *   `materialIdFromUrl()` は **UUID の形以外を受け取らない。**
 *   受け取った id は `document.querySelector('[data-mid="…"]')` に
 *   そのまま入るので、引用符などが混じると**選択子ごと壊れる。**
 *   「窓口が言ったことを、そのまま画面に流さない」と同じ考え方である。
 *
 * 【ここは何にも依存しない】
 *   Supabase も `import.meta.env` も持たないので、**素の node で
 *   確かめられる**(`playMark.js` / `mp3Join.js` と同じ考え方)。
 *   `npm run test:play` が見張っている。
 * ════════════════════════════════════════════════════════════════
 */

/** URL に付ける印。**1か所** */
export const MATERIAL_PARAM = 'm'

/** 教材の id の形(Supabase の uuid) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * その教材を開くリンクを作る。
 *
 * **いま開いている URL を土台にする。** 決め打ちにすると、
 * GitHub Pages のサブパス(`/English-AI-System/`)や、
 * 手元の開発サーバーで別のところを指してしまう。
 *
 * @param {string} id 教材の id
 * @param {{origin?: string, pathname?: string}} loc `window.location` でよい
 * @returns {string|null} 作れなければ `null`(**当てずっぽうの URL を返さない**)
 */
export function materialLinkFor(id, loc) {
  if (!id || !UUID_RE.test(String(id))) return null
  const origin = loc?.origin ?? ''
  const path = loc?.pathname ?? '/'
  if (!origin) return null
  return `${origin}${path}?${MATERIAL_PARAM}=${id}`
}

/**
 * URL の印から教材の id を読む。
 *
 * @param {string} search `window.location.search`(`?` は有っても無くてもよい)
 * @returns {string|null} UUID の形でなければ `null`
 */
export function materialIdFromUrl(search) {
  if (typeof search !== 'string' || !search) return null
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const id = (q.get(MATERIAL_PARAM) ?? '').trim()
  return UUID_RE.test(id) ? id : null
}

/**
 * 印だけを外した URL を返す(`history.replaceState` に渡す)。
 *
 * **取り出したら消す**(`playMark.js` と同じ作法)。残しておくと、
 * そのあと別の教材を発行して画面を読み直すたびに、
 * **リンクで来た教材へ引き戻される。**
 *
 * **`?v=` などほかの印は残す。** 消してよいのは `m` だけである。
 */
export function urlWithoutMaterial(loc) {
  const raw = loc?.search ?? ''
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  q.delete(MATERIAL_PARAM)
  const rest = q.toString()
  return `${loc?.pathname ?? '/'}${rest ? `?${rest}` : ''}${loc?.hash ?? ''}`
}
