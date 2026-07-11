/**
 * =====================================================
 * ATLAS AI — Settings Panel (Ajuste Fino)
 * =====================================================
 * Gerencia o modal de configurações e os pesos do motor.
 * =====================================================
 */

(function () {
    'use strict';

    const STORAGE_KEY = '@Brdolwin:AtlasConfig';
    
    const defaultSettings = {
        threshold: 70,
        weights: {
            trend: 20,
            momentum: 15,
            meanReversion: 15,
            volatility: 10,
            correlation: 10,
            smartMoney: 15,
            statistical: 10,
            breakout: 5
        }
    };

    const AtlasSettings = {
        settings: JSON.parse(JSON.stringify(defaultSettings)),
        
        init() {
            this.load();
            this.injectModal();
            this.bindEvents();
            console.log('[BRDOLWIN] ⚙️ Atlas Settings Initialized');
        },

        async load() {
            try {
                // Fallback: carregar do localStorage enquanto carrega do DB
                const localData = localStorage.getItem(STORAGE_KEY);
                if (localData) {
                    this.settings = { ...defaultSettings, ...JSON.parse(localData) };
                }

                // Sincronizar com a Nuvem se possível
                if (window.BRDOLWINSupabase && window.BRDOLWINSupabase.supabase) {
                    const { data, error } = await window.BRDOLWINSupabase.supabase
                        .from('atlas_settings')
                        .select('*')
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .single();
                        
                    if (data && !error) {
                        this.settings = {
                            threshold: data.threshold,
                            weights: {
                                trend: data.weight_trend,
                                momentum: data.weight_momentum,
                                meanReversion: data.weight_mean_reversion,
                                volatility: data.weight_volatility,
                                correlation: data.weight_correlation,
                                smartMoney: data.weight_smart_money,
                                statistical: data.weight_statistical,
                                breakout: data.weight_breakout
                            }
                        };
                        // Atualiza backup local
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
                    }
                }
            } catch (e) {
                console.error('Erro ao carregar configurações do Atlas:', e);
            }
        },

        async save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));

                if (window.BRDOLWINSupabase && window.BRDOLWINSupabase.supabase) {
                    const payload = {
                        threshold: this.settings.threshold,
                        weight_trend: this.settings.weights.trend,
                        weight_momentum: this.settings.weights.momentum,
                        weight_mean_reversion: this.settings.weights.meanReversion,
                        weight_volatility: this.settings.weights.volatility,
                        weight_correlation: this.settings.weights.correlation,
                        weight_smart_money: this.settings.weights.smartMoney,
                        weight_statistical: this.settings.weights.statistical,
                        weight_breakout: this.settings.weights.breakout
                    };
                    
                    const { error } = await window.BRDOLWINSupabase.supabase
                        .from('atlas_settings')
                        .insert([payload]);
                        
                    if (error) console.error('[Atlas Settings] Erro salvar Supabase:', error.message);
                }

                // Notificar o Orchestrator se estiver carregado
                if (window.BRDOLWINAtlasOrchestrator) {
                    window.BRDOLWINAtlasOrchestrator.updateConfig(this.settings);
                }
                
                // Show notification
                if (window.BRDOLWINUtils && window.BRDOLWINUtils.showToast) {
                    window.BRDOLWINUtils.showToast('Sucesso', 'Configurações enviadas para o Bot na Nuvem!', 'success');
                }
            } catch (e) {
                console.error('Erro ao salvar configurações do Atlas:', e);
            }
        },
        
        getSettings() {
            return { ...this.settings };
        },

        injectModal() {
            const html = `
            <div id="atlasSettingsModal" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div class="modal-content glass-card" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 12px; max-height: 90vh; overflow-y: auto;">
                    <div class="flex-between mb-4">
                        <h2 class="text-xl font-bold flex-center gap-2"><i data-lucide="settings"></i> Ajuste Fino (Atlas AI)</h2>
                        <button id="closeAtlasSettingsBtn" class="btn-secondary" style="padding: 0.5rem;"><i data-lucide="x"></i></button>
                    </div>
                    
                    <div class="settings-group mb-4">
                        <h3 class="text-lg font-bold text-accent mb-2">Sensibilidade de Entrada</h3>
                        <div class="flex-between mb-1">
                            <label class="text-sm text-muted">Consenso Mínimo para Alerta (%)</label>
                            <span id="val-threshold" class="font-bold text-light">${this.settings.threshold}%</span>
                        </div>
                        <input type="range" id="input-threshold" min="50" max="95" value="${this.settings.threshold}" class="w-100 mb-2" style="accent-color: var(--cor-accent-azul);">
                        <p class="text-xs text-muted">Quanto maior, mais conservador (menos sinais falsos, menos entradas).</p>
                    </div>
                    
                    <div class="settings-group mb-4">
                        <h3 class="text-lg font-bold text-accent mb-2">Pesos das Estratégias (Soma = 100%)</h3>
                        <div class="flex-between mb-2">
                            <span class="text-xs text-muted">Total Atual:</span>
                            <span id="totalWeights" class="text-xs font-bold text-green">100%</span>
                        </div>
                        
                        <div class="weight-inputs" style="display: flex; flex-direction: column; gap: 1rem;">
                            ${Object.keys(this.settings.weights).map(key => `
                                <div>
                                    <div class="flex-between mb-1">
                                        <label class="text-sm">${formatStrategyName(key)}</label>
                                        <span id="val-${key}" class="font-bold text-light">${this.settings.weights[key]}%</span>
                                    </div>
                                    <input type="range" data-key="${key}" class="weight-slider w-100" min="0" max="100" value="${this.settings.weights[key]}" style="accent-color: var(--cor-accent-azul);">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="flex-between mt-6">
                        <button id="resetAtlasSettingsBtn" class="btn-secondary text-sm">Restaurar Padrões</button>
                        <button id="saveAtlasSettingsBtn" class="btn-primary flex-center gap-2">
                            <i data-lucide="save" style="width: 16px;"></i> Aplicar e Salvar
                        </button>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.lucide) {
                window.lucide.createIcons();
            }
        },

        bindEvents() {
            const modal = document.getElementById('atlasSettingsModal');
            if (!modal) return;
            
            // Close behavior
            document.getElementById('closeAtlasSettingsBtn').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            // Threshold slider
            const thresholdInput = document.getElementById('input-threshold');
            const thresholdVal = document.getElementById('val-threshold');
            thresholdInput.addEventListener('input', (e) => {
                thresholdVal.textContent = e.target.value + '%';
            });
            
            // Weights sliders
            const weightSliders = document.querySelectorAll('.weight-slider');
            const totalWeightsLabel = document.getElementById('totalWeights');
            
            const updateTotal = () => {
                let total = 0;
                weightSliders.forEach(slider => total += parseInt(slider.value));
                totalWeightsLabel.textContent = total + '%';
                totalWeightsLabel.className = total === 100 ? 'text-xs font-bold text-green' : 'text-xs font-bold text-red';
            };
            
            weightSliders.forEach(slider => {
                slider.addEventListener('input', (e) => {
                    document.getElementById('val-' + e.target.dataset.key).textContent = e.target.value + '%';
                    updateTotal();
                });
            });
            
            // Reset Button
            document.getElementById('resetAtlasSettingsBtn').addEventListener('click', () => {
                thresholdInput.value = defaultSettings.threshold;
                thresholdVal.textContent = defaultSettings.threshold + '%';
                
                weightSliders.forEach(slider => {
                    const k = slider.dataset.key;
                    slider.value = defaultSettings.weights[k];
                    document.getElementById('val-' + k).textContent = defaultSettings.weights[k] + '%';
                });
                updateTotal();
            });
            
            // Save Button
            document.getElementById('saveAtlasSettingsBtn').addEventListener('click', () => {
                let total = 0;
                weightSliders.forEach(slider => total += parseInt(slider.value));
                
                if (total !== 100) {
                    alert('A soma dos pesos das estratégias deve ser exatamente 100%. Atualmente é ' + total + '%.');
                    return;
                }
                
                this.settings.threshold = parseInt(thresholdInput.value);
                weightSliders.forEach(slider => {
                    this.settings.weights[slider.dataset.key] = parseInt(slider.value);
                });
                
                this.save();
                modal.style.display = 'none';
            });
        },
        
        openModal() {
            const modal = document.getElementById('atlasSettingsModal');
            if (modal) {
                // Ensure inputs match current state
                document.getElementById('input-threshold').value = this.settings.threshold;
                document.getElementById('val-threshold').textContent = this.settings.threshold + '%';
                
                const weightSliders = document.querySelectorAll('.weight-slider');
                weightSliders.forEach(slider => {
                    const k = slider.dataset.key;
                    slider.value = this.settings.weights[k];
                    document.getElementById('val-' + k).textContent = this.settings.weights[k] + '%';
                });
                
                modal.style.display = 'flex';
            }
        }
    };
    
    function formatStrategyName(key) {
        const names = {
            trend: 'Tendência',
            momentum: 'Momentum',
            meanReversion: 'Reversão à Média',
            volatility: 'Volatilidade (Bands/ATR)',
            correlation: 'Correlação Macro',
            smartMoney: 'Smart Money (Fluxo)',
            statistical: 'Z-Score Estatístico',
            breakout: 'Rompimento'
        };
        return names[key] || key;
    }

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AtlasSettings.init());
    } else {
        AtlasSettings.init();
    }
    
    window.BRDOLWINAtlasSettings = AtlasSettings;

})();
