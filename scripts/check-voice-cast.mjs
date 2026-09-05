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
import { readFileSync } from 'node:fs'
import {
  castClipSpeakers, castLine, castList, remakeModeOf, sameVoices,
} from '../src/lib/voiceCast.js'
import {
  ACCENT_KEEP, CLIP_VOICES, V2, V3, findVoice, voiceModelOf, voiceSettingsOf,
  voicesOfAccent,
} from '../src/data/clipVoices.js'

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
  if (/voiceIds:\s*cast\b/.test(form)) ok('保存する声は、決めた1つ(cast)を使っている')
  else {
    ng('保存する声が、決めた1つ(cast)ではない',
      '作るときに伝えた性別と、保存する声がずれる')
  }
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
  if (!/remakeModeOf\(/.test(vr)) {
    ng('画面が、走る道を自分で決めている', '`remakeModeOf()` 1か所に任せる')
  } else ok('画面は `remakeModeOf()` に任せている')
  // **押す前に、本数と課金になることを書く**(見えない費用は管理できない)
  if (!/課金/.test(vr) || !/clipCount/.test(vr)) {
    ng('作り直す本数と、課金になることを書いていない')
  } else ok('押す前に、本数と課金になることが書いてある')
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

console.log(bad === 0 ? '\n✅ 声と役の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
