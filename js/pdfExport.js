let CUSTOM_FONT_BYTE_CACHE = null;

// main function
async function generateAndExportPDFs() {
  // Calculate total number of data rows (excluding header row)
  let csvData = Alpine.store('csvState').csvData
  const total = (csvData?.length || 0) - 1;
  if (total <= 0) {
    log('CSV has no data rows.');
  }
  const exportSingle =
    document.getElementById('export-single-pdf')?.checked ?? true;
  const rasterizeOutput =
    document.getElementById('rasterize-output')?.checked ?? false;
  const confirmMessage = exportSingle
    ? `Generate and download ${total} flattened PDF(s) as a single merged PDF?`
    : `Generate and download ${total} flattened PDF(s) as a ZIP?`;
  if (!confirm(confirmMessage)) return;

  if (rasterizeOutput) {
    if (
      !confirm('Files size will be larger but more compatible. Continue?')
    )
      return;
  }

  const currentPdfBytes = Alpine.store('pdfState').pdfBytes
  const locDataPages = Alpine.store('locData').pages

  if (!currentPdfBytes) { log('No base PDF loaded.'); return; }
  if (!locDataPages || Object.keys(locDataPages).length === 0) { log('No markers set.'); return; }
  if (!window.PDFLib) { log('pdf-lib not available'); return; }

  try {
    // collect files for zipping or merged export
    const filesForZip = [];
    const combinedDoc = exportSingle ? await PDFLib.PDFDocument.create() : null;

    
    log('Preparing source PDF…');
    const srcDoc = await PDFLib.PDFDocument.load(currentPdfBytes);
    const fonts = await embedFontsForDoc(srcDoc);

    drawStaticText(srcDoc, fonts, locDataPages);

    const fileNameCols = Alpine.store('csvState').fileNameCols;

    // Iterate through each data row in the CSV (skipping header)
    for (let r = 1; r < csvData.length; r++) {
      log(`Generating row ${r} of ${total}`);

      // New output doc with copied pages
      const outDoc = await srcDoc.copy();
      const fonts = await embedFontsForDoc(outDoc);

      // Draw placements for this row
      drawRowText(outDoc, fonts, locDataPages, r);

      if (exportSingle) {
        // Save output to combinedDoc -- will rasterize all at end!
        const copiedPages = await combinedDoc.copyPages(
          outDoc,
          outDoc.getPageIndices()
        );
        copiedPages.forEach((p) => combinedDoc.addPage(p));
      } else {
        // Save and queue this file for the ZIP (no per-file download)
        let bytes;
        if (rasterizeOutput) {
          bytes = rasterizeFile(
            await outDoc.save({
              useObjectStreams: false,
              compress: true,
            }),
            { dpi: 100 }
          );
        } else {
          bytes = await outDoc.save({
            useObjectStreams: false,
            compress: true,
          });
        }

        // Set FileName
        let stemRaw = '';
        for (const nm of fileNameCols) {
          stemRaw += (csvData[r]?.[nm] || '').toString();
        }
        if (stemRaw === '') {
          stemRaw = (csvData[r]?.[0] || '').toString();
        }

        // To get leading 0's if more than 9 rows
        const paddedRow = String(r).padStart(String(total).length, '0');
        const sanitized = sanitizeStem(stemRaw);
        const stem = sanitized
          ? `${paddedRow}-${sanitized}`
          : `${paddedRow}-Row`;

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
        .replace(/[:T]/g, '-')}.pdf`;
      if (rasterizeOutput) {
        log('Rasterizing output file...');
        const rasterizedMergedBytes = await rasterizeFile(mergedBytes);
        downloadPdf(rasterizedMergedBytes, mergedName);
        log(
          `All ${total} PDFs generated, merged, and rasterized into ${mergedName}.`
        );
      } else {
        downloadPdf(mergedBytes, mergedName);
        log(`All ${total} PDFs generated and merged into ${mergedName}.`);
      }
    } else {
      // 6) Generate and download a single ZIP
      const zipName = `autofilled_pdfs_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.zip`;
      await downloadZip(filesForZip, zipName);

      log(`All ${total} flattened PDFs generated and zipped into ${zipName}.`);
    }
  } catch (err) {
    console.error(err);
    log('Export error: ' + (err?.message || err));
  }
}


function sanitizeStem(s) {
  return (
    (s || '')
      .toString()
      .trim()
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 64) || ''
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
      if (node.get(PDFName.of('Annots')))
        node.set(PDFName.of('Annots'), outDoc.context.obj([]));
      // Remove page-level actions (AA)
      if (node.get(PDFName.of('AA'))) node.delete(PDFName.of('AA'));
    }
  } catch { }

  // 3) Remove document open actions
  try {
    const cat = outDoc.catalog; // Catalog dict
    if (cat.dict.has(PDFName.of('OpenAction')))
      cat.dict.delete(PDFName.of('OpenAction'));
    if (cat.dict.has(PDFName.of('AA'))) cat.dict.delete(PDFName.of('AA'));
  } catch { }

  // 4) Remove JavaScript & EmbeddedFiles name trees from /Names
  try {
    const cat = outDoc.catalog;
    const names = cat.dict.get(PDFName.of('Names'));
    if (names) {
      const namesDict = outDoc.context.lookup(names, PDFDict);
      if (namesDict) {
        if (namesDict.has(PDFName.of('JavaScript')))
          namesDict.delete(PDFName.of('JavaScript'));
        if (namesDict.has(PDFName.of('EmbeddedFiles')))
          namesDict.delete(PDFName.of('EmbeddedFiles'));
        // If /Names becomes empty, drop it
        if (namesDict.size === 0) cat.dict.delete(PDFName.of('Names'));
      }
    }
  } catch { }

  // 5) Remove metadata/XMP (optional)
  try {
    const cat = outDoc.catalog;
    if (cat.dict.has(PDFName.of('Metadata')))
      cat.dict.delete(PDFName.of('Metadata'));
  } catch { }

  // 6) Ensure fonts are subset & standard where possible (you already use { subset: true })
  // Nothing to do here programmatically unless re-embedding. You’re good.

  // 7) Clear viewer prefs that can trigger behaviors (optional)
  try {
    const cat = outDoc.catalog;
    if (cat.dict.has(PDFName.of('ViewerPreferences')))
      cat.dict.delete(PDFName.of('ViewerPreferences'));
  } catch { }
}

// downloader
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadZip(files, zipName = 'output.zip') {
  // files: Array<{ name: string, data: Uint8Array | ArrayBuffer | Blob | string }>
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.data);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPdf(data, filename = 'output.pdf') {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  downloadBlob(blob, filename);
}
