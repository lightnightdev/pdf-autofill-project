// ====================== FILE HANDLERS ======================
async function uploadPDF() {
  const file = await selectPdfFile();
  processPDF(file);
}


function uploadCSV() {
  console.log('CSV Upload triggered');
  // implement CSV picker, then update csvState
}


function changePdfName() {
  console.log('hi');
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
  if (view.currentPage < pdf.pdfPages) view.currentPage++;
}

function removeCurrentPage() {
  const view = Alpine.store('viewState');
  const locData = Alpine.store('locData');
  if (locData.pages[view.currentPage]) {
    delete locData.pages[view.currentPage];
  }
  console.log(`Page ${view.currentPage} removed`);
}

// ====================== MARKER DATA ======================
function clearAllMarkers() {
  Alpine.store('locData').clearAll();
  console.log('All markers cleared');
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
