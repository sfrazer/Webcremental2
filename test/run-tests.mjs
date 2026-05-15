import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dir = join(dirname(fileURLToPath(import.meta.url)), '..');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
    <div id="summary"></div>
    <table><tbody id="results"></tbody></table>
  </body></html>`,
  { url: 'http://localhost/' }
);

const ctx = vm.createContext(dom.window);

function runScript(rel) {
  const src = readFileSync(join(__dir, rel), 'utf8');
  vm.runInContext(src, ctx, { filename: rel });
}

runScript('js/research.js');
runScript('js/state.js');
runScript('js/engine.js');
runScript('test/tests.js');

const rows = dom.window.document.querySelectorAll('#results tr');
let passed = 0, failed = 0;
const failures = [];
for (const row of rows) {
  const status = row.querySelector('.status')?.textContent?.trim();
  const desc   = row.cells[1]?.textContent?.trim();
  const detail = row.cells[2]?.textContent?.trim();
  if (status === 'PASS') passed++;
  else { failed++; failures.push({ desc, detail }); }
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  FAIL  ${f.desc}  →  ${f.detail}`);
} else {
  console.log('All tests passed!');
}
process.exit(failed > 0 ? 1 : 0);
