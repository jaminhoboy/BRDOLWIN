// js/pages/forex-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINRouter && !window.BRDOLWINRouter.checkAuth()) return;

    let currentForexPair = 'eurusd';
    let atlasUpdateInterval = null;

    window.switchForexPair = function(pair) {
        currentForexPair = pair;
        const pairs = ['eurusd', 'usdjpy', 'gbpusd'];
        
        pairs.forEach(p => {
            const tabBtn = document.getElementById(`tabBtn${p.toUpperCase()}`);
            const panel = document.getElementById(`panel${p.toUpperCase()}`);
            
            if (p === pair) {
                if (tabBtn) tabBtn.className = 'btn-primary text-xs px-3 py-1.5 active';
                if (panel) panel.classList.add('active');
            } else {
                if (tabBtn) tabBtn.className = 'btn-secondary text-xs px-3 py-1.5';
                if (panel) panel.classList.remove('active');
            }
        });

        renderAtlasUI(); // Atualiza a UI do Atlas imediatamente ao trocar a aba
    };

    function updateForexUI(state) {
        if (!state) return;
        
        const api = window.BRDOLWINApi;
        if (!api) return;

        const updatePair = (pair, decimals, rangeCons, rangeAgr, stopPnts, targetPnts) => {
            if (!state[pair]) return;
            const quote = api.formatQuoteForUI(state[pair]);
            const UP = pair.toUpperCase();

            const pEl = document.getElementById(`fx${UP}Price`);
            const cEl = document.getElementById(`fx${UP}Change`);
            const tEl = document.getElementById(`fx${UP}Trend`);
            
            if (pEl) pEl.textContent = quote.price;
            if (cEl) {
                cEl.textContent = quote.change;
                cEl.className = quote.changeClass;
            }
            if (tEl) {
                const isBull = quote.rawChange >= 0;
                tEl.innerHTML = `<span class="${isBull ? 'text-green' : 'text-red'}"><i data-lucide="${quote.trendIcon}"></i> ${isBull ? 'Alta (Comprador)' : 'Baixa (Vendedor)'}</span>`;
            }

            const rawPrice = quote.rawPrice;
            const isBull = quote.rawChange >= 0;
            
            const eEl = document.getElementById(`fx${UP}Entry`);
            const sEl = document.getElementById(`fx${UP}Stop`);
            const trgEl = document.getElementById(`fx${UP}Target`);
            
            if (eEl && sEl && trgEl) {
                if (isBull) {
                    eEl.textContent = `${(rawPrice - rangeCons).toFixed(decimals)} - ${(rawPrice - rangeAgr).toFixed(decimals)}`;
                    sEl.textContent = (rawPrice - stopPnts).toFixed(decimals);
                    trgEl.textContent = (rawPrice + targetPnts).toFixed(decimals);
                    trgEl.className = 'text-xl font-bold text-green mt-1';
                } else {
                    eEl.textContent = `${(rawPrice + rangeAgr).toFixed(decimals)} - ${(rawPrice + rangeCons).toFixed(decimals)}`;
                    sEl.textContent = (rawPrice + stopPnts).toFixed(decimals);
                    trgEl.textContent = (rawPrice - targetPnts).toFixed(decimals);
                    trgEl.className = 'text-xl font-bold text-red mt-1';
                }
            }
        };

        updatePair('eurusd', 4, 0.0020, 0.0010, 0.0050, 0.0080);
        updatePair('gbpusd', 4, 0.0020, 0.0010, 0.0050, 0.0080);
        updatePair('usdjpy', 3, 0.200, 0.100, 0.500, 0.800);

        // Confidence calculation (average of available forex pairs trends alignment with DXY)
        let confScore = 50;
        let dataPoints = 0;
        
        if (state.dxy && state.eurusd) {
            dataPoints++;
            if ((state.dxy.changePercent > 0 && state.eurusd.changePercent < 0) || 
                (state.dxy.changePercent < 0 && state.eurusd.changePercent > 0)) {
                confScore += 15;
            } else {
                confScore -= 10;
            }
        }
        
        if (state.dxy && state.gbpusd) {
            dataPoints++;
            if ((state.dxy.changePercent > 0 && state.gbpusd.changePercent < 0) || 
                (state.dxy.changePercent < 0 && state.gbpusd.changePercent > 0)) {
                confScore += 15;
            } else {
                confScore -= 10;
            }
        }

        if (state.dxy && state.usdjpy) {
            dataPoints++;
            if ((state.dxy.changePercent > 0 && state.usdjpy.changePercent > 0) || 
                (state.dxy.changePercent < 0 && state.usdjpy.changePercent < 0)) {
                confScore += 15;
            } else {
                confScore -= 10;
            }
        }

        confScore = Math.min(100, Math.max(0, confScore));
        
        const confEl = document.getElementById('fxConfidence');
        if (confEl && !state.isLoading && dataPoints > 0) {
            let classificacao = 'Moderada';
            if (confScore >= 80) classificacao = 'Muito Alta (Alinhamento Macro)';
            else if (confScore >= 65) classificacao = 'Alta';
            else if (confScore >= 45) classificacao = 'Moderada';
            else if (confScore >= 30) classificacao = 'Baixa (Divergência)';
            else classificacao = 'Evitar Operação (Inconsistência Macro)';
            
            confEl.textContent = `${classificacao} (${confScore}%)`;
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // ── Atlas AI UI Update para Forex ──
    function startAtlasUI() {
        atlasUpdateInterval = setInterval(() => {
            renderAtlasUI();
        }, 3000);
    }

    function renderAtlasUI() {
        const Orch = window.BRDOLWINAtlasOrchestrator;
        const Risk = window.BRDOLWINAtlasRisk;
        const Journal = window.BRDOLWINAtlasJournal;
        if (!Orch) return;

        // Atualiza título da aba para mostrar o ativo atual
        const titleEl = document.getElementById('fxAtlasTitle');
        if (titleEl) titleEl.textContent = currentForexPair.toUpperCase();

        const ui = Orch.getVerdictForUI(currentForexPair);

        const badge = document.getElementById('fxAtlasVerdictBadge');
        if (badge) {
            badge.textContent = ui.label;
            badge.style.color = ui.color;
        }

        const confEl = document.getElementById('fxAtlasConfidence');
        if (confEl) confEl.textContent = ui.confidence + '%';

        const buyEl = document.getElementById('fxAtlasBuyScore');
        if (buyEl) buyEl.textContent = ui.buyScore || 0;

        const sellEl = document.getElementById('fxAtlasSellScore');
        if (sellEl) sellEl.textContent = ui.sellScore || 0;

        const grid = document.getElementById('fxAtlasStrategiesGrid');
        if (grid && ui.signals && Object.keys(ui.signals).length > 0) {
            const names = {
                trend: '📈 Tendência', momentum: '⚡ Momentum', meanReversion: '🔄 Reversão',
                volatility: '🌊 Volatilidade', correlation: '🌐 Correlação',
                smartMoney: '🏦 Smart Money', statistical: '📊 Estatística', breakout: '💥 Breakout'
            };
            const dirColors = { buy: '#34D399', sell: '#F87171', neutral: '#94A3B8' };
            const dirLabels = { buy: 'COMPRA', sell: 'VENDA', neutral: 'NEUTRO' };

            let html = '';
            Object.entries(ui.signals).forEach(([key, sig]) => {
                html += `
                    <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 8px; border-left: 3px solid ${dirColors[sig.direction]};">
                        <div class="flex-between">
                            <span class="text-sm font-bold">${names[key] || key}</span>
                            <span class="text-xs font-bold" style="color: ${dirColors[sig.direction]}">${dirLabels[sig.direction]} (${sig.confidence}%)</span>
                        </div>
                        <p class="text-xs text-muted mt-1">${sig.reason}</p>
                    </div>
                `;
            });
            grid.innerHTML = html;
        }

        if (Risk) {
            const status = Risk.getStatus();
            const cap = document.getElementById('fxAtlasCapital');
            if (cap) cap.textContent = 'R$ ' + status.capitalAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

            const pnl = document.getElementById('fxAtlasPnl');
            if (pnl) {
                pnl.textContent = 'R$ ' + status.pnlDiario.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                pnl.style.color = status.pnlDiario >= 0 ? '#34D399' : '#F87171';
            }

            const rs = document.getElementById('fxAtlasRiskStatus');
            if (rs) {
                if (status.locked) {
                    rs.textContent = '🔒 ' + status.lockReason;
                    rs.style.color = '#F87171';
                } else {
                    rs.textContent = '✅ Operacional';
                    rs.style.color = '#34D399';
                }
            }
        }

        if (Journal) {
            const m = Journal.getMetrics();
            const tt = document.getElementById('fxAtlasTotalTrades');
            if (tt) tt.textContent = m.totalTrades;
            const wr = document.getElementById('fxAtlasWinRate');
            if (wr) wr.textContent = m.winRate.toFixed(1) + '%';
            const pf = document.getElementById('fxAtlasPF');
            if (pf) pf.textContent = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);

            const list = document.getElementById('fxAtlasJournalList');
            if (list) {
                // Filtramos os trades de forex para mostrar aqui, ou mostramos todos?
                // Vamos mostrar todos os trades de moedas para ter contexto geral
                const recentTrades = Journal.getRecentTrades(10).filter(t => ['eurusd', 'usdjpy', 'gbpusd'].includes(t.asset));
                if (recentTrades.length > 0) {
                    let html = '';
                    recentTrades.forEach(t => {
                        const color = t.result === 'WIN' ? '#34D399' : '#F87171';
                        const icon = t.result === 'WIN' ? '✅' : '❌';
                        html += `
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div>
                                    <span class="text-sm font-bold">${icon} ${t.asset.toUpperCase()} ${t.direction.toUpperCase()}</span>
                                    <span class="text-xs text-muted ml-2">${t.exitReason}</span>
                                </div>
                                <span class="text-sm font-bold" style="color: ${color}; font-family: var(--fonte-dados);">
                                    ${t.pnlBRL >= 0 ? '+' : ''}R$ ${t.pnlBRL.toFixed(2)}
                                </span>
                            </div>
                        `;
                    });
                    list.innerHTML = html;
                }
            }
        }
    }

    if (window.BRDOLWINState) {
        window.BRDOLWINState.subscribe(updateForexUI);
    }
    
    startAtlasUI();
});
