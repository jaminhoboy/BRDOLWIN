// js/pages/forex-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (!window.BRDOLWINRouter.checkAuth()) return;

    window.switchForexPair = function(pair) {
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
    };

    function updateForexUI(state) {
        if (!state) return;
        
        const api = window.BRDOLWINApi;
        if (!api) return;

        // EURUSD
        if (state.eurusd) {
            const quote = api.formatQuoteForUI(state.eurusd);
            const pEl = document.getElementById('fxEURUSDPrice');
            const cEl = document.getElementById('fxEURUSDChange');
            const tEl = document.getElementById('fxEURUSDTrend');
            
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
            
            const eEl = document.getElementById('fxEURUSDEntry');
            const sEl = document.getElementById('fxEURUSDStop');
            const trgEl = document.getElementById('fxEURUSDTarget');
            
            if (eEl && sEl && trgEl) {
                if (isBull) {
                    eEl.textContent = `${(rawPrice - 0.0020).toFixed(4)} - ${(rawPrice - 0.0010).toFixed(4)}`;
                    sEl.textContent = (rawPrice - 0.0050).toFixed(4);
                    trgEl.textContent = (rawPrice + 0.0080).toFixed(4);
                    trgEl.className = 'text-xl font-bold text-green mt-1';
                } else {
                    eEl.textContent = `${(rawPrice + 0.0010).toFixed(4)} - ${(rawPrice + 0.0020).toFixed(4)}`;
                    sEl.textContent = (rawPrice + 0.0050).toFixed(4);
                    trgEl.textContent = (rawPrice - 0.0080).toFixed(4);
                    trgEl.className = 'text-xl font-bold text-red mt-1';
                }
            }
        }

        // USDJPY
        if (state.usdjpy) {
            const quote = api.formatQuoteForUI(state.usdjpy);
            const pEl = document.getElementById('fxUSDJPYPrice');
            const cEl = document.getElementById('fxUSDJPYChange');
            const tEl = document.getElementById('fxUSDJPYTrend');
            
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
            
            const eEl = document.getElementById('fxUSDJPYEntry');
            const sEl = document.getElementById('fxUSDJPYStop');
            const trgEl = document.getElementById('fxUSDJPYTarget');
            
            if (eEl && sEl && trgEl) {
                if (isBull) {
                    eEl.textContent = `${(rawPrice - 0.200).toFixed(3)} - ${(rawPrice - 0.100).toFixed(3)}`;
                    sEl.textContent = (rawPrice - 0.500).toFixed(3);
                    trgEl.textContent = (rawPrice + 0.800).toFixed(3);
                    trgEl.className = 'text-xl font-bold text-green mt-1';
                } else {
                    eEl.textContent = `${(rawPrice + 0.100).toFixed(3)} - ${(rawPrice + 0.200).toFixed(3)}`;
                    sEl.textContent = (rawPrice + 0.500).toFixed(3);
                    trgEl.textContent = (rawPrice - 0.800).toFixed(3);
                    trgEl.className = 'text-xl font-bold text-red mt-1';
                }
            }
        }

        // GBPUSD
        if (state.gbpusd) {
            const quote = api.formatQuoteForUI(state.gbpusd);
            const pEl = document.getElementById('fxGBPUSDPrice');
            const cEl = document.getElementById('fxGBPUSDChange');
            const tEl = document.getElementById('fxGBPUSDTrend');
            
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
            
            const eEl = document.getElementById('fxGBPUSDEntry');
            const sEl = document.getElementById('fxGBPUSDStop');
            const trgEl = document.getElementById('fxGBPUSDTarget');
            
            if (eEl && sEl && trgEl) {
                if (isBull) {
                    eEl.textContent = `${(rawPrice - 0.0020).toFixed(4)} - ${(rawPrice - 0.0010).toFixed(4)}`;
                    sEl.textContent = (rawPrice - 0.0050).toFixed(4);
                    trgEl.textContent = (rawPrice + 0.0080).toFixed(4);
                    trgEl.className = 'text-xl font-bold text-green mt-1';
                } else {
                    eEl.textContent = `${(rawPrice + 0.0010).toFixed(4)} - ${(rawPrice + 0.0020).toFixed(4)}`;
                    sEl.textContent = (rawPrice + 0.0050).toFixed(4);
                    trgEl.textContent = (rawPrice - 0.0080).toFixed(4);
                    trgEl.className = 'text-xl font-bold text-red mt-1';
                }
            }
        }

        // Confidence calculation (average of available forex pairs trends alignment with DXY)
        let confScore = 50;
        let dataPoints = 0;
        
        if (state.dxy && state.eurusd) {
            dataPoints++;
            // EURUSD and DXY should be inversely correlated
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
            // USDJPY and DXY should be positively correlated
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

        // Re-render lucide icons if new ones were added via innerHTML
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    if (window.BRDOLWINState) {
        window.BRDOLWINState.subscribe(updateForexUI);
    }
});
