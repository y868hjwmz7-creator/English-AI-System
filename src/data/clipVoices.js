/**
 * 教材の読み上げに使える**声の名簿**。
 *
 * ============================================================================
 * 【利用者が編集するのは、この下の CLIP_VOICES だけです】
 *
 *   ElevenLabs で気に入った声を見つけたら、**1行足すだけ**です。
 *
 *     { id: 'us-3', accent: 'us', gender: 'female', use: 'narration',
 *       label: 'Rachel', elevenId: '21m00Tcm4TlvDq8ikWAM' },
 *
 *   | 欄 | 何を書くか |
 *   |---|---|
 *   | `id`       | この名簿の中だけの合言葉。**他と重ならなければ何でもよい**。`us-3` など |
 *   | `accent`   | 下の CLIP_ACCENTS の id(`us` `uk` `sc` …) |
 *   | `gender`   | `female` か `male` |
 *   | `use`      | `narration` / `conversation` / `both`。下の【向き】を参照 |
 *   | `label`    | 画面に出す名前。ElevenLabs で見えている名前のままでよい |
 *   | `elevenId` | ElevenLabs の Voice ID(⋮ → Copy voice ID) |
 *
 *   **1つの訛りに何人でも登録できます。** 3人でも5人でも構いません。
 *   会話では、その中から選んだ人が役ごとに話します。
 *
 * ============================================================================
 * 【向き(`use`)— ElevenLabs の分類をそのまま持ち込む】(2026-08 利用者の指定)
 *
 *   > ナレーションや記事の朗読向きの声と、会話向きの感情豊かな声も
 *   > カテゴリーとして分けてありました。これはアプリ内でも活用したいです。
 *
 *   ElevenLabs の一覧には「Narrative Story」「Conversational」といった
 *   分類が付いている。**あれは的を射ている。** 記事の朗読に感情豊かな声を
 *   当てると芝居がかって聞きづらく、会話に淡々としたナレーションの声を
 *   当てると人と話している感じがしない。
 *
 *   | `use` | ElevenLabs の分類のめやす | アプリのどこで出るか |
 *   |---|---|---|
 *   | `narration`    | Narrative Story / Informative Educational | 記事、文型ドリル、単語、フレーズ |
 *   | `conversation` | Conversational / Entertainment Tv         | 会話(ダイアローグ) |
 *   | `both`         | どちらにも使える、と自分で判断したもの     | 両方に出る |
 *
 *   **教材の種類で、選べる声が自動的に絞られる。** 会話を作るときは
 *   会話向きだけ、記事なら朗読向きだけが並ぶ。取り違えようがない。
 *
 *   **`id` は一度決めたら変えないこと。** 変えると、その声で作った
 *   音声の置き場所が変わり、作り直し(= 課金)になります。
 *
 * ============================================================================
 * 【なぜ Voice ID をここに書くのか】(2026-08 に方針を変えた)
 *
 *   はじめは Supabase の Secrets に置いていた。しかし声が増えると、
 *   **名前と性別はコード、id は Secrets、と2か所に分かれる。**
 *   30人ぶんを2か所でそろえるのは、いつか必ずずれる。
 *
 *   Voice ID は**鍵ではない。** ElevenLabs の声を指す番号にすぎず、
 *   これだけでは何もできない(API キーが別に要る)。
 *   だから**1か所にまとめる**ほうがよい。
 *   **API キーは Secrets のまま。** あれは鍵である。
 *
 * ============================================================================
 * 【標準の段(Google / Azure)には、この訛りが無い】
 *
 *   持っているのはほぼアメリカ英語とイギリス英語だけ。
 *   スコットランドやインドの声は無い。そこで**代役**に落とす。
 *
 *     記事・会話の本文、発音・リズムのドリル → ElevenLabs(選んだ声)
 *     それ以外の演習                        → 代役(Google / Azure)
 *
 *   代役は「アメリカ寄り(米・加)なら us、それ以外は uk」× 性別で決まる。
 *   **同じ訛り・同じ性別の声どうしは、代役を共有する。**
 *   ドリルの音声はそのぶん作り直さずに済む。
 */

/** 訛りの一覧。画面の選択肢の順番でもある */
export const CLIP_ACCENTS = [
  { id: 'us', label: 'アメリカ',        hint: '標準。既定はこれ' },
  { id: 'uk', label: 'イギリス',        hint: 'RP(容認発音)' },
  { id: 'au', label: 'オーストラリア',  hint: '母音が大きく動く' },
  { id: 'ca', label: 'カナダ',          hint: 'アメリカに近い' },
  { id: 'ie', label: 'アイルランド',    hint: 'r を強く読む' },
  { id: 'sc', label: 'スコットランド',  hint: '巻き舌の r。聞き取りが難しい' },
  { id: 'in', label: 'インド',          hint: '取引先で出会いやすい' },
  { id: 'sg', label: 'シンガポール',    hint: '同上。アジアの英語' },
  { id: 'nz', label: 'ニュージーランド', hint: 'オーストラリアに近い' },
  { id: 'za', label: '南アフリカ',      hint: '母音が独特' },
]

export const DEFAULT_ACCENT = 'us'

/** 声の向き。教材の種類で自動的に絞る */
export const VOICE_USES = [
  { id: 'narration', label: 'ナレーション向き', hint: '記事の朗読・ドリル・単語' },
  { id: 'conversation', label: '会話向き', hint: '感情のある受け答え' },
  { id: 'both', label: 'どちらでも', hint: '両方に出る' },
]

/**
 * 教材の種類から、要る声の向きを決める。
 * **ここ1か所で決める。** 画面ごとに書くと必ず食い違う。
 */
export const voicePurposeFor = (kind) =>
  (kind === 'dialogue' ? 'conversation' : 'narration')

/**
 * 会話に出せる人数(2026-09 利用者の要望)。
 *
 *   > スピーカーが揃ったので、「会議」というジャンルを作りたいです。
 *   > 3人以上、何人くらいまでが教材としてリアルですか?
 *
 * **上限は4人。** 理由は2つある。
 *
 *   ① **1人あたりの発言が少なくなりすぎる。** 会話は 14 発言なので、
 *      3人なら1人 4〜5 回、4人なら 3〜4 回。5人だと 2〜3 回しかなく、
 *      **その人らしさが出ないまま終わる。** 会議の練習にならない
 *   ② **耳で聞き分けられなくなる。** 声は訛り × 男女で選ぶので、
 *      同じ訛りの中で確実に区別できるのは4人あたりまでである
 *      (`castClipSpeakers` は名簿の順に当てるだけで、
 *      似た声を避ける仕組みは持っていない)
 *
 * 実際の会議は5人以上のこともあるが、**教材は聞き分けられることが先。**
 */
export const SPEAKER_COUNTS = [
  { id: 2, label: '2人(1対1の会話)' },
  { id: 3, label: '3人(会議・打ち合わせ)' },
  { id: 4, label: '4人(会議・打ち合わせ)' },
]

/** 会話に出せる人数の上限。**窓口の丸めと同じ数にする** */
export const MAX_SPEAKERS = 4

/**
 * その教材に要る声の人数。会話は 2〜4 人、それ以外は1人。
 * **人数は教材に持たせない。** `materials.voice_ids` の長さがそのまま
 * 人数なので、**表も列も増やさない**(CLAUDE.md)。
 */
export const voiceCountFor = (kind, speakers = 2) => {
  /* **会議も会話と同じ形である**(2026-09 利用者の指定で `meeting` を足した)。
     ちがうのは**下限が3人**だという1点だけ。
     2人では「会議」にならない(それはただの1対1の会話である)。 */
  const meeting = kind === 'meeting'
  if (kind !== 'dialogue' && !meeting) return 1
  const least = meeting ? MIN_MEETING_SPEAKERS : 2
  const n = Math.round(Number(speakers) || least)
  return Math.min(Math.max(n, least), MAX_SPEAKERS)
}

/** 会議に出す人数の下限。**2人では会議にならない** */
export const MIN_MEETING_SPEAKERS = 3

/**
 * その種類で選べる人数(2026-09)。
 * 会話は 2〜4 人、**会議は 3〜4 人**(効かない選択肢を見せない)。
 */
export const speakerCountsFor = (kind) =>
  (kind === 'meeting'
    ? SPEAKER_COUNTS.filter((s) => s.id >= MIN_MEETING_SPEAKERS)
    : SPEAKER_COUNTS)

export const accentLabel = (id) =>
  CLIP_ACCENTS.find((a) => a.id === id)?.label ?? id

// ============================================================================
// ★★★ ここに声を足してください ★★★
//
//   2026-09、利用者が ElevenLabs で選んだ声を入れた(はじめ10人、のち15人)。
//   足したい声があれば、下と同じ形で1行足すだけでよい。足した順に並ぶ。
//
//     { id: 'sc-1', accent: 'sc', gender: 'male', use: 'both',
//       label: 'Angus', elevenId: 'ここに Voice ID' },
//
//   **`id` は一度決めたら変えないこと。** 変えると音声の置き場所が変わり、
//   作り直し(= 課金)になる。
//
//   【`use` は、いまぜんぶ `both` にしてある】
//     ElevenLabs 側の分類(Narrative Story / Conversational)を
//     こちらでは確かめていないので、**あやふやなことを書かず**
//     「どちらでも使える」にしてある。
//     使ってみて「この声は会話向きだ」と分かったら、その行の `use` を
//     `conversation`(または `narration`)に書き換えるだけでよい。
//     そうすると、記事を作るときの選択肢から自動的に外れる。
//
//   【声を**入れ替える**ときは、CLIP_REV を進める】
//     すでにある行の `elevenId` を別の声に差し替えたときだけである。
//     **足すだけなら進めなくてよい。** 音声の置き場所は
//     `<版>/<段>/<声の id>/<英文の指紋>.mp3` で、声の id が道に入っている。
//     足しただけなら新しい道になるので、前の音声とぶつからない。
//     (進めると**すべての音声が作り直しになる。** 迂闊に進めない)
// ============================================================================
export const CLIP_VOICES = [
  // ── アメリカ ────────────────────────────────────────────
  { id: 'us-1', accent: 'us', gender: 'female', use: 'both',
    label: 'Jessica', elevenId: 'cgSgspJ2msm6clMCkdW9' },
  { id: 'us-2', accent: 'us', gender: 'male', use: 'both',
    label: 'David Esposito', elevenId: 'iEw1wkYocsNy7I7pteSN' },
  /* **使わない**(2026-09 利用者の指定)。「クラスに出る」の Mika 役が
     この声で、**発言の終わりに必ずノイズが入る。**
     行ごと消さない —— id は音声の置き場所に入っているので、消すと
     この声で作った教材の話す人に声が当たらなくなる(`isRetired`) */
  { id: 'us-3', accent: 'us', gender: 'female', use: 'both', retired: true,
    label: 'Bella', elevenId: 'hod33eJyEU4TLqiYFttr' },
  { id: 'us-4', accent: 'us', gender: 'female', use: 'both',
    label: 'Nichalia', elevenId: 'XfNU2rGpBa01ckF309OY' },
  { id: 'us-5', accent: 'us', gender: 'male', use: 'both',
    label: 'Zhan', elevenId: '1IKfgBmzdwnmAUPnryb3' },
  { id: 'us-6', accent: 'us', gender: 'male', use: 'both',
    label: 'Adam', elevenId: 'hWnML2XRpykt4MG3bS1i' },
  { id: 'us-7', accent: 'us', gender: 'male', use: 'both',
    label: 'Joe', elevenId: 'UpphzPau5vxibPYV2NeV' },

  // ── イギリス ────────────────────────────────────────────
  { id: 'uk-1', accent: 'uk', gender: 'female', use: 'both',
    label: 'Sky', elevenId: 'QeRkfdkzgy4CefJ3AcII' },
  { id: 'uk-2', accent: 'uk', gender: 'female', use: 'both',
    label: 'Sophia', elevenId: 'LM5QaByxyWDmNhcQTYiS' },
  // **この2人はもともと遅い**ので、既定で 1.2 倍にする(2026-09 利用者の指定)
  { id: 'uk-3', accent: 'uk', gender: 'male', use: 'both',
    label: 'Jofra', elevenId: 'NuRyEq0OdD9mMOyd51UZ', rate: 1.2 },
  { id: 'uk-4', accent: 'uk', gender: 'male', use: 'both',
    label: 'Henry', elevenId: 'KP6QbSvtyKSTfuh4UzcQ', rate: 1.2 },

  // ── オーストラリア ──────────────────────────────────────
  { id: 'au-1', accent: 'au', gender: 'female', use: 'both',
    label: 'Brenna', elevenId: 'L4bD71zGAYHMT7a6MLwc' },
  { id: 'au-2', accent: 'au', gender: 'female', use: 'both',
    label: 'Emma', elevenId: '56bWURjYFHyYyVf490Dp' },
  { id: 'au-3', accent: 'au', gender: 'male', use: 'both',
    label: 'Tom', elevenId: 'DYkrAHD8iwork3YSUBbs' },
  { id: 'au-4', accent: 'au', gender: 'male', use: 'both',
    label: 'Brad', elevenId: 'vVnXvLYPFjIyE2YrjUBE' },
  /* 2026-09、利用者が女性を8人足した。
     **オーストラリアは女性10・男性2** になったので、会話のおまかせ
     (男女交互)は男性が2人で尽きる。3人以上の会議では女性が続く */
  { id: 'au-5', accent: 'au', gender: 'female', use: 'both',
    label: 'Charlotte', elevenId: 'aRlmTYIQo6Tlg5SlulGC' },
  { id: 'au-6', accent: 'au', gender: 'female', use: 'both',
    label: 'Dee', elevenId: '5TZtQYDIn8M40udRnoVI' },
  { id: 'au-7', accent: 'au', gender: 'female', use: 'both',
    label: 'Kylie', elevenId: 'e1nbKcfTL4XYy71tZn9J' },
  { id: 'au-8', accent: 'au', gender: 'female', use: 'both',
    label: 'Isabel', elevenId: 'XEQBC9sleaE3f5ff82UR' },
  { id: 'au-9', accent: 'au', gender: 'female', use: 'both',
    label: 'Helenrzz', elevenId: 'U0ryXq06j9IEookC0qwV' },
  { id: 'au-10', accent: 'au', gender: 'female', use: 'both',
    label: 'Krystal', elevenId: 'jVaO0tjr2YWfUw1xLmB2' },
  { id: 'au-11', accent: 'au', gender: 'female', use: 'both',
    label: 'Hannah', elevenId: 'M7ya1YbaeFaPXljg9BpK' },
  { id: 'au-12', accent: 'au', gender: 'female', use: 'both',
    label: 'AImie', elevenId: 'fCqNx624ZlenYx5PXk6M' },

  // ── スコットランド ──────────────────────────────────────
  /* 2026-09 利用者が選定。

     **訛りを最大限に活かす指定は、いまは全員に効く**(`ACCENT_KEEP`・下)。
     はじめはこの声にだけ付けていたが、利用者の指定で全員に広げた。

     **標準の段(Google / Azure)にスコットランドの声は無い。**
     ドリルや単語では `uk-male` が代役になる(`baseOf`)。
     訛りが要るのは記事・会話の本文なので、そこは ElevenLabs が読む。 */
  /* **雑音の出どころは、この声そのものだった**(2026-09 実機・利用者の判断)。

     > サーはやはり消えません。ElevenLabs の段階で感じていたことなので、
     > あなたの言っていることが正しいです。
     > 元々音の悪い音声は選ばないことにしました。

     試したことと、その結末を残しておく(**同じ道を二度たどらないため**)。

     | 試したこと | 結果 |
     |---|---|
     | 似せ具合 1 → **0.1**(話者らしさも off) | **さーっは消えなかった。** 元の録音そのものが雑 |
     | 終わりを **150ms** 切る | プチっは大幅に減ったが、まだ散見された |
     | 終わりを **200ms** 切る | **語尾が消えた。** 行き過ぎ |

     **どちらの値も残していない。** 0.1 は訛りを薄めるだけで雑音は消えず、
     切り落としは語尾を削る。**残せば「悪い音を、別の悪さで隠す」ことになる。**

     **2026-09、利用者の指定で外した**(「Ally は消してください」)。
     行ごと消さない —— id は音声の置き場所
     (`<版>/<段>/<声の id>/<指紋>.mp3`)に入っているので、消すと
     この声で作った教材の話す人に声が当たらなくなる(`isRetired`)。
     **代わりに Hugh が入っている**(下)。スコットランド訛りを
     練習したいゲストは実在するので、訛りそのものは残す。 */
  { id: 'sc-1', accent: 'sc', gender: 'male', use: 'both', retired: true,
    label: 'Ally', elevenId: 'v2zbX16tJNtRIx8rSHDM' },
  /* 2026-09 利用者が選定(Ally の代わり)。
     **`CLIP_REV` は進めない** —— 足すだけなら、すでに作った音声は
     1本も作り直しにならない(置き場所に声の id が入っているため)。 */
  { id: 'sc-2', accent: 'sc', gender: 'male', use: 'both',
    label: 'Hugh', elevenId: 'y6p0SvBlfEe2MH4XN7BP' },
  { id: 'sc-3', accent: 'sc', gender: 'male', use: 'both',
    label: 'Chris', elevenId: 's07KcA1KjfdDAsyJ87HW' },
  /* **性別は利用者から伝わっていない**(名前だけで足された)。
     いまは男性として置いてあるが、**名前から性別は当てられない。**
     ここがずれると、会話で「女性の声に男性の役名」が乗る
     (2026-09 に一度直した不具合そのもの)。**利用者に確かめて直す。** */
  { id: 'sc-4', accent: 'sc', gender: 'male', use: 'both',
    label: 'Rob', elevenId: 'JdanfwfOBtHuVRJhsamV' },
  { id: 'sc-5', accent: 'sc', gender: 'male', use: 'both',
    label: 'Mark', elevenId: 'pp4ihOlfDr2MgdTALvoR' },
  { id: 'sc-6', accent: 'sc', gender: 'male', use: 'both',
    label: 'Archie', elevenId: 'aMdQCEO9kwP77QH1DiFy' },
  /* **スコットランドで初めての女性の声**(2026-09)。
     これで会話のおまかせが**男女交互**に当たるようになる
     (`pickVoices`)。それまでは男性しかいなかったので、
     何人選んでも全員が男性だった */
  { id: 'sc-7', accent: 'sc', gender: 'female', use: 'both',
    label: 'Bonnie Makenzie', elevenId: 'AMNzDFTtLuyoKAL3YPnu' },
  { id: 'sc-8', accent: 'sc', gender: 'female', use: 'both',
    label: 'Isla Skye', elevenId: 'TVmbglAk3F1GkiCoOq47' },
  { id: 'sc-9', accent: 'sc', gender: 'female', use: 'both',
    label: 'Caroline', elevenId: 'GItJI30LSRkzJQjuHqkk' },
]


/**
 * **訛りを最大限に活かすための指定**(2026-09 利用者の指定)。
 *
 * **全員に効く。**
 *
 *   > 今回作った訛り、つまり話者の話し方の特徴を最大限反映させる指定は、
 *   > 全てのスピーカーに適用してくれますか? アメリカのスピーカーでもです。
 *
 * はじめはスコットランドの声にだけ付けていた(いまの音を変えないため)。
 * けれども**訛りは、どの声にもある。** アメリカの声にも、その人の
 * 話し方の癖がある。**一部にだけ効かせる理由がない。**
 *
 * ElevenLabs の `voice_settings` に渡す。意味は次のとおり。
 *
 * | 欄 | 何をするか | ここで選んだ値の理由 |
 * |---|---|---|
 * | `similarity_boost` | もとの録音にどれだけ寄せるか | **1(最大)。** 訛りは声そのものの特徴なので、寄せるほど残る |
 * | `stability`        | 読み方をどれだけ揃えるか   | **0.35。** 低いほど感情が出る(2026-09 利用者の指定) |
 * | `style`            | 誇張の強さ                 | **0。** 誇張は元の話し方から離れる方向に効く |
 * | `use_speaker_boost`| その話者らしさを強める     | **true** |
 *
 * **1人だけ違う値にしたくなったら**、その行に `settings` を足す
 * (書いた欄だけが上書きされる)。ふだんは要らない。
 *
 * 【聞いて確かめていない】
 *   こちらには音が聞こえない。**数字の意味から選んだ値**であって、
 *   「これがいちばん良い」と確かめたものではない。
 *   物足りなければ、この4つを書き換えて作り直せばよい。
 *
 * 【値を変えたら、音声を作り直す】
 *   置き場所は英文と声から決まるので、**設定を変えても自動では作り直らない。**
 *   さがす画面の「読み上げ音声を作り直す」を押す。
 */
/* **`stability` は 0.4 → 0.35**(2026-09 利用者の指定)。

     > 0.75か何かにあげたものも元の0.45もしくは0.35くらいに戻してほしいです。
     > 感情が豊かな方が良いです。

   **このリポジトリでは 0.75 にしたことは一度も無い**(ずっと 0.4 だった。
   0.8 は Ally だけの実験値で、すでに消してある)。
   利用者が言う 0.35〜0.45 の帯の**いちばん感情が出る側**に置く。
   **低いほど読み方が回ごとにばらつき、抑揚が大きくなる。**
   これ以上下げると、同じ英文でも鳴らすたびに読み方が変わりすぎる */
export const ACCENT_KEEP = {
  similarity_boost: 1,
  stability: 0.35,
  style: 0,
  use_speaker_boost: true,
}

/**
 * その声に添える ElevenLabs の指定。**どの声にも必ず添える。**
 * **判断はここ1か所。** 画面ごとに書くと必ず食い違う。
 *
 * 名簿にその行の `settings` があれば、**書いてある欄だけ**を差し替える。
 */
export const voiceSettingsOf = (id) => ({ ...ACCENT_KEEP, ...(findVoice(id)?.settings ?? {}) })

// ── ここから下は仕組み。触らなくてよい ──────────────────────────

/** 標準の段(Google / Azure)がそのまま持っている声 */
export const BASE_VOICES = ['us-female', 'us-male', 'uk-female', 'uk-male']

export const DEFAULT_BASE = 'us-female'

/** 訛りと性別から、標準の段での代役を決める */
export const baseOf = (accent, gender) =>
  `${['us', 'ca'].includes(accent) ? 'us' : 'uk'}-${gender === 'male' ? 'male' : 'female'}`

export const findVoice = (id) => CLIP_VOICES.find((v) => v.id === id) ?? null

/** 名簿に無い id でも落とさない。代役だけは必ず決まる */
export const baseVoiceOf = (id) => {
  const v = findVoice(id)
  if (v) return baseOf(v.accent, v.gender)
  // 名簿に無いものは、id そのものが代役の名前かもしれない(`us-female` など)
  return BASE_VOICES.includes(id) ? id : DEFAULT_BASE
}

/** その声で ElevenLabs を使えるか(Voice ID が入っているか) */
export const elevenIdOf = (id) => String(findVoice(id)?.elevenId ?? '').trim()

/**
 * **その声だけの速さの補正**(2026-09 利用者の指定)。
 *
 *   > Jofra と Henry のスピードのデフォルトを 120% にしてください。
 *
 * 声によって、もともとの話す速さがまるで違う。ElevenLabs の **v3 は
 * `speed` の指定に対応していない**ので、窓口では直せない。
 * そこで**鳴らすときの `playbackRate`** で補正する。
 *
 * - **MP3 を作り直さない。** だから費用は1円もかからず、`CLIP_REV` も進めない
 * - **利用者が選んだ速さに掛ける。** 120% で聞いている人には、
 *   この2人だけがさらに 1.2 倍になる(全体はそのまま)
 * - **上限を置く**(`MAX_RATE`)。掛け算が重なると聞き取れなくなる
 */
const MAX_RATE = 2.5
export const voiceRateOf = (id) => {
  const r = Number(findVoice(id)?.rate)
  return Number.isFinite(r) && r > 0 ? Math.min(r, MAX_RATE) : 1
}

/** 画面に出す名前。「Rachel(アメリカ・女性)」 */
export const voiceLabel = (id) => {
  const v = findVoice(id)
  if (v) {
    return `${v.label}(${accentLabel(v.accent)}・${v.gender === 'male' ? '男性' : '女性'})`
  }
  /* **代役(標準の段)にも、読める名前を付ける**(2026-09 実機)。
     教材に声を選んでいないときは `us-female` のような代役が鳴る。
     id をそのまま出すと**何のことか分からない**ので、
     「標準の声」であることと、訛り・性別を日本語で言う。
     `baseOf()` の作りに合わせて `<訛り>-<性別>` を読み解く */
  const m = /^([a-z]{2})-(male|female)$/.exec(String(id ?? ''))
  if (m) return `標準の声(${accentLabel(m[1])}・${m[2] === 'male' ? '男性' : '女性'})`
  return id
}

/**
 * **もう使わない声**(2026-09 利用者の指定)。
 *
 *   > この「クラスに出る」の Mika 役の声を今後使用しないように
 *   > 変更を加えてください。この人の時だけ発言の終わりに必ず
 *   > ノイズが入ります。
 *
 * 声そのものに癖がある(語尾に雑音が乗る・息が荒い)ことがある。
 * こちらでは**音が聞こえない**ので、気づけるのは利用者だけである。
 *
 * 【外し方】その行に `retired: true` を足すだけ。
 *
 * 【消さない理由】**行ごと消すと、その声で作った教材が迷子になる。**
 *   id は音声の置き場所(`<版>/<段>/<声の id>/<指紋>.mp3`)に入っている。
 *   消すと `findVoice()` が引けなくなり、**すでに作った会話の
 *   話す人に声が当たらなくなる。**
 *   だから**残したまま、選ばれないようにする。**
 *
 * 【どこまで効くか】
 *   ・**これから作る教材**では、選択肢にも出ず、おまかせでも選ばれない
 *   ・**すでに作った教材はそのまま。** 声は教材に保存されている。
 *     気になるものは作り直す(そのとき別の声になる)
 */
export const isRetired = (v) => Boolean(v?.retired)

/**
 * その訛りに登録されている声。向きを指定すると、その向きだけに絞る。
 * **もう使わない声は返さない**(選択肢にも、おまかせにも出さない)。
 */
export const voicesOfAccent = (accent, purpose = null) => CLIP_VOICES.filter(
  (v) => v.accent === accent
    && !isRetired(v)
    && (!purpose || v.use === purpose || v.use === 'both'),
)

/** その向きの声が1人でもいる訛り。**選べない訛りを並べない** */
export const accentsWithVoices = (purpose = null) =>
  CLIP_ACCENTS.filter((a) => voicesOfAccent(a.id, purpose).length > 0)

/**
 * おまかせ。その訛りから **n 人**を選ぶ。
 *
 * **男女が交互になるように選ぶ。** 会話で同じ性別が続くと、
 * どちらが話しているのか耳で分からない。
 *
 * 選ぶのは**教材を作るとき1回だけ**で、結果は教材に保存する。
 * 開くたびに選び直すと、**同じ教材なのに毎回ちがう声になり、
 * そのたびに音声を作り直す(= 課金される)。**
 */
export function pickVoices(accent, n = 1, purpose = null) {
  const pool = voicesOfAccent(accent, purpose)
  if (!pool.length) return []
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const byGender = { female: shuffled.filter((v) => v.gender === 'female'),
    male: shuffled.filter((v) => v.gender === 'male') }
  const out = []
  let want = byGender.female.length >= byGender.male.length ? 'female' : 'male'
  while (out.length < n) {
    const other = want === 'female' ? 'male' : 'female'
    const pick = byGender[want].shift() ?? byGender[other].shift()
    if (!pick) break
    out.push(pick.id)
    want = other
  }
  // 人数が足りなければ、そのぶんは使い回す(黙って別の訛りにしない)
  while (out.length < n && out.length) out.push(out[out.length % out.length])
  return out
}

/**
 * 教材に保存された声の並びを、使える形に整える。
 * 空なら「その訛りの代役1人」にする(声をまだ登録していないとき)。
 */
export function resolveVoices(voiceIds, accent = DEFAULT_ACCENT) {
  const list = (voiceIds ?? []).filter((id) => findVoice(id))
  if (list.length) return list
  return [baseOf(accent, 'female')]
}
