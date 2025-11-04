function log(msg) {
  const logStore = Alpine.store('logbox');
  if (!logStore) return console.warn('Log store not initialized');

  logStore.output += `> ${msg}\n`;
}

function getCanvasClickCoords(canvas, event) {
  if (!canvas || !event) return null;

  // Get canvas bounding rectangle
  const rect = canvas.getBoundingClientRect();

  // Coordinates relative to top-left of the canvas
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Optional: normalized coordinates (0–1), useful if canvas is scaled
  const normX = x / rect.width;
  const normY = y / rect.height;

  return { x, y, normX, normY };
}


function verifyPage(pageNum) {
  if (!Alpine.store('locData').pages[pageNum]) {
    Alpine.store('locData').pages[pageNum] = {
      csvColumns: [],
      customText: [],
      savedText: [],
    };
  }
}

function clearState() {
  const stores = ['locData', 'pdfState', 'csvState', 'viewState'];
  stores.forEach(name => Alpine.store(name).clear());
}

function b64ToU8(base64) {
  // Handle big strings safely
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}


// Remove control chars, normalize, cap length
function sanitizePlainString(input, maxLen = 200) {
  if (input == null) return null;
  // strip control chars (except newline/tab if you want to keep them)
  const withoutControls = String(input).replace(
    /[\u0000-\u001F\u007F-\u009F]/g,
    ''
  );
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
