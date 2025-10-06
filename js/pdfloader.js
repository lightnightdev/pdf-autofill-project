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
  document.getElementById(
    "page-info"
  ).textContent = `Page ${currentPage} / ${totalPages}`;
  log(`Rendered page ${currentPage}`);

  // sync overlay
  if (typeof renderLocAll === "function") {
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
  const file = e.target.files?.[0];
  if (!file) return;

  const file_ab = await file.arrayBuffer();

  try {
    log(` Selected file: ${file.name}`);
    log(` Original size: ${(file.size / 1024).toFixed(1)} KB`);
    const canEdit = await isEditingAllowed(file_ab); // or drop await if truly sync
    if (!canEdit) {
      log("PDF modifications not allowed. Rasterizing...");
    }
    const processed = canEdit
      ? await flattenAndCompressFile(file_ab) // return processed bytes/blob
      : await rasterizeFile(file_ab, {dpi : 100} ); // return processed bytes/blob

    renderPdf(processed); // pass processed output
    savePdfToIndexedDb(processed); // pass processed output
  } catch (err) {
    log("Error: " + (err?.message || err));
    console.error(err);
  }
});

async function flattenAndCompressFile(arrayBuffer) {
  try {
    // --------------------
    // Flatten & compress with PDF-lib
    // --------------------
    // dumpSizeHeaderFooter(arrayBuffer);
    const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
    });

    const form = pdfLibDoc.getForm();
    if (form) form.flatten();

    const pdfBytes = await pdfLibDoc.save({
      useObjectStreams: true,
      compress: true,
    });
    return pdfBytes;
  } catch (err) {
    log("Error processing PDF: " + err.message);
    console.error(err);
  }
}

function savePdfToIndexedDb(arrayBuffer) {
  // --------------------
  // Save to IndexedDB
  // --------------------
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  log(` Saving: PDF: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
  savePdfBlob(blob);
}

async function renderPdf(arrayBuffer) {
  // --------------------
  // Render PDF
  // --------------------
  const typedarray = new Uint8Array(arrayBuffer);
  await loadPDF(typedarray);
}

async function isEditingAllowed(ab) {
  loadingTask = pdfjsLib.getDocument({ data: ab });
  const PdfDoc = await loadingTask.promise;
  const permissions = await PdfDoc.getPermissions();

  // If null, then no restrictions
  if (!permissions) return true;

  log("Encryption detected. Checking for permissions...");

  const canModify = permissions.includes(
    pdfjsLib.PermissionFlag.MODIFY_CONTENTS
  );

  if (canModify) {
    log("Modify permissions enabled.");
  }

  return canModify;
}

// No Longer Used

function dumpSizeHeaderFooter(ab) {
  console.log("AB size:", ab.byteLength);
  const u8 = new Uint8Array(ab);
  const head = new TextDecoder("ascii").decode(u8.slice(0, 16));
  const tail = new TextDecoder("ascii").decode(
    u8.slice(Math.max(0, u8.length - 2048))
  );
  console.log("HEAD:", head); // should start with %PDF-1.x
  console.log("Has %%EOF:", tail.includes("%%EOF")); // must be true
  console.log("Has startxref:", tail.includes("startxref")); // must be true
}
