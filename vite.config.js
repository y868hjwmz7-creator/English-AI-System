import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

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

export default defineConfig({
  // GitHub Pages はリポジトリ名のフォルダ配下で配信されるため、その分の指定
  base: isSingleFile ? './' : process.env.BASE_PATH || '/',
  plugins: [react(), ...(isSingleFile ? [viteSingleFile()] : [])],
  build: {
    outDir: isSingleFile ? 'standalone' : 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: false,
  },
})
