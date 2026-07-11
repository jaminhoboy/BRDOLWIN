// js/pages/indice-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINRouter && !window.BRDOLWINRouter.checkAuth()) return;

    const IndicePage = {
        gaugeChart: null,
        currentHorizon: '30m',
        atlasUpdateInterval: null,

        init() {
            this.initTabs();
            this.initGauge();
            this.subscribeToMarketState();
            this.startAtlasUI();
        },

        initTabs() {
            const probTabs = document.querySelectorAll('#probTabs button');
            probTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    probTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    this.currentHorizon = e.target.textContent;
                    if (window.BRDOLWINState) window.BRDOLWINState.notifyListeners();
                });
            });
        },

        initGauge() {
            const gaugeContainer = document.getElementById('winGauge');
            if (gaugeContainer && window.echarts) {
                this.gaugeChart = echarts.init(gaugeContainer, 'dark');
                const option = {
                    backgroundColor: 'transparent',
                    series: [{
                        type: 'gauge',
                        startAngle: 180, endAngle: 0, min: 0, max: 100,
                        pointer: { show: true },
                        progress: { show: true, overlap: false, roundCap: true, clip: false },
                        axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(255,255,255,0.05)']] } },
                        splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
                        data: [{ value: 0, name: 'Alta' }],
                        title: { fontSize: 14, color: '#94A3B8', offsetCenter: [0, '20%'] },
                        detail: { width: 50, height: 14, fontSize: 24, color: '#E2E8F0', formatter: '{value}%', offsetCenter: [0, '-10%'] }
                    }]
                };
                this.gaugeChart.setOption(option);
            }
        },

        updateGauge(altaValue) {
            if (this.gaugeChart) {
                this.gaugeChart.setOption({
                    series: [{ data: [{ value: altaValue, name: 'Alta' }] }]
                });
            }
        },

        // ── Atlas AI UI Update ──
        startAtlasUI() {
            this.atlasUpdateInterval = setInterval(() => {
                this.renderAtlasUI();
            }, 3000);
        },

        renderAtlasUI() {
            const Orch = window.BRDOLWINAtlasOrchestrator;
            const Risk = window.BRDOLWINAtlasRisk;
            const Journal = window.BRDOLWINAtlasJournal;
            if (!Orch) return;

            const ui = Orch.getVerdictForUI('win');

            // Veredito principal
            const badge = document.getElementById('atlasVerdictBadge');
            if (badge) {
                badge.textContent = ui.label;
                badge.style.color = ui.color;
            }

            const confEl = document.getElementById('atlasConfidence');
            if (confEl) confEl.textContent = ui.confidence + '%';

            const buyEl = document.getElementById('atlasBuyScore');
            if (buyEl) buyEl.textContent = ui.buyScore || 0;

            const sellEl = document.getElementById('atlasSellScore');
            if (sellEl) sellEl.textContent = ui.sellScore || 0;

            // Estratégias individuais
            const grid = document.getElementById('atlasStrategiesGrid');
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

            // Gestão de Risco
            if (Risk) {
                const status = Risk.getStatus();
                const cap = document.getElementById('atlasCapital');
                if (cap) cap.textContent = 'R$ ' + status.capitalAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

                const pnl = document.getElementById('atlasPnl');
                if (pnl) {
                    pnl.textContent = 'R$ ' + status.pnlDiario.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    pnl.style.color = status.pnlDiario >= 0 ? '#34D399' : '#F87171';
                }

                const dd = document.getElementById('atlasDrawdown');
                if (dd) dd.textContent = status.drawdownPct.toFixed(2) + '%';

                const losses = document.getElementById('atlasLosses');
                if (losses) losses.textContent = status.consecutiveLosses;

                const rs = document.getElementById('atlasRiskStatus');
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

            // Métricas
            if (Journal) {
                const m = Journal.getMetrics();
                const tt = document.getElementById('atlasTotalTrades');
                if (tt) tt.textContent = m.totalTrades;
                const wr = document.getElementById('atlasWinRate');
                if (wr) wr.textContent = m.winRate.toFixed(1) + '%';
                const pf = document.getElementById('atlasPF');
                if (pf) pf.textContent = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);
                const sh = document.getElementById('atlasSharpe');
                if (sh) sh.textContent = m.sharpe.toFixed(2);
                const mdd = document.getElementById('atlasMaxDD');
                if (mdd) mdd.textContent = m.maxDrawdown.toFixed(2) + '%';

                // Diário
                const list = document.getElementById('atlasJournalList');
                if (list) {
                    const trades = Journal.getRecentTrades(10);
                    if (trades.length > 0) {
                        let html = '';
                        trades.forEach(t => {
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
        },

        subscribeToMarketState() {
            if (!window.BRDOLWINState) return;

            // Expose BRDOLWINDashboard for backward compat with market-state.js
            window.BRDOLWINDashboard = {
                currentHorizon: this.currentHorizon,
                gaugeChart: null,
                selectHorizon: (h) => { this.currentHorizon = h; },
                updateGauge: (v) => { this.updateGauge(v); }
            };

            window.BRDOLWINState.subscribe((state) => {
                if (state.win && state.win.price) {
                    const p = document.getElementById('winPrice');
                    if (p) p.textContent = window.BRDOLWINUtils.formatPrice(state.win.price);
                    
                    const changeEl = document.getElementById('winChange');
                    const change = state.win.changePercent || 0;
                    if (changeEl) {
                        changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
                        changeEl.className = change >= 0 ? 'text-green ml-2' : 'text-red ml-2';
                    }

                    const entry = document.getElementById('execWinEntry');
                    if (entry) entry.textContent = window.BRDOLWINUtils.formatPrice(state.win.price) + ' (Spot)';
                    const stop = document.getElementById('execWinStop');
                    if (stop) stop.textContent = window.BRDOLWINUtils.formatPrice(state.win.price - 150);
                    const target = document.getElementById('execWinTarget');
                    if (target) target.textContent = window.BRDOLWINUtils.formatPrice(state.win.price + 300);
                }

                // Probabilidades
                let probHigh = 45, probLow = 30;
                if (this.currentHorizon === '1h') { probHigh = 55; probLow = 25; }

                const ph = document.getElementById('winProbHigh');
                if (ph) ph.textContent = probHigh + '%';
                const pl = document.getElementById('winProbLow');
                if (pl) pl.textContent = probLow + '%';
                const bh = document.getElementById('winBarHigh');
                if (bh) bh.style.width = probHigh + '%';
                const bl = document.getElementById('winBarLow');
                if (bl) bl.style.width = probLow + '%';

                this.updateGauge(probHigh);

                // Global Ticker
                if (state.sp500 && state.sp500.price) {
                    const el = document.getElementById('tickerSP500');
                    if (el) el.innerHTML = `<span style="color: ${state.sp500.change >= 0 ? '#34D399' : '#F87171'}">${state.sp500.price.toFixed(2)}</span>`;
                }
                if (state.vix && state.vix.price) {
                    const el = document.getElementById('tickerVIX');
                    if (el) el.innerHTML = `<span style="color: ${state.vix.change >= 0 ? '#F87171' : '#34D399'}">${state.vix.price.toFixed(2)}</span>`;
                }
            });
        }
    };

    window.IndicePage = IndicePage;
    IndicePage.init();
});
