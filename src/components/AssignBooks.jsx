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
import { assignMaterials, loadMyLearners, searchMaterials } from '../lib/materials.js'
import SearchBar from './SearchBar.jsx'
import MaterialTitle from './MaterialTitle.jsx'
import { loadLearnerFeatures, setLearnerFeature } from '../lib/learnerFeatures.js'
import { shelfFeature } from '../data/shelves.js'
import { NATIVE_FLOW_UNITS, nfFeature } from '../data/nativeFlow.js'
import {
  busyText, doneText, nfAllBusyText, nfAllDoneText, nfAllNoneText, nfAllTodo,
  nfUnitTitle, nfUnitsOn, rizapBusyText, rizapDoneText,
  shelfTitle, shelvesOff, shelvesOn, stoppedText,
} from '../lib/assignBooks.js'
import AssignShelf from './AssignShelf.jsx'
import AssignRizap from './AssignRizap.jsx'
import AssignNote from './AssignNote.jsx'
import { RIZAP_BOOKS, RIZAP_LABEL, rizapPickLabel } from '../data/rizapBooks.js'
import { assignRizap, loadRizapUnits } from '../lib/rizapAssign.js'
import Loading from './Loading.jsx'
import LearnerPick from './LearnerPick.jsx'

export default function AssignBooks({ me = null, learnerId = null, learnerName = '' }) {
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
  /* **RIZAP ENGLISH の教材**(第5.202節)。知らせは3つめとして別に持つ ——
     同じ入れ物にすると、**別の欄の知らせがここに出る** */
  const [rizapNote, setRizapNote] = useState(null)
  /** 冊ごとの UNIT。**読めていない冊は `undefined` のまま**(0 と区別する) */
  const [rizapUnits, setRizapUnits] = useState({})
  /** 冊ごとに、いま選んでいる UNIT(空は丸ごと) */
  const [rizapPick, setRizapPick] = useState({})

  /* ── **その他の教材**(第5.238節・2026-09 利用者の指定)──

       > その他の教材の検索画面はサブ的な扱いで、デフォルトでは
       > 閉じていてよいです。

     **主役は上の3つの大項目**(単語帳・RIZAP・Quick Response)である。
     こちらは**キーワードだけ**にしてある —— 種類・レベル・業界で
     じっくり探すのは「教材」の画面の仕事で、
     **同じ絞り込みを2か所に作らない**(CLAUDE.md)。 */
  const [matOpen, setMatOpen] = useState(false)
  const [matQ, setMatQ] = useState('')
  /** さがした結果。**`null` は読み込み中**(無い、ではない) */
  const [mats, setMats] = useState(null)
  const [matPicked, setMatPicked] = useState([])
  const [matBusy, setMatBusy] = useState(false)
  const [matNote, setMatNote] = useState(null)
  const [rizapBusy, setRizapBusy] = useState(null)

  /* ゲストの一覧。**渡されているときは読みに行かない**(0円で済むものは0円で) */
  useEffect(() => {
    if (learnerId) return undefined
    let alive = true
    loadMyLearners().then(({ data }) => { if (alive) setPeople(data ?? []) })
    return () => { alive = false }
  }, [learnerId])

  /* 渡されたゲストが変わったら、そちらに合わせる */
  useEffect(() => { if (learnerId) setPicked(learnerId) }, [learnerId])

  /* **冊の中身は、相手によらない。**だからゲストを選び直しても読み直さない
     (0円で済むものは0円で)。**1冊ずつ入れていく** ——
     まとめて `setState` すると、**全部そろうまで1冊も出ない** */
  useEffect(() => {
    let alive = true
    for (const b of RIZAP_BOOKS) {
      loadRizapUnits(b.id).then(({ data }) => {
        if (!alive) return
        /* **読めなかった(`null`)ときは、入れない。**
           入れると「0 UNIT」と見えて、**読めなかったことが消える** */
        if (!data) return
        setRizapUnits((now) => ({ ...now, [b.id]: data }))
      })
    }
    return () => { alive = false }
  }, [])

  /* **その他の教材をさがす。**開いているあいだだけ読みに行く ——
     閉じているのに読むと、**見ていない一覧のために毎回通信する。**
     打つたびに呼ばず、**手が止まってから**(300ms)1回だけ呼ぶ。
     **追い越された結果は捨てる**(`alive`)—— 捨てないと、
     古い検索の結果が、あとから新しい結果を上書きする */
  useEffect(() => {
    if (!matOpen) return undefined
    let alive = true
    setMats(null)
    const t = setTimeout(() => {
      searchMaterials({ keyword: matQ }).then(({ data }) => {
        if (alive) setMats(data ?? [])
      })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [matOpen, matQ])

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
    setRizapNote(null)
    setMatNote(null)
    setMatPicked([])
    loadLearnerFeatures(who.id).then(({ data }) => {
      if (!alive) return
      setFeatures(data ?? new Set())
      setReading(false)
    })
    return () => { alive = false }
  }, [who?.id])

  /**
   * **RIZAP ENGLISH の教材を出す**(第5.202節)。
   *
   * 丸ごとでも1 UNIT でも、**通る道は同じ**(`assignRizap`)——
   * 違うのは「どの id を渡すか」だけである。
   * **画面で2通りに書き分けない**(置く場所の数だけ食い違う)。
   */
  const sendRizap = async (bookId) => {
    if (rizapBusy || !who) return
    const list = rizapUnits[bookId] ?? []
    const want = String(rizapPick[bookId] ?? '')
    const rows = want ? list.filter((u) => String(u.unit_no) === want) : list
    const title = rizapPickLabel(bookId, want, list.length)
    if (!rows.length) {
      setRizapNote({ kind: 'ng', text: `${title} … 出せる UNIT がありません。` })
      return
    }
    setRizapBusy(bookId)
    setRizapNote({ kind: 'busy', text: rizapBusyText(title) })
    const { data, error } = await assignRizap({
      learnerId: who.id,
      assignedBy: me?.id ?? null,
      materialIds: rows.map((u) => u.id),
    })
    setRizapBusy(null)
    if (error) {
      setRizapNote({ kind: 'ng', text: `${error?.message ?? error}` })
      return
    }
    /* **0 と、出した数を取り違えない。**「出しました」とだけ言うと、
       もう出してあった人には**何も変わっていないのに成功に見える** */
    setRizapNote({
      kind: 'ok',
      text: rizapDoneText(who.display_name, title, data.sent, data.already),
    })
  }

  /**
   * **えらんだ「その他の教材」を、この人に共有する**(第5.238節)。
   *
   * **数え方も文も `assignMaterials()` 1か所**(教材の画面と同じもの)。
   * ここで「n 件を n 人と」と書き写さない —— **置く場所の数だけ食い違う。**
   */
  const sendMats = async () => {
    if (matBusy || !who || !matPicked.length) return
    setMatBusy(true)
    setMatNote({ kind: 'busy', text: `${matPicked.length} 件を共有しています…` })
    const { data, error } = await assignMaterials({
      materialIds: matPicked, learnerIds: [who.id], assignedBy: me?.id ?? null,
    })
    setMatBusy(false)
    /* **断られても、通ったぶんは文の中に入っている**(「n 件まで共有しました」)。
       えらんだものは消さずに残す —— 続きをやり直せる */
    if (error) { setMatNote({ kind: 'ng', text: `${error}` }); return }
    setMatNote({ kind: 'ok', text: data.text })
    setMatPicked([])
  }

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
          {/* **ゲストを選ぶ欄は1か所**(`LearnerPick`・第5.238節・
              2026-09 利用者の指定「ゲストのリストは開くためのボタンを
              一つ配置し、デフォルトでは名前を記入して検索する仕様に」)。
              **ここは1人だけ** —— 冊は「そのゲストにいま出しているか」を
              読んで出しているので、相手が2人だと印を出せない。
              読み込み中・いないときの書き分けも、あちらが持っている */}
          <LearnerPick
            people={people} picked={picked ? [picked] : []} single
            onPick={(ids) => setPicked(ids[0] ?? '')} />
        </section>
      )}

      {/* ── ②何を渡すか ──────────────────────────────── */}
      {!picked ? (
        /* **行き止まりを作らない。** 何をすればよいかを書く */
        !learnerId && people?.length > 0 && (
          <p className="hint">ゲストを選んでください。</p>
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

          {/* **RIZAP ENGLISH の教材**(第5.202節・利用者の指定)。
              3つめの束として、単語帳・Quick Response の下に置く ——
              **並べ替えない**(上の2つは前からある) */}
          <section className="card">
            <h3 className="card-title">{RIZAP_LABEL}</h3>
            <AssignRizap
              books={RIZAP_BOOKS} units={rizapUnits} picked={rizapPick}
              busy={rizapBusy} note={rizapNote}
              onPick={(id, unit) => setRizapPick((now) => ({ ...now, [id]: unit }))}
              onSend={sendRizap} />
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

          {/* ── **その他の教材**(第5.238節・2026-09 利用者の指定)──────────
              > その他の教材の検索画面はサブ的な扱いで、
              > デフォルトでは閉じていてよいです。

              **大項目は上の3つ。**こちらは4つめで、**既定では閉じている。**
              `<details>` は使わない —— **畳んでも中身が場所を取る**
              (`.claude/rules/common.md`)。
              **押すものは、見出しの行に置く** —— 一覧の末尾だと、
              教材が増えるほど下へ流れて見つからない */}
          <section className="card">
            <div className="assign-mats-head">
              <h3 className="card-title">その他の教材</h3>
              <button type="button" className="btn btn--small btn--ghost"
                      aria-expanded={matOpen}
                      onClick={() => setMatOpen(!matOpen)}>
                {matOpen ? 'とじる' : 'さがす'}
              </button>
            </div>

            {matOpen && (
              <>
                {/* **キーワードだけ**(2026-09 利用者の回答)。
                    種類・レベル・業界でじっくり探すのは「教材」の画面の
                    仕事である —— **同じ絞り込みを2か所に作らない** */}
                <SearchBar keyword={matQ} onKeyword={setMatQ}
                           placeholder="教材の名前で探す" />

                {/* **黙って空にしない。**読み込み中と、無いときを書き分ける */}
                {mats === null && <Loading />}
                {mats !== null && mats.length === 0 && (
                  <p className="card-hint">当てはまる教材がありません。</p>
                )}

                {mats !== null && mats.length > 0 && (
                  <div className="assign-mats">
                    {mats.map((m) => (
                      <label key={m.id} className="toggle">
                        <input type="checkbox" checked={matPicked.includes(m.id)}
                               disabled={matBusy}
                               onChange={() => setMatPicked((now) => (
                                 now.includes(m.id)
                                   ? now.filter((x) => x !== m.id) : [...now, m.id]))} />
                        {/* 題の出し方は `MaterialTitle` 1か所(教材の画面と同じ) */}
                        <MaterialTitle title={m.title} as="span" size="row" hideDate />
                      </label>
                    ))}
                  </div>
                )}

                {/* **えらんでいないあいだは出さない**(効かない操作を見せない) */}
                {matPicked.length > 0 && (
                  <div className="btn-row">
                    <button type="button" className="btn btn--primary"
                            disabled={matBusy} onClick={sendMats}>
                      {matBusy ? '共有しています…' : `${matPicked.length} 件を共有する`}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* **知らせは、閉じていても出す** —— 共有したあとに閉じても、
                何が起きたかが消えない(CLAUDE.md「黙って消さない」) */}
            <AssignNote note={matNote} />
          </section>
        </>
      )}
    </div>
  )
}
