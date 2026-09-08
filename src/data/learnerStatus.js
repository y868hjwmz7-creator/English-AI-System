/**
 * ゲストの状態(受講中 / 休会中 / 退会済)の呼び名と、札の色。
 *
 * **対応表を2か所に持たない**(CLAUDE.md)。
 * `TrainerLearners.jsx` の中に書いてあったが、
 * **上に貼り付くゲスト名の箱**(`LearnerBar.jsx`)でも同じ札を出すので、
 * ここへ出した。**読む側は1行も変わっていない。**
 *
 * **`profiles.status` の値(英語)は変えない。**
 * 変えるのは画面に出す言葉だけである。
 */
export const LEARNER_STATUS = {
  active: { label: '受講中', cls: 'badge--admin' },
  paused: { label: '休会中', cls: 'badge--warn' },
  inactive: { label: '退会済', cls: 'badge--learner' },
}

/** 画面に出す言葉。**知らない値は、そのまま出す**(黙って消さない) */
export const statusLabel = (id) => LEARNER_STATUS[id]?.label ?? String(id ?? '')

/** 札の色。知らない値には付けない */
export const statusCls = (id) => LEARNER_STATUS[id]?.cls ?? ''
