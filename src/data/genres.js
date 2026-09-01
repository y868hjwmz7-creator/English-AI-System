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
 * その分野の場面を返す。**登録が無ければ「仕事全般」に落ちる**ので、
 * 分野を足して場面を足し忘れても壊れない。
 */
export const scenesFor = (industry) => SCENES_BY_INDUSTRY[industry] ?? DIALOGUE_SCENES

/** すべての場面(名前を引くときに使う)。**同じ表を2つ持たない** */
const ALL_SCENES = [
  ...DIALOGUE_SCENES,
  ...Object.values(SCENES_BY_INDUSTRY).flat(),
]

export const genreLabel = (id) => READING_GENRES.find((g) => g.id === id)?.label ?? id
export const sceneLabel = (id) => ALL_SCENES.find((s) => s.id === id)?.label ?? id
/** 場面の説明。AI に渡す文言を作るのに使う */
export const sceneHint = (id) => ALL_SCENES.find((s) => s.id === id)?.hint ?? ''
