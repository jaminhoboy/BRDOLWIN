/**
 * ============================================================
 * BRDOLWIN — Gauges Circulares (Apache ECharts)
 * ============================================================
 * Módulo de gauges para visualização de probabilidade,
 * confiança e qualidade operacional.
 *
 * Dependência: Apache ECharts
 * Exporta: window.BRDOLWINGauges
 * ============================================================
 */

;(function () {
  'use strict';

  // ── Cores da paleta ──
  const CORES = {
    background: '#0A0F1E',
    surface: '#1B2A41',
    texto: '#E2E8F0',
    textoSecundario: '#94A3B8',
    azul: '#3B82F6',
    verde: '#34D399',
    vermelho: '#F87171',
    amber: '#FBBF24',
    roxo: '#A78BFA',
  };

  // ── Configurações padrão por tipo de gauge ──
  const CONFIGS = {
    probabilidade: {
      min: 0,
      max: 100,
      sufixo: '%',
      cores: [
        [0.3, CORES.vermelho],
        [0.6, CORES.amber],
        [1, CORES.verde],
      ],
      titulo: 'Probabilidade',
    },
    confianca: {
      min: 0,
      max: 100,
      sufixo: '%',
      cores: [
        [0.25, CORES.vermelho],
        [0.5, CORES.amber],
        [0.75, CORES.azul],
        [1, CORES.verde],
      ],
      titulo: 'Confiança',
    },
    qualidade: {
      min: 0,
      max: 10,
      sufixo: '',
      cores: [
        [0.3, CORES.vermelho],
        [0.5, CORES.amber],
        [0.8, CORES.azul],
        [1, CORES.verde],
      ],
      titulo: 'Qualidade',
    },
  };

  // ── Registro de instâncias ──
  const _instancias = {};

  /**
   * Inicializa um gauge circular
   * @param {string} containerId - ID do container HTML
   * @param {Object} config - configuração do gauge
   * @param {string} config.tipo - 'probabilidade' | 'confianca' | 'qualidade'
   * @param {number} [config.valor] - valor inicial
   * @param {string} [config.titulo] - título do gauge
   * @param {string} [config.subtitulo] - subtítulo
   * @param {number} [config.tamanho] - tamanho do raio (padrão: 70%)
   */
  function initGauge(containerId, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[Gauges] Container '${containerId}' não encontrado.`);
      return;
    }

    // Verifica ECharts
    if (typeof echarts === 'undefined') {
      console.warn('[Gauges] ECharts não carregado. Exibindo placeholder.');
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:${CORES.textoSecundario};font-family:'JetBrains Mono',monospace;font-size:0.8rem;text-align:center;">
          <div>
            <div style="font-size:1.5rem;margin-bottom:0.3rem;">⊙</div>
            <div>${config.titulo || 'Gauge'}</div>
          </div>
        </div>
      `;
      return;
    }

    const tipo = config.tipo || 'probabilidade';
    const conf = CONFIGS[tipo] || CONFIGS.probabilidade;
    const valor = config.valor ?? (tipo === 'qualidade' ? 7.5 : 65);
    const titulo = config.titulo || conf.titulo;
    const subtitulo = config.subtitulo || '';
    const raio = config.tamanho || '70%';

    // Destrói instância anterior
    if (_instancias[containerId]) {
      _instancias[containerId].dispose();
    }

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    _instancias[containerId] = chart;

    const opcoes = {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 220,
          endAngle: -40,
          min: conf.min,
          max: conf.max,
          radius: raio,
          center: ['50%', '55%'],
          // ── Barra de progresso ──
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: CORES.azul },
                  { offset: 1, color: _getCorParaValor(valor, conf) },
                ],
              },
              shadowBlur: 8,
              shadowColor: 'rgba(59,130,246,0.3)',
            },
          },
          // ── Ponteiro ──
          pointer: {
            show: true,
            length: '55%',
            width: 3,
            itemStyle: {
              color: CORES.texto,
              shadowBlur: 4,
              shadowColor: 'rgba(0,0,0,0.3)',
            },
          },
          // ── Eixo ──
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, 'rgba(255,255,255,0.06)']],
              roundCap: true,
            },
          },
          axisTick: {
            show: true,
            distance: -18,
            length: 4,
            lineStyle: { color: 'rgba(255,255,255,0.15)', width: 1 },
          },
          splitLine: {
            show: true,
            distance: -22,
            length: 8,
            lineStyle: { color: 'rgba(255,255,255,0.2)', width: 1.5 },
          },
          axisLabel: {
            show: true,
            distance: 25,
            color: CORES.textoSecundario,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            formatter: function (v) {
              if (conf.max === 100) {
                if (v % 25 === 0) return v + conf.sufixo;
              } else {
                if (v % 2 === 0) return v + conf.sufixo;
              }
              return '';
            },
          },
          // ── Título (dentro do gauge) ──
          title: {
            show: true,
            offsetCenter: [0, '72%'],
            color: CORES.textoSecundario,
            fontSize: 11,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
          },
          // ── Valor central ──
          detail: {
            show: true,
            offsetCenter: [0, '35%'],
            color: CORES.texto,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            formatter: function (v) {
              if (conf.max === 100) return v.toFixed(1) + conf.sufixo;
              return v.toFixed(1) + conf.sufixo;
            },
            valueAnimation: true,
          },
          data: [{ value: valor, name: titulo }],
          animationDuration: 1200,
          animationEasingUpdate: 'cubicInOut',
        },
        // ── Anel decorativo externo ──
        {
          type: 'gauge',
          startAngle: 220,
          endAngle: -40,
          radius: raio,
          center: ['50%', '55%'],
          min: conf.min,
          max: conf.max,
          axisLine: {
            lineStyle: {
              width: 1,
              color: [[1, 'rgba(255,255,255,0.04)']],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          title: { show: false },
          detail: { show: false },
        },
      ],
    };

    chart.setOption(opcoes);

    // Resize automático
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(container);

    console.log(`[Gauges] Gauge '${containerId}' (${tipo}) inicializado.`);
  }

  /**
   * Retorna a cor correspondente ao valor dentro da escala de cores
   */
  function _getCorParaValor(valor, conf) {
    const ratio = (valor - conf.min) / (conf.max - conf.min);
    for (const [limite, cor] of conf.cores) {
      if (ratio <= limite) return cor;
    }
    return conf.cores[conf.cores.length - 1][1];
  }

  /**
   * Atualiza o valor de um gauge existente
   * @param {string} containerId - ID do container
   * @param {number} valor - novo valor
   * @param {string} [titulo] - novo título (opcional)
   */
  function updateGauge(containerId, valor, titulo) {
    const chart = _instancias[containerId];
    if (!chart) {
      console.warn(`[Gauges] Gauge '${containerId}' não encontrado.`);
      return;
    }

    const opcoes = {
      series: [
        {
          data: [{ value: valor, name: titulo || undefined }],
        },
      ],
    };

    chart.setOption(opcoes);
  }

  /**
   * Atualiza vários gauges de uma vez
   * @param {Object} valores - { containerId: valor, ... }
   */
  function updateMultiplos(valores) {
    Object.entries(valores).forEach(([id, valor]) => {
      updateGauge(id, valor);
    });
  }

  /**
   * Destrói um gauge específico
   */
  function destroyGauge(containerId) {
    if (_instancias[containerId]) {
      _instancias[containerId].dispose();
      delete _instancias[containerId];
    }
  }

  /**
   * Destrói todos os gauges
   */
  function destroyAll() {
    Object.keys(_instancias).forEach(id => destroyGauge(id));
  }

  // ── Exportação Global ──
  window.BRDOLWINGauges = {
    init: initGauge,
    update: updateGauge,
    updateMultiplos: updateMultiplos,
    destroy: destroyGauge,
    destroyAll: destroyAll,
  };

  console.log('[BRDOLWIN] Módulo Gauges carregado.');
})();
