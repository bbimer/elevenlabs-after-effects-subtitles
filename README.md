# NS Kinetic Typography Engine — AE Subtitle Pipeline

Turns an ElevenLabs VO into ready-to-style subtitle **text layers** in After Effects for high-speed video production.
Script handles the timing, pagination, and placement — you focus on the creative motion design.

```
script.txt ──▶ vo_generate.js ──▶ vo.mp3 + vo.align.json
                                        │
                                        ▼
                              caption_compile.js ──▶ vo.captions.json
                                        │
                                        ▼
                          build_subs.jsx (in AE) ──▶ CAP001_L1, CAP001_ACC …
```

## Requirements
- Node 18+ (for `vo_generate.js`; built-in fetch). Node 14+ for the compiler.
- After Effects (any recent version) for the `.jsx`.
- `ELEVENLABS_API_KEY` in your environment.

## 1) Generate VO + timings
Write your script as plain text. Write numbers **the way they should appear on screen**
(`$0.41`, `12.3%`) — the model speaks them correctly and timings map back to what you typed.
Mark an emphasis word/phrase with `*asterisks*` → it becomes an accent line.

```bash
ELEVENLABS_API_KEY=xi-... \
node vo_generate.js --text script.txt --voice <VOICE_ID> --out vo_delisting_01 --format wav
```
→ `vo_delisting_01.wav` + `vo_delisting_01.align.json`

## 2) Compile captions
```bash
node caption_compile.js vo_delisting_01.align.json --config compile.config.json
```
→ `vo_delisting_01.captions.json` (prints a page-by-page preview; flags warnings, never "fixes" silently)

Tune everything in `compile.config.json` (chars/line, durations, casing, emphasis policy…).

## 3) Build layers in After Effects
1. In your comp create two hidden text layers styled how you like:
   `_STYLE_BASE` (normal line) and `_STYLE_ACCENT` (emphasis line). Turn their eye OFF.
   Their position sets where the block sits. *(If missing, the script makes plain white
   defaults so it still runs — restyle them once and re-run.)*
2. `File > Scripts > Run Script File…` → pick `build_subs.jsx` → choose your `.captions.json`.
3. Layers appear: one per line, correct in/out, row-stacked, word markers on each layer,
   accent lines colored differently in the timeline.

**Re-run is idempotent** — it removes the previous sub layers first, so edit the
JSON or config and just run again. One Undo reverts the whole build. Style lives on the two
master layers, so changing the look = editing two layers, not 60.
