#!/usr/bin/env node
/**
 * fetch_history_captions.js — NS ElevenLabs History Subtitle Extractor & Multi-Part Merger
 *
 * Extract subtitles & audio from 1 OR MULTIPLE ElevenLabs Generation IDs (history_item_ids).
 * Automatically offsets timestamps for multi-part shorts!
 *
 * Usage Single ID:
 *   node fetch_history_captions.js GpdDB6kuQfObHnpFNDTl --out part1
 *
 * Usage Multi-ID (Combines 4 voiceover takes into 1 master timeline):
 *   node fetch_history_captions.js ID_1 ID_2 ID_3 ID_4 --out full_short
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: 'C:/Users/root/Desktop/NULLSPREAD/AfterEffects/ae-subs/.env' });
require('dotenv').config({ path: 'C:/Users/root/Desktop/NULLSPREAD/.env' });

function getArg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  return process.argv[i + 1] || def;
}

const OUT = getArg('out', null);

// Filter positional IDs (excluding flags and flag values)
const ids = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    i++; // skip next arg (flag value)
    continue;
  }
  ids.push(a);
}

if (!ids.length) {
  console.error('Usage: node fetch_history_captions.js <Generation_ID_1> [ID_2 ID_3 ...] [--out basename]');
  process.exit(1);
}

const finalOut = OUT || ids[0];
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error('ELEVENLABS_API_KEY env var is not set in .env'); process.exit(1); }

(async () => {
  console.log(`[fetch_history] Processing ${ids.length} Generation ID(s)...`);

  const combinedCharacters = [];
  const combinedStartTimes = [];
  const combinedEndTimes = [];
  const combinedParts = [];
  const combinedEmphasisSpans = [];
  let combinedText = '';
  let timeOffset = 0;
  const audioBuffers = [];

  function parsePromptTags(rawText) {
    let plain = '';
    const emphasisSpans = [];
    let i = 0;
    let inEmphasis = false;
    let spanStart = -1;

    while (i < rawText.length) {
      const remaining = rawText.slice(i);
      
      const openEmMatch = remaining.match(/^(\[(emphasis|accent)\]|<(emphasis|accent)>|\*)/i);
      if (openEmMatch) {
        if (!inEmphasis) {
          inEmphasis = true;
          spanStart = plain.length;
        }
        i += openEmMatch[0].length;
        continue;
      }

      const closeEmMatch = remaining.match(/^(\[\/(emphasis|accent)\]|<\/(emphasis|accent)>|\*)/i);
      if (closeEmMatch && inEmphasis) {
        inEmphasis = false;
        if (plain.length > spanStart) {
          emphasisSpans.push([spanStart, plain.length]);
        }
        i += closeEmMatch[0].length;
        continue;
      }

      const otherTagMatch = remaining.match(/^(\[\/?[\w\s-]+\]|<\/?[\w\s-]+>)/);
      if (otherTagMatch) {
        i += otherTagMatch[0].length;
        continue;
      }

      plain += rawText[i];
      i++;
    }

    if (inEmphasis && plain.length > spanStart) {
      emphasisSpans.push([spanStart, plain.length]);
    }

    return { plain, emphasisSpans };
  }

  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    console.log(`[fetch_history] [${idx + 1}/${ids.length}] Fetching ID: ${id} ...`);

    const metaRes = await fetch('https://api.elevenlabs.io/v1/history/' + encodeURIComponent(id), {
      headers: { 'xi-api-key': API_KEY }
    });

    if (!metaRes.ok) {
      const t = await metaRes.text().catch(() => '');
      console.error(`[fetch_history] HTTP ${metaRes.status} for ${id} — ${t.slice(0, 300)}`);
      process.exit(1);
    }

    const item = await metaRes.json();
    if (!item.alignments || !item.alignments.alignment) {
      console.error(`[fetch_history] No alignment data found in item ${id}.`);
      process.exit(1);
    }

    // Download audio MP3 chunk
    const audioRes = await fetch('https://api.elevenlabs.io/v1/history/' + encodeURIComponent(id) + '/audio', {
      headers: { 'xi-api-key': API_KEY }
    });

    if (!audioRes.ok) {
      console.error(`[fetch_history] Failed to download audio for ${id}. Status: ${audioRes.status}`);
      process.exit(1);
    }

    const audioBuf = Buffer.from(await audioRes.arrayBuffer());
    audioBuffers.push(audioBuf);

    const alg = item.alignments.alignment;
    const rawText = item.text || alg.characters.join('');
    const { plain: cleanItemText, emphasisSpans: itemEmSpans } = parsePromptTags(rawText);

    // Track emphasis spans offset by combinedText length
    const textStartOffset = combinedText ? combinedText.length + 1 : 0;
    for (const [s0, s1] of itemEmSpans) {
      combinedEmphasisSpans.push([s0 + textStartOffset, s1 + textStartOffset]);
    }

    // If not the first audio part, insert space separator into character alignment
    if (idx > 0 && combinedCharacters.length > 0) {
      var lastEnd = combinedEndTimes[combinedEndTimes.length - 1] || timeOffset;
      combinedCharacters.push(' ');
      combinedStartTimes.push(lastEnd);
      combinedEndTimes.push(timeOffset);
      combinedParts.push(idx);
    }

    // Clean prompt tags from character alignment stream
    let cIdx = 0;
    while (cIdx < alg.characters.length) {
      const remainingChars = alg.characters.slice(cIdx).join('');
      const tagMatch = remainingChars.match(/^(\[\/?[\w\s-]+\]|<\/?[\w\s-]+>|\*)/i);
      if (tagMatch) {
        cIdx += tagMatch[0].length;
        continue;
      }

      combinedCharacters.push(alg.characters[cIdx]);
      combinedStartTimes.push(alg.character_start_times_seconds[cIdx] + timeOffset);
      combinedEndTimes.push(alg.character_end_times_seconds[cIdx] + timeOffset);
      combinedParts.push(idx);
      cIdx++;
    }

    // Add space between text parts
    combinedText += (combinedText ? ' ' : '') + cleanItemText;

    // Update time offset to end of current clip + short pause
    const lastEndTime = alg.character_end_times_seconds[alg.character_end_times_seconds.length - 1] || 0;
    timeOffset += lastEndTime + 0.15; // 0.15s gap between clips
  }

  // Save concatenated MP3 audio
  const mp3File = finalOut + '.mp3';
  fs.writeFileSync(mp3File, Buffer.concat(audioBuffers));
  console.log('[fetch_history] Saved combined audio: ' + mp3File);

  // Save master alignment sidecar
  const sidecar = {
    version: 1,
    created: new Date().toISOString(),
    ids: ids,
    audio_file: path.basename(mp3File),
    text_plain: combinedText,
    emphasis_spans: combinedEmphasisSpans,
    alignment: {
      characters: combinedCharacters,
      character_start_times_seconds: combinedStartTimes,
      character_end_times_seconds: combinedEndTimes,
      character_parts: combinedParts
    }
  };

  const alignFile = finalOut + '.align.json';
  fs.writeFileSync(alignFile, JSON.stringify(sidecar, null, 2));
  console.log('[fetch_history] Saved master alignment: ' + alignFile);

  // Compile to master captions.json for After Effects
  console.log('[fetch_history] Compiling master captions for After Effects...');
  const compilerPath = path.join(__dirname, 'caption_compile.js');
  try {
    execSync(`node "${compilerPath}" "${alignFile}" --out "${finalOut}.captions.json"`, { stdio: 'inherit' });
    console.log('[fetch_history] SUCCESS! Generated master captions file: ' + finalOut + '.captions.json');
  } catch (e) {
    console.error('[fetch_history] Failed to compile captions:', e.message);
  }
})();
