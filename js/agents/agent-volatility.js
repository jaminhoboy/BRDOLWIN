/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente de Volatilidade e Regime                 ║
 * ║  (agent-volatility.js)                                      ║
 * ║  Peso na hierarquia: 6                                      ║
 * ║  Detecta regimes de mercado e ajusta pesos dos agentes      ║
 * ║  Regimes: tendência | lateralização | explosão |            ║
 * ║  iliquidez | manipulação | ruído                            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  const PESO_AGENTE = 6;
  const NOME_AGENTE = 'Agente de Volatilidade e Regime';

  // ─── Definição de Regimes ─────────────────────────────────────

  /**
   * Cada regime define como o mercado está se comportando
   * e como os outros agentes devem ajustar suas avaliações
   */
  const REGIMES = {
    tendencia: {
      nome: 'Tendência',
      descricao: 'Mercado em tendência direcional definida — seguir o fluxo principal.',
      qualidadeBase: 75,
      // Ajustes de peso para outros agentes neste regime
      ajustesPeso: {
        fluxo: 1.2,       // Fluxo mais importante em tendência
        volatilidade: 1.0,
        macro: 0.9,
        correlacao: 1.0,
        estrutural: 1.1,   // Estrutura sustenta tendência
        quantitativo: 1.0,
        sentimento: 0.8    // Sentimento menos confiável em tendência
      },
      ajusteConfianca: 1.1  // Confiança geral levemente aumentada
    },
    lateralizacao: {
      nome: 'Lateralização',
      descricao: 'Mercado lateralizado em range — operações de reversão à média.',
      qualidadeBase: 55,
      ajustesPeso: {
        fluxo: 1.0,
        volatilidade: 1.0,
        macro: 0.7,        // Macro menos relevante em range
        correlacao: 0.8,
        estrutural: 1.3,   // Estrutura muito importante em range
        quantitativo: 1.2, // Quant funciona bem em range
        sentimento: 1.0
      },
      ajusteConfianca: 0.9
    },
    explosao: {
      nome: 'Explosão de Volatilidade',
      descricao: 'Volatilidade em expansão rápida — ajustar alvos e stops. Movimentos amplos.',
      qualidadeBase: 60,
      ajustesPeso: {
        fluxo: 1.3,        // Fluxo é REI em explosões
        volatilidade: 1.2,
        macro: 1.1,
        correlacao: 1.2,   // Correlações importam em crises
        estrutural: 0.7,   // Estrutura pode ser rompida facilmente
        quantitativo: 0.6, // Quant falha em eventos extremos
        sentimento: 1.1
      },
      ajusteConfianca: 0.8  // Confiança reduzida — ambiente imprevisível
    },
    iliquidez: {
      nome: 'Iliquidez',
      descricao: 'Mercado ilíquido — spreads amplos, execução comprometida. Reduzir tamanho.',
      qualidadeBase: 25,
      ajustesPeso: {
        fluxo: 0.7,        // Fluxo distorcido pela iliquidez
        volatilidade: 1.0,
        macro: 0.8,
        correlacao: 0.6,   // Correlações quebram em iliquidez
        estrutural: 0.6,   // Suportes/resistências frágeis
        quantitativo: 0.5, // Estatísticas não confiáveis
        sentimento: 0.7
      },
      ajusteConfianca: 0.5  // Confiança fortemente reduzida
    },
    manipulacao: {
      nome: 'Manipulação Detectada',
      descricao: 'Padrões de manipulação identificados — qualidade operacional comprometida.',
      qualidadeBase: 15,
      ajustesPeso: {
        fluxo: 0.5,        // Fluxo pode estar sendo manipulado
        volatilidade: 1.0,
        macro: 0.6,
        correlacao: 0.5,   // Tudo distorcido
        estrutural: 0.4,
        quantitativo: 0.3, // Dados corrompidos
        sentimento: 0.5
      },
      ajusteConfianca: 0.3  // Confiança mínima
    },
    ruido: {
      nome: 'Ruído',
      descricao: 'Mercado em ruído — sem tendência, sem range claro. Movimentos aleatórios.',
      qualidadeBase: 20,
      ajustesPeso: {
        fluxo: 0.8,
        volatilidade: 1.0,
        macro: 0.7,
        correlacao: 0.7,
        estrutural: 0.5,   // Estrutura irrelevante em ruído
        quantitativo: 0.4, // Padrões não se repetem
        sentimento: 0.6
      },
      ajusteConfianca: 0.4  // Confiança muito baixa
    }
  };

  // ─── Funções de Detecção de Regime ────────────────────────────

  /**
   * Calcula ATR (Average True Range) normalizado
   * @param {number[]} trs - Array de True Ranges
   * @param {number} preco - Preço atual para normalização
   */
  function calcularATRNormalizado(trs, preco) {
    if (!trs || trs.length === 0 || !preco) return 1.0;
    const atr = trs.reduce(function (a, b) { return a + b; }, 0) / trs.length;
    return (atr / preco) * 100; // ATR como % do preço
  }

  /**
   * Calcula eficiência direcional (de 0 a 1)
   * 1 = movimento perfeitamente direcional
   * 0 = movimento totalmente lateral/aleatório
   * @param {number} deslocamento - Movimento líquido do preço
   * @param {number} caminho - Soma de todos os movimentos absolutos
   */
  function calcularEficiencia(deslocamento, caminho) {
    if (!caminho || caminho === 0) return 0;
    return Math.abs(deslocamento) / caminho;
  }

  /**
   * Detecta o regime atual de mercado
   * @param {Object} dados - Dados de volatilidade e microestrutura
   * @returns {Object} { regime, confianca, detalhes }
   */
  function detectarRegime(dados) {
    // Extrair métricas
    const atrNorm = typeof dados.atrNormalizado === 'number' ? dados.atrNormalizado : 1.0;
    const eficiencia = typeof dados.eficienciaDirecional === 'number' ? dados.eficienciaDirecional : 0.5;
    const volumeRelativo = typeof dados.volumeRelativoMedia === 'number' ? dados.volumeRelativoMedia : 1.0;
    const spreadMedio = typeof dados.spreadMedio === 'number' ? dados.spreadMedio : 1.0; // Em ticks
    const volatHistorica = typeof dados.volatilidadeHistorica === 'number' ? dados.volatilidadeHistorica : 1.0;
    const volatImplicita = typeof dados.volatilidadeImplicita === 'number' ? dados.volatilidadeImplicita : null;
    const spoofingDetectado = typeof dados.spoofingScore === 'number' ? dados.spoofingScore : 0;
    const washTrading = typeof dados.washTradingScore === 'number' ? dados.washTradingScore : 0;

    // Pontuação de cada regime
    const pontosRegime = {
      tendencia: 0,
      lateralizacao: 0,
      explosao: 0,
      iliquidez: 0,
      manipulacao: 0,
      ruido: 0
    };

    // ── TENDÊNCIA ──
    // Alta eficiência + volatilidade normal-alta + volume ok
    if (eficiencia > 0.55) pontosRegime.tendencia += 35;
    else if (eficiencia > 0.40) pontosRegime.tendencia += 20;

    if (atrNorm > 0.5 && atrNorm < 3.0) pontosRegime.tendencia += 15;
    if (volumeRelativo > 0.8 && volumeRelativo < 2.5) pontosRegime.tendencia += 10;
    if (spreadMedio < 3) pontosRegime.tendencia += 5;

    // ── LATERALIZAÇÃO ──
    // Baixa eficiência + volatilidade baixa-normal
    if (eficiencia < 0.25) pontosRegime.lateralizacao += 35;
    else if (eficiencia < 0.40) pontosRegime.lateralizacao += 20;

    if (atrNorm < 1.0) pontosRegime.lateralizacao += 15;
    if (volumeRelativo < 1.2 && volumeRelativo > 0.5) pontosRegime.lateralizacao += 10;

    // ── EXPLOSÃO ──
    // Volatilidade muito alta + volume alto
    if (atrNorm > 3.0) pontosRegime.explosao += 30;
    else if (atrNorm > 2.0) pontosRegime.explosao += 15;

    if (volumeRelativo > 2.5) pontosRegime.explosao += 20;
    else if (volumeRelativo > 1.8) pontosRegime.explosao += 10;

    // Vol implícita muito acima da histórica
    if (volatImplicita !== null && volatHistorica > 0) {
      const razaoVol = volatImplicita / volatHistorica;
      if (razaoVol > 1.5) pontosRegime.explosao += 15;
    }

    // ── ILIQUIDEZ ──
    // Volume muito baixo + spread amplo
    if (volumeRelativo < 0.4) pontosRegime.iliquidez += 30;
    else if (volumeRelativo < 0.6) pontosRegime.iliquidez += 15;

    if (spreadMedio > 5) pontosRegime.iliquidez += 25;
    else if (spreadMedio > 3) pontosRegime.iliquidez += 12;

    // ── MANIPULAÇÃO ──
    // Spoofing + wash trading
    if (spoofingDetectado > 60) pontosRegime.manipulacao += 35;
    else if (spoofingDetectado > 30) pontosRegime.manipulacao += 15;

    if (washTrading > 50) pontosRegime.manipulacao += 25;
    else if (washTrading > 25) pontosRegime.manipulacao += 12;

    // Volume alto + eficiência baixa pode ser manipulação
    if (volumeRelativo > 2.0 && eficiencia < 0.20) pontosRegime.manipulacao += 10;

    // ── RUÍDO ──
    // Eficiência muito baixa + volatilidade errática
    if (eficiencia < 0.15) pontosRegime.ruido += 25;
    if (atrNorm > 0.8 && atrNorm < 2.0 && eficiencia < 0.25) pontosRegime.ruido += 15;
    if (volumeRelativo > 0.5 && volumeRelativo < 1.0 && eficiencia < 0.30) pontosRegime.ruido += 10;

    // Encontra o regime dominante
    let regimeDominante = 'ruido';
    let pontuacaoMax = 0;

    Object.keys(pontosRegime).forEach(function (regime) {
      if (pontosRegime[regime] > pontuacaoMax) {
        pontuacaoMax = pontosRegime[regime];
        regimeDominante = regime;
      }
    });

    // Confiança da detecção de regime
    const pontuacaoTotal = Object.values(pontosRegime).reduce(function (a, b) { return a + b; }, 0);
    const confiancaRegime = pontuacaoTotal > 0
      ? Math.round(Math.min(90, (pontuacaoMax / pontuacaoTotal) * 100 + 15))
      : 30;

    return {
      regime: regimeDominante,
      confiancaDeteccao: confiancaRegime,
      pontuacoes: pontosRegime,
      metricas: {
        atrNormalizado: Number(atrNorm.toFixed(3)),
        eficienciaDirecional: Number(eficiencia.toFixed(3)),
        volumeRelativo: Number(volumeRelativo.toFixed(2)),
        spreadMedio: spreadMedio
      }
    };
  }

  /**
   * Gera os ajustes dinâmicos de peso para os outros agentes
   * @param {string} regime - Regime detectado
   * @returns {Object} Mapa de ajustes de peso
   */
  function gerarAjustesPeso(regime) {
    const configRegime = REGIMES[regime];
    if (!configRegime) return REGIMES.ruido.ajustesPeso;
    return configRegime.ajustesPeso;
  }

  /**
   * Calcula ajustes de alvos e stops para o regime atual
   * @param {string} regime - Regime detectado
   * @param {number} atrNorm - ATR normalizado
   */
  function calcularAjustesOperacionais(regime, atrNorm) {
    const ajustes = {
      multiplicadorStop: 1.0,
      multiplicadorAlvo: 1.0,
      reducaoTamanho: 1.0,
      observacao: ''
    };

    switch (regime) {
      case 'tendencia':
        ajustes.multiplicadorStop = 1.0;
        ajustes.multiplicadorAlvo = 1.3;
        ajustes.reducaoTamanho = 1.0;
        ajustes.observacao = 'Regime de tendência — alvos podem ser estendidos, stops normais.';
        break;

      case 'lateralizacao':
        ajustes.multiplicadorStop = 0.8;
        ajustes.multiplicadorAlvo = 0.7;
        ajustes.reducaoTamanho = 0.85;
        ajustes.observacao = 'Lateralização — alvos curtos, stops apertados, tamanho levemente reduzido.';
        break;

      case 'explosao':
        // Explosão → stops mais largos, alvos maiores, tamanho reduzido
        ajustes.multiplicadorStop = 1.5 + (atrNorm > 3 ? 0.5 : 0);
        ajustes.multiplicadorAlvo = 1.8;
        ajustes.reducaoTamanho = 0.5;
        ajustes.observacao = 'Explosão de volatilidade — stops ampliados, alvos estendidos, tamanho REDUZIDO pela metade.';
        break;

      case 'iliquidez':
        ajustes.multiplicadorStop = 2.0;
        ajustes.multiplicadorAlvo = 0.5;
        ajustes.reducaoTamanho = 0.3;
        ajustes.observacao = 'ILIQUIDEZ — risco de slippage elevado. Tamanho reduzido para 30%. Stops amplos para evitar stops prematuros por gap de liquidez.';
        break;

      case 'manipulacao':
        ajustes.multiplicadorStop = 1.5;
        ajustes.multiplicadorAlvo = 0.3;
        ajustes.reducaoTamanho = 0.1;
        ajustes.observacao = 'MANIPULAÇÃO DETECTADA — EVITAR operações. Se operar, tamanho mínimo (10%).';
        break;

      case 'ruido':
        ajustes.multiplicadorStop = 0.7;
        ajustes.multiplicadorAlvo = 0.5;
        ajustes.reducaoTamanho = 0.4;
        ajustes.observacao = 'Ruído de mercado — sem edge direcional. Reduzir tamanho significativamente ou aguardar definição.';
        break;

      default:
        ajustes.observacao = 'Regime indefinido — usar parâmetros padrão com cautela.';
    }

    return ajustes;
  }

  /**
   * Gera interpretação textual profissional do regime
   */
  function gerarInterpretacao(regime, deteccao, ajustes, ajustesPeso) {
    const configRegime = REGIMES[regime];
    const partes = [];

    // Descrição do regime
    partes.push(`Regime detectado: ${configRegime.nome} (confiança: ${deteccao.confiancaDeteccao}%).`);
    partes.push(configRegime.descricao);

    // Métricas
    partes.push(`Métricas: ATR normalizado ${deteccao.metricas.atrNormalizado}%, eficiência direcional ${(deteccao.metricas.eficienciaDirecional * 100).toFixed(0)}%, volume relativo ${deteccao.metricas.volumeRelativo}x, spread médio ${deteccao.metricas.spreadMedio} ticks.`);

    // Ajustes operacionais
    partes.push(ajustes.observacao);

    // Ajustes de peso
    const pesosAlterados = [];
    Object.keys(ajustesPeso).forEach(function (agente) {
      if (ajustesPeso[agente] !== 1.0) {
        const direcao = ajustesPeso[agente] > 1.0 ? 'aumentado' : 'reduzido';
        pesosAlterados.push(`${agente} ${direcao} (×${ajustesPeso[agente].toFixed(1)})`);
      }
    });

    if (pesosAlterados.length > 0) {
      partes.push('Pesos ajustados pelo regime: ' + pesosAlterados.join(', ') + '.');
    }

    // Alertas especiais
    if (regime === 'iliquidez') {
      partes.push('⚠ ALERTA: Iliquidez reduz confiança geral de todos os agentes. Slippage esperado acima do normal.');
    } else if (regime === 'manipulacao') {
      partes.push('🚨 ALERTA CRÍTICO: Manipulação detectada. Recomenda-se EVITAR operações até normalização do regime.');
    } else if (regime === 'explosao') {
      partes.push('⚡ Explosão de volatilidade em curso. Ajustar stops e alvos para movimentos amplificados.');
    }

    return partes.join(' ');
  }

  // ─── Função Principal ─────────────────────────────────────────

  function analyze(marketData) {
    const vol = (marketData && marketData.volatilidade) || {};

    // Prepara dados com defaults
    const dados = {
      atrNormalizado: typeof vol.atrNormalizado === 'number' ? vol.atrNormalizado : 1.0,
      eficienciaDirecional: typeof vol.eficienciaDirecional === 'number' ? vol.eficienciaDirecional : 0.5,
      volumeRelativoMedia: typeof vol.volumeRelativoMedia === 'number' ? vol.volumeRelativoMedia : 1.0,
      spreadMedio: typeof vol.spreadMedio === 'number' ? vol.spreadMedio : 1.5,
      volatilidadeHistorica: typeof vol.volatilidadeHistorica === 'number' ? vol.volatilidadeHistorica : 15,
      volatilidadeImplicita: typeof vol.volatilidadeImplicita === 'number' ? vol.volatilidadeImplicita : null,
      spoofingScore: typeof vol.spoofingScore === 'number' ? vol.spoofingScore : 5,
      washTradingScore: typeof vol.washTradingScore === 'number' ? vol.washTradingScore : 0
    };

    // Detecta regime
    const deteccao = detectarRegime(dados);
    const regime = deteccao.regime;
    const configRegime = REGIMES[regime];

    // Gera ajustes
    const ajustesPeso = gerarAjustesPeso(regime);
    const ajustesOp = calcularAjustesOperacionais(regime, dados.atrNormalizado);

    // Score — baseado na qualidade operacional do regime
    const scoreGeral = configRegime.qualidadeBase;

    // Direção — volatilidade/regime não tem direção por si, mas indica se a operação é viável
    let direcao;
    if (regime === 'tendencia' && dados.eficienciaDirecional > 0.5) {
      // Em tendência, ler a direção pela eficiência
      // Mas precisamos de dados adicionais para saber se alta ou baixa
      direcao = 'neutro'; // Regime informa qualidade, não direção
    } else {
      direcao = 'neutro'; // Agente de regime é neutro direcional por natureza
    }

    // Se dados de direção da tendência estão disponíveis
    if (vol.direcaoTendencia === 'alta' && regime === 'tendencia') {
      direcao = 'alta';
    } else if (vol.direcaoTendencia === 'baixa' && regime === 'tendencia') {
      direcao = 'baixa';
    }

    // Confiança
    let confianca = Math.round(Math.min(85, deteccao.confiancaDeteccao * configRegime.ajusteConfianca));
    confianca = Math.max(15, confianca);

    // Risco
    let risco;
    if (regime === 'manipulacao') risco = 'extremo';
    else if (regime === 'iliquidez' || regime === 'explosao') risco = 'alto';
    else if (regime === 'ruido' || regime === 'lateralizacao') risco = 'moderado';
    else risco = 'baixo';

    // Interpretação
    const interpretacao = gerarInterpretacao(regime, deteccao, ajustesOp, ajustesPeso);

    return {
      nome: NOME_AGENTE,
      score: Math.round(Math.max(0, Math.min(100, scoreGeral))),
      direcao: direcao,
      confianca: confianca,
      interpretacao: interpretacao,
      risco: risco,
      peso: PESO_AGENTE,
      // Dados extras cruciais para o motor de consenso
      _detalhes: {
        regime: regime,
        nomeRegime: configRegime.nome,
        confiancaDeteccao: deteccao.confiancaDeteccao,
        ajustesPesoAgentes: ajustesPeso,
        ajusteConfiancaGeral: configRegime.ajusteConfianca,
        ajustesOperacionais: ajustesOp,
        pontuacoesRegimes: deteccao.pontuacoes,
        metricas: deteccao.metricas
      }
    };
  }

  // ─── Exportação ───────────────────────────────────────────────
  window.BRDOLWINAgentVolatility = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE})`);

})();
