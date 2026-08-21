#!/usr/bin/env node
/**
 * vo_generate.js — NS VO generator (Phase 0)
 *
 * Text -> ElevenLabs TTS with character-level timestamps.
 * Saves:  {out}.mp3|.wav  +  {out}.align.json  (timing sidecar for caption_compile.js)
 *
 * Usage:
 *   ELEVENLABS_API_KEY=xi-... node vo_generate.js --text script.txt --voice VOICE_ID --out vo_delisting_01
 *
 * Options:
 *   --text <file>        script file (UTF-8). Use *word* to mark emphasis (accent line in subs).
 *   --voice <voice_id>   ElevenLabs voice id (required)
 *   --out <basename>     output basename, no extension (required)
 *   --model <id>         default: eleven_multilingual_v2
 *   --format mp3|wav     default: mp3  (wav = pcm_44100 wrapped into a WAV header)
 *   --stability <0..1>   default 0.45
 *   --similarity <0..1>  default 0.80
 *   --style <0..1>       default 0.15
 *   --no-speaker-boost   disable speaker boost (default: on)
 *
 * Notes:
 *   - Requires Node 18+ (built-in fetch).
 *   - Numbers: write them as you want them DISPLAYED ($0.41, 12.3%) — TTS normalizes
 *     pronunciation itself; `alignment` maps timings back to your original characters.
 *   - Emphasis markers (*...*) are stripped before sending to TTS; word indices are
 *     stored in align.json meta for the compiler.
 */

'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ---------- args ----------
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const TEXT_FILE = arg('text');
const VOICE_ID = arg('voice');
const OUT = arg('out');
const MODEL = arg('model', 'eleven_multilingual_v2');
const FORMAT = String(arg('format', 'mp3')).toLowerCase();
const STABILITY = parseFloat(arg('stability', '0.45'));
const SIMILARITY = parseFloat(arg('similarity', '0.80'));
const STYLE = parseFloat(arg('style', '0.15'));
const SPEAKER_BOOST = arg('no-speaker-boost', false) === false;

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) die('ELEVENLABS_API_KEY env var is not set.');
if (!TEXT_FILE || !VOICE_ID || !OUT) die('Required: --text <file> --voice <voice_id> --out <basename>');

function die(msg) { console.error('[vo_generate] ERROR: ' + msg); process.exit(1); }

// ---------- read script + parse *emphasis* ----------
const raw = fs.readFileSync(TEXT_FILE, 'utf8').replace(/\r\n/g, '\n').trim();
if (!raw) die('Script file is empty.');

// Strip [emphasis]...[/emphasis], [accent]...[/accent], *...* markers, remember emphasized character spans in the PLAIN text.
let plain = '';
const emphasisSpans = []; // [startChar, endChar) in plain text
{
  let i = 0, inEm = false, spanStart = -1;
  while (i < raw.length) {
    const remaining = raw.slice(i);
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
    plain += raw[i]; i++;
  }
  if (inEm && plain.length > spanStart) emphasisSpans.push([spanStart, plain.length]); // unclosed
}

if (plain.length > 4500) {
  console.warn('[vo_generate] WARN: script is ' + plain.length + ' chars — long texts may hit model limits. 40s VO is usually < 900 chars.');
}

// ---------- call ElevenLabs ----------
const outputFormat = FORMAT === 'wav' ? 'pcm_44100' : 'mp3_44100_128';
const url = 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(VOICE_ID)
          + '/with-timestamps?output_format=' + outputFormat;

const body = {
  text: plain,
  model_id: MODEL,
  voice_settings: {
    stability: STABILITY,
    similarity_boost: SIMILARITY,
    style: STYLE,
    use_speaker_boost: SPEAKER_BOOST
  }
};

(async () => {
  console.log('[vo_generate] requesting TTS with timestamps…');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) die('401 Unauthorized — check ELEVENLABS_API_KEY.');
    if (res.status === 422) die('422 Unprocessable — check voice_id / text. Response: ' + t.slice(0, 400));
    die('HTTP ' + res.status + ' — ' + t.slice(0, 400));
  }

  const data = await res.json();
  if (!data.audio_base64) die('Response has no audio_base64 — unexpected format.');
  if (!data.alignment) console.warn('[vo_generate] WARN: no alignment in response — captions will not be possible.');

  // ---------- write audio ----------
  const audioBuf = Buffer.from(data.audio_base64, 'base64');
  let audioFile;
  if (FORMAT === 'wav') {
    audioFile = OUT + '.wav';
    fs.writeFileSync(audioFile, wrapWav(audioBuf, 44100, 1, 16));
  } else {
    audioFile = OUT + '.mp3';
    fs.writeFileSync(audioFile, audioBuf);
  }

  // ---------- write align sidecar ----------
  const sidecar = {
    version: 1,
    created: new Date().toISOString(),
    voice_id: VOICE_ID,
    model_id: MODEL,
    audio_file: path.basename(audioFile),
    text_plain: plain,
    emphasis_spans: emphasisSpans,
    alignment: data.alignment || null,               // timings for ORIGINAL characters
    normalized_alignment: data.normalized_alignment || null // how TTS actually read it (debug)
  };
  const alignFile = OUT + '.align.json';
  fs.writeFileSync(alignFile, JSON.stringify(sidecar));

  const dur = data.alignment
    ? data.alignment.character_end_times_seconds[data.alignment.character_end_times_seconds.length - 1]
    : null;
  console.log('[vo_generate] OK  audio: ' + audioFile + (dur ? ('  (' + dur.toFixed(2) + 's)') : ''));
  console.log('[vo_generate] OK  align: ' + alignFile);
  console.log('[vo_generate] next: node caption_compile.js ' + alignFile);
})().catch(e => die(e.message || String(e)));

// ---------- minimal WAV wrapper for raw PCM S16LE ----------
function wrapWav(pcm, sampleRate, channels, bits) {
  const byteRate = sampleRate * channels * bits / 8;
  const blockAlign = channels * bits / 8;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(blockAlign, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
