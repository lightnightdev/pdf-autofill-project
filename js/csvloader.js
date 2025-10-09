// csvloader.js">
// --------------------
// CSV Handling with headers
// --------------------

let csvData;


function initCsvFileListener() {
  document.getElementById("csv-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    log(`Selected CSV: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    Papa.parse(file, {
      complete: function (results) {
        let rawData = results.data; // 2D array, first row = headers
        if (!rawData || rawData.length === 0) return log("CSV is empty");
        if (!rawData || rawData.length === 1) return log("CSV is headers only");

        // Filter for emptry rows
        const data = rawData.filter(row =>
          row && row.some(cell => cell && cell.trim() !== "")
        );
        log(`CSV parsed, ${data.length - 1} data rows`);

        // Save to local environment
        csvData = data;
        if (locData) {
          locData = {};
          renderAll();
        };

        // Save to IndexedDB
        saveCsvData();
      },
      header: false, // we parse manually
    });
  });
}

function displayCSVPreviewAsCards(data) {
  const container = document.getElementById("csv-cards");
  container.innerHTML = ""; // clear previous

  if (!data || data.length === 0) return;

  const headers = data[0];
  const rowsToShow = Math.min(2, data.length - 1);

  headers.forEach((colName, colIdx) => {
    const card = document.createElement("div");
    card.id = 'card-col' + String(colIdx)
    card.className = 'card p-2 text-center';
    card.dataset.colIdx = colIdx;
    card.style.cursor = "pointer";

    // ✅ If locData has this column, mark it
    if (locData && locData[colIdx]) {
      card.classList.add("loc-data-exists");
    }

    // Build inner content: header + first 2 rows preview
    const headerDiv = document.createElement("div");
    headerDiv.className = "fw-bold mb-1 text-start";
    headerDiv.textContent = colName;
    card.appendChild(headerDiv);

    for (let i = 1; i <= rowsToShow; i++) {
      const cellDiv = document.createElement("div");
      cellDiv.textContent = data[i][colIdx] || "";
      cellDiv.className = "text-start";
      cellDiv.style.fontSize = "0.8rem"; // smaller preview
      card.appendChild(cellDiv);
    }

    // Handle click
    card.onclick = () => selectCard(parseInt(card.dataset.colIdx));

    container.appendChild(card);
  });
}

// // Display table with headers and first two data rows
// function displayCSVPreviewWithHeaders(data) {
//   const table = document.getElementById("csv-table");
//   table.innerHTML = ""; // clear previous

//   if (!data || data.length === 0) return;

//   const headers = data[0];
//   const rowsToShow = Math.min(2, data.length - 1); // first 2 data rows

//   // --- Header row ---
//   const trHead = document.createElement("tr");
//   headers.forEach((cell, colIdx) => {
//     const th = document.createElement("th");
//     th.textContent = cell;
//     th.style.cursor = "pointer"; // indicate selectable
//     th.onclick = () => selectColumn(colIdx);
//     trHead.appendChild(th);
//   });
//   table.appendChild(trHead);

//   // --- Data rows ---
//   for (let i = 1; i <= rowsToShow; i++) {
//     const tr = document.createElement("tr");
//     data[i].forEach((cell, colIdx) => {
//       const td = document.createElement("td");
//       td.textContent = cell;
//       td.style.cursor = "pointer"; // selectable
//       td.onclick = () => selectColumn(colIdx);
//       tr.appendChild(td);
//     });
//     table.appendChild(tr);
//   }
// }



// function selectColumn(colIdx) {
//   selectedColIndex = colIdx;
//   const table = document.getElementById("csv-table");

//   Array.from(table.rows).forEach(row => {
//     Array.from(row.cells).forEach((cell, i) => {
//       if (i === colIdx) {
//         cell.classList.add("selected");
//       } else {
//         cell.classList.remove("selected");
//       }
//     });
//   });
// }