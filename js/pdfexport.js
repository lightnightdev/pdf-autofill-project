// pdfexport.js
let CUSTOM_FONT_BYTE_CACHE = null;

// main function
async function generateAndExportPDFs() {
  // Calculate total number of data rows (excluding header row)
  const total = (csvData?.length || 0) - 1;
  if (total <= 0) {
    log("CSV has no data rows.");
    return;
  }
  const exportSingle = document.getElementById("export-single-pdf")?.checked;
  const confirmMessage = exportSingle
    ? `Generate and download ${total} flattened PDF(s) as a single merged PDF?`
    : `Generate and download ${total} flattened PDF(s) as a ZIP?`;
  if (!confirm(confirmMessage)) return;

  // Validate environment and inputs
  if (!currentPdfBytes) {
    loadCachedPDF();
  }

  if (!window.PDFLib) {
    log("pdf-lib not available");
    return;
  }
  if (!currentPdfBytes) {
    log("No base PDF loaded.");
    return;
  }
  if (!hasAnyLocMarkers()) {
    log("No markers set.");
    return;
  }

  try {
    log("Preparing source PDF…");
    const srcDoc = await PDFLib.PDFDocument.load(currentPdfBytes);

    // collect files for zipping or merged export
    const filesForZip = [];
    const combinedDoc = exportSingle
      ? await PDFLib.PDFDocument.create()
      : null;

    const flattenedCheckmarks = getAllCheckmarks();

    // Iterate through each data row in the CSV (skipping header)
    for (let r = 1; r < csvData.length; r++) {
      log(`Generating row ${r} of ${total}…`);

      // 1) New output doc with copied pages
      const outDoc = await PDFLib.PDFDocument.create();
      const srcPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      srcPages.forEach((p) => outDoc.addPage(p));
      // TODO let user select pages

      // 2) Deep Sanitize again (just in case)
      await deepSanitizePdf(outDoc);

      // 3) Embed your custom fonts for THIS doc
      const fonts = await embedFontsForDoc(outDoc);


      // 4) Draw placements for this row
      drawRowText(outDoc, fonts, r);
      if (flattenedCheckmarks.length > 0) {
        await drawCheckmarks(outDoc, flattenedCheckmarks);
      }

      if (exportSingle) {
        const copiedPages = await combinedDoc.copyPages(
          outDoc,
          outDoc.getPageIndices()
        );
        copiedPages.forEach((p) => combinedDoc.addPage(p));
      } else {
        // 5) Save and queue this file for the ZIP (no per-file download)
        const bytes = await outDoc.save({
          useObjectStreams: false,
          compress: true,
        });
        const stemRaw = (csvData[r]?.[0] || "").toString();
        // To get leading 0's if more than 9 rows
        const paddedRow = String(r).padStart(String(total).length, "0");
        const sanitized = sanitizeStem(stemRaw);
        const stem = sanitized ? `${paddedRow}-${sanitized}` : `Row-${paddedRow}`;

        filesForZip.push({ name: `${stem}.pdf`, data: bytes });
      }
    }

    if (exportSingle) {
      const mergedBytes = await combinedDoc.save({
        useObjectStreams: false,
        compress: true,
      });
      const mergedName = `autofilled_pdfs_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.pdf`;
      downloadPdf(mergedBytes, mergedName);
      log(`All ${total} flattened PDFs generated and merged into ${mergedName}.`);
    } else {
      // 6) Generate and download a single ZIP
      const zipName = `autofilled_pdfs_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.zip`;
      await downloadZip(filesForZip, zipName);

      log(`All ${total} flattened PDFs generated and zipped into ${zipName}.`);
    }
  } catch (err) {
    console.error(err);
    log("Export error: " + (err?.message || err));
  }
}




function cloneFontBytes(rawBytes) {
  const requiredKeys = ["_signature", "_normal", "_monospace"];
  const cloned = {};

  for (const key of requiredKeys) {
    const source = rawBytes?.[key];
    if (!source) throw new Error(`Missing font bytes for "${key}"`);

    cloned[key] =
      source instanceof Uint8Array ? source : new Uint8Array(source);
  }

  return cloned;
}

async function loadAllCustomFontBytes() {
  if (CUSTOM_FONT_BYTE_CACHE) return CUSTOM_FONT_BYTE_CACHE;

  const fontBytes = initFontBytes(); // Call the init function
  if (!fontBytes) {
    throw new Error("Custom font bytes were not initialised");
  }

  CUSTOM_FONT_BYTE_CACHE = cloneFontBytes(fontBytes);
  return CUSTOM_FONT_BYTE_CACHE;
}

async function embedFontsForDoc(doc) {
  const fontkitGlobal = window.fontkit || globalThis.fontkit;
  if (!fontkitGlobal) {
    throw new Error("fontkit library was not loaded");
  }

  doc.registerFontkit(fontkitGlobal);

  let sig = null,
    norm = null,
    mono = null;
  try {
    const bytes = await loadAllCustomFontBytes();


    // Embed fonts to PDF document
    sig = await doc.embedFont(bytes._signature, { subset: false });
    norm = await doc.embedFont(bytes._normal, { subset: false });
    mono = await doc.embedFont(bytes._monospace, { subset: false });
  } catch (e) {
    console.warn("Falling back to standard fonts:", e);
    sig = await doc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    norm = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    mono = await doc.embedFont(PDFLib.StandardFonts.Courier);
  }

  return {
    _signature: sig,
    _normal: norm,
    _monospace: mono,
  };
}

function pickFontForPdf(fontKey, embedded) {
  switch ((fontKey || "").toLowerCase()) {
    case "_signature":
      return embedded._signature;
    case "_monospace":
      return embedded._monospace;
    case "_normal":
    default:
      return embedded._normal;
  }
}

function getCellOrHeader(rowIdx, colIdx) {
  const val = csvData?.[rowIdx]?.[colIdx];
  if (val && String(val).trim() !== "") return String(val);
  const header = csvData?.[0]?.[colIdx];
  if (header && String(header).trim() !== "") return `[${header}]`;
  return `Col ${colIdx}`;
}

function getCellOrBlank(rowIdx, colIdx) {
  const val = csvData?.[rowIdx]?.[colIdx];
  if (val && String(val).trim() !== "") return String(val);
  return ""; // Return empty string instead of falling back to header
}






function sanitizeStem(s) {
  return (
    (s || "")
      .toString()
      .trim()
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 64) || ""
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}


async function deepSanitizePdf(outDoc) {
  const { PDFName, PDFDict, PDFArray } = PDFLib;

  // 1) Flatten AcroForm fields (safe if no form present)
  try {
    outDoc.getForm().flatten();
  } catch { }

  // 2) Remove page annotations & additional actions
  try {
    for (const page of outDoc.getPages()) {
      const node = page.node;
      // Clear annotations array (comments, links, etc.)
      if (node.get(PDFName.of("Annots")))
        node.set(PDFName.of("Annots"), outDoc.context.obj([]));
      // Remove page-level actions (AA)
      if (node.get(PDFName.of("AA"))) node.delete(PDFName.of("AA"));
    }
  } catch { }

  // 3) Remove document open actions
  try {
    const cat = outDoc.catalog; // Catalog dict
    if (cat.dict.has(PDFName.of("OpenAction")))
      cat.dict.delete(PDFName.of("OpenAction"));
    if (cat.dict.has(PDFName.of("AA"))) cat.dict.delete(PDFName.of("AA"));
  } catch { }

  // 4) Remove JavaScript & EmbeddedFiles name trees from /Names
  try {
    const cat = outDoc.catalog;
    const names = cat.dict.get(PDFName.of("Names"));
    if (names) {
      const namesDict = outDoc.context.lookup(names, PDFDict);
      if (namesDict) {
        if (namesDict.has(PDFName.of("JavaScript")))
          namesDict.delete(PDFName.of("JavaScript"));
        if (namesDict.has(PDFName.of("EmbeddedFiles")))
          namesDict.delete(PDFName.of("EmbeddedFiles"));
        // If /Names becomes empty, drop it
        if (namesDict.size === 0) cat.dict.delete(PDFName.of("Names"));
      }
    }
  } catch { }

  // 5) Remove metadata/XMP (optional)
  try {
    const cat = outDoc.catalog;
    if (cat.dict.has(PDFName.of("Metadata")))
      cat.dict.delete(PDFName.of("Metadata"));
  } catch { }

  // 6) Ensure fonts are subset & standard where possible (you already use { subset: true })
  // Nothing to do here programmatically unless re-embedding. You’re good.

  // 7) Clear viewer prefs that can trigger behaviors (optional)
  try {
    const cat = outDoc.catalog;
    if (cat.dict.has(PDFName.of("ViewerPreferences")))
      cat.dict.delete(PDFName.of("ViewerPreferences"));
  } catch { }
}

// downloader
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadZip(files, zipName = "output.zip") {
  // files: Array<{ name: string, data: Uint8Array | ArrayBuffer | Blob | string }>
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPdf(data, filename = "output.pdf") {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: "application/pdf" });
  downloadBlob(blob, filename);
}
