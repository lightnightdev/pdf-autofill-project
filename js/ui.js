// ====================== FILE HANDLERS ======================
async function uploadPDF() {
  const file = await selectPdfFile();
  processPDF(file);
}


async function uploadCSV() {
  selectCsvFile();
}

function changePdfName() {
  const currentName = Alpine.store('pdfState').pdfName || 'form.pdf';
  const newName = prompt('Edit PDF name:', currentName);

  if (newName && newName.trim() !== '') {
    let finalName = newName.trim();

    // Ensure it ends with .pdf (case-insensitive)
    if (!finalName.toLowerCase().endsWith('.pdf')) {
      finalName += '.pdf';
    }

    Alpine.store('pdfState').pdfName = finalName;
    log(`PDF name updated: ${finalName}`);
    savePdfToIndexedDb();
  }
}


// ====================== PDF NAVIGATION ======================
function prevPage() {
  const view = Alpine.store('viewState');
  if (view.currentPage > 1) view.currentPage--;
}

function nextPage() {
  const view = Alpine.store('viewState');
  const pdf = Alpine.store('pdfState');
  if (view.currentPage < pdf.pdfPages) {
    view.currentPage++;
    verifyPage(view.currentPage);
  }
}

async function removeCurrentPage() {
  const viewState = Alpine.store('viewState');
  const pdfState = Alpine.store('pdfState');

  if (!pdfDoc || pdfState.pdfPages <= 1) {
    log('Only one page!');
    return;
  }

  if (!confirm(`Hide page ${viewState.currentPage}? This will remove all markers.`)) return;

  // Remove locData
  removePageLocData(viewState.currentPage);
  await removePageBytes(viewState.currentPage);

  log('Page hidden and removed.');

  // Go to previous page
  viewState.currentPage = Math.max(1, viewState.currentPage - 1);
  await queueUpdateRenderDoc();
}

async function removePageBytes(pageNum) {
  const pdfBytes = Alpine.store('pdfState').pdfBytes;
  const doc = await PDFLib.PDFDocument.load(pdfBytes);

  if (doc.totalPages <= 1) return;
  doc.removePage(pageNum - 1);

  const newBytes = await doc.save();
  const newPages = Number(Alpine.store('pdfState').pdfPages) - 1
  Alpine.store('pdfState').pdfBytes = newBytes;
  Alpine.store('pdfState').pdfPages = newPages;

  savePdfToIndexedDb();
}

function removePageLocData(pageNum) {
  delete Alpine.store('locData').pages[pageNum]
}

// ====================== MARKER DATA ======================
function clearAllMarkers() {
  if (!confirm('Delete all markers in this document?')) { return; }
  Alpine.store('locData').clear();
  log('All markers cleared');
}

function downloadMarkers() {
  const locData = Alpine.store('locData');
  const blob = new Blob([JSON.stringify(locData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'locData.json';
  a.click();
  URL.revokeObjectURL(url);
  console.log('Markers downloaded');
}

function uploadMarkers() {
  console.log('Upload markers functionality triggered');
  // Implement file picker to load JSON and populate locData.pages
}

// ====================== OUTPUT ======================
function generateAndExportPDFs() {
  console.log('Generate PDFs triggered');
  // Implement PDF generation using pdf-lib
}

// ====================== CUSTOM TEXT / MARKERS ======================
function checkmarkCreate() {
  console.log('Checkmark marker creation triggered');
}

function customTextCreate() {
  console.log('Custom text creation triggered');
}

function savedTextCreate() {
  console.log('Saved text creation triggered');
}
