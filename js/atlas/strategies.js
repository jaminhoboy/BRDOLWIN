/**
 * =====================================================
 * ATLAS AI — Strategies (8 Plugins Quantitativos)
 * =====================================================
 * Cada estratégia recebe um snapshot do MarketMemory
 * e retorna um sinal: { direction, confidence, reason }
 *   direction: 'buy' | 'sell' | 'neutral'
 *   confidence: 0-100
 *   reason: string
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

            const ema9 = snapshot.ema9;
            const ema21 = snapshot.ema21;
            const price = snapshot.lastPrice;
            const spread = ((ema9 - ema21) / ema21) * 100;

            if (ema9 > ema21 && price > ema9) {
                const conf = Math.min(90, 50 + Math.abs(spread) * 20);
                return { direction: 'buy', confidence: conf, reason: `EMA9 (${ema9.toFixed(0)}) > EMA21 (${ema21.toFixed(0)}), preço acima` };
            }
            if (ema9 < ema21 && price < ema9) {
                const conf = Math.min(90, 50 + Math.abs(spread) * 20);
                return { direction: 'sell', confidence: conf, reason: `EMA9 (${ema9.toFixed(0)}) < EMA21 (${ema21.toFixed(0)}), preço abaixo` };
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

            // RSI sobrecomprado + ROC forte positivo = Momentum de compra excessivo
            if (rsi > 70 && roc > 0.5) {
                return { direction: 'buy', confidence: Math.min(85, 40 + rsi - 70 + roc * 10), reason: `RSI ${rsi.toFixed(1)} (forte) + ROC ${roc.toFixed(2)}%` };
            }
            if (rsi < 30 && roc < -0.5) {
                return { direction: 'sell', confidence: Math.min(85, 40 + (30 - rsi) + Math.abs(roc) * 10), reason: `RSI ${rsi.toFixed(1)} (fraco) + ROC ${roc.toFixed(2)}%` };
            }
            if (rsi > 55 && roc > 0.2) {
                return { direction: 'buy', confidence: 45, reason: `Momentum moderado (RSI ${rsi.toFixed(1)})` };
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

            const bb = snapshot.bollinger;
            const price = snapshot.lastPrice;
            const vwap = snapshot.vwap;

            // Preço abaixo da banda inferior = sobrevendido
            if (price < bb.lower) {
                const distPct = ((bb.lower - price) / bb.lower) * 100;
                const conf = Math.min(85, 55 + distPct * 15);
                return { direction: 'buy', confidence: conf, reason: `Preço abaixo da BB inferior (${bb.lower.toFixed(0)}), reversão provável` };
            }
            // Preço acima da banda superior = sobrecomprado
            if (price > bb.upper) {
                const distPct = ((price - bb.upper) / bb.upper) * 100;
                const conf = Math.min(85, 55 + distPct * 15);
                return { direction: 'sell', confidence: conf, reason: `Preço acima da BB superior (${bb.upper.toFixed(0)}), reversão provável` };
            }

            // Distância do VWAP
            if (vwap) {
                const vwapDist = ((price - vwap) / vwap) * 100;
                if (vwapDist < -0.3) {
                    return { direction: 'buy', confidence: 40, reason: `Preço ${Math.abs(vwapDist).toFixed(2)}% abaixo do VWAP` };
                }
                if (vwapDist > 0.3) {
                    return { direction: 'sell', confidence: 40, reason: `Preço ${vwapDist.toFixed(2)}% acima do VWAP` };
                }
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

            const bb = snapshot.bollinger;
            const atr = snapshot.atr;
            const price = snapshot.lastPrice;

            // Compressão de volatilidade (banda estreita) = breakout iminente
            if (bb.bandwidth < 1.0) {
                // Determina direção pela posição do preço na banda
                const midPos = (price - bb.lower) / (bb.upper - bb.lower);
                if (midPos > 0.6) {
                    return { direction: 'buy', confidence: 60, reason: `Compressão de vol (BB ${bb.bandwidth.toFixed(2)}%) + preço na parte superior` };
                }
                if (midPos < 0.4) {
                    return { direction: 'sell', confidence: 60, reason: `Compressão de vol (BB ${bb.bandwidth.toFixed(2)}%) + preço na parte inferior` };
                }
                return { direction: 'neutral', confidence: 50, reason: `Compressão extrema — aguardando definição` };
            }

            // Expansão de volatilidade
            if (bb.bandwidth > 3.0) {
                return { direction: 'neutral', confidence: 30, reason: `Alta volatilidade (BB ${bb.bandwidth.toFixed(2)}%) — mercado instável` };
            }

            return { direction: 'neutral', confidence: 35, reason: `Volatilidade normal (ATR: ${atr.toFixed(1)})` };
        },

        // ──────────────────────────────────────
        // 5. CORRELAÇÃO (Intermarket: DXY, VIX, S&P)
        // ──────────────────────────────────────
        correlation(snapshot, globalState) {
            if (!globalState) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados globais não disponíveis' };
            }

            let signals = [];
            let buyScore = 0, sellScore = 0;

            // S&P500 subindo = bom para ativos de risco (WIN)
            if (globalState.sp500 && globalState.sp500.changePercent) {
                if (globalState.sp500.changePercent > 0.3) {
                    buyScore += 25;
                    signals.push('S&P500 +' + globalState.sp500.changePercent.toFixed(2) + '%');
                }
                if (globalState.sp500.changePercent < -0.3) {
                    sellScore += 25;
                    signals.push('S&P500 ' + globalState.sp500.changePercent.toFixed(2) + '%');
                }
            }

            // DXY subindo = ruim para BRL (WDO sobe)
            if (globalState.dxy && globalState.dxy.changePercent) {
                if (globalState.dxy.changePercent > 0.2) {
                    sellScore += 20;
                    signals.push('DXY forte (+' + globalState.dxy.changePercent.toFixed(2) + '%)');
                }
                if (globalState.dxy.changePercent < -0.2) {
                    buyScore += 20;
                    signals.push('DXY fraco (' + globalState.dxy.changePercent.toFixed(2) + '%)');
                }
            }

            // VIX alto = medo
            if (globalState.vix && globalState.vix.price) {
                if (globalState.vix.price > 25) {
                    sellScore += 30;
                    signals.push('VIX elevado (' + globalState.vix.price.toFixed(1) + ')');
                }
                if (globalState.vix.price < 15) {
                    buyScore += 15;
                    signals.push('VIX baixo (' + globalState.vix.price.toFixed(1) + ')');
                }
            }

            const totalScore = buyScore + sellScore;
            if (totalScore === 0) {
                return { direction: 'neutral', confidence: 20, reason: 'Sem sinais intermarket relevantes' };
            }

            if (buyScore > sellScore) {
                return { direction: 'buy', confidence: Math.min(75, buyScore + 20), reason: 'Correlação favorável: ' + signals.join(', ') };
            }
            if (sellScore > buyScore) {
                return { direction: 'sell', confidence: Math.min(75, sellScore + 20), reason: 'Correlação desfavorável: ' + signals.join(', ') };
            }
            return { direction: 'neutral', confidence: 30, reason: 'Sinais intermarket mistos' };
        },

        // ──────────────────────────────────────
        // 6. SMART MONEY (Zonas de Liquidez / Wyckoff)
        // ──────────────────────────────────────
        smartMoney(snapshot) {
            if (!snapshot.ready || !snapshot.levels) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const price = snapshot.lastPrice;
            const { supports, resistances } = snapshot.levels;

            // Preço testando suporte forte
            for (const sup of supports) {
                const dist = ((price - sup) / sup) * 100;
                if (dist >= 0 && dist < 0.15) {
                    return { direction: 'buy', confidence: 70, reason: `Testando suporte em ${sup.toFixed(0)} (absorção provável)` };
                }
            }

            // Preço testando resistência forte
            for (const res of resistances) {
                const dist = ((res - price) / res) * 100;
                if (dist >= 0 && dist < 0.15) {
                    return { direction: 'sell', confidence: 70, reason: `Testando resistência em ${res.toFixed(0)} (rejeição provável)` };
                }
            }

            return { direction: 'neutral', confidence: 25, reason: 'Sem zonas de liquidez ativas' };
        },

        // ──────────────────────────────────────
        // 7. ESTATÍSTICA (Sazonalidade e Horários)
        // ──────────────────────────────────────
        statistical() {
            const now = new Date();
            const hour = now.getHours();
            const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ...

            // Terça e Quinta estatisticamente têm mais tendência no WIN
            const trendDays = [2, 4]; // Terça e Quinta
            const isTrendDay = trendDays.includes(dayOfWeek);

            // Horários de maior probabilidade de tendência
            let timeConf = 0;
            let timeReason = '';

            if (hour >= 9 && hour < 11) {
                timeConf = 65;
                timeReason = 'Abertura B3 (09:00-11:00) — alta probabilidade de movimento direcional';
            } else if (hour >= 14 && hour < 16) {
                timeConf = 60;
                timeReason = 'Abertura NY (14:00-16:00) — fluxo institucional ativo';
            } else if (hour >= 11 && hour < 14) {
                timeConf = 30;
                timeReason = 'Horário de almoço (11:00-14:00) — baixa liquidez e lateralidade';
            } else {
                timeConf = 40;
                timeReason = 'Horário neutro';
            }

            if (isTrendDay) {
                timeConf = Math.min(80, timeConf + 10);
                timeReason += ' | Dia de tendência (estatístico)';
            }

            // Estatística não dá direção, apenas confiança de que o mercado vai se mover
            return {
                direction: 'neutral',
                confidence: timeConf,
                reason: timeReason,
                meta: { isTrendDay, hour, dayOfWeek }
            };
        },

        // ──────────────────────────────────────
        // 8. BREAKOUT (Rompimento de Caixa)
        // ──────────────────────────────────────
        breakout(snapshot) {
            if (!snapshot.ready || !snapshot.bollinger || !snapshot.levels) {
                return { direction: 'neutral', confidence: 0, reason: 'Dados insuficientes' };
            }

            const price = snapshot.lastPrice;
            const bb = snapshot.bollinger;
            const { supports, resistances } = snapshot.levels;

            // Breakout da banda superior de Bollinger + acima da última resistência
            if (price > bb.upper && resistances.length > 0) {
                const lastRes = resistances[resistances.length - 1];
                if (price > lastRes) {
                    return { direction: 'buy', confidence: 75, reason: `Rompimento de BB superior + resistência ${lastRes.toFixed(0)}` };
                }
            }

            // Breakdown da banda inferior + abaixo do último suporte
            if (price < bb.lower && supports.length > 0) {
                const lastSup = supports[supports.length - 1];
                if (price < lastSup) {
                    return { direction: 'sell', confidence: 75, reason: `Rompimento de BB inferior + suporte ${lastSup.toFixed(0)}` };
                }
            }

            // Breakout parcial (só Bollinger)
            if (price > bb.upper) {
                return { direction: 'buy', confidence: 55, reason: 'Preço rompeu banda superior de Bollinger' };
            }
            if (price < bb.lower) {
                return { direction: 'sell', confidence: 55, reason: 'Preço rompeu banda inferior de Bollinger' };
            }

            return { direction: 'neutral', confidence: 20, reason: 'Sem rompimentos ativos' };
        }
    };

    window.BRDOLWINAtlasStrategies = Strategies;
})();
