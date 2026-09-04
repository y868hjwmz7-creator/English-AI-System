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
  ACCENT_KEEP, CLIP_VOICES, findVoice, voiceSettingsOf, voicesOfAccent,
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
}

console.log(bad === 0 ? '\n✅ 声と役の検証は、すべて意図どおりです' : `\n❌ ${bad} 件`)
process.exit(bad === 0 ? 0 : 1)
