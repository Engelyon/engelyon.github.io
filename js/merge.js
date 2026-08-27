document.addEventListener('DOMContentLoaded', () => {
    const inpFile = document.getElementById('inp-file');
    const logContainer = document.getElementById('log-container');
    const btnDownload = document.getElementById('btn-download');

    let deckFundido = [];

    inpFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function(event) {
            try {
                const deckAmigo = JSON.parse(event.target.result);
                fazerMerge(deckAmigo);
            } catch (err) {
                alert("❌ Erro ao ler o arquivo. Certifique-se de que é um JSON válido.");
            }
        };

        // Lê o conteúdo do arquivo físico selecionado
        reader.readAsText(file);
    });

    function fazerMerge(deckAmigo) {
        // Puxa o seu deck atual (LocalStorage)
        const localData = localStorage.getItem('deck_modulos_local');
        const deckLocal = localData ? JSON.parse(localData) : [];

        let adicionadas = 0;
        let ignoradas = 0;
        let nomesAdicionados = [];

        // Prepara o deck local para receber as novidades
        deckFundido = [...deckLocal];

        deckAmigo.forEach(cartaAmigo => {
            // Verifica se a carta já existe (cruza pelo ID único ou pelo Nome exato)
            const jaExiste = deckFundido.some(c =>
                c.id === cartaAmigo.id ||
                c.nome.toLowerCase() === cartaAmigo.nome.toLowerCase()
            );

            if (!jaExiste) {
                deckFundido.push(cartaAmigo);
                nomesAdicionados.push(cartaAmigo.nome);
                adicionadas++;
            } else {
                ignoradas++;
            }
        });

        // Atualiza seu navegador com o deck novo imediatamente
        localStorage.setItem('deck_modulos_local', JSON.stringify(deckFundido));

        // Exibe o relatório do que aconteceu
        logContainer.style.display = 'block';
        logContainer.innerHTML = `
            <h3 style="margin-top:0; color: #2ea043;">✅ Merge Concluído!</h3>
            <p><b>Cartas no seu deck antes:</b> ${deckLocal.length}</p>
            <p><b>Novas cartas adicionadas:</b> ${adicionadas}</p>
            <p style="color:#8b949e;"><b>Cartas repetidas ignoradas:</b> ${ignoradas}</p>
            <p><b>Total no novo deck:</b> ${deckFundido.length}</p>
        `;

        if (adicionadas > 0) {
            logContainer.innerHTML += `<hr style="border-color:#30363d;">
            <p><b>Novidades:</b> ${nomesAdicionados.join(', ')}</p>`;
        }

        // Mostra o botão para baixar a versão final
        btnDownload.style.display = 'inline-block';
    }

    // Configura o botão de download
    btnDownload.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deckFundido, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "deck_modulos_merged.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });
});