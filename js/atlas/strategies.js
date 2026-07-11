/**
 * =====================================================
 * ATLAS AI — Strategies (8 Plugins Quantitativos)
 * =====================================================
 * Cada estratégia recebe um snapshot do MarketMemory
 * e retorna: { direction, confidence, reason }
 *   direction: 'buy' | 'sell' | 'neutral'
 *   confidence: 0-100
 *   reason: string
 *
 * v2.0 — Statistical separado por mercado (B3 / Forex)
 *         Correlation com contexto par-específico
 * =====================================================
 */
(function () {
    'use strict';

    const Strategies = {

        // ──────────────────────────────────────
        // 1. TENDÊNCIA (Cruzamento de EMAs)
        // ──────────────────────────────────────
        trend(snapshot) {
            if (!snapshot.ready || !snapshot.ema9 || !snapshot.ema21) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const ema9  = snapshot.ema9;
            const ema21 = snapshot.ema21;
            const price = snapshot.lastPrice;
            const spread = ((ema9 - ema21) / ema21) * 100;

            if (ema9 > ema21 && price > ema9) {
                const conf = Math.min(90, 50 + Math.abs(spread) * 20);
                return { direction: 'buy',  confidence: conf, reason: `EMA9 (${ema9.toFixed(2)}) > EMA21 (${ema21.toFixed(2)}), preço acima` };
            }
            if (ema9 < ema21 && price < ema9) {
                const conf = Math.min(90, 50 + Math.abs(spread) * 20);
                return { direction: 'sell', confidence: conf, reason: `EMA9 (${ema9.toFixed(2)}) < EMA21 (${ema21.toFixed(2)}), preço abaixo` };
            }
            return { direction: 'neutral', confidence: 20, reason: 'EMAs sem cruzamento claro' };
        },

        // ──────────────────────────────────────
        // 2. MOMENTUM (RSI + ROC)
        // ──────────────────────────────────────
        momentum(snapshot) {
            if (!snapshot.ready || snapshot.rsi === null) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const rsi = snapshot.rsi;
            const roc = snapshot.roc || 0;

            if (rsi > 70 && roc > 0.5) {
                return { direction: 'buy',  confidence: Math.min(85, 40 + rsi - 70 + roc * 10), reason: `RSI ${rsi.toFixed(1)} (forte) + ROC ${roc.toFixed(2)}%` };
            }
            if (rsi < 30 && roc < -0.5) {
                return { direction: 'sell', confidence: Math.min(85, 40 + (30 - rsi) + Math.abs(roc) * 10), reason: `RSI ${rsi.toFixed(1)} (fraco) + ROC ${roc.toFixed(2)}%` };
            }
            if (rsi > 55 && roc > 0.2) {
                return { direction: 'buy',  confidence: 45, reason: `Momentum moderado (RSI ${rsi.toFixed(1)})` };
            }
            if (rsi < 45 && roc < -0.2) {
                return { direction: 'sell', confidence: 45, reason: `Momentum moderado baixo (RSI ${rsi.toFixed(1)})` };
            }
            return { direction: 'neutral', confidence: 25, reason: `RSI neutro (${rsi.toFixed(1)})` };
        },

        // ──────────────────────────────────────
        // 3. REVERSÃO À MÉDIA (Bollinger + VWAP)
        // ──────────────────────────────────────
        meanReversion(snapshot) {
            if (!snapshot.ready || !snapshot.bollinger) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const bb    = snapshot.bollinger;
            const price = snapshot.lastPrice;
            const vwap  = snapshot.vwap;

            if (price < bb.lower) {
                const distPct = ((bb.lower - price) / bb.lower) * 100;
                const conf = Math.min(85, 55 + distPct * 15);
                return { direction: 'buy',  confidence: conf, reason: `Preço abaixo da BB inferior (${bb.lower.toFixed(2)}), reversão provável` };
            }
            if (price > bb.upper) {
                const distPct = ((price - bb.upper) / bb.upper) * 100;
                const conf = Math.min(85, 55 + distPct * 15);
                return { direction: 'sell', confidence: conf, reason: `Preço acima da BB superior (${bb.upper.toFixed(2)}), reversão provável` };
            }

            if (vwap) {
                const vwapDist = ((price - vwap) / vwap) * 100;
                if (vwapDist < -0.3) return { direction: 'buy',  confidence: 40, reason: `Preço ${Math.abs(vwapDist).toFixed(2)}% abaixo do VWAP` };
                if (vwapDist >  0.3) return { direction: 'sell', confidence: 40, reason: `Preço ${vwapDist.toFixed(2)}% acima do VWAP` };
            }

            return { direction: 'neutral', confidence: 20, reason: 'Preço dentro das bandas — sem reversão' };
        },

        // ──────────────────────────────────────
        // 4. VOLATILIDADE (ATR + Bollinger Width)
        // ──────────────────────────────────────
        volatility(snapshot) {
            if (!snapshot.ready || !snapshot.atr || !snapshot.bollinger) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const bb    = snapshot.bollinger;
            const atr   = snapshot.atr;
            const price = snapshot.lastPrice;

            if (bb.bandwidth < 1.0) {
                const midPos = (price - bb.lower) / (bb.upper - bb.lower);
                if (midPos > 0.6) return { direction: 'buy',     confidence: 60, reason: `Compressão de vol (BB ${bb.bandwidth.toFixed(2)}%) + preço na parte superior` };
                if (midPos < 0.4) return { direction: 'sell',    confidence: 60, reason: `Compressão de vol (BB ${bb.bandwidth.toFixed(2)}%) + preço na parte inferior` };
                return             { direction: 'neutral',        confidence: 50, reason: `Compressão extrema — aguardando definição` };
            }

            if (bb.bandwidth > 3.0) {
                return { direction: 'neutral', confidence: 30, reason: `Alta volatilidade (BB ${bb.bandwidth.toFixed(2)}%) — mercado instável` };
            }

            return { direction: 'neutral', confidence: 35, reason: `Volatilidade normal (ATR: ${atr.toFixed(2)})` };
        },

        // ──────────────────────────────────────
        // 5. CORRELAÇÃO (Intermarket — contexto por par)
        // pairKey: string — ex: 'win', 'wdo', 'eurusd', 'audusd'
        // ──────────────────────────────────────
        correlation(snapshot, globalState, pairKey = '') {
            if (!globalState) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados globais não disponíveis' };
            }

            let buyScore = 0, sellScore = 0;
            const signals = [];

            // ── Correlações comuns a todos ──
            // S&P500 — proxy de apetite a risco global
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

                // Para ativos que sobem com DXY fraco (EUR/USD, GBP/USD, AUD/USD, NZD/USD, WIN, WDO)
                const dxyInverseAssets = ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'eurgbp', 'win', 'wdo'];
                if (dxyInverseAssets.includes(pairKey)) {
                    if (dxy > 0.2)  { sellScore += 20; signals.push(`DXY forte (+${dxy.toFixed(2)}%)`); }
                    if (dxy < -0.2) { buyScore  += 20; signals.push(`DXY fraco (${dxy.toFixed(2)}%)`); }
                }

                // Para ativos que sobem com DXY forte (USD/JPY, USD/CAD, USD/CHF)
                const dxyDirectAssets = ['usdjpy', 'usdcad', 'usdchf', 'eurjpy', 'gbpjpy'];
                if (dxyDirectAssets.includes(pairKey)) {
                    if (dxy > 0.2)  { buyScore  += 20; signals.push(`DXY forte — USD favorável (+${dxy.toFixed(2)}%)`); }
                    if (dxy < -0.2) { sellScore += 20; signals.push(`DXY fraco — USD desfavorável (${dxy.toFixed(2)}%)`); }
                }
            }

            // ── Correlações Par-Específicas ──

            // AUD/USD e NZD/USD: correlação positiva com Ouro e commodities
            if (['audusd', 'nzdusd'].includes(pairKey) && globalState.gold?.changePercent) {
                const g = globalState.gold.changePercent;
                if (g > 0.3)  { buyScore  += 15; signals.push(`Ouro subindo (+${g.toFixed(2)}%) — favorável AUD/NZD`); }
                if (g < -0.3) { sellScore += 15; signals.push(`Ouro caindo (${g.toFixed(2)}%) — desfavorável AUD/NZD`); }
            }

            // USD/CAD: correlação inversa com Petróleo
            if (pairKey === 'usdcad' && globalState.oil?.changePercent) {
                const oil = globalState.oil.changePercent;
                if (oil > 0.5)  { sellScore += 20; signals.push(`Petróleo subindo (+${oil.toFixed(2)}%) — CAD forte`); }
                if (oil < -0.5) { buyScore  += 20; signals.push(`Petróleo caindo (${oil.toFixed(2)}%) — CAD fraco`); }
            }

            // EUR/JPY e GBP/JPY: carry trade — VIX alto = venda (risk-off = yen comprado)
            if (['eurjpy', 'gbpjpy', 'usdjpy'].includes(pairKey) && globalState.vix?.price) {
                const vix = globalState.vix.price;
                if (vix > 20) { sellScore += 20; signals.push(`VIX ${vix.toFixed(1)} — JPY comprado (risk-off)`); }
                if (vix < 14) { buyScore  += 15; signals.push(`VIX ${vix.toFixed(1)} — carry trade ativo (risk-on)`); }
            }

            // EUR/GBP: range-bound por padrão — penalizar sinais extremos
            if (pairKey === 'eurgbp') {
                buyScore  *= 0.6;
                sellScore *= 0.6;
                signals.push('EUR/GBP: par range-bound, sinal reduzido');
            }

            const total = buyScore + sellScore;
            if (total === 0) return { direction: 'neutral', confidence: 20, reason: 'Sem sinais intermarket relevantes' };

            if (buyScore > sellScore) {
                return { direction: 'buy',  confidence: Math.min(80, buyScore + 15), reason: 'Correlação favorável: ' + signals.join(', ') };
            }
            if (sellScore > buyScore) {
                return { direction: 'sell', confidence: Math.min(80, sellScore + 15), reason: 'Correlação desfavorável: ' + signals.join(', ') };
            }
            return { direction: 'neutral', confidence: 30, reason: 'Sinais intermarket mistos' };
        },

        // ──────────────────────────────────────
        // 6. SMART MONEY (Zonas de Liquidez / ICT Wyckoff)
        // ──────────────────────────────────────
        smartMoney(snapshot) {
            if (!snapshot.ready || !snapshot.levels) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const price = snapshot.lastPrice;
            const { supports, resistances } = snapshot.levels;

            // Absorção em suporte (Smart Money comprando)
            for (const sup of supports) {
                const dist = ((price - sup) / sup) * 100;
                if (dist >= 0 && dist < 0.12) {
                    return { direction: 'buy',  confidence: 75, reason: `Absorção em suporte ${sup.toFixed(2)} — Smart Money comprando` };
                }
                // Rompimento de suporte com velocidade = venda agressiva
                if (dist < 0 && dist > -0.08) {
                    return { direction: 'sell', confidence: 72, reason: `Stop Hunt abaixo do suporte ${sup.toFixed(2)} — liquidez varrida` };
                }
            }

            // Rejeição em resistência (Smart Money vendendo)
            for (const res of resistances) {
                const dist = ((res - price) / res) * 100;
                if (dist >= 0 && dist < 0.12) {
                    return { direction: 'sell', confidence: 75, reason: `Rejeição em resistência ${res.toFixed(2)} — Smart Money vendendo` };
                }
                // Rompimento de resistência = compra institucional
                if (dist < 0 && dist > -0.08) {
                    return { direction: 'buy',  confidence: 72, reason: `Rompimento de resistência ${res.toFixed(2)} — liquidez institucional` };
                }
            }

            return { direction: 'neutral', confidence: 25, reason: 'Sem zonas de liquidez ativas' };
        },

        // ──────────────────────────────────────
        // 7a. ESTATÍSTICA — Mercado Brasileiro (B3)
        // Horários e dias com maior probabilidade de tendência no WIN/WDO
        // ──────────────────────────────────────
        statisticalB3() {
            const now       = new Date();
            const hour      = now.getHours();
            const min       = now.getMinutes();
            const dayOfWeek = now.getDay();

            // Terça (2) e Quinta (4) têm mais tendência no WIN historicamente
            const isTrendDay   = [2, 4].includes(dayOfWeek);
            const isWeekend    = [0, 6].includes(dayOfWeek);
            if (isWeekend) return { direction: 'neutral', confidence: 0, reason: 'Fim de semana — B3 fechada' };

            let timeConf = 0;
            let timeReason = '';
            const hhmm = hour + min / 60;

            if (hhmm >= 9.0 && hhmm < 10.5) {
                timeConf = 70; timeReason = 'Abertura B3 (09:00-10:30) — alta direcionalidade';
            } else if (hhmm >= 14.0 && hhmm < 16.0) {
                timeConf = 65; timeReason = 'Abertura NY (14:00-16:00) — fluxo institucional ativo';
            } else if (hhmm >= 16.0 && hhmm < 17.5) {
                timeConf = 55; timeReason = 'Tarde B3 (16:00-17:30) — posicionamento de fechamento';
            } else if (hhmm >= 11.0 && hhmm < 14.0) {
                timeConf = 20; timeReason = 'Almoço B3 (11:00-14:00) — baixa liquidez, evitar';
            } else {
                timeConf = 30; timeReason = 'Horário neutro B3';
            }

            if (isTrendDay) {
                timeConf = Math.min(80, timeConf + 8);
                timeReason += ' | Dia de tendência estatística';
            }

            return { direction: 'neutral', confidence: timeConf, reason: timeReason };
        },

        // ──────────────────────────────────────
        // 7b. ESTATÍSTICA — Forex (Sessões Globais)
        // Sessões de Londres, NY, Tóquio e overlaps
        // ──────────────────────────────────────
        statisticalForex(pairKey = '') {
            const now  = new Date();
            const hour = now.getHours();
            const min  = now.getMinutes();
            const day  = now.getDay();
            const hhmm = hour + min / 60;

            // Forex fechado no fim de semana (exceto abertura Domingo 18h)
            if (day === 6) return { direction: 'neutral', confidence: 0, reason: 'Forex fechado — Sábado' };
            if (day === 0 && hhmm < 18) return { direction: 'neutral', confidence: 0, reason: 'Forex fechado — Domingo (abre às 18h)' };

            let timeConf = 30;
            let timeReason = '';

            // Horários em BRT (UTC-3)
            // Tóquio: 21:00 BRT (D-1) — 06:00 BRT
            // Londres: 05:00 BRT — 14:00 BRT
            // Nova York: 09:30 BRT — 18:00 BRT
            // Overlap Londres+NY: 09:30 BRT — 14:00 BRT (pico máximo de liquidez)

            const isTokyo   = (hhmm >= 21 || hhmm < 6);
            const isLondon  = (hhmm >= 5 && hhmm < 14);
            const isNY      = (hhmm >= 9.5 && hhmm < 18);
            const isOverlap = (hhmm >= 9.5 && hhmm < 14);  // London + NY

            if (isOverlap) {
                timeConf = 80; timeReason = 'Overlap Londres+NY (09:30-14:00) — PICO de liquidez Forex';
            } else if (isLondon && !isNY) {
                timeConf = 65; timeReason = 'Sessão de Londres (05:00-09:30) — alta direcionalidade';
            } else if (isNY && !isLondon) {
                timeConf = 60; timeReason = 'Sessão NY pura (14:00-18:00) — fluxo americano ativo';
            } else if (isTokyo) {
                // Tóquio é mais relevante para JPY
                const jpyPairs = ['usdjpy', 'eurjpy', 'gbpjpy'];
                timeConf   = jpyPairs.includes(pairKey) ? 70 : 35;
                timeReason = jpyPairs.includes(pairKey)
                    ? `Sessão de Tóquio — JPY com máxima liquidez`
                    : `Sessão de Tóquio — baixa liquidez para este par`;
            } else {
                timeConf = 20; timeReason = 'Mercado Forex com baixa liquidez neste horário';
            }

            // EUR/GBP: mais ativo na abertura europeia antes do overlap
            if (pairKey === 'eurgbp' && hhmm >= 5 && hhmm < 9.5) {
                timeConf = 72; timeReason = 'Pré-abertura Europa — EUR/GBP com máxima liquidez';
            }

            return { direction: 'neutral', confidence: timeConf, reason: timeReason };
        },

        // Wrapper unificado — o orchestrator chama sempre este
        statistical(pairKey = '') {
            const b3Assets = ['win', 'wdo'];
            if (b3Assets.includes(pairKey)) return this.statisticalB3();
            return this.statisticalForex(pairKey);
        },

        // ──────────────────────────────────────
        // 8. BREAKOUT (Rompimento de Caixa)
        // ──────────────────────────────────────
        breakout(snapshot) {
            if (!snapshot.ready || !snapshot.bollinger || !snapshot.levels) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const price = snapshot.lastPrice;
            const bb    = snapshot.bollinger;
            const { supports, resistances } = snapshot.levels;

            if (price > bb.upper && resistances.length > 0) {
                const lastRes = resistances[resistances.length - 1];
                if (price > lastRes) {
                    return { direction: 'buy',  confidence: 78, reason: `Rompimento de BB superior + resistência ${lastRes.toFixed(2)}` };
                }
            }

            if (price < bb.lower && supports.length > 0) {
                const lastSup = supports[supports.length - 1];
                if (price < lastSup) {
                    return { direction: 'sell', confidence: 78, reason: `Rompimento de BB inferior + suporte ${lastSup.toFixed(2)}` };
                }
            }

            if (price > bb.upper) return { direction: 'buy',  confidence: 55, reason: 'Preço rompeu banda superior de Bollinger' };
            if (price < bb.lower) return { direction: 'sell', confidence: 55, reason: 'Preço rompeu banda inferior de Bollinger' };

            return { direction: 'neutral', confidence: 20, reason: 'Sem rompimentos ativos' };
        }
    };

    window.BRDOLWINAtlasStrategies = Strategies;
    console.log('[Atlas Strategies] ✅ v2.0 carregado — Statistical B3/Forex separados, Correlation par-específica');
})();
