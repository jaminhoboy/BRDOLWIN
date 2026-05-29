// js/pages/admin-page.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar se o usuário está logado
    if (!window.BRDOLWINRouter.checkAuth()) return;

    // 2. Verificar se o usuário é Administrador
    if (!window.BRDOLWINAuth.isAdmin()) {
        alert("Acesso Negado. Você não tem privilégios de Administrador.");
        window.location.href = 'dashboard.html';
        return;
    }

    // O usuário é admin, prosseguir com a inicialização
    initAdminPanel();

    function initAdminPanel() {
        populatePlansTable();
        
        // Simular a carga dos motores (Mock visual para o layout, já que não há backend ainda)
        setTimeout(() => {
            const engineBadges = document.querySelectorAll('.engine-card .badge');
            engineBadges.forEach(badge => {
                badge.className = 'badge badge-status-open';
                badge.textContent = 'Online';
            });
        }, 1500);

        // Atualizar Uptime (mock)
        const uptimeEl = document.querySelectorAll('.admin-metric-value')[3];
        if(uptimeEl) uptimeEl.textContent = '99.9%';
    }

    function populatePlansTable() {
        const tbody = document.querySelector('#plansTable tbody');
        if (!tbody || !window.BRDOLWINAuth) return;

        const planos = window.BRDOLWINAuth.getPlanos();
        
        for (const key in planos) {
            const plano = planos[key];
            const row = document.createElement('tr');
            
            // Badge com a cor do plano
            const planBadge = `<span class="badge" style="background-color: ${plano.cor}20; color: ${plano.cor}; border: 1px solid ${plano.cor}50;">${plano.nome.toUpperCase()}</span>`;
            
            row.innerHTML = `
                <td>${planBadge}</td>
                <td style="font-size: 1.25rem;">${plano.icone}</td>
                <td>${plano.limites.atualizacaoSegundos}s</td>
                <td>${plano.limites.horizontesProbabilidade.join(', ')}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${plano.permissoes.slice(0, 5).map(p => `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">${p}</span>`).join('')}
                        ${plano.permissoes.length > 5 ? `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">+${plano.permissoes.length - 5}</span>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        }
    }
});
