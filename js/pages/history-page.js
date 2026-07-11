// js/pages/history-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINRouter && !window.BRDOLWINRouter.checkAuth()) return;

    const HistoryPage = {
        init() {
            this.renderMetrics();
            this.renderTable();
            this.setupExport();
            
            // Auto-refresh a cada 5 segundos
            setInterval(() => {
                this.renderMetrics();
                this.renderTable();
            }, 5000);
        },

        renderMetrics() {
            if (!window.BRDOLWINAtlasJournal) return;
            const metrics = window.BRDOLWINAtlasJournal.getMetrics();

            const pnlTotal = document.getElementById('historyPnlTotal');
            if (pnlTotal) {
                pnlTotal.textContent = 'R$ ' + metrics.pnlTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                pnlTotal.style.color = metrics.pnlTotal >= 0 ? '#34D399' : '#F87171';
            }

            const winRate = document.getElementById('historyWinRate');
            if (winRate) winRate.textContent = metrics.winRate.toFixed(1) + '%';

            const totalTrades = document.getElementById('historyTotalTrades');
            if (totalTrades) totalTrades.textContent = metrics.totalTrades;

            const profitFactor = document.getElementById('historyProfitFactor');
            if (profitFactor) profitFactor.textContent = metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2);
        },

        renderTable() {
            if (!window.BRDOLWINAtlasJournal) return;
            const tbody = document.getElementById('historyTableBody');
            const emptyMsg = document.getElementById('emptyHistory');
            
            // Pega todos os trades e a posição aberta (se houver)
            const allTrades = window.BRDOLWINAtlasJournal.getAllTrades();
            const openTrade = window.BRDOLWINAtlasJournal.openTrade;
            
            let displayList = [];
            if (openTrade) displayList.push(openTrade);
            displayList = displayList.concat(allTrades);

            if (displayList.length === 0) {
                if (tbody) tbody.innerHTML = '';
                if (emptyMsg) emptyMsg.style.display = 'block';
                return;
            }

            if (emptyMsg) emptyMsg.style.display = 'none';

            let html = '';
            displayList.forEach(t => {
                const dateObj = new Date(t.entryTime);
                const dateStr = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR');
                
                const isOpen = !t.exitTime;
                
                let resultBadge = '';
                let pnlStr = '';
                
                if (isOpen) {
                    resultBadge = '<span class="badge-open">EM ABERTO</span>';
                    pnlStr = '<span class="text-muted">---</span>';
                } else {
                    if (t.result === 'WIN') {
                        resultBadge = '<span class="badge-gain">GAIN</span>';
                        pnlStr = `<span class="text-green font-bold">+R$ ${t.pnlBRL.toFixed(2)}</span>`;
                    } else {
                        resultBadge = '<span class="badge-loss">LOSS</span>';
                        pnlStr = `<span class="text-red font-bold">-R$ ${Math.abs(t.pnlBRL).toFixed(2)}</span>`;
                    }
                }

                const dirClass = t.direction === 'buy' ? 'direction-buy' : 'direction-sell';
                const dirText = t.direction === 'buy' ? 'COMPRA' : 'VENDA';
                
                const decimals = t.asset === 'wdo' ? 2 : 0;
                const exitPrice = isOpen ? '---' : t.exitPrice.toFixed(decimals);
                const exitReason = isOpen ? 'Aguardando' : t.exitReason;

                html += `
                    <tr>
                        <td class="text-sm">${dateStr}</td>
                        <td class="font-bold text-light">${t.asset.toUpperCase()}</td>
                        <td class="${dirClass}">${dirText}</td>
                        <td style="font-family: var(--fonte-dados);">${t.entryPrice.toFixed(decimals)}</td>
                        <td style="font-family: var(--fonte-dados);">${exitPrice}</td>
                        <td class="text-sm text-muted">${exitReason}</td>
                        <td>${resultBadge}</td>
                        <td style="font-family: var(--fonte-dados);">${pnlStr}</td>
                    </tr>
                `;
            });

            if (tbody) tbody.innerHTML = html;
        },

        setupExport() {
            const btn = document.getElementById('btnExportCSV');
            if (!btn) return;
            
            btn.addEventListener('click', () => {
                if (!window.BRDOLWINAtlasJournal) return;
                const trades = window.BRDOLWINAtlasJournal.getAllTrades();
                if (trades.length === 0) {
                    alert('Nenhuma operação para exportar.');
                    return;
                }

                let csv = 'Data/Hora,Ativo,Direcao,Entrada,Saida,Motivo,Resultado,PnL(R$)\n';
                trades.forEach(t => {
                    const dateObj = new Date(t.entryTime);
                    const dateStr = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR');
                    const dirText = t.direction === 'buy' ? 'COMPRA' : 'VENDA';
                    csv += `"${dateStr}",${t.asset.toUpperCase()},${dirText},${t.entryPrice},${t.exitPrice},"${t.exitReason}",${t.result},${t.pnlBRL.toFixed(2)}\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'brdolwin_historico_atlas.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    };

    window.HistoryPage = HistoryPage;
    HistoryPage.init();
});
