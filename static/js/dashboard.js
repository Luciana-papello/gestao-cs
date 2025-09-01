// Dashboard Papello - JavaScript Principal (VERSÃO CORRIGIDA)

// Variáveis globais
let dashboardData = null;
let charts = {};
let isLoading = false;

// Configurações
const API_BASE = '/api';
const COLORS = {
    primary: '#96CA00',
    secondary: '#84A802',
    success: '#96CA00',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6'
};

// === INICIALIZAÇÃO ===
function initializeDashboard() {
    console.log('🎯 Inicializando Dashboard Papello...');
    
    // Event listeners globais
    setupEventListeners();
    
    // Verificar se estamos na página executiva
    if (window.location.pathname === '/executive' || window.location.pathname === '/') {
        loadExecutiveDashboard();
    }
    
    console.log('✅ Dashboard inicializado');
}

function setupEventListeners() {
    // Botão de refresh global
    $(document).on('click', '[onclick="refreshData()"]', function(e) {
        e.preventDefault();
        refreshData();
    });
    
    // Período rápido para recorrência
    $('#quick-period').change(function() {
        const days = $(this).val();
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(days));
        
        $('#recurrence-start').val(formatDate(startDate));
        $('#recurrence-end').val(formatDate(endDate));
        
        updatePeriodInfo();
    });
}

// === CARREGAMENTO DE DADOS ===
function loadExecutiveDashboard() {
    if (isLoading) return;
    
    console.log('📊 Carregando dados executivos...');
    showLoading();
    
    $.ajax({
        url: `${API_BASE}/executive-data`,
        method: 'GET',
        timeout: 30000,
        success: function(data) {
            console.log('✅ Dados recebidos da API:', data);
            dashboardData = data;
            
            // Atualizar apenas as funções que existem
            updateExecutiveKPIs(data.kpis);
            
            // Outras funções apenas se os dados existirem
            if (data.recurrence && Object.keys(data.recurrence).length > 0) {
                updateRecurrenceMetrics(data.recurrence);
            }
            
            if (data.satisfaction) {
                updateSatisfactionCards(data.satisfaction);
            }
            
            if (data.distributions) {
                updateDistributionCards(data.distributions);
            }
            
            if (data.critical_analysis) {
                updateCriticalAnalysisCards(data.critical_analysis);
            }
            
            updateLastUpdate(data.latest_update);
            hideLoading();
            console.log('✅ Dados carregados com sucesso');
        },
        error: function(xhr, status, error) {
            console.error('❌ Erro ao carregar dados:', error);
            hideLoading();
            showAlert('Erro ao carregar dados do dashboard. Verifique a conexão.', 'danger');
        }
    });
}

function refreshData() {
    if (isLoading) return;
    
    console.log('🔄 Atualizando dados...');
    
    // Primeiro limpar cache
    $.ajax({
        url: `${API_BASE}/refresh-data`,
        method: 'GET',
        success: function() {
            // Recarregar dados principais
            if (window.location.pathname === '/executive' || window.location.pathname === '/') {
                loadExecutiveDashboard();
            }
            showAlert('Dados atualizados com sucesso!', 'success');
        },
        error: function() {
            showAlert('Erro ao atualizar dados', 'danger');
        }
    });
}

// === ATUALIZAÇÃO DE KPIS ===
function updateExecutiveKPIs(kpis) {
    console.log('📊 Atualizando KPIs:', kpis);
    
    // Total de clientes
    updateMetricCard('card-total-clientes', {
        value: kpis.total_clientes.value,
        trend: kpis.total_clientes.subtitle,
        colorClass: 'info'
    });
    
    // Taxa de retenção
    updateMetricCard('card-retencao', {
        value: kpis.taxa_retencao.value,
        trend: kpis.taxa_retencao.subtitle,
        colorClass: kpis.taxa_retencao.color_class || 'success'
    });
    
    // Clientes críticos
    updateMetricCard('card-criticos', {
        value: kpis.taxa_criticos.value,
        trend: kpis.taxa_criticos.subtitle,
        colorClass: kpis.taxa_criticos.color_class || 'warning'
    });
    
    // Receita total
    updateMetricCard('card-receita', {
        value: kpis.receita_total.value,
        trend: kpis.receita_total.subtitle,
        colorClass: 'success'
    });
}

function updateRecurrenceMetrics(recurrence) {
    console.log('🔄 Atualizando métricas de recorrência:', recurrence);
    
    if (!recurrence || Object.keys(recurrence).length === 0) {
        showRecurrenceNoData();
        return;
    }
    
    // Novos clientes
    updateMetricCard('card-novos-clientes', {
        value: formatNumber(recurrence.pedidos_primeira || 0),
        trend: 'Período selecionado',
        colorClass: 'info'
    });
    
    // Recompras
    updateMetricCard('card-recompras', {
        value: formatNumber(recurrence.pedidos_recompra || 0),
        trend: 'Período selecionado',
        colorClass: 'success'
    });
    
    // Taxa de conversão
    const taxaConversao = recurrence.taxa_conversao || 0;
    const colorClass = taxaConversao >= 30 ? 'success' : taxaConversao >= 15 ? 'warning' : 'danger';
    updateMetricCard('card-conversao', {
        value: `${taxaConversao.toFixed(1)}%`,
        trend: 'Primeira → Recompra',
        colorClass: colorClass
    });
    
    // Ticket recompra
    const ticketPrimeira = recurrence.ticket_primeira || 0;
    const ticketRecompra = recurrence.ticket_recompra || 0;
    const diferenca = ticketPrimeira > 0 ? ((ticketRecompra - ticketPrimeira) / ticketPrimeira * 100) : 0;
    const trendText = diferenca > 0 ? `↗️ +${diferenca.toFixed(1)}% vs 1ª compra` : 
                     diferenca < 0 ? `↘️ ${diferenca.toFixed(1)}% vs 1ª compra` : 
                     '➡️ Igual à 1ª compra';
    
    updateMetricCard('card-ticket-recompra', {
        value: `R$ ${formatNumber(ticketRecompra)}`,
        trend: trendText,
        colorClass: diferenca >= 0 ? 'success' : 'warning'
    });
}

// === NOVAS FUNÇÕES PARA SUBSTITUIR AS QUE FALTAM ===
function updateSatisfactionCards(satisfaction) {
    console.log('⭐ Atualizando satisfação:', satisfaction);
    
    // Atendimento
    if (satisfaction.atendimento) {
        updateMetricCard('card-atendimento', {
            value: satisfaction.atendimento.value,
            trend: satisfaction.atendimento.trend,
            colorClass: satisfaction.atendimento.color_class
        });
    }
    
    // Produto  
    if (satisfaction.produto) {
        updateMetricCard('card-produto', {
            value: satisfaction.produto.value,
            trend: satisfaction.produto.trend,
            colorClass: satisfaction.produto.color_class
        });
    }
    
    // Prazo
    if (satisfaction.prazo) {
        updateMetricCard('card-prazo', {
            value: satisfaction.prazo.value,
            trend: satisfaction.prazo.trend,
            colorClass: satisfaction.prazo.color_class
        });
    }
    
    // NPS
    if (satisfaction.nps) {
        updateMetricCard('card-nps', {
            value: satisfaction.nps.value,
            trend: satisfaction.nps.trend,
            colorClass: satisfaction.nps.color_class
        });
    }
}

function updateDistributionCards(distributions) {
    console.log('📊 Atualizando distribuições:', distributions);
    
    // Status da Base de Clientes
    if (distributions.churn) {
        const churnData = distributions.churn;
        const total = Object.values(churnData).reduce((a, b) => a + b, 0);
        
        const baseTotal = total;
        const ativos = churnData['Ativo'] || 0;
        const inativos = churnData['Inativo'] || 0;
        const dormant = Object.keys(churnData).filter(k => k.includes('Dormant')).reduce((sum, k) => sum + (churnData[k] || 0), 0);
        
        // Atualizar cards de status
        updateStatusCard('BASE TOTAL', baseTotal, 'Clientes únicos', 'Clientes com pelo menos 1 pedido nos últimos 24 meses');
        updateStatusCard('ATIVOS', ativos, 'Carregando...', 'Compraram dentro do prazo esperado para seu perfil');
        updateStatusCard('INATIVOS', inativos, 'Carregando...', 'Não compram há muito tempo (>3x intervalo normal)');
        updateStatusCard('DORMANT', dormant, 'Carregando...', 'Atrasados da próxima compra (>2x intervalo normal)');
    }
    
    // Distribuição por Nível
    if (distributions.nivel) {
        updateDistributionChart('nivel-chart', distributions.nivel, 'Distribuição por Nível');
    }
    
    // Status de Risco  
    if (distributions.risco) {
        updateDistributionChart('risco-chart', distributions.risco, 'Status de Risco');
    }
}

function updateCriticalAnalysisCards(analysis) {
    console.log('🔍 Atualizando análises críticas:', analysis);
    
    // Clientes Premium em Risco
    const premiumRisk = analysis.premium_em_risco || 0;
    const totalPremium = analysis.total_premium || 0;
    const receitaRisco = analysis.receita_em_risco || 0;
    
    let premiumContent = '';
    if (premiumRisk > 0) {
        premiumContent = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Atenção Urgente</h6>
                <p><strong>${premiumRisk} clientes Premium/Gold</strong> estão em risco médio/alto</p>
                <p><strong>R$ ${formatNumber(receitaRisco)}</strong> em receita potencial em risco</p>
                <p><small>De um total de ${totalPremium} clientes premium</small></p>
            </div>
        `;
    } else {
        premiumContent = `
            <div class="alert alert-success">
                <h6><i class="fas fa-check-circle me-2"></i>Situação Controlada</h6>
                <p>Todos os ${totalPremium} clientes Premium/Gold estão com baixo risco</p>
            </div>
        `;
    }
    
    $('#premium-risk-analysis').html(premiumContent);
    
    // Métricas em Atenção - Resumo baseado nos dados
    let metricsContent = `
        <div class="row text-center">
            <div class="col-6 mb-3">
                <div class="h4 text-danger">${premiumRisk}</div>
                <small>Premium em Risco</small>
            </div>
            <div class="col-6 mb-3">
                <div class="h4 text-warning">R$ ${formatNumber(receitaRisco/1000)}K</div>
                <small>Receita em Risco</small>
            </div>
        </div>
    `;
    
    $('#metrics-attention').html(metricsContent);
    
    // Resumo Executivo
    let resumo = '';
    if (premiumRisk > 0) {
        resumo = `🚨 **AÇÃO URGENTE**: ${premiumRisk} clientes Premium em risco. Reunião de CS recomendada.`;
    } else {
        resumo = `🎉 **SITUAÇÃO EXCELENTE**: Todos os indicadores estão saudáveis. Continuar com as práticas atuais.`;
    }
    
    $('#executive-summary .alert-content').html(`<div class="alert alert-info">${resumo}</div>`);
}

// === FUNÇÕES AUXILIARES ===
function updateMetricCard(cardId, data) {
    const card = $(`#${cardId}`);
    if (card.length === 0) {
        console.warn(`⚠️ Card não encontrado: ${cardId}`);
        return;
    }
    
    try {
        // Atualizar classe de cor
        card.removeClass('success warning danger info').addClass(data.colorClass);
        
        // Atualizar valor (remover skeleton)
        const valueEl = card.find('.metric-value');
        valueEl.removeClass('skeleton').text(data.value);
        
        // Atualizar trend
        card.find('.metric-trend').text(data.trend);
        
        console.log(`✅ Card atualizado: ${cardId} = ${data.value}`);
    } catch (error) {
        console.error(`❌ Erro ao atualizar card ${cardId}:`, error);
    }
}

function updateStatusCard(title, value, status, description) {
    // Criar ou atualizar card de status na seção "Status da Base de Clientes"
    const container = $('.status-cards-container');
    if (container.length === 0) return;
    
    const cardHtml = `
        <div class="col-lg-3 col-md-6 mb-3">
            <div class="metric-card">
                <div class="metric-title">${title}</div>
                <div class="metric-value">${formatNumber(value)}</div>
                <div class="metric-trend">${status}</div>
                <div style="font-size: 0.8rem; color: #666; margin-top: 8px;">${description}</div>
            </div>
        </div>
    `;
    
    // Esta é uma implementação simplificada - na prática você ajustaria baseado no HTML real
}

function updateDistributionChart(chartId, data, title) {
    // Implementação simplificada - sem Chart.js por enquanto
    const container = $(`#${chartId}`);
    if (container.length === 0) return;
    
    let html = `<div class="chart-placeholder">
        <h6>${title}</h6>
        <div class="chart-simple">`;
    
    Object.entries(data).forEach(([key, value]) => {
        const percentage = (value / Object.values(data).reduce((a, b) => a + b, 0)) * 100;
        html += `
            <div class="chart-item mb-2">
                <span class="chart-label">${key}</span>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar" style="width: ${percentage}%; background: ${COLORS.primary};">
                        ${value} (${percentage.toFixed(1)}%)
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    container.html(html);
}

function showRecurrenceNoData() {
    const cards = ['card-novos-clientes', 'card-recompras', 'card-conversao', 'card-ticket-recompra'];
    cards.forEach(cardId => {
        updateMetricCard(cardId, {
            value: 'N/A',
            trend: 'Sem dados no período',
            colorClass: 'warning'
        });
    });
}

function formatNumber(value) {
    if (!value || value === 0) return '0';
    
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    if (num >= 1000000) {
        return `${(num/1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
        return `${(num/1000).toFixed(0)}K`;
    } else {
        return num.toLocaleString('pt-BR');
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoading() {
    isLoading = true;
    const overlay = $('#loading-overlay');
    if (overlay.length > 0) {
        overlay.removeClass('d-none');
    }
}

function hideLoading() {
    isLoading = false;
    const overlay = $('#loading-overlay');
    if (overlay.length > 0) {
        overlay.addClass('d-none');
    }
}

function showAlert(message, type = 'info') {
    console.log(`🔔 Alert: ${message}`);
    
    // Implementação simplificada para evitar loops infinitos
    try {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show mt-3" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;">
                ${message}
                <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
            </div>
        `;
        
        $('body').append(alertHtml);
        
        // Auto-dismiss após 5 segundos
        setTimeout(() => {
            $('.alert').fadeOut(500, function() { $(this).remove(); });
        }, 5000);
    } catch (error) {
        // Fallback para console se houver erro
        console.log(`Alert: ${message}`);
    }
}

function updateLastUpdate(date) {
    const element = $('#last-update');
    if (element.length > 0 && date && date !== 'N/A') {
        element.text(date);
    }
}

function updatePeriodInfo() {
    const startDate = $('#recurrence-start').val();
    const endDate = $('#recurrence-end').val();
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        
        $('#period-info').text(`Período: ${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')} (${days} dias)`);
    }
}

// === INICIALIZAÇÃO AUTOMÁTICA ===
$(document).ready(function() {
    console.log('📱 DOM carregado - Inicializando dashboard');
    initializeDashboard();
});

// === EXPORTAR FUNÇÕES GLOBAIS ===
window.dashboardPapello = {
    init: initializeDashboard,
    refresh: refreshData,
    loadExecutive: loadExecutiveDashboard
};

// === ADICIONAR NO FINAL DO dashboard.js ===

// Função que estava faltando
function initializeDateFilters() {
    console.log('📅 Inicializando filtros de data');
    
    // Definir datas padrão para recorrência (últimos 6 meses)
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    // Verificar se os elementos existem antes de definir valores
    const recurrenceStart = document.getElementById('recurrence-start');
    const recurrenceEnd = document.getElementById('recurrence-end');
    
    if (recurrenceStart && recurrenceEnd) {
        recurrenceStart.value = formatDate(sixMonthsAgo);
        recurrenceEnd.value = formatDate(today);
    }
    
    // Definir datas padrão para satisfação (últimos 30 dias) 
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const satisfactionStart = document.getElementById('satisfaction-start');
    const satisfactionEnd = document.getElementById('satisfaction-end');
    
    if (satisfactionStart && satisfactionEnd) {
        satisfactionStart.value = formatDate(thirtyDaysAgo);
        satisfactionEnd.value = formatDate(today);
    }
    
    updatePeriodInfo();
}

// Função para análise de recorrência
function updateRecurrenceAnalysis() {
    const startDate = $('#recurrence-start').val();
    const endDate = $('#recurrence-end').val();
    
    if (!startDate || !endDate) {
        showAlert('Selecione as datas inicial e final', 'warning');
        return;
    }
    
    showLoading();
    
    $.ajax({
        url: `${API_BASE}/recurrence-data`,
        method: 'GET',
        data: {
            data_inicio: startDate,
            data_fim: endDate
        },
        success: function(data) {
            updateRecurrenceMetrics(data.metrics);
            if (data.charts_data) {
                updateRecurrenceCharts(data.charts_data);
            }
            updatePeriodInfo();
            hideLoading();
            showAlert('Análise de recorrência atualizada!', 'success');
        },
        error: function(xhr, status, error) {
            console.error('Erro ao atualizar recorrência:', error);
            hideLoading();
            showAlert('Erro ao analisar recorrência', 'danger');
        }
    });
}

// Adicionar às exportações globais
window.initializeDateFilters = initializeDateFilters;
window.updateRecurrenceAnalysis = updateRecurrenceAnalysis;

// Funções que podem ser chamadas do HTML
window.refreshData = refreshData;
window.initializeDashboard = initializeDashboard;