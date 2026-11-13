// Tiny helpers shared by the browser suites.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright comes from the machine (or `npm i -D playwright`); it isn't a dependency of the game.
export const { chromium } = require('playwright');

export function checker() {
  const fails = [];
  const ok = (name, value) => {
    console.log(`${value ? 'PASS' : 'FAIL'} ${name}`);
    if (!value) fails.push(name);
  };
  return { ok, fails };
}

/** Evaluate inside the page with the game's test hook as `d`. */
export const ev = (page, fn, arg) => page.evaluate(([src, a]) => (0, eval)(`(${src})`)(window.__dr, a), [fn.toString(), arg]);
export const until = (page, fn, arg, timeout = 8000) =>
  page.waitForFunction(([src, a]) => (0, eval)(`(${src})`)(window.__dr, a), [fn.toString(), arg], { timeout });
