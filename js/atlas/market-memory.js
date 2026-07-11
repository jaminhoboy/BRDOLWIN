/**
 * =====================================================
 * ATLAS AI — Market Memory (Memória de Mercado)
 * =====================================================
 * Armazena o contexto intraday em tempo real:
 * - Histórico de preços (últimas N amostras)
 * - Detecção de níveis-chave (suportes/resistências)
 * - Cálculo de indicadores técnicos (EMA, RSI, ATR, BB)
 * - VWAP estimado
 * =====================================================
 */
(function () {
    'use strict';

    const MarketMemory = {
        // Histórico por ativo: { win: [], wdo: [], eurusd: [], ... }
        history: {},
        maxSamples: 200,

        /**
         * Registra um novo tick de preço
         */
        addTick(asset, price, volume = 0) {
            if (!this.history[asset]) {
                this.history[asset] = [];
            }
            const arr = this.history[asset];
            arr.push({
                price,
                volume,
                timestamp: Date.now()
            });
            // Manter apenas maxSamples
            if (arr.length > this.maxSamples) {
                arr.shift();
            }
        },

        /**
         * Retorna os preços como array simples
         */
        getPrices(asset) {
            if (!this.history[asset]) return [];
            return this.history[asset].map(t => t.price);
        },

        /**
         * Retorna o último preço
         */
        getLastPrice(asset) {
            const prices = this.getPrices(asset);
            return prices.length > 0 ? prices[prices.length - 1] : null;
        },

        /**
         * EMA — Média Móvel Exponencial
         */
        calcEMA(prices, period) {
            if (prices.length < period) return null;
            const k = 2 / (period + 1);
            let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
            for (let i = period; i < prices.length; i++) {
                ema = prices[i] * k + ema * (1 - k);
            }
            return ema;
        },

        /**
         * RSI — Índice de Força Relativa
         */
        calcRSI(prices, period = 14) {
            if (prices.length < period + 1) return null;
            let gains = 0, losses = 0;
            for (let i = prices.length - period; i < prices.length; i++) {
                const diff = prices[i] - prices[i - 1];
                if (diff >= 0) gains += diff;
                else losses -= diff;
            }
            const avgGain = gains / period;
            const avgLoss = losses / period;
            if (avgLoss === 0) return 100;
            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        },

        /**
         * ATR — Average True Range (simplificado, sem candles)
         */
        calcATR(prices, period = 14) {
            if (prices.length < period + 1) return null;
            let sumTR = 0;
            for (let i = prices.length - period; i < prices.length; i++) {
                sumTR += Math.abs(prices[i] - prices[i - 1]);
            }
            return sumTR / period;
        },

        /**
         * Bollinger Bands
         */
        calcBollinger(prices, period = 20, stdDevMult = 2) {
            if (prices.length < period) return null;
            const slice = prices.slice(-period);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
            const stdDev = Math.sqrt(variance);
            return {
                upper: mean + stdDev * stdDevMult,
                middle: mean,
                lower: mean - stdDev * stdDevMult,
                bandwidth: (stdDev * stdDevMult * 2) / mean * 100 // % da banda
            };
        },

        /**
         * VWAP estimado
         */
        calcVWAP(asset) {
            const ticks = this.history[asset];
            if (!ticks || ticks.length < 2) return null;
            let cumPV = 0, cumV = 0;
            ticks.forEach(t => {
                const vol = t.volume || 1;
                cumPV += t.price * vol;
                cumV += vol;
            });
            return cumV > 0 ? cumPV / cumV : null;
        },

        /**
         * ROC — Rate of Change (Momentum)
         */
        calcROC(prices, period = 10) {
            if (prices.length < period + 1) return null;
            const current = prices[prices.length - 1];
            const prev = prices[prices.length - 1 - period];
            return ((current - prev) / prev) * 100;
        },

        /**
         * Detecta suportes e resistências simples
         * (últimos mínimos e máximos locais)
         */
        detectLevels(asset, lookback = 50) {
            const prices = this.getPrices(asset);
            if (prices.length < lookback) return { supports: [], resistances: [] };

            const slice = prices.slice(-lookback);
            const supports = [];
            const resistances = [];

            for (let i = 2; i < slice.length - 2; i++) {
                // Mínimo local
                if (slice[i] < slice[i - 1] && slice[i] < slice[i - 2] &&
                    slice[i] < slice[i + 1] && slice[i] < slice[i + 2]) {
                    supports.push(slice[i]);
                }
                // Máximo local
                if (slice[i] > slice[i - 1] && slice[i] > slice[i - 2] &&
                    slice[i] > slice[i + 1] && slice[i] > slice[i + 2]) {
                    resistances.push(slice[i]);
                }
            }

            return {
                supports: supports.slice(-3),   // últimos 3
                resistances: resistances.slice(-3)
            };
        },

        /**
         * Retorna snapshot completo de indicadores para um ativo
         */
        getSnapshot(asset) {
            const prices = this.getPrices(asset);
            if (prices.length < 20) {
                return { ready: false, reason: 'Dados insuficientes (' + prices.length + '/20)' };
            }

            return {
                ready: true,
                lastPrice: prices[prices.length - 1],
                ema9: this.calcEMA(prices, 9),
                ema21: this.calcEMA(prices, 21),
                ema50: this.calcEMA(prices, 50),
                rsi: this.calcRSI(prices, 14),
                atr: this.calcATR(prices, 14),
                bollinger: this.calcBollinger(prices, 20),
                vwap: this.calcVWAP(asset),
                roc: this.calcROC(prices, 10),
                levels: this.detectLevels(asset),
                sampleCount: prices.length
            };
        },

        /**
         * Reseta tudo (ex: novo dia)
         */
        reset(asset) {
            if (asset) {
                this.history[asset] = [];
            } else {
                this.history = {};
            }
        }
    };

    window.BRDOLWINAtlasMemory = MarketMemory;
})();
