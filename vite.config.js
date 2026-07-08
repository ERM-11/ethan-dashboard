import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "Ethan's Dashboard",
        short_name: 'Dashboard',
        description: 'Personal dashboard with weather, stocks, news, and study tools',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        orientation: 'any',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(api|air-quality-api)\.open-meteo\.com\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'open-meteo', expiration: { maxAgeSeconds: 900 } }
          },
          {
            urlPattern: /\/api\/proxy/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-proxy', networkTimeoutSeconds: 10, expiration: { maxAgeSeconds: 900 } }
          },
          {
            urlPattern: /^https:\/\/(api\.allorigins\.win|api\.codetabs\.com|corsproxy\.io)\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'proxied', networkTimeoutSeconds: 10, expiration: { maxAgeSeconds: 900 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxAgeSeconds: 2592000 } }
          }
        ]
      }
    })
  ]
})
