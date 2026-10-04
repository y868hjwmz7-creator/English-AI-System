-- ════════════════════════════════════════════════════════════════
-- 0075 英文の台帳に「設問(question)」も積む
--
-- 【何が起きていたか】(2026-10-04 利用者の指摘)
--
--     あと、試験なだけに同じ問題を何度も出さないようお願いします
--
--   0008 で作った英文の台帳(`material_sentences`)は、
--   設問1つにつき **`prompt_en` / `audio_text` / `answer` / `text_en`**
--   の4つの欄だけを積んでいました。**`question` が入っていません。**
--
--   ところが、えらべる 78 PART のうち **21 PART は、英文の欄が
--   `question` しかありません**(英検の英作文・TOEIC Speaking の
--   応答問題と意見・VERSANT Part F など)。
--   そのため第5.354節の「絶対に同じ設問は作らない」が、
--   **その 21 PART ではまるごと働いていませんでした。**
--
-- 【何が起きるか】
--   ・台帳に積む欄に `question` を1つ足します
--   ・**すでにある教材のぶんも、まとめて積み直します**
--     (いままで積まれていなかった設問が、ここで台帳に入ります)
--   ・そのあとに作る教材は、**前に出した設問と同じものを避けます**
--
-- 【どこまで影響するか】
--   ・**教材・宿題・ゲストの情報・音声には、いっさい触れません**
--   ・消えるものは1つもありません。台帳に行が増えるだけです
--   ・**何度貼っても同じ結果**になります
--
-- 【成功の目安】
--   `Success. No rows returned` と出れば成功です。
--
-- **返す型を変えていなくても drop を置く**(CLAUDE.md)——
-- あとで誰かが返すものを変えるかもしれない。
-- トリガーは関数を使っているので、**先にトリガーを外します。**
-- ════════════════════════════════════════════════════════════════

drop trigger if exists material_items_sentences on public.material_items;
drop function if exists public.sync_material_sentences();

-- ────────────────────────────────────────────────────────────────
-- **積む欄の一覧は、ここ1か所**(第5.368節)
--
--   0008 はトリガーの中に欄を**2回**書いていた(積むところと、
--   消えた英文を外すところ)。**片方だけ直せば、必ず食い違う**
--   (CLAUDE.md「数え方を2通り持たない」)。
--
--   だから一覧を関数にして、**トリガーの両方がこれを読む。**
--   貼ったかどうかも、アプリと `supabase/apply/check.sql` が
--   **この同じ関数に訊く** —— 表も列も増えない移行なので、
--   「表が在るか」では見分けられない(0071 とまったく同じ立て付け)。
--   **読むだけ**なので、訊いても何も書き換わらない。
-- ────────────────────────────────────────────────────────────────
drop function if exists public.ledger_fields();

create or replace function public.ledger_fields()
returns setof text language sql immutable as $$
  select unnest(array[
    'prompt_en',    -- 提示文(読んで答える)
    'audio_text',   -- 読み上げ文(聞いて答える)
    'answer',       -- 解答
    'question',     -- ★ 設問(0075)。内容理解・ディスカッション・想定される質問
    'text_en'       -- 0001 の古い列。移行中の教材のため
  ]);
$$;

comment on function public.ledger_fields() is
  '英文の台帳に積む欄の一覧(0075)。トリガーも、貼ったかどうかの確認も、これを読む';

-- ────────────────────────────────────────────────────────────────
-- 設問が入ったら台帳に積む(欄は上の一覧から読む)
-- ────────────────────────────────────────────────────────────────
create or replace function public.sync_material_sentences()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_material uuid;
begin
  v_material := coalesce(new.material_id, old.material_id);

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.material_sentences (material_id, text_norm)
    select v_material, public.norm_en(to_jsonb(new) ->> f)
    from public.ledger_fields() as f
    where public.norm_en(to_jsonb(new) ->> f) is not null
    on conflict do nothing;
  end if;

  -- 設問が消された/書き換えられた場合、どこからも参照されなくなった
  -- 英文は台帳から外す。残すと、実在しない文で新しい教材を弾いてしまう。
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.material_sentences ms
    where ms.material_id = v_material
      and not exists (
        select 1
        from public.material_items mi, public.ledger_fields() as f
        where mi.material_id = v_material
          and ms.text_norm = public.norm_en(to_jsonb(mi) ->> f)
      );
  end if;

  return null;
end;
$$;

drop trigger if exists material_items_sentences on public.material_items;
create trigger material_items_sentences
  after insert or update or delete on public.material_items
  for each row execute function public.sync_material_sentences();

-- ────────────────────────────────────────────────────────────────
-- **すでにある教材のぶんを積み直す。** 何度実行しても同じ結果になる
-- (`on conflict do nothing`)。0008 と同じやり方だが、
-- **欄は上の一覧から読む**ので、欄を足した日に書き足さなくて済む。
-- ────────────────────────────────────────────────────────────────
insert into public.material_sentences (material_id, text_norm)
select mi.material_id, public.norm_en(to_jsonb(mi) ->> f)
from public.material_items mi, public.ledger_fields() as f
where public.norm_en(to_jsonb(mi) ->> f) is not null
on conflict do nothing;
