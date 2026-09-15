const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const tiposGerais = ['arma', 'suporte', 'propulsao', 'especial'];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e', especial: '#a855f7' };
const coresRaridade = { comum: '#484f58', incomum: '#38bdf8', raro: '#a855f7', unico: '#4ade80' };
const iconesTipo = { arma: '🔴', suporte: '🔵', propulsao: '🟢', especial: '🟣' };
const dicionarioSimbolos = { raio: '⚡', pilha: '🔋', coracao: '💖', escudo: '🛡️', seta: '🔼' };

let state = {
    tipo: 'arma', ato: 1, raridade: 'comum', upgraded: false,
    peso: 0, energia: 1, usos: 2, calor: 1, dano: 0,
    nome: 'NOME DA CARTA', arte: 'ARTE DA ARMA',
    arestas: [0, 1, 5], modo_inf: 'mira',
    mira: { hex0: 0, hex1: 0, hex3: 'X', hex3_label: '3+ hex' },
    desc: 'Descrição da carta aqui...',
    simbolos: { raio: 0, pilha: 0, coracao: 0, escudo: 0, seta: 0 }
};

window.addEventListener('DOMContentLoaded', () => {
    ligarEventosHUD();
    ligarEventosInline();
    renderizarCarta();
});

function ligarEventosHUD() {
    document.getElementById('ctrl-raridade').addEventListener('change', (e) => { state.raridade = e.target.value; renderizarCarta(); });
    document.getElementById('ctrl-ato').addEventListener('change', (e) => { state.ato = parseInt(e.target.value); renderizarCarta(); });
    document.getElementById('ctrl-upgraded').addEventListener('change', (e) => { state.upgraded = e.target.checked; renderizarCarta(); });

    document.getElementById('ctrl-range3').addEventListener('change', (e) => { state.mira.hex3_label = e.target.value; renderizarCarta(); });

    document.getElementById('ctrl-modo-inf').addEventListener('change', (e) => {
        state.modo_inf = e.target.value;
        document.getElementById('ctrl-mira-panel').classList.toggle('hide', state.modo_inf !== 'mira');
        document.getElementById('panel-simbolos').classList.toggle('hide', state.modo_inf !== 'simbolos');
        renderizarCarta();
    });

    document.getElementById('btn-export-png').addEventListener('click', exportarCartaPNG);
}

window.chgStat = function(prop, delta) {
    let v = state[prop] + delta;
    if (prop !== 'peso' && v < 0) v = 0;
    if (prop === 'usos' && v > 6) v = 6;
    state[prop] = v;
    renderizarCarta();
};

window.chgMira = function(hex, delta) {
    let val = state.mira[hex];
    if (val === 'X') val = 0;
    state.mira[hex] = val + delta;
    renderizarCarta();
};

window.setMiraX = function(hex) {
    state.mira[hex] = 'X';
    renderizarCarta();
};

window.chgSimb = function(id, delta) {
    let v = state.simbolos[id] + delta;
    if(v < 0) v = 0; if(v > 99) v = 99;
    state.simbolos[id] = v;
    renderizarCarta();
};

function ligarEventosInline() {
    document.getElementById('out-badge-tipo').addEventListener('click', () => {
        let idx = tiposGerais.indexOf(state.tipo);
        state.tipo = tiposGerais[(idx + 1) % tiposGerais.length];
        renderizarCarta();
    });

    document.getElementById('out-nome').addEventListener('blur', (e) => state.nome = e.target.innerText.trim());
    document.getElementById('out-desc').addEventListener('blur', (e) => state.desc = e.target.innerText.trim());
}

window.toggleEdge = function(edgeIdx) {
    if (state.arestas.includes(edgeIdx)) state.arestas = state.arestas.filter(e => e !== edgeIdx);
    else state.arestas.push(edgeIdx);
    renderizarCarta();
};

function renderizarCarta() {
    const card = document.getElementById('card-preview');
    state.upgraded ? card.classList.add('upgraded') : card.classList.remove('upgraded');

    if (document.activeElement.id !== 'out-nome') document.getElementById('out-nome').innerText = state.nome;
    if (document.activeElement.id !== 'out-desc') document.getElementById('out-desc').innerText = state.desc;

    document.getElementById('ctrl-raridade').value = state.raridade;
    document.getElementById('ctrl-ato').value = state.ato;
    document.getElementById('ctrl-modo-inf').value = state.modo_inf;

    ['energia', 'calor', 'dano'].forEach(p => {
        document.getElementById(`disp-${p}`).innerText = state[p];
        document.getElementById(`out-${p}`).innerText = state[p];
    });

    document.getElementById('disp-usos').innerText = state.usos;
    document.getElementById('out-usos-slots').innerHTML = '<div class="uses-slot"></div>'.repeat(state.usos);

    document.getElementById('disp-peso').innerText = state.peso;
    document.getElementById('out-peso').innerText = Math.abs(state.peso);
    document.getElementById('peso-icon').innerText = state.peso >= 0 ? '🏋️' : '🪶';

    const badge = document.getElementById('out-badge-tipo');
    badge.className = `badge badge-${state.tipo} clickable-icon`;
    badge.innerText = iconesTipo[state.tipo];

    const corAtiva = coresTipo[state.tipo] || '#f85149';
    let linhasHTML = '';
    const corLinha = coresRaridade[state.raridade] || '#484f58';
    for (let i = 0; i < state.ato; i++) {
        linhasHTML += `<div class="bg-line" style="background-color: ${corLinha};"></div>`;
    }

    let svgLines = '';
    for(let i=0; i<6; i++) {
        const isActive = state.arestas.includes(i);
        const color = isActive ? corAtiva : 'rgba(255,255,255,0.05)';
        const width = isActive ? 6 : 14;
        const p1 = verticesHex[i];
        const p2 = verticesHex[(i + 1) % 6];
        svgLines += `<line class="hex-edge" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" 
                      stroke="${color}" stroke-width="${width}" stroke-linecap="round" onclick="toggleEdge(${i})"/>`;
    }

    document.getElementById('out-svg-container').innerHTML = `
        <div class="bg-lines-container">${linhasHTML}</div>
        <svg class="hex-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <polygon points="27.5,11 72.5,11 95,50 72.5,89 27.5,89 5,50" fill="#0d1117" stroke="#484f58" stroke-width="2"/>
            ${svgLines}
        </svg>
        <div class="art-text editable-text" id="out-arte-text" contenteditable="true">${state.arte.replace(/\n/g, '<br>')}</div>
    `;

    document.getElementById('out-arte-text').addEventListener('blur', (e) => state.arte = e.target.innerText.trim());

    document.getElementById('out-box-energia').classList.toggle('val-0', state.energia === 0);
    document.getElementById('out-box-calor').classList.toggle('val-0', state.calor === 0);
    document.getElementById('out-box-usos').classList.toggle('val-0', state.usos === 0);
    document.getElementById('out-box-dano').classList.toggle('val-0', state.dano === 0);
    document.getElementById('out-box-peso').classList.toggle('val-0', state.peso === 0);

    document.getElementById('out-tabela').classList.add('hide');
    document.getElementById('out-desc').classList.add('hide');
    document.getElementById('out-simbolos').classList.add('hide');
    document.getElementById('ctrl-mira-panel').classList.add('hide');

    if (state.modo_inf === 'mira') {
        document.getElementById('out-tabela').classList.remove('hide');
        document.getElementById('ctrl-mira-panel').classList.remove('hide');
        document.getElementById('out-hex3-label').innerText = state.mira.hex3_label;
        document.getElementById('ctrl-range3').value = state.mira.hex3_label;

        ['0','1','3'].forEach(hex => {
            const val = state.mira[`hex${hex}`];
            document.getElementById(`disp-hex${hex}`).innerText = val;
            const el = document.getElementById(`out-hex${hex}`);
            el.innerText = val;

            if (val === 'X' || (typeof val === 'number' && val < 0)) el.className = 'cell-bot val-miss'; // Vermelho
            else if (val === 0) el.className = 'cell-bot val-neutral'; // Branco
            else el.className = 'cell-bot val-hit'; // Verde
        });
    }
    else if (state.modo_inf === 'texto') {
        document.getElementById('out-desc').classList.remove('hide');
    }
    else if (state.modo_inf === 'simbolos') {
        const simbBox = document.getElementById('out-simbolos');
        simbBox.classList.remove('hide');

        // Atualiza a visualização do HUD!
        Object.keys(dicionarioSimbolos).forEach(id => {
            document.getElementById(`simb-${id}`).innerText = state.simbolos[id];
        });

        let simbStr = '';
        Object.keys(dicionarioSimbolos).forEach(id => {
            if (state.simbolos[id] > 0) {
                if (simbStr !== '') simbStr += ' ';
                simbStr += (state.simbolos[id] <= 3) ? dicionarioSimbolos[id].repeat(state.simbolos[id]) : `${dicionarioSimbolos[id]} ${state.simbolos[id]}`;
            }
        });
        simbBox.innerText = simbStr || 'Vazio';

        const strLen = Array.from(simbStr).length;
        if (strLen < 6) simbBox.style.fontSize = '34px';
        else if (strLen < 12) simbBox.style.fontSize = '26px';
        else if (strLen < 18) simbBox.style.fontSize = '20px';
        else simbBox.style.fontSize = '16px';
    }
}

async function exportarCartaPNG() {
    const cardElement = document.getElementById('card-preview');
    const nomeFormatado = state.nome.toLowerCase().replace(/\s+/g, '_') || 'modulo';
    const sufixo = state.upgraded ? '-u' : '';
    const nomeArquivo = `${nomeFormatado}${sufixo}.png`;

    cardElement.classList.add('export-mode');
    await new Promise(r => setTimeout(r, 100));

    try {
        const canvas = await html2canvas(cardElement, { scale: 3, backgroundColor: null, useCORS: true });
        const link = document.createElement('a');
        link.download = nomeArquivo;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error("Erro ao gerar PNG:", err);
        alert("❌ Ocorreu um erro ao exportar a imagem da carta.");
    } finally {
        cardElement.classList.remove('export-mode');
    }
}