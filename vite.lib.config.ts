import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib/index.ts'),
      name: 'TenleavesAgentForm',
      formats: ['es', 'cjs'],
      fileName: (format) =>
        format === 'es' ? 'tenleaves-agent-form.es.js' : 'tenleaves-agent-form.cjs',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        // keep external for host app; consumer provides these
      ],
    },
    outDir: 'dist-lib',
    emptyOutDir: false,
  },
})
