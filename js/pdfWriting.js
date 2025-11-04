// --- PDF-Specific Utils ---


// Computes scaled PDF coordinates and font size based on page size and config
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

  return { pdfFontSize, exportX, exportY };
}

// Adjusts Y coordinate to account for font ascender and PDF units
function getCorrectYCoordinate(exportYTop, fontSize, fontKey) {
  const ascender = FONT_STYPODESCENDERS[fontKey];
  const unitsPerEm = FONT_UNITS_PER_EM[fontKey] || 1000;

  const ascenderRatio = ascender / unitsPerEm;
  const adjustment = ascenderRatio * fontSize;

  const exportY = exportYTop - adjustment;
  return exportY;
}

// Copies a specified column in a 2D array to a new column
function copyArrayColumn(arr, idx) {
  for (let i = 0; i < arr.length; i++) {
    arr[i].push(arr[i][idx]);
  }
  return arr[0].length - 1;
}

// Draws text on a page with optional per-character spacing
function drawPlacedText(page, cfg, text, fontsMap) {
  const font = pickFontForPdf(cfg.font, fontsMap);
  const spacing = Number(cfg.spacing) * 0.5 || 0;
  const { pdfFontSize, exportX, exportY } = computeExportCoords(page, cfg);

  if (!spacing) {
    page.drawText(text, { x: exportX, y: exportY, size: pdfFontSize, font });
    return;
  }

  // Per-character draw (manual spacing). Skip extra space after last char.
  let cursorX = exportX;
  for (const [i, ch] of Array.from(text).entries()) {
    page.drawText(ch, { x: cursorX, y: exportY, size: pdfFontSize, font });
    if (i < text.length - 1) {
      cursorX += font.widthOfTextAtSize(ch, pdfFontSize) + spacing;
    }
  }
}

// drawAllText
function drawStaticText(doc, docFonts, locDataPages) {
  if (!locDataPages) { return; };
  let pgld;
  for (pgNum of Object.keys(locDataPages)) {
    const page = doc.getPage(Number(pgNum) - 1);
    pgld = locDataPages[pgNum];
    for (obj of Object.values(pgld.customText)) {
      drawPlacedText(page, obj, obj.text, docFonts)
    }
    for (obj of Object.values(pgld.savedText)) {
      drawPlacedText(page, obj, obj.text, docFonts)
    }
  }
}


function drawRowText(doc, docFonts, locDataPages, rowIdx) {
  if (!locDataPages) { return; };
  let pgld;
  for (pgNum of Object.keys(locDataPages)) {
    const page = doc.getPage(Number(pgNum) - 1);
    pgld = locDataPages[pgNum];
    for (obj of Object.values(pgld.csvColumns)) {
      const txt = getCellOrBlank(rowIdx, obj.colIdx);
      drawPlacedText(page, obj, txt, docFonts)
    }
  }
}


// essentially drawRowText but Row 1 only (after header) and checks for sizing
function drawSizingText(doc, docFonts, pageLocData, pgNum) {
  const page = doc.getPage(Number(pgNum) - 1);
  if (!pageLocData) { console.log('error drawing sizing text'); return; };

  for (obj of Object.values(pageLocData.customText)) {
    if (obj.spacing && obj.spacing > 0) {
      drawPlacedText(page, obj, obj.text, docFonts)
    }
  }
  for (obj of Object.values(pageLocData.savedText)) {
    if (obj.spacing && obj.spacing > 0) {
      drawPlacedText(page, obj, obj.text, docFonts)
    }
  }
  for (obj of Object.values(pageLocData.csvColumns)) {
    if (obj.spacing && obj.spacing > 0) {
      const txt = getCellOrHeader(1, obj.colIdx);
      drawPlacedText(page, obj, txt, docFonts)
    }
  }
}


function pickFontForPdf(fontKey, embedded) {
  switch ((fontKey || '').toLowerCase()) {
    case '_signature':
      return embedded._signature;
    case '_monospace':
      return embedded._monospace;
    case '_symbol':
      return embedded._symbol;
    case '_normal':
    default:
      return embedded._normal;
  }
}

function getCellOrHeader(rowIdx, colIdx) {
  csvData = Alpine.store('csvState').csvData
  const val = csvData?.[rowIdx]?.[colIdx];
  if (val && String(val).trim() !== '') return String(val);
  const header = csvData?.[0]?.[colIdx];
  if (header && String(header).trim() !== '') return `[${header}]`;
  return `Col ${colIdx}`;
}

function getCellOrBlank(rowIdx, colIdx) {
  csvData = Alpine.store('csvState').csvData
  const val = csvData?.[rowIdx]?.[colIdx];
  if (val && String(val).trim() !== '') return String(val);
  return ''; // Return empty string instead of falling back to header
}
