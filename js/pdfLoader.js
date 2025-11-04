// --------------------
// PDF Loader - Alpine.js Friendly
// --------------------

// Keep editDoc, editDocFonts, renderDoc as local variables
let editDoc = null;
let editDocFonts = null;
let renderDoc = null;
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

    // Save PDF bytes to Alpine store
    Alpine.store('pdfState').pdfBytes = processed;
    Alpine.store('pdfState').pdfFileName = pn;

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

  await createEditDoc(pageNum);

  // Load renderDoc
  queueUpdateRenderDoc(pageNum);
}

// --------------------
// Create editable PDF-lib doc
// --------------------
async function createEditDoc(pageNum = 1) {
  const arrayBuffer = getAb();
  editDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  editDocFonts = await embedFontsForDoc(editDoc);
}

function queueUpdateRenderDoc(pageNum) {
  if (updateQueued) return;
  updateQueued = true;

  Promise.resolve().then(async () => {
    updateQueued = false;
    await updateRenderDoc(pageNum);
  });
}

async function updateRenderDoc(pageNum = 1) {
  renderDoc = null;
  if (!editDoc) await createEditDoc(pageNum);

  const bytes = await editDoc.save();
  renderDoc = await PDFLib.PDFDocument.load(bytes);
  await drawSizingText(renderDoc, editDocFonts);

  const typedarray = new Uint8Array(await renderDoc.save());
  pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;

  Alpine.store('viewState').currentPage = pageNum;
  Alpine.store('pdfState').pdfPages = pdfDoc.numPages;

  await renderPage(pageNum);
}

// --------------------
// Render a page
// --------------------
async function renderPage(pageNum) {
  if (renderInProgress || !pdfDoc) return;
  renderInProgress = true;

  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

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

// --------------------
// Navigation
// --------------------

async function removeCurrentPage() {
  const viewState = Alpine.store('viewState');
  const pdfState = Alpine.store('pdfState');

  if (!pdfDoc || pdfState.pdfPages <= 1) {
    log('Only one page!');
    return;
  }

  if (!confirm(`Hide page ${viewState.currentPage}? This will remove all markers.`)) return;

  // Remove locData & customText for current page
  removePageLocData(viewState.currentPage);
  removeCustomTextFromPage();

  await removePageBytes(viewState.currentPage);

  displayCSVPreviewAsCards(Alpine.store('csvState').csvData);

  log('Page hidden and removed.');

  // Go to previous page
  const newPage = viewState.currentPage > 1 ? viewState.currentPage - 1 : 1;
  await renderPage(newPage);
}

async function removePageBytes(pageNum) {
  const pdfBytes = Alpine.store('pdfState').pdfBytes;
  const doc = await PDFLib.PDFDocument.load(pdfBytes);

  if (doc.totalPages <= 1) return;
  doc.removePage(pageNum - 1);

  const newBytes = await doc.save();
  Alpine.store('pdfState').pdfBytes = newBytes;

  const currentPdfName = (await getPdfNameFromDb()) || 'unknown.pdf';
  const newPdfName = currentPdfName.startsWith('edited_') ? currentPdfName : 'edited_' + currentPdfName;

  savePdfToIndexedDb(newBytes, newPdfName);
}
