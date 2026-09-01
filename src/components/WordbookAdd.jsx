/**
 * 単語帳に、**手で語句を入れる**(2026-09 利用者の指定)。
 *
 *   > 単語帳に手打ちで入力できる機能をつけてくれ
 *
 * 【なぜ要るか】
 *   これまで単語帳に入るのは、**教材の中で触れた語**だけだった。
 *   けれども覚えたい語は、教材の外でも出てくる
 *   (レッスン中の会話、映画、仕事のメール)。
 *   その場で入れられないと、**紙にメモして忘れる。**
 *
 * 【入れ物は増やさない】
 *   入り口が違うだけで、入る先はこれまでと同じ `word_reviews` である。
 *   `mark_word()` をそのまま呼ぶので、**SQL は要らない。**
 *   復習の出方(箱・間隔)も、教材から入った語とまったく同じになる。
 *
 * 【意味は、入れたときに1回だけ引く】
 *   単語帳の画面は**控えを読むだけ**で、AI に尋ね直さない。
 *   だから手で入れた語は、そのままでは
 *   **「意味の控えがありません」のまま**になってしまう。
 *   入れた直後に1回だけ引いて控える(1語あたり約0.1円。
 *   控えはスクール全体で共有されるので、2人目からは無料)。
 *   **開くたびには引かない**(発音記号・要点フレーズと同じ考え方)。
 *
 *   引けなくても**語は入る。** 意味は、あとで教材の中で触れたときに付く。
 *
 * 【1語ずつ】
 *   まとめて貼り付けられるようにはしていない。
 *   出会った文を一緒に入れられるようにしてあり、
 *   **語と文は1対1**だからである。
 *
 * 【誰の単語帳に入るのか】(2026-09 利用者の指定)
 *
 *   > トレーナーエンドのゲストの単語帳にはトレーナーもゲストも手打ちで
 *   > 単語やフレーズを入れれるようにして下さい。
 *
 *   `learnerId` を渡すと、**そのゲストの単語帳**に入る(0025 の `p_learner`)。
 *   渡さなければ、これまでどおり自分の単語帳。
 *   **どちらに入るのかは、ボタンの文言に出す。** 黙っていると、
 *   トレーナーが自分の単語帳に入れたつもりになる。
 *   担当していないゲストには、SQL 側(`mark_word`)が書かせない。
 */
import { useRef, useState } from 'react'
import { lookupWord, normWord, setWordStatus } from '../lib/vocab.js'
import { PlusIcon } from './Icons.jsx'

export default function WordbookAdd({
  level = 'B1', learnerId = null, learnerName = '', onAdded = null,
}) {
  /* **誰の単語帳に入るのかを、はっきり言う**(2026-09)。
     トレーナーがゲストのカードから入れるときは、入る先はゲストである。
     ここを黙っていると、自分の単語帳に入れたつもりになる */
  const name = String(learnerName ?? '').trim()
  const honored = /(さん|様|先生)$/.test(name) ? name : `${name} さん`
  const whose = learnerId
    ? `${name ? honored : 'このゲスト'}の単語帳` : '単語帳'
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [seen, setSeen] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)
  const wordRef = useRef(null)

  const norm = normWord(word)
  /** 空白を含めば言い回し。**鍵は「そろえた形」なので、判定はここだけ** */
  const kind = norm.includes(' ') ? 'phrase' : 'word'

  const add = async () => {
    setError(null)
    setNote(null)
    if (!norm) {
      setError('英語の語句を入れてください。日本語や記号だけでは入りません。')
      return
    }
    setBusy(true)
    const sentence = seen.trim() || null
    // **先に意味を引いて控える。** 引いてから入れると、
    // 入れ終わった時点でもう意味が出ている
    const { error: lookupError } = await lookupWord({
      word: word.trim(), sentence: sentence ?? word.trim(), level,
    })
    const { error: e } = await setWordStatus(word, 'unknown', {
      kind, sentence, learnerId,
    })
    setBusy(false)
    if (e) { setError(e); return }

    // **何が入ったのかを、そのまま見せる。** 「追加しました」だけでは、
    // どの形で入ったのか(語か、言い回しか)が分からない
    setNote(`「${norm}」を${kind === 'phrase' ? '言い回し' : '語'}として`
      + `${whose}に入れました。`
      + (lookupError ? ' 意味の控えは取れませんでした。' : ''))
    setWord('')
    setSeen('')
    // 続けて入れられるように、入力欄へ戻す
    wordRef.current?.focus()
    onAdded?.()
  }

  return (
    <div className="wb-add">
      <button type="button" className="btn btn--ghost btn--small wb-add-open"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        <PlusIcon />
        {open ? '手で入れるのをやめる' : '語句を手で入れる'}
      </button>

      {open && (
        <div className="wb-add-body">
          <label className="field">
            <span>
              語句
              <span className="field-hint">
                英語で。2語以上なら言い回しとして入ります
              </span>
            </span>
            <input ref={wordRef} type="text" lang="en" value={word}
                   placeholder="resilient / look forward to"
                   onChange={(e) => setWord(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && !busy) add() }} />
          </label>
          <label className="field">
            <span>
              出会った文
              <span className="field-hint">
                任意。あとで思い出す手がかりになります
              </span>
            </span>
            <input type="text" lang="en" value={seen}
                   placeholder="She stayed resilient through the whole project."
                   onChange={(e) => setSeen(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter' && !busy) add() }} />
          </label>

          <div className="btn-row">
            <button type="button" className="btn btn--primary"
                    disabled={busy || !norm} onClick={add}>
              {busy ? '入れています…' : `${whose}に入れる`}
            </button>
          </div>

          {/* **押した場所のすぐ下に出す**(CLAUDE.md)。
              うまくいったかどうかが、その場で分かるようにする */}
          {note && <p className="notice notice--ok wb-add-note">{note}</p>}
          {error && <p className="notice notice--error wb-add-note">{error}</p>}
          <p className="field-hint">
            入れた語は<strong>「まだ」</strong>から始まります。
            復習に出てくるので、そこで「覚えた」まで持っていきます。
          </p>
        </div>
      )}
    </div>
  )
}
