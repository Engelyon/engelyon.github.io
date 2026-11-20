const byId = id => document.getElementById(id);
const svgNamespace = 'http://www.w3.org/2000/svg';
const board = { width: 594, height: 420, margin: 7 };
const a4 = { width: 210, height: 297, margin: 6, gap: 1.5 };
const root3 = Math.sqrt(3);
const tokenScale = { nave: 1, 'vida-5': .75, 'vida-1': .6, escudo: .6, overwatch: .6, dano: .6, energia: .6, calor: .6 };
const columnInput = byId('columns');
const rowInput = byId('rows');
const soloInput = byId('solo-radius');
const duoInput = byId('duo-radius');
const mapPreview = byId('map-preview');
const tokenPreview = byId('token-preview');
const tokenSheets = byId('token-sheets');
const mapStatus = byId('map-status');
const tokenStatus = byId('token-status');
const printStatus = byId('print-status');
const preview = document.querySelector('.preview');
const mapButton = byId('print-map');
const tokenButton = byId('print-tokens');
const tokenDirectory = new URL('../tokens/', document.baseURI);
let activePreview = 'map';
let hexSize = null;
const pageStyle = document.createElement('style');
document.head.append(pageStyle);

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(svgNamespace, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
}

function columnName(index) {
    let name = '';
    for (let i = index + 1; i > 0; i = Math.floor((i - 1) / 26)) {
        name = String.fromCharCode(65 + (i - 1) % 26) + name;
    }
    return name;
}

function distance(first, second) {
    const dq = first.q - second.q;
    const dr = first.r - second.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

function makeGrid(columns, rows) {
    const cells = [];
    const vertices = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
    const neighbors = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
    const edges = new Map();
    const middleX = (columns - 1) * 1.5;
    const middleY = (rows - 1) + .5;
    let center;
    let nearest = Infinity;
    for (let col = 0; col < columns; col++) {
        for (let row = 0; row < rows; row++) {
            const x = 3 * col;
            const y = 2 * row + col % 2;
            const cell = { q: col, r: row - Math.floor(col / 2), x, y, label: columnName(col) + (row + 1) };
            const squaredDistance = (x - middleX) ** 2 + 3 * (y - middleY) ** 2;
            if (squaredDistance < nearest) {
                nearest = squaredDistance;
                center = cell;
            }
            cells.push(cell);
            const points = vertices.map(([dx, dy]) => [x + dx, y + dy]);
            points.forEach((start, i) => {
                const end = points[(i + 1) % points.length];
                const key = [start.join(','), end.join(',')].sort().join(':');
                if (edges.has(key)) return;
                const [dq, dr] = neighbors[i];
                // A célula vizinha pode estar fora do mapa. Ela ainda define o lado da divisão.
                edges.set(key, { start, end, cell, neighbor: { q: cell.q + dq, r: cell.r + dr } });
            });
        }
    }
    return { cells, edges, center };
}

function drawBoard(grid, columns, rows, first, second) {
    const extentX = (columns - 1) * 1.5 + 2;
    const extentY = (rows + .5) * root3;
    const radius = Math.min((board.width - 2 * board.margin) / extentX, (board.height - 2 * board.margin) / extentY);
    const left = (board.width - extentX * radius) / 2 + radius;
    const top = (board.height - extentY * radius) / 2 + root3 * radius / 2;
    const point = ([x, y]) => `${(left + x * radius / 2).toFixed(4)} ${(top + y * root3 * radius / 2).toFixed(4)}`;
    const canvas = svgElement('svg', { viewBox: `0 0 ${board.width} ${board.height}`, role: 'img', 'aria-label': 'Tabuleiro de hexágonos' });
    canvas.append(svgElement('rect', { width: board.width, height: board.height, fill: 'white' }));
    const thinLines = [];
    const zoneLines = [];
    for (const edge of grid.edges.values()) {
        const d = `M ${point(edge.start)} L ${point(edge.end)}`;
        thinLines.push(d);
        const near = distance(edge.cell, grid.center);
        const far = distance(edge.neighbor, grid.center);
        if ([first, second].some(limit => (near <= limit) !== (far <= limit))) zoneLines.push(d);
    }
    const thin = Math.min(.24, radius * .035);
    canvas.append(
        svgElement('path', { class: 'hex-grid', d: thinLines.join(' '), fill: 'none', stroke: '#000', 'stroke-width': thin }),
        svgElement('path', { class: 'player-limits', d: zoneLines.join(' '), fill: 'none', stroke: '#000', 'stroke-width': thin * 2.65, 'stroke-linecap': 'round' })
    );
    const labels = svgElement('g', { fill: '#666', 'font-size': Math.min(2.65, radius * .29), 'font-family': 'Arial, sans-serif' });
    for (const cell of grid.cells) {
        const [x, y] = point([cell.x - .85, cell.y - .51]).split(' ');
        const text = svgElement('text', { x, y });
        text.textContent = cell.label;
        labels.append(text);
    }
    canvas.append(labels);
    const sheet = document.createElement('div');
    sheet.className = 'map-paper';
    sheet.append(canvas);
    mapPreview.replaceChildren(sheet);
    return { width: 2 * radius, height: root3 * radius };
}

const mmText = value => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
function renderMap() {
    hexSize = null;
    if (!columnInput.validity.valid || !rowInput.validity.valid) {
        mapStatus.textContent = 'Informe de 5 a 60 colunas e linhas.';
    } else {
        const columns = columnInput.valueAsNumber;
        const rows = rowInput.valueAsNumber;
        const grid = makeGrid(columns, rows);
        const first = soloInput.valueAsNumber;
        const second = duoInput.valueAsNumber;
        if (soloInput.validity.valid && duoInput.validity.valid && first < second) {
            hexSize = drawBoard(grid, columns, rows, first, second);
            mapStatus.textContent = `Centro: ${grid.center.label} · Hex: ${mmText(hexSize.width)} × ${mmText(hexSize.height)} mm`;
        } else {
            mapStatus.textContent = 'Use duas distâncias inteiras em ordem crescente a partir do centro.';
        }
    }
    mapStatus.classList.toggle('error', !hexSize);
    mapButton.disabled = !hexSize;
    if (!hexSize) mapPreview.replaceChildren();
    renderTokens();
}

const tokenEntries = typeof TOKEN_CATALOG === 'undefined' ? [] : TOKEN_CATALOG.filter(
    entry => Object.hasOwn(tokenScale, entry.type) && typeof entry.file === 'string' && entry.file.endsWith('.png')
).map(entry => {
    const row = document.createElement('tr');
    const title = row.insertCell();
    const label = document.createElement('div');
    label.textContent = entry.label || entry.file;
    const file = document.createElement('code');
    file.className = 'token-file';
    file.textContent = entry.file;
    title.append(label, file);
    row.insertCell().textContent = `${Math.round(tokenScale[entry.type] * 100)}%`;
    const copies = document.createElement('input');
    copies.type = 'number';
    copies.min = '0';
    copies.max = '999';
    copies.step = '1';
    copies.value = '1';
    copies.required = true;
    copies.disabled = true;
    copies.setAttribute('aria-label', `Cópias de ${entry.label || entry.file}`);
    row.insertCell().append(copies);
    byId('token-rows').append(row);
    copies.addEventListener('input', renderTokens);
    return { ...entry, row, copies, url: new URL(encodeURIComponent(entry.file), tokenDirectory).href, state: 'loading' };
});

async function loadToken(entry) {
    const image = new Image();
    image.src = entry.url;
    try {
        await image.decode();
        entry.state = 'ready';
        entry.copies.disabled = false;
    } catch {
        entry.state = 'missing';
        entry.row.dataset.error = 'true';
        entry.row.title = 'PNG ausente ou inválido';
    }
    renderTokens();
}

function packTokens(entries, shipDiameter) {
    const pages = [];
    const items = entries.flatMap(entry => Array.from({ length: entry.copies.valueAsNumber }, () => ({
        entry, size: shipDiameter * tokenScale[entry.type]
    }))).sort((first, second) => second.size - first.size);
    for (const token of items) {
        let position;
        for (const page of pages) {
            const shelf = page.shelves.find(line => token.size <= line.height &&
                line.x + token.size <= a4.width - a4.margin + 1e-8);
            if (shelf) {
                position = { page, shelf };
                break;
            }
            if (page.y + token.size <= a4.height - a4.margin + 1e-8) {
                position = { page, shelf: addShelf(page, token.size) };
                break;
            }
        }
        if (!position) {
            const page = { items: [], shelves: [], y: a4.margin };
            pages.push(page);
            position = { page, shelf: addShelf(page, token.size) };
        }
        const { page, shelf } = position;
        page.items.push({ ...token, x: shelf.x, y: shelf.y });
        shelf.x += token.size + a4.gap;
    }
    return pages;
}

function addShelf(page, height) {
    const shelf = { x: a4.margin, y: page.y, height };
    page.shelves.push(shelf);
    page.y += height + a4.gap;
    return shelf;
}

function makeTokenSheet(page) {
    const sheet = document.createElement('div');
    sheet.className = 'token-paper';
    const marks = svgElement('svg', { viewBox: '0 0 210 297', 'aria-hidden': 'true' });
    const commands = [];
    for (const { entry, size, x, y } of page.items) {
        const image = new Image();
        image.src = entry.url;
        image.alt = entry.label || entry.file;
        Object.assign(image.style, {
            left: `${x}mm`, top: `${y}mm`, width: `${size}mm`, height: `${size}mm`, objectFit: 'contain'
        });
        sheet.append(image);
        for (const [cornerX, horizontal] of [[x, -1], [x + size, 1]]) {
            for (const [cornerY, vertical] of [[y, -1], [y + size, 1]]) {
                commands.push(`M ${cornerX + horizontal * .16} ${cornerY} h ${horizontal * .52}`);
                commands.push(`M ${cornerX} ${cornerY + vertical * .16} v ${vertical * .52}`);
            }
        }
    }
    marks.append(svgElement('path', { d: commands.join(' '), fill: 'none', stroke: '#000', 'stroke-width': .15 }));
    sheet.append(marks);
    return sheet;
}

function renderTokens() {
    const ready = tokenEntries.filter(entry => entry.state === 'ready');
    const missing = tokenEntries.filter(entry => entry.state === 'missing').length;
    const loading = tokenEntries.length - ready.length - missing;
    const invalid = ready.some(entry => !entry.copies.validity.valid);
    const pages = hexSize && !invalid ? packTokens(ready, hexSize.height) : [];
    tokenSheets.replaceChildren(...pages.map(makeTokenSheet));
    byId('empty-tokens').hidden = pages.length > 0;
    const notes = [];
    if (hexSize) notes.push(`Nave: ${mmText(hexSize.height)} mm de lado a lado do hex.`);
    if (pages.length) notes.push(`${pages.length} ${pages.length === 1 ? 'folha A4' : 'folhas A4'}.`);
    if (missing) notes.push(`${missing} ${missing === 1 ? 'PNG ausente' : 'PNGs ausentes'}.`);
    if (loading) notes.push('Carregando artes…');
    if (invalid) notes.push('Use de 0 a 999 cópias por arte.');
    tokenStatus.textContent = notes.join(' ');
    tokenStatus.classList.toggle('error', invalid);
    tokenButton.disabled = !pages.length || loading > 0;
}

function showPreview(which) {
    activePreview = which;
    mapPreview.hidden = which !== 'map';
    tokenPreview.hidden = which !== 'tokens';
    pageStyle.textContent = which === 'map' ? `@page { size: ${board.width}mm ${board.height}mm; margin: 0; }` :
        '@page { size: A4 portrait; margin: 0; }';
    byId('show-map').setAttribute('aria-pressed', which === 'map');
    byId('show-tokens').setAttribute('aria-pressed', which === 'tokens');
}

function fitPreview() {
    const style = getComputedStyle(preview);
    const available = preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const zoom = width => Math.max(.1, Math.min(1, available / (width * 96 / 25.4)));
    preview.style.setProperty('--map-zoom', zoom(board.width));
    preview.style.setProperty('--token-zoom', zoom(a4.width));
}

let originalTitle = document.title;
window.addEventListener('beforeprint', () => {
    const disabled = activePreview === 'map' ? mapButton.disabled : tokenButton.disabled;
    document.body.dataset.print = disabled ? 'none' : activePreview;
    originalTitle = document.title;
    if (!disabled) document.title = activePreview === 'map' ? 'Rebels - Mapa A2' : 'Rebels - Tokens A4';
});
window.addEventListener('afterprint', () => {
    delete document.body.dataset.print;
    document.title = originalTitle;
});

async function printPreview(which) {
    showPreview(which);
    printStatus.hidden = true;
    if (which === 'tokens') {
        try {
            await Promise.all(Array.from(tokenSheets.querySelectorAll('img'), image => image.decode()));
        } catch {
            printStatus.textContent = 'Uma arte não carregou. Confira os PNGs na pasta tokens e recarregue a página.';
            printStatus.hidden = false;
            return;
        }
    }
    window.print();
}

for (const input of [columnInput, rowInput, soloInput, duoInput]) input.addEventListener('input', renderMap);
byId('show-map').addEventListener('click', () => showPreview('map'));
byId('show-tokens').addEventListener('click', () => showPreview('tokens'));
mapButton.addEventListener('click', () => printPreview('map'));
tokenButton.addEventListener('click', () => printPreview('tokens'));
new ResizeObserver(() => requestAnimationFrame(fitPreview)).observe(preview);
fitPreview();
showPreview('map');
renderMap();
tokenEntries.forEach(loadToken);
