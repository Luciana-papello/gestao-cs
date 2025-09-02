// Dashboard Papello - JavaScript Principal (VERSÃO CORRIGIDA)

// === FUNÇÕES GLOBAIS ESSENCIAIS ===

function initializeDashboard() {
    console.log('🚀 Inicializando Dashboard Papello...');
    
    // Configurar elementos globais
    setupGlobalElements();
    
    // Event listeners globais
    setupGlobalEventListeners();
    
    console.log('✅ Dashboard inicializado com sucesso');
}

function setupGlobalElements() {
    // Configurar elementos que aparecem em várias páginas
    updateLastUpdateTime();
}

function setupGlobalEventListeners() {
    // Event listeners para elementos globais
    $(document).on('click', '.btn-refresh', refreshData);
}

function updateLastUpdateTime() {
    const now = new Date().toLocaleString('pt-BR');
    $('#last-update').text(now);
}

// === FUNÇÕES DE UI AUXILIARES ===

function updateMetricCard(cardId, data) {
    const card = $(`#${cardId}`);
    if (!card.length) return;
    
    // Atualizar valor
    card.find('.metric-value').removeClass('skeleton').text(data.value);
    
    // Atualizar trend
    if (data.trend) {
        card.find('.metric-trend').text(data.trend);
    }
    
    // Atualizar classe de cor
    if (data.colorClass) {
        card.removeClass('success warning danger info')
            .addClass(data.colorClass);
    }
}

function showAlert(message, type = 'info', duration = 5000) {
    const alertClass = {
        'success': 'alert-success',
        'danger': 'alert-danger', 
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('#global-alerts').append(alertHtml);
    
    // Auto-remover após duration
    if (duration > 0) {
        setTimeout(() => {
            $('#global-alerts .alert').first().fadeOut(() => {
                $(this).remove();
            });
        }, duration);
    }
}

function showLoading() {
    $('#loading-overlay').removeClass('d-none');
    
    // Adicionar skeletons
    $('.metric-value').addClass('skeleton');
    $('.metric-trend').addClass('skeleton');
}

function hideLoading() {
    $('#loading-overlay').addClass('d-none');
    
    // Remover skeletons
    $('.skeleton').removeClass('skeleton');
}

function refreshData() {
    showAlert('Atualizando dados...', 'info', 2000);
    
    // Recarregar página atual ou dados específicos
    if (typeof loadExecutiveDashboard === 'function') {
        loadExecutiveDashboard();
    } else if (typeof loadClientsPage === 'function') {
        loadClientsPage();
    } else {
        location.reload();
    }
}

// === FUNÇÕES ESPECÍFICAS DA VISÃO EXECUTIVA ===

document.addEventListener("DOMContentLoaded", function() {
    // Só carrega dados executivos se estivermos na página certa
    if (document.getElementById('card-total-clientes')) {
        loadExecutiveDashboard();
        initializeDateFilters();
    }
});

async function loadExecutiveDashboard() {
    console.log("🔄 Carregando dados da Visão Executiva...");
    try {
        showLoader();

        const response = await fetch('/api/executive-data');
        if (!response.ok) {
            throw new Error(`Erro na rede: ${response.statusText}`);
        }
        const data = await response.json();

        // Atualizar os dados
        updateKPIs(data.kpis);
        updateStatusCards(data.distributions);
        updateSatisfactionMetrics(data.satisfaction);
        updateCriticalAnalysis(data.critical_analysis);
        
        // Atualizar os gráficos
        if (typeof updateDistributionCharts === 'function') {
            updateDistributionCharts(data.distributions);
        }

        // Atualizar análise de recorrência
        await updateRecurrenceAnalysis();
        
        // Análises críticas
        updateStrategicAnalysis(data);

        console.log("✅ Dados da Visão Executiva carregados com sucesso.");

    } catch (error) {
        console.error("❌ Falha ao carregar dados executivos:", error);
        showError("Não foi possível carregar os dados. Tente atualizar a página.");
    } finally {
        hideLoader();
    }
}

function initializeDateFilters() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 180);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const startInput = document.getElementById('recurrence-start');
    const endInput = document.getElementById('recurrence-end');
    
    if (startInput) startInput.value = formatDate(startDate);
    if (endInput) endInput.value = formatDate(endDate);
    
    // Event listeners para os filtros
    $(document).on('change', '#recurrence-start, #recurrence-end', updateRecurrenceAnalysis);
    $(document).on('change', '#quick-period', function() {
        const days = parseInt($(this).val());
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        
        $('#recurrence-start').val(formatDate(start));
        $('#recurrence-end').val(formatDate(end));
        updateRecurrenceAnalysis();
    });
}

async function updateRecurrenceAnalysis() {
    console.log("🔄 Atualizando análise de recorrência...");
    const startDate = document.getElementById('recurrence-start')?.value;
    const endDate = document.getElementById('recurrence-end')?.value;

    if (!startDate || !endDate) {
        console.error("Datas de início ou fim não selecionadas.");
        return;
    }

    try {
        const url = `/api/recurrence-data?data_inicio=${startDate}&data_fim=${endDate}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados de recorrência: ${response.statusText}`);
        }
        
        const data = await response.json();

        // Atualizar os cards de recorrência
        const metrics = data.metrics || {};
        
        updateMetricCard('card-novos-clientes', {
            value: (metrics.pedidos_primeira || 0).toLocaleString('pt-BR'),
            trend: `${data.periodo?.dias || 0} dias`,
            colorClass: 'info'
        });
        
        updateMetricCard('card-recompras', {
            value: (metrics.pedidos_recompra || 0).toLocaleString('pt-BR'),
            trend: `${data.periodo?.dias || 0} dias`,
            colorClass: 'success'
        });
        
        updateMetricCard('card-conversao', {
            value: `${(metrics.taxa_conversao || 0).toFixed(1)}%`,
            trend: 'Primeira → Recompra',
            colorClass: metrics.taxa_conversao >= 30 ? 'success' : 'warning'
        });

        const ticketPrimeira = metrics.ticket_primeira || 0;
        const ticketRecompra = metrics.ticket_recompra || 0;
        let diffPercent = 0;
        if (ticketPrimeira > 0) {
            diffPercent = ((ticketRecompra - ticketPrimeira) / ticketPrimeira) * 100;
        }
        const trendText = diffPercent >= 0 ? `↗️ +${diffPercent.toFixed(1)}%` : `↘️ ${diffPercent.toFixed(1)}%`;
        
        updateMetricCard('card-ticket-recompra', {
            value: `R$ ${ticketRecompra.toFixed(0)}`,
            trend: trendText + ' vs 1ª compra',
            colorClass: 'success'
        });

        // Atualizar os gráficos de recorrência
        if (typeof updateRecurrenceCharts === 'function' && data.charts_data) {
            updateRecurrenceCharts(data.charts_data);
        }
        
        console.log("✅ Análise de recorrência atualizada.");

    } catch (error) {
        console.error("❌ Falha ao atualizar recorrência:", error);
        showAlert('Erro ao carregar dados de recorrência', 'danger');
    }
}

function updateKPIs(kpis) {
    if (!kpis) return;
    
    updateMetricCard('card-total-clientes', {
        value: kpis.total_clientes?.value || '0',
        trend: kpis.total_clientes?.subtitle || '',
        colorClass: 'info'
    });
    
    updateMetricCard('card-retencao', {
        value: kpis.taxa_retencao?.value || '0%',
        trend: kpis.taxa_retencao?.subtitle || '',
        colorClass: kpis.taxa_retencao?.color_class || 'success'
    });
    
    updateMetricCard('card-criticos', {
        value: kpis.taxa_criticos?.value || '0%',
        trend: kpis.taxa_criticos?.subtitle || '',
        colorClass: kpis.taxa_criticos?.color_class || 'warning'
    });
    
    updateMetricCard('card-receita', {
        value: kpis.receita_total?.value || 'R$ 0',
        trend: kpis.receita_total?.subtitle || '',
        colorClass: 'success'
    });
}

function updateStatusCards(distributions) {
    if (!distributions || !distributions.churn) return;
    
    const churn = distributions.churn;
    const total = Object.values(churn).reduce((a, b) => a + b, 0);

    const ativos = churn['Ativo'] || 0;
    const inativos = churn['Inativo'] || 0;
    const dormant = Object.keys(churn)
        .filter(k => k.includes('Dormant'))
        .reduce((sum, key) => sum + churn[key], 0);

    updateMetricCard('card-base-total', {
        value: total.toLocaleString('pt-BR'),
        trend: 'Clientes únicos',
        colorClass: 'info'
    });
    
    updateMetricCard('card-ativos', {
        value: ativos.toLocaleString('pt-BR'),
        trend: total > 0 ? `${(ativos / total * 100).toFixed(1)}% da base` : '0% da base',
        colorClass: 'success'
    });
    
    updateMetricCard('card-inativos', {
        value: inativos.toLocaleString('pt-BR'),
        trend: total > 0 ? `${(inativos / total * 100).toFixed(1)}% da base` : '0% da base',
        colorClass: 'danger'
    });
    
    updateMetricCard('card-dormant', {
        value: dormant.toLocaleString('pt-BR'),
        trend: total > 0 ? `${(dormant / total * 100).toFixed(1)}% da base` : '0% da base',
        colorClass: 'warning'
    });
}

function updateSatisfactionMetrics(satisfaction) {
    if (!satisfaction) return;
    
    const metrics = ['nps', 'atendimento', 'produto', 'prazo'];
    
    metrics.forEach(metric => {
        const data = satisfaction[metric] || {};
        updateMetricCard(`card-${metric}`, {
            value: data.value || 'N/A',
            trend: data.trend || 'Sem dados',
            colorClass: data.color_class || 'info'
        });
    });
}

function updateCriticalAnalysis(analysis) {
    // Implementar se necessário
    console.log('Critical analysis:', analysis);
}

function updateStrategicAnalysis(data) {
    // Análise de Premium em Risco
    updatePremiumRiskAnalysis(data);
    
    // Métricas em Atenção
    updateMetricsAttention(data);
    
    // Resumo Executivo
    updateExecutiveSummary(data);
}

function updatePremiumRiskAnalysis(data) {
    const container = $('#premium-risk-analysis');
    if (!container.length) return;
    
    const analysis = data.critical_analysis || {};
    const premiumRisk = analysis.premium_em_risco || 0;
    const totalPremium = analysis.total_premium || 1;
    const receitaRisco = analysis.receita_em_risco || 0;
    
    let html = '';
    
    if (premiumRisk > 0) {
        const taxaRisco = (premiumRisk / totalPremium * 100).toFixed(1);
        html = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Situação Crítica</h6>
                <p><strong>${premiumRisk} clientes Premium/Gold em risco</strong> (${taxaRisco}%)</p>
                <p>💰 Receita em risco: R$ ${(receitaRisco/1000).toFixed(0)}K</p>
                <hr>
                <p><strong>Ação recomendada:</strong> Contato direto nas próximas 48h</p>
            </div>
        `;
    } else {
        html = `
            <div class="alert alert-success">
                <h6><i class="fas fa-check-circle me-2"></i>Situação Estável</h6>
                <p>Nenhum cliente Premium/Gold em risco crítico no momento.</p>
                <p><strong>Recomendação:</strong> Manter práticas atuais de CS</p>
            </div>
        `;
    }
    
    container.html(html);
}

function updateMetricsAttention(data) {
    const container = $('#metrics-attention');
    if (!container.length) return;
    
    const kpis = data.kpis || {};
    const satisfaction = data.satisfaction || {};
    
    const metricsIssues = [];
    
    // Verificar taxa de retenção baixa
    if (kpis.taxa_retencao && kpis.taxa_retencao.raw < 70) {
        metricsIssues.push("📉 Taxa de retenção abaixo de 70%");
    }
    
    // Verificar NPS baixo
    if (satisfaction.nps && satisfaction.nps.details && satisfaction.nps.details.nps_valor < 50) {
        metricsIssues.push("📈 NPS abaixo de 50 pontos");
    }
    
    // Verificar muitos clientes críticos
    if (kpis.taxa_criticos && kpis.taxa_criticos.raw > 20) {
        metricsIssues.push("🚨 Muitos clientes críticos (>20%)");
    }
    
    let html = '';
    
    if (metricsIssues.length > 0) {
        html = `
            <div class="alert alert-warning">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Pontos de Atenção</h6>
                <ul class="mb-0">
                    ${metricsIssues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
            </div>
            <div class="mt-3">
                <h6>💡 Recomendações:</h6>
                <ul class="small">
                    <li>Revisar estratégia de retenção</li>
                    <li>Priorizar ações com clientes críticos</li>
                    <li>Investigar causas do NPS baixo</li>
                </ul>
            </div>
        `;
    } else {
        html = `
            <div class="alert alert-success">
                <h6><i class="fas fa-check-circle me-2"></i>Métricas Saudáveis</h6>
                <p>Todos os indicadores principais estão dentro do esperado.</p>
                <p><strong>Recomendação:</strong> Continuar estratégia atual</p>
            </div>
        `;
    }
    
    container.html(html);
}

function updateExecutiveSummary(data) {
    const container = $('#executive-summary .alert-content');
    if (!container.length) return;
    
    const kpis = data.kpis || {};
    const totalClientes = kpis.total_clientes?.raw || 0;
    const taxaRetencao = kpis.taxa_retencao?.raw || 0;
    const receitaTotal = kpis.receita_total?.raw || 0;
    
    const html = `
        <div class="row">
            <div class="col-md-8">
                <h6 class="fw-bold mb-3">📊 Situação Atual</h6>
                <p>A Papello possui uma base de <strong>${totalClientes.toLocaleString('pt-BR')} clientes</strong> 
                com uma taxa de retenção de <strong>${taxaRetencao.toFixed(1)}%</strong>, 
                gerando <strong>R$ ${(receitaTotal/1000).toFixed(0)}K</strong> em receita total.</p>
                
                ${taxaRetencao >= 70 ? 
                    '<p class="text-success"><strong>✅ Situação positiva:</strong> Taxa de retenção acima da média do setor.</p>' :
                    '<p class="text-warning"><strong>⚠️ Atenção necessária:</strong> Taxa de retenção pode ser melhorada.</p>'
                }
                
                <h6 class="fw-bold mb-3 mt-4">🎯 Próximas Ações</h6>
                <ul>
                    <li>Monitorar clientes com risco alto de churn</li>
                    <li>Executar campanhas de reengajamento</li>
                    <li>Focar em clientes Premium e Gold</li>
                    <li>Analisar feedback de satisfação regularmente</li>
                </ul>
            </div>
            <div class="col-md-4">
                <div class="bg-light rounded p-3">
                    <h6 class="fw-bold mb-3">📈 Resumo dos KPIs</h6>
                    <div class="d-flex justify-content-between mb-2">
                        <span>Base Total:</span>
                        <strong>${totalClientes.toLocaleString('pt-BR')}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span>Taxa Retenção:</span>
                        <strong class="${taxaRetencao >= 70 ? 'text-success' : 'text-warning'}">${taxaRetencao.toFixed(1)}%</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-2">
                        <span>Receita:</span>
                        <strong>R$ ${(receitaTotal/1000).toFixed(0)}K</strong>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span>Status:</span>
                        <strong class="${taxaRetencao >= 70 ? 'text-success' : 'text-warning'}">
                            ${taxaRetencao >= 70 ? 'Saudável' : 'Atenção'}
                        </strong>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.html(html);
}

// === FUNÇÕES AUXILIARES ===

function showLoader() {
    $('.metric-value, .metric-trend').addClass('skeleton');
    $('#loading-overlay').removeClass('d-none');
}

function hideLoader() {
    $('.skeleton').removeClass('skeleton');
    $('#loading-overlay').addClass('d-none');
}

function showError(message) {
    console.error(`UI Error: ${message}`);
    showAlert(message, 'danger');
}

// Toggle para análise NPS
function toggleNPSAnalysis() {
    const analysis = $('#nps-detailed-analysis');
    const button = $('#show-nps-button');
    
    if (analysis.is(':visible')) {
        analysis.fadeOut();
        button.fadeIn();
    } else {
        analysis.fadeIn();
        button.fadeOut();
    }
}