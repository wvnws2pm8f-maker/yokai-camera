import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' にしておくと GitHub Pages のどんなリポジトリ名/サブパスに
// デプロイしても相対パスで動く（御蔵島図鑑・マニアスタジアムと同じ方針）
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '妖怪カメラ',
        short_name: '妖怪カメラ',
        description: '写真を撮ると、その土地にちなんだ妖怪が写り込む、じぶんだけの妖怪図鑑',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1a1230',
        theme_color: '#4a2e6b',
        lang: 'ja',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // 撮影した写真・図鑑データはIndexedDB側で管理するので、SWは
        // アプリ本体(JS/CSS/HTML/画像アセット/妖怪マスターデータ)だけをキャッシュすればよい
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ]
})
