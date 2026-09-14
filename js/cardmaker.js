const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e', especial: '#a855f7' };
const dicionarioSimbolos = { raio: '⚡', pilha: '🔋', coracao: '💖', escudo: '🛡️', seta: '🔼' };

let deckJSON = [];
let fileHandle = null;

window.addEventListener('DOMContentLoaded', () => {
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

window.chgSimb = function(id, delta) {
    const el = document.getElementById(`simb-${id}`);
    let val = parseInt(el.innerText) + delta;
    if(val < 0) val = 0;
    if(val > 99) val = 99;
    el.innerText = val;
    updateCard();
};

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
        alert("🔒 Selecione o arquivo 'deck_modulos.json' original.");
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
        peso: parseInt(document.getElementById('inp-peso').value) || 0,
        energia: parseInt(document.getElementById('inp-energia').value) || 0,
        usos: parseInt(document.getElementById('inp-usos').value) || 0,
        calor: parseInt(document.getElementById('inp-calor').value) || 0,
        arte: document.getElementById('inp-arte').value,
        arestasHex: arestasAtivas,
        modo_inferior: document.getElementById('inp-modo-inf').value
    };

    if (cardData.modo_inferior === 'simbolos') {
        cardData.simbolos = {
            raio: parseInt(document.getElementById('simb-raio').innerText) || 0,
            pilha: parseInt(document.getElementById('simb-pilha').innerText) || 0,
            coracao: parseInt(document.getElementById('simb-coracao').innerText) || 0,
            escudo: parseInt(document.getElementById('simb-escudo').innerText) || 0,
            seta: parseInt(document.getElementById('simb-seta').innerText) || 0
        };
    }

    if (cardData.tipo === 'arma') {
        cardData.dano = parseInt(document.getElementById('inp-dano').value) || 0;
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
        if (index > -1) deckJSON[index] = cardData;
        else deckJSON.push(cardData);
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
        if (!isEditMode) deckJSON.pop();
        refreshOutput();
    }
}

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
            document.getElementById('inp-peso').value = carta.peso !== undefined ? carta.peso : 0;
            document.getElementById('inp-arte').value = carta.arte || '';
            document.getElementById('inp-energia').value = carta.energia !== undefined ? carta.energia : 0;
            document.getElementById('inp-usos').value = carta.usos !== undefined ? carta.usos : 0;
            document.getElementById('inp-calor').value = carta.calor !== undefined ? carta.calor : 0;

            document.getElementById('inp-modo-inf').value = carta.modo_inferior || 'auto';

            if (carta.simbolos) {
                Object.keys(dicionarioSimbolos).forEach(id => {
                    document.getElementById(`simb-${id}`).innerText = carta.simbolos[id] || 0;
                });
            }

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
    const modoInf = document.getElementById('inp-modo-inf').value;
    const card = document.getElementById('card-preview');

    const hexContainer = document.getElementById('hex-selector-container');
    if (hexContainer) hexContainer.className = `hex-grid-selector tipo-${tipo}`;

    isUpgraded ? card.classList.add('upgraded') : card.classList.remove('upgraded');

    const nome = document.getElementById('inp-nome').value;
    const peso = parseInt(document.getElementById('inp-peso').value) || 0;
    let nomeStr = nome;
    if (peso !== 0) {
        const sinal = peso > 0 ? '+' : '';
        nomeStr += `<span style="float:right; font-size: 0.8em; color: #a8a8a8;">⚖️ ${sinal}${peso}</span>`;
    }
    document.getElementById('out-nome').innerHTML = nomeStr;

    const energia = parseInt(document.getElementById('inp-energia').value) || 0;
    const outEnergia = document.getElementById('out-energia');
    if (energia === 0) outEnergia.classList.add('invisible');
    else { outEnergia.classList.remove('invisible'); outEnergia.innerText = `⚡ ${energia}`; }

    const calor = parseInt(document.getElementById('inp-calor').value) || 0;
    const boxCalor = document.getElementById('out-box-calor');
    if (calor === 0) boxCalor.classList.add('invisible');
    else { boxCalor.classList.remove('invisible'); document.getElementById('out-calor').innerText = `🔥 ${calor}`; }

    const usos = parseInt(document.getElementById('inp-usos').value) || 0;
    const boxUsos = document.getElementById('out-box-usos');
    if (usos === 0) boxUsos.classList.add('invisible');
    else { boxUsos.classList.remove('invisible'); document.getElementById('out-usos-slots').innerHTML = '<div class="uses-slot"></div>'.repeat(usos); }

    const dano = parseInt(document.getElementById('inp-dano').value) || 0;
    const boxDano = document.getElementById('out-box-dano');
    if (tipo !== 'arma' || dano === 0) boxDano.classList.add('invisible');
    else { boxDano.classList.remove('invisible'); document.getElementById('out-dano').innerText = `💥 ${dano}`; }

    const badge = document.getElementById('out-badge-tipo');
    if (tipo === 'arma') { badge.className = 'badge badge-arma'; badge.innerText = '🔴'; }
    else if (tipo === 'suporte') { badge.className = 'badge badge-suporte'; badge.innerText = '🔵'; }
    else if (tipo === 'propulsao') { badge.className = 'badge badge-propulsao'; badge.innerText = '🟢'; }
    else if (tipo === 'especial') { badge.className = 'badge badge-especial'; badge.innerText = '🟣'; }

    const svgContainer = document.getElementById('out-svg-container');
    const txtArte = document.getElementById('inp-arte').value.replace(/\n/g, '<br>');
    svgContainer.innerHTML = gerarSvgHexagono(tipo) + `<div class="art-text">${txtArte}</div>`;

    document.getElementById('panel-dano').classList.add('hide');
    document.getElementById('panel-mira').classList.add('hide');
    document.getElementById('panel-desc').classList.add('hide');
    document.getElementById('panel-simbolos').classList.add('hide');

    if (tipo === 'arma') document.getElementById('panel-dano').classList.remove('hide');

    if (modoInf === 'simbolos') {
        document.getElementById('panel-simbolos').classList.remove('hide');
    } else {
        if (tipo === 'arma') document.getElementById('panel-mira').classList.remove('hide');
        else document.getElementById('panel-desc').classList.remove('hide');
    }

    document.getElementById('out-tabela').classList.add('hide');
    document.getElementById('out-desc').classList.add('hide');
    document.getElementById('out-simbolos').classList.add('hide');
    const statusRow = document.getElementById('out-status-row');

    if (tipo === 'arma') {
        document.getElementById('out-usos-lbl').innerText = 'TIROS';
        ['0','1','3'].forEach(hex => {
            const val = document.getElementById(`inp-hex${hex}`).value;
            const el = document.getElementById(`out-hex${hex}`);
            el.innerText = val;
            el.className = (val.includes('X') || val.includes('-')) ? 'cell-bot val-miss' : 'cell-bot val-hit';
        });
    } else {
        document.getElementById('out-usos-lbl').innerText = 'USOS';
        document.getElementById('out-desc').innerHTML = document.getElementById('inp-desc').value;
    }

    if (modoInf === 'simbolos') {
        const simbBox = document.getElementById('out-simbolos');
        simbBox.classList.remove('hide');

        let simbStr = '';
        Object.keys(dicionarioSimbolos).forEach(id => {
            const qtd = parseInt(document.getElementById(`simb-${id}`).innerText) || 0;
            if (qtd > 0) {
                if (simbStr !== '') simbStr += ' ';
                simbStr += (qtd <= 3) ? dicionarioSimbolos[id].repeat(qtd) : `${dicionarioSimbolos[id]} ${qtd}`;
            }
        });

        simbBox.innerText = simbStr;

        const strLen = Array.from(simbStr).length;
        if (strLen < 6) simbBox.style.fontSize = '34px';
        else if (strLen < 12) simbBox.style.fontSize = '26px';
        else if (strLen < 18) simbBox.style.fontSize = '20px';
        else simbBox.style.fontSize = '16px';

    } else {
        if (tipo === 'arma') document.getElementById('out-tabela').classList.remove('hide');
        else document.getElementById('out-desc').classList.remove('hide');
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
        const canvas = await html2canvas(cardElement, { scale: 3, backgroundColor: null, useCORS: true });
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