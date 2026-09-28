/**
 * **セッションの記録を、1本にまとめて見る**(第5.303節・2026-09-28 利用者の指定)。
 *
 *   > ゲストとトレーナー共有のセッションの記録をまとめて一本化、
 *   > つまり日付と内容を見出しをつけてまとめて出力する機能や、
 *   > セッションの記録内の単語やフレーズを元に教材を作れたりすると最高です。
 *
 * ============================================================================
 * 【props で受け取るだけにしてある】
 *
 *   **描けないものは測れない**(CLAUDE.md)。自分で読みに行く部品は
 *   Supabase の繋がらないこの環境では**1度も描けない**ので、
 *   読むのは `LessonNotes`、並べるのはここ、と分けてある
 *   (`SpeechPractice` / `QrCard` / `ShelfAssign` / `VolumeRow` と同じ作法)。
 *   骨組み(`?screen=notesdigest`)は、これを**本物のまま**描いて測る。
 *
 * 【語句から教材を作る道は、すでにある1つを使う】
 *
 *   単語帳の「この語で教材を作る」(`Wordbook` の `onMakeMaterial`)と
 *   **まったく同じ道**である —— 呼ぶ側(`TrainerLearners`)が
 *   `mustUse` に入れて「教材を作る」へ移す。
 *   **この画面のためだけの仕組みは1つも作っていない**(CLAUDE.md)。
 *
 * 【0円】
 *
 *   語句は記録に書いてある英字を決まりで拾うだけで、**AI を呼ばない**
 *   (`noteDigest.js` の `noteWords()`)。
 *
 * 【押すものは、一覧の末尾に置かない】(共通ルール・2026-09 利用者の指定)
 *
 *   語句は何十個にもなる。**見出しの行**(畳みの札と同じ行)に置くので、
 *   畳んでいても押せて、**場所が語数で動かない。**
 * ============================================================================
 */
import { noteDay } from '../lib/noteDigest.js'
import { TONE_GO, TONE_ROW, TONE_SIDE } from '../lib/btnTone.js'
import SteadyLabel from './SteadyLabel.jsx'
import { PrintIcon } from './Icons.jsx'

/** 印刷のボタンの文言。**一覧は1つ**(出すのにも、場所を取るのにも使う) */
export const PRINT_WORDS = ['印刷 / PDFで保存', '紙に出しています…']

/** 選べる語句の上限。**単語帳とそろえる**(1つの教材に収まる数) */
export const MAX_PICK = 20

export default function NotesDigest({
  /** 日付ごとの節(`noteSections()` が組んだもの) */
  sections = [],
  /** 記録の中から拾った語句(`noteWords()`)。**トレーナーのときだけ使う** */
  words = [],
  /** いま選んでいる語句 */
  picked = [],
  /** 語句の一覧を開いているか */
  wordsOpen = false,
  onWordsOpen = null,
  onPick = null,
  onClear = null,
  /** **これが無ければ、語句の欄ごと出さない**(効かない操作を見せない) */
  onMake = null,
  /** 紙に出す */
  onPrint = null,
  printing = false,
  /** 1日ずつの画面へ戻る */
  onBack = null,
  loading = false,
  error = '',
}) {
  const days = sections.length

  return (
    <div className="stack ndg">
      {/* ── 帯。**別々の物は `gap` で離す**(共通ルール)───────────── */}
      <div className="ndg-bar">
        <button type="button" className={`btn btn--small ${TONE_SIDE}`}
                onClick={() => onBack?.()}>1日ずつ</button>
        {/* **いまの状態**(残してよい3つのうちの1つ・共通ルール) */}
        <span className="muted ndg-count">{days} 日</span>
        <button type="button" className={`btn btn--small ${TONE_ROW} ndg-print`}
                disabled={!days || printing}
                onClick={() => onPrint?.()}>
          <PrintIcon />
          {/* **押しても、まわりの物が動かない**(共通ルール)——
              文言が入れ替わっても幅が変わらないよう、広いほうを取っておく */}
          <SteadyLabel keep={PRINT_WORDS}>
            {printing ? PRINT_WORDS[1] : PRINT_WORDS[0]}
          </SteadyLabel>
        </button>
      </div>

      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {/* ── 記録の中の語句(**トレーナーだけ**)──────────────────
          **長い一覧は、開くまで羅列しない**(共通ルール)。
          押すものは**見出しの行**に置く —— 語が増えても場所が動かない */}
      {onMake && words.length > 0 && (
        <div className="ndg-words">
          <div className="ndg-words-head">
            <button type="button" className={`btn btn--small ${TONE_SIDE} ndg-words-toggle`}
                    aria-expanded={wordsOpen}
                    onClick={() => onWordsOpen?.(!wordsOpen)}>
              記録の中の語句 {words.length}
            </button>
            {/* **選んでいるときだけ出す。** 効かない操作を見せない */}
            {picked.length > 0 && (
              <>
                <span className="muted ndg-picked">{picked.length} 選んでいます</span>
                <button type="button" className="btn btn--link btn--small"
                        onClick={() => onClear?.()}>選び直す</button>
                <button type="button" className={`btn btn--small ${TONE_GO}`}
                        onClick={() => onMake?.(picked)}>この語で教材を作る</button>
              </>
            )}
          </div>
          {wordsOpen && (
            <div className="ndg-chips">
              {words.map((w) => {
                const on = picked.includes(w)
                return (
                  <button type="button" key={w} lang="en"
                          className={`btn btn--small btn--toggle${on ? ' is-active' : ''}`}
                          aria-pressed={on}
                          disabled={!on && picked.length >= MAX_PICK}
                          onClick={() => onPick?.(w)}>{w}</button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 日付ごとに、見出しを付けて並べる ──────────────────── */}
      {loading ? (
        <p className="muted">開いています…</p>
      ) : !days ? (
        <p className="muted">まだありません。</p>
      ) : (
        <div className="ndg-list">
          {sections.map((sec) => (
            <section className="ndg-day" key={sec.date}>
              <h4 className="ndg-date">{noteDay(sec.date)}</h4>
              {sec.parts.map((p) => (
                <div className="ndg-part" key={p.who}>
                  <p className="field-label">{p.who}</p>
                  {/* **改行はそのまま出す**(1日ずつの画面と同じ `.notes-read`) */}
                  <div className="notes-read">{p.text}</div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
