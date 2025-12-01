import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // Reset base to default '/' for Vercel web deployment
    base: '/', 
    define: {
      // This is crucial: it allows 'process.env.API_KEY' to work in the browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})