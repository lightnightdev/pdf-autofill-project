let downloadModalInstance;
let downloadModalInitialized = false;
let downloadModalElements = null;

const downloadModalState = {
  token: null,
};

// ========================
// Modal open + auth check
// ========================
async function openQueryModal() {
  const modalEl = ensureDownloadModalSetup();
  if (!modalEl) {
    console.warn("Download modal element not found.");
    return;
  }

  resetDownloadModalState();
  downloadModalInstance.show();

  // ✅ Check saved token
  const existingToken = await verifyExistingToken();
  if (existingToken) {
    console.log("Authenticated via saved token.");
    downloadModalState.token = existingToken;
    switchToDownloadTable();
    await loadDownloadTableData();
  } else {
    console.log("No valid saved token — showing login form.");
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
    resetDownloadModalState();
    focusDownloadUsername();
  });

  downloadModalElements.tableBody?.addEventListener(
    "click",
    handleDownloadTableClick
  );

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
    downloadModalElements.usernameInput?.focus();
  }, 150);
}

function resetDownloadModalState() {
  if (!downloadModalElements) return;

  downloadModalState.token = null;
  downloadModalElements.form?.reset();
  downloadModalElements.errorMessage.textContent = "";
  setDownloadAuthLoading(false);

  updateDownloadTableStatus("");
  clearDownloadTable();

  downloadModalElements.loginSection.classList.remove("d-none");
  downloadModalElements.tableSection.classList.add("d-none");
  downloadModalElements.infoBanner?.classList.add("d-none");
}

function setDownloadAuthLoading(isLoading) {
  if (!downloadModalElements) return;

  downloadModalElements.submitBtn.disabled = isLoading;
  downloadModalElements.usernameInput.disabled = isLoading;
  downloadModalElements.passwordInput.disabled = isLoading;
  downloadModalElements.spinner.classList.toggle("d-none", !isLoading);
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

    switchToDownloadTable();
    await loadDownloadTableData();
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

  downloadModalElements.loginSection.classList.add("d-none");
  downloadModalElements.tableSection.classList.remove("d-none");
  downloadModalElements.infoBanner?.classList.remove("d-none");
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
    appendLoadCell(row, item);
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

function appendLoadCell(row, item) {
  const cell = document.createElement("td");
  cell.classList.add("text-center");

  const id =
    item?.id ?? item?.Id ?? item?.autofillId ?? item?.AutofillId ?? null;

  if (!id) {
    cell.textContent = "—";
    row.appendChild(cell);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-success btn-sm";
  button.textContent = "Load";
  button.dataset.loadId = String(id);

  const csvName = item.csvFileName ?? item.CsvFileName;
  if (csvName) {
    button.dataset.csvName = String(csvName);
  }

  const pdfName = item.pdfFileName ?? item.PdfFileName;
  if (pdfName) {
    button.dataset.pdfName = String(pdfName);
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

  const loadButton = event.target.closest("button[data-load-id]");
  if (loadButton && !loadButton.disabled) {
    event.preventDefault();
    await handleLoadButtonClick(loadButton);
    return;
  }

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
    await apiDeleteAutofill(id);
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

async function handleLoadButtonClick(button) {
  if (!button) return;

  const id = button.dataset.loadId;
  if (!id) return;

  const originalText = button.textContent;
  const csvNameFromButton = button.dataset.csvName || "";
  const label = button.dataset.pdfName || csvNameFromButton || `record ${id}`;

  try {
    button.disabled = true;
    button.textContent = "Loading…";
    updateDownloadTableStatus(`Loading ${label}…`);

    const [data, pdfResult] = await Promise.all([
      apiGetData(id),
      apiGetPdf(id),
    ]);

    if (!pdfResult || !pdfResult.ab) {
      throw new Error("PDF response did not include file data.");
    }

    const pdfFilename = pdfResult.filename || "download.pdf";
    const pdfBlob = new Blob([pdfResult.ab], { type: "application/pdf" });
    const pdfFile =
      typeof File === "function"
        ? new File([pdfBlob], pdfFilename, { type: "application/pdf" })
        : Object.assign(pdfBlob, { name: pdfFilename });

    await processPDF(pdfFile);

    const csvName =
      data?.csvFileName ?? data?.CsvFileName ?? csvNameFromButton ?? "";
    const markerPayload = data?.csvMarkerData ?? data?.CsvMarkerData ?? null;

    await applyDownloadedMarkerData(markerPayload, csvName);

    if (csvName) {
      if (typeof log === "function") {
        log(`Loaded CSV: ${csvName}`);
      }
      console.log("Loaded CSV:", csvName);
    }

    updateDownloadTableStatus("Load complete.");
  } catch (err) {
    console.error(err);
    const message = err?.message || "Failed to load selection.";
    updateDownloadTableStatus(message, true);
    if (typeof log === "function") {
      log(`Error loading selection: ${message}`);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function applyDownloadedMarkerData(markerJson, csvFileName) {
  if (!markerJson) {
    if (typeof log === "function") {
      log("No marker data provided by server.");
    }
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(markerJson);
  } catch (err) {
    throw new Error("Unable to parse marker data from server.");
  }

  let nextCustomText = {};
  let nextLocData = {};
  let nextCsvData = null;

  if (Array.isArray(parsed)) {
    [nextCustomText, nextLocData, nextCsvData] = parsed;
  } else if (parsed && typeof parsed === "object") {
    nextCustomText =
      parsed.customText ??
      parsed.CustomText ??
      parsed.markersCustomText ??
      parsed[0] ??
      {};
    nextLocData =
      parsed.locData ??
      parsed.LocData ??
      parsed.markers ??
      parsed[1] ??
      {};
    nextCsvData =
      parsed.csvData ??
      parsed.CsvData ??
      parsed.csv ??
      parsed[2] ??
      null;
  }

  if (!nextCustomText || typeof nextCustomText !== "object") {
    nextCustomText = {};
  }
  if (!nextLocData || typeof nextLocData !== "object") {
    nextLocData = {};
  }

  customText = nextCustomText;
  locData = nextLocData;

  if (typeof saveCustomText === "function") {
    await saveCustomText();
  }
  if (typeof saveLocData === "function") {
    await saveLocData();
  }

  let csvSaved = false;
  if (Array.isArray(nextCsvData) && nextCsvData.length) {
    csvData = nextCsvData;
    if (typeof saveCsvData === "function") {
      await saveCsvData(csvFileName || "server.csv");
      csvSaved = true;
    }
  }

  if (!csvSaved && Array.isArray(csvData)) {
    if (typeof displayCSVPreviewAsCards === "function") {
      displayCSVPreviewAsCards(csvData);
    }
  }

  if (typeof renderAll === "function") {
    await renderAll();
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
