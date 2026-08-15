# ElevenLabs After Effects Subtitles (v2.3)

Automated ElevenLabs TTS to Adobe After Effects Subtitle Pipeline & Native ScriptUI Dockable Panel GUI.

[![After Effects](https://img.shields.io/badge/After_Effects-2020+-CC77FF?logo=adobeaftereffects&logoColor=white)](https://www.adobe.com/products/aftereffects.html)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-API_v1-000000?logo=elevenlabs&logoColor=white)](https://elevenlabs.io)
[![Animation Composer](https://img.shields.io/badge/Animation_Composer-Compatible-7C3AED)](https://misterhorse.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**ElevenLabs After Effects Subtitles v2.3** is a high-speed production pipeline and native After Effects GUI panel designed for short-form video creators (TikTok, Instagram Reels, YouTube Shorts).

It automatically converts ElevenLabs Voiceovers (or web-generated **Generation IDs**) into frame-accurate, pre-timed After Effects subtitle text layers. Featuring a **FreeFlow Studio-inspired dark GUI panel**, it supports **Custom Preset Management**, **Multi-Take Tagging (`[A]`, `[B]`, `[C]`, `[D]`)**, **Line 1 / Line 2 Visual Timeline Label Colors**, **1-Click Batch Selection Tools**, **Timeline Playhead (CTI) Sync**, **80ms Lead-In pre-display timing**, **Timeline-Aware Audio Syncing**, and full **Animation Composer (Mister Horse)** preset integration.

---

## Key Features

* **Custom Preset Manager (`user_presets.json`):**
  * Save custom typography styles (Font, Size, Fill Color, Stroke, Tracking, All Caps, Italic) in 1 click (`💾 Save Preset...`).
  * Saved presets are permanently stored in `user_presets.json` and appear with a `★` in the preset dropdown across projects.
  * Delete outdated presets easily with `🗑️ Delete Preset`.
* **Built-in Luxury Script Typography Preset:**
  * Base Line: **Arial Black** (Bold, All Caps, Clean White).
  * Accent Line: **Good Vibes Pro** (Elegant Cursive Script, Lowercase Accent).
* **Smart Multilingual Clause Segmentation (`caption_compile.js`):**
  * Broadcast-grade clause-level pagination splitting at punctuation marks (`,`, `;`, `:`, `—`, `–`, `-`, `...`, `…`, `.`, `!`, `?`) and acoustic pauses (0.35s+).
  * Inseparable multi-word phrases prevention (`«один и тот же»`, `«тот же»`, `«на этом всё»`, `«exact same»`, `«split second»`, `«link in bio»`).
  * Dangling prepositions & conjunctions guard (`NO_LINE_END` & `NO_LINE_START`) for Russian, Ukrainian, and English.
* **Timeline Line 1 / Line 2 Visual Label Color Coding:**
  * 🔷 **Line 1 (Top):** Tagged `[A_L1]`, color-coded with **Cyan (#14)**.
  * 🔶 **Line 2 (Bottom):** Tagged `[A_L2]`, color-coded with **Orange (#11)**.
  * 💖 **Accent Words:** Tagged `[A_ACC]`, color-coded with **Magenta / Fuchsia (#13)**.
  * 🟢 **Single Word Pop:** Tagged `[A_W]`, color-coded with **Green (#9)**.
  * *Right-click any label chip in AE timeline ➔ `Select Label Group` to select all matching lines in seconds!*
* **1-Click Batch Timeline Selection Tools:**
  * `🔷 Select Line 1 (Top)` — selects all top-line subtitle layers across the active comp.
  * `🔶 Select Line 2 (Mid)` — selects all bottom-line subtitle layers.
  * `💖 Select Accents` — selects all accent text layers.
  * `🎙️ Select Current Take` — selects all layers belonging to a specific voiceover part.
* **Multi-Take Voiceover Tagging (`[A]`, `[B]`, `[C]`, `[D]`...):**
  * Auto-tags multiple voiceover takes when fetching comma-separated Generation IDs.
  * Selector dropdown allows manually choosing specific take tags (`Take A`, `Take B`, `Take C`, `Take D`, etc.).
* **FreeFlow Studio Dark GUI Panel (`elevenlabs-after-effects-subtitles.jsx`):**
  * Native dockable panel inside After Effects (`Window > elevenlabs-after-effects-subtitles`).
* **Timeline Playhead (CTI) & Audio Layer Sync:**
  * Generate subtitles starting at CTI (`comp.time`), or click **📍 Sync to Playhead (CTI)** / **🎵 Sync to Audio** to slide existing captions.
* **4 Kinetic Text Layout Modes:**
  1. **Mode 1: Broadcast Block `[L]`** — 2-line smart line breaks with accent lines.
  2. **Mode 2: Single Word Flash / Pop `[W]`** — 1 word at a time in center column (Hormozi / MrBeast style).
  3. **Mode 3: Kinetic Cascade Ladder `[C]`** — Vertical ladder stacking.
  4. **Mode 4: Highlight Tracker `[T]` + `[HI]`** — Full sentence text layer with isolated vector highlight box.
* **Animation Composer (Mister Horse) Integration:**
  * **Auto-Centering Anchor Point:** Automatically calculates `sourceRectAtTime()` and sets Anchor Point to exact Center-Center `[left + width/2, top + height/2]` for clean scale bounces without position drift.
* **Auto-Scaling & Safety Guard (85%):**
  * Automatically scales down long words so text never overflows 9:16 vertical video borders or gets covered by TikTok / Instagram UI icons.

---

## Installation Guide

### Option 1: Native Dockable Panel (Recommended)
1. Copy `elevenlabs-after-effects-subtitles.jsx` into your After Effects ScriptUI Panels directory:  
   `C:\Program Files\Adobe\Adobe After Effects <Version>\Support Files\Scripts\ScriptUI Panels\`  
   *(or run `deploy.bat` to automatically deploy to installed AE versions)*.
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
| System Prefixes | `[A_L1]`, `[A_L2]`, `[A_ACC]`, `[A_W]`, `[A_C]`, `[A_T]`, `[A_HI]` |
| Timeline Labels | Cyan (#14) Line 1, Orange (#11) Line 2, Magenta (#13) Accent, Green (#9) Word |

---

## License

MIT License. Free for personal and commercial video production.
