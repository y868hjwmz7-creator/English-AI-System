/**
 * ============================================================================
 * **どの相棒にするか**(第5.373節・2026-10-05 利用者の指定)
 *
 *   > というよりユーザーが選べるようにしたいです
 *
 *   こちらが1つに決める必要は、そもそも無かった。
 *   **使う人が、自分の相棒をえらぶ。**
 *
 * ── 置き場所は、配色や説明の文とまったく同じ ────────────────
 *
 *   **端末ごとに覚える**(`localStorage`)。SQL は1行も要らない。
 *   同じ会社の PC を何人かで使っても、**開いている人が自分で選び直せる**
 *   —— 配色・押したときの音・音量と、同じ扱いである。
 *
 * ── **一覧はここだけ。** 画面の中で `kind === '…'` と書かない ──
 *
 *   増やすときも減らすときも、ここ1か所を直す
 *   (CLAUDE.md「判断は1か所に持つ」)。
 *   **並べ替えも「減らす」に当たる**ので、順番も勝手に変えない。
 *
 * ── **素の node で走る** ────────────────────────────────────
 *
 *   React も `localStorage` も要らない形にしてあるので、
 *   `npm run test:feel` が画面を描かずに確かめられる。
 * ============================================================================
 */

/**
 * 相棒の一覧。**この順で画面に並ぶ。**
 *
 * **12 体の妖怪**(2026-10-05 利用者の指定「妖怪シリーズにしてください」)。
 * 立ち姿・1色・手描きの線。**ひと目で誰か分かるもの**だけを選んである ——
 * 名前を知らない妖怪を並べても、選びようがない。
 *
 * **素材サイトの絵は1つも写していない。** 妖怪は昔からある題材なので、
 * 作風だけを合わせて、こちらで描き起こした。
 */
export const BUDDY_KINDS = [
  { id: 'kappa', label: 'かっぱ' },
  { id: 'oni', label: 'おに' },
  { id: 'tengu', label: 'てんぐ' },
  { id: 'yuki', label: 'ゆきおんな' },
  { id: 'kasa', label: 'からかさ' },
  { id: 'zashiki', label: 'ざしきわらし' },
  { id: 'nurikabe', label: 'ぬりかべ' },
  { id: 'rokuro', label: 'ろくろくび' },
  { id: 'bakeneko', label: 'ばけねこ' },
  { id: 'konaki', label: 'こなきじじい' },
  { id: 'momen', label: 'いったんもめん' },
  { id: 'hitotsume', label: 'ひとつめこぞう' },
]

/**
 * 何も選んでいない人に出す相棒。
 * **かっぱにしてある** —— ひと目で妖怪と分かり、顔がはっきり描ける。
 */
export const BUDDY_KIND_DEFAULT = 'kappa'

/** 覚えておく鍵。**画面に鍵の名前を書かない**(`TIPS_KEY` と同じ作法) */
export const BUDDY_KIND_KEY = 'eas.buddyKind'

/**
 * 選んだことを、同じ画面の相棒たちに知らせる合図。
 * **これが無いと、設定を閉じるまで絵が変わらない。**
 */
export const BUDDY_KIND_EVENT = 'eas-buddy-kind'

/**
 * 読み取った値を、**必ず一覧の中のどれか**にして返す。
 * **知らない値は既定に落とす** —— 古い端末に別の名前が残っていても、
 * 相棒が1人も出ない、ということにはしない(行き止まりを作らない)。
 */
export function buddyKindOf(v) {
  return BUDDY_KINDS.some((k) => k.id === v) ? v : BUDDY_KIND_DEFAULT
}

/** いま選ばれている相棒。**読めなくても既定に落ちるだけ** */
export function loadBuddyKind() {
  try {
    return buddyKindOf(window.localStorage.getItem(BUDDY_KIND_KEY))
  } catch {
    return BUDDY_KIND_DEFAULT
  }
}

/** 選んだものを覚えて、**いま描かれている相棒たちに知らせる** */
export function saveBuddyKind(v) {
  const id = buddyKindOf(v)
  try { window.localStorage.setItem(BUDDY_KIND_KEY, id) } catch { /* 覚えられなくても動く */ }
  try {
    window.dispatchEvent(new CustomEvent(BUDDY_KIND_EVENT, { detail: id }))
  } catch { /* 合図を出せなくても、次に開いたときには変わっている */ }
  return id
}
