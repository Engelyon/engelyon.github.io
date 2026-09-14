const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const tiposGerais = ['arma', 'suporte', 'propulsao', 'especial'];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e', especial: '#a855f7' };
const coresRaridade = { comum: '#484f58', incomum: '#38bdf8', raro: '#a855f7', unico: '#4ade80' };
const iconesTipo = { arma: '🔴', suporte: '🔵', propulsao: '🟢', especial: '🟣' };
const dicionarioSimbolos = { raio: '⚡', pilha: '🔋', coracao: '💖', escudo: '🛡️', seta: '🔼' };

let state = {
    tipo: 'arma',
    ato: 1,
    raridade: 'comum',
    upgraded: false,
    peso: 0,
    energia: 1,
    usos: 2,
    calor: 1,
    dano: 0,
    nome: 'NOME DA CARTA',
    arte: 'ARTE DA ARMA',
    arestas: [0, 1, 5],
    modo_inf: 'texto',
    mira: { hex0: '-', hex1: '-', hex3: '-', hex3_label: '3+ hex' },
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
        // Mostra a opção Long Range se for mira
        document.getElementById('ctrl-group-range3').classList.toggle('hide', state.modo_inf !== 'mira');
        document.getElementById('panel-simbolos').classList.toggle('hide', state.modo_inf !== 'simbolos');
        renderizarCarta();
    });

    document.getElementById('btn-export-png').addEventListener('click', exportarCartaPNG);
}

window.chgUsos = function(delta) {
    let v = state.usos + delta;
    if(v < 0) v = 0; if(v > 6) v = 6;
    state.usos = v;
    document.getElementById('disp-usos').innerText = v;
    renderizarCarta();
};

window.chgSimb = function(id, delta) {
    let v = state.simbolos[id] + delta;
    if(v < 0) v = 0; if(v > 99) v = 99;
    state.simbolos[id] = v;
    document.getElementById(`simb-${id}`).innerText = v;
    renderizarCarta();
};

function ligarEventosInline() {
    document.getElementById('out-badge-tipo').addEventListener('click', () => {
        let idx = tiposGerais.indexOf(state.tipo);
        state.tipo = tiposGerais[(idx + 1) % tiposGerais.length];
        renderizarCarta();
    });

    document.getElementById('peso-icon').addEventListener('click', () => {
        if (state.peso === 0) state.peso = 1;
        else state.peso = -state.peso;
        renderizarCarta();
    });

    document.getElementById('out-nome').addEventListener('blur', (e) => state.nome = e.target.innerText.trim());
    document.getElementById('out-desc').addEventListener('blur', (e) => state.desc = e.target.innerText.trim());

    ['0', '1', '3'].forEach(h => {
        document.getElementById(`out-hex${h}`).addEventListener('blur', (e) => state.mira[`hex${h}`] = e.target.innerText.trim());
    });

    const capNum = (elId, propName) => {
        document.getElementById(elId).addEventListener('blur', (e) => {
            let v = parseInt(e.target.innerText);
            if (isNaN(v)) v = 0;
            if (propName === 'peso') state[propName] = state.peso < 0 ? -Math.abs(v) : Math.abs(v);
            else state[propName] = Math.abs(v);
            renderizarCarta();
        });
    };
    capNum('out-energia', 'energia');
    capNum('out-calor', 'calor');
    capNum('out-dano', 'dano');
    capNum('out-peso', 'peso');
}

window.toggleEdge = function(edgeIdx) {
    if (state.arestas.includes(edgeIdx)) {
        state.arestas = state.arestas.filter(e => e !== edgeIdx);
    } else {
        state.arestas.push(edgeIdx);
    }
    renderizarCarta();
};

// MÁQUINA DE RENDERIZAÇÃO
function renderizarCarta() {
    const card = document.getElementById('card-preview');
    state.upgraded ? card.classList.add('upgraded') : card.classList.remove('upgraded');

    const setIfNoFocus = (id, val) => { if (document.activeElement.id !== id) document.getElementById(id).innerText = val; };

    setIfNoFocus('out-nome', state.nome);
    setIfNoFocus('out-energia', state.energia);
    setIfNoFocus('out-calor', state.calor);
    setIfNoFocus('out-dano', state.dano);
    setIfNoFocus('out-peso', Math.abs(state.peso));
    setIfNoFocus('out-desc', state.desc);
    setIfNoFocus('out-hex0', state.mira.hex0);
    setIfNoFocus('out-hex1', state.mira.hex1);
    setIfNoFocus('out-hex3', state.mira.hex3);

    document.getElementById('peso-icon').innerText = state.peso >= 0 ? '🏋️' : '🪶';

    const badge = document.getElementById('out-badge-tipo');
    badge.className = `badge badge-${state.tipo} clickable-icon`;
    badge.innerText = iconesTipo[state.tipo];

    document.getElementById('out-usos-slots').innerHTML = '<div class="uses-slot"></div>'.repeat(state.usos);

    const corAtiva = coresTipo[state.tipo] || '#f85149';
    let linhasHTML = '';
    const corLinha = coresRaridade[state.raridade] || '#484f58';
    for (let i = 0; i < state.ato; i++) linhasHTML += `<div class="bg-line" style="background-color: ${corLinha};"></div>`;

    let svgLines = '';
    for(let i=0; i<6; i++) {
        const isActive = state.arestas.includes(i);
        const color = isActive ? corAtiva : 'rgba(255,255,255,0.05)';
        const width = isActive ? 6 : 14; // Borda inativa mais grossa p/ facilitar o clique
        const p1 = verticesHex[i];
        const p2 = verticesHex[(i + 1) % 6];
        svgLines += `<line class="hex-edge" x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" 
                      stroke="${color}" stroke-width="${width}" stroke-linecap="round" onclick="toggleEdge(${i})"/>`;
    }

    document.getElementById('out-svg-container').innerHTML = `
        <div class="bg-lines-container">${linhasHTML}</div>
        <svg class="hex-svg" viewBox="0 0 100 100">
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

    if (state.modo_inf === 'mira') {
        document.getElementById('out-tabela').classList.remove('hide');
        document.getElementById('out-hex3-label').innerText = state.mira.hex3_label;

        ['0','1','3'].forEach(hex => {
            const val = state.mira[`hex${hex}`];
            const el = document.getElementById(`out-hex${hex}`);
            el.className = `cell-bot editable-text ${ (val.includes('X') || val.includes('-')) ? 'val-miss' : 'val-hit' }`;
        });
    }
    else if (state.modo_inf === 'texto') {
        document.getElementById('out-desc').classList.remove('hide');
    }
    else if (state.modo_inf === 'simbolos') {
        const simbBox = document.getElementById('out-simbolos');
        simbBox.classList.remove('hide');
        let simbStr = '';
        Object.keys(dicionarioSimbolos).forEach(id => {
            if (state.simbolos[id] > 0) {
                if (simbStr !== '') simbStr += ' ';
                simbStr += (state.simbolos[id] <= 3) ? dicionarioSimbolos[id].repeat(state.simbolos[id]) : `${dicionarioSimbolos[id]} ${state.simbolos[id]}`;
            }
        });
        simbBox.innerText = simbStr || 'Vazio'; // Placeholder se 0
        const strLen = Array.from(simbStr).length;
        if (strLen < 6) simbBox.style.fontSize = '34px';
        else if (strLen < 12) simbBox.style.fontSize = '26px';
        else if (strLen < 18) simbBox.style.fontSize = '20px';
        else simbBox.style.fontSize = '16px';
    }
}

// EXPORTAÇÃO
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
        cardElement.classList.remove('export-mode'); // Devolve o modo edição
    }
}