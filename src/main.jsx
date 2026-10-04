import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { motionVars } from './lib/motion.js'
import { startOffline } from './lib/offline.js'

/* ★ **動きの長さと曲線を、描く前に流し込む**(第5.371節)。

     **数は `motion.js` 1か所にしか無い。** `styles.css` は
     `var(--motion-tap)` のように読むだけで、ミリ秒を1つも持たない
     —— 押し心地を変えたい日に、2か所を直さなくて済む
     (CLAUDE.md「呼び名・色・幅を2か所に書かない」と同じ話)。

     **描く前に入れる。** `useEffect` では最初の描画に間に合わず、
     開いた瞬間だけ動きが無い、という食い違いが出る。

     変数が無ければ `transition` は**成り立たない = 動かない**だけで、
     画面は何も壊れない(**黙って落ちない**・CLAUDE.md)。 */
for (const [k, v] of Object.entries(motionVars())) {
  document.documentElement.style.setProperty(k, v)
}

/* ★ **オフラインで開けるようにする**(第5.372節)。

     登録に失敗しても、**アプリは何も変わらない**(控えが無いだけ)。
     新しい版が控えたら、`window` に合図を出す ——
     画面はそれを拾って「読み込み直す」を出す
     (**勝手に入れ替えない。** 開いている最中に落ちることがある)。

     **開発中(`npm run dev`)では登録しない。** 古い枠を掴むと、
     直したものが届かなくなる(判断は `swPlan.js` の `canRegister()`)。 */
startOffline((waiting) => {
  if (waiting) window.dispatchEvent(new CustomEvent('app-update-ready'))
})

// ここがアプリの入口です。index.html の <div id="root"> の中に App を描画します。
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
