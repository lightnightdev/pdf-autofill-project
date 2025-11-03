document.addEventListener('alpine:init', () => {
  initAlpineLocData();
  initAlpineViewState();
  initAlpinePdfState();
  initAlpineCsvState();
  initAlpineLogbox();
});

document.addEventListener('alpine:initialized', () => {
  window.locData = Alpine.store('locData');
  window.viewState = Alpine.store('viewState');
  window.pdfState = Alpine.store('pdfState');
  window.csvState = Alpine.store('csvState');
});