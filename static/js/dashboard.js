// === DASHBOARD.JS CORRIGIDO - PAPELLO DASHBOARD ===

console.log('🚀 Inicializando Dashboard Papello...');

// === FUNÇÕES GLOBAIS ESSENCIAIS ===

function initializeDashboard() {
    console.log('🔄 Configurando dashboard...');
    
    // Configurar elementos globais
    setupGlobalElements();
    
    // Event listeners globais
    setupGlobalEventListeners();
    
    // Inicializar filtros de data
    initializeDateFilters();
    
    // Carregar dados da página atual
    const currentPage = getCurrentPage();
    if (currentPage === 'executive') {
        loadExecutiveDashboard();
    }
    
    console.log('✅ Dashboard inicializado com sucesso');
}

function getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('executive')) return 'executive';
    if (path.includes('clients')) return 'clients';
    if (path.includes('analytics')) return 'analytics';
    if (path.includes('actions')) return 'actions';
    return 'home';
}

function setupGlobalElements() {
    // Configurar elementos que aparecem em várias páginas
    updateLastUpdateTime();
}

function setupGlobalEventListeners() {
    // Event listeners para elementos globais
    $(document).on('click', '.btn-refresh', refreshData);
    $(document).on('click', '[onclick="refreshData()"]', refreshData);
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
    const valueElement = card.find('.metric-value');
    valueElement.removeClass('skeleton').text(data.value || '---');
    
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

function showLoading() {
    $('#loading-overlay').removeClass('d-none');
    $('.skeleton').addClass('skeleton-animation');
}

function hideLoading() {
    $('#loading-overlay').addClass('d-none');
    $('.skeleton').removeClass('skeleton-animation');
}

function showAlert(message, type = 'info') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    $('#global-alerts').html(alertHtml);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        $('.alert').fadeOut();
    }, 5000);
}

// === FUNÇÕES ESPECÍFICAS DA VISÃO EXECUTIVA ===

async function loadExecutiveDashboard() {
    console.log("🔄 Carregando dados da Visão Executiva...");
    try {
        showLoading();

        const response = await fetch('/api/executive-data');
        if (!response.ok) {
            throw new Error(`Erro na rede: ${response.statusText}`);
        }
        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error(data.error || 'A API retornou um erro.');
        }

        console.log('📊 Dados recebidos da API:', data);

        // Atualizar todas as seções da página
        updateKPIs(data.kpis);
        updateStatusCards(data.distributions);
        updateSatisfactionMetrics(data.satisfaction);
        updateCriticalAnalysis(data.critical_analysis);
        updateMetricsAttention(data);
        updateExecutiveSummary(data);
        
        // Tentar atualizar os gráficos, mas sem quebrar se falhar
        try {
            if (typeof updateDistributionCharts === 'function') {
                updateDistributionCharts(data.distributions);
            } else {
                console.warn('⚠️ Função updateDistributionCharts não encontrada');
            }
        } catch (chartError) {
            console.error('❌ Erro ao renderizar gráficos:', chartError);
            showAlert('Dados carregados, mas houve um erro ao exibir os gráficos.', 'warning');
        }

        // Atualizar análise de recorrência
        await updateRecurrenceAnalysis();
        
        console.log("✅ Dados da Visão Executiva carregados com sucesso.");

    } catch (error) {
        console.error("❌ Falha ao carregar dados executivos:", error);
        showAlert("Não foi possível carregar os dados. Tente atualizar a página.", 'danger');
    } finally {
        hideLoading();
    }
}

function updateKPIs(kpis) {
    console.log('🔄 Atualizando KPIs principais...');
    
    if (!kpis) {
        console.warn('⚠️ Dados de KPIs não fornecidos');
        return;
    }

    // Atualizar cada KPI
    if (kpis.total_clientes) {
        updateMetricCard('card-total-clientes', {
            value: kpis.total_clientes.value,
            trend: kpis.total_clientes.subtitle
        });
    }

    if (kpis.taxa_retencao) {
        updateMetricCard('card-retencao', {
            value: kpis.taxa_retencao.value,
            trend: kpis.taxa_retencao.subtitle,
            colorClass: kpis.taxa_retencao.color_class || 'success'
        });
    }

    if (kpis.taxa_criticos) {
        updateMetricCard('card-criticos', {
            value: kpis.taxa_criticos.value,
            trend: kpis.taxa_criticos.subtitle,
            colorClass: kpis.taxa_criticos.color_class || 'warning'
        });
    }

    if (kpis.receita_total) {
        updateMetricCard('card-receita', {
            value: kpis.receita_total.value,
            trend: kpis.receita_total.subtitle
        });
    }

    console.log('✅ KPIs atualizados');
}

function updateStatusCards(distributions) {
    console.log('🔄 Atualizando cards de status da base...');
    
    if (!distributions || !distributions.churn) {
        console.warn('⚠️ Dados de distribuição de churn não fornecidos');
        return;
    }
    
    const churn = distributions.churn;
    const total = Object.values(churn).reduce((a, b) => a + b, 0);

    const ativos = churn['Ativo'] || 0;
    const inativos = churn['Inativo'] || 0;
    
    // Somar todos os dormant
    const dormant = Object.keys(churn)
        .filter(k => k.includes('Dormant'))
        .reduce((sum, key) => sum + churn[key], 0);

    updateMetricCard('card-base-total', {
        value: total.toLocaleString('pt-BR'),
        trend: 'Clientes únicos'
    });
    
    updateMetricCard('card-ativos', {
        value: ativos.toLocaleString('pt-BR'),
        trend: total > 0 ? `${(ativos / total * 100).toFixed(1)}% da base` : '0%',
        colorClass: 'success'
    });
    
    updateMetricCard('card-inativos', {
        value: inativos.toLocaleString('pt-BR'),
        trend: total > 0 ? `${(inativos / total * 100).toFixed(1)}% da base` : '0%',
        colorClass: 'danger'
    });
    
    updateMetricCard('card-dormant', {
        value: dormant.toLocaleString('pt-BR'),
        trend: total > 0 ? `${(dormant / total * 100).toFixed(1)}% da base` : '0%',
        colorClass: 'warning'
    });

    console.log('✅ Cards de status atualizados');
}

function updateSatisfactionMetrics(satisfaction) {
    console.log('🔄 Atualizando métricas de satisfação...');
    
    if (!satisfaction) {
        console.warn('⚠️ Dados de satisfação não fornecidos');
        return;
    }

    // NPS
    if (satisfaction.nps) {
        updateMetricCard('card-nps', {
            value: satisfaction.nps.value,
            trend: satisfaction.nps.trend,
            colorClass: satisfaction.nps.color_class || 'info'
        });
        
        // Atualizar detalhes do NPS se existir o container
        const npsDetails = $('#nps-details');
        if (npsDetails.length && satisfaction.nps.details) {
            const details = satisfaction.nps.details;
            npsDetails.html(`
                <div class="row text-center">
                    <div class="col-4">
                        <div class="text-success fw-bold">${details.promoters || 0}</div>
                        <small class="text-muted">Promotores</small>
                    </div>
                    <div class="col-4">
                        <div class="text-warning fw-bold">${(details.total_respostas - details.promoters - details.detractors) || 0}</div>
                        <small class="text-muted">Neutros</small>
                    </div>
                    <div class="col-4">
                        <div class="text-danger fw-bold">${details.detractors || 0}</div>
                        <small class="text-muted">Detratores</small>
                    </div>
                </div>
            `);
        }
    }

    // Outras métricas de satisfação
    ['atendimento', 'produto', 'prazo'].forEach(metric => {
        if (satisfaction[metric]) {
            updateMetricCard(`card-${metric}`, {
                value: satisfaction[metric].value,
                trend: satisfaction[metric].trend,
                colorClass: satisfaction[metric].color_class || 'info'
            });
        }
    });

    console.log('✅ Métricas de satisfação atualizadas');
}

function updateCriticalAnalysis(analysis) {
    console.log('🔄 Atualizando análise crítica...');
    
    const container = $('#premium-risk-analysis');
    if (!container.length || !analysis) {
        console.warn('⚠️ Container de análise crítica não encontrado ou dados não fornecidos');
        return;
    }
    
    const premiumRisk = analysis.premium_em_risco || 0;
    const totalPremium = analysis.total_premium || 1;
    const receitaRisco = analysis.receita_em_risco || 0;
    
    let html = '';
    if (premiumRisk > 0) {
        const taxaRisco = (premiumRisk / totalPremium * 100).toFixed(1);
        html = `
            <div class="alert alert-danger h-100">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>Situação Crítica</h6>
                <p class="mb-1"><strong>${premiumRisk} clientes Premium/Gold</strong> (${taxaRisco}%) estão em risco de churn.</p>
                <p class="mb-1">💰 Receita em risco: <strong>R$ ${(receitaRisco/1000).toFixed(0)}K</strong></p>
                <hr>
                <p class="mb-0"><strong>Ação recomendada:</strong> Contato direto nas próximas 48h.</p>
            </div>
        `;
    } else {
        html = `
            <div class="alert alert-success h-100">
                <h6><i class="fas fa-check-circle me-2"></i>Situação Estável</h6>
                <p>Nenhum cliente Premium/Gold em risco crítico no momento.</p>
                <p class="mb-0"><strong>Recomendação:</strong> Manter práticas atuais de CS.</p>
            </div>
        `;
    }
    container.html(html);
    
    console.log('✅ Análise crítica atualizada');
}

function updateMetricsAttention(data) {
    console.log('🔄 Atualizando métricas em atenção...');
    
    const container = $('#metrics-attention');
    if (!container.length || !data) {
        console.warn('⚠️ Container de métricas em atenção não encontrado ou dados não fornecidos');
        return;
    }

    const kpis = data.kpis || {};
    const satisfaction = data.satisfaction || {};
    const issues = [];

    // Verificar problemas
    if (kpis.taxa_retencao && parseFloat(kpis.taxa_retencao.value) < 70) {
        issues.push(`📉 Taxa de retenção abaixo de 70% (${kpis.taxa_retencao.value})`);
    }
    if (satisfaction.nps && parseInt(satisfaction.nps.value) < 50) {
        issues.push(`😠 NPS abaixo de 50 (${satisfaction.nps.value})`);
    }
    if (kpis.taxa_criticos && parseFloat(kpis.taxa_criticos.value) > 15) {
        issues.push(`🚨 Clientes críticos acima de 15% (${kpis.taxa_criticos.value})`);
    }

    let html = '';
    if (issues.length > 0) {
        html = `
            <div class="alert alert-warning h-100">
                <h6><i class="fas fa-flag me-2"></i>Pontos de Atenção</h6>
                <ul class="mb-0 ps-3">
                    ${issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        html = `
            <div class="alert alert-success h-100">
                <h6><i class="fas fa-check-circle me-2"></i>Métricas Saudáveis</h6>
                <p class="mb-0">Todos os indicadores principais estão dentro do esperado.</p>
            </div>
        `;
    }
    container.html(html);
    
    console.log('✅ Métricas em atenção atualizadas');
}

function updateExecutiveSummary(data) {
    console.log('🔄 Atualizando resumo executivo...');
    
    const container = $('#executive-summary .alert-content');
    if (!container.length || !data) {
        console.warn('⚠️ Container de resumo executivo não encontrado ou dados não fornecidos');
        return;
    }

    const kpis = data.kpis || {};
    const totalClientes = kpis.total_clientes?.value || '0';
    const taxaRetencao = kpis.taxa_retencao?.value || '0%';
    const receitaTotal = kpis.receita_total?.value || 'R$ 0';
    const nps = data.satisfaction?.nps?.value || 'N/A';

    const html = `
        <p>A base de clientes da Papello, com <strong>${totalClientes}</strong> contas, demonstra uma saúde geral positiva, sustentada por uma receita de <strong>${receitaTotal}</strong>. 
        A taxa de retenção de <strong>${taxaRetencao}</strong> é um ponto forte, mas o NPS de <strong>${nps}</strong> indica uma oportunidade clara para melhorar a lealdade e satisfação do cliente.</p>
        <h6 class="fw-bold mt-3">Foco Estratégico:</h6>
        <ul class="mb-0 ps-3">
            <li><strong>Ação Imediata:</strong> Abordar os clientes Premium/Gold em risco para mitigar perdas de receita significativas.</li>
            <li><strong>Melhoria Contínua:</strong> Investigar as causas do NPS moderado para converter clientes neutros em promotores.</li>
            <li><strong>Manutenção:</strong> Continuar as estratégias que sustentam a alta taxa de retenção.</li>
        </ul>
    `;
    container.html(html);
    
    console.log('✅ Resumo executivo atualizado');
}

// === FUNÇÕES DE RECORRÊNCIA ===

async function updateRecurrenceAnalysis() {
    console.log('🔄 Atualizando análise de recorrência...');
    
    try {
        // Obter datas dos filtros
        const startDate = $('#recurrence-start').val();
        const endDate = $('#recurrence-end').val();
        
        if (!startDate || !endDate) {
            console.warn('⚠️ Datas de recorrência não definidas, usando padrão');
            return;
        }
        
        const response = await fetch(`/api/recurrence-analysis?start=${startDate}&end=${endDate}`);
        if (!response.ok) {
            throw new Error(`Erro na API de recorrência: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Atualizar cards de recorrência
        updateRecurrenceCards(data);
        
        // Atualizar gráficos de recorrência
        if (typeof updateRecurrenceCharts === 'function') {
            updateRecurrenceCharts(data.charts);
        }
        
        console.log('✅ Análise de recorrência atualizada');
        
    } catch (error) {
        console.error('❌ Erro ao atualizar análise de recorrência:', error);
        // Não mostrar erro para o usuário, pois é uma funcionalidade secundária
    }
}

function updateRecurrenceCards(data) {
    if (!data) return;
    
    // Atualizar cards com dados de recorrência
    if (data.novos_clientes !== undefined) {
        updateMetricCard('card-novos-clientes', {
            value: data.novos_clientes.toString(),
            trend: 'Clientes que fizeram sua primeira compra no período'
        });
    }
    
    if (data.recompras !== undefined) {
        updateMetricCard('card-recompras', {
            value: data.recompras.toString(),
            trend: 'Pedidos de clientes que já haviam comprado antes'
        });
    }
    
    if (data.taxa_conversao !== undefined) {
        updateMetricCard('card-taxa-conversao', {
            value: `${data.taxa_conversao.toFixed(1)}%`,
            trend: '% de clientes únicos que fizeram primeira compra e depois recompraram'
        });
    }
    
    if (data.ticket_recompra !== undefined) {
        updateMetricCard('card-ticket-recompra', {
            value: `R$ ${data.ticket_recompra.toFixed(2)}`,
            trend: 'Valor médio dos pedidos de recompra vs primeira compra'
        });
    }
}

// === FUNÇÕES DE FILTROS E CONTROLES ===

function initializeDateFilters() {
    console.log('🔄 Inicializando filtros de data...');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 180); // 6 meses padrão

    // Formatar datas para input
    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    // Definir valores padrão
    $('#recurrence-start').val(formatDate(startDate));
    $('#recurrence-end').val(formatDate(endDate));
    
    // Event listener para período rápido
    $('#quick-period').on('change', function() {
        const days = parseInt($(this).val());
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        
        $('#recurrence-start').val(formatDate(start));
        $('#recurrence-end').val(formatDate(end));
        
        // Atualizar texto informativo
        const periodText = $(this).find('option:selected').text();
        $('#period-info').text(`Período: ${periodText}`);
    });
    
    console.log('✅ Filtros de data inicializados');
}

// === FUNÇÕES GLOBAIS DE CONTROLE ===

function refreshData() {
    console.log('🔄 Atualizando dados...');
    
    showAlert('Atualizando dados...', 'info');
    
    const currentPage = getCurrentPage();
    if (currentPage === 'executive') {
        loadExecutiveDashboard();
    }
    
    // Atualizar timestamp
    updateLastUpdateTime();
}

// === INICIALIZAÇÃO ===

// Aguardar DOM estar pronto
$(document).ready(function() {
    console.log('📄 DOM pronto, aguardando inicialização...');
});

console.log('✅ dashboard.js carregado e pronto');

