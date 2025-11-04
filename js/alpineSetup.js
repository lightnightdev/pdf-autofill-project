let prevSpacing = 0;

document.addEventListener('alpine:init', () => {

  // ====================== LOC DATA STORE ======================
  Alpine.store('locData', {
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
    , saveToIDB() {
      saveLocData();
    }
    , colSel(colIdx) {
      const pgs = Object.values(this.pages);
      return pgs.some(page =>
        Object.values(page.csvColumns || {}).some(col => col.colIdx === colIdx)
      );

    }
    , delIdx(idx) {
      if (!confirm('Delete this marker?')) { return; }
      for (const [pageNum, page] of Object.entries(this.pages)) {
        let obj = null;
        if (page.customText && page.customText[idx]) {
          obj = page.customText[idx];
          delete page.customText[idx];
        } else if (page.savedText && page.savedText[idx]) {
          obj = page.savedText[idx];
          delete page.savedText[idx];
        } else if (page.csvColumns && page.csvColumns[idx]) {
          obj = page.csvColumns[idx];
          delete page.csvColumns[idx];
        }

        // Check spacing and trigger render
        if (obj && obj.spacing > 0) {
          queueUpdateRenderDoc(Number(pageNum));
        }
      }

    }
    , delCurrIdx() {
      prompt
      if (!Alpine.store('viewState').selectId) { return };
      const selId = Alpine.store('viewState').selectId;
      this.delIdx(selId);
    }
    , getSelected() {
      const selId = Alpine.store('viewState').selectId;
      let selObj;
      for (const [pageNum, page] of Object.entries(this.pages)) {
        if (page.customText && page.customText[selId]) { selObj = page.customText[selId] }
        else if (page.savedText && page.savedText[selId]) { selObj = page.savedText[selId] }
        else if (page.csvColumns && page.csvColumns[selId]) { selObj = page.csvColumns[selId] }
      }
      return selObj;
    }
    , moveSelected(x, y) {
      const selObj = this.getSelected()
      if (!selObj) { return; }
      selObj.x = Math.max(0, selObj.x + x);
      selObj.y = Math.max(0, selObj.y + y);
      if (selObj.spacing > 0) { queueUpdateRenderDoc() }
    }
    , adjustSelectedSpacing(adj) {
      const selObj = this.getSelected()
      if (!selObj) { return; }
      selObj.spacing = Math.max(0, selObj.spacing + adj);
    }
    , adjustSelectedSize(adj) {
      const selObj = this.getSelected()
      if (!selObj) { return; }
      selObj.size = Math.max(0, selObj.size + adj);
    }
    , cycleFont() {
      const selObj = this.getSelected()
      if (!selObj) { return; }
      if (selObj.font && selObj.font === "_symbol") { return }
      const fonts = ["_normal", "_monospace", "_signature"];
      const currentFontIndex = fonts.findIndex(f => f === selObj.font);
      if (currentFontIndex === -1) { selObj.font = "_normal"; return; }
      const nextIndex = (currentFontIndex + 1) % fonts.length;
      selObj.font = fonts[nextIndex];
    }
  });

  // ====================== VIEW STATE STORE ======================
  Alpine.store('viewState', {
    currentPage: 1,
    selectType: '',
    selectId: null,
    savedTextSelection: '__B_RoutingNumber',

    exportSingle: true,
    exportRasterize: false,

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
    , selectedItem() {
      const page = Alpine.store('locData').pages[this.currentPage];
      if (!page || !this.selectId) return null;

      return (
        page.customText[this.selectId] ||
        page.savedText[this.selectId] ||
        page.csvColumns[this.selectId] ||
        null
      );
    }
  });

  // ====================== FONT STATE STORE ======================
  Alpine.store('fontState', {
    selectedFont: '_normal',
    selectedSize: 12,
    selectedSpacing: 0,
    selX: 0,
    selY: 0,
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

  // ====================== PDF CANVAS STORE ======================

  Alpine.data('pdfCanvas', () => ({
    init() {
      this.$watch('$store.viewState.currentPage', (page) => {
        queueUpdateRenderDoc();
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
        "stageW": stageW,
        "stageH": stageH,
        "font": selFont,
        "size": selFontSize,
        "spacing": selSpacing,
      }

      verifyPage(pageNum);

      const newId = crypto.randomUUID();

      switch (selType) {
        case "checkmark":
          package.key = "__checkmark";
          package.text = resolveSavedTextValue("__checkmark")
          package.font = "_symbol"
          ld.pages[pageNum].savedText[newId] = package;
          break;
        case "savedText":
          const ky = vs.savedTextSelection
          package.key = ky
          package.text = resolveSavedTextValue(ky)
          ld.pages[pageNum].savedText[newId] = package;
          break;
        case "column":
          package.colIdx = vs.selectId;
          ld.pages[pageNum].csvColumns[newId] = package;
          break;
        case "customText":
          let customTxt = prompt("Enter custom text:")
          package.text = customTxt
          ld.pages[pageNum].customText[newId] = package;
          break;
      }

      Alpine.store('viewState').selectId = newId;
    }
  }));


});


document.addEventListener('alpine:initialized', () => {
  window.locData = Alpine.store('locData');
  window.viewState = Alpine.store('viewState');
  window.pdfState = Alpine.store('pdfState');
  window.fontState = Alpine.store('fontState');

  let prevFont = null;
  let prevSize = null;
  let prevSpacing = null;

  Alpine.effect(() => {
    const vs = Alpine.store('viewState');
    const fs = Alpine.store('fontState');
    const ld = Alpine.store('locData');

    if (!vs.selectId) return; // no selection
    const page = ld.pages[vs.currentPage];
    if (!page) return;

    const el =
      page.customText[vs.selectId] ||
      page.savedText[vs.selectId] ||
      page.csvColumns[vs.selectId];

    if (!el) return;

    // ----- Sync selected item → fontState -----
    if (
      fs.selectedFont !== el.font ||
      fs.selectedSize !== el.size ||
      fs.selectedSpacing !== el.spacing
    ) {
      fs.selectedFont = el.font || '_normal';
      fs.selectedSize = el.size || 12;
      fs.selectedSpacing = el.spacing || 0;
    }

    // ----- Sync fontState → selected item -----
    el.font = fs.selectedFont;
    el.size = fs.selectedSize;
    el.spacing = fs.selectedSpacing;

    // ----- Check if re-render is needed -----
    const spacingActive = el.spacing > 0;
    const fontChanged =
      el.font !== prevFont || el.size !== prevSize || el.spacing !== prevSpacing;

    if (spacingActive && fontChanged) {
      queueUpdateRenderDoc(vs.currentPage);
    }

    // update previous values
    prevFont = el.font;
    prevSize = el.size;
    prevSpacing = el.spacing;
  });
});
