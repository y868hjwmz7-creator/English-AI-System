/**
 * 左のメニューのいちばん下に置く「**設定**」(2026-09 利用者の指定)。
 *
 *   > サイドバーの「配色」から「教材の支度」までの項目をすべてまとめて
 *   > 「設定」としてサイドバーの一番下に配置してください。
 *
 * 【何が詰まっていたか】
 *   設定が**7つ縦に並んで**いた(配色 / 色づかい / 説明の文 /
 *   押したときの音 / 英語の音声 / 音楽 / 教材の支度)。どれも
 *   **一度決めたら何度も触らないもの**なのに、メニューを開くたびに
 *   行き先(画面の一覧)と同じだけの高さを占めていた。
 *
 * 【だから畳む。消さない】
 *   **1つも減らしていない**(「一度入れたものを勝手に減らさない」・共通ルール)。
 *   押すものを**「設定」1つ**にして、中に全部入れてある。
 *   ふだんは閉じているので、メニューは行き先だけになる。
 *
 * 【いまは9つある】(第5.257節・2026-09-25 利用者の指定)
 *   「音楽」が3つに割れた —— **オン / オフ・曲・音楽の大きさ**。
 *   **オフのあいだは、下の2つを出さない**(効かない操作を見せない)。
 *
 * 【開け閉めは覚えない】
 *   毎回触るものではない。覚えていると、次にメニューを開いたときに
 *   **行き先より先に設定が目に入る** —— いま直しているのは、まさにそれである
 *   (`CastChip` と同じ考え方。`SearchBar` が覚えるのは、あちらが
 *   「探しながら何度も開け閉めするもの」だからで、役目が違う)。
 *
 * 【自分では覚えない・自分では読みに行かない】
 *   値も書き込みも**呼ぶ側(`App.jsx`)が持つ。** ここは受け取って描くだけ
 *   なので、`npm run test:bar` が Supabase 無しでそのまま描いて測れる
 *   (`QrCard` / `WordRadio` / `SpeechPractice` と同じ作法 ——
 *   **描けないものは測れない**)。
 *
 * 【絵文字(⚙)を使わない】
 *   端末ごとに形も大きさも違う。すでにある `GearIcon` を使う
 *   (**足す前に、同じ絵がもう無いか探す**・CLAUDE.md)。
 */
import { GearIcon } from './Icons.jsx'
import VolumeRow from './VolumeRow.jsx'
import { THEMES } from '../lib/theme.js'
import { PALETTES } from '../lib/palette.js'
import { TIPS } from '../lib/tips.js'
import { volumeWorks } from '../lib/mixVolume.js'

/** 「どれか1つ」を選ぶ帯。**4つとも同じ形なので、書き写さない** */
function Pick({ label, options, value, onChange }) {
  return (
    <div className="nav-setting">
      <span className="nav-setting-label">{label}</span>
      <div className="theme-switch" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.id)} type="button" title={o.hint}
                  className={`theme-btn${value === o.id ? ' is-active' : ''}`}
                  onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const SOUNDS = [{ id: true, label: '鳴らす' }, { id: false, label: '鳴らさない' }]
/** 音楽を流すか(第5.257節・2026-09-25 利用者の指定「音楽on / offの設定も」) */
const MUSICS = [{ id: true, label: 'オン' }, { id: false, label: 'オフ' }]
const PREPARES = [
  { id: true, label: '自動', hint: '過去の教材も、裏で順に用意しておく' },
  { id: false, label: '使うときだけ', hint: '発行と「セッションで使う」のときだけ' },
]

export default function NavSettings({
  theme, onTheme,
  palette, onPalette,
  tips, onTips,
  sound, onSound,
  voiceVol, onVoiceVol,
  bgmVol, onBgmVol,
  /**
   * **音楽を流すか**(第5.257節・2026-09-25 利用者の指定)。
   *
   *   > 音量設定はそのまましっかり機能するようにし、
   *   > それに加えて音楽on / offの設定も追加してください。
   *   > on にしたら曲が選べるプルダインも出るように
   *
   * **新しい設定を足していない。** 「どこで流すか」のいちばん上が
   * すでに「流さない」なので、そこを切り替えているだけである
   * (判断は `bgmOn()` / `setBgmOn()` 1か所)。
   */
  music, onMusic,
  /** 曲のえらび(**2曲以上あるときだけ出る** —— `bgmChoices()` が決める) */
  songs = [], song, onSong,
  /** 「教材の支度」を出すか。**トレーナーと管理者だけ**(費用が出ていく) */
  showPrepare = false,
  prepare, onPrepare,
}) {
  return (
    <details className="nav-settings">
      <summary className="nav-settings-sum">
        <GearIcon className="icon nav-settings-icon" />
        設定
      </summary>
      <div className="nav-settings-body">
        <Pick label="配色" options={THEMES} value={theme} onChange={onTheme} />
        <Pick label="色づかい" options={PALETTES} value={palette} onChange={onPalette} />

        {/* **説明の文を出すか**(2026-09 利用者の指定)。

              > 全てのデザインから言葉による説明を省いてください。
              > 目指すのは説明がない、直感的なUIです。

            既定は「出さない」。**消してはいない**ので、ここで戻せる。
            畳むかどうかの決まりは `src/lib/tips.js` と styles.css の
            1行だけで、画面の側は `tip` の印を付けてあるだけである。 */}
        <Pick label="説明の文" options={TIPS} value={tips} onChange={onTips} />

        {/* 押した手応え(音とふるえ)。レッスン中に鳴ると邪魔なことが
            あるので、切れるようにしてある
            (2026-09 に「鳴らさない」から改めた・利用者の指定) */}
        <Pick label="押したときの音" options={SOUNDS} value={sound} onChange={onSound} />

        {/* **英語の音声の大きさ**(2026-09 利用者の指定)。

              > アプリに好きな音楽を追加し、英語の音声と音楽を独立して
              > それぞれ音量を調整出来るようにしたいです。
              > 英語音声が再生される時に自動で音楽の音量を下げる機能は
              > 必要ありません

            **置くのはここ1か所。** 端末ごとに覚える「一度決める設定」で、
            しかも**聴く人が決める**ものなので、音楽の画面(トレーナーだけ)には
            置かない —— ゲストも英語の音声を聴くし、曲も耳に入る。
            **同じ設定を2か所に置かない**(CLAUDE.md)。

            **効かない端末では、つまみを出さずに理由を言う。**
            iOS は `<audio>` の `volume` を無視するので、iPhone / iPad では
            どちらのつまみも動かない。**端末の名前では決めない** ——
            `volumeWorks()` が実際に入れて読み返すので、
            いつか受け付けるようになった日には**ひとりでに出る。** */}
        {volumeWorks() ? (
          <VolumeRow label="英語の音声" value={voiceVol} onChange={onVoiceVol} />
        ) : (
          <div className="nav-setting">
            <span className="nav-setting-label">音量</span>
            <p className="nav-vol-no">
              この端末は、アプリからの音量指定を受け付けません
              (iPhone・iPad)。端末の音量ボタンで調整してください。
            </p>
          </div>
        )}

        {/* ── **音楽**(第5.257節・2026-09-25 利用者の指定)──────────────

              > 設定から音楽の音量を0%にしても音楽が消えません。
              > 音量設定はそのまましっかり機能するようにし、
              > それに加えて音楽on / offの設定も追加してください。
              > on にしたら曲が選べるプルダインも出るように

            **3つを、この順に1かたまりで置く。**
            オフにしたら、下の2つは出さない ——
            選んでも何も鳴らないものを見せない(効かない操作を見せない)。

              音楽    [オン][オフ]
              曲      [ぜんぶ(順不同) ▾]   ← 2曲以上あるときだけ
              音楽の大きさ [────●──] 40%   ← 音量が効く端末だけ

            **「音楽」という名前を2つ置かない**(CLAUDE.md
            「違うものに同じ名前を付けない」)。つまみのほうは
            **「音楽の大きさ」**と呼び分ける —— すぐ上の行が
            オン / オフ なので、同じ名前だと**どちらが何なのか読めない。** */}
        <Pick label="音楽" options={MUSICS} value={music} onChange={onMusic} />
        {music && songs.length > 0 && (
          <label className="nav-setting nav-song">
            <span className="nav-setting-label">曲</span>
            <select className="nav-song-pick" value={song}
                    onChange={(e) => onSong?.(e.target.value)}>
              {songs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        )}
        {music && volumeWorks() && (
          <VolumeRow label="音楽の大きさ" value={bgmVol} onChange={onBgmVol} />
        )}

        {/* **過去の教材も、裏で順に支度するか**(2026-09 利用者の指定)。

              > 過去に作成したものも常にバックグラウンドで再生準備を
              > 進められないでしょうか？

            教材の画面を開いているあいだ、まだ音声の無い教材を1本ずつ
            用意していく。**費用が出ていく**ので、切れるようにしてある
            (「見えない費用は管理できない」・CLAUDE.md)。
            いま何本待っているかは、上の帯がいつも出している。 */}
        {showPrepare && (
          <Pick label="教材の支度" options={PREPARES} value={prepare} onChange={onPrepare} />
        )}
      </div>
    </details>
  )
}
