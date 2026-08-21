# ElevenLabs After Effects Subtitles (v2.6)

Automated ElevenLabs TTS to Adobe After Effects Kinetic Typography Subtitle Pipeline & Native ScriptUI Dockable Panel GUI.

[![After Effects](https://img.shields.io/badge/After_Effects-2020+-CC77FF?logo=adobeaftereffects&logoColor=white)](https://www.adobe.com/products/aftereffects.html)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-API_v1-000000?logo=elevenlabs&logoColor=white)](https://elevenlabs.io)
[![Animation Composer](https://img.shields.io/badge/Animation_Composer-Compatible-7C3AED)](https://misterhorse.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**ElevenLabs After Effects Subtitles v2.6** is a production-grade kinetic typography pipeline and native After Effects GUI panel engineered specifically for short-form video creators (TikTok, Instagram Reels, YouTube Shorts).

It converts ElevenLabs Voiceovers (or web-generated **Generation IDs**) into frame-accurate, acoustically synchronized After Effects subtitle text layers. Featuring a **FreeFlow Studio-inspired dark GUI panel**, it supports **6 Kinetic Text Layout Modes**, **Semantic Clause Segmentation**, **Automatic ElevenLabs Prompt Tag Stripping**, **Smart Single-Word Punctuation Cleaning**, **15 Curated Aesthetic Multi-Take Timeline Colors**, **Animation Composer Marker Auto-Fitting (35% Speed)**, **7 Designer Style Presets & Custom Preset Management**, and full **Animation Composer (Mister Horse)** integration.

---

## Key Features in v2.6

* **🧠 Semantic Thought Clause Segmentation (`caption_compile.js`):**
  * Subtitles are broken down by **complete semantic thoughts and clauses** rather than rigid mechanical 1-second chunks.
  * Prevents awkward sentence cutoffs or single orphaned trailing words appearing alone on new screens.
* **🏷️ Automatic ElevenLabs Prompt Tag Stripping & Accent Mapping:**
  * Direct support for ElevenLabs technical voice prompts: `[emphasis]...[/emphasis]`, `[accent]...[/accent]`, `[whisper]...[/whisper]`, `[pause]`, `[surprised]`, `<emphasis>`, and `*...*`.
  * Technical prompt tags are automatically stripped from the screen, while emphasized phrases (`8% дороже?`, `$2.6K`) are automatically styled with **`_STYLE_ACCENT`** (contrasting neon/gold colors and fonts).
* **🧹 Smart Single-Word Punctuation Cleaner (Mode 2 & Mode 6):**
  * In single-word flash modes, automatically removes visual punctuation clutter (commas `,`, periods `.`, dashes `-`, semicolons `;`, colons `:`, quotes `""`, ellipsis `...`).
  * Preserves high-energy emotional marks (`!`, `?`) and currency / percentage symbols (`%`, `$`, `€`, `£`, `₽`, `+100%`, `-50%`).
* **⚡ 6 Kinetic Text Layout Modes:**
  1. **Mode 1: Broadcast Block `[L]`** — 2-line smart line breaks with accent lines.
  2. **Mode 2: Single Word Flash / Pop `[W]`** — 1 word at a time in center column (Hormozi / MrBeast style) with clean punctuation.
  3. **Mode 3: Kinetic Cascade Ladder `[C]`** — Vertical ladder stacking with sequential line reveals.
  4. **Mode 4: Highlight Tracker `[T]` + `[HI]`** — Full sentence text layer with isolated vector highlight bounding box.
  5. **Mode 5: Single-Line Stream `[S]`** — Fast, punchy **1-line center subtitles** that keep the frame clean for graphics & footage.
  6. **Mode 6: Karaoke Word-Fill `[K]` / `[KW]`** — Full sentence in sleek 35% opacity with active words glowing in vibrant neon accent as spoken (CapCut style).
* **🌈 Top Aesthetic 15-Color Multi-Take Timeline Palette (`[A]`, `[B]`, `[C]`...):**
  * Automatically detects subsequent generations on the timeline and cycles through 15 high-contrast designer colors:
    * 🟦 **Take A (Phase 1):** Cyan (#14)
    * 🟪 **Take B (Phase 2):** Magenta (#13)
    * 🟧 **Take C (Phase 3):** Orange (#11)
    * 🟣 **Take D (Phase 4):** Purple (#10)
    * 🌊 **Take E (Phase 5):** Aqua / Seafoam (#3)
    * 🟩 **Take F (Phase 6):** Green (#9)
    * 🟨 **Take G (Phase 7):** Yellow (#2)
    * 🌸 **Take H (Phase 8):** Pink (#4)
    * 🔵 **Take I (Phase 9):** Blue (#8)
    * 🪻 **Take J (Phase 10):** Lavender (#5)
    * 🍑 **Take K (Phase 11):** Peach (#6)
    * 🟥 **Take L (Phase 12):** Red (#1)
    * 🌿 **Take M (Phase 13):** Dark Green (#16)
* **🎵 Auto-Import & Place Audio Track (.mp3 / .wav) on Timeline:**
  * Optional toggle `[ ] 🎵 Auto-Import & Place Audio Track` automatically imports the ElevenLabs voiceover into the project and positions it directly under the generated subtitle layers, tinted with the same take color.
* **⚡ Animation Composer Marker Auto-Fit (35% Speed):**
  * Automatically repositions `[TR In]` (In-Transition) markers across all (or selected) subtitle layers to a precise percentage of each layer's duration (default **35%**).
  * Eliminates the tedious need to manually drag markers on 40+ layers — animation speed scales proportionally to word length in 0.1 seconds!
* **🎨 7 Curated Designer Style Presets & Custom Preset Manager:**
  * **✨ Luxury Editorial:** Clean bold white sans + Champagne Gold elegant script (*Good Vibes Pro / Georgia Italic*).
  * **⚡ Tokyo Cyberpunk:** Electric Cyan base + Acid Neon Green accents with crisp black outlines.
  * **🔥 Hormozi Viral:** Alex Hormozi signature gold yellow + punch red with heavy 6px black stroke.
  * **💎 Crypto Terminal:** Electric Matrix green accent on clean white obsidian text.
  * **🌅 Sunset Pop:** Vibrant tangerine orange + hot pink bubblegum accents.
  * **🧊 Minimalist Clean:** Soft ice blue + pure white with wide letter spacing.
  * **🖤 High-Contrast Viral:** Pure white + bright yellow with universal high-contrast black border.
  * **Custom Preset Storage:** Save any customized master layer typography into `user_presets.json` in 1 click (`💾 Save Preset...`).
* **100% Comprehensive Typography Style Syncing:**
  * When updating or pushing master styles (`✨ Apply Style to Subtitles`), copies 100% of character & paragraph settings: **Vertical Scale**, **Horizontal Scale**, **Tracking**, **Auto-Leading**, **Baseline Shift**, **Faux Bold**, **All Caps**, **Fill**, **Stroke**, and **Paragraph Alignment**.
* **1-Click Batch Timeline Selection Tools:**
  * `🔷 Select Line 1 (Top)` — selects all top-line subtitle layers across the active comp.
  * `🔶 Select Line 2 (Mid)` — selects all bottom-line subtitle layers.
  * `💖 Select Accents` — selects all accent / highlight text layers.
  * `🎙️ Select Current Take` — selects all layers belonging to a specific voiceover part.
* **Auto-Scaling & Safety Guard (85%):**
  * Automatically scales down long words so text never overflows 9:16 vertical video borders or gets covered by TikTok / Instagram UI icons.

---

## Installation Guide

### Option 1: Native Dockable Panel (Recommended)
1. Copy `elevenlabs-after-effects-subtitles.jsx` into your After Effects ScriptUI Panels directory:  
   `C:\Program Files\Adobe\Adobe After Effects <Version>\Support Files\Scripts\ScriptUI Panels\`  
   *(or run `deploy.bat` to automatically deploy to installed AE versions)*.
2. Restart After Effects.
3. Open panel via top menu: **`Window` ➔ `elevenlabs-after-effects-subtitles.jsx`**.

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

## Repository Structure

```
ae-subs/
├── elevenlabs-after-effects-subtitles.jsx  # Complete ScriptUI GUI panel for After Effects
├── build_subs.jsx                          # Standalone direct ExtendScript builder
├── caption_compile.js                      # Semantic clause-level phonetic caption compiler
├── fetch_history_captions.js               # ElevenLabs API history & alignment fetcher
├── align_audio.js                          # Audio alignment utility
├── vo_generate.js                          # Direct TTS generation utility
├── deploy.bat                              # 1-click deploy to After Effects ScriptUI directory
├── user_presets.json                       # Persistent user presets storage
└── .env.example                            # API configuration template
```

---

## License

MIT © [bbimer](https://github.com/bbimer)
