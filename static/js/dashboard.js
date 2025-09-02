// Espera o documento HTML ser completamente carregado para executar o script
document.addEventListener("DOMContentLoaded", function() {
    // Carrega os dados principais do dashboard assim que a página abre
    loadExecutiveDashboard();
    initializeDateFilters();
});

/**
 * Função principal para carregar os dados da Visão Executiva.
 */
async function loadExecutiveDashboard() {
    console.log("🔄 Carregando dados da Visão Executiva...");
    try {
        // Mostra o loader enquanto os dados são buscados
        showLoader();

        // Faz a chamada para a API principal
        const response = await fetch('/api/executive-data');
        if (!response.ok) {
            throw new Error(`Erro na rede: ${response.statusText}`);
        }
        const data = await response.json();

        // Atualiza os cards com os dados recebidos
        updateKPIs(data.kpis);
        updateStatusCards(data.distributions); // Usando os dados de distribuição para os cards de status
        updateSatisfactionMetrics(data.satisfaction);
        updateCriticalAnalysis(data.critical_analysis);
        
        // Atualiza os gráficos
        updateNivelChart(data.distributions.nivel);
        updateRiscoChart(data.distributions.risco);

        // A análise de recorrência será chamada separadamente pelos filtros
        updateRecurrenceAnalysis();

        console.log("✅ Dados da Visão Executiva carregados com sucesso.");

    } catch (error) {
        console.error("❌ Falha ao carregar dados executivos:", error);
        showError("Não foi possível carregar os dados. Tente atualizar a página.");
    } finally {
        // Esconde o loader após o término da operação
        hideLoader();
    }
}

/**
 * Inicializa os filtros de data com valores padrão.
 */
function initializeDateFilters() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 180); // Padrão: últimos 6 meses

    // Formata a data para YYYY-MM-DD, que é o formato que o input[type=date] espera
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('recurrence-end').value = formatDate(endDate);
    document.getElementById('recurrence-start').value = formatDate(startDate);
}

/**
 * Busca e atualiza a seção de Análise de Recorrência.
 */
async function updateRecurrenceAnalysis() {
    console.log("🔄 Atualizando análise de recorrência...");
    const startDate = document.getElementById('recurrence-start').value;
    const endDate = document.getElementById('recurrence-end').value;

    if (!startDate || !endDate) {
        console.error("Datas de início ou fim não selecionadas.");
        return;
    }

    // Constrói a URL com os parâmetros de data
    const url = `/api/recurrence-data?data_inicio=${startDate}&data_fim=${endDate}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados de recorrência: ${response.statusText}`);
        }
        const data = await response.json();

        // Atualiza os cards de recorrência
        const metrics = data.metrics;
        document.querySelector('#card-novos-clientes .metric-value').textContent = metrics.pedidos_primeira.toLocaleString('pt-BR');
        document.querySelector('#card-recompras .metric-value').textContent = metrics.pedidos_recompra.toLocaleString('pt-BR');
        document.querySelector('#card-conversao .metric-value').textContent = `${metrics.taxa_conversao.toFixed(1)}%`;
        document.querySelector('#card-ticket-recompra .metric-value').textContent = `R$ ${metrics.ticket_recompra.toFixed(0)}`;
        
        // Atualiza os textos de tendência/período
        const periodoLabel = `${data.periodo.dias} dias`;
        document.querySelector('#card-novos-clientes .metric-trend').textContent = periodoLabel;
        document.querySelector('#card-recompras .metric-trend').textContent = periodoLabel;
        document.querySelector('#card-conversao .metric-trend').textContent = 'Primeira → Recompra';

        const ticketPrimeira = metrics.ticket_primeira;
        const ticketRecompra = metrics.ticket_recompra;
        let diffPercent = 0;
        if (ticketPrimeira > 0) {
            diffPercent = ((ticketRecompra - ticketPrimeira) / ticketPrimeira) * 100;
        }
        const trendText = diffPercent >= 0 ? `↗️ +${diffPercent.toFixed(1)}%` : `↘️ ${diffPercent.toFixed(1)}%`;
        document.querySelector('#card-ticket-recompra .metric-trend').textContent = trendText + ' vs 1ª compra';


        // Atualiza os gráficos de recorrência
        updateRecurrencePieChart(data.charts_data.pie_recurrence);
        updateTicketsBarChart(data.charts_data.bar_tickets);
        
        console.log("✅ Análise de recorrência atualizada.");

    } catch (error) {
        console.error("❌ Falha ao atualizar recorrência:", error);
    }
}


// Funções auxiliares para atualizar partes específicas da UI

function updateKPIs(kpis) {
    document.querySelector('#card-total-clientes .metric-value').textContent = kpis.total_clientes.value;
    document.querySelector('#card-retencao .metric-value').textContent = kpis.taxa_retencao.value;
    document.querySelector('#card-criticos .metric-value').textContent = kpis.taxa_criticos.value;
    document.querySelector('#card-receita .metric-value').textContent = kpis.receita_total.value;

    document.querySelector('#card-total-clientes .metric-trend').textContent = kpis.total_clientes.subtitle;
    document.querySelector('#card-retencao .metric-trend').textContent = kpis.taxa_retencao.subtitle;
    document.querySelector('#card-criticos .metric-trend').textContent = kpis.taxa_criticos.subtitle;
    document.querySelector('#card-receita .metric-trend').textContent = kpis.receita_total.subtitle;
}

function updateStatusCards(distributions) {
    const churn = distributions.churn || {};
    const total = Object.values(churn).reduce((a, b) => a + b, 0);

    const ativos = churn['Ativo'] || 0;
    const inativos = churn['Inativo'] || 0;
    const dormant = Object.keys(churn)
        .filter(k => k.includes('Dormant'))
        .reduce((sum, key) => sum + churn[key], 0);

    document.querySelector('#card-base-total .metric-value').textContent = total.toLocaleString('pt-BR');
    document.querySelector('#card-ativos .metric-value').textContent = ativos.toLocaleString('pt-BR');
    document.querySelector('#card-inativos .metric-value').textContent = inativos.toLocaleString('pt-BR');
    document.querySelector('#card-dormant .metric-value').textContent = dormant.toLocaleString('pt-BR');

    if (total > 0) {
        document.querySelector('#card-ativos .metric-trend').textContent = `${(ativos / total * 100).toFixed(1)}% da base`;
        document.querySelector('#card-inativos .metric-trend').textContent = `${(inativos / total * 100).toFixed(1)}% da base`;
        document.querySelector('#card-dormant .metric-trend').textContent = `${(dormant / total * 100).toFixed(1)}% da base`;
    }
}

function updateSatisfactionMetrics(satisfaction) {
    // NPS
    const nps = satisfaction.nps || {};
    document.querySelector('#card-nps .metric-value').textContent = nps.value || 'N/A';
    document.querySelector('#card-nps .metric-trend').textContent = nps.trend || 'Sem dados';
    document.querySelector('#card-nps').className = `metric-card ${nps.color_class || 'info'}`;
    // Outras métricas
    const atendimento = satisfaction.atendimento || {};
    document.querySelector('#card-atendimento .metric-value').textContent = atendimento.value || 'N/A';
    document.querySelector('#card-atendimento .metric-trend').textContent = atendimento.trend || 'Sem dados';
    document.querySelector('#card-atendimento').className = `metric-card ${atendimento.color_class || 'info'}`;
    
    const produto = satisfaction.produto || {};
    document.querySelector('#card-produto .metric-value').textContent = produto.value || 'N/A';
    document.querySelector('#card-produto .metric-trend').textContent = produto.trend || 'Sem dados';
    document.querySelector('#card-produto').className = `metric-card ${produto.color_class || 'info'}`;

    const prazo = satisfaction.prazo || {};
    document.querySelector('#card-prazo .metric-value').textContent = prazo.value || 'N/A';
    document.querySelector('#card-prazo .metric-trend').textContent = prazo.trend || 'Sem dados';
    document.querySelector('#card-prazo').className = `metric-card ${prazo.color_class || 'info'}`;
}

function updateCriticalAnalysis(analysis) {
    // Implementar a lógica para preencher as análises críticas se necessário
}


// Funções de UI (Loader, Erros)
function showLoader() {
    // Adicionar classe 'loading' para mostrar skeletons
    document.querySelectorAll('.metric-value, .metric-trend').forEach(el => {
        if (!el.textContent || el.textContent === '---' || el.textContent === 'Carregando...') {
            el.classList.add('skeleton');
        }
    });
}

function hideLoader() {
    // Remover classe 'loading'
    document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
}

function showError(message) {
    // Pode implementar um toast ou um modal de erro aqui
    console.error(`UI Error: ${message}`);
}