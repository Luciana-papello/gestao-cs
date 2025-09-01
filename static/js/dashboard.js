// Dashboard Papello - JavaScript Principal

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
    
    // Custom period checkbox para satisfação
    $('#custom-period-satisfaction').change(function() {
        const isCustom = $(this).is(':checked');
        $('#satisfaction-start, #satisfaction-end').prop('disabled', !isCustom);
        
        if (!isCustom) {
            // Definir últimos 30 dias
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
            
            $('#satisfaction-start').val(formatDate(startDate));
            $('#satisfaction-end').val(formatDate(endDate));
        }
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
            dashboardData = data;
            updateExecutiveKPIs(data.kpis);
            updateRecurrenceMetrics(data.recurrence);
            updateSatisfactionMetrics(data.satisfaction);
            updateDistributionCharts(data.distributions);
            updateCriticalAnalysis(data.critical_analysis);
            updateLastUpdate(data.latest_update);
            hideLoading();
            console.log('✅ Dados carregados com sucesso');
        },
        error: function(xhr, status, error) {
            console.error('❌ Erro ao carregar dados:', error);
            hideLoading();
            showAlert('Erro ao carregar dados do dashboard', 'danger');
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
        colorClass: kpis.taxa_retencao.color_class
    });
    
    // Clientes críticos
    updateMetricCard('card-criticos', {
        value: kpis.taxa_criticos.value,
        trend: kpis.taxa_criticos.subtitle,
        colorClass: kpis.taxa_criticos.color_class
    });
    
    // Receita total
    updateMetricCard('card-receita', {
        value: kpis.receita_total.value,
        trend: kpis.receita_total.subtitle,
        colorClass: 'success'
    });
}

function updateRecurrenceMetrics(recurrence) {
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

function updateSatisfactionMetrics(satisfaction) {
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
        
        // Mostrar botão de análise detalhada se tiver dados
        if (satisfaction.nps.details && satisfaction.nps.details.total_validas > 0) {
            $('#show-nps-button').show();
            updateNPSDetails(satisfaction.nps.details);
        } else {
            $('#show-nps-button').hide();
        }
    }
}

// === FUNÇÕES AUXILIARES ===
function updateMetricCard(cardId, data) {
    const card = $(`#${cardId}`);
    if (card.length === 0) return;
    
    // Atualizar classe de cor
    card.removeClass('success warning danger info').addClass(data.colorClass);
    
    // Atualizar valor (remover skeleton)
    const valueEl = card.find('.metric-value');
    valueEl.removeClass('skeleton').text(data.value);
    
    // Atualizar trend
    card.find('.metric-trend').text(data.trend);
    
    // Adicionar animação
    card.addClass('fade-in-up');
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

function updateNPSDetails(details) {
    $('#nps-promotores').text(details.promotores || 0);
    $('#nps-neutros').text(details.neutros || 0);
    $('#nps-detratores').text(details.detratores || 0);
    $('#nps-total').text(details.total_validas || 0);
    
    // Interpretação
    const nps = details.nps_valor || 0;
    let interpretacao = '';
    let alertClass = 'alert-info';
    
    if (nps >= 75) {
        interpretacao = `🏆 **EXCELENTE**: NPS ${nps.toFixed(0)} - NPS excepcional! Seus clientes são verdadeiros defensores da marca.`;
        alertClass = 'alert-success';
    } else if (nps >= 50) {
        interpretacao = `🌟 **MUITO BOM**: NPS ${nps.toFixed(0)} - NPS muito bom! Maioria dos clientes recomendaria sua empresa.`;
        alertClass = 'alert-success';
    } else if (nps >= 30) {
        interpretacao = `✅ **BOM**: NPS ${nps.toFixed(0)} - NPS na zona de qualidade. Há espaço para melhorias.`;
        alertClass = 'alert-info';
    } else if (nps >= 0) {
        interpretacao = `⚠️ **PRECISA MELHORAR**: NPS ${nps.toFixed(0)} - NPS na zona de melhoria. Foque em reduzir detratores.`;
        alertClass = 'alert-warning';
    } else {
        interpretacao = `🚨 **CRÍTICO**: NPS ${nps.toFixed(0)} - NPS negativo indica mais detratores que promotores. Ação urgente!`;
        alertClass = 'alert-danger';
    }
    
    $('#nps-interpretation').removeClass().addClass(`alert ${alertClass}`).html(interpretacao);
    
    // Fórmula
    $('#nps-formula').text(`NPS = ((${details.promotores} - ${details.detratores}) / ${details.total_validas}) × 100 = ${nps.toFixed(1)}`);
}

function updateCriticalAnalysis(analysis) {
    // Premium em risco
    const premiumRisk = analysis.premium_em_risco || 0;
    const totalPremium = analysis.total_premium || 1;
    const taxaPremiumRisco = (premiumRisk / totalPremium * 100);
    const receitaRisco = analysis.receita_em_risco || 0;
    
    let premiumContent = '';
    if (premiumRisk > 0) {
        premiumContent = `
            <div class="alert alert-danger">
                🚨 <strong>${premiumRisk} clientes Premium/Gold em risco</strong> (${taxaPremiumRisco.toFixed(1)}%)
                <br>💰 Receita em risco: R$ ${formatNumber(receitaRisco/1000)}K
            </div>
        `;
    } else {
        premiumContent = `
            <div class="alert alert-success">
                ✅ Nenhum cliente Premium/Gold em risco no momento!
            </div>
        `;
    }
    
    $('#premium-risk-analysis').html(premiumContent);
    
    // Resumo executivo baseado nos dados
    let resumo = '';
    let resumoClass = 'alert-success';
    
    if (premiumRisk > 0) {
        resumo = `🚨 **AÇÃO URGENTE**: ${premiumRisk} clientes Premium em risco. Reunião de CS recomendada.`;
        resumoClass = 'alert-danger';
    } else {
        resumo = `🎉 **SITUAÇÃO EXCELENTE**: Todos os indicadores estão saudáveis. Continuar com as práticas atuais de Customer Success.`;
        resumoClass = 'alert-success';
    }
    
    $('#executive-summary .alert-content').html(`<div class="alert ${resumoClass}">${resumo}</div>`);
}

// === UTILITÁRIOS ===
function formatNumber(value) {
    if (!value || value === 0) return '0';
    
    const num = parseFloat(value);
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
    $('#loading-overlay').removeClass('d-none');
}

function hideLoading() {
    isLoading = false;
    $('#loading-overlay').addClass('d-none');
}

function showAlert(message, type = 'info') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('#global-alerts').html(alertHtml);
    
    // Auto-dismiss após 5 segundos
    setTimeout(() => {
        $('#global-alerts .alert').alert('close');
    }, 5000);
}

function updateLastUpdate(date) {
    if (date && date !== 'N/A') {
        $('#last-update').text(date);
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

// === FUNÇÕES ESPECÍFICAS ===
function initializeDateFilters() {
    // Definir datas padrão para recorrência (últimos 6 meses)
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    $('#recurrence-start').val(formatDate(sixMonthsAgo));
    $('#recurrence-end').val(formatDate(today));
    
    // Definir datas padrão para satisfação (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    $('#satisfaction-start').val(formatDate(thirtyDaysAgo));
    $('#satisfaction-end').val(formatDate(today));
    
    updatePeriodInfo();
}

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
            updateRecurrenceCharts(data.charts_data);
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

function updateSatisfactionMetrics() {
    const startDate = $('#satisfaction-start').val();
    const endDate = $('#satisfaction-end').val();
    
    if (!startDate || !endDate) {
        showAlert('Selecione as datas inicial e final', 'warning');
        return;
    }
    
    showLoading();
    
    $.ajax({
        url: `${API_BASE}/satisfaction-data`,
        method: 'GET',
        data: {
            data_inicio: startDate,
            data_fim: endDate
        },
        success: function(data) {
            updateSatisfactionMetrics(data.metrics);
            hideLoading();
            showAlert('Métricas de satisfação atualizadas!', 'success');
        },
        error: function(xhr, status, error) {
            console.error('Erro ao atualizar satisfação:', error);
            hideLoading();
            showAlert('Erro ao analisar satisfação', 'danger');
        }
    });
}

function toggleNPSAnalysis() {
    const analysis = $('#nps-detailed-analysis');
    const button = $('#show-nps-button');
    
    if (analysis.is(':visible')) {
        analysis.slideUp();
        button.show();
    } else {
        analysis.slideDown();
        button.hide();
    }
}

// === EXPORT ===
window.dashboardPapello = {
    init: initializeDashboard,
    refresh: refreshData,
    loadExecutive: loadExecutiveDashboard,
    updateRecurrence: updateRecurrenceAnalysis,
    updateSatisfaction: updateSatisfactionMetrics,
    toggleNPS: toggleNPSAnalysis
};