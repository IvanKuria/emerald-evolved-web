import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { presenceMock } from './counter/dev-mock.ts'

/* Two headers carry the whole Play page. mGBA's WebAssembly build runs
   on threads, threads need SharedArrayBuffer, and the browser only
   hands that out to a page that is cross-origin isolated -- which also
   has to be a secure origin. So the dev server speaks HTTPS (a
   self-signed certificate; production gets a real one from the host)
   and sends COOP/COEP on every response. Production sets the same two
   in `public/_headers`. */
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tailwind(), basicSsl(), presenceMock() as Plugin],
  server: { host: '0.0.0.0', port: 5180, strictPort: true, headers: isolation },
  preview: { host: '0.0.0.0', port: 5180, headers: isolation },
})
