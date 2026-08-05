# ElevenLabs After Effects Subtitles (v2.0)

Automated ElevenLabs TTS to Adobe After Effects Subtitle Pipeline & Native ScriptUI Dockable Panel GUI.

[![After Effects](https://img.shields.io/badge/After_Effects-2020+-CC77FF?logo=adobeaftereffects&logoColor=white)](https://www.adobe.com/products/aftereffects.html)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-API_v1-000000?logo=elevenlabs&logoColor=white)](https://elevenlabs.io)
[![Animation Composer](https://img.shields.io/badge/Animation_Composer-Compatible-7C3AED)](https://misterhorse.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**ElevenLabs After Effects Subtitles v2.0** is a high-speed production pipeline and native After Effects GUI panel designed for short-form video creators (TikTok, Instagram Reels, YouTube Shorts).

It automatically converts ElevenLabs Voiceovers (or web-generated **Generation IDs**) into frame-accurate, pre-timed After Effects subtitle text layers. Featuring a **FreeFlow Studio-inspired dark GUI panel**, it supports **80ms Lead-In pre-display timing**, **Timeline-Aware Audio Syncing**, **4 Kinetic Layout Modes**, and full **Animation Composer (Mister Horse)** preset integration.

---

## Key Features

* **FreeFlow Studio Dark GUI Panel (`elevenlabs-after-effects-subtitles.jsx`):** Native dockable panel inside After Effects (`Window > elevenlabs-after-effects-subtitles`).
* **1-Click Generation ID Fetcher:** Paste 1 or multiple ElevenLabs Generation IDs directly into the panel to auto-fetch audio, alignment timestamps, and build subtitle layers in seconds.
* **Timeline-Aware Audio Layer Syncing:** Manually arrange 4 voiceover clips on the AE timeline with custom pauses — click **Sync Subtitles**, and captions automatically align to each audio layer's exact `inPoint`.
* **80ms Pre-Display Lead-In Offset:** Subtitles appear **80ms before spoken audio** for effortless human readability.
* **4 Kinetic Text Layout Modes:**
  1. **Mode 1: Broadcast Block `[L]`** — 2-line smart line breaks with accent lines (prevents dangling prepositions).
  2. **Mode 2: Single Word Flash / Pop `[W]`** — 1 word at a time in center column (Hormozi / MrBeast high-retention style).
  3. **Mode 3: Kinetic Cascade Ladder `[C]`** — Vertical ladder stacking.
  4. **Mode 4: Highlight Tracker `[T]` + `[HI]`** — Full sentence text layer with isolated vector highlight box.
* **Animation Composer (Mister Horse) Integration:**
  * **Auto-Centering Anchor Point:** Automatically calculates `sourceRectAtTime()` and sets Anchor Point to exact Center-Center `[left + width/2, top + height/2]` so AC presets (Scale Bounce, Overshoot, Pop-in) scale cleanly without position drift.
  * **System Layer Prefixes:** Layers are tagged with `[L]`, `[W]`, `[C]`, `[T]`, `[HI]`. Search `[W]` in AE timeline filter, select all, and apply AC animation presets in 1 click.
* **Auto-Scaling & Safety Guard (85%):** Automatically scales down long words (`TRILLION-DOLLAR`) so text never overflows 9:16 vertical video borders or gets covered by TikTok UI buttons.
* **Style Preset Support (Including `None`):** Supports custom manual styling on master layers (`_STYLE_BASE` and `_STYLE_ACCENT`) without resetting font choices or Sapphire effects.

---

## Installation Guide

### Option 1: Native Dockable Panel (Recommended)
1. Copy `elevenlabs-after-effects-subtitles.jsx` into your After Effects ScriptUI Panels directory:  
   `C:\Program Files\Adobe\Adobe After Effects <Version>\Support Files\Scripts\ScriptUI Panels\`
2. Restart After Effects.
3. Open panel via top menu: **`Window` ➔ `elevenlabs-after-effects-subtitles`**.

### Option 2: Direct Script Execution
1. In After Effects, navigate to **`File` ➔ `Scripts` ➔ `Run Script File…`**
2. Select `elevenlabs-after-effects-subtitles.jsx`.

---

## Workflow & CLI Utilities

### 1) Fetch & Build from ElevenLabs Generation ID(s)
Extract audio and timestamp alignment directly from 1 or multiple Web UI Generation IDs:
```bash
node fetch_history_captions.js GpdDB6kuQfObHnpFNDTl 8Bt7KyBhfPy8IEHvkv4R --out full_short
```
*Outputs: `full_short.mp3`, `full_short.align.json`, and `full_short.captions.json`.*

### 2) Align Existing Audio File (.mp3 / .wav)
Extract character timestamps for any existing audio file using ElevenLabs Forced Alignment API:
```bash
node align_audio.js --audio take_01.mp3 --text "Text spoken in audio..." --out take_01
```

### 3) Direct TTS Generation
Generate TTS audio and character timestamps from a plain text script (`script.txt`):
```bash
node vo_generate.js --text script.txt --voice <VOICE_ID> --out vo_01
```

---

## Technical Specifications

| Parameter | Value |
|---|---|
| Panel Language | ExtendScript (JSX / ScriptUI) |
| Alignment Engine | ElevenLabs Per-Character API / Forced Alignment |
| Default Lead-In | 80 ms (Pre-display offset) |
| Default Tail-Out | 150 ms (Hold duration) |
| Safe Margin Guard | 85% Max Comp Width Auto-Scale |
| Default Baseline | 72% Y-Axis (Lower Third) |
| System Prefixes | `[L]` Line, `[W]` Word, `[C]` Cascade, `[T]` Text, `[HI]` Highlight Box |

---

## License

MIT License. Free for personal and commercial video production.
