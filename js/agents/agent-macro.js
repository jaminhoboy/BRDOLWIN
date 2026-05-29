/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente Macro (agent-macro.js)                   ║
 * ║  Peso na hierarquia: 5                                      ║
 * ║  Analisa: Juros, Inflação, Risco Fiscal, DXY, Treasuries,  ║
 * ║  Petróleo, Liquidez Global                                  ║
 * ║  Determina ambiente macroeconômico vigente                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  // ─── Constantes de Referência ──────────────────────────────────
  const PESO_AGENTE = 5;
  const NOME_AGENTE = 'Agente Macro';

  // Limiares de referência para cálculos
  const LIMIARES = {
    // Juros — SELIC
    selic: {
      expansionista: 9.0,   // Abaixo → expansionista
      neutro: 12.5,         // Faixa neutra
      restritivo: 14.0      // Acima → restritivo
    },
    // Juros — FED Funds
    fedFunds: {
      expansionista: 2.5,
      neutro: 4.0,
      restritivo: 5.5
    },
    // Inflação — IPCA (12 meses)
    ipca: {
      controlada: 3.5,
      alerta: 5.0,
      critica: 7.0
    },
    // Inflação — CPI (EUA, 12 meses)
    cpi: {
      controlada: 2.5,
      alerta: 4.0,
      critica: 6.0
    },
    // DXY — Índice do Dólar
    dxy: {
      fraco: 100,
      neutro: 104,
      forte: 108
    },
    // Treasuries 10Y
    treasuries10y: {
      baixo: 3.5,
      neutro: 4.2,
      alto: 5.0
    },
    // Petróleo (Brent, USD)
    petroleo: {
      baixo: 60,
      neutro: 80,
      alto: 100
    },
    // CDS Brasil 5Y (risco fiscal)
    cdsBrasil: {
      baixo: 120,
      moderado: 180,
      alto: 250,
      critico: 350
    },
    // Liquidez global (proxy — M2 variação YoY %)
    liquidezGlobal: {
      contracao: -2,
      neutra: 2,
      expansao: 6
    }
  };

  // ─── Funções Auxiliares ────────────────────────────────────────

  /**
   * Normaliza um valor entre 0 e 100 baseado em min/max
   */
  function normalizar(valor, min, max) {
    if (max === min) return 50;
    const norm = ((valor - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, norm));
  }

  /**
   * Interpola linearmente entre dois valores
   */
  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  /**
   * Calcula score parcial de juros (SELIC + FED)
   * Juros altos → score baixo (negativo para ativos de risco)
   */
  function calcularScoreJuros(selic, fedFunds) {
    // SELIC
    let scoreSelic;
    if (selic <= LIMIARES.selic.expansionista) {
      scoreSelic = 85;
    } else if (selic <= LIMIARES.selic.neutro) {
      scoreSelic = lerp(70, 50, (selic - LIMIARES.selic.expansionista) / (LIMIARES.selic.neutro - LIMIARES.selic.expansionista));
    } else if (selic <= LIMIARES.selic.restritivo) {
      scoreSelic = lerp(50, 25, (selic - LIMIARES.selic.neutro) / (LIMIARES.selic.restritivo - LIMIARES.selic.neutro));
    } else {
      scoreSelic = Math.max(10, 25 - (selic - LIMIARES.selic.restritivo) * 5);
    }

    // FED Funds
    let scoreFed;
    if (fedFunds <= LIMIARES.fedFunds.expansionista) {
      scoreFed = 85;
    } else if (fedFunds <= LIMIARES.fedFunds.neutro) {
      scoreFed = lerp(70, 50, (fedFunds - LIMIARES.fedFunds.expansionista) / (LIMIARES.fedFunds.neutro - LIMIARES.fedFunds.expansionista));
    } else if (fedFunds <= LIMIARES.fedFunds.restritivo) {
      scoreFed = lerp(50, 25, (fedFunds - LIMIARES.fedFunds.neutro) / (LIMIARES.fedFunds.restritivo - LIMIARES.fedFunds.neutro));
    } else {
      scoreFed = Math.max(10, 25 - (fedFunds - LIMIARES.fedFunds.restritivo) * 5);
    }

    // Peso: 60% SELIC (mercado local), 40% FED (impacto global)
    return scoreSelic * 0.6 + scoreFed * 0.4;
  }

  /**
   * Calcula score parcial de inflação (IPCA + CPI)
   * Inflação controlada → favorável para ativos
   */
  function calcularScoreInflacao(ipca, cpi) {
    let scoreIpca;
    if (ipca <= LIMIARES.ipca.controlada) {
      scoreIpca = 80;
    } else if (ipca <= LIMIARES.ipca.alerta) {
      scoreIpca = lerp(65, 40, (ipca - LIMIARES.ipca.controlada) / (LIMIARES.ipca.alerta - LIMIARES.ipca.controlada));
    } else if (ipca <= LIMIARES.ipca.critica) {
      scoreIpca = lerp(40, 15, (ipca - LIMIARES.ipca.alerta) / (LIMIARES.ipca.critica - LIMIARES.ipca.alerta));
    } else {
      scoreIpca = Math.max(5, 15 - (ipca - LIMIARES.ipca.critica) * 3);
    }

    let scoreCpi;
    if (cpi <= LIMIARES.cpi.controlada) {
      scoreCpi = 80;
    } else if (cpi <= LIMIARES.cpi.alerta) {
      scoreCpi = lerp(65, 40, (cpi - LIMIARES.cpi.controlada) / (LIMIARES.cpi.alerta - LIMIARES.cpi.controlada));
    } else if (cpi <= LIMIARES.cpi.critica) {
      scoreCpi = lerp(40, 15, (cpi - LIMIARES.cpi.alerta) / (LIMIARES.cpi.critica - LIMIARES.cpi.alerta));
    } else {
      scoreCpi = Math.max(5, 15 - (cpi - LIMIARES.cpi.critica) * 3);
    }

    return scoreIpca * 0.55 + scoreCpi * 0.45;
  }

  /**
   * Calcula score de risco fiscal (CDS Brasil 5Y)
   * CDS baixo → ambiente favorável
   */
  function calcularScoreRiscoFiscal(cds) {
    if (cds <= LIMIARES.cdsBrasil.baixo) {
      return 85;
    } else if (cds <= LIMIARES.cdsBrasil.moderado) {
      return lerp(75, 50, (cds - LIMIARES.cdsBrasil.baixo) / (LIMIARES.cdsBrasil.moderado - LIMIARES.cdsBrasil.baixo));
    } else if (cds <= LIMIARES.cdsBrasil.alto) {
      return lerp(50, 25, (cds - LIMIARES.cdsBrasil.moderado) / (LIMIARES.cdsBrasil.alto - LIMIARES.cdsBrasil.moderado));
    } else if (cds <= LIMIARES.cdsBrasil.critico) {
      return lerp(25, 10, (cds - LIMIARES.cdsBrasil.alto) / (LIMIARES.cdsBrasil.critico - LIMIARES.cdsBrasil.alto));
    } else {
      return Math.max(5, 10 - (cds - LIMIARES.cdsBrasil.critico) * 0.05);
    }
  }

  /**
   * Calcula score do DXY
   * DXY forte → negativo para BRL (dólar sobe, WIN cai)
   * Para WIN: DXY forte = ruim | Para WDO: DXY forte = bom
   */
  function calcularScoreDXY(dxy) {
    if (dxy <= LIMIARES.dxy.fraco) {
      return 80; // Dólar fraco → bom para ativos BR
    } else if (dxy <= LIMIARES.dxy.neutro) {
      return lerp(65, 45, (dxy - LIMIARES.dxy.fraco) / (LIMIARES.dxy.neutro - LIMIARES.dxy.fraco));
    } else if (dxy <= LIMIARES.dxy.forte) {
      return lerp(45, 20, (dxy - LIMIARES.dxy.neutro) / (LIMIARES.dxy.forte - LIMIARES.dxy.neutro));
    } else {
      return Math.max(10, 20 - (dxy - LIMIARES.dxy.forte) * 2);
    }
  }

  /**
   * Calcula score das Treasuries 10Y
   * Yields altos → fuga de capital de emergentes
   */
  function calcularScoreTreasuries(yield10y) {
    if (yield10y <= LIMIARES.treasuries10y.baixo) {
      return 78;
    } else if (yield10y <= LIMIARES.treasuries10y.neutro) {
      return lerp(65, 45, (yield10y - LIMIARES.treasuries10y.baixo) / (LIMIARES.treasuries10y.neutro - LIMIARES.treasuries10y.baixo));
    } else if (yield10y <= LIMIARES.treasuries10y.alto) {
      return lerp(45, 20, (yield10y - LIMIARES.treasuries10y.neutro) / (LIMIARES.treasuries10y.alto - LIMIARES.treasuries10y.neutro));
    } else {
      return Math.max(10, 20 - (yield10y - LIMIARES.treasuries10y.alto) * 5);
    }
  }

  /**
   * Calcula score do petróleo
   * Petróleo alto → pressão inflacionária, mas bom para Petrobras
   */
  function calcularScorePetroleo(preco) {
    if (preco <= LIMIARES.petroleo.baixo) {
      return 55; // Muito baixo pode indicar recessão
    } else if (preco <= LIMIARES.petroleo.neutro) {
      return lerp(65, 70, (preco - LIMIARES.petroleo.baixo) / (LIMIARES.petroleo.neutro - LIMIARES.petroleo.baixo));
    } else if (preco <= LIMIARES.petroleo.alto) {
      return lerp(60, 35, (preco - LIMIARES.petroleo.neutro) / (LIMIARES.petroleo.alto - LIMIARES.petroleo.neutro));
    } else {
      return Math.max(15, 35 - (preco - LIMIARES.petroleo.alto) * 0.5);
    }
  }

  /**
   * Calcula score de liquidez global
   * Expansão de liquidez → positivo para ativos de risco
   */
  function calcularScoreLiquidez(m2Variacao) {
    if (m2Variacao <= LIMIARES.liquidezGlobal.contracao) {
      return Math.max(10, 25 + m2Variacao * 3);
    } else if (m2Variacao <= LIMIARES.liquidezGlobal.neutra) {
      return lerp(40, 55, (m2Variacao - LIMIARES.liquidezGlobal.contracao) / (LIMIARES.liquidezGlobal.neutra - LIMIARES.liquidezGlobal.contracao));
    } else if (m2Variacao <= LIMIARES.liquidezGlobal.expansao) {
      return lerp(55, 80, (m2Variacao - LIMIARES.liquidezGlobal.neutra) / (LIMIARES.liquidezGlobal.expansao - LIMIARES.liquidezGlobal.neutra));
    } else {
      return Math.min(90, 80 + (m2Variacao - LIMIARES.liquidezGlobal.expansao) * 1.5);
    }
  }

  /**
   * Determina o ambiente macroeconômico predominante
   */
  function determinarAmbiente(scores, dados) {
    const { juros, inflacao, riscoFiscal, dxy, treasuries, petroleo, liquidez } = scores;
    const mediaGeral = (juros + inflacao + riscoFiscal + dxy + treasuries + petroleo + liquidez) / 7;

    // Inflação elevada + juros altos → inflacionário
    if (dados.ipca > LIMIARES.ipca.alerta && dados.selic > LIMIARES.selic.neutro) {
      return 'inflacionário';
    }

    // Juros caindo + liquidez expandindo → expansionista
    if (juros > 65 && liquidez > 60) {
      return 'expansionista';
    }

    // Juros subindo + liquidez contraindo + DXY forte → recessivo
    if (juros < 35 && liquidez < 40 && dxy < 35) {
      return 'recessivo';
    }

    // DXY fraco + Treasuries baixas + liquidez expandindo → risk-on
    if (dxy > 60 && treasuries > 55 && liquidez > 55) {
      return 'risk-on';
    }

    // DXY forte + VIX alto (via treasuries subindo) + risco fiscal elevado → risk-off
    if (dxy < 35 && riscoFiscal < 40) {
      return 'risk-off';
    }

    // Se nenhum padrão claro
    if (mediaGeral >= 45 && mediaGeral <= 60) {
      return 'neutro';
    }

    return mediaGeral > 60 ? 'risk-on' : 'risk-off';
  }

  /**
   * Determina a direção macro para ativos brasileiros
   */
  function determinarDirecao(scoreGeral, ambiente) {
    if (ambiente === 'risk-on' || ambiente === 'expansionista') {
      return scoreGeral > 55 ? 'alta' : 'neutro';
    }
    if (ambiente === 'risk-off' || ambiente === 'recessivo') {
      return scoreGeral < 45 ? 'baixa' : 'neutro';
    }
    if (ambiente === 'inflacionário') {
      return scoreGeral < 40 ? 'baixa' : 'neutro';
    }
    // Neutro
    if (scoreGeral > 60) return 'alta';
    if (scoreGeral < 40) return 'baixa';
    return 'neutro';
  }

  /**
   * Determina o nível de risco macro
   */
  function determinarRisco(scoreGeral, ambiente, riscoFiscal) {
    if (ambiente === 'recessivo' || riscoFiscal < 25) return 'extremo';
    if (ambiente === 'risk-off' || ambiente === 'inflacionário' || scoreGeral < 30) return 'alto';
    if (ambiente === 'neutro' || (scoreGeral >= 30 && scoreGeral < 55)) return 'moderado';
    return 'baixo';
  }

  /**
   * Gera interpretação textual profissional em PT-BR
   */
  function gerarInterpretacao(scores, ambiente, direcao, scoreGeral, dados) {
    const partes = [];

    // Abertura com ambiente
    const descAmbiente = {
      'risk-on': 'O ambiente macroeconômico global favorece a tomada de risco',
      'risk-off': 'O cenário macroeconômico indica aversão a risco nos mercados globais',
      'neutro': 'O cenário macro apresenta sinais mistos, sem viés predominante claro',
      'inflacionário': 'Pressões inflacionárias dominam o cenário macroeconômico atual',
      'recessivo': 'Indicadores macroeconômicos apontam para desaceleração econômica',
      'expansionista': 'O ciclo econômico mostra sinais de expansão e afrouxamento monetário'
    };
    partes.push(descAmbiente[ambiente] || 'Cenário macroeconômico em transição.');

    // Juros
    if (dados.selic > LIMIARES.selic.restritivo) {
      partes.push(`SELIC em ${dados.selic.toFixed(2)}% mantém política monetária restritiva, pressionando ativos de risco.`);
    } else if (dados.selic < LIMIARES.selic.expansionista) {
      partes.push(`SELIC em ${dados.selic.toFixed(2)}% configura ambiente expansionista, favorecendo bolsa.`);
    }

    // DXY
    if (scores.dxy < 35) {
      partes.push(`DXY em ${dados.dxy.toFixed(1)} indica dólar globalmente forte, pressionando moedas emergentes.`);
    } else if (scores.dxy > 65) {
      partes.push(`DXY em ${dados.dxy.toFixed(1)} mostra enfraquecimento do dólar, favorecendo fluxo para emergentes.`);
    }

    // Risco fiscal
    if (scores.riscoFiscal < 30) {
      partes.push(`CDS Brasil em ${dados.cdsBrasil}bps sinaliza deterioração da percepção fiscal.`);
    } else if (scores.riscoFiscal > 70) {
      partes.push('Percepção de risco fiscal controlada, sustentando confiança nos ativos locais.');
    }

    // Liquidez
    if (scores.liquidez > 65) {
      partes.push('Liquidez global em expansão favorece fluxo para mercados emergentes.');
    } else if (scores.liquidez < 35) {
      partes.push('Contração de liquidez global reduz apetite por ativos de risco em emergentes.');
    }

    // Petróleo
    if (dados.petroleo > LIMIARES.petroleo.alto) {
      partes.push(`Petróleo acima de USD ${dados.petroleo.toFixed(0)} adiciona pressão inflacionária.`);
    }

    // Direção final
    if (direcao === 'alta') {
      partes.push(`Probabilidade macro favorece viés de alta para ativos brasileiros (score: ${scoreGeral.toFixed(0)}/100).`);
    } else if (direcao === 'baixa') {
      partes.push(`Cenário macro desfavorável para ativos brasileiros no curto prazo (score: ${scoreGeral.toFixed(0)}/100).`);
    } else {
      partes.push(`Macro sem viés direcional definido — prudência recomendada (score: ${scoreGeral.toFixed(0)}/100).`);
    }

    return partes.join(' ');
  }

  // ─── Função Principal de Análise ──────────────────────────────

  /**
   * Analisa dados macroeconômicos e retorna avaliação completa
   * @param {Object} marketData - Dados de mercado com propriedade .macro
   * @returns {Object} Resultado padronizado do agente
   */
  function analyze(marketData) {
    // Extrai dados macro com valores padrão seguros
    const macro = (marketData && marketData.macro) || {};

    const dados = {
      selic: typeof macro.selic === 'number' ? macro.selic : 13.25,
      fedFunds: typeof macro.fedFunds === 'number' ? macro.fedFunds : 5.25,
      ipca: typeof macro.ipca === 'number' ? macro.ipca : 4.5,
      cpi: typeof macro.cpi === 'number' ? macro.cpi : 3.4,
      dxy: typeof macro.dxy === 'number' ? macro.dxy : 104.5,
      treasuries10y: typeof macro.treasuries10y === 'number' ? macro.treasuries10y : 4.3,
      petroleo: typeof macro.petroleo === 'number' ? macro.petroleo : 78,
      cdsBrasil: typeof macro.cdsBrasil === 'number' ? macro.cdsBrasil : 160,
      liquidezGlobal: typeof macro.liquidezGlobal === 'number' ? macro.liquidezGlobal : 2.5
    };

    // Calcula scores individuais
    const scores = {
      juros: calcularScoreJuros(dados.selic, dados.fedFunds),
      inflacao: calcularScoreInflacao(dados.ipca, dados.cpi),
      riscoFiscal: calcularScoreRiscoFiscal(dados.cdsBrasil),
      dxy: calcularScoreDXY(dados.dxy),
      treasuries: calcularScoreTreasuries(dados.treasuries10y),
      petroleo: calcularScorePetroleo(dados.petroleo),
      liquidez: calcularScoreLiquidez(dados.liquidezGlobal)
    };

    // Score geral ponderado
    // Pesos: Juros 25%, Inflação 15%, Risco Fiscal 15%, DXY 15%, Treasuries 10%, Petróleo 10%, Liquidez 10%
    const scoreGeral =
      scores.juros * 0.25 +
      scores.inflacao * 0.15 +
      scores.riscoFiscal * 0.15 +
      scores.dxy * 0.15 +
      scores.treasuries * 0.10 +
      scores.petroleo * 0.10 +
      scores.liquidez * 0.10;

    // Determina ambiente, direção e risco
    const ambiente = determinarAmbiente(scores, dados);
    const direcao = determinarDirecao(scoreGeral, ambiente);
    const risco = determinarRisco(scoreGeral, ambiente, scores.riscoFiscal);

    // Confiança: depende de quantos fatores convergem
    const valoresScores = Object.values(scores);
    const acima55 = valoresScores.filter(s => s > 55).length;
    const abaixo45 = valoresScores.filter(s => s < 45).length;
    const convergencia = Math.max(acima55, abaixo45) / valoresScores.length;
    const confianca = Math.round(Math.min(90, Math.max(20, convergencia * 100 + (Math.abs(scoreGeral - 50) * 0.5))));

    // Interpretação textual
    const interpretacao = gerarInterpretacao(scores, ambiente, direcao, scoreGeral, dados);

    return {
      nome: NOME_AGENTE,
      score: Math.round(Math.max(0, Math.min(100, scoreGeral))),
      direcao: direcao,
      confianca: confianca,
      interpretacao: interpretacao,
      risco: risco,
      peso: PESO_AGENTE,
      // Dados extras para uso pelo motor de consenso
      _detalhes: {
        ambiente: ambiente,
        scores: scores,
        dadosUtilizados: dados
      }
    };
  }

  // ─── Exportação Global ────────────────────────────────────────
  window.BRDOLWINAgentMacro = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE})`);

})();
