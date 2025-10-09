// db.js

// KEYS
const DB_NAME = "PDFCache";
const STORE_NAME = "files";
const PDF_KEY = "currentPDF"; // Only ever store one PDF
const CSV_KEY = "csvData";
const LOC_KEY = "locData";
const CHK_KEY = "checkmarkData";
const RENDER_KEY = 'render_pdf'; // idb key for preview pdf

let db;

// Startup
async function loadCachedData() {
  log("Application started. Checking for cached data.");

  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore(STORE_NAME);
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    loadCache();
  };
  request.onerror = (e) => log("IndexedDB error: " + e.target.error);
}

async function loadCache() {
  await loadCachedCSV();
  await loadCachedPDF();
  await loadCachedLocData();

  if (Array.isArray(csvData) && csvData.length > 0) {
    displayCSVPreviewAsCards(csvData);
  }

  if (currentPdfBytes && currentPdfBytes.byteLength > 0) {
    loadPDF(currentPdfBytes);
  }

  if (locData && Object.keys(locData).length > 0) {
    renderLocAll(); // draw markers for current page
  }
};

// CSV
async function loadCachedCSV() {
  try {
    const data = await idbGet(CSV_KEY);
    if (!data) return;
    csvData = data;
    log(`Loaded cached CSV: (${data.length - 1} data rows)`);
  } catch (err) {
    log("Error loading cached CSV: " + (err?.message || err));
  }
}

// PDF
async function loadCachedPDF() {
  try {
    const blob = await idbGet(PDF_KEY);
    if (!blob) return;
    log(`Loaded cached PDF: ${(blob.size / 1024).toFixed(1)} KB`);
    const arrayBuffer = await blob.arrayBuffer();
    currentPdfBytes = arrayBuffer;
  } catch (err) {
    log("Error loading cached PDF: " + (err?.message || err));
  }
}

// Locations
async function loadCachedLocData() {
  try {
    locData = (await idbGet(LOC_KEY)) || {};
    if (locData && Object.keys(locData).length > 0) {
      log("Loaded cached locations.");
    }
  } catch (err) {
    log("Error loading locations: " + (err?.message || err));
  }
}


// 
// 
// Save to IndexedDB
// 
// 
function saveLocData() {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(locData, LOC_KEY);
  tx.oncomplete = () => {
    // log("Locations saved.");
  };
  tx.onerror = (err) => log("Error saving locations: " + err.target.error);
}

function saveCsvData(data) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(data, CSV_KEY);
  tx.oncomplete = () => {
    log("CSV data saved.");
    displayCSVPreviewAsCards(data);
  };
  tx.onerror = (err) => log("Error saving CSV: " + err.target.error);
}


function savePdfRenderBlob(blob) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(blob, RENDER_KEY);
  tx.oncomplete = () => {
    console.log("Saving Render PDF to IndexedDB (overwriting previous)");
  };
  tx.onerror = (err) => log("IndexedDB save error: " + err.target.error);
}


function savePdfBlob(blob) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(blob, PDF_KEY);
  tx.oncomplete = () => {
    log("Saved PDF to IndexedDB (overwriting previous)");
  };
  tx.onerror = (err) => log("IndexedDB save error: " + err.target.error);
}

// 
// 
// Get from IndexedDB
// 
// 
// Generic getter: get any value by key (e.g., CSV_KEY, PDF_KEY, LOC_KEY)
function idbGet(key) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("IndexedDB not initialized"));
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
  });
}
async function getCachedCSV() { return idbGet(CSV_KEY); }
async function getCachedPDF() { return idbGet(PDF_KEY); }
async function getCachedLoc() { return idbGet(LOC_KEY); }









// Clear IndexedDB

function clearFiles() {
  if (!confirm(`Remove all PDF/CSV data`)) {
    return;
  }

  // Delete the IndexedDB database
  const req = indexedDB.deleteDatabase("PDFCache");

  try {
    if (db && typeof db.close === "function") {
      console.log("Closing open IndexedDB connection...");
      db.close();
    }
  } catch (err) {
    console.warn("Could not close db safely, continuing to delete db:", err);
  }


  req.onsuccess = () => {
    let msg = "✅ PDFCache database deleted successfully."
    alert(msg);
    console.log(msg);
    clearGlobals();
    location.reload(); // reloads the page
  };

  req.onerror = (e) => {
    let msg = "❌ Error deleting PDFCache database:";
    log(msg);
    alert(msg);
    console.error(msg, e.target.error);
  };

  req.onblocked = () => {
    let msg = "⚠️ Database deletion is blocked (maybe other tabs open).";
    log(msg);
    console.warn(msg);
    alert("Please close other tabs of this app and try again.");
    location.reload();
  };


  clearGlobals();
}

function clearGlobals() {
  csvData = [];
  locData = {};
  selectedColIndex = null;
  pdfDoc = null;            // cached PDF as pdfjsLib document for viewing
  editDoc = null;           // PDF-Lib document with fonts
  editDocFonts = null;
  renderDoc = null;         // PDF-Lib document with edits
  currentPage = 1;
  totalPages = 0;
  currentPdfBytes = null;   // base pdf we render pages from
}