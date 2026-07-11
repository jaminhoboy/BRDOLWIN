/**
 * =====================================================
 * ATLAS BOT — strategies.js (Node.js Backend)
 * =====================================================
 * v2.0 — Alinhado com o frontend:
 *   • statistical() separado por mercado (B3 / Forex)
 *   • correlation() com contexto par-específico
 *   • smartMoney() com Stop Hunt detection
 * =====================================================
 */

export const Strategies = {

    // 1. TENDÊNCIA (EMAs)
    trend(snapshot) {
        if (!snapshot.ready || !snapshot.ema9 || !snapshot.ema21)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { ema9, ema21, lastPrice: price } = snapshot;
        const spread = ((ema9 - ema21) / ema21) * 100;

        if (ema9 > ema21 && price > ema9)
            return { direction: 'buy',  confidence: Math.min(90, 50 + Math.abs(spread) * 20), reason: `EMA9 > EMA21, preço acima` };
        if (ema9 < ema21 && price < ema9)
            return { direction: 'sell', confidence: Math.min(90, 50 + Math.abs(spread) * 20), reason: `EMA9 < EMA21, preço abaixo` };

        return { direction: 'neutral', confidence: 20, reason: 'EMAs sem cruzamento claro' };
    },

    // 2. MOMENTUM (RSI + ROC)
    momentum(snapshot) {
        if (!snapshot.ready || snapshot.rsi === null)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { rsi } = snapshot;
        const roc = snapshot.roc || 0;

        if (rsi > 70 && roc > 0.5)  return { direction: 'buy',  confidence: Math.min(85, 40 + rsi - 70 + roc * 10), reason: `RSI ${rsi.toFixed(1)} forte + ROC ${roc.toFixed(2)}%` };
        if (rsi < 30 && roc < -0.5) return { direction: 'sell', confidence: Math.min(85, 40 + (30 - rsi) + Math.abs(roc) * 10), reason: `RSI ${rsi.toFixed(1)} fraco + ROC ${roc.toFixed(2)}%` };
        if (rsi > 55 && roc > 0.2)  return { direction: 'buy',  confidence: 45, reason: `Momentum moderado (RSI ${rsi.toFixed(1)})` };
        if (rsi < 45 && roc < -0.2) return { direction: 'sell', confidence: 45, reason: `Momentum baixo (RSI ${rsi.toFixed(1)})` };

        return { direction: 'neutral', confidence: 25, reason: `RSI neutro (${rsi.toFixed(1)})` };
    },

    // 3. REVERSÃO À MÉDIA (Bollinger + VWAP)
    meanReversion(snapshot) {
        if (!snapshot.ready || !snapshot.bollinger)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { bollinger: bb, lastPrice: price, vwap } = snapshot;

        if (price < bb.lower) {
            const dist = ((bb.lower - price) / bb.lower) * 100;
            return { direction: 'buy',  confidence: Math.min(85, 55 + dist * 15), reason: `Abaixo da BB inferior (${bb.lower.toFixed(2)})` };
        }
        if (price > bb.upper) {
            const dist = ((price - bb.upper) / bb.upper) * 100;
            return { direction: 'sell', confidence: Math.min(85, 55 + dist * 15), reason: `Acima da BB superior (${bb.upper.toFixed(2)})` };
        }
        if (vwap) {
            const d = ((price - vwap) / vwap) * 100;
            if (d < -0.3) return { direction: 'buy',  confidence: 40, reason: `${Math.abs(d).toFixed(2)}% abaixo do VWAP` };
            if (d >  0.3) return { direction: 'sell', confidence: 40, reason: `${d.toFixed(2)}% acima do VWAP` };
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
            if (pos > 0.6) return { direction: 'buy',     confidence: 60, reason: `Compressão de vol + preço superior` };
            if (pos < 0.4) return { direction: 'sell',    confidence: 60, reason: `Compressão de vol + preço inferior` };
            return             { direction: 'neutral',    confidence: 50, reason: `Compressão extrema — aguardando` };
        }
        if (bb.bandwidth > 3.0) return { direction: 'neutral', confidence: 30, reason: `Alta volatilidade` };

        return { direction: 'neutral', confidence: 35, reason: `Volatilidade normal (ATR: ${atr.toFixed(2)})` };
    },

    // 5. CORRELAÇÃO (Intermarket — par-específica)
    correlation(snapshot, globalState, pairKey = '') {
        if (!globalState) return { direction: 'neutral', confidence: 0, reason: 'Dados globais indisponíveis' };

        let buyScore = 0, sellScore = 0;
        const signals = [];

        // S&P500 — apetite a risco global
        if (globalState.sp500?.changePercent) {
            const sp = globalState.sp500.changePercent;
            if (sp > 0.3)  { buyScore  += 20; signals.push(`S&P500 +${sp.toFixed(2)}%`); }
            if (sp < -0.3) { sellScore += 20; signals.push(`S&P500 ${sp.toFixed(2)}%`); }
        }

        // VIX — medo do mercado
        if (globalState.vix?.price) {
            const vix = globalState.vix.price;
            if (vix > 25) { sellScore += 25; signals.push(`VIX elevado (${vix.toFixed(1)})`); }
            if (vix < 15) { buyScore  += 12; signals.push(`VIX baixo (${vix.toFixed(1)})`); }
        }

        // DXY — força do Dólar
        if (globalState.dxy?.changePercent) {
            const dxy = globalState.dxy.changePercent;
            const dxyInverse = ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'eurgbp', 'win', 'wdo'];
            const dxyDirect  = ['usdjpy', 'usdcad', 'usdchf', 'eurjpy', 'gbpjpy'];

            if (dxyInverse.includes(pairKey)) {
                if (dxy > 0.2)  { sellScore += 20; signals.push(`DXY forte (+${dxy.toFixed(2)}%)`); }
                if (dxy < -0.2) { buyScore  += 20; signals.push(`DXY fraco (${dxy.toFixed(2)}%)`); }
            }
            if (dxyDirect.includes(pairKey)) {
                if (dxy > 0.2)  { buyScore  += 20; signals.push(`DXY forte — USD favorável`); }
                if (dxy < -0.2) { sellScore += 20; signals.push(`DXY fraco — USD desfavorável`); }
            }
        }

        // Petróleo → USD/CAD
        if (pairKey === 'usdcad' && globalState.oil?.changePercent) {
            const oil = globalState.oil.changePercent;
            if (oil > 0.5)  { sellScore += 20; signals.push(`Petróleo subindo — CAD forte`); }
            if (oil < -0.5) { buyScore  += 20; signals.push(`Petróleo caindo — CAD fraco`); }
        }

        // Carry trade → JPY crosses
        if (['eurjpy', 'gbpjpy', 'usdjpy'].includes(pairKey) && globalState.vix?.price) {
            const vix = globalState.vix.price;
            if (vix > 20) { sellScore += 20; signals.push(`VIX ${vix.toFixed(1)} — JPY comprado (risk-off)`); }
            if (vix < 14) { buyScore  += 15; signals.push(`VIX ${vix.toFixed(1)} — carry trade ativo`); }
        }

        // EUR/GBP — range-bound, reduzir peso do sinal
        if (pairKey === 'eurgbp') { buyScore *= 0.6; sellScore *= 0.6; }

        const total = buyScore + sellScore;
        if (total === 0) return { direction: 'neutral', confidence: 20, reason: 'Sem sinais intermarket' };
        if (buyScore > sellScore) return { direction: 'buy',  confidence: Math.min(80, buyScore + 15), reason: signals.join(', ') };
        if (sellScore > buyScore) return { direction: 'sell', confidence: Math.min(80, sellScore + 15), reason: signals.join(', ') };
        return { direction: 'neutral', confidence: 30, reason: 'Sinais mistos' };
    },

    // 6. SMART MONEY (Zonas de Liquidez + Stop Hunt)
    smartMoney(snapshot) {
        if (!snapshot.ready || !snapshot.levels)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { lastPrice: price, levels: { supports, resistances } } = snapshot;

        for (const sup of supports) {
            const dist = ((price - sup) / sup) * 100;
            if (dist >= 0 && dist < 0.12) return { direction: 'buy',  confidence: 75, reason: `Absorção em suporte ${sup.toFixed(2)}` };
            if (dist < 0 && dist > -0.08) return { direction: 'sell', confidence: 72, reason: `Stop Hunt abaixo do suporte ${sup.toFixed(2)}` };
        }
        for (const res of resistances) {
            const dist = ((res - price) / res) * 100;
            if (dist >= 0 && dist < 0.12) return { direction: 'sell', confidence: 75, reason: `Rejeição em resistência ${res.toFixed(2)}` };
            if (dist < 0 && dist > -0.08) return { direction: 'buy',  confidence: 72, reason: `Rompimento de resistência ${res.toFixed(2)}` };
        }
        return { direction: 'neutral', confidence: 25, reason: 'Sem zonas de liquidez ativas' };
    },

    // 7. ESTATÍSTICA — B3 (Horários e dias da semana)
    statisticalB3() {
        // Hora em Brasília (UTC-3)
        const brNow = new Date(Date.now() - 3 * 3600000);
        const hour  = brNow.getUTCHours();
        const min   = brNow.getUTCMinutes();
        const day   = brNow.getUTCDay();
        const hhmm  = hour + min / 60;

        if ([0, 6].includes(day)) return { direction: 'neutral', confidence: 0, reason: 'Fim de semana — B3 fechada' };

        const isTrendDay = [2, 4].includes(day);
        let timeConf = 30, timeReason = 'Horário neutro B3';

        if      (hhmm >= 9.0  && hhmm < 10.5) { timeConf = 70; timeReason = 'Abertura B3 (09:00-10:30) — alta direcionalidade'; }
        else if (hhmm >= 14.0 && hhmm < 16.0) { timeConf = 65; timeReason = 'Abertura NY (14:00-16:00) — fluxo institucional'; }
        else if (hhmm >= 16.0 && hhmm < 17.5) { timeConf = 55; timeReason = 'Tarde B3 — posicionamento de fechamento'; }
        else if (hhmm >= 11.0 && hhmm < 14.0) { timeConf = 20; timeReason = 'Almoço B3 — baixa liquidez, evitar'; }

        if (isTrendDay) { timeConf = Math.min(80, timeConf + 8); timeReason += ' | Dia de tendência'; }

        return { direction: 'neutral', confidence: timeConf, reason: timeReason };
    },

    // 7. ESTATÍSTICA — Forex (Sessões Globais em BRT)
    statisticalForex(pairKey = '') {
        const brNow = new Date(Date.now() - 3 * 3600000);
        const hour  = brNow.getUTCHours();
        const min   = brNow.getUTCMinutes();
        const day   = brNow.getUTCDay();
        const hhmm  = hour + min / 60;

        if (day === 6) return { direction: 'neutral', confidence: 0, reason: 'Forex fechado — Sábado' };
        if (day === 0 && hhmm < 18) return { direction: 'neutral', confidence: 0, reason: 'Forex fechado — Domingo' };

        const isTokyo   = (hhmm >= 21 || hhmm < 6);
        const isLondon  = (hhmm >= 5 && hhmm < 14);
        const isNY      = (hhmm >= 9.5 && hhmm < 18);
        const isOverlap = (hhmm >= 9.5 && hhmm < 14);

        let timeConf = 20, timeReason = 'Baixa liquidez Forex';

        if      (isOverlap)              { timeConf = 80; timeReason = 'Overlap Londres+NY — PICO de liquidez'; }
        else if (isLondon && !isNY)      { timeConf = 65; timeReason = 'Sessão de Londres — alta direcionalidade'; }
        else if (isNY && !isLondon)      { timeConf = 60; timeReason = 'Sessão NY pura — fluxo americano'; }
        else if (isTokyo) {
            const jpyPairs = ['usdjpy', 'eurjpy', 'gbpjpy'];
            timeConf   = jpyPairs.includes(pairKey) ? 70 : 35;
            timeReason = jpyPairs.includes(pairKey) ? 'Sessão Tóquio — JPY máxima liquidez' : 'Sessão Tóquio — baixa para este par';
        }

        if (pairKey === 'eurgbp' && hhmm >= 5 && hhmm < 9.5) {
            timeConf = 72; timeReason = 'Pré-abertura Europa — EUR/GBP máxima liquidez';
        }

        return { direction: 'neutral', confidence: timeConf, reason: timeReason };
    },

    // Wrapper unificado
    statistical(pairKey = '') {
        return ['win', 'wdo'].includes(pairKey)
            ? this.statisticalB3()
            : this.statisticalForex(pairKey);
    },

    // 8. BREAKOUT (Rompimento de Caixa)
    breakout(snapshot) {
        if (!snapshot.ready || !snapshot.bollinger || !snapshot.levels)
            return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };

        const { lastPrice: price, bollinger: bb, levels: { supports, resistances } } = snapshot;

        if (price > bb.upper && resistances.length > 0) {
            const lastRes = resistances.at(-1);
            if (price > lastRes) return { direction: 'buy',  confidence: 78, reason: `Rompimento de BB + resistência ${lastRes.toFixed(2)}` };
        }
        if (price < bb.lower && supports.length > 0) {
            const lastSup = supports.at(-1);
            if (price < lastSup) return { direction: 'sell', confidence: 78, reason: `Breakdown de BB + suporte ${lastSup.toFixed(2)}` };
        }
        if (price > bb.upper) return { direction: 'buy',  confidence: 55, reason: 'Preço rompeu BB superior' };
        if (price < bb.lower) return { direction: 'sell', confidence: 55, reason: 'Preço rompeu BB inferior' };

        return { direction: 'neutral', confidence: 20, reason: 'Sem rompimentos' };
    },
};
