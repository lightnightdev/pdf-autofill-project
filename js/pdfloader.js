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

  try {
    log(`Selected file: ${file.name}`);
    log(`Original size: ${(file.size / 1024).toFixed(1)} KB`);

    const canEdit = await isEditingAllowed(file); // or drop await if truly sync
    const processed = canEdit
      ? await rasterizeFile(file)            // return processed bytes/blob
      : await flattenAndCompressFile(file);  // return processed bytes/blob

    savePdfToIndexedDb(processed);     // pass processed output
    renderPdf(processed);              // pass processed output
  } catch (err) {
    log("Error: " + (err?.message || err));
    console.error(err);
  }
});




async function flattenAndCompressFile(file) {
  try {
    // --------------------
    // Flatten & compress with PDF-lib
    // --------------------
    console.log("getting arrayBuffer");
    const arrayBuffer = await file.arrayBuffer();
    console.log("AB size:", arrayBuffer.byteLength);
    dumpHeaderFooter(arrayBuffer);
    console.log("Encrypted flag (heuristic):", isLikelyEncrypted(arrayBuffer));
    const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
    });
    console.log("flatten");

    const form = pdfLibDoc.getForm();
    if (form) form.flatten();

    console.log("getting bytes");

    const pdfBytes = await pdfLibDoc.save({
      useObjectStreams: false,
      compress: true,
    });
    log(
      `Flattened & compressed PDF: ${(pdfBytes.byteLength / 1024).toFixed(
        1
      )} KB`
    );
  } catch (err) {
    log("Error processing PDF: " + err.message);
    console.error(err);
  }
};

function savePdfToIndexedDb(file){
    // --------------------
    // Save to IndexedDB
    // --------------------
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    savePdfBlob(blob);
}

async function renderPdf(file){
    // --------------------
    // Render PDF
    // --------------------
    const typedarray = new Uint8Array(pdfBytes);
    await loadPDF(typedarray);
};

function dumpHeaderFooter(ab) {
  const u8 = new Uint8Array(ab);
  const head = new TextDecoder("ascii").decode(u8.slice(0, 16));
  const tail = new TextDecoder("ascii").decode(
    u8.slice(Math.max(0, u8.length - 2048))
  );
  console.log("HEAD:", head); // should start with %PDF-1.x
  console.log("Has %%EOF:", tail.includes("%%EOF")); // must be true
  console.log("Has startxref:", tail.includes("startxref")); // must be true
}

async function isEditingAllowed(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;
  const perms = await doc.getPermissions();

  // null means not encrypted → editing is allowed
  if (!perms) return true;

  // otherwise check for MODIFY_CONTENTS flag
  return perms.includes(pdfjsLib.PermissionFlag.MODIFY_CONTENTS);
}


// function isLikelyEncrypted(ab) {
//   // crude detection: trailer dict or xref stream references /Encrypt
//   const text = new TextDecoder("latin1").decode(new Uint8Array(ab));
//   return text.includes("/Encrypt");
// }


