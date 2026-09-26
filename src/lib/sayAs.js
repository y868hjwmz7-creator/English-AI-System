/**
 * ============================================================================
 * **読み方の指定**(第5.266節・2026-09-26 利用者の指定)
 *
 *   > UMITO のような会社の名前をしてして記事やダイアローグを作ろうとすると、
 *   > 英語の読みが「ゆーえむあいてぃーおー」と言われてしまいます。
 *   > これを何とかできませんか?
 *   > 他のケースでもうまく対応できるよう汎用性のある解決策を考えてください。
 *   > 例えば「細かい指定」内に読み方も含めればOKなど、、、
 *
 * ── **何が起きていたか** ────────────────────────────────
 *
 *   読み上げは、**知らない大文字の並びを1文字ずつ読む。**
 *   `UMITO` → `U M I T O` → 「ゆーえむあいてぃーおー」。
 *   これは間違いではない —— `IBM` も `ATM` もそう読むべきだからである。
 *   **知らないものは文字ずつ**が正しい既定で、
 *   ここを推し量りで変えると `USA` が「ウサ」になる。
 *
 *   だから**名前ごとに教えてもらう**。教える場所は、利用者の言うとおり
 *   **「細かい指定」の中**である ——
 *   新しい欄を作らずに済み、**教材ごとに違う名前**を書ける。
 *
 * ── **書き方**(=(イコール)でつなぐだけ)────────────────
 *
 *     UMITO=ウミト
 *     UMITO=ウミト、KDDI=ケーディーディーアイ
 *     UMITO＝ウミト / Sakura=サクラ
 *     UMITO=oo-mee-toh          ← 英語のつづりで書いてもよい
 *
 *   **`=` でつないだところだけ**を読み方として拾う。
 *   ふつうの日本語の文に `X=Y` はまず出てこないので、
 *   **細かい指定の中身を取り違えない。**
 *
 * ── **英語のつづりに直す**(`kanaSpell.js`)──────────────
 *
 *     ウ → oo   ミ → mee   ト → toh      →   Oo-mee-toh
 *
 *   素のローマ字(`Umito`)にしないのは、英語の読み上げが
 *   `u` を「ユー」、`i` を「アイ」と読みがちだからである。
 *
 * ── **空白を入れない。ハイフンでつなぐ** ────────────────
 *
 *   **語の数が変わると、語ごとの色(読み上げ中のハイライト)がずれる。**
 *   `Oo mee toh` では1語が3語になってしまうので、
 *   **必ず1つのかたまり**にする(`docs/notes/25-読み上げ用の英文.md`)。
 *
 * ── **分からないものは、変えない** ────────────────────
 *
 *   かなの表に無い字が混ざっていたら `spellKana()` は `null` を返し、
 *   その1件は**無かったことにする**(当てずっぽうで音を作らない)。
 *
 * ── ここは算段だけ。何にも依存しない ─────────────────
 *
 *   **素の node でそのまま走る**(`npm run test:speak`)。
 * ============================================================================
 */
import { CHOON, KANA_SPELL, SOKUON, toKatakana } from '../data/kanaSpell.js'

/**
 * **かな → 英語風のつづり。**
 *
 * @returns `'oo-mee-toh'`。**読めない字が混ざっていたら `null`**
 */
export function spellKana(kana) {
  const s = toKatakana(String(kana ?? '').trim())
  if (!s) return null
  const out = []
  let hold = ''        // 促音(ッ)を持ち越す
  for (let i = 0; i < s.length;) {
    /* **伸ばす印。** 前のまとまりが既に長ければ足さない
       (`ユー` は `yoo` で足りている) */
    if (CHOON.includes(s[i])) {
      const last = out[out.length - 1]
      if (last && !/(oo|ee|oh|eh|aa)$/.test(last)) out[out.length - 1] = `${last}${last.slice(-1)}`
      i += 1
      continue
    }
    if (SOKUON.includes(s[i])) { hold = 'x'; i += 1; continue }
    /* **長いほうから引く。** `キャ` を `キ` + `ャ` に割らない */
    const two = s.slice(i, i + 2)
    const one = s[i]
    const hit = (two.length === 2 && KANA_SPELL[two]) ? { sp: KANA_SPELL[two], n: 2 }
      : KANA_SPELL[one] ? { sp: KANA_SPELL[one], n: 1 }
        : null
    /* **読めない字が1つでもあれば、その読み方ごと捨てる。**
       半分だけ直すと、**直したつもりで別の音**になる */
    if (!hit) return null
    /* 促音 … **次の子音を重ねる**(サッポロ → sap-poh-roh) */
    if (hold && out.length && /^[a-z]/.test(hit.sp)) {
      out[out.length - 1] = `${out[out.length - 1]}${hit.sp[0]}`
    }
    hold = ''
    out.push(hit.sp)
    i += hit.n
  }
  if (!out.length) return null
  const joined = out.join('-')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

/**
 * **読み方として使える形にそろえる。**
 *
 * - かな混じりなら `spellKana()` に通す
 * - 英語のつづりで書いてあれば、そのまま(**空白はハイフンにする**)
 * - どちらでもなければ `null`(**分からないものは変えない**)
 */
export function sayAsValue(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return null
  /* かな(ひらがな・カタカナ・伸ばす印)が1文字でもあれば、かなとして読む */
  if (/[ぁ-ゖァ-ヺーー]/.test(v)) return spellKana(v)
  /* 英語のつづり。**空白はハイフンへ** —— 語の数を変えないため */
  if (/^[A-Za-z][A-Za-z '-]*$/.test(v)) return v.trim().replace(/\s+/g, '-')
  return null
}

/**
 * **「細かい指定」から、読み方の対応表を拾う。**
 *
 * @returns `{ UMITO: 'Oo-mee-toh' }`。1つも無ければ空の object
 *
 * **拾うのは `名前=よみ` だけ。** ほかの文は1文字も見ない。
 */
export function parseSayAs(text) {
  const out = {}
  const src = String(text ?? '')
  if (!src.trim()) return out
  /* **切り分けずに、対そのものを探す。**
     はじめは区切り文字で切って回したが、**「。」で切っていなかった**ので
     `…の話。UMITO=ウミト` が丸ごと1つの塊になり、拾えなかった(実測)。
     **区切りを足し続ける形は、書き方が1つ増えるたびに破れる** ——
     **欲しいものを名指しする**(CLAUDE.md)。

     右側は「区切りでも句読点でもない文字の並び」。
     `=` の前後の空白は、あってもよい */
  const PAIR = /([A-Za-z][A-Za-z0-9&.'-]*)[ \t]*[=＝][ \t]*([^\s,、，。．・/／;；\n\r]+)/g
  for (const m of src.matchAll(PAIR)) {
    const key = String(m[1] ?? '').trim()
    const right = m[2]
    /* **名前は英数字で始まる1語。** 日本語の側を鍵にしない
       (英文の中に出てくるのは英語の綴りのほうである) */
    if (!/^[A-Za-z][A-Za-z0-9&.'-]*$/.test(key)) continue
    /* **1文字の名前は拾わない。** `a=…` のような書き間違いで、
       本文の `a` が全部置き換わると取り返しがつかない */
    if (key.length < 2) continue
    const value = sayAsValue(right)
    if (!value) continue
    out[key] = value
  }
  return out
}

/** 正規表現で使える形にする(名前に `.` や `&` が入ることがある) */
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * **英文の中の名前を、読み方に置き換える。**
 *
 * - **語の切れ目でだけ当てる**(`UMITO` が `UMITOS` の中に当たらない)
 * - **大文字小文字は、書いたとおりに合わせる** ——
 *   `IT=…` のような短い語で本文が総取り替えになるのを防ぐ
 * - 表が空なら、**1文字も変えずに返す**(0円・指紋も変わらない)
 */
export function applySayAs(text, map) {
  let out = String(text ?? '')
  if (!out || !map) return out
  for (const [key, value] of Object.entries(map)) {
    if (!key || !value) continue
    const re = new RegExp(`(^|[^A-Za-z0-9])(${esc(key)})(?![A-Za-z0-9])`, 'g')
    out = out.replace(re, (all, head) => `${head}${value}`)
  }
  return out
}

/**
 * **読み上げ用の英文。**
 *
 * 画面に出す英文は**1文字も変えない**(第5.205節と同じ決まり)。
 * ここが返すのは**別の文字列**で、置き換えが1つも起きなければ
 * **もとの文字とまったく同じもの**が返る ——
 * 同じなら音声の指紋も変わらないので、**作り直しにならない(0円)**。
 */
export function sayAsText(text, map) {
  const said = applySayAs(text, map)
  return said === String(text ?? '') ? '' : said
}
