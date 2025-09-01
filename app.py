from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json
from config import Config
from data_utils import (
    get_executive_summary_data, 
    load_google_sheet_public,
    format_number,
    format_phone_number
)

app = Flask(__name__)
app.config.from_object(Config)

@app.route('/')
def index():
    """Página inicial - redireciona para visão executiva"""
    return render_template('executive.html')

@app.route('/executive')
def executive_dashboard():
    """Dashboard da Visão Executiva"""
    return render_template('executive.html')

@app.route('/clients')
def client_management():
    """Gestão de Clientes"""
    return render_template('clients.html')

@app.route('/analytics')
def analytics_dashboard():
    """Analytics & Performance"""
    return render_template('analytics.html')

@app.route('/actions')
def actions_center():
    """Central de Ações"""
    return render_template('actions.html')

# === APIs DE DADOS ===

@app.route('/api/executive-data')
def api_executive_data():
    """API que retorna dados para a Visão Executiva"""
    try:
        data = get_executive_summary_data()
        
        if 'error' in data:
            return jsonify({'error': data['error']}), 500
        
        # Formatar dados para o frontend
        formatted_data = {
            'kpis': {
                'total_clientes': {
                    'value': format_number(data['kpis']['total_clientes']),
                    'raw': data['kpis']['total_clientes'],
                    'subtitle': 'Últimos 24 meses'
                },
                'taxa_retencao': {
                    'value': f"{data['kpis']['taxa_retencao']:.1f}%",
                    'raw': data['kpis']['taxa_retencao'],
                    'subtitle': f"{format_number(data['kpis']['clientes_ativos'])} clientes ativos",
                    'color_class': 'success' if data['kpis']['taxa_retencao'] >= 70 else 'warning'
                },
                'taxa_criticos': {
                    'value': f"{data['kpis']['taxa_criticos']:.1f}%",
                    'raw': data['kpis']['taxa_criticos'],
                    'subtitle': f"{format_number(data['kpis']['clientes_criticos'])} precisam atenção",
                    'color_class': 'danger' if data['kpis']['taxa_criticos'] >= 15 else 'warning' if data['kpis']['taxa_criticos'] >= 10 else 'success'
                },
                'receita_total': {
                    'value': format_number(data['kpis']['receita_total'], 'R$ ', ''),
                    'raw': data['kpis']['receita_total'],
                    'subtitle': 'Últimos 24 meses'
                }
            },
            'recurrence': data['recurrence'],
            'satisfaction': data['satisfaction'],
            'distributions': data['distributions'],
            'critical_analysis': data['critical_analysis'],
            'latest_update': data['latest_update'],
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(formatted_data)
        
    except Exception as e:
        return jsonify({'error': f'Erro ao carregar dados: {str(e)}'}), 500

@app.route('/api/recurrence-data')
def api_recurrence_data():
    """API específica para dados de recorrência com filtro de data"""
    try:
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        # Converter datas se fornecidas
        if data_inicio:
            data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d')
        else:
            data_inicio = datetime.now() - timedelta(days=180)
            
        if data_fim:
            data_fim = datetime.strptime(data_fim, '%Y-%m-%d')
        else:
            data_fim = datetime.now()
        
        # Carregar dados de pedidos
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")
        
        if df_pedidos.empty:
            return jsonify({'error': 'Dados de pedidos não disponíveis'}), 500
        
        # Analisar recorrência
        from data_utils import analyze_client_recurrence
        recurrence_data = analyze_client_recurrence(df_pedidos, data_inicio, data_fim)
        
        # Formatar resposta
        periodo_dias = (data_fim - data_inicio).days
        
        formatted_data = {
            'periodo': {
                'inicio': data_inicio.strftime('%d/%m/%Y'),
                'fim': data_fim.strftime('%d/%m/%Y'),
                'dias': periodo_dias
            },
            'metrics': recurrence_data,
            'charts_data': {
                'pie_recurrence': {
                    'labels': ['Primeira Compra', 'Recompra'],
                    'values': [
                        recurrence_data.get('pedidos_primeira', 0),
                        recurrence_data.get('pedidos_recompra', 0)
                    ],
                    'colors': [Config.COLORS['warning'], Config.COLORS['success']]
                },
                'bar_tickets': {
                    'labels': ['Primeira Compra', 'Recompra'],
                    'values': [
                        recurrence_data.get('ticket_primeira', 0),
                        recurrence_data.get('ticket_recompra', 0)
                    ],
                    'colors': [Config.COLORS['warning'], Config.COLORS['success']]
                }
            }
        }
        
        return jsonify(formatted_data)
        
    except Exception as e:
        return jsonify({'error': f'Erro ao analisar recorrência: {str(e)}'}), 500

@app.route('/api/satisfaction-data')
def api_satisfaction_data():
    """API para dados de satisfação com período personalizado"""
    try:
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        # Converter datas se fornecidas
        if data_inicio:
            data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d')
        else:
            data_inicio = datetime.now() - timedelta(days=30)
            
        if data_fim:
            data_fim = datetime.strptime(data_fim, '%Y-%m-%d')
        else:
            data_fim = datetime.now()
        
        # Carregar dados de satisfação
        df_satisfacao = load_satisfaction_data()
        
        if df_satisfacao.empty:
            return jsonify({'error': 'Dados de satisfação não disponíveis'}), 500
        
        # Buscar colunas automaticamente
        satisfaction_columns = {}
        for col in df_satisfacao.columns:
            col_lower = col.lower()
            if 'atendimento' in col_lower:
                satisfaction_columns['atendimento'] = col
            elif 'produto' in col_lower:
                satisfaction_columns['produto'] = col
            elif 'prazo' in col_lower:
                satisfaction_columns['prazo'] = col
            elif any(x in col_lower for x in ['possibilidade', 'recomenda']):
                satisfaction_columns['nps'] = col
        
        # Calcular métricas
        from data_utils import calculate_satisfaction_metrics
        metrics = {}
        
        for metric_name, column_name in satisfaction_columns.items():
            if column_name:
                is_nps = (metric_name == 'nps')
                metrics[metric_name] = calculate_satisfaction_metrics(
                    df_satisfacao, column_name, is_nps, data_inicio, data_fim
                )
        
        return jsonify({
            'metrics': metrics,
            'periodo': {
                'inicio': data_inicio.strftime('%d/%m/%Y'),
                'fim': data_fim.strftime('%d/%m/%Y'),
                'dias': (data_fim - data_inicio).days
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao calcular satisfação: {str(e)}'}), 500

@app.route('/api/refresh-data')
def api_refresh_data():
    """API para forçar atualização dos dados (limpar cache)"""
    try:
        from data_utils import _cache, _cache_timestamps
        _cache.clear()
        _cache_timestamps.clear()
        
        return jsonify({
            'success': True,
            'message': 'Cache limpo com sucesso',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao atualizar dados: {str(e)}'}), 500

# === FILTROS TEMPLATE ===

@app.template_filter('currency')
def currency_filter(value):
    """Filtro para formatar valores monetários"""
    if pd.isna(value) or value == 0:
        return "R$ 0"
    return format_number(value, "R$ ")

@app.template_filter('percentage')
def percentage_filter(value, decimals=1):
    """Filtro para formatar percentuais"""
    if pd.isna(value):
        return "0%"
    return f"{value:.{decimals}f}%"

@app.template_filter('phone')
def phone_filter(value):
    """Filtro para formatar telefones"""
    return format_phone_number(value)

# === HANDLERS DE ERRO ===

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# === CONTEXTO GLOBAL ===

@app.context_processor
def inject_globals():
    """Injeta variáveis globais nos templates"""
    return {
        'app_name': 'Dashboard Papello',
        'colors': Config.COLORS,
        'current_year': datetime.now().year,
        'build_time': datetime.now().strftime('%d/%m/%Y %H:%M')
    }
@app.route('/api/clients-data')
def api_clients_data():
    """API para dados dos clientes"""
    try:
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        
        if df_clientes.empty:
            return jsonify({'error': 'Dados não disponíveis'}), 500
        
        # Processar dados
        df_clientes['priority_score'] = df_clientes.apply(calculate_priority_score, axis=1)
        
        # Converter para lista de dicionários
        clients = df_clientes.to_dict('records')
        
        return jsonify({
            'clients': clients,
            'total': len(clients)
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao carregar clientes: {str(e)}'}), 500

@app.route('/api/analytics-data')
def api_analytics_data():
    """API para dados de analytics"""
    try:
        period = request.args.get('period', '90')
        comparison = request.args.get('comparison', 'previous')
        segment = request.args.get('segment', 'all')
        
        # Simular dados de analytics por enquanto
        data = {
            'period': period,
            'comparison': comparison,
            'segment': segment,
            'team_performance': {
                'actions_executed': 127,
                'actions_pending': 43,
                'execution_rate': 74.7,
                'avg_response_time': 4.2
            },
            'financial_analysis': {
                'total_revenue': 2850000,
                'revenue_at_risk': 456000,
                'churn_prediction': 12.4
            }
        }
        
        return jsonify(data)
        
    except Exception as e:
        return jsonify({'error': f'Erro ao carregar analytics: {str(e)}'}), 500
    
if __name__ == '__main__':
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=5000)