const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e' };

let deckJSON = [];
let fileHandle = null;

async function abrirArquivoDeck() {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON do Deck', accept: {'application/json': ['.json']} }]
        });

        const file = await fileHandle.getFile();
        const contents = await file.text();

        if(contents.trim() !== '') {
            deckJSON = JSON.parse(contents);
        } else {
            deckJSON = [];
        }

        refreshOutput();
        alert(`✅ Sucesso! O arquivo "${file.name}" foi carregado e está pronto para receber novas cartas.`);
    } catch (err) {
        console.warn("Seleção cancelada ou falha ao abrir:", err);
    }
}

async function saveCardToJSON() {
    const nomeAtual = document.getElementById('inp-nome').value.trim();
    const editData = localStorage.getItem('moduloEmEdicao');
    const isEditMode = editData !== null;
    const cartaSendoEditada = isEditMode ? JSON.parse(editData) : null;

    // Validação de nome repetido (ignora se for a própria carta sendo editada)
    const nomeExiste = deckJSON.some(c => c.nome.toLowerCase() === nomeAtual.toLowerCase() && (!isEditMode || c.id !== cartaSendoEditada.id));
    if (nomeExiste) {
        alert(`❌ Erro: Já existe uma carta chamada "${nomeAtual}" no deck!`);
        return;
    }

    const querSalvar = confirm(`Salvar módulo "${nomeAtual}" no arquivo?`);
    if (!querSalvar) return;

    const arestasAtivas = [];
    document.querySelectorAll('.inp-edge').forEach((cb) => {
        if (cb.checked) arestasAtivas.push(parseInt(cb.value));
    });

    const cardData = {
        id: isEditMode ? cartaSendoEditada.id : "MOD_" + Date.now().toString().slice(-6),
        nome: nomeAtual,
        tipo: document.getElementById('inp-tipo').value,
        upgraded: document.getElementById('inp-upgraded').checked,
        energia: parseInt(document.getElementById('inp-energia').value),
        usos: parseInt(document.getElementById('inp-usos').value),
        calor: parseInt(document.getElementById('inp-calor').value),
        arte: document.getElementById('inp-arte').value,
        arestasHex: arestasAtivas
    };

    if (cardData.tipo === 'arma') {
        cardData.dano = parseInt(document.getElementById('inp-dano').value);
        cardData.mira = {
            hex0: document.getElementById('inp-hex0').value,
            hex1_2: document.getElementById('inp-hex1').value,
            hex3: document.getElementById('inp-hex3').value
        };
    } else {
        cardData.descricao = document.getElementById('inp-desc').value;
    }

    // Se for modo edição, tenta carregar o deck base caso esteja vazio,
    // mas a funcionalidade de gravar exige a seleção do arquivo.
    if(isEditMode && deckJSON.length === 0) {
        // Em um ambiente sem servidor, a persistência do fileHandle entre sessões não é garantida.
        // Para atualizar o arquivo correto, o usuário precisará selecionar o arquivo.
        alert("Atenção: Como você está em modo edição, selecione o arquivo JSON do deck para atualizar.");
        try {
            [fileHandle] = await window.showOpenFilePicker({
                types: [{ description: 'JSON do Deck', accept: {'application/json': ['.json']} }]
            });
            const file = await fileHandle.getFile();
            const contents = await file.text();
            if(contents.trim() !== '') {
                deckJSON = JSON.parse(contents);
            }
        } catch (err) {
            console.warn("Operação cancelada.", err);
            return;
        }
    }

    if (isEditMode) {
        const index = deckJSON.findIndex(c => c.id === cartaSendoEditada.id);
        if (index > -1) {
            deckJSON[index] = cardData;
        } else {
            deckJSON.push(cardData); // Fallback caso a carta não seja encontrada no deck atual
        }
    } else {
        deckJSON.push(cardData);
    }

    refreshOutput();

    try {
        if (!fileHandle) {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: 'deck_modulos.json',
                types: [{ description: 'JSON do Deck', accept: {'application/json': ['.json']} }]
            });
        }

        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(deckJSON, null, 2));
        await writable.close();

        const btn = document.getElementById('btn-save');
        const txtOriginal = btn.innerText;
        btn.innerText = '✅ SALVO NO DISCO!';
        btn.style.background = '#2ea043';
        setTimeout(() => {
            btn.innerText = txtOriginal;
            btn.style.background = '';
            if(isEditMode) {
                localStorage.removeItem('moduloEmEdicao');
                window.location.href = 'modulos.html';
            }
        }, 1500);

    } catch (err) {
        console.error("Erro ao gravar o arquivo:", err);
        if(!isEditMode) deckJSON.pop();
        refreshOutput();
    }
}

function checarModoEdicao() {
    const editData = localStorage.getItem('moduloEmEdicao');
    if (editData) {
        const carta = JSON.parse(editData);

        document.getElementById('edit-stripes').style.display = 'block';
        document.getElementById('form-title').innerText = `✏️ Editando: ${carta.nome}`;
        document.getElementById('btn-cancel-edit').style.display = 'block';
        document.getElementById('btn-load').style.display = 'none';

        document.getElementById('inp-tipo').value = carta.tipo;
        document.getElementById('inp-upgraded').checked = carta.upgraded;
        document.getElementById('inp-nome').value = carta.nome;
        document.getElementById('inp-arte').value = carta.arte;
        document.getElementById('inp-energia').value = carta.energia;
        document.getElementById('inp-usos').value = carta.usos;
        document.getElementById('inp-calor').value = carta.calor;

        document.querySelectorAll('.inp-edge').forEach(cb => {
            cb.checked = carta.arestasHex.includes(parseInt(cb.value));
        });

        if (carta.tipo === 'arma') {
            document.getElementById('inp-dano').value = carta.dano;
            document.getElementById('inp-hex0').value = carta.mira.hex0;
            document.getElementById('inp-hex1').value = carta.mira.hex1_2;
            document.getElementById('inp-hex3').value = carta.mira.hex3;
        } else {
            document.getElementById('inp-desc').value = carta.descricao;
        }

        const btn = document.getElementById('btn-save');
        btn.innerText = "💾 Atualizar Edição no Arquivo";
        btn.style.background = "#d29922";

        updateCard();
    }
}

document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    localStorage.removeItem('moduloEmEdicao');
    window.location.href = 'modulos.html';
});

function gerarSvgHexagono(tipo) {
    const corAtiva = coresTipo[tipo] || '#f85149';
    let svgHTML = `<svg class="hex-svg" viewBox="0 0 100 100">`;
    svgHTML += `<polygon points="27.5,11 72.5,11 95,50 72.5,89 27.5,89 5,50" fill="#0d1117" stroke="#484f58" stroke-width="2"/>`;

    const checkboxes = document.querySelectorAll('.inp-edge');
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            const idx = parseInt(cb.value);
            const p1 = verticesHex[idx];
            const p2 = verticesHex[(idx + 1) % 6];
            svgHTML += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${corAtiva}" stroke-width="6" stroke-linecap="round"/>`;
        }
    });

    svgHTML += `</svg>`;
    return svgHTML;
}

function updateCard() {
    const tipo = document.getElementById('inp-tipo').value;
    const isUpgraded = document.getElementById('inp-upgraded').checked;
    const card = document.getElementById('card-preview');

    isUpgraded ? card.classList.add('upgraded') : card.classList.remove('upgraded');

    document.getElementById('out-nome').innerText = document.getElementById('inp-nome').value;
    document.getElementById('out-energia').innerText = `⚡ ${document.getElementById('inp-energia').value}`;
    document.getElementById('out-calor').innerText = `🔥 ${document.getElementById('inp-calor').value}`;

    const usosNum = parseInt(document.getElementById('inp-usos').value) || 0;
    document.getElementById('out-usos-slots').innerHTML = '<div class="uses-slot"></div>'.repeat(usosNum);

    const badge = document.getElementById('out-badge-tipo');
    const svgContainer = document.getElementById('out-svg-container');
    const statusRow = document.getElementById('out-status-row');
    const txtArte = document.getElementById('inp-arte').value.replace(/\n/g, '<br>');

    const svgPronto = gerarSvgHexagono(tipo);
    svgContainer.innerHTML = svgPronto + `<div class="art-text">${txtArte}</div>`;

    if (tipo === 'arma') {
        document.getElementById('panel-arma').classList.remove('hide');
        document.getElementById('panel-desc').classList.add('hide');

        document.getElementById('out-box-dano').classList.remove('hide');
        document.getElementById('out-tabela').classList.remove('hide');
        document.getElementById('out-desc').classList.add('hide');
        statusRow.classList.remove('status-row-utility');

        badge.className = 'badge badge-arma';
        badge.innerText = '🔴';
        document.getElementById('out-usos-lbl').innerText = 'TIROS';

        document.getElementById('out-dano').innerText = `💥 ${document.getElementById('inp-dano').value}`;

        ['0','1','3'].forEach(hex => {
            const val = document.getElementById(`inp-hex${hex}`).value;
            const el = document.getElementById(`out-hex${hex}`);
            el.innerText = val;
            el.className = (val.includes('X') || val.includes('-')) ? 'cell-bot val-miss' : 'cell-bot val-hit';
        });

    } else {
        document.getElementById('panel-arma').classList.add('hide');
        document.getElementById('panel-desc').classList.remove('hide');

        document.getElementById('out-box-dano').classList.add('hide');
        document.getElementById('out-tabela').classList.add('hide');
        document.getElementById('out-desc').classList.remove('hide');
        statusRow.classList.add('status-row-utility');

        document.getElementById('out-usos-lbl').innerText = 'USOS';
        document.getElementById('out-desc').innerHTML = document.getElementById('inp-desc').value;

        if (tipo === 'suporte') {
            badge.className = 'badge badge-suporte';
            badge.innerText = '🔵';
        } else if (tipo === 'propulsao') {
            badge.className = 'badge badge-propulsao';
            badge.innerText = '🟢';
        }
    }
}

function refreshOutput() {
    const output = document.getElementById('json-output');
    output.value = JSON.stringify(deckJSON, null, 2);
    output.scrollTop = output.scrollHeight;
}

document.querySelectorAll('.sidebar input, .sidebar select, .sidebar textarea').forEach(input => {
    input.addEventListener('input', updateCard);
    input.addEventListener('change', updateCard);
});

document.getElementById('btn-save').addEventListener('click', saveCardToJSON);
document.getElementById('btn-load').addEventListener('click', abrirArquivoDeck);

updateCard();
checarModoEdicao();