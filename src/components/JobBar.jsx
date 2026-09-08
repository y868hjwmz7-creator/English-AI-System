/**
 * 裏で作っている教材の**進み具合の帯**(2026-09 利用者の指定)。
 *
 *   > 作成中の進行度合いを示すバーを作成して、どのページにいても
 *   > 見えるように
 *
 * 【なぜ要るか】
 *   教材の生成は画面から切り離して走る(`src/lib/generateJob.js`)ので、
 *   ほかの画面へ移っても続く。**ところが移った先には、何の手がかりも無かった。**
 *   1〜3分かかるものが、動いているのか止まったのかも分からない。
 *   「**成功と失敗が、同じ見た目で終わってはいけない**」(CLAUDE.md)の、
 *   途中の話である。
 *
 * 【決めたこと】
 *   ・**帯は上に貼り付ける。** 下へ送っても見えていないと意味がない
 *   ・**経過秒数を出す。** 何%かだけでは、止まったのかどうか分からない
 *     (通信の待ち時間と同じ作法・CLAUDE.md)
 *   ・**「作るのをやめる」をここにも置く。** 止めたくなったときに、
 *     教材の画面まで戻らせない。押したときだけ止まる決まりは変えていない
 *   ・**走っているあいだだけ出す。** 終わったことは、お知らせ(`jobnote`)と
 *     メニューの青い丸が伝える。**同じことを3つ出さない**
 *   ・文言は `jobProgressLabel()` 1か所(作る画面のボタンと同じもの)
 *
 * 【ゲストには出さない】(2026-09 実機・利用者の指定)
 *
 *   ゲストの画面のいちばん上に、支度の帯が
 *   「2026-09-04 / 食事の話 / 決まり文句 …  閉じる」として残っていた。
 *
 *   **教材を作るのも、支度を始めるのもトレーナーだけ**である
 *   (`MaterialForm` と `TrainerMaterials` の2か所からしか始まらない)。
 *   ところが**帯そのものには役割の判定が1つも無かった**ので、
 *   トレーナーで開いたまま画面を読み込み直さずにゲストでログインし直すと、
 *   帯だけが残っていた(帯の状態は画面の中にあり、読み込み直すまで消えない)。
 *
 *   「**ゲストには、仕組みの内側を見せない**」(CLAUDE.md)。
 *   教材の名前も、支度の進み具合も、ゲストにできることが何も無い
 *   スクールの内側の話である。
 *
 *   ・**判定は `canSeeSystemDetail()` 1か所**(`SupabaseStatus` と同じ作法)。
 *     **既定は「見せない」**なので、役割が分からないうちも出ない
 *   ・**部品の中に置く。** 呼ぶ側(`App.jsx`)に書くと、
 *     置く場所が増えたときに必ずどこかが抜ける
 *   ・**仕組みは1つも止めていない。** 支度も生成も裏で走ったまま。
 *     消したのは**見せ方**だけである(残すのと、見せるのは別のこと)
 */
import { cancelJob, jobProgressLabel, jobRatio } from '../lib/generateJob.js'
import {
  cancelPrepare, clearPrepare, prepareLabel, prepareRatio,
} from '../lib/prepareJob.js'
import { canSeeSystemDetail } from '../lib/viewer.js'

export default function JobBar({
  job, secs, onOpen, onPublish, showOpen = false,
  /** 発行したあとの「支度」(2026-09 利用者の指定)。`prepareJob.js` */
  prep = null, prepSecs = 0,
}) {
  /* 仕組みの内側の話なので、ゲストには出さない(既定は「見せない」) */
  if (!canSeeSystemDetail()) return null

  /* ── 発行したあとの支度(音声と語の意味)──────────────────
   *
   *   > 初めて再生するときの待ち時間が３０秒近くあり、これは、教材が
   *   > 完成した際にバックグランドで準備する仕様にできないでしょうか？
   *
   *   **教材を作る仕事とは別の枠**なので、この帯にも別に出す。
   *   **同時には出さない** —— 作っている最中は、そちらが先である
   *   (支度は発行のあとに始まるので、ふつうは重ならない)。 */
  if (!job && prep) {
    const pct = Math.round(prepareRatio(prep) * 100)
    const running = prep.state === 'running'
    return (
      <div className={`jobbar${running ? '' : ' jobbar--done'}`}
           role="status" aria-live="polite">
        <div className="jobbar-row">
          <span className="jobbar-title">{prepareLabel(prep, prepSecs)}</span>
          <button type="button" className="btn btn--small btn--quiet"
                  onClick={running ? cancelPrepare : clearPrepare}>
            {running ? '支度をやめる' : '閉じる'}
          </button>
        </div>
        {running && (
          <div className="jobbar-track"
               role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
               aria-label="支度の進み具合">
            <div className="jobbar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    )
  }

  if (!job) return null

  /* ── できあがったら、**そのまま発行へ行ける1つのボタン**を出す ──
       2026-09 利用者の指定。

         > 教材を作りかけの状態で他のページに移った時に、どこに戻れば
         > 最終的な「発行する」を確定できるのかが非常に分かりにくいです。
         > どのページにいても教材の準備ができたらワンタッチで「発行」前の
         > 画面に遷移できるよう設計しなおしてください。
         > ※作成中であることはどのページにいてもしっかり見えていて、
         >   そこは、ばっちりです。

       **作っているあいだは見えていた。** ところが**できあがった瞬間に
       この帯が消えて**いた(以前は `state !== 'running'` で何も出さなかった)。
       残るのはメニューの青い丸だけで、そこから
       「教材 → 教材を作る」と2回たどらないと発行できなかった。

       ・**できあがっても帯は残す。** 消えるのは、下書きを受け取ったとき
       ・**ボタンは1つだけ**(「発行する画面へ」)。押した先が分かる言葉にする
       ・**狭い画面でも出す。** ここを畳んだら、この直しの意味がなくなる
         (作っているあいだの「教材の画面へ」は、これまでどおり畳む) */
  if (job.state === 'done') {
    return (
      <div className="jobbar jobbar--done" role="status" aria-live="polite">
        <div className="jobbar-row">
          <span className="jobbar-title">{job.title}の下書きができました</span>
          <button type="button" className="btn btn--small btn--primary jobbar-go"
                  onClick={onPublish}>
            発行する画面へ
          </button>
        </div>
      </div>
    )
  }

  if (job.state !== 'running') return null

  const ratio = jobRatio(job)
  const pct = Math.round(ratio * 100)

  return (
    <div className="jobbar" role="status" aria-live="polite">
      <div className="jobbar-row">
        <span className="jobbar-title">{job.title}を作っています…</span>
        {/* **名前を二度書かない。** 上ですでに「記事を」と出している */}
        <span className="jobbar-step">
          {jobProgressLabel(job, secs, { showLabel: job.label !== job.title })}
        </span>

        {/* **押した先が分かるときだけ出す。** 教材の画面にいるなら要らない */}
        {showOpen && (
          <button type="button" className="btn btn--small btn--ghost jobbar-open"
                  onClick={onOpen}>
            教材の画面へ
          </button>
        )}
        <button type="button" className="btn btn--small btn--quiet"
                onClick={cancelJob}>
          作るのをやめる
        </button>
      </div>

      {/* 進み具合そのもの。**読み上げにも数字で伝える** */}
      <div className="jobbar-track"
           role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
           aria-label={`${job.title}の進み具合`}>
        <div className="jobbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
