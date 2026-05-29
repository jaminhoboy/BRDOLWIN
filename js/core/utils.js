/**
 * =====================================================
 * BRDOLWIN — Utilitários Gerais
 * =====================================================
 * Funções auxiliares usadas em todo o sistema:
 * formatação de preços, percentuais, moeda, data/hora,
 * helpers matemáticos, controle de fluxo e DOM,
 * detecção de período do mercado.
 * 
 * Exporta como window.BRDOLWINUtils
 * =====================================================
 */

(function () {
  'use strict';

  // ─── Formatação de Preços ─────────────────────────────

  /**
   * Formata preço no padrão WIN/WDO (ex: 135.250 ou 5.732,50)
   * @param {number} price - Preço a formatar
   * @param {number} [decimals=0] - Casas decimais (0 p/ WIN, 2 p/ WDO)
   * @returns {string} Preço formatado
   */
  function formatPrice(price, decimals = 0) {
    if (price == null || isNaN(price)) return '—';
    return price.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * Formata percentual com sinal (ex: +1,25% ou -0,50%)
   * @param {number} value - Valor percentual (ex: 1.25 para 1,25%)
   * @returns {string} Percentual formatado com sinal
   */
  function formatPercent(value) {
    if (value == null || isNaN(value)) return '—';
    const sinal = value > 0 ? '+' : '';
    return `${sinal}${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }

  /**
   * Formata moeda em Real (ex: R$ 5.732,50)
   * @param {number} value - Valor monetário
   * @returns {string} Valor formatado em BRL
   */
  function formatCurrency(value) {
    if (value == null || isNaN(value)) return '—';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Formata hora no padrão HH:MM:SS
   * @param {Date} [date] - Data (padrão: agora)
   * @returns {string}
   */
  function formatTime(date) {
    const d = date ? new Date(date) : new Date();
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  /**
   * Formata data no padrão DD/MM/AAAA
   * @param {Date} [date] - Data (padrão: agora)
   * @returns {string}
   */
  function formatDate(date) {
    const d = date ? new Date(date) : new Date();
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Formata data+hora compacta DD/MM HH:MM
   * @param {Date} [date]
   * @returns {string}
   */
  function formatDateTime(date) {
    const d = date ? new Date(date) : new Date();
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }

  // ─── Helpers Matemáticos ──────────────────────────────

  /**
   * Limita valor entre min e max
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Interpolação linear entre a e b por t (0..1)
   */
  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  /**
   * Número aleatório entre min e max (uniforme)
   */
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * Distribuição gaussiana (Box-Muller)
   * @param {number} mean - Média
   * @param {number} stdDev - Desvio padrão
   * @returns {number}
   */
  function randomGaussian(mean = 0, stdDev = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * Arredonda para N casas decimais
   */
  function roundTo(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  // ─── Controle de Fluxo ────────────────────────────────

  /**
   * Debounce — executa fn apenas após delay ms sem chamadas
   * @param {Function} fn
   * @param {number} delay - Milissegundos
   * @returns {Function}
   */
  function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Throttle — executa fn no máximo 1x a cada delay ms
   * @param {Function} fn
   * @param {number} delay - Milissegundos
   * @returns {Function}
   */
  function throttle(fn, delay = 300) {
    let lastCall = 0;
    let timer = null;
    return function (...args) {
      const now = Date.now();
      const remaining = delay - (now - lastCall);
      clearTimeout(timer);
      if (remaining <= 0) {
        lastCall = now;
        fn.apply(this, args);
      } else {
        timer = setTimeout(() => {
          lastCall = Date.now();
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  // ─── Helpers DOM ──────────────────────────────────────

  /**
   * Cria elemento DOM com classe e conteúdo
   * @param {string} tag - Tag HTML
   * @param {string} [className] - Classes CSS
   * @param {string} [innerHTML] - Conteúdo HTML
   * @returns {HTMLElement}
   */
  function createElement(tag, className = '', innerHTML = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }

  /**
   * Seleciona um elemento (atalho para querySelector)
   * @param {string} selector
   * @param {HTMLElement} [parent=document]
   * @returns {HTMLElement|null}
   */
  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  /**
   * Seleciona todos os elementos (atalho para querySelectorAll)
   * @param {string} selector
   * @param {HTMLElement} [parent=document]
   * @returns {NodeList}
   */
  function qsa(selector, parent = document) {
    return parent.querySelectorAll(selector);
  }

  // ─── Detecção de Horário de Mercado ───────────────────

  /**
   * Retorna a hora atual de Brasília (UTC-3)
   * @returns {Date} Data ajustada para Brasília
   */
  function getBrasiliaTime() {
    const now = new Date();
    // Calcula offset para UTC-3 (Brasília)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc - 3 * 3600000);
  }

  /**
   * Retorna o período do dia para o mercado
   * @returns {'pre-abertura'|'abertura'|'manhã'|'almoço'|'tarde'|'fechamento'|'after'|'fechado'}
   */
  function getTimeOfDay() {
    const brt = getBrasiliaTime();
    const dia = brt.getDay();
    const horas = brt.getHours();
    const minutos = brt.getMinutes();
    const horaDecimal = horas + minutos / 60;

    // Final de semana
    if (dia === 0 || dia === 6) return 'fechado';

    if (horaDecimal < 8.75) return 'fechado';          // Antes das 08:45
    if (horaDecimal < 9.0) return 'pre-abertura';       // 08:45 - 09:00
    if (horaDecimal < 10.5) return 'abertura';          // 09:00 - 10:30
    if (horaDecimal < 11.5) return 'manhã';             // 10:30 - 11:30
    if (horaDecimal < 13.5) return 'almoço';            // 11:30 - 13:30
    if (horaDecimal < 16.0) return 'tarde';             // 13:30 - 16:00
    if (horaDecimal < 17.92) return 'fechamento';       // 16:00 - 17:55
    if (horaDecimal < 18.5) return 'after';             // 17:55 - 18:30

    return 'fechado';
  }

  /**
   * Verifica se o mercado está aberto (09:00-17:55, seg-sex)
   * @returns {boolean}
   */
  function isMarketOpen() {
    const periodo = getTimeOfDay();
    return !['fechado', 'pre-abertura', 'after'].includes(periodo);
  }

  /**
   * Retorna descrição amigável do período
   * @returns {string}
   */
  function getTimeOfDayLabel() {
    const labels = {
      'fechado': 'Mercado Fechado',
      'pre-abertura': 'Pré-Abertura',
      'abertura': 'Abertura',
      'manhã': 'Manhã',
      'almoço': 'Horário de Almoço',
      'tarde': 'Tarde',
      'fechamento': 'Fechamento',
      'after': 'After-Market',
    };
    return labels[getTimeOfDay()] || 'Mercado Fechado';
  }

  // ─── Helpers de Cores ─────────────────────────────────

  /**
   * Retorna classe CSS de cor baseada em valor positivo/negativo
   * @param {number} value
   * @returns {string} 'text-success' | 'text-danger' | 'text-secondary'
   */
  function colorClass(value) {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-danger';
    return 'text-secondary';
  }

  /**
   * Retorna cor hex baseada em nível de confiança (0-100)
   * Verde alto → Amarelo médio → Vermelho baixo
   * @param {number} confidence - 0 a 100
   * @returns {string} Cor hex
   */
  function confidenceColor(confidence) {
    if (confidence >= 70) return '#34D399'; // Verde
    if (confidence >= 50) return '#FBBF24'; // Amarelo
    if (confidence >= 30) return '#FB923C'; // Laranja
    return '#F87171'; // Vermelho
  }

  /**
   * Gera um ID único simples
   * @returns {string}
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ─── Exportação Global ────────────────────────────────

  window.BRDOLWINUtils = {
    // Formatação
    formatPrice,
    formatPercent,
    formatCurrency,
    formatTime,
    formatDate,
    formatDateTime,

    // Matemática
    clamp,
    lerp,
    randomBetween,
    randomGaussian,
    roundTo,

    // Controle de fluxo
    debounce,
    throttle,

    // DOM
    createElement,
    qs,
    qsa,

    // Mercado / Tempo
    getBrasiliaTime,
    getTimeOfDay,
    getTimeOfDayLabel,
    isMarketOpen,

    // Cores
    colorClass,
    confidenceColor,

    // Misc
    uid,
  };

  console.log('[BRDOLWIN] ✅ Utils carregado');
})();
