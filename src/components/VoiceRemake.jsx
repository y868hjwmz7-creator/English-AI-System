/**
 * **読み上げ音声を作り直すときに、国と話す人を選ぶ欄**(2026-09 利用者の指定)。
 *
 *   > また、音声を作り直す際も、国とスピーカーを選択できるようにして
 *   > ください。そして、元あるものも残せるようにしたいです。
 *   > つまり同じ内容の教材を違うアクセントに作り直すことが出来る仕様です。
 *
 * 【道は2つ。どちらも「作り直し」だが、残るものが違う】
 *
 * | | もとの教材 | いつ選ぶか |
 * |---|---|---|
 * | **別の教材として複製する**(既定) | **そのまま残る** | 同じ中身を別の訛りでも持ちたい |
 * | この教材の声を入れ替える | **声が変わる** | いまの声が気に入らない |
 *
 * **もとの MP3 は、どちらでも消えない。** 置き場所は
 * `<版>/<段>/<声の id>/<英文の指紋>.mp3` で**声の id が道に入っている**
 * ので、別の声を選べば別の道になる。声を戻せば、元の音がそのまま鳴る。
 *
 * 【決まりごと】
 *   ・**人数は教材が決める。** ここでは変えられない
 *     (変えると本文の話す人と数が合わなくなる)
 *   ・**選べる声は教材の種類で絞る**(`voicePurposeFor`)。
 *     記事にはナレーション向き、会話には会話向き
 *   ・**おまかせは1回だけ決める**(`useMemo`)。
 *     描き直すたびに引き直すと、押した瞬間に別の声で作られる
 *   ・**入れ替えは、自分が作った教材だけ**(0001 のポリシー)。
 *     人の教材では選択肢に出さない(**効かない操作を見せない**)
 *   ・**押す前に、本数と課金になることを書く**(見えない費用は管理できない)
 */
import { useMemo, useState } from 'react'
import {
  CLIP_ACCENTS, accentLabel, findVoice, pickVoices, voicePurposeFor, voicesOfAccent,
} from '../data/clipVoices.js'
import { castList, remakeModeOf, sameVoices } from '../lib/voiceCast.js'

/** その教材が使っている声の本数。**話す人の数がそのまま人数である** */
export const voiceCountOf = (material) => castList(material)?.length || 1

export default function VoiceRemake({
  material, clipCount, mine, busy, onRun, onCancel,
}) {
  const n = voiceCountOf(material)
  const purpose = voicePurposeFor(material.kind)
  /* いまの声の訛りから始める。**開いた瞬間に別の訛りに変わっていると、
     いま何で鳴っているのか分からなくなる** */
  const now = (material.voiceIds ?? []).filter((id) => findVoice(id))
  const nowAccent = findVoice(now[0])?.accent
  const [accent, setAccent] = useState(nowAccent ?? 'us')
  /* **はじめは「いまの声」から始める。** ここを空(おまかせ)にすると、
     開いて押しただけで**別の声に変わり、しかも課金される。**
     もともとこのボタンは「良い声にならない英文を作り直す」ためのもので、
     声を変えるつもりが無いことのほうが多い。
     **国と話す人を変えるのは、選び直したときだけ** */
  const [picked, setPicked] = useState(now)
  const [mode, setMode] = useState('copy')   // 'copy' | 'replace'

  /* 選べる声。**いま使っている声が名簿から外れていても、選択肢に残す**
     (`retired` を付けた声など)。外すと、その欄が空白に見える */
  const pool = useMemo(() => {
    const list = voicesOfAccent(accent, purpose)
    const extra = now
      .map((id) => findVoice(id))
      .filter((v) => v && v.accent === accent && !list.some((x) => x.id === v.id))
    return [...list, ...extra]
  }, [accent, purpose, material.id])

  /* **おまかせは1回だけ決める。** `pool` を見張りに入れない ——
     `filter` の返り値なので描き直すたびに別の配列になり、
     そのたびに引き直す(`MaterialForm` で踏んだ落とし穴と同じ) */
  const voiceIds = useMemo(() => {
    const out = []
    const auto = pickVoices(accent, n, purpose)
    for (let i = 0; i < n; i += 1) {
      out.push(picked[i] || auto[i] || auto[0])
    }
    return out.filter(Boolean)
  }, [accent, n, purpose, picked])

  const accents = CLIP_ACCENTS.filter((a) => voicesOfAccent(a.id, purpose).length > 0)
  /* **いまと同じ声のままか。** 同じなら、していることは
     「作り直し」であって「選び直し」ではない。断り書きを書き分ける */
  const same = sameVoices(voiceIds, now)
  /* **実際に走る道。** 声を変えていなければ、するのは音声の作り直しだけで、
     教材そのものには手を触れない(このボタンのもとの役目)。
     `mine` でない教材で「入れ替え」が選ばれたままにならないよう、
     ここで1回に決める(**判断を2か所に置かない**) */
  const run = remakeModeOf({ same, mode, mine })

  return (
    <div className="voice-remake">
      <div className="voice-row">
        <label className="field">
          <select value={accent} aria-label="訛り(国籍)" disabled={busy}
                  onChange={(e) => { setAccent(e.target.value); setPicked([]) }}>
            {accents.map((a) => (
              <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>
            ))}
          </select>
        </label>

        {pool.length > 0 && Array.from({ length: n }, (unused, i) => (
          <label className="field" key={i}>
            <span>{n > 1 ? `話す人 ${i + 1}` : '話す人'}</span>
            <select value={picked[i] ?? ''} disabled={busy}
                    onChange={(e) => setPicked((list) => {
                      const next = [...list]
                      next[i] = e.target.value
                      return next
                    })}>
              <option value="">おまかせ</option>
              {pool.map((v) => (
                <option key={v.id} value={v.id}
                        disabled={picked.some((x, j) => x === v.id && j !== i)}>
                  {v.label}({v.gender === 'male' ? '男性' : '女性'})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {/* **声を変えていないなら、道は1つしかない。**
          いま鳴っている MP3 を作り直すだけである(このボタンのもとの役目)。
          複製しても同じものが2本並ぶだけなので、選ばせない */}
      {!same && (
        <div className="voice-mode">
          {/* **既定は「複製」。** 利用者の指定は「元あるものも残せるように」 */}
          <label className="chip">
            <input type="radio" name={`vmode-${material.id}`} value="copy" disabled={busy}
                   checked={run === 'copy'} onChange={() => setMode('copy')} />
            別の教材として複製する
          </label>
          {/* **人の教材は書き換えられない**(0001 のポリシー)。
              選ばせてから断るのではなく、はじめから出さない */}
          {mine && (
            <label className="chip">
              <input type="radio" name={`vmode-${material.id}`} value="replace" disabled={busy}
                     checked={run === 'replace'} onChange={() => setMode('replace')} />
              この教材の声を入れ替える
            </label>
          )}
        </div>
      )}

      <p className="notice notice--warn">
        {run === 'refresh' && (
          <>いまの声のまま、読み上げ音声を<strong>もう一度作り直します。</strong>
            良い声にならない英文があるときに使います。</>
        )}
        {run === 'copy' && (
          <>いまの教材は<strong>そのまま残ります。</strong>
            同じ中身の教材を、選んだ声で<strong>もう1本</strong>作ります。</>
        )}
        {run === 'replace' && (
          <>この教材の読み上げの声を<strong>入れ替えます。</strong>
            いまの声で作った音声は消えないので、選び直せば元に戻せます。</>
        )}
        <br />
        読み上げ音声 <strong>{clipCount} 本</strong>を作ります
        (ElevenLabs に課金されます)。
        <br />
        <span className="voice-remake-cast">
          {accentLabel(accent)} … {voiceIds.map((id) => findVoice(id)?.label ?? id).join(' / ')}
        </span>
      </p>

      {/* **やめる道を、必ず並べて置く**(2026-09 実機・利用者の指摘)。
            > 作り直しを「やめる」ボタンも作ってください。今はないので戻れません。

          上の「読み上げ音声を作り直す」がもう一度押せば閉じるのだが、
          **そこは画面を送ると見えなくなる**うえ、
          「作り直す」と書いてあるものを押して閉じるとは思えない。
          **押した場所のすぐ下に、そのままの言葉で置く。**
          `btn--ghost`(枠線だけ)にして、走らせるボタンと見分けさせる */}
      <div className="btn-row">
        <button type="button" className="btn btn--small btn--quiet" disabled={busy}
                onClick={() => onRun({ voiceIds, mode: run, accentName: accentLabel(accent) })}>
          {run === 'copy' ? '複製して音声を作る'
            : run === 'replace' ? '声を入れ替えて音声を作る' : '本当に作り直す'}
        </button>
        <button type="button" className="btn btn--small btn--ghost" disabled={busy}
                onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  )
}
