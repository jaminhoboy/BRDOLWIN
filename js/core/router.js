/**
 * =====================================================
 * BRDOLWIN — Router / Navegação
 * =====================================================
 * Gerencia navegação entre páginas, destaque do link
 * ativo na sidebar, verificação de autenticação,
 * e exibição condicional do link Admin.
 *
 * Exporta como window.BRDOLWINRouter
 * =====================================================
 */

window.BRDOLWINRouter = {
  initRouter() {
    this.highlightCurrentPage();
    this.updateUserUI();
    this.setupAdminLink();
  },

  /**
   * Destaca o link ativo na sidebar
   */
  highlightCurrentPage() {
    const currentPath = window.location.pathname;
    const page = currentPath.split('/').pop() || 'index.html';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === page) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  /**
   * Atualiza UI do usuário (badge de plano e nome)
   */
  updateUserUI() {
    const planBadge = document.getElementById('userPlanBadge');
    const userNameDisplay = document.getElementById('userNameDisplay');

    const currentUser = window.BRDOLWINAuth
      ? window.BRDOLWINAuth.getCurrentUser()
      : null;
    const currentPlanId = window.BRDOLWINAuth
      ? window.BRDOLWINAuth.getCurrentPlan()
      : null;
    const planConfig = window.BRDOLWINAuth
      ? window.BRDOLWINAuth.getCurrentPlanConfig()
      : null;

    if (planBadge && planConfig) {
      planBadge.textContent = planConfig.nome.toUpperCase();
      planBadge.className = `badge badge-${currentPlanId}`;
    } else if (planBadge && currentPlanId) {
      planBadge.textContent = currentPlanId.toUpperCase();
      planBadge.className = `badge badge-${currentPlanId}`;
    }

    if (userNameDisplay && currentUser) {
      userNameDisplay.textContent = currentUser.nome || currentUser.email.split('@')[0];
    }
  },

  /**
   * Mostra/oculta o link do Painel Admin na sidebar
   */
  setupAdminLink() {
    const adminLink = document.getElementById('adminSidebarLink');
    if (adminLink && window.BRDOLWINAuth && window.BRDOLWINAuth.isAdmin()) {
      adminLink.style.display = 'flex';
    }
  },

  /**
   * Verifica autenticação e redireciona se não logado
   * @returns {boolean}
   */
  checkAuth() {
    if (!window.BRDOLWINAuth || !window.BRDOLWINAuth.isAuthenticated()) {
      window.location.href = 'index.html';
      return false;
    }

    this.updateUserUI();
    this.setupAdminLink();
    return true;
  },
};

// Initialize if document is ready
document.addEventListener('DOMContentLoaded', () => {
  window.BRDOLWINRouter.initRouter();
});
