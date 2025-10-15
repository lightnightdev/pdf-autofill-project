// markers.js

let locData = {};
let selectedColIndex = null;
let selectedFont = 'monospace';
let selectedSize = '12px';
const canvas = document.getElementById('pdf-canvas');

function newMarker(x, y, pageNum, selectedSize, selectedFont, selectedSpacing) {
  const needToReRender = needsReRender(
    locData[selectedColIndex]?.spacing ?? 0,
    selectedSpacing
  );

  // Save to locData
  locData[selectedColIndex] = {
    x: x,
    y: y,
    page: pageNum,
    font: selectedFont,
    size: selectedSize,
    spacing: selectedSpacing,
    stageW: canvas?.width || 1,     // 👈 store capture canvas size
    stageH: canvas?.height || 1,
  };

  // Add element to card
  const card = document.querySelector(`[data-col-idx='${selectedColIndex}']`);
  card.classList.add('loc-data-exists');
  if (selectedSpacing > 0) {
    queueUpdateRenderDoc();
  } else {
    // Render current colIndex only
    updateMarker(selectedColIndex);
  }
  saveLocData();
}

function removeMarker(colIndx) {
  delete locData[colIndx];
  const card = document.getElementById('card-col' + String(colIndx));
  card.classList.remove('loc-data-exists');
  updateMarker(selectedColIndex);
}

// checks for markers on current page & doesn't have spacing data
function renderAllMarkers() {
  
  // spacing data should be rendered with page, per renderAll();
  Object.keys(locData).forEach((key) => {
    const data = locData[key];
    const spacing = Number(data.spacing ?? 0); // null/undefined → 0, text → numeric conversion
    if (data && data.page === currentPage) {
      renderMarker(key, data);
    }
  });
}

// remove existing marker for this col (if any), then recreate
function updateMarker(colIndex, needToReRender = false) {
  const existing = document.getElementById(`loc-${colIndex}`);
  if (existing) existing.remove();

  // check if marker exists on current page
  const data = locData?.[colIndex];
  if (!data) return;
  if (typeof currentPage !== 'number' || data.page !== currentPage) return;
  if (!syncOverlayBoxToCanvas()) {
    log('no overlay or canvas');
    return;
  }

  // If baked-in spacing element is added or removed,
  if (needToReRender) {
    queueUpdateRenderDoc();
  }
  
  renderMarker(colIndex, data);
}

// add marker to page
function renderMarker(colIndex, markerData) {
  const overlay = document.getElementById('pdf-overlay');
  const el = document.createElement('div');
  el.id = `loc-${colIndex}`;
  el.className = 'loc-data-el';
  const isSelected = selectedColIndex === colIndex;
  if (isSelected) {
    el.classList.add('select')
  }
  el.dataset.colIdx = String(colIndex);
  el.addEventListener('click', () => selectCard(parseInt(colIndex, 10)));
  el.style.position = 'absolute';
  el.style.pointerEvents = 'auto';
  applyDataToMarker(el, markerData);
  const mText = getTextContent(parseInt(colIndex, 10));

  // --- handle spacing ---
  const spacing = Number(markerData.spacing);
  if (!isNaN(spacing) && spacing > 0) {
    // replace each character (including spaces) with a space
    el.classList.add('invisible-text')
    queueUpdateRenderDoc();
  } 
  el.textContent = mText;
  
  overlay.appendChild(el);
}

/// ALSO USED BY CUSTOMTEXT
function applyDataToMarker(el, markerData) {
  // anchor bottom-left corner at (x, y)
  el.style.left = (markerData.x || 0) + 'px';
  el.style.top = (markerData.y || 0) + 'px';
  // el.style.transform = 'translate(0, -100%)'; <-- already in css

  let font = markerData.font || '_normal';

  el.style.fontFamily = font;
  el.style.fontSize = (parseInt(markerData.size, 10) || 12) + 'px';
  el.style.letterSpacing = (parseInt(markerData.spacing, 10) || 0) + 'pt';
}

function getTextContent(colIndex) {
  const rowVal = csvData?.[1]?.[colIndex];
  if (rowVal && rowVal.trim() !== '') return rowVal;

  const header = csvData?.[0]?.[colIndex];
  if (header && header.trim() !== '') return `[${header}]`;

  return `Col ${colIndex}`;
}

function needsReRender(prevSpacing, nextSpacing) {
  const prevNotZero = Number(prevSpacing) !== 0;
  const nextNotZero = Number(nextSpacing) !== 0;
  return prevNotZero !== nextNotZero; // XOR
}

async function copyRow(colIdx) {
  let newIdx = copyArrayColumn(csvData, colIdx);
  const oldName = await getCsvNameFromDb();
  const newName = oldName.startsWith('edited_') ? oldName : 'edited_' + oldName;

  await saveCsvData(newName);
  unselectCustomTextCreate();
  selectMarkersAndCards(newIdx);
}

//
// Selecting Cards, Changing Font/Size/Loc
//
// This is the onClick for the cards!!!!!
function selectCard(colIdx) {
  if (selectedColIndex === colIdx) {
    if (confirm('Double this column?')) {
      copyRow(colIdx);
      return;
    }
  }
  unselectCustomTextCreate();
  selectMarkersAndCards(colIdx);
}

function selectMarkersAndCards(colIdx) {
  if (colIdx == -1) {
    selectedColIndex = null;
  } else {
    selectedColIndex = colIdx;
  }

  const markers = document.getElementById('pdf-overlay');
  const cards = document.getElementById('csv-cards');
  addSelectClassColIdx(markers, colIdx)
  addSelectClassColIdx(cards, colIdx)
  setFontSizeSelectors(colIdx);
}

function addSelectClassColIdx(parentContainer, colIdx) {
  Array.from(parentContainer.children).forEach((card) => {
    if (parseInt(card.dataset.colIdx) === colIdx) {
      card.classList.add('select');
    } else {
      card.classList.remove('select');
    }
  });
}

function setFontSizeSelectors(colIdx) {
  // ✅ Prefill font + size if this column already has locData
  if (locData?.[colIdx]) {
    const cfg = locData[colIdx];

    const fontSelect = document.getElementById('font-select');
    if (cfg.font) {
      fontSelect.value = cfg.font; // assumes option exists
    }

    const sizeInput = document.getElementById('size-select');
    if (cfg.size) {
      sizeInput.value = cfg.size;
    }

    const spacingInput = document.getElementById('spacing-select');
    if (cfg.spacing) {
      spacingInput.value = cfg.spacing;
    }
  } else {
    // Optional: reset to defaults when no locData
    document.getElementById('font-select').value = '_normal';
    document.getElementById('size-select').value = 12;
    document.getElementById('spacing-select').value = 0;
  }
}

// call once on startup (after the inputs exist)
// assigns event listeners
function initFontSizeHandlers() {
  const fontSel = document.getElementById('font-select');
  const sizeInp = document.getElementById('size-select');
  const spacingInp = document.getElementById('spacing-select');

  if (!fontSel || !sizeInp || !spacingInp)
    return log('ERROR: font/size selector(s) not detected');

  fontSel.addEventListener('change', onStyleInputChange);
  sizeInp.addEventListener('input', onStyleInputChange);
  spacingInp.addEventListener('input', onStyleInputChange);
}

function onStyleInputChange() {
  if (selectedColIndex == null && selectedCustomTextId == null) return;

  const isCustomText = selectedCustomTextId !== null;
  const markerData = isCustomText
    ? customText[currentPage]?.[selectedCustomTextId]
    : locData?.[selectedColIndex];

  if (!markerData) return;

  // read inputs
  const rawFont = document.getElementById('font-select').value;
  const rawSize = parseInt(document.getElementById('size-select').value, 10);
  const rawSpacing = parseInt(
    document.getElementById('spacing-select').value,
    10
  );

  const needToReRender = needsReRender(markerData.spacing, rawSpacing);

  // set values
  markerData.font = rawFont;
  markerData.size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 12;
  markerData.spacing =
    Number.isFinite(rawSpacing) && rawSpacing > 0 ? rawSpacing : 0;

  if (isCustomText) {
    saveCustomText();
    updateCustomText(selectedCustomTextId);
  } else {
    //
    // persist + update just this marker
    saveLocData();
    updateMarker(selectedColIndex); // incremental re-render for this one
  }

  if (needToReRender) {
    queueUpdateRenderDoc();
  }
}

//
// Deleting
//
// Assumes: db, STORE_NAME, LOC_KEY, locData, renderLocAll(), displayCSVPreviewAsCards(), log()

async function clearAllMarkers() {
  if (
    !confirm(
      'Delete all saved column markers/custom text on page? This cannot be undone.'
    )
  )
    return;

  // clears local and DB instance of LocData and customText
  await clearLocData();
  await clearCustomText();

  // clear any changes to rendered PDF
  await createEditDoc();

  // Refresh UI: remove markers and unmark CSV cards
  await renderAll(); // overlay reconcile will remove markers

  // If your CSV cards are already rendered, strip the 'loc-data-exists' class:
  const container = document.getElementById('csv-cards');
  if (container) {
    Array.from(container.children).forEach((card) =>
      card.classList.remove('loc-data-exists')
    );
  }

  // Optionally reset font/size controls
  const fontSelect = document.getElementById('font-select');
  const sizeInput = document.getElementById('size-select');
  if (fontSelect) fontSelect.value = '_normal';
  if (sizeInput) sizeInput.value = 12;
}

async function downloadMarkers() {
  let pdfName = await getPdfNameFromDb();
  if (!confirm(`Download PDF locations for file ${pdfName}?`)) return;
  const out = [customText, locData];
  const jsonString = JSON.stringify(out, null, 2); // null for replacer, 2 for indentation
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pdfName}-markers.json`; // or whatever filename you want
  a.click();
  URL.revokeObjectURL(url); // cleanup
}

async function uploadMarkers() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const [customTextData, locDataData] = JSON.parse(text);

      customText = customTextData;
      locData = locDataData;

      await saveLocData();
      await saveCustomText();

      log('Markers uploaded successfully');
      renderAll();
    } catch (error) {
      alert('Error loading markers file: ' + error.message);
    }
  };

  input.click();
}
