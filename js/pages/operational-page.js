// js/pages/operational-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (!window.BRDOLWINRouter.checkAuth()) return;

    // Subscribe to state updates para Painel Operacional
    if (window.BRDOLWINState) {
        window.BRDOLWINState.subscribe((s) => {
            const fmt = window.BRDOLWINUtils;
            if (!fmt) return;
            
            // === WIN (Mini Índice) ===
            const winBase = s.ibovPrice;
            if (winBase) {
                const horizon = '30m';
                const prob = s.probabilities[horizon];
                const isAlta = prob && prob.alta > prob.baixa;
                
                const winEntryAgg = document.getElementById('winEntryAgg');
                const winEntryCons = document.getElementById('winEntryCons');
                const winStop = document.getElementById('winStop');
                const winTarget1 = document.getElementById('winTarget1');
                const winTarget2 = document.getElementById('winTarget2');
                const winRR = document.getElementById('winRR');
                
                if (isAlta) {
                    if (winEntryAgg) winEntryAgg.textContent = fmt.formatPrice(winBase - 150);
                    if (winEntryCons) winEntryCons.textContent = fmt.formatPrice(winBase - 350);
                    if (winStop) winStop.textContent = fmt.formatPrice(winBase - 600);
                    if (winTarget1) winTarget1.textContent = fmt.formatPrice(winBase + 200);
                    if (winTarget2) winTarget2.textContent = fmt.formatPrice(winBase + 500);
                } else {
                    if (winEntryAgg) winEntryAgg.textContent = fmt.formatPrice(winBase + 150);
                    if (winEntryCons) winEntryCons.textContent = fmt.formatPrice(winBase + 350);
                    if (winStop) winStop.textContent = fmt.formatPrice(winBase + 600);
                    if (winTarget1) winTarget1.textContent = fmt.formatPrice(winBase - 200);
                    if (winTarget2) winTarget2.textContent = fmt.formatPrice(winBase - 500);
                }
                if (winRR) winRR.textContent = '1 : 2.5';
                
                // Quality badge
                const qualBadge = document.getElementById('winQualityBadge');
                if (qualBadge && s.confidence != null) {
                    if (s.confidence >= 65) { qualBadge.textContent = 'Alta'; qualBadge.className = 'badge badge-status-open'; }
                    else if (s.confidence >= 45) { qualBadge.textContent = 'Moderada'; qualBadge.style.background = 'rgba(251,191,36,0.2)'; qualBadge.style.color = '#FBBF24'; }
                    else { qualBadge.textContent = 'Baixa'; qualBadge.style.background = 'rgba(248,113,113,0.2)'; qualBadge.style.color = '#F87171'; }
                }
            }
            
            // === WDO (Mini Dólar) ===
            const wdoBase = s.dolarPrice;
            if (wdoBase) {
                const wdoEntryAgg = document.getElementById('wdoEntryAgg');
                const wdoStop = document.getElementById('wdoStop');
                const wdoTarget1 = document.getElementById('wdoTarget1');
                
                if (wdoEntryAgg) wdoEntryAgg.textContent = fmt.formatPrice(wdoBase + 0.015, 2);
                if (wdoStop) wdoStop.textContent = fmt.formatPrice(wdoBase + 0.045, 2);
                if (wdoTarget1) wdoTarget1.textContent = fmt.formatPrice(wdoBase - 0.025, 2);
            }
            
            // === Cenário Institucional (dinâmico) ===
            const scenarioPanel = document.getElementById('institutionalScenario');
            if (scenarioPanel && s.regime && s.regime !== 'Aguardando dados...') {
                const dirWin = s.probabilities['30m'];
                const direcaoWin = dirWin && dirWin.alta > dirWin.baixa ? 'alta' : 'baixa';
                const confText = s.confidence >= 65 ? 'alta confiança' : s.confidence >= 45 ? 'confiança moderada' : 'baixa confiança';
                
                scenarioPanel.innerHTML = `
                    <strong class="text-blue">1. Cenário Atual:</strong> ${s.regime}. Análise com ${confText} (${s.confidence || '—'}%).<br><br>
                    <strong class="text-blue">2. Direção Predominante WIN:</strong> Viés de ${direcaoWin} (${dirWin ? dirWin.alta + '% alta / ' + dirWin.baixa + '% baixa' : '—'}).<br><br>
                    <strong class="text-blue">3. Dólar Comercial:</strong> ${s.dolarPrice ? fmt.formatPrice(s.dolarPrice, 2) : '—'} (${s.dolarChange != null ? fmt.formatPercent(s.dolarChange) : '—'}).<br><br>
                    <strong class="text-blue">4. IBOV:</strong> ${s.ibovPrice ? fmt.formatPrice(s.ibovPrice) : '—'} (${s.ibovChange != null ? fmt.formatPercent(s.ibovChange) : '—'}).<br><br>
                    <strong class="text-blue">5. Janela Operacional:</strong> ${window.BRDOLWINWindows ? window.BRDOLWINWindows.getOperationalWindow().descricao : 'Verificando...'}.
                `;
            }
        });
    }
});
