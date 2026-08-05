/**********************************************************************
 * NS_Kinetic_Subtitles_Panel.jsx  —  FreeFlow Studio Aesthetic Panel
 *
 * Automated ElevenLabs TTS to After Effects Subtitle Engine & Panel GUI.
 *
 * FEATURES:
 *   - ElevenLabs Generation ID Multi-Part Fetcher (comma-separated IDs)
 *   - Timeline-Aware Audio Sync (aligns subtitles to audioLayer.inPoint)
 *   - 80ms Lead-In Pre-display timing & 150ms Tail-Out controls
 *   - 4 Kinetic Modes: Mode 1 (Broadcast [L]), Mode 2 (Single Word Pop [W]),
 *     Mode 3 (Cascade Ladder [C]), Mode 4 (Highlight Tracker [T]+[HI])
 *   - Animation Composer Integration: Auto-Centering Anchor Point (sourceRectAtTime),
 *     System Layer Prefixes ([L], [W], [C], [T], [HI]), Isolated Highlight Shape Layers
 *   - Positioning & Scaling: Y% Baseline (72%), Safe Margin Guard (85%), Master Scale %
 *   - Style Presets: "None (Custom Manual)", "Nullspread Neon", "Hormozi Gold", "Minimalist"
 *   - Single Selected Audio Layer Target Mode vs Entire Active Comp
 *
 * INSTALLATION:
 *   Copy to:  Support Files/Scripts/ScriptUI Panels/
 *   Open via: Window > NS Kinetic Subtitles
 *********************************************************************/

(function (thisObj) {

  // ----------------------------- DEFAULT CONFIG -----------------------------
  var CFG = {
    elevenLabsIds: '',
    leadInMs: 80,
    tailOutMs: 150,
    gapSnapMs: 120,
    baseYpct: 0.72,
    centerX: true,
    safeMarginPct: 85,
    masterScalePct: 100,
    layoutMode: 1, // 1: Broadcast, 2: Single Word Pop, 3: Cascade, 4: Tracker
    targetMode: 'all', // 'all' or 'selected'
    stylePreset: 0, // 0: None, 1: Neon, 2: Hormozi, 3: Minimal
    anchorAlign: 'center', // 'center' or 'bottom'
    usePrefixes: true,
    tag: 'nsub'
  };

  var MASTER_BASE = '_STYLE_BASE', MASTER_ACCENT = '_STYLE_ACCENT';

  // ----------------------------- BUILD SCRIPTUI GUI -----------------------------
  function buildGUI(panelObj) {
    var win = (panelObj instanceof Panel) ? panelObj : new Window('palette', 'elevenlabs-after-effects-subtitles', undefined, { resizable: true });
    win.orientation = 'column';
    win.alignChildren = ['fill', 'top'];
    win.spacing = 8;
    win.margins = 10;

    // Header Title Card
    var header = win.add('group');
    header.orientation = 'row';
    header.alignChildren = ['left', 'center'];
    var title = header.add('statictext', undefined, 'ELEVENLABS SUBTITLES');
    title.graphics.font = ScriptUI.newFont('Tahoma', 'BOLD', 13);
    var ver = header.add('statictext', undefined, 'v2.0 — FreeFlow Studio');
    ver.graphics.foregroundColor = ver.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1);

    // SECTION 1: ELEVENLABS GENERATION & SYNC
    var pnlGen = win.add('panel', undefined, '1. ElevenLabs Generation & Audio Sync');
    pnlGen.orientation = 'column';
    pnlGen.alignChildren = ['fill', 'top'];
    pnlGen.spacing = 6;
    pnlGen.margins = 8;

    pnlGen.add('statictext', undefined, 'Paste Generation IDs (comma-separated):');
    var txtIds = pnlGen.add('edittext', undefined, CFG.elevenLabsIds, { multiline: false });
    txtIds.preferredSize.height = 24;

    var btnFetch = pnlGen.add('button', undefined, '⚡ Fetch & Auto-Build Subtitles from ElevenLabs');
    btnFetch.graphics.font = ScriptUI.newFont('Tahoma', 'BOLD', 11);

    var gLocal = pnlGen.add('group');
    gLocal.orientation = 'row';
    gLocal.alignChildren = ['fill', 'center'];
    var txtLocalPath = gLocal.add('edittext', undefined, '', { multiline: false });
    txtLocalPath.alignment = ['fill', 'center'];
    var btnBrowse = gLocal.add('button', undefined, '📂 Browse JSON');
    btnBrowse.alignment = ['right', 'center'];

    var btnSync = pnlGen.add('button', undefined, '⚡ Sync Subtitles to Audio Layer Positions');

    // SECTION 2: KINETIC MODES & TIMING
    var pnlModes = win.add('panel', undefined, '2. Kinetic Layout Mode & 80ms Lead-In');
    pnlModes.orientation = 'column';
    pnlModes.alignChildren = ['fill', 'top'];
    pnlModes.spacing = 6;
    pnlModes.margins = 8;

    pnlModes.add('statictext', undefined, 'Layout Mode:');
    var dropMode = pnlModes.add('dropdownlist', undefined, [
      'Mode 1: Broadcast Block [L] (2-Line Smart Break)',
      'Mode 2: Single Word Flash / Pop [W] (1-Word Center)',
      'Mode 3: Kinetic Cascade Ladder [C] (Vertical Stack)',
      'Mode 4: Highlight Tracker [T] + [HI] (Full Sentence)'
    ]);
    dropMode.selection = 0;

    var gLead = pnlModes.add('group');
    gLead.add('statictext', undefined, 'Lead-In Pre-display:');
    var sldLead = gLead.add('slider', undefined, CFG.leadInMs, 0, 200);
    var lblLead = gLead.add('statictext', undefined, CFG.leadInMs + ' ms');
    lblLead.preferredSize.width = 50;
    sldLead.onChanging = function () { lblLead.text = Math.round(sldLead.value) + ' ms'; };

    // SECTION 3: POSITIONING & AUTO-SCALE
    var pnlPos = win.add('panel', undefined, '3. Frame Position & Auto-Scale Safety');
    pnlPos.orientation = 'column';
    pnlPos.alignChildren = ['fill', 'top'];
    pnlPos.spacing = 6;
    pnlPos.margins = 8;

    var gY = pnlPos.add('group');
    gY.add('statictext', undefined, 'Vertical Baseline Y%:');
    var sldY = gY.add('slider', undefined, CFG.baseYpct * 100, 10, 90);
    var lblY = gY.add('statictext', undefined, Math.round(CFG.baseYpct * 100) + '%');
    lblY.preferredSize.width = 40;
    sldY.onChanging = function () { lblY.text = Math.round(sldY.value) + '%'; };

    var gSafe = pnlPos.add('group');
    gSafe.add('statictext', undefined, 'Safe Margin Guard (Max W%):');
    var sldSafe = gSafe.add('slider', undefined, CFG.safeMarginPct, 50, 95);
    var lblSafe = gSafe.add('statictext', undefined, Math.round(CFG.safeMarginPct) + '%');
    lblSafe.preferredSize.width = 40;
    sldSafe.onChanging = function () { lblSafe.text = Math.round(sldSafe.value) + '%'; };

    var chkCenterX = pnlPos.add('checkbox', undefined, 'Snap to Center X (50%)');
    chkCenterX.value = CFG.centerX;

    // SECTION 4: STYLES & AC SPECS
    var pnlStyle = win.add('panel', undefined, '4. Style Presets & AC Integration');
    pnlStyle.orientation = 'column';
    pnlStyle.alignChildren = ['fill', 'top'];
    pnlStyle.spacing = 6;
    pnlStyle.margins = 8;

    var gPreset = pnlStyle.add('group');
    gPreset.add('statictext', undefined, 'Preset:');
    var dropPreset = gPreset.add('dropdownlist', undefined, [
      'None (Custom Manual — Keep Master Layers)',
      'Nullspread Neon (Cyan/Green Glow)',
      'Hormozi Gold (Yellow/Red Stroke)',
      'Minimalist Clean (Drop Shadow)'
    ]);
    dropPreset.selection = 0;

    var btnCreateMasters = pnlStyle.add('button', undefined, '🎨 Create / Reset Master Layers (_STYLE_BASE / _STYLE_ACCENT)');

    var gAnchor = pnlStyle.add('group');
    gAnchor.add('statictext', undefined, 'Anchor Point:');
    var radAnchorCenter = gAnchor.add('radiobutton', undefined, 'Center-Center (Bounce)');
    var radAnchorBottom = gAnchor.add('radiobutton', undefined, 'Bottom-Center (Up)');
    radAnchorCenter.value = true;

    var chkPrefixes = pnlStyle.add('checkbox', undefined, 'System Layer Prefixes ([L], [W], [C], [T], [HI])');
    chkPrefixes.value = true;

    // BOTTOM ACTION BUTTONS
    var gActions = win.add('group');
    gActions.orientation = 'row';
    gActions.alignChildren = ['fill', 'center'];

    var btnBuild = gActions.add('button', undefined, '🎬 BUILD SUBTITLES');
    btnBuild.graphics.font = ScriptUI.newFont('Tahoma', 'BOLD', 12);
    btnBuild.alignment = ['fill', 'center'];

    var btnClear = gActions.add('button', undefined, '🧹 CLEAR');
    btnClear.alignment = ['right', 'center'];

    // Status Footer Bar
    var gFooter = win.add('group');
    gFooter.orientation = 'row';
    gFooter.alignChildren = ['left', 'center'];
    var statusDot = gFooter.add('statictext', undefined, '● ElevenLabs API Active');
    statusDot.graphics.foregroundColor = statusDot.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.03, 0.9, 0.04, 1], 1);
    var statusTxt = gFooter.add('statictext', undefined, '| Ready.');

    // ----------------------------- HANDLERS -----------------------------

    btnBrowse.onClick = function () {
      var f = File.openDialog('Select a *.captions.json', '*.json');
      if (f) txtLocalPath.text = f.fsName;
    };

    btnCreateMasters.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      app.beginUndoGroup('NS Subtitles — Create Master Layers');
      try {
        makeMasterLayer(comp, MASTER_BASE, false, dropPreset.selection.index);
        makeMasterLayer(comp, MASTER_ACCENT, true, dropPreset.selection.index);
        statusTxt.text = '| Master style layers created/updated.';
      } catch (e) { alert(e.toString()); }
      app.endUndoGroup();
    };

    btnFetch.onClick = function () {
      var rawIds = txtIds.text.replace(/\s+/g, '');
      if (!rawIds) { alert('Please paste at least one ElevenLabs Generation ID!'); return; }

      statusTxt.text = '| Fetching from ElevenLabs...';
      var scriptDir = File($.fileName).parent.fsName;
      var testFile = File(scriptDir + '/fetch_history_captions.js');
      if (!testFile.exists) {
        scriptDir = 'C:\\Users\\root\\Desktop\\NULLSPREAD\\AfterEffects\\ae-subs';
      }
      var outBasename = 'temp/el_captions_' + new Date().getTime();
      var idList = rawIds.split(',').join(' ');

      var cmd = 'cd /d "' + scriptDir + '" && node fetch_history_captions.js ' + idList + ' --out "' + outBasename + '"';
      try {
        system.callSystem('cmd.exe /c "' + cmd + '"');
        var jsonFile = File(scriptDir + '/' + outBasename + '.captions.json');
        if (jsonFile.exists) {
          txtLocalPath.text = jsonFile.fsName;
          statusTxt.text = '| Fetched! Building subtitles...';
          btnBuild.notify('onClick');
        } else {
          alert('Could not generate captions JSON. Check your ElevenLabs API Key in .env.');
          statusTxt.text = '| Error fetching from ElevenLabs.';
        }
      } catch (err) { alert(err.toString()); }
    };

    btnSync.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }

      // Find the primary audio layer using robust multi-strategy detection
      var audioLayer = findAudioLayer(comp, CFG.tag);
      if (!audioLayer) { alert('No audio layer found in this composition!\n\nMake sure you have an audio file (.mp3, .wav, etc.) added to the timeline.'); return; }

      var audioStart = audioLayer.inPoint;

      app.beginUndoGroup('NS Subtitles \u2014 Sync Audio Timeline');
      try {
        // Collect all subtitle layers and find the earliest inPoint
        var subLayers = [];
        var earliestIn = Infinity;
        for (var i = 1; i <= comp.numLayers; i++) {
          var Ly = comp.layer(i);
          if (Ly.comment && Ly.comment.indexOf(CFG.tag + ':') === 0) {
            subLayers.push(Ly);
            if (Ly.inPoint < earliestIn) earliestIn = Ly.inPoint;
          }
        }

        if (subLayers.length === 0) {
          statusTxt.text = '| No subtitle layers found to sync.';
        } else {
          var delta = audioStart - earliestIn;

          if (Math.abs(delta) < 0.002) {
            statusTxt.text = '| Subtitles already aligned with audio (' + audioStart.toFixed(2) + 's).';
          } else {
            // Use startTime += delta — the correct AE way to slide a layer on the timeline
            for (var s = 0; s < subLayers.length; s++) {
              subLayers[s].startTime += delta;
            }
            statusTxt.text = '| Synced ' + subLayers.length + ' layers (shifted ' + (delta > 0 ? '+' : '') + delta.toFixed(2) + 's to audio at ' + audioStart.toFixed(2) + 's).';
          }
        }
      } catch (e) { alert('Sync error: ' + e.toString()); }
      app.endUndoGroup();
    };

    // Standalone clear function (no undo group — caller wraps it)
    function clearSubtitleLayers(comp) {
      var removed = 0;
      for (var i = comp.numLayers; i >= 1; i--) {
        var Ly = comp.layer(i);
        if (Ly.comment && Ly.comment.indexOf(CFG.tag + ':') === 0) {
          Ly.remove();
          removed++;
        }
      }
      return removed;
    }

    btnClear.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      app.beginUndoGroup('NS Subtitles — Clear Subtitles');
      try {
        var removed = clearSubtitleLayers(comp);
        statusTxt.text = '| Cleared ' + removed + ' subtitle layers.';
      } catch (e) { alert('Clear error: ' + e.toString()); }
      app.endUndoGroup();
    };

    btnBuild.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open an active comp first!'); return; }

      var jsonPath = txtLocalPath.text;
      if (!jsonPath) {
        var f = File.openDialog('Select a *.captions.json', '*.json');
        if (!f) return;
        jsonPath = f.fsName;
        txtLocalPath.text = jsonPath;
      }

      var jsonFile = File(jsonPath);
      if (!jsonFile.exists) { alert('JSON file does not exist: ' + jsonPath); return; }

      jsonFile.open('r'); jsonFile.encoding = 'UTF-8';
      var content = jsonFile.read(); jsonFile.close();

      var data;
      try { data = parseJSON(content); } catch (e) { alert('Invalid JSON format: ' + e.toString()); return; }
      if (!data || !data.pages || !data.pages.length) { alert('No caption pages found in JSON.'); return; }

      // Read GUI Config Values
      CFG.baseYpct = sldY.value / 100;
      CFG.centerX = chkCenterX.value;
      CFG.safeMarginPct = sldSafe.value;
      CFG.leadInMs = sldLead.value;
      CFG.layoutMode = dropMode.selection.index + 1;
      CFG.stylePreset = dropPreset.selection.index;
      CFG.anchorAlign = radAnchorCenter.value ? 'center' : 'bottom';
      CFG.usePrefixes = chkPrefixes.value;

      app.beginUndoGroup('NS Subtitles — Build Kinetic Subtitles');
      try {
        // Clear previous (using helper function, no nested undo group)
        clearSubtitleLayers(comp);

        // Master layers
        var masterBase = findLayer(comp, MASTER_BASE) || makeMasterLayer(comp, MASTER_BASE, false, CFG.stylePreset);
        var masterAcc = findLayer(comp, MASTER_ACCENT) || makeMasterLayer(comp, MASTER_ACCENT, true, CFG.stylePreset);

        // Find primary audio layer inPoint offset using robust detection
        var audioTimeOffset = 0;
        var detectedAudio = findAudioLayer(comp, CFG.tag);
        if (detectedAudio) {
          audioTimeOffset = detectedAudio.inPoint;
        }

        var baseY = comp.height * CFG.baseYpct;
        var leading = comp.height * 0.055;
        var leadInSec = CFG.leadInMs / 1000;
        var builtCount = 0;

        for (var p = 0; p < data.pages.length; p++) {
          var page = data.pages[p];
          var lines = page.lines || [];
          var pageStart = (page.start || 0) + audioTimeOffset - leadInSec;

          // Continuous page duration: hold until next page begins (eliminates black gaps)
          var nextPageStart = (p + 1 < data.pages.length) ? ((data.pages[p + 1].start || 0) + audioTimeOffset - leadInSec) : null;
          var pageEnd;
          if (nextPageStart !== null && (nextPageStart - pageStart) < 6.0) {
            pageEnd = nextPageStart;
          } else {
            pageEnd = Math.max((page.end || (page.start + 1.5)) + audioTimeOffset + 0.8, pageStart + 1.5);
          }
          if (pageEnd - pageStart < 0.5) pageEnd = pageStart + 0.5;
          if (pageStart < 0) pageStart = 0;

          // MODE 1: BROADCAST BLOCK [L] — all lines appear/disappear together
          if (CFG.layoutMode === 1) {
            var blockOffset1 = -((lines.length - 1) / 2) * leading;

            for (var li = 0; li < lines.length; li++) {
              var line = lines[li];
              var isAcc = (line.style === 'accent');
              var master = isAcc ? masterAcc : masterBase;

              var L = master.duplicate();
              L.enabled = true;
              var prefix = CFG.usePrefixes ? '[L] ' : '';
              L.name = prefix + 'CAP' + pad(page.id, 3) + '_' + (isAcc ? 'ACC' : ('L' + (li + 1)));
              L.comment = CFG.tag + ':' + page.id;
              L.inPoint = pageStart;
              L.outPoint = pageEnd;

              var st = L.property('Source Text');
              var td = st.value;
              td.text = line.text;
              st.setValue(td);

              var posX = CFG.centerX ? (comp.width / 2) : L.property('Transform').property('Position').value[0];
              var posY = baseY + blockOffset1 + li * leading;
              L.property('Transform').property('Position').setValue([posX, posY]);

              centerAnchorPoint(L, CFG.anchorAlign);
              applyScaleGuard(L, comp.width, CFG.safeMarginPct);
              builtCount++;
            }
          }
          // MODE 3: CASCADE LADDER [C] — lines stagger in one by one, all hold until pageEnd
          else if (CFG.layoutMode === 3) {
            var stagger = 0.25; // seconds delay between each line appearing
            var blockOffset3 = -((lines.length - 1) / 2) * leading;

            for (var li3 = 0; li3 < lines.length; li3++) {
              var line3 = lines[li3];
              var isAcc3 = (line3.style === 'accent');
              var master3 = isAcc3 ? masterAcc : masterBase;

              var LC = master3.duplicate();
              LC.enabled = true;
              var prefixC = CFG.usePrefixes ? '[C] ' : '';
              LC.name = prefixC + 'CAP' + pad(page.id, 3) + '_' + (isAcc3 ? 'ACC' : ('L' + (li3 + 1)));
              LC.comment = CFG.tag + ':' + page.id;

              // Each line staggers in; use word timing if available for smarter cascade
              var lineInTime = pageStart + (li3 * stagger);
              if (line3.words && line3.words.length > 0 && line3.words[0].s) {
                lineInTime = line3.words[0].s + audioTimeOffset - leadInSec;
                if (lineInTime < pageStart) lineInTime = pageStart;
              }
              LC.inPoint = lineInTime;
              LC.outPoint = pageEnd; // all lines hold until page ends

              var stC = LC.property('Source Text');
              var tdC = stC.value;
              tdC.text = line3.text;
              stC.setValue(tdC);

              var posXC = CFG.centerX ? (comp.width / 2) : LC.property('Transform').property('Position').value[0];
              var posYC = baseY + blockOffset3 + li3 * leading;
              LC.property('Transform').property('Position').setValue([posXC, posYC]);

              centerAnchorPoint(LC, CFG.anchorAlign);
              applyScaleGuard(LC, comp.width, CFG.safeMarginPct);
              builtCount++;
            }
          }
          // MODE 2: SINGLE WORD FLASH [W] (MrBeast / Hormozi Style)
          else if (CFG.layoutMode === 2) {
            // Flatten all words across all pages to guarantee 100% non-overlapping timeline slots
            var flatWords = [];
            for (var p2 = 0; p2 < data.pages.length; p2++) {
              var pg2 = data.pages[p2];
              var lns2 = pg2.lines || [];
              for (var l2 = 0; l2 < lns2.length; l2++) {
                var lineObj = lns2[l2];
                var wList = lineObj.words || [{ w: lineObj.text, s: pg2.start, e: (pg2.end || pg2.start + 0.5) }];
                for (var wIdx = 0; wIdx < wList.length; wIdx++) {
                  flatWords.push({
                    w: wList[wIdx].w,
                    s: wList[wIdx].s || pg2.start,
                    e: wList[wIdx].e || ((wList[wIdx].s || pg2.start) + 0.4),
                    pageId: pg2.id,
                    isAccent: (lineObj.style === 'accent')
                  });
                }
              }
            }

            for (var fw = 0; fw < flatWords.length; fw++) {
              var item = flatWords[fw];
              var wStart = item.s + audioTimeOffset - leadInSec;
              if (wStart < 0) wStart = 0;

              var wEnd;
              if (fw + 1 < flatWords.length) {
                var nextStart = flatWords[fw + 1].s + audioTimeOffset - leadInSec;
                if (nextStart - wStart < 1.5 && nextStart > wStart) {
                  wEnd = nextStart; // Butt-join to next word: 0 overlap, 0 gap!
                } else {
                  wEnd = item.e + audioTimeOffset + 0.3;
                }
              } else {
                wEnd = item.e + audioTimeOffset + 0.5;
              }

              var masterW = item.isAccent ? masterAcc : masterBase;
              var LW = masterW.duplicate();
              LW.enabled = true;
              var prefixW = CFG.usePrefixes ? '[W] ' : '';
              LW.name = prefixW + 'CAP' + pad(item.pageId, 3) + '_W' + pad(fw + 1, 2);
              LW.comment = CFG.tag + ':' + item.pageId;
              LW.inPoint = wStart;
              LW.outPoint = wEnd;

              var stW = LW.property('Source Text');
              var tdW = stW.value;
              tdW.text = item.w;
              stW.setValue(tdW);

              var posWX = CFG.centerX ? (comp.width / 2) : LW.property('Transform').property('Position').value[0];
              LW.property('Transform').property('Position').setValue([posWX, baseY]);

              centerAnchorPoint(LW, CFG.anchorAlign);
              applyScaleGuard(LW, comp.width, CFG.safeMarginPct);
              builtCount++;
            }
            // Skip inner page loop for Mode 2 since flatWords handled all pages
            break;
          }
          // MODE 4: HIGHLIGHT TRACKER [T] + [HI]
          // Full sentence text [T] stays for page duration; per-word highlight boxes [HI] track spoken word
          else if (CFG.layoutMode === 4) {
            // Combine all lines into one full sentence text layer
            var fullText4 = [];
            for (var lt4 = 0; lt4 < lines.length; lt4++) {
              fullText4.push(lines[lt4].text);
            }
            var combinedText4 = fullText4.join(' ');

            // Create the sentence text layer [T]
            var LT = masterBase.duplicate();
            LT.enabled = true;
            var prefixT = CFG.usePrefixes ? '[T] ' : '';
            LT.name = prefixT + 'CAP' + pad(page.id, 3) + '_TEXT';
            LT.comment = CFG.tag + ':' + page.id;
            LT.inPoint = pageStart;
            LT.outPoint = pageEnd;

            var stT = LT.property('Source Text');
            var tdT = stT.value;
            tdT.text = combinedText4;
            stT.setValue(tdT);

            var posTX = CFG.centerX ? (comp.width / 2) : LT.property('Transform').property('Position').value[0];
            LT.property('Transform').property('Position').setValue([posTX, baseY]);
            centerAnchorPoint(LT, CFG.anchorAlign);
            applyScaleGuard(LT, comp.width, CFG.safeMarginPct);
            builtCount++;

            // Create per-word highlight shape layers [HI]
            var allWords4 = [];
            for (var lw4 = 0; lw4 < lines.length; lw4++) {
              var words4 = lines[lw4].words || [];
              for (var w4 = 0; w4 < words4.length; w4++) {
                allWords4.push(words4[w4]);
              }
            }

            for (var hi = 0; hi < allWords4.length; hi++) {
              var hw = allWords4[hi];
              var hiStart = (hw.s || page.start) + audioTimeOffset - leadInSec;
              if (hiStart < pageStart) hiStart = pageStart;
              var hiEnd;
              if (hi + 1 < allWords4.length) {
                hiEnd = (allWords4[hi + 1].s || page.start) + audioTimeOffset - leadInSec;
                if (hiEnd <= hiStart) hiEnd = hiStart + 0.3;
              } else {
                hiEnd = pageEnd;
              }

              var shapeHi = comp.layers.addShape();
              shapeHi.enabled = true;
              var prefixHI = CFG.usePrefixes ? '[HI] ' : '';
              shapeHi.name = prefixHI + 'CAP' + pad(page.id, 3) + '_HI' + pad(hi + 1, 2);
              shapeHi.comment = CFG.tag + ':' + page.id;
              shapeHi.inPoint = hiStart;
              shapeHi.outPoint = hiEnd;
              shapeHi.moveAfter(LT);

              var shapeGroup = shapeHi.property('Contents').addProperty('ADBE Vector Group');
              var shapeRect = shapeGroup.property('Contents').addProperty('ADBE Vector Shape - Rect');
              var shapeFill = shapeGroup.property('Contents').addProperty('ADBE Vector Graphic - Fill');

              // Estimate word width based on character count (since sourceRectAtTime is unreliable for per-word)
              var wordChars = (hw.w || '').length;
              var estWordW = Math.max(wordChars * 28, 60);
              var estWordH = 60;
              shapeRect.property('Size').setValue([estWordW, estWordH]);
              shapeFill.property('Color').setValue([0.03, 0.9, 0.04, 1]);
              shapeHi.property('Transform').property('Position').setValue([posTX, baseY]);
              shapeHi.property('Transform').property('Opacity').setValue(30);

              builtCount++;
            }
          }
        }

        statusTxt.text = '| Built ' + builtCount + ' kinetic subtitle layers!';
      } catch (errBuild) {
        alert('Build error: ' + errBuild.toString());
      }
      app.endUndoGroup();
    };

    return win;
  }

  // ----------------------------- HELPER FUNCTIONS -----------------------------

  // Robust audio layer detection with multiple fallback strategies
  function findAudioLayer(comp, excludeTag) {
    var AUDIO_EXTS = /\.(mp3|wav|aac|m4a|ogg|flac|aif|aiff|wma)$/i;

    // Strategy 1: hasAudio property (works for video+audio and some audio-only layers)
    for (var i = 1; i <= comp.numLayers; i++) {
      var L = comp.layer(i);
      if (excludeTag && L.comment && L.comment.indexOf(excludeTag + ':') === 0) continue;
      try { if (L.hasAudio) return L; } catch (e) {}
    }

    // Strategy 2: source.hasAudio (works when layer.hasAudio is false but source has audio)
    for (var j = 1; j <= comp.numLayers; j++) {
      var L2 = comp.layer(j);
      if (excludeTag && L2.comment && L2.comment.indexOf(excludeTag + ':') === 0) continue;
      try { if (L2.source && L2.source.hasAudio) return L2; } catch (e) {}
    }

    // Strategy 3: check source file extension for known audio formats
    for (var k = 1; k <= comp.numLayers; k++) {
      var L3 = comp.layer(k);
      if (excludeTag && L3.comment && L3.comment.indexOf(excludeTag + ':') === 0) continue;
      try {
        if (L3.source && L3.source.file && AUDIO_EXTS.test(L3.source.file.name)) return L3;
      } catch (e) {}
    }

    // Strategy 4: check layer name for common audio naming patterns
    for (var m = 1; m <= comp.numLayers; m++) {
      var L4 = comp.layer(m);
      if (excludeTag && L4.comment && L4.comment.indexOf(excludeTag + ':') === 0) continue;
      if (AUDIO_EXTS.test(L4.name)) return L4;
    }

    return null;
  }

  function centerAnchorPoint(layer, mode) {
    try {
      var rect = layer.sourceRectAtTime(layer.inPoint + 0.05, false);
      var x = rect.left + (rect.width / 2);
      var y = (mode === 'bottom') ? (rect.top + rect.height) : (rect.top + (rect.height / 2));
      layer.property('Transform').property('Anchor Point').setValue([x, y]);
    } catch (e) { }
  }

  function applyScaleGuard(layer, compW, maxPct) {
    try {
      var rect = layer.sourceRectAtTime(layer.inPoint + 0.05, false);
      var maxW = compW * (maxPct / 100);
      if (rect.width > maxW && rect.width > 0) {
        var fitScale = (maxW / rect.width) * 100;
        layer.property('Transform').property('Scale').setValue([fitScale, fitScale]);
      }
    } catch (e) { }
  }

  function findLayer(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).name === name) return comp.layer(i);
    }
    return null;
  }

  function makeMasterLayer(comp, name, isAccent, presetIdx) {
    var L = comp.layers.addText(isAccent ? 'ACCENT STYLE' : 'BASE STYLE');
    L.name = name;
    L.enabled = false;
    L.property('Transform').property('Position').setValue([comp.width / 2, comp.height * 0.72]);

    var st = L.property('Source Text');
    var td = st.value;
    td.fontSize = isAccent ? 64 : 58;
    td.font = 'Sora-Bold';
    td.fillColor = isAccent ? [0.03, 0.9, 0.04] : [1, 1, 1];
    td.justification = ParagraphJustification.CENTER_JUSTIFY;

    if (presetIdx === 1) {
      td.fillColor = isAccent ? [0, 1, 0.8] : [1, 1, 1];
    } else if (presetIdx === 2) {
      td.font = 'Montserrat-Black';
      td.fillColor = isAccent ? [1, 0.85, 0] : [1, 1, 1];
      td.applyStroke = true;
      td.strokeColor = [0, 0, 0];
      td.strokeWidth = 4;
    } else if (presetIdx === 3) {
      td.font = 'Helvetica-Bold';
      td.fillColor = [1, 1, 1];
    }

    st.setValue(td);
    centerAnchorPoint(L, 'center');
    return L;
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  function parseJSON(str) {
    return eval('(' + str + ')');
  }

  // ----------------------------- LAUNCH PANEL -----------------------------
  var myPanel = buildGUI(thisObj);
  if (myPanel instanceof Window) {
    myPanel.center();
    myPanel.show();
  } else {
    myPanel.layout.layout();
    myPanel.layout.resize();
    myPanel.onResize = function () {
      this.layout.resize();
    };
  }

})(this);
