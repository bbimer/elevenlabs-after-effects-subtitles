#!/usr/bin/env node
/**
 * transcribe.js — Universal Video/Audio Subtitle Extractor & Semantic Compiler (v2.6)
 *
 * Extracts word-level timestamps from ANY video or audio file (MP4, MOV, MP3, WAV, MKV, SRT, VTT)
 * and formats them into After Effects-ready `.captions.json` using the v2.6 Semantic Pagination Engine.
 *
 * Engines Supported:
 *   1. ElevenLabs Scribe STT (Uses ELEVENLABS_API_KEY in .env)
 *   2. Groq Whisper API (Uses GROQ_API_KEY — whisper-large-v3, ultra fast)
 *   3. OpenAI Whisper API (Uses OPENAI_API_KEY — whisper-1)
 *   4. Local Python Whisper / Faster-Whisper (--local)
 *   5. Direct SRT / VTT Subtitle Parser (.srt, .vtt)
 *
 * Usage:
 *   node transcribe.js "C:/path/to/my_video.mp4"
 *   node transcribe.js "my_audio.mp3" --engine elevenlabs
 *   node transcribe.js "subtitles.srt" --out custom.captions.json
 *
 * Drag & Drop:
 *   Drag any video/audio onto `transcribe.bat` in Windows Explorer!
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ----------------------------- CONFIG & DEFAULTS -----------------------------
const DEFAULTS = {
  maxCharsPerLine: 24,
  hardMaxCharsPerLine: 28,
  maxLines: 2,
  targetLines: 2,
  maxCharsPerPage: 52,      // Semantic clause capacity for 2 lines
  gapThreshold: 0.35,       // Silence >= 350ms triggers clause flush
  minPageDur: 0.8,
  maxPageDur: 4.2,
  casing: 'upper',          // 'upper' | 'asis'
  stripFinalPeriod: true
};

const NO_LINE_END = new Set([
  'a','an','the','of','to','in','on','at','for','and','or','but','nor','not','no','is','are','was','were','with','by','from','as','vs','into','onto','than','that','this','these','those','your','their','its','his','her','our','my','over','under','per','we','they','he','she','it','you','i','so','if','then','where','when','which','who','whom','whose','how','why',
  'в','во','на','с','со','к','ко','из','изо','за','по','о','об','обо','от','ото','до','у','под','подо','над','надо','про','без','безо','для','при','чрез','через','сквозь','не','ни','и','а','но','да','или','либо','как','что','чтоб','чтобы','где','куда','откуда','когда','пока','едва','лишь','чем','тем','если','ежели','хоть','хотя','пусть','пускай','будто','словно','точно','тот','та','то','те','этот','эта','это','эти','мой','твой','наш','ваш','его','ее','их','свой','чей','кто','свої','його','її','їх','від','під','через','при','без'
]);

const NO_LINE_START = new Set([
  'же','ж','ли','ль','бы','б','то','ка','де','таки','будь','небудь',
  "'s","'re","'ve","'d","'ll","n't","%","percent"
]);

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
  ['one', 'of', 'the'],
  ['link', 'in', 'bio']
];

const UNITS = new Set(['day','days','hour','hours','min','mins','minute','minutes','sec','secs','second','seconds','week','weeks','month','months','year','years','percent','x','bps','fee','fees','долларов','доллара','рублей','рубля','гривен','секунды','секунд','минут','минуты','часов','часа','дней','дня']);
const NUM_RE = /^[\$€£₽₴]?[\d][\d,.]*%?$/;

// ----------------------------- LOAD ENVIRONMENT -----------------------------
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      try {
        const content = fs.readFileSync(ep, 'utf8');
        for (const line of content.split('\n')) {
          const m = line.trim().match(/^([^#=]+)=(.*)$/);
          if (m) {
            const k = m[1].trim();
            const v = m[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) process.env[k] = v;
          }
        }
      } catch (e) {}
    }
  }
}
loadEnv();

// ----------------------------- HELPERS -----------------------------
function findFfmpeg() {
  const candidates = [
    'ffmpeg',
    'ffmpeg.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-7.1-full_build/bin/ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Links/ffmpeg.exe'),
    'C:/ffmpeg/bin/ffmpeg.exe',
    'C:/Program Files/ffmpeg/bin/ffmpeg.exe'
  ];
  for (const c of candidates) {
    try {
      const res = spawnSync(c, ['-version'], { stdio: 'ignore' });
      if (res.status === 0) return c;
    } catch (e) {}
  }
  return null;
}

function cleanw(s) {
  return (s || '').toLowerCase().replace(/^[^\wа-яёіїєґ'$€£₽₴%]+|[^\wа-яёіїєґ'$€£₽₴%]+$/gi, '');
}

const wlen = w => w.w.length;
const textOf = ws => ws.map(w => w.w).join(' ');
const isTerm = w => /[.!?…]+["']?$/.test(w.w);
const isSoft = w => /[,;:—–-]+["']?$/.test(w.w) && !/^-+$/.test(w.w);

function badBreak(aWord, bWord) {
  if (!aWord || !bWord) return false;
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

// Combinations helper for line splitting
function combinations(n, k) {
  if (k === 0) return [[]];
  if (k === n) return [[...Array(n).keys()].map(i => i + 1)];
  const res = [];
  function rec(start, chosen) {
    if (chosen.length === k) { res.push([...chosen]); return; }
    for (let i = start; i <= n; i++) {
      chosen.push(i);
      rec(i + 1, chosen);
      chosen.pop();
    }
  }
  rec(1, []);
  return res;
}

function splitWords(arr, cuts) {
  const res = [];
  let prev = 0;
  for (const c of cuts) {
    res.push(arr.slice(prev, c));
    prev = c;
  }
  res.push(arr.slice(prev));
  return res;
}

function breakIntoLines(ws, cfg) {
  const full = textOf(ws);
  if (full.length <= cfg.maxCharsPerLine || ws.length === 1) {
    return { lines: [ws] };
  }

  let best = null;
  const maxL = Math.min(cfg.maxLines, ws.length);
  for (let k = 2; k <= maxL; k++) {
    const cuts = combinations(ws.length - 1, k - 1);
    for (const cut of cuts) {
      const runs = splitWords(ws, cut);
      const lens = runs.map(r => textOf(r).length);
      if (Math.max(...lens) > cfg.hardMaxCharsPerLine) continue;

      let score = (Math.max(...lens) - Math.min(...lens)); // balance
      score += Math.max(0, k - cfg.targetLines) * 16;
      for (const c of cut) {
        if (badBreak(ws[c - 1], ws[c])) score += 50;
      }
      for (const r of runs) {
        if (r.length === 1 && wlen(r[0]) <= 3) score += 20;
      }
      if (!best || score < best.score) best = { score, runs };
    }
  }

  if (!best) {
    // Greedy fallback
    const runs = [];
    let cur = [];
    for (const w of ws) {
      const test = cur.concat([w]);
      if (textOf(test).length > cfg.maxCharsPerLine && cur.length > 0) {
        runs.push(cur);
        cur = [w];
      } else {
        cur = test;
      }
    }
    if (cur.length) runs.push(cur);
    best = { runs };
  }

  return { lines: best.runs };
}

// ----------------------------- SEMANTIC COMPILER -----------------------------
function compileWordsToCaptions(rawWords, options = {}) {
  const cfg = Object.assign({}, DEFAULTS, options);

  // 1. Clean words & timestamps
  const words = [];
  for (let i = 0; i < rawWords.length; i++) {
    const rw = rawWords[i];
    let wText = String(rw.word || rw.w || rw.text || '').trim();
    if (!wText) continue;

    // Strip any prompt tags like [emphasis], [whisper], <pause>
    wText = wText.replace(/\[\/?[\w\s-]+\]/g, '').replace(/<\/?[\w\s-]+>/g, '').trim();
    if (!wText) continue;

    const s = Number(rw.start !== undefined ? rw.start : (rw.s !== undefined ? rw.s : 0));
    let e = Number(rw.end !== undefined ? rw.end : (rw.e !== undefined ? rw.e : s + 0.3));
    if (e <= s) e = s + 0.25;

    const em = !!(rw.em || rw.isAccent || rw.emphasis);
    words.push({ w: wText, s, e, em });
  }

  if (words.length === 0) {
    throw new Error('No valid words found to compile.');
  }

  // 2. Semantic Clause Pagination
  const gapAfter = idx => (idx + 1 < words.length) ? (words[idx + 1].s - words[idx].e) : Infinity;
  const rawPages = [];
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
    } else if (curLen >= cfg.maxCharsPerPage || curDur >= cfg.maxPageDur) {
      if (!isLast && !badBreak(w, nextW)) shouldFlush = true;
    } else if (isSoft(w) && curLen >= 28) {
      let remainingToTerm = 0;
      for (let k = i + 1; k < words.length; k++) {
        remainingToTerm += words[k].w.length + 1;
        if (isTerm(words[k])) break;
      }
      if (remainingToTerm >= 14 && !isLast && !badBreak(w, nextW)) {
        shouldFlush = true;
      }
    }

    if (shouldFlush || isLast) {
      flush();
    }
  }
  flush();

  // 3. Merge orphan / too-short pages into neighbors
  const pagesW = [];
  for (let i = 0; i < rawPages.length; i++) {
    const p = rawPages[i];
    const dur = p[p.length - 1].e - p[0].s;
    const isOrphan = (p.length === 1 && textOf(p).length <= 6) || (p.length <= 2 && dur < 0.45);

    if (isOrphan) {
      let merged = false;
      if (pagesW.length) {
        const prev = pagesW[pagesW.length - 1];
        const mergedLen = textOf(prev).length + 1 + textOf(p).length;
        if (mergedLen <= cfg.maxCharsPerPage + 8) {
          prev.push(...p);
          merged = true;
          continue;
        }
      }
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

  // 4. Build output pages
  const pages = [];
  let lastEnd = 0;

  for (let pi = 0; pi < pagesW.length; pi++) {
    const pWords = pagesW[pi];
    const pStart = pWords[0].s;
    const pEnd = pWords[pWords.length - 1].e;

    const { lines: lineRuns } = breakIntoLines(pWords, cfg);
    const outLines = [];

    for (const run of lineRuns) {
      let lineText = textOf(run);
      if (cfg.casing === 'upper') lineText = lineText.toUpperCase();

      const hasAccent = run.some(w => w.em);
      outLines.push({
        text: lineText,
        style: hasAccent ? 'accent' : 'base',
        words: run.map(w => ({
          w: (cfg.casing === 'upper') ? w.w.toUpperCase() : w.w,
          s: Number(w.s.toFixed(3)),
          e: Number(w.e.toFixed(3))
        }))
      });
    }

    // Strip trailing period if requested
    if (cfg.stripFinalPeriod && outLines.length) {
      const lastLine = outLines[outLines.length - 1];
      if (lastLine.text.endsWith('.') && !lastLine.text.endsWith('..') && !lastLine.text.endsWith('...')) {
        lastLine.text = lastLine.text.slice(0, -1);
      }
    }

    pages.push({
      id: pi + 1,
      start: Number(pStart.toFixed(3)),
      end: Number(pEnd.toFixed(3)),
      lines: outLines
    });

    lastEnd = Math.max(lastEnd, pEnd);
  }

  return {
    engine: 'NS-Kinetic-Typography-v2.6',
    transcribedAt: new Date().toISOString(),
    duration: Number(lastEnd.toFixed(3)),
    pagesCount: pages.length,
    pages
  };
}

// ----------------------------- TRANSCRIPTION ENGINES -----------------------------

// ENGINE 1: ElevenLabs Scribe STT
async function transcribeWithElevenLabs(audioBuffer, apiKey) {
  console.log('🎙️ Transcribing with ElevenLabs Scribe STT...');
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  formData.append('file', blob, 'audio.mp3');
  formData.append('model_id', 'scribe_v1');
  formData.append('timestamps_granularity', 'word');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs STT error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawWords = (json.words || []).map(w => ({
    word: w.text || w.word,
    start: w.start,
    end: w.end,
    em: false
  }));

  return rawWords;
}

// ENGINE 2: Groq Whisper API (whisper-large-v3)
async function transcribeWithGroq(audioBuffer, apiKey) {
  console.log('⚡ Transcribing with Groq Whisper API (whisper-large-v3)...');
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq Whisper error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawWords = (json.words || []).map(w => ({
    word: w.word,
    start: w.start,
    end: w.end,
    em: false
  }));

  return rawWords;
}

// ENGINE 3: OpenAI Whisper API
async function transcribeWithOpenAI(audioBuffer, apiKey) {
  console.log('🌐 Transcribing with OpenAI Whisper API (whisper-1)...');
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  formData.append('file', blob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Whisper error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawWords = (json.words || []).map(w => ({
    word: w.word,
    start: w.start,
    end: w.end,
    em: false
  }));

  return rawWords;
}

// ENGINE 4: SRT / VTT Subtitle File Parser
function parseSubtitleFile(filePath) {
  console.log(`📄 Parsing subtitle file: ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const rawWords = [];

  const timeRe = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/;
  const blocks = content.replace(/\r\n/g, '\n').split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    let timeLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (timeRe.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const tm = lines[timeLineIdx].match(timeRe);
    const startSec = parseInt(tm[1], 10) * 3600 + parseInt(tm[2], 10) * 60 + parseInt(tm[3], 10) + parseInt(tm[4], 10) / 1000;
    const endSec = parseInt(tm[5], 10) * 3600 + parseInt(tm[6], 10) * 60 + parseInt(tm[7], 10) + parseInt(tm[8], 10) / 1000;

    const textLines = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    const tokenWords = textLines.split(/\s+/).filter(Boolean);

    if (tokenWords.length === 0) continue;

    const blockDur = Math.max(endSec - startSec, 0.3);
    const wordDur = blockDur / tokenWords.length;

    for (let wi = 0; wi < tokenWords.length; wi++) {
      const wStart = startSec + wi * wordDur;
      const wEnd = wStart + wordDur;
      rawWords.push({
        word: tokenWords[wi],
        start: wStart,
        end: wEnd,
        em: false
      });
    }
  }

  return rawWords;
}

// ----------------------------- MAIN CLI ENTRYPOINT -----------------------------
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
========================================================================
  ⚡ NS KINETIC SUBTITLES — Universal Transcriber & Compiler (v2.6)
========================================================================

Usage:
  node transcribe.js <video_or_audio_path> [options]

Supported Inputs:
  • Video:    .mp4, .mov, .mkv, .webm, .avi
  • Audio:    .mp3, .wav, .m4a, .aac, .flac, .ogg
  • Captions: .srt, .vtt

Options:
  --engine <elevenlabs|groq|openai>  Force STT engine (default: auto-detected from .env)
  --out <filename.captions.json>     Custom output path
  --casing <upper|asis>              Text casing (default: upper)
  --max-chars <number>               Max characters per page (default: 52)

Examples:
  node transcribe.js "C:/Videos/promo_reel.mp4"
  node transcribe.js "voiceover.mp3" --engine groq
  node transcribe.js "subs.srt" --out my_custom.captions.json
========================================================================
`);
    process.exit(0);
  }

  const inputPath = path.resolve(args[0]);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  // Determine output path
  let outArgIdx = args.indexOf('--out');
  let outputPath = '';
  if (outArgIdx !== -1 && args[outArgIdx + 1]) {
    outputPath = path.resolve(args[outArgIdx + 1]);
  } else {
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    outputPath = path.join(path.dirname(inputPath), `${baseName}.captions.json`);
  }

  console.log(`\n🎬 Input File:  ${inputPath}`);
  console.log(`🎯 Output File: ${outputPath}`);

  const ext = path.extname(inputPath).toLowerCase();
  let rawWords = [];

  // 1. Check if subtitle file (.srt, .vtt)
  if (ext === '.srt' || ext === '.vtt') {
    rawWords = parseSubtitleFile(inputPath);
  } else {
    // 2. Extract or read Audio
    let audioBuffer = null;
    const isVideo = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv'].includes(ext);

    if (isVideo) {
      const ffmpeg = findFfmpeg();
      if (!ffmpeg) {
        console.error('❌ Error: ffmpeg is required to extract audio from video files.');
        console.error('   Please install ffmpeg or pass an audio file (.mp3 / .wav) directly.');
        process.exit(1);
      }
      const tempAudioPath = path.join(path.dirname(inputPath), `temp_${Date.now()}.mp3`);
      console.log(`🎞️ Extracting audio track via ffmpeg...`);
      try {
        execSync(`"${ffmpeg}" -y -i "${inputPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -q:a 4 "${tempAudioPath}"`, { stdio: 'ignore' });
        audioBuffer = fs.readFileSync(tempAudioPath);
        fs.unlinkSync(tempAudioPath);
      } catch (errFfmpeg) {
        if (fs.existsSync(tempAudioPath)) try { fs.unlinkSync(tempAudioPath); } catch(e) {}
        console.error('❌ ffmpeg audio extraction failed:', errFfmpeg.message);
        process.exit(1);
      }
    } else {
      audioBuffer = fs.readFileSync(inputPath);
    }

    // 3. Select Transcription Engine
    let engineChoice = '';
    const engineArgIdx = args.indexOf('--engine');
    if (engineArgIdx !== -1 && args[engineArgIdx + 1]) {
      engineChoice = args[engineArgIdx + 1].toLowerCase();
    }

    if (!engineChoice) {
      if (process.env.GROQ_API_KEY) engineChoice = 'groq';
      else if (process.env.OPENAI_API_KEY) engineChoice = 'openai';
      else if (process.env.ELEVENLABS_API_KEY) engineChoice = 'elevenlabs';
      else {
        console.error('❌ Error: No API keys found in .env (ELEVENLABS_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY).');
        console.error('   Please add your API key to .env or pass an .srt/.vtt file.');
        process.exit(1);
      }
    }

    if (engineChoice === 'groq') {
      if (!process.env.GROQ_API_KEY) {
        console.error('❌ Error: GROQ_API_KEY not found in .env');
        process.exit(1);
      }
      rawWords = await transcribeWithGroq(audioBuffer, process.env.GROQ_API_KEY);
    } else if (engineChoice === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ Error: OPENAI_API_KEY not found in .env');
        process.exit(1);
      }
      rawWords = await transcribeWithOpenAI(audioBuffer, process.env.OPENAI_API_KEY);
    } else if (engineChoice === 'elevenlabs') {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.error('❌ Error: ELEVENLABS_API_KEY not found in .env');
        process.exit(1);
      }
      rawWords = await transcribeWithElevenLabs(audioBuffer, process.env.ELEVENLABS_API_KEY);
    } else {
      console.error(`❌ Error: Unknown engine "${engineChoice}". Use elevenlabs, groq, or openai.`);
      process.exit(1);
    }
  }

  console.log(`✅ Extracted ${rawWords.length} words with word-level timestamps.`);

  // 4. Compile with v2.6 Semantic Pagination Engine
  console.log(`🧠 Compiling with v2.6 Semantic Clause Pagination Engine...`);
  const captionData = compileWordsToCaptions(rawWords, {
    casing: args.includes('--casing') ? args[args.indexOf('--casing') + 1] : DEFAULTS.casing,
    maxCharsPerPage: args.includes('--max-chars') ? parseInt(args[args.indexOf('--max-chars') + 1], 10) : DEFAULTS.maxCharsPerPage
  });

  fs.writeFileSync(outputPath, JSON.stringify(captionData, null, 2), 'utf8');

  console.log(`\n========================================================================`);
  console.log(`🎉 SUCCESS! Compiled ${captionData.pages.length} semantic subtitle pages (${captionData.duration}s)`);
  console.log(`📁 File saved to: ${outputPath}`);
  console.log(`========================================================================\n`);

  console.log(`📊 Storyboard Preview (${captionData.pages.length} pages):`);
  const previewPages = captionData.pages.slice(0, 10);
  for (const page of previewPages) {
    const timeCode = `${page.start.toFixed(2)}s – ${page.end.toFixed(2)}s`;
    const linesStr = page.lines.map(l => l.text).join(' / ');
    console.log(`   [${pad(page.id, 3)}] (${timeCode}): ${linesStr}`);
  }
  if (captionData.pages.length > 10) {
    console.log(`   ... and ${captionData.pages.length - 10} more pages.`);
  }

  console.log(`\n🎬 HOW TO USE IN AFTER EFFECTS:`);
  console.log(`  1. Open After Effects ➔ Window ➔ elevenlabs-after-effects-subtitles.jsx`);
  console.log(`  2. Click "📂 Browse JSON" and choose: ${path.basename(outputPath)}`);
  console.log(`  3. Choose your Kinetic Mode (Mode 1..6) and click "🎬 BUILD SUBTITLES"!\n`);
}

function pad(n, len) {
  let s = String(n);
  while (s.length < len) s = '0' + s;
  return s;
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Fatal Error:', err.message || err);
    process.exit(1);
  });
}

module.exports = {
  compileWordsToCaptions,
  parseSubtitleFile
};
