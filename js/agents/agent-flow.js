/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente de Fluxo Institucional (agent-flow.js)   ║
 * ║  Peso na hierarquia: 10 (MÁXIMO)                            ║
 * ║  Analisa: Agressão, Delta, Absorção, Spoofing, Iceberg,    ║
 * ║  Volume Profile, Defesa Institucional                       ║
 * ║  Pergunta central: "O institucional está acumulando ou      ║
 * ║  distribuindo?"                                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  // ─── Constantes ────────────────────────────────────────────────
  const PESO_AGENTE = 10;
  const NOME_AGENTE = 'Agente de Fluxo Institucional';

  // Limiares de referência para fluxo
  const LIMIARES_FLUXO = {
    // Razão agressão compradora / vendedora
    agressao: {
      compraDominante: 1.35,   // >1.35 → compra dominando
      vendaDominante: 0.72,    // <0.72 → venda dominando
      equilibrio: { min: 0.85, max: 1.15 }
    },
    // Delta acumulado (valor normalizado -100 a +100)
    delta: {
      forteCompra: 60,
      moderadoCompra: 30,
      moderadoVenda: -30,
      forteVenda: -60
    },
    // Taxa de absorção (% de ordens absorvidas vs agressivas)
    absorcao: {
      alta: 70,       // Absorção forte — institucional segurando preço
      moderada: 40,
      baixa: 20
    },
    // Quantidade de spoofing detectado (0 a 100 normalizado)
    spoofing: {
      nenhum: 10,
      moderado: 40,
      alto: 70
    },
    // Volume no POC (Point of Control) — concentração %
    volumeProfile: {
      concentrado: 35,  // >35% do volume no POC → preço justo encontrado
      disperso: 15      // <15% → mercado em busca de valor
    }
  };

  // ─── Funções de Análise de Fluxo ──────────────────────────────

  /**
   * Analisa a razão de agressão compradora vs vendedora
   * Retorna score de 0-100 onde:
   * 100 = agressão compradora dominante total
   * 0 = agressão vendedora dominante total
   * 50 = equilíbrio
   */
  function analisarAgressao(agressaoCompradora, agressaoVendedora) {
    if (!agressaoVendedora || agressaoVendedora === 0) {
      return agressaoCompradora > 0 ? 90 : 50;
    }

    const razao = agressaoCompradora / agressaoVendedora;

    if (razao >= LIMIARES_FLUXO.agressao.compraDominante) {
      // Compra dominante — mapear para 70-95
      const intensidade = Math.min(1, (razao - LIMIARES_FLUXO.agressao.compraDominante) / 0.65);
      return 70 + intensidade * 25;
    } else if (razao <= LIMIARES_FLUXO.agressao.vendaDominante) {
      // Venda dominante — mapear para 5-30
      const intensidade = Math.min(1, (LIMIARES_FLUXO.agressao.vendaDominante - razao) / 0.40);
      return 30 - intensidade * 25;
    } else if (razao >= LIMIARES_FLUXO.agressao.equilibrio.min && razao <= LIMIARES_FLUXO.agressao.equilibrio.max) {
      // Equilíbrio — 45-55
      return 45 + ((razao - LIMIARES_FLUXO.agressao.equilibrio.min) /
        (LIMIARES_FLUXO.agressao.equilibrio.max - LIMIARES_FLUXO.agressao.equilibrio.min)) * 10;
    } else if (razao > LIMIARES_FLUXO.agressao.equilibrio.max) {
      // Leve compra — 55-70
      return 55 + ((razao - LIMIARES_FLUXO.agressao.equilibrio.max) /
        (LIMIARES_FLUXO.agressao.compraDominante - LIMIARES_FLUXO.agressao.equilibrio.max)) * 15;
    } else {
      // Leve venda — 30-45
      return 30 + ((razao - LIMIARES_FLUXO.agressao.vendaDominante) /
        (LIMIARES_FLUXO.agressao.equilibrio.min - LIMIARES_FLUXO.agressao.vendaDominante)) * 15;
    }
  }

  /**
   * Analisa o delta acumulado (diferença entre compras e vendas agressivas)
   * @param {number} delta - Valor normalizado de -100 a +100
   */
  function analisarDelta(delta) {
    // Normaliza delta para score 0-100
    if (delta >= LIMIARES_FLUXO.delta.forteCompra) {
      const intensidade = Math.min(1, (delta - LIMIARES_FLUXO.delta.forteCompra) / 40);
      return 78 + intensidade * 17;
    } else if (delta >= LIMIARES_FLUXO.delta.moderadoCompra) {
      return 58 + ((delta - LIMIARES_FLUXO.delta.moderadoCompra) /
        (LIMIARES_FLUXO.delta.forteCompra - LIMIARES_FLUXO.delta.moderadoCompra)) * 20;
    } else if (delta >= LIMIARES_FLUXO.delta.moderadoVenda) {
      // Zona neutra
      return 42 + ((delta - LIMIARES_FLUXO.delta.moderadoVenda) /
        (LIMIARES_FLUXO.delta.moderadoCompra - LIMIARES_FLUXO.delta.moderadoVenda)) * 16;
    } else if (delta >= LIMIARES_FLUXO.delta.forteVenda) {
      return 22 + ((delta - LIMIARES_FLUXO.delta.forteVenda) /
        (LIMIARES_FLUXO.delta.moderadoVenda - LIMIARES_FLUXO.delta.forteVenda)) * 20;
    } else {
      const intensidade = Math.min(1, (LIMIARES_FLUXO.delta.forteVenda - delta) / 40);
      return Math.max(5, 22 - intensidade * 17);
    }
  }

  /**
   * Analisa absorção de ordens
   * Absorção alta na compra com preço não caindo → acumulação
   * Absorção alta na venda com preço não subindo → distribuição
   * @param {number} taxaAbsorcao - 0 a 100
   * @param {string} ladoAbsorcao - 'compra' | 'venda' | 'equilibrio'
   */
  function analisarAbsorcao(taxaAbsorcao, ladoAbsorcao) {
    const resultado = { score: 50, tipo: 'indefinido' };

    if (taxaAbsorcao >= LIMIARES_FLUXO.absorcao.alta) {
      if (ladoAbsorcao === 'compra') {
        resultado.score = 75 + ((taxaAbsorcao - LIMIARES_FLUXO.absorcao.alta) / 30) * 15;
        resultado.tipo = 'acumulação';
      } else if (ladoAbsorcao === 'venda') {
        resultado.score = 25 - ((taxaAbsorcao - LIMIARES_FLUXO.absorcao.alta) / 30) * 15;
        resultado.tipo = 'distribuição';
      } else {
        resultado.score = 50;
        resultado.tipo = 'defesa bilateral';
      }
    } else if (taxaAbsorcao >= LIMIARES_FLUXO.absorcao.moderada) {
      if (ladoAbsorcao === 'compra') {
        resultado.score = 58;
        resultado.tipo = 'acumulação leve';
      } else if (ladoAbsorcao === 'venda') {
        resultado.score = 42;
        resultado.tipo = 'distribuição leve';
      } else {
        resultado.score = 50;
        resultado.tipo = 'fluxo misto';
      }
    } else {
      resultado.score = 50;
      resultado.tipo = 'sem absorção relevante';
    }

    resultado.score = Math.max(5, Math.min(95, resultado.score));
    return resultado;
  }

  /**
   * Avalia impacto do spoofing detectado
   * Spoofing alto → reduz confiança do fluxo observado
   * @param {number} nivelSpoofing - 0 a 100
   */
  function avaliarSpoofing(nivelSpoofing) {
    if (nivelSpoofing >= LIMIARES_FLUXO.spoofing.alto) {
      return {
        penalidade: 25,
        alerta: 'Nível elevado de spoofing detectado — fluxo aparente pode ser manipulado.',
        confiavel: false
      };
    } else if (nivelSpoofing >= LIMIARES_FLUXO.spoofing.moderado) {
      return {
        penalidade: 12,
        alerta: 'Atividade moderada de spoofing identificada — cautela no fluxo.',
        confiavel: true
      };
    } else {
      return {
        penalidade: 0,
        alerta: null,
        confiavel: true
      };
    }
  }

  /**
   * Analisa presença de iceberg orders
   * @param {number} icebergDetectado - 0 a 100 (nível de confiança da detecção)
   * @param {string} ladoIceberg - 'compra' | 'venda' | 'ambos'
   */
  function analisarIceberg(icebergDetectado, ladoIceberg) {
    if (icebergDetectado < 20) {
      return { impacto: 0, descricao: 'Sem iceberg orders relevantes detectadas.' };
    }

    const impactoBase = (icebergDetectado / 100) * 15;

    if (ladoIceberg === 'compra') {
      return {
        impacto: impactoBase,
        descricao: `Iceberg orders de compra detectadas (confiança: ${icebergDetectado}%) — institucional acumulando de forma oculta.`
      };
    } else if (ladoIceberg === 'venda') {
      return {
        impacto: -impactoBase,
        descricao: `Iceberg orders de venda detectadas (confiança: ${icebergDetectado}%) — distribuição institucional em andamento.`
      };
    } else {
      return {
        impacto: 0,
        descricao: `Iceberg orders em ambos os lados (confiança: ${icebergDetectado}%) — possível defesa de range.`
      };
    }
  }

  /**
   * Analisa volume profile
   * @param {number} volumePOC - % do volume total concentrado no POC
   * @param {string} posicaoPrecoRelPOC - 'acima' | 'abaixo' | 'no_poc'
   */
  function analisarVolumeProfile(volumePOC, posicaoPrecoRelPOC) {
    const resultado = { score: 50, interpretacao: '' };

    if (volumePOC >= LIMIARES_FLUXO.volumeProfile.concentrado) {
      // Volume concentrado — preço justo encontrado
      if (posicaoPrecoRelPOC === 'acima') {
        resultado.score = 62;
        resultado.interpretacao = 'Preço acima do POC com volume concentrado — leilão de compra, mas risco de retorno ao valor.';
      } else if (posicaoPrecoRelPOC === 'abaixo') {
        resultado.score = 38;
        resultado.interpretacao = 'Preço abaixo do POC com volume concentrado — leilão de venda, porém região de valor pode atrair compradores.';
      } else {
        resultado.score = 50;
        resultado.interpretacao = 'Preço no POC — equilíbrio de mercado, sem viés direcional pelo volume profile.';
      }
    } else if (volumePOC <= LIMIARES_FLUXO.volumeProfile.disperso) {
      // Volume disperso — busca de valor
      resultado.score = 50;
      resultado.interpretacao = 'Volume disperso — mercado em fase de descoberta de preço, sem ponto de controle definido.';
    } else {
      resultado.score = 50;
      resultado.interpretacao = 'Distribuição de volume moderadamente concentrada no POC.';
    }

    return resultado;
  }

  /**
   * Analisa defesa institucional em níveis de preço
   * @param {Object} defesa - { ativa, nivel, lado, intensidade }
   */
  function analisarDefesaInstitucional(defesa) {
    if (!defesa || !defesa.ativa) {
      return { bonus: 0, descricao: 'Nenhuma defesa institucional identificada neste momento.' };
    }

    const intensidadeNorm = Math.min(100, Math.max(0, defesa.intensidade || 50));

    if (defesa.lado === 'compra') {
      return {
        bonus: (intensidadeNorm / 100) * 12,
        descricao: `Defesa institucional compradora ativa em ${defesa.nivel} (intensidade: ${intensidadeNorm}%) — suporte sendo defendido.`
      };
    } else if (defesa.lado === 'venda') {
      return {
        bonus: -(intensidadeNorm / 100) * 12,
        descricao: `Defesa institucional vendedora ativa em ${defesa.nivel} (intensidade: ${intensidadeNorm}%) — resistência sendo defendida.`
      };
    }

    return { bonus: 0, descricao: 'Defesa institucional detectada, mas sem lado definido.' };
  }

  /**
   * Determina se o institucional está acumulando ou distribuindo
   */
  function determinarComportamentoInstitucional(scoreAgressao, scoreDelta, absorcao, iceberg, defesa) {
    // Pontuação combinada ponderada
    const scoreCombinado =
      scoreAgressao * 0.30 +
      scoreDelta * 0.30 +
      absorcao.score * 0.20 +
      (50 + iceberg.impacto * 2) * 0.10 +
      (50 + defesa.bonus * 2) * 0.10;

    if (scoreCombinado >= 68) return 'acumulação';
    if (scoreCombinado >= 58) return 'acumulação provável';
    if (scoreCombinado <= 32) return 'distribuição';
    if (scoreCombinado <= 42) return 'distribuição provável';
    return 'indefinido';
  }

  /**
   * Gera interpretação textual profissional
   */
  function gerarInterpretacao(componentesAnalise, scoreGeral, direcao, comportamento) {
    const {
      scoreAgressao, scoreDelta, absorcao, spoofing,
      iceberg, volumeProfile, defesa
    } = componentesAnalise;

    const partes = [];

    // Comportamento institucional
    const descComportamento = {
      'acumulação': 'Fluxo institucional indica acumulação clara — institucional posicionando na compra com agressividade e absorção coordenada.',
      'acumulação provável': 'Fluxo sugere provável acumulação institucional — sinais predominantemente compradores, mas sem confirmação total.',
      'distribuição': 'Fluxo institucional indica distribuição ativa — institucional realizando vendas com absorção e delta negativo.',
      'distribuição provável': 'Fluxo sugere provável distribuição institucional — pressão vendedora predomina nos componentes de fluxo.',
      'indefinido': 'Fluxo institucional sem padrão claro de acumulação ou distribuição — mercado em equilíbrio ou transição.'
    };
    partes.push(descComportamento[comportamento]);

    // Agressão
    if (scoreAgressao > 70) {
      partes.push('Agressão compradora dominante nas ordens a mercado.');
    } else if (scoreAgressao < 30) {
      partes.push('Agressão vendedora dominante nas ordens a mercado.');
    }

    // Delta
    if (scoreDelta > 70) {
      partes.push('Delta acumulado fortemente positivo, confirmando pressão compradora.');
    } else if (scoreDelta < 30) {
      partes.push('Delta acumulado fortemente negativo, confirmando pressão vendedora.');
    }

    // Absorção
    if (absorcao.tipo !== 'sem absorção relevante') {
      partes.push(`Absorção: ${absorcao.tipo}.`);
    }

    // Spoofing
    if (spoofing.alerta) {
      partes.push(spoofing.alerta);
    }

    // Iceberg
    if (iceberg.impacto !== 0) {
      partes.push(iceberg.descricao);
    }

    // Volume Profile
    if (volumeProfile.interpretacao) {
      partes.push(volumeProfile.interpretacao);
    }

    // Defesa
    if (defesa.bonus !== 0) {
      partes.push(defesa.descricao);
    }

    // Score final
    partes.push(`Score de fluxo institucional: ${scoreGeral.toFixed(0)}/100 (confiança ${direcao === 'neutro' ? 'limitada' : 'direcional'}).`);

    return partes.join(' ');
  }

  // ─── Função Principal de Análise ──────────────────────────────

  /**
   * Analisa dados de fluxo institucional
   * @param {Object} marketData - Dados com propriedade .fluxo
   * @returns {Object} Resultado padronizado do agente
   */
  function analyze(marketData) {
    const fluxo = (marketData && marketData.fluxo) || {};

    // Extrai dados com valores padrão
    const dados = {
      agressaoCompradora: typeof fluxo.agressaoCompradora === 'number' ? fluxo.agressaoCompradora : 50,
      agressaoVendedora: typeof fluxo.agressaoVendedora === 'number' ? fluxo.agressaoVendedora : 50,
      deltaAcumulado: typeof fluxo.deltaAcumulado === 'number' ? fluxo.deltaAcumulado : 0,
      taxaAbsorcao: typeof fluxo.taxaAbsorcao === 'number' ? fluxo.taxaAbsorcao : 30,
      ladoAbsorcao: fluxo.ladoAbsorcao || 'equilibrio',
      nivelSpoofing: typeof fluxo.nivelSpoofing === 'number' ? fluxo.nivelSpoofing : 5,
      icebergDetectado: typeof fluxo.icebergDetectado === 'number' ? fluxo.icebergDetectado : 0,
      ladoIceberg: fluxo.ladoIceberg || 'ambos',
      volumePOC: typeof fluxo.volumePOC === 'number' ? fluxo.volumePOC : 25,
      posicaoPrecoRelPOC: fluxo.posicaoPrecoRelPOC || 'no_poc',
      defesa: fluxo.defesa || { ativa: false }
    };

    // Executa análises individuais
    const scoreAgressao = analisarAgressao(dados.agressaoCompradora, dados.agressaoVendedora);
    const scoreDelta = analisarDelta(dados.deltaAcumulado);
    const absorcao = analisarAbsorcao(dados.taxaAbsorcao, dados.ladoAbsorcao);
    const spoofing = avaliarSpoofing(dados.nivelSpoofing);
    const iceberg = analisarIceberg(dados.icebergDetectado, dados.ladoIceberg);
    const volumeProfile = analisarVolumeProfile(dados.volumePOC, dados.posicaoPrecoRelPOC);
    const defesa = analisarDefesaInstitucional(dados.defesa);

    // Score composto ponderado
    let scoreGeral =
      scoreAgressao * 0.25 +
      scoreDelta * 0.25 +
      absorcao.score * 0.20 +
      volumeProfile.score * 0.10 +
      50 * 0.10 + // Base neutra para componentes menores
      50 * 0.10;

    // Aplica bônus de iceberg e defesa
    scoreGeral += iceberg.impacto;
    scoreGeral += defesa.bonus;

    // Aplica penalidade de spoofing (reduz desvio do neutro)
    if (spoofing.penalidade > 0) {
      const desvioNeutro = scoreGeral - 50;
      scoreGeral = 50 + desvioNeutro * (1 - spoofing.penalidade / 100);
    }

    // Clampa resultado
    scoreGeral = Math.max(0, Math.min(100, scoreGeral));

    // Comportamento institucional
    const comportamento = determinarComportamentoInstitucional(scoreAgressao, scoreDelta, absorcao, iceberg, defesa);

    // Direção
    let direcao;
    if (scoreGeral > 58) direcao = 'alta';
    else if (scoreGeral < 42) direcao = 'baixa';
    else direcao = 'neutro';

    // Confiança — alta quando componentes convergem
    const componentesScore = [scoreAgressao, scoreDelta, absorcao.score];
    const media = componentesScore.reduce((a, b) => a + b, 0) / componentesScore.length;
    const variancia = componentesScore.reduce((soma, s) => soma + Math.pow(s - media, 2), 0) / componentesScore.length;
    const desvioPadrao = Math.sqrt(variancia);

    // Convergência alta (desvio baixo) → confiança alta
    let confianca = Math.round(Math.max(15, Math.min(95, 85 - desvioPadrao * 1.5)));

    // Spoofing reduz confiança
    confianca = Math.max(15, confianca - spoofing.penalidade);

    // Risco
    let risco;
    if (spoofing.penalidade >= 25) risco = 'extremo';
    else if (desvioPadrao > 25 || spoofing.penalidade >= 12) risco = 'alto';
    else if (desvioPadrao > 15 || direcao === 'neutro') risco = 'moderado';
    else risco = 'baixo';

    // Componentes para interpretação
    const componentesAnalise = {
      scoreAgressao, scoreDelta, absorcao, spoofing,
      iceberg, volumeProfile, defesa
    };

    const interpretacao = gerarInterpretacao(componentesAnalise, scoreGeral, direcao, comportamento);

    return {
      nome: NOME_AGENTE,
      score: Math.round(scoreGeral),
      direcao: direcao,
      confianca: confianca,
      interpretacao: interpretacao,
      risco: risco,
      peso: PESO_AGENTE,
      _detalhes: {
        comportamento: comportamento,
        scoreAgressao: Math.round(scoreAgressao),
        scoreDelta: Math.round(scoreDelta),
        absorcaoTipo: absorcao.tipo,
        spoofingConfiavel: spoofing.confiavel,
        icebergDetectado: dados.icebergDetectado > 20,
        defesaAtiva: dados.defesa.ativa
      }
    };
  }

  // ─── Exportação Global ────────────────────────────────────────
  window.BRDOLWINAgentFlow = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE} — MÁXIMO)`);

})();
