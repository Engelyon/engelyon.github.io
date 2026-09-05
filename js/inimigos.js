const verticesHex = [
    [27.5, 11], [72.5, 11], [95, 50], [72.5, 89], [27.5, 89], [5, 50]
];
const corAtaque = '#f85149';

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.edge-cb').forEach(cb => {
        cb.addEventListener('change', desenharTodosHexagonos);
    });

    document.querySelectorAll('.inp-atk-count').forEach(select => {
        select.addEventListener('change', (e) => {
            const actIndex = e.target.getAttribute('data-act');
            const count = parseInt(e.target.value);
            atualizarModoAcao(actIndex, count);
        });
    });

    document.getElementById('inp-elite').addEventListener('change', (e) => {
        const card = document.getElementById('enemy-card');
        e.target.checked ? card.classList.add('elite') : card.classList.remove('elite');
    });

    document.querySelectorAll('.range-table-mini .editable-stat').forEach(el => {
        el.addEventListener('input', atualizarCoresModificadores);
    });

    document.getElementById('btn-export-png').addEventListener('click', exportarParaPNG);

    document.querySelectorAll('.editable-stat, .hex-dmg, .enemy-hp span, .enemy-rank span, .action-name-plate').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });

    // Inicialização da Tela
    desenharTodosHexagonos();
    atualizarCoresModificadores(); // Pinta os iniciais
    document.querySelectorAll('.inp-atk-count').forEach(select => {
        atualizarModoAcao(select.getAttribute('data-act'), parseInt(select.value));
    });
});

function atualizarCoresModificadores() {
    document.querySelectorAll('.range-table-mini .editable-stat').forEach(el => {
        const text = el.innerText.trim().toUpperCase();

        // Remove as classes antigas
        el.classList.remove('val-hit', 'val-miss');

        // Aplica a cor correta dependendo do conteúdo
        if (text === 'X' || text.includes('-')) {
            el.classList.add('val-miss');
        } else if (text.includes('+') || (!isNaN(text) && parseInt(text) > 0)) {
            el.classList.add('val-hit');
        }
    });
}

function atualizarModoAcao(actIndex, count) {
    const atkMode = document.getElementById(`atk-mode-${actIndex}`);
    const utilMode = document.getElementById(`util-mode-${actIndex}`);
    const edgesGrid = document.getElementById(`edges-grid-${actIndex}`);
    const slotsContainer = document.getElementById(`slots-act-${actIndex}`);

    if (count === 0) {
        atkMode.classList.add('hide');
        utilMode.classList.remove('hide');
        edgesGrid.style.opacity = '0.3';
        edgesGrid.style.pointerEvents = 'none';
    } else {
        atkMode.classList.remove('hide');
        utilMode.classList.add('hide');
        edgesGrid.style.opacity = '1';
        edgesGrid.style.pointerEvents = 'auto';
        slotsContainer.innerHTML = '<div class="uses-slot"></div>'.repeat(count);
    }
}

function desenharTodosHexagonos() {
    for (let i = 1; i <= 3; i++) {
        desenharHexagono(i);
    }
}

function desenharHexagono(actIndex) {
    const container = document.getElementById(`svg-act-${actIndex}`);
    if (!container) return;

    const checkboxes = document.querySelectorAll(`.edge-cb[data-act="${actIndex}"]`);

    let svgHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%;">`;
    svgHTML += `<polygon points="27.5,11 72.5,11 95,50 72.5,89 27.5,89 5,50" fill="#010409" stroke="#484f58" stroke-width="2"/>`;

    checkboxes.forEach((cb) => {
        if (cb.checked) {
            const idx = parseInt(cb.value);
            const p1 = verticesHex[idx];
            const p2 = verticesHex[(idx + 1) % 6];
            svgHTML += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${corAtaque}" stroke-width="7" stroke-linecap="round"/>`;
        }
    });

    svgHTML += `</svg>`;
    container.innerHTML = svgHTML;
}

async function exportarParaPNG() {
    const cardElement = document.getElementById('enemy-card');
    const isElite = document.getElementById('inp-elite').checked;

    const nomeRaw = document.getElementById('out-nome').innerText.trim() || 'inimigo';
    const nomeFormatado = nomeRaw.toLowerCase().replace(/\s+/g, '_');
    const sufixo = isElite ? '-e' : '';
    const nomeArquivo = `${nomeFormatado}${sufixo}.png`;

    if (document.activeElement) document.activeElement.blur();

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
        alert("❌ Erro ao exportar a imagem. Tente novamente.");
    }
}