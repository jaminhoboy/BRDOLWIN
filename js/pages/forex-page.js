/**
 * =====================================================
 * BRDOLWIN — forex-page.js
 * =====================================================
 * Lógica da página Forex — 10 pares de moedas.
 * Gera os painéis dinamicamente e atualiza com dados reais.
 * =====================================================
 */

const FOREX_PAIRS = [
    {
        key: 'eurusd',
        label: 'EUR/USD',
        stateKey: 'eurusd',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '08:00 — 12:00', desc: 'Sessão de Londres (Alta Liquidez)' },
            { hora: '14:30 — 17:00', desc: 'Sessão de Nova York (Volatilidade Ativa)' },
        ],
    },
    {
        key: 'usdjpy',
        label: 'USD/JPY',
        stateKey: 'usdjpy',
        decimals: 3,
        pip: 0.01,
        sessions: [
            { hora: '21:00 — 02:00', desc: 'Sessão de Tóquio (Forte Fluxo Asiático)' },
            { hora: '08:00 — 10:00', desc: 'Overlap Londres (Liquidez Global)' },
        ],
    },
    {
        key: 'gbpusd',
        label: 'GBP/USD',
        stateKey: 'gbpusd',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '08:00 — 12:00', desc: 'Sessão de Londres (Alta Liquidez)' },
            { hora: '14:30 — 17:00', desc: 'Sessão de Nova York (Volatilidade Ativa)' },
        ],
    },
    {
        key: 'audusd',
        label: 'AUD/USD',
        stateKey: 'audusd',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '21:00 — 02:00', desc: 'Sessão de Sydney (Fluxo Asiático-Pacífico)' },
            { hora: '08:00 — 11:00', desc: 'Overlap Londres-Ásia (Volatilidade Extra)' },
        ],
    },
    {
        key: 'usdcad',
        label: 'USD/CAD',
        stateKey: 'usdcad',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '13:00 — 16:00', desc: 'Sessão de Nova York (Fluxo CAD)' },
            { hora: '15:00 — 17:00', desc: 'Overlap NY-Londres (Petróleo correlacionado)' },
        ],
    },
    {
        key: 'usdchf',
        label: 'USD/CHF',
        stateKey: 'usdchf',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '08:00 — 12:00', desc: 'Sessão Europeia (Franco Suíço ativo)' },
            { hora: '14:30 — 17:00', desc: 'Sessão de Nova York (USD dominante)' },
        ],
    },
    {
        key: 'nzdusd',
        label: 'NZD/USD',
        stateKey: 'nzdusd',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '20:00 — 00:00', desc: 'Sessão de Wellington (Abertura NZD)' },
            { hora: '21:00 — 02:00', desc: 'Overlap Sydney (Maior Volume)' },
        ],
    },
    {
        key: 'eurjpy',
        label: 'EUR/JPY',
        stateKey: 'eurjpy',
        decimals: 3,
        pip: 0.01,
        sessions: [
            { hora: '08:00 — 12:00', desc: 'Sessão de Londres (EUR ativo)' },
            { hora: '21:00 — 02:00', desc: 'Sessão de Tóquio (JPY ativo)' },
        ],
    },
    {
        key: 'gbpjpy',
        label: 'GBP/JPY',
        stateKey: 'gbpjpy',
        decimals: 3,
        pip: 0.01,
        sessions: [
            { hora: '08:00 — 12:00', desc: 'Sessão de Londres (Alta Volatilidade)' },
            { hora: '14:30 — 16:00', desc: 'Overlap NY-Londres (Extrema Volatilidade)' },
        ],
    },
    {
        key: 'eurgbp',
        label: 'EUR/GBP',
        stateKey: 'eurgbp',
        decimals: 4,
        pip: 0.0001,
        sessions: [
            { hora: '07:00 — 11:00', desc: 'Pré-abertura Europa (Máxima Liquidez)' },
            { hora: '08:00 — 12:00', desc: 'Sessão de Londres (EUR e GBP simultâneos)' },
        ],
    },
];

// Par selecionado atualmente
let _currentPair = 'eurusd';

// ─── Gerar HTML dos painéis ───────────────────────────

function buildPairHTML(pair) {
    return `
    <div id="fxPanel-${pair.key}" class="forex-pair-panel${pair.key === 'eurusd' ? ' active' : ''}">
        <div style="display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: -0.5rem;">
            <span class="fx-pair-badge"><i data-lucide="globe" style="width:10px"></i> ${pair.label}</span>
        </div>

        <div class="grid-3">
            <div class="glass-card metric-card">
                <span class="metric-label">Preço Atual (${pair.label})</span>
                <div class="metric-value"><span id="fxPrice-${pair.key}" style="font-family: var(--fonte-dados);">Carregando...</span></div>
            </div>
            <div class="glass-card metric-card">
                <span class="metric-label">Variação Diária</span>
                <div class="metric-value"><span id="fxChange-${pair.key}" class="text-muted" style="font-family: var(--fonte-dados);">--%</span></div>
            </div>
            <div class="glass-card metric-card">
                <span class="metric-label">Tendência de Curto Prazo</span>
                <div class="metric-value" id="fxTrend-${pair.key}"><span class="text-muted">Aguardando dados...</span></div>
            </div>
        </div>

        <div class="glass-card">
            <h3 class="text-lg font-bold mb-4">Plano de Execução — ${pair.label}</h3>
            <div class="grid-3">
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                    <span class="text-sm text-muted">Região de Entrada</span>
                    <div class="text-xl font-bold text-light mt-1" id="fxEntry-${pair.key}" style="font-size: 0.95rem; font-family: var(--fonte-dados);">Aguardando...</div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                    <span class="text-sm text-muted">Stop Institucional</span>
                    <div class="text-xl font-bold text-red mt-1" id="fxStop-${pair.key}" style="font-family: var(--fonte-dados);">---</div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                    <span class="text-sm text-muted">Alvo Principal</span>
                    <div class="text-xl font-bold text-green mt-1" id="fxTarget-${pair.key}" style="font-family: var(--fonte-dados);">---</div>
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

// ─── Renderizar todos os painéis ─────────────────────

function renderPanels() {
    const container = document.getElementById('fxPairPanels');
    if (!container) return;
    container.innerHTML = FOREX_PAIRS.map(buildPairHTML).join('');
    // Reinicia ícones Lucide nos novos elementos
    if (window.lucide) lucide.createIcons();
}

// ─── Trocar par selecionado ───────────────────────────

function switchForexPair(pairKey) {
    _currentPair = pairKey;

    // Painéis
    FOREX_PAIRS.forEach(p => {
        const panel = document.getElementById(`fxPanel-${p.key}`);
        if (panel) panel.classList.toggle('active', p.key === pairKey);
    });

    // Botões de aba
    document.querySelectorAll('.fx-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `fxTab-${pairKey}`);
    });

    // Título Atlas AI
    const pair = FOREX_PAIRS.find(p => p.key === pairKey);
    const atlasTitle = document.getElementById('fxAtlasTitle');
    if (atlasTitle && pair) atlasTitle.textContent = pair.label;

    // Atualiza confiança para o par selecionado
    updateConfidence();
}

window.switchForexPair = switchForexPair;

// ─── Formatar preço ───────────────────────────────────

function fmt(price, decimals) {
    if (!price || isNaN(price)) return '—';
    return price.toFixed(decimals);
}

// ─── Calcular stop/target/entrada ─────────────────────

function calcLevels(price, pair) {
    const isJPY = pair.decimals <= 3;
    const stopDist   = isJPY ? 0.500 : 0.0050;
    const targetDist = isJPY ? 0.800 : 0.0080;
    const entryAgg   = isJPY ? 0.100 : 0.0010;
    const entryCons  = isJPY ? 0.200 : 0.0020;

    return {
        entryAgg:  price - entryAgg,
        entryCons: price + entryCons,
        stop:      price - stopDist,
        target:    price + targetDist,
    };
}

// ─── Atualizar UI do par ──────────────────────────────

function updatePairUI(pair, data) {
    if (!data || !data.price) {
        const els = ['fxPrice', 'fxChange', 'fxEntry', 'fxStop', 'fxTarget'];
        els.forEach(id => {
            const el = document.getElementById(`${id}-${pair.key}`);
            if (el) el.textContent = '—';
        });
        const trend = document.getElementById(`fxTrend-${pair.key}`);
        if (trend) trend.innerHTML = '<span class="text-muted">Sem dados</span>';
        return;
    }

    const price = data.price;
    const change = data.changePercent ?? 0;

    // Preço
    const priceEl = document.getElementById(`fxPrice-${pair.key}`);
    if (priceEl) priceEl.textContent = fmt(price, pair.decimals);

    // Variação
    const changeEl = document.getElementById(`fxChange-${pair.key}`);
    if (changeEl) {
        const signal = change >= 0 ? '+' : '';
        changeEl.textContent = `${signal}${change.toFixed(2)}%`;
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

    // Entrada, Stop, Alvo
    const levels = calcLevels(price, pair);

    const entryEl = document.getElementById(`fxEntry-${pair.key}`);
    if (entryEl) entryEl.textContent = `${fmt(levels.entryAgg, pair.decimals)} — ${fmt(levels.entryCons, pair.decimals)}`;

    const stopEl = document.getElementById(`fxStop-${pair.key}`);
    if (stopEl) stopEl.textContent = fmt(levels.stop, pair.decimals);

    const targetEl = document.getElementById(`fxTarget-${pair.key}`);
    if (targetEl) targetEl.textContent = fmt(levels.target, pair.decimals);
}

// ─── Atualizar confiança do par ativo ─────────────────

function updateConfidence() {
    const state = window.BRDOLWINState?.getState?.() ?? {};
    const pair = FOREX_PAIRS.find(p => p.key === _currentPair);
    const data = state[pair?.stateKey];
    const el = document.getElementById('fxConfidence');
    if (!el) return;

    if (!data?.price) {
        el.textContent = 'Aguardando dados do mercado...';
        return;
    }

    const change = Math.abs(data.changePercent ?? 0);
    let conf = 50;
    if (change > 0.5) conf += 15;
    if (change > 1.0) conf += 15;
    if (change > 1.5) conf += 10;
    conf = Math.min(conf, 95);

    const label = conf >= 75 ? '🟢 Alta Confiança' : conf >= 55 ? '🟡 Confiança Moderada' : '🔴 Baixa Confiança';
    el.textContent = `${label} — ${conf}%`;
}

// ─── Subscriber do estado global ─────────────────────

function onStateUpdate(state) {
    FOREX_PAIRS.forEach(pair => {
        updatePairUI(pair, state[pair.stateKey]);
    });
    updateConfidence();
}

// ─── Init ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (!window.BRDOLWINAuth?.isAuthenticated?.()) return;

    renderPanels();

    // Inscrever-se nas atualizações de estado
    if (window.BRDOLWINState?.subscribe) {
        window.BRDOLWINState.subscribe(onStateUpdate);
    }

    // Forçar primeira atualização se estado já existir
    const initialState = window.BRDOLWINState?.getState?.();
    if (initialState) onStateUpdate(initialState);
});

window.BRDOLWINForex = { switchForexPair, onStateUpdate };
