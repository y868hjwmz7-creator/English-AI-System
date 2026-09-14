/**
 * ============================================================================
 * 出来上がった会話の**名前に合わせて、選んだ声の並びを入れ替える。**
 *
 * 【なぜ要るか】(2026-09 利用者の指摘)
 *
 *   > 会話や会議で男の役に女性の声、女性の役に男の声が
 *   > アサインされることがほとんどです。直して下さい。
 *
 *   仕組みは前から入っている —— 画面が `speakerGenders` を渡し、窓口が
 *   「最初に話す人から順に、1人目は男性、2人目は女性」と書かせる
 *   (2026-09)。**けれども、そのあと一度も確かめていなかった。**
 *
 *   **頼んでいるだけで、守られたかを見ていない。** だから
 *   ①窓口を置き直していない ②AI がその1行を守らなかった、のどちらでも
 *   **黙ってずれる。** しかも**音は鳴る**ので、聴くまで分からない。
 *
 *   CLAUDE.md には「**守らせたい形は、頼むのではなく道具の形で強制する**」
 *   「**出来上がった問は、1問ずつ確かめる**」と書いてある。
 *   性別だけ、その決まりから漏れていた。
 *
 * 【測ってある】
 *   声の並びは**訛りごとに決まっている**(`pickVoices` は男女を交互に選ぶ)。
 *   実測すると、2人のときは us/sc が「男・女」、uk/au が「女・男」で
 *   **400回とも同じ**だった。つまり指定が届いていなければ、
 *   AI が付ける名前の偏りがそのまま**ほぼ全部のずれ**になる。
 *   利用者の言う「ほとんど」と合う。
 *
 * 【なぜ「入れ替え」なのか。声を選び直さない】
 *   CLAUDE.md にこう書いてある。
 *
 *     **逆はしない。** 名前から性別を読んで声を当て直すのは、
 *     名前で性別が当てられないうえ、**指名した声が無視される**
 *
 *   だからここでは **選んだ声を1人も入れ替えない。並び順だけを変える。**
 *   出てくる声の顔ぶれは1人も変わらないので、トレーナーが指名した声は
 *   **必ず全員そのまま使われる。** 変わるのは「誰がどれを読むか」だけである。
 *
 * 【当てられないものは、当てない】
 *   名前からの性別は `guessGender()` の**閉じた一覧**で見る。
 *   一覧に無い名前は `unknown` で、**そこは何もしない**
 *   (`chunker.js` の `SURE_PREPS` と同じ考え方 ——
 *   **見落としは今までどおりだが、取り違えは害になる**)。
 *
 * 【いつ効くか】
 *   **発行するときに1回だけ。** そのとき保存する `voice_ids` の並びを
 *   直すだけなので、**AI を1回も呼ばず、音声も1本も作らない = 0円。**
 *   窓口の置き直しも SQL も要らない。
 *
 *   **すでに作った教材は直らない**(声は教材に保存されている・CLAUDE.md)。
 *   気になるものは、さがす画面の「読み上げ音声を作り直す」で作り直す。
 *
 * 【ここに置く理由】
 *   `MaterialForm.jsx` の中に書くと Supabase を引き連れ、
 *   **素の node で一度も走らせられない**(`playMark.js` と同じ考え方)。
 *   `npm run test:voice` が、この関数をそのまま呼んで確かめる。
 * ============================================================================
 */
import { guessGender, speakerKey } from './voiceCast.js'

/**
 * 出てくる順の、**重複しない話す人。**
 *
 * **`castClipSpeakers()` とまったく同じ数え方**でなければならない。
 * ずれると、ここで直した並びが**別の人に当たる。**
 * だから `speakerKey()` を共有し、同じ「最初に出てきた順」で数える。
 *
 * @param {Array<string>} speakers 出てくる順の話す人(重複していてよい)
 * @returns {Array<string>} 重複しない話す人(最初に出てきた順)
 */
export function distinctSpeakers(speakers) {
  const names = []
  for (const sp of speakers ?? []) {
    const k = speakerKey(sp)
    if (k && !names.includes(k)) names.push(k)
  }
  return names
}

/**
 * 名前に合わせて、**声の並びだけ**を入れ替える。
 *
 * @param {Array<string>} voiceIds 教材に保存する声の並び
 * @param {Array<string>} speakers 出てくる順の話す人
 * @param {(id: string) => ('male'|'female'|string|null|undefined)} genderOfId
 *        声 id → 性別(名簿を引く。**この関数は名簿を持たない**)
 * @returns {Array<string>} 並べ替えた声。**入れ替えないときは元の配列そのもの**
 */
export function orderVoicesByNames(voiceIds, speakers, genderOfId) {
  const ids = Array.isArray(voiceIds) ? voiceIds : []
  // **2人に満たなければ、入れ替えようがない**(行き止まりを作らない)
  if (ids.length < 2) return ids

  const names = distinctSpeakers(speakers)
  if (names.length < 2) return ids

  /* 名前から確かに読める性別だけを見る。**`unknown` は何もしない。**
     2人以上そろっていなければ、そもそも入れ替える根拠がない */
  const want = names.slice(0, ids.length).map((n) => guessGender(n))
  if (want.filter((g) => g === 'male' || g === 'female').length < 2) return ids

  /* いま当たっている声の性別。名簿に無い声は空にして**落とさない** ——
     `filter` で縮めると**2人目以降がずれる**(CLAUDE.md・同じ穴を二度空けない) */
  const have = ids.map((id) => {
    const g = genderOfId?.(id)
    return g === 'male' || g === 'female' ? g : ''
  })

  /* 上から順に、その名前に合う声を1人ずつ取る。
     **合う声が残っていなければ、そのままにして次へ進む**
     (取れなかったぶんは、あとで元の並びのまま埋める) */
  const left = ids.map((_, i) => i)
  const out = new Array(ids.length).fill(null)
  want.forEach((g, i) => {
    if (g !== 'male' && g !== 'female') return
    const at = left.findIndex((j) => have[j] === g)
    if (at < 0) return
    out[i] = ids[left[at]]
    left.splice(at, 1)
  })
  // 残りは、**元の並びのまま**前から埋める(顔ぶれは1人も変わらない)
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] === null) out[i] = ids[left.shift()]
  }

  // **変わっていなければ、元の配列そのものを返す**(呼ぶ側が見分けられる)
  return out.every((id, i) => id === ids[i]) ? ids : out
}
