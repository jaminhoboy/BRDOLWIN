/**
 * =====================================================
 * ATLAS AI — Orchestrator v2.0 (Cérebro Central)
 * =====================================================
 * v2.0 — Perfis de peso distintos por tipo de mercado:
 *   • B3 Futuros (WIN, WDO)
 *   • Forex Majors (EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF, NZD/USD, EUR/GBP)
 *   • Forex JPY Crosses (USD/JPY, EUR/JPY, GBP/JPY)
 *
 * Corrige: análise de todos os 10 pares forex, Memory
 * feeding completo, statistical correto por mercado.
 * =====================================================
 */
(function () {
    'use strict';

    // ─── Perfis de Peso por Tipo de Mercado ─────────────

    // B3 Futuros: Smart Money + Macro dominam
    const WEIGHTS_B3 = {
        trend:         20,
        momentum:      15,
        meanReversion:  3,
        volatility:     2,
        correlation:   22,
        smartMoney:    28,
        statistical:   10,
        breakout:       0,
    };

    // Forex Majors: ICT Liquidity + Sessão + Tendência
    const WEIGHTS_FOREX_MAJOR = {
        trend:         18,
        momentum:      15,
        meanReversion:  5,
        volatility:     0,
        correlation:   12,
        smartMoney:    30,
        statistical:   20,
        breakout:       0,
    };

    // Forex JPY Crosses: Momentum + Smart Money + Sessão Tóquio
    const WEIGHTS_FOREX_JPY = {
        trend:         20,
        momentum:      25,
        meanReversion:  2,
        volatility:     0,
        correlation:   10,
        smartMoney:    25,
        statistical:   18,
        breakout:       0,
    };

    // Mapa de ativo → perfil de peso
    function getWeightsForAsset(asset) {
        const b3      = ['win', 'wdo'];
        const jpyCross = ['usdjpy', 'eurjpy', 'gbpjpy'];
        if (b3.includes(asset))       return WEIGHTS_B3;
        if (jpyCross.includes(asset)) return WEIGHTS_FOREX_JPY;
        return WEIGHTS_FOREX_MAJOR;
    }

    // Todos os ativos analisados
    const ALL_ASSETS = [
        'win', 'wdo',
        'eurusd', 'usdjpy', 'gbpusd',
        'audusd', 'usdcad', 'usdchf', 'nzdusd',
        'eurjpy', 'gbpjpy', 'eurgbp',
    ];

    // Mapa de state key → asset key (para memória)
    const STATE_MAP = {
        win: 'win', wdo: 'wdo',
        eurusd: 'eurusd', usdjpy: 'usdjpy', gbpusd: 'gbpusd',
        audusd: 'audusd', usdcad: 'usdcad', usdchf: 'usdchf',
        nzdusd: 'nzdusd', eurjpy: 'eurjpy', gbpjpy: 'gbpjpy', eurgbp: 'eurgbp',
    };

    const ASSET_DISPLAY = {
        win: 'WINV26', wdo: 'WDOV26',
        eurusd: 'EUR/USD', usdjpy: 'USD/JPY', gbpusd: 'GBP/USD',
        audusd: 'AUD/USD', usdcad: 'USD/CAD', usdchf: 'USD/CHF',
        nzdusd: 'NZD/USD', eurjpy: 'EUR/JPY', gbpjpy: 'GBP/JPY',
        eurgbp: 'EUR/GBP',
    };

    // ─── Orchestrator ────────────────────────────────────

    const Orchestrator = {
        ALERT_THRESHOLD: 70,
        ALERT_COOLDOWN:  60000,
        lastAlertTime:   {},
        lastVerdict:     {},
        updateInterval:  null,

        init() {
            if (!window.BRDOLWINState) {
                console.warn('[Atlas Orchestrator] BRDOLWINState não encontrado. Aguardando...');
                return;
            }

            // Carrega threshold das configurações
            if (window.BRDOLWINAtlasSettings) {
                const conf = window.BRDOLWINAtlasSettings.getSettings();
                this.ALERT_THRESHOLD = conf.threshold;
            }

            window.BRDOLWINState.subscribe((state) => {
                this.processState(state);
            });

            console.log('[Atlas Orchestrator] ✅ v2.0 — 12 ativos, 3 perfis de peso, Statistical B3/Forex');
        },

        updateConfig(config) {
            this.ALERT_THRESHOLD = config.threshold;
            console.log('[Atlas Orchestrator] Threshold atualizado:', config.threshold);
        },

        processState(state) {
            const Memory     = window.BRDOLWINAtlasMemory;
            const Strategies = window.BRDOLWINAtlasStrategies;
            const Risk       = window.BRDOLWINAtlasRisk;
            const Journal    = window.BRDOLWINAtlasJournal;

            if (!Memory || !Strategies || !Risk) return;

            // ── 1. Alimentar Memória para TODOS os ativos ──
            for (const [stateKey, assetKey] of Object.entries(STATE_MAP)) {
                if (state[stateKey]?.price) {
                    Memory.addTick(assetKey, state[stateKey].price);
                }
            }

            // ── 2. Contexto macro global ──
            const globalCtx = {
                sp500: state.sp500,
                dxy:   state.dxy,
                vix:   state.vix,
                oil:   state.oil,
                gold:  state.gold,
            };

            // ── 3. Analisar TODOS os ativos ──
            for (const asset of ALL_ASSETS) {
                const snapshot = Memory.getSnapshot(asset);
                if (!snapshot.ready) continue;

                // ── 4. Executar as 8 estratégias com contexto correto ──
                const signals = {
                    trend:         Strategies.trend(snapshot),
                    momentum:      Strategies.momentum(snapshot),
                    meanReversion: Strategies.meanReversion(snapshot),
                    volatility:    Strategies.volatility(snapshot),
                    correlation:   Strategies.correlation(snapshot, globalCtx, asset),
                    smartMoney:    Strategies.smartMoney(snapshot),
                    statistical:   Strategies.statistical(asset),  // B3 ou Forex por asset
                    breakout:      Strategies.breakout(snapshot),
                };

                // ── 5. Consenso ponderado com perfil correto ──
                const weights = getWeightsForAsset(asset);
                const verdict = this.calcConsensus(signals, asset, weights);
                verdict.signals    = signals;
                verdict.snapshot   = snapshot;
                verdict.riskStatus = Risk.getStatus();
                verdict.weights    = weights;

                // ── 6. Risk Manager ──
                const vixVal   = state.vix?.price ?? 0;
                const riskCheck = Risk.canTrade({ vix: vixVal, asset });
                verdict.riskAllowed = riskCheck.allowed;
                verdict.riskReason  = riskCheck.reason;

                // ── 7. Disparar Alerta se sinal forte ──
                if (
                    verdict.confidence >= this.ALERT_THRESHOLD &&
                    riskCheck.allowed &&
                    verdict.direction !== 'neutral'
                ) {
                    this.tryFireAlert(asset, verdict, snapshot);
                }

                // ── 8. Checar Paper Trading ──
                if (Journal?.openTrade?.asset === asset) {
                    const closedTrade = Journal.checkStopTarget(snapshot.lastPrice);
                    if (closedTrade) {
                        console.log(`[Atlas] Paper Trade fechado: ${closedTrade.result} | PnL: R$ ${closedTrade.pnlBRL?.toFixed(2)}`);
                    }
                }

                this.lastVerdict[asset] = verdict;
            }
        },

        calcConsensus(signals, asset, weights) {
            let buyScore = 0, sellScore = 0, totalWeight = 0;
            const buyStrategies  = [];
            const sellStrategies = [];
            const reasons = [];

            for (const [name, signal] of Object.entries(signals)) {
                const weight = weights[name] ?? 0;
                if (weight === 0) continue; // estratégia desativada para este perfil

                const contribution = (signal.confidence / 100) * weight;

                if (signal.direction === 'buy') {
                    buyScore += contribution;
                    buyStrategies.push(name);
                } else if (signal.direction === 'sell') {
                    sellScore += contribution;
                    sellStrategies.push(name);
                }

                totalWeight += weight;
                if (signal.confidence > 40) reasons.push(`${name}: ${signal.reason}`);
            }

            const normalizedBuy  = totalWeight > 0 ? (buyScore  / totalWeight) * 100 : 0;
            const normalizedSell = totalWeight > 0 ? (sellScore / totalWeight) * 100 : 0;

            let direction, confidence, consensusStrategies;

            if (normalizedBuy > normalizedSell && normalizedBuy > 30) {
                direction          = 'buy';
                confidence         = Math.round(normalizedBuy);
                consensusStrategies = buyStrategies;
            } else if (normalizedSell > normalizedBuy && normalizedSell > 30) {
                direction          = 'sell';
                confidence         = Math.round(normalizedSell);
                consensusStrategies = sellStrategies;
            } else {
                direction          = 'neutral';
                confidence         = Math.round(Math.max(normalizedBuy, normalizedSell));
                consensusStrategies = [];
            }

            return {
                asset,
                direction,
                confidence,
                buyScore:           Math.round(normalizedBuy),
                sellScore:          Math.round(normalizedSell),
                consensusStrategies,
                strategiesAligned:  consensusStrategies.length,
                reasons:            reasons.slice(0, 5),
                timestamp:          Date.now(),
            };
        },

        tryFireAlert(asset, verdict, snapshot) {
            const now      = Date.now();
            const lastTime = this.lastAlertTime[asset] || 0;
            if (now - lastTime < this.ALERT_COOLDOWN) return;

            this.lastAlertTime[asset] = now;

            const Alerts = window.BRDOLWINAlerts;
            if (!Alerts) return;

            const price = snapshot.lastPrice;
            const atr   = snapshot.atr || price * 0.002;

            const entry  = price;
            const stop   = verdict.direction === 'buy'  ? price - atr * 1.5 : price + atr * 1.5;
            const target = verdict.direction === 'buy'  ? price + atr * 2.5 : price - atr * 2.5;

            const assetName = ASSET_DISPLAY[asset] || asset.toUpperCase();

            Alerts.showEntryAlert({
                asset:     assetName,
                direction: verdict.direction,
                entry, stop, target,
                reason: `Consenso de ${verdict.strategiesAligned} estratégias (${verdict.confidence}%): ${verdict.reasons[0] || ''}`,
            });

            console.log(`[Atlas Alert] 🔔 ${verdict.direction.toUpperCase()} ${assetName} @ ${price.toFixed(4)} | Confiança: ${verdict.confidence}% | Perfil: ${ASSET_DISPLAY[asset]}`);
        },

        getVerdict(asset) {
            return this.lastVerdict[asset] || null;
        },

        getVerdictForUI(asset) {
            const v = this.lastVerdict[asset];
            if (!v) {
                return {
                    label:      'Aguardando dados...',
                    color:      'var(--cor-texto-secundario)',
                    icon:       'loader',
                    confidence:  0,
                    buyScore:    0,
                    sellScore:   0,
                    signals:    {},
                };
            }

            const labels = { buy: '🟢 COMPRA', sell: '🔴 VENDA', neutral: '⚪ NEUTRO' };
            const colors = {
                buy:     'var(--cor-sucesso)',
                sell:    'var(--cor-alerta-vermelho)',
                neutral: 'var(--cor-texto-secundario)',
            };

            return {
                label:              labels[v.direction] || 'Neutro',
                color:              colors[v.direction],
                confidence:         v.confidence,
                buyScore:           v.buyScore,
                sellScore:          v.sellScore,
                strategiesAligned:  v.strategiesAligned,
                reasons:            v.reasons,
                riskAllowed:        v.riskAllowed,
                riskReason:         v.riskReason,
                signals:            v.signals,
                riskStatus:         v.riskStatus,
                weights:            v.weights,
                timestamp:          v.timestamp,
            };
        },
    };

    window.BRDOLWINAtlasOrchestrator = Orchestrator;

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { Orchestrator.init(); }, 2000);
    });
})();
