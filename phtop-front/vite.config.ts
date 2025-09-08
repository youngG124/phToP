import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발용 프록시: Vite(5173) → Express(3021)
// 배포 시에는 Nginx에서 /api, /d만 백엔드로 프록시 처리
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 같은 LAN/아이폰에서 접속 테스트할 때 유용
    proxy: {
      '/api': 'http://localhost:3021',
      '/d': 'http://localhost:3021',
    },
  },
})
