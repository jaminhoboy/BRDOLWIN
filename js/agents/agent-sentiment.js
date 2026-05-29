/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente de Sentimento (agent-sentiment.js)       ║
 * ║  Peso na hierarquia: 3                                      ║
 * ║  Detecta: Medo vs Euforia, Sentimento Institucional,       ║
 * ║  Sentimento Varejo (contrário), Polarização                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  const PESO_AGENTE = 3;
  const NOME_AGENTE = 'Agente de Sentimento';

  // ─── Limiares de Sentimento ───────────────────────────────────

  const LIMIARES = {
    // Escala de medo/euforia (0 = medo extremo, 100 = euforia extrema)
    medoEuforia: {
      medoExtremo: 15,
      medo: 30,
      neutroInferior: 40,
      neutroSuperior: 60,
      euforia: 70,
      euforiaExtrema: 85
    },
    // Polarização — quanto do mercado está de um mesmo lado
    polarizacao: {
      baixa: 55,
      moderada: 65,
      alta: 75,
      extrema: 85
    },
    // Proporção put/call
    putCall: {
      medoExtremo: 1.3,    // Muitas puts → medo
      medo: 1.1,
      neutro: 0.85,
      euforia: 0.65,
      euforiaExtrema: 0.50  // Poucas puts → complacência
    }
  };

  // ─── Análise de Medo vs Euforia ───────────────────────────────

  /**
   * Avalia o nível de medo vs euforia do mercado
   * Combina múltiplos indicadores para formar um termômetro
   * @param {Object} dados - Indicadores de sentimento
   * @returns {Object} { nivel, score, descricao }
   */
  function analisarMedoEuforia(dados) {
    const indicadores = [];
    let pesoTotal = 0;
    let scoreTotal = 0;

    // 1. Put/Call Ratio
    if (typeof dados.putCallRatio === 'number') {
      let scorePutCall;
      const pcr = dados.putCallRatio;

      if (pcr >= LIMIARES.putCall.medoExtremo) {
        scorePutCall = 10;
      } else if (pcr >= LIMIARES.putCall.medo) {
        scorePutCall = 25;
      } else if (pcr >= LIMIARES.putCall.neutro) {
        scorePutCall = 50;
      } else if (pcr >= LIMIARES.putCall.euforia) {
        scorePutCall = 75;
      } else {
        scorePutCall = 90;
      }

      indicadores.push({ nome: 'Put/Call Ratio', score: scorePutCall, peso: 0.25 });
      scoreTotal += scorePutCall * 0.25;
      pesoTotal += 0.25;
    }

    // 2. Índice de medo/ganância (se fornecido diretamente)
    if (typeof dados.indiceMedoGanancia === 'number') {
      const img = Math.max(0, Math.min(100, dados.indiceMedoGanancia));
      indicadores.push({ nome: 'Índice Medo/Ganância', score: img, peso: 0.30 });
      scoreTotal += img * 0.30;
      pesoTotal += 0.30;
    }

    // 3. Variação de volume (volume spike → medo se queda, euforia se alta)
    if (typeof dados.volumeRelativoMedia === 'number' && typeof dados.direcaoPreco === 'string') {
      let scoreVol;
      const volRel = dados.volumeRelativoMedia;

      if (volRel > 2.0 && dados.direcaoPreco === 'baixa') {
        scoreVol = 15; // Volume alto com queda → pânico
      } else if (volRel > 2.0 && dados.direcaoPreco === 'alta') {
        scoreVol = 80; // Volume alto com alta → euforia
      } else if (volRel > 1.5) {
        scoreVol = dados.direcaoPreco === 'alta' ? 65 : 35;
      } else {
        scoreVol = 50;
      }

      indicadores.push({ nome: 'Volume Relativo', score: scoreVol, peso: 0.15 });
      scoreTotal += scoreVol * 0.15;
      pesoTotal += 0.15;
    }

    // 4. Breadth (avanço/declínio)
    if (typeof dados.breadth === 'number') {
      // breadth: % de ações subindo (0-100)
      const scoreBreadth = dados.breadth;
      indicadores.push({ nome: 'Market Breadth', score: scoreBreadth, peso: 0.15 });
      scoreTotal += scoreBreadth * 0.15;
      pesoTotal += 0.15;
    }

    // 5. Distância da média móvel
    if (typeof dados.distanciaMedia200 === 'number') {
      // Positivo = acima da MA200, negativo = abaixo
      let scoreDist;
      const dist = dados.distanciaMedia200;

      if (dist > 15) {
        scoreDist = 85; // Muito acima → euforia
      } else if (dist > 5) {
        scoreDist = 65;
      } else if (dist > -5) {
        scoreDist = 50;
      } else if (dist > -15) {
        scoreDist = 35;
      } else {
        scoreDist = 15; // Muito abaixo → medo
      }

      indicadores.push({ nome: 'Distância MA200', score: scoreDist, peso: 0.15 });
      scoreTotal += scoreDist * 0.15;
      pesoTotal += 0.15;
    }

    // Score final
    const scoreFinal = pesoTotal > 0 ? scoreTotal / pesoTotal : 50;

    // Determina nível
    let nivel;
    if (scoreFinal <= LIMIARES.medoEuforia.medoExtremo) nivel = 'medo extremo';
    else if (scoreFinal <= LIMIARES.medoEuforia.medo) nivel = 'medo';
    else if (scoreFinal <= LIMIARES.medoEuforia.neutroInferior) nivel = 'cauteloso';
    else if (scoreFinal <= LIMIARES.medoEuforia.neutroSuperior) nivel = 'neutro';
    else if (scoreFinal <= LIMIARES.medoEuforia.euforia) nivel = 'otimista';
    else if (scoreFinal <= LIMIARES.medoEuforia.euforiaExtrema) nivel = 'euforia';
    else nivel = 'euforia extrema';

    // Descricao
    const descNiveis = {
      'medo extremo': 'Medo extremo no mercado — historicamente, excessos de pessimismo tendem a marcar fundos relevantes. Possível oportunidade contrária.',
      'medo': 'Sentimento de medo predominante — vendedores dominando psicologicamente. Cautela, mas atenção a reversões.',
      'cauteloso': 'Mercado em modo cauteloso — sem pessimismo extremo, mas participantes defensivos.',
      'neutro': 'Sentimento neutro — sem viés emocional extremo no mercado.',
      'otimista': 'Otimismo moderado — participantes confiantes, mas sem exagero.',
      'euforia': 'Euforia no mercado — excesso de confiança pode preceder correções.',
      'euforia extrema': 'Euforia extrema — historicamente, excessos de otimismo antecedem tops relevantes. Risco elevado de reversão.'
    };

    return {
      nivel: nivel,
      score: Math.round(scoreFinal),
      indicadores: indicadores,
      descricao: descNiveis[nivel]
    };
  }

  // ─── Sentimento Institucional (via Fluxo) ─────────────────────

  /**
   * Extrai sentimento institucional a partir de dados de fluxo
   * @param {Object} fluxoInstitucional - Dados de posicionamento institucional
   */
  function analisarSentimentoInstitucional(fluxoInstitucional) {
    if (!fluxoInstitucional) {
      return {
        score: 50,
        posicionamento: 'indefinido',
        descricao: 'Dados de posicionamento institucional não disponíveis.'
      };
    }

    const saldo = typeof fluxoInstitucional.saldoLiquido === 'number'
      ? fluxoInstitucional.saldoLiquido : 0;

    const posEstrangeiro = typeof fluxoInstitucional.fluxoEstrangeiro === 'number'
      ? fluxoInstitucional.fluxoEstrangeiro : 0;

    const posFundos = typeof fluxoInstitucional.posicaoFundos === 'number'
      ? fluxoInstitucional.posicaoFundos : 50;

    // Score composto
    let score = 50;
    const observacoes = [];

    // Saldo líquido institucional
    if (saldo > 500) {
      score += 20;
      observacoes.push(`Saldo líquido institucional positivo (R$${(saldo / 1e6).toFixed(0)}M) — acumulação.`);
    } else if (saldo > 100) {
      score += 10;
      observacoes.push('Fluxo institucional levemente comprador.');
    } else if (saldo < -500) {
      score -= 20;
      observacoes.push(`Saldo líquido institucional negativo (R$${(saldo / 1e6).toFixed(0)}M) — distribuição.`);
    } else if (saldo < -100) {
      score -= 10;
      observacoes.push('Fluxo institucional levemente vendedor.');
    }

    // Fluxo estrangeiro
    if (posEstrangeiro > 300) {
      score += 12;
      observacoes.push('Fluxo estrangeiro entrando — suporte para o mercado.');
    } else if (posEstrangeiro < -300) {
      score -= 12;
      observacoes.push('Fluxo estrangeiro saindo — pressão vendedora externa.');
    }

    // Posição de fundos locais (0 = muito vendido, 100 = muito comprado)
    if (posFundos > 75) {
      score += 5;
      observacoes.push('Fundos locais altamente posicionados — atenção ao potencial de realização.');
    } else if (posFundos < 25) {
      score -= 5;
      observacoes.push('Fundos locais desalocados — potencial de reentrada.');
    }

    score = Math.max(10, Math.min(90, score));

    let posicionamento;
    if (score > 65) posicionamento = 'comprador';
    else if (score < 35) posicionamento = 'vendedor';
    else posicionamento = 'neutro';

    return {
      score: Math.round(score),
      posicionamento: posicionamento,
      descricao: observacoes.length > 0
        ? 'Sentimento institucional: ' + observacoes.join(' ')
        : 'Sentimento institucional: sem sinal direcional claro.'
    };
  }

  // ─── Sentimento Varejo (Contrário) ────────────────────────────

  /**
   * Analisa sentimento varejo — usado como INDICADOR CONTRÁRIO
   * Quando varejo está muito de um lado, probabilidade de reversão aumenta
   * @param {Object} dadosVarejo - { percentualComprado, volumeVarejoRelativo, pesquisasGoogle }
   */
  function analisarSentimentoVarejo(dadosVarejo) {
    if (!dadosVarejo) {
      return {
        score: 50,
        sinalContrario: false,
        descricao: 'Dados de sentimento varejo não disponíveis.'
      };
    }

    const pctComprado = typeof dadosVarejo.percentualComprado === 'number'
      ? dadosVarejo.percentualComprado : 50;
    const volumeRelativo = typeof dadosVarejo.volumeVarejoRelativo === 'number'
      ? dadosVarejo.volumeVarejoRelativo : 1.0;

    let score;
    let sinalContrario = false;
    let descricao;

    // Indicador contrário: quando varejo está extremamente posicionado, é sinal oposto
    if (pctComprado > 80) {
      // Varejo muito comprado → sinal contrário de baixa
      score = 30;
      sinalContrario = true;
      descricao = `Varejo extremamente comprado (${pctComprado}%) — indicador contrário sugere cautela com posições de alta. Historicamente, excesso de compra varejo antecede correções.`;
    } else if (pctComprado > 65) {
      score = 40;
      descricao = `Varejo predominantemente comprado (${pctComprado}%) — sentimento otimista no varejo.`;
    } else if (pctComprado < 20) {
      // Varejo muito vendido → sinal contrário de alta
      score = 70;
      sinalContrario = true;
      descricao = `Varejo extremamente vendido (${pctComprado}% comprado) — indicador contrário sugere possível fundo. Capitulação do varejo pode marcar oportunidade.`;
    } else if (pctComprado < 35) {
      score = 60;
      descricao = `Varejo predominantemente vendido (${pctComprado}% comprado) — pessimismo no varejo pode ser oportunidade.`;
    } else {
      score = 50;
      descricao = `Sentimento varejo equilibrado (${pctComprado}% comprado) — sem extremo contrário.`;
    }

    // Volume de varejo elevado amplifica o sinal
    if (volumeRelativo > 2.0 && sinalContrario) {
      score = score > 50 ? Math.min(85, score + 10) : Math.max(15, score - 10);
      descricao += ` Volume de varejo ${volumeRelativo.toFixed(1)}x acima da média amplifica o sinal contrário.`;
    }

    return {
      score: Math.round(score),
      sinalContrario: sinalContrario,
      percentualComprado: pctComprado,
      descricao: descricao
    };
  }

  // ─── Polarização de Mercado ───────────────────────────────────

  /**
   * Avalia polarização — quando o mercado está muito de um lado
   * @param {Object} polarizacao - { ladoDominante, percentual }
   */
  function analisarPolarizacao(polarizacao) {
    if (!polarizacao || typeof polarizacao.percentual !== 'number') {
      return {
        score: 50,
        nivel: 'normal',
        descricao: 'Dados de polarização de mercado não disponíveis.'
      };
    }

    const pct = polarizacao.percentual;
    const lado = polarizacao.ladoDominante || 'indefinido';

    let nivel;
    let descricao;
    let riscoPolarizacao;

    if (pct >= LIMIARES.polarizacao.extrema) {
      nivel = 'extrema';
      riscoPolarizacao = 'extremo';
      descricao = `Polarização extrema: ${pct}% do mercado no lado ${lado}. Risco de movimento violento contrário — desbalanceamento perigoso.`;
    } else if (pct >= LIMIARES.polarizacao.alta) {
      nivel = 'alta';
      riscoPolarizacao = 'alto';
      descricao = `Polarização alta: ${pct}% posicionado no lado ${lado}. Atenção a liquidações forçadas em movimento contrário.`;
    } else if (pct >= LIMIARES.polarizacao.moderada) {
      nivel = 'moderada';
      riscoPolarizacao = 'moderado';
      descricao = `Polarização moderada: ${pct}% no lado ${lado}. Viés presente, mas sem extremo perigoso.`;
    } else {
      nivel = 'normal';
      riscoPolarizacao = 'baixo';
      descricao = `Posicionamento equilibrado: ${pct}% no lado dominante. Mercado sem polarização excessiva.`;
    }

    // Score — polarização extrema reduz qualidade operacional
    let score;
    if (nivel === 'extrema') {
      score = lado === 'compra' ? 30 : 70; // Contrário ao excesso
    } else if (nivel === 'alta') {
      score = lado === 'compra' ? 40 : 60;
    } else {
      score = 50;
    }

    return {
      score: Math.round(score),
      nivel: nivel,
      ladoDominante: lado,
      riscoPolarizacao: riscoPolarizacao,
      descricao: descricao
    };
  }

  // ─── Função Principal ─────────────────────────────────────────

  function analyze(marketData) {
    const sentimento = (marketData && marketData.sentimento) || {};

    // Executa cada componente
    const resultMedoEuforia = analisarMedoEuforia(sentimento);
    const resultInstitucional = analisarSentimentoInstitucional(sentimento.fluxoInstitucional);
    const resultVarejo = analisarSentimentoVarejo(sentimento.varejo);
    const resultPolarizacao = analisarPolarizacao(sentimento.polarizacao);

    // Score composto
    // Institucional tem mais peso que varejo (varejo é contrário)
    const scoreGeral =
      resultMedoEuforia.score * 0.30 +
      resultInstitucional.score * 0.35 +
      resultVarejo.score * 0.20 +
      resultPolarizacao.score * 0.15;

    // Direção
    let direcao;
    if (scoreGeral > 58) direcao = 'alta';
    else if (scoreGeral < 42) direcao = 'baixa';
    else direcao = 'neutro';

    // Confiança — sentimento é subjetivo, limitar confiança
    const maxConfiancaSentimento = 72;
    let confianca = Math.round(Math.min(maxConfiancaSentimento, Math.max(15,
      Math.abs(scoreGeral - 50) * 1.2 + 20
    )));

    // Se há sinal contrário do varejo, isso adiciona convicção
    if (resultVarejo.sinalContrario) {
      confianca = Math.min(maxConfiancaSentimento, confianca + 8);
    }

    // Risco
    let risco;
    if (resultPolarizacao.nivel === 'extrema' || resultMedoEuforia.nivel === 'euforia extrema' || resultMedoEuforia.nivel === 'medo extremo') {
      risco = 'extremo';
    } else if (resultPolarizacao.nivel === 'alta' || resultMedoEuforia.nivel === 'euforia' || resultMedoEuforia.nivel === 'medo') {
      risco = 'alto';
    } else if (direcao === 'neutro' || resultPolarizacao.nivel === 'moderada') {
      risco = 'moderado';
    } else {
      risco = 'baixo';
    }

    // Interpretação composta
    const interpretacao = [
      resultMedoEuforia.descricao,
      resultInstitucional.descricao,
      resultVarejo.descricao,
      resultPolarizacao.descricao,
      `Termômetro de sentimento: ${Math.round(scoreGeral)}/100 (${direcao === 'alta' ? 'otimista' : direcao === 'baixa' ? 'pessimista' : 'neutro'}).`
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
        nivelMedoEuforia: resultMedoEuforia.nivel,
        scoreMedoEuforia: resultMedoEuforia.score,
        posicionamentoInstitucional: resultInstitucional.posicionamento,
        scoreInstitucional: resultInstitucional.score,
        sinalContrarioVarejo: resultVarejo.sinalContrario,
        scoreVarejo: resultVarejo.score,
        polarizacao: resultPolarizacao.nivel,
        scorePolarizacao: resultPolarizacao.score
      }
    };
  }

  // ─── Exportação ───────────────────────────────────────────────
  window.BRDOLWINAgentSentiment = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE})`);

})();
