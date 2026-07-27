# NS Kinetic Typography Engine 🎬⚡
> **Automated ElevenLabs TTS to After Effects Subtitle Pipeline**  
> *Generate broadcast-quality animated captions from voiceovers in seconds.*

[![After Effects](https://img.shields.io/badge/After_Effects-2024+-CC77FF?logo=adobeaftereffects&logoColor=white)](https://www.adobe.com/products/aftereffects.html)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-API_v1-000000?logo=elevenlabs&logoColor=white)](https://elevenlabs.io)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Overview / Описание

**NS Kinetic Typography Engine** is a high-speed production pipeline for content creators, motion designers, and video editors (TikTok, Instagram Reels, YouTube Shorts). 

It automatically converts **ElevenLabs Voiceovers (TTS)** into perfectly formatted, frame-accurate **After Effects subtitle text layers** using exact character-level timestamps and broadcast typography layout rules.

---

## 🔥 Key Features / Capabilities

- ⏱ **Character-Level Timing**: Uses ElevenLabs timestamp alignment API for sub-frame subtitle precision.
- 🎨 **Master Layer Style Inheritance**: Inherits all fonts, colors, Sapphire effects, glow, and animators from `_STYLE_BASE` and `_STYLE_ACCENT` comp layers.
- ✍️ **Emphasis & Accent Words**: Mark `*words with asterisks*` in your script to pull them onto distinct accent styling lines.
- 📜 **Linguistic Line-Breaking**: Smart pagination prevents dangling prepositions (`a`, `the`, `in`, `to`) and locks numbers to units (`12%`, `$500`).
- ⚡ **CPS & Speed Guard**: Warns if reading speed exceeds 17 chars/sec to ensure maximum viewer retention.
- 🔁 **100% Idempotent**: One-click re-runs safely overwrite previous subtitle layers without duplicating comp clutter.

---

## 🛠 Workflow Pipeline / Схема работы

```
 script.txt (with *emphasis*)
           │
           ▼
    vo_generate.js ──────► ElevenLabs API (with-timestamps)
           │
           ├─► vo.mp3 / vo.wav (Voiceover Audio)
           └─► vo.align.json (Character Timestamps)
           │
           ▼
   caption_compile.js ───► Linguistic Formatting & CPS Guard
           │
           └─► vo.captions.json
           │
           ▼
  build_subs.jsx (in AE) ─► CAP001_L1, CAP001_ACC (Text Layers)
```

---

## 🚀 Quick Start Guide / Быстрый запуск

### 1) Prerequisites
- **Node.js 18+**
- **Adobe After Effects** (AE 2020+)
- **ElevenLabs API Key** (`ELEVENLABS_API_KEY`)

### 2) Generate VO & Character Alignment
Write your script in plain text. Use `*asterisks*` to highlight key words for accent lines:
```bash
$env:ELEVENLABS_API_KEY="your_elevenlabs_api_key"
node vo_generate.js --text script.txt --voice <VOICE_ID> --out vo_01
```
*Outputs: `vo_01.mp3` and `vo_01.align.json`*

### 3) Compile Subtitles & Punctuation
```bash
node caption_compile.js vo_01.align.json --config compile.config.json
```
*Outputs: `vo_01.captions.json`*

### 4) Build Layers in After Effects
1. In your active AE Comp, create two hidden text layers:
   - `_STYLE_BASE` (Normal caption line)
   - `_STYLE_ACCENT` (Emphasis line)
2. Run `File > Scripts > Run Script File…` ➔ select `build_subs.jsx` ➔ choose `vo_01.captions.json`.
3. All subtitle text layers will be created with word markers, correct timing, and master styling!

---

## 🏷 Keywords & Topics (SEO)
`after-effects` `subtitles` `captions` `elevenlabs` `text-to-speech` `motion-design` `extendscript` `jsx` `kinetic-typography` `auto-captions` `tiktok-editing` `reels-editing` `youtube-shorts`
