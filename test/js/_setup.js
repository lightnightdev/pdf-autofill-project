// Note: Alpine loads after DOM
document.addEventListener('alpine:initialized', () => {
    window.viewState = Alpine.store('viewState');
    Alpine.store('menuState').toggle(1);

    Promise.resolve().then(() => {
        loadCachedData();

    });
});


document.addEventListener('DOMContentLoaded', () => {
    renderSavedCustomTextOptions();
    quickEnableTooltips();

})

function quickEnableTooltips() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (el) {
        new bootstrap.Tooltip(el, {
            allowHtml: true,   // <-- important for HTML rendering
            placement: el.getAttribute('data-placement') || 'top'
        });
    });
}