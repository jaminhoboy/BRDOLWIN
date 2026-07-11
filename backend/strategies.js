/**
 * =====================================================
 * ATLAS BOT — strategies.js
 * =====================================================
 * As 8 estratégias quantitativas portadas para Node.js
 * Idênticas ao strategies.js do frontend
 * =====================================================
 */

export const Strategies = {

    // 1. TENDÊNCIA (EMAs)
    trend(snapshot) {
        if (!snapshot.ready || !snapshot.ema9 || !snapshot.ema21)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { ema9, ema21, lastPrice: price } = snapshot;
        const spread = ((ema9 - ema21) / ema21) * 100;

        if (ema9 > ema21 && price > ema9) {
            return { direction: 'buy', confidence: Math.min(90, 50 + Math.abs(spread) * 20), reason: `EMA9 > EMA21, preço acima` };
        }
        if (ema9 < ema21 && price < ema9) {
            return { direction: 'sell', confidence: Math.min(90, 50 + Math.abs(spread) * 20), reason: `EMA9 < EMA21, preço abaixo` };
        }
        return { direction: 'neutral', confidence: 20, reason: 'EMAs sem cruzamento claro' };
    },

    // 2. MOMENTUM (RSI + ROC)
    momentum(snapshot) {
        if (!snapshot.ready || snapshot.rsi === null)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const rsi = snapshot.rsi;
        const roc = snapshot.roc || 0;

        if (rsi > 70 && roc > 0.5) return { direction: 'buy', confidence: Math.min(85, 40 + rsi - 70 + roc * 10), reason: `RSI ${rsi.toFixed(1)} + ROC ${roc.toFixed(2)}%` };
        if (rsi < 30 && roc < -0.5) return { direction: 'sell', confidence: Math.min(85, 40 + (30 - rsi) + Math.abs(roc) * 10), reason: `RSI ${rsi.toFixed(1)} + ROC ${roc.toFixed(2)}%` };
        if (rsi > 55 && roc > 0.2) return { direction: 'buy', confidence: 45, reason: `Momentum moderado (RSI ${rsi.toFixed(1)})` };
        if (rsi < 45 && roc < -0.2) return { direction: 'sell', confidence: 45, reason: `Momentum moderado baixo (RSI ${rsi.toFixed(1)})` };
        return { direction: 'neutral', confidence: 25, reason: `RSI neutro (${rsi.toFixed(1)})` };
    },

    // 3. REVERSÃO À MÉDIA (Bollinger + VWAP)
    meanReversion(snapshot) {
        if (!snapshot.ready || !snapshot.bollinger)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { bollinger: bb, lastPrice: price, vwap } = snapshot;

        if (price < bb.lower) {
            const dist = ((bb.lower - price) / bb.lower) * 100;
            return { direction: 'buy', confidence: Math.min(85, 55 + dist * 15), reason: `Abaixo da BB inferior` };
        }
        if (price > bb.upper) {
            const dist = ((price - bb.upper) / bb.upper) * 100;
            return { direction: 'sell', confidence: Math.min(85, 55 + dist * 15), reason: `Acima da BB superior` };
        }
        if (vwap) {
            const d = ((price - vwap) / vwap) * 100;
            if (d < -0.3) return { direction: 'buy', confidence: 40, reason: `${Math.abs(d).toFixed(2)}% abaixo do VWAP` };
            if (d > 0.3) return { direction: 'sell', confidence: 40, reason: `${d.toFixed(2)}% acima do VWAP` };
        }
        return { direction: 'neutral', confidence: 20, reason: 'Dentro das bandas' };
    },

    // 4. VOLATILIDADE (ATR + Bollinger Width)
    volatility(snapshot) {
        if (!snapshot.ready || !snapshot.atr || !snapshot.bollinger)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { bollinger: bb, lastPrice: price, atr } = snapshot;

        if (bb.bandwidth < 1.0) {
            const pos = (price - bb.lower) / (bb.upper - bb.lower);
            if (pos > 0.6) return { direction: 'buy', confidence: 60, reason: `Compressão de vol + preço superior` };
            if (pos < 0.4) return { direction: 'sell', confidence: 60, reason: `Compressão de vol + preço inferior` };
            return { direction: 'neutral', confidence: 50, reason: `Compressão extrema` };
        }
        if (bb.bandwidth > 3.0) return { direction: 'neutral', confidence: 30, reason: `Alta volatilidade` };
        return { direction: 'neutral', confidence: 35, reason: `Volatilidade normal (ATR: ${atr.toFixed(2)})` };
    },

    // 5. CORRELAÇÃO (Intermarket)
    correlation(snapshot, globalState) {
        if (!globalState) return { direction: 'neutral', confidence: 0, reason: 'Dados globais indisponíveis' };

        let buyScore = 0, sellScore = 0;
        const signals = [];

        if (globalState.sp500?.changePercent) {
            if (globalState.sp500.changePercent > 0.3) { buyScore += 25; signals.push(`S&P500 +${globalState.sp500.changePercent.toFixed(2)}%`); }
            if (globalState.sp500.changePercent < -0.3) { sellScore += 25; signals.push(`S&P500 ${globalState.sp500.changePercent.toFixed(2)}%`); }
        }
        if (globalState.dxy?.changePercent) {
            if (globalState.dxy.changePercent > 0.2) { sellScore += 20; signals.push(`DXY forte`); }
            if (globalState.dxy.changePercent < -0.2) { buyScore += 20; signals.push(`DXY fraco`); }
        }
        if (globalState.vix?.price) {
            if (globalState.vix.price > 25) { sellScore += 30; signals.push(`VIX ${globalState.vix.price.toFixed(1)}`); }
            if (globalState.vix.price < 15) { buyScore += 15; signals.push(`VIX baixo`); }
        }

        if (buyScore + sellScore === 0) return { direction: 'neutral', confidence: 20, reason: 'Sem sinais intermarket' };
        if (buyScore > sellScore) return { direction: 'buy', confidence: Math.min(75, buyScore + 20), reason: signals.join(', ') };
        if (sellScore > buyScore) return { direction: 'sell', confidence: Math.min(75, sellScore + 20), reason: signals.join(', ') };
        return { direction: 'neutral', confidence: 30, reason: 'Sinais mistos' };
    },

    // 6. SMART MONEY (Suportes/Resistências)
    smartMoney(snapshot) {
        if (!snapshot.ready || !snapshot.levels)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { lastPrice: price, levels: { supports, resistances } } = snapshot;

        for (const sup of supports) {
            const dist = ((price - sup) / sup) * 100;
            if (dist >= 0 && dist < 0.15) return { direction: 'buy', confidence: 70, reason: `Testando suporte em ${sup.toFixed(2)}` };
        }
        for (const res of resistances) {
            const dist = ((res - price) / res) * 100;
            if (dist >= 0 && dist < 0.15) return { direction: 'sell', confidence: 70, reason: `Testando resistência em ${res.toFixed(2)}` };
        }
        return { direction: 'neutral', confidence: 25, reason: 'Sem zonas ativas' };
    },

    // 7. ESTATÍSTICA (Sazonalidade e Horários)
    statistical() {
        const now = new Date();
        // Hora de Brasília (UTC-3)
        const brNow = new Date(now.getTime() - 3 * 3600000);
        const hour = brNow.getUTCHours();
        const dayOfWeek = brNow.getUTCDay();
        const isTrendDay = [2, 4].includes(dayOfWeek); // Terça e Quinta

        let timeConf = 40;
        let timeReason = 'Horário neutro';

        if (hour >= 9 && hour < 11) { timeConf = 65; timeReason = 'Abertura B3 (09-11h)'; }
        else if (hour >= 14 && hour < 16) { timeConf = 60; timeReason = 'Abertura NY (14-16h)'; }
        else if (hour >= 11 && hour < 14) { timeConf = 30; timeReason = 'Almoço (11-14h)'; }

        if (isTrendDay) { timeConf = Math.min(80, timeConf + 10); timeReason += ' | Dia de tendência'; }

        return { direction: 'neutral', confidence: timeConf, reason: timeReason };
    },

    // 8. BREAKOUT (Rompimento de Caixa)
    breakout(snapshot) {
        if (!snapshot.ready || !snapshot.bollinger || !snapshot.levels)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { lastPrice: price, bollinger: bb, levels: { supports, resistances } } = snapshot;

        if (price > bb.upper && resistances.length > 0) {
            const lastRes = resistances.at(-1);
            if (price > lastRes) return { direction: 'buy', confidence: 75, reason: `Rompimento de BB + resistência ${lastRes.toFixed(2)}` };
        }
        if (price < bb.lower && supports.length > 0) {
            const lastSup = supports.at(-1);
            if (price < lastSup) return { direction: 'sell', confidence: 75, reason: `Breakdown de BB + suporte ${lastSup.toFixed(2)}` };
        }
        if (price > bb.upper) return { direction: 'buy', confidence: 55, reason: 'Preço rompeu BB superior' };
        if (price < bb.lower) return { direction: 'sell', confidence: 55, reason: 'Preço rompeu BB inferior' };

        return { direction: 'neutral', confidence: 20, reason: 'Sem rompimentos' };
    },
};
