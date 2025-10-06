let CUSTOM_FONT_BYTE_CACHE = null;
let FONTKIT_REGISTERED = false;

function cloneFontBytes(rawBytes) {
  const requiredKeys = ["signature", "normal", "monospace"];
  const cloned = {};

  for (const key of requiredKeys) {
    const source = rawBytes?.[key];
    if (!source) throw new Error(`Missing font bytes for "${key}"`);

    cloned[key] = source instanceof Uint8Array ? source : new Uint8Array(source);
  }

  return cloned;
}

async function loadAllCustomFontBytes() {
  if (CUSTOM_FONT_BYTE_CACHE) return CUSTOM_FONT_BYTE_CACHE;

  if (typeof FONT_BYTES === "undefined" || !FONT_BYTES) {
    throw new Error("Custom font bytes were not initialised (utils.js missing?)");
  }

  CUSTOM_FONT_BYTE_CACHE = cloneFontBytes(FONT_BYTES);
  return CUSTOM_FONT_BYTE_CACHE;
}

function ensureFontkitRegistered() {
  if (FONTKIT_REGISTERED) return;

  const fontkitGlobal =
    (typeof globalThis !== "undefined" && globalThis.fontkit) ||
    (typeof window !== "undefined" && window.fontkit);

  if (!fontkitGlobal) {
    throw new Error("fontkit library was not loaded");
  }

  if (!PDFLib || !PDFLib.PDFDocument || typeof PDFLib.PDFDocument.registerFontkit !== "function") {
    throw new Error("PDFLib missing registerFontkit support");
  }

  PDFLib.PDFDocument.registerFontkit(fontkitGlobal);
  FONTKIT_REGISTERED = true;
}

async function embedFontsForDoc(doc) {
  // Try custom fonts (now from FONT_BYTES)
  let sig = null, norm = null, mono = null;
  try {
    ensureFontkitRegistered();
    const bytes = await loadAllCustomFontBytes();
    sig  = await doc.embedFont(bytes.signature, { subset: true });
    norm = await doc.embedFont(bytes.normal,    { subset: true });
    mono = await doc.embedFont(bytes.monospace, { subset: true });
  } catch (e) {
    console.warn("Falling back to standard fonts:", e);
  }

  const helv   = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const helvIt = await doc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
  const cour   = await doc.embedFont(PDFLib.StandardFonts.Courier);

  return {
    signature: sig  || helvIt,
    normal:    norm || helv,
    monospace: mono || cour,
  };
}

function pickFontForPdf(fontKey, embedded) {
  switch ((fontKey || '').toLowerCase()) {
    case 'signature': return embedded.signature;
    case 'monospace': return embedded.monospace;
    case 'normal':
    default: return embedded.normal;
  }
}

function getCellOrHeader(rowIdx, colIdx) {
  const val = csvData?.[rowIdx]?.[colIdx];
  if (val && String(val).trim() !== "") return String(val);
  const header = csvData?.[0]?.[colIdx];
  if (header && String(header).trim() !== "") return `[${header}]`;
  return `Col ${colIdx}`;
}

function sanitizeStem(s) {
  return (s || "").toString().trim().replace(/[^\w\-]+/g, "_").slice(0, 64) || "Row";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateAndExportPDFs() {
  const total = (csvData?.length || 0) - 1;
  if (total <= 0) { log("CSV has no data rows."); return; }
  if (!confirm(`Generate and download ${total} flattened PDF(s) as a ZIP?`)) return;

  currentPdf = await getCachedPDF();
  if (!window.PDFLib) { log("pdf-lib not available"); return; }
  if (!currentPdf) { log("No base PDF loaded."); return; }
  if (!locData || Object.keys(locData).length === 0) { log("No locations set."); return; }

  try {
    log("Preparing source PDF…");
    const srcBytes = await currentPdf.arrayBuffer();
    const srcDoc = await PDFLib.PDFDocument.load(srcBytes);

    // collect files for zipping
    const filesForZip = [];

    for (let r = 1; r < csvData.length; r++) {
      log(`Generating row ${r} of ${total}…`);

      // 1) New output doc with copied pages
      const outDoc = await PDFLib.PDFDocument.create();
      const srcPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      srcPages.forEach(p => outDoc.addPage(p));

      // 2) Deep Sanitize
      await deepSanitizePdf(outDoc);

      // 3) Embed your custom fonts for THIS doc
      const fonts = await embedFontsForDoc(outDoc);

      // 4) Draw placements for this row
      for (const key of Object.keys(locData)) {
        const cfg = locData[key];
        if (!cfg) continue;

        const pageIndex = (cfg.page || 1) - 1;
        const page = outDoc.getPage(pageIndex);
        if (!page) continue;

        const pageW = page.getWidth();
        const pageH = page.getHeight();

        const stageW = Number(cfg.stageW) || pageW; // captured overlay width
        const stageH = Number(cfg.stageH) || pageH;

        const scaleX = pageW / stageW;
        const scaleY = pageH / stageH;

        // top-left overlay coords -> bottom-left PDF coords
        const exportX = (Number(cfg.x) || 0) * scaleX;
        const exportY = pageH - (Number(cfg.y) || 0) * scaleY;

        const text = getCellOrHeader(r, parseInt(key, 10));
        const size = Number(cfg.size) || 12;
        const font = pickFontForPdf(cfg.font, fonts);

        page.drawText(text, { x: exportX, y: exportY, size, font });
      }

      // 5) Save and queue this file for the ZIP (no per-file download)
      const bytes = await outDoc.save({ useObjectStreams: false, compress: true });
      const stemRaw = (csvData[r]?.[0] || "").toString();
      const stem = sanitizeStem(stemRaw) || `Row-${r}`;

      filesForZip.push({ name: `${stem}.pdf`, data: bytes });
    }

    // 6) Generate and download a single ZIP
    const zipName = `flattened_pdfs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.zip`;
    await downloadZip(filesForZip, zipName);

    log(`All ${total} flattened PDFs generated and zipped into ${zipName}.`);
  } catch (err) {
    console.error(err);
    log("Export error: " + (err?.message || err));
  }
}






async function deepSanitizePdf(outDoc) {
  const { PDFName, PDFDict, PDFArray } = PDFLib;

  // 1) Flatten AcroForm fields (safe if no form present)
  try { outDoc.getForm().flatten(); } catch { }

  // 2) Remove page annotations & additional actions
  try {
    for (const page of outDoc.getPages()) {
      const node = page.node;
      // Clear annotations array (comments, links, etc.)
      if (node.get(PDFName.of('Annots'))) node.set(PDFName.of('Annots'), outDoc.context.obj([]));
      // Remove page-level actions (AA)
      if (node.get(PDFName.of('AA'))) node.delete(PDFName.of('AA'));
    }
  } catch { }

  // 3) Remove document open actions
  try {
    const cat = outDoc.catalog; // Catalog dict
    if (cat.dict.has(PDFName.of('OpenAction'))) cat.dict.delete(PDFName.of('OpenAction'));
    if (cat.dict.has(PDFName.of('AA'))) cat.dict.delete(PDFName.of('AA'));
  } catch { }

  // 4) Remove JavaScript & EmbeddedFiles name trees from /Names
  try {
    const cat = outDoc.catalog;
    const names = cat.dict.get(PDFName.of('Names'));
    if (names) {
      const namesDict = outDoc.context.lookup(names, PDFDict);
      if (namesDict) {
        if (namesDict.has(PDFName.of('JavaScript'))) namesDict.delete(PDFName.of('JavaScript'));
        if (namesDict.has(PDFName.of('EmbeddedFiles'))) namesDict.delete(PDFName.of('EmbeddedFiles'));
        // If /Names becomes empty, drop it
        if (namesDict.size === 0) cat.dict.delete(PDFName.of('Names'));
      }
    }
  } catch { }

  // 5) Remove metadata/XMP (optional)
  try {
    const cat = outDoc.catalog;
    if (cat.dict.has(PDFName.of('Metadata'))) cat.dict.delete(PDFName.of('Metadata'));
  } catch { }

  // 6) Ensure fonts are subset & standard where possible (you already use { subset: true })
  // Nothing to do here programmatically unless re-embedding. You’re good.

  // 7) Clear viewer prefs that can trigger behaviors (optional)
  try {
    const cat = outDoc.catalog;
    if (cat.dict.has(PDFName.of('ViewerPreferences'))) cat.dict.delete(PDFName.of('ViewerPreferences'));
  } catch { }
}











// downloader
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
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
  a.href = url; a.download = zipName;
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
