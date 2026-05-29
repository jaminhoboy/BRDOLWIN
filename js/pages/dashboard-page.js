// js/pages/dashboard-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (!window.BRDOLWINRouter.checkAuth()) return;

    // Initialize UI
    initDashboard();

    function initDashboard() {
        // Gráficos foram removidos conforme solicitação do usuário.

        // Variável global para o Dashboard
        window.BRDOLWINDashboard = {
            currentHorizon: '30m',
            gaugeChart: null,
            
            selectHorizon(horizon) {
                this.currentHorizon = horizon;
                
                // Atualizar classes das abas
                const tabs = document.querySelectorAll('#probTabs button');
                tabs.forEach(tab => {
                    if(tab.textContent === horizon) tab.classList.add('active');
                    else tab.classList.remove('active');
                });

                // Forçar atualização da UI com o estado atual
                if(window.BRDOLWINState) {
                    window.BRDOLWINState.notifyListeners();
                }
            },
            
            updateGauge(altaValue) {
                if(this.gaugeChart) {
                    this.gaugeChart.setOption({
                        series: [{
                            data: [{ value: altaValue, name: 'Alta' }]
                        }]
                    });
                }
            }
        };

        // Mock Probability Gauge (ECharts)
        const gaugeContainer = document.getElementById('winGauge');
        if (gaugeContainer && window.echarts) {
            window.BRDOLWINDashboard.gaugeChart = echarts.init(gaugeContainer, 'dark');
            const option = {
                backgroundColor: 'transparent',
                series: [{
                    type: 'gauge',
                    startAngle: 180, endAngle: 0, min: 0, max: 100,
                    pointer: { show: true },
                    progress: { show: true, overlap: false, roundCap: true, clip: false },
                    axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(255,255,255,0.05)']] } },
                    splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
                    data: [{ value: 0, name: 'Alta' }],
                    title: { fontSize: 14, color: '#94A3B8', offsetCenter: [0, '20%'] },
                    detail: { width: 50, height: 14, fontSize: 24, color: '#E2E8F0', formatter: '{value}%', offsetCenter: [0, '-10%'] }
                }]
            };
            window.BRDOLWINDashboard.gaugeChart.setOption(option);
        }

        // Painel de agentes foi removido.
    }
});
