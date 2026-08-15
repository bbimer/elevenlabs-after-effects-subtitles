#!/usr/bin/env node
/**
 * caption_compile.js — NS caption compiler (Phase 0)
 *
 * {out}.align.json  ->  {out}.captions.json
 * Turns character-level TTS alignment into caption "pages" of 1-3 lines,
 * following broadcast-style readability rules and smart clause pagination.
 *
 * Usage:
 *   node caption_compile.js vo_delisting_01.align.json [--config compile.config.json] [--out file.json]
 *
 * Pure JS, no dependencies. Node 14+.
 */

'use strict';
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  return process.argv[i + 1];
}
const alignPath = process.argv[2];
if (!alignPath || alignPath.startsWith('--')) {
  console.error('Usage: node caption_compile.js <file.align.json> [--config compile.config.json] [--out out.json]');
  process.exit(1);
}

const DEFAULTS = {
  maxCharsPerLine: 24,
  hardMaxCharsPerLine: 28,
  maxLines: 3,
  targetLines: 2,
  maxCharsPerPage: 42,      // Optimized for 9:16 Shorts/Reels readability (was 66)
  gapThreshold: 0.35,       // Silence >= 350ms forces a page break (was 1.2s)
  minPageDur: 1.0,          // min duration for a page (s)
  maxPageDur: 4.2,          // max duration for a sentence page (s)
  maxCPS: 22,               // reading speed, display chars / sec
  leadIn: 0.08,             // page may appear up to this much BEFORE first word
  tailOut: 0.15,            // page holds this much after last word
  snapGap: 0.12,            // if gap to next page < this -> butt-join (no flicker gap)
  casing: 'upper',          // 'upper' | 'asis'
  stripFinalPeriod: true,   // drop trailing '.' on a page (keep ? !)
  emphasisPolicy: 'own-line' // 'own-line' | 'line' | 'off'
};

// Words that should NEVER end a line or page (dangling prepositions, conjunctions, articles, pronouns)
const NO_LINE_END = new Set([
  // English
  'a','an','the','of','to','in','on','at','for','and','or','but','nor','not','no','is','are','was','were','with','by','from','as','vs','into','onto','than','that','this','these','those','your','their','its','his','her','our','my','over','under','per','we','they','he','she','it','you','i','up','out','off','so','if','then','where','when','which','who','whom','whose','how','why',
  // Russian & Ukrainian prepositions & conjunctions
  'в','во','на','с','со','к','ко','из','изо','за','по','о','об','обо','от','ото','до','у','под','подо','над','надо','про','без','безо','для','при','чрез','через','сквозь','не','ни','и','а','но','да','или','либо','как','что','чтоб','чтобы','где','куда','откуда','когда','пока','едва','лишь','чем','тем','если','ежели','хоть','хотя','пусть','пускай','будто','словно','точно','тот','та','то','те','этот','эта','это','эти','мой','твой','наш','ваш','его','ее','их','свой','чей','кто','свої','його','її','їх','від','під','через','при','без'
]);

// Particles & enclitics that must NEVER start a line or page (must stay glued to preceding word)
const NO_LINE_START = new Set([
  'же','ж','ли','ль','бы','б','то','ка','де','таки','будь','небудь',
  "'s","'re","'ve","'d","'ll","n't","%","percent"
]);

// Inseparable multi-word phrases (must never be torn apart across lines or pages)
const GLUED_PHRASES = [
  ['один', 'и', 'тот', 'же'],
  ['одна', 'и', 'та', 'же'],
  ['одно', 'и', 'то', 'же'],
  ['одни', 'и', 'те', 'же'],
  ['тот', 'же'],
  ['та', 'же'],
  ['то', 'же'],
  ['те', 'же'],
  ['так', 'же'],
  ['то', 'есть'],
  ['потому', 'что'],
  ['так', 'как'],
  ['как', 'будто'],
  ['вряд', 'ли'],
  ['едва', 'ли'],
  ['не', 'только'],
  ['в', 'том', 'числе'],
  ['и', 'так', 'далее'],
  ['с', 'одной', 'из'],
  ['на', 'этом', 'всё'],
  ['the', 'exact', 'same'],
  ['exact', 'same'],
  ['in', 'a', 'split', 'second'],
  ['split', 'second'],
  ['that', 'is', 'it'],
  ['that’s', 'it'],
  ['thats', 'it'],
  ['one', 'of', 'the'],
  ['one', 'of'],
  ['link', 'in', 'bio']
];

// Units that must stay glued to a preceding number
const UNITS = new Set(['day','days','hour','hours','min','mins','minute','minutes','sec','secs','second','seconds','week','weeks','month','months','year','years','percent','x','bps','fee','fees','долларов','доллара','рублей','рубля','гривен','секунды','секунд','минут','минуты','часов','часа','дней','дня']);
const NUM_RE = /^[\$€£₽₴]?[\d][\d,.]*%?$/;

// ---------- load ----------
const side = JSON.parse(fs.readFileSync(alignPath, 'utf8'));
const cfgPath = arg('config');
const cfg = Object.assign({}, DEFAULTS, cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {});
const A = side.alignment;
if (!A || !A.characters || !A.characters.length) { console.error('No alignment data in ' + alignPath); process.exit(1); }

// ---------- chars -> words ----------
const chars = A.characters, cs = A.character_start_times_seconds || [], ce = A.character_end_times_seconds || [];
const cp = A.character_parts || [];
let lastValidTime = 0;
for (let i = 0; i < chars.length; i++) {
  if (cs[i] !== undefined && !isNaN(cs[i])) lastValidTime = cs[i];
  else cs[i] = lastValidTime + 0.04;
  if (ce[i] !== undefined && !isNaN(ce[i])) lastValidTime = ce[i];
  else ce[i] = cs[i] + 0.04;
}

const words = [];
{
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur) {
        if (cur.e <= cur.s) cur.e = cur.s + 0.25;
        words.push(cur);
        cur = null;
      }
      continue;
    }
    if (!cur) {
      const partIdx = (cp && cp[i] !== undefined) ? cp[i] : 0;
      const takeLetter = String.fromCharCode(65 + (partIdx % 26));
      cur = { w: '', s: cs[i], e: ce[i], i0: i, i1: i, em: false, part: partIdx + 1, take: takeLetter };
    }
    cur.w += c;
    if (ce[i] >= cs[i]) cur.e = ce[i];
    cur.i1 = i;
  }
  if (cur) {
    if (cur.e <= cur.s) cur.e = cur.s + 0.25;
    words.push(cur);
  }
}

// Emphasis mapping
const warningsGlobal = [];
{
  const joined = chars.join('');
  if (side.text_plain && joined !== side.text_plain) {
    warningsGlobal.push('alignment chars differ from text_plain — emphasis mapping may be off');
  }
  const spans = side.emphasis_spans || [];
  for (const w of words) {
    for (const [s0, s1] of spans) { if (w.i0 < s1 && w.i1 >= s0) { w.em = true; break; } }
  }
}

// ---------- helpers ----------
function cleanw(s) {
  return (s || '').toLowerCase().replace(/^[^\wа-яёіїєґ'$€£₽₴%]+|[^\wа-яёіїєґ'$€£₽₴%]+$/gi, '');
}

const wlen = w => w.w.length;
const textOf = ws => ws.map(w => w.w).join(' ');
const isTerm = w => /[.!?…]+["']?$/.test(w.w);
const isSoft = w => /[,;:—–-]+["']?$/.test(w.w) && !/^-+$/.test(w.w);
const gapAfter = i => (i + 1 < words.length) ? (words[i + 1].s - words[i].e) : Infinity;

function badBreak(aWord, bWord) {
  const ca = cleanw(aWord.w || aWord);
  const cb = cleanw(bWord.w || bWord);
  if (NO_LINE_END.has(ca)) return true;
  if (NO_LINE_START.has(cb)) return true;
  if (NUM_RE.test(ca) && UNITS.has(cb)) return true;
  if (/^[\$€£₽₴]$/.test(ca) && NUM_RE.test(cb)) return true;
  for (const phrase of GLUED_PHRASES) {
    for (let k = 0; k < phrase.length - 1; k++) {
      if (phrase[k] === ca && phrase[k + 1] === cb) return true;
    }
  }
  return false;
}

// ---------- pagination ----------
const rawPages = [];
{
  let buf = [];
  const flush = () => { if (buf.length) { rawPages.push(buf); buf = []; } };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    buf.push(w);

    const curLen = textOf(buf).length;
    const curDur = buf[buf.length - 1].e - buf[0].s;
    const isLast = (i === words.length - 1);
    const nextW = isLast ? null : words[i + 1];

    let shouldFlush = false;

    if (isTerm(w)) {
      shouldFlush = true;
    } else if (gapAfter(i) >= cfg.gapThreshold) {
      if (!isLast && !badBreak(w, nextW)) shouldFlush = true;
    } else if (isSoft(w) && curLen >= 14) {
      // Split on comma/colon/dash if clause has enough substance
      if (!isLast && !badBreak(w, nextW)) shouldFlush = true;
    } else if (curLen >= cfg.maxCharsPerPage || curDur >= cfg.maxPageDur) {
      // Split on page limit at legal boundary
      if (!isLast && !badBreak(w, nextW)) shouldFlush = true;
    }

    if (shouldFlush || isLast) {
      flush();
    }
  }
  flush();
}

// merge orphans / too-short pages into a neighbour
const pagesW = [];
for (let i = 0; i < rawPages.length; i++) {
  const p = rawPages[i];
  const dur = p[p.length - 1].e - p[0].s;
  const isOrphan = (p.length === 1 && textOf(p).length <= 6) || (p.length <= 2 && dur < 0.45);

  if (isOrphan) {
    let merged = false;
    // 1. Try merging backward into prev page
    if (pagesW.length) {
      const prev = pagesW[pagesW.length - 1];
      const mergedLen = textOf(prev).length + 1 + textOf(p).length;
      if (mergedLen <= cfg.maxCharsPerPage + 8) {
        prev.push(...p);
        merged = true;
        continue;
      }
    }
    // 2. Try merging forward into next raw page
    if (!merged && i + 1 < rawPages.length) {
      const nextP = rawPages[i + 1];
      const mergedLen = textOf(p).length + 1 + textOf(nextP).length;
      if (mergedLen <= cfg.maxCharsPerPage + 8) {
        rawPages[i + 1].unshift(...p);
        merged = true;
        continue;
      }
    }
  }
  pagesW.push(p);
}

// Legal split helper for line breaking
function legalSplit(p, k) {
  const a = p[k - 1], b = p[k];
  if (a.em && b.em) return false;
  if (badBreak(a, b)) return false;
  return true;
}

// ---------- line breaking ----------
function breakIntoLines(ws) {
  const warn = [];
  const full = textOf(ws);
  if (full.length <= cfg.maxCharsPerLine || ws.length === 1) {
    if (full.length > cfg.hardMaxCharsPerLine) warn.push('line exceeds hard max: "' + full + '"');
    return { lines: [ws], warn };
  }

  let best = null;
  const maxL = Math.min(cfg.maxLines, ws.length);
  for (let k = 2; k <= maxL; k++) {
    const cuts = combinations(ws.length - 1, k - 1);
    for (const cut of cuts) {
      const runs = split(ws, cut);
      const lens = runs.map(r => textOf(r).length);
      if (Math.max(...lens) > cfg.hardMaxCharsPerLine) continue;

      let score = (Math.max(...lens) - Math.min(...lens)); // balance
      score += Math.max(0, k - cfg.targetLines) * 16;
      for (const c of cut) {
        if (badBreak(ws[c], ws[c + 1])) score += 50; // heavily penalize bad breaks
      }
      for (const r of runs) {
        if (r.length === 1 && wlen(r[0]) <= 3) score += 20; // orphan word penalty
      }
      if (!best || score < best.score) best = { score, runs };
    }
  }

  if (!best) {
    warn.push('forced greedy break: "' + full + '"');
    const runs = [];
    let cur = [];
    for (const w of ws) {
      if (textOf(cur).length + (cur.length ? 1 : 0) + wlen(w) > cfg.hardMaxCharsPerLine && cur.length) {
        runs.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) runs.push(cur);
    return { lines: runs, warn };
  }
  return { lines: best.runs, warn };
}

function combinations(n, k) {
  const res = [];
  (function rec(start, acc) {
    if (acc.length === k) { res.push(acc.slice()); return; }
    for (let i = start; i < n; i++) { acc.push(i); rec(i + 1, acc); acc.pop(); }
  })(0, []);
  return res.length > 5000 ? res.filter((_, i) => i % Math.ceil(res.length / 5000) === 0) : res;
}

function split(ws, cuts) {
  const runs = []; let prev = 0;
  for (const c of cuts) { runs.push(ws.slice(prev, c + 1)); prev = c + 1; }
  runs.push(ws.slice(prev));
  return runs;
}

// Emphasis lines
function linesForPage(ws) {
  const warn = [];
  if (cfg.emphasisPolicy === 'own-line' && ws.some(w => w.em)) {
    const runs = []; let cur = null;
    for (const w of ws) {
      if (!cur || cur.em !== w.em) { cur = { em: w.em, ws: [w] }; runs.push(cur); }
      else cur.ws.push(w);
    }
    const lines = [];
    for (const r of runs) {
      if (r.em && textOf(r.ws).length <= cfg.hardMaxCharsPerLine) {
        lines.push({ ws: r.ws, style: 'accent' });
      } else {
        const b = breakIntoLines(r.ws);
        warn.push(...b.warn);
        for (const l of b.lines) lines.push({ ws: l, style: r.em ? 'accent' : 'base' });
      }
    }
    if (lines.length > cfg.maxLines) warn.push('page has ' + lines.length + ' lines (emphasis split) — review');
    return { lines, warn };
  }
  const b = breakIntoLines(ws);
  warn.push(...b.warn);
  return {
    lines: b.lines.map(l => ({
      ws: l,
      style: (cfg.emphasisPolicy === 'line' && l.some(w => w.em)) ? 'accent' : 'base'
    })),
    warn
  };
}

// ---------- assemble pages ----------
function displayText(ws, isLastLineOfPage) {
  let t = ws.map(w => w.w).join(' ');
  if (cfg.stripFinalPeriod && isLastLineOfPage) t = t.replace(/[.,;]$/, '');
  if (cfg.casing === 'upper') t = t.toUpperCase();
  return t;
}

const pages = [];
let pageCounter = 1;
const maxL = cfg.maxLines || 3;

for (let i = 0; i < pagesW.length; i++) {
  const ws = pagesW[i];
  const { lines, warn } = linesForPage(ws);

  const lineChunks = [];
  for (let li = 0; li < lines.length; li += maxL) {
    lineChunks.push(lines.slice(li, li + maxL));
  }

  for (let ci = 0; ci < lineChunks.length; ci++) {
    const chunkLines = lineChunks[ci];
    const chunkWords = [].concat(...chunkLines.map(l => l.ws));
    const start0 = chunkWords[0].s;
    const end0 = Math.max.apply(null, chunkWords.map(w => w.e).concat([start0 + 0.5]));
    const prevEnd = pages.length ? pages[pages.length - 1].end : 0;
    let start = Math.max(start0 - cfg.leadIn, prevEnd);
    let end = end0 + cfg.tailOut;
    const nextStart = (ci + 1 < lineChunks.length) ? (lineChunks[ci + 1][0].ws[0].s) : ((i + 1 < pagesW.length) ? pagesW[i + 1][0].s : Infinity);
    if (nextStart - end < cfg.snapGap) end = Math.min(nextStart, end0 + cfg.tailOut + cfg.snapGap);
    end = Math.min(end, nextStart);

    const pageTake = (chunkWords[0] && chunkWords[0].take) ? chunkWords[0].take : 'A';
    const pagePart = (chunkWords[0] && chunkWords[0].part) ? chunkWords[0].part : 1;

    pages.push({
      id: pageCounter++,
      take: pageTake,
      part: pagePart,
      start: round3(start),
      end: round3(end),
      lines: chunkLines.map((l, li) => ({
        text: displayText(l.ws, li === chunkLines.length - 1),
        style: l.style,
        words: l.ws.map(w => ({ w: cfg.casing === 'upper' ? w.w.toUpperCase() : w.w, s: round3(w.s), e: round3(w.e) }))
      })),
      warnings: warn,
      locked: false
    });
  }
}
function round3(x) { return Math.round(x * 1000) / 1000; }

// ---------- write ----------
const out = {
  version: 1,
  source: 'elevenlabs',
  audio: side.audio_file || null,
  settings: cfg,
  generated: new Date().toISOString(),
  globalWarnings: warningsGlobal,
  pages
};
const outPath = arg('out') || alignPath.replace(/\.align\.json$/, '') + '.captions.json';
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

// ---------- console summary ----------
const nWarn = pages.reduce((a, p) => a + p.warnings.length, 0) + warningsGlobal.length;
console.log('[caption_compile] ' + pages.length + ' pages -> ' + outPath + (nWarn ? ('   WARNINGS: ' + nWarn) : ''));
for (const p of pages) {
  const t = p.lines.map(l => l.text + (l.style === 'accent' ? '  «ACC»' : '')).join(' / ');
  console.log(String(p.id).padStart(3, '0') + '  ' + p.start.toFixed(2) + '–' + p.end.toFixed(2) + '  ' + t + (p.warnings.length ? '   ⚠ ' + p.warnings.join('; ') : ''));
}
