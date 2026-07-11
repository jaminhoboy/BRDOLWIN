/**
 * =====================================================
 * ATLAS BOT — memory.js
 * =====================================================
 * Memória de mercado — igual ao market-memory.js
 * do frontend, mas em módulo ESM para Node.js
 * =====================================================
 */

export class MarketMemory {
    constructor(maxSamples = 200) {
        this.history = {};
        this.maxSamples = maxSamples;
    }

    addTick(asset, price, volume = 0) {
        if (!this.history[asset]) this.history[asset] = [];
        this.history[asset].push({ price, volume, timestamp: Date.now() });
        if (this.history[asset].length > this.maxSamples) {
            this.history[asset].shift();
        }
    }

    getPrices(asset) {
        return (this.history[asset] ?? []).map(t => t.price);
    }

    getLastPrice(asset) {
        const p = this.getPrices(asset);
        return p.length ? p.at(-1) : null;
    }

    calcEMA(prices, period) {
        if (prices.length < period) return null;
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }

    calcRSI(prices, period = 14) {
        if (prices.length < period + 1) return null;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        const ag = gains / period, al = losses / period;
        if (al === 0) return 100;
        return 100 - (100 / (1 + ag / al));
    }

    calcATR(prices, period = 14) {
        if (prices.length < period + 1) return null;
        let sum = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            sum += Math.abs(prices[i] - prices[i - 1]);
        }
        return sum / period;
    }

    calcBollinger(prices, period = 20, mult = 2) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        return {
            upper: mean + std * mult,
            middle: mean,
            lower: mean - std * mult,
            bandwidth: (std * mult * 2) / mean * 100,
        };
    }

    calcVWAP(asset) {
        const ticks = this.history[asset];
        if (!ticks || ticks.length < 2) return null;
        let cumPV = 0, cumV = 0;
        ticks.forEach(t => { const v = t.volume || 1; cumPV += t.price * v; cumV += v; });
        return cumV > 0 ? cumPV / cumV : null;
    }

    calcROC(prices, period = 10) {
        if (prices.length < period + 1) return null;
        const curr = prices.at(-1);
        const prev = prices.at(-1 - period);
        return ((curr - prev) / prev) * 100;
    }

    detectLevels(asset, lookback = 50) {
        const prices = this.getPrices(asset);
        if (prices.length < lookback) return { supports: [], resistances: [] };
        const slice = prices.slice(-lookback);
        const supports = [], resistances = [];
        for (let i = 2; i < slice.length - 2; i++) {
            if (slice[i] < slice[i-1] && slice[i] < slice[i-2] && slice[i] < slice[i+1] && slice[i] < slice[i+2])
                supports.push(slice[i]);
            if (slice[i] > slice[i-1] && slice[i] > slice[i-2] && slice[i] > slice[i+1] && slice[i] > slice[i+2])
                resistances.push(slice[i]);
        }
        return { supports: supports.slice(-3), resistances: resistances.slice(-3) };
    }

    getSnapshot(asset) {
        const prices = this.getPrices(asset);
        if (prices.length < 20) return { ready: false, reason: `Dados insuficientes (${prices.length}/20)` };
        return {
            ready: true,
            lastPrice: prices.at(-1),
            ema9: this.calcEMA(prices, 9),
            ema21: this.calcEMA(prices, 21),
            ema50: this.calcEMA(prices, 50),
            rsi: this.calcRSI(prices, 14),
            atr: this.calcATR(prices, 14),
            bollinger: this.calcBollinger(prices, 20),
            vwap: this.calcVWAP(asset),
            roc: this.calcROC(prices, 10),
            levels: this.detectLevels(asset),
            sampleCount: prices.length,
        };
    }

    reset(asset) {
        if (asset) this.history[asset] = [];
        else this.history = {};
    }
}
