// --------------------
// Track clicks on canvas
// --------------------
function initCanvasClicks() {
  const canvas = document.getElementById('pdf-canvas');
  if (!canvas) { log('No canvas'); return; }

  canvas.addEventListener('click', async (e) => {
    if (!inputSelection && (selectedColIndex == null)) {
      log('ERROR: no column or custom text selected.');
      return;
    }

    // Click coordinates in canvas CSS pixel space
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Current canvas render size (store with placements!)
    const stageW = canvas.width;
    const stageH = canvas.height;

    // Read controls & normalize
    const sizeEl = document.getElementById('size-select');
    const fontEl = document.getElementById('font-select');
    const spacingEl = document.getElementById('spacing-select');

    const selectedSize = Number.parseInt(sizeEl?.value, 10) || 12;
    const selectedFont = (fontEl?.value || 'monospace');
    const selectedSpacing = Number.parseFloat(spacingEl?.value) || 0;

    if (inputSelection === 'checkmark') {
      // example uses CHECKMARK and your symbol font key
      const currentText = CHECKMARK;
      newCustomText(currentPage, x, y, currentText, 24, '_symbol', selectedSpacing, { stageW, stageH });
      return;
    }

    if (inputSelection === 'custom_text') {
      await userInputCustomText(x, y, selectedSize, selectedFont, selectedSpacing, stageW, stageH);
      return;
    }

    if (selectedColIndex != null) {
      // place a CSV marker
      newMarker(x, y, currentPage, selectedSize, selectedFont, selectedSpacing, { stageW, stageH });
      return;
    }
  });
}

// Ask user for string, sanitize, and place
async function userInputCustomText(x, y, size, font, spacing, stageW, stageH) {
  const currentText = await promptForSafeString('Enter text', 200);
  if (!currentText) { log('Canceled or empty text'); return; }
  newCustomText(currentPage, x, y, currentText, size, font, spacing, { stageW, stageH });
}

// Simple prompt + sanitize
async function promptForSafeString(message = 'Enter text', maxLen = 200) {
  const raw = window.prompt(message, '');
  if (raw == null) return null; // canceled
  const safe = sanitizePlainString(raw, maxLen);
  return safe || null;
}

// Example sanitizer (keep yours if you already defined it)
function sanitizePlainString(input, maxLen = 200) {
  if (input == null) return null;
  const withoutControls = String(input).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  const trimmed = withoutControls.trim().normalize('NFC');
  return trimmed.slice(0, maxLen);
}


//
// Rendering elements
//
async function renderAll() {
  // If current page has any elements with spacing, render those elements on the page, not the overlay
  if (typeof currentPage !== 'number') { log('No page/text to render.'); return; }

  if (pageHasNonZeroSpacing(currentPage)) {
    try {
      await renderPage(currentPage);
    } catch (e) {
      console.error(e);
      log('Issue with non-zero spacing columns on page.');
    }
  }

  if (!syncOverlayBoxToCanvas()) { log('no overlay or canvas'); return; }

  const overlay = document.getElementById('pdf-overlay');

  // Clear everything
  overlay.innerHTML = '';
  while (overlay.firstChild) {
    overlay.removeChild(overlay.firstChild);
  }
  // Recreate markers for this page
  renderAllMarkers();

  // Render CustomText
  renderAllCustomText();
}





function syncOverlayBoxToCanvas() {
  const overlay = document.getElementById('pdf-overlay');
  const canvas = document.getElementById('pdf-canvas');
  if (!overlay || !canvas) return false;

  overlay.style.width = canvas.width + 'px';
  overlay.style.height = canvas.height + 'px';
  overlay.style.left = '0px';
  overlay.style.top = '0px';
  overlay.style.position = 'absolute';
  overlay.style.zIndex = 10;
  overlay.style.pointerEvents = 'none'; // markers can re-enable selectively
  return true;
}


