// utils.js

// --- utils ---
function b64ToU8(base64) {
  // Handle big strings safely
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}







/**
 * Rasterize a PDF into an image-only PDF.
 * Requires pdfjsLib (PDF.js) and PDFLib (pdf-lib) to be loaded globally.
 *
 * @param {File|Blob|ArrayBuffer|Uint8Array} input
 * @param {Object} [opts]
 * @param {number} [opts.dpi=144]                 // Render resolution; 144 is a good quality/size balance
 * @param {"jpeg"|"png"} [opts.imageType="jpeg"]  // JPEG is smaller; PNG is lossless (bigger)
 * @param {number} [opts.jpegQuality=0.92]        // Only used when imageType="jpeg"
 * @param {function} [opts.onProgress]            // (pageIndex, pageCount) => void
 * @returns {Promise<Uint8Array>}
 */
async function rasterizeFile(input, opts = {}) {
  const {
    dpi = 144,
    imageType = "jpeg",
    jpegQuality = 0.92,
    onProgress
  } = opts;

  // ------------- helpers -------------
  const toArrayBuffer = async (x) => {
    if (x instanceof ArrayBuffer) return x;
    if (x instanceof Uint8Array) return x.buffer;
    if (x instanceof Blob) return await x.arrayBuffer();
    throw new Error("Unsupported input type for rasterizeFile");
  };

  const makeCanvas = (w, h) => {
    // Prefer OffscreenCanvas when available to avoid layout thrash
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
      return { canvas: c, ctx: c.getContext("2d") };
    } else {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      return { canvas: c, ctx: c.getContext("2d") };
    }
  };

  const canvasToBlob = (canvas, type, quality) => {
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: `image/${type}`, quality });
    }
    return new Promise((resolve) => canvas.toBlob(resolve, `image/${type}`, quality));
  };

  // ------------- load source PDF with PDF.js -------------
  const srcAB = await toArrayBuffer(input);
  const loadingTask = pdfjsLib.getDocument({ data: srcAB });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;

  // ------------- create destination PDF with PDF-Lib -------------
  const outDoc = await PDFLib.PDFDocument.create();

  // Process pages sequentially to keep memory modest
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);

    // PDF native size in points (72 pts/inch), independent of rotation
    // page.view = [xMin, yMin, xMax, yMax]; userUnit defaults to 1 for most PDFs
    const [x1, y1, x2, y2] = page.view;
    const userUnit = page.userUnit || 1;
    const widthPts = (x2 - x1) * userUnit;
    const heightPts = (y2 - y1) * userUnit;

    // Render at requested DPI in pixels: scale = dpi / 72
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });

    const { canvas, ctx } = makeCanvas(viewport.width, viewport.height);

    // Render with PDF.js
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Extract bitmap as Blob
    const blob = await canvasToBlob(canvas, imageType === "png" ? "png" : "jpeg", jpegQuality);
    const imgBytes = new Uint8Array(await blob.arrayBuffer());

    // Embed into out PDF
    const img = (imageType === "png")
      ? await outDoc.embedPng(imgBytes)
      : await outDoc.embedJpg(imgBytes);

    const outPage = outDoc.addPage([widthPts, heightPts]);
    outPage.drawImage(img, { x: 0, y: 0, width: widthPts, height: heightPts });

    // Cleanup memory for this page
    try { page.cleanup(); } catch { }
    if (!(canvas instanceof OffscreenCanvas)) {
      // help GC
      canvas.width = 1; canvas.height = 1;
    }

    onProgress?.(i, pageCount);
  }

  // Optional: copy minimal metadata (edit as needed)
  try {
    const meta = await pdf.getMetadata();
    if (meta?.info?.Title) outDoc.setTitle(meta.info.Title);
    if (meta?.info?.Author) outDoc.setAuthor(meta.info.Author);
  } catch { /* metadata is optional */ }

  // Save rasterized PDF
  return await outDoc.save({ useObjectStreams: false, addDefaultPage: false, compress: true });
}


// PDF-Specific Utils
// --- coordinate + font helpers reused by preview + export for character spacing ---

function computeExportCoords(page, cfg) {
  const pageW = page.getWidth();
  const pageH = page.getHeight();

  const stageW = Number(cfg.stageW) || pageW;
  const stageH = Number(cfg.stageH) || pageH;

  const scaleX = pageW / stageW;
  const scaleY = pageH / stageH;

  const cssPxSize = Number(cfg.size) || 12;
  const pdfFontSize = cssPxSize * scaleY;

  const exportX = (Number(cfg.x) || 0) * scaleX;

  const exportYTop = pageH - (Number(cfg.y) || 0) * scaleY;
  const exportY = getCorrectYCoordinate(exportYTop, pdfFontSize, cfg.font);

  return { pageW, pageH, scaleX, scaleY, pdfFontSize, exportX, exportY };
}

function getCorrectYCoordinate(exportYTop, fontSize, fontKey) {
  const ascender = FONT_STYPODESCENDERS[fontKey];
  const unitsPerEm = FONT_UNITS_PER_EM[fontKey] || 1000;

  const ascenderRatio = ascender / unitsPerEm;
  const adjustment = ascenderRatio * fontSize;

  const exportY = exportYTop - adjustment;
  return exportY;
}



function copyArrayColumn(arr, idx) {
  let i = arr.length;
  while (i--) {
    const row = arr[i];
    row[row.length] = row[idx];
  }
  return arr[0].length - 1;
}



function drawPlacedText(page, cfg, text, fontsMap) {
  const font = pickFontForPdf(cfg.font, fontsMap);
  const spacing = Number(cfg.spacing) || 0;
  const { pdfFontSize, exportX, exportY } = computeExportCoords(page, cfg);

  if (!spacing) {
    page.drawText(text, { x: exportX, y: exportY, size: pdfFontSize, font });
    return;
  }

  // Per-character draw (manual spacing). Skip extra space after last char.
  let cursorX = exportX;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    page.drawText(ch, { x: cursorX, y: exportY, size: pdfFontSize, font });
    if (i < chars.length - 1) {
      cursorX += font.widthOfTextAtSize(ch, pdfFontSize) + spacing;
    }
  }
}

function drawCustText(doc, docFonts) {

  for (const pgNumRaw of Object.keys(customText)) {
    let pgNum = parseInt(pgNumRaw, 10);
    const page = doc.getPage(pgNum - 1);
    const cTextsOnPg = customText[pgNum];
    for (cTexts of cTextsOnPg) {
      const cTextP = resolveCustomTextValue(cTexts.text)
      drawPlacedText(page, cTexts, cTextP, docFonts)
    }
  }
}

function drawRowText(doc, docFonts, row) {
  for (const key of Object.keys(locData)) {
    const cfg = locData[key];
    if (!cfg) continue;

    const pageIndex = (cfg.page || 1) - 1;
    const page = doc.getPage(pageIndex);
    if (!page) continue;

    const text = getCellOrBlank(row, parseInt(key, 10));
    drawPlacedText(page, cfg, text, docFonts); // <--- single call now
  }
}


// essentially drawRowText but Row 1 only (after header) and checks for sizing
function drawSizingText(doc, docFonts) {
  for (const key of Object.keys(locData)) {
    const cfg = locData[key];
    if (!cfg) continue;
    if (!Number.isFinite(Number(cfg.spacing) || cfg.spacing <= 0)) continue;

    const pageIndex = (cfg.page || 1) - 1;
    const page = doc.getPage(pageIndex);
    if (!page) continue;

    const text = getCellOrHeader(1, parseInt(key, 10));
    drawPlacedText(page, cfg, text, docFonts); // <--- single call now
  }

  // Loop through all pages that have custom text entries
  for (const [pageNumStr, entries] of Object.entries(customText)) {
    const pageNum = parseInt(pageNumStr, 10);
    const pageIndex = pageNum - 1;
    const page = doc.getPage(pageIndex);
    if (!page || !entries) continue;

    // Loop through each text config in this page
    for (const [i, cfg] of Object.entries(entries)) {
      if (!cfg) continue;

      const spacing = Number(cfg.spacing);
      if (!Number.isFinite(spacing) || spacing <= 0) continue;

      // Use the stored cfg.text directly
      const rawText = cfg.text || "";
      const text = resolveCustomTextValue(rawText)
      drawPlacedText(page, cfg, text, docFonts);
    }
  }
}


function initKeyCaptures() {
  document.addEventListener('keydown', function (event) {

    if (selectedColIndex === null && selectedCustomTextId === null) {
      return;
    }

    let action = "";
    switch (event.key) {
      case 'ArrowUp': action = "y-"; break;
      case 'ArrowDown': action = "y+"; break;
      case 'ArrowLeft': action = "x-"; break;
      case 'ArrowRight': action = "x+"; break;
      case '-': action = "s-"; break;
      case '=': action = "s+"; break;
      case '+': action = "s+"; break;
      case 'Delete': action = "d"; break;
      case 'Backspace': action = "d"; break;
      case '[': action = "sp-"; break;
      case ']': action = "sp+"; break;
      default: return;
    }
    event.preventDefault();
    if (selectedColIndex !== null) {
      colAction(action)
    } else if (selectedCustomTextId !== null) {
      customTextAction(action)
    };
  });
}


function colAction(move) {
  if (selectedColIndex == null || !locData) { return; }

  const markerData = locData[selectedColIndex];
  if (!markerData) { return; }

  // Parse numeric fields first to prevent string concatenation bugs
  markerData.x = parseInt(markerData.x, 10) || 50;
  markerData.y = parseInt(markerData.y, 10) || 50;
  markerData.size = parseInt(markerData.size, 10) || 12;

  switch (move) {
    case "x+":
      markerData.x += 1;
      break;
    case "x-":
      if (markerData.x > 1) { markerData.x -= 1; }
      break;
    case "y+":
      markerData.y += 1;
      break;
    case "y-":
      if (markerData.y > 1) { markerData.y -= 1; }
      break;
    case "s-":
      if (markerData.size > 3) {
        markerData.size -= 1;
        setFontSizeSelectors(selectedColIndex);
      }
      break;
    case "s+":
      markerData.size = parseInt(markerData.size, 10) + 1;
      setFontSizeSelectors(selectedColIndex);
      break;
    case "sp-":
      if (markerData.spacing > 0) {
        markerData.spacing -= 1;
        setFontSizeSelectors(selectedColIndex);
        queueUpdateRenderDoc();
      }
      break;
    case "sp+":
      markerData.spacing = parseInt(markerData.spacing, 10) + 1;
      setFontSizeSelectors(selectedColIndex);
      queueUpdateRenderDoc();
      break;
    case "d":
      removeMarker(selectedColIndex);
      break;
    default:
      console.warn("Move error: unknown direction", move);
  }

  try { saveLocData(); } catch { }
  updateMarker(selectedColIndex); // incremental re-render for this one
}

function customTextAction(move) {

  if (selectedCustomTextId == null || !customText) { return; }

  const customTextData = customText[currentPage][selectedCustomTextId];
  if (!customTextData) { return; }


  // Normalize numeric fields
  customTextData.x = parseInt(customTextData.x, 10) || 50;
  customTextData.y = parseInt(customTextData.y, 10) || 50;
  customTextData.size = parseInt(customTextData.size, 10) || 12;

  switch (move) {
    case "x+":
      customTextData.x += 1;
      break;
    case "x-":
      customTextData.x -= 1;
      break;
    case "y+":
      customTextData.y += 1;
      break;
    case "y-":
      customTextData.y -= 1;
      break;
    case "s-":
      if (customTextData.size > 3) { customTextData.size -= 1; }
      break;
    case "s+":
      customTextData.size += 1;
      break;
    case "sp-":
      if (customTextData.spacing > 0) {
        customTextData.spacing -= 1;
        queueUpdateRenderDoc();
      }
      break;
    case "sp+":
      customTextData.spacing = parseInt(customTextData.spacing, 10) + 1;
      queueUpdateRenderDoc();
      break;
    case "d":
      removeCustomText(currentPage, selectedCustomTextId);
      break;
    default:
      console.warn("Custom Text move error: unknown direction", move);
  }
  checkRender(customTextData);
  updateCustomText(selectedCustomTextId); // incremental re-render for this one
  setCustomTextSelectors(selectedCustomTextId);
}


const logicalXOR = (a, b) => (a || b) && !(a && b);

// Remove control chars, normalize, cap length
function sanitizePlainString(input, maxLen = 200) {
  if (input == null) return null;
  // strip control chars (except newline/tab if you want to keep them)
  const withoutControls = String(input).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  // trim & normalize unicode
  const trimmed = withoutControls.trim().normalize('NFC');
  // cap length
  return trimmed.slice(0, maxLen);
}

// If you MUST inject via innerHTML (prefer textContent!), escape first:
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function objectToHTMLTable(data, options = {}) {
  // Default options
  const {
    tableClass = '',
    headerClass = '',
    rowClass = '',
    cellClass = ''
  } = options;

  // Start building the table
  let html = `<table${tableClass ? ` class="${tableClass}"` : ''}>`;

  // Handle array of objects
  if (Array.isArray(data) && data.length > 0) {
    // Get headers from first object's keys
    const headers = Object.keys(data[0]);

    // Create header row
    html += '<thead><tr>';
    headers.forEach(header => {
      html += `<th${headerClass ? ` class="${headerClass}"` : ''}>${escapeHtml(header)}</th>`;
    });
    html += '</tr></thead>';

    // Create data rows
    html += '<tbody>';
    data.forEach(row => {
      html += `<tr${rowClass ? ` class="${rowClass}"` : ''}>`;
      headers.forEach(header => {
        const value = row[header];
        html += `<td${cellClass ? ` class="${cellClass}"` : ''}>${formatValue(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }
  // Handle single object (key-value pairs)
  else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    html += '<thead><tr>';
    html += `<th${headerClass ? ` class="${headerClass}"` : ''}>Key</th>`;
    html += `<th${headerClass ? ` class="${headerClass}"` : ''}>Value</th>`;
    html += '</tr></thead>';

    html += '<tbody>';
    Object.entries(data).forEach(([key, value]) => {
      html += `<tr${rowClass ? ` class="${rowClass}"` : ''}>`;
      html += `<td${cellClass ? ` class="${cellClass}"` : ''}>${escapeHtml(key)}</td>`;
      html += `<td${cellClass ? ` class="${cellClass}"` : ''}>${formatValue(value)}</td>`;
      html += '</tr>';
    });
    html += '</tbody>';
  }
  // Handle empty array
  else if (Array.isArray(data) && data.length === 0) {
    html += '<tbody><tr><td>No data available</td></tr></tbody>';
  }
  else {
    throw new Error('Data must be an object or array of objects');
  }

  html += '</table>';
  return html;
}

// Helper function to format different value types
function formatValue(value) {
  if (value === null) return '<em>null</em>';
  if (value === undefined) return '<em>undefined</em>';
  if (typeof value === 'object') return escapeHtml(JSON.stringify(value));
  return escapeHtml(String(value));
}

function checkRender(obj) {
  if (!obj || obj.spacing == null) return false;
  const num = Number(obj.spacing);
  if (isNaN(num)) return;
  if (num > 0) {
    queueUpdateRenderDoc();
  }
}
