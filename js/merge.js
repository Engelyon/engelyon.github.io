document.addEventListener('DOMContentLoaded', () => {
    const inpFile1 = document.getElementById('inp-file-1');
    const inpFile2 = document.getElementById('inp-file-2');
    const btnMerge = document.getElementById('btn-merge');
    const logContainer = document.getElementById('log-container');
    const btnDownload = document.getElementById('btn-download');

    let deckFundido = [];

    const lerArquivoJSON = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target.result));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject("Erro de leitura");
            reader.readAsText(file);
        });
    };

    btnMerge.addEventListener('click', async () => {
        const file1 = inpFile1.files[0];
        const file2 = inpFile2.files[0];

        if (!file1 || !file2) {
            alert("❌ Selecione os DOIS arquivos JSON para poder fazer o Merge!");
            return;
        }

        try {
            const deckBase = await lerArquivoJSON(file1);
            const deckNovidades = await lerArquivoJSON(file2);

            fazerMerge(deckBase, deckNovidades);
        } catch (err) {
            alert("❌ Erro ao ler os arquivos. Certifique-se de que ambos são JSON válidos.");
        }
    });

    function fazerMerge(deckBase, deckNovidades) {
        let adicionadas = 0;
        let ignoradas = 0;
        let nomesAdicionados = [];

        deckFundido = [...deckBase];

        deckNovidades.forEach(cartaAmigo => {
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

        logContainer.style.display = 'block';
        logContainer.innerHTML = `
            <h3 style="margin-top:0; color: #2ea043;">✅ Merge Concluído!</h3>
            <p><b>Cartas no Deck Base:</b> ${deckBase.length}</p>
            <p><b>Novas cartas injetadas:</b> ${adicionadas}</p>
            <p style="color:#8b949e;"><b>Cartas repetidas ignoradas:</b> ${ignoradas}</p>
            <p><b>Total no novo deck:</b> ${deckFundido.length}</p>
        `;

        if (adicionadas > 0) {
            logContainer.innerHTML += `<hr style="border-color:#30363d;">
            <p><b>Novidades:</b> ${nomesAdicionados.join(', ')}</p>`;
        }

        btnDownload.style.display = 'inline-block';
    }

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