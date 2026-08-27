/**
 * 「ビルドは通るのに、開くと落ちる」を防ぐための最小限の検査。
 *
 * import を書き忘れても Vite のビルドは成功してしまう。
 * 実際に App.jsx で TrainerMaterials の import が抜けたまま
 * ビルドが通り、画面を開いて初めて分かる状態になった(2026-08)。
 *
 * ここでは「存在しない名前を使っていないか」だけを見る。
 * 書き方の好みは対象にしない。増やすなら、実際に事故が起きたものだけ。
 */

// ブラウザと Node が用意している名前。これらは「未定義」ではない。
const browserGlobals = Object.fromEntries(
  [
    'window', 'document', 'navigator', 'console', 'fetch', 'URL', 'Blob', 'File',
    'FileReader', 'FormData', 'Headers', 'Request', 'Response', 'AbortController',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
    'cancelAnimationFrame', 'localStorage', 'sessionStorage', 'indexedDB', 'IDBKeyRange',
    'AudioContext', 'webkitAudioContext', 'MediaRecorder', 'SpeechSynthesisUtterance',
    'speechSynthesis', 'SpeechRecognition', 'webkitSpeechRecognition', 'Audio',
    'Float32Array', 'Int16Array', 'Uint8Array', 'DataView', 'TextEncoder', 'TextDecoder',
    'performance', 'crypto', 'alert', 'confirm', 'CustomEvent', 'Event', 'Image',
    'process', 'Deno', 'structuredClone', 'queueMicrotask', 'btoa', 'atob',
    'location', 'history', 'Buffer', 'CustomEvent', 'MediaStream', 'AbortSignal',
  ].map((name) => [name, 'readonly']),
)

export default [
  {
    files: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: browserGlobals,
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      // 本題。存在しない名前を使っていたら止める。
      'no-undef': 'error',
      // 使っていない import は、消し忘れか書き間違いのどちらか
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      // 実際に事故になりやすいもの
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-compare': 'error',
    },
  },
]
