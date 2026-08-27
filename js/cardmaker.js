// --- CONFIGURAÇÃO DA API DO GITHUB ---
const GITHUB_CONFIG = {
    owner: "Engelyon",
    repo: "engelyon.github.io",
    path: "modulos/deck_modulos.json",
    branch: "main"
};

const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const coresTipo = { arma: '#f85149', suporte: '#60a5fa', propulsao: '#22c55e' };

let deckJSON = [];

// Carrega o JSON do GitHub Pages silenciosamente ao abrir a página
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // O parâmetro '?t=' evita que o navegador puxe cache antigo
        const response = await fetch(`./modulos/deck_modulos.json?t=${new Date().getTime()}`);
        if (response.ok) {
            deckJSON = await response.json();
            refreshOutput();
        }
    } catch (e) {
        console.warn("Nenhum JSON anterior encontrado. Iniciando um novo deck.");
    }
    checarModoEdicao();
    updateCard();
});

// --- FUNÇÕES DA API DO GITHUB ---
async function obterArquivoGithub(token) {
    // Adiciona timestamp para impedir que o navegador entregue um SHA antigo do cache
    const timestamp = new Date().getTime();
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}?ref=${GITHUB_CONFIG.branch}&_nocache=${timestamp}`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github.v3+json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
        }
    });

    if (response.status === 404) {
        return { sha: null, content: [] };
    }

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`[GET Contents] HTTP ${response.status}: ${errJson.message || response.statusText}`);
    }

    const data = await response.json();
    const rawContent = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
    return {
        sha: data.sha,
        content: JSON.parse(rawContent)
    };
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
            message: `Atualização de módulo: ${new Date().toLocaleString('pt-BR')}`,
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
            const errorDetails = await putResponse.json();
            console.error("Erro detalhado da API do GitHub:", errorDetails);

            if (putResponse.status === 401) {
                localStorage.removeItem("gh_token");
                throw new Error("Token inválido ou expirado. O token salvo foi removido. Tente salvar novamente.");
            }
            if (putResponse.status === 404) {
                throw new Error(`Repositório ou caminho não encontrado. Verifique: owner="${GITHUB_CONFIG.owner}", repo="${GITHUB_CONFIG.repo}", path="${GITHUB_CONFIG.path}"`);
            }
            if (putResponse.status === 409) {
                throw new Error("Conflito de versão (SHA desatualizado). Recarregue a página antes de salvar.");
            }

            throw new Error(errorDetails.message || `Status HTTP ${putResponse.status}`);
        }

        return true;
    } catch (err) {
        alert(`❌ Erro no GitHub: ${err.message}`);
        return false;
    }
}

// --- FUNÇÃO DE SALVAMENTO ATUALIZADA ---
async function saveCardToJSON() {
    const nomeAtual = document.getElementById('inp-nome').value.trim();
    const editData = localStorage.getItem('moduloEmEdicao');
    const isEditMode = editData !== null;
    const cartaSendoEditada = isEditMode ? JSON.parse(editData) : null;

    const nomeExiste = deckJSON.some(c => c.nome.toLowerCase() === nomeAtual.toLowerCase() && (!isEditMode || c.id !== cartaSendoEditada.id));
    if (nomeExiste) {
        alert(`❌ Erro: Já existe uma carta chamada "${nomeAtual}" no deck!`);
        return;
    }

    const querSalvar = confirm(`Salvar módulo "${nomeAtual}" diretamente no GitHub?`);
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

    // Salva na nuvem
    const sucesso = await salvarDiretoNoGithub(deckJSON);

    if (sucesso) {
        const btn = document.getElementById('btn-save');
        const txtOriginal = btn.innerText;
        btn.innerText = '✅ COMMIT ENVIADO!';
        btn.style.background = '#2ea043';
        setTimeout(() => {
            btn.innerText = txtOriginal;
            btn.style.background = '';
            if(isEditMode) {
                localStorage.removeItem('moduloEmEdicao');
                window.location.href = 'modulos.html';
            }
        }, 1500);
    } else {
        // Reverte a array em caso de falha de conexão
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

        // Remove botão de abrir local, se ainda existir no seu HTML
        const btnLoad = document.getElementById('btn-load');
        if(btnLoad) btnLoad.style.display = 'none';

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
        btn.innerText = "💾 Commit de Edição";
        btn.style.background = "#d29922";
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
        } else if (propulsao) {
            badge.className = 'badge badge-propulsao';
            badge.innerText = '🟢';
        }
    }
}

function refreshOutput() {
    const output = document.getElementById('json-output');
    if(output) {
        output.value = JSON.stringify(deckJSON, null, 2);
        output.scrollTop = output.scrollHeight;
    }
}

document.querySelectorAll('.sidebar input, .sidebar select, .sidebar textarea').forEach(input => {
    input.addEventListener('input', updateCard);
    input.addEventListener('change', updateCard);
});

document.getElementById('btn-save').addEventListener('click', saveCardToJSON);