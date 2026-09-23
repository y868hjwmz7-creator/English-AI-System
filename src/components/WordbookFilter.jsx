/**
 * 単語帳の絞り込み — **入った日(カレンダー)と、出会った教材。**
 *
 * 【なぜ要るか】(2026-08 利用者の指定)
 *
 *   > 単語帳に吹き出しのカレンダーをつけて、単語帳に追加された日付、
 *   > 教材名で絞り込みできるようにしてください
 *
 *   単語帳は増えていく。「先週のレッスンで出た語だけ」「あの記事の語だけ」で
 *   引けないと、そのうち一覧を眺めるしかなくなる。
 *
 * 【問い合わせを増やさない】
 *   絞り込みは**手元で行う。** `review_words()` は200件まで返しているので、
 *   選ぶたびに Supabase へ聞き直す必要はない。待ち時間も費用も増えない。
 *
 * 【ゲストとトレーナーで同じものを使う】
 *   単語帳の画面は2つある(`Wordbook` = ゲスト自身 /
 *   `LearnerWordbook` = トレーナーがゲストのを見る)。
 *   **同じ見た目を2か所に書き写さない。** 書き写すと必ず片方だけ古くなる。
 *
 * 【0024 を貼る前は、何も出さない】
 *   `added_at` が1件も無ければ、この行ごと出さない。
 *   **効かない操作を見せない**(CLAUDE.md)。
 */
import { useRef, useState } from 'react'
import CalendarPopover from './CalendarPopover.jsx'
import { cefrIndex } from '../data/cefr.js'
import { POS_GROUPS } from '../lib/posGroups.js'
import { CalendarIcon, CloseIcon } from './Icons.jsx'

/* 絞る・数える・空にするは **`src/lib/wordbookFilter.js` 1か所**(2026-09)。
   あちらは何にも依存しない形なので、`npm run test:play` が素の node で
   確かめられるし、`runKeyOf()`(`reviewScope.js`)も同じ `FILTER_KEYS` を
   読める —— **鍵を書き写さない**(レベルを足したときに、あちらだけ
   数え漏らした)。**呼ぶ側は1行も変わっていない。** */
export {
  FILTER_KEYS, countNarrowed, emptyFilter, addedDayOf,
  topicOf, fieldOf, levelOf, posOf, frameOf, applyWordbookFilter,
} from '../lib/wordbookFilter.js'
import {
  NO_MATERIAL, addedDayOf, countNarrowed,
  emptyFilter, fieldOf, frameOf, levelOf, posOf, topicOf,
} from '../lib/wordbookFilter.js'
import { FRAME_FORMS } from '../lib/frameMatch.js'

/**
 * 絞り込みの行。**コンパクトに、押せるものだけ**(2026-08 利用者の指定)。
 *
 *   > あとは業界、趣味別、シチュエーション、話題から上手く絞り込める
 *   > コンパクトなUIを作成してください。
 *
 * 【選べるものしか出さない】
 *   選択肢が1つ以下の欄は、そもそも出さない。
 *   すべての語が同じ分野なら「分野」の欄は要らない。
 *   **効かない操作を見せない**(CLAUDE.md)。
 *
 * 【場面と話題は1つの欄】
 *   教材は**場面か話題のどちらか一方**しか持たない
 *   (会話なら場面、記事なら話題)。欄を2つに分けると片方はいつも空になる。
 *   `<optgroup>` で見出しだけ分ける。
 *
 * 【問い合わせを増やさない】
 *   絞り込みは**手元で行う。** 選ぶたびに Supabase へ聞き直さない。
 *
 * @param {Array}  rows     一覧ぜんぶ(絞る前)
 * @param {object} value    `{ day, material, field, topic }`
 * @param {Function} onChange
 */
export default function WordbookFilter({
  rows, value, onChange,
  /**
   * **教材名のプルダウンを出すか**(0040)。
   *
   * 単語帳では出さない(2026-09 利用者の指定。下の説明を参照)。
   * Quick Response の復習では**出す** — 利用者の指定である。
   *
   *   > 「テキスト」…などから絞り込んで練習できるようにしてください。
   *   > ごめんなさい、教材の名前(「クラスに出る」など)で絞る、ということです。
   *
   * **同じ部品を、呼ぶ側の指定で変える。** 似たものを2つ持たない。
   */
  showMaterial = false,
}) {
  const [openCal, setOpenCal] = useState(false)
  const btnRef = useRef(null)

  const list = rows ?? []
  const {
    day = null, material = null, field = null,
    topic = null, level = null, pos = null, frame = null,
  } = value ?? {}

  // **0024 を貼る前は、日で絞れない。** その欄だけ出さない
  const days = [...new Set(list.map(addedDayOf).filter(Boolean))].sort().reverse()
  const titles = [...new Set(list.map((r) => r.material_title).filter(Boolean))].sort()
  const anyNone = list.some((r) => !r.material_title)

  /* 分野と、場面・話題。**0028 を貼る前は空**なので、その欄は出ない。
     同じものを2度並べないよう、鍵で1つにまとめる */
  const uniq = (pairs) => {
    const seen = new Map()
    for (const x of pairs) if (x && !seen.has(x.key)) seen.set(x.key, x)
    return [...seen.values()]
  }
  const fields = uniq(list.map(fieldOf)).sort((a, b) => a.label.localeCompare(b.label, 'ja'))
  const topics = uniq(list.map(topicOf))
  const scenes = topics.filter((t) => t.group === 'シチュエーション')
  const genres = topics.filter((t) => t.group === '話題')
  /* **レベルは、やさしい順に並べる**(名前の五十音順ではない)。
     並び順は `cefrIndex()` 1か所 —— ここで書き直すと、
     教材を作る画面のプルダウンと順が食い違う */
  const levels = uniq(list.map(levelOf)).sort((a, b) => cefrIndex(a.key) - cefrIndex(b.key))
  /* **品詞は、五十音順に並べ替えない**(2026-09 利用者の指定
     「品詞ごとに分ける絞り込み機能」)。名詞・動詞・形容詞…という
     いつもの並びのほうが探しやすいので、`POS_GROUPS` の順のまま出す。
     **その語の品詞が分からなければ、`posOf()` が `null` を返す** ——
     そのぶんは選択肢に出ないだけで、絞らなければこれまでどおり出る */
  const posSet = new Set(list.map((r) => posOf(r)?.key).filter(Boolean))
  const poss = POS_GROUPS.filter((g) => posSet.has(g.id))

  /* **英文の「型」**(2026-09 利用者の指定「型の見分け、使い分けは
     必ず実現したいトレーニングです」)。

     **並べ替えない。** `sentenceFrames.js` に並んでいる順のまま出す
     (①無生物主語 → ②主語の席 → ③それ以外。巻末の一覧・PDF と同じ順)。
     五十音順にすると、資料と見比べられなくなる。

     **型を言い当てられなかった文は、選択肢に出ない** ——
     `frameOf()` が `null` を返すだけで、条件は1つも足していない
     (品詞とまったく同じ) */
  const frameFound = new Map()
  for (const r of list) {
    const f = frameOf(r)
    if (f && !frameFound.has(f.key)) frameFound.set(f.key, f)
  }
  const frames = FRAME_FORMS.map((f) => frameFound.get(f)).filter(Boolean)
  const frameGroups = [...new Set(frames.map((f) => f.group))]

  // **選べるものが何も無ければ、行ごと出さない**
  const show = {
    day: days.length > 0,
    material: showMaterial && (titles.length > 1 || (titles.length === 1 && anyNone)),
    field: fields.length > 1,
    topic: topics.length > 1,
    // **0048 を貼るまでは空**なので、その欄は出ない
    level: levels.length > 1,
    /* **Quick Response の復習には出ない。** あちらは「文」が溜まるので
       `pos` を1つも持たない —— 条件を1つも足さずに、ひとりでにそうなる */
    pos: poss.length > 1,
    /* **型が1つしか見つからなければ、絞る意味がない。**
       Native Flow のような短い言い回しばかりの冊では、
       そもそもこの欄が出ない —— 効かない操作を見せない(CLAUDE.md) */
    frame: frames.length > 1,
  }
  if (!Object.values(show).some(Boolean)) return null

  const on = countNarrowed(value) > 0
  const set = (patch) => onChange({ ...value, ...patch })

  /* **名前を左、選ぶ欄を右。欄の幅はぜんぶ同じ**
     (2026-09 実機・利用者の指摘「日付絞り込みのアイコンの位置が悪いです」
      「全体的にもっとプロっぽいデザインに」)。

     直す前は、中身なりの幅の錠剤が**ばらばらに折り返して4行**になっていた
     (実測 390px: 日付 84 / 分野 152 / 場面 178 / 教材 233 / 並べ方 161)。
     **幅がそろっていないことが、いちばん散らかって見える原因**である。
     名前を左の柱にそろえれば、日付も「1行のうちの1つ」に収まるので、
     **アイコンの置き場所という問題そのものが消える。** */
  return (
    <div className="wbfilter">
      {show.day && (
        <div className="wbfilter-row">
          <span className="wbfilter-name">日付</span>
          {/* **選んでいなくても色を持つ**(第5.244節・`npm run test:bar` が
              見つけた)。`day ? ' btn--quiet' : ''` と書いてあったので、
              **日付をまだ選んでいないあいだは、地の色のまま**だった ——
              となりの「分野」「場面」「教材」は選ぶ欄(`select`)で色があるのに、
              **この1つだけが白い箱**に見えていた。
              選んでいるかどうかは、**中の文字**が言う(「すべて」 → 「09/20」)。
              **色だけに頼らない**(CLAUDE.md) */}
          <button type="button" ref={btnRef}
                  className="btn btn--small btn--quiet wbfilter-ctl"
                  aria-expanded={openCal}
                  onClick={() => setOpenCal((x) => !x)}>
            <CalendarIcon />
            {day ? day.replace(/^\d{4}-/, '').replace('-', '/') : 'すべて'}
          </button>
        </div>
      )}

      {show.field && (
        <label className="wbfilter-row">
          <span className="wbfilter-name">分野</span>
          <select className="wbfilter-ctl" value={field ?? ''}
                  onChange={(e) => set({ field: e.target.value || null })}>
            <option value="">すべて</option>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
      )}

      {/* **レベル**(0048・2026-09 利用者の指定「レベルの絞り込みも欲しいですね」)。
          「B1 の教材で出会った語だけ」を復習できる。
          並びはやさしい順(`cefrIndex`)で、名前は `cefrLabel` —— どちらも
          `cefr.js` が持っている。**対応表をここに書き写さない** */}
      {show.level && (
        <label className="wbfilter-row">
          <span className="wbfilter-name">レベル</span>
          <select className="wbfilter-ctl" value={level ?? ''}
                  onChange={(e) => set({ level: e.target.value || null })}>
            <option value="">すべて</option>
            {levels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </label>
      )}

      {/* **品詞**(2026-09 利用者の指定)。

            > 全ての単語に対して効くようにして欲しいのが
            > 品詞ごとに分ける絞り込み機能です。

          「動詞だけをさらう」「前置詞が苦手だから、そこだけ」ができる。
          **そろえ方は `posGroupOf()`(`posGroups.js`)1か所** ——
          `pos` に入っている文字は「名詞」(窓口が引いた控え)と
          `n`(基礎単語)の2通りあるので、ここで見分けると片方で必ず抜ける */}
      {show.pos && (
        <label className="wbfilter-row">
          <span className="wbfilter-name">品詞</span>
          <select className="wbfilter-ctl" value={pos ?? ''}
                  onChange={(e) => set({ pos: e.target.value || null })}>
            <option value="">すべて</option>
            {poss.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </label>
      )}

      {/* **英文の型**(2026-09 利用者の指定)。

            > 型の見分け、使い分けは必ず実現したいトレーニングです

          「無生物主語の文だけをさらう」「`When it comes to` の型だけ」が
          できる。**見分けは `frameMatch.js` 1か所**で、AI は呼ばない
          (1文ごとに課金になるため)。
          **言い当てられなかった文には型を付けない** ——
          当てずっぽうで付けると、練習そのものが嘘になる */}
      {show.frame && (
        <label className="wbfilter-row">
          <span className="wbfilter-name">型</span>
          <select className="wbfilter-ctl" value={frame ?? ''}
                  onChange={(e) => set({ frame: e.target.value || null })}>
            <option value="">すべて</option>
            {frameGroups.map((g) => (
              <optgroup key={g} label={g}>
                {frames.filter((f) => f.group === g)
                  .map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}

      {show.topic && (
        <label className="wbfilter-row">
          <span className="wbfilter-name">場面・話題</span>
          <select className="wbfilter-ctl" value={topic ?? ''}
                  onChange={(e) => set({ topic: e.target.value || null })}>
            <option value="">すべて</option>
            {scenes.length > 0 && (
              <optgroup label="シチュエーション">
                {scenes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            )}
            {genres.length > 0 && (
              <optgroup label="話題">
                {genres.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            )}
          </select>
        </label>
      )}

      {/* **単語帳では「教材」のプルダウンを出さない**(2026-09 利用者の指定)。
            > 単語帳の「教材」のプルダウンは不必要です。
          教材の名前は長いので、狭い画面ではこれだけで1行を食っていた。
          絞りたいのは「いつ入った語か」と「どの分野・場面か」である。

          **Quick Response の復習では出す**(0040・利用者の指定)。
            > ごめんなさい、教材の名前(「クラスに出る」など)で絞る、
            > ということです。
          あちらは**文**が溜まるので、「あの教材の文だけ」で引きたくなる。
          呼ぶ側が `showMaterial` で決める。**同じ部品を2つに分けない** */}
      {show.material && (
        <label className="wbfilter-row">
          <span className="wbfilter-name">教材</span>
          <select className="wbfilter-ctl" value={material ?? ''}
                  onChange={(e) => set({ material: e.target.value || null })}>
            <option value="">すべて</option>
            {titles.map((t) => <option key={t} value={t}>{t}</option>)}
            {anyNone && <option value={NO_MATERIAL}>教材なし</option>}
          </select>
        </label>
      )}

      {/* **絞っているときだけ出す。** 何も絞っていなければ押す意味がない */}
      {on && (
        <div className="btn-row wbfilter-clear">
          <button type="button" className="btn btn--ghost btn--small"
                  onClick={() => onChange(emptyFilter())}>
            <CloseIcon />絞り込みをぜんぶ外す
          </button>
        </div>
      )}

      {openCal && (
        <CalendarPopover
          anchorEl={btnRef.current}
          days={days}
          value={day}
          onPick={(d) => set({ day: d })}
          onClose={() => setOpenCal(false)}
        />
      )}
    </div>
  )
}
