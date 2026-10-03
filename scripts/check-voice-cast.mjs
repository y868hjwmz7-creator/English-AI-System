/**
 * 会話の「声と役の性別」が食い違わないことを、機械的に確かめる。
 *
 * 【なぜ要るか】(2026-09 利用者の指摘)
 *
 *   > 音声が女性なのに、会話の中では男性役だったり、その反対も
 *   > 起きています。これが再発しないようにしてください。
 *
 *   読み上げの声は **最初に話す人から順に** 当たる(`castClipSpeakers`)。
 *   ところが名前は AI が自由に付けていたので、
 *   **女性の声に Tom が乗る**ことがあった。
 *
 *   直し方は「**声に名前を合わせる**」である。作るときに
 *   「1人目は男性、2人目は女性」と窓口へ渡し、名前をそれに合わせさせる。
 *   逆(名前から性別を読んで声を当て直す)はしない —
 *   名前で性別は当てられないし、指名した声が無視されてしまう。
 *
 * 【この検証が見るもの】
 *   ① 声は**最初に話す人から順に**当たるか(`castClipSpeakers`)
 *   ② 画面が、**声の並びと同じ順で**性別を窓口へ渡しているか
 *   ③ 窓口が、それを受け取って**順番を入れ替えるなと言っている**か
 *   ④ 作るときの声と、保存する声が**同じ1つ**か
 *      (別々に選ぶと、伝えた性別と保存した声がずれる)
 *
 * ②〜④はソースを読んで確かめる。**API を呼ばないと分からないこと**
 * (実際に出来上がる名前)は確かめようがないが、
 * **こちらの側の食い違いは、ここで全部止まる。**
 */
import { readFileSync, readdirSync } from 'node:fs'
import {
  castClipSpeakers, castLine, castList, remakeModeOf, sameVoices,
} from '../src/lib/voiceCast.js'
import {
  ACCENT_KEEP, CLIP_VOICES, DEFAULT_READ_STYLE, READ_STYLES, V2, V3,
  baseVoiceOf, elevenIdOf, findVoice, plainVoiceId, readStyleLabel, readStyleOf,
  resolveVoices, styledVoiceId, voiceLabel, voiceModelOf, voiceRateOf,
  voiceSettingsOf, voicesOfAccent,
} from '../src/data/clipVoices.js'
import { wholeMark } from '../src/lib/wholeAudio.js'
import { SPEAK_MAX, speakChunks } from '../src/lib/speakChunks.js'
import { orderVoicesByNames } from '../src/lib/voiceOrder.js'
/* 名前から当てるほう(第5.255節)。**一覧の外の名前で測る**ために要る */
import { guessGender } from '../src/lib/voiceCast.js'

let bad = 0
const ok = (s) => console.log(`✓ ${s}`)
const ng = (s, d = '') => { bad += 1; console.log(`✗ ${s}${d ? `\n    ${d}` : ''}`) }

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// ── ① 声は「最初に話す人から順に」当たる ─────────────────────────
{
  const us = voicesOfAccent('us')
  const male = us.find((v) => v.gender === 'male')
  const female = us.find((v) => v.gender === 'female')
  if (!male || !female) {
    ng('検証に使える声がいない', '米(us)に男女が1人ずついる前提')
  } else {
    // 「1人目は男性、2人目は女性」と伝えて作られた会話のつもり
    const ids = [male.id, female.id]
    const speakers = [
      'Tom (Berth Operator)', 'Mika (Agent)',
      'Tom (Berth Operator)', 'Mika (Agent)',
    ]
    const cast = castClipSpeakers(speakers, ids)
    const first = cast.get('tom (berth operator)')
    const second = cast.get('mika (agent)')
    if (first !== male.id) ng('1人目が、1つめの声にならない', `${first} ≠ ${male.id}`)
    else if (second !== female.id) ng('2人目が、2つめの声にならない', `${second} ≠ ${female.id}`)
    else ok('声は、最初に話す人から順に当たる')

    // **途中から出てくる人も、出てきた順**である
    const late = castClipSpeakers(['A (x)', 'B (y)', 'C (z)'], [male.id, female.id, male.id])
    if (late.get('c (z)') !== male.id) ng('3人目の当てがずれている')
    else ok('3人目も、出てきた順に当たる')
  }
}

// ── ② 画面が、声の並びと同じ順で性別を渡しているか ────────────────
{
  const form = read('src/components/MaterialForm.jsx')
  if (!/speakerGenders/.test(form)) {
    ng('作るときに、話す人の性別を渡していない',
      '窓口は名前を自由に付けるので、渡さないと声と食い違う')
  } else ok('作るときに、話す人の性別を渡している')

  // **声の並びから作っているか。** 別のところから作ると順番がずれる
  if (!/castGenders\s*=\s*\(\)\s*=>\s*cast/.test(form)) {
    ng('性別を、声の並び(cast)から作っていない',
      '別に組み立てると、保存する声との順番がずれる')
  } else ok('性別は、声の並びからそのまま作っている')
}

// ── ④ 作るときの声と、保存する声が同じ1つか ─────────────────────
{
  const form = read('src/components/MaterialForm.jsx')
  if (/pickVoices\(/.test(form) && !/useMemo\(/.test(form)) {
    ng('声をその場で選び直している', 'おまかせは毎回混ざるので、1回だけ決める')
  }
  /* **保存する声は `cast` から1回だけ作り、支度にも同じものを渡す。**
     `cast` そのものではなく、出来上がった名前に合わせて並べ替えた
     `voiceIds` を保存する(⑨)。ただし**顔ぶれは `cast` のまま**なので、
     「作るときに伝えた性別と、保存する声がずれない」という
     この検証の役目は変わっていない。
     見るのは「1回だけ作って、2か所へ同じものを渡しているか」である。

     **第5.196節で1段はさまった。** 並べ替えた `orderedCast()` に
     読み方(訛り / 感情)を付けたものが `styledCast()` で、
     保存するのはそちら。**顔ぶれも並びも変わらない**ので、
     この検証の役目は変わらない —— 見る名前だけを付け替える。
     **2段とも見る**(片方だけだと、途中で読み方が落ちても緑になる) */
  const once = /const voiceIds = styledCast\(\)/.test(form)
    && /const styledCast = \(\) => orderedCast\(\)/.test(form)
  const saved = /\n\s*voiceIds,\n/.test(form)
  const prepared = /voiceIds,\s*tags:/.test(form)
  if (/voiceIds:\s*cast\b/.test(form)) {
    ng('保存する声を、並べ替える前のまま渡している',
      '出来上がった名前に合わせた voiceIds を渡すこと(⑨)')
  } else if (!once) {
    ng('保存する声を、1回だけ決めていない',
      '作るときと支度で別々に作ると、食い違う')
  } else if (!saved || !prepared) {
    ng('作るときと支度で、同じ声を渡していない',
      `保存 ${saved} / 支度 ${prepared}`)
  } else ok('保存する声は、1回だけ決めて、支度にも同じものを渡している')
  // **見張りに `voicePool` を入れない**(描き直すたびに別の配列になる)
  const memo = form.match(/const cast = useMemo\([\s\S]*?\}, \[([^\]]*)\]\)/)
  if (!memo) ng('`cast` が useMemo で決まっていない')
  else if (/voicePool/.test(memo[1])) {
    ng('`cast` の見張りに voicePool が入っている',
      'filter の返り値なので毎回別物になり、そのたびに声を引き直す')
  } else ok(`\`cast\` は1回だけ決まる(見張り: ${memo[1].trim()})`)
}

// ── ③ 窓口が受け取って、順番を守らせているか ─────────────────────
{
  const fn = read('supabase/functions/generate-material/index.ts')
  if (!/body\.speakerGenders/.test(fn)) ng('窓口が、話す人の性別を読んでいない')
  else ok('窓口は、話す人の性別を読んでいる')
  /* **窓口が古いと、この指定は黙って捨てられる**(2026-09 実機)。
     しかも教材は普通にできあがるので、誰も気づけない。
     だから版を返させ、画面が見比べて知らせる(`speak` と同じ作法)。 */
  if (!/const FN_REV = /.test(fn)) {
    ng('生成の窓口が版を持っていない', '古いまま置かれていても気づけない')
  } else if (!/genRev: FN_REV/.test(fn)) {
    ng('生成の窓口が版を返していない')
  } else ok('生成の窓口は、どの応答にも版を付ける')

  {
    const mats = readFileSync(new URL('../src/lib/materials.js', import.meta.url), 'utf8')
    const form2 = readFileSync(new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    if (!/noteGenRev\(data\?\.genRev\)/.test(mats)) ng('画面が、生成の窓口の版を読んでいない')
    else if (!/export const genGatewayStale = /.test(mats)) ng('版を見比べていない')
    else if (!/genGatewayNote\(\)/.test(form2)) {
      ng('古いことを画面に出していない', '出さないと、誰も気づけない')
    } else ok('古い窓口は、教材を作った場所で知らせる')

    /* **性別の並びを崩さない。** `filter` で落とすと、名簿に無い声が
       1つ混じるだけで配列が縮み、2人目以降がずれる */
    if (/castGenders = \(\) => cast[\s\S]{0,200}?\.filter\(/.test(form2)) {
      ng('性別の一覧を filter で縮めている', '2人目以降がずれる')
    } else ok('性別の一覧は、声の数だけ並ぶ(縮めない)')
  }
  if (!/最初に話す人から順に/.test(fn)) {
    ng('窓口が「最初に話す人から順に」と言っていない',
      '声はその順で当たるので、順番を決めないと意味がない')
  } else ok('窓口は「最初に話す人から順に」と言っている')
  if (!/入れ替えない/.test(fn)) {
    ng('窓口が「順番を入れ替えるな」と言っていない')
  } else ok('窓口は「順番を入れ替えるな」と言っている')
  /* **書いてあるだけでは足りない。指示に入っているか**を見る。
     はじめはここを見ておらず、`+ genderLine` を外しても
     緑のままだった(**検証そのものを試して見つけた**)。
     定義だけ残って使われない、はよくある壊れ方である */
  if (!/\+\s*genderLine/.test(fn)) {
    ng('性別の指示が、頼み文に入っていない',
      '`genderLine` を作っただけで、登場人物の指示に足していない')
  } else ok('性別の指示は、頼み文に入っている')
}

/* ============================================================================
 * **名簿から声が消えていないこと**(2026-09。実際に落とした)
 *
 *   Sophie を足すときに、**そのすぐ上にいた Caroline を消してしまった。**
 *   `npm run lint` も `npm run build` も通り、**画面を開いても
 *   「1人少ない」だけ**なので、誰も気づけない。
 *
 *   > 一度入れた業種や趣味は勝手に減らさないでください。
 *   > 一度追加した要素は指示がない限りは勝手に変更を加えないでください。
 *   > これはプロジェクトを超えたルールです。(2026-09 利用者の指定)
 *
 *   声もまったく同じである。しかも消すと**その声で作った教材の
 *   話す人に声が当たらなくなる**ので、害は業種より大きい。
 *
 * 【だから、id を控えておく】
 *   ここに並べた id が1つでも名簿から消えたら赤くなる。
 *   **足したときは、ここにも書き足すことになる** ——
 *   そのぶん、必ず1回は自分の目で数えることになる(`test:bar` の `WANT` と同じ)。
 *
 *   **消してよいのは、利用者が「消して」と言ったときだけ。**
 *   そのときはこの一覧からも消す(`retired` は消すことではない。
 *   選択肢から外すだけなので、id は名簿に残る)。
 */
{
  const KNOWN = [
    'us-1', 'us-2', 'us-3', 'us-4', 'us-5', 'us-6', 'us-7',
    'uk-1', 'uk-2', 'uk-3', 'uk-4',
    'au-1', 'au-2', 'au-3', 'au-4', 'au-5', 'au-6', 'au-7', 'au-8',
    'au-9', 'au-10', 'au-11', 'au-12',
    'sc-1', 'sc-2', 'sc-3', 'sc-4', 'sc-5',
    'sc-6', 'sc-7', 'sc-8', 'sc-9', 'sc-10',
    /* **訳を読むためだけの声**(2026-09 利用者の指定
       「日本語の声のIDです Shohei (male) ID …」)。
       **英語の声ではない** —— `CLIP_ACCENTS` に `ja` を足していないので、
       教材の声を選ぶ画面にはどこにも出ない(`npm run test:play` が見張る)。
       ここに足すのは「名簿から勝手に消えていないか」を数えるためである */
    'ja-1',
  ]
  const gone = KNOWN.filter((id) => !findVoice(id))
  if (gone.length) {
    ng(`名簿から声が消えている: ${gone.join(' / ')}`,
      '一度入れた声を勝手に減らさない。その声で作った教材の話す人に、声が当たらなくなる')
  } else ok(`控えてある ${KNOWN.length} 人は、全員まだ名簿にいる`)

  const added = CLIP_VOICES.filter((v) => !KNOWN.includes(v.id))
  if (added.length) {
    ng(`名簿に足した声が、控えに入っていない: ${added.map((v) => v.id).join(' / ')}`,
      'scripts/check-voice-cast.mjs の KNOWN にも足すこと(数え直す機会になる)')
  }
}

// ── 名簿そのもの ──────────────────────────────────────────────
{
  const noGender = CLIP_VOICES.filter((v) => v.gender !== 'male' && v.gender !== 'female')
  if (noGender.length) {
    ng('性別の分からない声がいる', noGender.map((v) => v.id).join(' / '))
  } else ok(`名簿の ${CLIP_VOICES.length} 人は、全員に性別がある`)
  const broken = CLIP_VOICES.filter((v) => findVoice(v.id)?.id !== v.id)
  if (broken.length) ng('名簿の id が引けない', broken.map((v) => v.id).join(' / '))
}

// ── もう使わない声(2026-09 利用者の指定)─────────────────────────
//
//    > この「クラスに出る」の Mika 役の声を今後使用しないように
//    > 変更を加えてください。この人の時だけ発言の終わりに必ず
//    > ノイズが入ります。
//
//    外した声が **①これから選ばれないこと** と
//    **②すでに作った教材からは引けること** の両方を確かめる。
//    行ごと消すと②が壊れ、その声で作った会話の話す人に声が当たらなくなる。
{
  const retired = CLIP_VOICES.filter((v) => v.retired)
  for (const v of retired) {
    if (voicesOfAccent(v.accent).some((x) => x.id === v.id)) {
      ng(`外した声が、まだ選択肢に出る(${v.label})`, '`voicesOfAccent` から外れていない')
    }
    if (!findVoice(v.id)) {
      ng(`外した声が、引けなくなっている(${v.label})`,
        '行ごと消してはいけない。その声で作った教材の話す人に、声が当たらなくなる')
    }
  }
  if (!retired.length) ok('いま「使わない」にしている声は無い')
  else ok(`使わない声 ${retired.length} 人 … 選択肢から外れ、引くことはできる`)

  /* **仕組みそのものが効くか**を、その場で試す。
     名簿が全員現役でも、外す道が壊れていないことを確かめる */
  const probe = CLIP_VOICES.find((v) => !v.retired)
  if (probe) {
    const was = probe.retired
    probe.retired = true
    const gone = !voicesOfAccent(probe.accent).some((x) => x.id === probe.id)
    const still = Boolean(findVoice(probe.id))
    probe.retired = was
    if (!gone) ng('`retired` を付けても、選択肢から外れない')
    else if (!still) ng('`retired` を付けると、引けなくなる')
    else ok('`retired` を付ければ、選択肢から外れて、引くことはできる')
  }
}

// ── どの声かを知る道(2026-09 実機・利用者の指摘)──────────────────
//
//    > Mikaの音声が誰なのか確認できません
//
//    声に癖があることは**聞いた人にしか分からない**ので、
//    「あの声を外して」と言うには**名前が見えていなければならない。**
//    ところが `voice_ids` が空のときに何も出さないようにしていたため、
//    **鳴っているのに名前だけが出ない**状態になっていた。
//    空でも音は鳴る(`resolveVoices()` が代役に落とす)。
{
  const material = (voiceIds) => ({
    voiceIds,
    sections: [{
      exercise_type: 'dialogue',
      items: [
        { speaker: 'Mika (Coach)', prompt_en: 'Line one.' },
        { speaker: 'Kenji', prompt_en: 'Line two.' },
        { speaker: 'Mika (Coach)', prompt_en: 'Line three.' },
      ],
    }],
  })

  const us = voicesOfAccent('us')
  const line = castLine(material([us[0].id, us[1].id]))
  if (!line) ng('声を選んだ会話で、読み上げの行が出ない')
  else if (!line.includes(`Mika = ${us[0].label}`)) {
    ng('1人目に、1つめの声が出ていない', line)
  } else if (!line.includes(`Kenji = ${us[1].label}`)) {
    ng('2人目に、2つめの声が出ていない', line)
  } else ok(`読み上げの行 … ${line}`)

  /* **声を選んでいない教材でも出す。** ここが 2026-09 の実機で
     「確認できません」と言われたところである。**鳴るなら、名前が出る** */
  for (const empty of [[], null, undefined]) {
    const l = castLine(material(empty))
    if (!l) {
      ng('声を選んでいない会話で、読み上げの行が出ない',
        '空でも代役の声が鳴る。鳴るなら名前が出ないといけない')
      break
    }
    if (/\bus-female\b|\buk-male\b/.test(l)) {
      ng('代役の声が、id のまま出ている', `${l}\n    「標準の声(アメリカ・女性)」と読める形にする`)
      break
    }
  }
  if (castLine(material([])) && !/\bus-female\b/.test(castLine(material([])))) {
    ok(`声を選んでいない会話でも出る … ${castLine(material([]))}`)
  }

  // **話す人がいない教材では出さない**(効かない行を見せない)
  if (castLine({ voiceIds: [], sections: [{ exercise_type: 'reading', items: [{}] }] })) {
    ng('記事にまで、読み上げの行が出ている')
  } else ok('記事(話す人がいない教材)には出さない')

  // **1人ずつに分けて取り出せるか**(3人・4人の会議では、
  // つないだ1本の棒では読み取れない)
  const list = castList(material([us[0].id, us[1].id]))
  if (list?.length !== 2) ng('`castList()` が話す人ぶん返っていない')
  else if (list[0].speaker !== 'Mika' || !list[0].label.startsWith(us[0].label)) {
    ng('`castList()` の中身がずれている', JSON.stringify(list[0]))
  } else ok('`castList()` は、話す人ごとに1つずつ返す')

  /* **札は「読み上げの声」1つ**(`CastChip.jsx`)。
     さがす画面のカードと、レッスン表示の紙の**両方**に出る
     (2026-09 利用者の指定「各教材のトップに」)。
     **書き写すと、必ずどちらかだけ古くなる** */
  const chip = read('src/components/CastChip.jsx')
  if (!/castList\(/.test(chip)) ng('札が `castList()` を使っていない')
  else if (!/no-print/.test(chip)) {
    ng('札が紙に刷られてしまう', '記事・会話の紙は「書き込むための用紙」(仕様書 5.70)')
  } else ok('札は `castList()` を使い、紙には刷らない')

  for (const [where, file] of [
    ['さがす画面のカード', 'src/components/TrainerMaterials.jsx'],
    ['レッスン表示の紙', 'src/components/LessonView.jsx'],
  ]) {
    const src = read(file)
    if (!/<CastChip\b/.test(src)) ng(`${where}に、読み上げの声の札が無い`)
    else if (/castClipSpeakers\(\s*\[?names/.test(src)) {
      ng(`${where}が、当て方を自分で数え直している`,
        '`CastChip` に任せる。数え直すと、出す名前と鳴る声がずれる')
    } else ok(`${where} … 読み上げの声の札がある`)
  }
}

// ── 音声を作り直すときの「走る道」(2026-09 利用者の指定)──────────
//
//    > 音声を作り直す際も、国とスピーカーを選択できるようにしてください。
//    > そして、元あるものも残せるようにしたいです。
//    > つまり同じ内容の教材を違うアクセントに作り直すことが出来る仕様です。
//
//    **押したボタンと、実際に起きることが食い違ってはいけない。**
//    しかも間違えると**そのまま課金になる**ので、ここで止める。
{
  const cases = [
    ['声を変えていない → 教材に手を触れない',
      { same: true, mode: 'copy', mine: true }, 'refresh'],
    ['声を変えていない(人の教材でも同じ)',
      { same: true, mode: 'replace', mine: false }, 'refresh'],
    ['声を変えた → 既定は複製(もとが残る)',
      { same: false, mode: 'copy', mine: true }, 'copy'],
    ['声を変えて「入れ替える」を選んだ',
      { same: false, mode: 'replace', mine: true }, 'replace'],
    ['人の教材では、入れ替えを選んでも複製になる',
      { same: false, mode: 'replace', mine: false }, 'copy'],
  ]
  let bad2 = 0
  for (const [what, input, want] of cases) {
    const got = remakeModeOf(input)
    if (got !== want) { ng(`${what}(${want} のはずが ${got})`); bad2 += 1 }
  }
  if (!bad2) ok(`作り直しの道は、${cases.length} とおりとも意図どおり`)

  // **同じかどうかは、並びまで見る**(順が違えば当たる声が変わる)
  if (!sameVoices(['a', 'b'], ['a', 'b'])) ng('同じ並びを「違う」と言っている')
  else if (sameVoices(['a', 'b'], ['b', 'a'])) {
    ng('並びが違うのに「同じ」と言っている', '順が変わると、当たる声が入れ替わる')
  } else if (sameVoices(['a'], ['a', 'b'])) ng('数が違うのに「同じ」と言っている')
  else ok('いまの声と同じかどうかは、並びまで見る')

  /* **判断を画面に持たせない。** 出しているボタンと走る道が食い違うと、
     押した本人には**何が起きたのか分からない**まま課金される */
  const vr = read('src/components/VoiceRemake.jsx')
  const vrCode = vr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  if (!/remakeModeOf\(/.test(vr)) {
    ng('画面が、走る道を自分で決めている', '`remakeModeOf()` 1か所に任せる')
  } else ok('画面は `remakeModeOf()` に任せている')
  // **押す前に、本数と課金になることを書く**(見えない費用は管理できない)
  /* **本数だけでは足りない**(2026-09 実機)。
       > え? 作り直してません。長くてお金がかかるので
     **ElevenLabs の課金は文字数**なので、そちらを必ず並べて出す
     (見えない費用は管理できない・CLAUDE.md) */
  if (!/課金/.test(vr) || !/clipCount/.test(vr)) {
    ng('作り直す本数と、課金になることを書いていない')
  /* **コメントと props の名前に当たらないよう、出している形で見る。**
     はじめ `/clipChars/` と `/文字/` で探していたので、**画面に出す行を
     丸ごと消しても緑のまま**だった(説明にも props にも同じ語がある) */
  } else if (!/\{clipChars\.toLocaleString\(\)\}\s*文字/.test(vrCode)) {
    ng('押す前に、何文字ぶんかを出していない',
      'ElevenLabs の課金は文字数。本数だけでは高いか安いか判断できない')
  } else ok('押す前に、本数・文字数・課金になることが書いてある')

  // **画面が数え直していないか**(出した数と、実際に作る数が食い違う)
  const tm = read('src/components/TrainerMaterials.jsx')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  if (!/clipChars=\{remakeSizeOf\(/.test(tm)) {
    ng('画面が文字数を自分で数えている', '`remakeSizeOf()` 1か所に任せる')
  } else ok('文字数は `remakeSizeOf()` 1か所が数えている')

  /* ── **作り直すのは、鳴らすのとまったく同じ英文**(2026-09 実機)──────
   *
   *   > 長いSpeech練習は直っていませんでした。ずれ方としては、
   *   > 音に対してハイライトがどんどん遅れていきます。
   *
   * 読み上げは `speakChunks()` で**かけらに分けてから**窓口へ渡すので、
   * MP3 の置き場所は**かけらの指紋**で決まる。作り直しが段落まるごとで
   * 作ると、**誰も鳴らさない場所**に置いて課金し、
   * **鳴らすほうは永久に作り直されない**(= 時刻の控えもできない)。
   *
   * **音は鳴る**ので、これは押してみても気づけない。 */
  /* **コメントを落としてから見る。** この節の説明にも `speakChunks()` と
     書いてあるので、そのまま探すと**呼び出しを外しても緑のまま**になる
     (「名前が出てくるか」で見ない・CLAUDE.md。実際に一度そうなった) */
  const rc = read('src/lib/remakeClips.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  if (!/of speakChunks\(/.test(rc) || !/from '\.\/speakChunks\.js'/.test(rc)) {
    ng('作り直しが、鳴らすときと違う英文で作っている',
      '`speakChunks()` を通す —— 長い段落は、かけらごとに置かれている')
  } else ok('作り直しは、鳴らすときと同じ `speakChunks()` を通している')

  // 分けなければ意味が変わることを、実物で確かめておく
  const one = 'This is a plain sentence. '
  const long = one.repeat(Math.ceil((SPEAK_MAX + 400) / one.length)).trim()
  const pieces = speakChunks(long)
  if (pieces.length < 2) {
    ng('長い段落が、かけらに分かれていない', `${long.length} 文字で ${pieces.length} 個`)
  } else if (pieces[0].text === long) {
    ng('かけらが、段落まるごとと同じ英文になっている')
  } else ok(`長い段落は ${pieces.length} 個のかけらになる(置き場所が別々になる)`)

  // **ふつうの段落は、1本も変わらない**(AI が書く段落は 300 文字ほど)
  const short = 'The team met on Tuesday. Sales grew twelve percent. Nobody expected it.'
  const only = speakChunks(short)
  if (only.length !== 1 || only[0].text !== short) {
    ng('ふつうの長さの段落まで分けている', 'これまでの教材が、まるごと作り直しになる')
  } else ok('ふつうの長さの段落は、これまでと1文字も変わらない')
}

/* ══════════════════════════════════════════════════════════════════
 * **作り直しは、いま鳴っている音を作り直す**(2026-09 実機・13手め)
 *
 *   > 同じ声で作り直しましたが何も変わりません
 *
 * **変わらなくて当然だった。** 作り直していたのは**発言ごとの MP3 だけ**で、
 * **いま実際に鳴っている「1本にまとめた音声」を一度も触っていなかった。**
 * 本文の読み上げは「1本にまとめる」に統一されている(利用者の指定)ので、
 * **聴いている音は、ほぼいつもそちらである。**
 *
 * つまり利用者は**課金だけして、音が1ミリも変わらない**状態だった。
 * **`speakChunks` を通していなかったのと、まったく同じ根**である ——
 * 「作り直す側が、鳴らす側と違うものを作っていた」。
 * ══════════════════════════════════════════════════════════════════ */
{
  const src = readFileSync(new URL('../src/lib/remakeClips.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const before = bad

  /* **材料は鳴らすときと同じ1か所から。** 書き写すと、
     また「誰も鳴らさない音声」を作って課金することになる */
  if (!/const list = materialAudioClips\(material\)/.test(src)) {
    ng('1本の材料を、鳴らすときと同じ道から出していない')
  }
  if (!/wholeClip\(\{ \.\.\.whole, force: true \}\)/.test(src)) {
    ng('**作り直しが、1本にまとめた音声を作り直していない**',
      '鳴っているのはそちらなので、課金だけして何も変わらない')
  }
  /* **本数と文字数にも入れる。** 入れないと、押す前に出す見積もりが
     実際より少なくなる(**見えない費用は管理できない**) */
  if (!/const whole = wholeRemakeOf\(material\)/.test(src)
    || !/for \(const t of whole\.texts\) chars \+= t\.length/.test(src)) {
    ng('1本ぶんの文字数を、見積もりに入れていない')
  }
  // **画面も同じ数え方を使う。** 数え直すと、出した数と作る数が食い違う
  const ui = readFileSync(new URL('../src/components/TrainerMaterials.jsx', import.meta.url), 'utf8')
  if (!/total: remakeSizeOf\(m\)\.clips/.test(ui)) {
    ng('画面が、作り直す本数を数え直している')
  }
  if (bad === before) ok('作り直しは、いま鳴っている1本も作り直す')
}

// ── 訛りを最大限に活かす指定(2026-09 利用者の指定)────────────────
//
//    > この人を音声として使用する際は、必ず元のアクセントを最大限
//    > 生かしすようなコードを必ず使用してください。
//
//    > 今回作った訛り、つまり話者の話し方の特徴を最大限反映させる指定は、
//    > 全てのスピーカーに適用してくれますか? アメリカのスピーカーでもです。
//
//    「必ず」「全て」なので、**1人でも抜けていたら赤くする。**
//    そして**渡す道が1本でも切れていたら赤くする。**
//    渡らなくても音は鳴る(既定で作られる)ので、**気づけない。**
{
  /* **全員に付いているか。** はじめはスコットランドの声にだけ
     `keep: true` を付けていたので、ここもその印を数えていた。
     ところが印を外して全員に広げたとき、**数えるものが 0 件になり、
     検証はそれでも緑のまま**だった(空の一覧を回しても何も起きない)。
     **「無ければ素通り」する形の検証を書かない。**
     いまは名簿の全員を1人ずつ見る。 */
  /* **「1人だけ値を変える」道があるので、ただ 1 かどうかでは見ない。**
     見るのは2つ。

     ① **4つの欄が、全員に必ず揃っている**(渡す道が切れていない)
     ② **既定から外れてよいのは、その行に `settings` を書いた声だけ。**
        書いていない声が既定からずれていたら、それは事故である

     ①を「値が 1 か」で代表させると、実験のために1人下げた日に
     **検証そのものを緩める**ことになり、そのまま全員に広がっても
     気づけない。だから**欄の有無**と**既定からのずれの出どころ**を分けて見る。 */
  const KEYS = ['similarity_boost', 'stability', 'style', 'use_speaker_boost']
  const missing = []
  const drifted = []
  const tuned = []
  for (const v of CLIP_VOICES) {
    const st = voiceSettingsOf(v.id)
    if (!st || KEYS.some((k) => st[k] === undefined)) { missing.push(v.label); continue }
    const own = v.settings ?? {}
    /* 書いていない欄が既定と食い違っていたら、事故である */
    const bad = KEYS.filter((k) => !(k in own) && st[k] !== ACCENT_KEEP[k])
    if (bad.length) drifted.push(`${v.label}(${bad.join(' / ')})`)
    const named = KEYS.filter((k) => k in own)
    if (named.length) tuned.push(`${v.label}: ${named.map((k) => `${k}=${st[k]}`).join(' ')}`)
  }
  if (missing.length) {
    ng('訛りを活かす指定が付いていない声がいる', missing.join(' / '))
  } else if (drifted.length) {
    ng('名簿に書いていないのに、既定からずれている声がいる',
      `${drifted.join(' / ')}\n    1人だけ変えるなら、その行に settings を書く`)
  } else {
    ok(`名簿の ${CLIP_VOICES.length} 人**全員**に、4つの欄がそろって付いている`)
    /* **変えた声は必ず名前を出す。** 黙って効いていると、
       あとから「なぜこの声だけ音が違うのか」をたどれない */
    if (tuned.length) ok(`このうち値を変えてあるのは … ${tuned.join(' / ')}`)
  }

  /* ══════════════════════════════════════════════════════════════
     **「訛りを活かす」の `stability` は 0.35**
     (第5.258節・2026-09-25 実機・利用者の聴き比べ)

       > 訛りの設定を訛りを活かすにした時の訛り方が以前よりも弱いです。
       > …… Mark の訛りが非常に良かったのに、今は普通のイギリス人くらい
       > きれいな発音になってしまっています。比較して「訛りを活かす」に
       > ついては**全てのスピーカーに対して以前の設定に直してください。**

     【なぜ、値そのものを書き写しているのか】
       ふだんは**値を書き写さない。性質で見る**(CLAUDE.md)。
       ここだけは違う —— **この値は、性質から導いたものではない。**
       第5.192節では ElevenLabs の呼び名から推して 0.5(Natural)にしたが、
       **利用者が実際に聴き比べて、0.35 のほうが訛りが濃いと分かった。**
       **選んだのは耳であって、理屈ではない。** だから値で留める。

     【いちばん危ないのは「3つに揃えてあげる」ことである】
       v3 が受け取るのは 0 / 0.5 / 1 の3つだと言われている。
       0.35 はそのどれでもないので、**次に読んだ人が「書き間違いだ」と
       思って 0.5 に直す**ことが起こりうる。**実際、それをやった**
       のが第5.192節である。ここで止める。
     ══════════════════════════════════════════════════════════════ */
  {
    const V3_OK = [0, 0.5, 1]
    const fn = readFileSync(
      new URL('../supabase/functions/speak/index.ts', import.meta.url), 'utf8')
    const m = fn.match(/const V3_STABILITY = \[([^\]]*)\]/)
    const 窓口 = m ? m[1].split(',').map((x) => Number(x.trim())) : []
    if (String(窓口) !== String(V3_OK)) {
      ng('窓口が受け取る stability の3つが、見張りと食い違っている',
        `窓口 ${窓口} / ここ ${V3_OK}`)
    } else if (Number(ACCENT_KEEP.stability) !== 0.35) {
      ng('「訛りを活かす」の stability が 0.35 になっていない',
        `いま ${ACCENT_KEEP.stability}。**3つ(0 / 0.5 / 1)のどれでもないのは`
        + 'わざとである** —— 2026-09-25 に利用者が聴き比べて決めた値。'
        + '\n    0.5 に「直す」と、訛りがまた薄くなる(第5.192節で実際に起きた)')
    } else {
      ok('「訛りを活かす」の stability は 0.35 —— 実機で訛りがいちばん濃かった値')
    }

    /* ── **窓口が、送る前に丸めていないか**(第5.258節)────────────
         0.35 が生きているのは、窓口が**頼まれたまま**を1段目に置いて
         いるからである。送る前に 0.5 へ寄せる形に変わったら、
         名簿を 0.35 にしても**意味が無くなる**(しかも音は鳴るので、
         聴いた人にしか分からない)。

         **「名前が出てくるか」で見ない**(CLAUDE.md)—— 説明の中にも
         `snapStability` と書いてあるので、**1段目に何を積んでいるか**で見る。 */
    const 梯子 = fn.match(
      /const tries[^=]*=\s*\[\s*\n?\s*\{ model, settings, why: '頼まれたまま' \}/)
    if (!梯子) {
      ng('窓口の1段目が「頼まれたまま」ではない',
        '送る前に stability を丸めると、名簿の 0.35 が届かない(第5.258節)')
    } else if (!/if \(isV3\(model\) && settings && typeof settings\.stability/.test(fn)) {
      ng('窓口が、断られたときに寄せる受け皿を持っていない',
        '3つのどれでもない値を送るので、断られたときの道が要る')
    } else {
      ok('窓口は先回りして丸めない —— 1段目は「頼まれたまま」、寄せるのは断られたときだけ')
    }
  }

  /* ── **読み方(訛り / 感情)を、都度えらべる**(第5.196節)────────
   *
   *   > 発音について、訛りと感情どちらを重視するか都度指定させてください。
   *
   * 読み方は、**声の id の後ろに `-emo` を付けて持ち回る。**
   * だから見るのは次の4つで、**どれか1つでも欠けると黙って壊れる。**
   *
   *   ① 名簿の id が、その印とぶつかっていないか
   *   ② 付ける / 外すが、往復して元に戻るか。**既定の側は素のまま**か
   *   ③ 名簿を引く仕組みが、読み方を素通りするか
   *      (ここが抜けると、その声の**名前も Voice ID も引けなくなる**)
   *   ④ 置き場所が**本当に別になる**か
   *      (ここが抜けると、2つの読み方が**同じファイルを取り合う**)
   */
  {
    const TAIL = '-emo'
    const clash = CLIP_VOICES.filter((v) => v.id.endsWith(TAIL))
    if (clash.length) {
      ng(`名簿の id が「${TAIL}」で終わっている`,
        `${clash.map((v) => v.id).join(' / ')}\n    読み方の印とぶつかる。id を変える`)
    } else ok(`名簿の ${CLIP_VOICES.length} 人とも、id が読み方の印とぶつかっていない`)

    /* **一覧を勝手に減らさない。** 片方しか無ければ「都度えらぶ」が成り立たない */
    const styleIds = READ_STYLES.map((st) => st.id)
    if (!styleIds.includes('accent') || !styleIds.includes('emotion')) {
      ng('読み方が2つそろっていない', `いま ${styleIds.join(' / ')}`)
    } else if (!READ_STYLES.every((st) => st.label && st.hint)) {
      ng('読み方に、画面に出す名前かひとことが無い')
    } else if (DEFAULT_READ_STYLE !== 'accent') {
      /* **既定は「訛りを活かす」。** ここが感情の側に倒れると、
         何も指定していない古い教材まで読み方が変わったことになる */
      ng('既定の読み方が「訛りを活かす」ではない', `いま ${DEFAULT_READ_STYLE}`)
    } else ok(`読み方は ${READ_STYLES.map((st) => st.label).join(' / ')} の2つ`)

    /* **選択肢の文に、失うほうも書いてあるか**(第5.192節で踏んだところ)。
       「感情が豊かになる」しか言わないと、**訛りが薄れることを黙って
       変えた**ことになる。**つまみが2つの意味を持つなら、両方を言う** */
    const noLoss = READ_STYLES.filter((st) => !st.hint.includes('訛り'))
    if (noLoss.length) {
      ng('読み方のひとことに「訛り」がどうなるかが書いていない',
        `${noLoss.map((st) => `${st.label}「${st.hint}」`).join(' / ')}`)
    } else ok('読み方のひとことは、どちらも「訛り」がどうなるかを書いている')

    const probe = CLIP_VOICES.find((v) => v.elevenId) ?? CLIP_VOICES[0]
    const emo = styledVoiceId(probe.id, 'emotion')
    const plain = styledVoiceId(probe.id, 'accent')

    /* ② 往復。**既定の側は素の id のまま**でなければならない ——
       ここが変わると、**すでに作ってある音声が全部作り直しになる**(課金) */
    if (plain !== probe.id) {
      ng('既定の読み方で、声の id が変わってしまう',
        `${probe.id} → ${plain}。すでに作った音声が全部作り直しになる`)
    } else if (emo === probe.id) {
      ng('感情の側でも、声の id が変わらない', '置き場所が分かれず、同じ音が返る')
    } else if (plainVoiceId(emo) !== probe.id) {
      ng('読み方を外すと、元の id に戻らない', `${emo} → ${plainVoiceId(emo)}`)
    } else if (readStyleOf(emo) !== 'emotion' || readStyleOf(plain) !== 'accent') {
      ng('id から読み方を読み取れない',
        `${emo} → ${readStyleOf(emo)} / ${plain} → ${readStyleOf(plain)}`)
    } else ok(`読み方は id で持ち回る … ${plain} / ${emo}(往復して戻る)`)

    /* **両方見る。** 片方だけだと、**どちらでも同じ値を返す形**に
       書き換えても緑のままになる(CLAUDE.md「出ると出ないの両方を見る」) */
    const stEmo = Number(voiceSettingsOf(emo).stability)
    const stPlain = Number(voiceSettingsOf(plain).stability)
    if (stEmo === stPlain) {
      ng('読み方を変えても stability が動かない', `どちらも ${stEmo}`)
    } else if (stPlain !== Number(ACCENT_KEEP.stability)) {
      ng('訛りの側が、既定(ACCENT_KEEP)と違う値になっている',
        `${stPlain} / 既定 ${ACCENT_KEEP.stability}`)
    } else if (stEmo !== 0) {
      ng('感情の側が Creative(0)になっていない', `いま ${stEmo}`)
    } else ok(`読み方で stability が変わる … 訛り ${stPlain} / 感情 ${stEmo}`)

    /* ③ 名簿を引く仕組みが、読み方を素通りするか。
       **1つでも抜けると、その声だけ名前が出ない・Voice ID が引けない
       (= 1本にまとめられない)・速さの補正が効かない**、と別々に壊れる */
    const through = [
      ['名簿の行', findVoice(emo)?.id, findVoice(probe.id)?.id],
      ['Voice ID', elevenIdOf(emo), elevenIdOf(probe.id)],
      ['モデル', voiceModelOf(emo), voiceModelOf(probe.id)],
      ['速さ', voiceRateOf(emo), voiceRateOf(probe.id)],
      ['画面に出す名前', voiceLabel(emo), voiceLabel(probe.id)],
      ['標準の段の代役', baseVoiceOf(emo), baseVoiceOf(probe.id)],
    ].filter(([, a, b]) => a !== b)
    if (through.length) {
      ng('読み方を付けると、名簿から引けなくなるものがある',
        through.map(([k, a, b]) => `${k}: ${a} ≠ ${b}`).join(' / '))
    } else ok('読み方を付けても、名前・Voice ID・モデル・速さ・代役は同じ')

    /* ④ 置き場所。**良い段では分かれ、標準の段では分かれない。**
       ・分かれないと、2つの読み方が同じファイルを取り合う
       ・標準の段(Google / Azure)に stability は無いので、
         そちらまで分けると**同じ音を二度作って二度課金される** */
    if (baseVoiceOf(emo) !== baseVoiceOf(probe.id)) {
      ng('標準の段の置き場所まで分かれている', '同じ音を二度作って二度課金される')
    } else ok('標準の段では分かれない(同じ音なので、作り直さない)')

    /* **教材に保存した id が、そのまま鳴らす側へ届くか。**
       画面はどこも `resolveVoices(m.voiceIds)[0]` で取り出している。
       ここで落とされたり素の id に戻されたりすると、
       **保存はできているのに、鳴る音だけが既定に戻る**(いちばん気づけない) */
    const kept = resolveVoices([emo])
    if (kept[0] !== emo) {
      ng('教材に保存した読み方が、鳴らす側へ届かない', `${emo} → ${kept[0]}`)
    } else ok('教材に保存した読み方は、そのまま鳴らす側へ届く')

    const seat = castClipSpeakers(['Mika', 'Ken'], [emo, styledVoiceId(
      CLIP_VOICES.find((v) => v.id !== probe.id)?.id, 'emotion')])
    if ([...seat.values()].some((id) => readStyleOf(id) !== 'emotion')) {
      ng('会話の役に配ると、読み方が落ちる', [...seat.values()].join(' / '))
    } else ok('会話の役に配っても、読み方は落ちない')

    /* **1本にまとめた音声も分かれるか。** あちらは別の鍵(`wholeMark`)を
       持っているので、**ここを見ないと片方だけ取り違えたまま気づけない** */
    const w1 = wholeMark([emo, emo], ['Hello.', 'Bye.'])
    const w2 = wholeMark([probe.id, probe.id], ['Hello.', 'Bye.'])
    if (w1 === w2) {
      ng('1本にまとめた音声が、読み方で分かれない', '同じファイルを取り合う')
    } else ok('1本にまとめた音声も、読み方で分かれる')

    /* 画面に出す名前。**知らない id でも黙って落ちない** */
    if (readStyleLabel('emotion') === readStyleLabel('accent')) {
      ng('読み方の名前が、2つとも同じになっている')
    } else if (readStyleLabel('') !== readStyleLabel(DEFAULT_READ_STYLE)) {
      ng('知らない読み方に、名前が付かない')
    } else ok(`読み方の名前が出る … ${readStyleLabel('accent')} / ${readStyleLabel('emotion')}`)

    /* **えらんだものが、保存する id に本当に付いているか。**
       画面の側で付け忘れると、**選べるのに何も変わらない**
       (CLAUDE.md「何も変わらないは、届いていないという意味である」) */
    for (const [file, why] of [
      ['src/components/MaterialForm.jsx', '教材を作るとき'],
      ['src/components/VoiceRemake.jsx', '音声を作り直すとき'],
    ]) {
      const src = read(file).replace(/\/\*[\s\S]*?\*\//g, '')
      if (!/styledVoiceId\(/.test(src)) {
        ng(`${why}、えらんだ読み方を声の id に付けていない`, file)
      } else if (!/READ_STYLES\.map\(/.test(src)) {
        ng(`${why}、読み方をえらぶ欄が出ていない`, file)
      } else ok(`${why}、読み方をえらべて、保存する id に付く`)
    }

    /* **作り直しの欄は、指名を素の id で持つ。**
       `sc-2-emo` のまま入れると選択肢のどれにも当たらず、
       **「おまかせ」に見えて、押しただけで別の声に変わる** */
    {
      const src = read('src/components/VoiceRemake.jsx').replace(/\/\*[\s\S]*?\*\//g, '')
      if (!/useState\(now\.map\(plainVoiceId\)\)/.test(src)) {
        ng('作り直しの欄が、指名を素の id で持っていない',
          'now をそのまま入れると、選択肢に当たらず「おまかせ」に見える')
      } else ok('作り直しの欄は、指名を素の id で持っている')
    }
  }

  /* **範囲の外を送ると窓口が 422 で断られる。** 数の欄は 0〜1 に収める */
  const outOfRange = CLIP_VOICES.filter((v) => {
    const st = voiceSettingsOf(v.id)
    return ['similarity_boost', 'stability', 'style']
      .some((k) => !(Number(st[k]) >= 0 && Number(st[k]) <= 1))
  })
  if (outOfRange.length) {
    ng('0〜1 の外の値がある', outOfRange.map((v) => v.label).join(' / '))
  } else ok('数の欄は、全員 0〜1 に収まっている')

  /* **名簿に無い id でも落ちない。** 代役(`us-female` など)の名前が
     来ることがあるので、そこで `undefined` を返すと窓口へ渡らない */
  const fallback = voiceSettingsOf('us-female')
  if (!fallback || Number(fallback.similarity_boost) !== 1) {
    ng('名簿に無い声に、指定が付かない', '代役(us-female など)でも同じ指定を添える')
  } else ok('名簿に無い声(代役)にも、同じ指定が添う')

  /* **1人だけ違う値にする道**が生きているか、その場で試す。
     全員が同じ値でも、外す道が壊れていないことを確かめる(`retired` と同じ) */
  {
    const probe = CLIP_VOICES[0]
    probe.settings = { stability: 0.9 }
    const st = voiceSettingsOf(probe.id)
    delete probe.settings
    if (Number(st?.stability) !== 0.9) ng('その行の `settings` で上書きできない')
    else if (Number(st.similarity_boost) !== 1) {
      ng('`settings` を足すと、書いていない欄まで消える', '書いた欄だけを差し替える')
    } else ok('その行に `settings` を足せば、書いた欄だけを差し替えられる')
  }

  // **渡す道**(画面 → 窓口 → ElevenLabs)が切れていないか
  const clip = read('src/lib/audioClips.js')
  if (!/elevenSettings:\s*voiceSettingsOf\(/.test(clip)) {
    ng('画面が、訛りの指定を窓口へ渡していない',
      '`elevenSettings: voiceSettingsOf(rosterId)` が要る')
  } else ok('画面は、訛りの指定を窓口へ渡している')

  const fn = read('supabase/functions/speak/index.ts')
  if (!/body\.elevenSettings/.test(fn)) ng('窓口が、訛りの指定を読んでいない')
  else ok('窓口は、訛りの指定を読んでいる')
  if (!/voice_settings:\s*settings/.test(fn)) {
    ng('窓口が、ElevenLabs へ voice_settings を渡していない',
      '読んだだけで、頼みに入れていない')
  } else ok('窓口は、ElevenLabs へ voice_settings を渡している')
  if (!/cleanElevenSettings/.test(fn)) {
    ng('窓口が、来た値を確かめていない', '範囲の外を送ると 422 で断られる')
  } else ok('窓口は、来た値を 0〜1 に丸めている')

  /* 【モデルは v3】(2026-09 利用者の指定)
   *
   *   > 私は全ての音声サンプルをV3からのみ選んでいます。
   *
   *   名簿の声はすべて v3 で聴いて選ばれている。ところが窓口は
   *   長らく `eleven_multilingual_v2` を頼んでいた。
   *   **利用者が聴いた音と、アプリが鳴らす音が別物**だったのに、
   *   音は鳴るので気づけない。だから機械で見張る。 */
  const def = /const ELEVEN_MODEL_DEFAULT = '([^']+)'/.exec(fn)?.[1]
  if (!def) ng('窓口に、既定のモデルが無い')
  else if (!/v3/.test(def)) {
    ng('窓口の既定モデルが v3 でない', `いまは ${def}。利用者が選ぶ声はすべて v3 である`)
  } else ok(`窓口の既定モデルは ${def}(利用者が選ぶ声は v3 のみ)`)

  /* **落ちたことが分かるように返しているか。**
     v3 が使えないプランでは v2 に落ちるが、**音は鳴る**ので、
     返さないと「v3 のはずが v2 だった」に気づけない */
  if (!/madeModel/.test(fn)) {
    ng('窓口が、実際に作ったモデルを返していない', 'v2 に落ちても気づけない')
  } else ok('窓口は、実際に作ったモデルを返す')

  /* 【`isV3` は、**実際に当ててみる**】
     はじめ `[^\w]` を区切りにしていたが、`_` は語の文字なので
     **`eleven_v3` が「v3 ではない」**ことになっていた。
     読むだけでは気づけないので、**その場で走らせて確かめる。** */
  const v3re = /const isV3 = \(model: string\) => (\/.+?\/)\.test\(model\)/.exec(fn)?.[1]
  if (!v3re) ng('窓口に、v3 かどうかを見分ける決まりが無い')
  else {
    const re = new RegExp(v3re.slice(1, -1))
    const want = [['eleven_v3', true], ['eleven_v3_alpha', true],
      ['eleven_multilingual_v2', false], ['eleven_turbo_v2_5', false]]
    const bads = want.filter(([m, y]) => re.test(m) !== y).map(([m]) => m)
    if (bads.length) ng('v3 かどうかの見分けが違う', bads.join(' / '))
    else ok('v3 かどうかの見分けは、4とおりとも意図どおり')
  }
}

// ── 窓口の版(置き直したかどうか) ────────────────────────────
/* 【なぜ要るか】(2026-09 実機・利用者の指摘)
 *
 *   > さーっという音はずっと入っています。そして発言の終わりで
 *   > ほぼ必ずプチっという音が入ります。
 *   > Ally で既に試した 0.1 の値も効いていませんでした。
 *
 *   **0.1 にして何も変わらない**のは、指定が ElevenLabs まで
 *   届いていないということである。窓口は利用者が Supabase の画面から
 *   置くので、古いままなら `elevenSettings` は黙って捨てられる。
 *   **しかも音は鳴る**ので、誰も気づけない。だから版を返させる。 */
{
  const clips = readFileSync('src/lib/audioClips.js', 'utf8')

  // 窓口が版を返し、画面がそれを見ているか
  const fn = readFileSync('supabase/functions/speak/index.ts', 'utf8')
  /* 版は日付だが、同じ日に2度直すことがあるので**うしろに印が付く**
     (`2026-09-04b`)。`[\d-]+` だと、その日は素通りしていた */
  const rev = /const FN_REV = '([^']+)'/.exec(fn)?.[1]
  const need = /NEED_FN_REV = '([^']+)'/.exec(clips)?.[1]
  if (!rev) ng('窓口が版を返していない')
  else if (!need) ng('画面が、要る版を持っていない')
  else if (rev < need) ng('窓口の版が、画面の求める版より古い', `${rev} < ${need}`)
  else ok(`窓口の版 ${rev} … 画面が求める ${need} を満たしている`)

  // **版は、どの応答にも付ける**(失敗のときだけ付かないと、そこで誤診する)
  if (!/JSON\.stringify\(\{ \.\.\.\(body as object\), fnRev/.test(fn)) {
    ng('版が、一部の応答にしか付いていない', 'reply() の1か所で付ける')
  } else ok('版は、どの応答にも必ず付く')

  /* ここも**呼んでいるか**まで見る。`const noteFnRev =` を
     `const unusedNoteFnRev =` に変えただけでは、名前が残るので素通りした */
  if (!/noteFnRev\(\s*body\.fnRev\s*\)/.test(clips)) {
    ng('画面が、窓口の返した版を読んでいない', '定義だけあって呼んでいない')
  } else if (!/const noteFnRev = /.test(clips)) {
    ng('版を見る関数そのものが無い')
  } else ok('画面は、窓口が古ければ係の人に知らせる')

  /* 【版は、こちらから訊きに行く】(2026-09 実機・利用者の指摘)
   *
   *   > トレーナーの画面に赤い知らせが出なくなってます
   *
   *   版の見比べが `askForClip()` の中にしか無かったので、
   *   **その英文の MP3 がまだ無いときにしか起きていなかった。**
   *   すでに音声のある教材を聴くだけでは窓口が呼ばれず、
   *   古いままでも何も出ない。「無ければ素通り」そのものだった。 */
  if (!/export async function checkClipGateway/.test(clips)) {
    ng('版を訊きに行く道が無い', '音声を作ったときにしか版が分からない')
  } else if (!/\{\s*ping:\s*true\s*\}/.test(clips)) {
    ng('版を訊く呼び出しが、音声を作らせてしまう', 'ping を送ること')
  } else ok('画面は、窓口の版を自分から訊きに行く(音声は作らない)')

  if (!/body\.ping/.test(fn)) {
    ng('窓口が ping を知らない', '訊きに行っても版が返らない')
  } else ok('窓口は ping に版だけを返す')

  /* **呼んでいるかまで見る。** 定義だけでは、誰も呼ばなければ同じことである
     (`noteFnRev` で一度踏んだ落とし穴) */
  const app = readFileSync('src/App.jsx', 'utf8')
  if (!/checkClipGateway\(\)/.test(app)) {
    ng('画面が、版を訊きに行っていない', '定義だけあって呼んでいない')
  } else ok('開いたときに1度だけ、版を訊きに行く')

  /* 【知らせの文言を、画面に決め打ちしない】(2026-09 実機・同じ回)
   *
   *   `App.jsx` に「読み上げ音声を作れませんでした」と固定していたので、
   *   **版が古いことを伝えるだけの知らせにもその文が付いた。**
   *   音声を作りに行ってすらいないのに「作れませんでした」と出る。 */
  /* **注釈は数に入れない。** ここに「なぜ決め打ちしないか」を書いてある
     ので、そのまま当てると自分の注釈で赤くなる(実際になった) */
  const appCode = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  /* **教材の生成の失敗**(「記事を作れませんでした」)とは別物である。
     見るのは読み上げの1文だけ */
  if (/読み上げ音声を作れませんでした/.test(appCode)) {
    ng('知らせの文言が画面に決め打ちされている',
      '版が古いだけの知らせにも「作れませんでした」が付く')
  } else if (!/const FAILED = /.test(clips)) {
    ng('作れなかったときの1文が `audioClips.js` に無い')
  } else ok('知らせの文言は、起きたことを知っている側が書く')
}

/* ============================================================================
 * ⑨ **作り直した音声が、控えに隠されないこと**(2026-09 実機)
 *
 *   利用者が課金までして作り直したのに、**耳では何も変わらなかった。**
 *   作り直した MP3 は元と同じ場所に上書きされるが、窓口が
 *   `immutable` 付きで1年もつ指定を付けているので、
 *   **端末に残った古い MP3 が鳴り続ける。**
 *
 *   `remakeClip()` は `?v=` を付けていたが、その印は
 *   **モジュールの中(`urlCache`)にしか無かった。**
 *   画面を読み込み直せば消えるので、次に開いた人には古い音が鳴る。
 *   **しかも音は鳴るので、誰も気づけない。**
 *
 *   この間違いは `npm run lint` にも `npm run build` にも引っかからない。
 *   **鳴らしてみるまで分からず、しかも1回ごとに課金される。**
 */
{
  const clips = read('src/lib/audioClips.js')

  if (!/const noteRemade = /.test(clips) || !/localStorage\.setItem\(REMADE_KEY/.test(clips)) {
    ng('作り直した印を、端末に残していない',
      '画面を読み込み直すと、1年もちの古い MP3 が鳴る')
  } else ok('作り直した印は、端末に残る(読み込み直しても効く)')

  /* **`clipUrl()` が印を見ていること。** 残すだけで見なければ同じである
     (`noteFnRev` を定義だけして誰も呼んでいなかったのと同じ落とし穴) */
  const urlFn = clips.match(/export async function clipUrl[\s\S]*?\n}/)?.[0] ?? ''
  if (!/remadeMark\(/.test(urlFn) || !/\?v=/.test(urlFn)) {
    ng('`clipUrl()` が、作り直した印を見ていない',
      '印を残しても、鳴らすときに使わなければ古い音のまま')
  } else ok('`clipUrl()` は、作り直した英文だけ控えを素通りさせる')

  const remakeFn = clips.match(/export async function remakeClip[\s\S]*?\n}/)?.[0] ?? ''
  if (!/noteRemade\(/.test(remakeFn)) {
    ng('作り直したときに、印を残していない')
  } else ok('作り直したら、その英文の印を残す')
}

/* ============================================================================
 * ⑩ **v3 が読まない欄を、名簿でいじらないこと**(2026-09 実機)
 *
 *   利用者の指定で Ally だけ `similarity_boost` を下げ、
 *   作り直してもらったが**何も変わらなかった。**
 *   ElevenLabs の説明にこうある。
 *
 *     Similarity is not available for the Eleven v3 model.
 *     Speaker Boost is not available for the Eleven v3 model.
 *
 *   **利用者が使う声はすべて v3** なので(CLAUDE.md)、この2つと `speed` は
 *   渡っても捨てられる。**効かない欄を書いて作り直すと、課金だけがかかる。**
 *
 *   **既定(`ACCENT_KEEP`)から外さない。** あちらは
 *   「渡す道が切れていないか」を見るためのもので、v2 に落ちたときには効く。
 *   ここで止めるのは**その行の `settings` で値をいじること**だけである。
 */
{
  /* **v2 の声では、この3つは効く。** だから止めるのは v3 の声だけである
     (2026-09、利用者が v2 の声を1人採ったので、モデル別に分けた) */
  const DEAD_ON_V3 = ['similarity_boost', 'use_speaker_boost', 'speed']
  const found = []
  for (const v of CLIP_VOICES) {
    if (voiceModelOf(v.id) !== V3) continue
    for (const k of DEAD_ON_V3) {
      if (v.settings && v.settings[k] !== undefined) found.push(`${v.label}.${k}`)
    }
  }
  if (found.length) {
    ng(`v3 が読まない欄を名簿でいじっている: ${found.join(', ')}`,
      '作り直しても音は変わらず、課金だけがかかる。動かすなら stability')
  } else ok('名簿の settings は、v3 が読む欄だけを触っている')
}

/* ============================================================================
 * ⑪ **声ごとのモデルが、ElevenLabs まで届いていること**(2026-09 利用者の指定)
 *
 *   > ScotlandSophie (V2 / female) : …
 *
 *   利用者は ElevenLabs の画面で**聴いてから**声を選ぶ。
 *   v2 で聴いた声を黙って v3 で鳴らせば、**聴いた音とは別物**になる。
 *   しかも**音は鳴る**ので、**誰も気づけない**(`elevenSettings` で
 *   まったく同じ失敗を2度している)。
 */
{
  const clips = read('src/lib/audioClips.js')
  const fn = read('supabase/functions/speak/index.ts')

  // 名簿に書けるのは、知っているモデルだけ
  const wrong = CLIP_VOICES.filter((v) => v.model && ![V2, V3].includes(v.model))
  if (wrong.length) {
    ng(`名簿に知らないモデルがある: ${wrong.map((v) => v.label).join(', ')}`,
      'ElevenLabs に 422 で断られ、その声だけ音が鳴らなくなる')
  } else ok('名簿のモデルは、どれも知っている名前である')

  // 書いていない声は v3。**既定を静かに変えない**
  const noModel = CLIP_VOICES.find((v) => !v.model)
  if (noModel && voiceModelOf(noModel.id) !== V3) {
    ng('モデルを書いていない声の既定が v3 ではない',
      '利用者が使う声は原則すべて v3(CLAUDE.md)')
  } else ok(`モデルを書いていない声は v3 のまま(${V3})`)

  // 渡す道が切れていないか。**切れても音は鳴る**ので気づけない
  if (!/elevenModel:\s*voiceModelOf\(/.test(clips)) {
    ng('画面が、声ごとのモデルを窓口へ渡していない',
      'v2 で聴いた声が v3 で鳴る。音は鳴るので気づけない')
  } else ok('画面は、声ごとのモデルを窓口へ渡している')

  if (!/body\.elevenModel/.test(fn)) {
    ng('窓口が、渡されたモデルを読んでいない')
  } else if (!/ELEVEN_MODELS\.includes\(/.test(fn)) {
    ng('窓口が、知らないモデル名をそのまま流している',
      '書き間違いが 422 になり、その声だけ鳴らなくなる')
  } else ok('窓口は、渡されたモデルを読み、知らない名前は既定に落とす')

  // 実際にモデルを渡して合成しているか(受け取って捨てていないか)
  if (!/synthElevenBest\([\s\S]{0,200}?elevenModel,/.test(fn)) {
    ng('窓口が、読んだモデルを ElevenLabs へ渡していない',
      '受け取っただけで捨てている。既定のモデルで作られる')
  } else ok('窓口は、そのモデルで ElevenLabs に作らせている')

  // モデルを変えてある声は、名前を読み上げる(黙って効かせない)
  const named = CLIP_VOICES.filter((v) => v.model && v.model !== V3)
  if (named.length) {
    ok(`既定(v3)と違うモデルの声: ${named.map((v) => `${v.label}=${v.model}`).join(' / ')}`)
  }
}

// ── ⑩ 良い声に断られたとき ─────────────────────────────────────────
//
//   【なぜ要るか】(2026-09 実機・利用者の指摘)
//
//     > イギリスの男性、Jofra でスピーチを作成しようとしたら、
//     > google の女性の音声で生成されました。
//
//   出どころは2つあった。**どちらも「音は鳴る」ので気づけない。**
//
//     ① 断り方 … ElevenLabs が断ったのに、画面には
//        「Azure は AZURE_SPEECH_KEY…、Google は GOOGLE_TTS_API_KEY」と
//        **関係のない鍵の名前**が出ていた。しかも
//        **クレジット切れ(401)が、いつも「鍵が正しくありません」**に
//        化けていた(401 の枝が 402 の枝より先にあったため)
//     ② 落ちる先 … 良い声に断られると**端末の声**まで落ちていた。
//        利用者の会社PC の英語の声は Google の3つだけで、既定が女性である。
//        つまり「Google の女性」は**端末の声**であって、こちらが作った音ではない
//
//   ①は**中身を取り出して、素の node で実際に走らせる。**
//   文字を探すだけだと、枝の順を入れ替えても緑のままになる。
{
  const speak = read('supabase/functions/speak/index.ts')
  const a = speak.indexOf('// ── ここから tts-error')
  const b = speak.indexOf('// ── ここまで tts-error')
  if (a < 0 || b < 0) {
    ng('窓口(speak)に tts-error の印が無い', '印を消すと、この検証が何も見なくなる')
  } else {
    /* 型注釈だけを外して走らせる。**知っている4つしか外さない** ——
       足されたものは `new Function` が落ちるので、黙って素通りしない */
    const STRIP = [
      ['const SECRET_OF: Record<string, string> = {', 'const SECRET_OF = {'],
      ['const theirWords = (raw: string) =>', 'const theirWords = (raw) =>'],
      ['const fellBackNote = (why: string) =>', 'const fellBackNote = (why) =>'],
      ['const humanTtsError = (who: string, status: number, raw: string) => {',
        'const humanTtsError = (who, status, raw) => {'],
    ]
    let block = speak.slice(a, b)
    let stripOk = true
    for (const [from, to] of STRIP) {
      if (!block.includes(from)) {
        ng(`tts-error の中の "${from.slice(0, 40)}…" が見つからない`,
          '形を変えたら、この検証の STRIP も直すこと')
        stripOk = false
      } else block = block.replace(from, to)
    }
    if (stripOk) {
      const { humanTtsError, fellBackNote } = new Function(
        `${block}\nreturn { humanTtsError, fellBackNote }`,
      )()

      const quota = JSON.stringify({
        detail: { status: 'quota_exceeded', message: 'You have 0 credits remaining.' },
      })
      const unusual = JSON.stringify({
        detail: {
          status: 'detected_unusual_activity',
          message: 'Unusual activity detected. Free Tier usage disabled.',
        },
      })
      const perm = JSON.stringify({
        detail: { status: 'missing_permissions', message: 'The API key is missing text_to_speech.' },
      })
      const badKey = JSON.stringify({
        detail: { status: 'invalid_api_key', message: 'Invalid API key.' },
      })

      // ── その会社の鍵の名前だけを言う ──────────────────────────
      const ev = humanTtsError('ElevenLabs', 401, badKey)
      if (!/ELEVENLABS_API_KEY/.test(ev.detail)) {
        ng('ElevenLabs に断られたのに、ELEVENLABS_API_KEY と言っていない',
          'どこを直せばよいのか、画面から分からない')
      } else if (/AZURE_SPEECH_KEY|GOOGLE_TTS_API_KEY/.test(ev.detail)) {
        ng('ElevenLabs の断りに、Azure と Google の鍵の名前が混ざっている',
          '断ったのはその会社ではない。関係のない鍵を貼り直すことになる')
      } else ok('ElevenLabs の断りは、ELEVENLABS_API_KEY だけを名指しする')

      const az = humanTtsError('Azure', 401, 'Unauthorized')
      if (!/AZURE_SPEECH_KEY/.test(az.detail) || /ELEVENLABS_API_KEY/.test(az.detail)) {
        ng('Azure の断りが、その会社の鍵を名指ししていない')
      } else ok('Azure の断りは、AZURE_SPEECH_KEY を名指しする')

      // ── クレジット切れは、401 でも「鍵」と言わない ──────────────
      const q = humanTtsError('ElevenLabs', 401, quota)
      if (/鍵が正しくありません/.test(q.detail)) {
        ng('クレジット切れ(401)が「鍵が正しくありません」になっている',
          '401 の枝を 402 の枝より先に置くと、こうなる。順が逆')
      } else if (!/クレジット/.test(q.detail)) {
        ng('クレジット切れを、クレジットの話として言っていない')
      } else ok('クレジット切れは、401 で来ても「クレジット」と言う')

      // ── 無料プランがクラウドから止められている ─────────────────
      const u = humanTtsError('ElevenLabs', 401, unusual)
      if (/鍵が正しくありません/.test(u.detail) || !/無料プラン/.test(u.detail)) {
        ng('無料プランの停止が「鍵が正しくありません」になっている',
          '鍵は正しいので、貼り直しても永久に直らない')
      } else if (!u.fatal) {
        ng('無料プランの停止で、取りに行くのをやめていない')
      } else ok('無料プランの停止は、そのことばで言う(貼り直させない)')

      // ── 鍵に読み上げの権限が無い ──────────────────────────────
      const p = humanTtsError('ElevenLabs', 401, perm)
      if (/鍵が正しくありません/.test(p.detail) || !/権限/.test(p.detail)) {
        ng('権限不足が「鍵が正しくありません」になっている')
      } else ok('権限不足は、権限の話として言う')

      // ── **向こうの言い分を、必ず添える** ──────────────────────
      //   こちらには ElevenLabs へ問い合わせる手段が無い。
      //   画面に出る1文だけが、唯一の手がかりである
      const cases = [[401, badKey, 'invalid_api_key'], [401, quota, 'quota_exceeded'],
        [401, unusual, 'detected_unusual_activity'], [401, perm, 'missing_permissions'],
        [429, 'Too Many Requests', 'Too Many Requests'],
        [500, 'boom', 'boom'], [400, 'no such voice', 'no such voice']]
      const lost = cases.filter(([s, raw, word]) =>
        !String(humanTtsError('ElevenLabs', s, raw).detail).includes(word))
      if (lost.length) {
        ng(`向こうの言い分を捨てている枝がある(${lost.length} 件)`,
          '言い換えたこちらの1文だけでは、外したときに直せない')
      } else ok('どの断り方でも、向こうの言い分をそのまま添えている')

      // ── 落ちたことを、それだけで通じる1文で言う ───────────────
      const note = fellBackNote('ElevenLabs のクレジットを使い切りました。')
      if (!/標準の声/.test(note) || !/クレジット/.test(note)) {
        ng('落ちたときの1文が、起きたことを言い切っていない',
          '画面はこの文をそのまま出す。ここで言い切らないと誤診させる')
      } else ok('落ちたときの1文は、それだけで意味が通る')
    }
  }

  // ── ② 落ちる先は「標準の声」。端末の声まで落とさない ───────────
  /* **`!force` は、すぐ下の別の見張りが受け持つ。** ここで一緒に見ると、
     どちらを壊しても同じ1行が赤くなり、**どちらが壊れたのか分からない** */
  if (!/if \(made\.error &&[^)]*standardProvider\) \{/.test(speak)) {
    ng('良い声に断られたとき、標準の声に落としていない',
      '落ちる先が無いと、画面は端末の声(会社PCでは Google の女性)まで落ちる')
  } else if (!/path = `\$\{CLIP_REV\}\/standard\/\$\{base\}\/\$\{await fingerprint\(base, text\)\}\.mp3`/.test(speak)) {
    ng('落ちた先の置き場所が、画面の見に来る場所と違う',
      '`<版>/standard/<代役の声>/<指紋>` でなければ、毎回作り直して毎回課金する')
  } else if (!/const already = await fetch\(publicUrl, \{ method: 'HEAD' \}\)[\s\S]{0,400}?fellBack: true/.test(speak)) {
    ng('落ちた先に、もう音声があっても作り直している', '標準の声にも無料枠と待ち時間がある')
  } else ok('良い声に断られたら、標準の声(選んだ訛りと性別)に落ちる')

  // **作り直しのときは落とさない。** あれは良い声にするために課金するボタンで、
  // 標準の声で作って「できました」と返すと、成功と失敗が同じ見た目で終わる
  if (!/&& !force &&/.test(speak)) {
    ng('作り直し(force)のときにも標準の声へ落ちている',
      '課金して押したのに「できました」と出る。成功と失敗が見分けられない')
  } else ok('作り直しのときは落とさない(断った理由をそのまま返す)')

  // 実際に作った会社で見ているか(`provider` のままだと、落ちたあとに食い違う)
  //
  // **2つとも見る**(第5.274節で、置く前の大きさを決める1本が増えた)。
  //   ① `evened` … 置く前に大きさを決める(第5.362節で英語も上げるようになった)
  //   ② `stored` … 終わりをなだらかにする
  // どちらも `madeBy`(実際に作った会社)で分けていなければならない
  //
  // ★ **式をそのまま書き写さない**(第5.362節で踏んだ)。
  //   `voiceId === JA_VOICE_ID` まで書いてあったので、英語も上げるように
  //   直した瞬間に**仕組みは無傷のまま赤くなった。**
  //   見るのは「**`madeBy` で分けているか**」だけでよい。
  if (!/const stored = madeBy === 'eleven' \? fadeMp3Tail\(evened\) : audio/.test(speak)
    || !/const evened = madeBy === 'eleven' \?/.test(speak)) {
    ng('置く前のなだらかにする判断が、実際に作った会社を見ていない')
  } else if (!/provider: madeBy,/.test(speak)) {
    ng('返している会社が、実際に作った会社ではない')
  } else ok('窓口は、実際に作った会社で判断し、それを返す')

  // 頼まれた段で作れたかで `fellBack` を決めているか
  if (!/fellBack: tier === 'premium' && madeTier !== 'premium',/.test(speak)) {
    ng('落ちたことを `fellBack` で返していない',
      'Voice ID の有無だけを見ていると、断られて落ちたことがどこにも出ない')
  } else ok('頼まれた段で作れたかどうかで、落ちたことを返す')

  /* ── **鍵は、前後の空白を落としてから使う** ──────────────────────
     Secrets に貼るときに改行や空白が1つ混じるだけで、
     **正しい鍵でも 401 になる。** しかも画面には「鍵が正しくありません」と
     出るので、**何度貼り直しても直らない。** こちらで落とせる */
  if (!/const envKey = \(name: string\) => \(Deno\.env\.get\(name\) \?\? ''\)\.trim\(\)/.test(speak)) {
    ng('鍵の前後の空白を落としていない',
      '貼るときに改行が1つ混じるだけで、正しい鍵が 401 になる')
  } else if (/Deno\.env\.get\('(ELEVENLABS_API_KEY|AZURE_SPEECH_KEY|AZURE_SPEECH_REGION|GOOGLE_TTS_API_KEY)'\)(?!\s*\?\?)/.test(speak)) {
    ng('空白を落とさずに読んでいる鍵が残っている')
  } else ok('鍵は、前後の空白を落としてから使う')

  // ── ③ 画面は、落ちたときに知らせを消さない ─────────────────────
  const clips = read('src/lib/audioClips.js')
  if (!/if \(body\.fellBack && body\.detail\) \{[\s\S]{0,200}?setDetail\(body\.detail\)/.test(clips)) {
    ng('画面が、落ちたときの知らせを消している',
      '音は鳴るので、なぜ声が違うのかを知る道がどこにも無くなる')
  } else ok('画面は、落ちたときの知らせをそのまま出す')

  // ── ④ 窓口を直したら、版を1つ進める ───────────────────────────
  const fnRev = speak.match(/^const FN_REV = '([^']+)'/m)?.[1] ?? ''
  const need = clips.match(/^export const NEED_FN_REV = '([^']+)'/m)?.[1] ?? ''
  if (!fnRev || !need) {
    ng('窓口の版を読めない')
  } else if (fnRev !== need) {
    ng(`窓口の版と、画面が要る版が違う(窓口 ${fnRev} / 画面 ${need})`,
      '窓口に手を入れたら、両方を同じ値に進める')
  } else ok(`窓口の版はそろっている(${fnRev})`)
}

/* ── ⑨ 出来上がった名前に、声の並びを合わせる ──────────────────────
 *
 *   2026-09 利用者の指摘
 *     > 会話や会議で男の役に女性の声、女性の役に男の声が
 *     > アサインされることがほとんどです。
 *
 *   窓口へ性別は渡していたが、**そのあと一度も確かめていなかった。**
 *   ①窓口を置き直していない ②AI がその1行を守らなかった、のどちらでも
 *   黙ってずれる。**しかも音は鳴るので、聴くまで分からない。**
 *
 *   **「直る」だけを見ない。** それだけだと、名前が読めないときにまで
 *   勝手に入れ替える形へ書き換えても緑になる。
 *   ①直るか ②顔ぶれが1人も変わっていないか ③合っているものを動かさないか
 *   ④読めないときは何もしないか ⑤画面が本当に呼んでいるか、を一緒に見る。 */
{
  const us = voicesOfAccent('us')
  const male = us.find((v) => v.gender === 'male')
  const female = us.find((v) => v.gender === 'female')
  const gOf = (id) => findVoice(id)?.gender
  const ids = [male.id, female.id]
  // 「1人目は男性」と頼んだのに、AI が女性の名前から始めてしまった会話
  const flipped = ['Mika (Agent)', 'Kenji (Manager)', 'Mika (Agent)']

  // ① 入れ替わるか
  const fixed = orderVoicesByNames(ids, flipped, gOf)
  const cast = castClipSpeakers(flipped, fixed)
  if (gOf(cast.get('mika (agent)')) !== 'female' || gOf(cast.get('kenji (manager)')) !== 'male') {
    ng('名前と声の性別がそろっていない',
      `mika → ${gOf(cast.get('mika (agent)'))} / kenji → ${gOf(cast.get('kenji (manager)'))}`)
  } else ok('名前がずれていたら、声の並びを入れ替える')

  // ② **顔ぶれは1人も変えない**(指名した声が無視されない)
  if ([...fixed].sort().join() !== [...ids].sort().join()) {
    ng('声の顔ぶれが変わっている', `${ids} → ${fixed}`)
  } else ok('入れ替えても、選んだ声は1人も変わらない')

  // ③ 合っているものは、1ミリも動かさない
  const same = ['Kenji (Manager)', 'Mika (Agent)']
  if (orderVoicesByNames(ids, same, gOf) !== ids) {
    ng('合っているのに並びを動かしている', '元の配列そのものを返すこと')
  } else ok('名前と声が合っていれば、何もしない')

  // ④ **名前から読めないときは、何もしない**(あやふやなことを言わない)
  const unknown = ['Speaker A (x)', 'Speaker B (y)']
  if (orderVoicesByNames(ids, unknown, gOf) !== ids) {
    ng('名前を読めないのに並びを変えている')
  } else ok('名前から性別を読めないときは、何もしない')

  // 1人だけ読めるときも動かさない(根拠が足りない)
  if (orderVoicesByNames(ids, ['Mika (Agent)', 'Speaker B (y)'], gOf) !== ids) {
    ng('1人しか読めないのに並びを変えている')
  } else ok('読める名前が1人だけなら、動かさない')

  /* ══════════════════════════════════════════════════════════════
     **⑥ 一覧に無い名前でも、言われた性別で並ぶ**(第5.255節・2026-09-25)

       > 今だに会話や会議の登場人物と、音声の性別が合わないことが
       > 多いです。そろそろちゃんと直してください。何度やるんですか

     **ここまでの①〜④は、ずっと緑だった。** 見ていたのが
     **一覧に載っている名前ばかり**だったからである
     (`Mika` も `Kenji` も一覧の中にいる)。
     AI は名前を自由に付けるので、**一覧の外の名前が本番では普通に出る。**
     そこが `unknown` に落ち、④「何もしない」がそのまま**不具合**になる。

     **いちばん危ない形を、検証の中に必ず置く**(CLAUDE.md)。
     ══════════════════════════════════════════════════════════════ */
  {
    // **どちらも `guessGender()` の一覧に無い名前**(ここが肝)
    const 外 = ['Takumi (Sales)', 'Elise (Buyer)']
    if (guessGender(外[0]) !== 'unknown' || guessGender(外[1]) !== 'unknown') {
      ng('検証の名前が一覧に載ってしまった',
        '**一覧の外の名前**で見ないと、この穴は測れない')
    } else ok('検証に使う名前は、名前からは読めない(いちばん危ない形)')

    // **言われていなければ、これまでどおり何もしない**(「出ない」側)
    if (orderVoicesByNames(ids, 外, gOf) !== ids) {
      ng('言われてもいないのに、並びを変えている')
    } else ok('言われなければ、名前から読めないので何もしない')

    /* **言われたら、そのとおりに並ぶ**(「出る」側)。
       ids は [男, 女] の順。1人目 Takumi が男なら、そのまま */
    const 言 = (n) => (n.startsWith('takumi') ? 'male' : 'female')
    const そのまま = orderVoicesByNames(ids, 外, gOf, 言)
    const c1 = castClipSpeakers(外, そのまま)
    if (gOf(c1.get('takumi (sales)')) !== 'male' || gOf(c1.get('elise (buyer)')) !== 'female') {
      ng('言われた性別のとおりに声が当たっていない',
        `takumi → ${gOf(c1.get('takumi (sales)'))} / elise → ${gOf(c1.get('elise (buyer)'))}`)
    } else ok('**一覧に無い名前でも、言われた性別で声が当たる**')

    /* **逆に言われたら、入れ替わる。** これを見ないと、
       **いつも元の並びを返す**形でも上の1本は緑になる */
    const 逆 = (n) => (n.startsWith('takumi') ? 'female' : 'male')
    const 入替 = orderVoicesByNames(ids, 外, gOf, 逆)
    const c2 = castClipSpeakers(外, 入替)
    if (gOf(c2.get('takumi (sales)')) !== 'female' || gOf(c2.get('elise (buyer)')) !== 'male') {
      ng('逆に言われたのに、入れ替わっていない',
        `takumi → ${gOf(c2.get('takumi (sales)'))} / elise → ${gOf(c2.get('elise (buyer)'))}`)
    } else ok('逆に言われたら、そのとおりに入れ替わる')

    /* **言われたほうが先。** 名前からの当てと食い違っても、言われたほうを採る
       (`Mika` は一覧では女性。それを男と言われたら、男の声にする) */
    const 食違 = orderVoicesByNames(ids, ['Mika (Agent)', 'Kenji (Manager)'], gOf,
      (n) => (n.startsWith('mika') ? 'male' : 'female'))
    const c3 = castClipSpeakers(['Mika (Agent)', 'Kenji (Manager)'], 食違)
    if (gOf(c3.get('mika (agent)')) !== 'male') {
      ng('名前からの当てが、言われたほうより勝っている',
        '当てるのは、言われていないときだけである')
    } else ok('名前から読めても、言われたほうを先に採る')
  }

  /* ⑦ **窓口が、必ず書くことになっているか**(第5.255節)。
       任意の欄にすると、書かれなかった日に**また名前から当てる**ことになる。
       **頼むのではなく、道具の形で強制する**(CLAUDE.md) */
  {
    const fn = read('supabase/functions/generate-material/index.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    if (!/speaker_gender: \{[\s\S]{0,400}?enum: \['male', 'female'\]/.test(fn)) {
      ng('窓口に `speaker_gender` の欄が無い(male / female の2つから選ばせる)')
    } else ok('窓口 … 性別は male / female の2つから選ばせる')
    if (!/required: \['speaker', 'speaker_gender'/.test(fn)) {
      ng('窓口 … `speaker_gender` が必須になっていない',
        '任意だと、書かれなかった日にまた名前から当てることになる')
    } else ok('窓口 … 会話・会議では `speaker_gender` が必須')
  }

  /* ⑧ **画面が、窓口の言ってきた性別を渡しているか**(第5.255節)。
       ここを見ないと、**画面が渡すのをやめても緑のまま**になる ——
       算段だけ直して、入力が来ていない形である
       (それが「何度やっても直らない」の正体だった) */
  {
    const form4 = read('src/components/MaterialForm.jsx').replace(/\/\*[\s\S]*?\*\//g, '')
    if (!/it\?\.speaker_gender/.test(form4)) {
      ng('画面が、窓口の言ってきた性別を読んでいない')
    } else if (!/\(name\) => said\.get\(name\)/.test(form4)) {
      ng('画面が、言われた性別を並べ替えに渡していない',
        '読んでいても、渡さなければ1ミリも効かない')
    } else ok('画面 … 窓口の言ってきた性別を、そのまま並べ替えに渡す')
  }

  // ⑤ **画面が本当に呼んでいるか。** 定義だけあっても何も起きない
  const form3 = read('src/components/MaterialForm.jsx').replace(/\/\*[\s\S]*?\*\//g, '')
  // **呼んでいる形で見る。** 取り込みの行(`import { … }`)には丸括弧が無い
  if (!/orderVoicesByNames\(\s*\n?\s*cast/.test(form3)) {
    ng('画面が、並びを合わせていない', '発行するときに1回だけ通すこと')
  } else if (/voiceIds:\s*cast\b/.test(form3)) {
    ng('保存する声が、並べ替える前のままになっている')
  } else ok('画面は、発行するときに声の並びを合わせている')
}

/* ══════════════════════════════════════════════════════════════════════
   **RIZAP ENGLISH の教材の、固定の配役**(第5.202節)

     > Elevenlabsの声で固定で作ってください。
     > Mary = Jessica / Noah = David Esposito / Hannah = Sky / Sam = Henry
     > Conversation1、2、３、Business Conversation 1、２は共通して
     > この設定でお願いします。**絶対に変えないで。**

   **推測ではなく、名指しである。** `voiceOrder.js` の並べ替えは
   名前から性別を読むだけなので、「Mary が Jessica である」ことは
   決まらない。ここは、その指名が**いまも守られているか**を見る。
   ══════════════════════════════════════════════════════════════════════ */
{
  const { RIZAP_CAST, rizapVoiceOf, rizapVoiceIds, rizapNameKey } =
    await import('../src/data/rizapCast.js')

  /* ── ① 指名どおりの声か。**id と名前が食い違っていないか** ──
     `clipVoices.js` の並びが変わった日に、黙って別人になるのを止める */
  const wrong = RIZAP_CAST.filter((c) => {
    const v = CLIP_VOICES.find((x) => x.id === c.voice)
    return !v || v.label !== c.want
  })
  if (wrong.length) {
    ng('RIZAP の配役 … 指名した声と、名簿の名前が食い違っている',
      wrong.map((c) => `${c.name} → ${c.voice} は ${
        CLIP_VOICES.find((x) => x.id === c.voice)?.label ?? '(名簿に無い)'
      }。指定は ${c.want}`).join('\n    '))
  } else {
    ok(`RIZAP の配役 … ${RIZAP_CAST.length}人とも指名どおり(${
      RIZAP_CAST.map((c) => `${c.name}=${c.want}`).join(' / ')})`)
  }

  /* ── ② 男女が入れ替わっていないか(実機で起きたことそのもの)── */
  const sexes = RIZAP_CAST.map((c) => CLIP_VOICES.find((x) => x.id === c.voice)?.gender)
  if (sexes.some((g) => g !== 'male' && g !== 'female')) {
    ng('RIZAP の配役 … 性別の分からない声が混じっている', sexes.join(' / '))
  } else if (new Set(sexes).size < 2) {
    ng('RIZAP の配役 … 全員が同じ性別になっている(実機で起きた形)',
      sexes.join(' / '))
  } else {
    ok(`RIZAP の配役 … 男女が混ざっている(${sexes.join(' / ')})`)
  }

  /* ── ③ 使っていない声・退いた声を当てていないか ── */
  const dead = RIZAP_CAST.filter((c) => CLIP_VOICES.find((x) => x.id === c.voice)?.retired)
  if (dead.length) {
    ng('RIZAP の配役 … もう使わない声を当てている',
      dead.map((c) => `${c.name} → ${c.voice}`).join(' / '))
  } else ok('RIZAP の配役 … もう使わない声は当てていない')

  /* ── ④ **知らない人物には、声を当てない** ──
     利用者の指定「登場人物が追加になった際は、私に…尋ねてください」。
     当てずっぽうで埋めると、また黙って別の声になる */
  if (rizapVoiceOf('Kelly') !== null) {
    ng('RIZAP の配役 … 知らない人物に、勝手に声を当てている',
      '`null` を返して、利用者に訊くこと')
  } else ok('RIZAP の配役 … 知らない人物には声を当てない(null を返す)')
  const mixed = rizapVoiceIds(['Mary (Ticket center clerk)', 'Kelly', 'Noah'])
  if (!mixed.unknown.includes('kelly')) {
    ng('RIZAP の配役 … 声の決まっていない人物を、知らせていない',
      JSON.stringify(mixed))
  } else ok('RIZAP の配役 … 声の決まっていない人物を名指しで返す(訊く相手が分かる)')

  /* ── ⑤ **出てくる順**。重複しない。`voiceOrder.js` と同じ数え方 ──
     ずれると、声を当てた人と読み上げる人が別人になる */
  const order = rizapVoiceIds(['Mary (Ticket center clerk)', 'Noah', 'Mary (Ticket center clerk)'])
  if (order.ids.join(',') !== 'us-1,us-2') {
    ng('RIZAP の配役 … 出てくる順の並びになっていない', order.ids.join(','))
  } else ok('RIZAP の配役 … 出てくる順に、重複なく並ぶ(us-1, us-2)')
  /* **肩書きを落とす切り方が、`voiceCast.js` とそろっているか。**
     あちらは `speakerKey` → `(` の前 → 空白で切った最初の語 */
  if (rizapNameKey('Mary (Ticket center clerk)') !== 'mary') {
    ng('RIZAP の配役 … 肩書きの落とし方が、voiceCast.js とそろっていない',
      rizapNameKey('Mary (Ticket center clerk)'))
  } else ok('RIZAP の配役 … 肩書きの落とし方が、voiceCast.js とそろっている')

  /* ── ⑥ **声の名前を、画面用に書き写していない** ──
     `want` は「そのつもりで選んだ」という記録で、画面には使わない。
     画面に出す名前は `voiceLabel()` が `clipVoices.js` から引く */
  const src = readFileSync(new URL('../src/data/rizapCast.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  if (/label:/.test(src)) {
    ng('RIZAP の配役 … 画面に出す名前を、こちらに書き写している',
      '名前は clipVoices.js 1か所(voiceLabel)から引くこと')
  } else ok('RIZAP の配役 … 画面に出す名前を書き写していない')
}

/* ══════════════════════════════════════════════════════════════════
   **1人で読む教材の声は、必ず女性から選ぶ**(第5.291/5.297節・実機)

     > 文系トレーニングの音声の男性の声がよくないです。女性の方が良いです
     > (第5.291節・文型ドリルだけ)

     > それ以外は全て私の答えは「はい」です。
     > (第5.297節・記事・単語 / フレーズ・Speech練習・テストにも広げる)

   **「たまたま男性だった」のではない。必ず男性だった。**
   `pickVoices()` は人数の多い性別から交互に選ぶ。アメリカの
   ナレーション向きは 女2人 / 男4人 なので、いつも男性から始まる。
   1人で読む教材は**声が1人**なので、その1人目がそのまま使われていた。

   **種類を並べて数えない。** `voiceCountFor(kind) === 1`(= 1人で読む)
   で見る。種類を足した日に、**書き足さずに**見張りが付いてくる。
   ══════════════════════════════════════════════════════════════════ */
{
  const { pickVoices, findVoice, voiceCountFor, voicePurposeFor, voiceFirstGenderFor }
    = await import('../src/data/clipVoices.js')

  /* **画面(`MaterialForm` の `cast`)とまったく同じ引き方をする。**
     ここで別の引き方をすると、画面が直っていなくても緑になる */
  const えらぶ = (kind, accent = 'us') => {
    const n = voiceCountFor(kind)
    return pickVoices(accent, n * 2, voicePurposeFor(kind), voiceFirstGenderFor(kind))[0]
  }
  const 数える = (kind, accent = 'us') => {
    const c = { female: 0, male: 0 }
    /* **`pickVoices` は毎回混ぜる。** 1回だけ見ると、
       直っていなくても当たることがある —— **何度もまわす** */
    for (let i = 0; i < 200; i += 1) c[findVoice(えらぶ(kind, accent))?.gender] += 1
    return c
  }

  /* **種類は、こちらで並べない。** 教材の種類そのものから引いて、
     **1人で読むもの / 2人以上いるもの**に分ける(第5.297節) */
  const { MATERIAL_KINDS } = await import('../src/data/materialKinds.js')
  const 全種類 = MATERIAL_KINDS.map((k) => k.id)
  const ひとり = 全種類.filter((k) => voiceCountFor(k) === 1)
  const ふたり以上 = 全種類.filter((k) => voiceCountFor(k) > 1)

  /* **「無ければ素通り」する検証を書かない**(CLAUDE.md)。
     どちらかが空になったら、下の2本は何も見ていないのと同じである。
     **文型ドリルだけになっても赤くする** —— 第5.297節で広げた先が
     こっそり減っていないか(記事・単語 / フレーズ・Speech練習・テスト) */
  if (ひとり.length < 5 || !ふたり以上.length) {
    ng('1人で読む教材 … 数えている種類が少なすぎる(見張りが空まわりしている)',
      `1人 ${ひとり.length} 件 / 2人以上 ${ふたり以上.length} 件`)
  } else ok(`1人で読む教材 … ${ひとり.length} 種類を数える(${ひとり.join(' / ')})`)

  /* ── ① **1人で読む教材は、何度まわしても女性**(第5.297節)── */
  {
    const 男の出た種類 = []
    for (const kind of ひとり) {
      const c = 数える(kind)
      if (c.male) 男の出た種類.push(`${kind}(女 ${c.female} / 男 ${c.male})`)
    }
    if (男の出た種類.length) {
      ng('1人で読む教材 … 1人目に男性が選ばれることがある', 男の出た種類.join(' / '))
    } else {
      ok(`1人で読む教材 … ${ひとり.length} 種類 × 200 回まわして、ぜんぶ女性`
        + '(前は 200 回とも男性)')
    }
  }

  /* ── ② **「出る」と「出ない」の両方を見る** ──
     どの種類でも女性にしてしまう形に書き換えたら、ここが赤くなる。
     **2人以上で読む教材(会話・会議)は、これまでどおり交互** */
  const よそ = ふたり以上.filter((k) => voiceFirstGenderFor(k) !== null)
  if (よそ.length) {
    ng('2人以上で読む教材 … 1人目の性別まで決めてしまっている', よそ.join(' / '))
  } else ok(`2人以上で読む教材 … 交互のまま(${ふたり以上.join(' / ')})`)

  /* ── ③ **会話は、これまでどおり交互** ──
     1人目を決める仕組みを足したせいで、会話の2人が同じ性別になっていないか */
  const 組 = pickVoices('us', 2, 'conversation')
  const 性 = 組.map((id) => findVoice(id)?.gender)
  if (組.length !== 2 || 性[0] === 性[1]) {
    ng('会話 … 2人が同じ性別になっている(聞き分けられない)', 性.join(' / '))
  } else ok(`会話 … これまでどおり男女が交互(${性.join(' / ')})`)

  /* ── ④ **足りなくなったら、もう一方から選ぶ**(黙って落とさない)──
     **「無ければ素通り」する検証を書かない**(CLAUDE.md)。
     どの訛りも男女そろっているので「女性のいない訛り」は作れないが、
     **人数より多く求めれば、必ず足りなくなる** ——
     アメリカのナレーション向きは女2人なので、6人求めれば
     3人目の女性で尽きる。そこで男性に落ちなければ、
     **返る人数が足りなくなる**(= 声の当たらない役が出る) */
  {
    const 六人 = pickVoices('us', 6, 'narration', 'female')
    const 男女 = 六人.map((id) => findVoice(id)?.gender)
    if (六人.length !== 6) {
      ng('おまかせ … 女性が尽きたところで人数が足りなくなる',
        `${六人.length} 人(${男女.join(' / ')})`)
    } else if (男女[0] !== 'female') {
      ng('おまかせ … 言われた性別から始まっていない', 男女.join(' / '))
    } else if (new Set(六人).size !== 6) {
      ng('おまかせ … 同じ声を二度出している', 六人.join(' / '))
    } else {
      ok(`おまかせ … 女性が尽きたら男性に落ちる(${男女.join(' / ')})`)
    }
  }

  /* ── ⑤ **画面が、その判断を通っているか** ──
     定義だけあって誰も呼ばなければ、何も起きない */
  const form = readFileSync(new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  if (!/pickVoices\(accent, voiceCount \* 2, voicePurpose,\s*voiceFirstGenderFor\(kind\)\)/
    .test(form)) {
    ng('1人で読む教材 … 教材を作る画面が、1人目の性別を渡していない')
  } else ok('1人で読む教材 … 教材を作る画面が、`voiceFirstGenderFor(kind)` を渡す')
  /* **見張り(`useMemo`)に `kind` が入っているか。**
     `voicePurpose` は文型ドリルと記事でどちらも `narration` なので、
     `kind` が無いと**種類を変えても選び直されない** */
  if (!/\}, \[accent, voiceCount, voicePurpose, picked, kind\]\)/.test(form)) {
    ng('1人で読む教材 … 種類を変えても、声が選び直されない',
      '`useMemo` の見張りに `kind` が無い')
  } else ok('1人で読む教材 … 種類を変えたら、声を選び直す(`useMemo` に `kind` がある)')

  /* ── ⑥ **判断は1か所。画面の中で種類を見ていない** ── */
  if (/kind === 'pattern'/.test(form)) {
    ng('1人で読む教材 … 画面の中で種類を見ている',
      '判断は `voiceFirstGenderFor()` 1か所に置くこと')
  } else ok('1人で読む教材 … 画面の中で `kind === \'pattern\'` と書いていない')
}

/* ══════════════════════════════════════════════════════════════════
   **標準の段は、割り当てた会社に本当にその声があるか**(第5.293節)

     > なぜ US male が Google ではなく azure なのですか？あの声は好きでは
     > ないです。Google の male の声が悪くなければそちらにし、
     > 男女を両方使えるようにしたい

   窓口は「話者 → 会社」の表と、「会社ごとの声の名前」の表を**別々に**
   持っている。会社を1つ書き換えたときに、**その会社の表にその話者が
   載っていなければ、その声は1本も鳴らない**(窓口が引けない)。
   **こちらからは窓口を1度も動かせない**ので、机の上で突き合わせる。
   ══════════════════════════════════════════════════════════════════ */
{
  const { BASE_VOICES, BASE_PROVIDER, providerOf } =
    await import('../src/data/clipVoices.js')
  const ts = readFileSync(new URL('../supabase/functions/speak/index.ts', import.meta.url), 'utf8')

  /** 窓口の表を1つ読む。**名前で探す**(行の順番に頼らない) */
  const 表 = (名) => {
    const at = ts.indexOf(`const ${名}`)
    if (at < 0) return null
    const body = ts.slice(at, ts.indexOf('\n}', at))
    return body
  }
  const 割り当て = 表('SPEAKER_PROVIDER')
  const 会社 = 割り当て
    ? Object.fromEntries([...割り当て.matchAll(/'([a-z-]+)':\s*'(google|azure)'/g)]
      .map((m) => [m[1], m[2]]))
    : null
  const 声の名前 = (名) => {
    const body = 表(名)
    return body ? [...body.matchAll(/'([a-z-]+)':\s*\{\s*voice:/g)].map((m) => m[1]) : null
  }
  const g = 声の名前('GOOGLE_VOICES')
  const a = 声の名前('AZURE_VOICES')

  if (!会社 || !g || !a) {
    ng('標準の段 … 窓口の表を読めなかった',
      `SPEAKER_PROVIDER ${!!会社} / GOOGLE_VOICES ${!!g} / AZURE_VOICES ${!!a}`)
  } else {
    /* ── ① **割り当てた会社に、その話者の声があるか** ── */
    const 無い = Object.entries(会社)
      .filter(([who, どこ]) => !(どこ === 'google' ? g : a).includes(who))
      .map(([who, どこ]) => `${who} → ${どこ}(その会社の表に無い)`)
    if (無い.length) {
      ng('標準の段 … 声の無い会社に任せている(1本も鳴らない)', 無い.join('\n    '))
    } else {
      ok(`標準の段 … ${Object.entries(会社).map(([w, d]) => `${w}=${d}`).join(' / ')}`)
    }

    /* ── ② **画面の名簿と、窓口の割り当てがそろっているか** ──
       片方にしかいない話者がいると、**画面は頼むのに窓口が引けない**
       (またはその逆で、誰も使わない行が残る) */
    const 画面だけ = BASE_VOICES.filter((v) => !(v in 会社))
    const 窓口だけ = Object.keys(会社).filter((v) => !BASE_VOICES.includes(v))
    if (画面だけ.length || 窓口だけ.length) {
      ng('標準の段 … 画面の名簿と窓口の割り当てが食い違っている',
        `画面だけ ${画面だけ.join(' / ') || '無し'} / 窓口だけ ${窓口だけ.join(' / ') || '無し'}`)
    } else ok('標準の段 … 画面の名簿(BASE_VOICES)と窓口の割り当てが、同じ4人')

    /* ── ③ **男女とも標準の段で鳴らせる**(第5.293節・利用者の指定
           「男女を両方使えるようにしたい」)。
       どちらかが抜けると、その性別の声をえらんだ教材が鳴らない ── */
    const 欠け = ['us-female', 'us-male'].filter((v) => !(v in 会社))
    if (欠け.length) {
      ng('標準の段 … アメリカの男女がそろっていない', 欠け.join(' / '))
    } else ok('標準の段 … アメリカは男女とも鳴らせる')

    /* ── ④ **画面に出す会社の名前が、窓口とそろっているか**(第5.296節)──
       会社を決めているのは窓口だが、**画面にも出すことになった**ので、
       同じ表が2か所にある。**必ず片方だけ古くなる**(CLAUDE.md)。
       `CLIP_REV` を窓口と画面でそろえるのと、まったく同じ作法で見張る */
    const ずれ = Object.entries(会社)
      .filter(([who, どこ]) => (BASE_PROVIDER[who] ?? '').toLowerCase() !== どこ)
      .map(([who, どこ]) => `${who} … 窓口 ${どこ} / 画面 ${BASE_PROVIDER[who] ?? '(無し)'}`)
    if (ずれ.length) {
      ng('標準の段 … 窓口と画面で、会社の表が食い違っている', ずれ.join('\n    '))
    } else ok('標準の段 … 窓口と画面で、会社の表がそろっている')

    /* ── ⑤ **どの訛りでも同じ会社か**(利用者の指定
           「全ての国籍において同じ仕様にしてください」)── */
    const { CLIP_ACCENTS } = await import('../src/data/clipVoices.js')
    const 会社たち = [...new Set(CLIP_ACCENTS
      .flatMap((a) => ['female', 'male'].map((g) => providerOf(a.id, g))))]
    if (会社たち.length !== 1 || !会社たち[0]) {
      ng('標準の段 … 訛りや性別で会社が変わる', 会社たち.join(' / ') || '(空)')
    } else ok(`標準の段 … どの訛り・どちらの性別でも ${会社たち[0]}`)
  }
}

/* ══════════════════════════════════════════════════════════════════
   **えらんだ声が、どのページで鳴るのか**(第5.296節)

     > 選択画面には名前、性別と(Google)の評価を入れてください。
     > そうでないとややこしいです。

   欄に並ぶのは ElevenLabs の声だが、**その声で読むページと読まない
   ページがある。** 名前と性別だけでは、どこで鳴るのか分からなかった。
   ══════════════════════════════════════════════════════════════════ */
{
  const { voicePlan, voicePlanLine } = await import('../src/lib/voicePlan.js')

  /* ── ① **3つの形が、それぞれ違う1行になる** ──
     「出る」と「出ない」の両方を見る(CLAUDE.md) */
  const 文型 = voicePlanLine('pattern', [], 'Google', 'female')
  const 単語 = voicePlanLine('vocab', [], 'Google', 'female')
  const 発音 = voicePlanLine('pattern', ['l-r'], 'Google', 'female')
  if (!/えらんだ声/.test(文型) || !/Google/.test(文型)) {
    ng('声の行 … 文型ドリルで、両方を書いていない', 文型)
  } else ok(`声の行 … 文型ドリル: ${文型}`)
  if (/えらんだ声/.test(単語) || !/Google/.test(単語)) {
    ng('声の行 … 単語 / フレーズは、ぜんぶ代役のはず', 単語)
  } else ok(`声の行 … 単語 / フレーズ: ${単語}`)
  if (/Google/.test(発音)) {
    ng('声の行 … 発音の弱点が付いた教材で、代役が混じっている', 発音)
  } else ok(`声の行 … 発音の弱点つき: ${発音}`)

  /* ── ② **音の付かない演習を、どちらにも入れない** ──
     入れると「読みます」と書いた場所で1本も鳴らない。
     誤り訂正(`audioFrom: null`)がそれである */
  const { pick, base } = voicePlan('pattern', [])
  if ([...pick, ...base].includes('誤り訂正')) {
    ng('声の行 … 音の付かない演習まで数えている', [...pick, ...base].join(' / '))
  } else ok('声の行 … 音の付かない演習(誤り訂正)は、どちらにも入れない')

  /* ── ③ **画面が、その1行を本当に出しているか** ──
     定義だけあって誰も呼ばなければ、何も起きない */
  const form = readFileSync(new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  if (!/voicePlanLine\(kind, tagIds,/.test(form)) {
    ng('声の行 … 教材を作る画面が、その1行を出していない')
  } else ok('声の行 … 教材を作る画面が、`voicePlanLine()` を出す')
  /* **欄には「名前(性別・どこの声か)」を出す**。
     会社の名前は `providerOfVoice()` 1か所から引く(第5.308節)——
     ここに `ElevenLabs` と書き写すと、Google の声にまでそう出る */
  if (!/\{v\.label\}\(\{v\.gender === 'male' \? '男性' : '女性'\}・\{providerOfVoice\(v\.id\)\}\)/.test(form)) {
    ng('声の行 … 欄に、どこの声かを書いていない')
  } else ok('声の行 … 欄は「名前(性別・どこの声か)」')
}

/* ══════════════════════════════════════════════════════════════════
   **Google の声も、欄に並べる**(第5.308節・2026-09-29 利用者の指摘)

     > そして、文型トレーニングの音声の選択肢に Google がひとつも
     > ありませんが、忘れていませんか？

   欄に並んでいたのは ElevenLabs の声だけで、**実際に読んでいる Google の
   声は選べなかった。** 並べたうえで、えらばれたら段を標準に落とす。

   **いちばん危ない形を、検証の中に必ず1つ置く**(CLAUDE.md)——
   ここでは「**おまかせが Google を引き当てないか**」である。
   引き当てたら、何も指定していない教材の声が変わり、
   **すでにある音声が全部作り直しになる**(= 再課金)。
   ══════════════════════════════════════════════════════════════════ */
{
  const {
    BASE_CAST, BASE_VOICES, CLIP_ACCENTS: 訛り一覧, isBaseVoice, pickVoices: おまかせ,
    providerOfVoice, resolveVoices: 整える, voiceChoicesOf, voiceLabel: 名前,
    voicesOfAccent: 良い声だけ,
  } = await import('../src/data/clipVoices.js')
  const { PREMIUM: 良い段, STANDARD: 標準段, picksBaseVoice, voiceTierFor: 段 }
    = await import('../src/lib/voiceTier.js')
  const { voicePlanLine: 行 } = await import('../src/lib/voicePlan.js')

  /* ── ① **欄に、Google の声が並ぶ** ──
     「出る」と「出ない」の両方を見る(CLAUDE.md)——
     `voiceChoicesOf` には出て、`voicesOfAccent`(おまかせが使う)には出ない */
  const 並び = voiceChoicesOf('us').map((v) => v.id)
  const 混ぜ物 = 良い声だけ('us').map((v) => v.id).filter((id) => isBaseVoice(id))
  if (!並び.includes('us-female') || !並び.includes('us-male')) {
    ng('Google の声 … 欄に並んでいない', 並び.join(' / '))
  } else ok(`Google の声 … 欄に並ぶ(${並び.length} 人のうち us-female / us-male)`)
  if (混ぜ物.length) {
    ng('Google の声 … おまかせの名簿にまで混ざっている(既存の教材の声が変わる)',
      混ぜ物.join(' / '))
  } else ok('Google の声 … おまかせの名簿(`voicesOfAccent`)には混ざっていない')

  /* **おまかせを実際に 200 回まわす。** 名簿を見るだけでは、
     `pickVoices` が別の道で引いていたときに素通りする */
  const 引いた = new Set()
  for (let i = 0; i < 200; i += 1) {
    for (const 訛 of 訛り一覧) for (const id of おまかせ(訛.id, 3)) 引いた.add(id)
  }
  const 事故 = [...引いた].filter((id) => isBaseVoice(id))
  if (事故.length) {
    ng('Google の声 … おまかせが引き当てた(= 再課金)', 事故.join(' / '))
  } else ok(`Google の声 … おまかせを ${訛り一覧.length} 訛り × 200 回まわしても引かない`)

  /* ── ② **どの訛りでも、男女2人ずつ並ぶ** ──
     1つの訛りだけ見ると「無ければ素通り」になる(CLAUDE.md) */
  const 足りない = 訛り一覧
    .map((a) => [a.id, voiceChoicesOf(a.id).filter((v) => v.base).map((v) => v.gender)])
    .filter(([, g]) => !(g.includes('female') && g.includes('male')))
    .map(([id, g]) => `${id} … ${g.join(' / ') || '(0人)'}`)
  if (足りない.length) {
    ng('Google の声 … 男女そろっていない訛りがある', 足りない.join('\n    '))
  } else ok(`Google の声 … ${訛り一覧.length} 訛りぜんぶで男女2人`)

  /* ── ③ **えらぶと、段が標準に落ちる** ──
     **落ちる / 落ちない の両方**を見る。片方だけだと、
     **いつも標準に落とす形**に書き換えても緑のままになる */
  const 本文 = { exerciseType: 'article', tags: [] }
  if (段({ ...本文, voiceIds: ['us-1'] }) !== 良い段) {
    ng('Google の声 … ElevenLabs をえらんだのに、良い段にならない')
  } else ok('Google の声 … ElevenLabs をえらべば、本文は良い段のまま')
  if (段({ ...本文, voiceIds: ['us-female'] }) !== 標準段) {
    ng('Google の声 … えらんでも、良い段のままになっている(中身は標準の音)')
  } else ok('Google の声 … えらぶと、本文でも標準の段に落ちる')
  /* **1人でも混じっていれば落とす**(会話で役ごとに段は変えられない) */
  if (段({ ...本文, voiceIds: ['us-1', 'us-male'] }) !== 標準段) {
    ng('Google の声 … 2人のうち1人が Google でも、良い段のままになっている')
  } else ok('Google の声 … 2人のうち1人でも Google なら、ぜんぶ標準の段')
  /* **えらんでいないときは、これまでと1つも変わらない**(= 作り直さない) */
  for (const 空 of [undefined, null, []]) {
    if (段({ ...本文, voiceIds: 空 }) !== 良い段) {
      ng('Google の声 … 声をえらんでいない教材の段まで変わった(= 全部作り直し)',
        String(空))
    }
  }
  ok('Google の声 … 声をえらんでいない教材の段は、これまでどおり')
  /* **弱点タグ(発音)より強い。** 読む声が無いのだから、そちらが勝つ */
  if (段({ exerciseType: 'jp_to_en', tags: ['l-r'], voiceIds: ['uk-male'] }) !== 標準段) {
    ng('Google の声 … 発音の弱点が付くと、良い段に引き戻されている')
  } else ok('Google の声 … 発音の弱点が付いていても、標準の段に落ちる')

  /* ── ④ **すべての `voiceTierFor(` が、えらんだ声を渡しているか** ──
     1か所でも渡し忘れると、**そこだけ良い段の置き場所を探し**、
     支度した MP3 と食い違って1本も当たらない(CLAUDE.md「数え方を2通り持たない」)。
     **名前が出てくるかでは見ない** —— コメントを落としてから、
     呼び出しの丸かっこを数えて中身を見る */
  {
    const 見る = (dir) => {
      const out = []
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const q = `${dir}/${e.name}`
        if (e.isDirectory()) out.push(...見る(q))
        else if (/\.(js|jsx)$/.test(e.name)) out.push(q)
      }
      return out
    }
    const 抜け = []
    let 数 = 0
    for (const f of 見る(new URL('../src', import.meta.url).pathname)) {
      if (f.endsWith('voiceTier.js')) continue
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
      let i = 0
      for (;;) {
        const at = src.indexOf('voiceTierFor({', i)
        if (at < 0) break
        let d = 0; let j = at + 'voiceTierFor('.length; let end = -1
        for (; j < src.length; j += 1) {
          if (src[j] === '{' || src[j] === '(') d += 1
          else if (src[j] === '}' || src[j] === ')') { d -= 1; if (d === 0) { end = j; break } }
        }
        数 += 1
        if (!/\bvoiceIds\b/.test(src.slice(at, end + 1))) {
          抜け.push(`${f.split('/src/')[1]} … ${src.slice(at, end + 1).replace(/\s+/g, ' ')}`)
        }
        i = end + 1
      }
    }
    if (数 < 10) ng('Google の声 … 呼び出しを数えられていない(探し方が壊れている)', 数)
    else if (抜け.length) {
      ng('Google の声 … えらんだ声を渡していない `voiceTierFor(` がある', 抜け.join('\n    '))
    } else ok(`Google の声 … ${数} か所の \`voiceTierFor(\` が、ぜんぶ えらんだ声を渡す`)
  }

  /* ── ⑤ **えらんだ Google の声が、保存まで残るか** ──
     `findVoice()` が引けないと `resolveVoices()` が黙って落とし、
     **代役に戻って、何も変わらない**(「何も変わらない = 届いていない」) */
  if (整える(['us-male'])[0] !== 'us-male') {
    ng('Google の声 … 保存する並びから落ちている', 整える(['us-male']).join(' / '))
  } else ok('Google の声 … 保存する並びに残る')

  /* ── ⑥ **呼び名を変えていない** ──
     `BASE_CAST` を足した日に、画面に出る文字が変わってはいけない */
  if (名前('us-female') !== '標準の声(アメリカ・女性)') {
    ng('Google の声 … 画面に出る名前が変わった', 名前('us-female'))
  } else ok(`Google の声 … 画面に出る名前は これまでどおり(${名前('us-female')})`)
  const 会社 = BASE_CAST.map((v) => providerOfVoice(v.id))
  if (会社.some((c) => c !== 'Google') || 会社.length !== BASE_VOICES.length) {
    ng('Google の声 … 会社の名前が Google になっていない', 会社.join(' / '))
  } else ok(`Google の声 … ${会社.length} 人とも「Google」と出る`)
  if (providerOfVoice('us-1') !== 'ElevenLabs') {
    ng('Google の声 … ElevenLabs の声にまで Google と出ている', providerOfVoice('us-1'))
  } else ok('Google の声 … ElevenLabs の声は「ElevenLabs」のまま')

  /* ── ⑦ **黙って落とさない。欄の下の1行が変わる** ── */
  const 良い行 = 行('pattern', [], 'Google', 'female', ['us-1'])
  const 標準行 = 行('pattern', [], 'Google', 'female', ['us-female'])
  if (!/えらんだ声/.test(良い行)) {
    ng('声の行 … ElevenLabs をえらんだのに「えらんだ声」が消えた', 良い行)
  } else ok(`声の行 … ElevenLabs をえらぶと: ${良い行}`)
  if (/えらんだ声/.test(標準行) || !/すべて/.test(標準行)) {
    ng('声の行 … Google をえらんでも「えらんだ声で読む」と出ている(黙って落としている)',
      標準行)
  } else ok(`声の行 … Google をえらぶと: ${標準行}`)

  /* ── ⑧ **画面が、本当にこの形になっているか** ──
     道具だけ直しても、画面が古い名簿を見ていれば何も変わらない。
     **コメントを落としてから、使っている形で数える**(CLAUDE.md) */
  const form = readFileSync(new URL('../src/components/MaterialForm.jsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  if (!/voiceChoices\.map\(\(v\) =>/.test(form)) {
    ng('Google の声 … 欄が、まだ ElevenLabs だけの名簿を並べている')
  } else ok('Google の声 … 欄は `voiceChoices`(ElevenLabs + Google)を並べる')
  if (!/voiceChoices\.some\(\(v\) => v\.id === want\)/.test(form)) {
    ng('Google の声 … 指名の検査が ElevenLabs だけの名簿を見ている(えらんでもおまかせに戻る)')
  } else ok('Google の声 … 指名の検査も `voiceChoices` を見る')
  /* **欄の下の1行にも、えらんだ声を渡しているか。**
     道具の側(⑦)だけ見ていたので、**画面が渡し忘れても緑のまま**だった
     —— 赤チェックで1本だけ緑のままになり、それで気づいた(第5.308節) */
  /* **引数の並びを丸ごと書き写さない**(2026-09-29 に踏んだ)。
     第5.309節で `examKey` を足した日に、`cast)` で閉じなくなり、
     **画面は正しいのに、この見張りだけが赤くなった。**
     見たいのは「`cast` を渡しているか」1つだけなので、そこだけ見る */
  if (!/voicePlanLine\(kind, tagIds,[\s\S]{0,300}?, cast[,)]/.test(form)) {
    ng('Google の声 … 欄の下の1行に、えらんだ声を渡していない(黙って落とす)')
  } else ok('Google の声 … 欄の下の1行にも、えらんだ声を渡す')
  /* **効かない操作を見せない** —— Google に `stability` は無い */
  if (!/voicePool\.length > 0 &&[\s\S]{0,40}?!picksBaseVoice\(cast\) &&/.test(form)) {
    ng('Google の声 … 「声の出し方」が、効かないのに出たままになっている')
  } else ok('Google の声 … Google をえらぶと「声の出し方」を出さない')
  if (!picksBaseVoice(['us-1', 'uk-female']) || picksBaseVoice(['us-1'])
      || picksBaseVoice([]) || picksBaseVoice(null)) {
    ng('Google の声 … `picksBaseVoice()` の見分けが合っていない')
  } else ok('Google の声 … `picksBaseVoice()` は、混じっているときだけ true')
}

console.log(bad === 0 ? '\n✅ 声と役の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
