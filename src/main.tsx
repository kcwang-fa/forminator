import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SignPage from './components/signature/SignPage.tsx'

// 路徑分流（這個專案沒有 react-router，只有兩頁所以直接看 pathname）：
//   /sign → 手機簽名頁（QR 掃進來的，輕量、不載入 wizard 表單）
//   其他  → 主應用
// vercel.json 的 SPA rewrite、vite dev、server.js fallback 都會把 /sign 導回 index.html，
// 所以這裡判斷 pathname 就夠了，不需要任何路由設定。
const isSignPage = window.location.pathname === '/sign'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSignPage ? <SignPage /> : <App />}
  </StrictMode>,
)
