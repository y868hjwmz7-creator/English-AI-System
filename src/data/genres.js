/**
 * リーディングのジャンルと、ダイアローグの場面。
 *
 * どちらも「AI に何を書かせるか」を決める指定である。
 * 業界(industries.js)と組み合わせて使う。
 *   例: 業界=IT・技術 × ジャンル=最新の話題 → IT 業界の新しい動きの記事
 *       業界=接客・観光 × 場面=交渉 → ホテルでの価格交渉の会話
 *
 * id は教材に保存されるため、使い始めたら変えない。label は自由に変えられる。
 */

/** 記事のジャンル。Engoo のような「読み物」を想定している */
export const READING_GENRES = [
  { id: 'news',       label: '最新の話題',   hint: 'その業界でいま起きていること' },
  { id: 'trend',      label: 'ちょっとした流行', hint: '広まりつつあるやり方・道具・考え方' },
  { id: 'howto',      label: '仕事のコツ',   hint: '現場で使える具体的なやり方' },
  { id: 'story',      label: '実際にあった話', hint: '会社や人の、うまくいった話・失敗した話' },
  { id: 'culture',    label: '文化のちがい', hint: '国によって仕事の進め方が違うところ' },
  { id: 'science',    label: '仕組みの話',   hint: 'なぜそうなるのかを噛み砕いた説明' },
  { id: 'opinion',    label: '賛否が分かれる話', hint: '意見が割れていて、話す材料になるもの' },
  { id: 'curious',    label: '意外な話',     hint: '思わず人に話したくなる面白いネタ' },
]

/**
 * 会話の場面。
 *
 * 「同じ内容を、どのくらいの丁寧さで話すか」が場面ごとに変わる。
 * 噂話で使う言い回しを会議で使うと浮くし、その逆も同じ。
 * 場面を変えて何本も作れることが、この機能の狙いである。
 */
export const DIALOGUE_SCENES = [
  { id: 'gossip',      label: '噂話・世間話', hint: '休憩中に「そういえば聞いた?」と話す調子' },
  { id: 'casual',      label: 'オフィスでの雑談', hint: '同僚どうしの、くだけすぎない話し方' },
  { id: 'standup',     label: '朝の進捗共有', hint: '短く要点だけ。今日やることの確認' },
  { id: 'meeting',     label: '真面目な会議', hint: '議題があり、意見を出し合って決める' },
  { id: 'negotiation', label: '交渉',       hint: '条件・金額・期限のすり合わせ' },
  { id: 'client',      label: 'お客様との打ち合わせ', hint: '社外の相手。丁寧だが硬すぎない' },
  { id: 'trouble',     label: 'トラブル対応', hint: '問題が起きて、急いで対処を決める' },
  { id: 'onboarding',  label: '新しい人への説明', hint: '知らない相手に、噛み砕いて伝える' },
  { id: 'review',      label: '面談・振り返り', hint: '上司と部下。評価や今後の話' },
  { id: 'smalltalk',   label: '打ち合わせ前の雑談', hint: '本題に入る前の数十秒' },
]

export const genreLabel = (id) => READING_GENRES.find((g) => g.id === id)?.label ?? id
export const sceneLabel = (id) => DIALOGUE_SCENES.find((s) => s.id === id)?.label ?? id
