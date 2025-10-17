const API_BASE = 'https://www.lightnightdev.com/autofill/api';

const API_ENDPOINTS = {
  login: `${API_BASE}/Auth/login`,
  test: `${API_BASE}/Auth/test`,
  getData: (id) => `${API_BASE}/autofill/data/${id}`,
  getPdf: (id) => `${API_BASE}/autofill/pdf/${id}`,
  create: `${API_BASE}/autofill`,
  delete: (id) => `${API_BASE}/autofill/${id}`,
  list: `${API_BASE}/autofill/list`,
};

async function apiLogin(username, password) {
  const res = await fetch(`${API_BASE}/Auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error(`Login Failed: ${msg}`);
    throw new Error(`Login failed: ${msg}`);
  }

  const data = await res.json();
  localStorage.setItem('token', data.token);
  return data;
}

async function apiTestAuth() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/Auth/test`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Auth test failed: ${res.status}`);
  return await res.json(); // { message: "You are authorized!" }
}

async function apiGetList() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/Autofill/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`List fetch failed: ${res.status}`);
  return await res.json();
}

async function apiGetData(id) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/autofill/data/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
  return await res.json();
}

async function apiGetPdf(id) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/autofill/pdf/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = 'download.pdf';

  if (contentDisposition && contentDisposition.includes('filename=')) {
    filename = contentDisposition
      .split('filename=')[1]
      .replace(/["']/g, '')
      .trim();
  }

  const ab = await res.arrayBuffer();
  return { filename: filename, pdfAB: ab };
}

async function apiCreateAutofill({
  carrierName,
  csvFileName,
  csvMarkerData,
  notes,
  pdfFile,
  pdfFileName,
}) {
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('CarrierName', carrierName || '');
  form.append('CsvFileName', csvFileName || '');
  form.append('CsvMarkerData', csvMarkerData || '');
  form.append('Notes', notes || '');
  if (!pdfFile) {
    throw new Error('PDF file is required for upload.');
  }

  if (pdfFile instanceof Blob) {
    const name = pdfFileName || pdfFile.name || 'upload.pdf';
    form.append('PdfFile', pdfFile, name);
  } else {
    form.append('PdfFile', pdfFile);
  }

  const res = await fetch(`${API_BASE}/autofill`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Create failed: ${msg}`);
  }

  const data = await res.json(); // { id: number }
  return data.id;
}

async function apiDeleteAutofill_POST(id) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/autofill/delete/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) throw new Error(`Record ${id} not found`);
  if (res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
  return true;
}

async function apiDeleteAutofill(id) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/autofill/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) throw new Error(`Record ${id} not found`);
  if (res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
  return true;
}

async function parseApiData(apiData) {
  if (!apiData || typeof apiData !== 'object') {
    throw new Error('Invalid API response');
  }

  const csvName = apiData.csvFileName ?? apiData.csvName ?? '_server.csv';

  let markerPayload = { locData: {}, customText: {} };
  const markerRaw = apiData.csvMarkerData ?? apiData.CsvMarkerData;
  if (markerRaw) {
    try {
      markerPayload =
        typeof markerRaw === 'string' ? JSON.parse(markerRaw) : markerRaw;
    } catch (err) {
      console.error('Unable to parse csvMarkerData:', err);
    }
  }

  locData =
    markerPayload.locData && typeof markerPayload.locData === 'object'
      ? markerPayload.locData
      : {};
  customText =
    markerPayload.customText && typeof markerPayload.customText === 'object'
      ? markerPayload.customText
      : {};

  await Promise.all([saveLocData(), saveCustomText()]);


  const headerRow = Array.isArray(markerPayload.firstColumnHeaders)
    ? markerPayload.firstColumnHeaders
    : Array.isArray(locData.firstColumnHeaders)
    ? locData.firstColumnHeaders // <-- should be this one
    : null;

  csvData[0] = headerRow;
  saveCsvData();
  
  displayCSVPreviewAsCards(csvData)
  renderCustomTextCards(currentPage);

  renderAll?.();
  
  downloadCsvTemplate(headerRow);
}

async function buildUploadSummaryData() {
  if (typeof idbGet !== 'function') {
    console.error('IndexedDB helpers are unavailable.');
    return null;
  }

  let pdfBlob;
  try {
    pdfBlob = await idbGet(PDF_KEY);
  } catch (err) {
    console.error('Unable to read PDF from IndexedDB:', err);
    pdfBlob = null;
  }

  if (!pdfBlob) {
    alert('Please select a PDF before sending data to the server.');
    return null;
  }

  let pdfName = '';
  if (typeof getPdfNameFromDb === 'function') {
    try {
      pdfName = (await getPdfNameFromDb()) || '';
    } catch (err) {
      console.warn('Unable to read PDF name:', err);
    }
  }

  const pdfFileName = pdfName || pdfBlob.name || 'form.pdf';

  let csvName = '';
  if (typeof getCsvNameFromDb === 'function') {
    try {
      csvName = (await getCsvNameFromDb()) || '';
    } catch (err) {
      console.warn('Unable to read CSV name:', err);
    }
  }

  const rawLocData =
    typeof locData !== 'undefined' && locData && typeof locData === 'object'
      ? locData
      : {};
  let locDataCopy;
  try {
    locDataCopy = JSON.parse(JSON.stringify(rawLocData));
  } catch (err) {
    console.warn('Unable to clone locData for upload:', err);
    locDataCopy = {};
  }
  if (
    !locDataCopy ||
    typeof locDataCopy !== 'object' ||
    Array.isArray(locDataCopy)
  ) {
    locDataCopy = {};
  }

  const rawCustomText =
    typeof customText !== 'undefined' &&
    customText &&
    typeof customText === 'object'
      ? customText
      : {};
  let customTextCopy;
  try {
    customTextCopy = JSON.parse(JSON.stringify(rawCustomText));
  } catch (err) {
    console.warn('Unable to clone customText for upload:', err);
    customTextCopy = Array.isArray(rawCustomText) ? [] : {};
  }

  const headerRow =
    Array.isArray(csvData) && csvData.length > 0 && Array.isArray(csvData[0])
      ? [...csvData[0]]
      : [];

  Object.keys(locDataCopy).forEach((key) => {
    const entry = locDataCopy[key];
    if (!entry || typeof entry !== 'object') return;
    const columnIndex = Number(key);
    if (Number.isFinite(columnIndex) && headerRow.length > columnIndex) {
      entry.header = headerRow[columnIndex] ?? '';
    }
  });

  const csvMarkerData = JSON.stringify(
    {
      customText: customTextCopy,
      locData: locDataCopy,
      firstColumnHeaders: headerRow,
    },
    null,
    2
  );

  const carrierName = ''; // Will be entered on Modal
  const notes = `Uploaded on ${new Date().toDateString()}`;

  return {
    pdfBlob,
    pdfName: pdfName || pdfBlob.name || 'form.pdf',
    pdfFileName,
    pdfSizeBytes: typeof pdfBlob.size === 'number' ? pdfBlob.size : 0,
    csvName,
    locData: locDataCopy,
    customText: customTextCopy,
    csvMarkerData,
    firstColumnHeaders: headerRow,
    carrierName,
    notes,
  };
}
