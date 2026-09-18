/**
 * **アサインする** —— この人に出す冊を、1か所で決める(第5.181節)。
 *
 * ============================================================================
 *   > 新しい冊をアサインするのは各ゲストの単語帳もquick response帳、
 *   > もしくは「アサインする」の機能を作り、その中から教材、単語帳の冊、
 *   > quick responseの冊を選べるようにしたいです。
 *
 * 【利用者に決めてもらったこと】(2026-09)
 *
 *   | 問い | 答え |
 *   |---|---|
 *   | どこから開くか | **両方**(左メニュー + ゲストのページ) |
 *   | 並べ方 | **ゲストを先に選ぶ**(①誰に → ②何を渡すか) |
 *   | 教材も配るか | **いいえ。冊だけ** |
 *
 * 【同じことを2つ作らない】
 *
 *   ・並べる部品は、ゲストのページと**同じもの**
 *     (`FeatureToggle` / `ShelfAssign` / `NativeFlowAssign`)
 *   ・**どれが出ているか・何と言うか**は `assignBooks.js` 1か所
 *   ・**どちらの帳面の冊か**も `learnerFeatures.js` が知っている
 *     (`featuresIn('word')` / `featuresIn('qr')`)
 *
 *   だから、こちらに書いてあるのは**React の持ちものと、窓口を呼ぶ順**だけ
 *   である。文言も判断も1文字も持っていない。
 *
 * 【門番は画面に持たせない】
 *
 *   書けるかどうかを決めるのは `set_learner_feature()` の中(0055 / 0059)。
 *   担当していないゲストには、そもそも書けない ——
 *   **判定を2か所に置くと、必ず食い違う**(CLAUDE.md)。
 *
 * 【教材は、ここには出さない】
 *
 *   利用者の指定で**冊だけ**にしてある。教材はこれまでどおり
 *   「教材」の画面から配る(**勝手に広げない**)。
 * ============================================================================
 *
 * @param learnerId ゲストのページから開いたときは、そのゲスト(**選ばせない**)
 * @param learnerName その名前(知らせの文に使う)
 */
import { useEffect, useMemo, useState } from 'react'
import { loadMyLearners } from '../lib/materials.js'
import { loadLearnerFeatures, setLearnerFeature } from '../lib/learnerFeatures.js'
import { shelfFeature } from '../data/shelves.js'
import { NATIVE_FLOW_UNITS, nfFeature } from '../data/nativeFlow.js'
import {
  busyText, doneText, nfAllBusyText, nfAllDoneText, nfAllNoneText, nfAllTodo,
  nfUnitTitle, nfUnitsOn, shelfTitle, shelvesOff, shelvesOn, stoppedText,
} from '../lib/assignBooks.js'
import AssignShelf from './AssignShelf.jsx'
import Loading from './Loading.jsx'

export default function AssignBooks({ learnerId = null, learnerName = '' }) {
  /** 担当しているゲスト。**`null` は読み込み中**(いない、ではない) */
  const [people, setPeople] = useState(null)
  /** いま選んでいるゲスト。渡されていれば、それが答え(選ばせない) */
  const [picked, setPicked] = useState(learnerId ?? '')
  const [features, setFeatures] = useState(new Set())
  const [busy, setBusy] = useState(null)
  const [reading, setReading] = useState(false)
  /* **知らせは、押した欄のすぐ下に出す**(CLAUDE.md)。
     単語帳と Quick Response で別に持つ —— 同じ入れ物にすると、
     **片方の知らせが、もう片方の欄に出る** */
  const [wordNote, setWordNote] = useState(null)
  const [qrNote, setQrNote] = useState(null)

  /* ゲストの一覧。**渡されているときは読みに行かない**(0円で済むものは0円で) */
  useEffect(() => {
    if (learnerId) return undefined
    let alive = true
    loadMyLearners().then(({ data }) => { if (alive) setPeople(data ?? []) })
    return () => { alive = false }
  }, [learnerId])

  /* 渡されたゲストが変わったら、そちらに合わせる */
  useEffect(() => { if (learnerId) setPicked(learnerId) }, [learnerId])

  /** いま決めている相手。**名前も一緒に持つ**(知らせの文に要る) */
  const who = useMemo(() => {
    if (!picked) return null
    const found = (people ?? []).find((p) => p.id === picked)
    return { id: picked, display_name: found?.display_name || learnerName || 'ゲスト' }
  }, [picked, people, learnerName])

  /* その人に出しているものを読む。**相手を変えたら読み直す** */
  useEffect(() => {
    if (!who?.id) { setFeatures(new Set()); return undefined }
    let alive = true
    setReading(true)
    /* **前の人の知らせを残さない**(別の人の話に見える) */
    setWordNote(null)
    setQrNote(null)
    loadLearnerFeatures(who.id).then(({ data }) => {
      if (!alive) return
      setFeatures(data ?? new Set())
      setReading(false)
    })
    return () => { alive = false }
  }, [who?.id])

  const shelfOn = useMemo(() => shelvesOn(features), [features])
  const shelfOff = useMemo(() => shelvesOff(features), [features])
  const nfOn = useMemo(() => nfUnitsOn(features), [features])

  /**
   * 1つ出す / 外す。**向きは押した時点の `features` で決める。**
   *
   * @param setNote どちらの欄に知らせを出すか(押した場所に出す)
   */
  const toggle = async (id, title, setNote) => {
    if (busy || !who) return
    const on = !features.has(id)
    setBusy(id)
    setNote({ kind: 'busy', text: busyText(title, on) })
    const { error } = await setLearnerFeature(who.id, id, on)
    setBusy(null)
    if (error) { setNote({ kind: 'ng', text: `${error?.message ?? error}` }); return }
    const now = new Set(features)
    if (on) now.add(id); else now.delete(id)
    setFeatures(now)
    setNote({ kind: 'ok', text: doneText(who.display_name, title, on) })
  }

  /**
   * **Native Flow を丸ごと。**
   *
   * `toggle()` を6回呼ばない —— あれは押すたびに `features` を見て向きを
   * 決めるので、**2回目以降は古い控えを見て逆向きに倒す。**
   * ここは向きが先に決まっているので、まとめて1回だけ書き戻す。
   */
  const pickNfAll = async (on) => {
    if (busy || !who) return
    const todo = nfAllTodo(features, on)
    if (!todo.length) {
      setQrNote({ kind: 'ok', text: nfAllNoneText(who.display_name, on) })
      return
    }
    setBusy('nf:all')
    setQrNote({ kind: 'busy', text: nfAllBusyText(todo.length, on) })
    const next = new Set(features)
    let done = 0
    let bad = null
    for (const id of todo) {
      const { error } = await setLearnerFeature(who.id, id, on)
      if (error) { bad = error; break }
      if (on) next.add(id); else next.delete(id)
      done += 1
    }
    /* **途中で断られても、通ったぶんは残す** —— 画面と中身を食い違わせない */
    setFeatures(next)
    setBusy(null)
    setQrNote(bad
      ? { kind: 'ng', text: stoppedText(done, bad) }
      : { kind: 'ok', text: nfAllDoneText(who.display_name, on) })
  }

  return (
    <div className="stack assign">
      {/* ── ①誰に(ゲストのページから開いたときは、もう決まっている)── */}
      {!learnerId && (
        <section className="card">
          <h2 className="card-title">アサインする</h2>
          <label className="field">
            <span className="field-label">誰に出しますか</span>
            <select className="input" value={picked}
                    onChange={(e) => setPicked(e.target.value)}>
              <option value="">選んでください</option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </label>
          {/* **黙って空にしない。** 読み込み中と、いない場合を書き分ける */}
          {people === null && <p className="card-hint">読んでいます…</p>}
          {people?.length === 0 && (
            <p className="card-hint">担当しているゲストが、まだいません。</p>
          )}
        </section>
      )}

      {/* ── ②何を渡すか ──────────────────────────────── */}
      {!picked ? (
        /* **行き止まりを作らない。** 何をすればよいかを書く */
        !learnerId && people?.length > 0 && (
          <p className="card-hint">ゲストを選ぶと、出せる冊が並びます。</p>
        )
      ) : reading ? (
        <Loading />
      ) : (
        <>
          <section className="card">
            <h3 className="card-title">単語帳の冊</h3>
            {/* **1行1冊。説明は出さない**(第5.186節・利用者の指定)。
                見た目も中身も `AssignShelf` 1か所が持っている ——
                ゲストのページ(単語帳のタブ)とまったく同じものである */}
            <AssignShelf
              group="word" features={features} busy={busy} note={wordNote}
              onFeature={(f) => toggle(f.id, f.label, setWordNote)}
              shelfOn={shelfOn} shelfOff={shelfOff}
              onShelf={(sh) => toggle(shelfFeature(sh.id), shelfTitle(sh), setWordNote)} />
          </section>

          <section className="card">
            <h3 className="card-title">Quick Response の冊</h3>
            <AssignShelf
              group="qr" features={features} busy={busy} note={qrNote}
              onFeature={(f) => toggle(f.id, f.label, setQrNote)}
              units={NATIVE_FLOW_UNITS} unitsOn={nfOn}
              onUnit={(u) => toggle(nfFeature(u.id), nfUnitTitle(u), setQrNote)}
              onAll={pickNfAll} />
          </section>
        </>
      )}
    </div>
  )
}
