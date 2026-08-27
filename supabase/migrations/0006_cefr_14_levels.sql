-- ============================================================================
-- English AI System — レベルの段階をスクールの区分(14段階)に合わせる
--
-- 【これは何か】
--   0005 で入れた CEFR の6段階を、スクールで実際に使っている
--   14段階に置き換えます。0005 の追加変更です。
--
--   Pre-Basic / Basic / A1 / A1+ / A2 / A2+ / B1 / B1+ / B2 / B2+ /
--   C1 / C1+ / C2 / Proficiency
--
-- 【既存のデータの扱い】
--   0005 で入れた A1〜C2 はそのまま有効です。移し替えは要りません。
--   増えるのは Pre-Basic / Basic / 各「+」/ Proficiency の8段階。
-- ============================================================================

-- 生徒のレベル
alter table public.profiles drop constraint if exists profiles_cefr_check;
alter table public.profiles
  add constraint profiles_cefr_check check (
    cefr is null or cefr in (
      'Pre-Basic', 'Basic',
      'A1', 'A1+', 'A2', 'A2+',
      'B1', 'B1+', 'B2', 'B2+',
      'C1', 'C1+', 'C2',
      'Proficiency'
    )
  );

comment on column public.profiles.cefr is
  'スクールのレベル区分(14段階)。CEFR を基に、間の段階を + で表す。'
  'Pre-Basic / Basic / A1 / A1+ / A2 / A2+ / B1 / B1+ / B2 / B2+ / C1 / C1+ / C2 / Proficiency';

-- 教材のレベル。生徒と同じ物差しにそろえる。
alter table public.materials drop constraint if exists materials_level_check;
alter table public.materials
  add constraint materials_level_check check (
    level in (
      'Pre-Basic', 'Basic',
      'A1', 'A1+', 'A2', 'A2+',
      'B1', 'B1+', 'B2', 'B2+',
      'C1', 'C1+', 'C2',
      'Proficiency'
    )
  );

comment on column public.materials.level is
  '教材のレベル。生徒の cefr と同じ14段階を使う。'
  '物差しを分けると、トレーナーが頭の中で変換することになり判断が鈍る。';

-- ============================================================================
-- 完了。0005 で登録済みの A1〜C2 はそのまま使えます。
-- ============================================================================
