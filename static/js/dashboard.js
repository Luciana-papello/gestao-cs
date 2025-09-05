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
    
    const currentPage = getCurrentPage();
    if (currentPage === 'executive') {
        initializeDateFilters(); // Apenas na página executiva
        loadExecutiveDashboard();
    } else if (currentPage === 'clients') { // <-- ADICIONAR ESTE BLOCO
        loadClientsPage();
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

    // --- LÓGICA DE OTIMIZAÇÃO DE FONTE ADICIONADA ---
    // Se o texto do valor for longo (ex: R$ 28.503.101 tem mais de 10 caracteres),
    // adicionamos a classe 'long-number' para reduzir a fonte.
    if (data.value && data.value.length > 10) {
        valueElement.addClass('long-number');
    } else {
        valueElement.removeClass('long-number');
    }
    // ----------------------------------------------------

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

        // --- CORREÇÃO ADICIONADA AQUI ---
        // Armazena os dados em uma variável global para que outras funções possam usá-los.
        window.currentDashboardData = data; 
        // ---------------------------------

        console.log('📊 Dados recebidos da API:', data);

        // Atualizar todas as seções da página
        updateKPIs(data.kpis);

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
                        <div class="text-success fw-bold">${details.promotores || 0}</div>
                        <small class="text-muted">Promotores</small>
                    </div>
                    <div class="col-4">
                        <div class="text-warning fw-bold">${(details.neutros) || 0}</div>
                        <small class="text-muted">Neutros</small>
                    </div>
                    <div class="col-4">
                        <div class="text-danger fw-bold">${details.detratores|| 0}</div>
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
        // Obter datas dos filtros ou usar padrão
        let startDate = $('#recurrence-start').val() || '2025-03-08';
        let endDate = $('#recurrence-end').val() || '2025-09-04';
        
        const response = await fetch(`/api/recurrence-analysis?start=${startDate}&end=${endDate}`);
        
        if (!response.ok) {
            throw new Error(`Erro na API de recorrência: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Dados de recorrência recebidos:', data);
        
        // Verificar se dados chegaram
        if (!data.metrics) {
            throw new Error('Dados de métricas não encontrados na resposta');
        }
        
        // *** CORREÇÃO PRINCIPAL: Atualizar cards com os dados corretos ***
        console.log('🔄 Atualizando cards de recorrência...');
        
        // Card Novos Clientes
        updateMetricCard('card-novos-clientes', {
            value: data.metrics.pedidos_primeira.toLocaleString('pt-BR'),
            trend: `Primeira compra no período`,
            colorClass: 'info'
        });
        
        // Card Recompras  
        updateMetricCard('card-recompras', {
            value: data.metrics.pedidos_recompra.toLocaleString('pt-BR'),
            trend: `Pedidos recorrentes`,
            colorClass: 'success'
        });
        
        // Card Taxa de Conversão
        const taxa = data.metrics.taxa_conversao;
        updateMetricCard('card-taxa-conversao', {
            value: `${taxa.toFixed(1)}%`,
            trend: 'Primeira → Recompra',
            colorClass: taxa >= 30 ? 'success' : taxa >= 15 ? 'warning' : 'danger'
        });
        
        // Card Ticket Recompra
        const ticketRecompra = data.metrics.ticket_recompra;
        const ticketPrimeira = data.metrics.ticket_primeira;
        let trend = 'Valor médio dos pedidos de recompra';
        let colorClass = 'info';
        
        if (ticketPrimeira > 0) {
            const diferenca = ((ticketRecompra - ticketPrimeira) / ticketPrimeira * 100);
            if (diferenca > 0) {
                trend = `↗️ +${diferenca.toFixed(1)}% vs primeira compra`;
                colorClass = 'success';
            } else if (diferenca < 0) {
                trend = `↘️ ${diferenca.toFixed(1)}% vs primeira compra`;
                colorClass = 'warning';
            } else {
                trend = `➡️ Igual à primeira compra`;
                colorClass = 'info';
            }
        }
        
        updateMetricCard('card-ticket-recompra', {
            value: `R$ ${ticketRecompra.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
            trend: trend,
            colorClass: colorClass
        });
        
        console.log('✅ Cards de recorrência atualizados com sucesso');
        
        // Atualizar gráficos se Chart.js estiver disponível
        if (typeof updateRecurrenceCharts === 'function' && data.charts) {
            console.log('🔄 Tentando atualizar gráficos de recorrência...');
            updateRecurrenceCharts(data.charts);
        }
        
        console.log('✅ Análise de recorrência atualizada');
        
    } catch (error) {
        console.error('❌ Erro ao atualizar análise de recorrência:', error);
        
        // Mostrar erro nos cards
        ['card-novos-clientes', 'card-recompras', 'card-taxa-conversao', 'card-ticket-recompra'].forEach(cardId => {
            updateMetricCard(cardId, {
                value: 'Erro',
                trend: 'Falha ao carregar',
                colorClass: 'danger'
            });
        });
        
        showAlert(`Não foi possível carregar dados de recorrência: ${error.message}`, 'warning');
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

function toggleNPSAnalysis() {
    console.log('🔄 Toggling NPS detailed analysis...');
    
    const analysisContainer = $('#nps-detailed-analysis');
    const button = $('#show-nps-button');
    
    if (analysisContainer.length === 0) {
        console.warn('⚠️ Container de análise NPS não encontrado');
        return;
    }
    
    const isVisible = analysisContainer.is(':visible');
    
    if (isVisible) {
        // Ocultar análise
        analysisContainer.slideUp(300);
        button.find('button').html('<i class="fas fa-microscope me-2"></i>Ver Análise Completa do NPS');
        console.log('✅ Análise NPS ocultada');
    } else {
        // Mostrar análise
        analysisContainer.slideDown(300);
        button.find('button').html('<i class="fas fa-eye-slash me-2"></i>Ocultar Análise do NPS');
        console.log('✅ Análise NPS exibida');
        
        // Carregar dados detalhados do NPS
        loadDetailedNPSData();
    }
}
function loadDetailedNPSData() {
    console.log('🔄 Carregando dados detalhados do NPS...');
    
    const npsData = window.currentDashboardData?.satisfaction?.nps;
    if (!npsData || !npsData.details) {
        console.warn('⚠️ Dados detalhados do NPS não disponíveis');
        return;
    }
    
    const details = npsData.details;
    
    // Atualizar elementos do NPS detalhado
    $('#nps-promotores').text(details.promotores || 0);
    $('#nps-neutros').text(details.neutros || 0);
    $('#nps-detratores').text(details.detratores || 0);
    $('#nps-total').text(details.total_validas || 0);
    
    // Atualizar interpretação
    const npsValue = parseFloat(npsData.value) || 0;
    let interpretation = '';
    let alertClass = 'alert-info';
    
    if (npsValue >= 70) {
        interpretation = 'Excelente! Seu NPS está na categoria "Classe Mundial". A maioria dos clientes são promotores ativos da sua marca.';
        alertClass = 'alert-success';
    } else if (npsValue >= 50) {
        interpretation = 'Muito bom! Seu NPS está acima da média brasileira. Há uma base sólida de clientes satisfeitos.';
        alertClass = 'alert-success';
    } else if (npsValue >= 0) {
        interpretation = 'Moderado. Há espaço significativo para melhoria na experiência do cliente.';
        alertClass = 'alert-warning';
    } else {
        interpretation = 'Crítico. É urgente investigar e melhorar a experiência do cliente.';
        alertClass = 'alert-danger';
    }
    
    $('#nps-interpretation').removeClass('alert-info alert-success alert-warning alert-danger')
                           .addClass(alertClass)
                           .text(interpretation);
    
    console.log('✅ Dados detalhados do NPS carregados');
}

// === TORNAR FUNÇÕES GLOBAIS ===
window.toggleNPSAnalysis = toggleNPSAnalysis;

// === FUNÇÕES DA PÁGINA DE GESTÃO DE CLIENTES ===

let allClients = [];
let filteredClients = [];
let currentPage = 1;
let itemsPerPage = 10;

async function loadClientsPage() {
    console.log('🔄 Carregando página de Gestão de Clientes...');
    showLoading();
    try {
        const response = await fetch('/api/clients-data');
        if (!response.ok) throw new Error(`Erro na API de clientes: ${response.statusText}`);
        
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.error || 'A API de clientes retornou um erro.');

        allClients = data.clients;
        filteredClients = allClients;
        
        populateFilters();

        // INICIALIZA O SELECT2 NOS FILTROS
        $('#filter-nivel, #filter-risco, #filter-status').select2({
            theme: "bootstrap-5",
            placeholder: 'Selecione',
            closeOnSelect: false, // Mantém aberto para múltiplas seleções
        });

        setupClientEventListeners();
        renderPage();
        
        console.log(`✅ ${allClients.length} clientes carregados com sucesso.`);

    } catch (error) {
        console.error("❌ Falha ao carregar dados dos clientes:", error);
        $('#client-list-container').html('<div class="alert alert-danger">Não foi possível carregar os dados. Tente atualizar a página.</div>');
    } finally {
        hideLoading();
    }
}

function setupClientEventListeners() {
    $('#search-client, #filter-receita-min, #filter-receita-max').on('keyup', debounce(applyFilters, 400));
    $('#filter-nivel, #filter-risco, #filter-status, #items-per-page').on('change', applyFilters);
    $('#export-clients-btn').on('click', exportClientsToCSV);
}

function populateFilters() {
    const niveis = [...new Set(allClients.map(c => c.nivel_cliente))].filter(Boolean).sort();
    const riscos = [...new Set(allClients.map(c => c.risco_recencia))].filter(Boolean).sort();
    const statuses = [...new Set(allClients.map(c => c.status_churn))].filter(Boolean).sort();

    niveis.forEach(nivel => $('#filter-nivel').append(`<option value="${nivel}">${nivel}</option>`));
    riscos.forEach(risco => $('#filter-risco').append(`<option value="${risco}">${risco}</option>`));
    statuses.forEach(status => $('#filter-status').append(`<option value="${status}">${status}</option>`));
}

function applyFilters() {
    const searchTerm = $('#search-client').val().toLowerCase();
    const nivelFilter = $('#filter-nivel').val() || [];
    const riscoFilter = $('#filter-risco').val() || []; // Mantido caso queira adicionar de volta
    const statusFilter = $('#filter-status').val() || [];
    const minReceita = parseFloat($('#filter-receita-min').val());
    const maxReceita = parseFloat($('#filter-receita-max').val());
    
    itemsPerPage = parseInt($('#items-per-page').val());

    filteredClients = allClients.filter(client => {
        const searchMatch = !searchTerm || 
                            client.nome.toLowerCase().includes(searchTerm) || 
                            client.email.toLowerCase().includes(searchTerm);
        
        const nivelMatch = nivelFilter.length === 0 || nivelFilter.includes(client.nivel_cliente);
        const riscoMatch = riscoFilter.length === 0 || riscoFilter.includes(client.risco_recencia);
        const statusMatch = statusFilter.length === 0 || statusFilter.includes(client.status_churn);

        // Lógica para o filtro de receita
        const clientReceita = parseFloat(String(client.receita).replace(',', '.')) || 0;
        const receitaMatch = (isNaN(minReceita) || clientReceita >= minReceita) &&
                             (isNaN(maxReceita) || clientReceita <= maxReceita);

        return searchMatch && nivelMatch && riscoMatch && statusMatch && receitaMatch;
    });

    currentPage = 1;
    renderPage();
}

function renderPage() {
    renderClientList();
    renderPagination();
}

function renderClientList() {
    const container = $('#client-list-container');
    container.empty();

    if (filteredClients.length === 0) {
        container.html('<div class="text-center p-5"><i class="fas fa-search fa-2x text-muted"></i><p class="mt-3">Nenhum cliente encontrado com os filtros aplicados.</p></div>');
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageClients = filteredClients.slice(startIndex, endIndex);

    pageClients.forEach(client => {
        const cardHtml = createClientCard(client);
        container.append(cardHtml);
    });
}

function createClientCard(client) {
    // Mapeamento de Nível para a classe CSS de cor
    const nivelColorMap = {
        'Premium': 'text-nivel-premium',
        'Gold': 'text-nivel-gold',
        'Silver': 'text-nivel-silver',
        'Bronze': 'text-nivel-bronze'
    };
    const nomeColorClass = nivelColorMap[client.nivel_cliente] || '';

    // Funções de formatação
    const format = (value, prefix = '', suffix = '') => (value && String(value).trim() !== '') ? `${prefix}${value}${suffix}` : 'N/A';
    const formatCurrency = (value) => {
        const num = parseFloat(String(value).replace(',', '.'));
        return !isNaN(num) ? `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
    };
    const formatDays = (value) => {
        const num = parseFloat(String(value).replace(',', '.'));
        return !isNaN(num) ? `${num.toFixed(1)} dias` : 'N/A';
    };
    const formatLocation = (cidade, estado) => {
        const c = format(cidade);
        const e = format(estado);
        if (c !== 'N/A' && e !== 'N/A') return `${c}, ${e}`;
        if (c !== 'N/A') return c;
        if (e !== 'N/A') return e;
        return 'N/A';
    };

    return `
    <div class="card client-card mb-3">
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5 class="card-title mb-0 ${nomeColorClass}">${format(client.nome)}</h5>
                    <small class="text-muted">${format(client.email)}</small>
                    <div class="mt-2" style="font-size: 0.85rem;">
                        <span class="me-3"><i class="fas fa-phone-alt me-1 text-muted"></i> ${format(client.telefone1)}</span>
                        <span class="me-3"><i class="fas fa-id-card me-1 text-muted"></i> ${format(client.cpfcnpj)}</span>
                        <span><i class="fas fa-map-marker-alt me-1 text-muted"></i> ${formatLocation(client.cidade, client.estado)}</span>
                    </div>
                </div>
                <div class="text-end">
                    <span class="fw-bold fs-4">${format(client.score_final)}</span>
                    <div class="text-muted" style="font-size: 0.8rem;">Score Final</div>
                </div>
            </div>
            <hr>
            <div class="client-info-grid">
                <div class="client-info-item"><i class="fas fa-user-tie"></i> <strong>Vendedor:</strong> ${format(client.codigo_vendedor)}</div>
                <div class="client-info-item"><i class="fas fa-trophy"></i> <strong>Nível:</strong> ${format(client.nivel_cliente)}</div>
                <div class="client-info-item"><i class="fas fa-exclamation-triangle"></i> <strong>Risco:</strong> ${format(client.risco_recencia)}</div>
                <div class="client-info-item"><i class="fas fa-heartbeat"></i> <strong>Status:</strong> ${format(client.status_churn)}</div>
                <div class="client-info-item"><i class="fas fa-redo-alt"></i> <strong>Frequência:</strong> ${format(client.frequency, '', ' pedidos')}</div>
                <div class="client-info-item"><i class="fas fa-history"></i> <strong>Intervalo Médio:</strong> ${formatDays(client.ipt_cliente)}</div>
                <div class="client-info-item"><i class="fas fa-dollar-sign"></i> <strong>Receita:</strong> ${formatCurrency(client.receita)}</div>
                <div class="client-info-item"><i class="fas fa-calendar-check"></i> <strong>Últ. Compra:</strong> ${format(client.recency_days, '', ' dias')}</div>
            </div>
        </div>
    </div>`;
}

// NOVA FUNÇÃO: Exportar clientes para CSV
function exportClientsToCSV() {
    if (filteredClients.length === 0) {
        alert("Não há clientes para exportar com os filtros atuais.");
        return;
    }

    const headers = [
        "Nome", "Email", "Telefone", "CNPJ/CPF", "Cidade", "Estado", 
        "Vendedor", "Nível Cliente", "Risco Recência", "Status Churn",
        "Score Final", "Priority Score", "Frequência", "Intervalo Médio", 
        "Receita", "Última Compra (dias)"
    ];

    // Mapeia os dados do cliente para a ordem dos cabeçalhos, garantindo que tudo seja string
    const rows = filteredClients.map(client => [
        `"${String(client.nome || '').replace(/"/g, '""')}"`,
        `"${String(client.email || '').replace(/"/g, '""')}"`,
        `"${String(client.telefone1 || '').replace(/"/g, '""')}"`,
        `"${String(client.cpfcnpj || '').replace(/"/g, '""')}"`,
        `"${String(client.cidade || '').replace(/"/g, '""')}"`,
        `"${String(client.estado || '').replace(/"/g, '""')}"`,
        `"${String(client.codigo_vendedor || '').replace(/"/g, '""')}"`,
        `"${String(client.nivel_cliente || '').replace(/"/g, '""')}"`,
        `"${String(client.risco_recencia || '').replace(/"/g, '""')}"`,
        `"${String(client.status_churn || '').replace(/"/g, '""')}"`,
        `"${String(client.score_final || '').replace(/"/g, '""')}"`,
        `"${String(client.priority_score || '').replace(/"/g, '""')}"`,
        `"${String(client.frequency || '').replace(/"/g, '""')}"`,
        `"${String(client.ipt_cliente || '').replace(/"/g, '""')}"`,
        `"${String(client.receita || '').replace(/"/g, '""')}"`,
        `"${String(client.recency_days || '').replace(/"/g, '""')}"`
    ].join(';')); // Use ponto e vírgula como separador para CSV no Brasil

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "clientes_papello_filtrados.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderPagination() {
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
    const infoContainer = $('#pagination-info');
    const controlsContainer = $('#pagination-controls, #pagination-controls-bottom');
    
    infoContainer.text(`Mostrando ${Math.min(itemsPerPage * (currentPage - 1) + 1, filteredClients.length)} a ${Math.min(currentPage * itemsPerPage, filteredClients.length)} de ${filteredClients.length} clientes`);
    
    controlsContainer.empty();
    if (totalPages <= 1) return;

    let paginationHtml = '<ul class="pagination">';
    
    // Botão Anterior
    paginationHtml += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}">Anterior</a></li>`;

    // Lógica para exibir páginas
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) endPage = Math.min(5, totalPages);
    if (currentPage > totalPages - 3) startPage = Math.max(1, totalPages - 4);

    if (startPage > 1) paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';

    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }

    if (endPage < totalPages) paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';

    // Botão Próximo
    paginationHtml += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}">Próximo</a></li>`;
    paginationHtml += '</ul>';
    
    controlsContainer.html(paginationHtml);

    // Adiciona evento de clique aos links da paginação
    controlsContainer.find('a.page-link').on('click', function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        if (page) {
            currentPage = parseInt(page);
            renderPage();
            $('html, body').animate({ scrollTop: 0 }, 'fast'); // Rola para o topo
        }
    });
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}