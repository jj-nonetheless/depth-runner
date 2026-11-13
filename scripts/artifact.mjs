// Turns the Vite build into the shape the claude.ai Artifact tool publishes: page content only
// (title, meta, styles, markup, script) — the platform supplies the html/head/body skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();
writeFileSync('dist/artifact.html', `${keep}\n${body.trim()}\n`);
console.log('wrote dist/artifact.html');
