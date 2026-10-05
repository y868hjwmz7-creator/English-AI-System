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
 * 【絵は「三本線と丸」(`SortIcon`)。**歯車は使わない**】
 *   2026-09-29 利用者の指定。
 *
 *     > これから歯車は使いません。全て3本線と丸のものに統一です
 *
 *   絵文字(⚙)は端末ごとに形も大きさも違うので、もともと使っていない。
 *   **設定の絵は、アプリ全体で `SortIcon` 1つにそろえた**
 *   (聞き流しの設定・復習の「出しかた」・レッスン表示の設定と同じ絵)。
 *   `GearIcon` は、誰も呼ばなくなったので**消した**。
 */
import { SortIcon } from './Icons.jsx'
/* **ボタンの色は `btnTone.js` 1か所**(第5.242節)。ここで色名を書かない */
import { TONE_SIDE } from '../lib/btnTone.js'
/* ★ **相棒をえらぶ**(第5.373節・2026-10-05 利用者の指定
     「というよりユーザーが選べるようにしたいです」)。
     **一覧は `buddyKind.js` 1か所**で、ここでは並べるだけ */
import { BUDDY_KINDS } from '../lib/buddyKind.js'
import Buddy from './Buddy.jsx'
import VolumeRow from './VolumeRow.jsx'
/* ★ **ほかのアプリの音を混ぜるか**(第5.352節)。
   **効く端末かどうかは `mixWorks()` 1か所**が決める(名前で見分けない) */
import { MIX_MODES, mixWorks } from '../lib/audioSession.js'
import { THEMES } from '../lib/theme.js'
import { PALETTES } from '../lib/palette.js'
import { TIPS } from '../lib/tips.js'
import { VOL_NO_TEXT, volumeWorks } from '../lib/mixVolume.js'

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
/* ★ **ほかのアプリの音(Spotify など)の3つは、`MIX_MODES` が持っている**
     (第5.352 / 5.356節)。**ここに書き写さない** ——
     呼び名も、宣言する種類も、あちら1か所で決まる(CLAUDE.md)。

     **「音楽」という名前を使わない** —— すぐ下の行がアプリ自身の音楽の
     オン / オフ である(CLAUDE.md「違うものに同じ名前を付けない」)。 */
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
  mix, onMix,
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
  /* ★ **オフラインで鳴らせる音声の本数**(第5.372節)。
       **数えられなければ `null`** —— そのときはこの行ごと出さない
       (「0 と `null` を取り違えない」・CLAUDE.md)。
       **0 円である** —— 置き場所にある MP3 を落としてくるだけで、
       作り直してはいない(作り直しだけが課金される) */
  clipsKept = null, onClipsClear,
  /** いま選ばれている相棒と、選び直し(**値は呼ぶ側が持つ**) */
  buddy, onBuddy,
}) {
  return (
    <details className="nav-settings">
      <summary className="nav-settings-sum">
        <SortIcon className="icon nav-settings-icon" />
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

        {/* ★ **相棒**(第5.373節・2026-10-05 利用者の指定)。

              > というよりユーザーが選べるようにしたいです

            **言葉で選ばせない。絵で選ばせる**(「余計な説明書きは全て排除」)。
            名前は読み上げ(`aria-label`)にだけ置いてある。
            **一覧は `buddyKind.js` 1か所**で、ここは並べるだけ ——
            増やす日に、この画面は1行も直らない。 */}
        <div className="nav-setting">
          <span className="nav-setting-label">相棒</span>
          <div className="buddy-pick" role="group" aria-label="相棒">
            {BUDDY_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`buddy-pick-btn${buddy === k.id ? ' is-on' : ''}`}
                aria-pressed={buddy === k.id}
                aria-label={k.label}
                onClick={() => onBuddy?.(k.id)}
              >
                {/* **本物の相棒をそのまま描く。** 別の絵を置くと、
                    選んだあとに出てくるものと食い違う。
                    **顔だけ**(`sm`)にして3人を1行に収める —— 全身だと
                    メニューの幅(248px)で折り返し、行の高さが相棒の数で動く */}
                <Buddy kind={k.id} face="glad" size="sm" />
              </button>
            ))}
          </div>
        </div>

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
            {/* **言い方は `mixVolume.js` 1か所**(第5.274節)——
                聞き流しの設定にも同じ文が要る */}
            <p className="nav-vol-no">{VOL_NO_TEXT}</p>
          </div>
        )}

        {/* ★ **ほかのアプリの音**(第5.352節)。

              > アプリの英語の音声を聴くと音楽が消えてしまいます。

            **効く端末にだけ出す。** この宣言を持っているのは
            いまのところ Safari だけで、ほかの端末ではそもそも
            ほかのアプリの音を止めていない —— **効かない操作を見せない**
            (上の音量のつまみと、まったく同じ作法)。 */}
        {mixWorks() && (
          <Pick label="ほかのアプリの音" options={MIX_MODES} value={mix} onChange={onMix} />
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

        {/* ★ **オフラインで鳴らせる音声**(第5.372節・2026-10-04 利用者)。

              > 通勤・移動中が多い

            一度聞いた音声は、電波が無くても鳴る。**何本あるかを出す** ——
            見えないものは管理できない(CLAUDE.md)。
            **消しても 0 円**(置き場所から落とし直すだけ)なので、確認は置かない。
            **数えられなければ、この行ごと出さない。** */}
        {clipsKept !== null && (
          <div className="nav-setting">
            <span className="nav-setting-label">オフラインの音声</span>
            <div className="nav-setting-side">
              <span className="nav-setting-now">{clipsKept} 本</span>
              <button type="button" className={`btn btn--small ${TONE_SIDE}`}
                      onClick={onClipsClear} disabled={!clipsKept}>
                消す
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
