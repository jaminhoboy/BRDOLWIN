/**
 * ============================================================
 * BRDOLWIN — Gráfico de Probabilidades (Barras Horizontais)
 * ============================================================
 * Barras empilhadas mostrando distribuição de probabilidade
 * para alta/baixa/lateral em cada horizonte temporal.
 *
 * Dependência: Apache ECharts
 * Exporta: window.BRDOLWINProbabilityChart
 * ============================================================
 */

;(function () {
  'use strict';

  const CORES = {
    background: '#0A0F1E',
    surface: '#1B2A41',
    texto: '#E2E8F0',
    textoSecundario: '#94A3B8',
    alta: '#34D399',
    baixa: '#F87171',
    lateral: '#FBBF24',
    borda: 'rgba(255,255,255,0.08)',
  };

  // ── Estado ──
  let _chart = null;
  let _containerId = null;

  /**
   * Dados demo de probabilidades por horizonte
   */
  function _dadosDemo() {
    return {
      horizontes: ['5min', '15min', '1h', '4h', 'Diário'],
      alta: [42.5, 55.2, 61.8, 48.3, 52.1],
      baixa: [38.2, 28.4, 22.7, 35.1, 30.5],
      lateral: [19.3, 16.4, 15.5, 16.6, 17.4],
    };
  }

  /**
   * Inicializa o gráfico de probabilidades
   * @param {string} containerId - ID do container HTML
   * @param {Object} [data] - dados iniciais
   */
  function initProbabilityChart(containerId, data) {
    _containerId = containerId;
    const container = document.getElementById(containerId);

    if (!container) {
      console.error(`[ProbabilityChart] Container '${containerId}' não encontrado.`);
      return;
    }

    // Verifica ECharts
    if (typeof echarts === 'undefined') {
      console.warn('[ProbabilityChart] ECharts não carregado. Exibindo placeholder.');
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:${CORES.textoSecundario};font-family:'JetBrains Mono',monospace;font-size:0.85rem;">
          <div style="text-align:center;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">📊</div>
            <div>Distribuição de Probabilidades</div>
          </div>
        </div>
      `;
      return;
    }

    // Destrói instância anterior
    if (_chart) _chart.dispose();

    _chart = echarts.init(container, null, { renderer: 'canvas' });
    const dados = data || _dadosDemo();

    const opcoes = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(27,42,65,0.95)',
        borderColor: CORES.borda,
        borderWidth: 1,
        textStyle: {
          color: CORES.texto,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
        },
        formatter: function (params) {
          let html = `<div style="font-weight:600;margin-bottom:6px;">${params[0].axisValue}</div>`;
          params.forEach(p => {
            const cor = p.seriesName === 'Alta' ? CORES.alta :
                        p.seriesName === 'Baixa' ? CORES.baixa : CORES.lateral;
            html += `
              <div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor};"></span>
                <span>${p.seriesName}:</span>
                <span style="font-weight:600;color:${cor};">${p.value.toFixed(1)}%</span>
              </div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['Alta', 'Baixa', 'Lateral'],
        top: 5,
        right: 10,
        textStyle: {
          color: CORES.textoSecundario,
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
        },
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 16,
      },
      grid: {
        left: 80,
        right: 30,
        top: 35,
        bottom: 15,
        containLabel: false,
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: CORES.textoSecundario,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          formatter: '{value}%',
        },
        axisLine: { lineStyle: { color: CORES.borda } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      yAxis: {
        type: 'category',
        data: dados.horizontes,
        inverse: true,
        axisLabel: {
          color: CORES.texto,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 500,
        },
        axisLine: { lineStyle: { color: CORES.borda } },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Alta',
          type: 'bar',
          stack: 'total',
          data: dados.alta,
          itemStyle: {
            color: CORES.alta,
            borderRadius: [0, 0, 0, 0],
            opacity: 0.85,
          },
          emphasis: { itemStyle: { opacity: 1 } },
          label: {
            show: true,
            position: 'inside',
            color: '#0A0F1E',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            formatter: function (p) {
              return p.value >= 12 ? p.value.toFixed(1) + '%' : '';
            },
          },
          animationDuration: 1000,
          animationEasing: 'cubicOut',
        },
        {
          name: 'Baixa',
          type: 'bar',
          stack: 'total',
          data: dados.baixa,
          itemStyle: {
            color: CORES.baixa,
            opacity: 0.85,
          },
          emphasis: { itemStyle: { opacity: 1 } },
          label: {
            show: true,
            position: 'inside',
            color: '#0A0F1E',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            formatter: function (p) {
              return p.value >= 12 ? p.value.toFixed(1) + '%' : '';
            },
          },
          animationDuration: 1000,
          animationDelay: 200,
          animationEasing: 'cubicOut',
        },
        {
          name: 'Lateral',
          type: 'bar',
          stack: 'total',
          data: dados.lateral,
          itemStyle: {
            color: CORES.lateral,
            borderRadius: [0, 4, 4, 0],
            opacity: 0.85,
          },
          emphasis: { itemStyle: { opacity: 1 } },
          label: {
            show: true,
            position: 'inside',
            color: '#0A0F1E',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            formatter: function (p) {
              return p.value >= 12 ? p.value.toFixed(1) + '%' : '';
            },
          },
          animationDuration: 1000,
          animationDelay: 400,
          animationEasing: 'cubicOut',
        },
      ],
    };

    _chart.setOption(opcoes);

    // Resize automático
    const resizeObserver = new ResizeObserver(() => {
      if (_chart) _chart.resize();
    });
    resizeObserver.observe(container);

    console.log('[ProbabilityChart] Inicializado com sucesso.');
  }

  /**
   * Atualiza probabilidades
   * @param {Object} probabilities - {horizontes, alta, baixa, lateral}
   */
  function updateProbabilityChart(probabilities) {
    if (!_chart) {
      console.warn('[ProbabilityChart] Chart não inicializado.');
      return;
    }

    const dados = probabilities || _dadosDemo();

    _chart.setOption({
      yAxis: { data: dados.horizontes },
      series: [
        { data: dados.alta },
        { data: dados.baixa },
        { data: dados.lateral },
      ],
    });
  }

  /**
   * Destrói o gráfico
   */
  function destroy() {
    if (_chart) {
      _chart.dispose();
      _chart = null;
    }
  }

  // ── Exportação Global ──
  window.BRDOLWINProbabilityChart = {
    init: initProbabilityChart,
    update: updateProbabilityChart,
    destroy: destroy,
  };

  console.log('[BRDOLWIN] Módulo ProbabilityChart carregado.');
})();
