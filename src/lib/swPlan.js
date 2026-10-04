/**
 * ============================================================================
 * **オフラインの決まり**(第5.372節・2026-10-04 利用者の指定)
 *
 *   > 通勤・移動中が多い
 *
 * ── なぜ要るか ──────────────────────────────────────────────
 *
 *   いまは**電波が無いと、アプリが1行も開かない。**
 *   地下鉄でアイコンを押すと、ブラウザの「接続できません」が出て終わる。
 *   ゲストがいちばん練習できる時間に、**道具が無い。**
 *
 * ── **ここには判断しか置かない**(素の node で走る) ──────────
 *
 *   Service Worker(`src/sw.js`)は、この環境では**1度も動かせない。**
 *   `caches` も `fetch` のイベントも無い。だから
 *   **「どの URL を、どの道で取るか」だけ**をここへ出して、
 *   `npm run test:offline` が**素の node で**確かめられるようにする
 *   (CLAUDE.md「素の node で走らせられる形に切り出す」)。
 *
 * ── **控えてよいものと、絶対に控えないもの** ─────────────────
 *
 *   | 道 | 何 | なぜ |
 *   |---|---|---|
 *   | `asset` | `/assets/*.js` `*.css` | **名前に中身の指紋が入っている。**別物は別の名前 |
 *   | `app`   | 画面そのもの・絵・manifest | 名前が変わらない。**だから新しいほうを先に見る** |
 *   | `clip`  | 読み上げ MP3 と、その `.json` | **置き場所が英文の指紋。**公開。鍵が要らない |
 *   | `pass`  | **それ以外ぜんぶ** | 触らない |
 *
 *   **`pass` が既定である。** 表のデータ(`/rest/v1/`)・ログイン
 *   (`/auth/v1/`)・窓口(`/functions/v1/`)は**1バイトも控えない** ——
 *   鍵が混じるし、RLS で人ごとに違うものが返る。
 *   **控えると、別の人のものが出る。**
 *
 * ── **古い版に固まらない**(ここがいちばん危ない) ─────────────
 *
 *   CLAUDE.md が何度も踏んでいる穴
 *   —— 「直したはずの不具合が直っていない = 古い内容が端末に残っていた」。
 *   Service Worker は、**それを仕組みとして作り込める。**
 *
 *   だから**画面そのものは、必ず通信を先に試す**(`app` = network-first)。
 *   電波があるときは**いつも最新**で、無いときだけ控えを出す。
 *   `asset` を控え優先にしてよいのは、**名前に指紋が入っている**ため ——
 *   中身が変われば名前が変わり、古いほうは誰も呼ばない。
 * ============================================================================
 */

/** 控えの名前。**版が変われば名前も変わる**(`activate` で古いのを捨てる) */
export function cacheNamesOf(stamp) {
  const v = String(stamp || 'dev').replace(/[^\w.-]+/g, '_')
  return {
    app: `app-${v}`,
    asset: `asset-${v}`,
    /* ★ **音声だけは版をまたぐ。** 置き場所が英文の指紋なので、
         アプリを出し直すたびに捨てると**ただの再課金**になる
         (CLAUDE.md「音声と語の意味は、1回だけ課金される」) */
    clip: 'clip-1',
  }
}

/** 版をまたいで残す控え。**ここに無いものは `activate` で捨てる** */
export function keepCaches(stamp) {
  const n = cacheNamesOf(stamp)
  return [n.app, n.asset, n.clip]
}

/** いま在る控えのうち、**捨てるもの** */
export function staleCaches(all, stamp) {
  const keep = new Set(keepCaches(stamp))
  return (all || []).filter((x) => !keep.has(x))
}

/**
 * **その要求を、どの道で取るか。**
 *
 * @param {string} url      取りに行く先
 * @param {object} p
 * @param {string} p.origin このアプリが配られている元(`location.origin`)
 * @param {string} [p.base] 配られているフォルダ(`/English-AI-System/`)
 * @param {string} [p.method] 既定は `GET`
 * @param {string} [p.mode]   `navigate` なら画面そのもの
 * @returns {'asset'|'app'|'clip'|'pass'}
 */
export function routeOf(url, { origin, base = '/', method = 'GET', mode = '' } = {}) {
  /* **読む以外は、1つも触らない。** 書き込みを控えたら事故である */
  if (String(method).toUpperCase() !== 'GET') return 'pass'

  let u
  try { u = new URL(url, origin) } catch { return 'pass' }
  /* **http(s) 以外は触らない**(`chrome-extension:` `blob:` `data:`) */
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'pass'

  if (u.origin === origin) {
    /* 画面そのもの。**名前が変わらないので、通信を先に試す** */
    if (mode === 'navigate') return 'app'
    const path = u.pathname
    if (!path.startsWith(base)) return 'pass'
    const rest = path.slice(base.length)
    /* 組み立てたもの。**名前に中身の指紋が入っている** */
    if (/^assets\//.test(rest)) return 'asset'
    /* 画面・絵・manifest。**名前が変わらない** */
    if (rest === '' || /\.(html|json|png|svg|ico|webmanifest)$/.test(rest)) return 'app'
    return 'pass'
  }

  /* **公開の置き場所にある音声だけ。** 鍵が要らず、名前が英文の指紋である */
  if (/\/storage\/v1\/object\/public\//.test(u.pathname)
      && /\.(mp3|json)$/.test(u.pathname)) return 'clip'

  /* ★ **既定は「触らない」。** 表のデータもログインも窓口も、ここに落ちる */
  return 'pass'
}

/**
 * 音声の控えの上限(**本数**)。
 *
 * **大きさでは測れない** —— `Cache` は入れたものの大きさを教えてくれないし、
 * 1本ずつ読み直して数えると、**それだけで時間と電池を使う。**
 * 1本はおよそ 20〜80KB なので、**800 本でおよそ 40MB** である。
 */
export const CLIP_MAX = 800

/**
 * **溢れたぶんを、入れた順に捨てる。**
 *
 * `Cache.keys()` は**入れた順**に返す。だから古いほうが前にいる。
 * 「いちばん使っていないもの」ではない —— それを測るには
 * **読むたびに控えを1つ書く**ことになり、読むのが遅くなる。
 * **入れた順で足りる**ことを、ここに書いておく。
 */
export function clipEvict(keys, max = CLIP_MAX) {
  const n = (keys || []).length - max
  return n > 0 ? keys.slice(0, n) : []
}

/**
 * **登録してよいか。**
 *
 * - `file://`(1ファイル版)では動かない —— **登録しようとすると例外が出る**
 * - 安全な置き場所(https か localhost)でないと、そもそも使えない
 * - 開発中(`dev`)は登録しない —— **古い枠を掴んで、直しが届かなくなる**
 */
export function canRegister({ protocol = '', secure = false, has = false, dev = false } = {}) {
  if (!has || !secure || dev) return false
  return protocol === 'https:' || protocol === 'http:'
}

/**
 * **先に落としてよい端末か**(第5.372節)。
 *
 * 教材を開いた時点で、その音声を**先に控えておく** ——
 * そうしないと「家で開いて、電車で聞く」ができない
 * (Service Worker が控えるのは、**一度鳴らしたもの**だけである)。
 *
 * **0円である**(置いてある MP3 を落とすだけで、作り直していない)。
 * ただし**通信は使う**ので、端末が
 * **「データ節約」**(`navigator.connection.saveData`)と言っているときは、
 * **何もしない。** 本人がそう決めている通信を、こちらで勝手に使わない。
 */
export function keepsAhead({ saveData = false, online = true, usable = true } = {}) {
  return Boolean(usable && online && !saveData)
}

/** 控えの本数を、そのまま読める言葉にする(**数えられなければ出さない**) */
export function clipCountText(n) {
  return Number.isFinite(n) && n >= 0 ? `${n} 本` : ''
}
