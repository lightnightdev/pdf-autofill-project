function renderJsonTable(containerEl, jsonObj, labelType = "Item") {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  // --- Collect valid keys (numbers only) ---
  const keys = Object.keys(jsonObj || {})
    .map(k => Number(k))
    .filter(k => Number.isFinite(k))
    .sort((a, b) => a - b);

  if (keys.length === 0) {
    containerEl.textContent = `No ${labelType.toLowerCase()} data available.`;
    return;
  }

  // --- State ---
  let currentIndex = 0;

  // --- Header with navigation ---
  const headerDiv = document.createElement("div");
  headerDiv.className =
    "d-flex justify-content-between align-items-center mb-2";

  const titleSpan = document.createElement("h6");
  titleSpan.className = "mb-0";
  headerDiv.appendChild(titleSpan);

  const navDiv = document.createElement("div");
  navDiv.className = "d-flex align-items-center gap-2";

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn btn-sm btn-outline-secondary";
  prevBtn.textContent = "← Prev";

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-sm btn-outline-secondary";
  nextBtn.textContent = "Next →";

  navDiv.appendChild(prevBtn);
  navDiv.appendChild(nextBtn);
  headerDiv.appendChild(navDiv);

  containerEl.appendChild(headerDiv);

  const tableContainer = document.createElement("div");
  containerEl.appendChild(tableContainer);

  // --- Render one entry ---
  function renderTableAt(index) {
    tableContainer.innerHTML = "";

    const key = keys[index];
    const entry = jsonObj[key];
    titleSpan.textContent = `${labelType} ${key}`;

    if (!entry || typeof entry !== "object") {
      tableContainer.textContent = "No data for this entry.";
      return;
    }

    const rows = Object.entries(entry).map(([k, v]) => ({
      key: k,
      value: typeof v === "object" ? JSON.stringify(v) : v
    }));

    const table = document.createElement("table");
    table.className =
      "table table-sm table-bordered table-striped table-hover mb-0";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    ["Key", "Value"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach(({ key, value }) => {
      const tr = document.createElement("tr");
      const tdKey = document.createElement("td");
      tdKey.textContent = key;
      const tdVal = document.createElement("td");
      tdVal.textContent = value;
      tr.append(tdKey, tdVal);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // Update button states
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === keys.length - 1;
  }

  // --- Button handlers (skip missing indexes automatically) ---
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderTableAt(currentIndex);
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < keys.length - 1) {
      currentIndex++;
      renderTableAt(currentIndex);
    }
  });

  // --- Initial render ---
  renderTableAt(currentIndex);
}
