-- ============================================================================
-- 0064 教材に「どの冊の、第何 UNIT か」を控える
--
-- 【なぜ要るか】(2026-09 利用者の指定)
--
--   > 教材のアサインのページから Conversation1、2、3、
--   > Business Conversation 1、2 をアサインできるようにしてください。
--   > UNIT ごと、丸ごと、それぞれお願いします。UNIT 毎の場合はプルダウンで
--
--   RIZAP ENGLISH の教材は **5冊 × 各 18 UNIT ほど**になる。
--   アサインの画面で「この冊の UNIT 3 だけ」「この冊を丸ごと」を選ぶには、
--   **どの教材がどの冊の第何 UNIT か**が分かっていなければならない。
--
-- 【題名から読み取らない】
--
--   題名は `RIZAP ENGLISH / Conversation 1 — UNIT 1 Booking a Bus` の形だが、
--   **題名を切り分けて冊と番号を取り出すのは、壊れやすい。**
--   題を1文字直しただけで並びが崩れ、しかも**画面を開くまで分からない**。
--   欄を2つ持てば、**並べ替えも絞り込みもデータベースに任せられる。**
--
-- 【何が起きるか】
--   `materials` に **`series`(冊の id)と `unit_no`(UNIT の番号)**の
--   2列が増えます。**既存の教材はどちらも空のまま**で、
--   これまでどおり動きます。何度貼っても同じ結果になります。
--
-- 【どこまで影響するか】
--   宿題・単語帳・ゲストの情報・取り組みの記録には触れません。
--   RLS(見える範囲の決まり)も変えません。
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
-- ============================================================================

alter table public.materials
  add column if not exists series  text,
  add column if not exists unit_no integer;

comment on column public.materials.series is
  'まとまった冊の id(0064)。RIZAP ENGLISH なら rizap-c1 など。'
  '**画面に出す名前は src/data/rizapBooks.js 1か所**が持つ(ここには書かない)';
comment on column public.materials.unit_no is
  'その冊の中の UNIT 番号(0064)。1 から始まる。冊に属さない教材は空';

-- **同じ冊の中で、UNIT 番号が重ならないようにする。**
-- 重なると、アサインのプルダウンに同じ番号が2つ並び、
-- **どちらを出したのか分からなくなる**(行き止まり)。
-- 冊に属さない教材(どちらも空)は、この決まりの外に置く
drop index if exists materials_series_unit_idx;
create unique index if not exists materials_series_unit_idx
  on public.materials (series, unit_no)
  where series is not null and unit_no is not null;

-- 冊ごとに UNIT 順で読むための並び
create index if not exists materials_series_idx
  on public.materials (series, unit_no)
  where series is not null;
