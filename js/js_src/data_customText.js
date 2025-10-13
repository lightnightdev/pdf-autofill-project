// const CHECKMARK = "\u2713" // unicode 2713 ✓
// ^moved to font_data

let inputSelection = null;
let selectedCustomTextId = null;

let customText = {};
// customText[pageNumber] = [{x: 25, y: 30, text: "hello", size: 24, spacing: 12, font: _monospace]
//

function checkmarkCreate() {
    inputSelection = "checkmark";
    selectedColIndex = null;
    selectedCustomTextId = null;
    deselectCheckmarkCustomText();
    selectMarkersAndCards(-1);
}

function customTextCreate() {
    inputSelection = "custom_text";
    selectCheckmarkCustomText(true, false);
    selectMarkersAndCards(-1);
}

function unselectCustomTextCreate() {
    inputSelection = null;
    selectCheckmarkCustomText(false, false);

    const elements = document.querySelectorAll('.select.ct-data-el');
    if (elements.length) {
        for (const el of elements) {
            el.classList.remove('select');
        }
    }

}

function selectCheckmarkCustomText(selectCheckmark, selectCustomText) {
    selectedColIndex = null;
    selectedCustomTextId = null;
    const cardC = document.getElementById('checkmark-card');
    const cardT = document.getElementById('custom-text-card');
    selectCheckmark ? cardC?.classList.add('select') : cardC?.classList.remove('select');
    selectCustomText ? cardT?.classList.add('select') : cardT?.classList.remove('select');
}

function newCustomText(page, x, y, text, size, font, spacing = 0) {
    const canvas = document.getElementById("pdf-canvas");
    if (!customText[page]) { customText[page] = [] }
    const ctData = {
        x: x,
        y: y,
        text: text,
        size: size,
        font: font,
        spacing: spacing,
        stageW: canvas.width || 1,
        stageH: canvas.height || 1,
    }
    let idx = customText[page].push(
        ctData
    )
    idx -= 1
    saveCustomText();
    renderCustomText(idx, ctData);
    selectCustomText(idx);
}

function updateCustomText(ctId) {
    saveCustomText();
    const el = document.getElementById(`ct-${ctId}`)
    if (el) { el.remove() }

    renderCustomText(ctId, customText[currentPage][ctId]);
}

function removeCustomText(page, ctId) {
    customText[page].splice(ctId, 1);
    const el = document.getElementById(`ct-${ctId}`)
    if (el) { el.remove(); }
    unselectCustomTextCreate();
    saveCustomText();
}

function renderAllCustomText() {
    if (!customText[currentPage]) { return }
    for (i = 0; i < customText[currentPage].length; i++) {
        renderCustomText(i, customText[currentPage][i]);
    }
}

function renderCustomText(ctId, data) {
    // add marker to page
    const overlay = document.getElementById('pdf-overlay');
    const el = document.createElement('div');
    el.id = `ct-${ctId}`;
    el.classList.add('custom-text')
    el.classList.add('ct-data-el');
    if (selectedCustomTextId == ctId) { el.classList.add('select') }
    el.dataset.ctId = String(ctId);
    el.addEventListener('click', () => selectCustomText(parseInt(ctId, 10)));
    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';

    applyDataToMarker(el, data);
    el.textContent = data.text
    overlay.appendChild(el);
}


function selectCustomText(ctId) {
    selectMarkersAndCards(-1);
    unselectCustomTextCreate()
    selectedCustomTextId = ctId;
    const el = document.getElementById(`ct-${ctId}`)
    el.classList.add('select');
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
}