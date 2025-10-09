// markers.js


let locData = {};
let selectedColIndex = null;
let selectedFont = "monospace";
let selectedSize = "12px";
const canvas = document.getElementById("pdf-canvas");




function newMarker(x, y, pageNum, selectedSize, selectedFont, selectedSpacing) {

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
  const card = document.querySelector(`[data-col-idx="${selectedColIndex}"]`)
  card.classList.add("loc-data-exists")
  if (selectedSpacing > 0) {
    updateRenderDoc();
  } else {
    // Render current colIndex only
    updateMarker(selectedColIndex);
  }
  saveLocData();
}

function removeMarker(colIndx) {
  delete locData[colIndx];
  const card = document.getElementById('card-col' + String(colIndx));
  card.classList.remove("loc-data-exists");
  updateMarker(selectedColIndex);
}



// checks for markers on current page & doesn't have spacing data
function renderAllMarkers() {
  // spacing data should be rendered with page, per renderAll();
  Object.keys(locData).forEach((key) => {
    const data = locData[key];
    if (data && data.page === currentPage && Number(data.spacing) <= 0) {
      renderMarker(key, data);
    }
  });
}

// remove existing marker for this col (if any), then recreate
function updateMarker(colIndex) {
  const existing = document.getElementById(`loc-${colIndex}`);
  if (existing) existing.remove();

  // check if marker exists on current page
  const data = locData?.[colIndex];
  if (!data) return;
  if (typeof currentPage !== 'number' || data.page !== currentPage) return;
  if (!syncOverlayBoxToCanvas()) { log('no overlay or canvas'); return; }

  // 
  if (Number(data.spacing) > 0) { // if there is spacing, update the Doc, not the overlay
    updateRenderDoc();
  } else {
    renderMarker(colIndex, data);
  }
}

// add marker to page
function renderMarker(colIndex, markerData) {
  const overlay = document.getElementById('pdf-overlay');
  const el = document.createElement('div');
  el.id = `loc-${colIndex}`;
  el.className = 'loc-data-el';
  if (selectedColIndex == colIndex) { el.className = 'loc-data-el select' }
  el.dataset.colIdx = String(colIndex);
  el.addEventListener('click', () => selectCard(parseInt(colIndex, 10)));
  el.style.position = 'absolute';
  el.style.pointerEvents = 'auto';

  applyDataToMarker(el, markerData);
  el.textContent = getTextContent(parseInt(colIndex, 10));
  overlay.appendChild(el);
}

/// ALSO USED BY CUSTOMTEXT
function applyDataToMarker(el, markerData) {
  // anchor bottom-left corner at (x, y)
  el.style.left = (markerData.x || 0) + 'px';
  el.style.top = (markerData.y || 0) + 'px';
  // el.style.transform = 'translate(0, -100%)'; <-- already in css

  let font = markerData.font || "_normal";

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






// Check if page has 
function pageHasNonZeroSpacing(pageNum) {
  if (!locData) return false;
  for (const key of Object.keys(locData)) {
    const d = locData[key];
    if (!d || d.page !== pageNum) continue;
    if (Number(d.spacing) > 0) return true;
  }
  return false;
}



async function copyRow(colIdx) {
  let newIdx = copyArrayColumn(csvData, colIdx);
  await saveCsvData("updated_ " + await getCsvNameFromDb());
  unselectCustomTextCreate();
  selectMarkersAndCards(newIdx);
}

// 
// Selecting Cards, Changing Font/Size/Loc
// 
// This is the onClick for the cards!!!!!
function selectCard(colIdx) {
  if (selectedColIndex === colIdx) {
    if (confirm("Double this column?")) {
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

  const markers = document.getElementById("pdf-overlay");
  const cards = document.getElementById("csv-cards");
  addSelectClassColIdx(markers, colIdx)
  addSelectClassColIdx(cards, colIdx)
}

function addSelectClassColIdx(parentContainer, colIdx) {
  Array.from(parentContainer.children).forEach((card) => {
    if (parseInt(card.dataset.colIdx) === colIdx) {
      card.classList.add("select");
    } else {
      card.classList.remove("select");
    }
  });
}

function setFontSizeSelectors(colIdx) {

  // ✅ Prefill font + size if this column already has locData
  if (locData?.[colIdx]) {
    const cfg = locData[colIdx];

    const fontSelect = document.getElementById("font-select");
    if (cfg.font) {
      fontSelect.value = cfg.font; // assumes option exists
    }

    const sizeInput = document.getElementById("size-select");
    if (cfg.size) {
      sizeInput.value = cfg.size;
    }

    const spacingInput = document.getElementById("spacing-select");
    if (cfg.spacing) {
      spacingInput.value = cfg.spacing;
    }
  } else {
    // Optional: reset to defaults when no locData
    document.getElementById("font-select").value = "_normal";
    document.getElementById("size-select").value = 12;
    document.getElementById("spacing-select").value = 0;
  }
}


// call once on startup (after the inputs exist)
// assigns event listeners
function initFontSizeHandlers() {
  const fontSel = document.getElementById('font-select');
  const sizeInp = document.getElementById('size-select');
  const spacingInp = document.getElementById('spacing-select');

  if (!fontSel || !sizeInp || !spacingInp) return log('ERROR: font/size selector(s) not detected');

  fontSel.addEventListener('change', onStyleInputChange);
  sizeInp.addEventListener('input', onStyleInputChange);
  spacingInp.addEventListener('input', onStyleInputChange);
}


function onStyleInputChange() {
  if (selectedColIndex == null && selectedCustomTextId == null) { return; }

  let markerData = {}
  if (selectedCustomTextId !== null) {
    markerData = customText[currentPage][selectedCustomTextId]
  } else if (selectedColIndex !== null) {
    markerData = locData[selectedColIndex];
  }

  // read inputs
  const rawFont = document.getElementById('font-select').value;
  const rawSize = parseInt(document.getElementById('size-select').value, 10);
  const rawSpacing = parseInt(document.getElementById('spacing-select').value, 10);

  const prevSpacingNotZero = Number(markerData.spacing) != 0;
  const nextSpacingIsZero = Number(rawSpacing) <= 0;
  const spacingToZero = prevSpacingNotZero && nextSpacingIsZero

  // normalize values
  markerData.font = rawFont
  markerData.size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 12;

  if (selectedCustomTextId !== null) {
    saveCustomText();
    updateCustomText(selectedCustomTextId);
  } else if (selectedColIndex !== null) {
    // 
    markerData.spacing = Number.isFinite(rawSpacing) && rawSpacing > 0 ? rawSpacing : 0;
    // persist + update just this marker
    saveLocData();
    if (spacingToZero) { updateRenderDoc() };
    updateMarker(selectedColIndex); // incremental re-render for this one
  }

}













//
// Deleting
//
// Assumes: db, STORE_NAME, LOC_KEY, locData, renderLocAll(), displayCSVPreviewAsCards(), log()

async function clearAllLocData() {
  if (!confirm("Delete all saved columns/custom text on page? This cannot be undone.")) return;

  // clears local and DB instance of LocData and customText
  await clearLocData();
  await clearCustomText();


  // 3) Refresh UI: remove markers and unmark CSV cards
  await renderAll(); // overlay reconcile will remove markers

  // If your CSV cards are already rendered, strip the "loc-data-exists" class:
  const container = document.getElementById("csv-cards");
  if (container) {
    Array.from(container.children).forEach(card => card.classList.remove("loc-data-exists"));
  }

  // Optionally reset font/size controls
  const fontSelect = document.getElementById("font-select");
  const sizeInput = document.getElementById("size-select");
  if (fontSelect) fontSelect.value = "monospace";
  if (sizeInput) sizeInput.value = 12;
}






async function downloadMarkers() {
  let pdfName = await getPdfNameFromDb()
  if (!confirm(`Download PDF locations for file ${pdfName}?`)) return;
  const out = [customText, locData]
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