/**
 * 教材の**中身**(演習と設問)。開いたときに出る部分。
 *
 * 【なぜ部品にしたか】(2026-08 利用者の指定)
 *
 *   > 宿題の表示をトレーナーの教材の表示と統一してください。
 *
 *   同じ中身を、トレーナーの「教材」と、ゲストの情報の中の「過去の宿題」の
 *   両方から開けるようにした。**同じ見た目を2か所に書き写さない**
 *   (CLAUDE.md)。書き写すと、必ず片方だけ古くなる。
 *
 * 【切り出しただけで、見た目は変えていない】
 *   `TrainerMaterials` にあったものをそのまま移してある。
 *   **寄せたついでに直さない**(共通ルール)。
 *
 * 【印刷】
 *   `id="material-<教材id>"` を持たせてあるので、呼ぶ側は
 *   `printElement(document.getElementById(...))` で紙に出せる。
 *   紙用の見出し(`print-only`)もここに入っている。
 */
import MaterialTitle from './MaterialTitle.jsx'
import Tabs from './Tabs.jsx'
import SpeakButton from './SpeakButton.jsx'
import EnglishText from './EnglishText.jsx'
import PhraseChips from './PhraseChips.jsx'
import Phonetic from './Phonetic.jsx'
import { PrintIcon } from './Icons.jsx'
import { printElement } from '../lib/print.js'
import { cefrLabel } from '../data/cefr.js'
import { weaknessTagLabel } from '../data/weaknessTags.js'
import { industryLabel } from '../data/industries.js'
import { countLabel, exerciseLabel, exerciseType } from '../data/exerciseTypes.js'
import { kindLabel } from '../lib/materials.js'
import { clearMaterialProgress, hasMaterialProgress } from '../lib/progress.js'
import { voiceTierFor } from '../lib/voiceTier.js'
import { resolveVoices } from '../data/clipVoices.js'
import { useState } from 'react'

export default function MaterialBody({
  material: m,
  openSection = null,
  onSection = null,
  wordStatuses = null,
  onMarkWord = null,
  onClose = null,
  /** 練習の記録を消すボタンを出すか。**トレーナーの教材だけ**(利用者の指定) */
  showReset = false,
  /** 呼ぶ側の事情で出す知らせ(区切りの訳を作っています… など) */
  busyNote = null,
  errorNote = null,
}) {
  /**
   * **教材ごとに、練習の途中経過を消す**(2026-08 利用者の指定)。
   * **押し間違いを防ぐため2段**にする(1回目で「本当に消す」に変わる)。
   */
  const [resetAsk, setResetAsk] = useState(false)
  const [resetDone, setResetDone] = useState(null)

  if (!m) return null
  const sections = m.sections ?? []
  const domId = `material-${m.id}`

  return (
    <div className="material-detail" id={domId}>
      {/* 紙に出したときだけ出る見出し。何の教材か分からない
          紙が配られると、あとで整理できない */}
      <div className="print-only print-head">
        <MaterialTitle title={m.title} headline={m.headline} as="strong" size="sheet"
                       fallbackTags={[cefrLabel(m.level), kindLabel(m.kind),
                         industryLabel(m.industry)]} />
        <div className="print-meta">
          {cefrLabel(m.level)} / {kindLabel(m.kind)} / {industryLabel(m.industry)}
          {' / '}全 {m.itemCount} 問
          {(m.tagIds ?? []).length ? ` / ${m.tagIds.map(weaknessTagLabel).join('・')}` : ''}
        </div>
      </div>
      {/* **「セッションで使う」はここに置かない。**
          開いていない行にも出しているので、開くと2つ並んでしまう。
          **同じことをするボタンを2つ見せない**(CLAUDE.md)。 */}
      <div className="btn-row no-print">
        <button type="button" className="btn btn--small"
                onClick={() => printElement(document.getElementById(domId))}>
          <PrintIcon />印刷 / PDFで保存
        </button>
        {busyNote && <span className="muted">{busyNote}</span>}
        {/* **やりかけが残っているときだけ出す。**
            効かないボタンを出さない(CLAUDE.md) */}
        {showReset && hasMaterialProgress(m.id) && (
          <button type="button"
                  className={`btn btn--small ${resetAsk ? 'btn--quiet' : 'btn--ghost'}`}
                  onClick={() => {
                    if (!resetAsk) { setResetAsk(true); return }
                    const n = clearMaterialProgress(m.id)
                    setResetAsk(false)
                    setResetDone(n)
                  }}>
            {resetAsk ? '本当に消す' : 'この教材の練習の記録を消す'}
          </button>
        )}
        {resetAsk && (
          <button type="button" className="btn btn--ghost btn--small"
                  onClick={() => setResetAsk(false)}>
            やめる
          </button>
        )}
      </div>
      {/* **押した場所のすぐ下に出す**(CLAUDE.md)。
          何が消えて、何が消えていないかまで書く */}
      {resetAsk && (
        <p className="card-hint no-print">
          この端末に残っている、この教材の
          <strong>スラッシュの区切り・ディクテーションの書きかけ・
          Quick Response の進み具合</strong>を消します。
          <strong>単語帳に登録した語は消えません。</strong>
          ほかの教材にも触れません。
        </p>
      )}
      {resetDone != null && (
        <p className="notice notice--ok no-print">
          {resetDone > 0
            ? `練習の記録を消しました(${resetDone} 件)。`
            : '消すものはありませんでした。'}
          単語帳に登録した語は消えていません。
        </p>
      )}
      {/* **失敗したときだけ出す。** 裏で作っているので、
          うまくいったときは訳が出るようになるだけでよい */}
      {errorNote && <p className="notice notice--warn no-print">{errorNote}</p>}
      <Tabs
        variant="sub"
        ariaLabel="演習の切り替え"
        value={openSection ?? null}
        onChange={(id) => onSection?.(openSection === id ? null : id)}
        items={sections.map((sec) => ({
          id: sec.id,
          label: exerciseLabel(sec.exercise_type),
          count: sec.items.length,
        }))}
      />
      {sections
        .map((sec, i) => {
          /* はじめはどれも開かない。演習が1種類のときだけ開く
             (Tabs は2つ未満だと描かないため、押す先が無い)。

             **開いていないものも、描いてから隠す**(`is-closed`)。
             描かないでいたので、タブを押さずに印刷すると
             **見出しだけの紙**が出ていた(2026-08 実機)。
             紙用の指定が `display: block` に戻し、教材まるごとを刷る。 */
          const open = sec.id === openSection || (sections.length < 2 && i === 0)
          const type = exerciseType(sec.exercise_type)
          return (
            <section key={sec.id} className={`exercise-view${open ? '' : ' is-closed'}`}>
              <h4 className="section-title">
                {exerciseLabel(sec.exercise_type)}({countLabel(sec.exercise_type, sec.items.length)})
                {!type?.audioFrom && <span className="field-hint"> 音声なし</span>}
              </h4>
              {sec.instruction && <p className="card-hint">{sec.instruction}</p>}
              <ol className="material-preview">
                {sec.items.map((it) => (
                  <li key={it.id}>
                    {it.tag_id && (
                      <span className="item-tag">{weaknessTagLabel(it.tag_id)}</span>
                    )}
                    {it.speaker && (
                      <div className="passage-speaker" lang="en">{it.speaker}</div>
                    )}
                    {type?.audioFrom && it[type.audioFrom] && (
                      <div className="item-audio">
                        <SpeakButton
                          text={it[type.audioFrom]}
                          clipVoice={resolveVoices(m.voiceIds)[0]}
                          tier={voiceTierFor({
                            exerciseType: sec.exercise_type,
                            tags: m.tagIds,
                          })}
                        />
                      </div>
                    )}
                    {/* 語に触れると意味が出る。**トレーナー自身も
                        「知っていた / 知らなかった」を付けられる**
                        (2026-08 利用者の指定)。付けた記録は
                        トレーナー自身のもので、ゲストのものには触れない */}
                    {it.prompt_en && (
                      <div>
                        <EnglishText text={it.prompt_en} textJa={it.prompt_ja} level={m.level}
                                     statuses={wordStatuses} onMark={onMarkWord} />
                        <Phonetic value={it.phonetic} />
                        <PhraseChips phrases={it.phrases} sentence={it.prompt_en}
                                     level={m.level}
                                     statuses={wordStatuses} onMark={onMarkWord} />
                      </div>
                    )}
                    {it.prompt_ja && <div>{it.prompt_ja}</div>}
                    {it.question && (
                      <div><EnglishText text={it.question} level={m.level}
                                        statuses={wordStatuses} onMark={onMarkWord} /></div>
                    )}
                    {it.hint && <div className="field-hint">与える語: {it.hint}</div>}
                    {it.audio_text && !it.prompt_en && (
                      <div lang="en" className="muted">読み上げ: {it.audio_text}</div>
                    )}
                    {it.answer && <div className="detail-answer">→ {it.answer}</div>}
                    {it.answer_alt && (
                      <div className="muted">別解: {it.answer_alt}</div>
                    )}
                    {it.note && <div className="field-hint">{it.note}</div>}
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      {onClose && (
        <button type="button" className="btn btn--link" onClick={onClose}>
          中身を閉じる
        </button>
      )}
    </div>
  )
}
