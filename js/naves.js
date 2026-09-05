const SLOT_W = 325;
const SLOT_H = 476;
const GAP = 18;
const GRID_PADDING = 80;

const HULL_THICKNESS = 30;
const OUTER_CHAMFER = 40;
const INNER_CHAMFER = 95;

let slots = new Map();

window.addEventListener('DOMContentLoaded', () => {
    slots.set("0,0", { b: true, p: true, g: true, r: true });
    renderGrid();
    document.getElementById('btn-export-png').addEventListener('click', exportarPNG);
});

function renderGrid() {
    if (slots.size === 0) slots.set("0,0", { b: true, p: true, g: true, r: true });

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    let first = true;
    for (let key of slots.keys()) {
        let [x, y] = key.split(',').map(Number);
        if (first) { minX = maxX = x; minY = maxY = y; first = false; }
        else {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    }

    const grid = document.getElementById('ship-grid');

    Array.from(grid.children).forEach(child => { if (child.id !== 'hull-svg') child.remove(); });

    grid.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, ${SLOT_W}px)`;
    grid.style.gridTemplateRows = `repeat(${maxY - minY + 1}, ${SLOT_H}px)`;

    // SLOTS
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const key = `${x},${y}`;
            if (slots.has(key)) {
                const cell = document.createElement('div');
                cell.className = 'slot';
                const data = slots.get(key);

                // Botão Remover (X)
                const btnRem = document.createElement('div');
                btnRem.className = 'btn-remove'; btnRem.innerHTML = '✖';
                btnRem.onclick = () => { slots.delete(key); renderGrid(); };
                cell.appendChild(btnRem);

                // Matriz 2x2 de Cores
                const colorsWrap = document.createElement('div');
                colorsWrap.className = 'colors-wrap';
                const coresDef = [
                    { id: 'b', class: 'color-blue' }, { id: 'p', class: 'color-purple' },
                    { id: 'g', class: 'color-green' }, { id: 'r', class: 'color-red' }
                ];
                coresDef.forEach(c => {
                    const btnColor = document.createElement('div');
                    btnColor.className = `square-btn ${c.class} ${data[c.id] ? 'active' : ''}`;
                    btnColor.onclick = () => { data[c.id] = !data[c.id]; renderGrid(); };
                    colorsWrap.appendChild(btnColor);
                });
                cell.appendChild(colorsWrap);

                // Botões de Expansão (+)
                if (!slots.has(`${x},${y-1}`)) cell.appendChild(createAddBtn('top', x, y-1));
                if (!slots.has(`${x},${y+1}`)) cell.appendChild(createAddBtn('bottom', x, y+1));
                if (!slots.has(`${x-1},${y}`)) cell.appendChild(createAddBtn('left', x-1, y));
                if (!slots.has(`${x+1},${y}`)) cell.appendChild(createAddBtn('right', x+1, y));

                grid.appendChild(cell);
            } else {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'slot-empty';
                grid.appendChild(emptyCell);
            }
        }
    }

    desenharCascoSVG(minX, minY);
}

function desenharCascoSVG(minX, minY) {
    const edges = [];
    for (let key of slots.keys()) {
        const [x, y] = key.split(',').map(Number);

        const px = (x - minX) * (SLOT_W + GAP) - GAP/2 + GRID_PADDING;
        const py = (y - minY) * (SLOT_H + GAP) - GAP/2 + GRID_PADDING;
        const pw = SLOT_W + GAP;
        const ph = SLOT_H + GAP;

        if (!slots.has(`${x},${y-1}`)) edges.push({ start: {x: px, y: py}, end: {x: px+pw, y: py} });
        if (!slots.has(`${x+1},${y}`)) edges.push({ start: {x: px+pw, y: py}, end: {x: px+pw, y: py+ph} });
        if (!slots.has(`${x},${y+1}`)) edges.push({ start: {x: px+pw, y: py+ph}, end: {x: px, y: py+ph} });
        if (!slots.has(`${x-1},${y}`)) edges.push({ start: {x: px, y: py+ph}, end: {x: px, y: py} });
    }

    const loops = [];
    while (edges.length > 0) {
        let loop = [];
        let curr = edges.splice(0, 1)[0];
        loop.push(curr);

        while (true) {
            let nextIdx = edges.findIndex(e => Math.abs(e.start.x - curr.end.x) < 1 && Math.abs(e.start.y - curr.end.y) < 1);
            if (nextIdx === -1) break;
            curr = edges.splice(nextIdx, 1)[0];
            loop.push(curr);
        }
        loops.push(loop);
    }

    // C) Desenha a geometria com Expansão + Wrap
    let svgContent = '';
    loops.forEach(loop => {
        let pathD = "";
        for (let i = 0; i < loop.length; i++) {
            const e1 = loop[i];
            const e2 = loop[(i + 1) % loop.length];

            const d1 = { x: Math.sign(e1.end.x - e1.start.x), y: Math.sign(e1.end.y - e1.start.y) };
            const d2 = { x: Math.sign(e2.end.x - e2.start.x), y: Math.sign(e2.end.y - e2.start.y) };
            const n1 = { x: d1.y, y: -d1.x };
            const n2 = { x: d2.y, y: -d2.x };

            const s1 = { x: e1.start.x + HULL_THICKNESS * n1.x, y: e1.start.y + HULL_THICKNESS * n1.y };
            const s2 = { x: e2.start.x + HULL_THICKNESS * n2.x, y: e2.start.y + HULL_THICKNESS * n2.y };

            let intersec = {x: 0, y: 0};
            if (d1.y === 0) { intersec.y = s1.y; intersec.x = s2.x; }
            else { intersec.x = s1.x; intersec.y = s2.y; }

            const cross = d1.x * d2.y - d1.y * d2.x;
            const isInnerCorner = cross < 0;

            const currentChamfer = isInnerCorner ? INNER_CHAMFER : OUTER_CHAMFER;

            const C1 = { x: intersec.x - currentChamfer * d1.x, y: intersec.y - currentChamfer * d1.y };
            const C2 = { x: intersec.x + currentChamfer * d2.x, y: intersec.y + currentChamfer * d2.y };

            if (i === 0) pathD += `M ${C1.x} ${C1.y} `;
            else pathD += `L ${C1.x} ${C1.y} `;

            pathD += `L ${C2.x} ${C2.y} `;
        }
        pathD += "Z ";
        svgContent += `<path d="${pathD}" fill="#5c6370" stroke="#5c6370" stroke-width="2" stroke-linejoin="bevel" />`;
    });

    document.getElementById('hull-svg').innerHTML = svgContent;
}

function createAddBtn(pos, nx, ny) {
    const btn = document.createElement('div');
    btn.className = `btn-add add-${pos}`; btn.innerHTML = '+';
    btn.onclick = () => { slots.set(`${nx},${ny}`, { b: true, p: true, g: true, r: true }); renderGrid(); };
    return btn;
}

async function exportarPNG() {
    const grid = document.getElementById('ship-grid');
    grid.classList.add('export-mode');

    const prevPosition = grid.style.position;
    grid.style.position = 'absolute'; grid.style.top = '0'; grid.style.left = '0';

    await new Promise(r => setTimeout(r, 100));

    try {
        const canvas = await html2canvas(grid, { scale: 2, backgroundColor: null, useCORS: true });
        const link = document.createElement('a');
        link.download = `Blueprint_Nave_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error("Erro ao exportar PNG:", e);
        alert("❌ Erro ao exportar o layout da Nave.");
    } finally {
        grid.style.position = prevPosition;
        grid.classList.remove('export-mode');
    }
}