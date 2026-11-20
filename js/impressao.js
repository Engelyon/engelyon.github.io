// O empacotamento usa centésimos de milímetro.
const PAPER = { width: 21000, height: 29700, margin: 600, gap: 150 };
const SVG_NS = 'http://www.w3.org/2000/svg';
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
// Medidas do editor de naves em pixels lógicos, antes da exportação em 2×.
const HULL = { slotWidth: 325, slotHeight: 476, gap: 18, padding: 80, outline: 40, slotBorder: 8 };
const SLOT_CLEARANCE = 50; // 0,5 mm adicionais no total de cada eixo.
const formats = {
    module: { width: 4400, height: 6700 },
    tarot: { width: 12000, height: 7000 },
    'hull-2x2': { footprints: [[2, 2]] },
    'hull-2x1': { footprints: [[2, 1], [1, 2]] },
    'hull-1x1': { footprints: [[1, 1]] }
};

const sheets = document.getElementById('sheets');
const preview = document.getElementById('preview');
const printButton = document.getElementById('print-button');
const sheetCount = document.getElementById('sheet-count');
const emptyPreview = document.getElementById('empty-preview');
const status = document.getElementById('import-status');
const copiesError = document.getElementById('copies-error');
const formatPicker = document.getElementById('print-format');
const picker = document.getElementById('png-picker');
const list = document.getElementById('file-list');
const template = document.getElementById('file-row');
const files = [];
let loading = false;

picker.addEventListener('change', () => {
    const selected = Array.from(picker.files);
    picker.value = '';
    importFiles(selected, formats[formatPicker.value], formatPicker.selectedOptions[0].textContent);
});
printButton.addEventListener('click', () => window.print());
new ResizeObserver(() => requestAnimationFrame(fitPreview)).observe(preview);
fitPreview();

function fitPreview() {
    const style = getComputedStyle(preview);
    const available = preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const paperPixels = PAPER.width / 100 * 96 / 25.4;
    sheets.style.setProperty('--preview-scale', Math.max(0.1, Math.min(1, available / paperPixels)));
}

function hullGeometry(columns, rows) {
    const gridWidth = columns * HULL.slotWidth + (columns - 1) * HULL.gap;
    const gridHeight = rows * HULL.slotHeight + (rows - 1) * HULL.gap;
    // No PNG, o contorno interno ocupa até 8 px lógicos em cada lado do slot.
    const innerWidth = HULL.slotWidth - 2 * HULL.slotBorder;
    const innerHeight = HULL.slotHeight - 2 * HULL.slotBorder;
    const pixelWidth = gridWidth + 2 * HULL.outline;
    const pixelHeight = gridHeight + 2 * HULL.outline;
    return {
        exportWidth: gridWidth + 2 * HULL.padding,
        exportHeight: gridHeight + 2 * HULL.padding,
        crop: HULL.padding - HULL.outline,
        pixelWidth,
        pixelHeight,
        printWidth: Math.ceil(pixelWidth * (formats.module.width + SLOT_CLEARANCE) / innerWidth),
        printHeight: Math.ceil(pixelHeight * (formats.module.height + SLOT_CLEARANCE) / innerHeight)
    };
}

function similarRatio(width, height, expectedWidth, expectedHeight, tolerance) {
    return Math.abs((width / height) / (expectedWidth / expectedHeight) - 1) <= tolerance;
}

async function prepareHull(image, footprints) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    for (const [columns, rows] of footprints) {
        const bounds = hullGeometry(columns, rows);
        const turned = (width > height) !== (bounds.exportWidth > bounds.exportHeight);
        const [exportWidth, exportHeight] = turned
            ? [bounds.exportHeight, bounds.exportWidth] : [bounds.exportWidth, bounds.exportHeight];
        const [pixelWidth, pixelHeight] = turned
            ? [bounds.pixelHeight, bounds.pixelWidth] : [bounds.pixelWidth, bounds.pixelHeight];
        const size = {
            width: turned ? bounds.printHeight : bounds.printWidth,
            height: turned ? bounds.printWidth : bounds.printHeight,
            isHull: true
        };
        if (similarRatio(width, height, exportWidth, exportHeight, 0.006)) {
            const scaleX = width / exportWidth;
            const scaleY = height / exportHeight;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(pixelWidth * scaleX);
            canvas.height = Math.round(pixelHeight * scaleY);
            canvas.getContext('2d').drawImage(image, bounds.crop * scaleX, bounds.crop * scaleY,
                pixelWidth * scaleX, pixelHeight * scaleY, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('Não foi possível recortar o casco.');
            return { ...size, blob };
        }
        if (similarRatio(width, height, pixelWidth, pixelHeight, 0.006)) return size;
    }
    throw new Error('As proporções do PNG não correspondem ao casco selecionado.');
}

async function loadPng(file, format) {
    const signature = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
    if (!PNG_SIGNATURE.every((byte, index) => signature[index] === byte)) throw new Error('PNG inválido ou danificado.');

    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => { throw new Error('PNG inválido ou danificado.'); });
        const size = format.footprints ? await prepareHull(image, format.footprints) : format;
        if (!format.footprints && !similarRatio(image.naturalWidth, image.naturalHeight, size.width, size.height, 0.035)) {
            throw new Error('As proporções do PNG não correspondem ao formato selecionado.');
        }
        if (size.blob) {
            const cropped = URL.createObjectURL(size.blob);
            URL.revokeObjectURL(url);
            return { width: size.width, height: size.height, isHull: size.isHull, url: cropped };
        }
        return { width: size.width, height: size.height, isHull: size.isHull, url };
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    }
}

async function importFiles(selected, format, formatLabel) {
    if (!selected.length) return;
    loading = true;
    picker.disabled = true;
    formatPicker.disabled = true;
    status.dataset.state = 'loading';
    status.textContent = 'Carregando PNGs…';
    status.hidden = false;
    updatePrintAvailability();
    const failures = [];
    for (const file of selected) {
        try {
            addFile(file.name, formatLabel, await loadPng(file, format));
        } catch (error) {
            failures.push(`${file.name} — ${error.message}`);
        }
    }
    loading = false;
    picker.disabled = false;
    formatPicker.disabled = false;
    status.dataset.state = 'error';
    status.textContent = failures.join('\n');
    status.hidden = !failures.length;
    render();
}

function addFile(name, format, asset) {
    const row = template.content.firstElementChild.cloneNode(true);
    const label = row.querySelector('.file-name');
    const copies = row.querySelector('.copies');
    const remove = row.querySelector('.remove-file');
    label.textContent = name;
    label.title = name;
    row.querySelector('.file-format').textContent = format;
    copies.setAttribute('aria-label', `Cópias de ${name}`);
    remove.setAttribute('aria-label', `Remover ${name}`);
    const file = { ...asset, name, copies };
    files.push(file);
    list.append(row);
    copies.addEventListener('input', render);
    remove.addEventListener('click', () => {
        const next = row.nextElementSibling || row.previousElementSibling;
        files.splice(files.indexOf(file), 1);
        row.remove();
        render();
        URL.revokeObjectURL(asset.url);
        if (next) next.querySelector('.remove-file').focus();
        else picker.focus();
    });
}

function newSheet() {
    return {
        items: [],
        free: [{
            x: PAPER.margin, y: PAPER.margin,
            width: PAPER.width - 2 * PAPER.margin + PAPER.gap,
            height: PAPER.height - 2 * PAPER.margin + PAPER.gap
        }]
    };
}

function bestSlot(pages, file, strategy) {
    let best;
    for (const page of pages) {
        for (const space of page.free) {
            for (const rotated of [false, true]) {
                const width = (rotated ? file.height : file.width) + PAPER.gap;
                const height = (rotated ? file.width : file.height) + PAPER.gap;
                if (width > space.width || height > space.height) continue;
                const x = space.x;
                const y = space.y;
                const shortSide = Math.min(space.width - width, space.height - height);
                const area = space.width * space.height - width * height;
                const score = strategy === 'top' ? y * PAPER.width + x :
                    strategy === 'area' ? area : shortSide * PAPER.height + Math.max(space.width - width, space.height - height);
                if (!best || score < best.score) best = { page, x, y, width, height, rotated, score };
            }
        }
    }
    return best;
}

function splitSpace(space, used) {
    const right = space.x + space.width;
    const bottom = space.y + space.height;
    const usedRight = used.x + used.width;
    const usedBottom = used.y + used.height;
    if (used.x >= right || usedRight <= space.x || used.y >= bottom || usedBottom <= space.y) return [space];
    const parts = [];
    if (used.x > space.x) parts.push({ ...space, width: used.x - space.x });
    if (usedRight < right) parts.push({ ...space, x: usedRight, width: right - usedRight });
    if (used.y > space.y) parts.push({ ...space, height: used.y - space.y });
    if (usedBottom < bottom) parts.push({ ...space, y: usedBottom, height: bottom - usedBottom });
    return parts;
}

function contains(outer, inner) {
    return outer.x <= inner.x && outer.y <= inner.y &&
        outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
}

function pack(cards, strategy) {
    const pages = [];
    for (const file of cards) {
        let slot = bestSlot(pages, file, strategy);
        if (!slot) {
            const page = newSheet();
            pages.push(page);
            slot = bestSlot([page], file, strategy);
        }
        const { page, x, y, width, height, rotated } = slot;
        page.items.push({ file, x, y, width: width - PAPER.gap, height: height - PAPER.gap, rotated });
        const free = page.free.flatMap(space => splitSpace(space, slot));
        page.free = free.filter((space, index) => !free.some((other, otherIndex) =>
            otherIndex !== index && contains(other, space) && (otherIndex < index || !contains(space, other))));
    }
    return pages;
}

function packCards(cards) {
    const byArea = [...cards].sort((a, b) => b.width * b.height - a.width * a.height);
    const bySide = [...cards].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
    return [pack(byArea, 'top'), pack(byArea, 'short'), pack(bySide, 'area')]
        .reduce((best, candidate) => candidate.length < best.length ? candidate : best);
}

function cropMarks() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('crop-marks');
    svg.setAttribute('viewBox', `0 0 ${PAPER.width} ${PAPER.height}`);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
}

function addCropMarks(svg, x, y, width, height) {
    const commands = [];
    for (const [cornerX, horizontal] of [[x, -1], [x + width, 1]]) {
        for (const [cornerY, vertical] of [[y, -1], [y + height, 1]]) {
            commands.push(`M ${cornerX + horizontal * 16} ${cornerY} h ${horizontal * 53}`);
            commands.push(`M ${cornerX} ${cornerY + vertical * 16} v ${vertical * 53}`);
        }
    }
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', commands.join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#1a1a1a');
    path.setAttribute('stroke-width', '15');
    svg.append(path);
}

function mm(value) {
    return `${value / 100}mm`;
}

function makeSheet({ items }) {
    const sheet = document.createElement('section');
    sheet.className = 'sheet';
    const marks = cropMarks();
    items.forEach(({ file, x, y, width, height, rotated }) => {
        const card = document.createElement('div');
        card.className = rotated ? 'print-card rotated' : 'print-card';
        Object.assign(card.style, { left: mm(x), top: mm(y), width: mm(width), height: mm(height) });
        const image = document.createElement('img');
        if (file.isHull) image.className = 'hull-image';
        image.src = file.url;
        image.alt = file.name;
        image.style.width = mm(file.width);
        image.style.height = mm(file.height);
        if (rotated) card.style.setProperty('--rotated-width', mm(width));
        card.append(image);
        sheet.append(card);
        addCropMarks(marks, x, y, width, height);
    });
    sheet.append(marks);
    return sheet;
}

function render() {
    const invalid = files.some(file => !file.copies.validity.valid);
    copiesError.hidden = !invalid;
    const cards = files.flatMap(file => file.copies.validity.valid ? Array(file.copies.valueAsNumber).fill(file) : []);
    const pages = cards.length ? packCards(cards) : [];
    sheets.replaceChildren(...pages.map(makeSheet));
    sheetCount.textContent = `${pages.length} ${pages.length === 1 ? 'folha' : 'folhas'}`;
    emptyPreview.hidden = files.length > 0;
    updatePrintAvailability();
}

function updatePrintAvailability() {
    const ready = sheets.childElementCount > 0 && !loading && copiesError.hidden;
    printButton.disabled = !ready;
    document.body.classList.toggle('can-print', ready);
}
