/**
 * ============================================================================
 * **教材の「呼び名」を、1か所で決める**(第5.384節・2026-10-05 利用者の指定)
 *
 *   > 同じレベルで「応答問題」をいくつか作ってゲストにアサインすると、
 *   > 一番大きく表示される題名がすべて同じなので、見分けがつかず探しにくい
 *   > …… A2＋という題名の２つの教材は違う内容のものです。
 *   > 日付も同じなのでより分かりにくいです。
 *
 * ── なぜ「A2+」が大きく出ていたのか(測って分かったこと)───────────
 *
 *   教材名は `日付 / 試験・PART / ジャンル・場面 / 弱点タグ / レベル / 業種`
 *   をつないで作られる(`MaterialForm` の `autoTitle()`)。
 *   **応答問題は、場面も弱点タグも業種も持たない**ので、
 *   残るのが `日付 / A2+` だけになる。見出しは日付を右上へ逃がすので、
 *   **大きく出るのがレベルだけ**になっていた。
 *
 *   しかも**レベルは、すぐ下の札にもう1つ出ている。**
 *   同じことを2つ見せている状態である(CLAUDE.md)。
 *
 * ── **ここが「どれを呼び名にするか」の、ただ1つの置き場所** ──────────
 *
 *   画面の中で `kind === 'response'` や `main === level` と書かない。
 *   **置く場所の数だけ食い違う**(CLAUDE.md「判断は1か所に持つ」)。
 *
 *   順番は上から。**先に当たったものが勝つ。**
 *
 *   | 順 | どこから | いつ使うか |
 *   |---|---|---|
 *   | ① `typed`    | トレーナーが書いた名前(教材名の先頭) | **レベルそのものでなければ** |
 *   | ② `nickname` | AI が付けた一言の呼び名(`headline_ja`) | 本文の無い教材だけ |
 *   | ③ `content`  | 中身(正解にする表現の先頭 + ほか N) | **いまある教材にも効く** |
 *   | ④ `kind`     | 種類の名前(「応答問題」) | 中身がまだ読めていないとき |
 *
 *   **③ があるので、いまアサイン済みの教材も、保存された名前を
 *   1文字も書き換えずに見分けられる。**
 *
 * ── **どこから来た呼び名かも返す** ───────────────────────────
 *
 *   「道が2つあるものは、いまどちらを通ったかを見えるようにしてから直す」
 *   (CLAUDE.md)。見張りも、これが無いと**①と③を取り違えて緑になる。**
 *
 * ── 素の node で走る ────────────────────────────────────
 *
 *   Supabase も `import.meta.env` も引き連れていない。
 *   `npm run test:name` が、この決まりだけを確かめる。
 * ============================================================================
 */
import { parseMaterialTitle } from './format.js'
import { kindLabel } from '../data/materialKinds.js'

/** どこから来た呼び名か。**画面に文字列を書き写さない** */
export const NAME_FROM = {
  TYPED: 'typed',
  NICKNAME: 'nickname',
  CONTENT: 'content',
  KIND: 'kind',
}

const 文字 = (v) => String(v ?? '').trim()

/**
 * **見出しに入れる表現の、長さの上限。**
 *
 * 長い英文がそのまま見出しになると、カードが2行3行に伸びて
 * **並んだときの見分けが、かえって付かなくなる。**
 * 切ったことが分かるように「…」を足す。
 */
export const PHRASE_MAX = 36

/** 長い表現を、見出しに入る長さへ。**切ったことを隠さない** */
export function shortPhrase(s, max = PHRASE_MAX) {
  const t = 文字(s)
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

/**
 * **その名前が、レベルの言い換えにすぎないか。**
 *
 * `autoTitle()` はレベルを**そのままの値**(`A2+`)でつなぐので、
 * 比べる相手も `materials.level` の値である。
 * **札に出る言い換え(`A2+(A2 と B1 の間)`)と比べない** ——
 * あちらは呼び名の一覧から作られるので、言い換えを直した日にずれる。
 */
export function nameIsLevel(name, level) {
  const a = 文字(name).toLowerCase()
  const b = 文字(level).toLowerCase()
  return Boolean(a) && Boolean(b) && a === b
}

/**
 * 中身に出てくる**英語の表現**を、出てくる順に、重なりを除いて返す。
 *
 * **重なりを数えない。** 応答問題は**1つの表現を2回**正解にする設計なので
 * (第5.332節)、そのまま数えると「ほか 19 表現」のように倍で出る。
 *
 * **並びは `seq`。** 読んできた順に頼らない —— Supabase は順を約束しない。
 */
export function materialPhrases(material) {
  const 段 = [...(material?.sections ?? [])]
    .sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0))
  const out = []
  const 見た = new Set()
  for (const sec of 段) {
    const items = [...(sec?.items ?? [])].sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0))
    for (const it of items) {
      const en = 文字(it?.answer) || 文字(it?.prompt_en)
      const 鍵 = en.toLowerCase()
      if (!en || 見た.has(鍵)) continue
      見た.add(鍵)
      out.push(en)
    }
  }
  return out
}

/**
 * 中身から組んだ呼び名。**中身が読めていなければ空を返す**(黙って作らない)。
 *
 *   1つだけ … `Could you send it by Friday?`
 *   いくつも … `Could you send it by Friday? ほか 9 表現`
 */
export function contentName(material) {
  const list = materialPhrases(material)
  if (!list.length) return ''
  const 頭 = shortPhrase(list[0])
  return list.length > 1 ? `${頭} ほか ${list.length - 1} 表現` : 頭
}

/**
 * **この教材を、見出しに何と出すか。**
 *
 * @param {object} material 教材(`title` / `level` / `kind` / `headline` /
 *   `headlineJa` / `sections[].items[]`)
 * @returns {{ name: string, from: string }} 呼び名と、その出どころ
 */
export function materialName(material) {
  const level = 文字(material?.level)
  const typed = 文字(parseMaterialTitle(material?.title).main)

  /* ① トレーナーが書いた名前。**レベルそのものなら、名前ではない** */
  if (typed && !nameIsLevel(typed, level)) {
    return { name: typed, from: NAME_FROM.TYPED }
  }

  /* ② AI の付けた一言の呼び名。**本文のある教材では使わない** ——
       あちらは英語の見出しが名前の役をしていて、`headline_ja` は
       その訳として**見出しのすぐ下にもう出ている**(2行に同じものを並べない) */
  const nick = 文字(material?.headlineJa ?? material?.headline_ja)
  if (!文字(material?.headline) && nick) {
    return { name: nick, from: NAME_FROM.NICKNAME }
  }

  /* ③ 中身から組む。**いまアサイン済みの教材が、ここで見分けられる** */
  const body = contentName(material)
  if (body) return { name: body, from: NAME_FROM.CONTENT }

  /* ④ 最後の砦。**レベルを出すくらいなら、種類を出す** ——
       レベルはすぐ下の札にもう在る(同じことを2つ見せない) */
  const kind = 文字(kindLabel(material?.kind))
  if (kind) return { name: kind, from: NAME_FROM.KIND }

  /* ここまで何も無いときだけ、元のまま。**黙って空にしない** */
  return { name: typed, from: NAME_FROM.TYPED }
}
