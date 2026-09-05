const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e' };

let deckJSON = [];
let fileHandle = null;

// INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
    // 1. Liga os botões
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        localStorage.removeItem('moduloEmEdicao');
        window.location.href = 'modulos.html';
    });

    document.querySelectorAll('.sidebar input, .sidebar select, .sidebar textarea').forEach(input => {
        input.addEventListener('input', updateCard);
        input.addEventListener('change', updateCard);
    });

    document.getElementById('btn-save').addEventListener('click', saveCardToJSON);
    document.getElementById('btn-export-png').addEventListener('click', exportarCartaPNG);
    const btnLoad = document.getElementById('btn-load');
    if (btnLoad) {
        btnLoad.innerText = "📂 Carregar Deck Base";
        btnLoad.addEventListener('click', abrirArquivoDeck);
    }

    checarModoEdicao();
    updateCard();
});

// FUNÇÕES DE DISCO
async function abrirArquivoDeck() {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            id: 'deck_modulos_id',
            types: [{ description: 'JSON do Deck', accept: {'application/json': ['.json']} }]
        });
        const file = await fileHandle.getFile();
        const contents = await file.text();

        deckJSON = contents.trim() !== '' ? JSON.parse(contents) : [];
        refreshOutput();
        alert(`✅ Deck carregado! Cartas atuais: ${deckJSON.length}`);
        return true;
    } catch (err) {
        console.warn("Cancelado.", err);
        return false;
    }
}

async function saveCardToJSON() {
    const nomeAtual = document.getElementById('inp-nome').value.trim();
    const editData = localStorage.getItem('moduloEmEdicao');
    const isEditMode = editData !== null;
    const cartaSendoEditada = isEditMode ? JSON.parse(editData) : null;

    if (!fileHandle) {
        alert("🔒Seleciona o arquivo 'deck_modulos.json' original.\nIsso garante que a nova carta vai entrar nele em vez de baixar um arquivo novo.");
        const abriu = await abrirArquivoDeck();
        if (!abriu) return;
    }

    const nomeExiste = deckJSON.some(c => c.nome.toLowerCase() === nomeAtual.toLowerCase() && (!isEditMode || c.id !== cartaSendoEditada.id));
    if (nomeExiste) {
        alert(`❌ Já existe uma carta chamada "${nomeAtual}" no deck`);
        return;
    }

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

    if (isEditMode) {
        const index = deckJSON.findIndex(c => c.id === cartaSendoEditada.id);
        if (index > -1) {
            deckJSON[index] = cardData;
        } else {
            deckJSON.push(cardData);
        }
    } else {
        deckJSON.push(cardData);
    }

    refreshOutput();

    try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(deckJSON, null, 2));
        await writable.close();

        const btn = document.getElementById('btn-save');
        const txtOriginal = btn.innerText;
        btn.innerText = '✅ SALVO!';
        btn.style.background = '#2ea043';

        setTimeout(() => {
            btn.innerText = txtOriginal;
            btn.style.background = '';
            if (isEditMode) {
                localStorage.removeItem('moduloEmEdicao');
                window.location.href = 'modulos.html';
            }
        }, 1500);

    } catch (err) {
        console.error("Erro ao gravar:", err);
        alert("Erro ao gravar o arquivo! Ve aí se o arquivo não ta aberto em outro programa.");
        if (!isEditMode) deckJSON.pop(); // Remove a carta da memória caso dê erro na gravação
        refreshOutput();
    }
}

// FUNÇÕES VISUAIS
function checarModoEdicao() {
    const editData = localStorage.getItem('moduloEmEdicao');
    if (editData) {
        try {
            const carta = JSON.parse(editData);

            const stripes = document.getElementById('edit-stripes');
            if(stripes) stripes.style.display = 'block';

            const formTitle = document.getElementById('form-title');
            if(formTitle) formTitle.innerText = `✏️ Editando: ${carta.nome}`;

            const btnCancel = document.getElementById('btn-cancel-edit');
            if(btnCancel) btnCancel.style.display = 'block';

            const btnLoad = document.getElementById('btn-load');
            if (btnLoad) btnLoad.style.display = 'none';

            document.getElementById('inp-tipo').value = carta.tipo || 'arma';
            document.getElementById('inp-upgraded').checked = !!carta.upgraded;
            document.getElementById('inp-nome').value = carta.nome || '';
            document.getElementById('inp-arte').value = carta.arte || '';
            document.getElementById('inp-energia').value = carta.energia !== undefined ? carta.energia : 1;
            document.getElementById('inp-usos').value = carta.usos !== undefined ? carta.usos : 2;
            document.getElementById('inp-calor').value = carta.calor !== undefined ? carta.calor : 1;

            const arestas = carta.arestasHex || [];
            document.querySelectorAll('.inp-edge').forEach(cb => {
                cb.checked = arestas.includes(parseInt(cb.value));
            });

            if (carta.tipo === 'arma') {
                document.getElementById('inp-dano').value = carta.dano || 0;
                const mira = carta.mira || {hex0: '', hex1_2: '', hex3: ''};
                document.getElementById('inp-hex0').value = mira.hex0;
                document.getElementById('inp-hex1').value = mira.hex1_2;
                document.getElementById('inp-hex3').value = mira.hex3;
            } else {
                document.getElementById('inp-desc').value = carta.descricao || '';
            }

            const btn = document.getElementById('btn-save');
            btn.innerText = "💾 Atualizar Edição no Arquivo";
            btn.style.background = "#d29922";
        } catch (e) {
            console.error("Erro ao carregar dados de edição:", e);
        }
    }
}

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

    const hexContainer = document.getElementById('hex-selector-container');
    if (hexContainer) {
        hexContainer.className = `hex-grid-selector tipo-${tipo}`;
    }

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

async function exportarCartaPNG() {
    const cardElement = document.getElementById('card-preview');
    const nomeRaw = document.getElementById('inp-nome').value.trim() || 'modulo';
    const isUpgraded = document.getElementById('inp-upgraded').checked;

    const nomeFormatado = nomeRaw.toLowerCase().replace(/\s+/g, '_');
    const sufixo = isUpgraded ? '-u' : '';
    const nomeArquivo = `${nomeFormatado}${sufixo}.png`;

    try {
        const canvas = await html2canvas(cardElement, {
            scale: 3,
            backgroundColor: null,
            useCORS: true
        });

        const link = document.createElement('a');
        link.download = nomeArquivo;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Erro ao gerar PNG:", err);
        alert("❌ Ocorreu um erro ao exportar a imagem da carta.");
    }
}

function refreshOutput() {
    const output = document.getElementById('json-output');
    if(output) {
        output.value = JSON.stringify(deckJSON, null, 2);
        output.scrollTop = output.scrollHeight;
    }
}