/**
 * 应用入口（中文注释版）
 * - 加载 UnoCSS Reset 与自定义样式
 * - 将 App 挂载到 #root
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
