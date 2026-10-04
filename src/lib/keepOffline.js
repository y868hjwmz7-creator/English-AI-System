/**
 * ============================================================================
 * **持ち出す**(第5.372節・オフラインで開ける)
 *
 *   > 通勤・移動中が多い(2026-10-04 利用者)
 *
 *   Service Worker は、**一度鳴らした音声**を控えている。
 *   だから「まだ聞いていない宿題」は、電波の無いところでは鳴らない ——
 *   **家を出る前に、その教材ぶんを先に落としておく。**
 *
 * ── **窓口を呼ばない = 0円** ───────────────────────────────
 *
 *   すでに置いてある MP3 を**落としてくるだけ**である。
 *   作り直してはいないので、**1円もかからない**
 *   (CLAUDE.md「音声と語の意味は、1回だけ課金される」)。
 *   ただし**通信は使う**ので、何本落とすかを先に出す。
 *
 * ── **数え方を2通り持たない** ──────────────────────────────
 *
 *   何を落とすかは、**鳴らすときとまったく同じ道具**から引く ——
 *   本文は `materialAudioClips()` → `wholeClipUrl()`(1本にまとめたもの)、
 *   それ以外は `materialRestClips()` → `clipUrl()`。
 *   **支度(`prepareJob.js`)が作っているのも、この2つ**である。
 *   ここで別の数え方をすると、**置いていない場所を落としに行く。**
 *
 * ── **作らない。あるものだけ** ─────────────────────────────
 *
 *   `clipUrl()` は「置かれる**はず**の場所」を返すだけで、
 *   あるかどうかは見ない(往復が増えて、鳴り始めが遅くなるため)。
 *   だから**無いものは、落ちるだけ**である ——
 *   Service Worker の側が、落ちたものを控えない。
 * ============================================================================
 */
import { clipUrl, wholeClipUrl } from './audioClips.js'
import { materialAudioClips, materialRestClips } from './audioPlaylist.js'
import { keepClips } from './offline.js'

/**
 * その教材を鳴らすのに要る、音声の置き場所をぜんぶ返す。
 *
 * **窓口は1度も呼ばない。** 置き場所を計算するだけである。
 * @returns {Promise<string[]>} 重なりは取り除いてある
 */
export async function materialClipUrls(material) {
  const 置き場所 = []

  /* ── ① 本文。**1本にまとめたもの**(支度が作るのはこちら) ── */
  const 本文 = materialAudioClips(material) ?? []
  if (本文.length) {
    const url = await wholeClipUrl({
      texts: 本文.map((c) => c.text),
      voiceIds: 本文.map((c) => c.voiceId),
    })
    if (url) 置き場所.push(url)
  }

  /* ── ② 本文以外。**1文ずつ**(鳴らすときと同じ段・同じ声) ── */
  for (const c of materialRestClips(material) ?? []) {
    const url = await clipUrl(c.text, c.voiceId, c.tier)
    if (url) 置き場所.push(url)
  }

  return [...new Set(置き場所)]
}

/**
 * **持ち出す。** その教材の音声を、先に落として控える。
 *
 * @returns {Promise<{total:number, added:number|null}>}
 *   `added` は**新しく落とした本数**。数えられなければ `null`
 *   (**0 と取り違えない** —— すでに全部あって 0 本なのか、
 *    Service Worker が居なくて数えられないのか、は別の話である)
 */
export async function keepMaterialOffline(material) {
  const urls = await materialClipUrls(material)
  if (!urls.length) return { total: 0, added: 0 }
  const r = await keepClips(urls)
  return { total: urls.length, added: Number.isFinite(r?.added) ? r.added : null }
}
