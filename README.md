# PDF Autofill Project

## Overview
The PDF Autofill Project is a browser-based tool for positioning CSV data onto a PDF template and exporting personalized, flattened documents in bulk. It is built entirely with client-side technologies (no server component required) using:

- [PDF.js](https://mozilla.github.io/pdf.js/) for on-screen PDF rendering
- [pdf-lib](https://pdf-lib.js.org/) plus Fontkit for editing and embedding fonts
- [Papa Parse](https://www.papaparse.com/) for CSV parsing
- [JSZip](https://stuk.github.io/jszip/) for bundling generated PDFs into a single ZIP download

All state (the PDF, CSV data, and placement coordinates) is cached in the browser via IndexedDB, so you can refresh the page or return later without losing your progress.

## Key Features
- **Interactive placement**: Click anywhere on the PDF canvas to bind a CSV column to that location. Each column is previewed as a card showing sample values.
- **Custom fonts & sizes**: Choose between monospace, standard, and signature-style fonts with adjustable point sizes when placing text.
- **Bulk export**: Generate one flattened PDF per CSV data row. Output files are zipped with sanitized filenames that include zero-padded row numbers.
- **Automatic PDF preparation**: Uploaded PDFs are flattened (or rasterized when modifications are restricted) and sanitized to remove forms, annotations, scripts, and other embedded content before export.
- **Persistent workspace**: The last-used PDF, CSV, and marker locations are automatically saved in IndexedDB and restored on load.

## Project Structure
```
/workspace/pdf-autofill-project
├── _main.html        # Entry point for the web app
├── css/
│   └── style.css     # Layout, colors, and PDF overlay styling
├── js/
│   ├── _startup.js   # IndexedDB initialization and state bootstrapping
│   ├── csvloader.js  # CSV upload, parsing, and preview card rendering
│   ├── db.js         # IndexedDB helpers for saving and retrieving assets
│   ├── log.js        # Simple logging utility for the sidebar console
│   ├── markers.js    # PDF click handling, marker rendering, and styling controls
│   ├── pdfexport.js  # PDF generation, font embedding, and ZIP download logic
│   ├── pdfloader.js  # PDF upload pipeline, flattening/rasterizing, and rendering
│   └── utils.js      # Utility helpers (Base64 font loading, etc.)
├── sample*.csv       # Example CSV files with headers and data rows
└── sample*.pdf       # Matching sample PDFs for testing
```

## Getting Started
1. **Serve the app** (recommended). Because the project reads local files and uses modules such as PDF.js, open the app via a local web server rather than `file://`.
   ```bash
   # From the project root
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000/_main.html` in your browser.

   > Tip: Any static server (Vite preview, `npm serve`, etc.) works—the code is pure client-side JavaScript.

2. **Load a base PDF** by selecting a file in the left sidebar. The app will flatten editable PDFs or rasterize locked ones before displaying the first page. Use the navigation buttons to change pages.

3. **Load CSV data** using the second file input. The CSV must include a header row followed by one or more data rows. Empty rows are automatically discarded. Each column appears as a selectable card in the right sidebar with a preview of the first two values.

4. **Place fields**:
   - Click a column card to select it, then adjust the font and size controls if needed.
   - Click on the PDF canvas where the column should appear. A marker is created and shown on the overlay.
   - Repeat for each column you want to map. Markers are page-aware, so navigate to other pages to place additional fields.

5. **Export**: After mapping your fields, click **Generate PDFs**. Confirm the prompt and the app will:
   - Copy the prepared base PDF for each data row.
   - Embed the selected fonts and draw text at the recorded coordinates (scaled to the PDF page size).
   - Sanitize the output PDF (remove annotations, JavaScript, etc.).
   - Bundle all generated PDFs into a timestamped ZIP archive and trigger a download.

6. **Clear placements**: Use **Clear All Markers** to delete placement data from both the current session and IndexedDB.

## CSV Requirements
- The **first row** must contain headers. Header names are used for marker labels when data is missing.
- Each **subsequent row** generates one output PDF.
- Empty rows are ignored. Cells that are blank in a data row render as empty strings in the exported PDFs.
- You can use the provided `sample*.csv` files for quick testing.

## Fonts
Three custom fonts are bundled with the project (monospace, standard, and signature style). Their binary data is loaded from Base64 strings in `js/utils.js` and embedded in exported PDFs via Fontkit. If embedding fails, the code falls back to built-in Helvetica/Courier fonts.

## Troubleshooting
- **Nothing happens when clicking the canvas**: Ensure a column card is selected first. The log sidebar will remind you if not.
- **Markers disappear after reload**: Check the browser console for IndexedDB errors. IndexedDB must be available for persistence.
- **PDF download size is large**: Locked PDFs are rasterized into images, which can produce larger files. Use editable PDFs when possible.
- **Fonts look wrong in the output**: Verify that Fontkit loads (network access required for the CDN scripts). If custom fonts fail to embed, the fallback fonts will be used.

## Development Notes
- The app uses plain ES5/ES6 scripts loaded directly in `_main.html`. No build step is required.
- Logging goes to the left sidebar and the browser console. Helper functions reside in `js/log.js`.
- The project intentionally avoids external dependencies beyond the CDN-hosted libraries noted above. You can self-host those libraries if offline access is required.

## License
This repository did not include a license file. Add one if you plan to distribute or open-source the project.
