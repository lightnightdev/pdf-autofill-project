// pdfloader.js

// --------------------
// PDF state
// --------------------
let currentPdfBytes = null;   // base pdf we render pages from
let pdfDoc = null;            // cached PDF as pdfjsLib document for viewing
let editDoc = null;           // PDF-Lib document with fonts
let editDocFonts = null;
let renderDoc = null;         // PDF-Lib document with edits
let currentPage = 1;
let totalPages = 0;

function initPdfControlListeners() {

  // --------------------
  // File handling
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
        : await rasterizeFile(file_ab, { dpi: 100 }); // return processed bytes/blob

      loadPDF(processed); // pass processed output
      savePdfToIndexedDb(processed); // pass processed output
    } catch (err) {
      log("Error: " + (err?.message || err));
      console.error(err);
    }
  });


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
}

function removePage() {
  if (pdfDoc.numPages == 1) {
    log('Only one page!');
    return;
  }

  if (!confirm(`Hide page ${currentPage}? This will remove all fields place on the page and remove it from the exported document.`)) {
    return;
  }

  // 3) Remove all locData for that page
  if (locData && typeof locData === "object") {
    for (const key of Object.keys(locData)) {
      const cfg = locData[key];
      if (cfg && Number(cfg.page) === Number(currentPage)) {
        delete locData[key];
      }
    }
  }
  // Remove all customText on that page, shift it down
  removePageFromCustomText();

  saveLocData();
  removePageBytes(currentPage)
  displayCSVPreviewAsCards(csvData);
  renderAll();
  log('Page hidden and removed.')

}

async function removePageBytes(pageNum) {
  doc = await PDFLib.PDFDocument.load(currentPdfBytes);
  if (doc.totalPages == 1) { return; }
  doc.removePage(pageNum - 1);
  currentPdfBytes = await doc.save();
  loadPDF(currentPdfBytes);
}

// --------------------
// Load PDF into pdfDoc and render first page - startup enters here too
// typedarray is Uint8Array(arrayBuffer)
// --------------------
async function loadPDF(arrayBuffer) {
  currentPdfBytes = arrayBuffer;
  createEditDoc(arrayBuffer);
  // on error, renderPage with pdfDoc
}

// --------------------
// Turn PDF bytes into editable PDFLib object (editDoc)
// Edit Doc is the template w/ fonts -- renderDoc will copy EditDoc 
// --------------------
async function createEditDoc(arrayBuffer) {
  editDoc = await PDFLib.PDFDocument.load(arrayBuffer);
  editDocFonts = await embedFontsForDoc(editDoc); // embedding fonts
  await updateRenderDoc(1, true);

}

async function updateRenderDoc(pageNum = 1, logLoad = false) {
  renderDoc = null;
  const editDocBytes = await editDoc.save();                  // serialize the current in-memory PDF
  renderDoc = await PDFLib.PDFDocument.load(editDocBytes);    // load a new independent copy
  await drawSizingText(renderDoc, editDocFonts);
  await showRenderDoc(pageNum, logLoad);
}

async function showRenderDoc(pageNum, logLoad = false) {
  const renderArrayBuffer = await renderDoc.save({
    useObjectStreams: false,
    compress: false,
  });
  const typedarray = new Uint8Array(renderArrayBuffer);
  pdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
  totalPages = pdfDoc.numPages;
  if (logLoad) { log(`PDF loaded, pages: ${totalPages}`) };
  await renderPage(pageNum);
}
//function drawPlacedText(page, cfg, text, fontsMap) {

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
  initCanvasClicks();

  // Update page info
  totalPages = pdfDoc.numPages;
  currentPage = pageNum;
  document.getElementById(
    "page-info"
  ).textContent = `Page ${currentPage} / ${totalPages}`;

  // sync overlay
  renderAll();
}





// --------------------
// Flatten & compress with PDF-lib
// --------------------
async function flattenAndCompressFile(arrayBuffer) {
  try {
    // dumpSizeHeaderFooter(arrayBuffer);

    // Get PDF from Array buffer
    const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true, });

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
    log("Error processing PDF: " + err.message);
    console.error(err);
    return (arrayBuffer);
  }
}

// --------------------
// Save Render (with spacing markers) / Main PDF to IndexedDb
// --------------------
// 
function saveRenderPdfToIndexedDb(arrayBuffer) {
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  log(` Saving Render PDF: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
  savePdfRenderBlob(blob);
}

function savePdfToIndexedDb(arrayBuffer) {
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  log(` Saving: PDF: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
  savePdfBlob(blob);
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
