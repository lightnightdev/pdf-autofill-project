
//<svg xmlns="http://www.w3.org/2000/svg" id="mdi-check" viewBox="0 0 24 24"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" /></svg>

let checkmarks = [];
let selectedCheckmark = false;
const checkSvgPath = 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z';
let selectedCheckmarkId = null;



function newCheckmark(x, y, page) {

    const chk = {
        x: x,
        y: y,
        page: page,
        scale: 1,
    }
    selectedCheckmarkId = checkmarks.push(chk) - 1;
    const chkId = selectedCheckmarkId;
    saveCheckmarks();
    renderCheckmark(chkId);
}

function clearAllCheckmarks() {
    checkmarks = [];
    saveCheckmarks();
}

function renderAllCheckmarks() {
    const chkmks = document.querySelectorAll('.checkmark');
    chkmks.forEach(element => {
        element.remove();
    });
    for (i = 0; i < checkmarks.length; i++) {
        if (checkmarks[i].page == currentPage) {
            renderCheckmark(i)
        }
    }
}

function deleteCheckmark(chkId) {
    console.log('deleting: ' + String(chkId));
    checkmarks.splice(chkId, 1);
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
        if (parseInt(card.dataset.chkId) === datasetChkId) {
            card.classList.add("select");
        } else {
            card.classList.remove("select");
        }
    });
}

async function renderCheckmark(chkId) {
    const chk = checkmarks[chkId];

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
    dv.addEventListener('click', () => selectCheckmark(parseInt(chkId, 10)));
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


function drawCheckmarks(pdfDoc, checkmarks, canvasWidth, canvasHeight) {
    // Get pages
    const pdfDocPages = pdfDoc.getPages();

    checkmarks.forEach(chk => {
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
            stageW: canvasWidth,
            stageH: canvasHeight
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