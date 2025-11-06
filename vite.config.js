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
        // マニュアルチャンク分割（CDNからFirebaseを読み込むため、Firebaseは除外）
        manualChunks(id) {
          // node_modules を vendor チャンクに
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // 統計計算関連モジュール
          if (id.includes('/yield-stats-')) {
            return 'stats';
          }

          // 複数パターンUI関連モジュール
          if (id.includes('/multi-pattern-')) {
            return 'multi-pattern';
          }

          // データベース関連モジュール
          if (id.includes('/db/')) {
            return 'database';
          }

          // Firebase同期関連モジュール
          if (id.includes('/firebase-sync/')) {
            return 'firebase-sync';
          }

          // UI ユーティリティ
          if (id.includes('/toast.js') || id.includes('/dom-utils.js') || id.includes('/help-modal.js')) {
            return 'ui-utils';
          }
        },

        // チャンクファイル名のパターン
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },

    // 圧縮設定（esbuild は Vite に組み込まれているため、追加インストール不要）
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'], // console.log と debugger を削除（本番環境）
      pure: ['console.log', 'console.info']
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
    // Firebase は CDN から読み込むため、ここには含めない
    include: []
  },

  // エイリアス設定（オプション）
  resolve: {
    alias: {
      '@': resolve(__dirname, './scripts'),
      '@core': resolve(__dirname, './scripts/core')
    }
  }
});
