const sections = {
    arma: { type: 'arma', fields: ['energia', 'calor', 'peso', 'direcoes', 'tiros', 'dano', '1 hex', '2 hexes', 'longo alcance'] },
    utilitario: { type: 'suporte', fields: ['energia', 'calor', 'usos', 'peso', 'direcoes', 'modo', 'rodape'] },
    gerador: { type: 'especial', fields: ['peso', 'rodape'] },
    propulsor: { type: 'propulsao', fields: ['energia', 'calor', 'peso', 'direcoes', 'rodape'] }
};
const rarities = { c: 'comum', i: 'incomum', r: 'raro', u: 'unico', comum: 'comum', incomum: 'incomum', raro: 'raro', unico: 'unico' };
const faces = { F: 0, FD: 1, TD: 2, T: 3, TE: 4, FE: 5 };
const byId = id => document.getElementById(id);
const fileInput = byId('csv-file');
const cardPicker = byId('batch-card');
const economy = byId('ctrl-print-economy');
const exportButton = byId('batch-export');
const progress = byId('batch-progress');
const status = byId('batch-status');
const issues = byId('batch-issues');
const previewCard = byId('card-preview');
let cards = [];

function normalize(value) {
    return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

function parseCsv(text) {
    const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const firstLine = input.split('\n').find(line => line.trim()) || '';
    const delimiter = [';', '\t'].find(char => firstLine.includes(char)) || ',';
    const rows = [];
    let fields = [];
    let field = '';
    let quoted = false;
    let closedQuote = false;
    let line = 1;
    let rowLine = 1;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (quoted) {
            if (char === '"' && input[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
                closedQuote = true;
            } else {
                field += char;
            }
        } else if (char === delimiter || char === '\n') {
            fields.push(field.trim());
            field = '';
            closedQuote = false;
            if (char === '\n') {
                rows.push({ line: rowLine, fields });
                fields = [];
                rowLine = line + 1;
            }
        } else if (char === '"' && !field.trim() && !closedQuote) {
            field = '';
            quoted = true;
        } else if (char === '"' || (closedQuote && char.trim())) {
            throw new Error(`Aspas inválidas na linha ${line}.`);
        } else {
            field += char;
        }
        if (char === '\n') line++;
    }

    if (quoted) throw new Error(`Aspas sem fechamento na linha ${rowLine}.`);
    fields.push(field.trim());
    rows.push({ line: rowLine, fields });
    return rows;
}

function integer(value, label, { signed = false, max = 999, optional = false } = {}) {
    if (optional && ['', '—', '–', '-'].includes(value)) return 0;
    const number = Number(value.replaceAll('−', '-'));
    if (!/^[+−-]?\d+$/.test(value) || !Number.isSafeInteger(number) ||
        number < (signed ? -max : 0) || number > max) {
        throw new Error(`valor inválido em ${label} (${value || 'vazio'}).`);
    }
    return number || 0;
}

function aim(value, label) {
    return /^[x×]$/i.test(value) ? 'X' : integer(value, label, { signed: true });
}

function longAim(value) {
    if (/^[x×]$/i.test(value)) return { longo: 'X', longoLabel: '3+ hex' };
    const match = /^([+−-]?\d+)\s+a\s+3\s*(\+|[–−-]\s*5)(?:\s+hex(?:es)?)?$/i.exec(value);
    if (!match) throw new Error(`longo alcance inválido (${value || 'vazio'}).`);
    return {
        longo: integer(match[1], 'longo alcance', { signed: true }),
        longoLabel: match[2] === '+' ? '3+ hex' : '3–5 hex'
    };
}

function directions(value) {
    if (!value || /^[—–-]$/.test(value)) return [];
    if (value === '6') return [0, 1, 2, 3, 4, 5];
    return [...new Set(value.toUpperCase().split(/[,\s]+/).map(face => {
        if (!Object.hasOwn(faces, face)) throw new Error(`direção desconhecida (${face}).`);
        return faces[face];
    }))];
}

function readCard(row, section, columns) {
    const get = field => row[columns.indexOf(field)] ?? '';
    const name = row[0].trim();
    const upgraded = /-u$/i.test(name);
    const nome = name.replace(/-u$/i, '').trim();
    if (!nome) throw new Error('nome da carta vazio.');

    const rarity = normalize(get('rar'));
    if (!Object.hasOwn(rarities, rarity)) throw new Error(`raridade desconhecida (${get('rar') || 'vazio'}).`);

    const weapon = section.type === 'arma';
    const mode = normalize(get('modo'));
    if (section.type === 'suporte' && !['texto', 'simbolos'].includes(mode)) {
        throw new Error(`modo de rodapé desconhecido (${get('modo') || 'vazio'}).`);
    }
    const modo_inf = weapon ? 'mira' : (mode === 'texto' ? 'texto' : 'simbolos');
    const footer = get('rodape');
    if (!weapon && !footer) throw new Error('rodapé vazio.');

    return {
        nome, upgraded, ato: 1, tipo: section.type, raridade: rarities[rarity], modo_inf,
        peso: integer(get('peso'), 'peso', { signed: true }),
        energia: integer(get('energia'), 'energia', { optional: true }),
        calor: integer(get('calor'), 'calor', { optional: true }),
        usos: integer(get(weapon ? 'tiros' : 'usos'), weapon ? 'tiros' : 'usos', { optional: !weapon, max: 6 }),
        dano: integer(get('dano'), 'dano', { optional: !weapon }),
        arestas: directions(get('direcoes')),
        mira: weapon ? { hex1: aim(get('1 hex'), '1 hex'), hex2: aim(get('2 hexes'), '2 hexes'), ...longAim(get('longo alcance')) } : {},
        desc: modo_inf === 'texto' ? footer : '',
        simbolos: {},
        simbolosTexto: modo_inf === 'simbolos' ? footer : ''
    };
}

function importCards(text) {
    const parsed = [];
    const warnings = [];
    let section;
    let columns;
    for (const { line, fields } of parseCsv(text)) {
        if (!fields.some(Boolean)) continue;
        const heading = normalize(fields[0] || '');
        const isHeader = Object.hasOwn(sections, heading) && normalize(fields[1] || '').replace(/\.$/, '') === 'rar';
        if (isHeader) {
            section = sections[heading];
            columns = fields.map(value => normalize(value).replace(/\.$/, ''));
            const missing = section.fields.filter(field => !columns.includes(field));
            if (missing.length) {
                warnings.push(`Linha ${line}: faltam colunas em ${fields[0]} (${missing.join(', ')}).`);
                section = undefined;
            }
            continue;
        }

        try {
            if (!section) throw new Error('fora de um bloco com cabeçalho válido.');
            if (fields.length < section.fields.length + 2 || fields.slice(columns.length).some(Boolean)) {
                throw new Error('número de campos incompatível com o cabeçalho.');
            }
            parsed.push(readCard(fields, section, columns));
        } catch (error) {
            warnings.push(`Linha ${line} (${fields[0] || 'sem nome'}): ${error.message}`);
        }
    }
    return { parsed, warnings };
}

function showStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !message;
}

function showIssues(warnings) {
    issues.querySelector('ul').replaceChildren(...warnings.map(warning => {
        const item = document.createElement('li');
        item.textContent = warning;
        return item;
    }));
    issues.hidden = !warnings.length;
    issues.open = Boolean(warnings.length);
}

function showCard(index) {
    state = cards[index];
    renderizarCarta();
}

function loadPreview() {
    byId('batch-empty').hidden = Boolean(cards.length);
    byId('batch-card-container').hidden = !cards.length;
    if (cards.length) showCard(cardPicker.selectedIndex);
}

async function handleFile(file) {
    fileInput.disabled = true;
    exportButton.disabled = true;
    cardPicker.disabled = true;
    showStatus('Lendo CSV…');
    cards = [];
    let warnings = [];
    let message;
    try {
        ({ parsed: cards, warnings } = importCards(await file.text()));
        message = cards.length ? `${cards.length} cartas prontas. ${cards.filter(card => card.upgraded).length} upgrades.` :
            'Nenhuma carta válida encontrada.';
        if (warnings.length) message += ` ${warnings.length} linhas para revisar.`;
    } catch (error) {
        message = error.message || 'Não foi possível ler o CSV.';
    }

    cardPicker.replaceChildren(...cards.map((card, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${card.nome}${card.upgraded ? ' · Upgrade' : ''}`;
        return option;
    }));
    if (!cards.length) cardPicker.append(new Option('Selecione o CSV'));
    fileInput.disabled = false;
    exportButton.disabled = !cards.length;
    cardPicker.disabled = !cards.length;
    showIssues(warnings);
    showStatus(message, cards.length ? '' : 'error');
    loadPreview();
}

function pngName(card, economical, usedNames) {
    const base = card.nome.toLowerCase().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/\s+/g, '_').replace(/^[._]+|[._]+$/g, '') || 'modulo';
    const suffix = `${card.upgraded ? '-u' : ''}${economical ? '-pb' : ''}`;
    let name = `${base}${suffix}.png`;
    let index = 2;
    while (usedNames.has(name)) name = `${base}-${index++}${suffix}.png`;
    usedNames.add(name);
    return name;
}

async function exportBatch() {
    const controls = [fileInput, cardPicker, economy, exportButton];
    controls.forEach(control => { control.disabled = true; });
    progress.max = cards.length;
    progress.value = 0;
    progress.hidden = false;
    const initial = cardPicker.selectedIndex;
    const economical = economy.checked;

    try {
        if (typeof html2canvas !== 'function') throw new Error('A biblioteca de PNG não carregou. Recarregue a página.');
        const zip = new JSZip();
        const usedNames = new Set();
        previewCard.classList.add('export-mode');
        await document.fonts.ready;
        for (const [index, card] of cards.entries()) {
            showStatus(`Gerando PNG ${index + 1} de ${cards.length}…`);
            showCard(index);
            const canvas = await html2canvas(previewCard, { scale: 3, backgroundColor: null });
            const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!png) throw new Error(`Não foi possível gerar o PNG de ${card.nome}.`);
            zip.file(pngName(card, economical, usedNames), png);
            canvas.width = 0;
            canvas.height = 0;
            progress.value = index + 1;
        }
        showStatus('Montando o ZIP…');
        const archive = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(archive);
        const link = document.createElement('a');
        link.href = url;
        link.download = `modulos-ato-1${economical ? '-pb' : ''}.zip`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showStatus(`ZIP gerado com ${cards.length} PNGs.`);
    } catch (error) {
        showStatus(error.message || 'Falha ao exportar o lote.', 'error');
    } finally {
        previewCard.classList.remove('export-mode');
        showCard(initial);
        progress.hidden = true;
        controls.forEach(control => { control.disabled = false; });
    }
}

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) handleFile(file);
});
cardPicker.addEventListener('change', loadPreview);
economy.addEventListener('change', loadPreview);
exportButton.addEventListener('click', exportBatch);
