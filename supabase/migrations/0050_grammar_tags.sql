-- ============================================================================
-- English AI System — 苦手タグの文法項目を15件足す
--
-- 【なぜ必要か】(2026-09 利用者の指定)
--
--   > ついでに苦手タグの文法項目にまだないもので
--   > 一般的なものがあれば追加してください
--
--   文法の見出しには16件しか無く、**受動態・助動詞・動名詞・文型といった、
--   どの文法書にも見出しがあるものが選べなかった。**
--   中学英語(30日講座)をそのまま乗せられないうえ、
--   レッスンで「受け身が言えていない」と気づいても、
--   その弱点で教材を作れなかった。
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
--   演習の種類・教材の種類とまったく同じ落とし穴である(CLAUDE.md)。
--   `scripts/check-exercise-types.mjs` が、画面と表の食い違いを見張る。
--
-- 【何を消すか】
--   **何も消さない。何も書き換えない。** 既存の16件は1文字も触らない。
--   足すのは15行だけで、**何度実行してもよい**(`on conflict` で上書き)。
--
-- 【貼る前でも壊れない】
--   足したタグを選ばなければ、これまでどおり動く。
--   選んで発行したときだけ止まる(そして、その場でこのファイルを貼れば直る)。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 0. **もとから抜けていた「母音全般」を足す**(2026-09)
--
--    この見張りを作った日に、いちばん最初に赤くなったのがこれである。
--    `all-consonants`(子音全般)は 0001 で入っているのに、
--    **`all-vowels`(母音全般)はどの移行にも無かった。**
--    画面(`weaknessTags.js`)には最初からあるので、
--    **そのタグを付けて教材を発行すると、ずっと止まっていた**ことになる。
--
--    誰も踏まなかったのは、これが `drill`(網羅型の練習)で、
--    弱点の選択肢には出ないタグだからである。
--    **見張りが無ければ、踏むまで分からなかった。**
-- ────────────────────────────────────────────────────────────────
insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('all-vowels',       'pronunciation', 'drill', '母音全般',
   '特定の音ではなく、母音をひととおり通す網羅型の練習', 75)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;

-- ────────────────────────────────────────────────────────────────
-- 1. 文法の項目を15件足す
-- ────────────────────────────────────────────────────────────────
insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('sentence-pattern', 'grammar', 'weakness', '文型(SVOC)',
   'S / V / O / C の並び。「誰が どうする 何を」の骨組み', 500),
  ('passive',          'grammar', 'weakness', '受動態',
   'be + 過去分詞。誰がしたかを言わずに済ませる形', 501),
  ('modal',            'grammar', 'weakness', '助動詞',
   'can / will / must / should / may。丁寧さと確信の強さが変わる', 502),
  ('gerund',           'grammar', 'weakness', '動名詞',
   '-ing を名詞として使う形。enjoy -ing / want to do の使い分け', 503),
  ('relative-adverb',  'grammar', 'weakness', '関係副詞',
   'where / when / why / how。関係代名詞との違い', 504),
  ('pronoun',          'grammar', 'weakness', '代名詞',
   'it / they / one / this。何を指しているかが相手に伝わるか', 505),
  ('causative',        'grammar', 'weakness', '使役・知覚動詞',
   'make / let / have + 原形、see / hear + O + doing', 506),
  ('reported-speech',  'grammar', 'weakness', '話法',
   '「彼はこう言った」。時制と語順の移し方', 507),
  ('negation',         'grammar', 'weakness', '否定',
   'not / no / never / hardly。部分否定と全体否定', 508),
  ('emphasis',         'grammar', 'weakness', '強調・倒置',
   'It is 〜 that、do + 原形、Never have I 〜', 509),
  ('adverb-form',      'grammar', 'weakness', '形容詞と副詞',
   'good / well、hard / hardly。どちらの形を使うか', 510),
  ('future',           'grammar', 'weakness', '未来の言い方',
   'will / be going to / 現在進行形。決まっている予定かどうか', 511),
  ('there-is',         'grammar', 'weakness', 'there の文',
   'There is / are。「〜がある」を主語を立てずに言う形', 512),
  ('imperative',       'grammar', 'weakness', '命令文・依頼',
   'Do 〜 / Please 〜 / Could you 〜。頼み方の強さ', 513),
  ('time-clause',      'grammar', 'weakness', '時・条件の節',
   'When / If の中では、未来のことも現在形で言う', 514)
on conflict (id) do update
  set category = excluded.category,
      kind     = excluded.kind,
      label    = excluded.label,
      hint     = excluded.hint;
