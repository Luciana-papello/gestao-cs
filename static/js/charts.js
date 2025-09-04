// === CHARTS.JS CORRIGIDO - PAPELLO DASHBOARD ===

// Verificação de segurança crítica
if (typeof Chart === 'undefined') {
    console.error('❌ ERRO CRÍTICO: Chart.js não foi carregado. Gráficos não funcionarão.');
    // Criar objeto Chart mock para evitar erros
    window.Chart = {
        defaults: { font: {}, color: '' },
        register: () => {},
        destroy: () => {}
    };
}

// Cores Papello
const CHART_COLORS = {
    primary: '#96CA00',
    secondary: '#84A802',
    success: '#96CA00',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    premium: '#8b5cf6',
    gold: '#f59e0b',
    silver: '#6b7280',
    bronze: '#dc2626'
};

// Paletas de cores
const COLOR_PALETTES = {
    nivel: {
        'Premium': CHART_COLORS.premium,
        'Gold': CHART_COLORS.gold,
        'Silver': CHART_COLORS.silver,
        'Bronze': CHART_COLORS.bronze
    },
    churn: {
        'Ativo': CHART_COLORS.success,
        'Inativo': CHART_COLORS.danger,
        'Dormant_Bronze': CHART_COLORS.warning,
        'Dormant_Gold': CHART_COLORS.warning,
        'Dormant_Silver': CHART_COLORS.warning,
        'Dormant_Premium': CHART_COLORS.warning,
        'Dormant_Novo': CHART_COLORS.warning
    },
    risco: {
        'Alto Risco': CHART_COLORS.danger,
        'Médio Risco': CHART_COLORS.warning,
        'Baixo Risco': CHART_COLORS.success
    }
};

// Armazenamento dos gráficos
let charts = {};

// === FUNÇÕES PRINCIPAIS ===

function updateDistributionCharts(distributions) {
    console.log('🔄 Atualizando gráficos de distribuição...');
    
    if (!distributions) {
        console.warn('⚠️ Dados de distribuição não fornecidos');
        return;
    }
    
    try {
        // Gráfico de nível
        if (distributions.nivel) {
            updateNivelChart(distributions.nivel);
        }
        
        // Gráfico de risco
        if (distributions.risco) {
            updateRiscoChart(distributions.risco);
        }
        
        console.log('✅ Gráficos de distribuição atualizados');
    } catch (error) {
        console.error('❌ Erro ao atualizar gráficos de distribuição:', error);
        showChartError('Erro ao carregar gráficos de distribuição');
    }
}

function updateRecurrenceCharts(chartsData) {
    console.log('🔄 Atualizando gráficos de recorrência...');
    
    if (!chartsData) {
        console.warn('⚠️ Dados de recorrência não fornecidos');
        return;
    }
    
    try {
        // Gráfico de pizza da recorrência
        if (chartsData.pie_recurrence) {
            updateRecurrencePieChart(chartsData.pie_recurrence);
        }
        
        // Gráfico de barras dos tickets
        if (chartsData.bar_tickets) {
            updateTicketsBarChart(chartsData.bar_tickets);
        }
        
        console.log('✅ Gráficos de recorrência atualizados');
    } catch (error) {
        console.error('❌ Erro ao atualizar gráficos de recorrência:', error);
        showChartError('Erro ao carregar gráficos de recorrência');
    }
}

// === IMPLEMENTAÇÕES DOS GRÁFICOS ===

function updateNivelChart(data) {
    console.log('🔄 Atualizando gráfico de nível...');
    
    const ctx = document.getElementById('chart-nivel-pie');
    if (!ctx) {
        console.warn('⚠️ Canvas chart-nivel-pie não encontrado');
        return;
    }
    
    // Verificação de segurança
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não disponível para gráfico de nível');
        showChartError('Biblioteca de gráficos não carregada', ctx.parentElement);
        return;
    }
    
    try {
        // Destruir gráfico existente
        if (charts.nivelPie) {
            charts.nivelPie.destroy();
        }
        
        const labels = Object.keys(data);
        const values = Object.values(data);
        const colors = labels.map(label => COLOR_PALETTES.nivel[label] || CHART_COLORS.info);
        
        charts.nivelPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Gráfico de nível atualizado');
    } catch (error) {
        console.error('❌ Erro ao criar gráfico de nível:', error);
        showChartError('Erro ao carregar gráfico de distribuição por nível', ctx.parentElement);
    }
}

function updateRiscoChart(data) {
    console.log('🔄 Atualizando gráfico de risco...');
    
    const ctx = document.getElementById('chart-risco-pie');
    if (!ctx) {
        console.warn('⚠️ Canvas chart-risco-pie não encontrado');
        return;
    }
    
    // Verificação de segurança
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não disponível para gráfico de risco');
        showChartError('Biblioteca de gráficos não carregada', ctx.parentElement);
        return;
    }
    
    try {
        // Destruir gráfico existente
        if (charts.riscoPie) {
            charts.riscoPie.destroy();
        }
        
        const labels = Object.keys(data);
        const values = Object.values(data);
        const colors = labels.map(label => COLOR_PALETTES.risco[label] || CHART_COLORS.info);
        
        charts.riscoPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Gráfico de risco atualizado');
    } catch (error) {
        console.error('❌ Erro ao criar gráfico de risco:', error);
        showChartError('Erro ao carregar gráfico de status de risco', ctx.parentElement);
    }
}

function updateRecurrencePieChart(data) {
    console.log('🔄 Atualizando gráfico de pizza de recorrência...');
    
    const ctx = document.getElementById('chart-recurrence-pie');
    if (!ctx) {
        console.warn('⚠️ Canvas chart-recurrence-pie não encontrado');
        return;
    }
    
    // Verificação de segurança
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não disponível para gráfico de recorrência');
        showChartError('Biblioteca de gráficos não carregada', ctx.parentElement);
        return;
    }
    
    try {
        // Destruir gráfico existente
        if (charts.recurrencePie) {
            charts.recurrencePie.destroy();
        }
        
        const labels = Object.keys(data);
        const values = Object.values(data);
        const colors = [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger];
        
        charts.recurrencePie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Gráfico de pizza de recorrência atualizado');
    } catch (error) {
        console.error('❌ Erro ao criar gráfico de recorrência:', error);
        showChartError('Erro ao carregar gráfico de distribuição no período', ctx.parentElement);
    }
}

function updateTicketsBarChart(data) {
    console.log('🔄 Atualizando gráfico de barras de tickets...');
    
    const ctx = document.getElementById('chart-tickets-bar');
    if (!ctx) {
        console.warn('⚠️ Canvas chart-tickets-bar não encontrado');
        return;
    }
    
    // Verificação de segurança
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não disponível para gráfico de tickets');
        showChartError('Biblioteca de gráficos não carregada', ctx.parentElement);
        return;
    }
    
    try {
        // Destruir gráfico existente
        if (charts.ticketsBar) {
            charts.ticketsBar.destroy();
        }
        
        const labels = Object.keys(data);
        const values = Object.values(data);
        
        charts.ticketsBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ticket Médio (R$)',
                    data: values,
                    backgroundColor: CHART_COLORS.primary,
                    borderColor: CHART_COLORS.secondary,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `R$ ${context.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Gráfico de barras de tickets atualizado');
    } catch (error) {
        console.error('❌ Erro ao criar gráfico de tickets:', error);
        showChartError('Erro ao carregar gráfico de comparação de tickets médios', ctx.parentElement);
    }
}

// === FUNÇÕES AUXILIARES ===

function showChartError(message, container) {
    if (!container) return;
    
    const errorHtml = `
        <div class="chart-error text-center p-4">
            <i class="fas fa-chart-pie text-muted mb-2" style="font-size: 2rem;"></i>
            <p class="text-muted mb-0">${message}</p>
            <small class="text-muted">Tente atualizar a página</small>
        </div>
    `;
    
    container.innerHTML = errorHtml;
}

function destroyAllCharts() {
    console.log('🔄 Destruindo todos os gráficos...');
    
    Object.keys(charts).forEach(key => {
        if (charts[key] && typeof charts[key].destroy === 'function') {
            try {
                charts[key].destroy();
                delete charts[key];
            } catch (error) {
                console.warn(`⚠️ Erro ao destruir gráfico ${key}:`, error);
            }
        }
    });
    
    console.log('✅ Todos os gráficos destruídos');
}

// Limpar gráficos quando a página for descarregada
window.addEventListener('beforeunload', destroyAllCharts);

console.log('✅ charts.js inicializado com verificações de segurança');

