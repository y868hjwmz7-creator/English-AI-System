-- ============================================================================
-- English AI System — 苦手タグの「表現」に「丁寧な言い回し」を足す
--
-- 【なぜ必要か】(2026-09 利用者の指定)
--
--   > 弱点タグの「表現」内に「丁寧な言い回し」を追加してください。
--   > つまり、ビジネスで使用する丁寧な言い回しを網羅するためのタグとします。
--   > 例えば、I was wondering if you could 〜、Do you mind 〜ing? ,
--   > Do you mind if I 〜 ? Could you possibly do 〜? などなどです
--
--   仕事の英語でいちばん事故が起きるのは、**言えないこと**ではなく
--   **言い方がぶっきらぼうになること**である。
--
--     Send me the file.                      ← 通じるが、命令に聞こえる
--     Could you send me the file?            ← ふつう
--     I was wondering if you could send 〜    ← 相手に断る余地を残す
--
--   同じ依頼でも、丁寧さの段が違えば相手の受け取り方がまるで変わる。
--   ところが**この段そのものを指すタグが無かった。**
--
-- 【なぜ、いまあるタグでは足りないか】
--
--   `fixed-phrase`(決まり文句)は「挨拶・依頼・断り・相づちの**定型を
--   知っているか**」で、**形を覚えているかどうか**の話である。
--   こちらは「**その場に合う丁寧さで言えるか**」で、軸が違う ——
--   `Do you mind if I 〜?` を知っていても、使いどころを外せば同じことになる。
--
--   **似たタグを2つ作らない**(CLAUDE.md)ので、重ならないところだけを
--   足してある。`sort_order` は 335 —— `collocation`(330)のすぐ後ろ、
--   `hesitation`(340・なめらかさ)の手前で、**表現の並びの中**に入る。
--
-- 【なぜ SQL が要るか — いちばん大事なところ】
--
--   弱点タグは**画面(`src/data/weaknessTags.js`)と表の2か所**にある。
--   しかも `material_tags.tag_id` は `weakness_tags(id)` を参照している。
--
--     tag_id text not null references public.weakness_tags(id)
--
--   だから**このファイルを貼る前に新しいタグで教材を発行すると、
--   その瞬間に外部キー違反で止まる。**
--   0050・0052・0060 とまったく同じ落とし穴である(CLAUDE.md)。
--   `scripts/check-exercise-types.mjs` が、画面と表の食い違いを見張る。
--
-- 【巻末のレクチャーとつながっている】
--   `src/data/sentenceFrames.js` の ③「やわらげる・提案する(仕事で効く)」が
--   そのままこの型である(It might be worth 〜ing / I was wondering if
--   you could 〜 / Would it be possible to 〜 / We may want to 〜 /
--   What if we 〜)。紙で見つけて、このタグで練習に回せる。
--
-- 【何を消すか】
--   **何も消さない。何も書き換えない。** 既存のタグは1文字も触らない。
--   足すのは1行だけで、**何度実行してもよい**(`on conflict` で上書き)。
--
-- 【貼る前でも壊れない】
--   足したタグを選ばなければ、これまでどおり動く。
--   選んで発行したときだけ止まる(そして、その場でこのファイルを貼れば直る)。
-- ============================================================================

insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('polite-phrasing', 'expression', 'weakness', '丁寧な言い回し',
   'ビジネスの丁寧さ。I was wondering if you could 〜 / Do you mind 〜ing? / Could you possibly 〜?',
   335)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;
