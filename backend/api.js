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
    const [ibov, dolar, dxy, sp500, vix, oil, eurusd, usdjpy, gbpusd] = await Promise.allSettled([
        fetchYahooQuote('^BVSP'),
        fetchYahooQuote('BRL=X'),
        fetchYahooQuote('DX-Y.NYB'),
        fetchYahooQuote('ES=F'),
        fetchYahooQuote('^VIX'),
        fetchYahooQuote('CL=F'),
        fetchYahooQuote('EURUSD=X'),
        fetchYahooQuote('USDJPY=X'),
        fetchYahooQuote('GBPUSD=X'),
    ]);

    const val = (r) => r.status === 'fulfilled' ? r.value : null;

    return {
        ibov:   val(ibov),
        win:    val(ibov),   // alias — WIN segue IBOV
        dolar:  val(dolar),
        wdo:    val(dolar),  // alias — WDO segue Dólar
        dxy:    val(dxy),
        sp500:  val(sp500),
        vix:    val(vix),
        oil:    val(oil),
        eurusd: val(eurusd),
        usdjpy: val(usdjpy),
        gbpusd: val(gbpusd),
    };
}
