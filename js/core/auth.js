/**
 * =====================================================
 * BRDOLWIN — Sistema de Autenticação (Supabase)
 * =====================================================
 * Gerencia login, logout, verificação de sessão e
 * permissões por plano usando o Supabase Auth.
 * =====================================================
 */

(function () {
  'use strict';

  // ─── Definição de Planos e Permissões ─────────────────
  const PLANOS = {
    starter: {
      nome: 'Starter',
      cor: '#3B82F6',
      icone: '📊',
      permissoes: [
        'dashboard_basico',
        'probabilidades_30m',
        'probabilidades_1h',
        'calendario_economico',
        'visao_geral',
      ],
      limites: {
        atualizacaoSegundos: 30,
        horizontesProbabilidade: ['30m', '1h'],
        agentesVisiveis: ['macro', 'tecnico'],
      },
    },
    pro: {
      nome: 'Pro',
      cor: '#A78BFA',
      icone: '⚡',
      permissoes: [
        'dashboard_basico',
        'probabilidades_30m',
        'probabilidades_1h',
        'probabilidades_2h',
        'probabilidades_3h',
        'tempo_real',
        'entradas_stops_alvos',
        'fluxo_institucional',
        'correlacoes',
        'calendario_economico',
        'visao_geral',
        'multi_horizonte',
      ],
      limites: {
        atualizacaoSegundos: 10,
        horizontesProbabilidade: ['30m', '1h', '2h', '3h'],
        agentesVisiveis: ['macro', 'tecnico', 'fluxo', 'liquidez', 'correlacao'],
      },
    },
    elite: {
      nome: 'Elite',
      cor: '#FBBF24',
      icone: '👑',
      permissoes: [
        'dashboard_basico',
        'probabilidades_30m',
        'probabilidades_1h',
        'probabilidades_2h',
        'probabilidades_3h',
        'tempo_real',
        'entradas_stops_alvos',
        'fluxo_institucional',
        'correlacoes',
        'calendario_economico',
        'visao_geral',
        'multi_horizonte',
        'heatmap',
        'ia_contextual',
        'alertas_personalizados',
        'exportar_dados',
        'relatorios_avancados',
        'modo_replay',
        'api_acesso',
      ],
      limites: {
        atualizacaoSegundos: 5,
        horizontesProbabilidade: ['30m', '1h', '2h', '3h'],
        agentesVisiveis: ['macro', 'tecnico', 'fluxo', 'liquidez', 'correlacao', 'sentiment', 'volatilidade'],
      },
    },
    admin: {
      nome: 'Admin',
      cor: '#EF4444',
      icone: '🔒',
      permissoes: [
        'dashboard_basico',
        'probabilidades_30m',
        'probabilidades_1h',
        'probabilidades_2h',
        'probabilidades_3h',
        'tempo_real',
        'entradas_stops_alvos',
        'fluxo_institucional',
        'correlacoes',
        'calendario_economico',
        'visao_geral',
        'multi_horizonte',
        'heatmap',
        'ia_contextual',
        'alertas_personalizados',
        'exportar_dados',
        'relatorios_avancados',
        'modo_replay',
        'api_acesso',
        'admin_panel'
      ],
      limites: {
        atualizacaoSegundos: 1,
        horizontesProbabilidade: ['30m', '1h', '2h', '3h'],
        agentesVisiveis: ['macro', 'tecnico', 'fluxo', 'liquidez', 'correlacao', 'sentiment', 'volatilidade'],
      },
    },
  };

  const STORAGE_KEY = 'brdolwin_sessao';

  // ─── Funções de Autenticação ──────────────────────────

  async function login(email, senha) {
    if (!email || !senha) {
      return { sucesso: false, mensagem: 'Preencha email e senha.' };
    }

    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha,
      });

      if (error) {
        // Se for erro de credenciais, tentamos criar a conta automaticamente (Auto-SignUp)
        // Isso é para facilitar o teste com as contas demo. Num app real, usaríamos apenas signIn.
        if (error.message.includes('Invalid login credentials')) {
          const { data: signUpData, error: signUpError } = await window.supabaseClient.auth.signUp({
            email: email,
            password: senha,
            options: {
              data: {
                nome: email.split('@')[0],
                plano: email.includes('admin') ? 'admin' : (email.includes('elite') ? 'elite' : (email.includes('pro') ? 'pro' : 'starter'))
              }
            }
          });
          
          if (signUpError) {
             return { sucesso: false, mensagem: signUpError.message };
          }
          
          // Se o signUp deu certo, mas a sessão não voltou, pode ser que "Confirm Email" esteja ativo
          if (!signUpData.session) {
             return { sucesso: false, mensagem: 'Conta criada! Confirme seu email no Supabase (ou desative o Confirm Email nas opções do Supabase).' };
          }
          
          // Criou e logou com sucesso
          return _construirSessao(signUpData.user);
        }

        return { sucesso: false, mensagem: error.message };
      }

      return _construirSessao(data.user);
    } catch (err) {
      return { sucesso: false, mensagem: 'Erro de conexão com o servidor.' };
    }
  }

  function _construirSessao(user) {
    const plano = user.user_metadata?.plano || 'starter';
    const nome = user.user_metadata?.nome || user.email.split('@')[0];

    const sessao = {
      id: user.id,
      nome: nome,
      email: user.email,
      plano: plano,
      avatar: nome.substring(0,2).toUpperCase(),
      corAvatar: PLANOS[plano]?.cor || '#3B82F6',
      loginTimestamp: Date.now(),
      expiraEm: Date.now() + 8 * 3600 * 1000,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));
    console.log(`[BRDOLWIN] ✅ Login: ${sessao.nome} (${PLANOS[sessao.plano].nome})`);

    return {
      sucesso: true,
      mensagem: `Bem-vindo, ${sessao.nome}!`,
      usuario: sessao,
    };
  }

  async function logout() {
    const usuario = getCurrentUser();
    await window.supabaseClient.auth.signOut();
    sessionStorage.removeItem(STORAGE_KEY);
    console.log(`[BRDOLWIN] 🚪 Logout: ${usuario ? usuario.nome : 'desconhecido'}`);
    window.location.href = 'index.html';
  }

  function isAuthenticated() {
    const sessao = _getSessao();
    if (!sessao) return false;

    if (Date.now() > sessao.expiraEm) {
      console.log('[BRDOLWIN] ⏰ Sessão expirada');
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  }

  function getCurrentUser() {
    if (!isAuthenticated()) return null;
    return _getSessao();
  }

  function getCurrentPlan() {
    const user = getCurrentUser();
    return user ? user.plano : null;
  }

  function getCurrentPlanConfig() {
    const plano = getCurrentPlan();
    return plano ? PLANOS[plano] : null;
  }

  function hasPermission(feature) {
    const config = getCurrentPlanConfig();
    if (!config) return false;
    return config.permissoes.includes(feature);
  }

  function getUpdateInterval() {
    const config = getCurrentPlanConfig();
    if (!config) return 30000;
    return config.limites.atualizacaoSegundos * 1000;
  }

  function getAvailableHorizons() {
    const config = getCurrentPlanConfig();
    if (!config) return ['30m', '1h'];
    return config.limites.horizontesProbabilidade;
  }

  function getVisibleAgents() {
    const config = getCurrentPlanConfig();
    if (!config) return ['macro', 'tecnico'];
    return config.limites.agentesVisiveis;
  }

  function requireAuth() {
    if (!isAuthenticated()) {
      console.log('[BRDOLWIN] 🔒 Acesso negado — redirecionando para login');
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  function getPlanos() {
    return PLANOS;
  }

  function _getSessao() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function isAdmin() {
    return hasPermission('admin_panel');
  }

  window.BRDOLWINAuth = {
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
    getCurrentPlan,
    getCurrentPlanConfig,
    hasPermission,
    getUpdateInterval,
    getAvailableHorizons,
    getVisibleAgents,
    requireAuth,
    getPlanos,
    isAdmin,
  };

  console.log('[BRDOLWIN] ✅ Auth (Supabase) carregado');
})();
