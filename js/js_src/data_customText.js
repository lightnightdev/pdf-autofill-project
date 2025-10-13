let inputSelection = null;
let selectedCustomTextId = null;
let selectedCustomTextType = null;

let customText = {};
// customText[pageNumber] = [{x: 25, y: 30, text: "hello", size: 24, spacing: 12, font: _monospace]

function checkmarkCreate() {
    inputSelection = "checkmark";
    selectedColIndex = null;
    selectedCustomTextId = null;
    selectedCustomTextType = null;

    const cardC = document.getElementById('checkmark-card');
    cardC?.classList.add('select');

    const cardT = document.getElementById('custom-text-card');
    cardT?.classList.remove('select');
    selectMarkersAndCards(-1);
}

function customTextCreate() {
    inputSelection = "custom_text";
    selectedColIndex = null;
    selectedCustomTextId = null;
    selectedCustomTextType = null;

    const cardT = document.getElementById('custom-text-card');
    cardT?.classList.add('select');

    const cardC = document.getElementById('checkmark-card');
    cardC?.classList.remove('select');
    selectMarkersAndCards(-1);
}

function unselectCustomTextCreate() {
    inputSelection = null;
    selectedCustomTextId = null;
    selectedCustomTextType = null;

    const cardC = document.getElementById('checkmark-card');
    const cardT = document.getElementById('custom-text-card');
    cardC?.classList.remove('select');
    cardT?.classList.remove('select');

    const elements = document.querySelectorAll('.select.ct-data-el');
    if (elements.length) {
        for (const el of elements) {
            el.classList.remove('select');
        }
    }
}

function newCustomText(page, x, y, text, size, font, spacing = 0, stage = {}) {
    createCustomElement('text', page, x, y, text, size, font, spacing, stage);
}

function newCheckmark(page, x, y, size = 24, spacing = 0, stage = {}) {
    createCustomElement('checkmark', page, x, y, CHECKMARK_TOKEN, size, '_symbol', spacing, stage);
}

function createCustomElement(type, page, x, y, text, size, font, spacing = 0, stage = {}) {
    if (!customText[page]) { customText[page] = []; }

    const canvas = document.getElementById("pdf-canvas");
    const stageW = stage.stageW || canvas?.width || 1;
    const stageH = stage.stageH || canvas?.height || 1;

    const storedText = type === 'checkmark' ? CHECKMARK_TOKEN : text;

    const elementData = {
        x,
        y,
        text: storedText,
        size,
        font,
        spacing,
        stageW,
        stageH,
    };

    const idx = customText[page].push(elementData) - 1;
    saveCustomElement(type);
    const entryType = getCustomElementType(elementData);
    renderCustomText(idx, elementData, entryType);
    selectCustomText(idx, entryType);
}

function updateCustomText(ctId, type = selectedCustomTextType || 'text') {
    if (!customText[currentPage]) { return; }

    saveCustomElement(type);
    const elementType = type || getCustomElementType(customText[currentPage][ctId]);
    const el = document.getElementById(getCustomElementId(ctId, elementType));
    if (el) { el.remove(); }

    const data = customText[currentPage][ctId];
    if (!data) { return; }
    const entryType = getCustomElementType(data);
    renderCustomText(ctId, data, entryType);
}

function removeCustomText(page, ctId, type = selectedCustomTextType || 'text') {
    if (!customText[page]) { return; }

    const entryType = type || getCustomElementType(customText[page][ctId]);
    customText[page].splice(ctId, 1);
    const el = document.getElementById(getCustomElementId(ctId, entryType));
    if (el) { el.remove(); }
    unselectCustomTextCreate();
    saveCustomElement(type);
}

function renderAllCustomText() {
    renderAllCustomElements();
}

function renderAllCustomElements(type) {
    if (!customText[currentPage]) { return; }
    for (let i = 0; i < customText[currentPage].length; i++) {
        const entry = customText[currentPage][i];
        const entryType = getCustomElementType(entry);
        if (type && entryType !== type) { continue; }
        renderCustomText(i, entry, entryType);
    }
}

function renderCustomText(ctId, data, type) {
    if (!data) { return; }
    const entryType = type || getCustomElementType(data);
    const overlay = document.getElementById('pdf-overlay');
    const el = document.createElement('div');
    el.id = getCustomElementId(ctId, entryType);
    el.classList.add('custom-text');
    el.classList.add('ct-data-el');
    if (selectedCustomTextId === ctId && selectedCustomTextType === entryType) {
        el.classList.add('select');
    }
    el.dataset.ctId = String(ctId);
    el.dataset.ctType = entryType;
    el.addEventListener('click', () => selectCustomText(parseInt(ctId, 10), entryType));
    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';

    applyDataToMarker(el, data);
    el.textContent = resolveCustomTextValue(data.text);
    overlay.appendChild(el);
}

function selectCustomText(ctId, type = null) {
    selectMarkersAndCards(-1);
    unselectCustomTextCreate();
    const entry = customText[currentPage]?.[ctId];
    const entryType = type || getCustomElementType(entry);
    selectedCustomTextId = ctId;
    selectedCustomTextType = entryType;

    const cardC = document.getElementById('checkmark-card');
    const cardT = document.getElementById('custom-text-card');
    if (entryType === 'checkmark') {
        cardC?.classList.add('select');
    } else {
        cardT?.classList.add('select');
    }

    const el = document.getElementById(getCustomElementId(ctId, entryType));
    el?.classList.add('select');
}

function removeCustomTextFromPage() {
  customText = shiftCollectionAfterPage(customText);
  saveCustomElement('text');
}

function shiftCollectionAfterPage(collection) {
  const newArr = [];
  if (!collection) { return newArr; }
  const kys = Object.keys(collection);
  for (const ky of kys) {
    const i = parseInt(ky, 10);
    if (Number.isNaN(i)) { continue; }
    if (i < currentPage) {
      newArr[i] = collection[i];
    } else if (i > currentPage) {
      newArr[i - 1] = collection[i];
    }
  }

  return newArr;
}

function getCustomElementId(ctId, type = 'text') {
  return `ce-${type}-${ctId}`;
}

function saveCustomElement(type = 'text') {
  try {
    saveCustomText && saveCustomText();
  } catch { /* no-op */ }
}

function migrateLegacyCheckmarks() {
  if (!customText) { return false; }
  let migrated = false;

  const pages = Object.keys(customText);
  for (const page of pages) {
    const entries = customText[page];
    if (!Array.isArray(entries)) { continue; }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) { continue; }
      if (entry.text === CHECKMARK_SYMBOL) {
        entries[i] = { ...entry, text: CHECKMARK_TOKEN };
        migrated = true;
      }
    }
  }

  if (migrated) {
    try { saveCustomText && saveCustomText(); } catch { }
  }

  return migrated;
}

function mergeLegacyCheckmarkCollection(legacyCheckmarks) {
  if (!legacyCheckmarks) { return false; }
  let merged = false;
  const pages = Object.keys(legacyCheckmarks);
  for (const page of pages) {
    const entries = legacyCheckmarks[page];
    if (!Array.isArray(entries)) { continue; }
    if (!customText[page]) { customText[page] = []; }
    for (const entry of entries) {
      if (!entry) { continue; }
      customText[page].push({ ...entry, text: CHECKMARK_TOKEN });
      merged = true;
    }
  }

  if (merged) {
    try { saveCustomText && saveCustomText(); } catch { }
  }

  return merged;
}

function getCustomElementType(entry) {
  return isCheckmarkText(entry?.text) ? 'checkmark' : 'text';
}