/**
 * **いま、誰の記録として残るか**(第5.178節・2026-09 利用者の指摘)。
 *
 * ============================================================================
 *   > ゲストページ内のそのゲストの宿題になっている教材内で単語やフレーズを
 *   > 単語帳に登録しているはずなのに、明らかに他のゲストが登録した単語などが
 *   > 入っていることがあります。しっかり分けて管理する体制にしてください。
 *
 * 【何が起きていたか】
 *
 *   レッスン表示には**2つの入り口**がある。
 *
 *   | どこから開いたか | 語の行き先 |
 *   |---|---|
 *   | ゲストのページ → 宿題 → セッションで使う | **そのゲスト**(正しい) |
 *   | **教材の画面 → セッションで使う** | **トレーナー自身**(混ざる) |
 *
 *   あとのほうは 2026-08 に「トレーナー自身の記録でよいですか → はい」と
 *   決めたものだが、**利用者はふだん教材の画面から開いている**
 *   (`LessonView` のメモの節に、同じことがすでに書いてある)。
 *   だから**トレーナー自身の単語帳に、どのゲストとのセッションで拾った語も
 *   まとめて溜まっていた。** それが「他のゲストの語が入っている」の正体である。
 *
 * 【直し方 —— 消すのではなく、見えるようにする】(2026-09 利用者の指定)
 *
 *   > 開いてから、帯で切り替える
 *
 *   **既定はこれまでどおり「自分」。** 動きは変えない。
 *   そのかわり**いま誰の記録になるかを、帯に必ず出す。**
 *   押せばその場で相手を変えられる(**行き止まりを作らない**)。
 *
 *   **見えない持ち主は管理できない** —— AI を呼ぶ前に回数と金額を出すのと
 *   まったく同じ考え方である(CLAUDE.md「見えない費用は管理できない」)。
 *
 * 【切り替えられるのは、相手が決まっていないときだけ】
 *
 *   ゲストのページから開いたときは、相手がもう決まっている。
 *   そこで切り替えられると、**画面共有中に取り違えたまま気づかない**
 *   (`lastLearner.js` がいちばん恐れている事故と同じ)。
 *   だから**受け止められる親(`onPick`)がいるときだけ**押せる形にする。
 *   いないときは、ただの名札である(**効かない操作を見せない**)。
 *
 * 【自分では何も読まない】
 *
 *   一覧も名前も**props で受け取るだけ**なので、骨組み(Supabase 無し)でも
 *   そのまま描ける(**描けないものは測れない**・CLAUDE.md)。
 * ============================================================================
 *
 * @param learnerId いまの相手。`null` は「自分」
 * @param name      相手の名前(`people` に無くても出せるように)
 * @param people    選べる担当ゲスト(`[{ id, display_name }]`)。`null` は読み込み中
 * @param onPick    選ばれた相手(「自分」は `null`)。**渡したときだけ押せる**
 * @param onOpen    札を押したときの合図(担当ゲストを読みに行く)
 */
import { useRef, useState } from 'react'
import SettingsSheet from './SettingsSheet.jsx'
import BookShelf from './BookShelf.jsx'

/** 「自分」を指す id。**`BookShelf` は id で選ぶので、自分にも1つ要る** */
const ME = 'me'

/** 誰の記録かを1行で言う。**文言はここ1か所**(画面に書き写さない) */
export const ownerLabel = (learnerId, name = '') => (
  learnerId ? `${String(name ?? '').trim() || 'ゲスト'}さんの記録` : '自分の記録'
)

export default function SessionOwner({
  learnerId = null, name = '', people = null, onPick = null, onOpen = null,
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const label = ownerLabel(learnerId, name)

  /* **行ごと、この部品が持つ。**
     文の前後(「この教材で拾った語は」「に入ります」)を呼ぶ側に書くと、
     **骨組みと本物が食い違う**(CLAUDE.md で何度も転んだところ)。
     帯の中には置けなかった —— 320px の帯はすでに満杯で、
     札が 26px まで潰れて読めなかった(実測・第5.178節) */
  const row = (inner) => (
    <div className="lesson-ownerrow no-print">
      <span className="lesson-ownerrow-lead">この教材で拾った語は</span>
      {inner}
      <span className="lesson-ownerrow-lead">に入ります</span>
    </div>
  )

  /* **受け止める人がいなければ、ただの名札。**
     押せる見た目にすると、押しても何も起きない行き止まりになる */
  if (!onPick) {
    return row(
      <span className="lesson-owner lesson-owner--fixed">
        <span className="lesson-owner-name">{label}</span>
      </span>,
    )
  }

  return (
    <>
      {row(
      <button type="button"
              ref={btnRef}
              className={`btn btn--small lesson-owner${open ? ' chip--on' : ''}`}
              aria-expanded={open}
              onClick={() => { setOpen((v) => !v); if (!open) onOpen?.() }}>
        {/* **名前は切らない。** 狭い画面では入るところまでで「…」になる
            (`.bookpick` とまったく同じ作法・第5.176節) */}
        <span className="lesson-owner-name">{label}</span>
        <span aria-hidden="true">▾</span>
      </button>,
      )}
      {open && (
        <SettingsSheet
          anchorEl={btnRef.current}
          onClose={() => setOpen(false)}
          title="誰の記録として残しますか"
          /* 読み込みが終わると行が増える。**置き直す合図を渡す** */
          placeKey={`${learnerId ?? 'me'}/${people?.length ?? -1}`}
        >
          {/* **並べるのは `BookShelf` に任せる。**
              冊をえらぶのと、相手をえらぶのは**同じ形**である ——
              印・太字・枠・地色・`aria-current` の5つで示す作法を
              ここに書き写すと、必ず片方だけ古くなる(CLAUDE.md) */}
          <BookShelf
            books={[
              /* **「自分」を先に置く。** これまでどおりの道を残す */
              { id: ME, label: '自分の記録' },
              ...(people ?? []).map((p) => ({
                id: p.id, label: `${p.display_name}さんの記録`,
              })),
            ]}
            book={learnerId ?? ME}
            onPick={(id) => { onPick(id === ME ? null : id); setOpen(false) }} />
          {/* **黙って空にしない。** 読んでいる最中と、いない場合を書き分ける */}
          {people === null && <p className="card-hint">読んでいます…</p>}
          {people?.length === 0 && (
            <p className="card-hint">担当しているゲストがいません。</p>
          )}
          <p className="tip card-hint">
            単語帳・Quick Response・セッションの記録の3つが、ここで選んだ人のものになります。
          </p>
        </SettingsSheet>
      )}
    </>
  )
}
