/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BRDOLWIN — Agente de Correlação Global (agent-correlation) ║
 * ║  Peso na hierarquia: 5                                      ║
 * ║  Monitora: S&P500, Ibovespa, DXY, WDO, VIX, Treasuries,   ║
 * ║  Petróleo, Minério, Bitcoin                                 ║
 * ║  Avalia convergência vs divergência de correlações           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  const PESO_AGENTE = 5;
  const NOME_AGENTE = 'Agente de Correlação Global';

  // ─── Definição dos Pares de Correlação ────────────────────────

  /**
   * Cada par define:
   * - nome: descrição do par
   * - ativoA, ativoB: chaves nos dados de mercado
   * - correlacaoHistorica: correlação normal/esperada
   * - importancia: peso do par na análise (0 a 1)
   * - impactoWIN: como a correlação afeta WIN ('direto' ou 'inverso')
   * - impactoWDO: como a correlação afeta WDO
   */
  const PARES_CORRELACAO = [
    {
      nome: 'S&P 500 vs Ibovespa',
      ativoA: 'sp500',
      ativoB: 'ibovespa',
      correlacaoHistorica: 0.72,
      importancia: 0.20,
      impactoWIN: 'direto',
      descNormal: 'Ibovespa acompanhando S&P 500 — correlação normal.',
      descDivergente: 'Ibovespa divergindo do S&P 500'
    },
    {
      nome: 'DXY vs WDO',
      ativoA: 'dxy',
      ativoB: 'wdo',
      correlacaoHistorica: 0.85,
      importancia: 0.20,
      impactoWIN: 'inverso',
      descNormal: 'WDO acompanhando DXY — relação de câmbio normal.',
      descDivergente: 'WDO divergindo do DXY — possível fator local influenciando câmbio'
    },
    {
      nome: 'VIX (Medo Global)',
      ativoA: 'vix',
      ativoB: 'ibovespa',
      correlacaoHistorica: -0.60,
      importancia: 0.18,
      impactoWIN: 'inverso',
      descNormal: 'VIX e Ibovespa com correlação inversa normal — nível de medo precificado.',
      descDivergente: 'Ibovespa ignorando movimento do VIX — atenção a possível correção'
    },
    {
      nome: 'Treasuries 10Y vs Emergentes',
      ativoA: 'treasuries10y',
      ativoB: 'ibovespa',
      correlacaoHistorica: -0.45,
      importancia: 0.12,
      impactoWIN: 'inverso',
      descNormal: 'Treasuries e ativos brasileiros com relação inversa esperada.',
      descDivergente: 'Treasuries subindo sem impacto negativo em BR — resiliência ou delay'
    },
    {
      nome: 'Petróleo vs Petrobras/Ibov',
      ativoA: 'petroleo',
      ativoB: 'ibovespa',
      correlacaoHistorica: 0.40,
      importancia: 0.10,
      impactoWIN: 'direto',
      descNormal: 'Petróleo e Ibovespa com correlação positiva (peso de PETR no índice).',
      descDivergente: 'Petróleo descolado do Ibovespa'
    },
    {
      nome: 'Minério de Ferro vs Ibov',
      ativoA: 'minerio',
      ativoB: 'ibovespa',
      correlacaoHistorica: 0.50,
      importancia: 0.10,
      impactoWIN: 'direto',
      descNormal: 'Minério sustentando Ibovespa via VALE.',
      descDivergente: 'Minério e Ibovespa descolados — possível rotação setorial'
    },
    {
      nome: 'Bitcoin vs Risk-On',
      ativoA: 'bitcoin',
      ativoB: 'sp500',
      correlacaoHistorica: 0.55,
      importancia: 0.10,
      impactoWIN: 'direto',
      descNormal: 'Bitcoin acompanhando apetite global por risco.',
      descDivergente: 'Bitcoin divergindo do apetite por risco geral'
    }
  ];

  // ─── Limiares do VIX ──────────────────────────────────────────
  const VIX_LIMIARES = {
    complacencia: 12,
    normal: 18,
    elevado: 25,
    panico: 35
  };

  // ─── Funções de Análise ───────────────────────────────────────

  /**
   * Calcula variação percentual de um ativo
   */
  function calcularVariacao(atual, anterior) {
    if (!anterior || anterior === 0) return 0;
    return ((atual - anterior) / anterior) * 100;
  }

  /**
   * Determina se dois ativos estão convergindo ou divergindo
   * baseado na variação recente vs correlação esperada
   */
  function avaliarConvergencia(variacaoA, variacaoB, correlacaoEsperada) {
    // Se correlação esperada é positiva, os dois devem mover na mesma direção
    // Se negativa, devem mover em direções opostas

    // Ambos neutros → sem informação
    if (Math.abs(variacaoA) < 0.1 && Math.abs(variacaoB) < 0.1) {
      return { status: 'neutro', intensidade: 0 };
    }

    // Correlação observada instantânea (sinal)
    const mesmaDir = (variacaoA > 0 && variacaoB > 0) || (variacaoA < 0 && variacaoB < 0);
    const direcaoOposta = (variacaoA > 0 && variacaoB < 0) || (variacaoA < 0 && variacaoB > 0);

    let convergente;
    if (correlacaoEsperada > 0) {
      convergente = mesmaDir;
    } else {
      convergente = direcaoOposta;
    }

    // Intensidade — quão forte é a variação
    const intensidade = Math.min(100, (Math.abs(variacaoA) + Math.abs(variacaoB)) * 10);

    if (convergente) {
      return { status: 'convergente', intensidade: intensidade };
    } else {
      return { status: 'divergente', intensidade: intensidade };
    }
  }

  /**
   * Analisa o VIX como indicador de medo global
   * @param {number} vixAtual - Nível atual do VIX
   * @param {number} vixAnterior - Nível anterior do VIX
   */
  function analisarVIX(vixAtual, vixAnterior) {
    const variacao = calcularVariacao(vixAtual, vixAnterior);

    let nivelMedo;
    let scoreVix;
    let descricao;

    if (vixAtual >= VIX_LIMIARES.panico) {
      nivelMedo = 'pânico';
      scoreVix = 15;
      descricao = `VIX em ${vixAtual.toFixed(1)} — nível de pânico extremo no mercado global. Aversão total a risco.`;
    } else if (vixAtual >= VIX_LIMIARES.elevado) {
      nivelMedo = 'elevado';
      scoreVix = 30;
      descricao = `VIX em ${vixAtual.toFixed(1)} — medo elevado nos mercados globais. Cautela com ativos de risco.`;
    } else if (vixAtual >= VIX_LIMIARES.normal) {
      nivelMedo = 'normal';
      scoreVix = 55;
      descricao = `VIX em ${vixAtual.toFixed(1)} — volatilidade dentro da normalidade.`;
    } else if (vixAtual >= VIX_LIMIARES.complacencia) {
      nivelMedo = 'baixo';
      scoreVix = 72;
      descricao = `VIX em ${vixAtual.toFixed(1)} — baixa volatilidade, ambiente favorável para risco.`;
    } else {
      nivelMedo = 'complacência';
      scoreVix = 65; // Complacência extrema pode anteceder correção
      descricao = `VIX em ${vixAtual.toFixed(1)} — complacência extrema. Historicamente, antecede aumento de volatilidade.`;
    }

    // Variação rápida do VIX é informativa
    if (variacao > 20) {
      descricao += ` Spike de ${variacao.toFixed(1)}% no VIX — deterioração rápida do sentimento.`;
      scoreVix = Math.max(10, scoreVix - 15);
    } else if (variacao < -15) {
      descricao += ` Queda de ${Math.abs(variacao).toFixed(1)}% no VIX — alívio no sentimento de risco.`;
      scoreVix = Math.min(85, scoreVix + 10);
    }

    return {
      nivelMedo: nivelMedo,
      score: scoreVix,
      variacao: variacao,
      descricao: descricao
    };
  }

  /**
   * Analisa todos os pares de correlação
   * @param {Object} dados - Dados de mercado com preços atuais e anteriores
   */
  function analisarPares(dados) {
    const resultados = [];
    let convergentes = 0;
    let divergentes = 0;
    let neutros = 0;
    let scoreAcumulado = 0;
    let pesoAcumulado = 0;

    PARES_CORRELACAO.forEach(function (par) {
      const ativoA = dados[par.ativoA] || {};
      const ativoB = dados[par.ativoB] || {};

      const varA = calcularVariacao(ativoA.atual, ativoA.anterior);
      const varB = calcularVariacao(ativoB.atual, ativoB.anterior);

      const conv = avaliarConvergencia(varA, varB, par.correlacaoHistorica);

      let scorePar;
      let descricao;

      if (conv.status === 'convergente') {
        convergentes++;
        scorePar = 60 + (conv.intensidade / 100) * 15;
        descricao = par.descNormal;
      } else if (conv.status === 'divergente') {
        divergentes++;
        scorePar = 35 - (conv.intensidade / 100) * 10;
        descricao = par.descDivergente + ` (${par.ativoA}: ${varA > 0 ? '+' : ''}${varA.toFixed(2)}%, ${par.ativoB}: ${varB > 0 ? '+' : ''}${varB.toFixed(2)}%).`;
      } else {
        neutros++;
        scorePar = 50;
        descricao = `${par.nome}: variação mínima em ambos — sem informação relevante.`;
      }

      scoreAcumulado += scorePar * par.importancia;
      pesoAcumulado += par.importancia;

      resultados.push({
        nome: par.nome,
        status: conv.status,
        intensidade: conv.intensidade,
        score: Math.round(scorePar),
        variacaoA: Number(varA.toFixed(2)),
        variacaoB: Number(varB.toFixed(2)),
        descricao: descricao
      });
    });

    return {
      resultados: resultados,
      convergentes: convergentes,
      divergentes: divergentes,
      neutros: neutros,
      scoreMedio: pesoAcumulado > 0 ? scoreAcumulado / pesoAcumulado : 50
    };
  }

  // ─── Função Principal ─────────────────────────────────────────

  function analyze(marketData) {
    const corr = (marketData && marketData.correlacao) || {};

    // Extrai dados com valores padrão
    const dados = {
      sp500: {
        atual: (corr.sp500 && corr.sp500.atual) || 5200,
        anterior: (corr.sp500 && corr.sp500.anterior) || 5180
      },
      ibovespa: {
        atual: (corr.ibovespa && corr.ibovespa.atual) || 128000,
        anterior: (corr.ibovespa && corr.ibovespa.anterior) || 127500
      },
      dxy: {
        atual: (corr.dxy && corr.dxy.atual) || 104.5,
        anterior: (corr.dxy && corr.dxy.anterior) || 104.3
      },
      wdo: {
        atual: (corr.wdo && corr.wdo.atual) || 5150,
        anterior: (corr.wdo && corr.wdo.anterior) || 5130
      },
      vix: {
        atual: (corr.vix && corr.vix.atual) || 17,
        anterior: (corr.vix && corr.vix.anterior) || 16.5
      },
      treasuries10y: {
        atual: (corr.treasuries10y && corr.treasuries10y.atual) || 4.3,
        anterior: (corr.treasuries10y && corr.treasuries10y.anterior) || 4.25
      },
      petroleo: {
        atual: (corr.petroleo && corr.petroleo.atual) || 78,
        anterior: (corr.petroleo && corr.petroleo.anterior) || 77
      },
      minerio: {
        atual: (corr.minerio && corr.minerio.atual) || 115,
        anterior: (corr.minerio && corr.minerio.anterior) || 114
      },
      bitcoin: {
        atual: (corr.bitcoin && corr.bitcoin.atual) || 67000,
        anterior: (corr.bitcoin && corr.bitcoin.anterior) || 66500
      }
    };

    // Análise dos pares
    const analisesPares = analisarPares(dados);

    // Análise do VIX
    const analiseVix = analisarVIX(dados.vix.atual, dados.vix.anterior);

    // Score geral composto
    // 65% correlações, 35% VIX
    const scoreGeral = analisesPares.scoreMedio * 0.65 + analiseVix.score * 0.35;

    // Direção
    let direcao;
    const taxaConvergencia = analisesPares.convergentes / Math.max(1, analisesPares.convergentes + analisesPares.divergentes);

    if (scoreGeral > 58 && taxaConvergencia > 0.6) {
      direcao = 'alta';
    } else if (scoreGeral < 42 || taxaConvergencia < 0.3) {
      direcao = 'baixa';
    } else {
      direcao = 'neutro';
    }

    // Confiança — alta quando a maioria dos pares converge
    let confianca = Math.round(Math.min(85, Math.max(20,
      taxaConvergencia * 60 + Math.abs(scoreGeral - 50) * 0.6
    )));

    // Muitas divergências → reduz confiança
    if (analisesPares.divergentes > analisesPares.convergentes) {
      confianca = Math.max(15, confianca - 15);
    }

    // Risco
    let risco;
    if (analiseVix.nivelMedo === 'pânico') risco = 'extremo';
    else if (analiseVix.nivelMedo === 'elevado' || analisesPares.divergentes >= 4) risco = 'alto';
    else if (analisesPares.divergentes >= 2 || direcao === 'neutro') risco = 'moderado';
    else risco = 'baixo';

    // Interpretação composta
    const partes = [];

    partes.push(`Análise de ${PARES_CORRELACAO.length} pares de correlação: ${analisesPares.convergentes} convergentes, ${analisesPares.divergentes} divergentes, ${analisesPares.neutros} neutros.`);

    // Adiciona análise do VIX
    partes.push(analiseVix.descricao);

    // Pares divergentes são os mais informativos
    analisesPares.resultados
      .filter(function (r) { return r.status === 'divergente'; })
      .forEach(function (r) {
        partes.push(r.descricao);
      });

    // Conclusão
    if (taxaConvergencia > 0.7) {
      partes.push('Correlações predominantemente convergentes — mercados globais alinhados.');
    } else if (taxaConvergencia < 0.4) {
      partes.push('Múltiplas divergências detectadas — cautela com análises direcionais, mercado descorrelacionado.');
    } else {
      partes.push('Correlações mistas — alguns pares convergem, outros divergem. Cenário exige leitura multi-fatorial.');
    }

    const interpretacao = partes.join(' ');

    return {
      nome: NOME_AGENTE,
      score: Math.round(Math.max(0, Math.min(100, scoreGeral))),
      direcao: direcao,
      confianca: confianca,
      interpretacao: interpretacao,
      risco: risco,
      peso: PESO_AGENTE,
      _detalhes: {
        convergentes: analisesPares.convergentes,
        divergentes: analisesPares.divergentes,
        neutros: analisesPares.neutros,
        taxaConvergencia: Number(taxaConvergencia.toFixed(2)),
        vix: {
          nivel: dados.vix.atual,
          nivelMedo: analiseVix.nivelMedo,
          score: analiseVix.score
        },
        pares: analisesPares.resultados
      }
    };
  }

  // ─── Exportação ───────────────────────────────────────────────
  window.BRDOLWINAgentCorrelation = {
    analyze: analyze,
    nome: NOME_AGENTE,
    peso: PESO_AGENTE,
    versao: '1.0.0'
  };

  console.log(`[BRDOLWIN] ${NOME_AGENTE} carregado (peso: ${PESO_AGENTE})`);

})();
