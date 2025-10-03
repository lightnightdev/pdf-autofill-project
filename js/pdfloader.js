// pdfmanager.js

// --------------------
// PDF state
// --------------------
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;

// --------------------
// Navigation buttons
// --------------------
document.getElementById("prev-page").addEventListener("click", () => {
  if (currentPage <= 1) return;
  renderPage(currentPage - 1);
});
document.getElementById("next-page").addEventListener("click", () => {
  if (currentPage >= totalPages) return;
  renderPage(currentPage + 1);
});

// --------------------
// Render a page
// --------------------
async function renderPage(pageNum) {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.getElementById("pdf-canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Update page info
  totalPages = pdfDoc.numPages;
  currentPage = pageNum;
  document.getElementById("page-info").textContent = `Page ${currentPage} / ${totalPages}`;
  log(`Rendered page ${currentPage}`);

  // sync overlay
  if (typeof renderLocAll === 'function') {
    renderLocAll();
  }

}

// --------------------
// Load PDF into pdfDoc and render first page
// --------------------
async function loadPDF(typedarray) {
  pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
  totalPages = pdfDoc.numPages;
  log(`PDF loaded, pages: ${totalPages}`);
  await renderPage(1);
}

// --------------------
// Handle file input
// --------------------
document.getElementById("pdf-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  log(`Selected file: ${file.name}`);
  log(`Original size: ${(file.size / 1024).toFixed(1)} KB`);

  try {
    // --------------------
    // Flatten & compress with PDF-lib
    // --------------------
    const arrayBuffer = await file.arrayBuffer();
    const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    const form = pdfLibDoc.getForm();
    if (form) form.flatten();

    const pdfBytes = await pdfLibDoc.save({ useObjectStreams: true, compress: true });
    log(`Flattened & compressed PDF: ${(pdfBytes.byteLength / 1024).toFixed(1)} KB`);

    // --------------------
    // Save to IndexedDB
    // --------------------
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    savePdfBlob(blob);

    // --------------------
    // Render PDF
    // --------------------
    const typedarray = new Uint8Array(pdfBytes);
    await loadPDF(typedarray);
  } catch (err) {
    log("Error processing PDF: " + err.message);
    console.error(err);
  }
});

