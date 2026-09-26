/**
 * ============================================================================
 * 教材の音声を、**鳴る順に並べる**。
 *
 * 【なぜ別のファイルにしてあるか】(2026-09 実機)
 *
 *   ここは `downloadAudio.js` の中に書いてあった。ところがあちらは
 *   Supabase(`clipUrl`)を引き連れているので、**素の node では
 *   一度も走らせられなかった。** そのため
 *
 *     const bodyOf = (material) => (material?.sections ?? [])
 *       .find((sec) => sec.exercise_type === 'reading' || … === 'dialogue')
 *
 *   という書き間違い —— 記事の演習の id は **`article`** である ——
 *   が誰にも捕まらず、**会話では出るのに、記事だけ
 *   「音声をダウンロード」のボタンが出ない**まま渡してしまった。
 *
 *   > あれ？先ほど作成した「ダイアローグ」では音声のダウンロードが
 *   > できるのですが、その後に作成した「記事」ではダメでした。
 *
 *   `npm run lint` も `npm run build` も通る。**作ってみるまで分からない。**
 *   だから **`playMark.js` / `mp3Join.js` と同じように**、
 *   何にも依存しない形に切り出して `npm run test:mp3` で見張る。
 *
 * 【本文かどうかを、ここで数えない】
 *   種類の名前を書き写すと、演習を足したときに必ずどこかが古くなる。
 *   本文かどうかは `exerciseTypes.js` の **`isPassage`** が持っている
 *   (`voiceTierFor` も 6Steps もそちらを見ている)。
 *   **判断を2か所に置かない。**
 *
 * 【並べ方は「Listen (全体)」とまったく同じ】
 *   声の当て方も間(ま)の決め方も、鳴らすときと同じ道具を通す
 *   (`castClipSpeakers` / `turnGapMs`)。**数え方を2通り持たない。**
 * ============================================================================
 */
import { castClipSpeakers, voiceFor } from './voiceCast.js'
import { resolveVoices } from '../data/clipVoices.js'
import { exerciseType, isPassageSection } from '../data/exerciseTypes.js'
import { voiceTierFor } from './voiceTier.js'
import { turnGapMs } from './turnGap.js'
import { speakChunks } from './speakChunks.js'

/** 本文の演習(記事・会話・会議)。**「Listen (全体)」が鳴らすもの** */
export const bodySectionOf = (material) => (material?.sections ?? [])
  .find((sec) => isPassageSection(sec.exercise_type)) ?? null

/**
 * 音声になる項目だけ。**絞り方をここ1か所に置く。**
 *
 * 通しの一覧も、段落ごとの Listen が使う番号も、**同じこの絞り方**で
 * 数える。片方だけ変えると**番号が1つずれて、別の発言が鳴る。**
 */
export const audioItemsOf = (items, typeId) => (items ?? [])
  .filter((it) => audioTextOf(it, typeId))

/**
 * その項目の、読み上げる英文。
 *
 * **どの欄を読むかは `audioFrom` 1か所が決める**(`exerciseTypes.js`)。
 * 演習ごとに違う —— 和文英訳は `answer`、リスニングは `audio_text`、
 * 内容の理解と想定される質問は `question` である。
 *
 * **`audioFrom` が `null` の演習は、必ず空を返す。**
 * 誤り訂正と穴埋めがそれで、**誤った英文を手本として聞かせられない**
 * (CLAUDE.md)。ここを緩めると、通しの読み上げが誤文を読み上げる。
 *
 * 以前は `audio_text || prompt_en` と書いてあった。本文(記事・会話)は
 * それで正しかったが、**本文以外では当たらない**(和文英訳には
 * `prompt_en` が無く、誤り訂正では読んではいけない英文が入っている)。
 */
export const audioTextOf = (it, typeId) => {
  const from = exerciseType(typeId)?.audioFrom
  if (!from) return ''
  /* ── **読み方を直した英文があれば、そちらを読む**(第5.266節)──
     2026-09-26 利用者の指定。

       > UMITO のような会社の名前を…英語の読みが
       > 「ゆーえむあいてぃーおー」と言われてしまいます。

     `audio_text` は「お手本音声にする英文」の欄で、0007 からある。
     **画面に出るのは `from` の欄のまま**で、ここが返すのは
     **音にする文字**である(第5.205節「画面の英文と声にする英文を分ける」)。

     ・**リスニングは二重にしない** —— あちらは `from` そのものが
       `audio_text` で、しかも答え合わせでその文字がそのまま画面に出る
     ・**これまでの教材は1文字も変わらない** —— 窓口が `audio_text` を
       返すのはリスニングだけなので、ほかの演習では空のままである
       (= 指紋が変わらない = **作り直しにならない・0円**) */
  const said = String(it?.audio_text ?? '').trim()
  if (said && from !== 'audio_text') return said
  return String(it?.[from] ?? '').trim()
}

/**
 * **1本にまとめた音声の、どこを鳴らせばよいか**(2026-09 利用者の指定)。
 *
 *   > 音声については「1本にまとめる」の仕様に統一しましょう。
 *   > 「段落ごと」は廃止です
 *
 * 本文の音声は**1本だけ**作る。段落ごと・発言ごとの Listen は、
 * **その1本の中の区間**を鳴らす(別の MP3 を作らない = 二度課金しない)。
 *
 * **番号は `audioItemsOf` で数える。** 描くときの番号(空の項目も混じる)を
 * そのまま渡すと、**別の発言の区間を鳴らす。**
 *
 * **本文の演習でなければ、必ず `null` を返す。** 内容の理解や語句は
 * 1本の中に入っていないので、区間を当てようがない。
 * **その判断は `isPassageSection` 1か所に任せる** —— 呼ぶ側に
 * 「本文のときだけ渡してください」と約束させると、必ずどこかが破る。
 *
 * @param {object} section  演習(**項目の一覧ごと**渡す)
 * @param {object} cast     話す人 → 声(`castClipSpeakers` の返り値)
 * @param {string} solo     話す人がいないときの声
 * @param {object} item     いま鳴らそうとしている項目(**同じ実物**)
 * @returns {{texts: string[], voiceIds: string[], index: number}|null}
 */
export function wholeSliceOf(section, cast, solo, item) {
  if (!isPassageSection(section?.exercise_type)) return null
  const list = audioItemsOf(section.items, section.exercise_type)
  // **2つ以上ないと、1本にまとめる意味がない**(`wholeClip` も同じ条件)
  if (list.length < 2) return null
  const index = list.indexOf(item)
  if (index < 0) return null
  return {
    texts: list.map((x) => audioTextOf(x, section.exercise_type)),
    voiceIds: list.map((it) => voiceFor(cast, it.speaker, solo)),
    index,
  }
}

/**
 * 通しで鳴るものを、順に並べる。
 *
 * @returns {Array<{text, voiceId, tier, gapMs}>} `gapMs` は**そのあとの間**
 */
export function materialAudioClips(material) {
  const body = bodySectionOf(material)
  if (!body) return []
  const voiceIds = material?.voiceIds ?? material?.voice_ids ?? null
  const solo = resolveVoices(voiceIds)[0]
  const cast = castClipSpeakers((body.items ?? []).map((it) => it.speaker), voiceIds)
  const tier = voiceTierFor({
    exerciseType: body.exercise_type,
    tags: material?.tags ?? [],
  })

  const items = audioItemsOf(body.items, body.exercise_type)
  return items.map((it, i) => {
    const next = items[i + 1]
    const text = audioTextOf(it, body.exercise_type)
    /* **間の決め方も、鳴らすときと同じ。**
       前の発言と次の発言の中身から決まる(`turnGap.js`)。
       同じ人が続けて話すときは、受け答えの規則を当てない */
    const gapMs = next
      ? turnGapMs(text, audioTextOf(next, body.exercise_type), {
        sameVoice: String(it.speaker ?? '') === String(next.speaker ?? ''),
      })
      : 0
    return {
      text,
      voiceId: voiceFor(cast, it.speaker, solo),
      tier,
      gapMs,
    }
  })
}

/**
 * かけらとかけらのあいだの間(ま)。**鳴らすときと同じ 90ms**
 * (`readAloud.js` の `if (joined) await pause(90 / rate)`)。
 *
 * 分けたのは**こちらの都合**であって、話のうえでは文と文の切れ目である。
 * だから段落の間(`turnGapMs`)は置かない。
 */
export const PIECE_GAP_MS = 90

/**
 * **実際に鳴る「かけら」を、鳴る順に並べる**(2026-09 実機)。
 *
 * ── なぜ要るのか ───────────────────────────────────────────────
 *
 * 読み上げは、長い段落を `speakChunks()` で**かけらに分けてから**
 * 窓口へ渡す。だから MP3 の置き場所は**かけらの英文の指紋**で決まる。
 *
 *     <版>/<段>/<声の id>/<かけらの英文の指紋>.mp3
 *
 * ところが音声のダウンロードは `materialAudioClips()` の
 * **段落まるごとの英文**で集めていた。その指紋の MP3 は
 * **どこにも存在しない**ので、
 *
 *   > 音声が ◯ 本足りません
 *
 * と出て、**1本も落とせない。** 作り直し(`remakeClips.js`)で踏んだのと
 * **まったく同じ根**である。
 *
 * **貼った原稿(Speech練習)だけで起きる。** AI が書く段落は 300 文字ほど
 * なので `speakChunks()` を通っても1つのままで、
 * **ふつうの教材では、これまでと1本も変わらない。**
 *
 * ── なぜ `materialAudioClips()` の側で分けないか ────────────────
 *
 * あちらは **`prepareJob.js` も使っている。** そちらは英文を
 * **段落まるごとのまま** `wholeClip({texts, voiceIds})` へ渡す
 * (1本にまとめた音声は、本文ぜんぶを1回で作る)。
 * ここで分けてしまうと、**1本にまとめる側の指紋まで変わり、
 * すでにある音声が全部作り直しになる**(= 再課金)。
 *
 * **分けるのは「あるものを集める側」だけ。**
 *
 * @returns {Array<{text, voiceId, tier, gapMs}>} `gapMs` は**そのあとの間**
 */
/**
 * ============================================================================
 * **本文のほかに、読み上げが付く英文をぜんぶ並べる**(第5.203節)
 *
 * 2026-09 実機・利用者の指摘。
 *
 *   > そもそもが教材を作りながら音の処理を裏で同時に終わらせられないの
 *   > ですか？ 文系トレーニングでさえどの listen を押しても数秒待たされ、
 *   > 記事やダイアローグだと1分近く待たされます。
 *
 * ── 数えたら、支度は**ほんの一部**しか作っていなかった ──────────
 *
 *   | 教材の種類 | 読み上げのある問 | いま支度が作るもの |
 *   |---|---|---|
 *   | 文型ドリル | **30 本** | **0 本**(本文の演習が無いので、丸ごと素通り) |
 *   | 記事 | 24 本 | 1本にまとめた本文だけ |
 *   | 会話 | 30 本 | 同上 |
 *   | 単語 / フレーズ | **20 本** | **0 本** |
 *
 *   **押したときに作るしかないので、毎回待たされていた。**
 *
 * ── 本文はここに入れない ────────────────────────────────────
 *
 *   本文(記事・会話)は `materialAudioClips()` が受け持ち、支度では
 *   **1本にまとめて**作る(`wholeClip`)。ここで発言ごとにも作ると、
 *   **本文の音声代が倍になる**(CLAUDE.md「2つの形を置いている」)。
 *   利用者の指定は **A(本文以外を全部)** なので、本文は外す。
 *
 * ── 声と段は、鳴らすときとまったく同じ決め方 ────────────────
 *
 *   画面(`MaterialBody`)は本文以外の英文を
 *   **`resolveVoices(voiceIds)[0]`(いちばん最初の声)**で読み、
 *   段は `voiceTierFor({exerciseType, tags})` で決める。
 *   **ここで別の決め方をすると、支度した MP3 と、押したときに探す
 *   MP3 の置き場所が食い違い、1本も当たらない**(`materialClipPieces`
 *   の説明にある落とし穴と、まったく同じ根)。
 *
 * ── どの欄を読むかも、書き写さない ──────────────────────────
 *
 *   `exerciseTypes.js` の `audioFrom` 1か所から引く。
 *   種類を足した日に、ここだけ古いままにならない。
 * ============================================================================
 *
 * @returns {Array<{text, voiceId, tier}>} 鳴る順
 */
export function materialRestClips(material) {
  const body = bodySectionOf(material)
  const voiceIds = material?.voiceIds ?? material?.voice_ids ?? null
  const solo = resolveVoices(voiceIds)[0]
  const tags = material?.tags ?? material?.tagIds ?? []
  const out = []
  const seen = new Set()
  for (const sec of material?.sections ?? []) {
    /* **本文は入れない**(1本にまとめたものが受け持つ) */
    if (body && sec === body) continue
    const from = exerciseType(sec?.exercise_type)?.audioFrom
    if (!from) continue
    const tier = voiceTierFor({ exerciseType: sec.exercise_type, tags })
    for (const it of sec.items ?? []) {
      const text = String(it?.[from] ?? '').trim()
      if (!text) continue
      /* **同じ英文を二度作らない。** 置き場所は(段・声・英文の指紋)なので、
         同じ3つなら**同じ1本**である —— 二度数えると、
         画面に出す本数だけが水増しになる(数え方を2通り持たない) */
      const key = `${tier}|${solo}|${text}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ text, voiceId: solo, tier })
    }
  }
  return out
}

export function materialClipPieces(material) {
  const out = []
  for (const clip of materialAudioClips(material)) {
    /* **鳴らすときとまったく同じ分け方。** ここを書き写すと、
       別の場所の MP3 を探して「足りません」と言うことになる */
    const pieces = speakChunks(clip.text)
      .map((p) => ({ ...clip, text: p.text.trim() }))
      .filter((p) => p.text)
    if (!pieces.length) continue
    pieces.forEach((p, i) => {
      /* **段落の間は、最後のかけらのうしろにだけ置く。**
         途中に置くと、1つの段落の途中で話が切れて聞こえる */
      out.push({ ...p, gapMs: i === pieces.length - 1 ? clip.gapMs : PIECE_GAP_MS })
    })
  }
  return out
}
