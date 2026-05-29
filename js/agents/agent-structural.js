/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente Estrutural (agent-structural.js)         ║
 * ║  Peso na hierarquia: 4                                      ║
 * ║  Analisa: Wyckoff (elevado), SMC (médio), Price Action,     ║
 * ║  Elliott Wave (auxiliar), Compressão vs Expansão             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  const PESO_AGENTE = 4;
  const NOME_AGENTE = 'Agente Estrutural';

  // Pesos internos das metodologias
  const PESOS_METODOLOGIA = {
    wyckoff: 0.40,    // Peso elevado
    smc: 0.25,        // Peso médio
    priceAction: 0.20,
    elliott: 0.10,    // Auxiliar — nunca dominante
    compressao: 0.05  // Complementar
  };

  // ─── Análise Wyckoff ──────────────────────────────────────────

  /**
   * Analisa fase de Wyckoff
   * @param {Object} wyckoff - Dados de análise Wyckoff
   * @returns {Object} { score, fase, descricao }
   */
  function analisarWyckoff(wyckoff) {
    if (!wyckoff || !wyckoff.fase) {
      return { score: 50, fase: 'indefinida', descricao: 'Sem dados Wyckoff disponíveis.' };
    }

    const fases = {
      // Fases de acumulação — bullish
      'acumulacao_fase_a': {
        score: 55,
        descricao: 'Wyckoff Fase A de acumulação — selling climax possível, parada da tendência de baixa.'
      },
      'acumulacao_fase_b': {
        score: 52,
        descricao: 'Wyckoff Fase B — construção de causa, testing de oferta e demanda no range.'
      },
      'acumulacao_fase_c': {
        score: 60,
        descricao: 'Wyckoff Fase C — possível spring/shakeout, teste final da oferta.'
      },
      'spring': {
        score: 78,
        descricao: 'Spring de Wyckoff detectado — armadilha de venda com rápida recuperação, alta probabilidade de markup.'
      },
      'acumulacao_fase_d': {
        score: 72,
        descricao: 'Wyckoff Fase D — SOS (Sign of Strength) confirmado, demanda superando oferta.'
      },
      'acumulacao_fase_e': {
        score: 75,
        descricao: 'Wyckoff Fase E — início do markup, saída do range de acumulação.'
      },
      'markup': {
        score: 80,
        descricao: 'Fase de Markup ativa — tendência de alta em andamento pós-acumulação.'
      },

      // Fases de distribuição — bearish
      'distribuicao_fase_a': {
        score: 45,
        descricao: 'Wyckoff Fase A de distribuição — buying climax possível, parada da tendência de alta.'
      },
      'distribuicao_fase_b': {
        score: 48,
        descricao: 'Wyckoff Fase B de distribuição — testes de topo, institucional distribuindo.'
      },
      'distribuicao_fase_c': {
        score: 38,
        descricao: 'Wyckoff Fase C de distribuição — possível upthrust, teste final da demanda.'
      },
      'upthrust': {
        score: 22,
        descricao: 'Upthrust de Wyckoff detectado — armadilha de compra com rejeição rápida, alta probabilidade de markdown.'
      },
      'distribuicao_fase_d': {
        score: 28,
        descricao: 'Wyckoff Fase D — LPSY (Last Point of Supply), oferta dominando.'
      },
      'distribuicao_fase_e': {
        score: 20,
        descricao: 'Wyckoff Fase E — início do markdown, saída do range de distribuição.'
      },
      'markdown': {
        score: 15,
        descricao: 'Fase de Markdown ativa — tendência de baixa em andamento pós-distribuição.'
      },

      // Fases neutras
      'range': {
        score: 50,
        descricao: 'Mercado em range de Wyckoff — sem definição entre acumulação e distribuição.'
      },
      'indefinida': {
        score: 50,
        descricao: 'Fase de Wyckoff não identificada com clareza no momento.'
      }
    };

    const faseInfo = fases[wyckoff.fase] || fases['indefinida'];

    // Aplica modificador de confiança da identificação da fase
    const confiancaFase = typeof wyckoff.confianca === 'number' ? wyckoff.confianca / 100 : 0.6;
    const scoreAjustado = 50 + (faseInfo.score - 50) * confiancaFase;

    return {
      score: scoreAjustado,
      fase: wyckoff.fase,
      descricao: faseInfo.descricao
    };
  }

  // ─── Análise SMC (Smart Money Concepts) ───────────────────────

  /**
   * Analisa estrutura SMC
   * @param {Object} smc - { bos, choch, fvg, orderBlocks }
   */
  function analisarSMC(smc) {
    if (!smc) {
      return { score: 50, elementos: [], descricao: 'Sem dados SMC disponíveis.' };
    }

    let scoreSMC = 50;
    const elementos = [];

    // BOS (Break of Structure)
    if (smc.bos) {
      if (smc.bos.direcao === 'alta') {
        scoreSMC += 12;
        elementos.push('BOS de alta confirmado');
      } else if (smc.bos.direcao === 'baixa') {
        scoreSMC -= 12;
        elementos.push('BOS de baixa confirmado');
      }
    }

    // CHoCH (Change of Character)
    if (smc.choch) {
      if (smc.choch.direcao === 'alta') {
        scoreSMC += 15;
        elementos.push('CHoCH bullish — mudança de caráter para alta');
      } else if (smc.choch.direcao === 'baixa') {
        scoreSMC -= 15;
        elementos.push('CHoCH bearish — mudança de caráter para baixa');
      }
    }

    // FVG (Fair Value Gap)
    if (smc.fvg && smc.fvg.ativa) {
      if (smc.fvg.tipo === 'bullish') {
        scoreSMC += 8;
        elementos.push(`FVG bullish em ${smc.fvg.regiao || 'região próxima'} — alvo de preenchimento acima`);
      } else if (smc.fvg.tipo === 'bearish') {
        scoreSMC -= 8;
        elementos.push(`FVG bearish em ${smc.fvg.regiao || 'região próxima'} — alvo de preenchimento abaixo`);
      }
    }

    // Order Blocks
    if (smc.orderBlocks && Array.isArray(smc.orderBlocks)) {
      smc.orderBlocks.forEach(function (ob) {
        if (ob.tipo === 'bullish' && ob.proximidade === 'proxima') {
          scoreSMC += 6;
          elementos.push(`Order Block bullish próximo em ${ob.nivel || '—'}`);
        } else if (ob.tipo === 'bearish' && ob.proximidade === 'proxima') {
          scoreSMC -= 6;
          elementos.push(`Order Block bearish próximo em ${ob.nivel || '—'}`);
        }
      });
    }

    scoreSMC = Math.max(5, Math.min(95, scoreSMC));

    const descricao = elementos.length > 0
      ? 'SMC: ' + elementos.join('; ') + '.'
      : 'SMC: nenhum elemento estrutural relevante identificado no momento.';

    return { score: scoreSMC, elementos: elementos, descricao: descricao };
  }

  // ─── Análise Price Action ─────────────────────────────────────

  /**
   * Analisa Price Action clássico
   * @param {Object} priceAction - { suportes, resistencias, padraoCandle, tendencia }
   */
  function analisarPriceAction(priceAction) {
    if (!priceAction) {
      return { score: 50, descricao: 'Sem dados de Price Action disponíveis.' };
    }

    let scorePA = 50;
    const observacoes = [];

    // Proximidade a suportes/resistências
    if (priceAction.proximidadeSuporte && priceAction.proximidadeSuporte < 0.3) {
      scorePA += 10;
      observacoes.push('Preço próximo a suporte relevante');
    }
    if (priceAction.proximidadeResistencia && priceAction.proximidadeResistencia < 0.3) {
      scorePA -= 10;
      observacoes.push('Preço próximo a resistência relevante');
    }

    // Padrões de candle
    const padroesAlta = ['martelo', 'engolfo_alta', 'estrela_matutina', 'piercing_line', 'harami_alta', 'doji_libellula'];
    const padroesBaixa = ['estrela_cadente', 'engolfo_baixa', 'estrela_vespertina', 'dark_cloud', 'harami_baixa', 'doji_lapide'];

    if (priceAction.padraoCandle) {
      if (padroesAlta.indexOf(priceAction.padraoCandle) !== -1) {
        scorePA += 12;
        observacoes.push(`Padrão de candle de alta: ${priceAction.padraoCandle.replace(/_/g, ' ')}`);
      } else if (padroesBaixa.indexOf(priceAction.padraoCandle) !== -1) {
        scorePA -= 12;
        observacoes.push(`Padrão de candle de baixa: ${priceAction.padraoCandle.replace(/_/g, ' ')}`);
      }
    }

    // Tendência atual
    if (priceAction.tendencia === 'alta') {
      scorePA += 8;
      observacoes.push('Tendência de alta confirmada por topos e fundos ascendentes');
    } else if (priceAction.tendencia === 'baixa') {
      scorePA -= 8;
      observacoes.push('Tendência de baixa confirmada por topos e fundos descendentes');
    } else if (priceAction.tendencia === 'lateral') {
      observacoes.push('Mercado lateralizado — sem tendência direcional definida');
    }

    // Rompimento
    if (priceAction.rompimento) {
      if (priceAction.rompimento.tipo === 'alta' && priceAction.rompimento.confirmado) {
        scorePA += 15;
        observacoes.push(`Rompimento de alta confirmado em ${priceAction.rompimento.nivel || '—'}`);
      } else if (priceAction.rompimento.tipo === 'baixa' && priceAction.rompimento.confirmado) {
        scorePA -= 15;
        observacoes.push(`Rompimento de baixa confirmado em ${priceAction.rompimento.nivel || '—'}`);
      } else if (priceAction.rompimento.falso) {
        // Rompimento falso → sinal contrário
        if (priceAction.rompimento.tipo === 'alta') {
          scorePA -= 10;
          observacoes.push('Falso rompimento de alta — piora perspectiva');
        } else {
          scorePA += 10;
          observacoes.push('Falso rompimento de baixa — spring possível');
        }
      }
    }

    scorePA = Math.max(5, Math.min(95, scorePA));

    const descricao = observacoes.length > 0
      ? 'Price Action: ' + observacoes.join('; ') + '.'
      : 'Price Action: sem padrões relevantes identificados.';

    return { score: scorePA, descricao: descricao };
  }

  // ─── Análise Elliott Wave ─────────────────────────────────────

  /**
   * Análise auxiliar de Elliott Wave — NUNCA dominante
   * @param {Object} elliott - { onda, grau, confianca, contagem }
   */
  function analisarElliott(elliott) {
    if (!elliott || !elliott.onda) {
      return { score: 50, descricao: 'Contagem de Elliott Wave não disponível.' };
    }

    // Score baseado na onda identificada
    const scoresPorOnda = {
      '1': 62,  // Início de impulso — moderadamente bullish
      '2': 45,  // Correção da 1 — ainda incerto
      '3': 80,  // Onda mais forte — muito bullish
      '4': 55,  // Correção da 3 — pullback saudável
      '5': 65,  // Extensão final — bullish mas exaustão possível
      'a': 35,  // Início da correção — bearish
      'b': 55,  // Rally de correção — bull trap possível
      'c': 20   // Onda final de correção — muito bearish
    };

    const scoreBase = scoresPorOnda[elliott.onda] || 50;

    // Ajusta pela confiança da contagem (Elliott é subjetivo)
    const confiancaContagem = typeof elliott.confianca === 'number' ? elliott.confianca / 100 : 0.4;
    const scoreAjustado = 50 + (scoreBase - 50) * confiancaContagem;

    const descricao = `Elliott Wave: possível onda ${elliott.onda} (grau: ${elliott.grau || 'intermediário'}, confiança: ${Math.round(confiancaContagem * 100)}%). Contagem auxiliar — não deve guiar decisão isoladamente.`;

    return { score: scoreAjustado, descricao: descricao };
  }

  // ─── Análise de Compressão vs Expansão ────────────────────────

  /**
   * Detecta estado de compressão ou expansão de volatilidade estrutural
   * @param {Object} compressao - { estado, intensidade, duracaoBars }
   */
  function analisarCompressao(compressao) {
    if (!compressao || !compressao.estado) {
      return { score: 50, descricao: 'Estado de compressão/expansão não disponível.' };
    }

    if (compressao.estado === 'compressao') {
      // Compressão → energia acumulada, breakout iminente
      const intensidade = compressao.intensidade || 50;
      return {
        score: 50, // Neutro direcional — compressão não indica lado
        descricao: `Compressão de volatilidade detectada (intensidade: ${intensidade}%, duração: ${compressao.duracaoBars || '?'} barras). Breakout iminente — atenção redobrada ao rompimento.`
      };
    } else if (compressao.estado === 'expansao') {
      return {
        score: 50,
        descricao: 'Mercado em expansão de volatilidade — movimento direcional em andamento.'
      };
    } else {
      return {
        score: 50,
        descricao: 'Volatilidade estrutural em padrão normal.'
      };
    }
  }

  // ─── Função Principal ─────────────────────────────────────────

  function analyze(marketData) {
    const estrutural = (marketData && marketData.estrutural) || {};

    // Executa cada metodologia
    const resultWyckoff = analisarWyckoff(estrutural.wyckoff);
    const resultSMC = analisarSMC(estrutural.smc);
    const resultPA = analisarPriceAction(estrutural.priceAction);
    const resultElliott = analisarElliott(estrutural.elliott);
    const resultCompressao = analisarCompressao(estrutural.compressao);

    // Score composto ponderado (Elliott NUNCA dominante)
    const scoreGeral =
      resultWyckoff.score * PESOS_METODOLOGIA.wyckoff +
      resultSMC.score * PESOS_METODOLOGIA.smc +
      resultPA.score * PESOS_METODOLOGIA.priceAction +
      resultElliott.score * PESOS_METODOLOGIA.elliott +
      resultCompressao.score * PESOS_METODOLOGIA.compressao;

    // Direção
    let direcao;
    if (scoreGeral > 58) direcao = 'alta';
    else if (scoreGeral < 42) direcao = 'baixa';
    else direcao = 'neutro';

    // Confiança — baseada na convergência das metodologias
    const scoresMetodologias = [resultWyckoff.score, resultSMC.score, resultPA.score];
    const mediaMetodo = scoresMetodologias.reduce(function (a, b) { return a + b; }, 0) / scoresMetodologias.length;
    const variancia = scoresMetodologias.reduce(function (soma, s) { return soma + Math.pow(s - mediaMetodo, 2); }, 0) / scoresMetodologias.length;
    const desvio = Math.sqrt(variancia);

    let confianca = Math.round(Math.max(20, Math.min(85, 80 - desvio * 1.8)));

    // Se Wyckoff e SMC convergem, aumenta confiança
    if ((resultWyckoff.score > 60 && resultSMC.score > 60) || (resultWyckoff.score < 40 && resultSMC.score < 40)) {
      confianca = Math.min(90, confianca + 10);
    }

    // Risco
    let risco;
    if (desvio > 25) risco = 'alto';
    else if (desvio > 15 || direcao === 'neutro') risco = 'moderado';
    else risco = 'baixo';

    // Se em compressão, eleva o risco (breakout incerto)
    if (estrutural.compressao && estrutural.compressao.estado === 'compressao') {
      risco = risco === 'baixo' ? 'moderado' : risco === 'moderado' ? 'alto' : risco;
    }

    // Interpretação composta
    const interpretacao = [
      resultWyckoff.descricao,
      resultSMC.descricao,
      resultPA.descricao,
      resultElliott.descricao,
      resultCompressao.descricao,
      `Score estrutural consolidado: ${Math.round(scoreGeral)}/100.`
    ].join(' ');

    return {
      nome: NOME_AGENTE,
      score: Math.round(Math.max(0, Math.min(100, scoreGeral))),
      direcao: direcao,
      confianca: confianca,
      interpretacao: interpretacao,
      risco: risco,
      peso: PESO_AGENTE,
      _detalhes: {
        wyckoff: { score: Math.round(resultWyckoff.score), fase: resultWyckoff.fase },
        smc: { score: Math.round(resultSMC.score), elementos: resultSMC.elementos },
        priceAction: Math.round(resultPA.score),
        elliott: Math.round(resultElliott.score),
        compressao: estrutural.compressao ? estrutural.compressao.estado : 'normal'
      }
    };
  }

  // ─── Exportação ───────────────────────────────────────────────
  window.BRDOLWINAgentStructural = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE})`);

})();
