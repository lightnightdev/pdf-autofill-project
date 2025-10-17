let modalInstance,
  modalInitialized = false,
  els = null;
let allDownloadItems = []; // stores the full unfiltered list

const modalState = {
  token: null,
  mode: 'download', // or "upload"
  pendingUpload: null,
};

const MODAL_TEXT = {
  download: {
    title: 'Download PDF / Markers',
    subtitle: 'Download or delete existing PDFs/markers.',
  },
  upload: {
    title: 'Upload PDF / Markers',
    subtitle:
      'Review and confirm your current PDF + marker bundle before sending.',
  },
};

// =========================================================
// ENTRY POINT
// =========================================================
async function openQueryModal(mode = 'download', uploadData = null) {
  const modalEl = ensureModalSetup();
  if (!modalEl) return;

  modalState.mode = mode;
  modalState.pendingUpload = mode === 'upload' ? uploadData : null;
  resetModal();
  applyModalMode(mode);
  modalInstance.show();

  const token = await verifyExistingToken();
  if (token) {
    modalState.token = token;
    if (mode === 'upload') await showUploadSection();
    else await showDownloadTable();
  } else {
    showLoginSection();
  }
}

// =========================================================
// SETUP
// =========================================================
function ensureModalSetup() {
  const modalEl = document.getElementById('downloadModal');
  if (!modalEl) {
    log('Error initializing modal');
    return null;
  }
  if (modalInitialized) return modalEl;

  els = {
    modalEl,
    // shared
    modalTitle: document.getElementById('download-modal-title'),
    modalSubtitle: document.getElementById('download-modal-subtitle'),
    loginSection: document.getElementById('download-login-section'),
    form: document.getElementById('download-auth-form'),
    username: document.getElementById('download-username'),
    password: document.getElementById('download-password'),
    submitBtn: document.getElementById('download-auth-submit'),
    spinner: document.getElementById('download-auth-spinner'),
    errorMsg: document.getElementById('download-auth-error'),
    logoutBtn: document.getElementById('download-logout-btn'),
    // download
    tableSection: document.getElementById('download-table-section'),
    tableBody: document.querySelector('#download-data-table tbody'),
    tableStatus: document.getElementById('download-table-status'),
    downloadFilterInput: document.getElementById('download-filter'),
    downloadFilterClear: document.getElementById('download-filter-clear'),

    // upload
    uploadSection: document.getElementById('download-upload-section'),
    uploadPdfName: document.getElementById('upload-pdf-name'),
    uploadPdfSize: document.getElementById('upload-pdf-size'),
    uploadFirstColumnHeaders: document.getElementById(
      'upload-first-column-headers'
    ),
    uploadLocDataPreview: document.getElementById('upload-locdata-preview'),
    uploadCustomTextPreview: document.getElementById(
      'upload-customtext-preview'
    ),
    uploadCarrierInput: document.getElementById('upload-carrier-name'),
    uploadNotesInput: document.getElementById('upload-notes'),
    uploadConfirmBtn: document.getElementById('upload-confirm-btn'),
    uploadSpinner: document.getElementById('upload-confirm-spinner'),
    uploadStatus: document.getElementById('upload-status'),
    uploadConfirmText: document.getElementById('upload-confirm-text'),
  };

  modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);

  els.form?.addEventListener('submit', handleAuthSubmit);
  els.logoutBtn?.addEventListener('click', handleLogout);
  els.uploadConfirmBtn?.addEventListener('click', handleUploadConfirm);
  els.tableBody?.addEventListener('click', handleTableClick);

  els.downloadFilterInput?.addEventListener('input', handleFilterInput);
  els.downloadFilterClear?.addEventListener('click', () => {
    els.downloadFilterInput.value = '';
    handleFilterInput();
  });

  modalEl.addEventListener('hidden.bs.modal', resetModal);
  modalInitialized = true;
  return modalEl;
}

// =========================================================
// MODE SWITCHERS
// =========================================================
function applyModalMode(mode) {
  setText(els.modalTitle, MODAL_TEXT[mode].title);
  setText(els.modalSubtitle, MODAL_TEXT[mode].subtitle);
}

function showLoginSection() {
  hideAllSections();
  els.loginSection.classList.remove('d-none');
  setTimeout(() => els.username?.focus(), 150);
}

async function showDownloadTable() {
  hideAllSections();
  els.tableSection.classList.remove('d-none');
  setText(els.tableStatus, 'Loading...');
  try {
    const list = await apiGetList();
    allDownloadItems = Array.isArray(list) ? list : [];
    renderDownloadTable(allDownloadItems);
    setText(els.tableStatus, '');
  } catch (e) {
    setText(els.tableStatus, e.message || 'Failed to load data');
  }
}

async function showUploadSection() {
  hideAllSections();
  els.uploadSection.classList.remove('d-none');
  els.uploadConfirmBtn.classList.remove('d-none');

  const data = modalState.pendingUpload || (await buildUploadSummaryData());
  modalState.pendingUpload = data;
  if (!data) return;

  setText(els.uploadPdfName, data.pdfName || '—');
  setText(els.uploadPdfSize, formatFileSize(data.pdfSizeBytes));
  els.uploadCarrierInput.value = data.carrierName || '';
  els.uploadNotesInput.value = data.notes || '';

  if (els.uploadFirstColumnHeaders) {
    const headers = Array.isArray(data.firstColumnHeaders)
      ? data.firstColumnHeaders
      : [];
    const headerStrings = headers.map((header, index) => {
      const value =
        typeof header === 'string' ? header.trim() : String(header ?? '');
      return value || `(Column ${index + 1})`;
    });
    els.uploadFirstColumnHeaders.textContent = headerStrings.length
      ? headerStrings.join(', ')
      : 'None';
  }

  renderJsonTable(els.uploadLocDataPreview, data.locData, 'Column');
  renderJsonTable(els.uploadCustomTextPreview, data.customText, 'Page');

  updateUploadStatus('', 'info');
  setUploadSubmitting(false);
}

function hideAllSections() {
  ['loginSection', 'tableSection', 'uploadSection'].forEach((k) =>
    els[k]?.classList.add('d-none')
  );
}

// =========================================================
// AUTH
// =========================================================
async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = els.username.value.trim();
  const password = els.password.value.trim();
  if (!username || !password) {
    els.errorMsg.textContent = 'Enter username and password.';
    return;
  }

  setAuthLoading(true);
  els.errorMsg.textContent = '';
  try {
    const res = await apiLogin(username, password);
    if (!res?.token) throw new Error('Missing token');
    modalState.token = res.token;
    localStorage.setItem('token', res.token);
    if (modalState.mode === 'upload') await showUploadSection();
    else await showDownloadTable();
  } catch (err) {
    els.errorMsg.textContent = err.message || 'Login failed.';
  } finally {
    setAuthLoading(false);
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  modalState.token = null;
  showLoginSection();
}

function setAuthLoading(loading) {
  [els.username, els.password, els.submitBtn].forEach(
    (el) => (el.disabled = loading)
  );
  toggle(els.spinner, !loading);
}

// =========================================================
// DOWNLOAD TABLE
// =========================================================
function renderDownloadTable(items) {
  els.tableBody.innerHTML = '';
  if (!items.length) {
    setText(els.tableStatus, 'No records found.');
    return;
  }

  const frag = document.createDocumentFragment();
  for (const item of items) {
    const tr = document.createElement('tr');
    const pdfSize = formatFileSize(item.pdfFileSize ?? item.PdfFileSize ?? 0);
    [item.carrierName, item.pdfFileName, pdfSize, item.csvFileName, item.notes]
      .map((v) => v ?? '—')
      .forEach((text) => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });

    const created =
      new Date(item.createdUtc || item.CreatedUtc || '').toLocaleString() ||
      '—';
    const tdCreated = document.createElement('td');
    tdCreated.textContent = created;
    tr.appendChild(tdCreated);

    const tdAction = document.createElement('td');
    tdAction.className = 'text-end'; // optional right-align

    // ✅ Add a flex wrapper
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group d-flex justify-content-end gap-2';

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-outline-danger btn-del-data btn-sm';
    btnDelete.textContent = 'Delete';
    btnDelete.dataset.id = item.id ?? item.Id;
    btnGroup.appendChild(btnDelete);

    // Load button
    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn btn-outline-primary btn-load-data btn-sm';
    btnLoad.textContent = 'Load';
    btnLoad.dataset.id = item.id ?? item.Id;
    btnGroup.appendChild(btnLoad);

    tdAction.appendChild(btnGroup);
    tr.appendChild(tdAction);

    frag.appendChild(tr);
  }
  els.tableBody.appendChild(frag);
}

function handleFilterInput() {
  const term = els.downloadFilterInput?.value?.trim().toLowerCase() || '';
  if (!term) {
    renderDownloadTable(allDownloadItems);
    return;
  }

  const filtered = allDownloadItems.filter((item) => {
    const carrier = item.carrierName ?? item.CarrierName ?? '';
    return carrier.toLowerCase().includes(term);
  });

  renderDownloadTable(filtered);
}

async function handleTableClick(e) {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const id = btn.dataset.id;
  const isDelete = btn.classList.contains('btn-del-data');
  const isLoad = btn.classList.contains('btn-load-data');

  // === DELETE ACTION ===

  if (isDelete) {
    if (!confirm(`Delete record ${id}?`)) return;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Deleting...';

    try {
      await apiDeleteAutofill_POST(id);
      await showDownloadTable();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // === LOAD ACTION ===
  else if (isLoad) {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Loading...';

    try {
      const pdfData = await apiGetPdf(id);
      if (!pdfData) throw new Error('No PDF returned.');
      const data = await apiGetData(id);
      if (!data) throw new Error('No data returned.');

      setText(els.tableStatus, `Loaded record ${id} successfully!`);

      await parseApiData(data);
      // this function handles uploading state data

      const pdfAB = pdfData?.pdfAB;
      const pdfFN = pdfData?.filename;

      
      await Promise.all([
        savePdfToIndexedDb(pdfAB, pdfFN),
        loadPDF(pdfAB),
      ]);

      pdfButton(true, pdfFN),
      
      setTimeout(() => {
        if (modalInstance) modalInstance.hide();
        window.location.reload();
      }, 2000);
    } catch (err) {
      alert('Failed to load: ' + err.message);
      btn.disabled = false;
    } finally {
      btn.textContent = originalText;
    }
  }
}

// =========================================================
// UPLOAD
// =========================================================
async function handleUploadConfirm() {
  const data = modalState.pendingUpload;
  if (!data) return;
  data.carrierName = els.uploadCarrierInput.value.trim();
  if (!data.carrierName || data.carrierName === '') {
    updateUploadStatus('Input a carrier name', 'error');
    els.uploadCarrierInput.focus();
    return;
  }
  data.notes = els.uploadNotesInput.value.trim();

  setUploadSubmitting(true);
  updateUploadStatus('Uploading...');

  try {
    const pdfFileName = data.pdfFileName || 'form.pdf';
    let pdfFile = data.pdfBlob;
    if (!(pdfFile instanceof File)) {
      pdfFile = new File([data.pdfBlob], pdfFileName, {
        type: 'application/pdf',
      });
    }

    const id = await apiCreateAutofill({
      carrierName: data.carrierName,
      csvFileName: data.csvName,
      csvMarkerData: data.csvMarkerData,
      notes: data.notes,
      pdfFile,
      pdfFileName,
    });

    els.uploadConfirmBtn.classList.remove('btn-primary');
    els.uploadConfirmBtn.classList.add('btn-success');
    updateUploadStatus(`Upload complete! ID: ${id}`, 'success');
    setTimeout(() => {
      if (modalInstance) modalInstance.hide();
      els.uploadConfirmBtn.classList.add('btn-primary');
      els.uploadConfirmBtn.classList.remove('btn-success');
    }, 2000);
  } catch (err) {
    updateUploadStatus(err.message || 'Upload failed', 'error');
  } finally {
    setUploadSubmitting(false);
    els.uploadConfirmBtn.disabled = true;
  }
}

// =========================================================
// HELPERS
// =========================================================
function updateUploadStatus(msg, variant = 'info') {
  const el = els.uploadStatus;
  el.textContent = msg;
  el.classList.remove('text-danger', 'text-success');
  if (variant === 'error') el.classList.add('text-danger');
  if (variant === 'success') el.classList.add('text-success');
}
function setUploadSubmitting(b) {
  els.uploadConfirmBtn.disabled = b;
  toggle(els.uploadSpinner, !b);
  setText(els.uploadConfirmText, b ? 'Uploading...' : 'Upload to Server');
}
function formatFileSize(b) {
  if (!b) return '0 KB';
  const u = ['B', 'KB', 'MB'];
  let i = 0;
  while (b > 1024 && i < u.length - 1) (b /= 1024), i++;
  return `${b.toFixed(1)} ${u[i]}`;
}
function resetModal() {
  hideAllSections();
  els.errorMsg.textContent = '';
  els.tableBody.innerHTML = '';
  setText(els.tableStatus, '');
  setAuthLoading(false);
  updateUploadStatus('');
  setUploadSubmitting(false);
}
function setText(el, text) {
  if (el) el.textContent = text;
}
function toggle(el, show) {
  if (el) el.classList.toggle('d-none', show);
}

async function verifyExistingToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const res = await apiTestAuth(); // ✅ use centralized function
    if (!res?.message?.includes('authorized')) return null;
    return token;
  } catch (err) {
    console.warn('Token verification failed:', err);
    return null;
  }
}
