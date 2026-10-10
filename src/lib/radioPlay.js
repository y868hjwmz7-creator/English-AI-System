/**
 * **1枚ぶんを鳴らす**(第5.445節・2026-10-10 利用者の指定)。
 *
 * ============================================================================
 * 【なぜ切り出したか】
 *
 *   > 基本的に単語帳で取り組んでいる最中に聞き流しに移行したりするので、
 *   > そのままのデザインでできないのですか？
 *   > シャッフルやリピートのボタンも消え不便です。
 *
 *   聞き流しは**別の画面**(`WordRadio`)だった。そこへ飛ぶと、
 *   練習のカードも、シャッフルも、くり返すも、問数も消えていた。
 *
 *   **画面を分けるのをやめ、練習のカードのまま「流す」状態にする。**
 *   そうすると鳴らす算段が**2か所**に要る —— 聞き流しの画面と、
 *   練習のカード。**書き写せば必ず食い違う**(CLAUDE.md
 *   「数え方を2通り持たない」)ので、**ここ1か所**に置いて両方が通る。
 *
 * ============================================================================
 * 【差し替えられる口を持たせた理由】
 *
 *   鳴らす道具(`readAloud` / `prepareRead` / `quietWait`)は
 *   Supabase と `import.meta.env` を引き連れており、**素の node で
 *   1度も走らせられない。** だから**呼ぶ口を引数**にしてある ——
 *   検証では偽物を渡し、**どの順で何が起きるか**だけを確かめる
 *   (`test:similar` が窓口を偽物で走らせるのと同じ作法)。
 *
 *   **既定は本物**なので、画面の側は何も渡さなくてよい。
 *
 * ============================================================================
 * 【ここが持っている決まり】(どれも、もとの聞き流しから1ミリも変えていない)
 *
 *   ① **何を、どの順で鳴らすか**は `radioSteps()` が決める
 *   ② **間の長さ**は `radioGapsOf()` が決める(3つの間が同じ比で動く)
 *   ③ **長い間は音で置く**(`quietWait`)—— 画面を消しても止まらない
 *      (第5.285節。時計は画面が消えると止まる)
 *   ④ **次の行を、鳴らしているあいだに温める**(`radioWarmups()`)
 *   ⑤ **日本語は窓口の声でだけ読む**(`clipOnly`)—— 端末の声に落とさない
 *   ⑥ **声と段は、その行から**(`radioVoiceOf()`・第5.334節)
 */
import { PREMIUM } from './voiceTier.js'
import { JA_VOICE } from '../data/clipVoices.js'
import { radioGapsOf, radioSteps, radioVoiceOf, radioWarmups } from './wordRadio.js'

/**
 * ★ **本物の道具は、呼ばれたときに取りに行く**(第5.445節)。
 *
 *   `readAloud.js` は `audioClips.js` を通じて Supabase と
 *   `import.meta.env` を引き連れている。**頭で取り込むと、
 *   読み込んだだけで素の node が落ちる**(実測:
 *   `Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')`)——
 *   それだと、この算段を**1度も測れない。**
 *
 *   **偽物を渡されたときは、本物を取りに行かない。**
 *   画面からは何も渡らないので、そのときだけ取りに行く。
 */
let 道具 = null
const 本物 = async () => {
  if (!道具) {
    const [ra, ac] = await Promise.all([import('./readAloud.js'), import('./audioClips.js')])
    道具 = { speak: ra.readAloud, warm: ra.prepareRead, pause: ac.quietWait }
  }
  return 道具
}

/** 鳴らし終わった理由。画面はこれを見て、次へ送るかどうかを決める */
export const PLAYED = 'played'   // ふつうに鳴り終わった
export const EMPTY = 'empty'     // 読むものが無い行だった
export const STOPPED = 'stopped' // 途中で止められた(閉じた・次へ送られた)

/**
 * その行を、決まった順に鳴らす。**次へ送るのは呼ぶ側の役目**である
 * (練習のカードは「答えたら次」、聞き流しは「鳴り終わったら次」と
 * 送り方が違うため)。
 *
 * @param {object} row 単語帳 / Quick Response の1行
 * @param {object} o
 * @param {string} o.mode   読み方(`radioModesFor()` の id)
 * @param {number} o.gap    間の長さ(ミリ秒。3つの間の元になる)
 * @param {number} o.rate   速さ
 * @param {object} o.next   次に出る行(温めるためだけに使う)
 * @param {function} o.alive  まだ生きているか(閉じたら false)
 * @param {function} o.here   まだこの行か(「次へ」で送られたら false)
 * @param {function} o.onSay  いま何を読んでいるか('en' / 'ja' / 'you' / null)
 * @param {function} o.onLine 画面に出す文字(かたまりのときは、かたまり)
 * @param {function} o.onOpen 答えを開くか
 * @param {function} o.onNext 次へ送る(鳴り終わった直後・間を置く前)
 * @returns {Promise<'played'|'empty'|'stopped'>}
 */
export async function playRadioRow(row, {
  mode, gap, rate = 1, next = null,
  alive = () => true, here = () => true,
  onSay = () => {}, onLine = () => {}, onOpen = () => {},
  /** **次へ送る。** 鳴り終わった直後・間を置く**前**に呼ばれる(下を見よ) */
  onNext = () => {},
  /* **差し替えられる口**(検証では偽物を渡す。渡さなければ本物) */
  speak = null, warm = null, pause = null,
} = {}) {
  const r = (speak && warm && pause) ? null : await 本物()
  const 鳴らす = speak || r.speak
  const 温める = warm || r.warm
  const 待つ = pause || r.pause
  /* **長い間は音で置く。** `quietWait` が 0.15 秒を境に決める ——
     画面の中で 150 と書かない(第5.285節) */
  const wait = (ms) => 待つ(ms, alive)

  /* **次の行を、いま鳴らしているあいだに温める**(第5.251節)。
     **何を温めるかは `radioWarmups()` が決める** —— ここで
     「言う練習なら訳も」と書くと、読む順を変えた日に先読みだけが古くなる。
     **費用は増えない** —— どのみち次に鳴らすものである */
  if (next) {
    for (const w of radioWarmups(next, mode)) {
      温める(w.text, w.ja ? { clipVoice: JA_VOICE, clipTier: PREMIUM } : radioVoiceOf(next))
    }
  }

  /* **問が変わったら、答えは閉じる。** 前の問の英文が残っていると、
     次の問の「言う番」に前の答えが出たままになる */
  onLine(null); onOpen(false)

  const steps = radioSteps(row, mode, gap)
  /* **読むものが無い行は、待たずに次へ。**「読んだことにして」間だけ
     置くと、無音の時間が延びるだけである */
  if (!steps.length) return EMPTY

  const gaps = radioGapsOf(gap, mode)
  for (const st of steps) {
    if (!alive()) return STOPPED
    /* 「次へ」で移されたら、この行はもう読まない */
    if (!here()) return STOPPED
    /* **「言う番」は、ただの間ではない。** 画面にそう出す ——
       黙って止まっていると、待たされているのか壊れたのか分からない */
    if (st.kind === 'wait') {
      onSay(st.you ? 'you' : null)
      await wait(st.ms)
      continue
    }
    onSay(st.kind)
    /* **鳴らすものを、そのまま画面に出す。** ここで開く(答えは、鳴ってから) */
    onLine(st.text); onOpen(true)
    /* **描き替えを1手待ってから鳴らす** —— すぐ鳴らすと音が先、文字があと
       になる(実測)。`requestAnimationFrame` は別のタブで止まるので使わない */
    await wait(0)
    if (!alive() || !here()) return STOPPED
    /* **日本語は窓口の声でだけ読む**(`clipOnly`)。作れなかったときは
       鳴らさずに次へ —— 落ちた先で悪い声が鳴るくらいなら、一瞬だまるほうがよい */
    await (st.kind === 'ja'
      ? 鳴らす(st.text, { rate, clipVoice: JA_VOICE, clipTier: PREMIUM, clipOnly: true })
      : 鳴らす(st.text, { rate, ...radioVoiceOf(row) }))
  }
  if (!alive()) return STOPPED
  onSay(null)
  /* 「次へ」で移されていたら、**語のあいだの間は置かない。**
     押したのに 0.9 秒だまるのは、効いていないように見える */
  if (!here()) return STOPPED
  /* ★ **進めるのが先、間を置くのがあと**(もとの聞き流しのまま)。
       React は `setAt()` をその場では描き替えないので、**間よりあとに
       進めると、音が出た時点で画面がまだ1つ前**になる
       (実測:「gist」を読んでいるのに画面は「take on」)。
       先に進めておけば、語と語のあいだで必ず追いつく。

       **この順を、呼ぶ側に書かせない。** 2か所(聞き流しと練習のカード)
       から呼ぶので、**書き写せば必ず片方だけ古くなる** */
  onNext()
  await wait(gaps.word)
  return alive() ? PLAYED : STOPPED
}
