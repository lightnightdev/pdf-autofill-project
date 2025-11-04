
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





async function drawAllPdfContent(doc, docFonts, row = null) {
  const bytes = Alpine.store('pdfState').pdfBytes;
  const pages = Alpine.store('locData').pages;

  // ========= Phase 1: Sizing Text (rasterized) =========
  for (const [pgNumStr, pageData] of Object.entries(pages)) {
    const pageNum = parseInt(pgNumStr, 10);
    const page = doc.getPage(pageNum - 1);
    if (!page) continue;

    // CSV-based spacing previews
    if (pageData.csvColumns) {
      for (const [key, cfg] of Object.entries(pageData.csvColumns)) {
        const spacing = Number(cfg.spacing);
        if (!Number.isFinite(spacing) || spacing <= 0) continue;

        const text = getCellOrHeader(1, parseInt(key, 10)); // header row for sizing
        drawPlacedText(page, cfg, text, docFonts);
      }
    }

    // CustomText spacing previews
    if (pageData.customText) {
      for (const cfg of Object.values(pageData.customText)) {
        const spacing = Number(cfg.spacing);
        if (!Number.isFinite(spacing) || spacing <= 0) continue;

        const text = resolveCustomTextValue(cfg.text || '');
        drawPlacedText(page, cfg, text, docFonts);
      }
    }
  }

  // ========= Phase 2: Actual Text Content =========
  for (const [pgNumStr, pageData] of Object.entries(pages)) {
    const pageNum = parseInt(pgNumStr, 10);
    const page = doc.getPage(pageNum - 1);
    if (!page) continue;

    // CSV-driven text (per row)
    if (pageData.csvColumns && row !== null) {
      for (const [key, cfg] of Object.entries(pageData.csvColumns)) {
        const text = getCellOrBlank(row, parseInt(key, 10));
        drawPlacedText(page, cfg, text, docFonts);
      }
    }

    // Saved text (manual user text saved on page)
    if (pageData.savedText) {
      for (const [key, cfg] of Object.entries(pageData.savedText)) {
        const text = cfg.text || '';
        drawPlacedText(page, cfg, text, docFonts);
      }
    }

    // Custom text (user-specified static entries)
    if (pageData.customText) {
      for (const cfg of Object.values(pageData.customText)) {
        const text = resolveCustomTextValue(cfg.text || '');
        drawPlacedText(page, cfg, text, docFonts);
      }
    }
  }
}


function drawPlacedText(page, cfg, text, fontsMap) {
  const font = pickFontForPdf(cfg.font, fontsMap);
  const spacing = Number(cfg.spacing) || 0;
  const { pdfFontSize, exportX, exportY } = computeExportCoords(page, cfg);

  if (!spacing) {
    page.drawText(text, { x: exportX, y: exportY, size: pdfFontSize, font });
    return;
  }

  // Per-character draw with spacing
  let cursorX = exportX;
  for (const [i, ch] of Array.from(text).entries()) {
    page.drawText(ch, { x: cursorX, y: exportY, size: pdfFontSize, font });
    if (i < text.length - 1) {
      cursorX += font.widthOfTextAtSize(ch, pdfFontSize) + spacing;
    }
  }
}


function drawCustText(doc, docFonts) {
  const pages = Alpine.store('locData').pages;
  for (const [pgNumStr, pageData] of Object.entries(pages)) {
    const pageNum = parseInt(pgNumStr, 10);
    const page = doc.getPage(pageNum - 1);
    if (!page || !pageData.customText) continue;

    for (const cfg of Object.values(pageData.customText)) {
      const resolvedText = resolveCustomTextValue(cfg.text || '');
      drawPlacedText(page, cfg, resolvedText, docFonts);
    }
  }
}


function drawRowText(doc, docFonts, row) {
  const pages = Alpine.store('locData').pages;

  for (const [pgNumStr, pageData] of Object.entries(pages)) {
    const pageNum = parseInt(pgNumStr, 10);
    const page = doc.getPage(pageNum - 1);
    if (!page || !pageData.csvColumns) continue;

    for (const [key, cfg] of Object.entries(pageData.csvColumns)) {
      const text = getCellOrBlank(row, parseInt(key, 10));
      drawPlacedText(page, cfg, text, docFonts);
    }
  }
}


function drawSizingText(doc, docFonts) {
  const pages = Alpine.store('locData').pages;

  // Loop CSV columns for spacing checks
  for (const [pgNumStr, pageData] of Object.entries(pages)) {
    const pageNum = parseInt(pgNumStr, 10);
    const page = doc.getPage(pageNum - 1);
    if (!page || !pageData.csvColumns) continue;

    for (const [key, cfg] of Object.entries(pageData.csvColumns)) {
      if (!Number.isFinite(Number(cfg.spacing)) || cfg.spacing <= 0) continue;
      const text = getCellOrHeader(1, parseInt(key, 10));
      drawPlacedText(page, cfg, text, docFonts);
    }
  }

  // Loop custom text entries for spacing
  for (const [pgNumStr, pageData] of Object.entries(pages)) {
    const pageNum = parseInt(pgNumStr, 10);
    const page = doc.getPage(pageNum - 1);
    if (!page || !pageData.customText) continue;

    for (const cfg of Object.values(pageData.customText)) {
      if (!Number.isFinite(Number(cfg.spacing)) || cfg.spacing <= 0) continue;
      const text = resolveCustomTextValue(cfg.text || '');
      drawPlacedText(page, cfg, text, docFonts);
    }
  }
}

