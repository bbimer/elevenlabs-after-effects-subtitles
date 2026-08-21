#!/usr/bin/env node
/**
 * align_audio.js — NS Forced Alignment Tool for Existing Audio
 *
 * Align ANY existing audio file (.mp3 / .wav / ElevenLabs takes) with text
 * using ElevenLabs Forced Alignment API (POST /v1/forced-alignment).
 *
 * Saves: {out}.align.json  -> automatically runs caption_compile.js -> {out}.captions.json
 *
 * Usage:
 *   node align_audio.js --audio take_01.mp3 --text "Text spoken in audio..." [--out part1]
 *   node align_audio.js --audio take_01.mp3 --text script.txt [--out part1]
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

const AUDIO_FILE = arg('audio');
let TEXT = arg('text');
const OUT = arg('out', AUDIO_FILE ? path.basename(AUDIO_FILE, path.extname(AUDIO_FILE)) : 'output');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) die('ELEVENLABS_API_KEY env var is not set in .env');
if (!AUDIO_FILE || !TEXT) die('Usage: node align_audio.js --audio <file.mp3> --text <script.txt or "text"> [--out basename]');

if (!fs.existsSync(AUDIO_FILE)) die('Audio file not found: ' + AUDIO_FILE);

// If --text is a path to a file, read it
if (fs.existsSync(TEXT)) {
  TEXT = fs.readFileSync(TEXT, 'utf8').replace(/\r\n/g, '\n').trim();
}

if (!TEXT) die('Text input is empty.');

// Parse [emphasis]...[/emphasis], [accent]...[/accent], *emphasis* markers from text
let plain = '';
const emphasisSpans = [];
{
  let i = 0, inEm = false, spanStart = -1;
  while (i < TEXT.length) {
    const remaining = TEXT.slice(i);
    const openEmMatch = remaining.match(/^(\[(emphasis|accent)\]|<(emphasis|accent)>|\*)/i);
    if (openEmMatch) {
      if (!inEm) { inEm = true; spanStart = plain.length; }
      i += openEmMatch[0].length;
      continue;
    }
    const closeEmMatch = remaining.match(/^(\[\/(emphasis|accent)\]|<\/(emphasis|accent)>|\*)/i);
    if (closeEmMatch && inEm) {
      inEm = false;
      if (plain.length > spanStart) emphasisSpans.push([spanStart, plain.length]);
      i += closeEmMatch[0].length;
      continue;
    }
    const otherTagMatch = remaining.match(/^(\[\/?[\w\s-]+\]|<\/?[\w\s-]+>)/);
    if (otherTagMatch) {
      i += otherTagMatch[0].length;
      continue;
    }
    plain += TEXT[i]; i++;
  }
  if (inEm && plain.length > spanStart) emphasisSpans.push([spanStart, plain.length]);
}

function die(msg) { console.error('[align_audio] ERROR: ' + msg); process.exit(1); }

(async () => {
  console.log('[align_audio] Aligning audio file: ' + AUDIO_FILE + ' ...');

  const formData = new FormData();
  const fileBuf = fs.readFileSync(AUDIO_FILE);
  const blob = new Blob([fileBuf], { type: 'audio/mpeg' });
  formData.append('file', blob, path.basename(AUDIO_FILE));
  formData.append('text', plain);

  const res = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY
    },
    body: formData
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    die('HTTP ' + res.status + ' — Forced Alignment failed: ' + t.slice(0, 400));
  }

  const data = await res.json();
  const alignment = data.alignment || data;

  const sidecar = {
    version: 1,
    created: new Date().toISOString(),
    audio_file: path.basename(AUDIO_FILE),
    text_plain: plain,
    emphasis_spans: emphasisSpans,
    alignment: alignment
  };

  const alignFile = OUT + '.align.json';
  fs.writeFileSync(alignFile, JSON.stringify(sidecar, null, 2));
  console.log('[align_audio] OK  Generated alignment: ' + alignFile);

  // Automatically compile to captions.json
  const compilerPath = path.join(__dirname, 'caption_compile.js');
  console.log('[align_audio] Compiling captions for After Effects...');
  try {
    execSync(`node "${compilerPath}" "${alignFile}" --out "${OUT}.captions.json"`, { stdio: 'inherit' });
    console.log('[align_audio] SUCCESS! Generated captions file: ' + OUT + '.captions.json');
  } catch (e) {
    console.error('[align_audio] Failed to run caption_compile.js:', e.message);
  }
})().catch(e => die(e.message || String(e)));
