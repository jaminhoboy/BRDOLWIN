/**
 * =====================================================
 * BRDOLWIN — forex-page.js
 * =====================================================
 * Mesmo padrão das páginas indice-page.js e dolar-page.js.
 * Usa window.BRDOLWINAtlasOrchestrator, Risk e Journal
 * para exibir veredito real do Atlas AI em cada par Forex.
 * =====================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINRouter && !window.BRDOLWINRouter.checkAuth()) return;

    // ─── Configuração dos 10 pares ─────────────────────────
    const FOREX_PAIRS = [
        {
            key: 'eurusd', label: 'EUR/USD', stateKey: 'eurusd', decimals: 4,
            sessions: [
                { hora: '08:00 — 12:00', desc: 'Sessão de Londres (Alta Liquidez)' },
                { hora: '14:30 — 17:00', desc: 'Sessão de Nova York (Volatilidade Ativa)' },
            ],
        },
        {
            key: 'usdjpy', label: 'USD/JPY', stateKey: 'usdjpy', decimals: 3,
            sessions: [
                { hora: '21:00 — 02:00', desc: 'Sessão de Tóquio (Forte Fluxo Asiático)' },
                { hora: '08:00 — 10:00', desc: 'Overlap Londres (Liquidez Global)' },
            ],
        },
        {
            key: 'gbpusd', label: 'GBP/USD', stateKey: 'gbpusd', decimals: 4,
            sessions: [
                { hora: '08:00 — 12:00', desc: 'Sessão de Londres (Alta Liquidez)' },
                { hora: '14:30 — 17:00', desc: 'Sessão de Nova York (Volatilidade Ativa)' },
            ],
        },
        {
            key: 'audusd', label: 'AUD/USD', stateKey: 'audusd', decimals: 4,
            sessions: [
                { hora: '21:00 — 02:00', desc: 'Sessão de Sydney (Fluxo Asiático-Pacífico)' },
                { hora: '08:00 — 11:00', desc: 'Overlap Londres-Ásia (Volatilidade Extra)' },
            ],
        },
        {
            key: 'usdcad', label: 'USD/CAD', stateKey: 'usdcad', decimals: 4,
            sessions: [
                { hora: '13:00 — 16:00', desc: 'Sessão de Nova York (Fluxo CAD)' },
                { hora: '15:00 — 17:00', desc: 'Overlap NY-Londres (Petróleo correlacionado)' },
            ],
        },
        {
            key: 'usdchf', label: 'USD/CHF', stateKey: 'usdchf', decimals: 4,
            sessions: [
                { hora: '08:00 — 12:00', desc: 'Sessão Europeia (Franco Suíço ativo)' },
                { hora: '14:30 — 17:00', desc: 'Sessão de Nova York (USD dominante)' },
            ],
        },
        {
            key: 'nzdusd', label: 'NZD/USD', stateKey: 'nzdusd', decimals: 4,
            sessions: [
                { hora: '20:00 — 00:00', desc: 'Sessão de Wellington (Abertura NZD)' },
                { hora: '21:00 — 02:00', desc: 'Overlap Sydney (Maior Volume)' },
            ],
        },
        {
            key: 'eurjpy', label: 'EUR/JPY', stateKey: 'eurjpy', decimals: 3,
            sessions: [
                { hora: '08:00 — 12:00', desc: 'Sessão de Londres (EUR ativo)' },
                { hora: '21:00 — 02:00', desc: 'Sessão de Tóquio (JPY ativo)' },
            ],
        },
        {
            key: 'gbpjpy', label: 'GBP/JPY', stateKey: 'gbpjpy', decimals: 3,
            sessions: [
                { hora: '08:00 — 12:00', desc: 'Sessão de Londres (Alta Volatilidade)' },
                { hora: '14:30 — 16:00', desc: 'Overlap NY-Londres (Extrema Volatilidade)' },
            ],
        },
        {
            key: 'eurgbp', label: 'EUR/GBP', stateKey: 'eurgbp', decimals: 4,
            sessions: [
                { hora: '07:00 — 11:00', desc: 'Pré-abertura Europa (Máxima Liquidez)' },
                { hora: '08:00 — 12:00', desc: 'Sessão de Londres (EUR e GBP simultâneos)' },
            ],
        },
    ];

    let _currentPair = 'eurusd';
    let _atlasInterval = null;

    // ─── Gerar HTML dos painéis ───────────────────────────
    function buildPairHTML(pair) {
        const isJPY = pair.decimals <= 3;
        const stopDist   = isJPY ? 0.500 : 0.0050;
        const targetDist = isJPY ? 0.800 : 0.0080;
        const entryAgg   = isJPY ? 0.100 : 0.0010;
        const entryCons  = isJPY ? 0.200 : 0.0020;

        return `
        <div id="fxPanel-${pair.key}" class="forex-pair-panel${pair.key === 'eurusd' ? ' active' : ''}">

            <div class="grid-3">
                <div class="glass-card metric-card">
                    <span class="metric-label">Preço Atual (${pair.label})</span>
                    <div class="metric-value">
                        <span id="fxPrice-${pair.key}" style="font-family: var(--fonte-dados);">Carregando...</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <span class="metric-label">Variação Diária</span>
                    <div class="metric-value">
                        <span id="fxChange-${pair.key}" class="text-muted" style="font-family: var(--fonte-dados);">--%</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <span class="metric-label">Tendência de Curto Prazo</span>
                    <div class="metric-value" id="fxTrend-${pair.key}">
                        <span class="text-muted">Aguardando dados...</span>
                    </div>
                </div>
            </div>

            <div class="glass-card">
                <h3 class="text-lg font-bold mb-4">Plano de Execução — ${pair.label}</h3>
                <div class="grid-3">
                    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                        <span class="text-sm text-muted">Região de Entrada</span>
                        <div class="text-lg font-bold text-light mt-1" id="fxEntry-${pair.key}" style="font-family: var(--fonte-dados);">Aguardando...</div>
                        <span class="text-xs text-muted">Agressivo / Conservador</span>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                        <span class="text-sm text-muted">Stop Institucional</span>
                        <div class="text-xl font-bold text-red mt-1" id="fxStop-${pair.key}" style="font-family: var(--fonte-dados);">---</div>
                        <span class="text-xs text-muted">±${isJPY ? '0.500' : '0.0050'}</span>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                        <span class="text-sm text-muted">Alvo Principal</span>
                        <div class="text-xl font-bold text-green mt-1" id="fxTarget-${pair.key}" style="font-family: var(--fonte-dados);">---</div>
                        <span class="text-xs text-muted">±${isJPY ? '0.800' : '0.0080'}</span>
                    </div>
                </div>
            </div>

            <div class="grid-2">
                <div class="glass-card" style="border: 1px solid rgba(255,255,255,0.05);">
                    <h4 class="text-sm text-muted mb-3"><i data-lucide="clock" style="width: 14px;"></i> Janela Operacional Ideal</h4>
                    <div class="text-lg font-bold text-blue" style="font-family: var(--fonte-dados);">${pair.sessions[0].hora}</div>
                    <p class="text-xs text-muted mt-1 mb-3">${pair.sessions[0].desc}</p>
                    <div class="text-lg font-bold text-blue" style="font-family: var(--fonte-dados);">${pair.sessions[1].hora}</div>
                    <p class="text-xs text-muted mt-1">${pair.sessions[1].desc}</p>
                </div>
                <div class="glass-card" style="border: 1px solid rgba(255,255,255,0.05);">
                    <h4 class="text-sm text-muted mb-4"><i data-lucide="shield" style="width: 14px;"></i> Lote Recomendado (Risco Ajustado)</h4>
                    <div class="flex-between text-sm mb-2">
                        <span class="text-muted">Iniciante:</span>
                        <span class="font-bold text-light">0.01 — 0.05 lotes (Micro)</span>
                    </div>
                    <div class="flex-between text-sm mb-2">
                        <span class="text-muted">Intermediário:</span>
                        <span class="font-bold text-light">0.10 — 0.50 lotes (Mini)</span>
                    </div>
                    <div class="flex-between text-sm">
                        <span class="text-muted">Avançado:</span>
                        <span class="font-bold text-blue">1.00+ lotes (Standard)</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function renderPanels() {
        const container = document.getElementById('fxPairPanels');
        if (!container) return;
        container.innerHTML = FOREX_PAIRS.map(buildPairHTML).join('');
        if (window.lucide) lucide.createIcons();
    }

    // ─── Trocar par ───────────────────────────────────────
    function switchForexPair(pairKey) {
        _currentPair = pairKey;
        FOREX_PAIRS.forEach(p => {
            const panel = document.getElementById(`fxPanel-${p.key}`);
            if (panel) panel.classList.toggle('active', p.key === pairKey);
        });
        document.querySelectorAll('.fx-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === `fxTab-${pairKey}`);
        });
        // Atualiza título Atlas
        const pair = FOREX_PAIRS.find(p => p.key === pairKey);
        const atlasTitle = document.getElementById('fxAtlasTitle');
        if (atlasTitle && pair) atlasTitle.textContent = pair.label;
        // Re-render Atlas para o novo par
        renderAtlasUI();
    }
    window.switchForexPair = switchForexPair;

    // ─── Atualizar dados do par (via BRDOLWINState) ───────
    function updatePairUI(pair, data) {
        if (!data || !data.price) {
            const el = document.getElementById(`fxPrice-${pair.key}`);
            if (el) el.textContent = '—';
            return;
        }
        const price = data.price;
        const change = data.changePercent ?? 0;
        const isJPY = pair.decimals <= 3;

        // Preço
        const priceEl = document.getElementById(`fxPrice-${pair.key}`);
        if (priceEl) priceEl.textContent = price.toFixed(pair.decimals);

        // Variação
        const changeEl = document.getElementById(`fxChange-${pair.key}`);
        if (changeEl) {
            changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
            changeEl.className = change >= 0 ? 'text-green font-bold' : 'text-red font-bold';
        }

        // Tendência
        const trendEl = document.getElementById(`fxTrend-${pair.key}`);
        if (trendEl) {
            if (Math.abs(change) < 0.05) {
                trendEl.innerHTML = '<span style="color:#94A3B8;">⬌ Lateral</span>';
            } else if (change > 0) {
                trendEl.innerHTML = `<span class="text-green">↑ Alta (+${change.toFixed(2)}%)</span>`;
            } else {
                trendEl.innerHTML = `<span class="text-red">↓ Baixa (${change.toFixed(2)}%)</span>`;
            }
        }

        // Entrada / Stop / Alvo
        const stopDist   = isJPY ? 0.500 : 0.0050;
        const targetDist = isJPY ? 0.800 : 0.0080;
        const entryAgg   = isJPY ? 0.100 : 0.0010;
        const entryCons  = isJPY ? 0.200 : 0.0020;

        const entryEl = document.getElementById(`fxEntry-${pair.key}`);
        if (entryEl) {
            entryEl.textContent = `${(price - entryAgg).toFixed(pair.decimals)} — ${(price + entryCons).toFixed(pair.decimals)}`;
        }
        const stopEl = document.getElementById(`fxStop-${pair.key}`);
        if (stopEl) stopEl.textContent = (price - stopDist).toFixed(pair.decimals);
        const targetEl = document.getElementById(`fxTarget-${pair.key}`);
        if (targetEl) targetEl.textContent = (price + targetDist).toFixed(pair.decimals);
    }

    // ─── Atlas AI UI — mesmo padrão do indice-page.js ─────
    function renderAtlasUI() {
        const Orch    = window.BRDOLWINAtlasOrchestrator;
        const Risk    = window.BRDOLWINAtlasRisk;
        const Journal = window.BRDOLWINAtlasJournal;
        if (!Orch) return;

        // Pega veredito para o par selecionado (mesmo padrão que 'win' e 'wdo')
        const ui = Orch.getVerdictForUI(_currentPair);

        // Veredito
        const badge = document.getElementById('fxAtlasVerdictBadge');
        if (badge) { badge.textContent = ui.label; badge.style.color = ui.color; }

        const confEl = document.getElementById('fxAtlasConfidence');
        if (confEl) confEl.textContent = ui.confidence + '%';

        const buyEl = document.getElementById('fxAtlasBuyScore');
        if (buyEl) buyEl.textContent = ui.buyScore || 0;

        const sellEl = document.getElementById('fxAtlasSellScore');
        if (sellEl) sellEl.textContent = ui.sellScore || 0;

        // Confiança geral
        const confCard = document.getElementById('fxConfidence');
        if (confCard) {
            const c = ui.confidence;
            const label = c >= 75 ? '🟢 Alta Confiança' : c >= 50 ? '🟡 Confiança Moderada' : '🔴 Baixa Confiança';
            confCard.textContent = `${label} — ${c}%`;
        }

        // Estratégias individuais
        const grid = document.getElementById('fxAtlasStrategiesGrid');
        if (grid && ui.signals && Object.keys(ui.signals).length > 0) {
            const names = {
                trend: '📈 Tendência', momentum: '⚡ Momentum', meanReversion: '🔄 Reversão',
                volatility: '🌊 Volatilidade', correlation: '🌐 Correlação',
                smartMoney: '🏦 Smart Money', statistical: '📊 Estatística', breakout: '💥 Breakout'
            };
            const dirColors  = { buy: '#34D399', sell: '#F87171', neutral: '#94A3B8' };
            const dirLabels  = { buy: 'COMPRA', sell: 'VENDA', neutral: 'NEUTRO' };
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

        // Métricas do Journal
        if (Journal) {
            const m = Journal.getMetrics();
            const tt = document.getElementById('fxAtlasTotalTrades');
            if (tt) tt.textContent = m.totalTrades;
            const wr = document.getElementById('fxAtlasWinRate');
            if (wr) wr.textContent = m.winRate.toFixed(1) + '%';
            const pf = document.getElementById('fxAtlasPF');
            if (pf) pf.textContent = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2);

            // Diário de Operações
            const list = document.getElementById('fxAtlasJournalList');
            if (list) {
                const trades = Journal.getRecentTrades(10);
                if (trades.length > 0) {
                    let html = '';
                    trades.forEach(t => {
                        const color = t.result === 'WIN' ? '#34D399' : '#F87171';
                        const icon  = t.result === 'WIN' ? '✅' : '❌';
                        html += `
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div>
                                    <span class="text-sm font-bold">${icon} ${(t.asset || '').toUpperCase()} ${(t.direction || '').toUpperCase()}</span>
                                    <span class="text-xs text-muted ml-2">${t.exitReason || ''}</span>
                                </div>
                                <span class="text-sm font-bold" style="color: ${color}; font-family: var(--fonte-dados);">
                                    ${(t.pnlBRL || 0) >= 0 ? '+' : ''}R$ ${(t.pnlBRL || 0).toFixed(2)}
                                </span>
                            </div>
                        `;
                    });
                    list.innerHTML = html;
                }
            }
        }
    }

    // ─── Subscribe ao estado do mercado (igual WIN/DOL) ───
    function subscribeToMarketState() {
        if (!window.BRDOLWINState) return;
        window.BRDOLWINState.subscribe((state) => {
            FOREX_PAIRS.forEach(pair => {
                updatePairUI(pair, state[pair.stateKey]);
            });
        });
    }

    // ─── Init ─────────────────────────────────────────────
    renderPanels();
    subscribeToMarketState();

    // Atualizar Atlas AI a cada 3s (igual WIN/DOL)
    _atlasInterval = setInterval(renderAtlasUI, 3000);
    renderAtlasUI(); // primeira chamada imediata

    // Estado inicial se já carregado
    const initialState = window.BRDOLWINState?.getState?.();
    if (initialState) {
        FOREX_PAIRS.forEach(pair => updatePairUI(pair, initialState[pair.stateKey]));
    }

    window.BRDOLWINForex = { switchForexPair, renderAtlasUI };
});
