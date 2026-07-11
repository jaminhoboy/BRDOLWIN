/**
 * =====================================================
 * BRDOLWIN — Serviço de Dados de Mercado (APIs Reais)
 * =====================================================
 * Busca cotações reais de:
 *   - BRAPI (B3: IBOV, Dólar/BRL via USDBRL)
 *   - Yahoo Finance (via proxy AllOrigins): DXY, S&P500, VIX, Petróleo, Treasuries
 *
 * ZERO dados mock. Se a API falhar, mostra "—" ou "Indisponível".
 *
 * Exporta como window.BRDOLWINApi
 * =====================================================
 */

(function () {
  'use strict';

  // ─── Configuração de Endpoints ─────────────────────────

  // BRAPI — API brasileira gratuita para cotações B3
  const BRAPI_BASE = 'https://brapi.dev/api';

  // AllOrigins — proxy CORS para Yahoo Finance
  const ALLORIGINS_BASE = 'https://api.allorigins.win/get';

  // Cache para evitar spam de requests
  const _cache = {};
  const CACHE_TTL_MS = 3000; // 3 segundos (Real-time sem scalping)

  // ─── Funções Internas ─────────────────────────────────

  /**
   * Faz fetch com cache e tratamento de erro
   */
  async function fetchWithCache(url, cacheKey, ttl = CACHE_TTL_MS) {
    const now = Date.now();
    if (_cache[cacheKey] && (now - _cache[cacheKey].timestamp) < ttl) {
      return _cache[cacheKey].data;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      _cache[cacheKey] = { data, timestamp: now };
      return data;
    } catch (error) {
      console.warn(`[BRDOLWIN API] Erro ao buscar ${cacheKey}:`, error.message);
      // Retorna cache expirado se existir, senão null
      return _cache[cacheKey] ? _cache[cacheKey].data : null;
    }
  }

  /**
   * Busca dados via Yahoo Finance (usando AllOrigins como proxy CORS)
   */
  async function fetchYahooQuote(symbol) {
    // Adiciona timestamp para evitar cache do próprio Yahoo
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&t=${Date.now()}`;
    // Passa disableCache=true para o AllOrigins não usar versão salva no servidor deles
    const proxyUrl = `${ALLORIGINS_BASE}?disableCache=true&url=${encodeURIComponent(yahooUrl)}`;

    const data = await fetchWithCache(proxyUrl, `yahoo_${symbol}`, CACHE_TTL_MS);
    if (!data || !data.contents) return null;

    try {
      const parsed = JSON.parse(data.contents);
      const result = parsed.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];

      if (!meta || !quote) return null;

      const lastClose = quote.close ? quote.close[quote.close.length - 1] : meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;

      return {
        symbol: symbol,
        price: meta.regularMarketPrice || lastClose,
        previousClose: prevClose,
        change: prevClose ? ((meta.regularMarketPrice || lastClose) - prevClose) : 0,
        changePercent: prevClose ? (((meta.regularMarketPrice || lastClose) - prevClose) / prevClose * 100) : 0,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date(),
      };
    } catch (e) {
      console.warn(`[BRDOLWIN API] Erro ao parsear Yahoo ${symbol}:`, e.message);
      return null;
    }
  }

  // ─── API Pública ──────────────────────────────────────

  /**
   * Busca cotação do Dólar comercial (USDBRL)
   */
  async function getDolar() {
    return await fetchYahooQuote('BRL=X');
  }

  /**
   * Busca cotação do IBOVESPA
   */
  async function getIbovespa() {
    return await fetchYahooQuote('^BVSP');
  }

  /**
   * Busca DXY (Índice do Dólar)
   */
  async function getDXY() {
    return await fetchYahooQuote('DX-Y.NYB');
  }

  /**
   * Busca S&P 500 Futuro
   */
  async function getSP500() {
    return await fetchYahooQuote('ES=F');
  }

  /**
   * Busca VIX (Índice de Volatilidade)
   */
  async function getVIX() {
    return await fetchYahooQuote('^VIX');
  }

  /**
   * Busca Petróleo WTI
   */
  async function getOilWTI() {
    return await fetchYahooQuote('CL=F');
  }

  /**
   * Busca Treasury 10Y
   */
  async function getTreasury10Y() {
    return await fetchYahooQuote('^TNX');
  }

  /**
   * Busca EUR/USD
   */
  async function getEURUSD() { return await fetchYahooQuote('EURUSD=X'); }
  async function getUSDJPY() { return await fetchYahooQuote('USDJPY=X'); }
  async function getGBPUSD() { return await fetchYahooQuote('GBPUSD=X'); }
  async function getAUDUSD() { return await fetchYahooQuote('AUDUSD=X'); }
  async function getUSDCAD() { return await fetchYahooQuote('USDCAD=X'); }
  async function getUSDCHF() { return await fetchYahooQuote('USDCHF=X'); }
  async function getNZDUSD() { return await fetchYahooQuote('NZDUSD=X'); }
  async function getEURJPY() { return await fetchYahooQuote('EURJPY=X'); }
  async function getGBPJPY() { return await fetchYahooQuote('GBPJPY=X'); }
  async function getEURGBP() { return await fetchYahooQuote('EURGBP=X'); }

  /**
   * Busca todos os dados macro de uma vez
   * Retorna um objeto com todos os ativos, null para os que falharem
   */
  async function getAllMacro() {
    const results = await Promise.allSettled([
      getDXY(), getSP500(), getVIX(), getOilWTI(), getTreasury10Y(),
      getDolar(), getIbovespa(),
      getEURUSD(), getUSDJPY(), getGBPUSD(),
      getAUDUSD(), getUSDCAD(), getUSDCHF(), getNZDUSD(),
      getEURJPY(), getGBPJPY(), getEURGBP(),
    ]);
    const val = (r) => r.status === 'fulfilled' ? r.value : null;
    return {
      dxy: val(results[0]), sp500: val(results[1]), vix: val(results[2]),
      oil: val(results[3]), treasury: val(results[4]),
      dolar: val(results[5]), ibov: val(results[6]),
      eurusd: val(results[7]), usdjpy: val(results[8]), gbpusd: val(results[9]),
      audusd: val(results[10]), usdcad: val(results[11]), usdchf: val(results[12]),
      nzdusd: val(results[13]), eurjpy: val(results[14]), gbpjpy: val(results[15]),
      eurgbp: val(results[16]),
    };
  }

  /**
   * Formata quote para exibição em UI
   */
  function formatQuoteForUI(quote) {
    if (!quote) {
      return {
        price: '—',
        change: '—',
        changeClass: 'text-muted',
        trendIcon: 'minus',
      };
    }

    const isPositive = quote.changePercent >= 0;
    
    // Para moedas do forex ou ienes, formatamos com casas decimais apropriadas
    let fractionDigits = 2;
    if (quote.symbol && quote.symbol.includes('JPY')) {
      fractionDigits = 3;
    } else if (quote.symbol && quote.symbol.includes('=X')) {
      fractionDigits = 4;
    }

    return {
      price: typeof quote.price === 'number' ? quote.price.toLocaleString('pt-BR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }) : '—',
      change: typeof quote.changePercent === 'number'
        ? `${isPositive ? '+' : ''}${quote.changePercent.toFixed(2)}%`
        : '—',
      changeClass: isPositive ? 'text-green' : 'text-red',
      trendIcon: isPositive ? 'trending-up' : 'trending-down',
      rawPrice: quote.price,
      rawChange: quote.changePercent,
    };
  }

  /**
   * Limpa todo o cache
   */
  function clearCache() {
    Object.keys(_cache).forEach((key) => delete _cache[key]);
    console.log('[BRDOLWIN API] Cache limpo');
  }

  // ─── Exportação Global ────────────────────────────────

  window.BRDOLWINApi = {
    getDolar, getIbovespa, getDXY, getSP500, getVIX, getOilWTI, getTreasury10Y,
    getEURUSD, getUSDJPY, getGBPUSD,
    getAUDUSD, getUSDCAD, getUSDCHF, getNZDUSD, getEURJPY, getGBPJPY, getEURGBP,
    getAllMacro, formatQuoteForUI, clearCache,
  };

  console.log('[BRDOLWIN] ✅ API Service carregado (Dados Reais)');
})();
