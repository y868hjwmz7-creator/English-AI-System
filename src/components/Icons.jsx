/**
 * 画面で使う小さな絵(アイコン)。
 *
 * 【なぜ絵文字をやめたか】
 *   🔊 のような絵文字は、**端末ごとに形も色もばらばら**で、
 *   周りの文字と大きさも揃わない。並べたときに揃って見えない
 *   (2026-08 の指摘)。線で描いた絵にすると、どの端末でも同じ形になり、
 *   `currentColor` で文字と同じ色になるので、暗い配色でも紙の上でも
 *   そのまま馴染む。
 *
 *   大きさは `1em`。**文字に合わせて拡大縮小する。**
 *   レッスン表示では文字を3段階に変えられるので、固定の px にすると
 *   特大のときに絵だけ小さく取り残される。
 */

/**
 * スピーカー。**音を鳴らすもの**(Listen・聞き流し)。
 *
 * ── **塗りつぶしをやめて、線画にそろえた**(2026-09-26 利用者の指定)──
 *
 *   > 絞り込みのマークと聞き流しのマークももっと統一感を出して
 *   > ちゃんとデザインしてください
 *
 *   本体だけが**塗りつぶし**で、波は細い線だった。
 *   となりに並ぶ絞り込み(`SortIcon`)は 1.6px の線画なので、
 *   **小さい寸法では、片方だけが黒い塊に見える。**
 *   この絵の束はぜんぶ線画なので、**ここだけが例外だった。**
 *
 *   太さ・角の丸め・線の始末を `SortIcon` とそろえてある
 *   (絵は第5.275節でつまみ3本に変わったが、**太さは 1.6 のまま**)。
 *   **どこか1つだけ変えない** —— 変えると、また片方だけが浮く。
 */
export function SpeakerIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 本体は**1本の輪郭**。
          離れた線の集まりにすると、18px でばらけて見える */}
      <path d="M4 8h3l4-3.5v11L7 12H4z" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.8 5.2a6.5 6.5 0 0 1 0 9.6" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * **読み上げの操作盤を開く / 閉じる**(2026-10-08 利用者の指定・第5.424節)。
 *
 * ============================================================================
 * 【スピーカーは、言っていることが違った】
 *
 *   > 上部バーの再生プレーヤーのオンオフのボタンのアイコンが
 *   > スピーカーになってます。他にアイコンの案はありませんか?
 *
 *   このボタンは**音を出す**ものではなく、**下の操作盤を開け閉めする**
 *   ものである。スピーカーは「音が出る」としか言っておらず、
 *   **すぐ下に本物のスピーカー(「聴く」)が並ぶ**ので紛らわしかった。
 *
 * 【37 案を描いて、利用者が**案30** を選んだ】
 *
 *   実物の大きさ(帯の中の 20px)で見分けられるかで絞った。
 *   漢字(文 / 段 / 全)も記号(1 / ¶ / ∞)も、**字が 7px ほどになって
 *   読めない。** 線の多い絵(矢印 + 点、うねり)は潰れる。
 *
 *   残ったのは「**再生の印 + 音の弧**」で、はじめ丸い再生だったが
 *   (「丸なのがなぁ」)、**丸をやめて三角そのもの**にした。
 *
 *   **三角は、塗りと枠線の両方を本物の帯に当てて見比べた**
 *   (案30 = 塗り / 案31 = 枠線)。**利用者は枠線(案31)を選んだ。**
 *   すぐ左に**ページ送りの ▶(塗りの三角)**が並ぶので、塗りだと
 *   三角が2つ並ぶ形になる —— **中が抜けているほうが、隣と役割が違う**
 *   ことが形で分かる。
 *
 * 【弧は2本。**案24 から1文字も変えていない**】
 *   音が広がる弧は、スピーカーの絵の弧と同じ考え方である。
 *   3本に増やすと 20px で詰まる(実測)。
 *
 * ★ **見分けは形だけに頼らない。** `aria-label` は
 *   「読み上げの操作を開く / 閉じる」、押している印は `aria-pressed` にある。
 */
export function PlayerIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 再生の三角。**枠線**(利用者がえらんだ案31)——
          すぐ左のページ送り ▶ は塗りなので、**中が抜けていることが
          見分け**になる。太さはまわりの線画と同じ 1.6 */}
      <path d="M4.6 4.4 12.2 10 4.6 15.6z" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* 音の弧。太さと端の始末は、まわりの線画とそろえる(1.6) */}
      <path d="M14.6 7.4a4 4 0 0 1 0 5.2" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.9 5.6a7 7 0 0 1 0 8.8" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** マイク。自分の録音 */
export function MicIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" fill="currentColor" />
      <path d="M4.8 9.5a5.2 5.2 0 0 0 10.4 0" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 14.7v2.8" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** 停止 */
/** 鳴らす(聞き流しの「つづける」) */
export function PlayIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7 5.2 15 10l-8 4.8z" fill="currentColor" />
    </svg>
  )
}

/** 音楽(自作の BGM・0049)。**絵文字は使わない**(端末ごとに形が違う) */
/**
 * ★ **聞き流し**(第5.444節・2026-10-10 利用者の指定)。
 *
 * ── なぜ新しい絵が要ったか ────────────────────────────────
 *
 *   聞き流しのボタンは、**画面によって絵が違っていた** ——
 *   単語帳は `MusicIcon`(♪)、Quick Response は `SpeakerIcon`。
 *   **同じ働きのボタンには、同じ絵**(共通ルール)。
 *
 *   そのうえ **♪ は「曲」の絵でもある**(`BgmLibrary` の見出し)。
 *   聞き流しの設定の中に「曲」が並ぶので、**同じ絵がすぐ近くで
 *   2つの意味を持つ**ことになる —— 共通ルール
 *   「違うものに同じ名前を付けない」の、絵の版である。
 *
 *   ヘッドホンなら、**スピーカー(= この1つを聴く)とも、
 *   ♪(= 曲)とも別物**だと一目で分かる。
 *
 * ── なぜ太いか ────────────────────────────────────────
 *
 *   **帯のボタンの絵は 1文字ぶん(約14px)しかない**(`.icon` は `1em`)。
 *   細い線はこの大きさで消える —— 実際、細い弧 + 小さな耳で描いた案は
 *   「インパクトがイマイチ」と言われた。**塗りを増やし、箱いっぱいに使う。**
 *
 * ── なぜ耳が四角か(利用者の指定)────────────────────────
 *
 *   となりに並ぶ絵(卒業帽・札2枚・くり返しの矢印)が**直線的**なので、
 *   丸い耳だと**この絵だけ家族から外れる。**
 */
export function HeadphoneIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 頭にかける弧。**この絵だけ太くする** —— 共通の 1.8 では
          14px で消える。角の作法(`square` / `miter`)は下の `角` と同じだが、
          **あれはこの行より後ろで宣言されている**ので、ここでは書き下す */}
      <path d="M2.8 12V9.6a7.2 7.2 0 0 1 14.4 0V12"
            fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="square" strokeLinejoin="miter" />
      {/* 耳当て。**塗りの四角**(丸めない) */}
      <rect x="1.4" y="11.6" width="4.4" height="6.8" fill="currentColor" />
      <rect x="14.2" y="11.6" width="4.4" height="6.8" fill="currentColor" />
    </svg>
  )
}

export function MusicIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 14.5V4.8l7-1.4v9.4" />
      <circle cx="5.8" cy="14.6" r="1.9" />
      <circle cx="12.8" cy="13.1" r="1.9" />
    </svg>
  )
}

export function StopIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.6" fill="currentColor" />
    </svg>
  )
}

/** 画面(レッスンで大きく表示する) */
export function ScreenIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.2" y="3.5" width="15.6" height="10.5" rx="1.8" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 17h6" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 印刷 */
export function PrintIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 7V3h8v4" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="2.5" y="7" width="15" height="7" rx="1.6" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="12" width="8" height="5" rx="1" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/* ── **歯車(`GearIcon`)は廃止した**(2026-09-29 利用者の指定)─────
 *
 *   > これから歯車は使いません。全て3本線と丸のものに統一です
 *
 *   設定の絵は、アプリ全体で **`SortIcon`(三本線と丸)1つ**にそろえた。
 *   もとは左のメニュー・レッスン表示・集中モードが歯車、
 *   聞き流しと復習が三本線と丸で、**同じ「設定」に2つの絵**があった。
 *
 *   **描き方の経緯は、ここに残す**(同じことを繰り返さないため)。
 *   歯車は一度作り直している —— はじめ「丸 + まわりに8本の線」にしたら
 *   **18px では太陽(☀)にしか見えなかった。** 18 / 24 / 40 / 64px の
 *   4つで描いて並べ、**歯が本体と地続きの形・歯は6つ**に直した
 *   (8つにすると 18px で谷が潰れて、また丸に戻る)。
 *   **絵は、小さくして並べて確かめる。** 大きい絵だけ見て決めない。
 *
 *   **絵文字(⚙)は使わない**のは、いまも変わらない(端末ごとに違う)。
 */


/* ── 画面の切り替え(左のメニュー)で使う絵 ────────────────────
   **どれも同じ枠(20×20)・同じ線の太さ(1.5)で描く。**
   1つだけ太かったり大きかったりすると、並べたときに揃って見えない。
   細くたたんだメニューでは、この絵だけが目印になるので、
   **形で見分けられること**を優先している(色は付けない)。 */

/** 三本線。メニューの開け閉め */
export function MenuIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** ✕。開いたものを閉じる */
export function CloseIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** ＋。手で足す。**同じ枠(20×20)・同じ線の太さ(1.5)でそろえる** */
export function PlusIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 虫めがね。さがす */
export function SearchIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.9 12.9L17 17" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/**
 * **絞り込み(出しかた)**(第5.184節・2026-09 実機・利用者の指定)。
 *
 *   > 単語帳とクイックレスポンスの右上の「出し方」を添付した
 *   > 「ソートアイコン」にして、文字をなくしてください
 *
 * ── **つまみ3本の形へ**(第5.275節・2026-09-26 実機・利用者の指定)──
 *
 *   > また、絞り込みのマークがダサいですね。線が太すぎて横の聞き流しの
 *   > スピーカーマークとの統一感がないです。
 *   > 絞り込みのマークは添付のものにしてください
 *
 *   ここまで2度変わっている。**経緯ごと残す。**
 *
 *   | いつ | 形 | 直した理由 |
 *   |---|---|---|
 *   | 第5.184節 | 長さの違う横3本線 | —— |
 *   | 第5.262節 | **じょうご(ろうと)** | 3本線が運動靴の印に見える |
 *   | 第5.275節 | **つまみ3本**(いま) | じょうごが重たく見える |
 *
 *   **線の太さは 1.6 のまま、1ミリも変えていない**(となりの `SpeakerIcon`
 *   と同じ値)。重たく見えていたのは太さではなく**形**である ——
 *   じょうごは下がすぼまるので、**注ぎ口では線と線がくっついて
 *   黒い棒に見える。** 小さい寸法ほどそうなる。
 *   つまみ3本は**どこも線どうしが離れている**ので、同じ太さでも軽く見える。
 *
 * 【描き方】
 *   ・線は**つまみの手前で止める。** 輪の中を線が横切らないようにする
 *     (輪を塗りつぶして隠す手は使えない —— この絵は地の色を知らない)
 *   ・**輪の大きさ(半径 1.9)と、段の間(5.7)は、いっしょに決まる。**
 *     輪が小さいと、線の太さ(1.6)に穴がふさがれて**ただの点**に見える。
 *     かといって大きくすると、**上下の輪どうしがくっつく**
 *     (半径 2.1 で試したら、2段目と3段目が重なった。実際に描いて見つけた)。
 *     **外まわり(半径 + 線の太さの半分)が、段の間より小さいこと**
 *   ・**つまみは輪(塗りつぶさない)。** この絵の束はぜんぶ線画で、
 *     塗りつぶしを1つ混ぜると、そこだけが黒い塊に見える
 *     (`SpeakerIcon` で踏んだところと同じ)
 *   ・★ **横線は2本**(第5.415節・利用者の指定「YouTubeと同じ
 *     横線2本＋つまみの形にアプリ全体で統一する」)。
 *     **2つのつまみは、わざと位置をずらす** —— そろえると
 *     「二本線」に見えて、ただのメニューと見分けが付かない
 *
 * **歯車(`GearIcon`)とは役目が違う** —— あちらは「設定」、
 * こちらは「並べ方・絞り方」を指す。
 * **同じ絵を2つの行き先に付けない**(CLAUDE.md)。
 */
export function SortIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* ★ **横線は2本**(第5.415節・2026-10-07 利用者の指定)。

            > 絞り込み・設定のアイコンは、YouTubeと同じ「横線2本＋つまみ」の
            > 形にアプリ全体で統一する。今の「3本線と丸」のアイコンも置き換える。

          3本だと、20px の中で線とつまみが詰まって**運動靴の印**に見える
          (第5.262節で一度言われた)。2本にすると、つまみが大きく描けて
          **何の絵か分かる。**

          **太さ・線の始末は1か所にまとめる。** 4本の線と2つの輪を
          ばらばらに書くと、どれか1つだけ古くなる。
          **つまみは輪(塗りつぶさない)** —— この絵の束はぜんぶ線画で、
          塗りつぶしを1つ混ぜると、そこだけが黒い塊に見える。
          **2つのつまみは、わざと位置をずらす** —— そろえると
          「二本線」に見えて、ただのメニューと見分けが付かない */}
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        {/* 1段目(つまみは右より) */}
        <path d="M2.6 6.6h5.6" />
        <path d="M16.4 6.6h1" />
        <circle cx="12.4" cy="6.6" r="2.2" />
        {/* 2段目(つまみは左より) */}
        <path d="M2.6 13.4h1.4" />
        <path d="M11.9 13.4h5.5" />
        <circle cx="8" cy="13.4" r="2.2" />
      </g>
    </svg>
  )
}

/** 本。教材 */
export function BookIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3.5 4.2c2.4-.7 4.3-.7 6.5.5v11c-2.2-1.2-4.1-1.2-6.5-.5z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16.5 4.2c-2.4-.7-4.3-.7-6.5.5v11c2.2-1.2 4.1-1.2 6.5-.5z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 本棚。**業種べつの単語帳(棚)**(0057)。
 *
 * **足す前に、同じ絵がもう無いか探した。** `BookIcon`(教材)と
 * `CardsIcon`(単語帳)はどちらもすでに別の画面が使っており、
 * 使い回すと上の帯とメニューで**どの画面か見分けられなくなる**
 * (絵は `pages` から引いて上の帯にも出るため)。
 * ほかの絵と同じ枠(20×20)・同じ線の太さ(1.5)でそろえる。
 */
export function ShelfIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 立てて並んだ本3冊 + 棚板1枚 */}
      <rect x="3.5" y="4" width="3" height="10" rx="0.6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8" y="6" width="3" height="8" rx="0.6"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.2 5.2l2.8.8-2 7.7-2.8-.8z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.5 16.5h15" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * カレンダー。**単語帳を「入った日」で絞る**ときに使う(2026-08 利用者の指定)。
 * ほかの絵と同じ枠(20×20)・同じ線の太さ(1.5)でそろえる。
 */
export function CalendarIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.75" y="4.25" width="14.5" height="13" rx="2"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 8.25h14.5M6.75 2.75v3M13.25 2.75v3"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 人が2人。ゲスト */
export function PeopleIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="7.6" cy="6.6" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.6 16c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.4 4.4a2.6 2.6 0 0 1 0 4.9M14.2 11.7c2.1.4 3.4 2 3.4 4.3"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 棒グラフ。集計 */
export function ChartIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 16.5h14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 16.5V11M10 16.5V4.5M14.5 16.5V8" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 書類とチェック。今週の宿題 */
export function TaskIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="4" y="2.8" width="12" height="14.4" rx="2"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.3 9.6l1.9 1.9 3.8-4" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 重ねた札。単語帳 */
export function CardsIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2.8" y="6" width="10.4" height="10.4" rx="2"
            fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.4 3.6h8.2a2.4 2.4 0 0 1 2.4 2.4v8" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 折れ線。学習の記録 */
export function TrendIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 16.5h14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 13l3.6-4.2 3 2.6 4.4-5.4" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 稲妻。Quick Response(日本語を見て、すぐ英語で言う)
    **学習の記録の折れ線を使い回さない。** 同じ絵は同じ意味に見える */
export function BoltIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11.2 2.5L4.8 11h4.3l-.8 6.5L15.4 9h-4.4z" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** 段。6Steps(順に積み上げるトレーニング) */
export function StepsIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 16.5h4v-4h4v-4h4v-4h3" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 枠の四隅。集中モード(1段落だけを画面に固定して調べる)。
    **枠にはめる**という形そのものが、この機能の中身である */
export function FocusIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 6.5v-3a1 1 0 011-1h3M13.5 2.5h3a1 1 0 011 1v3M17.5 13.5v3a1 1 0 01-1 1h-3M6.5 17.5h-3a1 1 0 01-1-1v-3"
            fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10h6" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 紙。ゲストに関するファイル(0031)
    **同じ枠(20×20)・同じ線の太さ(1.5)でそろえる** */
export function FileIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11.5 2.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 17.5h8a1.5 1.5 0 001.5-1.5V6.5z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 2.5v4h4" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** 上向きの矢印。ファイルを置く */
export function UploadIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 14V4.5M6.2 8.3L10 4.5l3.8 3.8" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5v2a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-2"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** ペン。紙への書き込み(2026-09) */
/**
 * くり返し(ディクテーション・2026-09 利用者の指定)。
 * **輪になった矢印。** 「同じところを回る」が形で分かる
 */
/**
 * **ヒント**(2026-09 利用者の指定)。電球。
 * ほかの絵と同じ 20×20・線だけ・`aria-hidden`(文字のほうが名前を言う)。
 */
export function HintIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.6a4.7 4.7 0 0 0-2.8 8.5c.5.4.8 1 .8 1.6v.3h4v-.3c0-.6.3-1.2.8-1.6A4.7 4.7 0 0 0 10 2.6Z" />
      <path d="M8.3 15.6h3.4" />
      <path d="M8.9 17.6h2.2" />
    </svg>
  )
}

/**
 * **くり返しの輪(2本の矢印)。ここ1か所**
 * (2026-09-30 利用者の指定・第5.326節)。
 *
 *   > 聞き流しなどのリピートも同じく絵に揃えてください。
 *
 * **同じものには同じ絵**(CLAUDE.md)。`RepeatIcon`(聞き流しの
 * 「繰り返す」)と `RepeatRangeIcon`(音声プレーヤーのくり返し)は、
 * **この1つの輪を共に使う** —— 2か所に描くと、片方だけ古くなる
 * (実際そうなっていた。第5.324節でプレーヤーの側だけ2本矢印にしたので、
 *  聞き流しだけ矢印1本のまま残っていた)。
 *
 * 上を右へ・下を左へ。上下は 180 度まわすと重なる。
 *
 * ★ **角は丸めない**(第5.419節・2026-10-08 利用者の指定・写真つき)。
 *
 *   > 繰り返しとシャッフルの矢印が丸いのがデザインを損ねている気がします。
 *   > 添付のようなものに変更です。
 *
 * もとは角を 2.2 の弧で丸め、線の端も `round` にしていた。
 * **直角で折り、端も角のまま**(`square` / `miter`)にする ——
 * 穂先の三角と同じ性格になり、絵がしまる。
 *
 * **太さ・端の形は、シャッフルとまったく同じ1組**にそろえる
 * (となりに並ぶので、片方だけ違うとそこだけ浮く)。
 */
/** 線の太さ。**くり返しとシャッフルで同じ1か所から引く**(第5.419節) */
const 線 = 1.8
/** 角と端の形。**丸めない**(第5.419節・利用者の指定) */
const 角 = { strokeLinecap: 'square', strokeLinejoin: 'miter' }

/**
 * **シャッフルの、上下へのはみ出しを減らす割合**
 * (2026-10-09 利用者の指定・第5.430節)。
 *
 *   > シャッフルの矢印の上下へのはみ出しも減らしつつ
 *
 * くり返しの輪は**2本の横棒**なので、絵が低い帯に収まって見える。
 * 一方シャッフルは**斜めに走る2本**で、箱いっぱいに上下する ——
 * となりに並べると、こちらだけ背が高く見えた。
 *
 * **`transform: scaleY` では潰さない。** あれは**線の太さまで細くする**ので、
 * くり返しとそろえてある `線`(1.8)が崩れる。
 * **置き場所(y 座標)だけ**をまん中(10)へ寄せる。
 */
const 縦 = 0.76
/** y 座標を、まん中(10)を軸に `縦` まで寄せる。**数は書き写さない** */
const 低く = (y) => Math.round((10 + (y - 10) * 縦) * 100) / 100

function RepeatLoop() {
  return (
    <>
      {/* 上の筋 … 左端で直角に下りる → 右へ → 穂先 */}
      <path d="M4 9V6.2h9.2"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <path d="M13 3.4 17.2 6.2 13 9z" fill="currentColor" />
      {/* 下の筋 … 上を 180 度まわすと、ちょうど重なる */}
      <path d="M16 11v2.8H6.8"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <path d="M7 11 2.8 13.8 7 16.6z" fill="currentColor" />
    </>
  )
}

export function RepeatIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* ★ **プレーヤーのくり返しと、まったく同じ輪**(第5.326節)。
            **輪は上の1か所**にあるので、描き替えると両方が一緒に変わる */}
      <RepeatLoop />
    </svg>
  )
}

/**
 * **くり返す範囲**(文 / 段落・発言 / 全文)。第5.318節。
 *
 * ============================================================================
 * 【なぜ絵を3つに分けたか】(2026-09-30 利用者の指定)
 *
 *   > リピート設定の「繰り返し」という表示文言は削除し、
 *   > アイコン中心の操作にしてください。
 *   > それぞれ、リピート範囲が見分けられる異なる矢印アイコンを
 *   > デザインしてください。
 *
 *   もとは**ボタン1つ**で、押すたびに「しない → 文 → 段落 → 全文」と
 *   回っていた。いまは**3つ並べて、押したものが光る。**
 *   いま何を回しているかが、押さなくても分かる。
 *
 * 【描き方 — **小さくして並べて確かめた**】
 *   6つの案を 20 / 28 / 36px で描いて見比べた(歯車が 18px で太陽に
 *   見えた第5.189節と同じやり方)。**線の本数で範囲を示す案は、
 *   20px で線どうしがくっついて読めなかった。**
 *
 *   採ったのは「**輪は同じ。下の1本の線の長さで範囲**」だった。
 *
 * ★ **線の長さをやめ、点の数にした**(2026-10-08 利用者の指定・第5.419節)。
 *
 *   > 繰り返しの文、段落、全体の見分けを下の線の長さではない他の案を
 *   > 挙げてください
 *
 *   **1つのボタンを押して回す形では、長さは比べる相手がいない。**
 *   3つ並べていたころは「4 / 8.5 / 13」の差が一目で分かったが、
 *   いまは**1つしか出ていない**ので、その線が短いのか長いのかが
 *   分からない(第5.320節でボタン1つに戻したときに、ここが抜けていた)。
 *
 *   5案を描いて、**実物の 20px でも見分けられるか**で絞った。
 *
 *   | 案 | 20px で |
 *   |---|---|
 *   | **点の数(採った)** | **1 / 2 / 3 と数えられる** |
 *   | 行の数(線の本数) | 見分けられる(次点) |
 *   | 漢字「文 / 段 / 全」 | **字が 7px ほどになり、読めない** |
 *   | 記号「1 / ¶ / ∞」 | 同じく小さすぎる |
 *   | 輪の大きさ 小 → 中 → 大 | 差が分からず、**しないと文が同じ形**になる |
 *
 *   **数は「いくつ分を回すか」そのもの**である ——
 *   1つ(文)→ 2つ(段落・発言)→ 3つ(全文)。
 *   点は丸なので、**どんなに小さくても潰れない**(線の本数は、
 *   20px で線どうしがくっつく —— 上に書いたとおり)。
 *
 * ★ **`off`(くり返さない)も、この絵で出す**(2026-09-30 利用者の指定・第5.320節)。
 *
 *   > 3つ並んだリピートのマークをひとつにして、押すたびに切り替わるように
 *   > できませんか? …4つ目の普通の再生を示すマークを作るか、
 *   > それとも普通の再生の時はグレーアウトさせるか
 *
 *   2案を 20 / 28 / 36px で描いて見比べ、**利用者が案A を選んだ**。
 *
 *   | 案 | 「しない」の見せ方 | 20px で |
 *   |---|---|---|
 *   | **A(採った)** | **印を描かない + うすく** | はっきり見分けられる |
 *   | B | 輪に斜線 | **線が重なって潰れ、何の絵か読めない** |
 *
 *   **色だけに頼っていない**(CLAUDE.md)—— 「しない」は
 *   **うすい**だけでなく、**点が1つも無い**。形でも分かる。
 *
 * @param range 'off'(しない)/ 'sentence'(文)/ 'item'(段落・発言)/ 'all'(全文)
 */
export function RepeatRangeIcon({ range = 'item', className = 'icon' }) {
  /* **点の数は1か所で決める。** 画面の中で数を書かない。
     `off` は 0 —— **回す範囲が無いので、点も無い** */
  const 点 = { off: 0, sentence: 1, item: 2, all: 3 }[range] ?? 2
  /* 点の間隔。**真ん中ぞろえ**にすると、増えても左右に均等に広がる */
  const 間 = 3
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* ★ **2本の矢印**(2026-09-30 利用者の指定・写真つき・第5.324節)。

          > リピートのアイコンですが、もっとこういう風にして
          > もらえませんか? 線は周囲のデザインとバランスを取るために、
          > これより細くて良いです。2本矢印が欲しいです。

          **前は矢印が1本だった**(輪を1周して、左端にだけ穂先)。
          いちばん普通のリピートの記号は、**上を右へ・下を左へ**の
          2本である。上下は 180 度まわすと重なる(同じ形)。

          ★ **輪は `RepeatLoop` 1か所**(第5.326節)——
            聞き流しの `RepeatIcon` と**同じ絵**を使う。
            ここに書き写すと、片方だけ古くなる(実際そうなった)。 */}
      {/* ★ **輪は原寸に戻した**(2026-10-09 利用者の指定・第5.430節)。

            > シャッフルの右側の矢印が上下にはみ出してダイナミックなのに
            > 対して、丸がない時のリピートが小さく、不揃いに見えるんですよね。
            > リピートの丸を矢印の囲いの中に入れるのはどうでしょうか？

            第5.419節では**点を輪の下に置く場所を作るために**輪だけを
            0.74 倍に縮めていた。そのため「しない」(点が0)のときは
            **点も無く、輪も小さい**ので、となりのシャッフルより
            一回り小さく見えていた。
            **点を囲いの中に入れれば、縮める理由そのものが無くなる。**
            どの段でも、絵の外形はシャッフルとそろう。 */}
      <RepeatLoop />
      {/* 回す範囲は**点の数**。1つ(文)→ 2つ(段落・発言)→ 3つ(全文)。
          **囲いの中**(まん中の高さ)に並べる —— 上下の筋のあいだは
          だいたい 7.1〜12.9 なので、まん中は 10 である */}
      {Array.from({ length: 点 }, (_, i) => (
        <circle key={i} r="1.1" cy="10" fill="currentColor"
                cx={10 + (i - (点 - 1) / 2) * 間} />
      ))}
    </svg>
  )
}

/**
 * **シャッフル**(2026-09-30 利用者の指定・写真つき・第5.325節)。
 *
 *   > 文型トレーニングで使うシャッフルボタンを追加してください。
 *   > シャッフルは、他の操作ボタンと大きさ・余白・アイコンの線を
 *   > 揃えたコンパクトなアイコンボタンにしてください。
 *
 * **2本の矢印が交差する**、いちばん普通のシャッフルの記号である。
 * 上の筋は左上から右下へ、下の筋は左下から右上へ。
 *
 * ★ **角は丸めない**(第5.419節・2026-10-08 利用者の指定・写真つき)。
 * **太さも端の形も、くり返しの輪とまったく同じ1組**から引く
 * (`線` / `角`・すぐ上)—— となりに並ぶので、片方だけ違うと浮く。
 */
export function ShuffleIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 左上 → 右下。穂先は筋と同じ斜め(45度)を向く */}
      <path d={`M2.6 ${低く(6.4)}h3.2L14.1 ${低く(13.9)}`}
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <path d={`M16.6 ${低く(16.6)} 16 ${低く(12.1)} 12.1 ${低く(16)}z`}
            fill="currentColor" />
      {/* 左下 → 右上 */}
      <path d={`M2.6 ${低く(13.6)}h3.2L14.1 ${低く(6.1)}`}
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <path d={`M16.6 ${低く(3.4)} 16 ${低く(7.9)} 12.1 ${低く(4)}z`}
            fill="currentColor" />
    </svg>
  )
}

/**
 * ★ **もう出さない(卒業帽)**(第5.441節・2026-10-10 利用者の指定)。
 *
 *   > もう出さないなんだな、て一目でわかるアイコンが欲しいですね
 *
 * ============================================================================
 * 【なぜ卒業帽か】
 *
 *   押すと、その文(語)は**「覚えた」に入って、もう出てこない**
 *   (第5.438節)。**行き先が「覚えた」である**ことまで言える絵が要る ——
 *   × や ごみ箱だと「消す」に見え、**取り返しがつかない操作**と読める
 *   (実際には札から「覚えた」をえらべば、いつでも出てくる)。
 *
 *   卒業帽は「もう練習しなくていいところまで来た」を、
 *   **字を1つも足さずに**言う(**余計な説明書きを置かない**・共通ルール)。
 *
 * 【太さ・角は、となりの2つとまったく同じ1組】
 *
 *   `線` / `角`(このファイルの上)から引く —— **同じ行に並ぶ**ので、
 *   片方だけ違うとそこだけ浮く(第5.419節とまったく同じ理由)。
 *
 * 【板(ひし形)は、箱から出ないところまで縮めてある】
 *
 *   `strokeLinejoin: miter` は、**鋭い角で線を外へ長く突き出す。**
 *   はじめ左右の頂点を 1.4 / 18.6 に置いたら、**突き出した先が
 *   viewBox の外に出て、平らに切られた**(SVG は箱の外を描かない)。
 *   板を少し高くして角を鈍らせ、**突き出した先が 0.3 / 19.7 に収まる**
 *   ところまで寄せてある。**数を変えるときは、ここを測り直す。**
 */
export function GraduateIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 板。上から見たひし形 */}
      <path d="M10 3.2 17.6 6.9 10 10.6 2.4 6.9z"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      {/* 頭にかぶるところ。板の下の辺にぴったり付く */}
      <path d="M5.6 8.4v3.4c0 1.8 8.8 1.8 8.8 0V8.4"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      {/* ふさ。右の頂点から下がる */}
      <path d="M17.6 6.9v4.2"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <circle cx="17.6" cy="12.4" r="1.1" fill="currentColor" />
    </svg>
  )
}

/**
 * ★ **カードを混ぜる**(第5.441節・2026-10-10 利用者の指定)。
 *
 *   > シャフルももう少しわかりやすいアイコンはありませんか?
 *   > すみません、シャッフルはカードのやつですよ!
 *
 * ============================================================================
 * 【`ShuffleIcon` と、言っていることが違う】
 *
 *   `ShuffleIcon`(2本の筋が交差する絵)は、**音声プレーヤーの
 *   「順番をばらばらに鳴らす」**である。こちらは**出題のカードを
 *   混ぜる**ことで、混ぜる相手が「音」ではなく「札」である。
 *
 *   絵を**2枚の札**にすると、何を混ぜているのかが一目で分かる。
 *   **音声プレーヤーのシャッフルは1つも変えていない**
 *   (**言われた場所だけ**・CLAUDE.md)。
 *
 * 【札は、傾けて2枚。上に回す矢印】
 *
 *   回した札の角が**箱から出ないところまで寄せてある**
 *   (`GraduateIcon` と同じ話。実際、はじめの位置では左下の角が
 *   平らに切られていた)。**数を変えるときは、4隅を測り直す。**
 */
export function CardShuffleIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2" y="8.4" width="7" height="9.4" rx="1.3"
            transform="rotate(-10 5.5 13.1)"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <rect x="11" y="8.4" width="7" height="9.4" rx="1.3"
            transform="rotate(10 14.5 13.1)"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      {/* 入れ替える合図。**弧の端だけは丸める** ——
          角で切ると、細い弧の先が欠けて見える */}
      <path d="M4.6 5.4C7.4 1.8 12.6 1.8 15.4 5.4"
            fill="none" stroke="currentColor" strokeWidth={線} strokeLinecap="round" />
      <path d="M17.6 5.4 13.2 6 15 2.2z" fill="currentColor" />
    </svg>
  )
}

/**
 * ★ **くり返す + いま何問ずつか**(第5.441節・2026-10-10 利用者の指定)。
 *
 *   > リピートを押すと10個出す場合は10を2つの矢印で囲みます。
 *   > 20個なら20、30個なら30、全てならAllを囲う。
 *   > 少しアイコン全てを大きくすると良さそうですね 5問も欲しいな
 *   > そして、数字と矢印の間にもう少し余裕持てないかな
 *
 * ============================================================================
 * 【なぜ数を絵の中に入れたか】
 *
 *   問数のプルダウンは**カードから外した**(2026-10-10 利用者の確認)——
 *   選ぶのは右上の絞り込みの中だけでよい。
 *   ただし**いま何問ずつ回っているかは、見えていないと困る。**
 *   「選ぶ」をしまって、「いまの値」だけを残した形である
 *   (**残してよいのは、いまの状態**・共通ルール)。
 *
 * 【字は書き写さない】
 *
 *   `label` は呼ぶ側が `sizeLabel(size)` から渡す。
 *   **ここで `size === 'all' ? …` と書かない**(判断は1か所・CLAUDE.md)。
 *   3文字(`All`)のときだけ少し小さくするが、**長さで決める**ので、
 *   値が増えた日もついてくる(数を書き写さない)。
 *
 * 【矢印は上下に押し広げてある】
 *
 *   はじめ `RepeatLoop` と同じ y(6.2 / 13.8)に置いたら、
 *   **数字の上下が矢印の棒に当たった**(「余裕持てないかな」)。
 *   棒を 3.9 / 16.1 まで外へ出し、**まん中を 7〜13 まるごと空けてある。**
 */
export function RepeatCountIcon({ label = '', className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {/* 上の棒。左で折れて右へ、先は右向きの穂先 */}
      <path d="M3.4 7.1V3.9h10"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <path d="M13 1.3 16.8 3.9 13 6.5z" fill="currentColor" />
      {/* 下の棒。右で折れて左へ、先は左向きの穂先 */}
      <path d="M16.6 12.9v3.2h-10"
            fill="none" stroke="currentColor" strokeWidth={線} {...角} />
      <path d="M7 13.5 3.2 16.1 7 18.7z" fill="currentColor" />
      {/* 数。**端末の字をそのまま使う**(`inherit`)——
          絵のために別のフォントを持ち込まない */}
      {/* ★ **大きさは1つ。長さで分けない**(2026-10-10・見張りが捕まえた)。

           はじめ「3文字以上なら小さく」と分けていた。**問数が 9 段になり
           「100」が入った日**に、`npm run test:bar` が
           「数が矢印の骨に届いている」と赤くした。

           分けると**2つ困る。**
             ①**いちばん長い言葉で測らないと見つからない**(そのとき
               画面に出ている言葉の大きさで測ってしまう)
             ②問数を変えるたびに**数の大きさが変わる**
               (押しても、まわりの物が動かない・共通ルール)

           **いちばん長い形(3文字)が骨に届かない大きさ**に決め打つ。
           数を増やしても、ここは触らなくてよい。

           ★ **6.5 では「100」が本当に接していた**(2026-10-10)。
             描いた点どうしの隙間を測ると **0.00**(ほかは 0.9〜1.9)。
             **箱(`getBBox`)で測ると見つからない** —— 棒は太さ 1.8 で
             描かれるので、**骨の線より 0.9 ずつ外へ太っている。**
             字を 5.4 にして、どの数も **1.0 以上**あけた。

           ★ **縦に逃がす手は使えない。** 縦の棒は上が左・下が右にあり、
             字が入れる帯は上下 4 しかない。**横幅で収める**ほうが確実で、
             矢印の形(利用者が選んだもの)に1ミリも触らずに済む */}
      <text x="10" y="10" textAnchor="middle" dominantBaseline="central"
            fontSize="5.4" fontWeight="700"
            fill="currentColor" fontFamily="inherit" letterSpacing="-0.2">
        {label}
      </text>
    </svg>
  )
}


/** セッションの記録(0032)。**罫線の入った紙**。書くところだと分かる */
/**
 * **音を用意しているあいだの絵**(2026-09-30・第5.321節)。
 *
 *   点が3つ、順に濃くなる。**ほかの絵と同じ箱に入る**ので、
 *   ▶ / ■ と差し替えても**丸の大きさが1px も変わらない**
 *   (押しても、まわりの物が動かない・`.claude/rules/common.md`)。
 *
 *   **何秒たったかは、ここに描かない** —— `aria-label` と `title` が
 *   「用意中 3 秒」と言う。数が伸びると、その行が動くためである。
 */
export function WaitIcon({ className = 'icon' }) {
  return (
    <svg className={`${className} wait-icon`} viewBox="0 0 20 20"
         aria-hidden="true" focusable="false" fill="currentColor">
      <circle cx="4" cy="10" r="1.9" />
      <circle cx="10" cy="10" r="1.9" />
      <circle cx="16" cy="10" r="1.9" />
    </svg>
  )
}

export function NoteIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="4" y="2.5" width="12" height="15" rx="2" fill="none"
            stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6.5h6M7 10h6M7 13.5h3.5" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function PenIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M13.4 3.1l3.5 3.5-9 9-4.2.7.7-4.2z" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.8 4.7l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * 消しゴム(練習の記録を消す・2026-09 利用者の指定でアイコンにした)。
 *
 * **ゴミ箱にしない。** すぐ下に「教材を消す」があり、
 * **消える相手がまったく違う**(あちらは教材そのもの、こちらは
 * この端末に残っている書きかけ)。同じ絵にすると取り違える。
 */
export function EraserIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M8.4 16.5 3.9 12a1.4 1.4 0 0 1 0-2l6-6a1.4 1.4 0 0 1 2 0l4.2 4.2a1.4 1.4 0 0 1 0 2l-6.3 6.3z"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 7 13 13M8.4 16.5H17" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 落とす(音声をダウンロード)。`UploadIcon` の矢印を逆にしただけ */
export function DownloadIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 3.5V13M6.2 9.2 10 13l3.8-3.8" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 作り直す(読み上げ音声を作り直す)。
 *
 * **`RepeatIcon` とは別に描く。** あちらは平たい輪(同じところを回る)で、
 * こちらは**円をぐるりと回る矢印**(もう一度作る)。
 * 同じ画面に並ぶことは無いが、意味が違うものを同じ形にしない。
 */
export function RefreshIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M16.2 10a6.2 6.2 0 1 1-1.9-4.5" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.4 2.6v3.6h-3.6" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * リンク(鎖の輪が2つ —— 「場所そのものを渡す」)。
 *
 * **`ScreenIcon`(セッションで使う)や `UploadIcon` と取り違えない。**
 *
 * **いまはどの画面も使っていない。** 「教材をシェア」と
 * 「この教材をゲストと共有する」を1つのボタンにまとめた日(2026-09)に、
 * そちらは `ShareIcon`(渡す)へ移った —— 鎖では
 * **ゲストに宿題として出す道**を言えないためである。
 * **絵そのものは消していない**(リンクを渡す場面はまた出てくる)。
 */
export function LinkIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M8.4 11.6a3 3 0 0 0 4.3 0l2.6-2.6a3 3 0 0 0-4.3-4.3l-1 1"
            fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.6 8.4a3 3 0 0 0-4.3 0l-2.6 2.6a3 3 0 0 0 4.3 4.3l1-1"
            fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}


/**
 * 渡す(共有・2026-09 利用者の指定)。
 *
 *   > 「教材をシェア」と「教材をゲストと共有」はボタンをひとつにして
 *   > その中でゲストと共有なのか普通の共有なのかを選べるようにしてください
 *
 * **`LinkIcon`(鎖)では足りない。** あれは「リンクを渡す」しか言えないが、
 * このボタンは**ゲストに宿題として出す**道も持っている。
 * 点と点をつなぐ形なら、「この教材を、あちらへ渡す」とだけ言える。
 *
 * **絵文字は使わない**(端末ごとに形が違う)。
 * **足す前に、同じ絵がもう無いかを探してある** —— 鎖(`LinkIcon`)は
 * 意味が狭く、`UploadIcon`(上矢印)は「取り込む」に読める。
 */
export function ShareIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="15" cy="4.6" r="2.3" />
      <circle cx="5" cy="10" r="2.3" />
      <circle cx="15" cy="15.4" r="2.3" />
      <path d="M7.1 8.9 12.9 5.7" />
      <path d="M7.1 11.1 12.9 14.3" />
    </svg>
  )
}


/**
 * 家(ホーム・2026-09 利用者の指定)。
 *
 *   > ロードの後いきなり教材が映るのではなく、何か箱を並べて、
 *   > 選択したモードに飛ぶ仕様にしたいです
 *
 * 行き先を並べる画面そのものにも、メニューの並びに入る絵が要る。
 * **絵文字は使わない**(端末ごとに形が違う)。
 */
export function HomeIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 8.6 10 3.4l6.8 5.2v7.1a1 1 0 0 1-1 1h-3.4v-4.6H7.6v4.6H4.2a1 1 0 0 1-1-1z" />
    </svg>
  )
}

/**
 * 右向きの山形(ホームの箱の「行き先」の印)。
 *
 * **触る端末には「カーソルを載せる」が無い**(CLAUDE.md)。
 * 箱が押せることを、押す前から見て分かるようにするための印である。
 */
export function ChevronIcon({ className = 'icon' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.8 4.6 13.2 10l-5.4 5.4" />
    </svg>
  )
}
