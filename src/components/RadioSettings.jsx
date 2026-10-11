/**
 * ★ **聞き流しの設定**(第5.445節・④・2026-10-10 利用者の指定)。
 *
 *   > そうですね、聞き流しの設定は右上にしましょう
 *   > 右上の設定の中ですよね。
 *
 * ============================================================================
 * 【なぜ移したか】
 *
 *   聞き流しが**別の画面**だったころは、その画面の右上に自分の設定を
 *   持っていた(第5.274節)。画面を分けるのをやめた(第5.445節・②)ので、
 *   **置き場所が無くなった。**
 *
 *   **練習の画面の「出しかた」(右上)の中に入れる。** あそこは
 *   「いまの画面で何をどう出すか」を決める場所で、何問ずつ・ランダム・
 *   くり返す・訊き方が**もう並んでいる。**
 *   読み方と間と曲と音量は、まさにその続きである。
 *
 * 【ここには、聞き流しだけのものを置く】
 *
 *   ・**何問ずつ**と**ランダム**は置かない —— 「出しかた」の帯が
 *     もう持っている(**同じことをするものを2つ見せない**・CLAUDE.md)。
 *     流すのは**練習と同じ並び・同じ範囲**である
 *   ・**「教材(冊)」「冊の中の区切り」も置かない** —— あれは
 *     上の帯の `冊名 ▾` が持っている。聞き流しが別画面だったころは
 *     帯が見えなかったので中に入れていた(第5.283節 / 第5.288節)が、
 *     **いまは帯がそのまま見えている**
 *
 * 【欄の形は、もとの聞き流しの設定と1ミリも変えていない】
 *
 *   名前と欄を**2列の格子**に直に並べる(`.radio-set-body`・第5.273節)。
 *   名前の長さがまちまちでも、欄は同じ場所から始まり同じ幅になる。
 *   **見た目の決まりは `styles.css` 1か所**で、ここに数を書かない。
 */
/* 音量のつまみ。**覚えるのは `mixVolume.js`、鳴っている曲に当てるのは
   `bgm.js`** —— ここは受け取って描くだけ */
import VolumeRow from './VolumeRow.jsx'
import { VOL_NO_TEXT, volumeWorks } from '../lib/mixVolume.js'
/* **どの曲を流すか**(第5.194節)。選び方も文言も、あちら1か所が持つ */
import { bgmChoices } from '../lib/bgmPick.js'
import {
  radioGapLabelFor, radioGapsFor, radioModesFor,
} from '../lib/wordRadio.js'

/**
 * @param {string} o.where `'word'` / `'qr'`。**読み方の一覧も、間の一覧も
 *   これで決まる**(`wordRadio.js` 1か所)
 * @param {string} o.uid 名札と欄を結びつけるための id(呼ぶ側の `useId()`)
 */
export default function RadioSettings({
  uid = 'radioset',
  where = 'word',
  mode, onMode,
  gap, onGap,
  tracks = [], tracksError = null,
  pick, onPick,
  voiceVol, onVoiceVol,
  bgmVol, onBgmVol,
}) {
  const modes = radioModesFor(where)
  const 曲選び = bgmChoices(tracks)

  return (
    /* **別々の物を、すき間ゼロでくっつけない**(共通ルール)。
       入れ物(`.rscope-radio`)は `gap` を持っているが、
       **ここでも1つ束ねる** —— 欄の格子と音量のつまみは別々の物である */
    <div className="radio-set">
      <div className="radio-set-body">
        {/* **読み方は、選べるものが2つ以上あるときだけ出す**
            (**効かない操作を見せない**・CLAUDE.md)。
            単語帳は「英語だけ」1つきりなので、そこでは出ない */}
        {modes.length > 1 && (
          <>
            <label className="radio-set-name" htmlFor={`${uid}-mode`}>読み方</label>
            <select id={`${uid}-mode`} className="radio-set-pick radio-set-pick--mode"
                    value={mode}
                    onChange={(e) => onMode(e.target.value)}>
              {modes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </>
        )}

        {/* ★ **読めなかったことを、えらぶ場所に出す**(第5.396節)。
               **「曲がありません」とは言わない** —— 登録はされている */}
        {tracksError && (
          <p className="radio-set-name radio-set-no" role="alert">
            曲を読めませんでした({tracksError})
          </p>
        )}
        {/* **2曲以上あるときだけ出す**(`bgmChoices` が決める)——
            1曲しか無ければ「ぜんぶ」とその1曲は同じものである */}
        {曲選び.length > 0 && (
          <>
            <label className="radio-set-name" htmlFor={`${uid}-song`}>曲</label>
            <select id={`${uid}-song`} className="radio-set-pick radio-set-pick--song"
                    value={pick}
                    onChange={(e) => onPick(e.target.value)}>
              {曲選び.map((x) => (
                <option key={x.id || 'all'} value={x.id}>{x.label}</option>
              ))}
            </select>
          </>
        )}

        {/* **間の長さ。** 数(秒)は1文字も削らない —— そこが読めないと、
            何を選んでいるのか分からない(CLAUDE.md)。
            **名前も `wordRadio.js` 1か所から取る**(書き写さない)——
            読み方によって「間」の意味が変わる */}
        <label className="radio-set-name" htmlFor={`${uid}-gap`}>
          {radioGapLabelFor(where, mode)}
        </label>
        <select id={`${uid}-gap`} className="radio-set-pick radio-set-pick--gap"
                value={gap}
                onChange={(e) => onGap(Number(e.target.value))}>
          {radioGapsFor(where, mode)
            .map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </div>

      {/* ── **音量**(第5.274節・利用者の指定「音楽などの設定もここに」)──

             **効かない端末では、つまみを出さずに理由を言う。**
             iOS は `<audio>` の `volume` を無視する。
             **端末の名前では決めない**(`volumeWorks()` が実際に試す)。 */}
      {volumeWorks() ? (
        <>
          <VolumeRow label="英語の音声" value={voiceVol} onChange={onVoiceVol} />
          {/* **曲が1つも無ければ出さない**(効かない操作を見せない) */}
          {tracks.length > 0 && (
            <VolumeRow label="音楽の大きさ" value={bgmVol} onChange={onBgmVol} />
          )}
        </>
      ) : (
        /* **言い方は `mixVolume.js` 1か所**(メニューの設定と同じ文) */
        <p className="nav-vol-no">{VOL_NO_TEXT}</p>
      )}
    </div>
  )
}
