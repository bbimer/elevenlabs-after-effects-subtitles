/**********************************************************************
 * NS_Kinetic_Subtitles_Panel.jsx  —  FreeFlow Studio Aesthetic Panel
 *
 * Automated ElevenLabs TTS to After Effects Subtitle Engine & Panel GUI.
 *
 * FEATURES:
 *   - ElevenLabs Generation ID Multi-Part Fetcher (comma-separated IDs)
 *   - Multi-Take Support: Unique Take letter per voiceover part ([A], [B], [C], [D]...)
 *   - Line 1 / Line 2 Visual Differentiation (Color Labels + Clear Prefixes):
 *       • Line 1: [A_L1] with Cyan Color Label (#14)
 *       • Line 2: [A_L2] with Orange Color Label (#11)
 *       • Accent: [A_ACC] with Magenta/Fuchsia Color Label (#13)
 *       • Word Pop: [A_W] with Green Color Label (#9)
 *   - Quick Batch Selection Buttons:
 *       • "Select All Line 1", "Select All Line 2", "Select All Accents", "Select by Take"
 *   - Timeline-Aware Audio Sync (aligns subtitles to audioLayer.inPoint)
 *   - 80ms Lead-In Pre-display timing & 150ms Tail-Out controls
 *   - 4 Kinetic Modes: Mode 1 (Broadcast [L]), Mode 2 (Single Word Pop [W]),
 *     Mode 3 (Cascade Ladder [C]), Mode 4 (Highlight Tracker [T]+[HI])
 *   - Style Presets & Preset Manager (Save / Load / Delete custom styles)
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
    startMode: 0, // 0: Playhead CTI (comp.time), 1: Audio Layer inPoint, 2: 0:00 (Timeline Start)
    takeMode: 0, // 0: Auto (From IDs/JSON), 1: Take A, 2: Take B, 3: Take C, 4: Take D, 5: Take E, 6: Take F
    targetMode: 'all', // 'all' or 'selected'
    stylePreset: 0,
    anchorAlign: 'center', // 'center' or 'bottom'
    usePrefixes: true,
    autoAddAudio: false,
    tag: 'nsub'
  };

  var MASTER_BASE = '_STYLE_BASE', MASTER_ACCENT = '_STYLE_ACCENT';
  var BUILTIN_PRESETS = [
    'None (Custom Manual — Keep Master Layers)',
    '✨ Luxury Editorial (White Sans + Champagne Gold Script)',
    '⚡ Tokyo Cyberpunk (Cyan Base + Acid Green Accent)',
    '🔥 Hormozi Viral (Gold Yellow + Punch Red Stroke)',
    '💎 Crypto Terminal (Electric Matrix Green + White)',
    '🌅 Sunset Pop (Vibrant Tangerine + Hot Pink)',
    '🧊 Minimalist Clean (Ice Blue + Pure White)',
    '🖤 High-Contrast Viral (Black Stroke + Bright Yellow)'
  ];

  var TAKE_LETTERS = ['Auto', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

  // AE Timeline Label Colors mapped to each Take phase (0-16):
  // Take A: 14 (Cyan — Электрик циан / ярко-голубой)
  // Take B: 13 (Magenta — Неоновая фуксия / розово-малиновый)
  // Take C: 11 (Orange — Тёплый апельсиновый)
  // Take D: 10 (Purple — Глубокий неоновый фиолетовый)
  // Take E: 3  (Aqua / Seafoam — Морская волна / бирюзовый)
  // Take F: 9  (Green — Сочный лаймовый зелёный)
  // Take G: 2  (Yellow — Солнечный жёлтый)
  // Take H: 4  (Pink — Мягкий конфетный розовый)
  // Take I: 8  (Blue — Королевский синий)
  // Take J: 5  (Lavender — Пастельная лаванда)
  // Take K: 6  (Peach — Персиковый коралл)
  // Take L: 1  (Red — Рубиновый красный)
  // Take M: 16 (Dark Green — Благородный изумруд)
  // Take N: 15 (Sandstone — Песочный)
  // Take O: 7  (Tan — Бежевый)
  var TAKE_LABEL_COLORS = {
    'A': 14, // Cyan (Электрик циан)
    'B': 13, // Magenta (Неоновая фуксия)
    'C': 11, // Orange (Апельсиновый)
    'D': 10, // Purple (Неоновый фиолетовый)
    'E': 3,  // Aqua (Бирюзовый)
    'F': 9,  // Green (Сочный зелёный)
    'G': 2,  // Yellow (Солнечный жёлтый)
    'H': 4,  // Pink (Розовый)
    'I': 8,  // Blue (Синий)
    'J': 5,  // Lavender (Лавандовый)
    'K': 6,  // Peach (Персиковый)
    'L': 1,  // Red (Красный)
    'M': 16, // Dark Green (Изумрудный)
    'N': 15, // Sandstone (Песочный)
    'O': 7   // Tan (Бежевый)
  };

  var LABEL_L1 = 14;
  var LABEL_L2 = 11;
  var LABEL_ACC = 13;
  var LABEL_L3 = 5;
  var LABEL_WORD = 9;

  // ----------------------------- PRESET STORAGE -----------------------------
  function getPresetsFile() {
    var scriptDir = File($.fileName).parent.fsName;
    var testFile = File(scriptDir + '/caption_compile.js');
    if (!testFile.exists) {
      scriptDir = 'C:\\Users\\root\\Desktop\\NULLSPREAD\\AfterEffects\\ae-subs';
    }
    return File(scriptDir + '/user_presets.json');
  }

  function loadUserPresets() {
    try {
      var f = getPresetsFile();
      if (f.exists) {
        f.open('r'); f.encoding = 'UTF-8';
        var txt = f.read(); f.close();
        if (txt) return eval('(' + txt + ')') || {};
      }
    } catch (e) {}
    return {};
  }

  function saveUserPresets(presetsObj) {
    try {
      var f = getPresetsFile();
      f.open('w'); f.encoding = 'UTF-8';
      f.write(toJSONString(presetsObj));
      f.close();
      return true;
    } catch (e) {
      alert('Save presets error: ' + e.toString());
      return false;
    }
  }

  function toJSONString(obj) {
    if (obj === null) return 'null';
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (typeof obj === 'string') return '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    if (obj instanceof Array) {
      var arr = [];
      for (var i = 0; i < obj.length; i++) arr.push(toJSONString(obj[i]));
      return '[' + arr.join(',') + ']';
    }
    if (typeof obj === 'object') {
      var pairs = [];
      for (var k in obj) {
        if (obj.hasOwnProperty(k)) pairs.push('"' + k + '":' + toJSONString(obj[k]));
      }
      return '{' + pairs.join(',') + '}';
    }
    return '""';
  }

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
    var ver = header.add('statictext', undefined, 'v2.3 — FreeFlow Studio');
    ver.graphics.foregroundColor = ver.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1);

    // SECTION 1: ELEVENLABS GENERATION & SYNC
    var pnlGen = win.add('panel', undefined, '1. ElevenLabs Generation & Timeline Sync');
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

    var gSync = pnlGen.add('group');
    gSync.orientation = 'row';
    gSync.alignChildren = ['fill', 'center'];
    gSync.spacing = 4;
    var btnSyncPlayhead = gSync.add('button', undefined, '📍 Sync to Playhead (CTI)');
    btnSyncPlayhead.alignment = ['fill', 'center'];
    var btnSyncAudio = gSync.add('button', undefined, '🎵 Sync to Audio');
    btnSyncAudio.alignment = ['fill', 'center'];

    // SECTION 2: KINETIC MODES, TAKES & TIMING
    var pnlModes = win.add('panel', undefined, '2. Kinetic Layout, Take Letter & Timeline Start');
    pnlModes.orientation = 'column';
    pnlModes.alignChildren = ['fill', 'top'];
    pnlModes.spacing = 6;
    pnlModes.margins = 8;

    var gModeRow = pnlModes.add('group');
    gModeRow.orientation = 'row';
    gModeRow.alignChildren = ['fill', 'center'];
    gModeRow.add('statictext', undefined, 'Mode:');
    var dropMode = gModeRow.add('dropdownlist', undefined, [
      'Mode 1: Broadcast Block (2-Line Smart Break)',
      'Mode 2: Single Word Flash / Pop (1-Word Center)',
      'Mode 3: Kinetic Cascade Ladder (Vertical Stack)',
      'Mode 4: Highlight Tracker (Full Sentence Box)',
      'Mode 5: Single-Line Stream (1-Line Center / Dynamic Chunk)',
      'Mode 6: Karaoke Word-Fill (Active Word Glow / CapCut Style)'
    ]);
    dropMode.alignment = ['fill', 'center'];
    dropMode.selection = 0;

    var gTakeStart = pnlModes.add('group');
    gTakeStart.orientation = 'row';
    gTakeStart.alignChildren = ['fill', 'center'];
    gTakeStart.spacing = 6;

    gTakeStart.add('statictext', undefined, 'Take Tag:');
    var dropTake = gTakeStart.add('dropdownlist', undefined, [
      'Auto (A, B, C, D...)',
      'Take A [A]',
      'Take B [B]',
      'Take C [C]',
      'Take D [D]',
      'Take E [E]',
      'Take F [F]',
      'Take G [G]'
    ]);
    dropTake.selection = 0;

    gTakeStart.add('statictext', undefined, 'Start:');
    var dropStart = gTakeStart.add('dropdownlist', undefined, [
      '📍 Playhead (CTI)',
      '🎵 Audio Layer',
      '⏱️ 0:00 Start'
    ]);
    dropStart.selection = 0;

    var gLead = pnlModes.add('group');
    gLead.add('statictext', undefined, 'Lead-In Pre-display:');
    var sldLead = gLead.add('slider', undefined, CFG.leadInMs, 0, 200);
    var lblLead = gLead.add('statictext', undefined, CFG.leadInMs + ' ms');
    lblLead.preferredSize.width = 50;
    sldLead.onChanging = function () { lblLead.text = Math.round(sldLead.value) + ' ms'; };

    var chkAddAudio = pnlModes.add('checkbox', undefined, '🎵 Auto-Import & Place Audio Track (.mp3) on Timeline');
    chkAddAudio.value = CFG.autoAddAudio;

    var chkClearOld = pnlModes.add('checkbox', undefined, 'Replace existing subtitles (clear all first)');
    chkClearOld.value = false;

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

    // SECTION 4: STYLES & PRESETS
    var pnlStyle = win.add('panel', undefined, '4. Style Presets & Custom Preset Manager');
    pnlStyle.orientation = 'column';
    pnlStyle.alignChildren = ['fill', 'top'];
    pnlStyle.spacing = 6;
    pnlStyle.margins = 8;

    var gPreset = pnlStyle.add('group');
    gPreset.add('statictext', undefined, 'Preset:');
    var dropPreset = gPreset.add('dropdownlist', undefined, []);
    dropPreset.alignment = ['fill', 'center'];

    function refreshPresetDropdown(selectName) {
      dropPreset.removeAll();
      for (var b = 0; b < BUILTIN_PRESETS.length; b++) {
        dropPreset.add('item', BUILTIN_PRESETS[b]);
      }
      var userPresets = loadUserPresets();
      var customNames = [];
      for (var k in userPresets) {
        if (userPresets.hasOwnProperty(k)) {
          customNames.push(k);
          dropPreset.add('item', '★ ' + k);
        }
      }
      dropPreset.selection = 0;
      if (selectName) {
        for (var i = 0; i < dropPreset.items.length; i++) {
          if (dropPreset.items[i].text === selectName || dropPreset.items[i].text === ('★ ' + selectName)) {
            dropPreset.selection = i;
            break;
          }
        }
      }
    }
    refreshPresetDropdown();

    var gMasterBtns = pnlStyle.add('group');
    gMasterBtns.orientation = 'row';
    gMasterBtns.alignChildren = ['fill', 'center'];
    gMasterBtns.spacing = 4;
    var btnCreateMasters = gMasterBtns.add('button', undefined, '🎨 Reset Masters');
    btnCreateMasters.alignment = ['fill', 'center'];
    var btnApplyStyle = gMasterBtns.add('button', undefined, '✨ Apply Style to Subtitles');
    btnApplyStyle.alignment = ['fill', 'center'];

    var gCustomPresetBtns = pnlStyle.add('group');
    gCustomPresetBtns.orientation = 'row';
    gCustomPresetBtns.alignChildren = ['fill', 'center'];
    gCustomPresetBtns.spacing = 4;
    var btnSavePreset = gCustomPresetBtns.add('button', undefined, '💾 Save Preset...');
    btnSavePreset.alignment = ['fill', 'center'];
    var btnDeletePreset = gCustomPresetBtns.add('button', undefined, '🗑️ Delete Preset');
    btnDeletePreset.alignment = ['fill', 'center'];

    var gAnchor = pnlStyle.add('group');
    gAnchor.add('statictext', undefined, 'Anchor Point:');
    var radAnchorCenter = gAnchor.add('radiobutton', undefined, 'Center (Bounce)');
    var radAnchorBottom = gAnchor.add('radiobutton', undefined, 'Bottom (Up)');
    radAnchorCenter.value = true;

    var chkPrefixes = pnlStyle.add('checkbox', undefined, 'Use Distinct Line Prefixes ([A_L1], [A_L2], [A_ACC])');
    chkPrefixes.value = true;

    // SECTION 5: QUICK SELECTION & BATCH STYLING
    var pnlSelect = win.add('panel', undefined, '5. Quick Timeline Selection (Batch Styling)');
    pnlSelect.orientation = 'column';
    pnlSelect.alignChildren = ['fill', 'top'];
    pnlSelect.spacing = 4;
    pnlSelect.margins = 8;

    var gSelRow1 = pnlSelect.add('group');
    gSelRow1.orientation = 'row';
    gSelRow1.alignChildren = ['fill', 'center'];
    gSelRow1.spacing = 4;
    var btnSelectL1 = gSelRow1.add('button', undefined, '🔷 Select Line 1 (Top)');
    btnSelectL1.alignment = ['fill', 'center'];
    var btnSelectL2 = gSelRow1.add('button', undefined, '🔶 Select Line 2 (Mid)');
    btnSelectL2.alignment = ['fill', 'center'];

    var gSelRow2 = pnlSelect.add('group');
    gSelRow2.orientation = 'row';
    gSelRow2.alignChildren = ['fill', 'center'];
    gSelRow2.spacing = 4;
    var btnSelectAcc = gSelRow2.add('button', undefined, '💖 Select Accents');
    btnSelectAcc.alignment = ['fill', 'center'];
    var btnSelectTake = gSelRow2.add('button', undefined, '🎙️ Select Current Take');
    btnSelectTake.alignment = ['fill', 'center'];

    // SECTION 6: ANIMATION COMPOSER MARKER AUTO-FIT (35%)
    var pnlMarkers = win.add('panel', undefined, '6. Animation Composer Marker Auto-Fit (Speed)');
    pnlMarkers.orientation = 'column';
    pnlMarkers.alignChildren = ['fill', 'top'];
    pnlMarkers.spacing = 4;
    pnlMarkers.margins = 8;

    var gMarkerSlider = pnlMarkers.add('group');
    gMarkerSlider.orientation = 'row';
    gMarkerSlider.alignChildren = ['fill', 'center'];
    gMarkerSlider.add('statictext', undefined, 'TR In Marker Position:');
    var sldMarkerPct = gMarkerSlider.add('slider', undefined, 35, 10, 80);
    var lblMarkerPct = gMarkerSlider.add('statictext', undefined, '35%');
    lblMarkerPct.preferredSize.width = 35;
    sldMarkerPct.onChanging = function () { lblMarkerPct.text = Math.round(sldMarkerPct.value) + '%'; };

    var gMarkerBtns = pnlMarkers.add('group');
    gMarkerBtns.orientation = 'row';
    gMarkerBtns.alignChildren = ['fill', 'center'];
    gMarkerBtns.spacing = 4;
    var btnFitMarkersSel = gMarkerBtns.add('button', undefined, '⚡ Fit Selected Layers (35%)');
    btnFitMarkersSel.alignment = ['fill', 'center'];
    var btnFitMarkersAll = gMarkerBtns.add('button', undefined, '⚡ Fit ALL Subtitles (35%)');
    btnFitMarkersAll.alignment = ['fill', 'center'];

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

    btnSavePreset.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition with master layers first!'); return; }

      var masterBase = findLayer(comp, MASTER_BASE);
      var masterAcc = findLayer(comp, MASTER_ACCENT);
      if (!masterBase) {
        alert('Could not find ' + MASTER_BASE + ' layer in the composition.\nClick "Reset Masters", adjust your fonts/sizes, then click "Save Preset...".');
        return;
      }

      var presetName = prompt('Enter a name for your custom preset:', 'My Reels Style');
      if (!presetName) return;
      presetName = presetName.replace(/^\s+|\s+$/g, '');
      if (!presetName) return;

      var baseTd = masterBase.property('Source Text').value;
      var accTd = masterAcc ? masterAcc.property('Source Text').value : baseTd;

      var userPresets = loadUserPresets();
      userPresets[presetName] = {
        base: extractStyleProps(baseTd),
        accent: extractStyleProps(accTd)
      };

      if (saveUserPresets(userPresets)) {
        refreshPresetDropdown('★ ' + presetName);
        statusTxt.text = '| Saved custom preset: "' + presetName + '"!';
        alert('Preset "' + presetName + '" saved successfully!\nIt is now available in your Preset dropdown.');
      }
    };

    btnDeletePreset.onClick = function () {
      var sel = dropPreset.selection;
      if (!sel) return;
      var text = sel.text;
      if (text.indexOf('★ ') !== 0) {
        alert('You can only delete custom presets (marked with ★).\nBuilt-in presets cannot be deleted.');
        return;
      }
      var rawName = text.substring(2);
      if (!confirm('Are you sure you want to delete custom preset "' + rawName + '"?')) return;

      var userPresets = loadUserPresets();
      if (userPresets.hasOwnProperty(rawName)) {
        delete userPresets[rawName];
        saveUserPresets(userPresets);
        refreshPresetDropdown();
        statusTxt.text = '| Deleted preset: "' + rawName + '".';
      }
    };

    function extractStyleProps(td) {
      return {
        font: td.font,
        fontSize: td.fontSize,
        fillColor: td.applyFill ? [td.fillColor[0], td.fillColor[1], td.fillColor[2]] : null,
        applyFill: td.applyFill,
        strokeColor: td.applyStroke ? [td.strokeColor[0], td.strokeColor[1], td.strokeColor[2]] : null,
        strokeWidth: td.applyStroke ? td.strokeWidth : 0,
        applyStroke: td.applyStroke,
        tracking: td.tracking,
        allCaps: td.allCaps || false,
        fauxBold: td.fauxBold || false,
        fauxItalic: td.fauxItalic || false
      };
    }

    btnCreateMasters.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      app.beginUndoGroup('NS Subtitles — Create Master Layers');
      try {
        var selIdx = dropPreset.selection ? dropPreset.selection.index : 0;
        var selText = dropPreset.selection ? dropPreset.selection.text : '';

        makeMasterLayer(comp, MASTER_BASE, false, selIdx, selText);
        makeMasterLayer(comp, MASTER_ACCENT, true, selIdx, selText);
        statusTxt.text = '| Master style layers created/updated.';
      } catch (e) { alert(e.toString()); }
      app.endUndoGroup();
    };

    btnApplyStyle.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      app.beginUndoGroup('NS Subtitles — Apply Style from Masters');
      try {
        var count = applyStyleToSubtitles(comp);
        if (count === 0) {
          statusTxt.text = '| No subtitle layers found to update. Click "BUILD SUBTITLES".';
        } else {
          statusTxt.text = '| Applied style to ' + count + ' subtitle layers!';
        }
      } catch (e) { alert('Apply style error: ' + e.toString()); }
      app.endUndoGroup();
    };

    // Quick Layer Selection Handlers
    btnSelectL1.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      var count = 0;
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        var isL1 = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('_L1') !== -1 || L.name.indexOf('_C1') !== -1 || L.name.indexOf('_S1') !== -1 || L.name.indexOf('_TEXT') !== -1 || L.name.indexOf('_KB') !== -1));
        L.selected = isL1;
        if (isL1) count++;
      }
      statusTxt.text = '| Selected ' + count + ' Line 1 / Base layers.';
    };

    btnSelectL2.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      var count = 0;
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        var isL2 = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('_L2') !== -1 || L.name.indexOf('_C2') !== -1 || L.name.indexOf('_S2') !== -1));
        L.selected = isL2;
        if (isL2) count++;
      }
      statusTxt.text = '| Selected ' + count + ' Line 2 layers.';
    };

    btnSelectAcc.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      var count = 0;
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        var isAcc = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('_ACC') !== -1 || L.name.indexOf('_HI') !== -1 || L.name.indexOf('_KW') !== -1));
        L.selected = isAcc;
        if (isAcc) count++;
      }
      statusTxt.text = '| Selected ' + count + ' Accent / Highlight layers.';
    };

    btnSelectTake.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      var chosenTake = dropTake.selection.index === 0 ? 'A' : TAKE_LETTERS[dropTake.selection.index];
      var count = 0;
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        var isTake = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('[' + chosenTake + '_') !== -1 || L.name.indexOf('[' + chosenTake + ']') !== -1));
        L.selected = isTake;
        if (isTake) count++;
      }
      statusTxt.text = '| Selected ' + count + ' layers for Take [' + chosenTake + '].';
    };

    btnFitMarkersSel.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      app.beginUndoGroup('NS Subtitles — Fit AC Markers (Selected)');
      try {
        var pctVal = Math.round(sldMarkerPct.value);
        var count = fitAnimationComposerMarkers(comp, pctVal, true);
        if (count === 0) {
          statusTxt.text = '| No AC markers found on selected layers.';
          alert('No Animation Composer markers found on selected layers.\n\nMake sure you selected subtitle layers that have Animation Composer applied.');
        } else {
          statusTxt.text = '| Fitted TR In markers on ' + count + ' selected layers to ' + pctVal + '%!';
        }
      } catch (e) { alert('Marker fit error: ' + e.toString()); }
      app.endUndoGroup();
    };

    btnFitMarkersAll.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      app.beginUndoGroup('NS Subtitles — Fit AC Markers (All)');
      try {
        var pctVal = Math.round(sldMarkerPct.value);
        var count = fitAnimationComposerMarkers(comp, pctVal, false);
        if (count === 0) {
          statusTxt.text = '| No AC markers found on subtitle layers.';
          alert('No Animation Composer markers found on subtitle layers.\n\nApply an Animation Composer transition to your subtitle layers first, then click this button.');
        } else {
          statusTxt.text = '| Fitted TR In markers on ' + count + ' subtitle layers to ' + pctVal + '%!';
        }
      } catch (e) { alert('Marker fit error: ' + e.toString()); }
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

    btnSyncAudio.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }

      var audioLayer = findAudioLayer(comp, CFG.tag);
      if (!audioLayer) { alert('No audio layer found in this composition!\n\nMake sure you have an audio file (.mp3, .wav, etc.) added to the timeline.'); return; }

      var audioStart = audioLayer.inPoint;
      var audioEnd = audioLayer.outPoint;
      var audioDur = audioEnd - audioStart;

      app.beginUndoGroup('NS Subtitles — Sync & Fit Audio Timeline');
      try {
        var subLayers = [];
        var earliestIn = Infinity;
        var latestOut = -Infinity;

        var hasSelection = false;
        for (var selCheck = 1; selCheck <= comp.numLayers; selCheck++) {
          if (comp.layer(selCheck).selected && comp.layer(selCheck).comment && comp.layer(selCheck).comment.indexOf(CFG.tag + ':') === 0) {
            hasSelection = true;
            break;
          }
        }

        for (var i = 1; i <= comp.numLayers; i++) {
          var Ly = comp.layer(i);
          if (Ly.comment && Ly.comment.indexOf(CFG.tag + ':') === 0) {
            if (hasSelection && !Ly.selected) continue;
            subLayers.push(Ly);
            if (Ly.inPoint < earliestIn) earliestIn = Ly.inPoint;
            if (Ly.outPoint > latestOut) latestOut = Ly.outPoint;
          }
        }

        if (subLayers.length === 0) {
          statusTxt.text = '| No subtitle layers found to sync.';
        } else {
          var capDur = latestOut - earliestIn;
          if (capDur > 0.3 && audioDur > 0.3) {
            var ratio = audioDur / capDur;
            for (var s = 0; s < subLayers.length; s++) {
              var L = subLayers[s];
              var relIn = L.inPoint - earliestIn;
              var relOut = L.outPoint - earliestIn;
              L.inPoint = audioStart + (relIn * ratio);
              L.outPoint = audioStart + (relOut * ratio);
            }
            statusTxt.text = '| Fitted & synced ' + subLayers.length + ' layers to audio (' + audioDur.toFixed(2) + 's, speed ' + ratio.toFixed(2) + 'x)!';
          }
        }
      } catch (e) { alert('Sync error: ' + e.toString()); }
      app.endUndoGroup();
    };

    btnSyncPlayhead.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }

      var targetTime = comp.time;

      app.beginUndoGroup('NS Subtitles — Sync to Playhead (CTI)');
      try {
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
          var delta = targetTime - earliestIn;

          if (Math.abs(delta) < 0.002) {
            statusTxt.text = '| Subtitles already at playhead (' + targetTime.toFixed(2) + 's).';
          } else {
            for (var s = 0; s < subLayers.length; s++) {
              subLayers[s].startTime += delta;
            }
            statusTxt.text = '| Synced ' + subLayers.length + ' layers to playhead at ' + targetTime.toFixed(2) + 's (shifted ' + (delta > 0 ? '+' : '') + delta.toFixed(2) + 's).';
          }
        }
      } catch (e) { alert('Sync error: ' + e.toString()); }
      app.endUndoGroup();
    };

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
      CFG.startMode = dropStart.selection.index;
      CFG.takeMode = dropTake.selection.index;
      CFG.stylePreset = dropPreset.selection.index;
      CFG.anchorAlign = radAnchorCenter.value ? 'center' : 'bottom';
      CFG.usePrefixes = chkPrefixes.value;
      CFG.autoAddAudio = chkAddAudio.value;
      CFG.clearOld = chkClearOld.value;

      app.beginUndoGroup('NS Subtitles — Build Kinetic Subtitles');
      try {
        if (CFG.clearOld) {
          clearSubtitleLayers(comp);
        }

        var pageOffset = CFG.clearOld ? 0 : getMaxPageId(comp, CFG.tag);

        var selPresetIdx = dropPreset.selection ? dropPreset.selection.index : 0;
        var selPresetText = dropPreset.selection ? dropPreset.selection.text : '';

        var masterBase = findLayer(comp, MASTER_BASE) || makeMasterLayer(comp, MASTER_BASE, false, selPresetIdx, selPresetText);
        var masterAcc = findLayer(comp, MASTER_ACCENT) || makeMasterLayer(comp, MASTER_ACCENT, true, selPresetIdx, selPresetText);
        masterBase.enabled = false;
        masterAcc.enabled = false;

        var timeOffset = 0;
        var startDesc = '0.00s';

        if (CFG.startMode === 0) {
          timeOffset = comp.time;
          startDesc = 'Playhead: ' + timeOffset.toFixed(2) + 's';
        } else if (CFG.startMode === 1) {
          var refTime = comp.time;
          var detectedAudio = findAudioLayer(comp, CFG.tag, refTime);
          if (detectedAudio) {
            timeOffset = detectedAudio.inPoint;
            startDesc = 'Audio (' + detectedAudio.name + '): ' + timeOffset.toFixed(2) + 's';
          } else {
            timeOffset = 0;
            startDesc = '0.00s (no audio found)';
          }
        } else {
          timeOffset = 0;
          startDesc = '0.00s';
        }

        var baseY = comp.height * CFG.baseYpct;
        var leading = comp.height * 0.055;
        var leadInSec = CFG.leadInMs / 1000;

        var autoTake = (CFG.takeMode > 0) ? TAKE_LETTERS[CFG.takeMode] : getAutoTakeLetter(comp, CFG.clearOld);
        var autoTakeColor = TAKE_LABEL_COLORS[autoTake] || 14;
        var baseTakeIdx = Math.max(0, autoTake.charCodeAt(0) - 65);

        // Auto-Import & Place Audio Layer if toggle is enabled
        var audioAddedLayer = null;
        if (CFG.autoAddAudio) {
          var resolvedAudio = resolveAudioFile(data, jsonPath);
          if (resolvedAudio) {
            audioAddedLayer = importAndPlaceAudioLayer(comp, resolvedAudio, timeOffset, autoTake, autoTakeColor);
          }
        }

        var createdLayers = [];
        var builtCount = 0;

        for (var p = 0; p < data.pages.length; p++) {
          var page = data.pages[p];
          var curPageId = page.id + pageOffset;
          var lines = page.lines || [];
          var pageStart = (page.start || 0) + timeOffset - leadInSec;

          // Determine take letter & take color
          var partOffset = (page.part ? (page.part - 1) : 0);
          var takeIdx = (CFG.takeMode > 0) ? (CFG.takeMode - 1) : ((baseTakeIdx + partOffset) % 15);
          var takeLetter = TAKE_LETTERS[takeIdx + 1] || 'A';
          var takeColor = TAKE_LABEL_COLORS[takeLetter] || 14;

          var nextPageStart = (p + 1 < data.pages.length) ? (((data.pages[p + 1].start || 0)) + timeOffset - leadInSec) : null;
          var pageEnd;
          if (nextPageStart !== null && (nextPageStart - pageStart) < 6.0) {
            pageEnd = nextPageStart;
          } else {
            pageEnd = (page.end || (page.start + 1.5)) + timeOffset;
          }
          if (pageEnd - pageStart < 0.3) pageEnd = pageStart + 0.3;
          if (pageStart < 0) pageStart = 0;

          // MODE 1: BROADCAST BLOCK [L]
          if (CFG.layoutMode === 1) {
            var blockOffset1 = -((lines.length - 1) / 2) * leading;

            for (var li = 0; li < lines.length; li++) {
              var line = lines[li];
              var isAcc = (line.style === 'accent');
              var master = isAcc ? masterAcc : masterBase;

              var L = master.duplicate();
              L.enabled = true;

              // Distinct Prefix & Per-Take Label Color
              var lineTag = isAcc ? 'ACC' : ('L' + (li + 1));
              var prefix = CFG.usePrefixes ? ('[' + takeLetter + '_' + lineTag + '] ') : '';
              L.name = prefix + 'CAP' + pad(curPageId, 3) + '_' + lineTag;
              L.comment = CFG.tag + ':' + curPageId;
              L.inPoint = pageStart;
              L.outPoint = pageEnd;

              // Apply distinct AE Timeline Label Color per Take phase (Accents get Fuchsia 13)
              L.label = isAcc ? 13 : takeColor;

              var st = L.property('Source Text');
              var td = st.value;
              td.text = stripPromptTags(line.text);
              st.setValue(td);

              var posX = CFG.centerX ? (comp.width / 2) : L.property('Transform').property('Position').value[0];
              var posY = baseY + blockOffset1 + li * leading;
              L.property('Transform').property('Position').setValue([posX, posY]);

              centerAnchorPoint(L, CFG.anchorAlign);
              applyScaleGuard(L, comp.width, CFG.safeMarginPct);
              createdLayers.push(L);
              builtCount++;
            }
          }
          // MODE 3: CASCADE LADDER [C]
          else if (CFG.layoutMode === 3) {
            var stagger = 0.25;
            var blockOffset3 = -((lines.length - 1) / 2) * leading;

            for (var li3 = 0; li3 < lines.length; li3++) {
              var line3 = lines[li3];
              var isAcc3 = (line3.style === 'accent');
              var master3 = isAcc3 ? masterAcc : masterBase;

              var LC = master3.duplicate();
              LC.enabled = true;

              var lineTag3 = isAcc3 ? 'ACC' : ('C' + (li3 + 1));
              var prefixC = CFG.usePrefixes ? ('[' + takeLetter + '_' + lineTag3 + '] ') : '';
              LC.name = prefixC + 'CAP' + pad(curPageId, 3) + '_' + lineTag3;
              LC.comment = CFG.tag + ':' + curPageId;

              // Apply distinct AE Timeline Label Color per Take phase
              LC.label = isAcc3 ? 13 : takeColor;

              var lineInTime = pageStart + (li3 * stagger);
              if (line3.words && line3.words.length > 0 && line3.words[0].s !== undefined) {
                lineInTime = line3.words[0].s + timeOffset - leadInSec;
                if (lineInTime < pageStart) lineInTime = pageStart;
              }
              if (lineInTime >= pageEnd) lineInTime = Math.max(0, pageEnd - 0.2);
              LC.inPoint = lineInTime;
              LC.outPoint = pageEnd;

              var stC = LC.property('Source Text');
              var tdC = stC.value;
              tdC.text = stripPromptTags(line3.text);
              stC.setValue(tdC);

              var posXC = CFG.centerX ? (comp.width / 2) : LC.property('Transform').property('Position').value[0];
              var posYC = baseY + blockOffset3 + li3 * leading;
              LC.property('Transform').property('Position').setValue([posXC, posYC]);

              centerAnchorPoint(LC, CFG.anchorAlign);
              applyScaleGuard(LC, comp.width, CFG.safeMarginPct);
              createdLayers.push(LC);
              builtCount++;
            }
          }
          // MODE 2: SINGLE WORD FLASH [W]
          else if (CFG.layoutMode === 2) {
            var flatWords = [];
            for (var p2 = 0; p2 < data.pages.length; p2++) {
              var pg2 = data.pages[p2];
              var lns2 = pg2.lines || [];
              var wordPartOffset = (pg2.part ? (pg2.part - 1) : 0);
              var wordTakeIdx = (CFG.takeMode > 0) ? (CFG.takeMode - 1) : ((baseTakeIdx + wordPartOffset) % 15);
              var wordTake = TAKE_LETTERS[wordTakeIdx + 1] || 'A';
              for (var l2 = 0; l2 < lns2.length; l2++) {
                var lineObj = lns2[l2];
                var wList = lineObj.words || [{ w: lineObj.text, s: pg2.start, e: (pg2.end || pg2.start + 0.5) }];
                for (var wIdx = 0; wIdx < wList.length; wIdx++) {
                  flatWords.push({
                    w: wList[wIdx].w,
                    s: wList[wIdx].s || pg2.start,
                    e: wList[wIdx].e || ((wList[wIdx].s || pg2.start) + 0.4),
                    pageId: pg2.id,
                    take: wordTake,
                    isAccent: (lineObj.style === 'accent')
                  });
                }
              }
            }

            for (var fw = 0; fw < flatWords.length; fw++) {
              var item = flatWords[fw];
              var cleanW = cleanPopWord(item.w);
              if (!cleanW) continue;

              var curPageId2 = item.pageId + pageOffset;
              var wStart = item.s + timeOffset - leadInSec;
              if (wStart < 0) wStart = 0;

              var wEnd;
              if (fw + 1 < flatWords.length) {
                var nextStart = flatWords[fw + 1].s + timeOffset - leadInSec;
                if (nextStart - wStart < 1.5 && nextStart > wStart) {
                  wEnd = nextStart;
                } else {
                  wEnd = item.e + timeOffset + 0.3;
                }
              } else {
                wEnd = item.e + timeOffset + 0.5;
              }
              if (wEnd <= wStart) wEnd = wStart + 0.2;

              var masterW = item.isAccent ? masterAcc : masterBase;
              var LW = masterW.duplicate();
              LW.enabled = true;
              var itemTake = item.take || autoTake;
              var itemColor = TAKE_LABEL_COLORS[itemTake] || 14;
              var prefixW = CFG.usePrefixes ? ('[' + itemTake + '_W] ') : '';
              LW.name = prefixW + 'CAP' + pad(curPageId2, 3) + '_W' + pad(fw + 1, 2);
              LW.comment = CFG.tag + ':' + curPageId2;
              LW.inPoint = wStart;
              LW.outPoint = wEnd;
              LW.label = item.isAccent ? 13 : itemColor;

              var stW = LW.property('Source Text');
              var tdW = stW.value;
              tdW.text = cleanW;
              stW.setValue(tdW);

              var posWX = CFG.centerX ? (comp.width / 2) : LW.property('Transform').property('Position').value[0];
              LW.property('Transform').property('Position').setValue([posWX, baseY]);

              centerAnchorPoint(LW, CFG.anchorAlign);
              applyScaleGuard(LW, comp.width, CFG.safeMarginPct);
              createdLayers.push(LW);
              builtCount++;
            }
            break;
          }
          // MODE 4: HIGHLIGHT TRACKER [T] + [HI]
          else if (CFG.layoutMode === 4) {
            var fullText4 = [];
            for (var lt4 = 0; lt4 < lines.length; lt4++) {
              fullText4.push(lines[lt4].text);
            }
            var combinedText4 = stripPromptTags(fullText4.join(' '));

            var LT = masterBase.duplicate();
            LT.enabled = true;
            var prefixT = CFG.usePrefixes ? ('[' + takeLetter + '_T] ') : '';
            LT.name = prefixT + 'CAP' + pad(curPageId, 3) + '_TEXT';
            LT.comment = CFG.tag + ':' + curPageId;
            LT.inPoint = pageStart;
            LT.outPoint = pageEnd;
            LT.label = takeColor;

            var stT = LT.property('Source Text');
            var tdT = stT.value;
            tdT.text = combinedText4;
            stT.setValue(tdT);

            var posTX = CFG.centerX ? (comp.width / 2) : LT.property('Transform').property('Position').value[0];
            LT.property('Transform').property('Position').setValue([posTX, baseY]);
            centerAnchorPoint(LT, CFG.anchorAlign);
            applyScaleGuard(LT, comp.width, CFG.safeMarginPct);
            createdLayers.push(LT);
            builtCount++;

            var allWords4 = [];
            for (var lw4 = 0; lw4 < lines.length; lw4++) {
              var words4 = lines[lw4].words || [];
              for (var w4 = 0; w4 < words4.length; w4++) {
                allWords4.push(words4[w4]);
              }
            }

            var textRect4;
            try { textRect4 = LT.sourceRectAtTime(pageStart + 0.05, false); } catch(e) { textRect4 = { width: combinedText4.length * 28, height: 60 }; }
            var totalChars4 = Math.max(combinedText4.length, 1);
            var charWidth4 = textRect4.width / totalChars4;
            var textLeft4 = posTX - (textRect4.width / 2);
            var charCursor4 = 0;

            for (var hi = 0; hi < allWords4.length; hi++) {
              var hw = allWords4[hi];
              var cleanHW = cleanPopWord(hw.w);
              if (!cleanHW) continue;

              var hiStart = (hw.s || page.start) + timeOffset - leadInSec;
              if (hiStart < pageStart) hiStart = pageStart;
              var hiEnd;
              if (hi + 1 < allWords4.length) {
                hiEnd = (allWords4[hi + 1].s || page.start) + timeOffset - leadInSec;
                if (hiEnd <= hiStart) hiEnd = hiStart + 0.3;
              } else {
                hiEnd = pageEnd;
              }
              if (hiEnd <= hiStart) hiEnd = hiStart + 0.3;

              var shapeHi = comp.layers.addShape();
              shapeHi.enabled = true;
              var prefixHI = CFG.usePrefixes ? ('[' + takeLetter + '_HI] ') : '';
              shapeHi.name = prefixHI + 'CAP' + pad(curPageId, 3) + '_HI' + pad(hi + 1, 2);
              shapeHi.comment = CFG.tag + ':' + curPageId;
              shapeHi.inPoint = hiStart;
              shapeHi.outPoint = hiEnd;
              shapeHi.label = LABEL_ACC;
              shapeHi.moveAfter(LT);

              var shapeGroup = shapeHi.property('Contents').addProperty('ADBE Vector Group');
              var shapeRect = shapeGroup.property('Contents').addProperty('ADBE Vector Shape - Rect');
              var shapeFill = shapeGroup.property('Contents').addProperty('ADBE Vector Graphic - Fill');

              var wordIdx4 = combinedText4.indexOf(cleanHW, charCursor4);
              if (wordIdx4 === -1) wordIdx4 = charCursor4;
              charCursor4 = wordIdx4 + cleanHW.length;

              var wordChars = cleanHW.length;
              var estWordW = Math.max(wordChars * charWidth4 * 1.15, 50);
              var estWordH = Math.max(textRect4.height * 1.15, 60);
              shapeRect.property('Size').setValue([estWordW, estWordH]);
              shapeFill.property('Color').setValue([0.03, 0.9, 0.04, 1]);

              var wordCenterX = textLeft4 + (wordIdx4 + (wordChars / 2)) * charWidth4;
              shapeHi.property('Transform').property('Position').setValue([wordCenterX, baseY]);
              shapeHi.property('Transform').property('Opacity').setValue(30);

              createdLayers.push(shapeHi);
              builtCount++;
            }
          }
          // MODE 5: SINGLE-LINE STREAM (1-LINE CENTER PUNCH) [S]
          else if (CFG.layoutMode === 5) {
            for (var li5 = 0; li5 < lines.length; li5++) {
              var line5 = lines[li5];
              var isAcc5 = (line5.style === 'accent');
              var master5 = isAcc5 ? masterAcc : masterBase;

              var L5 = master5.duplicate();
              L5.enabled = true;

              var lineTag5 = isAcc5 ? 'ACC' : ('S' + (li5 + 1));
              var prefix5 = CFG.usePrefixes ? ('[' + takeLetter + '_' + lineTag5 + '] ') : '';
              L5.name = prefix5 + 'CAP' + pad(curPageId, 3) + '_' + lineTag5;
              L5.comment = CFG.tag + ':' + curPageId;

              // Calculate start and end time for each individual single-line
              var lineStart5 = pageStart;
              if (line5.words && line5.words.length > 0 && line5.words[0].s !== undefined) {
                lineStart5 = line5.words[0].s + timeOffset - leadInSec;
                if (lineStart5 < pageStart) lineStart5 = pageStart;
              }

              var lineEnd5 = pageEnd;
              if (li5 + 1 < lines.length && lines[li5 + 1].words && lines[li5 + 1].words.length > 0 && lines[li5 + 1].words[0].s !== undefined) {
                lineEnd5 = lines[li5 + 1].words[0].s + timeOffset - leadInSec;
              } else if (li5 + 1 < lines.length) {
                lineEnd5 = pageStart + ((li5 + 1) * ((pageEnd - pageStart) / lines.length));
              }
              if (lineEnd5 <= lineStart5) lineEnd5 = lineStart5 + 0.3;

              L5.inPoint = lineStart5;
              L5.outPoint = lineEnd5;
              L5.label = isAcc5 ? 13 : takeColor;

              var st5 = L5.property('Source Text');
              var td5 = st5.value;
              td5.text = stripPromptTags(line5.text);
              st5.setValue(td5);

              // Position strictly single-line at baseY
              var pos5X = CFG.centerX ? (comp.width / 2) : L5.property('Transform').property('Position').value[0];
              L5.property('Transform').property('Position').setValue([pos5X, baseY]);

              centerAnchorPoint(L5, CFG.anchorAlign);
              applyScaleGuard(L5, comp.width, CFG.safeMarginPct);
              createdLayers.push(L5);
              builtCount++;
            }
          }
          // MODE 6: KARAOKE WORD-FILL (ACTIVE WORD GLOW) [K]
          else if (CFG.layoutMode === 6) {
            for (var li6 = 0; li6 < lines.length; li6++) {
              var line6 = lines[li6];
              var lineWords6 = line6.words || [];
              var blockOffset6 = -((lines.length - 1) / 2) * leading;
              var linePosY6 = baseY + blockOffset6 + li6 * leading;
              var linePosX6 = CFG.centerX ? (comp.width / 2) : masterBase.property('Transform').property('Position').value[0];

              // 1. BASE DIMMED LINE
              var LKBase = masterBase.duplicate();
              LKBase.enabled = true;
              var prefixKB = CFG.usePrefixes ? ('[' + takeLetter + '_KB] ') : '';
              LKBase.name = prefixKB + 'CAP' + pad(curPageId, 3) + '_BASE_' + (li6 + 1);
              LKBase.comment = CFG.tag + ':' + curPageId;
              LKBase.inPoint = pageStart;
              LKBase.outPoint = pageEnd;
              LKBase.label = takeColor; // Distinct Take timeline color
              LKBase.property('Transform').property('Opacity').setValue(35); // 35% Opacity context

              var cleanLine6 = stripPromptTags(line6.text);
              var stKB = LKBase.property('Source Text');
              var tdKB = stKB.value;
              tdKB.text = cleanLine6;
              stKB.setValue(tdKB);

              LKBase.property('Transform').property('Position').setValue([linePosX6, linePosY6]);
              centerAnchorPoint(LKBase, CFG.anchorAlign);
              applyScaleGuard(LKBase, comp.width, CFG.safeMarginPct);
              createdLayers.push(LKBase);
              builtCount++;

              // 2. ACTIVE GLOW WORDS OVER BASE LINE
              var lineRect6;
              try { lineRect6 = LKBase.sourceRectAtTime(pageStart + 0.05, false); } catch(e) { lineRect6 = { width: cleanLine6.length * 28, height: 60 }; }
              var totalChars6 = Math.max(cleanLine6.length, 1);
              var charWidth6 = lineRect6.width / totalChars6;
              var lineLeft6 = linePosX6 - (lineRect6.width / 2);
              var charCursor6 = 0;

              for (var wi6 = 0; wi6 < lineWords6.length; wi6++) {
                var wObj6 = lineWords6[wi6];
                var cleanKW = cleanPopWord(wObj6.w);
                if (!cleanKW) continue;

                var kwStart = (wObj6.s !== undefined ? wObj6.s : page.start) + timeOffset - leadInSec;
                if (kwStart < pageStart) kwStart = pageStart;
                var kwEnd;
                if (wi6 + 1 < lineWords6.length && lineWords6[wi6 + 1].s !== undefined) {
                  kwEnd = lineWords6[wi6 + 1].s + timeOffset - leadInSec;
                  if (kwEnd <= kwStart) kwEnd = kwStart + 0.25;
                } else if (li6 + 1 < lines.length && lines[li6 + 1].words && lines[li6 + 1].words.length > 0 && lines[li6 + 1].words[0].s !== undefined) {
                  kwEnd = lines[li6 + 1].words[0].s + timeOffset - leadInSec;
                } else {
                  kwEnd = pageEnd;
                }
                if (kwEnd <= kwStart) kwEnd = kwStart + 0.25;

                var LKWord = masterAcc.duplicate();
                LKWord.enabled = true;
                var prefixKW = CFG.usePrefixes ? ('[' + takeLetter + '_KW] ') : '';
                LKWord.name = prefixKW + 'CAP' + pad(curPageId, 3) + '_KW_' + (li6 + 1) + '_' + (wi6 + 1);
                LKWord.comment = CFG.tag + ':' + curPageId;
                LKWord.inPoint = kwStart;
                LKWord.outPoint = kwEnd;
                LKWord.label = 13; // Magenta/Accent highlight

                var stKW = LKWord.property('Source Text');
                var tdKW = stKW.value;
                tdKW.text = cleanKW;
                stKW.setValue(tdKW);

                var wordIdx6 = cleanLine6.indexOf(cleanKW, charCursor6);
                if (wordIdx6 === -1) wordIdx6 = charCursor6;
                charCursor6 = wordIdx6 + cleanKW.length;

                var wordChars6 = cleanKW.length;
                var wordCenter6X = lineLeft6 + (wordIdx6 + (wordChars6 / 2)) * charWidth6;
                LKWord.property('Transform').property('Position').setValue([wordCenter6X, linePosY6]);

                centerAnchorPoint(LKWord, CFG.anchorAlign);
                applyScaleGuard(LKWord, comp.width, CFG.safeMarginPct);
                createdLayers.push(LKWord);
                builtCount++;
              }
            }
          }
        }

        // Position audio layer directly below all created subtitle layers
        if (audioAddedLayer && createdLayers.length > 0) {
          try {
            var bottomSubLayer = createdLayers[createdLayers.length - 1];
            audioAddedLayer.moveAfter(bottomSubLayer);
          } catch (e) {}
        }

        statusTxt.text = '| Built ' + builtCount + ' layers (' + startDesc + ')' + (audioAddedLayer ? (' + 🎵 ' + audioAddedLayer.name) : '') + '!';
      } catch (errBuild) {
        alert('Build error: ' + errBuild.toString());
      }
      app.endUndoGroup();
    };

    return win;
  }

  // ----------------------------- HELPER FUNCTIONS -----------------------------

  function applyStyleToSubtitles(comp) {
    var masterBase = findLayer(comp, MASTER_BASE);
    var masterAcc = findLayer(comp, MASTER_ACCENT);
    if (!masterBase) { alert('No ' + MASTER_BASE + ' master layer found!\nClick "Reset Masters" first.'); return 0; }

    var baseSt = masterBase.property('Source Text');
    var baseTd = baseSt.value;
    var accTd = masterAcc ? masterAcc.property('Source Text').value : baseTd;

    var updatedCount = 0;
    for (var i = 1; i <= comp.numLayers; i++) {
      var L = comp.layer(i);
      if (L.comment && L.comment.indexOf(CFG.tag + ':') === 0) {
        var st = L.property('Source Text');
        if (st) {
          var isAcc = (L.name.indexOf('_ACC') !== -1);
          var sourceTd = isAcc ? accTd : baseTd;
          var curTd = st.value;
          var originalText = curTd.text;

          curTd.font = sourceTd.font;
          curTd.fontSize = sourceTd.fontSize;

          curTd.applyFill = sourceTd.applyFill;
          if (sourceTd.applyFill) curTd.fillColor = sourceTd.fillColor;
          curTd.applyStroke = sourceTd.applyStroke;
          if (sourceTd.applyStroke) {
            curTd.strokeColor = sourceTd.strokeColor;
            curTd.strokeWidth = sourceTd.strokeWidth;
            curTd.strokeOverFill = sourceTd.strokeOverFill;
          }

          curTd.tracking = sourceTd.tracking;
          try { if (sourceTd.verticalScale !== undefined) curTd.verticalScale = sourceTd.verticalScale; } catch (e) {}
          try { if (sourceTd.horizontalScale !== undefined) curTd.horizontalScale = sourceTd.horizontalScale; } catch (e) {}
          try { if (sourceTd.baselineShift !== undefined) curTd.baselineShift = sourceTd.baselineShift; } catch (e) {}
          try { if (sourceTd.autoLeading !== undefined) curTd.autoLeading = sourceTd.autoLeading; } catch (e) {}
          try { if (!sourceTd.autoLeading && sourceTd.leading !== undefined) curTd.leading = sourceTd.leading; } catch (e) {}
          try { if (sourceTd.allCaps !== undefined) curTd.allCaps = sourceTd.allCaps; } catch (e) {}
          try { if (sourceTd.smallCaps !== undefined) curTd.smallCaps = sourceTd.smallCaps; } catch (e) {}
          try { if (sourceTd.fauxBold !== undefined) curTd.fauxBold = sourceTd.fauxBold; } catch (e) {}
          try { if (sourceTd.fauxItalic !== undefined) curTd.fauxItalic = sourceTd.fauxItalic; } catch (e) {}
          try { if (sourceTd.tsume !== undefined) curTd.tsume = sourceTd.tsume; } catch (e) {}

          curTd.justification = sourceTd.justification;

          curTd.text = originalText;
          st.setValue(curTd);

          centerAnchorPoint(L, CFG.anchorAlign);
          applyScaleGuard(L, comp.width, CFG.safeMarginPct);
          updatedCount++;
        }
      }
    }

    if (masterBase) masterBase.enabled = false;
    if (masterAcc) masterAcc.enabled = false;

    return updatedCount;
  }

  function findAudioLayer(comp, excludeTag, targetTime) {
    var AUDIO_EXTS = /\.(mp3|wav|aac|m4a|ogg|flac|aif|aiff|wma)$/i;
    var t = (targetTime !== undefined) ? targetTime : comp.time;

    // 1. User explicitly selected an audio layer in the AE timeline:
    for (var s = 1; s <= comp.numLayers; s++) {
      var Lsel = comp.layer(s);
      if (Lsel.selected) {
        if (excludeTag && Lsel.comment && Lsel.comment.indexOf(excludeTag + ':') === 0) continue;
        if (AUDIO_EXTS.test(Lsel.name)) return Lsel;
        if (Lsel.source && Lsel.source.file && AUDIO_EXTS.test(Lsel.source.file.name)) return Lsel;
        if (Lsel.hasAudio && !Lsel.hasVideo) return Lsel;
      }
    }

    // 2. Standalone audio file (.mp3, .wav) active at targetTime (e.g. current playhead)
    for (var k = 1; k <= comp.numLayers; k++) {
      var L3 = comp.layer(k);
      if (excludeTag && L3.comment && L3.comment.indexOf(excludeTag + ':') === 0) continue;
      var isAudio = false;
      if (L3.source && L3.source.file && AUDIO_EXTS.test(L3.source.file.name)) isAudio = true;
      else if (AUDIO_EXTS.test(L3.name)) isAudio = true;
      else if (L3.hasAudio && !L3.hasVideo) isAudio = true;

      if (isAudio) {
        if (t >= (L3.inPoint - 0.05) && t < L3.outPoint) {
          return L3;
        }
      }
    }

    // 3. Fallback: Any standalone audio file in comp
    for (var m = 1; m <= comp.numLayers; m++) {
      var L4 = comp.layer(m);
      if (excludeTag && L4.comment && L4.comment.indexOf(excludeTag + ':') === 0) continue;
      if (L4.source && L4.source.file && AUDIO_EXTS.test(L4.source.file.name)) return L4;
      if (AUDIO_EXTS.test(L4.name)) return L4;
      if (L4.hasAudio && !L4.hasVideo) return L4;
    }

    return null;
  }

  function resolveAudioFile(data, captionsFilePath) {
    if (!data) return null;

    // 1. Direct path from data.audio in JSON
    if (data.audio) {
      var directF = new File(data.audio);
      if (directF.exists) return directF;

      if (captionsFilePath) {
        var capDir = (new File(captionsFilePath)).parent.fsName;
        var relF = new File(capDir + '/' + data.audio);
        if (relF.exists) return relF;
      }

      var tempF = new File('C:/Users/root/Desktop/NULLSPREAD/AfterEffects/ae-subs/temp/' + data.audio);
      if (tempF.exists) return tempF;

      var rootF = new File('C:/Users/root/Desktop/NULLSPREAD/AfterEffects/ae-subs/' + data.audio);
      if (rootF.exists) return rootF;
    }

    // 2. Sibling audio file with matching name next to captions JSON
    if (captionsFilePath) {
      var mp3Path = captionsFilePath.replace(/\.captions\.json$/i, '.mp3').replace(/\.align\.json$/i, '.mp3');
      var mp3F = new File(mp3Path);
      if (mp3F.exists) return mp3F;

      var wavPath = captionsFilePath.replace(/\.captions\.json$/i, '.wav').replace(/\.align\.json$/i, '.wav');
      var wavF = new File(wavPath);
      if (wavF.exists) return wavF;
    }

    return null;
  }

  function importAndPlaceAudioLayer(comp, audioFile, timeOffset, takeLetter, takeColor) {
    if (!audioFile || !audioFile.exists) return null;

    // Check if footage already imported into project panel
    var audioItem = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      var itm = app.project.item(i);
      if (itm instanceof FootageItem && itm.file && itm.file.fsName === audioFile.fsName) {
        audioItem = itm;
        break;
      }
    }

    // Import if not found
    if (!audioItem) {
      try {
        var io = new ImportOptions(audioFile);
        audioItem = app.project.importFile(io);
      } catch (e) {
        return null;
      }
    }

    if (audioItem) {
      // Check if an audio layer with this source is already placed at this time in comp
      for (var k = 1; k <= comp.numLayers; k++) {
        var exL = comp.layer(k);
        if (exL.source && exL.source === audioItem && Math.abs(exL.inPoint - timeOffset) < 0.08) {
          return exL;
        }
      }

      var audioLayer = comp.layers.add(audioItem);
      audioLayer.startTime = timeOffset;
      audioLayer.inPoint = timeOffset;
      
      var prefix = CFG.usePrefixes ? ('[' + takeLetter + '_VO] ') : '';
      audioLayer.name = prefix + audioFile.name;
      audioLayer.comment = CFG.tag + ':VO:' + takeLetter;
      audioLayer.label = takeColor;

      return audioLayer;
    }
    return null;
  }

  function stripPromptTags(text) {
    if (!text) return '';
    return String(text)
      .replace(/\[\/?[\w\s-]+\]/g, '')
      .replace(/<\/?[\w\s-]+>/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function cleanPopWord(w) {
    if (!w) return '';
    var t = String(w).trim();
    // 1. Strip any prompt tags
    t = t.replace(/\[\/?[\w\s-]+\]/g, '').replace(/<\/?[\w\s-]+>/g, '');
    // 2. Remove leading punctuation (except +, $, €, £, ₽, ₴, #, @, %, - when followed by digit)
    t = t.replace(/^[^\wа-яёіїєґ'\$€£₽₴%+#\-]+/gi, '');
    if (t.charAt(0) === '-' && !/^-\d/.test(t)) {
      t = t.substring(1).trim();
    }
    // 3. Remove trailing punctuation EXCEPT '!' and '?' (and '%')
    t = t.replace(/[,;:\.—–\-"'«»`~…]+$/g, '');
    t = t.replace(/\.{2,}$/g, '');
    return t;
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
      layer.property('Transform').property('Scale').setValue([100, 100]);
      var rect = layer.sourceRectAtTime(layer.inPoint + 0.05, false);
      var maxW = compW * (maxPct / 100);
      if (rect.width > maxW && rect.width > 0) {
        var fitScale = (maxW / rect.width) * 100;
        layer.property('Transform').property('Scale').setValue([fitScale, fitScale]);
      }
    } catch (e) { }
  }

  function getMaxPageId(comp, tag) {
    var max = 0;
    for (var i = 1; i <= comp.numLayers; i++) {
      var c = comp.layer(i).comment || '';
      if (c.indexOf(tag + ':') === 0) {
        var n = parseInt(c.split(':')[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return max;
  }

  function findLayer(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).name === name) return comp.layer(i);
    }
    return null;
  }

  function makeMasterLayer(comp, name, isAccent, presetIdx, presetText) {
    var L = comp.layers.addText(isAccent ? 'ACCENT STYLE' : 'BASE STYLE');
    L.name = name;
    L.enabled = false;
    L.property('Transform').property('Position').setValue([comp.width / 2, comp.height * 0.72]);
    L.label = isAccent ? LABEL_ACC : LABEL_L1;

    var st = L.property('Source Text');
    var td = st.value;
    td.fontSize = isAccent ? 64 : 58;
    td.font = 'Sora-Bold';
    td.fillColor = isAccent ? [0.03, 0.9, 0.04] : [1, 1, 1];
    td.justification = ParagraphJustification.CENTER_JUSTIFY;

    // Check if Custom Preset is selected (starts with ★)
    if (presetText && presetText.indexOf('★ ') === 0) {
      var rawCustomName = presetText.substring(2);
      var userPresets = loadUserPresets();
      if (userPresets.hasOwnProperty(rawCustomName)) {
        var customDef = isAccent ? userPresets[rawCustomName].accent : userPresets[rawCustomName].base;
        if (customDef) {
          if (customDef.font) { try { td.font = customDef.font; } catch (e) {} }
          if (customDef.fontSize) td.fontSize = customDef.fontSize;
          if (customDef.applyFill !== undefined) td.applyFill = customDef.applyFill;
          if (customDef.fillColor) td.fillColor = customDef.fillColor;
          if (customDef.applyStroke !== undefined) td.applyStroke = customDef.applyStroke;
          if (customDef.strokeColor) td.strokeColor = customDef.strokeColor;
          if (customDef.strokeWidth !== undefined) td.strokeWidth = customDef.strokeWidth;
          if (customDef.tracking !== undefined) td.tracking = customDef.tracking;
          if (customDef.allCaps !== undefined) { try { td.allCaps = customDef.allCaps; } catch (e) {} }
          if (customDef.fauxBold !== undefined) { try { td.fauxBold = customDef.fauxBold; } catch (e) {} }
          if (customDef.fauxItalic !== undefined) { try { td.fauxItalic = customDef.fauxItalic; } catch (e) {} }
          st.setValue(td);
          centerAnchorPoint(L, 'center');
          return L;
        }
      }
    }

    // Built-in presets
    if (presetIdx === 1) {
      // ✨ Luxury Editorial (White Sans + Champagne Gold Script)
      if (isAccent) {
        try { td.font = 'GoodVibesPro'; } catch(e) { try { td.font = 'Georgia-Italic'; } catch(e2) { try { td.font = 'Arial-ItalicMT'; } catch(e3){} } }
        td.fontSize = 76;
        td.fillColor = [0.96, 0.84, 0.58]; // Champagne Gold
        try { td.allCaps = false; } catch(e) {}
        td.applyStroke = false;
      } else {
        try { td.font = 'Arial-Black'; } catch(e) { try { td.font = 'Montserrat-Black'; } catch(e2) {} }
        td.fontSize = 54;
        td.fillColor = [1, 1, 1];
        try { td.allCaps = true; } catch(e) {}
        td.applyStroke = false;
      }
    } else if (presetIdx === 2) {
      // ⚡ Tokyo Cyberpunk (Cyan Base + Acid Green Accent)
      if (isAccent) {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 62;
        td.fillColor = [0.1, 1.0, 0.2]; // Acid Neon Green
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 5;
        try { td.allCaps = true; } catch(e) {}
      } else {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 56;
        td.fillColor = [0.0, 0.95, 1.0]; // Electric Cyan
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 4;
        try { td.allCaps = true; } catch(e) {}
      }
    } else if (presetIdx === 3) {
      // 🔥 Hormozi Viral (Gold Yellow + Punch Red Stroke)
      if (isAccent) {
        try { td.font = 'Montserrat-Black'; } catch(e) { try { td.font = 'Arial-Black'; } catch(e2) {} }
        td.fontSize = 64;
        td.fillColor = [1.0, 0.18, 0.18]; // Punch Red
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 6;
        try { td.allCaps = true; } catch(e) {}
      } else {
        try { td.font = 'Montserrat-Black'; } catch(e) { try { td.font = 'Arial-Black'; } catch(e2) {} }
        td.fontSize = 58;
        td.fillColor = [1.0, 0.88, 0.0]; // Pure Yellow
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 5;
        try { td.allCaps = true; } catch(e) {}
      }
    } else if (presetIdx === 4) {
      // 💎 Crypto Terminal (Electric Matrix Green + White)
      if (isAccent) {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 62;
        td.fillColor = [0.0, 1.0, 0.4]; // Terminal Green
        td.applyStroke = true;
        td.strokeColor = [0.05, 0.1, 0.08];
        td.strokeWidth = 4;
        try { td.allCaps = true; } catch(e) {}
      } else {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 54;
        td.fillColor = [0.94, 0.97, 0.98];
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 3;
        try { td.allCaps = true; } catch(e) {}
      }
    } else if (presetIdx === 5) {
      // 🌅 Sunset Pop (Vibrant Tangerine + Hot Pink)
      if (isAccent) {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 62;
        td.fillColor = [1.0, 0.2, 0.6]; // Hot Pink
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 4;
        try { td.allCaps = true; } catch(e) {}
      } else {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 56;
        td.fillColor = [1.0, 0.48, 0.0]; // Tangerine
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 4;
        try { td.allCaps = true; } catch(e) {}
      }
    } else if (presetIdx === 6) {
      // 🧊 Minimalist Clean (Ice Blue + Pure White)
      if (isAccent) {
        try { td.font = 'Helvetica-Bold'; } catch(e) { try { td.font = 'Arial-BoldMT'; } catch(e2){} }
        td.fontSize = 58;
        td.fillColor = [0.6, 0.88, 1.0]; // Soft Ice Blue
        td.applyStroke = false;
        try { td.allCaps = false; } catch(e) {}
      } else {
        try { td.font = 'Helvetica-Bold'; } catch(e) { try { td.font = 'Arial-BoldMT'; } catch(e2){} }
        td.fontSize = 52;
        td.fillColor = [1, 1, 1];
        td.applyStroke = false;
        try { td.allCaps = false; } catch(e) {}
      }
    } else if (presetIdx === 7) {
      // 🖤 High-Contrast Viral (Black Stroke + Bright Yellow)
      if (isAccent) {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 64;
        td.fillColor = [1.0, 0.92, 0.0]; // Bright Yellow
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 6;
        try { td.allCaps = true; } catch(e) {}
      } else {
        try { td.font = 'Arial-Black'; } catch(e) {}
        td.fontSize = 56;
        td.fillColor = [1, 1, 1]; // White
        td.applyStroke = true;
        td.strokeColor = [0, 0, 0];
        td.strokeWidth = 5;
        try { td.allCaps = true; } catch(e) {}
      }
    }

    st.setValue(td);
    centerAnchorPoint(L, 'center');
    return L;
  }

  function fitAnimationComposerMarkers(comp, pct, onlySelected) {
    var inFrac = pct / 100;
    var count = 0;

    for (var i = 1; i <= comp.numLayers; i++) {
      var L = comp.layer(i);
      if (onlySelected && !L.selected) continue;
      if (!onlySelected && (!L.comment || L.comment.indexOf(CFG.tag + ':') !== 0)) continue;

      var markerProp = L.property('Marker');
      if (!markerProp || markerProp.numKeys === 0) continue;

      var dur = L.outPoint - L.inPoint;
      if (dur <= 0.04) continue;

      var targetInTime = L.inPoint + (dur * inFrac);

      var markersToMove = [];
      for (var k = 1; k <= markerProp.numKeys; k++) {
        var val = markerProp.keyValue(k);
        var comm = (val.comment || '').toLowerCase();
        // Match Animation Composer markers: 'tr in', 'in', or if there's 1 marker on layer
        var isTrIn = (comm.indexOf('tr in') !== -1 || comm.indexOf('in') !== -1 || markerProp.numKeys === 1);
        var isTrOut = (comm.indexOf('tr out') !== -1 || comm.indexOf('out') !== -1);

        if (isTrIn && !isTrOut) {
          markersToMove.push({ oldIndex: k, newTime: targetInTime, val: val });
        }
      }

      if (markersToMove.length > 0) {
        // Remove old keys from highest index to lowest so key indices remain stable
        for (var m = markersToMove.length - 1; m >= 0; m--) {
          markerProp.removeKey(markersToMove[m].oldIndex);
        }
        // Re-insert at new target time
        for (var n = 0; n < markersToMove.length; n++) {
          markerProp.setValueAtTime(markersToMove[n].newTime, markersToMove[n].val);
        }
        count++;
      }
    }
    return count;
  }

  function getAutoTakeLetter(comp, isClearing) {
    if (isClearing) return 'A';
    var usedTakes = {};
    var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

    for (var i = 1; i <= comp.numLayers; i++) {
      var L = comp.layer(i);
      if (L.comment && L.comment.indexOf(CFG.tag + ':') === 0) {
        // 1. Check layer prefix [A_ / [B_
        var m = L.name.match(/\[([A-Z])_/i);
        if (m && m[1]) {
          usedTakes[m[1].toUpperCase()] = true;
        }
        // 2. Check comment take tag
        var mComm = L.comment.match(/:VO:([A-Z])(?::|$)/i);
        if (mComm && mComm[1]) {
          usedTakes[mComm[1].toUpperCase()] = true;
        }
        // 3. Check layer label color
        for (var letKey in TAKE_LABEL_COLORS) {
          if (TAKE_LABEL_COLORS.hasOwnProperty(letKey) && TAKE_LABEL_COLORS[letKey] === L.label) {
            usedTakes[letKey] = true;
          }
        }
      }
    }

    for (var k = 0; k < letters.length; k++) {
      if (!usedTakes[letters[k]]) return letters[k];
    }
    return 'A';
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
