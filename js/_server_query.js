let downloadModalInstance;
let downloadModalInitialized = false;
let downloadModalElements = null;

const downloadModalState = {
  token: null,
};

const DOWNLOAD_API_ENDPOINTS = {
  login: 'api/auth/login',
  list: 'api/autofill/list',
};

function openQueryModal() {
  const modalEl = ensureDownloadModalSetup();
  if (!modalEl) {
    console.warn('Download modal element not found.');
    return;
  }

  resetDownloadModalState();
  downloadModalInstance.show();
}

function ensureDownloadModalSetup() {
  const modalEl = document.getElementById('downloadModal');
  if (!modalEl) {
    return null;
  }

  if (downloadModalInitialized) {
    return modalEl;
  }

  downloadModalElements = {
    modalEl,
    form: document.getElementById('download-auth-form'),
    usernameInput: document.getElementById('download-username'),
    passwordInput: document.getElementById('download-password'),
    submitBtn: document.getElementById('download-auth-submit'),
    spinner: document.getElementById('download-auth-spinner'),
    errorMessage: document.getElementById('download-auth-error'),
    loginSection: document.getElementById('download-login-section'),
    tableSection: document.getElementById('download-table-section'),
    tableStatus: document.getElementById('download-table-status'),
    tableBody: document.querySelector('#download-data-table tbody'),
    logoutBtn: document.getElementById('download-logout-btn'),
  };

  downloadModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl, {
    backdrop: true,
    keyboard: true,
    focus: true,
  });

  downloadModalElements.form?.addEventListener('submit', handleDownloadAuthSubmit);
  downloadModalElements.logoutBtn?.addEventListener('click', () => {
    resetDownloadModalState();
    focusDownloadUsername();
  });

  modalEl.addEventListener('shown.bs.modal', () => {
    document.body.classList.add('download-modal-open');
    focusDownloadUsername();
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    document.body.classList.remove('download-modal-open');
    resetDownloadModalState();
  });

  downloadModalInitialized = true;
  return modalEl;
}

function focusDownloadUsername() {
  if (!downloadModalElements) return;
  setTimeout(() => {
    downloadModalElements.usernameInput?.focus();
  }, 150);
}

function resetDownloadModalState() {
  if (!downloadModalElements) return;

  downloadModalState.token = null;
  downloadModalElements.form?.reset();
  downloadModalElements.errorMessage.textContent = '';
  setDownloadAuthLoading(false);

  downloadModalElements.tableStatus.textContent = '';
  downloadModalElements.tableStatus.classList.remove('text-danger');
  clearDownloadTable();

  downloadModalElements.loginSection.classList.remove('d-none');
  downloadModalElements.tableSection.classList.add('d-none');
}

function setDownloadAuthLoading(isLoading) {
  if (!downloadModalElements) return;

  downloadModalElements.submitBtn.disabled = isLoading;
  downloadModalElements.usernameInput.disabled = isLoading;
  downloadModalElements.passwordInput.disabled = isLoading;
  downloadModalElements.spinner.classList.toggle('d-none', !isLoading);
}

async function handleDownloadAuthSubmit(event) {
  event.preventDefault();
  if (!downloadModalElements) return;

  const username = downloadModalElements.usernameInput.value.trim();
  const password = downloadModalElements.passwordInput.value.trim();

  if (!username || !password) {
    downloadModalElements.errorMessage.textContent = 'Please enter both username and password.';
    return;
  }

  downloadModalElements.errorMessage.textContent = '';
  setDownloadAuthLoading(true);

  try {
    const loginResponse = await fetch(DOWNLOAD_API_ENDPOINTS.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      const errorText = await extractErrorText(loginResponse);
      throw new Error(errorText || 'Unable to authenticate.');
    }

    const loginData = await loginResponse.json();
    if (!loginData?.token) {
      throw new Error('Authentication token missing in response.');
    }

    downloadModalState.token = loginData.token;

    switchToDownloadTable();
    await loadDownloadTableData();
  } catch (err) {
    console.error(err);
    downloadModalElements.errorMessage.textContent = err.message || 'Login failed. Please try again.';
    downloadModalState.token = null;
  } finally {
    setDownloadAuthLoading(false);
  }
}

function switchToDownloadTable() {
  if (!downloadModalElements) return;

  downloadModalElements.loginSection.classList.add('d-none');
  downloadModalElements.tableSection.classList.remove('d-none');
  downloadModalElements.tableStatus.textContent = 'Loading available downloads…';
  downloadModalElements.tableStatus.classList.remove('text-danger');
  clearDownloadTable();
}

async function loadDownloadTableData() {
  if (!downloadModalElements || !downloadModalState.token) return;

  try {
    const listResponse = await fetch(DOWNLOAD_API_ENDPOINTS.list, {
      headers: {
        Authorization: `Bearer ${downloadModalState.token}`,
      },
    });

    if (!listResponse.ok) {
      const errorText = await extractErrorText(listResponse);
      throw new Error(errorText || 'Failed to retrieve PDF list.');
    }

    const listData = await listResponse.json();
    renderDownloadTable(Array.isArray(listData) ? listData : []);
  } catch (err) {
    console.error(err);
    downloadModalElements.tableStatus.classList.add('text-danger');
    downloadModalElements.tableStatus.textContent = err.message || 'Unable to load data.';
  }
}

function renderDownloadTable(items) {
  if (!downloadModalElements) return;

  clearDownloadTable();

  if (!items.length) {
    downloadModalElements.tableStatus.textContent = 'No PDF marker exports found.';
    return;
  }

  downloadModalElements.tableStatus.textContent = '';

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const row = document.createElement('tr');

    appendTableCell(row, item.carrierName ?? item.CarrierName ?? '—');
    appendTableCell(row, item.pdfFileName ?? item.PdfFileName ?? '—');

    const pdfSizeBytes = item.pdfFileSize ?? item.PdfFileSize ?? 0;
    const pdfSizeKb = pdfSizeBytes ? (pdfSizeBytes / 1024).toFixed(1) : '0.0';
    appendTableCell(row, pdfSizeKb);

    appendTableCell(row, item.csvFileName ?? item.CsvFileName ?? '—');
    appendTableCell(row, item.notes ?? item.Notes ?? '—');

    const createdValue = item.createdUtc ?? item.CreatedUtc;
    const createdDate = createdValue ? new Date(createdValue).toLocaleString() : '—';
    appendTableCell(row, createdDate);

    fragment.appendChild(row);
  });

  downloadModalElements.tableBody.appendChild(fragment);
}

function appendTableCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text ?? '—';
  row.appendChild(cell);
}

function clearDownloadTable() {
  if (!downloadModalElements) return;
  downloadModalElements.tableBody.innerHTML = '';
}

async function extractErrorText(response) {
  try {
    const data = await response.clone().json();
    if (data?.message) return data.message;
    if (typeof data === 'string') return data;
  } catch (err) {
    // ignore json parse errors
  }

  try {
    const text = await response.clone().text();
    return text;
  } catch (err) {
    return null;
  }
}
