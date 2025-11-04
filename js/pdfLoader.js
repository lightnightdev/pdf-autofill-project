// --------------------
// PDF Loader - Alpine.js Friendly
// --------------------

// Keep editDoc, editDocFonts, renderDoc as local variables
let editDoc = null;
let editDocFonts = null;
let pdfDoc = null;
let renderInProgress = false;
let updateQueued = false;

// --------------------
// Upload PDF
// --------------------
function selectPdfFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Please select a valid PDF file.');
        return;
      }
      if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        alert(`File too large (${sizeMB} MB). Limit is 2048 MB.`);
        return;
      }

      resolve(file)
    };
    input.click();
  });
}

// --------------------
// Process PDF
// --------------------
async function processPDF(file) {
  const file_ab = await file.arrayBuffer();
  try {
    log(`Selected file: ${file.name}`);
    log(`Original size: ${(file.size / 1024).toFixed(1)} KB`);

    const pn = await file.name;
    const canEdit = await isPdfEditingAllowed(file_ab);
    const processed = canEdit
      ? await flattenAndCompressFile(file_ab)
      : await rasterizeFile(file_ab, { dpi: 100 });

    const pdfDoc = await pdfjsLib.getDocument({data: file_ab}).promise;
    Alpine.store('pdfState').pdfPages = pdfDoc.numPages;

    // Save PDF bytes to Alpine store
    Alpine.store('pdfState').pdfBytes = processed;
    Alpine.store('pdfState').pdfName = pn;

    savePdfToIndexedDb();

    await loadPDF(1);
  } catch (err) {
    log('Error: ' + (err?.message || err));
    console.error(err);
  }
}

function isValidPdf() {
  const pdfBytes = Alpine.store('pdfState').pdfBytes;
  return !(!pdfBytes)
}

function getAb() {
  const pdfBytes = Alpine.store('pdfState').pdfBytes;
  return pdfBytes
}


// --------------------
// Load PDF and render first page
// --------------------
async function loadPDF(pageNum = 1) {
  if (!isValidPdf) return;


  // Load renderDoc
  queueUpdateRenderDoc(pageNum);
}

// --------------------
// Queue Update
// --------------------
function queueUpdateRenderDoc(pageNum = -1) {
  if (pageNum = -1) { pageNum = Alpine.store('viewState').currentPage ;}
  if (updateQueued) return;
  updateQueued = true;

  Promise.resolve().then(async () => {
    updateQueued = false;
    await renderPage(pageNum);
  })
}

// --------------------
// Render a page
// --------------------
async function renderPage(pageNum = 1) {
  if (renderInProgress) { return; }
  renderInProgress = true;

  try {
    const arrayBuffer = getAb();
    const renderDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const renderDocFonts = await embedFontsForDoc(renderDoc);

    const ld = Alpine.store('locData').pages[pageNum]

    await drawSizingText(renderDoc, renderDocFonts, ld, pageNum)

    const typedarray = new Uint8Array(await renderDoc.save());
    pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    syncOverlayBoxToCanvas();

    // Update Alpine stores
    Alpine.store('viewState').currentPage = pageNum;
    checkMenu();

  } catch (err) {
    console.log(err);
    log('Error rendering page');
  } finally {
    renderInProgress = false;
  }
}

function checkMenu() {
  const open2 = Alpine.store('pdfState').pdfPages > 1;
  if (open2) {
    Alpine.store('menuState').open(2);
  }
}

function syncOverlayBoxToCanvas() {
  const overlay = document.getElementById('pdf-overlay');
  const canvas = document.getElementById('pdf-canvas');
  if (!overlay || !canvas) return false;

  overlay.style.width = canvas.width + 'px';
  overlay.style.height = canvas.height + 'px';
  overlay.style.left = '0px';
  overlay.style.top = '0px';
  overlay.style.position = 'absolute';
  overlay.style.zIndex = 10;
  overlay.style.pointerEvents = 'none'; // markers can re-enable selectively
  return true;
}

// --------------------
// Navigation
// --------------------

