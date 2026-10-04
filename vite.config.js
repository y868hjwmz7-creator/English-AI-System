import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { build as esbuild } from 'esbuild'

/**
 * Vite の設定ファイル。npm run dev / build のときに読み込まれます。
 *
 * ビルドの出し方が2種類あります。
 *
 *  1. 通常ビルド  … npm run build
 *     dist/ に出力。GitHub Pages などのウェブサーバーに置く用。
 *     ※マイク録音を使うには https:// で配信する必要があるため、こちらが本命。
 *
 *  2. 1ファイル版 … npm run build:single
 *     standalone/index.html に、HTML・CSS・JavaScript を全部詰め込んだ
 *     1個のファイルとして出力。ダウンロードしてダブルクリックするだけで開けます。
 *     インストール作業が一切できない環境で画面を確認したいとき用。
 *     ※ブラウザの決まりで、ファイルを直接開いた場合(file://)はマイクが使えません。
 */
const isSingleFile = process.env.BUILD_SINGLE === '1'

/**
 * **Service Worker を1本に束ねる**(第5.372節・オフラインで開ける)。
 *
 * `src/sw.js` は `src/lib/swPlan.js`(どの URL をどう扱うか)を取り込む。
 * Vite の入口にすると**名前に指紋が付いてしまい**、置き場所が毎回変わって
 * Service Worker として登録できない。だから **esbuild で `dist/sw.js` に
 * そのままの名前で出す。**
 *
 * **こうしないと、決まりを2か所に書くことになる**
 * (`public/sw.js` に手で写す = CLAUDE.md「数え方を2通り持たない」)。
 *
 * **1ファイル版では作らない** —— `file://` では Service Worker が動かない。
 */
function swPlugin() {
  return {
    name: 'sw-bundle',
    apply: 'build',
    async closeBundle() {
      if (isSingleFile) return
      await esbuild({
        entryPoints: ['src/sw.js'],
        outfile: 'dist/sw.js',
        bundle: true,
        format: 'iife',
        target: 'es2020',
        /* **版をそのまま差し込む。** 版が変われば控えの名前も変わる */
        define: { __SW_STAMP__: JSON.stringify(process.env.VITE_BUILD_STAMP || 'dev') },
        legalComments: 'none',
        /* ★ **日本語をそのまま出す。** 既定だと `\u691C` のように
             逃がされ、**版が文字として読めなくなる**(検証で踏んだ) */
        charset: 'utf8',
      })
    },
  }
}

export default defineConfig({
  // GitHub Pages はリポジトリ名のフォルダ配下で配信されるため、その分の指定
  base: isSingleFile ? './' : process.env.BASE_PATH || '/',
  plugins: [react(), ...(isSingleFile ? [viteSingleFile()] : [swPlugin()])],
  build: {
    outDir: isSingleFile ? 'standalone' : 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: false,
  },
})
