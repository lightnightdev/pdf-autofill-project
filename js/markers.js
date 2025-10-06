

//  Global Variables

let selectedColIndex = null;
let selectedFont = "monospace";
let selectedSize = "12px";
const canvas = document.getElementById("pdf-canvas");




// 
// 
// Track clicks on page
// 
// 
canvas.addEventListener("click", (e) => {
  if (selectedColIndex === null) {
    log("ERROR: Please select a column first!");
    return;
  }

  // Get click coordinates relative to the canvas
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Get selected elements
  const selectedFontInput = document.getElementById('font-select');
  const selectedSizeInput = document.getElementById('size-select');
  selectedFont = selectedFontInput.value;
  selectedSize = selectedSizeInput.value ? selectedSizeInput.value : "12";

  // Get the selected column data (first visible row as example)
  const headerText = csvData[0][selectedColIndex];
  const firstRowText = csvData[1][selectedColIndex];

  // Save to locData
  locData[selectedColIndex] = {
    x: x,
    y: y,
    page: currentPage,
    font: selectedFont,
    size: selectedSize,
    stageW: canvas?.width || 1,     // 👈 store capture canvas size
    stageH: canvas?.height || 1
  };

  // Add element to card
  const card = document.querySelector(`[data-col-idx="${selectedColIndex}"]`)
  card.classList.add("loc-data-exists")

  log('');
  log(`${headerText}`);
  log(` -Row 1: ${firstRowText}`);
  log(` -Loc: x=${x}, y=${y}, pg=${currentPage}`);
  log(` -Font: ${selectedFont}, Size: ${selectedSize}`);

  // Render current colIndex only
  renderLoc(selectedColIndex);
  saveLocData();

});





//
// Rendering
//
function renderLocAll() {
  if (!syncOverlayBoxToCanvas()) { log('no overlay or canvas'); return; }
  if (typeof currentPage !== 'number' || !locData) { log('No page/text to render.'); return; }

  const overlay = document.getElementById('pdf-overlay');

  // 1) Clear everything
  overlay.innerHTML = '';

  // 2) Recreate only markers for this page
  Object.keys(locData).forEach((key) => {
    const data = locData[key];
    if (data && data.page === currentPage) {
      createMarker(key, data, overlay);
    }
  });
}

function renderLoc(colIndex) {
  // incremental update for just one column
  const data = locData?.[colIndex];
  if (!data) return;
  if (typeof currentPage !== 'number' || data.page !== currentPage) return;
  if (!syncOverlayBoxToCanvas()) return;

  const overlay = document.getElementById('pdf-overlay');
  // remove existing marker for this col (if any), then recreate
  const existing = document.getElementById(`loc-${colIndex}`);
  if (existing) existing.remove();
  createMarker(colIndex, data, overlay);
}

function createMarker(colIndex, markerData, overlay) {
  const el = document.createElement('div');
  el.id = `loc-${colIndex}`;
  el.className = 'loc-data-el';
  el.dataset.colIndex = String(colIndex);
  el.style.position = 'absolute';
  el.style.pointerEvents = 'auto';

  applyDataToMarker(el, markerData, colIndex);
  overlay.appendChild(el);
}

function applyDataToMarker(el, markerData, colIndex) {
  // anchor bottom-left corner at (x, y)
  el.style.left = (markerData.x || 0) + 'px';
  el.style.top  = (markerData.y || 0) + 'px';
  // el.style.transform = 'translate(0, -100%)'; <-- already in css

  let font = markerData.font || CreatoDisplay;

  el.style.fontFamily = font;
  el.style.fontSize   = (parseInt(markerData.size, 10) || 12) + 'px';

  el.textContent = getTextContent(parseInt(colIndex, 10));
}

function getTextContent(colIndex) {
  const rowVal = csvData?.[1]?.[colIndex];
  if (rowVal && rowVal.trim() !== '') return rowVal;

  const header = csvData?.[0]?.[colIndex];
  if (header && header.trim() !== '') return `[${header}]`;

  return `Col ${colIndex}`;
}

function syncOverlayBoxToCanvas() {
  const overlay = document.getElementById('pdf-overlay');
  const canvas  = document.getElementById('pdf-canvas');
  if (!overlay || !canvas) return false;

  overlay.style.width  = canvas.width  + 'px';
  overlay.style.height = canvas.height + 'px';
  overlay.style.left   = '0px';
  overlay.style.top    = '0px';
  overlay.style.position = 'absolute';
  overlay.style.zIndex = 10;
  overlay.style.pointerEvents = 'none'; // markers can re-enable selectively
  return true;
}












// 
// Selecting Cards & Font/Size
// 

function selectCard(colIdx) {
  selectedColIndex = colIdx;
  const container = document.getElementById("csv-cards");

  Array.from(container.children).forEach((card) => {
    if (parseInt(card.dataset.colIdx) === colIdx) {
      card.classList.add("card-select");
    } else {
      card.classList.remove("card-select");
    }
  });
  setFontSizeSelectors(colIdx);
}

function setFontSizeSelectors(colIdx) {
  // ✅ Prefill font + size if this column already has locData
  const card = document.querySelector(`[data-col-idx="${colIdx}"]`);
  if (card && card.classList.contains("loc-data-exists") && locData?.[colIdx]) {
    log('setting');
    const cfg = locData[colIdx];

    const fontSelect = document.getElementById("font-select");
    if (cfg.font) {
      fontSelect.value = cfg.font; // assumes option exists
    }

    const sizeInput = document.getElementById("size-select");
    if (cfg.size) {
      sizeInput.value = cfg.size;
    }
  } else {
    // Optional: reset to defaults when no locData
    document.getElementById("font-select").value = "CreatoDisplay";
    document.getElementById("size-select").value = 12;
  }
}



// call once on startup (after the inputs exist)
// assigns event listeners
function initFontSizeHandlers() {
  const fontSel = document.getElementById('font-select');
  const sizeInp = document.getElementById('size-select');

  if (!fontSel || !sizeInp) return log('ERROR: font/size selector(s) not detected');

  fontSel.addEventListener('change', onStyleInputChange);
  sizeInp.addEventListener('input',  onStyleInputChange); // live as you type
}


function onStyleInputChange() {
  if (selectedColIndex == null) { return; }
  if (!locData) locData = {};

  // Return if entry doesn't exist
  const markerData = locData[selectedColIndex];
  if (!markerData) { return; }

  // read inputs
  const rawFont = document.getElementById('font-select').value;
  const rawSize = parseInt(document.getElementById('size-select').value, 10);

  // normalize values
  markerData.font = rawFont
  markerData.size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 12;

  // persist + update just this marker
  try { saveLocData && saveLocData(); } catch {}
  renderLoc(selectedColIndex); // incremental re-render for this one
}
























//
// Deleting
//
// Assumes: db, STORE_NAME, LOC_KEY, locData, renderLocAll(), displayCSVPreviewAsCards(), log()

async function clearAllLocData() {
  if (!confirm("Delete all saved locations? This cannot be undone.")) return;

  // 1) Clear locally
  locData = {};
  try {
    // 2) Clear in IndexedDB
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(LOC_KEY);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    log("All location data deleted.");
  } catch (err) {
    log("Error deleting location data: " + (err?.message || err));
  }

  // 3) Refresh UI: remove markers and unmark CSV cards
  renderLocAll(); // overlay reconcile will remove markers

  // If your CSV cards are already rendered, strip the "loc-data-exists" class:
  const container = document.getElementById("csv-cards");
  if (container) {
    Array.from(container.children).forEach(card => card.classList.remove("loc-data-exists"));
  }

  // Optionally reset font/size controls
  const fontSelect = document.getElementById("font-select");
  const sizeInput  = document.getElementById("size-select");
  if (fontSelect) fontSelect.value = "monospace";
  if (sizeInput)  sizeInput.value  = 12;
}


