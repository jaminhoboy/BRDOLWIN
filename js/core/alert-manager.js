/**
 * =====================================================
 * BRDOLWIN — Alert Manager (Global Pop-ups)
 * =====================================================
 * Gerencia a exibição de pop-ups (Toasts) em todas as páginas.
 * Permite que o Atlas AI ou o Orquestrador avisem sobre
 * entradas claras independentemente da página atual.
 * =====================================================
 */

(function () {
    'use strict';

    const AlertManager = {
        containerId: 'toast-container',
        container: null,

        init() {
            // Cria o container caso não exista na página atual
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = this.containerId;
                document.body.appendChild(this.container);
            }
        },

        /**
         * Dispara um novo pop-up de alerta de entrada
         * @param {Object} data 
         * @param {string} data.asset Ex: 'WINV26'
         * @param {string} data.direction 'buy' ou 'sell'
         * @param {number} data.entry Preço de entrada
         * @param {number} data.stop Preço de stop
         * @param {number} data.target Preço alvo principal
         * @param {string} data.reason Motivo da entrada
         * @param {number} duration Duração em ms (default 8000)
         */
        showEntryAlert(data, duration = 8000) {
            if (!this.container) this.init();

            const isBuy = data.direction === 'buy';
            const icon = isBuy ? 'trending-up' : 'trending-down';
            const typeStr = isBuy ? 'COMPRA' : 'VENDA';
            const format = window.BRDOLWINUtils ? window.BRDOLWINUtils.formatPrice : (val) => val;

            const toast = document.createElement('div');
            toast.className = `toast-alert ${data.direction}`;
            
            toast.innerHTML = `
                <div class="toast-header">
                    <div class="toast-title">
                        <i data-lucide="${icon}" style="width: 18px;"></i>
                        ${typeStr} CLARA — ${data.asset}
                    </div>
                    <button class="toast-close"><i data-lucide="x" style="width: 16px;"></i></button>
                </div>
                <div class="toast-body">
                    <div class="toast-metric">
                        <span class="toast-label">Entrada</span>
                        <span class="toast-value" style="color: ${isBuy ? 'var(--cor-sucesso)' : 'var(--cor-alerta-vermelho)'}">${format(data.entry)}</span>
                    </div>
                    <div class="toast-metric">
                        <span class="toast-label">Alvo Principal</span>
                        <span class="toast-value">${format(data.target)}</span>
                    </div>
                    <div class="toast-metric">
                        <span class="toast-label">Stop Loss</span>
                        <span class="toast-value">${format(data.stop)}</span>
                    </div>
                    <div class="toast-metric">
                        <span class="toast-label">Risco:Retorno</span>
                        <span class="toast-value">1:${Math.abs((data.target - data.entry)/(data.entry - data.stop)).toFixed(1)}</span>
                    </div>
                </div>
                <div class="toast-reason">${data.reason}</div>
                <div class="toast-progress"></div>
            `;

            this.container.appendChild(toast);
            
            // Renderiza os ícones do Lucide
            if (window.lucide) {
                window.lucide.createIcons({ root: toast });
            }

            // Animação da barra de progresso
            const progressBar = toast.querySelector('.toast-progress');
            progressBar.style.transition = `transform ${duration}ms linear`;
            
            // Força reflow para a transição funcionar
            toast.offsetHeight;
            progressBar.style.transform = 'scaleX(0)';

            // Botão de fechar
            const closeBtn = toast.querySelector('.toast-close');
            let timeoutId;

            const closeToast = () => {
                toast.classList.add('closing');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300); // tempo da animação slideOut
            };

            closeBtn.addEventListener('click', () => {
                clearTimeout(timeoutId);
                closeToast();
            });

            // Auto fechar
            timeoutId = setTimeout(closeToast, duration);
        }
    };

    window.BRDOLWINAlerts = AlertManager;

    // Inicializa no DOM load
    document.addEventListener('DOMContentLoaded', () => {
        AlertManager.init();
    });

})();
