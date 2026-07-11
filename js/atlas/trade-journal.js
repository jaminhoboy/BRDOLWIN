/**
 * =====================================================
 * ATLAS AI — Trade Journal & Paper Trader
 * =====================================================
 * Registra e simula operações em tempo real.
 * Calcula métricas profissionais:
 *   - Win Rate, Profit Factor, Sharpe, Sortino
 *   - Curva de patrimônio, Drawdown máximo
 *   - Diário detalhado de cada operação
 * =====================================================
 */
(function () {
    'use strict';

    const TradeJournal = {
        trades: [],
        openTrade: null,
        startingCapital: 50000,
        equity: 50000,
        peakEquity: 50000,
        maxDrawdown: 0,

        /**
         * Abre uma nova operação simulada
         */
        openPosition(params) {
            if (this.openTrade) return null; // Já tem posição aberta

            this.openTrade = {
                id: 'ATLAS-' + Date.now(),
                asset: params.asset,
                direction: params.direction, // 'buy' | 'sell'
                entryPrice: params.entryPrice,
                stopLoss: params.stopLoss,
                takeProfit: params.takeProfit,
                lotes: params.lotes || 1,
                reason: params.reason || '',
                confidence: params.confidence || 0,
                strategies: params.strategies || [],
                entryTime: new Date().toISOString(),
                exitPrice: null,
                exitTime: null,
                pnlPoints: null,
                pnlBRL: null,
                result: null
            };
            return this.openTrade;
        },

        /**
         * Fecha a posição aberta
         */
        closePosition(exitPrice, exitReason = 'Manual') {
            if (!this.openTrade) return null;

            const trade = this.openTrade;
            trade.exitPrice = exitPrice;
            trade.exitTime = new Date().toISOString();

            // Cálculo de P&L
            if (trade.direction === 'buy') {
                trade.pnlPoints = exitPrice - trade.entryPrice;
            } else {
                trade.pnlPoints = trade.entryPrice - exitPrice;
            }

            // Valor por ponto (WIN = R$0.20/ponto, WDO = R$10/ponto)
            const pointValue = trade.asset === 'win' ? 0.20 : 10.00;
            trade.pnlBRL = trade.pnlPoints * pointValue * trade.lotes;
            trade.result = trade.pnlBRL >= 0 ? 'WIN' : 'LOSS';
            trade.exitReason = exitReason;

            // Atualizar equity
            this.equity += trade.pnlBRL;
            if (this.equity > this.peakEquity) {
                this.peakEquity = this.equity;
            }
            const currentDD = ((this.peakEquity - this.equity) / this.peakEquity) * 100;
            if (currentDD > this.maxDrawdown) {
                this.maxDrawdown = currentDD;
            }

            // Registrar e limpar
            this.trades.push({ ...trade });
            this.openTrade = null;

            // Registrar no Risk Manager
            if (window.BRDOLWINAtlasRisk) {
                window.BRDOLWINAtlasRisk.registerTradeResult(trade.pnlBRL);
            }

            return trade;
        },

        /**
         * Verifica se o preço atingiu stop ou alvo
         */
        checkStopTarget(currentPrice) {
            if (!this.openTrade) return null;

            const trade = this.openTrade;

            if (trade.direction === 'buy') {
                if (currentPrice <= trade.stopLoss) {
                    return this.closePosition(trade.stopLoss, 'Stop Loss');
                }
                if (currentPrice >= trade.takeProfit) {
                    return this.closePosition(trade.takeProfit, 'Take Profit');
                }
            } else {
                if (currentPrice >= trade.stopLoss) {
                    return this.closePosition(trade.stopLoss, 'Stop Loss');
                }
                if (currentPrice <= trade.takeProfit) {
                    return this.closePosition(trade.takeProfit, 'Take Profit');
                }
            }

            return null;
        },

        /**
         * Calcula métricas profissionais
         */
        getMetrics() {
            const total = this.trades.length;
            if (total === 0) {
                return {
                    totalTrades: 0,
                    winRate: 0,
                    profitFactor: 0,
                    sharpe: 0,
                    sortino: 0,
                    maxDrawdown: 0,
                    equity: this.equity,
                    avgWin: 0,
                    avgLoss: 0,
                    expectancy: 0
                };
            }

            const wins = this.trades.filter(t => t.result === 'WIN');
            const losses = this.trades.filter(t => t.result === 'LOSS');

            const totalWinBRL = wins.reduce((s, t) => s + t.pnlBRL, 0);
            const totalLossBRL = Math.abs(losses.reduce((s, t) => s + t.pnlBRL, 0));

            const winRate = (wins.length / total) * 100;
            const profitFactor = totalLossBRL > 0 ? totalWinBRL / totalLossBRL : totalWinBRL > 0 ? Infinity : 0;
            const avgWin = wins.length > 0 ? totalWinBRL / wins.length : 0;
            const avgLoss = losses.length > 0 ? totalLossBRL / losses.length : 0;
            const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);

            // Sharpe Ratio (simplificado, sem risk-free)
            const returns = this.trades.map(t => t.pnlBRL);
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const stdDev = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length);
            const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

            // Sortino (apenas downside deviation)
            const negReturns = returns.filter(r => r < 0);
            const downsideDev = negReturns.length > 0
                ? Math.sqrt(negReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / negReturns.length)
                : 0;
            const sortino = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

            return {
                totalTrades: total,
                wins: wins.length,
                losses: losses.length,
                winRate: winRate,
                profitFactor: profitFactor,
                sharpe: sharpe,
                sortino: sortino,
                maxDrawdown: this.maxDrawdown,
                equity: this.equity,
                pnlTotal: totalWinBRL - totalLossBRL,
                avgWin: avgWin,
                avgLoss: avgLoss,
                expectancy: expectancy
            };
        },

        /**
         * Retorna o equity curve como array [{ timestamp, equity }]
         */
        getEquityCurve() {
            let eq = this.startingCapital;
            const curve = [{ timestamp: null, equity: eq }];
            this.trades.forEach(t => {
                eq += t.pnlBRL;
                curve.push({ timestamp: t.exitTime, equity: eq });
            });
            return curve;
        },

        /**
         * Retorna os últimos N trades
         */
        getRecentTrades(n = 10) {
            return this.trades.slice(-n).reverse();
        },

        /**
         * Reset completo
         */
        reset() {
            this.trades = [];
            this.openTrade = null;
            this.equity = this.startingCapital;
            this.peakEquity = this.startingCapital;
            this.maxDrawdown = 0;
        }
    };

    window.BRDOLWINAtlasJournal = TradeJournal;
})();
