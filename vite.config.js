import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html: it can be opened from disk or published as a claude.ai artifact.
export default defineConfig({
  plugins: [solid(), viteSingleFile()],
  build: { target: 'es2022' },
});
