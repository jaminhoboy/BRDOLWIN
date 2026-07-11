// js/pages/admin-page.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar se o usuário está logado
    if (!window.BRDOLWINRouter.checkAuth()) return;

    // 2. Verificar se o usuário é Administrador
    if (!window.BRDOLWINAuth.isAdmin()) {
        alert("Acesso Negado. Você não tem privilégios de Administrador.");
        window.location.href = 'indice.html';
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

        setupEnginesModal();
    }

    const enginesData = {
        trend: {
            title: 'Agente Tendência',
            icon: 'trending-up',
            desc: 'Avalia o cruzamento de médias móveis (EMA9 e EMA21) para identificar a inércia do mercado. É altamente eficaz no longo prazo porque os mercados tendem a continuar o movimento antes de reverter.',
            wB3: '20%', wMaj: '18%', wJpy: '20%'
        },
        momentum: {
            title: 'Agente Momentum',
            icon: 'zap',
            desc: 'Analisa o Índice de Força Relativa (RSI) e a Taxa de Variação (ROC). Confirma a velocidade do movimento, sendo vital para evitar entradas em tendências já exauridas e detectar movimentos explosivos.',
            wB3: '15%', wMaj: '15%', wJpy: '25%'
        },
        meanReversion: {
            title: 'Agente Reversão à Média',
            icon: 'corner-down-left',
            desc: 'Mede distorções de preço em relação ao VWAP e Bandas de Bollinger. Mercados laterais são dominados por esta estratégia, pois o preço sempre tende a retornar à sua média justa.',
            wB3: '3%', wMaj: '5%', wJpy: '2%'
        },
        volatility: {
            title: 'Agente Volatilidade',
            icon: 'activity',
            desc: 'Baseado no ATR e largura das Bandas de Bollinger. Antecipa expansões explosivas (breakouts) quando identifica que o mercado está sofrendo compressão extrema (squeeze).',
            wB3: '2%', wMaj: '0%', wJpy: '0%'
        },
        correlation: {
            title: 'Agente Intermarket',
            icon: 'git-merge',
            desc: 'Lê o fluxo macroeconômico global (DXY, VIX, S&P 500, Petróleo, Ouro). É a camada de defesa mais forte do robô, evitando operações contra a força motriz do mercado mundial.',
            wB3: '22%', wMaj: '12%', wJpy: '10%'
        },
        smartMoney: {
            title: 'Agente Smart Money',
            icon: 'building',
            desc: 'Mapeia as zonas de liquidez institucionais (suportes e resistências estruturais). Identifica onde bancos e HFTs estão posicionados, evitando ser alvo de "stop hunts" (varredura de liquidez).',
            wB3: '28%', wMaj: '30%', wJpy: '25%'
        },
        statistical: {
            title: 'Agente Estatístico',
            icon: 'clock',
            desc: 'Avalia sazonalidade e horários de pico (abertura B3, sessões de Londres, NY e Tóquio). Aumenta a confiança apenas nos momentos em que há volume financeiro suficiente para deslocar o preço.',
            wB3: '10%', wMaj: '20%', wJpy: '18%'
        },
        breakout: {
            title: 'Agente Breakout',
            icon: 'box',
            desc: 'Mede rompimentos de caixas de consolidação com dupla confirmação. Atualmente desativado (peso 0) para evitar "falsos rompimentos", deixando o trabalho para o Agente Smart Money.',
            wB3: '0%', wMaj: '0%', wJpy: '0%'
        }
    };

    function setupEnginesModal() {
        const modal = document.getElementById('engineModal');
        if (!modal) return;
        
        const titleEl = document.getElementById('engineModalTitle');
        const descEl = document.getElementById('engineModalDesc');
        const wB3El = document.getElementById('weightB3');
        const wMajEl = document.getElementById('weightForexMaj');
        const wJpyEl = document.getElementById('weightForexJpy');

        document.querySelectorAll('.engine-card').forEach(card => {
            card.addEventListener('click', () => {
                const engineKey = card.getAttribute('data-engine');
                const data = enginesData[engineKey];
                if (data) {
                    titleEl.innerHTML = `<i data-lucide="${data.icon}"></i> ${data.title}`;
                    descEl.textContent = data.desc;
                    wB3El.textContent = data.wB3;
                    wMajEl.textContent = data.wMaj;
                    wJpyEl.textContent = data.wJpy;
                    
                    lucide.createIcons({
                        nameAttr: 'data-lucide',
                        attrs: {
                            class: 'lucide'
                        }
                    });
                    
                    modal.classList.add('active');
                }
            });
        });
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
