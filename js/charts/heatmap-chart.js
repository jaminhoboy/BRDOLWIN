/**
 * ============================================================
 * BRDOLWIN — Heatmap de Liquidez Institucional (D3.js)
 * ============================================================
 * Visualização de calor por preço×tempo para identificar
 * concentração de liquidez e atividade institucional.
 *
 * Dependência: D3.js v7
 * Exporta: window.BRDOLWINHeatmapChart
 * ============================================================
 */

;(function () {
  'use strict';

  // ── Paleta de cores do heatmap ──
  const CORES = {
    frio: '#1B2A41',
    medio: '#A78BFA',
    quente: '#F87171',
    background: '#0A0F1E',
    texto: '#94A3B8',
    textoPrimario: '#E2E8F0',
    borda: 'rgba(255,255,255,0.08)',
    tooltipBg: 'rgba(27,42,65,0.95)',
  };

  // ── Estado do módulo ──
  let _svg = null;
  let _containerId = null;
  let _dados = [];
  let _tooltip = null;
  let _dimensoes = { largura: 0, altura: 0, margem: { top: 30, right: 60, bottom: 40, left: 70 } };

  /**
   * Gera dados simulados de heatmap
   * @param {number} linhas - níveis de preço
   * @param {number} colunas - intervalos de tempo
   * @returns {Array} dados formatados [{x, y, valor}]
   */
  function _gerarDadosDemo(linhas = 30, colunas = 48) {
    const dados = [];
    const precoBase = 128000;
    const agora = new Date();

    for (let i = 0; i < colunas; i++) {
      for (let j = 0; j < linhas; j++) {
        // Simula concentração de liquidez em regiões específicas
        let valor = Math.random() * 30;

        // Zonas de alta liquidez (simulação institucional)
        if (j > 10 && j < 15 && i > 20 && i < 35) valor += 50 + Math.random() * 40;
        if (j > 20 && j < 25 && i > 5 && i < 15) valor += 30 + Math.random() * 30;
        if (j > 5 && j < 8 && i > 35 && i < 45) valor += 60 + Math.random() * 30;

        const tempo = new Date(agora.getTime() - (colunas - i) * 15 * 60000);

        dados.push({
          x: i,
          y: j,
          valor: Math.round(valor),
          tempo: tempo,
          preco: precoBase + j * 50,
        });
      }
    }

    return dados;
  }

  /**
   * Cria tooltip HTML
   */
  function _criarTooltip(container) {
    _tooltip = document.createElement('div');
    _tooltip.className = 'heatmap-tooltip';
    _tooltip.style.cssText = `
      position: absolute;
      display: none;
      background: ${CORES.tooltipBg};
      border: 1px solid ${CORES.borda};
      border-radius: 8px;
      padding: 10px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: ${CORES.textoPrimario};
      pointer-events: none;
      z-index: 100;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      transition: opacity 0.15s ease;
    `;
    container.style.position = 'relative';
    container.appendChild(_tooltip);
  }

  /**
   * Inicializa o heatmap
   * @param {string} containerId - ID do container HTML
   * @param {Array} [data] - dados [{x, y, valor, tempo, preco}]
   */
  function initHeatmap(containerId, data) {
    _containerId = containerId;
    const container = document.getElementById(containerId);

    if (!container) {
      console.error(`[Heatmap] Container '${containerId}' não encontrado.`);
      return;
    }

    // Verifica D3
    if (typeof d3 === 'undefined') {
      console.warn('[Heatmap] D3.js não carregado. Exibindo placeholder.');
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:${CORES.texto};font-family:'JetBrains Mono',monospace;font-size:0.85rem;">
          <div style="text-align:center;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">🔥</div>
            <div>Heatmap de Liquidez</div>
            <div style="font-size:0.75rem;opacity:0.6;margin-top:0.25rem;">Requer D3.js v7</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    _criarTooltip(container);

    _dados = data || _gerarDadosDemo();

    const m = _dimensoes.margem;
    _dimensoes.largura = container.clientWidth;
    _dimensoes.altura = container.clientHeight || 350;

    const larguraUtil = _dimensoes.largura - m.left - m.right;
    const alturaUtil = _dimensoes.altura - m.top - m.bottom;

    // ── SVG Principal ──
    _svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', _dimensoes.largura)
      .attr('height', _dimensoes.altura)
      .style('background', 'transparent');

    const g = _svg.append('g')
      .attr('transform', `translate(${m.left},${m.top})`);

    // ── Escalas ──
    const xMax = d3.max(_dados, d => d.x);
    const yMax = d3.max(_dados, d => d.y);
    const valorMax = d3.max(_dados, d => d.valor);

    const escalaX = d3.scaleBand()
      .domain(d3.range(xMax + 1))
      .range([0, larguraUtil])
      .padding(0.02);

    const escalaY = d3.scaleBand()
      .domain(d3.range(yMax + 1))
      .range([alturaUtil, 0])
      .padding(0.02);

    const escalaCor = d3.scaleLinear()
      .domain([0, valorMax * 0.3, valorMax * 0.6, valorMax])
      .range([CORES.frio, '#2D4A7A', CORES.medio, CORES.quente])
      .interpolate(d3.interpolateRgb);

    // ── Eixos ──
    // Eixo X — mostra apenas alguns horários
    const ticksX = _dados.filter(d => d.y === 0 && d.x % 6 === 0);
    const eixoX = d3.axisBottom(escalaX)
      .tickValues(ticksX.map(d => d.x))
      .tickFormat(d => {
        const item = _dados.find(dd => dd.x === d && dd.y === 0);
        if (!item) return '';
        return item.tempo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      });

    g.append('g')
      .attr('transform', `translate(0,${alturaUtil})`)
      .call(eixoX)
      .selectAll('text')
      .style('fill', CORES.texto)
      .style('font-size', '10px')
      .style('font-family', "'JetBrains Mono', monospace");

    g.selectAll('.domain, .tick line').style('stroke', CORES.borda);

    // Eixo Y — preços
    const ticksY = d3.range(yMax + 1).filter(i => i % 5 === 0);
    const eixoY = d3.axisLeft(escalaY)
      .tickValues(ticksY)
      .tickFormat(d => {
        const item = _dados.find(dd => dd.y === d);
        return item ? item.preco.toLocaleString('pt-BR') : '';
      });

    g.append('g')
      .call(eixoY)
      .selectAll('text')
      .style('fill', CORES.texto)
      .style('font-size', '10px')
      .style('font-family', "'JetBrains Mono', monospace");

    g.selectAll('.domain, .tick line').style('stroke', CORES.borda);

    // ── Células do heatmap ──
    g.selectAll('.heatmap-celula')
      .data(_dados)
      .enter()
      .append('rect')
      .attr('class', 'heatmap-celula')
      .attr('x', d => escalaX(d.x))
      .attr('y', d => escalaY(d.y))
      .attr('width', escalaX.bandwidth())
      .attr('height', escalaY.bandwidth())
      .attr('rx', 1)
      .style('fill', d => escalaCor(d.valor))
      .style('opacity', 0)
      .on('mouseenter', function (event, d) {
        d3.select(this).style('stroke', '#E2E8F0').style('stroke-width', 1);
        _tooltip.style.display = 'block';
        _tooltip.innerHTML = `
          <div style="margin-bottom:4px;color:${CORES.textoPrimario};font-weight:600;">Liquidez Institucional</div>
          <div>Preço: <span style="color:#3B82F6;">${d.preco.toLocaleString('pt-BR')}</span></div>
          <div>Horário: <span style="color:#3B82F6;">${d.tempo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div>Volume: <span style="color:${d.valor > valorMax * 0.6 ? CORES.quente : CORES.medio};">${d.valor}</span></div>
          <div style="margin-top:4px;font-size:0.65rem;color:${CORES.texto};">
            ${d.valor > valorMax * 0.7 ? '⚠️ Alta concentração detectada' : d.valor > valorMax * 0.4 ? '📊 Concentração moderada' : '📉 Baixa atividade'}
          </div>
        `;
      })
      .on('mousemove', function (event) {
        const rect = container.getBoundingClientRect();
        _tooltip.style.left = (event.clientX - rect.left + 15) + 'px';
        _tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
      })
      .on('mouseleave', function () {
        d3.select(this).style('stroke', 'none');
        _tooltip.style.display = 'none';
      })
      .transition()
      .duration(800)
      .delay((d, i) => i * 0.5)
      .style('opacity', 1);

    // ── Legenda de cores ──
    _criarLegenda(g, escalaCor, larguraUtil, alturaUtil, valorMax);

    // ── Título ──
    _svg.append('text')
      .attr('x', m.left)
      .attr('y', 18)
      .style('fill', CORES.textoPrimario)
      .style('font-size', '12px')
      .style('font-family', "'Inter', sans-serif")
      .style('font-weight', '600')
      .text('Mapa de Calor — Concentração de Liquidez');

    console.log('[Heatmap] Inicializado com sucesso.');
  }

  /**
   * Cria legenda de cores do heatmap
   */
  function _criarLegenda(g, escalaCor, largura, altura, valorMax) {
    const legendaLargura = 15;
    const legendaAltura = altura * 0.6;
    const legendaX = largura + 15;
    const legendaY = (altura - legendaAltura) / 2;

    const defs = _svg.append('defs');
    const gradiente = defs.append('linearGradient')
      .attr('id', 'heatmap-legenda-grad')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');

    gradiente.append('stop').attr('offset', '0%').attr('stop-color', CORES.frio);
    gradiente.append('stop').attr('offset', '40%').attr('stop-color', CORES.medio);
    gradiente.append('stop').attr('offset', '100%').attr('stop-color', CORES.quente);

    g.append('rect')
      .attr('x', legendaX)
      .attr('y', legendaY)
      .attr('width', legendaLargura)
      .attr('height', legendaAltura)
      .attr('rx', 3)
      .style('fill', 'url(#heatmap-legenda-grad)');

    // Labels da legenda
    const labels = [
      { y: legendaY, texto: 'Alto' },
      { y: legendaY + legendaAltura / 2, texto: 'Médio' },
      { y: legendaY + legendaAltura, texto: 'Baixo' },
    ];

    labels.forEach(l => {
      g.append('text')
        .attr('x', legendaX + legendaLargura + 6)
        .attr('y', l.y + 4)
        .style('fill', CORES.texto)
        .style('font-size', '9px')
        .style('font-family', "'JetBrains Mono', monospace")
        .text(l.texto);
    });
  }

  /**
   * Atualiza o heatmap com novos dados
   * @param {Array} newData - novos dados [{x, y, valor, tempo, preco}]
   */
  function updateHeatmap(newData) {
    if (!_containerId) return;
    // Re-renderiza com novos dados
    initHeatmap(_containerId, newData || _gerarDadosDemo());
  }

  /**
   * Destrói o heatmap
   */
  function destroy() {
    if (_svg) {
      _svg.remove();
      _svg = null;
    }
    if (_tooltip && _tooltip.parentNode) {
      _tooltip.parentNode.removeChild(_tooltip);
      _tooltip = null;
    }
  }

  // ── Exportação Global ──
  window.BRDOLWINHeatmapChart = {
    init: initHeatmap,
    update: updateHeatmap,
    destroy: destroy,
  };

  console.log('[BRDOLWIN] Módulo HeatmapChart carregado.');
})();
