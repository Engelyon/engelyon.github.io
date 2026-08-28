const verticesHex = [[27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e' };

let deckCompleto = [];
let currentActiveCardId = null;
let fileHandle = null;

// INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
    localStorage.removeItem('moduloEmEdicao');
    // Liga os Filtros
    document.getElementById('filter-tipo').addEventListener('change', renderizarGaleria);
    document.getElementById('filter-energia').addEventListener('change', renderizarGaleria);
    document.getElementById('filter-usos').addEventListener('change', renderizarGaleria);

    // Liga os botões do Modal
    document.getElementById('btn-modal-delete').addEventListener('click', deletarCartaModal);
    document.getElementById('btn-modal-edit').addEventListener('click', editarCartaModal);
    document.getElementById('btn-modal-close').addEventListener('click', fecharModal);

    const modal = document.getElementById('modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) fecharModal();
    });

    document.getElementById('gallery-grid').addEventListener('dblclick', abrirModalDuploClique);

    // Liga o botão de abrir arquivo manual
    const btnLoadJson = document.getElementById('btn-load-json');
    if (btnLoadJson) {
        btnLoadJson.innerText = "📂 Carregar deck_modulos.json";
        btnLoadJson.addEventListener('click', carregarArquivoManual);
    }
});

// FUNÇÕES DO SISTEMA E GALERIA
async function carregarArquivoManual() {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            id: 'deck_modulos_id',
            types: [{ description: 'JSON do Deck', accept: {'application/json': ['.json']} }]
        });
        const file = await fileHandle.getFile();
        const contents = await file.text();

        if (contents.trim() !== '') {
            deckCompleto = JSON.parse(contents);
            renderizarGaleria();
        }
    } catch (err) {
        console.warn("Cancelado.", err);
    }
}

function buildSVG(tipo, arestasHex) {
    const corAtiva = coresTipo[tipo] || '#f85149';
    let svg = `<svg class="hex-svg" viewBox="0 0 100 100">`;
    svg += `<polygon points="27.5,11 72.5,11 95,50 72.5,89 27.5,89 5,50" fill="#0d1117" stroke="#484f58" stroke-width="2"/>`;

    arestasHex.forEach(idx => {
        const p1 = verticesHex[idx];
        const p2 = verticesHex[(idx + 1) % 6];
        svg += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${corAtiva}" stroke-width="6" stroke-linecap="round"/>`;
    });
    svg += `</svg>`;
    return svg;
}

function gerarHTMLCarta(cardData) {
    const isUpgraded = cardData.upgraded ? 'upgraded' : '';
    const emojis = { arma: '🔴', suporte: '🔵', propulsao: '🟢' };
    const slotsUsos = '<div class="uses-slot"></div>'.repeat(cardData.usos);
    let mioloStatus = '';

    if (cardData.tipo === 'arma') {
        const mira = cardData.mira || {hex0:'', hex1_2:'', hex3:''};
        const hitMiss = (val) => (val.includes('X') || val.includes('-')) ? 'val-miss' : 'val-hit';
        mioloStatus = `
                <div class="status-row">
                    <div class="stat-box dmg-box"><div class="dmg-val">💥 ${cardData.dano || 0}</div><div class="dmg-lbl">DANO</div></div>
                    <div class="uses-track"><div class="uses-lbl">TIROS</div><div class="uses-slots">${slotsUsos}</div></div>
                    <div class="stat-box heat-gen-box"><div class="heat-gen-val">🔥 ${cardData.calor || 0}</div><div class="heat-gen-lbl">CALOR</div></div>
                </div>
                <div class="name-plate">${cardData.nome}</div>
                <div class="range-table">
                    <div class="range-grid">
                        <div class="grid-cell"><div class="cell-top">0 hex</div><div class="cell-bot ${hitMiss(mira.hex0)}">${mira.hex0}</div></div>
                        <div class="grid-cell"><div class="cell-top">1-2 hex</div><div class="cell-bot ${hitMiss(mira.hex1_2)}">${mira.hex1_2}</div></div>
                        <div class="grid-cell"><div class="cell-top">3+ hex</div><div class="cell-bot ${hitMiss(mira.hex3)}">${mira.hex3}</div></div>
                    </div>
                </div>
            `;
    } else {
        mioloStatus = `
                <div class="status-row status-row-utility">
                    <div class="uses-track"><div class="uses-lbl">USOS</div><div class="uses-slots">${slotsUsos}</div></div>
                    <div class="stat-box heat-gen-box"><div class="heat-gen-val">🔥 ${cardData.calor || 0}</div><div class="heat-gen-lbl">CALOR</div></div>
                </div>
                <div class="name-plate">${cardData.nome}</div>
                <div class="desc-box">${cardData.descricao || ''}</div>
            `;
    }

    return `
            <div class="card-wrapper" data-id="${cardData.id}" title="Duplo-clique para ampliar">
                <div class="card ${isUpgraded}">
                    <div class="top-bar">
                        <div class="badge energy">⚡ ${cardData.energia || 0}</div>
                        <div class="badge badge-${cardData.tipo}">${emojis[cardData.tipo] || '⚪'}</div>
                    </div>
                    <div class="art-container">
                        ${buildSVG(cardData.tipo, cardData.arestasHex || [])}
                        <div class="art-text">${(cardData.arte || '').replace(/\n/g, '<br>')}</div>
                    </div>
                    ${mioloStatus}
                </div>
            </div>
        `;
}

function renderizarGaleria() {
    const grid = document.getElementById('gallery-grid');
    const fTipo = document.getElementById('filter-tipo').value;
    const fEnergia = document.getElementById('filter-energia').value;
    const fUsos = document.getElementById('filter-usos').value;

    const deckFiltrado = deckCompleto.filter(carta => {
        let passaTipo = (fTipo === 'all' || carta.tipo === fTipo);
        let passaEnergia = (fEnergia === 'all' || carta.energia === parseInt(fEnergia));
        let passaUsos = true;

        if (fUsos !== 'all') {
            if (fUsos === '4') passaUsos = (carta.usos >= 4);
            else passaUsos = (carta.usos === parseInt(fUsos));
        }
        return passaTipo && passaEnergia && passaUsos;
    });

    document.getElementById('count-display').innerText = deckFiltrado.length;
    grid.innerHTML = '';
    deckFiltrado.forEach(carta => {
        grid.innerHTML += gerarHTMLCarta(carta);
    });
}

function abrirModalDuploClique(e) {
    const wrapper = e.target.closest('.card-wrapper');
    if (wrapper) {
        currentActiveCardId = wrapper.getAttribute('data-id');
        const cartaSelecionada = deckCompleto.find(c => c.id === currentActiveCardId);

        document.getElementById('modal-card-slot').innerHTML = gerarHTMLCarta(cartaSelecionada);
        document.getElementById('modal').classList.add('active');
    }
}

async function deletarCartaModal() {
    const carta = deckCompleto.find(c => c.id === currentActiveCardId);
    const confirmacao = confirm(`🚨 Tem certeza absoluta qua vai apagar "${carta.nome}"?`);

    if (confirmacao) {
        deckCompleto = deckCompleto.filter(c => c.id !== currentActiveCardId);

        if (fileHandle) {
            try {
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(deckCompleto, null, 2));
                await writable.close();
                alert(`Módulo "${carta.nome}" apagado!`);
            } catch (err) {
                alert("Erro ao gravar no arquivo. Verifique se ele não está aberto em outro programa.");
            }
        } else {
            alert("⚠️!!! Como você não carregou o arquivo pelo botão azul no topo da página, a carta foi apagada só da tela. Carrega o arquivo primeiro se quiser apagar de vdd.");
        }

        fecharModal();
        renderizarGaleria();
    }
}

function editarCartaModal() {
    const carta = deckCompleto.find(c => c.id === currentActiveCardId);

    localStorage.setItem('moduloEmEdicao', JSON.stringify(carta));
    window.location.href = 'cardmaker.html';
}

function fecharModal() {
    document.getElementById('modal').classList.remove('active');
    currentActiveCardId = null;
}