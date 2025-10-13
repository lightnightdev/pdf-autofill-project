// db.js

// KEYS
const DB_NAME = "PDFCache";
const DB_VERSION = 1;
const STORE_NAME = "files";
const PDF_KEY = "currentPDF";
const PDF_NAME_KEY = "pdfName";
const CSV_KEY = "csvData";
const CSV_NAME_KEY = "csvName";
const LOC_KEY = "locData";
const TXT_KEY = "customTextData";
const RENDER_KEY = 'render_pdf'; // idb key for preview pdf

let db; // IDBDatabase

// ===== IndexedDB core helpers =====
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
}

function ensureDB() {
  return db ? Promise.resolve(db) : openDB().then((handle) => (db = handle));
}

function idbTx(mode = "readonly") {
  if (!db) throw new Error("IndexedDB not initialized");
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function idbGet(key) {
  return ensureDB().then(() => new Promise((resolve, reject) => {
    const req = idbTx("readonly").get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
  }));
}

function idbPut(key, value) {
  return ensureDB().then(() => new Promise((resolve, reject) => {
    const store = idbTx("readwrite");
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("IndexedDB put failed"));
  }));
}

// ===== Startup / Cache loading =====
async function loadCachedData() {
  log("Checking for cached data...");

  try {
    db = await ensureDB(); // assures DB exists and is assigned to db
  } catch (e) {
    log("IndexedDB error: " + (e?.message || e));
    return;
  }

  await loadCache();
}

async function loadCache() {
  // Load everything in parallel, then run UI hooks in original order
  await Promise.all([
    loadCachedCSV(),
    loadCachedPDF(),
    loadCachedLocData(),
    loadCachedCustomText(),
  ]);

  const csvIsValid = Array.isArray(csvData) && csvData.length > 0
  const pdfIsValid = currentPdfBytes && currentPdfBytes.byteLength > 0

  if (csvIsValid) {
    displayCSVPreviewAsCards(csvData);
    csvButton(true, await getCsvNameFromDb())
  }

  if (pdfIsValid) {
    loadPDF(currentPdfBytes);
    pdfButton(true, currentPdfName)
  }

  if (csvIsValid && pdfIsValid ) {
    setTimeout( function () {
      closeMenu(1)
      openMenu(2)
    },
    1000);
  }
}

// ===== CSV =====
async function loadCachedCSV() {
  try {
    const data = await idbGet(CSV_KEY);
    if (!data) return;
    csvData = data;
    log(` - Loaded CSV: (${data.length - 1} data rows)`);
  } catch (err) {
    log("Error loading cached CSV: " + (err?.message || err));
  }
}

// ===== PDF =====
async function loadCachedPDF() {
  try {
    const blob = await idbGet(PDF_KEY);
    if (!blob) return;
    log(` - Loaded PDF: ${(blob.size / 1024).toFixed(1)} KB`);
    currentPdfBytes = await blob.arrayBuffer();
    currentPdfName = await getPdfNameFromDb();
  } catch (err) {
    log("Error loading cached PDF: " + (err?.message || err));
  }
}

// ===== Locations =====
async function loadCachedLocData() {
  try {
    locData = (await idbGet(LOC_KEY)) || {};
    if (locData && Object.keys(locData).length > 0) {
      log(" - Loaded markers.");
    }
  } catch (err) {
    log("Error loading locations: " + (err?.message || err));
  }
}

// ===== Custom Text =====
async function loadCachedCustomText() {
  try {
    customText = (await idbGet(TXT_KEY)) || {};
    if (Array.isArray(customText) && customText.length > 0) {
      log(" - Loaded custom text.");
    }
  } catch (err) {
    log("Error loading custom text: " + (err?.message || err));
  }
}

// ===== Save helpers =====

async function saveLocData() {
  try {
    await idbPut(LOC_KEY, locData);
  } catch (err) {
    log("Error saving " + String(LOC_KEY) + ":" + (err?.message || err));
  }
}

async function saveCustomText() {
  try {
    await idbPut(TXT_KEY, customText);
  } catch (err) {
    log("Error saving custom text: " + (err?.message || err));
  }
}

async function saveCsvData(csvName) {
  try {
    await idbPut(CSV_KEY, csvData);
    await idbPut(CSV_NAME_KEY, csvName);
    log("CSV data saved.");
    displayCSVPreviewAsCards(csvData);
    csvButton(true, csvName);
  } catch (err) {
    log("Error saving CSV: " + (err?.message || err));
  }
}

async function savePdfRenderBlob(blob) {
  try {
    await idbPut(RENDER_KEY, blob);
    console.log("Saving Render PDF to IndexedDB (overwriting previous)");
  } catch (err) {
    log("IndexedDB save error: " + (err?.message || err));
  }
}

async function savePdfBlob(blob, pdfName) {
  if (!pdfName || pdfName === "") { pdfName = "form.pdf" }
  try {
    await idbPut(PDF_KEY, blob);
    await idbPut(PDF_NAME_KEY, pdfName);
    log("Saved PDF to IndexedDB (overwriting previous)");
  } catch (err) {
    log("IndexedDB save error: " + (err?.message || err));
  }
}

async function getPdfNameFromDb() {
  try {
    const pdfName = await idbGet(PDF_NAME_KEY) || "unknown.pdf"
    return pdfName;
  } catch (err) {
    log('Unable to get PDF name.');
    return 'x.pdf';
  }
}

async function getCsvNameFromDb() {
  try {
    const csvName = await idbGet(CSV_NAME_KEY) || "unknown.csv"
    return csvName;
  } catch (err) {
    log('Unable to get CSV name.');
    return 'x.csv';
  }
}
// ===== Clear IndexedDB =====
function clearFiles() {
  if (!confirm(`Remove all PDF/CSV data`)) return;

  // Best-effort close before delete
  try {
    if (db && typeof db.close === "function") {
      console.log("Closing open IndexedDB connection...");
      db.close();
    }
  } catch (err) {
    console.warn("Could not close db safely, continuing to delete db:", err);
  }

  const req = indexedDB.deleteDatabase(DB_NAME);

  req.onsuccess = () => {
    const msg = "✅ PDFCache database deleted successfully.";
    log(msg);
    clearGlobals();
    location.reload();
  };

  req.onerror = (e) => {
    const msg = "❌ Error deleting PDFCache database:";
    log(msg);
    alert(msg);
    console.error(msg, e?.target?.error);
  };

  req.onblocked = () => {
    const msg = "⚠️ Database deletion is blocked (maybe other tabs open).";
    log(msg);
    console.warn(msg);
    alert("Please close other tabs of this app and try again.");
    location.reload();
  };
}




async function clearLocData() {
  locData = {};
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(LOC_KEY);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

  } catch (err) {
    log("Error deleting location data: " + (err?.message || err));
  }
}



async function clearCustomText() {
  customText = {};
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(TXT_KEY);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

  } catch (err) {
    log("Error deleting custom text data: " + (err?.message || err));
  }
}






// ===== Reset in-memory state (kept as-is) =====
function clearGlobals() {
  csvData = [];
  locData = {};
  customText = {};
  selectedColIndex = null;
  pdfDoc = null;            // cached PDF as pdfjsLib document for viewing
  editDoc = null;           // PDF-Lib document with fonts
  editDocFonts = null;
  renderDoc = null;         // PDF-Lib document with edits
  currentPage = 1;
  totalPages = 0;
  currentPdfBytes = null;   // base pdf we render pages from
  clearCustomText();
  clearLocData();
  pdfButton(false);
  csvButton(false);
}