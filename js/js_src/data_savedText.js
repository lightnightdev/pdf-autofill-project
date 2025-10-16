const CUSTOM_SYMBOLS = {
  // __Key: [Value, Label]
  __B_RoutingNumber: { textContent: '011275484', label: 'BSB Routing' },
  __B_Name: { textContent: 'Bangore Savings Bank', label: 'BSB Name' },
  __B_FullAddress: {
    textContent: '11 Hamlin Way, Bangor, ME 04401',
    label: 'BSB Full Address',
  },
  __B_Street: { textContent: '11 Hamlin Way', label: 'BSB Street' },
  __B_City: { textContent: 'Bangor', label: 'BSB City' },
  __B_State: { textContent: 'ME', label: 'BSB State' },
  __B_Zip: { textContent: '04401', label: 'BSB Zip' },
  __checkmark: { textContent: '\u2713', label: 'Checkmark' },
};

function resolveCustomTextValue(value) {
  if (value == null) return '';

  if (value === '__today') {
    const date = new Date();
    return date.toLocaleDateString('en-US');
  }

  // Safely return mapped text or the raw value if not found
  const entry = CUSTOM_SYMBOLS[value];
  return entry ? entry.textContent : value;
}

function savedTextCreate() {
  inputSelection = 'saved_text';
  selectCustomInputs(false, false, true);
}

function renderSavedCustomTextOptions() {
  const select = document.getElementById('saved-text-input');
  if (!select) return;

  select.innerHTML = Object.entries(CUSTOM_SYMBOLS)
    .map(
      ([key, data], i) =>
        `<option value="${key}"${i === 0 ? ' selected' : ''}>${
          data.label
        }</option>`
    )
    .join('');
}
