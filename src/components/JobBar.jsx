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
 */
import { cancelJob, jobProgressLabel, jobRatio } from '../lib/generateJob.js'

export default function JobBar({ job, secs, onOpen, showOpen = false }) {
  if (!job || job.state !== 'running') return null

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
