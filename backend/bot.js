/**
 * =====================================================
 * ATLAS BOT — bot.js (Cérebro Principal 24/7)
 * =====================================================
 * Robô autônomo que roda no servidor (Render.com).
 * Loop a cada 8s:
 *   1. Busca cotações do Yahoo Finance
 *   2. Alimenta o MarketMemory
 *   3. Executa as 8 estratégias
 *   4. Calcula consenso ponderado
 *   5. Verifica Risk Manager
 *   6. Abre/Fecha Paper Trades no Supabase
 * =====================================================
 */

import 'dotenv/config';
import express from 'express';
import { getAllMarketData } from './api.js';
import { MarketMemory } from './memory.js';
import { Strategies } from './strategies.js';
import { saveTrade, closeTrade, getOpenBotTrades, loadSettings } from './journal.js';

// ─── Config ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const TICK_MS = parseInt(process.env.TICK_INTERVAL_MS || '8000');
const SETTINGS_SYNC_MS = parseInt(process.env.SETTINGS_SYNC_INTERVAL_MS || '30000');

// ─── Estado Global do Bot ─────────────────────────────
const memory = new MarketMemory(200);

let settings = { threshold: 65 };

// Perfis de peso por tipo de mercado
const WEIGHTS_B3 = {
    trend: 20, momentum: 15, meanReversion: 3, volatility: 2,
    correlation: 22, smartMoney: 28, statistical: 10, breakout: 0,
};
const WEIGHTS_FOREX_MAJOR = {
    trend: 18, momentum: 15, meanReversion: 5, volatility: 0,
    correlation: 12, smartMoney: 30, statistical: 20, breakout: 0,
};
const WEIGHTS_FOREX_JPY = {
    trend: 20, momentum: 25, meanReversion: 2, volatility: 0,
    correlation: 10, smartMoney: 25, statistical: 18, breakout: 0,
};

function getWeightsForAsset(asset) {
    if (['win', 'wdo'].includes(asset)) return WEIGHTS_B3;
    if (['usdjpy', 'eurjpy', 'gbpjpy'].includes(asset)) return WEIGHTS_FOREX_JPY;
    return WEIGHTS_FOREX_MAJOR;
}

// Risk Manager (em memória)
const risk = {
    config: {
        maxDailyDrawdownPct: 3.0,
        maxConsecutiveLosses: 3,
        vixPanicThreshold: 30,
        capitalInicial: 50000,
        riskPerTradePct: 1.0,
    },
    state: {
        capitalAtual: 50000,
        pnlDiario: 0,
        consecutiveLosses: 0,
        openPositions: 0,
        locked: false,
        lockReason: '',
    }
};

// Trades abertos pelo bot (em memória para checar stop/target)
let openTrades = [];

// Estatísticas do bot
const stats = {
    ticks: 0,
    tradesAbertos: 0,
    tradesFechados: 0,
    wins: 0,
    losses: 0,
    startedAt: new Date().toISOString(),
};

// ─── Funções Utilitárias ──────────────────────────────

function getBrasiliaHour() {
    const now = new Date();
    return new Date(now.getTime() - 3 * 3600000).getUTCHours();
}

function getBrasiliaDay() {
    const now = new Date();
    return new Date(now.getTime() - 3 * 3600000).getUTCDay();
}

function isWithinTradingHours() {
    const hour = getBrasiliaHour();
    const min = new Date().getUTCMinutes();
    const day = getBrasiliaDay();
    if (day === 0 || day === 6) return false;                  // Fim de semana
    if (hour < 9 || hour >= 18) return false;                  // Fora do horário
    if (hour === 9 && min < 5) return false;                   // Leilão de abertura
    if (hour === 17 && min >= 25) return false;                // Leilão de fechamento
    return true;
}

function isWithinForexHours() {
    const hour = getBrasiliaHour();
    const day = getBrasiliaDay();
    if (day === 6) return false; // Fechado Sábado
    if (day === 0 && hour < 18) return false; // Domingo abre às 18h
    if (day === 5 && hour >= 18) return false; // Sexta fecha às 18h
    return true;
}

function canTrade(context = {}) {
    if (risk.state.locked) return { allowed: false, reason: risk.state.lockReason };
    
    const isB3 = ['win', 'wdo'].includes(context.asset);
    if (isB3) {
        if (!isWithinTradingHours()) return { allowed: false, reason: 'Fora do horário B3' };
    } else {
        if (!isWithinForexHours()) return { allowed: false, reason: 'Forex Fechado (Fim de semana)' };
    }

    const drawPct = (risk.state.pnlDiario / risk.config.capitalInicial) * 100;
    if (drawPct <= -risk.config.maxDailyDrawdownPct) return { allowed: false, reason: 'Drawdown máximo atingido' };
    if (risk.state.consecutiveLosses >= risk.config.maxConsecutiveLosses) return { allowed: false, reason: 'Perdas consecutivas — Cooldown' };
    if (context.vix && context.vix > risk.config.vixPanicThreshold) return { allowed: false, reason: `VIX em pânico (${context.vix.toFixed(1)})` };
    if (risk.state.openPositions >= 2) return { allowed: false, reason: 'Máx. de posições atingido' };

    return { allowed: true, reason: 'Autorizado' };
}

function calcConsensus(signals, weights) {
    let buyScore = 0, sellScore = 0, totalWeight = 0;
    const reasons = [];

    for (const [name, signal] of Object.entries(signals)) {
        const weight = weights[name] ?? 0;
        if (weight === 0) continue;
        const contribution = (signal.confidence / 100) * weight;
        totalWeight += weight;
        if (signal.direction === 'buy')  buyScore  += contribution;
        else if (signal.direction === 'sell') sellScore += contribution;
        if (signal.direction !== 'neutral' && signal.confidence > 40) reasons.push(`${name}: ${signal.reason}`);
    }

    const maxScore   = Math.max(buyScore, sellScore);
    const confidence = totalWeight > 0 ? (maxScore / totalWeight) * 100 : 0;
    const direction  = buyScore > sellScore ? 'buy' : sellScore > buyScore ? 'sell' : 'neutral';

    return { direction, confidence: Math.round(confidence), buyScore: Math.round(buyScore), sellScore: Math.round(sellScore), reasons };
}

function calcStopTarget(price, direction, atr, asset) {
    // Usar ATR para calcular stop dinâmico
    const stopDist = atr ? atr * 2 : price * 0.002;
    const targetDist = atr ? atr * 3 : price * 0.004;

    if (direction === 'buy') {
        return { stop: price - stopDist, target: price + targetDist };
    } else {
        return { stop: price + stopDist, target: price - targetDist };
    }
}

function registerTradeResult(pnl) {
    risk.state.pnlDiario += pnl;
    risk.state.capitalAtual += pnl;
    if (pnl < 0) risk.state.consecutiveLosses++;
    else risk.state.consecutiveLosses = 0;
    risk.state.openPositions = Math.max(0, risk.state.openPositions - 1);
    stats.tradesFechados++;
    if (pnl >= 0) stats.wins++;
    else stats.losses++;
}

// ─── Loop Principal ───────────────────────────────────

async function tick() {
    stats.ticks++;
    const tickStart = Date.now();

    try {
        // 1. Busca cotações
        const marketData = await getAllMarketData();

        // 2. Alimenta memória — TODOS os 12 ativos
        const ALL_ASSETS = [
            'win', 'wdo',
            'eurusd', 'usdjpy', 'gbpusd',
            'audusd', 'usdcad', 'usdchf', 'nzdusd',
            'eurjpy', 'gbpjpy', 'eurgbp',
        ];
        for (const asset of ALL_ASSETS) {
            if (marketData[asset]?.price) {
                memory.addTick(asset, marketData[asset].price);
            }
        }

        // 3. Checar trades abertos (stop/target)
        for (const trade of openTrades) {
            const currentData = marketData[trade.asset];
            if (!currentData?.price) continue;

            const currentPrice = currentData.price;
            let closed = false;
            let result = null;
            let pnl = 0;

            // Ponto do ativo
            const pointValue = trade.asset === 'win' ? 0.20 : trade.asset === 'wdo' ? 10.00 : 1.0;
            const lotes = trade.lotes || 1;

            if (trade.direction === 'buy') {
                if (currentPrice <= trade.stop_price) {
                    result = 'LOSS';
                    pnl = (currentPrice - trade.entry_price) * pointValue * lotes;
                    closed = true;
                } else if (currentPrice >= trade.target_price) {
                    result = 'WIN';
                    pnl = (currentPrice - trade.entry_price) * pointValue * lotes;
                    closed = true;
                }
            } else {
                if (currentPrice >= trade.stop_price) {
                    result = 'LOSS';
                    pnl = (trade.entry_price - currentPrice) * pointValue * lotes;
                    closed = true;
                } else if (currentPrice <= trade.target_price) {
                    result = 'WIN';
                    pnl = (trade.entry_price - currentPrice) * pointValue * lotes;
                    closed = true;
                }
            }

            if (closed) {
                await closeTrade(trade.id, currentPrice, result, pnl);
                registerTradeResult(pnl);
                openTrades = openTrades.filter(t => t.id !== trade.id);
                console.log(`[Bot] 📊 Trade ${result.toUpperCase()} ${trade.asset.toUpperCase()} | PnL: R$ ${pnl.toFixed(2)} | Capital: R$ ${risk.state.capitalAtual.toFixed(2)}`);
            }
        }

        // 4. Analisar cada ativo e verificar novos sinais
        const globalCtx = {
            sp500: marketData.sp500,
            dxy:   marketData.dxy,
            vix:   marketData.vix,
            oil:   marketData.oil,
        };

        for (const asset of ALL_ASSETS) {
            const snapshot = memory.getSnapshot(asset);
            if (!snapshot.ready) continue;

            // 5. Executar as 8 estratégias com contexto correto por ativo
            const signals = {
                trend:         Strategies.trend(snapshot),
                momentum:      Strategies.momentum(snapshot),
                meanReversion: Strategies.meanReversion(snapshot),
                volatility:    Strategies.volatility(snapshot),
                correlation:   Strategies.correlation(snapshot, globalCtx, asset),
                smartMoney:    Strategies.smartMoney(snapshot),
                statistical:   Strategies.statistical(asset),
                breakout:      Strategies.breakout(snapshot),
            };

            // 6. Consenso ponderado com perfil de peso correto
            const weights = getWeightsForAsset(asset);
            const verdict = calcConsensus(signals, weights);

            // 7. Risk Manager
            const vixPrice = marketData.vix?.price ?? 0;
            const riskCheck = canTrade({ vix: vixPrice, asset });

            // 8. Abrir trade se sinal forte
            if (
                verdict.confidence >= settings.threshold &&
                verdict.direction !== 'neutral' &&
                riskCheck.allowed
            ) {
                // Não abrir se já há trade aberto para esse ativo
                const alreadyOpen = openTrades.some(t => t.asset === asset);
                if (!alreadyOpen) {
                    const price = marketData[asset].price;
                    const atr = snapshot.atr;
                    const { stop, target } = calcStopTarget(price, verdict.direction, atr, asset);

                    const tradePayload = {
                        asset,
                        direction:   verdict.direction,
                        entryPrice:  price,
                        stopPrice:   stop,
                        targetPrice: target,
                        confidence:  verdict.confidence,
                        reason:      verdict.reasons.slice(0, 3).join(' | '),
                        strategies:  signals,
                        lotes:       1,
                    };

                    const saved = await saveTrade(tradePayload);
                    if (saved) {
                        saved.asset = asset;
                        saved.direction = verdict.direction;
                        saved.entry_price = price;
                        saved.stop_price = stop;
                        saved.target_price = target;
                        saved.lotes = 1;
                        openTrades.push(saved);
                        risk.state.openPositions++;
                        stats.tradesAbertos++;

                        const emoji = verdict.direction === 'buy' ? '🟢' : '🔴';
                        console.log(`[Bot] ${emoji} NOVO TRADE ${verdict.direction.toUpperCase()} ${asset.toUpperCase()} | Confiança: ${verdict.confidence}% | Entrada: ${price}`);
                    }
                }
            }
        }

        const elapsed = Date.now() - tickStart;
        if (stats.ticks % 10 === 0) {
            const winRate = stats.tradesFechados > 0 ? ((stats.wins / stats.tradesFechados) * 100).toFixed(1) : '0.0';
            console.log(`[Bot] ✅ Tick #${stats.ticks} | ${elapsed}ms | Trades: ${stats.tradesFechados} | WinRate: ${winRate}% | Capital: R$ ${risk.state.capitalAtual.toFixed(2)}`);
        }

    } catch (err) {
        console.error('[Bot] ❌ Erro no tick:', err.message);
    }
}

// Reset diário às 00:00 BRT
function scheduleDailyReset() {
    const now = new Date();
    const brNow = new Date(now.getTime() - 3 * 3600000);
    const msUntilMidnight = (24 * 60 * 60 * 1000) - (
        brNow.getUTCHours() * 3600000 +
        brNow.getUTCMinutes() * 60000 +
        brNow.getUTCSeconds() * 1000
    );

    setTimeout(() => {
        console.log('[Bot] 🌅 Reset diário do Risk Manager');
        risk.state.pnlDiario = 0;
        risk.state.consecutiveLosses = 0;
        risk.state.openPositions = 0;
        risk.state.locked = false;
        memory.reset(); // Limpa memória para novo dia
        scheduleDailyReset(); // Agendar próximo reset
    }, msUntilMidnight);
}

// Sincroniza settings do Supabase periodicamente
async function syncSettings() {
    const newSettings = await loadSettings();
    settings = newSettings;
    console.log(`[Bot] ⚙️  Settings sincronizados | Threshold: ${settings.threshold}%`);
}

// ─── Express — Healthcheck para manter o Render acordado ─
const app = express();

app.get('/', (req, res) => {
    const winRate = stats.tradesFechados > 0
        ? ((stats.wins / stats.tradesFechados) * 100).toFixed(1)
        : '0.0';
    res.json({
        status: 'online',
        bot: 'Atlas AI Bot — BRDOLWIN',
        uptime: `${Math.floor((Date.now() - new Date(stats.startedAt).getTime()) / 60000)} minutos`,
        ticks: stats.ticks,
        openTrades: openTrades.length,
        totalTrades: stats.tradesFechados,
        winRate: `${winRate}%`,
        capital: `R$ ${risk.state.capitalAtual.toFixed(2)}`,
        threshold: `${settings.threshold}%`,
        tradingHoursActive: isWithinTradingHours(),
        timestamp: new Date().toISOString(),
    });
});

app.get('/health', (req, res) => res.send('OK'));

// ─── Bootstrap ────────────────────────────────────────

async function start() {
    console.log('🤖 ==========================================');
    console.log('🤖  Atlas AI Bot v1.0 — BRDOLWIN Backend');
    console.log('🤖 ==========================================');

    // Carregar settings do Supabase
    await syncSettings();

    // Recarregar trades abertos do Supabase (caso o bot tenha reiniciado)
    openTrades = await getOpenBotTrades();
    console.log(`[Bot] 📂 ${openTrades.length} trade(s) aberto(s) recarregados do Supabase`);

    // Iniciar servidor Express
    app.listen(PORT, () => {
        console.log(`[Bot] 🌐 Servidor healthcheck rodando na porta ${PORT}`);
    });

    // Agendar reset diário
    scheduleDailyReset();

    // Agendar sincronização de settings
    setInterval(syncSettings, SETTINGS_SYNC_MS);

    // Iniciar loop principal
    console.log(`[Bot] ⏱  Loop principal a cada ${TICK_MS / 1000}s — Iniciando...`);
    await tick(); // Primeiro tick imediato
    setInterval(tick, TICK_MS);
}

start().catch(err => {
    console.error('[Bot] FALHA CRÍTICA NA INICIALIZAÇÃO:', err);
    process.exit(1);
});
