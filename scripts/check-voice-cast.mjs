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
import { castClipSpeakers } from '../src/lib/voiceCast.js'
import {
  CLIP_VOICES, findVoice, voiceSettingsOf, voicesOfAccent,
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

// ── 訛りを最大限に活かす指定(2026-09 利用者の指定)────────────────
//
//    > この人を音声として使用する際は、必ず元のアクセントを最大限
//    > 生かしすようなコードを必ず使用してください。
//
//    「必ず」なので、**渡す道が1本でも切れていたら赤くする。**
//    渡らなくても音は鳴る(既定で作られる)ので、**気づけない。**
{
  const keep = CLIP_VOICES.filter((v) => v.keep)
  if (!keep.length) ok('いま「訛りを活かす」を付けた声は無い')
  else {
    for (const v of keep) {
      const st = voiceSettingsOf(v.id)
      if (!st) ng(`${v.label} に、訛りを活かす指定が付いていない`)
      else if (Number(st.similarity_boost) < 1) {
        ng(`${v.label} の similarity_boost が最大でない`,
          'もとの録音に寄せるほど訛りが残る。1 にする')
      } else ok(`${v.label} … 訛りを活かす指定が付いている`)
    }
    // **付けていない声には送らない**(いまの音を変えないため)
    const plain = CLIP_VOICES.find((v) => !v.keep)
    if (plain && voiceSettingsOf(plain.id)) {
      ng('付けていない声にまで指定が付いている', `${plain.label} に付いている`)
    } else if (plain) ok('付けていない声には、何も添えない')
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
