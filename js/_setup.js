// Note: Alpine loads after DOM
document.addEventListener('alpine:initialized', () => {
    window.viewState = Alpine.store('viewState');
    Alpine.store('menuState').toggle(1);

    Promise.resolve().then(() => {
        loadCachedData();
    });
});