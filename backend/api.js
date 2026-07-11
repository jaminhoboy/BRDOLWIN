/**
 * =====================================================
 * ATLAS BOT — api.js
 * =====================================================
 * Busca cotações reais do Yahoo Finance no Node.js
 * Mesma lógica do api-service.js do frontend,
 * mas usando node-fetch e sem proxy CORS.
 * =====================================================
 */

import fetch from 'node-fetch';

const _cache = {};
const CACHE_TTL_MS = 5000; // 5 segundos no bot

async function fetchYahooQuote(symbol) {
    const cacheKey = `yahoo_${symbol}`;
    const now = Date.now();

    if (_cache[cacheKey] && (now - _cache[cacheKey].ts) < CACHE_TTL_MS) {
        return _cache[cacheKey].data;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&t=${now}`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AtlasBot/1.0)',
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            console.warn(`[API] Yahoo ${symbol} HTTP ${res.status}`);
            return _cache[cacheKey]?.data ?? null;
        }

        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];
        if (!meta || !quote) return null;

        const price = meta.regularMarketPrice ?? (quote.close?.at(-1) ?? null);
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;

        const data = {
            symbol,
            price,
            previousClose: prevClose,
            change: prevClose && price ? price - prevClose : 0,
            changePercent: prevClose && price ? ((price - prevClose) / prevClose) * 100 : 0,
            currency: meta.currency,
            timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date(),
        };

        _cache[cacheKey] = { data, ts: now };
        return data;

    } catch (err) {
        console.warn(`[API] Erro ${symbol}:`, err.message);
        return _cache[cacheKey]?.data ?? null;
    }
}

export async function getAllMarketData() {
    const promises = await Promise.allSettled([
        fetchYahooQuote('^BVSP'),
        fetchYahooQuote('BRL=X'),
        fetchYahooQuote('DX-Y.NYB'),
        fetchYahooQuote('ES=F'),
        fetchYahooQuote('^VIX'),
        fetchYahooQuote('CL=F'),
        fetchYahooQuote('EURUSD=X'),
        fetchYahooQuote('USDJPY=X'),
        fetchYahooQuote('GBPUSD=X'),
        fetchYahooQuote('AUDUSD=X'),
        fetchYahooQuote('USDCAD=X'),
        fetchYahooQuote('USDCHF=X'),
        fetchYahooQuote('NZDUSD=X'),
        fetchYahooQuote('EURJPY=X'),
        fetchYahooQuote('GBPJPY=X'),
        fetchYahooQuote('EURGBP=X'),
    ]);

    const val = (r) => r.status === 'fulfilled' ? r.value : null;

    return {
        ibov:   val(promises[0]),
        win:    val(promises[0]),
        dolar:  val(promises[1]),
        wdo:    val(promises[1]),
        dxy:    val(promises[2]),
        sp500:  val(promises[3]),
        vix:    val(promises[4]),
        oil:    val(promises[5]),
        eurusd: val(promises[6]),
        usdjpy: val(promises[7]),
        gbpusd: val(promises[8]),
        audusd: val(promises[9]),
        usdcad: val(promises[10]),
        usdchf: val(promises[11]),
        nzdusd: val(promises[12]),
        eurjpy: val(promises[13]),
        gbpjpy: val(promises[14]),
        eurgbp: val(promises[15]),
    };
}
