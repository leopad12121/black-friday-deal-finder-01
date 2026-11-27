// A working black-friday-deal-finder-01 entry (Node 22, standard library only): the site is this directory's app/
// folder, plain static files a browser opens at app/index.html (ES modules, CSS, no build step), its deals held in its
// own files: nothing it runs, styles or shows loads over the network, and each deal links out to its store. The program
// hands it in: it copies app/ and screenshots/ from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads (your screenshots, the first load's files and bytes, and your source), with the vendored
// make.fun library. Leave vendor/makefun-frontend.ts as it is: the scorer requires dossier.json to be byte for byte
// what its own copy writes.
//
// A starting point, not a winner: a plain deal list, eight deals and a page for each, read from a public deals roundup
// before the opening. Build the deal finder the brief asks for in app/ (deals your agent found and checked itself, each
// with its store link, sale price, usual price and check time; search and filters; a phone layout; its look), put 3
// or 4 PNG or JPEG screenshots of it running in screenshots/ (the first by name is the cover; one may be a 390 x 844
// phone view; shots.json says which views this starter's were taken of), and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildDossier, classifyAppPath, cssReferences, dynamicImports, firstLoadOf, htmlFacts, importMapOf, isLocalRef, isPathSpecifier, pageBaseFrom, readAppTree, resolveAppPath, resolveModule, sourceImports, type AppTree } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** A source file's text, decoded strictly: invalid UTF-8 is a broken file, not a guess. */
const strictText = new TextDecoder('utf-8', { fatal: true });

/** A module's syntax, checked by node itself: --check reads syntax only, so a missing import it names still passes — resolution is the first-load check below. */
function checkModuleSyntax(path: string, text: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'deal-scout-check-'));
  try {
    const tmp = join(dir, 'check.mjs');
    writeFileSync(tmp, text);
    const run = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    if (run.error) throw new Error(`validate: app/${path}: the syntax check could not run (${run.error.message})`);
    if (run.status !== 0) {
      const detail = (run.stderr ?? '').trim().split('\n')[0] ?? '';
      throw new Error(`validate: app/${path}: not valid JavaScript (${detail})`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A stylesheet's braces, balanced outside its comments and strings: cssReferences reads the references, this reads the shape. */
function checkCssBraces(shown: string, css: string): void {
  let depth = 0;
  let i = 0;
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < css.length && css[i] !== ch) i += css[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth < 0) throw new Error(`validate: ${shown}: a closing brace with no opening brace`);
    }
    i++;
  }
  if (depth !== 0) throw new Error(`validate: ${shown}: ${depth} unclosed brace(s)`);
}

/**
 * Every file the dossier embeds must exist and parse. A hand-in that names a file it does not hold, or holds a file
 * no parser takes, is refused by the scorer — so refuse it here first, naming the file, before dossier.json is
 * written. Nothing here changes the output: it only reads, and throws on a broken input.
 */
function validateEmbeddedFiles(dir: string): void {
  const appDir = join(dir, 'app');
  const tree = readAppTree(appDir);

  // Every source file the dossier prints: it must read, decode and parse for its kind.
  for (const file of tree.files) {
    if (classifyAppPath(file.path) !== 'source') continue;
    const shown = `app/${file.path}`;
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(appDir, file.path));
    } catch {
      throw new Error(`validate: ${shown}: missing — the dossier embeds this file but it is not there`);
    }
    let text: string;
    try {
      text = strictText.decode(bytes);
    } catch {
      throw new Error(`validate: ${shown}: not valid UTF-8 — a source file the dossier prints must decode`);
    }
    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(text);
      } catch (err) {
        throw new Error(`validate: ${shown}: not valid JSON (${(err as Error).message})`);
      }
    } else if (file.path.endsWith('.html')) {
      htmlFacts(text);
    } else if (file.path.endsWith('.js') || file.path.endsWith('.mjs')) {
      checkModuleSyntax(file.path, text);
    } else if (file.path.endsWith('.css')) {
      cssReferences(text);
      checkCssBraces(shown, text);
    }
  }

  // Every screenshot the dossier holds: a real JPEG or PNG, not a renamed file.
  for (const name of readdirSync(join(dir, 'screenshots'))) {
    const shown = `screenshots/${name}`;
    const bytes = readFileSync(join(dir, 'screenshots', name));
    const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!png && !jpeg) throw new Error(`validate: ${shown}: neither a PNG nor a JPEG (the dossier holds images only)`);
  }

  // Every file the first load fetches: the dossier lists a reference it cannot resolve as "not in app/", so a
  // missing one fails here, naming the reference and where it was read from.
  const facts = htmlFacts(strictText.decode(readFileSync(join(appDir, 'index.html'))));
  const first = firstLoadOf(tree, facts, (path) => strictText.decode(readFileSync(join(appDir, path))));
  for (const miss of [...first.missing, ...first.laterMissing]) {
    throw new Error(`validate: ${miss.ref} (${miss.where}): no such file in app/ — the first load names it but it is not there`);
  }

  // A second pass over every reference, not just the first load's (below).
  validateLocalReferences(dir, tree);
}

/**
 * Every local reference in every source file must name a file of app/. The first load only walks what the page
 * fetches on open; a view the router reaches later, or a module a lazy import reaches, still breaks the site when
 * its file is missing, and the dossier prints the broken reference either way. A bare module name the import map
 * does not cover, and an absolute URL, name no file of app/ and are not this check's business.
 */
function validateLocalReferences(dir: string, tree: AppTree): void {
  const appDir = join(dir, 'app');
  const files = new Set(tree.files.map((f) => f.path));
  const indexFacts = htmlFacts(strictText.decode(readFileSync(join(appDir, 'index.html'))));
  const map = importMapOf(indexFacts).map;
  const base = pageBaseFrom(indexFacts, 'index.html');
  const missing = (ref: string, where: string): never => {
    throw new Error(`validate: ${ref} (${where}): no such file in app/ — a source file names it but it is not there`);
  };
  const check = (ref: string, from: string, where: string): void => {
    if (!isLocalRef(ref)) return;
    const cut = ref.search(/[?#]/);
    if (cut >= 0 && ref.slice(0, cut).trim() === '') return; // a query or fragment alone names no file
    const target = resolveAppPath(ref, from);
    if (target === '') return; // app/ itself
    if (target === null || !files.has(target)) missing(ref, where);
  };
  for (const file of tree.files) {
    if (classifyAppPath(file.path) !== 'source') continue;
    const shown = `app/${file.path}`;
    const text = strictText.decode(readFileSync(join(appDir, file.path)));
    if (file.path.endsWith('.html')) {
      const facts = htmlFacts(text);
      const pageBase = pageBaseFrom(facts, file.path);
      for (const link of facts.links) check(link.href, pageBase, `${shown}'s <link href>`);
      for (const script of facts.scripts) {
        if (script.src !== null) check(script.src, pageBase, `${shown}'s <script src>`);
      }
      for (const res of facts.resources) check(res.src, pageBase, `${shown}'s <${res.tag} src>`);
      for (const style of facts.styles) {
        for (const ref of cssReferences(style)) check(ref.ref, pageBase, `${shown}'s inline <style>`);
      }
    } else if (file.path.endsWith('.js') || file.path.endsWith('.mjs')) {
      for (const spec of [...sourceImports(text), ...dynamicImports(text)]) {
        if (spec === null) continue;
        const target = resolveModule(spec, file.path, map, base);
        if (target === null) {
          if (isPathSpecifier(spec)) missing(spec, `imported by ${shown}`);
          continue;
        }
        if (!files.has(target)) missing(spec, `imported by ${shown}`);
      }
    } else if (file.path.endsWith('.css')) {
      for (const ref of cssReferences(text)) check(ref.ref, file.path, `${shown}'s stylesheet`);
    }
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Refuse a hand-in the scorer would refuse: every file the dossier embeds must exist and parse.
validateEmbeddedFiles(out);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 16 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 16777216 }),
);
