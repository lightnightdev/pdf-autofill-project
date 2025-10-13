let downloadModalInstance;
let downloadModalInitialized = false;
let downloadModalElements = null;

const downloadModalState = {
  token: null,
  mode: "list",
  pendingUpload: null,
};

const DOWNLOAD_MODAL_COPY = {
  list: {
    title: "Download PDF / Markers",
    subtitle: "Authenticate to view the available PDF and marker exports.",
  },
  upload: {
    title: "Send PDF / Markers",
    subtitle: "Authenticate to send the current PDF and marker data to the server.",
  },
};

// ========================
// Modal open + auth check
// ========================
async function openQueryModal(options = {}) {
  const modalEl = ensureDownloadModalSetup();
  if (!modalEl) {
    console.warn("Download modal element not found.");
    return;
  }

  const { mode = "list", uploadData = null } = options;
  downloadModalState.mode = mode;
  if (mode === "upload") {
    downloadModalState.pendingUpload = uploadData ?? downloadModalState.pendingUpload;
    if (!downloadModalState.pendingUpload) {
      console.warn("Upload mode requested without pending data.");
    }
  } else {
    downloadModalState.pendingUpload = null;
  }

  resetDownloadModalState({ preserveMode: true, preservePending: true });
  applyModalMode(downloadModalState.mode);
  downloadModalInstance.show();

  // ✅ Check saved token
  const existingToken = await verifyExistingToken();
  if (existingToken) {
    console.log("Authenticated via saved token.");
    downloadModalState.token = existingToken;
    if (downloadModalState.mode === "upload") {
      await showUploadConfirmation();
    } else {
      switchToDownloadTable();
      await loadDownloadTableData();
    }
  } else {
    if (downloadModalState.mode === "upload") {
      console.log("Login required before uploading.");
    } else {
      console.log("No valid saved token — showing login form.");
    }
  }
}

// ========================
// Modal setup
// ========================
function ensureDownloadModalSetup() {
  const modalEl = document.getElementById("downloadModal");
  if (!modalEl) return null;

  if (downloadModalInitialized) return modalEl;

  downloadModalElements = {
    modalEl,
    form: document.getElementById("download-auth-form"),
    usernameInput: document.getElementById("download-username"),
    passwordInput: document.getElementById("download-password"),
    submitBtn: document.getElementById("download-auth-submit"),
    spinner: document.getElementById("download-auth-spinner"),
    errorMessage: document.getElementById("download-auth-error"),
    loginSection: document.getElementById("download-login-section"),
    tableSection: document.getElementById("download-table-section"),
    tableStatus: document.getElementById("download-table-status"),
    tableBody: document.querySelector("#download-data-table tbody"),
    logoutBtn: document.getElementById("download-logout-btn"),
    infoBanner: document.getElementById("download-table-info"),
    modalTitle: document.getElementById("download-modal-title"),
    modalSubtitle: document.getElementById("download-modal-subtitle"),
    uploadSection: document.getElementById("download-upload-section"),
    uploadPdfName: document.getElementById("upload-pdf-name"),
    uploadPdfSize: document.getElementById("upload-pdf-size"),
    uploadLocDataPreview: document.getElementById("upload-locdata-preview"),
    uploadCustomTextPreview: document.getElementById("upload-customtext-preview"),
    firstColumnHeaders: document.getElementById("upload-first-column-headers"),
    uploadConfirmBtn: document.getElementById("upload-confirm-btn"),
    uploadCancelBtn: document.getElementById("upload-cancel-btn"),
    uploadConfirmText: document.getElementById("upload-confirm-text"),
    uploadSpinner: document.getElementById("upload-confirm-spinner"),
    uploadStatus: document.getElementById("upload-status"),
  };

  downloadModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl, {
    backdrop: true,
    keyboard: true,
    focus: true,
  });

  downloadModalElements.form?.addEventListener(
    "submit",
    handleDownloadAuthSubmit
  );

  downloadModalElements.logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token"); // ✅ also clear saved login
    const preserve = downloadModalState.mode === "upload";
    resetDownloadModalState({ preserveMode: preserve, preservePending: preserve });
    focusDownloadUsername();
  });

  downloadModalElements.tableBody?.addEventListener(
    "click",
    handleDownloadTableClick
  );

  downloadModalElements.uploadConfirmBtn?.addEventListener(
    "click",
    handleUploadConfirm
  );

  downloadModalElements.uploadCancelBtn?.addEventListener("click", () => {
    downloadModalInstance?.hide();
  });

  modalEl.addEventListener("shown.bs.modal", () => {
    document.body.classList.add("download-modal-open");
    focusDownloadUsername();
  });

  modalEl.addEventListener("hidden.bs.modal", () => {
    document.body.classList.remove("download-modal-open");
    resetDownloadModalState();
  });

  downloadModalInitialized = true;
  return modalEl;
}

// ========================
// UI Helpers
// ========================
function focusDownloadUsername() {
  if (!downloadModalElements) return;
  setTimeout(() => {
    if (
      downloadModalElements.loginSection?.classList.contains("d-none")
    ) {
      return;
    }
    downloadModalElements.usernameInput?.focus();
  }, 150);
}

function applyModalMode(mode) {
  if (!downloadModalElements) return;
  const copy = DOWNLOAD_MODAL_COPY[mode] || DOWNLOAD_MODAL_COPY.list;

  if (downloadModalElements.modalTitle && copy?.title) {
    downloadModalElements.modalTitle.textContent = copy.title;
  }
  if (downloadModalElements.modalSubtitle && copy?.subtitle) {
    downloadModalElements.modalSubtitle.textContent = copy.subtitle;
  }
}

function clearUploadPreview() {
  if (!downloadModalElements) return;
  if (downloadModalElements.uploadPdfName) {
    downloadModalElements.uploadPdfName.textContent = "—";
  }
  if (downloadModalElements.uploadPdfSize) {
    downloadModalElements.uploadPdfSize.textContent = "—";
  }
  if (downloadModalElements.uploadLocDataPreview) {
    downloadModalElements.uploadLocDataPreview.textContent = "{}";
  }
  if (downloadModalElements.uploadCustomTextPreview) {
    downloadModalElements.uploadCustomTextPreview.textContent = "{}";
  }
  if (downloadModalElements.firstColumnHeaders) {
    downloadModalElements.firstColumnHeaders.textContent = "None";
  }
}

function setUploadSubmitting(isSubmitting) {
  if (!downloadModalElements) return;

  if (downloadModalElements.uploadConfirmBtn) {
    downloadModalElements.uploadConfirmBtn.disabled = !!isSubmitting;
  }
  if (downloadModalElements.uploadCancelBtn) {
    downloadModalElements.uploadCancelBtn.disabled = !!isSubmitting;
  }
  if (downloadModalElements.uploadSpinner) {
    downloadModalElements.uploadSpinner.classList.toggle("d-none", !isSubmitting);
  }

  if (downloadModalElements.uploadConfirmText) {
    downloadModalElements.uploadConfirmText.textContent = isSubmitting
      ? "Sending…"
      : "Send to Server";
  } else if (downloadModalElements.uploadConfirmBtn) {
    downloadModalElements.uploadConfirmBtn.textContent = isSubmitting
      ? "Sending…"
      : "Send to Server";
  }
}

function updateUploadStatus(message, variant = "info") {
  if (!downloadModalElements?.uploadStatus) return;

  const el = downloadModalElements.uploadStatus;
  el.textContent = message || "";
  el.classList.remove("text-danger", "text-success");

  if (!message) return;

  if (variant === "error") {
    el.classList.add("text-danger");
  } else if (variant === "success") {
    el.classList.add("text-success");
  }
}

function formatFileSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 bytes";

  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : size < 10 ? 2 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function resetDownloadModalState(options = {}) {
  if (!downloadModalElements) return;

  const { preserveMode = false, preservePending = false } = options;

  downloadModalState.token = null;
  if (!preserveMode) {
    downloadModalState.mode = "list";
  }
  if (!preservePending) {
    downloadModalState.pendingUpload = null;
  }

  downloadModalElements.form?.reset?.();
  if (downloadModalElements.errorMessage) {
    downloadModalElements.errorMessage.textContent = "";
  }
  setDownloadAuthLoading(false);

  updateDownloadTableStatus("");
  clearDownloadTable();

  downloadModalElements.loginSection?.classList.remove("d-none");
  downloadModalElements.tableSection?.classList.add("d-none");
  downloadModalElements.infoBanner?.classList.add("d-none");
  downloadModalElements.uploadSection?.classList.add("d-none");

  clearUploadPreview();
  setUploadSubmitting(false);
  updateUploadStatus("");

  applyModalMode(downloadModalState.mode);
}

function setDownloadAuthLoading(isLoading) {
  if (!downloadModalElements) return;

  if (downloadModalElements.submitBtn) {
    downloadModalElements.submitBtn.disabled = isLoading;
  }
  if (downloadModalElements.usernameInput) {
    downloadModalElements.usernameInput.disabled = isLoading;
  }
  if (downloadModalElements.passwordInput) {
    downloadModalElements.passwordInput.disabled = isLoading;
  }
  downloadModalElements.spinner?.classList.toggle("d-none", !isLoading);
}

// ========================
// Auth Handling
// ========================
async function handleDownloadAuthSubmit(event) {
  event.preventDefault();
  if (!downloadModalElements) return;

  const username = downloadModalElements.usernameInput.value.trim();
  const password = downloadModalElements.passwordInput.value.trim();

  if (!username || !password) {
    downloadModalElements.errorMessage.textContent =
      "Please enter both username and password.";
    return;
  }

  downloadModalElements.errorMessage.textContent = "";
  setDownloadAuthLoading(true);

  try {
    // ✅ Use centralized API function
    const loginData = await apiLogin(username, password);
    if (!loginData?.token) throw new Error("Token missing from response.");

    downloadModalState.token = loginData.token;

    if (downloadModalState.mode === "upload") {
      await showUploadConfirmation();
    } else {
      switchToDownloadTable();
      await loadDownloadTableData();
    }
  } catch (err) {
    console.error(err);
    downloadModalElements.errorMessage.textContent =
      err.message || "Login failed. Please try again.";
    downloadModalState.token = null;
  } finally {
    setDownloadAuthLoading(false);
  }
}

// ========================
// Table loading + rendering
// ========================
function switchToDownloadTable() {
  if (!downloadModalElements) return;

  downloadModalState.mode = "list";
  applyModalMode("list");
  downloadModalElements.loginSection.classList.add("d-none");
  downloadModalElements.tableSection.classList.remove("d-none");
  downloadModalElements.infoBanner?.classList.remove("d-none");
  downloadModalElements.uploadSection?.classList.add("d-none");
  updateDownloadTableStatus("Loading available downloads…");
  clearDownloadTable();
}

async function loadDownloadTableData() {
  if (!downloadModalElements) return;

  try {
    // ✅ Use centralized API function
    const listData = await apiGetList();
    renderDownloadTable(Array.isArray(listData) ? listData : []);
  } catch (err) {
    console.error(err);
    updateDownloadTableStatus(
      err.message || "Unable to load data.",
      true
    );
  }
}

function renderDownloadTable(items) {
  if (!downloadModalElements) return;

  clearDownloadTable();

  if (!items.length) {
    updateDownloadTableStatus("No PDF marker exports found.");
    return;
  }

  updateDownloadTableStatus("");

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const row = document.createElement("tr");

    appendTableCell(row, item.carrierName ?? item.CarrierName ?? "—");
    appendTableCell(row, item.pdfFileName ?? item.PdfFileName ?? "—");

    const pdfSizeBytes = item.pdfFileSize ?? item.PdfFileSize ?? 0;
    const pdfSizeKb = pdfSizeBytes ? (pdfSizeBytes / 1024).toFixed(1) : "0.0";
    appendTableCell(row, pdfSizeKb);

    appendTableCell(row, item.csvFileName ?? item.CsvFileName ?? "—");
    appendTableCell(row, item.notes ?? item.Notes ?? "—");

    const createdValue = item.createdUtc ?? item.CreatedUtc;
    const createdDate = createdValue
      ? new Date(createdValue).toLocaleString()
      : "—";
    appendTableCell(row, createdDate);

    appendActionCell(row, item);

    fragment.appendChild(row);
  });

  downloadModalElements.tableBody.appendChild(fragment);
}

function appendTableCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text ?? "—";
  row.appendChild(cell);
}

function appendActionCell(row, item) {
  const cell = document.createElement("td");
  cell.classList.add("text-end");

  const id =
    item?.id ?? item?.Id ?? item?.autofillId ?? item?.AutofillId ?? null;

  if (!id) {
    cell.textContent = "—";
    row.appendChild(cell);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-danger btn-sm";
  button.textContent = "Delete";
  button.dataset.deleteId = String(id);

  const label =
    item.pdfFileName ??
    item.PdfFileName ??
    item.csvFileName ??
    item.CsvFileName ??
    item.carrierName ??
    item.CarrierName;

  if (label) {
    button.dataset.deleteLabel = String(label);
  }

  cell.appendChild(button);
  row.appendChild(cell);
}

function clearDownloadTable() {
  if (!downloadModalElements) return;
  downloadModalElements.tableBody.innerHTML = "";
}

function updateDownloadTableStatus(message, isError = false) {
  if (!downloadModalElements) return;
  downloadModalElements.tableStatus.textContent = message || "";
  if (isError && message) {
    downloadModalElements.tableStatus.classList.add("text-danger");
  } else {
    downloadModalElements.tableStatus.classList.remove("text-danger");
  }
}

async function handleDownloadTableClick(event) {
  if (!downloadModalElements) return;

  const button = event.target.closest("button[data-delete-id]");
  if (!button || button.disabled) return;

  const id = button.dataset.deleteId;
  if (!id) return;

  const label = button.dataset.deleteLabel
    ? `"${button.dataset.deleteLabel}"`
    : `record ${id}`;

  const confirmed = window.confirm(
    `Are you sure you want to delete ${label}? This action cannot be undone.`
  );

  if (!confirmed) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Deleting…";

  try {
    updateDownloadTableStatus(`Deleting ${label}…`);
    await apiDeleteAutofill_POST(id);
    await loadDownloadTableData();
    const hadError = downloadModalElements.tableStatus.classList.contains(
      "text-danger"
    );
    if (!hadError) {
      updateDownloadTableStatus(`${label} deleted successfully.`);
    }
  } catch (err) {
    console.error(err);
    updateDownloadTableStatus(
      err.message || `Failed to delete ${label}.`,
      true
    );
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// ========================
// Upload confirmation flow
// ========================
async function showUploadConfirmation() {
  if (!downloadModalElements) return;

  if (!downloadModalState.pendingUpload) {
    const rebuilt = await buildUploadSummaryData();
    if (!rebuilt) {
      updateUploadStatus(
        "Unable to prepare the upload summary. Close the modal and try again.",
        "error"
      );
      return;
    }
    downloadModalState.pendingUpload = rebuilt;
  }

  const data = downloadModalState.pendingUpload;

  applyModalMode("upload");
  downloadModalElements.loginSection?.classList.add("d-none");
  downloadModalElements.tableSection?.classList.add("d-none");
  downloadModalElements.infoBanner?.classList.add("d-none");
  downloadModalElements.uploadSection?.classList.remove("d-none");

  if (downloadModalElements.uploadPdfName) {
    downloadModalElements.uploadPdfName.textContent = data.pdfName || "—";
  }
  if (downloadModalElements.uploadPdfSize) {
    downloadModalElements.uploadPdfSize.textContent = formatFileSize(
      data.pdfSizeBytes
    );
  }
  if (downloadModalElements.uploadLocDataPreview) {
    downloadModalElements.uploadLocDataPreview.textContent = JSON.stringify(
      data.locData ?? {},
      null,
      2
    );
  }
  if (downloadModalElements.uploadCustomTextPreview) {
    downloadModalElements.uploadCustomTextPreview.textContent = JSON.stringify(
      data.customText ?? {},
      null,
      2
    );
  }
  if (downloadModalElements.firstColumnHeaders) {
    const headers = Array.isArray(data.firstColumnHeaders)
      ? data.firstColumnHeaders
      : [];
    const headerStrings = headers.map((header, index) => {
      const value = typeof header === "string" ? header.trim() : String(header ?? "");
      return value || `(Column ${index + 1})`;
    });
    downloadModalElements.firstColumnHeaders.textContent = headerStrings.length
      ? headerStrings.join("\n")
      : "None";
  }

  updateUploadStatus("", "info");
  setUploadSubmitting(false);
}

async function buildUploadSummaryData() {
  if (typeof idbGet !== "function") {
    console.error("IndexedDB helpers are unavailable.");
    return null;
  }

  let pdfBlob;
  try {
    pdfBlob = await idbGet(PDF_KEY);
  } catch (err) {
    console.error("Unable to read PDF from IndexedDB:", err);
    pdfBlob = null;
  }

  if (!pdfBlob) {
    alert("Please select a PDF before sending data to the server.");
    return null;
  }

  let pdfName = "";
  if (typeof getPdfNameFromDb === "function") {
    try {
      pdfName = (await getPdfNameFromDb()) || "";
    } catch (err) {
      console.warn("Unable to read PDF name:", err);
    }
  }

  const pdfFileName = pdfName || pdfBlob.name || "form.pdf";

  let csvName = "";
  if (typeof getCsvNameFromDb === "function") {
    try {
      csvName = (await getCsvNameFromDb()) || "";
    } catch (err) {
      console.warn("Unable to read CSV name:", err);
    }
  }

  const rawLocData =
    typeof locData !== "undefined" && locData && typeof locData === "object"
      ? locData
      : {};
  let locDataCopy;
  try {
    locDataCopy = JSON.parse(JSON.stringify(rawLocData));
  } catch (err) {
    console.warn("Unable to clone locData for upload:", err);
    locDataCopy = {};
  }
  if (!locDataCopy || typeof locDataCopy !== "object" || Array.isArray(locDataCopy)) {
    locDataCopy = {};
  }

  const rawCustomText =
    typeof customText !== "undefined" && customText && typeof customText === "object"
      ? customText
      : {};
  let customTextCopy;
  try {
    customTextCopy = JSON.parse(JSON.stringify(rawCustomText));
  } catch (err) {
    console.warn("Unable to clone customText for upload:", err);
    customTextCopy = Array.isArray(rawCustomText) ? [] : {};
  }

  const headerRow =
    Array.isArray(csvData) && csvData.length > 0 && Array.isArray(csvData[0])
      ? [...csvData[0]]
      : [];

  Object.keys(locDataCopy).forEach((key) => {
    if (key === "firstColumnHeaders") return;
    const entry = locDataCopy[key];
    if (!entry || typeof entry !== "object") return;
    const columnIndex = Number(key);
    if (Number.isFinite(columnIndex) && headerRow.length > columnIndex) {
      entry.header = headerRow[columnIndex] ?? "";
    }
  });

  locDataCopy.firstColumnHeaders = headerRow;

  const csvMarkerData = JSON.stringify(
    {
      customText: customTextCopy,
      locData: locDataCopy,
    },
    null,
    2
  );

  const carrierName = deriveCarrierName(headerRow, pdfName || csvName || pdfFileName);
  const notes = `Uploaded via PDF-CSV Autofiller on ${new Date().toISOString()}`;

  return {
    pdfBlob,
    pdfName: pdfName || pdfBlob.name || "form.pdf",
    pdfFileName,
    pdfSizeBytes: typeof pdfBlob.size === "number" ? pdfBlob.size : 0,
    csvName,
    locData: locDataCopy,
    customText: customTextCopy,
    csvMarkerData,
    firstColumnHeaders: headerRow,
    carrierName,
    notes,
  };
}

function deriveCarrierName(headerRow, fallbackName = "") {
  if (Array.isArray(headerRow) && headerRow.length > 0) {
    const firstHeader = headerRow[0];
    if (typeof firstHeader === "string" && firstHeader.trim()) {
      return firstHeader.trim();
    }
  }

  if (typeof fallbackName === "string" && fallbackName) {
    return fallbackName.replace(/\.[^/.]+$/, "");
  }

  return "";
}

async function handleUploadConfirm() {
  if (!downloadModalElements) return;

  const data = downloadModalState.pendingUpload;
  if (!data) {
    updateUploadStatus(
      "No upload data available. Close the modal and try again.",
      "error"
    );
    return;
  }

  if (!downloadModalState.token) {
    updateUploadStatus("Please authenticate before sending the bundle.", "error");
    downloadModalElements.loginSection?.classList.remove("d-none");
    downloadModalElements.uploadSection?.classList.add("d-none");
    return;
  }

  if (!data.pdfBlob) {
    updateUploadStatus("Missing PDF data. Close the modal and try again.", "error");
    return;
  }

  setUploadSubmitting(true);
  updateUploadStatus("Sending bundle to server…");

  try {
    const pdfFileName = data.pdfFileName || data.pdfName || "form.pdf";
    let pdfFile = data.pdfBlob;

    if (!(pdfFile instanceof File) && typeof File === "function") {
      pdfFile = new File([data.pdfBlob], pdfFileName, {
        type: data.pdfBlob.type || "application/pdf",
      });
    }

    const createdId = await apiCreateAutofill({
      carrierName: data.carrierName || "",
      csvFileName: data.csvName || "",
      csvMarkerData: data.csvMarkerData || "",
      notes: data.notes || "",
      pdfFile,
      pdfFileName,
    });

    updateUploadStatus(`Upload complete! Record ID: ${createdId}.`, "success");
  } catch (err) {
    console.error(err);
    updateUploadStatus(err?.message || "Failed to upload bundle.", "error");
  } finally {
    setUploadSubmitting(false);
  }
}

async function handleSendToServerClick() {
  try {
    const uploadData = await buildUploadSummaryData();
    if (!uploadData) return;
    downloadModalState.pendingUpload = uploadData;
    await openQueryModal({ mode: "upload", uploadData });
  } catch (err) {
    console.error("Unable to open upload confirmation modal:", err);
    alert(err?.message || "Unable to open the upload confirmation modal.");
  }
}

// ========================
// Shared helper functions
// ========================
async function extractErrorText(response) {
  try {
    const data = await response.clone().json();
    if (data?.message) return data.message;
    if (typeof data === "string") return data;
  } catch (_) {}
  try {
    const text = await response.clone().text();
    return text;
  } catch (_) {
    return null;
  }
}

async function verifyExistingToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const res = await apiTestAuth(); // ✅ use centralized function
    if (!res?.message?.includes("authorized")) return null;
    return token;
  } catch (err) {
    console.warn("Token verification failed:", err);
    return null;
  }
}
