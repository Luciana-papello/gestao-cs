// Dashboard Papello - Gráficos com Chart.js

// Configurações globais dos gráficos
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';

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
        'Dormant': CHART_COLORS.warning
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
    if (!distributions) return;
    
    // Gráfico de nível
    if (distributions.nivel) {
        createNivelPieChart(distributions.nivel);
    }
    
    // Gráfico de risco
    if (distributions.risco) {
        createRiscoBarChart(distributions.risco);
    }
}

function updateRecurrenceCharts(chartsData) {
    if (!chartsData) return;
    
    // Gráfico de pizza da recorrência
    if (chartsData.pie_recurrence) {
        createRecurrencePieChart(chartsData.pie_recurrence);
    }
    
    // Gráfico de barras dos tickets
    if (chartsData.bar_tickets) {
        createTicketsBarChart(chartsData.bar_tickets);
    }
}

// === GRÁFICOS ESPECÍFICOS ===

function createNivelPieChart(data) {
    const ctx = document.getElementById('chart-nivel-pie');
    if (!ctx) return;
    
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
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverBorderWidth: 3
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
                        usePointStyle: true,
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed * 100) / total).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000
            },
            cutout: '50%'
        }
    });
}

function createRiscoBarChart(data) {
    const ctx = document.getElementById('chart-risco-bar');
    if (!ctx) return;
    
    // Destruir gráfico existente
    if (charts.riscoBar) {
        charts.riscoBar.destroy();
    }
    
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = labels.map(label => COLOR_PALETTES.risco[label] || CHART_COLORS.info);
    
    charts.riscoBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.x} clientes`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    },
                    title: {
                        display: true,
                        text: 'Quantidade de Clientes',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function createRecurrencePieChart(data) {
    const ctx = document.getElementById('chart-recurrence-pie');
    if (!ctx) return;
    
    // Destruir gráfico existente
    if (charts.recurrencePie) {
        charts.recurrencePie.destroy();
    }
    
    const { labels, values, colors } = data;
    
    // Verificar se há dados
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) {
        showNoDataMessage(ctx, 'Nenhum dado de recorrência no período selecionado');
        return;
    }
    
    charts.recurrencePie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverBorderWidth: 3
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
                        usePointStyle: true,
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const percentage = ((context.parsed * 100) / total).toFixed(1);
                            return `${context.label}: ${context.parsed} pedidos (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000
            },
            cutout: '50%'
        }
    });
}

function createTicketsBarChart(data) {
    const ctx = document.getElementById('chart-tickets-bar');
    if (!ctx) return;
    
    // Destruir gráfico existente
    if (charts.ticketsBar) {
        charts.ticketsBar.destroy();
    }
    
    const { labels, values, colors } = data;
    
    // Verificar se há dados
    const hasData = values.some(value => value > 0);
    if (!hasData) {
        showNoDataMessage(ctx, 'Nenhum dado de ticket médio no período');
        return;
    }
    
    charts.ticketsBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false
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
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: R$ ${context.parsed.y.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    },
                    title: {
                        display: true,
                        text: 'Valor Médio (R$)',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

// === GRÁFICOS DE SATISFAÇÃO ===

function createNPSGaugeChart(npsValue) {
    const ctx = document.getElementById('chart-nps-gauge');
    if (!ctx) return;
    
    // Destruir gráfico existente
    if (charts.npsGauge) {
        charts.npsGauge.destroy();
    }
    
    // Determinar cor baseada no valor do NPS
    let color = CHART_COLORS.danger;
    if (npsValue >= 50) color = CHART_COLORS.success;
    else if (npsValue >= 0) color = CHART_COLORS.warning;
    
    charts.npsGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [Math.max(0, npsValue + 100), Math.max(0, 100 - (npsValue + 100))],
                backgroundColor: [color, 'rgba(0,0,0,0.1)'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
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
                    enabled: false
                }
            },
            cutout: '75%'
        },
        plugins: [{
            beforeDraw: function(chart) {
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;
                
                ctx.restore();
                const fontSize = (height / 100).toFixed(2);
                ctx.font = `${fontSize}em Inter, sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.fillStyle = color;
                
                const text = npsValue.toFixed(0);
                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                const textY = height / 1.4;
                
                ctx.fillText(text, textX, textY);
                ctx.save();
            }
        }]
    });
}

// === UTILITÁRIOS ===

function showNoDataMessage(canvas, message) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, width / 2, height / 2);
}

function destroyAllCharts() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};
}

// === CONFIGURAÇÕES RESPONSIVAS ===

function updateChartsResponsive() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
}

// Event listener para redimensionamento
window.addEventListener('resize', debounce(updateChartsResponsive, 300));

// Função debounce para otimizar performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// === EXPORTAR FUNÇÕES ===
window.chartsPapello = {
    updateDistributions: updateDistributionCharts,
    updateRecurrence: updateRecurrenceCharts,
    createNPSGauge: createNPSGaugeChart,
    destroyAll: destroyAllCharts,
    updateResponsive: updateChartsResponsive
};

// Limpar gráficos ao descarregar página
window.addEventListener('beforeunload', destroyAllCharts);