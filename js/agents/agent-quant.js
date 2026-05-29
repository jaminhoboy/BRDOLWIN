/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente Quantitativo (agent-quant.js)            ║
 * ║  Peso na hierarquia: 4                                      ║
 * ║  Calcula: Probabilidades, Assimetria, Correlação, Robustez  ║
 * ║  NUNCA produz certezas absolutas                            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  const PESO_AGENTE = 4;
  const NOME_AGENTE = 'Agente Quantitativo';

  // Limiar máximo de confiança — NUNCA 100%
  const CONFIANCA_MAXIMA = 82;
  const PROBABILIDADE_MAXIMA = 88;

  // ─── Funções Estatísticas ─────────────────────────────────────

  /**
   * Calcula média de um array numérico
   */
  function calcularMedia(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  /**
   * Calcula desvio padrão
   */
  function calcularDesvioPadrao(arr) {
    if (!arr || arr.length < 2) return 0;
    const media = calcularMedia(arr);
    const variancia = arr.reduce(function (soma, v) {
      return soma + Math.pow(v - media, 2);
    }, 0) / (arr.length - 1);
    return Math.sqrt(variancia);
  }

  /**
   * Calcula skewness (assimetria) da distribuição
   * Positiva → cauda direita mais longa (mais valores extremos positivos)
   * Negativa → cauda esquerda mais longa (mais valores extremos negativos)
   */
  function calcularSkewness(arr) {
    if (!arr || arr.length < 3) return 0;
    const n = arr.length;
    const media = calcularMedia(arr);
    const dp = calcularDesvioPadrao(arr);
    if (dp === 0) return 0;

    const somaCubo = arr.reduce(function (soma, v) {
      return soma + Math.pow((v - media) / dp, 3);
    }, 0);

    return (n / ((n - 1) * (n - 2))) * somaCubo;
  }

  /**
   * Calcula kurtosis (curtose) da distribuição
   * Alta → caudas pesadas (mais eventos extremos)
   * Baixa → caudas leves
   */
  function calcularKurtosis(arr) {
    if (!arr || arr.length < 4) return 0;
    const n = arr.length;
    const media = calcularMedia(arr);
    const dp = calcularDesvioPadrao(arr);
    if (dp === 0) return 0;

    const somaQuarta = arr.reduce(function (soma, v) {
      return soma + Math.pow((v - media) / dp, 4);
    }, 0);

    const kurt = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * somaQuarta -
      (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));

    return kurt;
  }

  /**
   * Calcula correlação de Pearson entre dois arrays
   * Retorna valor entre -1 e +1
   */
  function calcularCorrelacao(arrX, arrY) {
    if (!arrX || !arrY) return 0;
    const n = Math.min(arrX.length, arrY.length);
    if (n < 5) return 0;

    const xSlice = arrX.slice(0, n);
    const ySlice = arrY.slice(0, n);

    const mediaX = calcularMedia(xSlice);
    const mediaY = calcularMedia(ySlice);

    let numerador = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xSlice[i] - mediaX;
      const dy = ySlice[i] - mediaY;
      numerador += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominador = Math.sqrt(denomX * denomY);
    if (denominador === 0) return 0;

    return numerador / denominador;
  }

  /**
   * Calcula Z-Score de um valor em relação a uma distribuição
   */
  function calcularZScore(valor, media, dp) {
    if (dp === 0) return 0;
    return (valor - media) / dp;
  }

  // ─── Análise de Padrões Repetitivos ───────────────────────────

  /**
   * Analisa frequência e confiança de padrões repetitivos
   * @param {Object} padroes - { totalOcorrencias, acertosAlta, acertosBaixa, amostra }
   * @returns {Object} { probabilidadeAlta, probabilidadeBaixa, confiancaPadrao, descricao }
   */
  function analisarPadroesRepetitivos(padroes) {
    if (!padroes || !padroes.totalOcorrencias || padroes.totalOcorrencias < 10) {
      return {
        probabilidadeAlta: 50,
        probabilidadeBaixa: 50,
        confiancaPadrao: 15,
        descricao: 'Amostra insuficiente para análise estatística de padrões repetitivos (mínimo: 10 ocorrências).'
      };
    }

    const total = padroes.totalOcorrencias;
    const acertosAlta = padroes.acertosAlta || 0;
    const acertosBaixa = padroes.acertosBaixa || 0;
    const neutros = total - acertosAlta - acertosBaixa;

    // Probabilidades cruas
    let probAlta = (acertosAlta / total) * 100;
    let probBaixa = (acertosBaixa / total) * 100;

    // Aplica teto — NUNCA certeza absoluta
    probAlta = Math.min(PROBABILIDADE_MAXIMA, probAlta);
    probBaixa = Math.min(PROBABILIDADE_MAXIMA, probBaixa);

    // Confiança baseada no tamanho da amostra (mais dados = mais confiança)
    // Usa raiz quadrada do tamanho da amostra como proxy
    const confiancaAmostra = Math.min(
      CONFIANCA_MAXIMA,
      Math.round(30 + Math.sqrt(total) * 5)
    );

    // Descricao
    let descricao;
    if (total < 30) {
      descricao = `Padrão identificado em ${total} ocorrências (amostra pequena). Alta: ${probAlta.toFixed(1)}%, Baixa: ${probBaixa.toFixed(1)}%. Confiança limitada pela amostra.`;
    } else if (total < 100) {
      descricao = `Padrão analisado com ${total} ocorrências. Probabilidade de alta: ${probAlta.toFixed(1)}%, baixa: ${probBaixa.toFixed(1)}%, neutro: ${((neutros / total) * 100).toFixed(1)}%.`;
    } else {
      descricao = `Análise robusta com ${total} ocorrências históricas. Alta: ${probAlta.toFixed(1)}%, Baixa: ${probBaixa.toFixed(1)}%. Padrão estatisticamente significativo.`;
    }

    return {
      probabilidadeAlta: probAlta,
      probabilidadeBaixa: probBaixa,
      confiancaPadrao: confiancaAmostra,
      descricao: descricao
    };
  }

  // ─── Análise de Assimetria da Distribuição ────────────────────

  /**
   * Avalia a assimetria da distribuição de retornos
   * @param {number[]} retornos - Array de retornos históricos
   */
  function analisarAssimetria(retornos) {
    if (!retornos || retornos.length < 20) {
      return {
        score: 50,
        skewness: 0,
        kurtosis: 0,
        descricao: 'Dados insuficientes para análise de assimetria (mínimo: 20 observações).'
      };
    }

    const skew = calcularSkewness(retornos);
    const kurt = calcularKurtosis(retornos);
    const dp = calcularDesvioPadrao(retornos);
    const media = calcularMedia(retornos);

    // Score baseado na skewness
    // Skewness positiva → mais movimentos extremos de alta → favorável para posição comprada
    let scoreAssimetria = 50;

    if (skew > 0.5) {
      scoreAssimetria = 60 + Math.min(20, skew * 8);
    } else if (skew < -0.5) {
      scoreAssimetria = 40 - Math.min(20, Math.abs(skew) * 8);
    } else {
      scoreAssimetria = 50 + skew * 10;
    }

    // Kurtosis alta → caudas pesadas → mais risco
    let alertaKurtosis = '';
    if (kurt > 3) {
      alertaKurtosis = ' Curtose elevada indica distribuição leptocúrtica — eventos extremos mais prováveis que o normal.';
    } else if (kurt < -1) {
      alertaKurtosis = ' Curtose negativa — distribuição platocúrtica, menor probabilidade de movimentos extremos.';
    }

    const descricao = `Assimetria dos retornos: skewness ${skew.toFixed(2)} (${skew > 0.3 ? 'viés positivo' : skew < -0.3 ? 'viés negativo' : 'aproximadamente simétrica'}). Desvio padrão: ${dp.toFixed(4)}, média: ${media.toFixed(4)}.${alertaKurtosis}`;

    return {
      score: Math.max(10, Math.min(90, Math.round(scoreAssimetria))),
      skewness: Number(skew.toFixed(3)),
      kurtosis: Number(kurt.toFixed(3)),
      descricao: descricao
    };
  }

  // ─── Análise de Correlação ────────────────────────────────────

  /**
   * Avalia correlações entre variáveis relevantes
   * @param {Object} correlacoes - { pares: [{ nome, serieX, serieY, esperada }] }
   */
  function analisarCorrelacoes(correlacoes) {
    if (!correlacoes || !correlacoes.pares || correlacoes.pares.length === 0) {
      return {
        score: 50,
        paresAnalisados: 0,
        descricao: 'Sem pares de correlação disponíveis para análise.'
      };
    }

    const resultados = [];
    let scoreTotal = 0;
    let pesoTotal = 0;

    correlacoes.pares.forEach(function (par) {
      const corr = calcularCorrelacao(par.serieX, par.serieY);
      const esperada = typeof par.esperada === 'number' ? par.esperada : 0;
      const desvioEsperada = Math.abs(corr - esperada);

      // Score: correlação alinhada com esperada → bom
      let scorePar;
      if (desvioEsperada < 0.15) {
        scorePar = 70; // Correlação como esperada
      } else if (desvioEsperada < 0.35) {
        scorePar = 55; // Desvio moderado
      } else {
        scorePar = 30; // Correlação desalinhada — sinal de alerta
      }

      const peso = par.peso || 1;
      scoreTotal += scorePar * peso;
      pesoTotal += peso;

      resultados.push({
        nome: par.nome || 'Par desconhecido',
        correlacao: Number(corr.toFixed(3)),
        esperada: esperada,
        desvio: Number(desvioEsperada.toFixed(3)),
        alinhada: desvioEsperada < 0.15
      });
    });

    const scoreMedio = pesoTotal > 0 ? scoreTotal / pesoTotal : 50;

    const paresAlinhados = resultados.filter(function (r) { return r.alinhada; }).length;
    const descricao = `${resultados.length} par(es) de correlação analisados. ${paresAlinhados} alinhado(s) com a expectativa. ` +
      resultados.map(function (r) {
        return `${r.nome}: ρ=${r.correlacao} (esperada: ${r.esperada})`;
      }).join('; ') + '.';

    return {
      score: Math.round(Math.max(10, Math.min(90, scoreMedio))),
      paresAnalisados: resultados.length,
      resultados: resultados,
      descricao: descricao
    };
  }

  // ─── Análise de Robustez do Setup ─────────────────────────────

  /**
   * Avalia robustez do setup quantitativo
   * @param {Object} setup - { payoff, winRate, amostra, drawdownMax, sharpe }
   */
  function analisarRobustez(setup) {
    if (!setup) {
      return {
        score: 50,
        qualidade: 'indeterminada',
        descricao: 'Sem dados de setup para avaliação de robustez.'
      };
    }

    let scoreRobustez = 50;
    const observacoes = [];

    // Win Rate (ajustado pelo payoff)
    const winRate = typeof setup.winRate === 'number' ? setup.winRate : 50;
    const payoff = typeof setup.payoff === 'number' ? setup.payoff : 1.0;

    // Expectativa matemática: E = (winRate * payoff) - ((1 - winRate) * 1)
    const winRateDecimal = winRate / 100;
    const expectativa = (winRateDecimal * payoff) - ((1 - winRateDecimal) * 1);

    if (expectativa > 0.3) {
      scoreRobustez += 25;
      observacoes.push(`Expectativa matemática positiva: ${expectativa.toFixed(2)}R`);
    } else if (expectativa > 0.1) {
      scoreRobustez += 12;
      observacoes.push(`Expectativa matemática moderadamente positiva: ${expectativa.toFixed(2)}R`);
    } else if (expectativa > 0) {
      scoreRobustez += 5;
      observacoes.push(`Expectativa marginalmente positiva: ${expectativa.toFixed(2)}R — edge limitado`);
    } else {
      scoreRobustez -= 15;
      observacoes.push(`Expectativa negativa: ${expectativa.toFixed(2)}R — setup sem vantagem estatística`);
    }

    // Sharpe Ratio
    const sharpe = typeof setup.sharpe === 'number' ? setup.sharpe : null;
    if (sharpe !== null) {
      if (sharpe > 2.0) {
        scoreRobustez += 15;
        observacoes.push(`Sharpe Ratio excelente: ${sharpe.toFixed(2)}`);
      } else if (sharpe > 1.0) {
        scoreRobustez += 8;
        observacoes.push(`Sharpe Ratio bom: ${sharpe.toFixed(2)}`);
      } else if (sharpe > 0.5) {
        scoreRobustez += 3;
        observacoes.push(`Sharpe Ratio aceitável: ${sharpe.toFixed(2)}`);
      } else {
        scoreRobustez -= 8;
        observacoes.push(`Sharpe Ratio baixo: ${sharpe.toFixed(2)} — risco/retorno desfavorável`);
      }
    }

    // Drawdown máximo
    const ddMax = typeof setup.drawdownMax === 'number' ? setup.drawdownMax : null;
    if (ddMax !== null) {
      if (ddMax > 30) {
        scoreRobustez -= 15;
        observacoes.push(`Drawdown máximo elevado: ${ddMax.toFixed(1)}% — risco de ruína significativo`);
      } else if (ddMax > 15) {
        scoreRobustez -= 5;
        observacoes.push(`Drawdown máximo moderado: ${ddMax.toFixed(1)}%`);
      } else {
        scoreRobustez += 5;
        observacoes.push(`Drawdown máximo controlado: ${ddMax.toFixed(1)}%`);
      }
    }

    // Tamanho da amostra
    const amostra = typeof setup.amostra === 'number' ? setup.amostra : 0;
    if (amostra < 30) {
      scoreRobustez -= 10;
      observacoes.push(`Amostra insuficiente (${amostra} trades) — risco de overfitting`);
    } else if (amostra >= 100) {
      scoreRobustez += 5;
      observacoes.push(`Amostra robusta: ${amostra} trades analisados`);
    }

    // Limitar — NUNCA certeza
    scoreRobustez = Math.max(10, Math.min(PROBABILIDADE_MAXIMA, scoreRobustez));

    // Qualidade
    let qualidade;
    if (scoreRobustez >= 70) qualidade = 'robusto';
    else if (scoreRobustez >= 55) qualidade = 'aceitável';
    else if (scoreRobustez >= 40) qualidade = 'frágil';
    else qualidade = 'sem vantagem';

    const descricao = 'Robustez do setup: ' + observacoes.join('. ') +
      `. Qualidade: ${qualidade} (score: ${Math.round(scoreRobustez)}/100).`;

    return {
      score: Math.round(scoreRobustez),
      qualidade: qualidade,
      expectativa: Number(expectativa.toFixed(3)),
      descricao: descricao
    };
  }

  // ─── Função Principal ─────────────────────────────────────────

  function analyze(marketData) {
    const quant = (marketData && marketData.quant) || {};

    // Executa cada componente
    const resultPadroes = analisarPadroesRepetitivos(quant.padroes);
    const resultAssimetria = analisarAssimetria(quant.retornos);
    const resultCorrelacoes = analisarCorrelacoes(quant.correlacoes);
    const resultRobustez = analisarRobustez(quant.setup);

    // Score composto
    // Padrões: 30%, Assimetria: 20%, Correlações: 20%, Robustez: 30%
    const scorePadroes = Math.max(resultPadroes.probabilidadeAlta, resultPadroes.probabilidadeBaixa) > 55
      ? (resultPadroes.probabilidadeAlta > resultPadroes.probabilidadeBaixa
        ? 50 + (resultPadroes.probabilidadeAlta - 50) * 0.8
        : 50 - (resultPadroes.probabilidadeBaixa - 50) * 0.8)
      : 50;

    const scoreGeral =
      scorePadroes * 0.30 +
      resultAssimetria.score * 0.20 +
      resultCorrelacoes.score * 0.20 +
      resultRobustez.score * 0.30;

    // Limitar — NUNCA certeza absoluta
    const scoreFinal = Math.max(5, Math.min(PROBABILIDADE_MAXIMA, scoreGeral));

    // Direção
    let direcao;
    if (scoreFinal > 58 && resultPadroes.probabilidadeAlta > resultPadroes.probabilidadeBaixa) {
      direcao = 'alta';
    } else if (scoreFinal < 42 || resultPadroes.probabilidadeBaixa > resultPadroes.probabilidadeAlta + 10) {
      direcao = 'baixa';
    } else {
      direcao = 'neutro';
    }

    // Confiança — média ponderada das confiânças individuais, com teto
    let confianca = Math.round(Math.min(
      CONFIANCA_MAXIMA,
      resultPadroes.confiancaPadrao * 0.3 +
      Math.abs(resultAssimetria.score - 50) * 1.2 * 0.2 +
      resultCorrelacoes.score * 0.2 +
      resultRobustez.score * 0.3
    ));
    confianca = Math.max(15, confianca);

    // Risco
    let risco;
    if (resultRobustez.qualidade === 'sem vantagem') risco = 'extremo';
    else if (resultRobustez.qualidade === 'frágil' || confianca < 35) risco = 'alto';
    else if (resultRobustez.qualidade === 'aceitável' || direcao === 'neutro') risco = 'moderado';
    else risco = 'baixo';

    // Interpretação
    const interpretacao = [
      resultPadroes.descricao,
      resultAssimetria.descricao,
      resultCorrelacoes.descricao,
      resultRobustez.descricao,
      'NOTA: Análise quantitativa fornece probabilidades estimadas — nunca certezas absolutas. Resultados passados não garantem desempenho futuro.'
    ].join(' ');

    return {
      nome: NOME_AGENTE,
      score: Math.round(scoreFinal),
      direcao: direcao,
      confianca: confianca,
      interpretacao: interpretacao,
      risco: risco,
      peso: PESO_AGENTE,
      _detalhes: {
        probabilidadeAlta: Number(resultPadroes.probabilidadeAlta.toFixed(1)),
        probabilidadeBaixa: Number(resultPadroes.probabilidadeBaixa.toFixed(1)),
        skewness: resultAssimetria.skewness,
        kurtosis: resultAssimetria.kurtosis,
        correlacoes: resultCorrelacoes.resultados || [],
        robustez: resultRobustez.qualidade,
        expectativa: resultRobustez.expectativa
      }
    };
  }

  // ─── Exportação ───────────────────────────────────────────────
  window.BRDOLWINAgentQuant = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE})`);

})();
