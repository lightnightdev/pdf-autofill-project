// db.js

// KEYS
const DB_NAME = 'PDFCache';
const DB_VERSION = 2;
const STORE_NAME = 'files';
const PDF_KEY = 'currentPDF';
const PDF_NAME_KEY = 'pdfName';
const PDF_PG_KEY = 'pdfPages';
const LOC_KEY = 'locData';
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
        req.onerror = () =>
            reject(req.error || new Error('Failed to open IndexedDB'));
    });
}

function ensureDB() {
    return db ? Promise.resolve(db) : openDB().then((handle) => (db = handle));
}

function idbTx(mode = 'readonly') {
    if (!db) throw new Error('IndexedDB not initialized');
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function idbGet(key) {
    return ensureDB().then(
        () =>
            new Promise((resolve, reject) => {
                const req = idbTx('readonly').get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () =>
                    reject(req.error || new Error('IndexedDB get failed'));
            })
    );
}

function idbPut(key, value) {
    return ensureDB().then(
        () =>
            new Promise((resolve, reject) => {
                const store = idbTx('readwrite');
                const req = store.put(value, key);
                req.onsuccess = () => resolve(true);
                req.onerror = () =>
                    reject(req.error || new Error('IndexedDB put failed'));
            })
    );
}

function idbDelete(key, value) {
    return ensureDB().then(
        () =>
            new Promise((resolve, reject) => {
                const store = idbTx('readwrite');
                const req = store.delete(key);
                req.onsuccess = () => resolve(true);
                req.onerror = () =>
                    reject(req.error || new Error('IndexedDB delete failed'));
            })
    );
}

// ===== Startup / Cache loading =====
async function loadCachedData() {
    log('Checking for cached data...');

    try {
        db = await ensureDB(); // assures DB exists and is assigned to db
    } catch (e) {
        log('IndexedDB error: ' + (e?.message || e));
        return;
    }

    await Promise.all([
        fetchCachedPDF(),
        fetchCachedLocData()
    ]);

    if (isValidPdf()) {
        loadPDF();
    }
}

// ===== PDF =====
async function fetchCachedPDF() {
    try {
        const blob = await idbGet(PDF_KEY);
        if (!blob) return;
        log(` - Fetched PDF: ${(blob.size / 1024).toFixed(1)} KB`);
        Alpine.store('pdfState').pdfBytes = await blob.arrayBuffer();
        const pdfName = (await idbGet(PDF_NAME_KEY));
        const pdfPages = (await idbGet(PDF_PG_KEY));
        if (pdfName) { Alpine.store('pdfState').pdfName = pdfName;}
        if (pdfPages) { Alpine.store('pdfState').pdfPages = pdfPages;}
    } catch (err) {
        log('Error loading cached PDF: ' + (err?.message || err));
    }
}

// ===== Locations =====
async function fetchCachedLocData() {
    try {
        locData = (await idbGet(LOC_KEY)) || {};
        if (locData && Object.keys(locData).length > 0) {
            log(' - Loaded markers.');
        }
    } catch (err) {
        log('Error loading markers: ' + (err?.message || err));
    }
}

// ===== Save helpers =====

async function saveLocData() {
    try {
        await idbPut(LOC_KEY, locData);
    } catch (err) {
        log('Error saving ' + String(LOC_KEY) + ':' + (err?.message || err));
    }
}

async function savePdfToIndexedDb() {
    const ab = Alpine.store('pdfState').pdfBytes
    const pg = Alpine.store('pdfState').pdfPages
    let pn = Alpine.store('pdfState').pdfName

    if (!ab) { return; }
    if (!pn || pn === '') { pn = 'form.pdf'; }

    log(` Saving ${pn}: ${(ab.byteLength / 1024).toFixed(1)} KB...`);
    const blob = new Blob([ab], { type: 'application/pdf' });

    try {
        await idbPut(PDF_KEY, blob);
        await idbPut(PDF_NAME_KEY, pn);
        await idbPut(PDF_PG_KEY, pg);
        log('PDF Data saved');
    } catch (err) {
        log('IndexedDB save error: ' + (err?.message || err));
    }
}



// ===== Clear IndexedDB =====
function clearFiles() {
    if (!confirm(`Remove all cached data?`)) return;

    if (!db) {
        console.warn('DB not open yet.');
        return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const clearReq = store.clear(); // <-- clears all entries in this object store

    clearReq.onsuccess = () => {
        log('✅ All cached files cleared successfully.');
        clearState();
    };

    clearReq.onerror = (e) => {
        const msg = '❌ Error clearing cached files:';
        log(msg);
        console.error(msg, e?.target?.error);
        alert(msg);
    };
}


async function clearLocData() {
    Alpine.store('locData').clear();

    try {
        // Ensure DB is open
        const dbHandle = await ensureDB();

        // Double-check that the store exists
        if (!dbHandle.objectStoreNames.contains(STORE_NAME)) {
            console.warn(`Cached "${STORE_NAME}" does not exist — skipping delete.`);
            return;
        }

        // Use your helper for deletion
        await idbDelete(LOC_KEY);

        console.log('Location data cleared successfully.');
    } catch (err) {
        console.error('Error deleting location data:', err?.message || err);
    }
}