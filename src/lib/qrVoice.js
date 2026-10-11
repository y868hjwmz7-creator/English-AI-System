/**
 * **溜めた1問を、どの声・どの段で鳴らすか**(0078・第5.446節)。
 *
 *   > A で良いです。復習はその時の声のキャラで構いません。
 *   > その方が頭に残ります
 *   (2026-10 利用者の指定)
 *
 * ============================================================================
 * 【なぜ別のファイルなのか】
 *
 *   `qrReviews.js` は Supabase を引き連れているので、**素の node で
 *   1度も動かせない。** 判断をあちらに置くと**見張りが1本も書けない** ——
 *   応答問題で「問数がきっちり半分」になっていたのに気づけなかったのと
 *   同じ形である(CLAUDE.md・第5.345節)。
 *
 * 【判断はここ1か所】
 *
 *   画面の中で `row.clip_voice ?? …` と書かない。
 *   **置く場所の数だけ食い違う**(CLAUDE.md)。
 *
 *   | 控え | どう鳴らすか |
 *   |---|---|
 *   | 声が控えてある | **そのとおりに鳴らす。** 教材の中とまったく同じ置き場所になる |
 *   | 控えが無い(0078 より前に溜めた行) | **その教材の1人目の声**に落とす |
 *
 *   **落とし先を「既定の声」にしない。** その教材の1人目にそろえておけば、
 *   教材の中の Quick Response が作った音声がそのまま鳴る
 *   (**課金が増えない**)。教材が消えている行だけが既定の声になる。
 *
 * 【段は、いままでどおり良い段】
 *   `QrCard` の既定がそうだった(`tier = 'premium'`)。**変えない。**
 *   ただし次の2つは**良い段で鳴らしようがない**ので標準に落とす。
 *
 *   ・良い声を1つも登録していないとき(`hasPremiumVoices()`)
 *   ・落ち先が Google の声のとき(`isBaseVoice()`)
 *
 *   **段と、実際に鳴る声を食い違わせない**(`voiceTier.js` と同じ考え方)——
 *   食い違うと、窓口が代役に落として鳴らすので
 *   **`premium` の置き場所に標準の音が残る。**
 * ============================================================================
 */
import { isBaseVoice, resolveVoices } from '../data/clipVoices.js'
import { PREMIUM, STANDARD, hasPremiumVoices } from './voiceTier.js'

/**
 * @param {object} row `qr_items()` が返した1行
 *   (`clip_voice` / `clip_tier` / `material_voice_ids`)
 * @returns {{clipVoice: string, tier: string}}
 *   **名前は、教材の中の対(`quickResponsePairs()`)とそろえる** ——
 *   そうすれば `QrCard` は、どちらから来た問かを見分けずに鳴らせる
 */
export const qrVoiceOf = (row) => {
  const clipVoice = String(row?.clip_voice ?? '').trim()
    || resolveVoices(row?.material_voice_ids)[0]
  const tier = String(row?.clip_tier ?? '').trim()
    || (hasPremiumVoices() && !isBaseVoice(clipVoice) ? PREMIUM : STANDARD)
  return { clipVoice, tier }
}
