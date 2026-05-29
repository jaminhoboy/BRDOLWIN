/**
 * =====================================================
 * BRDOLWIN — Estado Global Reativo
 * =====================================================
 * Gerenciador de estado central com sistema de 
 * subscriptions (pub/sub). Armazena todos os dados
 * da aplicação e notifica listeners quando valores mudam.
 * 
 * Exporta como window.BRDOLWINState
 * =====================================================
 */

(function () {
  'use strict';

  // ─── Estado Interno ───────────────────────────────────

  /**
   * Armazena todos os dados do sistema.
   * Cada chave pode ter múltiplos listeners.
   */
  const _estado = {
    // Dados de mercado em tempo real
    marketData: {
      win: {
        preco: 135250,
        abertura: 135100,
        maxima: 135450,
        minima: 135020,
        variacao: 0.11,
        volume: 0,
        candles: [],
      },
      wdo: {
        preco: 5732.50,
        abertura: 5720.00,
        maxima: 5745.00,
        minima: 5715.00,
        variacao: 0.22,
        volume: 0,
        candles: [],
      },
      timestamp: Date.now(),
    },

    // Resultados dos agentes de inteligência
    agentResults: {
      macro: null,
      tecnico: null,
      fluxo: null,
      liquidez: null,
      correlacao: null,
      sentiment: null,
      volatilidade: null,
    },

    // Probabilidades calculadas
    probabilities: {
      win: {
        '30m': { alta: 33.3, baixa: 33.3, lateral: 33.4 },
        '1h':  { alta: 33.3, baixa: 33.3, lateral: 33.4 },
        '2h':  { alta: 33.3, baixa: 33.3, lateral: 33.4 },
        '3h':  { alta: 33.3, baixa: 33.3, lateral: 33.4 },
      },
      wdo: {
        '30m': { alta: 33.3, baixa: 33.3, lateral: 33.4 },
        '1h':  { alta: 33.3, baixa: 33.3, lateral: 33.4 },
        '2h':  { alta: 33.3, baixa: 33.3, lateral: 33.4 },
        '3h':  { alta: 33.3, baixa: 33.3, lateral: 33.4 },
      },
      ultimaAtualizacao: null,
    },

    // Dados de confiança do sistema
    confidence: {
      geral: 50,
      qualidadeFluxo: 50,
      consensoAgentes: 50,
      ruidoMacro: 50,
      riscoManipulacao: 20,
      eficienciaOperacional: 50,
      classificacao: 'Moderada',
    },

    // Dados operacionais (entradas, stops, alvos)
    operationalData: {
      win: null,
      wdo: null,
      cenarioAtual: '',
      fatoresFavoraveis: [],
      riscos: [],
      conclusaoInstitucional: '',
    },

    // Janela operacional atual
    operationalWindow: {
      janelaAtual: 'fechado',
      descricao: 'Aguardando abertura do mercado',
      qualidadeHorario: 0,
      proximoEvento: null,
      alertas: [],
    },

    // Dados macro globais
    macroGlobal: {
      dxy: 104.50,
      sp500: 5400,
      vix: 15.0,
      petroleo: 75.0,
      treasury10y: 4.30,
    },

    // Status do sistema
    systemStatus: {
      online: true,
      ultimaAtualizacao: null,
      ciclosProcessados: 0,
      erros: [],
    },
  };

  // ─── Sistema de Listeners (Pub/Sub) ───────────────────

  /**
   * Mapa de listeners por chave de estado.
   * Chave '*' recebe TODAS as atualizações.
   * @type {Object<string, Function[]>}
   */
  const _listeners = {
    '*': [], // Listeners globais
  };

  /**
   * Histórico de mudanças (últimas 50 para debug)
   * @type {Array<{key: string, timestamp: number}>}
   */
  const _historico = [];
  const MAX_HISTORICO = 50;

  // ─── API Pública ──────────────────────────────────────

  /**
   * Obtém o valor de uma chave do estado.
   * Suporta chaves aninhadas com ponto (ex: 'marketData.win.preco')
   * @param {string} key - Chave do estado
   * @returns {*} Valor (cópia profunda para evitar mutação)
   */
  function getState(key) {
    if (!key) return _deepClone(_estado);

    const partes = key.split('.');
    let valor = _estado;

    for (const parte of partes) {
      if (valor == null || typeof valor !== 'object') return undefined;
      valor = valor[parte];
    }

    return _deepClone(valor);
  }

  /**
   * Define o valor de uma chave no estado e notifica listeners.
   * Suporta chaves aninhadas com ponto.
   * @param {string} key - Chave do estado
   * @param {*} value - Novo valor
   */
  function setState(key, value) {
    if (!key) {
      console.warn('[BRDOLWIN State] setState requer uma chave');
      return;
    }

    const partes = key.split('.');
    let alvo = _estado;

    // Navega até o penúltimo nível
    for (let i = 0; i < partes.length - 1; i++) {
      const parte = partes[i];
      if (alvo[parte] == null || typeof alvo[parte] !== 'object') {
        alvo[parte] = {};
      }
      alvo = alvo[parte];
    }

    const ultimaChave = partes[partes.length - 1];
    const valorAnterior = alvo[ultimaChave];
    alvo[ultimaChave] = value;

    // Registra no histórico
    _historico.push({ key, timestamp: Date.now() });
    if (_historico.length > MAX_HISTORICO) _historico.shift();

    // Notifica listeners da chave raiz (ex: 'marketData' para 'marketData.win.preco')
    const chaveRaiz = partes[0];
    _notificarListeners(chaveRaiz, value, valorAnterior);
    _notificarListeners(key, value, valorAnterior);
    _notificarListeners('*', { key, value, valorAnterior });
  }

  /**
   * Define múltiplas chaves de uma vez (batch update).
   * Útil para atualizações atômicas.
   * @param {Object<string, *>} updates - Objeto {chave: valor}
   */
  function batchUpdate(updates) {
    if (!updates || typeof updates !== 'object') return;

    for (const [key, value] of Object.entries(updates)) {
      // Atualiza sem notificar individualmente
      const partes = key.split('.');
      let alvo = _estado;
      for (let i = 0; i < partes.length - 1; i++) {
        if (alvo[partes[i]] == null) alvo[partes[i]] = {};
        alvo = alvo[partes[i]];
      }
      alvo[partes[partes.length - 1]] = value;
    }

    // Notifica uma vez para cada chave raiz afetada
    const chavesRaiz = [...new Set(Object.keys(updates).map((k) => k.split('.')[0]))];
    for (const chave of chavesRaiz) {
      _notificarListeners(chave, getState(chave), null);
    }
    _notificarListeners('*', { key: '_batch', updates });
  }

  /**
   * Inscreve um callback para mudanças em uma chave.
   * @param {string} key - Chave a observar ('*' para todas)
   * @param {Function} callback - fn(novoValor, valorAnterior)
   * @returns {Function} Função para cancelar a inscrição
   */
  function subscribe(key, callback) {
    if (typeof callback !== 'function') {
      console.warn('[BRDOLWIN State] subscribe requer uma função callback');
      return () => {};
    }

    if (!_listeners[key]) {
      _listeners[key] = [];
    }

    _listeners[key].push(callback);

    // Retorna função de unsubscribe
    return function unsubscribe() {
      const idx = _listeners[key].indexOf(callback);
      if (idx !== -1) _listeners[key].splice(idx, 1);
    };
  }

  /**
   * Reseta o estado para valores iniciais
   */
  function resetState() {
    console.log('[BRDOLWIN State] 🔄 Estado resetado');
    // O estado é mantido por referência, então recriamos os objetos
    _estado.agentResults = {
      macro: null, tecnico: null, fluxo: null,
      liquidez: null, correlacao: null, sentiment: null, volatilidade: null,
    };
    _estado.probabilities.ultimaAtualizacao = null;
    _estado.confidence = {
      geral: 50, qualidadeFluxo: 50, consensoAgentes: 50,
      ruidoMacro: 50, riscoManipulacao: 20, eficienciaOperacional: 50,
      classificacao: 'Moderada',
    };
    _estado.operationalData = {
      win: null, wdo: null, cenarioAtual: '', fatoresFavoraveis: [],
      riscos: [], conclusaoInstitucional: '',
    };
    _notificarListeners('*', { key: '_reset' });
  }

  /**
   * Retorna o histórico de atualizações (para debug)
   * @returns {Array}
   */
  function getHistorico() {
    return [..._historico];
  }

  /**
   * Retorna contagem de listeners por chave (para debug)
   * @returns {Object<string, number>}
   */
  function getListenerCount() {
    const counts = {};
    for (const [key, listeners] of Object.entries(_listeners)) {
      if (listeners.length > 0) counts[key] = listeners.length;
    }
    return counts;
  }

  // ─── Funções Internas ─────────────────────────────────

  /**
   * Notifica todos os listeners de uma chave
   * @private
   */
  function _notificarListeners(key, novoValor, valorAnterior) {
    const listeners = _listeners[key];
    if (!listeners || listeners.length === 0) return;

    for (const fn of listeners) {
      try {
        fn(novoValor, valorAnterior);
      } catch (err) {
        console.error(`[BRDOLWIN State] Erro no listener de '${key}':`, err);
      }
    }
  }

  /**
   * Cópia profunda simples (funciona para dados JSON-serializáveis)
   * @private
   */
  function _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }

  // ─── Exportação Global ────────────────────────────────

  window.BRDOLWINState = {
    getState,
    setState,
    batchUpdate,
    subscribe,
    resetState,
    getHistorico,
    getListenerCount,
  };

  console.log('[BRDOLWIN] ✅ State carregado');
})();
