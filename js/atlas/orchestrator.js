/**
 * =====================================================
 * ATLAS AI — Orchestrator (Cérebro Central)
 * =====================================================
 * O Orquestrador é o motor central de decisão.
 * Ele:
 *   1. Alimenta o MarketMemory com ticks
 *   2. Executa as 8 estratégias em paralelo
 *   3. Calcula o consenso ponderado
 *   4. Consulta o RiskManager
 *   5. Dispara Alertas (Pop-ups) via AlertManager
 *   6. Executa Paper Trades via TradeJournal
 *   7. Emite o veredito final para a UI
 * =====================================================
 */
(function () {
    'use strict';

    const Orchestrator = {
        // Pesos de cada estratégia (soma = 100)
        weights: {
            trend: 20,
            momentum: 15,
            meanReversion: 15,
            volatility: 10,
            correlation: 10,
            smartMoney: 15,
            statistical: 10,
            breakout: 5
        },

        // Threshold para considerar sinal "claro"
        ALERT_THRESHOLD: 70,

        // Cooldown entre alertas (evita spam) em ms
        ALERT_COOLDOWN: 60000, // 1 minuto
        lastAlertTime: {},

        // Último veredito por ativo
        lastVerdict: {},

        // Intervalo de atualização
        updateInterval: null,

        /**
         * Inicializa o orquestrador, conectando ao MarketState
         */
        init() {
            if (!window.BRDOLWINState) {
                console.warn('[Atlas Orchestrator] BRDOLWINState não encontrado. Aguardando...');
                return;
            }

            // Carrega config inicial se existir
            if (window.BRDOLWINAtlasSettings) {
                const conf = window.BRDOLWINAtlasSettings.getSettings();
                this.weights = { ...conf.weights };
                this.ALERT_THRESHOLD = conf.threshold;
            }

            // Subscreve ao estado do mercado
            window.BRDOLWINState.subscribe((state) => {
                this.processState(state);
            });

            console.log('[Atlas Orchestrator] ✅ Inicializado e escutando MarketState');
        },

        updateConfig(config) {
            this.weights = { ...config.weights };
            this.ALERT_THRESHOLD = config.threshold;
            console.log('[Atlas Orchestrator] Configurações atualizadas dinamicamente.');
        },

        /**
         * Processa o estado do mercado (chamado a cada tick)
         */
        processState(state) {
            const Memory = window.BRDOLWINAtlasMemory;
            const Strategies = window.BRDOLWINAtlasStrategies;
            const Risk = window.BRDOLWINAtlasRisk;
            const Journal = window.BRDOLWINAtlasJournal;

            if (!Memory || !Strategies || !Risk) return;

            // ── 1. Alimentar Memória ──
            if (state.win && state.win.price) {
                Memory.addTick('win', state.win.price);
            }
            if (state.wdo && state.wdo.price) {
                Memory.addTick('wdo', state.wdo.price);
            }
            if (state.eurusd && state.eurusd.price) {
                Memory.addTick('eurusd', state.eurusd.price);
            }

            // ── 2. Analisar cada ativo ──
            const assets = ['win', 'wdo', 'eurusd', 'usdjpy', 'gbpusd'];
            const globalCtx = {
                sp500: state.sp500,
                dxy: state.dxy,
                vix: state.vix
            };

            assets.forEach(asset => {
                const snapshot = Memory.getSnapshot(asset);
                if (!snapshot.ready) return;

                // ── 3. Executar as 8 estratégias ──
                const signals = {
                    trend: Strategies.trend(snapshot),
                    momentum: Strategies.momentum(snapshot),
                    meanReversion: Strategies.meanReversion(snapshot),
                    volatility: Strategies.volatility(snapshot),
                    correlation: Strategies.correlation(snapshot, globalCtx),
                    smartMoney: Strategies.smartMoney(snapshot),
                    statistical: Strategies.statistical(),
                    breakout: Strategies.breakout(snapshot)
                };

                // ── 4. Calcular consenso ponderado ──
                const verdict = this.calcConsensus(signals, asset);
                verdict.signals = signals;
                verdict.snapshot = snapshot;
                verdict.riskStatus = Risk.getStatus();

                // ── 5. Verificar Risk Manager ──
                const vixVal = state.vix ? state.vix.price : 0;
                const riskCheck = Risk.canTrade({ vix: vixVal, asset });
                verdict.riskAllowed = riskCheck.allowed;
                verdict.riskReason = riskCheck.reason;

                // ── 6. Disparar Alerta se sinal forte ──
                if (verdict.confidence >= this.ALERT_THRESHOLD && riskCheck.allowed &&
                    verdict.direction !== 'neutral') {
                    this.tryFireAlert(asset, verdict, snapshot);
                }

                // ── 7. Checar Paper Trading ──
                if (Journal && Journal.openTrade && Journal.openTrade.asset === asset) {
                    const closedTrade = Journal.checkStopTarget(snapshot.lastPrice);
                    if (closedTrade) {
                        console.log(`[Atlas] Paper Trade fechado: ${closedTrade.result} | PnL: R$ ${closedTrade.pnlBRL.toFixed(2)}`);
                    }
                }

                // Salvar último veredito
                this.lastVerdict[asset] = verdict;
            });
        },

        /**
         * Calcula o consenso ponderado dos sinais
         */
        calcConsensus(signals, asset) {
            let buyScore = 0, sellScore = 0, totalWeight = 0;
            let buyStrategies = [], sellStrategies = [];
            const reasons = [];

            Object.entries(signals).forEach(([name, signal]) => {
                const weight = this.weights[name] || 10;
                const contribution = (signal.confidence / 100) * weight;

                if (signal.direction === 'buy') {
                    buyScore += contribution;
                    buyStrategies.push(name);
                } else if (signal.direction === 'sell') {
                    sellScore += contribution;
                    sellStrategies.push(name);
                }

                totalWeight += weight;
                if (signal.confidence > 40) {
                    reasons.push(`${name}: ${signal.reason}`);
                }
            });

            // Normalizar para 0-100
            const normalizedBuy = (buyScore / totalWeight) * 100;
            const normalizedSell = (sellScore / totalWeight) * 100;

            let direction, confidence, consensusStrategies;

            if (normalizedBuy > normalizedSell && normalizedBuy > 30) {
                direction = 'buy';
                confidence = Math.round(normalizedBuy);
                consensusStrategies = buyStrategies;
            } else if (normalizedSell > normalizedBuy && normalizedSell > 30) {
                direction = 'sell';
                confidence = Math.round(normalizedSell);
                consensusStrategies = sellStrategies;
            } else {
                direction = 'neutral';
                confidence = Math.round(Math.max(normalizedBuy, normalizedSell));
                consensusStrategies = [];
            }

            return {
                asset,
                direction,
                confidence,
                buyScore: Math.round(normalizedBuy),
                sellScore: Math.round(normalizedSell),
                consensusStrategies,
                strategiesAligned: consensusStrategies.length,
                reasons: reasons.slice(0, 4), // Top 4 razões
                timestamp: Date.now()
            };
        },

        /**
         * Tenta disparar um alerta (com cooldown)
         */
        tryFireAlert(asset, verdict, snapshot) {
            const now = Date.now();
            const lastTime = this.lastAlertTime[asset] || 0;

            if (now - lastTime < this.ALERT_COOLDOWN) return;

            this.lastAlertTime[asset] = now;

            const Alerts = window.BRDOLWINAlerts;
            if (!Alerts) return;

            const price = snapshot.lastPrice;
            const atr = snapshot.atr || 100;

            // Calcular stops e alvos dinamicamente pelo ATR
            let entry, stop, target;
            if (verdict.direction === 'buy') {
                entry = price;
                stop = price - atr * 1.5;
                target = price + atr * 2.5;
            } else {
                entry = price;
                stop = price + atr * 1.5;
                target = price - atr * 2.5;
            }

            const formatAssetName = (ast) => {
                const map = {
                    'win': 'WINV26', 'wdo': 'WDOV26',
                    'eurusd': 'EUR/USD', 'usdjpy': 'USD/JPY', 'gbpusd': 'GBP/USD'
                };
                return map[ast] || ast.toUpperCase();
            };
            const assetName = formatAssetName(asset);

            Alerts.showEntryAlert({
                asset: assetName,
                direction: verdict.direction,
                entry: entry,
                stop: stop,
                target: target,
                reason: `Consenso de ${verdict.strategiesAligned} estratégias (${verdict.confidence}%): ${verdict.reasons[0] || ''}`
            });

            console.log(`[Atlas Alert] 🔔 ${verdict.direction.toUpperCase()} ${assetName} @ ${price} | Confiança: ${verdict.confidence}%`);
        },

        /**
         * Retorna o veredito mais recente para um ativo
         */
        getVerdict(asset) {
            return this.lastVerdict[asset] || null;
        },

        /**
         * Retorna o veredito formatado para a UI
         */
        getVerdictForUI(asset) {
            const v = this.lastVerdict[asset];
            if (!v) {
                return {
                    label: 'Aguardando dados...',
                    color: 'var(--cor-texto-secundario)',
                    icon: 'loader',
                    confidence: 0,
                    signals: {}
                };
            }

            const labels = {
                buy: '🟢 COMPRA',
                sell: '🔴 VENDA',
                neutral: '⚪ NEUTRO'
            };
            const colors = {
                buy: 'var(--cor-sucesso)',
                sell: 'var(--cor-alerta-vermelho)',
                neutral: 'var(--cor-texto-secundario)'
            };

            return {
                label: labels[v.direction] || 'Neutro',
                color: colors[v.direction],
                confidence: v.confidence,
                buyScore: v.buyScore,
                sellScore: v.sellScore,
                strategiesAligned: v.strategiesAligned,
                reasons: v.reasons,
                riskAllowed: v.riskAllowed,
                riskReason: v.riskReason,
                signals: v.signals,
                riskStatus: v.riskStatus,
                timestamp: v.timestamp
            };
        }
    };

    window.BRDOLWINAtlasOrchestrator = Orchestrator;

    // Inicializa após o DOM carregar
    document.addEventListener('DOMContentLoaded', () => {
        // Pequeno delay para garantir que MarketState já inicializou
        setTimeout(() => {
            Orchestrator.init();
        }, 2000);
    });
})();
