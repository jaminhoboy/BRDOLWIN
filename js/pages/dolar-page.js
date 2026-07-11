// js/pages/dolar-page.js
document.addEventListener('DOMContentLoaded', () => {
    if (window.BRDOLWINRouter && !window.BRDOLWINRouter.checkAuth()) return;

    const DolarPage = {
        gaugeChart: null,
        currentHorizon: '30m',

        init() {
            this.initTabs();
            this.initGauge();
            this.subscribeToMarketState();
        },

        initTabs() {
            const probTabs = document.querySelectorAll('#probTabs button');
            probTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    probTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    this.currentHorizon = e.target.textContent;
                    if (window.BRDOLWINState) window.BRDOLWINState.notifyListeners();
                });
            });
        },

        initGauge() {
            const gaugeContainer = document.getElementById('wdoGauge');
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
                if (state.wdo && state.wdo.price) {
                    document.getElementById('wdoPrice').textContent = window.BRDOLWINUtils.formatPrice(state.wdo.price, 2);
                    
                    const changeEl = document.getElementById('wdoChange');
                    const change = state.wdo.changePercent || 0;
                    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
                    changeEl.className = change >= 0 ? 'text-green ml-2' : 'text-red ml-2';

                    document.getElementById('execWdoEntry').textContent = window.BRDOLWINUtils.formatPrice(state.wdo.price, 2) + ' (Spot)';
                    document.getElementById('execWdoStop').textContent = window.BRDOLWINUtils.formatPrice(state.wdo.price - 10, 2);
                    document.getElementById('execWdoTarget').textContent = window.BRDOLWINUtils.formatPrice(state.wdo.price + 20, 2);
                }

                let probHigh = 0, probLow = 0, probSide = 0;
                
                if (this.currentHorizon === '30m') {
                    probHigh = 30; probLow = 55; probSide = 15;
                } else if (this.currentHorizon === '1h') {
                    probHigh = 35; probLow = 45; probSide = 20;
                }

                document.getElementById('wdoProbHigh').textContent = probHigh + '%';
                document.getElementById('wdoProbLow').textContent = probLow + '%';
                
                const wdoBarHigh = document.getElementById('wdoBarHigh');
                if (wdoBarHigh) wdoBarHigh.style.width = probHigh + '%';
                
                const wdoBarLow = document.getElementById('wdoBarLow');
                if (wdoBarLow) wdoBarLow.style.width = probLow + '%';

                this.updateGauge(probHigh);

                if (state.sp500 && state.sp500.price) {
                    const spEl = document.getElementById('tickerSP500');
                    if (spEl) spEl.innerHTML = `<span style="color: ${state.sp500.change >= 0 ? '#34D399' : '#F87171'}">${state.sp500.price.toFixed(2)}</span>`;
                }
                if (state.dxy && state.dxy.price) {
                    const dxyEl = document.getElementById('tickerDXY');
                    if (dxyEl) dxyEl.innerHTML = `<span style="color: ${state.dxy.change >= 0 ? '#34D399' : '#F87171'}">${state.dxy.price.toFixed(2)}</span>`;
                }
                if (state.vix && state.vix.price) {
                    const vixEl = document.getElementById('tickerVIX');
                    if (vixEl) vixEl.innerHTML = `<span style="color: ${state.vix.change >= 0 ? '#F87171' : '#34D399'}">${state.vix.price.toFixed(2)}</span>`;
                }
            });
        }
    };

    window.DolarPage = DolarPage;
    DolarPage.init();
});
