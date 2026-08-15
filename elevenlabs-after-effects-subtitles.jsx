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
    tag: 'nsub'
  };

  var MASTER_BASE = '_STYLE_BASE', MASTER_ACCENT = '_STYLE_ACCENT';
  var BUILTIN_PRESETS = [
    'None (Custom Manual — Keep Master Layers)',
    'Luxury Script (Arial Black + Good Vibes Pro)',
    'Nullspread Neon (Cyan/Green Glow)',
    'Hormozi Gold (Yellow/Red Stroke)',
    'Minimalist Clean (Drop Shadow)'
  ];

  var TAKE_LETTERS = ['Auto', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // AE Label Color Indices (0-16):
  // 14: Cyan (Голубой - Line 1)
  // 11: Orange (Оранжевый - Line 2)
  // 13: Fuchsia / Magenta (Пурпурный/Розовый - Accent)
  // 9:  Green (Зеленый - Words)
  // 5:  Lavender (Лаванда - Line 3)
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
      'Mode 4: Highlight Tracker (Full Sentence)'
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
        var isL1 = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('_L1') !== -1 || L.name.indexOf('_C1') !== -1 || L.name.indexOf('_TEXT') !== -1));
        L.selected = isL1;
        if (isL1) count++;
      }
      statusTxt.text = '| Selected ' + count + ' Line 1 layers (Cyan).';
    };

    btnSelectL2.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      var count = 0;
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        var isL2 = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('_L2') !== -1 || L.name.indexOf('_C2') !== -1));
        L.selected = isL2;
        if (isL2) count++;
      }
      statusTxt.text = '| Selected ' + count + ' Line 2 layers (Orange).';
    };

    btnSelectAcc.onClick = function () {
      var comp = app.project.activeItem;
      if (!(comp && comp instanceof CompItem)) { alert('Open a composition first!'); return; }
      var count = 0;
      for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        var isAcc = (L.comment && L.comment.indexOf(CFG.tag + ':') === 0 && (L.name.indexOf('_ACC') !== -1 || L.name.indexOf('_HI') !== -1));
        L.selected = isAcc;
        if (isAcc) count++;
      }
      statusTxt.text = '| Selected ' + count + ' Accent layers (Magenta).';
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

      app.beginUndoGroup('NS Subtitles — Sync Audio Timeline');
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
          var delta = audioStart - earliestIn;

          if (Math.abs(delta) < 0.002) {
            statusTxt.text = '| Subtitles already aligned with audio (' + audioStart.toFixed(2) + 's).';
          } else {
            for (var s = 0; s < subLayers.length; s++) {
              subLayers[s].startTime += delta;
            }
            statusTxt.text = '| Synced ' + subLayers.length + ' layers to audio at ' + audioStart.toFixed(2) + 's (shifted ' + (delta > 0 ? '+' : '') + delta.toFixed(2) + 's).';
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
          var detectedAudio = findAudioLayer(comp, CFG.tag);
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
        var builtCount = 0;

        for (var p = 0; p < data.pages.length; p++) {
          var page = data.pages[p];
          var curPageId = page.id + pageOffset;
          var lines = page.lines || [];
          var pageStart = (page.start || 0) + timeOffset - leadInSec;

          // Determine take letter
          var takeLetter = 'A';
          if (CFG.takeMode > 0) {
            takeLetter = TAKE_LETTERS[CFG.takeMode];
          } else if (page.take) {
            takeLetter = page.take;
          }

          var nextPageStart = (p + 1 < data.pages.length) ? ((data.pages[p + 1].start || 0) + timeOffset - leadInSec) : null;
          var pageEnd;
          if (nextPageStart !== null && (nextPageStart - pageStart) < 6.0) {
            pageEnd = nextPageStart;
          } else {
            pageEnd = Math.max((page.end || (page.start + 1.5)) + timeOffset + 0.8, pageStart + 1.5);
          }
          if (pageEnd - pageStart < 0.5) pageEnd = pageStart + 0.5;
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

              // Distinct Prefix & Label Color
              var lineTag = isAcc ? 'ACC' : ('L' + (li + 1));
              var prefix = CFG.usePrefixes ? ('[' + takeLetter + '_' + lineTag + '] ') : '';
              L.name = prefix + 'CAP' + pad(curPageId, 3) + '_' + lineTag;
              L.comment = CFG.tag + ':' + curPageId;
              L.inPoint = pageStart;
              L.outPoint = pageEnd;

              // Apply AE Timeline Label Color
              if (isAcc) {
                L.label = LABEL_ACC; // 13: Magenta
              } else if (li === 0) {
                L.label = LABEL_L1;  // 14: Cyan
              } else if (li === 1) {
                L.label = LABEL_L2;  // 11: Orange
              } else {
                L.label = LABEL_L3;  // 5: Lavender
              }

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

              // Apply AE Timeline Label Color
              if (isAcc3) {
                LC.label = LABEL_ACC; // 13: Magenta
              } else if (li3 === 0) {
                LC.label = LABEL_L1;  // 14: Cyan
              } else if (li3 === 1) {
                LC.label = LABEL_L2;  // 11: Orange
              } else {
                LC.label = LABEL_L3;  // 5: Lavender
              }

              var lineInTime = pageStart + (li3 * stagger);
              if (line3.words && line3.words.length > 0 && line3.words[0].s) {
                lineInTime = line3.words[0].s + timeOffset - leadInSec;
                if (lineInTime < pageStart) lineInTime = pageStart;
              }
              if (lineInTime >= pageEnd) lineInTime = Math.max(0, pageEnd - 0.2);
              LC.inPoint = lineInTime;
              LC.outPoint = pageEnd;

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
          // MODE 2: SINGLE WORD FLASH [W]
          else if (CFG.layoutMode === 2) {
            var flatWords = [];
            for (var p2 = 0; p2 < data.pages.length; p2++) {
              var pg2 = data.pages[p2];
              var lns2 = pg2.lines || [];
              var wordTake = pg2.take || takeLetter;
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
              var itemTake = (CFG.takeMode > 0) ? TAKE_LETTERS[CFG.takeMode] : (item.take || 'A');
              var prefixW = CFG.usePrefixes ? ('[' + itemTake + '_W] ') : '';
              LW.name = prefixW + 'CAP' + pad(curPageId2, 3) + '_W' + pad(fw + 1, 2);
              LW.comment = CFG.tag + ':' + curPageId2;
              LW.inPoint = wStart;
              LW.outPoint = wEnd;
              LW.label = item.isAccent ? LABEL_ACC : LABEL_WORD;

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
            break;
          }
          // MODE 4: HIGHLIGHT TRACKER [T] + [HI]
          else if (CFG.layoutMode === 4) {
            var fullText4 = [];
            for (var lt4 = 0; lt4 < lines.length; lt4++) {
              fullText4.push(lines[lt4].text);
            }
            var combinedText4 = fullText4.join(' ');

            var LT = masterBase.duplicate();
            LT.enabled = true;
            var prefixT = CFG.usePrefixes ? ('[' + takeLetter + '_T] ') : '';
            LT.name = prefixT + 'CAP' + pad(curPageId, 3) + '_TEXT';
            LT.comment = CFG.tag + ':' + curPageId;
            LT.inPoint = pageStart;
            LT.outPoint = pageEnd;
            LT.label = LABEL_L1;

            var stT = LT.property('Source Text');
            var tdT = stT.value;
            tdT.text = combinedText4;
            stT.setValue(tdT);

            var posTX = CFG.centerX ? (comp.width / 2) : LT.property('Transform').property('Position').value[0];
            LT.property('Transform').property('Position').setValue([posTX, baseY]);
            centerAnchorPoint(LT, CFG.anchorAlign);
            applyScaleGuard(LT, comp.width, CFG.safeMarginPct);
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

              var wordIdx4 = combinedText4.indexOf(hw.w, charCursor4);
              if (wordIdx4 === -1) wordIdx4 = charCursor4;
              charCursor4 = wordIdx4 + (hw.w || '').length;

              var wordChars = (hw.w || '').length;
              var estWordW = Math.max(wordChars * charWidth4 * 1.15, 50);
              var estWordH = Math.max(textRect4.height * 1.15, 60);
              shapeRect.property('Size').setValue([estWordW, estWordH]);
              shapeFill.property('Color').setValue([0.03, 0.9, 0.04, 1]);

              var wordCenterX = textLeft4 + (wordIdx4 + (wordChars / 2)) * charWidth4;
              shapeHi.property('Transform').property('Position').setValue([wordCenterX, baseY]);
              shapeHi.property('Transform').property('Opacity').setValue(30);

              builtCount++;
            }
          }
        }

        statusTxt.text = '| Built ' + builtCount + ' subtitle layers (' + startDesc + ')!';
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

  function findAudioLayer(comp, excludeTag) {
    var AUDIO_EXTS = /\.(mp3|wav|aac|m4a|ogg|flac|aif|aiff|wma)$/i;

    for (var i = 1; i <= comp.numLayers; i++) {
      var L = comp.layer(i);
      if (excludeTag && L.comment && L.comment.indexOf(excludeTag + ':') === 0) continue;
      try { if (L.hasAudio) return L; } catch (e) {}
    }

    for (var j = 1; j <= comp.numLayers; j++) {
      var L2 = comp.layer(j);
      if (excludeTag && L2.comment && L2.comment.indexOf(excludeTag + ':') === 0) continue;
      try { if (L2.source && L2.source.hasAudio) return L2; } catch (e) {}
    }

    for (var k = 1; k <= comp.numLayers; k++) {
      var L3 = comp.layer(k);
      if (excludeTag && L3.comment && L3.comment.indexOf(excludeTag + ':') === 0) continue;
      try {
        if (L3.source && L3.source.file && AUDIO_EXTS.test(L3.source.file.name)) return L3;
      } catch (e) {}
    }

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
      // Luxury Script (Arial Black + Good Vibes Pro)
      if (isAccent) {
        try { td.font = 'GoodVibesPro'; } catch(e) { try { td.font = 'Good Vibes Pro'; } catch(e2) {} }
        td.fontSize = 78;
        td.fillColor = [1, 1, 1];
        try { td.allCaps = false; } catch(e) {}
      } else {
        try { td.font = 'Arial-Black'; } catch(e) { try { td.font = 'Arial Black'; } catch(e2) {} }
        td.fontSize = 54;
        td.fillColor = [1, 1, 1];
        try { td.allCaps = true; } catch(e) {}
      }
    } else if (presetIdx === 2) {
      // Nullspread Neon
      td.fillColor = isAccent ? [0, 1, 0.8] : [1, 1, 1];
    } else if (presetIdx === 3) {
      // Hormozi Gold
      td.font = 'Montserrat-Black';
      td.fillColor = isAccent ? [1, 0.85, 0] : [1, 1, 1];
      td.applyStroke = true;
      td.strokeColor = [0, 0, 0];
      td.strokeWidth = 4;
    } else if (presetIdx === 4) {
      // Minimalist Clean
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
