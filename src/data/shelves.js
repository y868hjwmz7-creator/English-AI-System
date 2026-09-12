/**
 * **業種べつの単語帳(棚)**(0057・2026-09 利用者の指定)。
 *
 *   > 何冊も違う単語帳を持てるようにしてほしいんです。基本は自分の単語帳、
 *   > Quick Response が表示され、他の独立した業種や趣味別の単語帳とは
 *   > そもそも混ざらないようにしたいんです。「自分の単語帳に追加する」
 *   > みたいのを押したものだけ自分の単語帳に追加されてほしいんです。
 *   > …そして、ゲストにはトレーナーが指定した単語帳のみが追加されるのです。
 *
 * ============================================================================
 * 【まず数えた。**1,700冊は作れない**】
 *
 *   利用者は「すべての業界、趣味について、すべてのシチュエーションと
 *   場面を想定したもの」と言った。そこで実際に数えた。
 *
 *   | 何 | 数 |
 *   |---|---|
 *   | 分野ぜんぶ | 83 |
 *   | **親だけ** | **35**(お仕事 26 / 趣味 9) |
 *   | 場面(共通と、種類ぶんを含む) | **合計 883**(棚あたり平均 25.2) |
 *   | **分野 × 場面** | **約 1,700**(種類まで数えたとき) |
 *
 *   **棚あたりの場面は、ばらつきが大きい**(実測)。
 *   エネルギー 80・格闘技 69 に対し、ビジネス全般・ゲーム・ファッションは 14。
 *   種類(`parent` を持つ行)を抱えている親ほど、`ownOf` が
 *   その種類ぶんの場面まで集めるためである。
 *
 *   CLAUDE.md には、まさにこの数について
 *   「**場面は 1,700通りあり、手で書けない。書けない表は作らない**」と
 *   書いてある。棚を場面ごとに作ると、そこへ戻ることになる。
 *
 *   だから利用者に数字を出して尋ね、こう決まった。
 *
 *   > 単語帳は業種ごと、出し方の中に場面やシチュエーションで絞り込み、
 *   > あなたのおすすめ通りでお願いします。
 *
 *   **棚は親の分野ごとに1冊 = 35冊。** 場面は捨てるのではなく、
 *   **冊の中の絞り込み**にする(語の1つずつが `scene` を持つ)。
 *   こうすれば「すべての場面を想定する」は満たしたまま、
 *   冊の数は人が選べる数に収まる。
 *
 * ============================================================================
 * 【**別の一覧を作らない**】
 *
 *   棚の一覧は `industries.js` の**親そのもの**である。ここで並べ直さない。
 *
 *   - 分野を足せば、棚も**ひとりでに1冊増える**
 *     (利用者の「業界や趣味を追加するたびに単語帳も追加する」)
 *   - **種類(`parent` を持つ行)は棚を作らない。**
 *     `parentOf()` が親へ落とすので、
 *     「カテゴリーがかぶるものであれば既存のものに追加」が
 *     **条件を1つも書かずに**満たされる
 *   - 「一度入れたものを勝手に減らさない」もそのまま効く
 *     —— 減らす手立てがこちらに無い
 *
 * 【なぜ `src/lib/` ではないのか】
 *
 *   あちらは Supabase を引き連れていて、**素の node で一度も走らせられない**
 *   (`playMark.js` / `mp3Join.js` と同じ考え方)。
 *   一覧と**判断**はここに置き、`npm run test:play` が確かめる。
 */

import { INDUSTRIES, industriesIn, industryLabel, parentOf } from './industries.js'
import { scenesFor } from './genres.js'

/** 棚の組。**`INDUSTRY_GROUPS` と同じもの**(名前を2か所に持たない) */
export const SHELF_GROUPS = [
  { id: 'work', label: 'お仕事' },
  { id: 'hobby', label: '趣味・娯楽' },
]

/**
 * 棚の一覧。**親の分野そのもの**(お仕事 → 趣味・娯楽の順)。
 *
 * `industriesIn()` が「1つめの欄に出す分野」= 親だけを返すので、
 * **ここでは並べ直しも絞り込みもしない。**
 */
export const shelfList = () =>
  SHELF_GROUPS.flatMap((g) => industriesIn(g.id).map((i) => ({
    id: i.id,
    label: i.label,
    hint: i.hint ?? '',
    group: g.id,
  })))

/** その id の棚が在るか */
export const isShelf = (id) => !!id && INDUSTRIES.some((i) => i.id === id && !i.parent)

/**
 * その分野の語は、どの棚に入るか。
 *
 * **種類(コンサル(建設)など)は親の棚に入る。**
 * 利用者の言う「カテゴリーがかぶるものであれば既存のものに追加」が、
 * `parentOf()` 1つでそのまま満たされる。
 * 知らない分野・汎用(null)は `null`(**当てずっぽうで棚に入れない**)。
 */
export const shelfOf = (industry) => {
  if (!industry) return null
  const p = parentOf(industry)
  return isShelf(p) ? p : null
}

/** 棚の名前。**`industryLabel()` に任せる**(名前を2か所に持たない) */
export const shelfLabel = (id) => industryLabel(id)

/**
 * その棚の中で絞り込める場面。
 *
 * **`scenesFor()` をそのまま使う。** あれは
 * 「その分野に特化した場面 + どこにでもある場面」を返し、しかも
 * **種類を持つ親では、種類ぜんぶの場面を集める**(`ownOf`)。
 * 棚は親なので、ここがちょうど欲しいものになる。
 */
export const shelfScenes = (id) => (isShelf(id) ? scenesFor(id) : [])

/**
 * 1つの場面につき、いくつの語句を作るか。
 *
 * **場面あたりで決める。** 冊あたりで決めると、場面が3つの分野と
 * 12ある分野で、1場面あたりの濃さがまるで変わる。
 *
 * 12 にしたのは、基礎単語が「1日 12 語」で回っているためである
 * (`basicWords.js`)。**人が1度に向き合える数を、2か所で変えない。**
 */
export const WORDS_PER_SCENE = 12

/**
 * その棚をぜんぶ作ったとき、何語になるかの目安。
 *
 * **押す前に語数と金額を出す**(見えない費用は管理できない・CLAUDE.md)
 * ために使う。実際にできる数は AI の返し方で前後する。
 */
export const shelfTarget = (id) => shelfScenes(id).length * WORDS_PER_SCENE

/**
 * 棚を作る仕事の並び(場面ごとに1つ)。
 *
 * **1冊まるごとを1回で頼まない。** 場面が12ある分野では 144 語になり、
 * 長すぎて途中で切られる(`max_tokens`)。**場面ごとに区切れば、
 * 途中で失敗しても、そこまでの場面は残る。**
 */
export const shelfJobs = (id) => shelfScenes(id).map((s) => ({
  shelf: id,
  scene: s.id,
  label: s.label,
  hint: s.hint ?? '',
  count: WORDS_PER_SCENE,
}))

/**
 * **まだ足りない場面だけ**を並べる(2026-09 利用者の問い)。
 *
 *   > 一回一回単語を作るのですか？
 *
 * 出したときは**場面を1つ選んで1回押す**形だったので、
 * **883 回**押すことになっていた(35冊 × 平均 25.2 場面・実測)。
 * **1冊ぶんをまとめて作れる**ようにするために、
 * 「この棚で、あと何をどれだけ作ればよいか」をここが決める。
 *
 * - **すでに足りている場面は落とす。** だから
 *   **何度押しても安全**である(押すたびに同じ語を作り直さない)
 * - **作るのは足りないぶんだけ**(`count`)。1語だけ手で入れた場面が
 *   「もう要らない」ことにならない
 * - **順は `shelfJobs()` のまま。** 並べ替えると、
 *   場面のプルダウンと順が食い違う
 *
 * @param id   棚の id
 * @param have 場面ごとの語数(`Map` でも、ただのオブジェクトでもよい)
 */
export function shelfTodo(id, have = null) {
  const n = have instanceof Map ? have : new Map(Object.entries(have ?? {}))
  return shelfJobs(id)
    .map((j) => ({ ...j, have: Number(n.get(j.scene) ?? 0) }))
    .filter((j) => j.have < WORDS_PER_SCENE)
    .map((j) => ({ ...j, count: WORDS_PER_SCENE - j.have }))
}

/**
 * 1場面を作るのにかかるおよその額(ドル)。
 *
 * **押す前に語数と金額を出す**(見えない費用は管理できない・CLAUDE.md)
 * ために使う。実測ではなく、Sonnet 5 の単価と 12 語ぶんの出力から
 * 見積もった幅である。**実際にかかった額は、作ったあとに出す。**
 */
export const SCENE_COST = { min: 0.02, max: 0.05 }

/* ==========================================================================
 * ゲストへの指定 —— **新しい表を作らない**
 *
 *   「ゲストにはトレーナーが指定した単語帳のみが追加される」は、
 *   0055 の `learner_features`(ゲスト × 名前で1行)と**同じ形**である。
 *
 *   あの表は **`feature` に check を置いていない。**
 *   0055 の comment にこう書いてある ——「次に1つ足すたびに SQL を
 *   貼り直してもらうことになるので、名前の一覧はコード側が持つ」。
 *   だから **`shelf:<分野の id>` という名前で、そのまま入れられる。**
 *
 *   - 新しい表も、新しい RPC も、新しい RLS も要らない
 *   - `set_learner_feature()` の門番(`teaches()` / `is_owner()`)がそのまま効く
 *   - `erase_learner()` が**すでに消している**(表を足したら消す側にも足す、
 *     を守る必要がない)
 *
 *   **名前の作り方は、ここ1か所。** 画面で `'shelf:' + id` と書かない ——
 *   置く場所の数だけ食い違う(`remakeModeOf()` と同じ考え方)。
 * ========================================================================== */

/** `learner_features.feature` に入れる名前の頭 */
export const SHELF_PREFIX = 'shelf:'

/** 棚 → 名前。**知らない棚には名前を作らない** */
export const shelfFeature = (id) => (isShelf(id) ? `${SHELF_PREFIX}${id}` : null)

/** 名前 → 棚。棚でないもの・別の名前(`basics` など)は `null` */
export const shelfIdOfFeature = (name) => {
  const s = String(name ?? '')
  if (!s.startsWith(SHELF_PREFIX)) return null
  const id = s.slice(SHELF_PREFIX.length)
  return isShelf(id) ? id : null
}

/**
 * **この人に、その棚を出すか。**
 *
 * 判断はここ1か所。画面の中で `role === 'learner'` と書かない。
 *
 * - **ゲスト以外には、ぜんぶ出す。** 棚を作り、育て、指定するのは
 *   トレーナーの仕事なので、見えないと始まらない
 * - **ゲストには、トレーナーが入れた棚だけ**(利用者の指定そのもの)
 * - **役割が分からないうちは出さない**(既定は「出さない」・
 *   `showsBasics()` / `canAskReview()` とまったく同じ作法)
 *
 * @param role     `profiles.role`(分からなければ null)
 * @param features 開いているものの集合(`Set`)。読めていなければ null
 * @param shelf    棚の id
 */
export function showsShelf({ role = null, features = null } = {}, shelf = null) {
  if (!isShelf(shelf)) return false
  if (role && role !== 'learner') return true
  return !!features && features.has(shelfFeature(shelf))
}

/** その人に出す棚だけを並べる。**画面で `filter` を書き写さない** */
export const shelvesFor = (who = {}) => shelfList().filter((s) => showsShelf(who, s.id))

/* ==========================================================================
 * **チェックを入れた分野だけを学ぶ**(0058・2026-09 利用者の指定)
 *
 *   > 最終的にこうやって混ぜたくないんですよ。これは独立した単語帳に
 *   > したいんです。…チェックを入れた分野だけ単語が学べるようにしたいです
 *
 *   棚は 35 冊・語は 1万を超える(上の表)。**ぜんぶを一度に開かない。**
 *   チェックを入れた分野の語だけを読み、その中で練習する。
 *
 *   - **覚える。** 毎回選び直させない(「一度選んだら覚える」)
 *   - **出せなくなった棚は、黙って落とす**(`pickedShelves`)。
 *     トレーナーが指定を外した棚が残っていると、
 *     **見えていない冊の語が出題に混ざる**
 *   - 鍵の名前は**ここ1か所。** 画面に書かない
 * ========================================================================== */

/** チェックを入れた棚を覚えておく鍵 */
export const SHELF_PICK_KEY = 'eas.shelfPick'

/**
 * 覚えているチェックを、**いま出してよい棚だけに絞って**返す。
 *
 * @param saved   覚えていた id の一覧(壊れていてもよい)
 * @param allowed いま出してよい棚(`shelvesFor()` の返り値でも、id の一覧でもよい)
 */
export function pickedShelves(saved, allowed = []) {
  const okIds = new Set(
    (allowed ?? []).map((s) => (typeof s === 'string' ? s : s?.id)).filter(Boolean),
  )
  const list = Array.isArray(saved) ? saved : []
  const out = []
  for (const id of list) {
    const s = String(id ?? '')
    if (okIds.has(s) && !out.includes(s)) out.push(s)
  }
  return out
}

/** 覚えているチェックを読む。**壊れていても落ちない** */
export function loadShelfPick(allowed = []) {
  try {
    const raw = globalThis.localStorage?.getItem(SHELF_PICK_KEY)
    return pickedShelves(raw ? JSON.parse(raw) : [], allowed)
  } catch { return [] }
}

/** チェックを覚える */
export function saveShelfPick(ids) {
  try {
    globalThis.localStorage?.setItem(
      SHELF_PICK_KEY, JSON.stringify((ids ?? []).map(String)),
    )
  } catch { /* 覚えられなくても、その場では使える */ }
}
