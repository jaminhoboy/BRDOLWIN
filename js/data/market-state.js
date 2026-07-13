/**
 * =====================================================
 * BRDOLWIN — Estado do Mercado (Dados Reais)
 * =====================================================
 * Consome window.BRDOLWINApi para atualizar o estado
 * global do mercado com dados REAIS.
 *
 * ZERO Math.random(). ZERO dados mock.
 * Se a API falhar, mantém o último valor ou "—".
 *
 * Exporta como window.BRDOLWINState
 * =====================================================
 */

(function () {
  'use strict';

  // ─── Estado Global ────────────────────────────────────

  const state = {
    // Dados B3
    dolarPrice: null,
    dolarChange: null,
    ibovPrice: null,
    ibovChange: null,

    // Dados Macro (via Yahoo Finance)
    dxy: null,
    sp500: null,
    vix: null,
    oil: null,
    treasury10y: null,

    // Dados Forex (EURUSD, USDJPY, GBPUSD)
    eurusd: null,
    usdjpy: null,
    gbpusd: null,

    // Confiança calculada (baseada nos dados reais)
    confidence: null,

    // Regime de mercado (detectado automaticamente)
    regime: 'Aguardando dados...',

    // Probabilidades em múltiplos horizontes
    probabilities: { 
        '30m': { alta: null, baixa: null, lateral: null },
        '1h': { alta: null, baixa: null, lateral: null },
        '2h': { alta: null, baixa: null, lateral: null },
        '3h': { alta: null, baixa: null, lateral: null }
    },

    // Status do carregamento
    isLoading: true,
    lastUpdate: null,
    errorCount: 0,
  };

  const listeners = [];

  // ─── Getters / Setters ────────────────────────────────

  function getState(key) {
    return key ? state[key] : { ...state };
  }

  function setState(key, value) {
    state[key] = value;
    notifyListeners();
  }

  function subscribe(callback) {
    listeners.push(callback);
    // Dispara imediatamente com estado atual
    callback({ ...state });
  }

  function notifyListeners() {
    const snapshot = { ...state };
    listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (e) {
        console.error('[BRDOLWIN State] Erro no listener:', e);
      }
    });
  }

  // ─── Detecção de Regime ───────────────────────────────

  /**
   * Determina o regime de mercado baseado nos dados reais
   */
  function detectRegime(macroData) {
    if (!macroData) return 'Indisponível';

    const vix = macroData.vix?.price;
    const sp500Change = macroData.sp500?.changePercent;
    const dxyChange = macroData.dxy?.changePercent;

    // Se não temos dados suficientes
    if (vix == null && sp500Change == null) return 'Dados insuficientes';

    // VIX alto → mercado volátil/medo
    if (vix != null && vix > 25) return 'Alta Volatilidade (Risk-Off)';
    if (vix != null && vix > 20) return 'Cautela';

    // S&P500 subindo forte → risco ligado
    if (sp500Change != null && sp500Change > 0.5) return 'Risk-On (Expansão)';
    if (sp500Change != null && sp500Change < -0.5) return 'Risk-Off (Contração)';

    // DXY fortalecendo → pressão em emergentes
    if (dxyChange != null && dxyChange > 0.3) return 'Dólar Forte (Pressão EM)';
    if (dxyChange != null && dxyChange < -0.3) return 'Dólar Fraco (Alívio EM)';

    return 'Neutro / Lateral';
  }

  /**
   * Calcula confiança institucional baseada nos dados disponíveis
   * (sem nenhum random — usa convergência dos dados macro)
   */
  function calcConfidence(macroData) {
    if (!macroData) return null;

    let score = 50; // base neutra
    let factorsAvailable = 0;

    // VIX baixo → mais confiável para operar
    if (macroData.vix?.price != null) {
      factorsAvailable++;
      const vix = macroData.vix.price;
      if (vix < 15) score += 15;
      else if (vix < 20) score += 5;
      else if (vix > 25) score -= 15;
      else if (vix > 30) score -= 25;
    }

    // Tendência do S&P500
    if (macroData.sp500?.changePercent != null) {
      factorsAvailable++;
      const spChange = macroData.sp500.changePercent;
      if (Math.abs(spChange) < 0.3) score += 10; // mercado calmo
      else if (Math.abs(spChange) > 1.5) score -= 10; // mercado volátil
    }

    // Dados disponíveis aumentam confiança (mais dados = melhor análise)
    const dataCount = Object.values(macroData).filter((v) => v != null).length;
    score += dataCount * 2;

    // Se poucos fatores disponíveis, reduzir confiança
    if (factorsAvailable < 2) score -= 20;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Calcula probabilidades baseadas nos dados reais
   */
  function calcProbabilities(macroData) {
    if (!macroData) return { alta: null, baixa: null, lateral: null };

    let bias = 0; // -100 (muito bearish) a +100 (muito bullish)
    let dataPoints = 0;

    // DXY caindo → positivo para Brasil
    if (macroData.dxy?.changePercent != null) {
      dataPoints++;
      bias -= macroData.dxy.changePercent * 10; // DXY caindo = positivo
    }

    // S&P500 subindo → positivo para mercados
    if (macroData.sp500?.changePercent != null) {
      dataPoints++;
      bias += macroData.sp500.changePercent * 10;
    }

    // VIX alto → negativo
    if (macroData.vix?.price != null) {
      dataPoints++;
      if (macroData.vix.price > 20) bias -= 15;
      else if (macroData.vix.price < 15) bias += 10;
    }

    // Petróleo subindo → misto (inflação mas bom para PETR)
    if (macroData.oil?.changePercent != null) {
      dataPoints++;
      bias += macroData.oil.changePercent * 3;
    }

    if (dataPoints === 0) return { alta: null, baixa: null, lateral: null };

    // Normalizar bias
    bias = Math.max(-100, Math.min(100, bias));

    // Fallback simples se o engine nao estiver carregado
    let alta = Math.round(50 + bias * 0.35);
    let baixa = Math.round(50 - bias * 0.35);
    
    if (window.BRDOLWINProbability) {
      const consensusScore = 50 + (bias / 2);
      const prob = window.BRDOLWINProbability.calculateProbabilities(consensusScore);
      alta = prob.alta;
      baixa = prob.baixa;
    }
    
    let lateral = 100 - Math.min(85, Math.max(5, alta)) - Math.min(85, Math.max(5, baixa));

    return {
      alta: Math.min(85, Math.max(5, alta)),
      baixa: Math.min(85, Math.max(5, baixa)),
      lateral: Math.max(5, lateral),
    };
  }

  function applyHorizonNoise(baseProb, shiftTowardsTrend) {
      if (baseProb.alta == null) return baseProb;
      let { alta, baixa, lateral } = baseProb;
      
      if (alta > baixa) {
          alta = Math.min(85, alta + shiftTowardsTrend);
          baixa = Math.max(5, baixa - (shiftTowardsTrend/2));
      } else {
          baixa = Math.min(85, baixa + shiftTowardsTrend);
          alta = Math.max(5, alta - (shiftTowardsTrend/2));
      }
      
      lateral = 100 - Math.round(alta) - Math.round(baixa);
      
      return {
          alta: Math.round(alta),
          baixa: Math.round(baixa),
          lateral: Math.round(lateral)
      };
  }

  function calcProbabilitiesMulti(macroData) {
      const base = calcProbabilities(macroData);
      return {
          '30m': applyHorizonNoise(base, 0),
          '1h': applyHorizonNoise(base, 5),
          '2h': applyHorizonNoise(base, 10),
          '3h': applyHorizonNoise(base, 15)
      };
  }

  // ─── Loop de Atualização ──────────────────────────────

  let updateTimer = null;

  /**
   * Busca todos os dados reais e atualiza o estado
   */
  async function refreshData() {
    if (!window.BRDOLWINApi) {
      console.warn('[BRDOLWIN State] API Service não carregado ainda');
      return;
    }

    console.log('[BRDOLWIN State] Buscando dados reais do mercado...');
    state.isLoading = true;
    notifyListeners();

    try {
      const macroData = await window.BRDOLWINApi.getAllMacro();

      // Atualizar dados B3
      if (macroData.dolar) {
        state.dolarPrice = macroData.dolar.price;
        state.dolarChange = macroData.dolar.changePercent;
        state.wdo = macroData.dolar; // Alimentar Atlas AI
      }
      if (macroData.ibov) {
        state.ibovPrice = macroData.ibov.price;
        state.ibovChange = macroData.ibov.changePercent;
        state.win = macroData.ibov; // Alimentar Atlas AI
      }

      // Atualizar dados macro
      state.dxy = macroData.dxy;
      state.sp500 = macroData.sp500;
      state.vix = macroData.vix;
      state.oil = macroData.oil;
      state.treasury10y = macroData.treasury;

      // Atualizar dados Forex
      state.eurusd = macroData.eurusd;
      state.usdjpy = macroData.usdjpy;
      state.gbpusd = macroData.gbpusd;

      // Calcular métricas derivadas
      state.regime = detectRegime(macroData);
      state.confidence = calcConfidence(macroData);
      state.probabilities = calcProbabilitiesMulti(macroData);

      state.lastUpdate = new Date();
      state.errorCount = 0;
      state.isLoading = false;

      console.log('[BRDOLWIN State] ✅ Dados atualizados:', {
        dolar: state.dolarPrice,
        ibov: state.ibovPrice,
        regime: state.regime,
        confidence: state.confidence,
      });
    } catch (error) {
      state.errorCount++;
      state.isLoading = false;
      console.error('[BRDOLWIN State] ❌ Erro na atualização:', error);
    }

    notifyListeners();
  }

  /**
   * Inicia o loop de atualização automática
   * Intervalo baseado no plano do usuário
   */
  function startRealTimeUpdates() {
    // Busca inicial imediata
    refreshData();

    // Intervalo de atualização baseado no plano
    let intervalMs = 3000; // Default: 3s
    if (window.BRDOLWINAuth) {
      intervalMs = window.BRDOLWINAuth.getUpdateInterval();
    }

    // Mínimo de 3 segundos (Sem delay / Nuvem real-time)
    intervalMs = Math.max(3000, intervalMs);

    console.log(`[BRDOLWIN State] ⏱️ Atualização automática a cada ${intervalMs / 1000}s`);

    if (updateTimer) clearInterval(updateTimer);
    updateTimer = setInterval(refreshData, intervalMs);
  }

  /**
   * Para as atualizações automáticas
   */
  function stopUpdates() {
    if (updateTimer) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
    console.log('[BRDOLWIN State] ⏹️ Atualizações paradas');
  }

  // ─── Atualização da UI Global ─────────────────────────

  /**
   * Listener padrão que atualiza elementos do DOM comuns
   */
  function defaultUIUpdater(currentState) {
    const fmt = window.BRDOLWINUtils;
    const api = window.BRDOLWINApi;

    // Dólar (WDO proxy)
    const wdoEl = document.getElementById('wdoPrice');
    if (wdoEl && currentState.dolarPrice != null) {
      wdoEl.textContent = fmt
        ? fmt.formatPrice(currentState.dolarPrice, 2)
        : currentState.dolarPrice.toFixed(2);
    } else if (wdoEl && currentState.dolarPrice == null && !currentState.isLoading) {
      wdoEl.textContent = '—';
    }

    // IBOV (WIN proxy)
    const winEl = document.getElementById('winPrice');
    if (winEl && currentState.ibovPrice != null) {
      winEl.textContent = fmt
        ? fmt.formatPrice(currentState.ibovPrice)
        : currentState.ibovPrice.toFixed(0);
    } else if (winEl && currentState.ibovPrice == null && !currentState.isLoading) {
      winEl.textContent = '—';
    }

    // Confiança
    const confEl = document.getElementById('confidenceScore');
    if (confEl && currentState.confidence != null) {
      let classificacao = 'Moderada';
      if (currentState.confidence >= 80) classificacao = 'Muito Alta';
      else if (currentState.confidence >= 65) classificacao = 'Alta';
      else if (currentState.confidence >= 45) classificacao = 'Moderada';
      else if (currentState.confidence >= 30) classificacao = 'Baixa';
      else classificacao = 'Evitar Operação';
      confEl.textContent = `${classificacao} (${currentState.confidence}%)`;
    } else if (confEl && !currentState.isLoading) {
      confEl.textContent = 'Aguardando dados...';
    }

    // Regime
    const regimeEl = document.getElementById('marketRegime');
    if (regimeEl) {
      regimeEl.textContent = currentState.regime || 'Aguardando dados...';
    }

    // Probabilidades
    const horizon = window.BRDOLWINDashboard ? window.BRDOLWINDashboard.currentHorizon : '30m';
    const currentProb = currentState.probabilities[horizon];

    if (currentProb && currentProb.alta != null) {
      const pHigh = document.getElementById('winProbHigh');
      const pLow = document.getElementById('winProbLow');
      const pSide = document.getElementById('winProbSide');
      const bHigh = document.getElementById('winBarHigh');
      const bLow = document.getElementById('winBarLow');
      const bSide = document.getElementById('winBarSide');

      if (pHigh) pHigh.textContent = `${currentProb.alta}%`;
      if (pLow) pLow.textContent = `${currentProb.baixa}%`;
      if (pSide) pSide.textContent = `${currentProb.lateral}%`;
      if (bHigh) bHigh.style.width = `${currentProb.alta}%`;
      if (bLow) bLow.style.width = `${currentProb.baixa}%`;
      if (bSide) bSide.style.width = `${currentProb.lateral}%`;
      
      if (window.BRDOLWINDashboard && window.BRDOLWINDashboard.updateGauge) {
          window.BRDOLWINDashboard.updateGauge(currentProb.alta);
      }
      
      // Atualização do Painel de Execução WIN
      if (currentState.ibovPrice) {
          const winBase = currentState.ibovPrice;
          const isAlta = currentProb.alta > currentProb.baixa;
          
          const elEntry = document.getElementById('execWinEntry');
          const elStop = document.getElementById('execWinStop');
          const elTarget = document.getElementById('execWinTarget');
          
          if (elEntry && elStop && elTarget) {
              if (isAlta) {
                  elEntry.textContent = `${window.BRDOLWINUtils.formatPrice(winBase - 200, 0)} - ${window.BRDOLWINUtils.formatPrice(winBase, 0)}`;
                  elStop.textContent = window.BRDOLWINUtils.formatPrice(winBase - 600, 0);
                  elTarget.textContent = window.BRDOLWINUtils.formatPrice(winBase + 800, 0);
                  elTarget.className = "text-xl font-bold text-green mt-1";
              } else {
                  elEntry.textContent = `${window.BRDOLWINUtils.formatPrice(winBase, 0)} - ${window.BRDOLWINUtils.formatPrice(winBase + 200, 0)}`;
                  elStop.textContent = window.BRDOLWINUtils.formatPrice(winBase + 600, 0);
                  elTarget.textContent = window.BRDOLWINUtils.formatPrice(winBase - 800, 0);
                  elTarget.className = "text-xl font-bold text-red mt-1";
              }
          }
      }

      // Atualização do Painel de Execução WDO
      if (currentState.dolarPrice) {
          const wdoBase = currentState.dolarPrice;
          const isAlta = currentProb.alta > currentProb.baixa; // WDO costuma ser invertido, mas usando mesma prob para simplificar
          
          const elEntry = document.getElementById('execWdoEntry');
          const elStop = document.getElementById('execWdoStop');
          const elTarget = document.getElementById('execWdoTarget');
          
          if (elEntry && elStop && elTarget) {
              if (!isAlta) { // Invertido em relação ao índice
                  elEntry.textContent = `${window.BRDOLWINUtils.formatPrice(wdoBase - 0.02, 2)} - ${window.BRDOLWINUtils.formatPrice(wdoBase, 2)}`;
                  elStop.textContent = window.BRDOLWINUtils.formatPrice(wdoBase - 0.06, 2);
                  elTarget.textContent = window.BRDOLWINUtils.formatPrice(wdoBase + 0.08, 2);
                  elTarget.className = "text-xl font-bold text-green mt-1";
              } else {
                  elEntry.textContent = `${window.BRDOLWINUtils.formatPrice(wdoBase, 2)} - ${window.BRDOLWINUtils.formatPrice(wdoBase + 0.02, 2)}`;
                  elStop.textContent = window.BRDOLWINUtils.formatPrice(wdoBase + 0.06, 2);
                  elTarget.textContent = window.BRDOLWINUtils.formatPrice(wdoBase - 0.08, 2);
                  elTarget.className = "text-xl font-bold text-red mt-1";
              }
          }
      }
    }

    // === Ticker Global ===
    const tickerItems = [
        { id: 'tickerSP500', data: currentState.sp500 },
        { id: 'tickerDXY', data: currentState.dxy },
        { id: 'tickerVIX', data: currentState.vix },
        { id: 'tickerOil', data: currentState.oil },
        { id: 'tickerTreasury', data: currentState.treasury10y },
    ];
    tickerItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && api) {
            const formatted = api.formatQuoteForUI(item.data);
            el.textContent = `${formatted.price} (${formatted.change})`;
            el.className = formatted.changeClass;
        }
    });
  }

  // ─── Exportação Global ────────────────────────────────

  window.BRDOLWINState = {
    getState,
    setState,
    subscribe,
    notifyListeners,
    refreshData,
    startRealTimeUpdates,
    stopUpdates,
    state, // acesso direto (readonly idealmente)
  };

  // Registra o atualizador padrão de UI
  subscribe(defaultUIUpdater);

  // Auto-start ao carregar o DOM
  document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINApi) {
      startRealTimeUpdates();
    } else {
      // Espera o api-service carregar
      const waitForApi = setInterval(() => {
        if (window.BRDOLWINApi) {
          clearInterval(waitForApi);
          startRealTimeUpdates();
        }
      }, 100);
      // Timeout de segurança
      setTimeout(() => clearInterval(waitForApi), 10000);
    }
  });

  console.log('[BRDOLWIN] ✅ State carregado (Modo: Dados Reais)');
})();
