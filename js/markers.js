// markers.js


let locData = [];
let selectedColIndex = null;
let selectedFont = "monospace";
let selectedSize = "12px";
let selectedSpacing = "0";
const canvas = document.getElementById("pdf-canvas");

function ensureLocDataArray() {
  if (!Array.isArray(locData)) {
    locData = [];
  }
}

function getPageMarkers(pageNum, create = false) {
  ensureLocDataArray();
  const pageIndex = Number(pageNum);
  if (!Number.isFinite(pageIndex) || pageIndex < 0) {
    return [];
  }
  if (!Array.isArray(locData[pageIndex])) {
    if (create) {
      locData[pageIndex] = [];
    } else {
      return [];
    }
  }
  return locData[pageIndex];
}

function findMarkerEntryByCol(colIndex) {
  if (!Array.isArray(locData)) return null;
  const target = Number(colIndex);
  for (let page = 0; page < locData.length; page++) {
    const pageMarkers = locData[page];
    if (!Array.isArray(pageMarkers)) continue;
    for (let idx = 0; idx < pageMarkers.length; idx++) {
      const marker = pageMarkers[idx];
      if (marker && Number(marker.colIndex) === target) {
        return { marker, page, index: idx };
      }
    }
  }
  return null;
}

function getMarkerData(colIndex) {
  const entry = findMarkerEntryByCol(colIndex);
  return entry ? entry.marker : null;
}

function removeMarkerData(colIndex) {
  const entry = findMarkerEntryByCol(colIndex);
  if (!entry) return;
  const { page, index } = entry;
  const pageMarkers = locData[page];
  pageMarkers.splice(index, 1);
  if (pageMarkers.length === 0) {
    locData[page] = [];
  }
}

function columnHasMarker(colIndex) {
  return !!getMarkerData(colIndex);
}

function hasAnyLocMarkers() {
  return Array.isArray(locData) && locData.some((page) => Array.isArray(page) && page.length > 0);
}

function forEachMarker(callback) {
  if (!Array.isArray(locData)) return;
  for (let page = 0; page < locData.length; page++) {
    const pageMarkers = locData[page];
    if (!Array.isArray(pageMarkers)) continue;
    pageMarkers.forEach((marker, idx) => {
      if (!marker) return;
      callback(marker, idx, page);
    });
  }
}




function newMarker(x, y, pageNum) {
  // Get selected elements
  const selectedSizeInput = document.getElementById('size-select');
  const selectedFontInput = document.getElementById('font-select');
  const selectedSpacingInput = document.getElementById('spacing-select');
  selectedSize = selectedSizeInput.value ? selectedSizeInput.value : "12";
  selectedFont = selectedFontInput.value;
  selectedSpacing = selectedSpacingInput.value ? selectedSpacingInput.value : "0";

  // Save to locData
  const marker = {
    colIndex: selectedColIndex,
    x: x,
    y: y,
    page: pageNum,
    font: selectedFont,
    size: selectedSize,
    spacing: selectedSpacing,
    stageW: canvas?.width || 1,     // 👈 store capture canvas size
    stageH: canvas?.height || 1,
  };

  removeMarkerData(selectedColIndex);
  const pageMarkers = getPageMarkers(pageNum, true);
  pageMarkers.push(marker);

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
  removeMarkerData(colIndx);
  const card = document.getElementById('card-col' + String(colIndx));
  card.classList.remove("loc-data-exists");
  updateMarker(selectedColIndex);
}



// checks for markers on current page & doesn't have spacing data
function renderAllMarkers() {
  // spacing data should be rendered with page, per renderAll();
  const pageMarkers = getPageMarkers(currentPage);
  pageMarkers.forEach((marker) => {
    if (marker && Number(marker.spacing) <= 0) {
      renderMarker(marker.colIndex, marker);
    }
  });
}

// remove existing marker for this col (if any), then recreate
function updateMarker(colIndex) {
  const existing = document.getElementById(`loc-${colIndex}`);
  if (existing) existing.remove();

  // check if marker exists on current page
  const data = getMarkerData(colIndex);
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

  applyDataToMarker(el, markerData, colIndex);
  overlay.appendChild(el);
}

function applyDataToMarker(el, markerData, colIndex) {
  // anchor bottom-left corner at (x, y)
  el.style.left = (markerData.x || 0) + 'px';
  el.style.top = (markerData.y || 0) + 'px';
  // el.style.transform = 'translate(0, -100%)'; <-- already in css

  let font = markerData.font || CreatoDisplay;

  el.style.fontFamily = font;
  el.style.fontSize = (parseInt(markerData.size, 10) || 12) + 'px';
  el.style.letterSpacing = (parseInt(markerData.spacing, 10) || 0) + 'pt';
  el.textContent = getTextContent(parseInt(colIndex, 10));
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
  const pageMarkers = getPageMarkers(pageNum);
  for (const marker of pageMarkers) {
    if (!marker) continue;
    if (Number(marker.spacing) > 0) return true;
  }
  return false;
}







// 
// Selecting Cards, Changing Font/Size/Loc
// 
// This is the onClick for the cards!!!!!
function selectCard(colIdx) {
  selectedColIndex = colIdx;
  unselectCheckmark();
  const markers = document.getElementById("pdf-overlay");
  const cards = document.getElementById("csv-cards");
  selectMarkersAndCards(colIdx);
}

function selectMarkersAndCards(colIdx) {
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
  const marker = getMarkerData(colIdx);
  if (marker) {
    const cfg = marker;

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
  if (selectedColIndex == null) { return; }
  if (!locData) locData = [];

  // Return if entry doesn't exist
  const markerData = getMarkerData(selectedColIndex);
  if (!markerData) { return; }

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
  markerData.spacing = Number.isFinite(rawSpacing) && rawSpacing > 0 ? rawSpacing : 0;

  // persist + update just this marker
  try { saveLocData && saveLocData(); } catch { }

  if (spacingToZero) { updateRenderDoc() };
  updateMarker(selectedColIndex); // incremental re-render for this one

}













//
// Deleting
//
// Assumes: db, STORE_NAME, LOC_KEY, locData, renderLocAll(), displayCSVPreviewAsCards(), log()

async function clearAllLocData() {
  if (!confirm("Delete all saved markers and checkmarks? This cannot be undone.")) return;

  // clears local and DB instance of LocData and checkmarks
  await clearLocDB();
  await clearAllCheckmarks();


  // 3) Refresh UI: remove markers and unmark CSV cards
  renderAll(); // overlay reconcile will remove markers

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
