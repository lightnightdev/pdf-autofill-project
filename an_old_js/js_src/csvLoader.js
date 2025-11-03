// csvloader.js">
// --------------------
// CSV Handling with headers
// --------------------

let csvData = [];

async function uploadCSV() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    log(`Selected CSV: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    Papa.parse(file, {
      complete: function (results) {
        let rawData = results.data; // 2D array, first row = headers
        if (!rawData || rawData.length === 0) return log('CSV is empty');
        if (!rawData || rawData.length === 1) return log('CSV is headers only');

        // Filter for emptry rows
        const data = rawData.filter(
          (row) => row && row.some((cell) => cell && cell.trim() !== '')
        );
        log(`CSV parsed, ${data.length - 1} data rows`);

        // Save to local environment
        csvData = data;
        csvButton(true, file.name);

        // Save to IndexedDB
        saveCsvData(file.name);
      },
      header: false, // we parse manually
    });
  };
  input.click();
}

function csvButton(isUpload, fileName = 'csv_file.csv') {
  const pdfBtn = document.getElementById('csv-input');
  if (isUpload) {
    pdfBtn.classList.remove('btn-outline-success');
    pdfBtn.classList.add('btn-success');
    pdfBtn.classList.add('file-loaded');
    pdfBtn.textContent = fileName;
  } else {
    pdfBtn.classList.add('btn-outline-success');
    pdfBtn.classList.remove('btn-success');
    pdfBtn.classList.remove('file-loaded');
    pdfBtn.textContent = 'Select CSV';
  }
}

function displayCSVPreviewAsCards(data) {
  const container = document.getElementById('csv-cards');
  container.innerHTML = ''; // clear previous

  if (!data || data.length === 0) return;

  const headers = data[0];
  const rowsToShow = Math.min(2, data.length - 1);

  headers.forEach((colName, colIdx) => {
    const card = document.createElement('div');
    card.id = 'card-col' + String(colIdx);
    card.className = 'card col-card p-2 text-center';
    card.dataset.colIdx = colIdx;
    card.style.cursor = 'pointer';

    // ✅ If locData has this column, mark it
    if (locData && locData[colIdx]) {
      card.classList.add('loc-data-exists');
    }

    const wrp = document.createElement('div');
    wrp.className = 'd-flex';

    // Header
    const textDiv = document.createElement('div');
    textDiv.className = 'col-8';
    const headerDiv = document.createElement('div');
    headerDiv.className = 'fw-bold mb-1 text-start';
    headerDiv.textContent = colName;
    textDiv.appendChild(headerDiv);

    // Preview Rows
    for (let i = 1; i <= rowsToShow; i++) {
      const cellDiv = document.createElement('div');
      cellDiv.textContent = data[i][colIdx] || '';
      cellDiv.className = 'text-start';
      cellDiv.style.fontSize = '0.8rem'; // smaller preview
      textDiv.appendChild(cellDiv);
    }
    wrp.appendChild(textDiv);

    // ✅ Add "Add to File Name" toggle mini-card
    const toggleDiv = document.createElement('div');
    toggleDiv.id = 'file-name-toggle-' + String(colIdx);
    toggleDiv.className = 'card file-name-toggle mt-2 text-align-center col-4';
    toggleDiv.textContent = 'Add to File Name';
    toggleDiv.onclick = (e) => {
      e.stopPropagation(); // prevent triggering main card click
      toggleDiv.classList.toggle('file-name-select');
    };
    wrp.appendChild(toggleDiv);
    card.appendChild(wrp);

    // Handle click
    card.onclick = () => selectCard(parseInt(card.dataset.colIdx));

    container.appendChild(card);
  });
}

// get selected headers
function getSelectedFileNameHeaders(csvData) {
  const selectedCards = document.querySelectorAll('.file-name-select');
  const selectedHeaders = [];
  selectedCards.forEach((div) => {
    const colIdx = parseInt(div.closest('.col-card').dataset.colIdx);
    selectedHeaders.push(colIdx);
  });
  return selectedHeaders;
}

function downloadCsvTemplate(headerRow) {
  if (!headerRow || headerRow.length === 0) { return; }

  const shouldDownload = confirm('Download CSV template for this form?');

  if (!shouldDownload) {
    return;
  }

  // Convert header row into a CSV string (UTF-8)
  const csvContent = headerRow.join(',') + '\n';

  // Create a UTF-8 BOM so Excel opens it correctly
  const bom = '\uFEFF'; // Byte Order Mark for UTF-8
  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8',
  });

  // Create temporary download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template.csv';
  document.body.appendChild(a);
  a.click();

  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
