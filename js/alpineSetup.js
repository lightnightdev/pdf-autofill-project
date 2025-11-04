document.addEventListener('alpine:init', () => {

  // ====================== LOC DATA STORE ======================
  Alpine.store('locData', {
    meta: {
      pdfName: '',
      totalPages: 0,
      lastModifiedUtc: ''
    },
    pages: {
      1: {
        csvColumns: {},
        customText: {},
        savedText: {},
      }
    },
    clear() {
      this.meta = { pdfName: '', totalPages: 0, lastModifiedUtc: '' };
      this.pages = {
        1: {
          csvColumns: {},
          customText: {},
          savedText: {},
        }
      };
    }
    , resolveSavedText(value) {
      if (value == null) return '';

      if (value === '__today') {
        const date = new Date();
        return date.toLocaleDateString('en-US');
      }

      // Safely return mapped text or the raw value if not found
      const entry = CUSTOM_SYMBOLS[value];
      return entry ? entry.textContent : value;
    }
  });

  // ====================== VIEW STATE STORE ======================
  Alpine.store('viewState', {
    currentPage: 1,
    selectType: '',
    selectId: null,
    savedTextSelection: '',

    exportSingle: true,
    exportRasterize: false,
    selectedFont: '_normal',
    selectedSize: 12,
    selectedSpacing: 0,
    clear() {
      this.currentPage = 1;
      this.selectType = '';
      this.selectedId = null;
      this.savedTextSelection = '';

      this.exportSingle = true;
      this.exportRasterize = false;

      this.selectedFont = '_normal';
      this.selectedSize = 12;
      this.selectedSpacing = 0;
    }
  });

  // ====================== LOGBOX STORE ======================
  Alpine.store('logbox', {
    output: '',
    status: 'ok',
    setError(msg) {
      this.output += `! ${msg}\n`;
      this.status = 'error';
    },
    clear() {
      this.output = '';
      this.status = 'ok';
    }
  });

  // ====================== PDF STATE STORE ======================
  Alpine.store('pdfState', {
    pdfBytes: null,
    pdfPages: 0,
    pdfName: null,
    clear() {
      this.pdfBytes = null;
      this.pdfPages = 0;
      this.pdfName = null;
    }
  });

  // ====================== CSV STATE STORE ======================
  Alpine.store('csvState', {
    csvData: [],
    csvName: '',       // keep consistent name
    fileNameCols: new Set(),

    toggleFileNameCol(colIdx) {
      if (this.fileNameCols.has(colIdx)) {
        this.fileNameCols.delete(colIdx);
      } else {
        this.fileNameCols.add(colIdx);
      }
    },

    getSampleRow(colIdx) {
      const firstRowData = this.csvData[1][colIdx]
      if (firstRowData === null || firstRowData === "") {
        return `(${this.csvData[0][colIdx]})`
      }
      return firstRowData;
    },

    clear() {
      this.csvData = [];
      this.csvName = '';
      this.fileNameCols = new Set();
    }
  });


  // ====================== MENU STATE STORE ======================
  Alpine.store('menuState', {
    openMenus: {},
    open(id) {
      this.openMenus[id] = true;

    },
    toggle(id) {
      this.openMenus[id] = !this.openMenus[id];
    },
    isOpen(id) {
      return !!this.openMenus[id];
    },
    clear() {
      this.openMenus = {};
    }
  });


  Alpine.data('pdfCanvas', () => ({
    init() {
      this.$watch('$store.viewState.currentPage', (page) => {
        renderPage(page);
      })
    },
    handleCanvasClick(e) {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const stageW = canvas.width;
      const stageH = canvas.height;

      const ld = Alpine.store('locData');
      const vs = Alpine.store('viewState');
      const selType = vs.selectType;
      const selFont = vs.selectedFont;
      const selFontSize = vs.selectedSize;
      const selSpacing = vs.selectedSpacing;
      const pageNum = vs.currentPage;

      let package = {
        "x": x,
        "y": y,
        "font": selFont,
        "size": selFontSize,
        "spacing": selSpacing,
      }

      verifyPage(pageNum);

      switch (selType) {
        case "checkmark":
          package.key = "__checkmark";
          package.font = "_symbol"
          ld.pages[pageNum].savedText[crypto.randomUUID()] = package;
          break;
        case "savedText":
          package.key = vs.savedTextSelection
          ld.pages[pageNum].savedText[crypto.randomUUID()] = package;
          break;
        case "column":
          package.colIdx = vs.selectId;
          ld.pages[pageNum].csvColumns[crypto.randomUUID()] = package;
          break;
        case "customText":
          let customTxt = prompt("Enter custom text:")
          package.text = customTxt
          ld.pages[pageNum].customText[crypto.randomUUID()] = package;
          break;
      }
    }
  }));
});


function verifyPage(pageNum) {
  if (!Alpine.store('locData').pages[pageNum]) {
    Alpine.store('locData').pages[pageNum] = {
      csvColumns: [],
      customText: [],
      savedText: [],
    };
  }
}