
//<svg xmlns="http://www.w3.org/2000/svg" id="mdi-check" viewBox="0 0 24 24"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" /></svg>

let checkmarks = [];
let selectedCheckmark = false;
const checkSvgPath = 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z';
let selectedCheckmarkId = null;

function ensureCheckmarkArray() {
    if (!Array.isArray(checkmarks)) {
        checkmarks = [];
    }
}

function getCheckmarksForPage(pageNum, create = false) {
    ensureCheckmarkArray();
    const pageIndex = Number(pageNum);
    if (!Number.isFinite(pageIndex) || pageIndex < 0) {
        return [];
    }
    if (!Array.isArray(checkmarks[pageIndex])) {
        if (create) {
            checkmarks[pageIndex] = [];
        } else {
            return [];
        }
    }
    return checkmarks[pageIndex];
}

function createCheckmarkId(pageNum, index) {
    return `${pageNum}:${index}`;
}

function parseCheckmarkId(chkId) {
    if (chkId == null) return null;
    const [pageStr, idxStr] = String(chkId).split(':');
    const page = Number(pageStr);
    const index = Number(idxStr);
    if (!Number.isFinite(page) || !Number.isFinite(index)) {
        return null;
    }
    return { page, index };
}

function getCheckmarkById(chkId) {
    const parsed = parseCheckmarkId(chkId);
    if (!parsed) return null;
    const pageArr = checkmarks?.[parsed.page];
    if (!Array.isArray(pageArr)) return null;
    return pageArr[parsed.index] || null;
}

function hasAnyCheckmarks() {
    return Array.isArray(checkmarks) && checkmarks.some((page) => Array.isArray(page) && page.length > 0);
}

function getAllCheckmarks() {
    const results = [];
    if (!Array.isArray(checkmarks)) return results;
    for (let page = 0; page < checkmarks.length; page++) {
        const pageArr = checkmarks[page];
        if (!Array.isArray(pageArr)) continue;
        pageArr.forEach((chk) => {
            if (chk) {
                results.push(chk);
            }
        });
    }
    return results;
}

function forEachCheckmark(callback) {
    if (!Array.isArray(checkmarks)) return;
    for (let page = 0; page < checkmarks.length; page++) {
        const pageArr = checkmarks[page];
        if (!Array.isArray(pageArr)) continue;
        pageArr.forEach((chk, idx) => {
            if (!chk) return;
            callback(chk, idx, page);
        });
    }
}



function newCheckmark(x, y, page) {

    const canvasEl = document.getElementById('pdf-canvas');
    const stageW = canvasEl?.width || 1;
    const stageH = canvasEl?.height || 1;

    const chk = {
        x: x,
        y: y,
        page: page,
        scale: 1,
        stageW: stageW,
        stageH: stageH,
    }
    const pageArr = getCheckmarksForPage(page, true);
    const idx = pageArr.push(chk) - 1;
    const chkId = createCheckmarkId(page, idx);
    selectedCheckmarkId = chkId;
    saveCheckmarks();
    renderCheckmark(chkId);
}

function clearAllCheckmarks() {
    checkmarks = [];
    selectedCheckmarkId = null;
    saveCheckmarks();
    renderAllCheckmarks();
}

function renderAllCheckmarks() {
    const chkmks = document.querySelectorAll('.checkmark');
    chkmks.forEach(element => {
        element.remove();
    });
    const pageArr = getCheckmarksForPage(currentPage);
    pageArr.forEach((chk, idx) => {
        if (chk) {
            const chkId = createCheckmarkId(currentPage, idx);
            renderCheckmark(chkId);
        }
    });
    if (selectedCheckmarkId) {
        const parsed = parseCheckmarkId(selectedCheckmarkId);
        if (parsed && parsed.page === currentPage) {
            selectCheckmark(selectedCheckmarkId);
        }
    }
}

function deleteCheckmark(chkId) {
    console.log('deleting: ' + String(chkId));
    const parsed = parseCheckmarkId(chkId);
    if (!parsed) return;
    const pageArr = getCheckmarksForPage(parsed.page);
    if (!Array.isArray(pageArr)) return;
    pageArr.splice(parsed.index, 1);
    if (pageArr.length === 0) {
        checkmarks[parsed.page] = [];
    }
    if (selectedCheckmarkId === chkId) {
        selectedCheckmarkId = null;
    }
    saveCheckmarks();
    renderAllCheckmarks();
}

function updateCheckmark(chkId) {
    const chk = document.getElementById('chk-' + String(chkId));
    if (chk) {
        chk.remove()
        renderCheckmark(chkId);
    }
}

function unselectCheckmark() {
    const cmCard = document.getElementById('checkmark-card');
    cmCard.classList.remove('select');
    selectedCheckmark = false;
}

function checkmarkCreate() {

    if (selectedCheckmark) {
        unselectCheckmark();
        return;
    }
    const cmCard = document.getElementById('checkmark-card');

    selectedColIndex = null;
    selectedCheckmark = true;
    cmCard.classList.add('select');
    selectMarkersAndCards(-1);
}

function selectCheckmark(chkId) {
    console.log('selecting: ' + String(chkId));
    const overlay = document.getElementById('pdf-overlay');
    addSelectClassChkId(overlay, chkId);
    selectedCheckmarkId = chkId;
}

function addSelectClassChkId(parentContainer, datasetChkId) {
    Array.from(parentContainer.children).forEach((card) => {
        if (card.dataset.chkId === String(datasetChkId)) {
            card.classList.add("select");
        } else {
            card.classList.remove("select");
        }
    });
}

async function renderCheckmark(chkId) {
    const chk = getCheckmarkById(chkId);
    if (!chk) return;

    const overlay = document.getElementById('pdf-overlay');

    const dv = document.createElement('div');
    dv.dataset.chkId = String(chkId);
    dv.className = "checkmark";
    dv.style.position = 'absolute';
    dv.style.left = (chk.x || 0) + 'px';
    dv.style.top = (chk.y || 0) + 'px';
    dv.style.width = `${24 * (chk.scale || 1)}px`;
    dv.style.height = `${24 * (chk.scale || 1)}px`;
    dv.style.transform = 'translate(-0%, -100%)'
    dv.id = `chk-${chkId}`;
    dv.addEventListener('click', () => selectCheckmark(chkId));
    dv.style.pointerEvents = 'auto';

    // Use createElementNS for SVG elements
    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    svgEl.setAttribute("viewBox", "0 0 24 24");
    svgEl.style.color = '#002000'
    svgEl.style.fill = 'currentColor'

    // Also use createElementNS for the path
    const pth = document.createElementNS("http://www.w3.org/2000/svg", 'path');
    pth.setAttribute("d", checkSvgPath);

    svgEl.appendChild(pth);
    dv.appendChild(svgEl);

    overlay.appendChild(dv);

}


function drawCheckmarks(pdfDoc, checkmarksList, canvasWidth, canvasHeight) {
    // Get pages
    const pdfDocPages = pdfDoc.getPages();

    checkmarksList.forEach(chk => {
        // Get the page for this checkmark (assuming 0-indexed page numbers)
        const pdfPage = pdfDocPages[chk.page];

        if (!pdfPage) {
            console.warn(`Page ${chk.page} not found for checkmark`);
            return;
        }

        // Compute export coordinates
        const coords = computeExportCoordsForSVG(pdfPage, {
            x: chk.x,
            y: chk.y,
            scale: chk.scale,
            stageW: chk.stageW || canvasWidth,
            stageH: chk.stageH || canvasHeight
        });

        // Draw the SVG path
        pdfPage.drawSvgPath(checkSvgPath, {
            x: coords.exportX,
            y: coords.exportY,
            scale: coords.pdfSvgSize / 24, // Normalize: SVG viewBox is 24x24
            color: PDFLib.rgb(0, 0.125, 0), // #002000 converted to RGB
            // opacity: 1, // optional
        });
    });
}

function computeExportCoordsForSVG(page, cfg) {
    const pageW = page.getWidth();
    const pageH = page.getHeight();

    const stageW = Number(cfg.stageW) || pageW;
    const stageH = Number(cfg.stageH) || pageH;

    const scaleX = pageW / stageW;
    const scaleY = pageH / stageH;

    // SVG sizing: base size is 24px, scaled by chk.scale
    const cssSvgSize = 24 * (Number(cfg.scale) || 1);
    const pdfSvgSize = cssSvgSize * scaleY;

    // X coordinate
    const exportX = (Number(cfg.x) || 0) * scaleX;

    // Y coordinate: CSS uses translate(-0%, -100%) which anchors at bottom-left
    const cssY = Number(cfg.y) || 0;
    const exportYBottom = pageH - cssY * scaleY;

    const exportY = exportYBottom;

    return { pageW, pageH, scaleX, scaleY, pdfSvgSize, exportX, exportY };
}