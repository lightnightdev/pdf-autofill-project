// const CHECKMARK = "\u2713" // unicode 2713 ✓
// ^moved to font_data

let inputSelection = null;
let selectedCustomTextId = null;

let customText = {};
// customText[pageNumber] = [{x: 25, y: 30, text: "hello", size: 24, spacing: 12, font: _monospace]
//

function checkmarkCreate() {
  inputSelection = 'checkmark';
  selectCustomInputs(true, false, false);
}

function customTextCreate() {
  inputSelection = 'custom_text';
  selectCustomInputs(false, true, false);
}

function unselectCustomTextCreate() {
  inputSelection = null;
  selectCustomInputs(false, false, false);

  const elements = document.querySelectorAll('.select.ct-data-el');
  if (elements.length) {
    for (const el of elements) {
      el.classList.remove('select');
    }
  }

  document.getElementById('font-select').disabled = false;
  document.getElementById('spacing-select').disabled = false;

  highlightCustomTextCard(null);
}

function selectCustomInputs(
  selectCheckmark,
  selectCustomText,
  selectSavedText
) {
  selectedColIndex = null;
  selectedCustomTextId = null;
  const cardC = document.getElementById('checkmark-card');
  const cardT = document.getElementById('custom-text-card');
  const cardS = document.getElementById('saved-text-card');
  const inputS = document.getElementById('saved-text-input');
  selectCheckmark
    ? cardC?.classList.add('select')
    : cardC?.classList.remove('select');
  selectCustomText
    ? cardT?.classList.add('select')
    : cardT?.classList.remove('select');
  selectSavedText
    ? cardS?.classList.add('select')
    : cardS?.classList.remove('select');
  selectSavedText
    ? inputS?.classList.add('select')
    : inputS?.classList.remove('select');
  if (selectCheckmark || selectCustomText || selectSavedText) {
    selectMarkersAndCards(-1);
  }
}

function newCustomText(page, x, y, text, size, font, spacing = 0) {
  const canvas = document.getElementById('pdf-canvas');
  if (!customText[page]) {
    customText[page] = [];
  }
  const ctData = {
    x: x,
    y: y,
    text: text,
    size: size,
    font: font,
    spacing: spacing,
    stageW: canvas.width || 1,
    stageH: canvas.height || 1,
  };
  let idx = customText[page].push(ctData);
  idx -= 1;
  saveCustomText();
  renderCustomText(idx, ctData);
  renderCustomTextCards(page);
  selectCustomText(idx);
}

function updateCustomText(ctId) {
  saveCustomText();
  const el = document.getElementById(`ct-${ctId}`);
  if (el) {
    el.remove();
  }

  renderCustomText(ctId, customText[currentPage][ctId]);
  renderCustomTextCards(currentPage);
}

function removeCustomText(page, ctId) {
  customText[page].splice(ctId, 1);

  unselectCustomTextCreate();
  saveCustomText();
  renderCustomTextCards(currentPage);
  renderAll(); // need ct-id of elements to match state
}

function renderAllCustomText() {
  renderCustomTextCards(currentPage);

  if (!customText[currentPage]) {
    return;
  }
  for (i = 0; i < customText[currentPage].length; i++) {
    renderCustomText(i, customText[currentPage][i]);
  }
}

function renderCustomText(ctId, data) {
  if (!data) {
    return;
  }
  // add marker to page
  const overlay = document.getElementById('pdf-overlay');
  const el = document.createElement('div');
  el.id = `ct-${ctId}`;
  el.classList.add('custom-text');
  el.classList.add('ct-data-el');
  if (selectedCustomTextId == ctId) {
    el.classList.add('select');
  }
  el.dataset.ctId = String(ctId);
  el.addEventListener('click', () => selectCustomText(parseInt(ctId, 10)));
  el.style.position = 'absolute';
  el.style.pointerEvents = 'auto';
  applyDataToMarker(el, data);
  // --- handle spacing ---
  const spacing = Number(data.spacing);
  if (!isNaN(spacing) && spacing > 0) {
    // replace each character (including spaces) with a space
    el.classList.add('invisible-text');
  }
  el.textContent = resolveCustomTextValue(data.text);
  overlay.appendChild(el);
}

function selectCustomText(ctId) {
  selectMarkersAndCards(-1);
  unselectCustomTextCreate();
  selectedCustomTextId = ctId;
  const el = document.getElementById(`ct-${ctId}`);
  el.classList.add('select');

  if (el) {
    el.classList.add('select');
  }
  highlightCustomTextCard(ctId);
  setCustomTextSelectors(ctId);
}

function removeCustomTextFromPage() {
  const newArr = [];
  const kys = Object.keys(customText);
  for (ky of kys) {
    i = parseInt(ky, 10);
    if (i < currentPage) {
      // keep everything before the deleted page the same
      newArr[i] = customText[i];
    } else if (i > currentPage) {
      // shift everything after down by one
      newArr[i - 1] = customText[i];
    }
  }

  customText = newArr;
  saveCustomText();
  renderCustomTextCards(currentPage);
}

function renderCustomTextCards(pageNumber) {
  const container = document.getElementById('custom-cards');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const resolvedPage =
    typeof pageNumber === 'number'
      ? pageNumber
      : typeof currentPage === 'number'
      ? currentPage
      : 1;

  const entries = customText?.[resolvedPage];
  if (!Array.isArray(entries)) {
    return;
  }

  entries.forEach((entry, ctId) => {
    if (!entry || entry.text === '__checkmark') {
      return;
    }

    const card = document.createElement('div');
    card.className = 'card p-2 text-start loc-data-exists';
    card.dataset.ctId = String(ctId);
    card.id = `custom-card-${ctId}`;

    if (selectedCustomTextId === ctId) {
      card.classList.add('select');
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'fw-bold mb-1 text-start';
    titleDiv.textContent = resolveCustomTextValue(entry.text) || '';
    card.appendChild(titleDiv);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'text-start text-muted small';
    const fontValue = entry.font;
    const sizeValue = Number.isFinite(Number(entry.size))
      ? Number(entry.size)
      : 12;
    const spacingValue = Number.isFinite(Number(entry.spacing))
      ? Number(entry.spacing)
      : 0;
    detailsDiv.textContent = `Font ${fontValue} • Size ${sizeValue} • Spacing ${spacingValue}`;
    card.appendChild(detailsDiv);

    card.addEventListener('click', () => {
      selectCustomText(parseInt(card.dataset.ctId, 10));
    });

    container.appendChild(card);
  });
}

function highlightCustomTextCard(ctId) {
  const container = document.getElementById('custom-cards');
  if (!container) {
    return;
  }

  Array.from(container.children).forEach((card) => {
    const cardId = parseInt(card.dataset.ctId, 10);
    if (ctId != null && cardId === ctId) {
      card.classList.add('select');
    } else {
      card.classList.remove('select');
    }
  });
}

function setCustomTextSelectors(ctId) {
  const ctEntry = customText?.[currentPage]?.[ctId];
  if (!ctEntry) {
    return;
  }

  const isCheckmark = ctEntry.text === '__checkmark';
  if (isCheckmark) {
    document.getElementById('font-select').disabled = true;
    document.getElementById('spacing-select').disabled = true;
    return;
  }

  const fontSelect = document.getElementById('font-select');
  if (fontSelect) {
    fontSelect.value = ctEntry.font || '_normal';
  }

  const sizeInput = document.getElementById('size-select');
  if (sizeInput) {
    const numericSize = Number(ctEntry.size);
    sizeInput.value =
      Number.isFinite(numericSize) && numericSize > 0 ? numericSize : 12;
  }

  const spacingInput = document.getElementById('spacing-select');
  if (spacingInput) {
    const numericSpacing = Number(ctEntry.spacing);
    spacingInput.value = Number.isFinite(numericSpacing) ? numericSpacing : 0;
  }
}
