function initAlpineLocData() {
  Alpine.store('locData', {
    columnLoc: [],
    customTextLoc: [],
    storedTextLoc: [],
    
    clearAll() {
      this.columnLoc = [];
      this.customTextLoc = [];
      this.storedTextLoc = [];
    },
  });
}

function initAlpineViewState() {
  Alpine.store('viewState', {
    currentSelected: null,
    currentPage: null,
    currentRender: null,
  });
}

function initAlpinePdfState() {
  Alpine.store('pdfState', {
    currentPdfBytes: null,
    pdfPages: null,
    pdfFileName: null,
  });
}

function initAlpineCsvState() {
  Alpine.store('csvState', {
    csvData: null,
    csvFileName: null,
  });
}

function initAlpineLogbox() {
  Alpine.data('logbox', {
    output: '',
    status: 'ok',
  });
}
