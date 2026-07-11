/**
 * =====================================================
 * ATLAS AI — Risk Manager (Gestão de Risco)
 * =====================================================
 * Travas operacionais automáticas:
 * - Drawdown máximo diário
 * - Limite de perdas consecutivas
 * - VIX alto (> 30 = pânico)
 * - Horários proibidos (leilões, pré-mercado)
 * - Gestão de exposição por ativo
 * =====================================================
 */
(function () {
    'use strict';

    const RiskManager = {
        config: {
            maxDailyDrawdownPct: 3.0,     // Máx 3% de perda no dia
            maxConsecutiveLosses: 3,        // Para depois de 3 derrotas seguidas
            vixPanicThreshold: 30,          // VIX > 30 = sem operações
            maxOpenPositions: 2,            // Máx 2 posições simultâneas
            capitalInicial: 50000,          // Capital virtual inicial (paper trading)
            riskPerTradePct: 1.0,           // Máx 1% do capital por operação
        },

        state: {
            capitalAtual: 50000,
            pnlDiario: 0,
            consecutiveLosses: 0,
            totalTrades: 0,
            openPositions: 0,
            locked: false,
            lockReason: '',
            tradeHistory: []
        },

        /**
         * Verifica se é seguro operar agora
         * @param {Object} context — { vix, asset, hora }
         * @returns {{ allowed: boolean, reason: string }}
         */
        canTrade(context = {}) {
            // 1. Sistema travado manualmente?
            if (this.state.locked) {
                return { allowed: false, reason: `🔒 Sistema travado: ${this.state.lockReason}` };
            }

            // 2. Drawdown diário
            const drawdownPct = (this.state.pnlDiario / this.config.capitalInicial) * 100;
            if (drawdownPct <= -this.config.maxDailyDrawdownPct) {
                this.lock('Drawdown diário atingido (' + drawdownPct.toFixed(2) + '%)');
                return { allowed: false, reason: '🛑 Drawdown diário máximo atingido' };
            }

            // 3. Perdas consecutivas
            if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
                return { allowed: false, reason: '⚠️ ' + this.state.consecutiveLosses + ' perdas consecutivas — Cooldown ativo' };
            }

            // 4. VIX em pânico
            if (context.vix && context.vix > this.config.vixPanicThreshold) {
                return { allowed: false, reason: '🌋 VIX em ' + context.vix.toFixed(1) + ' (> ' + this.config.vixPanicThreshold + ') — Pânico no mercado' };
            }

            // 5. Horário de operação (B3: 9h-17h BRT)
            const now = context.hora ? new Date(context.hora) : new Date();
            const hour = now.getHours();
            const minutes = now.getMinutes();

            // Pré-abertura (antes 9:00) e pós-fechamento (depois 17:30)
            if (hour < 9 || (hour === 17 && minutes > 30) || hour >= 18) {
                return { allowed: false, reason: '⏰ Fora do horário de negociação (09:00 — 17:30)' };
            }

            // Leilões de abertura (9:00-9:05) e fechamento (17:25-17:30)
            if (hour === 9 && minutes < 5) {
                return { allowed: false, reason: '🔔 Leilão de abertura em andamento' };
            }
            if (hour === 17 && minutes >= 25) {
                return { allowed: false, reason: '🔔 Leilão de fechamento em andamento' };
            }

            // 6. Posições abertas
            if (this.state.openPositions >= this.config.maxOpenPositions) {
                return { allowed: false, reason: '📊 Máximo de posições abertas atingido (' + this.config.maxOpenPositions + ')' };
            }

            return { allowed: true, reason: '✅ Operação autorizada' };
        },

        /**
         * Calcula o tamanho da posição baseado no risco
         * @param {number} entryPrice
         * @param {number} stopPrice
         * @param {string} assetType — 'win' | 'wdo'
         * @returns {{ lotes: number, riskBRL: number, rr: number }}
         */
        calcPositionSize(entryPrice, stopPrice, assetType = 'win') {
            const riskBRL = this.state.capitalAtual * (this.config.riskPerTradePct / 100);
            const pointDiff = Math.abs(entryPrice - stopPrice);

            // Valor do ponto por contrato
            const pointValue = assetType === 'win' ? 0.20 : 10.00;

            const lotes = Math.floor(riskBRL / (pointDiff * pointValue));
            return {
                lotes: Math.max(1, lotes),
                riskBRL: riskBRL,
                rr: 0 // será preenchido pelo orquestrador
            };
        },

        /**
         * Registra resultado de uma operação
         * @param {number} pnl — lucro/prejuízo em R$
         */
        registerTradeResult(pnl) {
            this.state.pnlDiario += pnl;
            this.state.totalTrades++;

            if (pnl < 0) {
                this.state.consecutiveLosses++;
            } else {
                this.state.consecutiveLosses = 0;
            }

            this.state.capitalAtual += pnl;

            this.state.tradeHistory.push({
                pnl,
                capital: this.state.capitalAtual,
                timestamp: Date.now()
            });
        },

        /**
         * Trava o sistema
         */
        lock(reason) {
            this.state.locked = true;
            this.state.lockReason = reason;
        },

        /**
         * Destrava o sistema
         */
        unlock() {
            this.state.locked = false;
            this.state.lockReason = '';
        },

        /**
         * Reset diário (novo dia de operações)
         */
        resetDaily() {
            this.state.pnlDiario = 0;
            this.state.consecutiveLosses = 0;
            this.state.totalTrades = 0;
            this.state.openPositions = 0;
            this.state.locked = false;
            this.state.lockReason = '';
            this.state.tradeHistory = [];
        },

        /**
         * Retorna um resumo do estado atual de risco
         */
        getStatus() {
            const drawdownPct = (this.state.pnlDiario / this.config.capitalInicial) * 100;
            return {
                capitalAtual: this.state.capitalAtual,
                pnlDiario: this.state.pnlDiario,
                drawdownPct: drawdownPct,
                consecutiveLosses: this.state.consecutiveLosses,
                totalTrades: this.state.totalTrades,
                openPositions: this.state.openPositions,
                locked: this.state.locked,
                lockReason: this.state.lockReason,
                riskLevel: drawdownPct <= -2 ? 'CRITICAL' :
                           drawdownPct <= -1 ? 'HIGH' :
                           drawdownPct < 0 ? 'MODERATE' : 'LOW'
            };
        }
    };

    window.BRDOLWINAtlasRisk = RiskManager;
})();
