document.addEventListener('alpine:init', () => {

  // ====================== LOC DATA STORE ======================
  Alpine.store('locData', {
    meta: {
      pdfName: '',
      totalPages: 0,
      lastModifiedUtc: ''
    },
    pages: {},
    clear() {
      this.meta = { pdfName: '', totalPages: 0, lastModifiedUtc: '' };
      this.pages = {
        1: {
          csvColumns: {},
          customText: {},
          savedText: {}
        }
      };
    }
  });

  // ====================== VIEW STATE STORE ======================
  Alpine.store('viewState', {
    currentPage: 1,
    currentRender: null,
    exportSingle: true,
    rasterize: false,
    selectedFont: '_normal',
    selectedSize: 12,
    selectedSpacing: 0,
    savedTextSelection: null,
    clear() {
      this.currentPage = 1;
      this.currentRender = null;
      this.exportSingle = true;
      this.rasterize = false;
      this.selectedFont = '_normal';
      this.selectedSize = 12;
      this.selectedSpacing = 0;
      this.savedTextSelection = null;
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
    csvData: null,
    csvFileName: null,
    fileNameCols: [],

    toggleFileNameCol(colIdx) {
      const i = this.fileNameCols.indexOf(colIdx);
      if (i >= 0) {
        this.fileNameCols.splice(i, 1);
      } else {
        this.fileNameCols.push(colIdx);
      }
    },
    clear() {
      this.csvData = null;
      this.csvFileName = null;
      this.fileNameCols = [];
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


  Alpine.data('pdfOverlay', () => ({
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

      const view = Alpine.store('viewState');
      const selection = view.savedTextSelection;
      const pageNum = view.currentPage;

      if (!selection) {
        log('No selection active');
        return;
      }

      const locStore = Alpine.store('locData');
      if (!locStore.pages[pageNum]) {
        locStore.pages[pageNum] = {};
      }

      if (selection === 'custom_text') {
        const text = prompt('Enter custom text')?.trim();
        if (!text) return;

        const id = crypto.randomUUID();
        locStore.pages[pageNum][id] = {
          type: 'customText',
          text,
          x,
          y,
          font: view.selectedFont,
          size: view.selectedSize,
          spacing: view.selectedSpacing,
          stageW,
          stageH
        };

        // Auto-select new element
        view.selectedElementId = id;
      }
    },

    selectElement(id) {
      Alpine.store('viewState').selectedElementId = id;
      log(`Selected element: ${id}`);
    }
  }));

});
