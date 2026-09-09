/**
 * Quick Response(復習)— 「まだ」を押した文が、ここに溜まる(0040)。
 *
 * 【何のためか】(2026-09 利用者の指定)
 *
 *   > 教材の中で取り組んだ Quick Response の中で「まだ」を押したものは、
 *   > Quick Response という復習用の機能を独立して作り、
 *   > ひとつのアカウントにつきひとつ持たせてください。
 *   > UI は通常の Quick Response の画面と同じです。
 *   > 単語と同じく、「テキスト」「日付」「業界」「シチュエーション」などから
 *   > 絞り込んで練習できるようにしてください。
 *   > 「まだ」「おぼえかけ」の仕組みは同じです。
 *
 *   教材の中の Quick Response は**その教材の通し**である。だから
 *   言えなかった文は、その教材を開き直さないと二度と出てこない。
 *   ここは**教材をまたいだ、その人ひとりぶんの復習**である。
 *   単語帳が**語**に対してしていることを、こちらは**文**に対してする。
 *
 * 【1問ぶんの見た目は `QrCard` 1つ】
 *   教材の中の Quick Response と**同じ部品**を使う。
 *   **同じ見た目を2か所に書き写さない**(CLAUDE.md)。
 *   ちがうのはボタンの言葉づかいだけ(「まだ」/「言える」)。
 *
 * 【誰の復習か】(単語帳と同じ)
 *   `learnerId` を渡さなければ、ログインしている本人のもの。
 *   トレーナーがゲストのページから開いたときは、そのゲストのもの。
 *   **見てよいかどうかは SQL(`qr_items`)が決める。** 画面で判定しない。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  QR_ORDERS, loadQrReviews, markQr, orderQrPairs, qrPairOf, qrReviewSupported,
} from '../lib/qrReviews.js'
import WordbookFilter, { applyWordbookFilter, countNarrowed, emptyFilter } from './WordbookFilter.jsx'
import ReviewScope from './ReviewScope.jsx'
import ReviewStats from './ReviewStats.jsx'
import {
  QR_GROUPS, SCOPES, groupLead, loadScope, loadSize, qrGroupPool, qrTally,
  runKeyOf, saveScope, saveSize, scopeCounts, scopePool, shouldRecord,
  takeCount, todayKey,
} from '../lib/reviewScope.js'
import QrCard from './QrCard.jsx'
import SessionResult from './SessionResult.jsx'
import GoalBar from './GoalBar.jsx'
import FocusFrame from './FocusFrame.jsx'
import WordRadio from './WordRadio.jsx'
import { MusicIcon } from './Icons.jsx'
import { listTracks } from '../lib/bgm.js'
import { NO_GOAL, NO_WEEK, loadQrWeek, loadWeeklyGoal } from '../lib/goals.js'
import { stopReading } from '../lib/readAloud.js'
import { usePracticeLog } from '../lib/practice.js'
import { answerFeedback } from '../lib/haptics.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

/** 並べ方は覚えておく。**一度決めれば、毎回選ぶものではない**
    (紙の幅・文字の大きさと同じ作法。`slashLevel.js` と同じ書き方) */
const ORDER_KEY = 'eas.qrOrder'
const loadOrder = () => {
  try {
    const saved = localStorage.getItem(ORDER_KEY)
    return QR_ORDERS.some((o) => o.id === saved) ? saved : 'shuffle'
  } catch { return 'shuffle' }
}
const saveOrder = (id) => {
  try { localStorage.setItem(ORDER_KEY, id) } catch { /* 使えなくても困らない */ }
}

export default function QrReview({ learnerId = null, learnerName = '' }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(emptyFilter)
  const [order, setOrder] = useState(loadOrder)
  /**
   * **出題範囲と、1回ぶんの個数**(2026-09 利用者の指定)。
   *
   *   > 出題範囲の時系列での絞りかた…その時に復習したい単語やフレーズ、
   *   > 文章の個数だ。これを直感的に選択できる仕組みを作り上げたい。
   *
   * もとは「今日出すぶん / 溜まっているぶん全部」のプルダウン1つで、
   * **1回ぶんの区切りが無かった。** 87問溜まっていれば87問続く
   * (単語帳には10語で区切る決まりがあるのに、こちらで破っていた)。
   *
   * 算段は `reviewScope.js`、見た目は `ReviewScope.jsx` **1か所**。
   * 単語帳とまったく同じものを使う。**書き写さない。**
   * 選んだものは覚える(`eas.review.qr.*`)。
   */
  const [scope, setScope] = useState(() => loadScope('qr'))
  const [size, setSize] = useState(() => loadSize('qr'))
  /**
   * **いま選んでいる段**(まだ / 言えかけ / 言える)。`null` ならぜんぶ。
   *
   * 2026-09 利用者の指定「タッチすればそれらを復習できるように」。
   * **覚えない** —— その場の選択なので、次に開いたときは「ぜんぶ」に戻す
   * (覚えていると、なぜ言える文ばかり出るのか分からなくなる)。
   */
  const [group, setGroup] = useState(null)
  /** いま解いている一覧(**この回のぶんだけ**)。`null` なら、まだ始めていない */
  const [run, setRun] = useState(null)
  /* **聞き流し**(2026-09 利用者の指定「Quick Responseにも聞き流しを作ってくれ」)。
     答える練習ではないので、**箱も次に出す日も1ミリも動かさない**
     (単語帳とまったく同じ決まり。`WordRadio` の中でも呼んでいない) */
  const [radio, setRadio] = useState(null)   // 読む文。null なら出さない
  const [tracks, setTracks] = useState([])   // 曲(無ければ音楽は流れない)
  /** まだ出していない残り。「つづける」で次の区切りへ進む */
  const [pending, setPending] = useState([])
  const [at, setAt] = useState(0)
  const [done, setDone] = useState([])
  /**
   * **この回で「言える」を記録した文。**
   *
   * 同じ範囲を続けて回したときに、同じ文を二度進めないための控えである
   * (`shouldRecord` の `already`)。読み直せば消える —— そのときには
   * `due_on` が新しくなっているので、控えが無くても正しく判定できる。
   */
  const gradedRef = useRef(new Set())
  /* **続けた記録と、週の目標**(0042・2026-09 利用者の指定)。
     単語帳と**同じ形**にそろえてある。**日ではなく週で数える** */
  const [week, setWeek] = useState(NO_WEEK)
  const [goal, setGoal] = useState(NO_GOAL)

  // 取り組みを**裏で数える**(0022)。ゲストのぶんだけ数える
  usePracticeLog('quick_response', Boolean(run), learnerId)

  const reload = async () => {
    setBusy(true)
    const [list, wk, aim] = await Promise.all([
      loadQrReviews(learnerId, { status: 'todo', limit: 500 }),
      /* 0042 を貼る前は 0 が返る。**数が出ないだけで、復習はできる** */
      loadQrWeek(learnerId),
      loadWeeklyGoal(learnerId),
    ])
    if (list.error) setError(list.error); else setError(null)
    setRows(list.data ?? [])
    if (wk.data) setWeek(wk.data)
    if (aim.data) setGoal(aim.data)
    setBusy(false)
  }

  useEffect(() => { reload() }, [learnerId])

  // 画面を離れるときは、鳴っているものを止める
  useEffect(() => () => stopReading(), [])

  const today = todayKey()
  /* 絞り込みは**手元で行う**(単語帳と同じ)。`qr_items()` は 500 件まで
     返しているので、選ぶたびに Supabase へ聞き直さない。待ち時間も費用も増えない */
  /* **段で絞ってから、絞り込みを当てる。** 順はどちらでも同じものが残るが、
     **数え上げ(`tally`)は段で絞る前の `rows` から出す** ——
     押すたびに札の数が変わっては、何を選んでいるのか分からなくなる */
  const filtered = useMemo(
    () => applyWordbookFilter(qrGroupPool(rows, group), filter),
    [rows, group, filter],
  )
  /** いま選んでいる範囲にあてはまるもの。**数え上げと同じ道を通す** */
  const shown = useMemo(() => scopePool(filtered, scope, today), [filtered, scope, today])

  /**
   * 3つの数(2026-09 実機・利用者の指定で「今日出す / 溜まっている」から改めた)。
   *
   * **SQL は1行も要らない。** `qr_items` は箱(`box`)を返しているので、
   * 読み込んだ行から数えられる。数え方は **`qrTally()` 1か所**
   * (`qrReviews.js`)—— 画面で数え直すと、単語帳とずれる。
   */
  const tally = useMemo(() => qrTally(rows), [rows])
  /** いくつ絞っているか。**畳んでいても分かるように**札の数として渡す */
  const narrowed = countNarrowed(filter)

  /**
   * 段を押したとき。**範囲は「ぜんぶ」に移す**(2026-09 利用者の指定)。
   *
   * 「言える」文は箱6なので、次に出る日が30日先である。範囲が
   * 「今日出す」のままだと**押した瞬間に0件**になり、押せたのに
   * 何も出ないという、いちばん分かりにくい形になる。
   * 段を外したら、覚えている範囲へ戻す(`onlySet` と同じ作法)。
   */
  const pickGroup = (id) => {
    setGroup(id)
    setScope(id ? 'all' : loadScope('qr'))
  }

  /* **選んでいた札が0件になったら、押せる札へ移す**(絞り込みを変えたとき)。
     黙って空のまま置くと、「出すものがありません」だけが残って
     何を押せばよいのか分からない(`pickScene` と同じ作法・CLAUDE.md) */
  const counts = scopeCounts(filtered, today)
  useEffect(() => {
    if (busy || filtered.length === 0) return
    if ((counts[scope] ?? 0) > 0) return
    const next = SCOPES.find((s) => (counts[s.id] ?? 0) > 0)
    if (next) setScope(next.id)
  }, [busy, filtered.length, counts[scope], scope])

  const start = () => {
    const list = orderQrPairs(shown.map(qrPairOf), order)
    const take = takeCount(size, list.length)
    setRun(list.slice(0, take))
    /* **残りは捨てない。**「つづける」で次の区切りへ進む。
       ここで切り落とすと、「教材の順」を選んだ人は
       **いつまでも先頭の10問しか出てこない** */
    setPending(list.slice(take))
    setAt(0)
    setDone([])
  }

  /**
   * **聞き流しを始める**(2026-09 利用者の指定)。
   *
   *   > Quick Responseにも聞き流しを作ってくれ。
   *   > 英語だけ・日本語→英語 この２種類だ。
   *
   * **読む文は、出題とまったく同じ道で選ぶ**(`shown` → `qrPairOf` →
   * `orderQrPairs`)—— 範囲の札も絞り込みも並べ方も、そのまま効く。
   * **数え方を2通り持たない。** ただし**問数では切らない**
   * (聞き流しは終わりを決めずに回すもの・単語帳と同じ)。
   *
   * 曲は**押したときに引く。** 押さない人には1回も問い合わせが飛ばない。
   * **曲が0本でも聞き流しは始まる**(音楽が鳴らないだけ・行き止まりを作らない)。
   */
  const listen = async () => {
    const pool = orderQrPairs(shown.map(qrPairOf), order)
    if (!pool.length) return
    setRadio(pool)
    const { data } = await listTracks()
    setTracks(data ?? [])
  }

  /**
   * **復習の最中に「出しかた」を変えたら、その場で組み直す**
   * (2026-09 利用者の指定「中に入ってからも絞り込みができるように」)。
   * 変わったかどうかは **`runKeyOf()` 1か所**(単語帳と同じもの)。
   */
  const runKey = runKeyOf({ scope, size, filter, group })
  const runKeyRef = useRef(runKey)
  useEffect(() => {
    if (!run) { runKeyRef.current = runKey; return }
    if (runKeyRef.current === runKey) return
    runKeyRef.current = runKey
    start()
  }, [runKey, Boolean(run)])

  /** 次の区切りへ。**読み直さない** —— 並びと残りをそのまま持っている */
  const next = () => {
    const take = takeCount(size, pending.length)
    setRun(pending.slice(0, take))
    setPending(pending.slice(take))
    setAt(0)
    setDone([])
  }

  const stop = () => {
    stopReading()
    setRun(null)
    setPending([])
    gradedRef.current = new Set()
    // **答えた結果を映し直す。** 箱が動いているので、残り数が変わる
    reload()
  }

  const answer = async (ok) => {
    const card = run[at]
    /* **押した手応えを返す。** 言えたらピンポン、まだなら低く1つだけ */
    answerFeedback(ok)
    /* 「まだ」は箱を 0 に戻して翌日、「言える」は箱を1つ上げる。
       **何日後に出すかは SQL(`mark_qr`)が決める。** 画面には持たない

       **記録するかどうかは `shouldRecord()` 1か所**(`reviewScope.js`)。
       「まだ」はいつでも、「言える」は**期限が来ていて、この回でまだ
       進めていないとき**だけ。**遅く出す方へは動かさない** ——
       同じ範囲を1日に何度も回すと、明日の復習が空になるためである */
    const key = card.key || card.en
    if (shouldRecord(ok, {
      dueOn: card.due_on, addedAt: card.added_at, today, already: gradedRef.current.has(key),
    })) {
      if (ok) gradedRef.current.add(key)
      await markQr(card, ok ? 'learning' : 'unknown', { learnerId })
    }
    setDone((d) => [...d, { ...card, ok }])
    setAt((i) => i + 1)
  }

  /** **もう出さない**(間違えて溜めた文・すっかり言えるようになった文) */
  const retire = async () => {
    const card = run[at]
    await markQr(card, 'known', { learnerId })
    setDone((d) => [...d, { ...card, ok: true }])
    setAt((i) => i + 1)
  }

  const who = learnerName ? `${learnerName} さんの` : ''

  if (!isSupabaseConfigured) {
    return (
      <section className="card">
        <h2 className="card-title">Quick Response(復習)</h2>
        <p className="hint">
          Supabase が設定されていないため、復習は溜まりません。
        </p>
      </section>
    )
  }

  // ── 解いているあいだ ───────────────────────────────────────
  //
  // **集中モードで出す**(2026-09 利用者の指定)。
  //
  //   > Quick Response は集中モード扱いなので、
  //   > 上下の余計な情報は表示しないでください。
  //
  // これまでは**ふつうのページの中**に置いていたので、上には左メニュー・
  // 上の帯・接続の知らせ・試作版の断り書き、下には版とサンプルデータの
  // ボタンが残っていた。**1問だけに向き合う場所なのに、まわりが騒がしい。**
  //
  // 骨組みは `FocusFrame` 1つ(`FocusReader` / `StepFocus` /
  // 教材の中の Quick Response と同じもの)。**書き写さない。**
  // portal で body の直下に出るので、**まわりのものは自動的に消える。**
  if (run && run.length) {
    const finished = at >= run.length
    const body = (
      /* **`qr--paper` は付けない**(2026-09 実機・利用者の指定)。
         あれは**紙の上の色**に差し替えるもので、地が白くなった
         この画面では要らない —— 何も足さなければアプリの配色に従い、
         単語帳の復習とそろう(`.focus-paper` の吹き出しと同じ考え方) */
      <section className="qr">
        {/* どこまで来たか。**終わりが見えないと続かない**(単語帳と同じ) */}
        <div className="qr-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((Math.min(at, run.length) / run.length) * 100)}%` }} />
        </div>

        {finished ? (
          /* **終わりの1枚は、単語帳とまったく同じ部品**(`SessionResult`・
             2026-09 利用者の指定「ゲーミフィケーションを追加したいです」)。
             点数・声かけ・連続・できなかったものを、
             **書き写さずに1か所で持つ**(単語帳で踏んだ失敗) */
          <div className="qr-result">
            <SessionResult
              items={done.map((x) => ({ ok: x.ok, main: x.en, sub: x.ja }))}
              unit="文"
              week={week}
              extra={<GoalBar goal={goal.sentGoal} done={goal.sentDone} unit="文" />}
              missLead="上に出ているのが、言えなかった文です。また明日出ます。"
            >
              {/* **行き止まりを作らない。** 範囲に残りがあれば、
                  読み直さずにそのまま次の区切りへ進める(並びも保たれる) */}
              <div className="btn-row">
                {pending.length > 0 && (
                  <button type="button" className="btn btn--primary" onClick={next}>
                    つぎの {takeCount(size, pending.length)} 問
                  </button>
                )}
                <button type="button"
                        className={`btn ${pending.length > 0 ? 'btn--quiet' : 'btn--primary'}`}
                        onClick={stop}>
                  おわる
                </button>
              </div>
              {pending.length > 0 && (
                <p className="card-hint">この範囲に、あと {pending.length} 問あります。</p>
              )}
            </SessionResult>
          </div>
        ) : (
          /* **1問ぶんは、教材の中の Quick Response とまったく同じ部品**(`QrCard`)。
             ちがうのはボタンの言葉だけ(2026-09 利用者の指定)。
             教材の中は「その場で言えたか」、こちらは「これから言えるか」を訊く */
          <QrCard
            pair={run[at]} no={at + 1}
            onAnswer={answer}
            yetLabel="まだ" okLabel="言える"
            extra={(
              /* **消す道を必ず用意する。** 溜まる一方だと、押し間違えた1問が
                 ずっと出続ける。答えではない操作なので、枠線だけのボタンにする */
              <button type="button" className="btn btn--ghost btn--small" onClick={retire}>
                もう出さない
              </button>
            )}
          />
        )}
      </section>
    )

    /* **下の帯は渡さない。** Quick Response は「まだ / 言える」で進むので、
       ◀ 前 / 次 ▶ を置くと進め方が2つになる(教材の中の Quick Response と同じ) */
    return (
      <FocusFrame
        className="qrfocus"
        /* **紙を持たない集中モードにする**(2026-09 実機・利用者の指定)。
             > あくまでバックグラウンドの色を白くして、
             > 集中モードではなくしてください
           単語帳の復習と**並ぶ画面**なので、見た目もそろえる。
           **幅は1ドットも変えていない**(「幅は変えないでくださいよ」) */
        plain
        learnerId={learnerId}
        page={`qrrev:${at}`}
        scrollKey={`qrrev:${at}`}
        onClose={stop}
        top={(
          <span className="focus-count">
            {finished ? `${run.length} / ${run.length}` : `${at + 1} / ${run.length}`}
          </span>
        )}
        /* **中に入ってからも絞り込める**(2026-09 利用者の指定)。
           始める前とまったく同じ「出しかた」を、帯の右端から開く。
           **中身は書き写さない** —— `ReviewScope` の畳んだ形である */
        topEnd={(
          <ReviewScope
            compact
            rows={filtered}
            unit="問"
            scope={scope}
            size={size}
            narrowed={narrowed}
            onScope={(id) => { setScope(id); saveScope('qr', id) }}
            onSize={(sz) => { setSize(sz); saveSize('qr', sz) }}
            onStart={start}
          >
            <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
          </ReviewScope>
        )}
      >
        {body}
      </FocusFrame>
    )
  }

  // ── 始める前 ───────────────────────────────────────────────
  return (
    <section className="card">
      {/* **上の説明は出さない**(2026-09 実機・利用者の指定
          「上下の説明が不要です。これはquick response、単語帳に共通です」)。
          一度読めば足りるものが、毎日いちばん上に居座っていた */}
      <h2 className="card-title">{who}Quick Response(復習)</h2>

      {!qrReviewSupported() && (
        <p className="notice notice--warn">
          この Supabase にはまだ復習の入れ物(0040 の SQL)が入っていません。
          貼るまでは、教材の Quick Response はこれまでどおり使えますが、
          「まだ」を押した文は溜まりません。
        </p>
      )}
      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      {busy ? (
        <p className="muted">読み込み中…</p>
      ) : rows.length === 0 ? (
        <p className="hint">
          まだ1問も溜まっていません。教材の Quick Response で「まだ」を押すと、
          その文がここに入ります。
        </p>
      ) : (
        <>
          {/* **数え方を、単語帳とそろえる**(2026-09 実機・利用者の指定)。

                > 「今日出す」「溜まっている」の意味が私にも分からないので、
                > そもそも文言を変えたいですね。

              調べたところ、Anki(新規 / 学習中 / 復習)も WaniKani も
              mikan(今日の目標 / 覚えた単語数)も、**「帳面ぜんぶの数」を
              大きく出しているアプリはほとんど無かった。** 出しているのは
              「今日やる数」か「覚えた数」(=進み具合)である。

              しかも**このアプリの単語帳には、すでに
              「まだ / 覚えかけ / 覚えた」**があった。こちらだけが
              「今日出す / 溜まっている」という**別の数え方**をしていた。
              利用者が単語帳にそろえることを選んだ。

              **「今日いくつやるか」は、すぐ下の「6 問を出す」が言っている。**
              だからここでは言わない(同じものを2か所に出さない)。

              箱(0〜6)は**仕組みの内側の数字なので画面に出さない**が、
              **どの段にいるか**を3つに束ねて言うことはできる。
              言葉は Quick Response の言い方にそろえる(「覚えた」ではなく
              「言える」)—— あちらは語、こちらは文である。

              **押せる**(2026-09 利用者の指定「タッチすればそれらを
              復習できるようにしたい」)。見た目は `ReviewStats` 1つで、
              単語帳とまったく同じもの。**書き写さない** */}
          <ReviewStats
            items={QR_GROUPS.map((g) => ({ ...g, n: tally[g.id] ?? 0 }))}
            value={group}
            onPick={pickGroup}
            dueId="yet"
            lead={groupLead(QR_GROUPS, group, '問')}
          />

          {/* **いつのぶんを、何問ずつ、何で絞るか**(2026-09 利用者の指定)。
              単語帳とまったく同じ部品。**書き写さない。**
              絞り込みと並べ方も、**この中(「出しかた」)に入れる** ——
              設定が画面の3か所に散っていたのを1か所にまとめた */}
          <ReviewScope
            rows={filtered}
            unit="問"
            scope={scope}
            size={size}
            narrowed={narrowed}
            onScope={(id) => { setScope(id); saveScope('qr', id) }}
            onSize={(s) => { setSize(s); saveSize('qr', s) }}
            onStart={start}
          >
            {/* **絞り込みは単語帳と同じ部品**(`WordbookFilter`)。
                ちがうのは、**教材名のプルダウンを出す**という1点だけ
                (2026-09 利用者の指定「『テキスト』= 教材の名前で絞る」) */}
            <WordbookFilter rows={rows} value={filter} onChange={setFilter} showMaterial />
            <label className="wbfilter-row">
              <span className="wbfilter-name">並べ方</span>
              <select className="wbfilter-ctl" value={order}
                      onChange={(e) => { setOrder(e.target.value); saveOrder(e.target.value) }}>
                {QR_ORDERS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </ReviewScope>

          {/* **聞き流し**(2026-09 利用者の指定)。「出す」のとなりに置く ——
              同じ文を、答えるか・聴くだけかの違いなので、選ぶのはここである。
              **範囲の札も絞り込みも並べ方も、そのまま効く**(`listen()` 1か所)。
              単語帳の `wb-listen` と**まったく同じ形**にそろえる */}
          <button type="button" className="btn btn--quiet wb-listen"
                  disabled={shown.length === 0}
                  onClick={listen}>
            <MusicIcon />聞き流す({shown.length} 問)
          </button>

          {shown.length === 0 && filtered.length === 0 && (
            <p className="hint">この絞り込みに当てはまる文がありません。</p>
          )}
        </>
      )}

      {/* **部品は `WordRadio` 1つ。** 単語帳とまったく同じものを使い、
          渡すのは「どの画面から来たか」だけ(`where`)。
          読み方の一覧も、覚える鍵も `wordRadio.js` が持っている ——
          **書き写すと、必ず片方だけ古くなる**(CLAUDE.md) */}
      {radio && (
        <WordRadio
          rows={radio}
          where="qr"
          tracks={tracks}
          learnerId={learnerId}
          onClose={() => setRadio(null)}
        />
      )}
    </section>
  )
}
