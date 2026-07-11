// js/pages/indice-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINRouter && !window.BRDOLWINRouter.checkAuth()) return;

    const IndicePage = {
        gaugeChart: null,
        currentHorizon: '30m',

        init() {
            this.initTabs();
            this.initGauge();
            this.subscribeToMarketState();
            
            // Mock de atualização periódica para demonstração do AlertManager
            setTimeout(() => {
                if (window.BRDOLWINAlerts) {
                    window.BRDOLWINAlerts.showEntryAlert({
                        asset: 'WINV26',
                        direction: 'buy',
                        entry: 135250,
                        stop: 135100,
                        target: 135500,
                        reason: 'Consenso Atlas: 8 estratégias alinhadas.'
                    });
                }
            }, 5000);
        },

        initTabs() {
            const probTabs = document.querySelectorAll('#probTabs button');
            probTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    probTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    this.currentHorizon = e.target.textContent;
                    // Força atualização
                    if (window.BRDOLWINState) window.BRDOLWINState.notifyListeners();
                });
            });
        },

        initGauge() {
            const gaugeContainer = document.getElementById('winGauge');
            if (gaugeContainer && window.echarts) {
                this.gaugeChart = echarts.init(gaugeContainer, 'dark');
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
                this.gaugeChart.setOption(option);
            }
        },

        updateGauge(altaValue) {
            if (this.gaugeChart) {
                this.gaugeChart.setOption({
                    series: [{ data: [{ value: altaValue, name: 'Alta' }] }]
                });
            }
        },

        subscribeToMarketState() {
            if (!window.BRDOLWINState) return;

            window.BRDOLWINState.subscribe((state) => {
                // Atualiza Header
                if (state.win && state.win.price) {
                    document.getElementById('winPrice').textContent = window.BRDOLWINUtils.formatPrice(state.win.price);
                    
                    const changeEl = document.getElementById('winChange');
                    const change = state.win.changePercent || 0;
                    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
                    changeEl.className = change >= 0 ? 'text-green ml-2' : 'text-red ml-2';

                    // Atualiza Operacional
                    document.getElementById('execWinEntry').textContent = window.BRDOLWINUtils.formatPrice(state.win.price) + ' (Spot)';
                    document.getElementById('execWinStop').textContent = window.BRDOLWINUtils.formatPrice(state.win.price - 150);
                    document.getElementById('execWinTarget').textContent = window.BRDOLWINUtils.formatPrice(state.win.price + 300);
                }

                // Atualiza Probabilidades
                let probHigh = 0, probLow = 0, probSide = 0;
                
                if (this.currentHorizon === '30m') {
                    probHigh = 45; probLow = 30; probSide = 25;
                } else if (this.currentHorizon === '1h') {
                    probHigh = 55; probLow = 25; probSide = 20;
                }

                document.getElementById('winProbHigh').textContent = probHigh + '%';
                document.getElementById('winProbLow').textContent = probLow + '%';
                
                const winBarHigh = document.getElementById('winBarHigh');
                if (winBarHigh) winBarHigh.style.width = probHigh + '%';
                
                const winBarLow = document.getElementById('winBarLow');
                if (winBarLow) winBarLow.style.width = probLow + '%';

                this.updateGauge(probHigh);

                // Global Ticker
                if (state.sp500 && state.sp500.price) {
                    const spEl = document.getElementById('tickerSP500');
                    if (spEl) spEl.innerHTML = `<span style="color: ${state.sp500.change >= 0 ? '#34D399' : '#F87171'}">${state.sp500.price.toFixed(2)}</span>`;
                }
                if (state.vix && state.vix.price) {
                    const vixEl = document.getElementById('tickerVIX');
                    if (vixEl) vixEl.innerHTML = `<span style="color: ${state.vix.change >= 0 ? '#F87171' : '#34D399'}">${state.vix.price.toFixed(2)}</span>`;
                }
            });
        }
    };

    window.IndicePage = IndicePage;
    IndicePage.init();
});
