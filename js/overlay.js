// --------------------
// Track clicks on canvas
// --------------------
function initCanvasClicks() {
    canvas.addEventListener("click", (e) => {
        // Get click coordinates relative to the canvas
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;


        if (selectedCheckmark) {
            newCheckmark(x, y, currentPage);
            return;
        } else if (selectedColIndex === null) {
            log("ERROR: no checkmark or column selected");
            return;
        } else {
            newMarker(x, y, currentPage);
        }

    })
};


//
// Rendering elements
//
async function renderAll() {
    // If current page has any elements with spacing, render those elements on the page, not the overlay
    if (typeof currentPage !== 'number' || !locData) { log('No page/text to render.'); return; }

    if (pageHasNonZeroSpacing(currentPage)) {
        try {
            await renderPage(currentPage);
        } catch (e) {
            console.error(e);
            log('Issue with non-zero spacing columns on page.');
        }
    }

    if (!syncOverlayBoxToCanvas()) { log('no overlay or canvas'); return; }

    const overlay = document.getElementById('pdf-overlay');

    // Clear everything
    overlay.innerHTML = '';

    // Recreate markers for this page
    renderAllMarkers();

    // Render checkmarks
    renderAllCheckmarks();
}





function syncOverlayBoxToCanvas() {
    const overlay = document.getElementById('pdf-overlay');
    const canvas = document.getElementById('pdf-canvas');
    if (!overlay || !canvas) return false;

    overlay.style.width = canvas.width + 'px';
    overlay.style.height = canvas.height + 'px';
    overlay.style.left = '0px';
    overlay.style.top = '0px';
    overlay.style.position = 'absolute';
    overlay.style.zIndex = 10;
    overlay.style.pointerEvents = 'none'; // markers can re-enable selectively
    return true;
}


