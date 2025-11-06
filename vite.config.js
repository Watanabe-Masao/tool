import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // ルートディレクトリ
  root: '.',

  // 公開ディレクトリ
  publicDir: 'public',

  // ビルド設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',

    // ソースマップを生成（デバッグ用）
    sourcemap: true,

    // チャンク分割設定
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // マニュアルチャンク分割
        manualChunks: {
          // Firebaseライブラリを別チャンクに
          'firebase-core': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore'
          ],

          // 統計計算関連を別チャンクに
          'stats': [
            './scripts/yield-stats-calc.js',
            './scripts/yield-stats-helpers.js',
            './scripts/yield-stats-charts.js'
          ],

          // UI関連を別チャンクに
          'ui': [
            './scripts/toast.js',
            './scripts/dom-utils.js',
            './scripts/help-modal.js'
          ]
        },

        // チャンクファイル名のパターン
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },

    // 圧縮設定
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // console.logを削除（本番環境）
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      }
    },

    // チャンクサイズ警告のしきい値
    chunkSizeWarningLimit: 500, // 500KB

    // CSS コード分割
    cssCodeSplit: true
  },

  // 開発サーバー設定
  server: {
    port: 3000,
    open: true,
    cors: true,

    // HMR (Hot Module Replacement)
    hmr: {
      overlay: true
    }
  },

  // プレビューサーバー設定
  preview: {
    port: 4173,
    open: true
  },

  // 最適化設定
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore'
    ]
  },

  // エイリアス設定（オプション）
  resolve: {
    alias: {
      '@': resolve(__dirname, './scripts'),
      '@core': resolve(__dirname, './scripts/core')
    }
  }
});
