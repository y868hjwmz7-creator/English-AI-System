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
import { industriesIn } from './industries.js'

/**
 * **どの仕事にもある話題**(2026-08 利用者の指定)。
 *
 *   > 記事またはダイアローグを選択した際は業界、趣味どちらを選んだと
 *   > しても話題もシチュエーションも自然なものが出るようにしっかり
 *   > 作り込んでくれ。その上で業種、趣味ごとに最適化された選択肢が
 *   > 出るように、かつ共通するシチュエーションや話題は共通して
 *   > 表示されるように。
 *
 * 場面(`DIALOGUE_SCENES`)と同じ考え方。**共通の話題も必ず並べる。**
 * 同じ「最新の話題」でも、出てくる語は分野で変わる。
 *
 * 分野を選んでいないときは、この一覧だけが出る。
 */
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
 * **どの仕事にもある場面**(2026-08 利用者の指定)。
 *
 *   > どの業種でもあるような共通のシチュエーションはそれぞれに
 *   > 入れておいてください。なぜなら例えば朝のミーティングでも
 *   > 業界によって使われる単語やフレーズが異なるからです。
 *
 * **同じ「朝の進捗共有」でも、出てくる語は業界で変わる。**
 * IT なら障害やリリース、製造なら歩留まりや段取りの話になる。
 * だから業界に特化した場面だけに絞らず、**共通の場面も必ず並べる。**
 *
 * 分野を選んでいないときは、この一覧だけが出る。
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

/**
 * **どの趣味にもある話題**(2026-08 利用者の指定)。
 *
 * 仕事の話題(「仕事のコツ」「賛否が分かれる話」)をそのまま趣味に出すと、
 * 読み物として噛み合わない。**趣味の側の共通形**を別に持つ。
 */
export const COMMON_HOBBY_GENRES = [
  { id: 'hg_news',     label: '最新の話題',       hint: 'その分野でいま起きていること' },
  { id: 'hg_start',    label: 'はじめての人へ',   hint: '何から始めるか、何を用意するか' },
  { id: 'hg_tips',     label: '上達のコツ',       hint: '経験者が知っている小さな工夫' },
  { id: 'hg_story',    label: '体験談',           hint: 'やってみた話。失敗も含めて' },
  { id: 'hg_compare',  label: 'くらべてみた',     hint: '2つを並べて、違いを見る' },
  { id: 'hg_culture',  label: '国によるちがい',   hint: '海外ではこう楽しまれている' },
  { id: 'hg_curious',  label: '意外な話',         hint: '思わず人に話したくなるネタ' },
  { id: 'hg_pick',     label: 'おすすめを選ぶ',   hint: '選び方の基準と、その理由' },
]

/**
 * **どの趣味にもある場面**(2026-08 利用者の指定)。
 *
 *   > 趣味についても同じ考え方を採用してください。
 *
 * 仕事の共通場面(会議・交渉)をそのまま趣味に出しても、
 * その人が英語を使う場面にはならない。**趣味の側の共通形**を別に持つ。
 * ここでも、同じ「誘う」でもゴルフとゲームでは出てくる語が違う。
 */
export const COMMON_HOBBY_SCENES = [
  { id: 'hob_invite',  label: '誘う・約束する', hint: 'いつ、どこで、だれと' },
  { id: 'hob_firsttime', label: 'はじめて会う人と', hint: 'どれくらいやっているか、きっかけ' },
  { id: 'hob_impress', label: '感想を言い合う',  hint: '良かったところ、物足りないところ' },
  { id: 'hob_recommend', label: 'おすすめを教える', hint: '相手の好みに合わせて選ぶ' },
  { id: 'hob_gear',    label: '道具・買い物',    hint: '選び方、値段、使い心地' },
  { id: 'hob_fail',    label: 'うまくいかない話', hint: 'failした話。笑いに変える言い方' },
  { id: 'hob_chat',    label: 'メッセージのやりとり', hint: '短く、くだけた書き方' },
  { id: 'hob_plan',    label: '次の予定を決める', hint: '候補を出して、すり合わせる' },
]

/**
 * 分野ごとの場面(2026-08 利用者の指定)。
 *
 *   > 趣味を選んだ時のシチュエーションがこれではつまらないです、
 *   > というよりもミスマッチです。楽しく学べるよう選択肢を変えてください。
 *   > 業界を選んだ時はこれでOKですが、それも職種で変えて欲しいです。
 *   > 例えば、外科医を選んだら、手術前の説明、とか、手術方法についての
 *   > 話し合い、とか、業界に特化した選択肢が出るようにしてください。
 *
 * **上の `DIALOGUE_SCENES` は「仕事全般」の場面である。**
 * ゴルフに「朝の進捗共有」、外科医に「打ち合わせ前の雑談」を出しても、
 * その人が実際に英語を使う場面にならない。
 *
 * 【決まりごと】
 *   ・**id は分野の名前で始める**(`surgery_preop` など)。
 *     `materials.scene` に保存されるので、**使い始めたら変えない**
 *   ・分野を足したら、ここにも足す。**無ければ「仕事全般」に落ちる**
 *     ので、足し忘れても壊れない
 *   ・**1分野につき 6〜8 個。** 多すぎると選べない
 */
export const SCENES_BY_INDUSTRY = {
  /* ── お仕事 ────────────────────────────────────────────── */
  it: [
    { id: 'it_spec',     label: '仕様の詰め',     hint: '何を作るかを決める。認識のずれを潰す' },
    { id: 'it_review',   label: 'コードレビュー', hint: '直してほしい点を、角を立てずに伝える' },
    { id: 'it_incident', label: '障害対応',       hint: '止まっている。原因と復旧を急いで詰める' },
    { id: 'it_standup',  label: '朝の進捗共有',   hint: '短く要点だけ。今日やることの確認' },
    { id: 'it_estimate', label: '見積もりと納期', hint: 'いつまでに、どこまでできるか' },
    { id: 'it_handover', label: '引き継ぎ',       hint: '知らない相手に、噛み砕いて渡す' },
    { id: 'it_vendor',   label: '外部ベンダーとの調整', hint: '社外の相手。丁寧だが硬すぎない' },
  ],
  medical: [
    { id: 'med_intake',   label: '受け入れ・問診',   hint: 'どこが、いつから、どんなふうに' },
    { id: 'med_explain',  label: '患者さんへの説明', hint: '専門語を使わずに、不安を減らす' },
    { id: 'med_family',   label: 'ご家族への説明',   hint: '本人以外に、状況と見通しを伝える' },
    { id: 'med_handover', label: '申し送り',         hint: '交代の相手へ、短く漏れなく' },
    { id: 'med_team',     label: '多職種での相談',   hint: '看護・リハビリ・薬剤と方針を合わせる' },
    { id: 'med_care',     label: '介護の現場',       hint: '声かけ、移乗、日々の様子の共有' },
    { id: 'med_emergency', label: '急変時',          hint: '緊迫した場面。短い指示と復唱' },
  ],
  surgery: [
    { id: 'sur_preop',  label: '手術前の説明',   hint: '何をするか、危険は何か、同意を得る' },
    { id: 'sur_plan',   label: '術式の話し合い', hint: 'どの方法で行くか、医師どうしで詰める' },
    { id: 'sur_or',     label: '手術中のやりとり', hint: '短い指示と復唱。器械出しとの連携' },
    { id: 'sur_postop', label: '術後の説明',     hint: '経過、退院の見通し、気をつけること' },
    { id: 'sur_conf',   label: 'カンファレンス', hint: '症例を出して、方針の意見を出し合う' },
    { id: 'sur_case',   label: '症例報告',       hint: '学会や院内で、経過をまとめて話す' },
    { id: 'sur_referral', label: '他院への紹介', hint: '受け渡し。経過と依頼をはっきり伝える' },
  ],
  pharma: [
    { id: 'phr_trial',   label: '治験の打ち合わせ', hint: '実施計画、組み入れ、進み具合' },
    { id: 'phr_reg',     label: '当局とのやりとり', hint: '承認申請。問い合わせへの回答' },
    { id: 'phr_quality', label: '品質・逸脱の対応', hint: '起きたこと、原因、これからの手' },
    { id: 'phr_msl',     label: '医師への学術情報', hint: 'データをもとに、正確に、売り込まずに' },
    { id: 'phr_audit',   label: '監査・査察',       hint: '見られる側。記録と手順を説明する' },
    { id: 'phr_launch',  label: '発売の準備',       hint: '各部署と段取りを合わせる' },
  ],
  finance: [
    { id: 'fin_loan',    label: '融資の相談',   hint: '使いみち、返済、担保の話' },
    { id: 'fin_pitch',   label: '投資の提案',   hint: '見込みと危険を、正直に並べる' },
    { id: 'fin_results', label: '決算の説明',   hint: '数字の背景を、聞き手に合わせて' },
    { id: 'fin_risk',    label: 'リスクの説明', hint: '悪くなったときに何が起きるか' },
    { id: 'fin_compliance', label: 'コンプライアンス確認', hint: '手続きと決まりの確かめ合い' },
    { id: 'fin_client',  label: 'お客様との面談', hint: '社外の相手。丁寧だが硬すぎない' },
  ],
  investor: [
    { id: 'inv_meeting', label: '投資先との面談', hint: '進み具合と、次の一手を聞く' },
    { id: 'inv_dd',      label: '事業の見極め',   hint: '数字と話の食い違いを詰める' },
    { id: 'inv_terms',   label: '条件の交渉',     hint: '金額、持ち分、いつ入れるか' },
    { id: 'inv_board',   label: '取締役会',       hint: '賛成・反対をはっきり述べる' },
    { id: 'inv_lp',      label: '出資者への報告', hint: '良い知らせも悪い知らせも伝える' },
    { id: 'inv_exit',    label: '出口の相談',     hint: '売却・上場の道筋を話し合う' },
  ],
  manda: [
    { id: 'ma_dd',        label: 'デューデリジェンス', hint: '資料の不足を指摘し、答えをもらう' },
    { id: 'ma_valuation', label: '値段の話し合い',     hint: '算定の前提をすり合わせる' },
    { id: 'ma_terms',     label: '契約条件の交渉',     hint: '表明保証、補償、条件付き対価' },
    { id: 'ma_signing',   label: '調印前の詰め',       hint: '残っている論点を一つずつ潰す' },
    { id: 'ma_pmi',       label: '統合後の引き継ぎ',   hint: '別々だった組織の進め方を合わせる' },
    { id: 'ma_announce',  label: '社内への説明',       hint: '不安を減らし、これからを示す' },
  ],
  legal: [
    { id: 'law_draft',   label: '契約書の読み合わせ', hint: '条項の意図と、危ないところ' },
    { id: 'law_redline', label: '条項の交渉',         hint: '譲れる線と、譲れない線' },
    { id: 'law_advice',  label: '社内からの相談',     hint: '法律の言葉を使わずに答える' },
    { id: 'law_dispute', label: 'もめごとの対応',     hint: '事実を並べ、次の手を決める' },
    { id: 'law_compliance', label: '社内の決まりの説明', hint: 'なぜ守る必要があるかまで話す' },
    { id: 'law_counsel', label: '外部の弁護士と',     hint: '状況を渡し、見立てをもらう' },
  ],
  insurance: [
    { id: 'ins_explain', label: '契約内容の説明', hint: '出るとき・出ないときをはっきり' },
    { id: 'ins_claim',   label: '請求の受付',     hint: '何が起きたかを、順に聞き取る' },
    { id: 'ins_assess',  label: '査定の説明',     hint: '金額の根拠を、納得できるように' },
    { id: 'ins_agent',   label: '代理店とのやりとり', hint: '商品の説明と、販売の相談' },
    { id: 'ins_renewal', label: '更新の相談',     hint: '見直しの提案。押しつけない' },
    { id: 'ins_dispute', label: '不服への対応',   hint: '感情が高ぶった相手に、冷静に' },
  ],
  trading: [
    { id: 'trd_source',   label: '仕入れ先との交渉', hint: '値段、数量、いつまでに' },
    { id: 'trd_quote',    label: '見積もりのやりとり', hint: '条件を変えながら詰める' },
    { id: 'trd_shipping', label: '船積み・物流',     hint: '書類、遅れ、費用の分担' },
    { id: 'trd_credit',   label: '与信の相談',       hint: '相手の支払い能力をどう見るか' },
    { id: 'trd_agent',    label: '代理店との打ち合わせ', hint: '販売の分担と目標' },
    { id: 'trd_claim',    label: 'クレーム対応',     hint: '品違い・数量不足の処理' },
  ],
  manufacturing: [
    { id: 'mfg_line',    label: '現場での指示',   hint: '短く、確実に伝わる言い方' },
    { id: 'mfg_quality', label: '品質の問題',     hint: '不良の原因と、これからの手' },
    { id: 'mfg_safety',  label: '安全の確認',     hint: '危ないところを、遠慮なく指摘する' },
    { id: 'mfg_kaizen',  label: '改善の提案',     hint: '作業を楽に、速くする案を出す' },
    { id: 'mfg_supplier', label: '取引先との調整', hint: '納期と仕様のすり合わせ' },
    { id: 'mfg_visit',   label: '工場見学の案内', hint: '工程を、知らない人に説明する' },
  ],
  construction: [
    { id: 'con_site',    label: '現場での打ち合わせ', hint: '図面を見ながら、その場で決める' },
    { id: 'con_schedule', label: '工程の調整',       hint: '遅れをどう取り戻すか' },
    { id: 'con_contract', label: '契約・追加費用',   hint: '変更が出たときの話し合い' },
    { id: 'con_viewing', label: '内見の案内',       hint: '良いところも、気になる点も伝える' },
    { id: 'con_safety',  label: '安全の指示',       hint: '事故を起こさないための声かけ' },
    { id: 'con_owner',   label: '施主への説明',     hint: '専門語を使わずに、見通しを話す' },
  ],
  restaurant: [
    { id: 'rst_seat',    label: '席への案内',     hint: '人数、席の希望、待ち時間' },
    { id: 'rst_order',   label: '注文を取る',     hint: 'おすすめ、苦手なもの、焼き加減' },
    { id: 'rst_menu',    label: 'メニューの説明', hint: '材料と作り方を、短い言葉で' },
    { id: 'rst_kitchen', label: '厨房でのやりとり', hint: '短い指示と復唱。急ぎの伝え方' },
    { id: 'rst_claim',   label: 'クレーム対応',   hint: 'まず受け止め、それから手を打つ' },
    { id: 'rst_supply',  label: '仕入れ・業者と', hint: '数量、値段、納品の時間' },
    { id: 'rst_reserve', label: '予約の電話',     hint: '日時、人数、席の希望を確かめる' },
  ],
  hospitality: [
    { id: 'hos_checkin', label: 'チェックイン',   hint: '手続きと、部屋・設備の案内' },
    { id: 'hos_guide',   label: '道案内・おすすめ', hint: '行き方と、行く価値のある理由' },
    { id: 'hos_booking', label: '予約の受付・変更', hint: '空き状況と、条件のすり合わせ' },
    { id: 'hos_trouble', label: '苦情への対応',   hint: 'まず受け止め、それから手を打つ' },
    { id: 'hos_restaurant', label: 'レストランで', hint: '注文、アレルギー、味の説明' },
    { id: 'hos_farewell', label: 'お見送り',      hint: '短いやりとりで、また来たくなる' },
  ],
  sports: [
    { id: 'spt_intake',  label: '痛みの聞き取り', hint: 'どこが、いつから、どう動かすと' },
    { id: 'spt_cue',     label: '動作の指示',     hint: '体の使い方を、短い言葉で' },
    { id: 'spt_rehab',   label: 'リハビリの計画', hint: 'いつまでに、どこまで戻すか' },
    { id: 'spt_treat',   label: '施術の説明',     hint: '何をするか、どう感じるか' },
    { id: 'spt_coach',   label: 'コーチとの共有', hint: '出せる状態かどうかを伝える' },
    { id: 'spt_prevent', label: 'ケガを防ぐ話',   hint: '日々やっておくこと' },
  ],
  research: [
    { id: 'res_lab',     label: '研究室での相談', hint: '結果の読み方と、次に試すこと' },
    { id: 'res_conf',    label: '学会での質疑',   hint: '短く答え、限界も正直に言う' },
    { id: 'res_collab',  label: '共同研究の打診', hint: '何を持ち寄り、何を得るか' },
    { id: 'res_grant',   label: '助成金の相談',   hint: 'なぜ要るのかを、専門外にも' },
    { id: 'res_review',  label: '査読への返答',   hint: '指摘に、感情を入れずに答える' },
    { id: 'res_student', label: '学生への指導',   hint: '考え方を渡す。答えを渡さない' },
  ],
  music: [
    { id: 'mus_booking', label: 'ブッキングの相談', hint: '日程、出演時間、ギャラ' },
    { id: 'mus_rehearsal', label: 'リハーサル',    hint: '音量、返し、進行の確認' },
    { id: 'mus_gear',    label: '機材のやりとり',  hint: '持ち込み、借りる、つなぎ方' },
    { id: 'mus_tour',    label: 'ツアーの段取り',  hint: '移動、宿、荷物' },
    { id: 'mus_mc',      label: 'お客さんへの声かけ', hint: 'ステージからのひとこと' },
    { id: 'mus_studio',  label: 'レコーディング',  hint: 'テイクの相談、音の注文' },
  ],
  film: [
    { id: 'flm_audition', label: 'オーディション', hint: '自己紹介と、役への向き合い方' },
    { id: 'flm_reading',  label: '読み合わせ',     hint: '解釈のすり合わせ' },
    { id: 'flm_set',      label: '撮影現場',       hint: '段取り、待ち、短い指示' },
    { id: 'flm_direct',   label: '演出の相談',     hint: 'どう見せたいかを言葉にする' },
    { id: 'flm_interview', label: '取材',          hint: '作品について、外に向けて話す' },
    { id: 'flm_festival', label: '映画祭・舞台挨拶', hint: '短く、印象に残る話し方' },
  ],

  /* ── 趣味・娯楽 ─────────────────────────────────────────
     **仕事の場面をそのまま出さない。** 「朝の進捗共有」をゴルフに
     出しても、その人が実際に英語を使う場面にはならない。
     旅先や趣味の輪の中で、**本当に起きるやりとり**を並べる。 */
  travel: [
    { id: 'trv_airport', label: '空港で',       hint: 'カウンター、乗り継ぎ、荷物のトラブル' },
    { id: 'trv_hotel',   label: 'ホテルで',     hint: 'チェックイン、部屋の相談、頼みごと' },
    { id: 'trv_ask',     label: '道を尋ねる',   hint: '通りがかりの人に、短く聞く' },
    { id: 'trv_order',   label: 'お店で注文する', hint: 'メニュー、おすすめ、支払い' },
    { id: 'trv_trouble', label: '困ったとき',   hint: '無くした、遅れた、体調が悪い' },
    { id: 'trv_local',   label: '現地の人と話す', hint: '出身、仕事、この街のこと' },
    { id: 'trv_friends', label: '旅先で知り合う', hint: '一緒に行かない?と誘う・誘われる' },
  ],
  golf: [
    { id: 'glf_invite',  label: 'ラウンドに誘う', hint: '日程と場所を決めるまで' },
    { id: 'glf_teebox',  label: 'ティーで',      hint: '順番、風、距離の読み合い' },
    { id: 'glf_course',  label: 'コースを歩きながら', hint: '仕事以外の、気楽な話' },
    { id: 'glf_score',   label: 'スコアの話',    hint: '良かった穴、崩れた穴' },
    { id: 'glf_gear',    label: '道具の話',      hint: 'クラブ、ボール、買い替え' },
    { id: 'glf_19th',    label: 'ラウンド後の一杯', hint: '振り返りと、次の約束' },
  ],
  food: [
    { id: 'fod_order',   label: 'お店で注文する', hint: 'おすすめ、苦手なもの、焼き加減' },
    { id: 'fod_recipe',  label: 'レシピを教わる', hint: '手順と、コツを聞き出す' },
    { id: 'fod_market',  label: '食材を買う',     hint: '産地、量、鮮度のたずね方' },
    { id: 'fod_review',  label: '味の感想',       hint: '好き嫌いを、失礼にならずに' },
    { id: 'fod_host',    label: '人を招く',       hint: '献立の相談、アレルギーの確認' },
    { id: 'fod_recommend', label: '店をすすめる', hint: 'どんな店か、なぜ良いか' },
  ],
  gourmet: [
    { id: 'gou_find',   label: '店をさがす',     hint: '何が食べたいか、予算、場所' },
    { id: 'gou_wait',   label: '行列・待ち時間', hint: '並ぶかどうか、店員に聞く' },
    { id: 'gou_order',  label: '注文する',       hint: '名物、量、取り分け' },
    { id: 'gou_taste',  label: '味の感想',       hint: '好き嫌いを、失礼にならずに' },
    { id: 'gou_review', label: '写真とレビュー', hint: '人に伝わる書き方' },
    { id: 'gou_hop',    label: 'はしごする',     hint: '次どこ行く?の相談' },
  ],
  wine: [
    { id: 'win_shop',   label: 'お店で選ぶ',     hint: '予算と好みを伝えて、選んでもらう' },
    { id: 'win_somm',   label: 'ソムリエと話す', hint: '料理に合わせて相談する' },
    { id: 'win_taste',  label: 'テイスティング', hint: '香り、味わい、余韻の言い方' },
    { id: 'win_pair',   label: '料理と合わせる', hint: 'なぜ合うのかを説明する' },
    { id: 'win_winery', label: 'ワイナリー訪問', hint: '造り方を聞く、畑を歩く' },
    { id: 'win_share',  label: '人にすすめる',   hint: '相手の好みから選んで渡す' },
  ],
  movies: [
    { id: 'mov_pitch',   label: 'おすすめを伝える', hint: 'ネタバレせずに面白さを言う' },
    { id: 'mov_after',   label: '見たあとの感想',   hint: '好きな場面と、その理由' },
    { id: 'mov_argue',   label: '評価が割れる作品', hint: '意見が違う相手と話す' },
    { id: 'mov_actor',   label: '俳優・監督の話',   hint: 'あの人の他の作品は' },
    { id: 'mov_service', label: '配信サービスの話', hint: '何に入っている、何が見られる' },
    { id: 'mov_plan',    label: '一緒に見る約束',   hint: '何を、いつ、どこで' },
  ],
  watching: [
    { id: 'wat_live',    label: '試合を見ながら',  hint: 'いまの場面への短い反応' },
    { id: 'wat_rules',   label: 'ルールを教える',   hint: '知らない人に、噛み砕いて' },
    { id: 'wat_player',  label: '選手の話',         hint: '調子、移籍、比べる' },
    { id: 'wat_result',  label: '結果を振り返る',   hint: '勝因・敗因を言い合う' },
    { id: 'wat_stadium', label: 'スタジアムで',     hint: '席、飲食、まわりの人と' },
    { id: 'wat_predict', label: '次の試合の予想',   hint: 'どちらが勝つか、なぜ' },
  ],
  listening: [
    { id: 'lis_taste',   label: '好きな音楽の話', hint: 'どんな曲か、どこが好きか' },
    { id: 'lis_live',    label: 'ライブの話',     hint: '行った・行きたい、チケット' },
    { id: 'lis_fest',    label: 'フェスで',       hint: '待ち合わせ、タイムテーブル' },
    { id: 'lis_share',   label: 'おすすめを渡す', hint: '相手の好みから選ぶ' },
    { id: 'lis_play',    label: '自分で演奏する', hint: '楽器、練習、バンド' },
    { id: 'lis_venue',   label: '会場でのやりとり', hint: 'グッズ、入場、まわりの人と' },
  ],
  dj: [
    { id: 'dj_set',      label: '選曲の相談',     hint: '流れ、盛り上げどころ' },
    { id: 'dj_booth',    label: 'ブースで',       hint: '交代、音量、モニターの注文' },
    { id: 'dj_gear',     label: '機材の話',       hint: 'つなぎ方、持ち込み、トラブル' },
    { id: 'dj_event',    label: 'イベントの打ち合わせ', hint: '出番、時間、ギャラ' },
    { id: 'dj_crowd',    label: 'お客さんの反応', hint: 'リクエスト、声かけ' },
    { id: 'dj_after',    label: '打ち上げ',       hint: '感想と、次の約束' },
  ],
  fitness: [
    { id: 'fit_gym',     label: 'ジムでのやりとり', hint: '器具を譲る、使い方を聞く' },
    { id: 'fit_form',    label: 'フォームを教わる', hint: '体の使い方を言葉で' },
    { id: 'fit_plan',    label: 'メニューの相談',   hint: '目標と、そこまでの道' },
    { id: 'fit_trainer', label: 'トレーナーと',     hint: '調子、痛み、次回の予定' },
    { id: 'fit_food',    label: '食事の話',         hint: 'たんぱく質、間食、外食' },
    { id: 'fit_progress', label: '成果の共有',      hint: '変わったところを言い合う' },
  ],
  gaming: [
    { id: 'gam_voice',   label: 'ボイスチャット', hint: '短い指示と、味方への声かけ' },
    { id: 'gam_party',   label: '一緒に遊ぶ約束', hint: '時間、人数、やるゲーム' },
    { id: 'gam_review',  label: 'ゲームの感想',   hint: '面白さと、物足りなさ' },
    { id: 'gam_help',    label: '攻略を教わる',   hint: '詰まったところを説明する' },
    { id: 'gam_stream',  label: '配信・実況',     hint: '見ている人へのひとこと' },
    { id: 'gam_gear',    label: '機材・設定の話', hint: 'コントローラー、回線、画質' },
  ],
}

/**
 * 分野ごとの話題(2026-08 利用者の指定)。
 *
 * 場面(`SCENES_BY_INDUSTRY`)と**同じ決まり**で作ってある。
 *   ・id は分野の名前で始める。`materials.genre` に保存されるので変えない
 *   ・**1分野につき 4〜5 個。** 共通の話題が足されるので、これで十分
 *   ・登録が無い分野は、共通の話題だけになる(足し忘れても壊れない)
 */
export const GENRES_BY_INDUSTRY = {
  /* ── お仕事 ────────────────────────────────────────────── */
  it: [
    { id: 'itg_ai',      label: '現場での AI 活用', hint: '何が変わり、何が変わらないか' },
    { id: 'itg_incident', label: '障害から学ぶ',    hint: '何が起き、どう直したか' },
    { id: 'itg_security', label: 'セキュリティ',    hint: '狙われ方と、守り方' },
    { id: 'itg_team',    label: 'チームの進め方',   hint: 'レビュー、見積もり、遠隔での働き方' },
    { id: 'itg_debt',    label: '古い仕組みの作り直し', hint: 'なぜ溜まり、どう返すか' },
  ],
  medical: [
    { id: 'medg_care',   label: '患者さんとの向き合い方', hint: '説明の仕方、寄り添い方' },
    { id: 'medg_tech',   label: '新しい医療の技術', hint: '遠隔診療、機器、データの使い方' },
    { id: 'medg_team',   label: '多職種のチーム',   hint: '看護・リハビリ・薬剤との連携' },
    { id: 'medg_aging',  label: '高齢化と介護',     hint: '在宅、施設、家族の負担' },
    { id: 'medg_burnout', label: '医療者の働き方',  hint: '交代制、人手不足、続けるための工夫' },
  ],
  surgery: [
    { id: 'surg_tech',   label: '術式の進歩',       hint: '内視鏡、ロボット、低侵襲' },
    { id: 'surg_case',   label: '印象に残った症例', hint: '判断が難しかったところ' },
    { id: 'surg_team',   label: '手術室のチーム',   hint: '声かけ、確認、事故を防ぐ工夫' },
    { id: 'surg_train',  label: '若手の育成',       hint: '見て覚える、から先へ' },
    { id: 'surg_ethics', label: '説明と同意',       hint: 'どこまで、どう伝えるか' },
  ],
  pharma: [
    { id: 'phrg_trial',  label: '治験のいま',       hint: '組み入れ、分散型、患者の負担' },
    { id: 'phrg_reg',    label: '承認と規制',       hint: '国ごとの違い、早期承認' },
    { id: 'phrg_quality', label: '品質と製造',      hint: '逸脱、査察、サプライチェーン' },
    { id: 'phrg_price',  label: '薬価とアクセス',   hint: '誰に、いくらで届くか' },
  ],
  finance: [
    { id: 'fing_market', label: '相場の動き',       hint: '何が起きて、どう受け止められたか' },
    { id: 'fing_rule',   label: '規制とルール',     hint: '守る側の実務' },
    { id: 'fing_fintech', label: '金融と技術',      hint: '決済、与信、データ' },
    { id: 'fing_risk',   label: 'リスクの話',       hint: '想定と、外れたとき' },
  ],
  investor: [
    { id: 'invg_thesis', label: '投資の考え方',     hint: 'どこを見て決めるか' },
    { id: 'invg_startup', label: 'スタートアップ',  hint: '伸びる会社、つまずく会社' },
    { id: 'invg_exit',   label: '出口のいま',       hint: '上場、売却、市場の空気' },
    { id: 'invg_esg',    label: 'お金の使われ方',   hint: '環境・社会への影響' },
  ],
  manda: [
    { id: 'mag_case',    label: '実際の案件',       hint: 'うまくいった話、壊れた話' },
    { id: 'mag_dd',      label: '見極めの実務',     hint: '何を調べ、何を見落とすか' },
    { id: 'mag_pmi',     label: '統合のむずかしさ', hint: '文化と仕組みを合わせる' },
    { id: 'mag_cross',   label: '国をまたぐ買収',   hint: '商習慣と規制の違い' },
  ],
  legal: [
    { id: 'lawg_contract', label: '契約の落とし穴', hint: '揉めてから効いてくる条項' },
    { id: 'lawg_compliance', label: '社内の決まり', hint: '守らせる側の工夫' },
    { id: 'lawg_dispute', label: '紛争と解決',      hint: '訴える前にできること' },
    { id: 'lawg_ai',     label: '新しい技術と法',   hint: 'AI、データ、著作権' },
  ],
  insurance: [
    { id: 'insg_claim',  label: '請求と査定',       hint: '揉めやすいところ' },
    { id: 'insg_product', label: '商品の作られ方',  hint: '何を、いくらで引き受けるか' },
    { id: 'insg_risk',   label: '新しいリスク',     hint: '気候、サイバー、健康' },
    { id: 'insg_trust',  label: '信頼のつくり方',   hint: '説明と、いざというときの対応' },
  ],
  trading: [
    { id: 'trdg_supply', label: '物流とサプライチェーン', hint: '止まったとき何が起きるか' },
    { id: 'trdg_deal',   label: '交渉の現場',       hint: '値段以外で決まること' },
    { id: 'trdg_risk',   label: '為替と与信',       hint: '損をしないための備え' },
    { id: 'trdg_market', label: '新しい市場',       hint: 'どこへ、何を売るか' },
  ],
  manufacturing: [
    { id: 'mfgg_quality', label: '品質のつくり込み', hint: '不良をどう減らすか' },
    { id: 'mfgg_auto',   label: '自動化とロボット', hint: '人の仕事はどう変わるか' },
    { id: 'mfgg_safety', label: '安全と事故',       hint: '起きた例と、防ぎ方' },
    { id: 'mfgg_kaizen', label: '現場の改善',       hint: '小さな工夫が積み上がる' },
  ],
  construction: [
    { id: 'cong_site',   label: '現場のいま',       hint: '人手、工期、資材' },
    { id: 'cong_design', label: '設計とデザイン',   hint: '住み心地と、使い勝手' },
    { id: 'cong_green',  label: '省エネと環境',     hint: '断熱、再生材、認証' },
    { id: 'cong_market', label: '不動産の動き',     hint: '価格、需要、街の変化' },
  ],
  hospitality: [
    { id: 'hosg_service', label: 'もてなしの工夫',  hint: '記憶に残る接客とは' },
    { id: 'hosg_travel', label: '旅行のいま',       hint: '人の動き、行き先の変化' },
    { id: 'hosg_trouble', label: '困ったお客様',    hint: '断り方、収め方' },
    { id: 'hosg_local',  label: '地元とのつながり', hint: 'その土地らしさをどう出すか' },
  ],
  restaurant: [
    { id: 'rstg_menu',   label: 'メニューづくり',   hint: '何を、いくらで出すか' },
    { id: 'rstg_kitchen', label: '厨房のまわし方',  hint: '段取り、人手、無駄を減らす' },
    { id: 'rstg_trend',  label: '食のはやり',       hint: '客が求めているもの' },
    { id: 'rstg_review', label: '口コミと評判',     hint: '書かれ方と、向き合い方' },
  ],
  sports: [
    { id: 'sptg_injury', label: 'ケガと復帰',       hint: '起き方と、戻るまでの道' },
    { id: 'sptg_train',  label: 'トレーニングの科学', hint: '何が効き、何が効かないか' },
    { id: 'sptg_mental', label: '心の側面',         hint: '緊張、集中、立ち直り' },
    { id: 'sptg_nutrition', label: '食事と回復',    hint: '何を、いつ摂るか' },
  ],
  research: [
    { id: 'resg_finding', label: '新しい発見',      hint: '何が分かったのか' },
    { id: 'resg_method', label: '研究のやり方',     hint: '再現性、データの扱い' },
    { id: 'resg_career', label: '研究者の道',       hint: 'ポスト、資金、進路' },
    { id: 'resg_open',   label: '開かれた研究',     hint: '公開、共同、市民との関わり' },
  ],
  music: [
    { id: 'musg_scene',  label: '音楽シーンのいま', hint: '売れ方、聴かれ方の変化' },
    { id: 'musg_making', label: '曲づくりの裏側',   hint: '思いつきから形になるまで' },
    { id: 'musg_live',   label: 'ライブの現場',     hint: '会場、音、お客さん' },
    { id: 'musg_money',  label: '音楽で食べる',     hint: '配信、権利、収入' },
  ],
  film: [
    { id: 'flmg_making', label: '撮影の裏側',       hint: '現場で何が起きているか' },
    { id: 'flmg_acting', label: '演じるということ', hint: '役に入る、離れる' },
    { id: 'flmg_industry', label: '映画界のいま',   hint: '配信、興行、資金' },
    { id: 'flmg_story',  label: '物語のつくり方',   hint: '脚本、構成、編集' },
  ],

  /* ── 趣味・娯楽 ───────────────────────────────────────── */
  travel: [
    { id: 'trvg_place',  label: '行き先の紹介',     hint: 'どんな街か、何が見どころか' },
    { id: 'trvg_tips',   label: '旅のコツ',         hint: '荷物、移動、お金' },
    { id: 'trvg_trouble', label: '旅先のトラブル',  hint: '起きた話と、どう切り抜けたか' },
    { id: 'trvg_food',   label: '現地の食べもの',   hint: '名物と、頼み方' },
    { id: 'trvg_manner', label: '現地のマナー',     hint: '知らないと失礼になること' },
  ],
  golf: [
    { id: 'glfg_course', label: 'コースの紹介',     hint: '難しさ、景色、攻め方' },
    { id: 'glfg_swing',  label: 'スイングの話',     hint: '直したところと、その結果' },
    { id: 'glfg_gear',   label: '道具えらび',       hint: 'クラブ、ボール、シューズ' },
    { id: 'glfg_tour',   label: 'プロの試合',       hint: '勝負どころと、その判断' },
    { id: 'glfg_manner', label: 'ゴルフのマナー',   hint: '同伴者への気づかい' },
  ],
  food: [
    { id: 'fodg_recipe', label: 'つくり方',         hint: '手順と、失敗しないコツ' },
    { id: 'fodg_ingredient', label: '食材の話',     hint: '旬、産地、選び方' },
    { id: 'fodg_tool',   label: '道具とキッチン',   hint: '鍋、包丁、家電' },
    { id: 'fodg_world',  label: '世界の家庭料理',   hint: '国ごとの定番' },
  ],
  gourmet: [
    { id: 'goug_shop',   label: 'お店の紹介',       hint: '何が名物で、どう並ぶか' },
    { id: 'goug_street', label: '食べ歩きの街',     hint: '歩いて回れる範囲の楽しみ' },
    { id: 'goug_trend',  label: '流行りの一品',     hint: 'なぜ人が集まるのか' },
    { id: 'goug_review', label: '評価のしかた',     hint: '星、口コミ、あてになるか' },
  ],
  wine: [
    { id: 'wing_grape',  label: 'ぶどうの品種',     hint: '味わいの違いはどこから' },
    { id: 'wing_region', label: '産地をたどる',     hint: '土地と気候が味を決める' },
    { id: 'wing_pair',   label: '料理との相性',     hint: 'なぜ合うのか' },
    { id: 'wing_buy',    label: '買い方・保管',     hint: '値段の見方、置き方' },
  ],
  movies: [
    { id: 'movg_review', label: '作品を語る',       hint: '見どころと、引っかかったところ' },
    { id: 'movg_maker',  label: 'つくり手の話',     hint: '監督、俳優、脚本' },
    { id: 'movg_service', label: '配信サービス',    hint: '何がどこで見られるか' },
    { id: 'movg_genre',  label: 'ジャンルの話',     hint: 'そのジャンルの型と外し方' },
  ],
  watching: [
    { id: 'watg_match',  label: '試合を振り返る',   hint: '流れが変わった場面' },
    { id: 'watg_player', label: '選手の話',         hint: '成長、移籍、引退' },
    { id: 'watg_rule',   label: 'ルールと戦術',     hint: '見方が変わる知識' },
    { id: 'watg_fan',    label: '応援する側',       hint: 'スタジアム、グッズ、仲間' },
  ],
  listening: [
    { id: 'lisg_artist', label: 'アーティストの話', hint: '経歴と、いまの活動' },
    { id: 'lisg_live',   label: 'ライブ・フェス',   hint: '会場の空気、回り方' },
    { id: 'lisg_genre',  label: 'ジャンルを知る',   hint: '成り立ちと、聴きどころ' },
    { id: 'lisg_gear',   label: '聴く道具',         hint: 'イヤホン、配信、音質' },
  ],
  dj: [
    { id: 'djg_set',     label: 'プレイの組み立て', hint: '流れのつくり方' },
    { id: 'djg_gear',    label: '機材の話',         hint: 'つなぎ方、選び方' },
    { id: 'djg_scene',   label: 'クラブシーン',     hint: '街ごとの色、イベント' },
    { id: 'djg_track',   label: '曲の掘り方',       hint: 'どこで見つけるか' },
  ],
  fitness: [
    { id: 'fitg_train',  label: 'トレーニング法',   hint: '種目、回数、休み方' },
    { id: 'fitg_food',   label: '食事と体づくり',   hint: 'たんぱく質、増量、減量' },
    { id: 'fitg_gear',   label: 'ジムと器具',       hint: '選び方、使い方' },
    { id: 'fitg_body',   label: '体の仕組み',       hint: 'なぜそうなるのか' },
  ],
  gaming: [
    { id: 'gamg_title',  label: '作品の紹介',       hint: '何が面白いのか' },
    { id: 'gamg_play',   label: '攻略と上達',       hint: '詰まりどころの越え方' },
    { id: 'gamg_scene',  label: 'e スポーツ',       hint: '大会、選手、観戦' },
    { id: 'gamg_gear',   label: '機材と環境',       hint: '回線、周辺機器、設定' },
  ],
}

/**
 * その分野の話題を返す。**特化した話題 + どこにでもある話題。**
 * 場面(`scenesFor`)とまったく同じ考え方でそろえてある。
 */
export const genresFor = (industry) => {
  const own = GENRES_BY_INDUSTRY[industry] ?? []
  const isHobby = industriesIn('hobby').some((i) => i.id === industry)
  return [...own, ...(isHobby ? COMMON_HOBBY_GENRES : READING_GENRES)]
}

/**
 * その分野の場面を返す。**特化した場面 + どこにでもある場面**(利用者の指定)。
 *
 *   > どの業種でもあるような共通のシチュエーションはそれぞれに
 *   > 入れておいてください。
 *
 * **同じ「朝の進捗共有」でも、出てくる語は業界で変わる。**
 * 特化したものだけに絞ると、いちばんよく使う場面が選べなくなる。
 *
 * 共通の側は**仕事と趣味で別**。仕事の「真面目な会議」を
 * ゴルフに出しても、その人が英語を使う場面にはならない。
 *
 * 登録が無い分野でも、その分け方に合う共通の場面は出る。
 */
export const scenesFor = (industry) => {
  const own = SCENES_BY_INDUSTRY[industry] ?? []
  const isHobby = industriesIn('hobby').some((i) => i.id === industry)
  return [...own, ...(isHobby ? COMMON_HOBBY_SCENES : DIALOGUE_SCENES)]
}

/** すべての場面(名前を引くときに使う)。**同じ表を2つ持たない** */
const ALL_SCENES = [
  ...DIALOGUE_SCENES,
  ...COMMON_HOBBY_SCENES,
  ...Object.values(SCENES_BY_INDUSTRY).flat(),
]
/** すべての話題。名前を引くときに使う */
const ALL_GENRES = [
  ...READING_GENRES,
  ...COMMON_HOBBY_GENRES,
  ...Object.values(GENRES_BY_INDUSTRY).flat(),
]

export const genreLabel = (id) => ALL_GENRES.find((g) => g.id === id)?.label ?? id
export const sceneLabel = (id) => ALL_SCENES.find((s) => s.id === id)?.label ?? id
/** 場面の説明。AI に渡す文言を作るのに使う */
export const sceneHint = (id) => ALL_SCENES.find((s) => s.id === id)?.hint ?? ''
/** 話題の説明。AI に渡す文言を作るのに使う */
export const genreHint = (id) => ALL_GENRES.find((g) => g.id === id)?.hint ?? ''
