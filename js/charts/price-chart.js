/**
 * ============================================================
 * BRDOLWIN — Gráfico de Preço (TradingView Lightweight Charts)
 * ============================================================
 * Módulo responsável pelo gráfico de candlestick institucional
 * com volume, regiões operacionais e seleção de timeframe.
 * 
 * Dependência: TradingView Lightweight Charts (CDN)
 * Exporta: window.BRDOLWINPriceChart
 * ============================================================
 */

;(function () {
  'use strict';

  // ── Configuração de cores ──
  const CORES = {
    background: '#0A0F1E',
    textoPrimario: '#E2E8F0',
    textoSecundario: '#94A3B8',
    grid: 'rgba(255,255,255,0.04)',
    borda: 'rgba(255,255,255,0.08)',
    alta: '#34D399',
    baixa: '#F87171',
    volumeBase: 'rgba(59,130,246,0.3)',
    volumeAlta: 'rgba(52,211,153,0.3)',
    volumeBaixa: 'rgba(248,113,113,0.3)',
    crosshair: '#94A3B8',
    regiaoAlta: 'rgba(52,211,153,0.08)',
    regiaoBaixa: 'rgba(248,113,113,0.08)',
    linhaRegiao: 'rgba(59,130,246,0.5)',
  };

  // ── Estado interno do módulo ──
  let _chart = null;
  let _candleSeries = null;
  let _volumeSeries = null;
  let _containerId = null;
  let _timeframe = '15';
  let _linhasRegiao = [];

  /**
   * Gera dados simulados de candle para demonstração
   * @param {number} qtd - quantidade de candles
   * @returns {Array} array de candles
   */
  function _gerarDadosDemo(qtd = 200) {
    const candles = [];
    const volumes = [];
    let preco = 128500 + Math.random() * 2000;
    const agora = Math.floor(Date.now() / 1000);
    const intervalo = parseInt(_timeframe) * 60;

    for (let i = 0; i < qtd; i++) {
      const tempo = agora - (qtd - i) * intervalo;
      const variacao = (Math.random() - 0.48) * 150;
      const abertura = preco;
      const fechamento = preco + variacao;
      const maxima = Math.max(abertura, fechamento) + Math.random() * 80;
      const minima = Math.min(abertura, fechamento) - Math.random() * 80;

      candles.push({
        time: tempo,
        open: Math.round(abertura * 100) / 100,
        high: Math.round(maxima * 100) / 100,
        low: Math.round(minima * 100) / 100,
        close: Math.round(fechamento * 100) / 100,
      });

      volumes.push({
        time: tempo,
        value: Math.round(500 + Math.random() * 3000),
        color: fechamento >= abertura ? CORES.volumeAlta : CORES.volumeBaixa,
      });

      preco = fechamento;
    }

    return { candles, volumes };
  }

  /**
   * Inicializa o gráfico de preço
   * @param {string} containerId - ID do container HTML
   * @param {Object} [data] - dados iniciais {candles, volumes}
   */
  function initPriceChart(containerId, data) {
    _containerId = containerId;
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[PriceChart] Container '${containerId}' não encontrado.`);
      return;
    }

    // Limpa conteúdo anterior
    container.innerHTML = '';

    // ── Barra de controles (timeframe) ──
    const controles = document.createElement('div');
    controles.className = 'price-chart-controles';
    controles.innerHTML = `
      <div class="timeframe-seletor">
        <button class="tf-btn" data-tf="1">1m</button>
        <button class="tf-btn" data-tf="5">5m</button>
        <button class="tf-btn active" data-tf="15">15m</button>
        <button class="tf-btn" data-tf="60">1h</button>
        <button class="tf-btn" data-tf="240">4h</button>
        <button class="tf-btn" data-tf="D">1D</button>
      </div>
      <div class="chart-info">
        <span class="chart-ativo">WIN</span>
        <span class="chart-preco" id="${containerId}-preco">--</span>
        <span class="chart-variacao" id="${containerId}-variacao">--</span>
      </div>
    `;
    container.appendChild(controles);

    // ── Container do gráfico ──
    const chartWrapper = document.createElement('div');
    chartWrapper.id = `${containerId}-wrapper`;
    chartWrapper.style.cssText = 'width:100%;flex:1;min-height:0;';
    container.appendChild(chartWrapper);

    // Verifica se a biblioteca está disponível
    if (typeof LightweightCharts === 'undefined') {
      console.warn('[PriceChart] LightweightCharts não carregado. Exibindo placeholder.');
      chartWrapper.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:${CORES.textoSecundario};font-family:'JetBrains Mono',monospace;font-size:0.85rem;">
          <div style="text-align:center;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">📊</div>
            <div>Gráfico de Preço</div>
            <div style="font-size:0.75rem;opacity:0.6;margin-top:0.25rem;">TradingView Lightweight Charts</div>
          </div>
        </div>
      `;
      return;
    }

    // ── Criação do chart ──
    _chart = LightweightCharts.createChart(chartWrapper, {
      width: chartWrapper.clientWidth,
      height: chartWrapper.clientHeight || 400,
      layout: {
        background: { type: 'solid', color: CORES.background },
        textColor: CORES.textoSecundario,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CORES.grid },
        horzLines: { color: CORES.grid },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: CORES.crosshair, width: 1, style: 2 },
        horzLine: { color: CORES.crosshair, width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: CORES.borda,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: CORES.borda,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // ── Série de candlestick ──
    _candleSeries = _chart.addCandlestickSeries({
      upColor: CORES.alta,
      downColor: CORES.baixa,
      borderUpColor: CORES.alta,
      borderDownColor: CORES.baixa,
      wickUpColor: CORES.alta,
      wickDownColor: CORES.baixa,
    });

    // ── Série de volume ──
    _volumeSeries = _chart.addHistogramSeries({
      color: CORES.volumeBase,
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    _volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // ── Dados ──
    const dados = data || _gerarDadosDemo();
    _candleSeries.setData(dados.candles);
    _volumeSeries.setData(dados.volumes);

    // ── Atualiza informações de preço ──
    if (dados.candles.length > 0) {
      const ultimo = dados.candles[dados.candles.length - 1];
      const primeiro = dados.candles[0];
      _atualizarInfoPreco(ultimo, primeiro);
    }

    // ── Crosshair move ──
    _chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !param.seriesData.get(_candleSeries)) return;
      const candle = param.seriesData.get(_candleSeries);
      const precoEl = document.getElementById(`${_containerId}-preco`);
      if (precoEl && candle) {
        precoEl.textContent = candle.close.toLocaleString('pt-BR');
      }
    });

    // ── Eventos dos botões de timeframe ──
    controles.querySelectorAll('.tf-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        controles.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _timeframe = btn.dataset.tf;
        _trocarTimeframe(_timeframe);
      });
    });

    // ── Resize observer ──
    const resizeObserver = new ResizeObserver(() => {
      if (_chart) {
        _chart.applyOptions({
          width: chartWrapper.clientWidth,
          height: chartWrapper.clientHeight,
        });
      }
    });
    resizeObserver.observe(chartWrapper);

    console.log('[PriceChart] Inicializado com sucesso.');
  }

  /**
   * Atualiza informações de preço exibidas na barra
   */
  function _atualizarInfoPreco(ultimo, primeiro) {
    const precoEl = document.getElementById(`${_containerId}-preco`);
    const variacaoEl = document.getElementById(`${_containerId}-variacao`);

    if (precoEl) {
      precoEl.textContent = ultimo.close.toLocaleString('pt-BR');
    }

    if (variacaoEl && primeiro) {
      const diff = ultimo.close - primeiro.open;
      const pct = ((diff / primeiro.open) * 100).toFixed(2);
      const sinal = diff >= 0 ? '+' : '';
      variacaoEl.textContent = `${sinal}${pct}%`;
      variacaoEl.className = `chart-variacao ${diff >= 0 ? 'positivo' : 'negativo'}`;
    }
  }

  /**
   * Troca timeframe e recarrega dados
   */
  function _trocarTimeframe(tf) {
    _timeframe = tf;
    const dados = _gerarDadosDemo();
    if (_candleSeries) _candleSeries.setData(dados.candles);
    if (_volumeSeries) _volumeSeries.setData(dados.volumes);
    if (dados.candles.length > 0) {
      _atualizarInfoPreco(
        dados.candles[dados.candles.length - 1],
        dados.candles[0]
      );
    }
  }

  /**
   * Adiciona novo candle ao gráfico
   * @param {Object} newCandle - {time, open, high, low, close, volume}
   */
  function updatePriceChart(newCandle) {
    if (!_candleSeries || !_volumeSeries) {
      console.warn('[PriceChart] Chart não inicializado.');
      return;
    }

    _candleSeries.update({
      time: newCandle.time,
      open: newCandle.open,
      high: newCandle.high,
      low: newCandle.low,
      close: newCandle.close,
    });

    _volumeSeries.update({
      time: newCandle.time,
      value: newCandle.volume || 0,
      color: newCandle.close >= newCandle.open ? CORES.volumeAlta : CORES.volumeBaixa,
    });
  }

  /**
   * Adiciona linhas de região operacional ao gráfico
   * @param {Array} regioes - [{preco, label, cor, estilo}]
   */
  function adicionarRegioesOperacionais(regioes) {
    if (!_candleSeries) return;

    // Remove linhas anteriores
    _linhasRegiao.forEach(l => _candleSeries.removePriceLine(l));
    _linhasRegiao = [];

    regioes.forEach(regiao => {
      const linha = _candleSeries.createPriceLine({
        price: regiao.preco,
        color: regiao.cor || CORES.linhaRegiao,
        lineWidth: 1,
        lineStyle: regiao.estilo || 2, // tracejado
        axisLabelVisible: true,
        title: regiao.label || '',
      });
      _linhasRegiao.push(linha);
    });
  }

  /**
   * Define o ativo exibido (WIN/WDO)
   * @param {string} ativo - 'WIN' ou 'WDO'
   */
  function setAtivo(ativo) {
    const el = document.querySelector(`#${_containerId} .chart-ativo`);
    if (el) el.textContent = ativo;
    // Recarrega dados para o novo ativo
    const dados = _gerarDadosDemo();
    if (_candleSeries) _candleSeries.setData(dados.candles);
    if (_volumeSeries) _volumeSeries.setData(dados.volumes);
  }

  /**
   * Destrói o gráfico e limpa recursos
   */
  function destroy() {
    if (_chart) {
      _chart.remove();
      _chart = null;
      _candleSeries = null;
      _volumeSeries = null;
      _linhasRegiao = [];
    }
  }

  // ── Exportação Global ──
  window.BRDOLWINPriceChart = {
    init: initPriceChart,
    update: updatePriceChart,
    adicionarRegioes: adicionarRegioesOperacionais,
    setAtivo: setAtivo,
    destroy: destroy,
  };

  console.log('[BRDOLWIN] Módulo PriceChart carregado.');
})();
