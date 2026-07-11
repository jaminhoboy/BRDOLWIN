/**
 * =====================================================
 * ATLAS AI — Trade Journal & Paper Trader
 * =====================================================
 * Registra e simula operações em tempo real.
 * Salva no LocalStorage para persistir entre as telas.
 * =====================================================
 */
(function () {
    'use strict';

    const STORAGE_KEY = '@Brdolwin:AtlasJournal';

    const TradeJournal = {
        trades: [],
        openTrade: null,
        startingCapital: 50000,
        equity: 50000,
        peakEquity: 50000,
        maxDrawdown: 0,

        /**
         * Inicializa o Journal, carregando dados salvos
         */
        init() {
            this.loadFromStorage();
        },

        loadFromStorage() {
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) {
                    const parsed = JSON.parse(data);
                    this.trades = parsed.trades || [];
                    this.openTrade = parsed.openTrade || null;
                    this.equity = parsed.equity || this.startingCapital;
                    this.peakEquity = parsed.peakEquity || this.startingCapital;
                    this.maxDrawdown = parsed.maxDrawdown || 0;
                }
            } catch (e) {
                console.error('Erro ao carregar Trade Journal do storage:', e);
            }
        },

        saveToStorage() {
            try {
                const data = {
                    trades: this.trades,
                    openTrade: this.openTrade,
                    equity: this.equity,
                    peakEquity: this.peakEquity,
                    maxDrawdown: this.maxDrawdown
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
                console.error('Erro ao salvar Trade Journal no storage:', e);
            }
        },

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
                entryTime: new Date().toISOString(),
                exitPrice: null,
                exitTime: null,
                pnlPoints: null,
                pnlBRL: null,
                result: null
            };
            
            this.saveToStorage();
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
            // Para forex, vamos usar um multiplicador fictício de R$50 por pip para simplificar
            const isWin = trade.asset.toLowerCase().includes('win');
            const isWdo = trade.asset.toLowerCase().includes('wdo');
            const pointValue = isWin ? 0.20 : (isWdo ? 10.00 : 50.00); 

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

            this.saveToStorage();

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
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    profitFactor: 0,
                    sharpe: 0,
                    maxDrawdown: 0,
                    equity: this.equity,
                    pnlTotal: 0
                };
            }

            const wins = this.trades.filter(t => t.result === 'WIN');
            const losses = this.trades.filter(t => t.result === 'LOSS');

            const totalWinBRL = wins.reduce((s, t) => s + t.pnlBRL, 0);
            const totalLossBRL = Math.abs(losses.reduce((s, t) => s + t.pnlBRL, 0));

            const winRate = (wins.length / total) * 100;
            const profitFactor = totalLossBRL > 0 ? totalWinBRL / totalLossBRL : (totalWinBRL > 0 ? Infinity : 0);

            // Sharpe Ratio simplificado
            const returns = this.trades.map(t => t.pnlBRL);
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            let stdDev = 0;
            if (returns.length > 1) {
                stdDev = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1));
            }
            const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

            return {
                totalTrades: total,
                wins: wins.length,
                losses: losses.length,
                winRate: winRate,
                profitFactor: profitFactor,
                sharpe: sharpe,
                maxDrawdown: this.maxDrawdown,
                equity: this.equity,
                pnlTotal: totalWinBRL - totalLossBRL
            };
        },

        getRecentTrades(n = 10) {
            return [...this.trades].reverse().slice(0, n);
        },

        getAllTrades() {
            return [...this.trades].reverse(); // Mais recentes primeiro
        },

        reset() {
            this.trades = [];
            this.openTrade = null;
            this.equity = this.startingCapital;
            this.peakEquity = this.startingCapital;
            this.maxDrawdown = 0;
            this.saveToStorage();
        }
    };

    TradeJournal.init();
    window.BRDOLWINAtlasJournal = TradeJournal;
})();
