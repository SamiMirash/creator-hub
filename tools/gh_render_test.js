// Render the Serious Sam Game Hub headlessly and assert Arash's complaints are fixed.
// ⛔ Runs the PAGE'S OWN inline script against the REAL data file, with a stub DOM. A test that
//    reimplements the render logic proves nothing about the page.
const fs = require('fs');
const HUB = 'C:/local_stream_companion/_deploy_creator_hub';

const html = fs.readFileSync(HUB + '/game.html', 'utf8');
const m = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.log('no inline script'); process.exit(1); }

let captured = null;
const stubEl = () => ({
  innerHTML: '', style: {}, classList: { add(){}, remove(){}, toggle(){} },
  value: '', dataset: {}, textContent: '',
  addEventListener(){}, removeEventListener(){}, appendChild(){}, setAttribute(){},
  focus(){}, blur(){}, closest(){ return null; }, querySelector(){ return null; },
  querySelectorAll(){ return []; },
});
const detail = stubEl();
Object.defineProperty(detail, 'innerHTML', {
  set(v) { captured = v; }, get() { return captured; },
});

global.document = {
  getElementById: (id) => (id === 'gh-detail' ? detail : stubEl()),
  querySelector: () => stubEl(), querySelectorAll: () => [],
  addEventListener: () => {}, createElement: () => stubEl(),
  body: stubEl(), documentElement: stubEl(),
};
global.window = {
  location: { search: '?slug=serious-sam', href: '', pathname: '/game' },
  addEventListener: () => {}, history: { replaceState(){}, pushState(){} },
  matchMedia: () => ({ matches: false, addEventListener(){} }),
};
global.fetch = () => new Promise(() => {});   // never resolves: we call render() ourselves
global.requestAnimationFrame = (f) => f();
global.history = { replaceState(){}, pushState(){} };
detail.scrollIntoView = () => {};

// ⭐ run the WHOLE script, then reach in for render(). Extracting one function missed its helpers.
// ⭐ THE SCRIPT IS AN IIFE, so render() is private. Inject an export on the last line INSIDE
//    the closure rather than reimplementing any of it.
const idx = m[1].lastIndexOf('})();');
if (idx < 0) { console.log('IIFE tail not found'); process.exit(1); }
const patched = m[1].slice(0, idx) + '\n  globalThis.__render = render;\n' + m[1].slice(idx);
new Function(patched)();
const render = globalThis.__render;
if (!render) { console.log('render() not reachable from the script scope'); process.exit(1); }

const d = JSON.parse(fs.readFileSync(HUB + '/data/games/serious-sam.json', 'utf8'));
try { render(d); } catch (e) { console.log('render threw: ' + e.message); process.exit(1); }
if (!captured) { console.log('render produced no HTML'); process.exit(2); }

const H = captured;
const count = (re) => (H.match(re) || []).length;
const checks = [
  ['A. the "earliest" badge is gone', count(/gh-earliest/g) === 0],
  ['B. no row repeats its own title after "Play:"',
    !/Play: Serious Sam \(Palm OS\)/.test(H)],
  ['B2. the platform fallback is used instead', /Play on /.test(H)],
  ['C. group number printed once, repeats marked', count(/gh-order-cont/g) > 0],
  ['C2. continuation rows are indented', count(/gh-sub/g) > 0],
  ['D. the strap states the grouping', /versions of one game kept together/.test(H)],
  ['E. entry 1 is NOT auto-open', !/<details class="gh-entry[^"]*" open/.test(H)],
  ['F. timeline strip rendered', /gh-time-bar/.test(H)],
  ['G. one tick per dated release', count(/gh-time-tick/g) >= 20],
];
// ⛔ THE TICKS MUST BE DISTINGUISHABLE, NOT MERELY PRESENT. 27 elements at 16 positions is
//    27 elements and a lie. Count DISTINCT rendered positions, left% plus the px nudge.
{
  const pos = new Set();
  const re = /left:([\d.]+)%;transform:translateX\((-?[\d.]+)px\)/g;
  let mm;
  while ((mm = re.exec(H)) !== null) { pos.add(mm[1] + '|' + mm[2]); }
  const ticks = (H.match(/gh-time-tick/g) || []).length;
  checks.push(['H. every tick has its own position (' + pos.size + ' of ' + ticks + ')',
    pos.size === ticks]);
}
let bad = 0;
for (const [label, ok] of checks) { if (!ok) bad++; console.log((ok ? '  PASS  ' : '  FAIL  ') + label); }
console.log('');
console.log('  ' + H.length + ' chars, ' + count(/class="gh-entry/g) + ' rows, '
  + count(/gh-order-cont/g) + ' continuation rows, ' + count(/gh-time-tick/g) + ' ticks');
const first = H.indexOf('gh-time');
if (first > 0) { console.log('  strip at char ' + first + ' (before the first row: '
  + (first < H.indexOf('class="gh-entry')) + ')'); }
process.exit(bad ? 1 : 0);
