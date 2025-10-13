const API_BASE = "https://www.lightnightdev.com/autofill/api";

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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error(`Login Failed: ${msg}`)
    throw new Error(`Login failed: ${msg}`);
  }

  const data = await res.json();
  localStorage.setItem("token", data.token);
  return data;
}

async function apiTestAuth() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/Auth/test`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Auth test failed: ${res.status}`);
  return await res.json(); // { message: "You are authorized!" }
}

async function apiGetList() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/Autofill/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`List fetch failed: ${res.status}`);
  return await res.json();
}

async function apiGetData(id) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/autofill/data/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to fetch data: ${res.status}`);
  return await res.json();
}

async function apiGetPdf(id) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/autofill/pdf/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = "download.pdf";

  if (contentDisposition && contentDisposition.includes("filename=")) {
    filename = contentDisposition
      .split("filename=")[1]
      .replace(/["']/g, "")
      .trim();
  }

  const ab = await res.arrayBuffer();
  return { filename, ab}
}

async function apiCreateAutofill({
  carrierName,
  csvFileName,
  csvMarkerData,
  notes,
  pdfFile,
}) {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("CarrierName", carrierName || "");
  form.append("CsvFileName", csvFileName || "");
  form.append("CsvMarkerData", csvMarkerData || "");
  form.append("Notes", notes || "");
  form.append("PdfFile", pdfFile);

  const res = await fetch(`${API_BASE}/autofill`, {
    method: "POST",
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

async function apiDeleteAutofill(id) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/autofill/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) throw new Error(`Record ${id} not found`);
  if (res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
  return true;
}
