-- ============================================================================
-- English AI System — データベースの初期設定
--
-- 【使い方】
--   Supabase の管理画面 → 左メニュー「SQL Editor」→「New query」を開き、
--   このファイルの中身をすべて貼り付けて「Run」を押してください。
--   最後に「Success. No rows returned」と出れば成功です。
--
--   途中で失敗しても、何度でも貼り直して実行できます
--   (すべて「無ければ作る」書き方にしてあります)。
--
-- 【実行時に「Potential issue detected」という警告が出ます】
--   これは正常です。Supabase は「作る」以外の操作が含まれていると
--   一律にこの警告を出します。このファイルに含まれるのは次の3つだけで、
--   いずれも「このファイルが前回作ったものを作り直す」ためのものです。
--
--     drop policy   … このファイルが作る12テーブルのポリシーだけを消す
--     drop trigger  … このファイルが作るトリガー1つだけを消す
--     revoke        … assignments の更新権限を絞る(第8節の説明を参照)
--
--   利用者のデータを消す文(delete / drop table / truncate)は
--   1つも含まれていません。
--
-- 【このファイルが作るもの】
--   ・生徒と講師の情報          profiles / learner_admins
--   ・弱点タグ                  weakness_tags(38件を投入)
--   ・教材                      materials / material_items / material_tags / material_audio
--   ・宿題の配信                assignments
--   ・学習記録と発音練習        study_logs / attempts
--   ・レッスンのフィードバック  lesson_feedback / lesson_feedback_tags
--   ・お手本音声の置き場        Storage バケット material-audio
--   ・上記すべてのアクセス制御  RLS(誰がどの行を読めるか)
--
-- 【重要】RLS について
--   アプリが持つ鍵(publishable key)は公開前提のもので、隠せません。
--   安全性は、この SQL が設定する RLS が担保します。
--   RLS を無効にすると、鍵を持つ誰もが全データを読めるようになります。
--   絶対に無効にしないでください。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 人(生徒と講師)
-- ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'learner' check (role in ('learner', 'admin')),
  industry     text,                       -- NULL = 汎用。職種別の教材を出す場合に使う
  created_at   timestamptz not null default now()
);
comment on table public.profiles is '生徒と講師。auth.users と 1対1。';

-- 講師と生徒の担当関係(多対多にしてある)
create table if not exists public.learner_admins (
  admin_id   uuid not null references public.profiles(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  primary key (admin_id, learner_id)
);

-- サインアップしたら profiles を自動で作る。
-- クライアントから insert させないためのしくみ。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────
-- 2. RLS で使う判定関数
--
--   security definer にしてあるのは、関数の中の SELECT に RLS を
--   かけないため。かかると profiles のポリシーが自分自身を呼び、
--   無限ループになる。
-- ────────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- 自分(講師)が担当している生徒か
create or replace function public.teaches(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.learner_admins
    where admin_id = auth.uid() and learner_id = target
  );
$$;

-- その教材が自分に配信されているか(生徒用)
create or replace function public.is_assigned_material(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments
    where material_id = target and learner_id = auth.uid()
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. 弱点タグ
-- ────────────────────────────────────────────────────────────────

create table if not exists public.weakness_tags (
  id         text primary key,             -- 変更禁止。教材との紐付けに使う
  category   text not null,
  kind       text not null default 'weakness' check (kind in ('weakness', 'drill')),
  label      text not null,                -- 画面表示用。自由に変えてよい
  hint       text,                         -- 取り違え防止の例。AI 生成時にも渡す
  sort_order integer not null default 0
);
comment on column public.weakness_tags.id is '一度使い始めたら変更しない。変えると過去の教材が行方不明になる。';

insert into public.weakness_tags (id, category, kind, label, hint, sort_order) values
  ('l-r', 'consonant', 'weakness', '/l/ と /r/', 'light / right、collect / correct', 0),
  ('s-th', 'consonant', 'weakness', '/s/ と /th/', 'sink / think、mouse / mouth', 10),
  ('b-v', 'consonant', 'weakness', '/b/ と /v/', 'best / vest、boat / vote', 20),
  ('final-consonant', 'consonant', 'weakness', '語尾の子音', '語尾に母音を足さない。book を「ブックゥ」にしない', 30),
  ('consonant-cluster', 'consonant', 'weakness', '子音連続', 'street、texts、asked のように子音が続く形', 40),
  ('all-consonants', 'consonant', 'drill', '全子音の基本練習', '弱点ではなく網羅型の反復ドリル。子音をひととおり通す', 50),
  ('short-long-vowel', 'vowel', 'weakness', '短母音と長母音', 'ship / sheep、full / fool', 60),
  ('schwa', 'vowel', 'weakness', 'あいまい母音', 'about、sofa、banana の弱く読む母音', 70),
  ('word-stress', 'rhythm', 'weakness', '強勢の位置', '単語のどの音節を強く読むか。PREsent / preSENT', 80),
  ('sentence-rhythm', 'rhythm', 'weakness', '文全体のリズム', '強く読む語と弱く読む語の緩急', 90),
  ('linking', 'rhythm', 'weakness', 'リンキング', '音のつながり。an apple、pick it up', 100),
  ('reduction', 'rhythm', 'weakness', '脱落', '消える音。next day の t、want to → wanna', 110),
  ('article', 'grammar', 'weakness', '冠詞', 'a / an / the / 無冠詞の使い分け', 120),
  ('preposition', 'grammar', 'weakness', '前置詞', 'in / on / at / by / for など', 130),
  ('tense', 'grammar', 'weakness', '時制', '現在完了と過去形、進行形、時制の一致', 140),
  ('number-agreement', 'grammar', 'weakness', '単数複数', '名詞の数と動詞の一致。可算・不可算', 150),
  ('quantity', 'grammar', 'weakness', '数の表現', 'much / many / a few / a little / several — 量をあらわす語', 160),
  ('numerals', 'grammar', 'weakness', '数字', '金額・日付・桁・小数・パーセントの読み上げ。ビジネスで必須', 170),
  ('relative-pronoun', 'grammar', 'weakness', '関係代名詞', 'who / which / that、前置詞 + 関係代名詞', 180),
  ('subjunctive', 'grammar', 'weakness', '仮定法', 'If I were / would have など', 190),
  ('comparison', 'grammar', 'weakness', '比較表現', '比較級・最上級、as ... as、the 比較級', 200),
  ('infinitive', 'grammar', 'weakness', 'to不定詞', '名詞的・形容詞的・副詞的用法、動名詞との使い分け', 210),
  ('participial-clause', 'grammar', 'weakness', '分詞構文', 'Walking down the street, I saw ... の形', 220),
  ('participle', 'grammar', 'weakness', '分詞(ing/ed)', '名詞を後ろから修飾する形。the man standing there / the car parked there', 230),
  ('participial-adj', 'grammar', 'weakness', '分詞形容詞', '感情をあらわす形。interesting / interested、boring / bored', 240),
  ('conjunction', 'grammar', 'weakness', '接続詞', 'and / but / although / while / since など', 250),
  ('ellipsis', 'grammar', 'weakness', '省略表現', '会話で落とされる語。Sounds good. / Been there.', 260),
  ('word-order', 'grammar', 'weakness', '語順', '疑問文・間接疑問・副詞の位置', 270),
  ('filler', 'expression', 'weakness', 'つなぎ言葉', 'Well, / Actually, / I mean — 間をつなぐ言い方', 280),
  ('paraphrase', 'expression', 'weakness', '言い換え', '語が出てこないときに別の言い方で伝える', 290),
  ('fixed-phrase', 'expression', 'weakness', '決まり文句', '挨拶、依頼、断り、相づちの定型', 300),
  ('phrasal-verb', 'expression', 'weakness', '句動詞', 'put off / come up with / look into など', 310),
  ('idiom', 'expression', 'weakness', 'イディオム', '直訳できない慣用表現', 320),
  ('collocation', 'expression', 'weakness', 'コロケーション', '語の相性。make a decision(× do a decision)', 330),
  ('hesitation', 'fluency', 'weakness', '言いよどみ', '詰まって止まる、同じ語を繰り返す', 340),
  ('pausing', 'fluency', 'weakness', '間の取り方', '意味の切れ目で区切る。不自然な位置で切らない', 350),
  ('speed', 'fluency', 'weakness', '速さ', '速すぎる / 遅すぎる。一定の速さを保つ', 360),
  ('summarizing', 'fluency', 'weakness', '要約', '要点だけを短くまとめて話す', 370)
on conflict (id) do update set
  category   = excluded.category,
  kind       = excluded.kind,
  label      = excluded.label,
  hint       = excluded.hint,
  sort_order = excluded.sort_order;

-- ────────────────────────────────────────────────────────────────
-- 4. 教材
-- ────────────────────────────────────────────────────────────────

create table if not exists public.materials (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  level          integer not null check (level between 1 and 3),
  kind           text not null check (kind in ('passage', 'word', 'phrase')),
  instruction_ja text,                     -- 取り組み方(音読 / シャドーイング など)
  status         text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  industry       text,
  source         text not null default 'manual',  -- manual / claude-opus-5 など
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);

-- 教材と弱点タグ(多対多)
create table if not exists public.material_tags (
  material_id uuid not null references public.materials(id) on delete cascade,
  tag_id      text not null references public.weakness_tags(id) on delete restrict,
  primary key (material_id, tag_id)
);

-- 教材に含まれる英文。音声を英文単位で持つために分けてある
create table if not exists public.material_items (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  seq         integer not null,
  text_en     text not null,
  text_ja     text,
  note_ja     text,
  unique (material_id, seq)
);

-- 英文 × 話者 ごとのお手本音声(実体は Storage、ここはその場所)
create table if not exists public.material_audio (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.material_items(id) on delete cascade,
  speaker_id  text not null,               -- us-female / us-male / uk-female / uk-male
  storage_path text not null,
  duration_ms integer,
  voice       text,
  created_at  timestamptz not null default now(),
  unique (item_id, speaker_id)
);

-- ────────────────────────────────────────────────────────────────
-- 5. 宿題の配信
-- ────────────────────────────────────────────────────────────────

create table if not exists public.assignments (
  id               uuid primary key default gen_random_uuid(),
  material_id      uuid not null references public.materials(id) on delete cascade,
  learner_id       uuid not null references public.profiles(id) on delete cascade,
  assigned_by      uuid not null references public.profiles(id),
  assigned_at      timestamptz not null default now(),
  due_on           date,
  learner_done_at  timestamptz,            -- 生徒が「やった」を押した日時
  admin_checked_at timestamptz             -- 講師がレッスンで確認した日時
);
create index if not exists assignments_learner_idx on public.assignments (learner_id, assigned_at desc);
create index if not exists assignments_material_idx on public.assignments (material_id);

-- ────────────────────────────────────────────────────────────────
-- 6. 学習記録と発音練習
-- ────────────────────────────────────────────────────────────────

create table if not exists public.study_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  studied_on date not null,
  minutes    integer not null check (minutes >= 0),
  category   text not null,
  material   text,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists study_logs_user_idx on public.study_logs (user_id, studied_on desc);

-- 発音練習の記録。音声そのものは保存しない(端末内に留める)
create table if not exists public.attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  assignment_id   uuid references public.assignments(id) on delete set null,
  item_id         uuid references public.material_items(id) on delete set null,
  target_text     text not null,
  score           numeric,
  recognized_text text,
  engine          text not null default 'mock',  -- mock = シミュレーション値
  attempted_at    timestamptz not null default now()
);
create index if not exists attempts_user_idx on public.attempts (user_id, attempted_at desc);
comment on column public.attempts.engine is 'mock はシミュレーション。実エンジンの値と混ぜて集計しないこと。';

-- ────────────────────────────────────────────────────────────────
-- 7. レッスンのフィードバック(弱点 → 次の教材 の循環の要)
-- ────────────────────────────────────────────────────────────────

create table if not exists public.lesson_feedback (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid not null references public.profiles(id) on delete cascade,
  admin_id      uuid not null references public.profiles(id),
  lesson_on     date not null,
  good_points   text,
  weakness_note text,
  created_at    timestamptz not null default now()
);
create index if not exists lesson_feedback_learner_idx on public.lesson_feedback (learner_id, lesson_on desc);

create table if not exists public.lesson_feedback_tags (
  feedback_id uuid not null references public.lesson_feedback(id) on delete cascade,
  tag_id      text not null references public.weakness_tags(id) on delete restrict,
  primary key (feedback_id, tag_id)
);

-- ────────────────────────────────────────────────────────────────
-- 8. RLS(誰がどの行を読み書きできるか)
--
--   ここが安全性の本体。すべてのテーブルで有効にする。
-- ────────────────────────────────────────────────────────────────

alter table public.profiles             enable row level security;
alter table public.learner_admins       enable row level security;
alter table public.weakness_tags        enable row level security;
alter table public.materials            enable row level security;
alter table public.material_tags        enable row level security;
alter table public.material_items       enable row level security;
alter table public.material_audio       enable row level security;
alter table public.assignments          enable row level security;
alter table public.study_logs           enable row level security;
alter table public.attempts             enable row level security;
alter table public.lesson_feedback      enable row level security;
alter table public.lesson_feedback_tags enable row level security;

-- 何度でも実行できるよう、同名のポリシーがあれば作り直す。
--
-- 消す対象は「このファイルが作る12テーブル」だけに限っている。
-- 同じデータベースに別の用途のテーブルがあっても、それらのポリシーには触れない。
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'learner_admins', 'weakness_tags',
        'materials', 'material_tags', 'material_items', 'material_audio',
        'assignments', 'study_logs', 'attempts',
        'lesson_feedback', 'lesson_feedback_tags'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Storage のポリシーも、このファイルが作る2つだけを名指しで消す
drop policy if exists "音声は配信された生徒と講師だけ" on storage.objects;
drop policy if exists "音声を置けるのは講師だけ" on storage.objects;

-- profiles ------------------------------------------------------
create policy "自分のプロフィールを見る" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "自分のプロフィールを直す" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- INSERT のポリシーは作らない。作成はトリガーのみが行う。

-- learner_admins ------------------------------------------------
create policy "担当関係を見る" on public.learner_admins
  for select to authenticated using (admin_id = auth.uid() or learner_id = auth.uid());
create policy "担当関係は講師だけが決める" on public.learner_admins
  for all to authenticated using (public.is_admin() and admin_id = auth.uid())
  with check (public.is_admin() and admin_id = auth.uid());

-- weakness_tags -------------------------------------------------
create policy "タグは全員が読める" on public.weakness_tags
  for select to authenticated using (true);
create policy "タグを増やせるのは講師だけ" on public.weakness_tags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- materials -----------------------------------------------------
-- 生徒は「自分に配信された教材」だけ見える
create policy "配信された教材だけ見える" on public.materials
  for select to authenticated
  using (public.is_admin() or public.is_assigned_material(id));
create policy "教材を作れるのは講師だけ" on public.materials
  for all to authenticated
  using (public.is_admin() and created_by = auth.uid())
  with check (public.is_admin() and created_by = auth.uid());

-- material_tags / material_items / material_audio ---------------
-- 親の教材が見えるかどうかで決まる
create policy "教材のタグ" on public.material_tags
  for select to authenticated
  using (public.is_admin() or public.is_assigned_material(material_id));
create policy "教材のタグは講師だけ" on public.material_tags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "教材の英文" on public.material_items
  for select to authenticated
  using (public.is_admin() or public.is_assigned_material(material_id));
create policy "教材の英文は講師だけ" on public.material_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "お手本音声" on public.material_audio
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.material_items mi
      where mi.id = item_id and public.is_assigned_material(mi.material_id)
    )
  );
create policy "お手本音声は講師だけ" on public.material_audio
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- assignments ---------------------------------------------------
create policy "自分の宿題を見る" on public.assignments
  for select to authenticated
  using (learner_id = auth.uid() or (public.is_admin() and public.teaches(learner_id)));
create policy "生徒はやった記録だけ更新できる" on public.assignments
  for update to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());
create policy "配信できるのは講師だけ" on public.assignments
  for all to authenticated
  using (public.is_admin() and public.teaches(learner_id))
  with check (public.is_admin() and public.teaches(learner_id) and assigned_by = auth.uid());

-- 生徒が更新してよいのは learner_done_at の列だけ。
-- RLS では列を絞れないので、列単位の権限で絞る。
revoke update on public.assignments from authenticated;
grant update (learner_done_at) on public.assignments to authenticated;

-- study_logs ----------------------------------------------------
create policy "自分の学習記録" on public.study_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "講師は担当生徒の学習記録を見る" on public.study_logs
  for select to authenticated using (public.is_admin() and public.teaches(user_id));

-- attempts ------------------------------------------------------
create policy "自分の発音練習" on public.attempts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "講師は担当生徒の発音練習を見る" on public.attempts
  for select to authenticated using (public.is_admin() and public.teaches(user_id));

-- lesson_feedback -----------------------------------------------
create policy "自分へのフィードバックを見る" on public.lesson_feedback
  for select to authenticated
  using (learner_id = auth.uid() or (public.is_admin() and public.teaches(learner_id)));
create policy "フィードバックを書けるのは講師だけ" on public.lesson_feedback
  for all to authenticated
  using (public.is_admin() and public.teaches(learner_id))
  with check (public.is_admin() and public.teaches(learner_id) and admin_id = auth.uid());

create policy "フィードバックのタグを見る" on public.lesson_feedback_tags
  for select to authenticated
  using (exists (
    select 1 from public.lesson_feedback f
    where f.id = feedback_id
      and (f.learner_id = auth.uid() or (public.is_admin() and public.teaches(f.learner_id)))
  ));
create policy "フィードバックのタグは講師だけ" on public.lesson_feedback_tags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────
-- 9. お手本音声の置き場(Storage)
--
--   音声ファイルは Git リポジトリではなくここに置く。
--   非公開にして、配信された生徒だけが読めるようにする。
-- ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('material-audio', 'material-audio', false)
on conflict (id) do nothing;

create policy "音声は配信された生徒と講師だけ" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material-audio' and (
      public.is_admin() or exists (
        select 1
        from public.material_audio ma
        join public.material_items mi on mi.id = ma.item_id
        where ma.storage_path = name and public.is_assigned_material(mi.material_id)
      )
    )
  );
create policy "音声を置けるのは講師だけ" on storage.objects
  for all to authenticated
  using (bucket_id = 'material-audio' and public.is_admin())
  with check (bucket_id = 'material-audio' and public.is_admin());

-- ============================================================================
-- 完了。
--
-- 【この直後に必ず行うこと】
--   1. アプリからサインアップして、自分のアカウントを作る
--   2. この SQL Editor で次を実行し、自分を講師にする
--        update public.profiles set role = 'admin'
--        where id = (select id from auth.users where email = 'あなたのメールアドレス');
--   3. 生徒のアカウントを作ったら、担当関係を登録する
--        insert into public.learner_admins (admin_id, learner_id)
--        values ('講師のUUID', '生徒のUUID');
--
--   ※ 誰も admin にしないと、教材を1件も作れません。
-- ============================================================================
