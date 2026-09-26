/**
 * セッションの記録(メモ)の出し入れ(0032)。
 *
 * 2026-09 利用者の指定:
 *   > トレーニング中、または個々のゲストの情報内でセッションに関する記録や
 *   > メモをするためのフリーボード、例えばワードのようなものを呼び出せると
 *   > 嬉しいですね。それはカレンダーと同期して呼び出せるものだと嬉しいです。
 *
 * 【日付ごとに1枚】
 *   レッスンはその日に1回である。だから「ゲスト × 日付」で1行
 *   (`vocab_days` / `practice_days` と同じ考え方)。
 *   カレンダーと結び付けるのに、これがいちばん素直な形になる。
 *
 * 【誰が書けるか】(2026-09 利用者の判断)
 *   書けるのは**いま担当しているトレーナー(と管理者)だけ**、
 *   **ゲスト本人は読める。** 決まりは 0032 の RLS に置いてあり、
 *   画面はそれに合わせて出し分けるだけである
 *   (**役割の判定を2か所に置かない**・CLAUDE.md)。
 *
 * 【空にしたら、行ごと消す】
 *   カレンダーは「書いてある日」に印を付ける。空の行を残すと、
 *   **中身の無い日に印が付く。** 押しても何も無い目に遭わせない。
 *
 * **例外を外に出さない。** 必ず `{ data, error }` の形で返す
 * (`supabase.js` の決まり)。
 */
import { supabase, withTimeout, TIMEOUT_MARK } from './supabase.js'

const TABLE = 'lesson_notes'

const fail = (e) => {
  const m = String(e?.message ?? e ?? '')
  if (m === TIMEOUT_MARK) return '時間内に返事がありませんでした。通信を確かめてください'
  if (/failed to fetch|load failed|networkerror/i.test(m)) {
    return 'サーバーに届きませんでした。通信を確かめてください'
  }
  if (/relation .* does not exist|42P01|schema cache/i.test(m)) {
    return 'メモの置き場がまだ用意されていません(0032 の SQL を貼ってください)'
  }
  if (/row-level security|violates row-level/i.test(m)) {
    return 'このゲストのメモは書けません(担当しているゲストだけ書けます)'
  }
  return m || '失敗しました'
}

/** その日の1枚を読む。**無い日は空で返す**(まだ書いていないだけである) */
export async function loadNote(learnerId, dateKey) {
  if (!supabase || !learnerId || !dateKey) return { data: null, error: null }
  try {
    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .select('id, learner_id, on_date, body, learner_body, updated_by, updated_at')
        .eq('learner_id', learnerId)
        .eq('on_date', dateKey)
        .maybeSingle(),
    )
    if (error) return { data: null, error: fail(error) }
    return { data: data ?? null, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}

/**
 * 書いてある日の一覧(カレンダーの印)。
 * **空の日は入らない**(空にしたときは行ごと消しているため)。
 */
export async function loadNoteDays(learnerId) {
  if (!supabase || !learnerId) return { data: [], error: null }
  try {
    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .select('on_date')
        .eq('learner_id', learnerId)
        .order('on_date', { ascending: false })
        .limit(400),
    )
    if (error) return { data: [], error: fail(error) }
    return { data: (data ?? []).map((r) => String(r.on_date).slice(0, 10)), error: null }
  } catch (e) {
    return { data: [], error: fail(e) }
  }
}

/**
 * その日の1枚を書く。**同じ日に2枚作らない**(0032 の unique に合わせて
 * `upsert`)。空にしたときは**行ごと消す。**
 *
 * `updated_at` は送らない。**端末の時計で決めない**(DB の trigger が入れる)。
 */
export async function saveNote({ learnerId, dateKey, body, updatedBy }) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  if (!learnerId || !dateKey) return { data: null, error: 'どの日の記録か分かりません' }
  const text = String(body ?? '')
  try {
    if (!text.trim()) {
      /* ── **ゲストの欄が残っていたら、行ごと消さない**(第5.267節)──
           0070 で `learner_body`(ゲストの記録)が増えた。
           これまでどおり行ごと消すと、**トレーナーが自分の欄を空にした
           だけで、ゲストの書いたものまで消える。**
           **黙って消さない**(CLAUDE.md)。

           **読んでから決める。** 「空なら消す」を画面側に書かせない ——
           置く場所の数だけ食い違う(判断は1か所)。 */
      const { data: now, error: readError } = await withTimeout(
        supabase.from(TABLE).select('learner_body')
          .eq('learner_id', learnerId).eq('on_date', dateKey).maybeSingle(),
      )
      if (readError) return { data: null, error: fail(readError) }
      if (String(now?.learner_body ?? '').trim()) {
        /* ゲストの欄は残す。**トレーナーの欄だけを空にする** */
        const { error } = await withTimeout(
          supabase.from(TABLE).update({ body: '', updated_by: updatedBy ?? null })
            .eq('learner_id', learnerId).eq('on_date', dateKey),
        )
        if (error) return { data: null, error: fail(error) }
        return { data: null, error: null }
      }
      const { error } = await withTimeout(
        supabase.from(TABLE).delete()
          .eq('learner_id', learnerId).eq('on_date', dateKey),
      )
      if (error) return { data: null, error: fail(error) }
      return { data: null, error: null }
    }
    const { data, error } = await withTimeout(
      supabase.from(TABLE)
        .upsert({
          learner_id: learnerId,
          on_date: dateKey,
          body: text,
          updated_by: updatedBy ?? null,
        }, { onConflict: 'learner_id,on_date' })
        .select('id, learner_id, on_date, body, learner_body, updated_by, updated_at')
        .single(),
    )
    if (error) return { data: null, error: fail(error) }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}

/**
 * ============================================================================
 * **ゲストが、自分の欄だけを書く**(0070・第5.267節)
 *
 * 2026-09-26 利用者の指定。
 *
 *   > ゲストログインしたさいの「セッションの記録」を、
 *   > ゲストも入力、編集できるようにしたいです。
 *   > 同時に書いても大丈夫なようにしてください。
 *
 * **トレーナーの欄(`body`)には触らない。** だから同時に書いても、
 * どちらも消えない。
 *
 * **`upsert` ではなく関数を呼ぶ。** 0032 の RLS は
 * 「書けるのは担当トレーナーと管理者だけ」なので、
 * ゲストの `update` はそのまま断られる。
 * **列ごとの権限ではトレーナーとゲストを分けられない**
 * (CLAUDE.md「RLS は『行』しか絞れない」)ので、
 * `set_learner_note()` が**自分の行の `learner_body` だけ**を書き換える。
 *
 * 誰の記録かは**渡さない。** 窓口(関数)の中で `auth.uid()` から決まるので、
 * ほかの人の記録に書きようがない。
 * ============================================================================
 */
export async function saveLearnerNote({ dateKey, body }) {
  if (!supabase) return { data: null, error: 'Supabase に接続していません' }
  if (!dateKey) return { data: null, error: 'どの日の記録か分かりません' }
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('set_learner_note', { p_on_date: dateKey, p_body: String(body ?? '') }),
    )
    if (error) return { data: null, error: fail(error) }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: fail(e) }
  }
}
