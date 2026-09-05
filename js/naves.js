const SLOT_W = 325;
const SLOT_H = 476;

let slots = new Map();

window.addEventListener('DOMContentLoaded', () => {
    slots.set("0,0", { b: true, p: true, g: true, r: true });
    renderGrid();

    document.getElementById('btn-export-png').addEventListener('click', exportarPNG);
});

function renderGrid() {
    if (slots.size === 0) {
        slots.set("0,0", { b: true, p: true, g: true, r: true });
    }

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    let first = true;

    for (let key of slots.keys()) {
        let [x, y] = key.split(',').map(Number);
        if (first) {
            minX = maxX = x;
            minY = maxY = y;
            first = false;
        } else {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    const grid = document.getElementById('ship-grid');
    grid.innerHTML = '';

    // A malha agora é afastada rigidamente em 18px (o tamanho exato de uma parede interna soldada 9+9)
    grid.style.gap = '18px';
    grid.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, ${SLOT_W}px)`;
    grid.style.gridTemplateRows = `repeat(${maxY - minY + 1}, ${SLOT_H}px)`;

    const hullThickness = 30; // Casco pesado externo
    const innerThickness = 9; // Metade da parede interna
    const chamferRadius = '35px'; // Chanfro arredondado fora
    const innerRadius = '5px'; // Mini chanfro interno

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const key = `${x},${y}`;

            if (slots.has(key)) {
                // Wrapper segura a posição no Grid
                const wrapper = document.createElement('div');
                wrapper.className = 'cell-wrapper';

                const data = slots.get(key);
                let bTop = !slots.has(`${x},${y-1}`);
                let bBot = !slots.has(`${x},${y+1}`);
                let bLef = !slots.has(`${x-1},${y}`);
                let bRig = !slots.has(`${x+1},${y}`);

                // A armadura que cresce por trás do módulo
                const hull = document.createElement('div');
                hull.className = 'hull-layer';
                hull.style.top = bTop ? `-${hullThickness}px` : `-${innerThickness}px`;
                hull.style.bottom = bBot ? `-${hullThickness}px` : `-${innerThickness}px`;
                hull.style.left = bLef ? `-${hullThickness}px` : `-${innerThickness}px`;
                hull.style.right = bRig ? `-${hullThickness}px` : `-${innerThickness}px`;

                // Arredonda as pontas expostas do casco
                if (bTop && bLef) hull.style.borderTopLeftRadius = chamferRadius;
                if (bTop && bRig) hull.style.borderTopRightRadius = chamferRadius;
                if (bBot && bLef) hull.style.borderBottomLeftRadius = chamferRadius;
                if (bBot && bRig) hull.style.borderBottomRightRadius = chamferRadius;

                wrapper.appendChild(hull);

                // O módulo intocável no centro
                const cell = document.createElement('div');
                cell.className = 'slot';

                // Aplica uma leve curva nas quinas internas expostas pra acompanhar o casco
                if (bTop && bLef) cell.style.borderTopLeftRadius = innerRadius;
                if (bTop && bRig) cell.style.borderTopRightRadius = innerRadius;
                if (bBot && bLef) cell.style.borderBottomLeftRadius = innerRadius;
                if (bBot && bRig) cell.style.borderBottomRightRadius = innerRadius;

                // Botão Remover (X)
                const btnRem = document.createElement('div');
                btnRem.className = 'btn-remove';
                btnRem.innerHTML = '✖';
                btnRem.onclick = () => { slots.delete(key); renderGrid(); };
                cell.appendChild(btnRem);

                // Matriz 2x2
                const colorsWrap = document.createElement('div');
                colorsWrap.className = 'colors-wrap';
                const coresDef = [
                    { id: 'b', class: 'color-blue' },
                    { id: 'p', class: 'color-purple' },
                    { id: 'g', class: 'color-green' },
                    { id: 'r', class: 'color-red' }
                ];

                coresDef.forEach(c => {
                    const btnColor = document.createElement('div');
                    btnColor.className = `square-btn ${c.class} ${data[c.id] ? 'active' : ''}`;
                    btnColor.onclick = () => { data[c.id] = !data[c.id]; renderGrid(); };
                    colorsWrap.appendChild(btnColor);
                });

                cell.appendChild(colorsWrap);
                wrapper.appendChild(cell);

                // Botões de Expansão (+) colocados nas bordas corretas
                if (bTop) wrapper.appendChild(createAddBtn('top', x, y-1));
                if (bBot) wrapper.appendChild(createAddBtn('bottom', x, y+1));
                if (bLef) wrapper.appendChild(createAddBtn('left', x-1, y));
                if (bRig) wrapper.appendChild(createAddBtn('right', x+1, y));

                grid.appendChild(wrapper);
            } else {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'slot-empty';
                grid.appendChild(emptyCell);
            }
        }
    }
}

function createAddBtn(pos, nx, ny) {
    const btn = document.createElement('div');
    btn.className = `btn-add add-${pos}`;
    btn.innerHTML = '+';
    btn.onclick = () => {
        slots.set(`${nx},${ny}`, { b: true, p: true, g: true, r: true });
        renderGrid();
    };
    return btn;
}

async function exportarPNG() {
    const grid = document.getElementById('ship-grid');
    grid.classList.add('export-mode');

    // Um tempinho para garantir que o DOM processou a remoção visual dos botões
    await new Promise(r => setTimeout(r, 100));

    try {
        const canvas = await html2canvas(grid, {
            scale: 2,
            backgroundColor: null,
            useCORS: true
        });

        const link = document.createElement('a');
        link.download = `Blueprint_Nave_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error("Erro ao exportar PNG:", e);
        alert("❌ Erro ao exportar o layout da Nave.");
    } finally {
        grid.classList.remove('export-mode');
    }
}