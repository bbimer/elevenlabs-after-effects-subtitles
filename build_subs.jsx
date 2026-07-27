/**********************************************************************
 * build_subs.jsx  —  NULLSPREAD subtitle builder for After Effects
 * Phase 0 (no panel). Run via File > Scripts > Run Script File…
 *
 * Reads a *.captions.json (from caption_compile.js) and builds one TEXT
 * LAYER PER LINE in the ACTIVE comp — inheriting style/effects from two
 * master layers you control:  _STYLE_BASE  and  _STYLE_ACCENT
 *
 * WORKFLOW
 *   1) In your comp, make two text layers styled exactly how you want
 *      (font, stroke, shadow, even Sapphire on them). Name them:
 *          _STYLE_BASE     — normal caption line
 *          _STYLE_ACCENT   — emphasis line (e.g. the blue handwritten look)
 *      Turn their eye (visibility) OFF. Their POSITION defines where the
 *      block sits; rows stack down from there.
 *      (If they don't exist, the script creates plain white defaults so it
 *       still runs — restyle them once and re-run.)
 *   2) Run this script, pick the .captions.json.
 *   3) Layers are created named CAP001_L1 / CAP001_L2 / CAP001_ACC …
 *      with correct in/out, row positions, word markers, label colors.
 *   4) Do your thing: Motion Composer, animations, effects.
 *
 * RE-RUN = idempotent. Existing NULLSPREAD sub layers are removed first,
 * so tweak the JSON / config and just run again. One Undo reverts all.
 *
 * Layout constants below — edit to taste (or drive from a panel later).
 *********************************************************************/

(function () {
  // ----------------------------- CONFIG -----------------------------
  var CFG = {
    baseYpct: 0.72,      // vertical baseline of the block (fraction of comp height)
    leadingPct: 0.055,   // row-to-row spacing as fraction of comp height
    centerX: true,       // center rows horizontally in comp (else keep master X)
    labelBase: 8,        // AE label color index for base lines
    labelAccent: 9,      // AE label color index for accent lines
    addWordMarkers: true,
    addPageMarkersToComp: true,
    tag: 'nsub'          // layer.comment marker = tag:{pageId}
  };
  var MASTER_BASE = '_STYLE_BASE', MASTER_ACCENT = '_STYLE_ACCENT';

  // ----------------------------- guards -----------------------------
  var comp = app.project.activeItem;
  if (!(comp && comp instanceof CompItem)) { alert('Open a comp and make it active, then run.'); return; }

  var f = File.openDialog('Select a *.captions.json', '*.json');
  if (!f) return;
  f.open('r'); f.encoding = 'UTF-8';
  var content = f.read(); f.close();

  var data;
  try { data = parseJSON(content); }
  catch (e) { alert('Could not parse JSON:\n' + e.toString()); return; }
  if (!data || !data.pages || !data.pages.length) { alert('No pages in this captions file.'); return; }

  app.beginUndoGroup('NULLSPREAD — build subtitles');
  try {
    // remove previous NULLSPREAD layers
    for (var i = comp.numLayers; i >= 1; i--) {
      var Ly = comp.layer(i);
      if (Ly.comment && Ly.comment.indexOf(CFG.tag + ':') === 0) Ly.remove();
    }

    var masterBase = findLayer(comp, MASTER_BASE) || makeMaster(comp, MASTER_BASE, false);
    var masterAcc  = findLayer(comp, MASTER_ACCENT) || makeMaster(comp, MASTER_ACCENT, true);

    var baseY = comp.height * CFG.baseYpct;
    var leading = comp.height * CFG.leadingPct;
    var built = 0, warned = 0;

    for (var p = 0; p < data.pages.length; p++) {
      var page = data.pages[p];
      var lines = page.lines || [];
      // vertical centering of the block around baseY (so 2- vs 3-line pages sit consistently)
      var blockOffset = -((lines.length - 1) / 2) * leading;

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var isAcc = (line.style === 'accent');
        var master = isAcc ? masterAcc : masterBase;

        var L = master.duplicate();
        L.enabled = true;
        L.name = 'CAP' + pad(page.id, 3) + '_' + (isAcc ? 'ACC' : ('L' + (li + 1)));
        L.comment = CFG.tag + ':' + page.id;
        L.label = isAcc ? CFG.labelAccent : CFG.labelBase;

        // text (inherits font/stroke/animators/effects from the master)
        var st = L.property('Source Text');
        var td = st.value;
        td.text = line.text;
        st.setValue(td);

        // position: stack rows from baseY; optionally center X
        var pos = L.property('Transform').property('Position');
        var curX = pos.value[0];
        var x = CFG.centerX ? (comp.width / 2) : curX;
        var y = baseY + blockOffset + li * leading;
        pos.setValue([x, y]);

        // timing
        L.inPoint = page.start;
        L.outPoint = page.end;

        // word markers (relative to layer start so they ride with it if moved)
        if (CFG.addWordMarkers && line.words) {
          var mk = L.property('Marker');
          for (var w = 0; w < line.words.length; w++) {
            var t = line.words[w].s;
            if (t >= page.start && t <= page.end) {
              var mv = new MarkerValue(line.words[w].w);
              mk.setValueAtTime(t, mv);
            }
          }
        }
        built++;
      }
      if (page.warnings && page.warnings.length) warned++;
      if (CFG.addPageMarkersToComp) {
        var cm = comp.markerProperty || null;
        if (cm) { try { cm.setValueAtTime(page.start, new MarkerValue('P' + page.id)); } catch (e) {} }
      }
    }

    alert('NULLSPREAD subs built.\n' + built + ' line layers across ' + data.pages.length + ' pages.' +
          (warned ? ('\n' + warned + ' page(s) had compiler warnings — check the JSON.') : ''));
  } catch (err) {
    alert('Build error:\n' + err.toString());
  } finally {
    app.endUndoGroup();
  }

  // ----------------------------- helpers -----------------------------
  function findLayer(c, name) {
    for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === name) return c.layer(i);
    return null;
  }
  function makeMaster(c, name, accent) {
    var td = new TextDocument(accent ? 'ACCENT' : 'STYLE');
    var L = c.layers.addText(td);
    L.name = name;
    var t = L.property('Source Text').value;
    t.resetCharStyle && t.resetCharStyle();
    t.fontSize = accent ? Math.round(c.height * 0.075) : Math.round(c.height * 0.06);
    t.fillColor = [1, 1, 1];
    t.applyStroke = true; t.strokeColor = [0, 0, 0]; t.strokeWidth = accent ? 6 : 8; t.strokeOverFill = false;
    try { t.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (e) {}
    L.property('Source Text').setValue(t);
    L.property('Transform').property('Position').setValue([c.width / 2, c.height * 0.72]);
    L.enabled = false;
    L.comment = 'NULLSPREAD master (restyle me, keep hidden)';
    return L;
  }
  function pad(n, w) { n = '' + n; while (n.length < w) n = '0' + n; return n; }

  // Minimal JSON parser for ExtendScript (no JSON global). Trusted local file.
  function parseJSON(s) {
    // strip UTF-8 BOM if present
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    var result;
    // ExtendScript has eval; our compiler output is trusted JSON.
    try { result = eval('(' + s + ')'); }
    catch (e) { throw new Error('JSON eval failed: ' + e.toString()); }
    return result;
  }
})();
