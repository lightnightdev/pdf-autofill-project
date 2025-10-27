// pdfloader.js

// --------------------
// PDF state
// --------------------
let currentPdfBytes = null; // base pdf we render pages from
let pdfDoc = null; // cached PDF as pdfjsLib document for viewing
let editDoc = null; // PDF-Lib document with fonts
let editDocFonts = null;
let renderDoc = null; // PDF-Lib document with edits
let currentPage = 1;
let totalPages = 0;

async function uploadPDF() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';

  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB in bytes
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      alert('Please select a valid PDF file.');
      return;
    }

    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(`File too large (${sizeMB} MB). The limit is 2048 MB.`);
      return;
    }

    await processPDF(file);
  };

  input.click();
}

async function processPDF(file) {
  const file_ab = await file.arrayBuffer();

  try {
    log(` Selected file: ${file.name}`);
    log(` Original size: ${(file.size / 1024).toFixed(1)} KB`);
    const canEdit = await isEditingAllowed(file_ab); // or drop await if truly sync
    if (!canEdit) {
      log('PDF modifications not allowed. Rasterizing...');
    }
    const processed = canEdit
      ? await flattenAndCompressFile(file_ab) // return processed bytes/blob
      : await rasterizeFile(file_ab, { dpi: 100 }); // return processed bytes/blob

    savePdfToIndexedDb(processed, file.name); // pass processed output
    pdfButton(true, file.name);
    clearCustomText();
    clearLocData();
    loadPDF(processed); // pass processed output
  } catch (err) {
    log('Error: ' + (err?.message || err));
    console.error(err);
  }
}

function pdfButton(isUpload, fileName = currentPdfName || 'file.pdf') {
  const pdfBtn = document.getElementById('pdf-input');
  if (isUpload) {
    pdfBtn.classList.remove('btn-outline-success');
    pdfBtn.classList.add('btn-success');
    pdfBtn.classList.add('file-loaded');
    pdfBtn.textContent = fileName;
  } else {
    pdfBtn.classList.add('btn-outline-success');
    pdfBtn.classList.remove('btn-success');
    pdfBtn.classList.remove('file-loaded');
    pdfBtn.textContent = 'Select PDF';
  }
}

// --------------------
// Navigation buttons
// --------------------
document.getElementById('prev-page').addEventListener('click', () => {
  prevPage();
});

document.getElementById('next-page').addEventListener('click', () => {
  nextPage();
});

async function nextPage() {
  if (currentPage >= totalPages) return;
  await renderPage(currentPage + 1);
  renderAll();
}

async function prevPage() {
  if (currentPage <= 1) return;
  await renderPage(currentPage - 1);
  renderAll();
}

async function removeCurrentPage() {
  if (pdfDoc.numPages == 1) {
    log('Only one page!');
    return;
  }

  if (
    !confirm(
      `Hide page ${currentPage}? This will remove all fields place on the page and remove it from the exported document.`
    )
  ) {
    return;
  }

  // Remove all locData for that page
  if (locData && typeof locData === 'object') {
    for (const key of Object.keys(locData)) {
      const cfg = locData[key];
      if (cfg && Number(cfg.page) === Number(currentPage)) {
        delete locData[key];
      }
    }
  }

  saveLocData();
  // Remove all customText on that page, shift it down
  removeCustomTextFromPage();

  removePageBytes(currentPage);
  displayCSVPreviewAsCards(csvData);
  log('Page hidden and removed.');
  renderAll();
}

async function removePageBytes(pageNum) {
  const goToPage = pageNum == totalPages ? pageNum - 1 : pageNum;
  doc = await PDFLib.PDFDocument.load(currentPdfBytes);
  if (doc.totalPages == 1) {
    return;
  }
  doc.removePage(pageNum - 1);
  currentPdfBytes = await doc.save();
  const currentPdfName = (await getPdfNameFromDb()) || 'unknown.pdf';
  const newPdfName = currentPdfName.startsWith('edited_')
    ? currentPdfName
    : 'edited_' + currentPdfName;

  savePdfToIndexedDb(currentPdfBytes, newPdfName);
  log('loading, going to ' + goToPage);
  loadPDF(currentPdfBytes, goToPage);
}

// --------------------
// Load PDF into pdfDoc and render first page - startup enters here too
// typedarray is Uint8Array(arrayBuffer)
// --------------------
async function loadPDF(arrayBuffer, pageNum = 1) {
  currentPdfBytes = arrayBuffer;
  createEditDoc(arrayBuffer, pageNum);
  // on error, renderPage with pdfDoc
}

// --------------------
// Turn PDF bytes into editable PDFLib object (editDoc)
// Edit Doc is the template w/ fonts -- renderDoc will copy EditDoc
// --------------------
async function createEditDoc(arrayBuffer = currentPdfBytes, pageNum = 1) {
  editDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  editDocFonts = await embedFontsForDoc(editDoc); // embedding fonts
  queueUpdateRenderDoc(pageNum);
}

let updateQueued = false;
let updateQueuedMarkers = false;

function queueUpdateRenderDoc(pageNum = currentPage) {
  if (updateQueued) return;
  updateQueued = true;
  Promise.resolve().then(async () => {
    updateQueued = false;
    await updateRenderDoc(pageNum);
  });
}

async function updateRenderDoc(pageNum = currentPage, logLoad = false) {
  renderDoc = null;
  if (!editDoc) {
    await createEditDoc(currentPdfBytes);
  }
  const editDocBytes = await editDoc.save(); // serialize the current in-memory PDF
  renderDoc = await PDFLib.PDFDocument.load(editDocBytes); // load a new independent copy
  await drawSizingText(renderDoc, editDocFonts);
  const renderArrayBuffer = await renderDoc.save({
    useObjectStreams: false,
    compress: false,
  });
  const typedarray = new Uint8Array(renderArrayBuffer);
  pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
  totalPages = pdfDoc.numPages;
  if (logLoad) {
    log(`PDF loaded, pages: ${totalPages}`);
  }
  await renderPage(pageNum);
}
//function drawPlacedText(page, cfg, text, fontsMap) {

// --------------------
// Render a page
// --------------------
let renderInProgress = false;

async function renderPage(pageNum = currentPage) {
  if (renderInProgress) {
    return;
  }
  renderInProgress = true;

  try {
    if (!pdfDoc) return;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    initCanvasClicks();

    // update info
    totalPages = pdfDoc.numPages;
    currentPage = pageNum;
    document.getElementById(
      'page-info'
    ).textContent = `Page ${currentPage} / ${totalPages}`;
  } catch (err) {
    log('Error rendering page');
    console.error('renderPage error:', err);
  } finally {
    renderInProgress = false;
  }
}

// --------------------
// Flatten & compress with PDF-lib
// --------------------
async function flattenAndCompressFile(arrayBuffer) {
  try {
    // dumpSizeHeaderFooter(arrayBuffer);

    // Get PDF from Array buffer
    const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
    });

    // Flatten form fields
    const form = pdfLibDoc.getForm();
    if (form) form.flatten();

    // Save bytes
    const pdfBytes = await pdfLibDoc.save({
      useObjectStreams: true,
      compress: true,
    });
    return pdfBytes;
  } catch (err) {
    log('Error processing PDF: ' + err.message);
    console.error(err);
    return arrayBuffer;
  }
}

// --------------------
// Save Render (with spacing markers) / Main PDF to IndexedDb
// --------------------
//
function saveRenderPdfToIndexedDb(arrayBuffer) {
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  log(` Saving Render PDF: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
  savePdfRenderBlob(blob);
}

function savePdfToIndexedDb(arrayBuffer, pdfName) {
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  log(` Saving: PDF: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
  savePdfBlob(blob, pdfName);
  pdfButton(true, pdfName);
}

async function isEditingAllowed(ab) {
  loadingTask = pdfjsLib.getDocument({ data: ab });
  const PdfDoc = await loadingTask.promise;
  const permissions = await PdfDoc.getPermissions();

  // If null, then no restrictions
  if (!permissions) return true;

  log('Encryption detected. Checking for permissions...');

  const canModify = permissions.includes(
    pdfjsLib.PermissionFlag.MODIFY_CONTENTS
  );

  if (canModify) {
    log('Modify permissions enabled.');
  }

  return canModify;
}

// // No Longer Used

// function dumpSizeHeaderFooter(ab) {
//   console.log("AB size:", ab.byteLength);
//   const u8 = new Uint8Array(ab);
//   const head = new TextDecoder("ascii").decode(u8.slice(0, 16));
//   const tail = new TextDecoder("ascii").decode(
//     u8.slice(Math.max(0, u8.length - 2048))
//   );
//   console.log("HEAD:", head); // should start with %PDF-1.x
//   console.log("Has %%EOF:", tail.includes("%%EOF")); // must be true
//   console.log("Has startxref:", tail.includes("startxref")); // must be true
// }
