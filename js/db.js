// db.js
// CSV
async function loadCachedCSV() {
  try {
    const data = await idbGet(CSV_KEY);
    if (!data) return;
    csvData = data;
    log(`Loaded cached CSV: (${data.length - 1} data rows)`);
    displayCSVPreviewAsCards(data);
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
    await loadPDF(new Uint8Array(arrayBuffer));
  } catch (err) {
    log("Error loading cached PDF: " + (err?.message || err));
  }
}

// Locations
async function loadCachedLocData() {
  try {
    locData = (await idbGet(LOC_KEY)) || {};
    log("Loaded cached locations.");
    renderLocAll?.(); // draw markers for current page
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