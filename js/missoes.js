const form = document.getElementById('mission-form');
const playerCount = document.getElementById('player-count');
const enemyGroups = document.getElementById('enemy-groups');
const obstacleRows = document.getElementById('obstacle-rows');
const card = document.getElementById('mission-card');
const previewArea = document.getElementById('preview-area');
const previewFrame = document.getElementById('preview-frame');
const printToggle = document.getElementById('print-economy');
const exportButton = document.getElementById('export-png');
const message = document.getElementById('export-message');
const cardColumns = card.querySelector('.card-columns');
const columns = Array.from(card.querySelectorAll('.card-column'));
let exporting = false;
const players = Array.from(playerCount.options, option => option.value);
const groups = players.map(() => {
    const group = document.createElement('div');
    group.className = 'entry-list';
    enemyGroups.append(group);
    return group;
});

const fields = [
    ['mission-name', 'card-title', 'Nome da missão'],
    ['mission-act', 'card-act', ''],
    ['mission-difficulty', 'card-difficulty', '—'],
    ['mission-faction', 'card-faction', '—'],
    ['mission-tension', 'card-tension', '—'],
    ['mission-description', 'card-description', ''],
    ['mission-rewards', 'card-rewards', '']
].map(([field, output, fallback]) => ({
    input: document.getElementById(field),
    output: document.getElementById(output),
    fallback
}));

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
    if (event.target.matches('.enemy-quantity')) {
        event.target.closest('.enemy-row').querySelector('.decrease-quantity').disabled =
            quantityOf(event.target) <= 1;
    }
    renderCard();
});
playerCount.addEventListener('change', showSelectedGroup);
printToggle.addEventListener('change', () => card.classList.toggle('print-economy', printToggle.checked));
exportButton.addEventListener('click', exportPng);

document.getElementById('add-enemy').addEventListener('click', () => {
    addRow('enemy-row-template', groups[playerCount.selectedIndex], true);
});
document.getElementById('add-obstacle').addEventListener('click', () => {
    addRow('obstacle-row-template', obstacleRows, true);
});

groups.forEach(group => addRow('enemy-row-template', group));
addRow('obstacle-row-template', obstacleRows);
showSelectedGroup();
card.classList.toggle('print-economy', printToggle.checked);
new ResizeObserver(() => requestAnimationFrame(fitPreview)).observe(previewArea);
fitPreview();
renderCard();

function showSelectedGroup() {
    groups.forEach((group, index) => { group.hidden = index !== playerCount.selectedIndex; });
}

function quantityOf(input) {
    const value = input.valueAsNumber;
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function addRow(templateId, container, focus = false) {
    const row = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
    const quantity = row.querySelector('.enemy-quantity');
    if (quantity) {
        const less = row.querySelector('.decrease-quantity');
        const more = row.querySelector('.increase-quantity');
        const updateQuantity = delta => {
            quantity.value = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, quantityOf(quantity) + delta));
            less.disabled = quantityOf(quantity) <= 1;
            renderCard();
        };
        less.disabled = true;
        less.addEventListener('click', () => updateQuantity(-1));
        more.addEventListener('click', () => updateQuantity(1));
        quantity.addEventListener('change', () => updateQuantity(0));
    }
    row.querySelector('.remove-row').addEventListener('click', () => {
        const nextInput = row.nextElementSibling?.querySelector('input') ||
            row.previousElementSibling?.querySelector('input');
        row.remove();
        (nextInput || container.closest('fieldset').querySelector('.add-row')).focus();
        renderCard();
    });
    container.append(row);
    if (focus) {
        row.querySelector('input').focus();
        renderCard();
    }
}

function entryRow(key, content) {
    const row = document.createElement('div');
    row.className = 'card-entry';
    const label = document.createElement('span');
    label.className = 'entry-key';
    label.textContent = key;
    const value = document.createElement('div');
    value.append(content);
    row.append(label, value);
    return row;
}

function renderCard() {
    fields.forEach(({ input, output, fallback }) => {
        output.textContent = input.value.trim() || fallback;
    });

    const enemies = groups.map((group, index) => {
        const list = document.createDocumentFragment();
        group.querySelectorAll('.enemy-row').forEach(row => {
            const name = row.querySelector('.enemy-name').value.trim();
            if (!name) return;
            if (list.childNodes.length) list.append(' · ');
            const count = document.createElement('span');
            count.className = 'entry-quantity';
            count.textContent = `${quantityOf(row.querySelector('.enemy-quantity'))}×`;
            list.append(count, ` ${name}`);
        });
        return entryRow(players[index] === '1' ? '1 jogador' : `${players[index]} jogadores`,
            list.childNodes.length ? list : '—');
    });
    document.getElementById('card-enemies').replaceChildren(...enemies);

    const obstacles = Array.from(obstacleRows.querySelectorAll('.obstacle-row')).flatMap(row => {
        const name = row.querySelector('.obstacle-name').value.trim();
        const coordinates = row.querySelector('.obstacle-coordinates').value.trim();
        return name || coordinates ? [entryRow(coordinates || '—', name || '—')] : [];
    });
    document.getElementById('card-obstacles').replaceChildren(...obstacles);

    card.classList.remove('compact');
    if (cardOverflows()) card.classList.add('compact');
    const overflow = cardOverflows();
    setMessage(overflow ? 'O conteúdo ultrapassa o espaço da carta. Encurte os campos ou as listas antes de exportar.' : '', 'error');
    exportButton.disabled = overflow || exporting;
}

function cardOverflows() {
    return cardColumns.clientHeight === 0 || card.scrollHeight > card.clientHeight ||
        columns.some(column => column.scrollHeight > column.clientHeight);
}

function fitPreview() {
    const style = getComputedStyle(previewArea);
    const available = previewArea.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const scale = Math.max(0.1, Math.min(1, available / card.offsetWidth));
    previewFrame.style.width = `${card.offsetWidth * scale}px`;
    previewFrame.style.height = `${card.offsetHeight * scale}px`;
    card.style.transform = `scale(${scale})`;
}

function setMessage(text, kind) {
    message.textContent = text;
    message.dataset.kind = kind;
    message.hidden = !text;
}

async function exportPng() {
    if (exportButton.disabled) return;
    renderCard();
    if (exportButton.disabled) return;

    const printable = printToggle.checked;
    const name = fields[0].input.value.trim().toLocaleLowerCase('pt-BR')
        .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'missao';
    exporting = true;
    exportButton.disabled = true;
    printToggle.disabled = true;

    try {
        const canvas = await html2canvas(card, {
            scale: 3,
            backgroundColor: null,
            width: card.offsetWidth,
            height: card.offsetHeight,
            onclone: (_, clone) => clone.classList.add('export-mode')
        });
        const link = document.createElement('a');
        link.download = `${name}${printable ? '-pb' : ''}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setMessage('PNG exportado.', 'success');
    } catch (error) {
        console.error('Erro ao exportar a missão:', error);
        setMessage('Não foi possível exportar o PNG. Tente novamente.', 'error');
    } finally {
        exporting = false;
        printToggle.disabled = false;
        exportButton.disabled = cardOverflows();
    }
}
