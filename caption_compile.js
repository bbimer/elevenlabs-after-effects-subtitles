#!/usr/bin/env node
/**
 * caption_compile.js — NS caption compiler (Phase 0)
 *
 * {out}.align.json  ->  {out}.captions.json
 * Turns character-level TTS alignment into caption "pages" of 1-3 lines,
 * following broadcast-style readability rules (see compile.config.json).
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
  maxCharsPerLine: 22,
  hardMaxCharsPerLine: 26,
  maxLines: 3,
  targetLines: 2,
  maxCharsPerPage: 66,
  gapThreshold: 1.20,       // s of silence that forces a page break (1.2s)
  minPageDur: 1.5,          // min duration for a multi-word page
  maxPageDur: 5.0,          // max duration for a sentence page
  maxCPS: 22,               // reading speed, display chars / sec
  leadIn: 0.08,             // page may appear up to this much BEFORE first word
  tailOut: 0.15,            // page holds this much after last word
  snapGap: 0.12,            // if gap to next page < this -> butt-join (no flicker gap)
  casing: 'upper',          // 'upper' | 'asis'
  stripFinalPeriod: true,   // drop trailing '.' on a page (keep ? !)
  emphasisPolicy: 'own-line' // 'own-line' | 'line' | 'off'
};

// Words that should not end a line (dangling function words)
const NO_LINE_END = new Set(['a','an','the','of','to','in','on','at','for','and','or','but','nor','not','no','is','are','was','were','with','by','from','as','vs','into','onto','than','that','this','your','their','its','his','her','over','under','per']);
// Units that must stay glued to a preceding number
const UNITS = new Set(['day','days','hour','hours','min','mins','minute','minutes','sec','secs','second','seconds','week','weeks','month','months','year','years','percent','x','bps','fee','fees']);
const NUM_RE = /^[\$€£]?[\d][\d,.]*%?$/;

// ---------- load ----------
const side = JSON.parse(fs.readFileSync(alignPath, 'utf8'));
const cfgPath = arg('config');
const cfg = Object.assign({}, DEFAULTS, cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {});
const A = side.alignment;
if (!A || !A.characters || !A.characters.length) { console.error('No alignment data in ' + alignPath); process.exit(1); }

// ---------- chars -> words ----------
const chars = A.characters, cs = A.character_start_times_seconds, ce = A.character_end_times_seconds;
const words = []; // {w, s, e, i0, i1, em}
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
    if (!cur) cur = { w: '', s: cs[i], e: ce[i], i0: i, i1: i, em: false };
    cur.w += c;
    if (ce[i] >= cs[i]) cur.e = ce[i];
    cur.i1 = i;
  }
  if (cur) {
    if (cur.e <= cur.s) cur.e = cur.s + 0.25;
    words.push(cur);
  }
}

// emphasis spans are char-indices into text_plain; alignment chars should be 1:1 with it
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
const wlen = w => w.w.length;
const textOf = ws => ws.map(w => w.w).join(' ');
const isTerm = w => /[.!?]$/.test(w.w);
const isSoft = w => /[,;:—–-]$/.test(w.w) && !/^-+$/.test(w.w);
const gapAfter = i => (i + 1 < words.length) ? (words[i + 1].s - words[i].e) : Infinity;

// ---------- pagination ----------
const rawPages = [];
{
  let buf = [], lastSoft = -1; // index in buf AFTER which a soft break exists
  const flush = () => { if (buf.length) { rawPages.push(buf); buf = []; lastSoft = -1; } };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // would adding w overflow?
    const nextLen = textOf(buf).length + (buf.length ? 1 : 0) + wlen(w);
    const nextDur = buf.length ? (w.e - buf[0].s) : (w.e - w.s);
    if (buf.length && (nextLen > cfg.maxCharsPerPage || nextDur > cfg.maxPageDur)) {
      if (lastSoft >= Math.floor(buf.length * 0.4)) {
        const head = buf.slice(0, lastSoft + 1), tail = buf.slice(lastSoft + 1);
        rawPages.push(head); buf = tail; lastSoft = -1;
      } else flush();
    }
    buf.push(w);
    if (isSoft(w)) lastSoft = buf.length - 1;
    if (isTerm(w) || gapAfter(i) >= cfg.gapThreshold) flush();
  }
  flush();
}

// merge orphans / too-short pages into a neighbour (backward or forward)
const pagesW = [];
for (let i = 0; i < rawPages.length; i++) {
  const p = rawPages[i];
  const dur = p[p.length - 1].e - p[0].s;
  const isOrphan = (p.length <= 2 && textOf(p).length <= 8) || dur < cfg.minPageDur;

  if (isOrphan) {
    var merged = false;
    // 1. Try merging backward into prev page
    if (pagesW.length) {
      const prev = pagesW[pagesW.length - 1];
      const mergedLen = textOf(prev).length + 1 + textOf(p).length;
      if (mergedLen <= cfg.maxCharsPerPage * 1.35) {
        prev.push(...p);
        merged = true;
        continue;
      }
    }
    // 2. Try merging forward into next raw page
    if (!merged && i + 1 < rawPages.length) {
      rawPages[i + 1].unshift(...p);
      merged = true;
      continue;
    }
    // 3. Last resort: force merge backward
    if (!merged && pagesW.length) {
      pagesW[pagesW.length - 1].push(...p);
      continue;
    }
  }
  pagesW.push(p);
}

// legal page-split point? (break BEFORE index k). Never inside an emphasis run,
// never after a dangling function word, never between number and its unit / currency.
function cleanw(s){ return s.toLowerCase().replace(/[^\w$€£%.]/g,''); }
function legalSplit(p, k) {
  const a = p[k - 1], b = p[k];
  if (a.em && b.em) return false;
  if (NO_LINE_END.has(cleanw(a.w))) return false;
  if (NUM_RE.test(a.w) && UNITS.has(cleanw(b.w))) return false;
  if (/^[\$€£]$/.test(a.w) && NUM_RE.test(b.w)) return false;
  return true;
}
function findLegalSplit(p) { // nearest-to-middle legal boundary, else null
  const mid = p.length / 2;
  let best = null, bestD = Infinity;
  for (let k = 1; k < p.length; k++) {
    if (!legalSplit(p, k)) continue;
    const d = Math.abs(k - mid) - (gapBetween(p, k) * 2); // prefer real speech gaps
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}
function gapBetween(p, k){ return Math.max(0, p[k].s - p[k - 1].e); }

// CPS guard: split overly dense pages once, at the nearest LEGAL boundary
for (let i = 0; i < pagesW.length; i++) {
  const p = pagesW[i];
  const dur = p[p.length - 1].e - p[0].s;
  const cpsv = textOf(p).length / Math.max(dur, 0.01);
  if (cpsv > cfg.maxCPS && p.length > 3) {
    const k = findLegalSplit(p);
    if (k) { pagesW.splice(i, 1, p.slice(0, k), p.slice(k)); i++; }
  }
}

// ---------- line breaking ----------
function badBreakAfter(ws, k) { // break between ws[k] and ws[k+1]
  const a = ws[k], b = ws[k + 1];
  if (NO_LINE_END.has(a.w.toLowerCase().replace(/[^\w$€£%.]/g, ''))) return true;
  if (NUM_RE.test(a.w) && UNITS.has(b.w.toLowerCase().replace(/[^\w]/g, ''))) return true;
  if (NUM_RE.test(b.w) && /^[\$€£]$/.test(a.w)) return true;
  return false;
}
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
    // all compositions of ws into k contiguous non-empty runs
    const cuts = combinations(ws.length - 1, k - 1);
    for (const cut of cuts) {
      const runs = split(ws, cut);
      const lens = runs.map(r => textOf(r).length);
      if (Math.max(...lens) > cfg.hardMaxCharsPerLine) continue;
      // score: balance matters, but prefer FEWER lines strongly (2 over 3 unless needed)
      let score = (Math.max(...lens) - Math.min(...lens));           // imbalance
      score += Math.max(0, k - cfg.targetLines) * 16;                // heavy penalty per extra line
      for (const c of cut) if (badBreakAfter(ws, c)) score += 30;    // bad linguistic break
      for (const r of runs) if (r.length === 1 && wlen(r[0]) <= 3) score += 14; // orphan word line
      if (!best || score < best.score) best = { score, runs };
    }
  }
  if (!best) { // single word longer than hard max, or nothing fits — force greedy
    warn.push('forced greedy break: "' + full + '"');
    const runs = [];
    let cur = [];
    for (const w of ws) {
      if (textOf(cur).length + (cur.length ? 1 : 0) + wlen(w) > cfg.hardMaxCharsPerLine && cur.length) { runs.push(cur); cur = []; }
      cur.push(w);
    }
    if (cur.length) runs.push(cur);
    return { lines: runs.slice(0, cfg.maxLines), warn };
  }
  return { lines: best.runs, warn };
}
function combinations(n, k) { // choose k cut positions out of n (0..n-1), capped for sanity
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

// emphasis: pull emphasized runs into their own accent lines (policy 'own-line')
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
  if (cfg.stripFinalPeriod && isLastLineOfPage) t = t.replace(/[.,;]$/, ''); // drop trailing . , ; at page end
  if (cfg.casing === 'upper') t = t.toUpperCase();
  return t;
}

const pages = [];
for (let i = 0; i < pagesW.length; i++) {
  const ws = pagesW[i];
  const { lines, warn } = linesForPage(ws);
  const start0 = ws[0].s;
  const end0 = Math.max.apply(null, ws.map(function(w){ return w.e; }).concat([start0 + 0.5]));
  const prevEnd = pages.length ? pages[pages.length - 1].end : 0;
  let start = Math.max(start0 - cfg.leadIn, prevEnd);
  let end = end0 + cfg.tailOut;
  const nextStart = (i + 1 < pagesW.length) ? pagesW[i + 1][0].s : Infinity;
  if (nextStart - end < cfg.snapGap) end = Math.min(nextStart, end0 + cfg.tailOut + cfg.snapGap);
  end = Math.min(end, nextStart);
  const cpsv = textOf(ws).length / Math.max(end0 - start0, 0.01);
  if (cpsv > cfg.maxCPS) warn.push('CPS ' + cpsv.toFixed(1) + ' > ' + cfg.maxCPS);

  pages.push({
    id: i + 1,
    start: round3(start),
    end: round3(end),
    lines: lines.map((l, li) => ({
      text: displayText(l.ws, li === lines.length - 1),
      style: l.style,
      words: l.ws.map(w => ({ w: cfg.casing === 'upper' ? w.w.toUpperCase() : w.w, s: round3(w.s), e: round3(w.e) }))
    })),
    warnings: warn,
    locked: false
  });
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
