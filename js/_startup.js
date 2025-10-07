// _startup.js
// --------------------
// IndexedDB setup
// --------------------
const DB_NAME = "PDFCache";
const STORE_NAME = "files";
const PDF_KEY = "currentPDF"; // Only ever store one PDF
const CSV_KEY = "csvData";
const LOC_KEY = "locData";

let db;
let csvData;
let locData = {};

const request = indexedDB.open(DB_NAME, 1);
request.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore(STORE_NAME);
};
request.onsuccess = (e) => {
  db = e.target.result;
  loadCachedLocData();
  loadCachedPDF();
  loadCachedCSV();
};
request.onerror = (e) => log("IndexedDB error: " + e.target.error);



initFontSizeHandlers();

document.addEventListener('keydown', function (event) {
  if (selectedColIndex === null) {
    log("Choose a column");
    return;
  }

  let move = "";
  switch (event.key) {
    case 'ArrowUp': move = "y-"; break;
    case 'ArrowDown': move = "y+"; break;
    case 'ArrowLeft': move = "x-"; break;
    case 'ArrowRight': move = "x+"; break;
    default: return;
  }
  event.preventDefault();
  moveSpace(move);
});