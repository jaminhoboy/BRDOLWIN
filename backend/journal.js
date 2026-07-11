/**
 * =====================================================
 * ATLAS BOT — journal.js
 * =====================================================
 * Persiste Paper Trades e lê configurações no Supabase
 * =====================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ─── Paper Trades ─────────────────────────────────────

export async function saveTrade(trade) {
    const { data, error } = await supabase
        .from('atlas_trades')
        .insert([{
            asset:        trade.asset,
            direction:    trade.direction,
            entry_price:  trade.entryPrice,
            stop_price:   trade.stopPrice,
            target_price: trade.targetPrice,
            confidence:   trade.confidence,
            reason:       trade.reason,
            status:       'open',
            is_bot:       true,
            // Valores nulos até fechar
            exit_price:   null,
            result:       null,
            pnl:          null,
            exit_reason:  null
        }])
        .select()
        .single();

    if (error) {
        console.error('[Journal] Erro ao salvar trade:', error.message);
        return null;
    }
    return data;
}

export async function closeTrade(tradeId, closePrice, result, pnlBRL, exitReason = 'Atlas AI') {
    const { error } = await supabase
        .from('atlas_trades')
        .update({
            exit_price:  closePrice,
            result:      result,        // 'WIN' | 'LOSS'
            pnl:         pnlBRL,
            status:      'closed',
            exit_reason: exitReason
        })
        .eq('id', tradeId);

    if (error) console.error('[Journal] Erro ao fechar trade:', error.message);
}

export async function getOpenBotTrades() {
    const { data, error } = await supabase
        .from('atlas_trades')
        .select('*')
        .eq('status', 'open')
        .eq('is_bot', true);

    if (error) {
        console.error('[Journal] Erro ao buscar trades abertos:', error.message);
        return [];
    }
    return data ?? [];
}

// ─── Configurações do Atlas ────────────────────────────

const DEFAULT_SETTINGS = {
    threshold: 70,
    weights: {
        trend:         20,
        momentum:      15,
        meanReversion: 15,
        volatility:    10,
        correlation:   10,
        smartMoney:    15,
        statistical:   10,
        breakout:       5,
    }
};

export async function loadSettings() {
    try {
        const { data, error } = await supabase
            .from('atlas_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            console.log('[Journal] Usando configurações padrão do Atlas.');
            return DEFAULT_SETTINGS;
        }

        return {
            threshold: data.threshold,
            weights: {
                trend:         data.weight_trend,
                momentum:      data.weight_momentum,
                meanReversion: data.weight_mean_reversion,
                volatility:    data.weight_volatility,
                correlation:   data.weight_correlation,
                smartMoney:    data.weight_smart_money,
                statistical:   data.weight_statistical,
                breakout:      data.weight_breakout,
            }
        };
    } catch (e) {
        console.error('[Journal] Erro ao carregar settings:', e.message);
        return DEFAULT_SETTINGS;
    }
}
