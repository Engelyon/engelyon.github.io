// --- CONFIGURAÇÃO DA API DO GITHUB ---
const GITHUB_CONFIG = {
    owner: "SEU_USUARIO_AQUI",
    repo: "NOME_DO_REPOSITORIO_AQUI",
    path: "modulos/deck_modulos.json",
    branch: "main"
};

const verticesHex = [[27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e' };

let deckCompleto = [];
let currentActiveCardId = null;

// 1. CARREGAMENTO AUTOMÁTICO VIA GITHUB PAGES
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(`./modulos/deck_modulos.json?t=${new Date().getTime()}`);
        if (response.ok) {
            deckCompleto = await response.json();
            renderizarGaleria();
        }
    } catch (e) {
        console.warn("Falha ao carregar deck remotamente.");
    }

    // Opcional: Oculta o botão de carregar se ele ainda existir no seu HTML
    const btnLoad = document.getElementById('btn-load-json');
    if(btnLoad) btnLoad.style.display = 'none';
});

// --- FUNÇÕES DA API DO GITHUB (Necessárias para Deletar) ---
async function obterArquivoGithub(token) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}?ref=${GITHUB_CONFIG.branch}`;
    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github.v3+json" }
    });

    if (response.status === 404) return { sha: null, content: [] };
    if (!response.ok) throw new Error("Erro ao acessar repositório");

    const data = await response.json();
    const rawContent = decodeURIComponent(escape(atob(data.content)));
    return { sha: data.sha, content: JSON.parse(rawContent) };
}

async function salvarDiretoNoGithub(novoDeck) {
    let token = localStorage.getItem("gh_token");
    if (!token) {
        token = prompt("Cole seu GitHub Personal Access Token:");
        if (!token) return false;
        localStorage.setItem("gh_token", token.trim());
    }

    try {
        const fileData = await obterArquivoGithub(token);
        const jsonString = JSON.stringify(novoDeck, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(jsonString)));

        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const body = {
            message: `Deleção de módulo via Galeria: ${new Date().toLocaleString('pt-BR')}`,
            content: contentBase64,
            branch: GITHUB_CONFIG.branch
        };
        if (fileData.sha) body.sha = fileData.sha;

        const putResponse = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify(body)
        });

        if (!putResponse.ok) {
            if (putResponse.status === 401) localStorage.removeItem("gh_token");
            throw new Error(`Falha no commit: ${putResponse.statusText}`);
        }
        return true;
    } catch (err) {
        alert(`❌ Erro no GitHub: ${err.message}`);
        return false;
    }
}

// 2. FUNÇÃO QUE DESENHA O SVG DO HEXÁGONO
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

// 3. FUNÇÃO QUE GERA O HTML DE UMA CARTA ÚNICA
function gerarHTMLCarta(cardData) {
    const isUpgraded = cardData.upgraded ? 'upgraded' : '';
    const emojis = { arma: '🔴', suporte: '🔵', propulsao: '🟢' };
    const labelUsos = cardData.tipo === 'arma' ? 'TIROS' : 'USOS';
    const slotsUsos = '<div class="uses-slot"></div>'.repeat(cardData.usos);

    let mioloStatus = '';
    if (cardData.tipo === 'arma') {
        const mira = cardData.mira;
        const hitMiss = (val) => (val.includes('X') || val.includes('-')) ? 'val-miss' : 'val-hit';
        mioloStatus = `
                <div class="status-row">
                    <div class="stat-box dmg-box"><div class="dmg-val">💥 ${cardData.dano}</div><div class="dmg-lbl">DANO</div></div>
                    <div class="uses-track"><div class="uses-lbl">TIROS</div><div class="uses-slots">${slotsUsos}</div></div>
                    <div class="stat-box heat-gen-box"><div class="heat-gen-val">🔥 ${cardData.calor}</div><div class="heat-gen-lbl">CALOR</div></div>
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
                    <div class="stat-box heat-gen-box"><div class="heat-gen-val">🔥 ${cardData.calor}</div><div class="heat-gen-lbl">CALOR</div></div>
                </div>
                <div class="name-plate">${cardData.nome}</div>
                <div class="desc-box">${cardData.descricao}</div>
            `;
    }

    return `
            <div class="card-wrapper" data-id="${cardData.id}" title="Duplo-clique para ampliar">
                <div class="card ${isUpgraded}">
                    <div class="top-bar">
                        <div class="badge energy">⚡ ${cardData.energia}</div>
                        <div class="badge badge-${cardData.tipo}">${emojis[cardData.tipo]}</div>
                    </div>
                    <div class="art-container">
                        ${buildSVG(cardData.tipo, cardData.arestasHex)}
                        <div class="art-text">${cardData.arte.replace(/\n/g, '<br>')}</div>
                    </div>
                    ${mioloStatus}
                </div>
            </div>
        `;
}

// 4. RENDERIZAÇÃO E FILTROS
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

document.getElementById('filter-tipo').addEventListener('change', renderizarGaleria);
document.getElementById('filter-energia').addEventListener('change', renderizarGaleria);
document.getElementById('filter-usos').addEventListener('change', renderizarGaleria);

// 5. LÓGICA DO DUPLO CLIQUE (MODAL)
const gridContainer = document.getElementById('gallery-grid');
const modal = document.getElementById('modal');
const modalSlot = document.getElementById('modal-card-slot');

gridContainer.addEventListener('dblclick', (e) => {
    const wrapper = e.target.closest('.card-wrapper');
    if (wrapper) {
        currentActiveCardId = wrapper.getAttribute('data-id');
        const cartaSelecionada = deckCompleto.find(c => c.id === currentActiveCardId);

        modalSlot.innerHTML = gerarHTMLCarta(cartaSelecionada);
        modal.classList.add('active');
    }
});

// --- 6. AÇÃO: DELETAR CARTA NO GITHUB ---
document.getElementById('btn-modal-delete').addEventListener('click', async () => {
    const carta = deckCompleto.find(c => c.id === currentActiveCardId);
    const confirmacao = confirm(`🚨 ATENÇÃO!\nTem certeza absoluta que deseja deletar o módulo "${carta.nome}" remotamente?`);

    if (confirmacao) {
        // Cria um deck temporário sem a carta deletada
        const deckFiltrado = deckCompleto.filter(c => c.id !== currentActiveCardId);

        // Comita a deleção
        const sucesso = await salvarDiretoNoGithub(deckFiltrado);

        if (sucesso) {
            deckCompleto = deckFiltrado; // Atualiza o deck em memória
            alert(`Módulo "${carta.nome}" apagado com sucesso do repositório!`);
            modal.classList.remove('active');
            currentActiveCardId = null;
            renderizarGaleria();
        }
    }
});

// --- 7. AÇÃO: EDITAR CARTA ---
document.getElementById('btn-modal-edit').addEventListener('click', () => {
    const carta = deckCompleto.find(c => c.id === currentActiveCardId);
    localStorage.setItem('moduloEmEdicao', JSON.stringify(carta));
    window.location.href = 'cardmaker.html';
});

// Fechar Modal
document.getElementById('btn-modal-close').addEventListener('click', () => {
    modal.classList.remove('active');
    currentActiveCardId = null;
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});