/**
 * ============================================================================
 * **RIZAP ENGLISH の教材の、固定の配役**(第5.202節)
 *
 * 2026-09 実機・利用者の指定。
 *
 *   > 二人とも女性になっています。ふざけないでください。
 *   > そして、Elevenlabsの声で固定で作ってください。
 *   > Mary = Jessica / Noah = David Esposito / Hannah = Sky / Sam = Henry
 *   > Conversation1、2、３、Business Conversation 1、２は共通して
 *   > この設定でお願いします。**絶対に変えないで。**
 *
 * ── なぜ、こうなったか(こちらの誤り)────────────────────────
 *
 *   UNIT 1 を入れる SQL に **`voice_ids` を1つも入れていなかった。**
 *   声を選んでいない教材は「標準の声」に落ちる(`voiceLabel()`)ので、
 *   画面には **Mary も Noah も「標準の声(アメリカ・女性)」**と出た。
 *
 *   名前から声を並べ替える仕組み(`voiceOrder.js`)は確かめてあったが、
 *   あれは**すでに選ばれている声の並びを入れ替えるだけ**である。
 *   **1つも選んでいなければ、何も起きない。**
 *   「仕組みがある」ことと「その教材で効いている」ことは別である ——
 *   CLAUDE.md「**頼んでいるだけで、守られたかを見ていない**」と同じ形を
 *   もう一度踏んだ。
 *
 * ── だから、推測をやめて、名指しで固定する ──────────────────
 *
 *   `voiceOrder.js` は**名前から性別を推測**して並べ替える。
 *   推測が当たっても「Mary が Jessica である」ことは決まらない。
 *   **利用者は人物ごとに声を指名した。** ここはその表である。
 *
 *   **5冊すべてで共通**(Conversation 1〜3 / Business Conversation 1〜2)。
 *   **絶対に変えない**(利用者の指定)。
 *
 * ── 知らない人物には、声を当てない ──────────────────────────
 *
 *   利用者の指定。
 *
 *     > UNIT を追加していく際に登場人物が追加になった際は、私に、
 *     > その登場人物にどの声を採用するのか尋ねてください。
 *
 *   だから `rizapVoiceOf()` は**知らない名前に `null` を返す。**
 *   **当てずっぽうで埋めない。** 埋めると、また「いつのまにか
 *   違う声になっている」が起きる(既定は「できない」側・CLAUDE.md)。
 *
 * ── 声の名前は、ここに書き写さない ──────────────────────────
 *
 *   持つのは **id だけ**(`us-1` など)。「Jessica」「Sky」といった
 *   画面に出る名前は `clipVoices.js` 1か所が持っている
 *   (CLAUDE.md「**呼び名を2か所に書かない**」)。
 *   **id と名前が食い違っていないかは `npm run test:voice` が見張る。**
 * ============================================================================
 */

/**
 * **人物 → 声の id。** 利用者が名指ししたものである。
 *
 * `want` は、利用者がそのとき言った声の名前。**画面には使わない** ——
 * ここに書いてあるのは「**そのつもりで選んだ**」という記録で、
 * 実際に出す名前は `voiceLabel(voice)` が `clipVoices.js` から引く。
 * 2つが食い違ったら `npm run test:voice` が赤くなる。
 */
export const RIZAP_CAST = [
  { name: 'Mary', voice: 'us-1', want: 'Jessica' },
  { name: 'Noah', voice: 'us-2', want: 'David Esposito' },
  { name: 'Hannah', voice: 'uk-1', want: 'Sky' },
  { name: 'Sam', voice: 'uk-4', want: 'Henry' },
]

/**
 * 「Mary (Ticket center clerk)」→「mary」。
 *
 * **`voiceCast.js` の `speakerKey` + 下の名前と、同じ切り方にする** ——
 * ずれると、声を当てた人と読み上げる人が別人になる。
 */
export const rizapNameKey = (speaker) => String(speaker ?? '')
  .trim().toLowerCase().split('(')[0].trim().split(/\s+/)[0] ?? ''

/**
 * **その人物の声。知らない人物は `null`。**
 *
 * `null` が返ったら、**利用者に「この人物はどの声にしますか」と訊く。**
 * こちらで決めない(利用者の指定)。
 */
export function rizapVoiceOf(speaker) {
  const key = rizapNameKey(speaker)
  if (!key) return null
  return RIZAP_CAST.find((c) => c.name.toLowerCase() === key)?.voice ?? null
}

/**
 * **出てくる順の、声の並び**(`materials.voice_ids` に入れる形)。
 *
 * **重複しない人物を、最初に出てきた順に**並べる ——
 * `voiceOrder.js` の `distinctSpeakers()` とまったく同じ数え方でなければ、
 * **並びがずれて別人の声になる**(数え方を2通り持たない・CLAUDE.md)。
 *
 * @param {Array<string>} speakers 出てくる順の話す人(重複していてよい)
 * @returns {{ids: string[], unknown: string[]}}
 *   `ids` … 声の並び / `unknown` … **声が決まっていない人物**(訊く相手)
 */
export function rizapVoiceIds(speakers) {
  const seen = []
  for (const sp of speakers ?? []) {
    const k = rizapNameKey(sp)
    if (k && !seen.includes(k)) seen.push(k)
  }
  const ids = []
  const unknown = []
  for (const k of seen) {
    const v = rizapVoiceOf(k)
    if (v) ids.push(v)
    else unknown.push(k)
  }
  return { ids, unknown }
}
