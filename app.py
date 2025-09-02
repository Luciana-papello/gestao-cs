from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json
import pandas as pd
from config import Config
from data_utils import (
    get_executive_summary_data, 
    load_google_sheet_public,
    load_satisfaction_data,
    calculate_priority_score,
    analyze_client_recurrence,
    clear_cache,
    format_number,
    format_phone_number
)

# Inicializar Flask
app = Flask(__name__)
app.config.from_object(Config)

# === ROTAS PRINCIPAIS ===

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
    """API que retorna dados para a Visão Executiva - VERSÃO FINAL CORRIGIDA"""
    try:
        print("🔄 [API] Processando /api/executive-data...")
        
        # Carregar dados usando a função corrigida
        data = get_executive_summary_data()
        
        if 'error' in data:
            print(f"❌ [API] Erro nos dados: {data['error']}")
            return jsonify({
                'error': data['error'],
                'status': 'error',
                'timestamp': datetime.now().isoformat()
            }), 500
        
        # Formatar dados para o frontend - FORMATO FINAL
        formatted_response = {
            'kpis': {
                'total_clientes': {
                    'value': f"{data['kpis']['total_clientes']:,}".replace(',', '.'),
                    'raw': data['kpis']['total_clientes'],
                    'subtitle': 'Base de clientes total',
                    'color_class': 'info'
                },
                'taxa_retencao': {
                    'value': f"{data['kpis']['taxa_retencao']:.1f}%",
                    'raw': data['kpis']['taxa_retencao'],
                    'subtitle': f"{data['kpis']['clientes_ativos']:,} clientes ativos".replace(',', '.'),
                    'color_class': 'success' if data['kpis']['taxa_retencao'] >= 70 else 'warning' if data['kpis']['taxa_retencao'] >= 50 else 'danger'
                },
                'taxa_criticos': {
                    'value': f"{data['kpis']['taxa_criticos']:.1f}%",
                    'raw': data['kpis']['taxa_criticos'],
                    'subtitle': f"{data['kpis']['clientes_criticos']:,} precisam atenção".replace(',', '.'),
                    'color_class': 'danger' if data['kpis']['taxa_criticos'] >= 20 else 'warning' if data['kpis']['taxa_criticos'] >= 10 else 'success'
                },
                'receita_total': {
                    'value': f"R$ {data['kpis']['receita_total']:,.0f}".replace(',', '.'),
                    'raw': data['kpis']['receita_total'],
                    'subtitle': 'Receita acumulada',
                    'color_class': 'success'
                }
            },
            'recurrence': data.get('recurrence', {}),
            'satisfaction': data.get('satisfaction', {}),
            'distributions': data.get('distributions', {}),
            'critical_analysis': data.get('critical_analysis', {}),
            'latest_update': data.get('latest_update', 'N/A'),
            'debug_info': data.get('debug_info', {}),
            'status': 'success',
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"✅ [API] Dados formatados - {len(formatted_response['kpis'])} KPIs enviados")
        return jsonify(formatted_response)
        
    except Exception as e:
        print(f"❌ [API] Erro crítico: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Resposta de erro estruturada
        error_response = {
            'error': f'Erro interno do servidor: {str(e)}',
            'kpis': {
                'total_clientes': {'value': 'Erro', 'raw': 0, 'subtitle': 'Falha ao carregar', 'color_class': 'danger'},
                'taxa_retencao': {'value': 'Erro', 'raw': 0, 'subtitle': 'Falha ao carregar', 'color_class': 'danger'},
                'taxa_criticos': {'value': 'Erro', 'raw': 0, 'subtitle': 'Falha ao carregar', 'color_class': 'danger'},
                'receita_total': {'value': 'Erro', 'raw': 0, 'subtitle': 'Falha ao carregar', 'color_class': 'danger'}
            },
            'recurrence': {},
            'satisfaction': {},
            'distributions': {},
            'critical_analysis': {},
            'latest_update': 'Erro',
            'status': 'error',
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(error_response), 500

@app.route('/api/clients-data')
def api_clients_data():
    """API para dados dos clientes"""
    try:
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        
        if df_clientes.empty:
            return jsonify({'error': 'Dados de clientes não disponíveis'}), 500
        
        # Processar dados
        df_clientes['priority_score'] = df_clientes.apply(calculate_priority_score, axis=1)
        
        # Converter para lista de dicionários
        clients = df_clientes.to_dict('records')
        
        return jsonify({
            'clients': clients,
            'total': len(clients),
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({'error': f'Erro ao carregar clientes: {str(e)}', 'status': 'error'}), 500

@app.route('/api/analytics-data')
def api_analytics_data():
    """API para dados de analytics"""
    try:
        period = request.args.get('period', '90')
        comparison = request.args.get('comparison', 'previous')
        segment = request.args.get('segment', 'all')
        
        # Por enquanto, dados simulados de analytics
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
            },
            'status': 'success'
        }
        
        return jsonify(data)
        
    except Exception as e:
        return jsonify({'error': f'Erro ao carregar analytics: {str(e)}', 'status': 'error'}), 500
@app.route('/api/recurrence-data')
def api_recurrence_data():
    """API específica para dados de recorrência com filtro de data"""
    try:
        data_inicio_str = request.args.get('data_inicio')
        data_fim_str = request.args.get('data_fim')

        # Converte as strings de data para objetos datetime
        data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d') if data_inicio_str else datetime.now() - timedelta(days=180)
        data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d') if data_fim_str else datetime.now()

        # Carrega os dados de pedidos
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")

        if df_pedidos.empty:
            return jsonify({'error': 'Dados de pedidos não disponíveis'}), 500

        # Analisa a recorrência com o período especificado
        recurrence_data = analyze_client_recurrence(df_pedidos, data_inicio, data_fim)

        if not recurrence_data:
             return jsonify({'error': 'Não foram encontrados dados de recorrência para o período selecionado.'}), 404

        # Formata a resposta para o frontend
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
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Erro ao analisar recorrência: {str(e)}'}), 500
@app.route('/api/refresh-data')
def api_refresh_data():
    """API para limpar cache e forçar atualização dos dados"""
    try:
        # Limpar cache interno
        clear_cache()
        
        return jsonify({
            'status': 'success',
            'message': 'Cache limpo com sucesso',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Erro ao limpar cache: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

# === FILTROS DE TEMPLATE ===

@app.template_filter('currency')
def currency_filter(value):
    """Filtro para formatar moeda"""
    try:
        return f"R$ {float(value):,.2f}".replace(',', '.')
    except:
        return "R$ 0,00"

@app.template_filter('percentage')
def percentage_filter(value, decimals=1):
    """Filtro para formatar percentagem"""
    try:
        return f"{float(value):.{decimals}f}%"
    except:
        return "0%"

@app.template_filter('phone')
def phone_filter(value):
    """Filtro para formatar telefones"""
    return format_phone_number(value)

# === HANDLERS DE ERRO ===

@app.errorhandler(404)
def not_found(error):
    """Página não encontrada"""
    return jsonify({
        'error': 'Página não encontrada',
        'status': 'not_found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Erro interno do servidor"""
    return jsonify({
        'error': 'Erro interno do servidor',
        'status': 'internal_error'
    }), 500

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

# === ROTAS DE TESTE ===

@app.route('/api/test')
def api_test():
    """Rota de teste para verificar se o Flask está funcionando"""
    return jsonify({
        'message': 'Flask está funcionando!',
        'status': 'success',
        'timestamp': datetime.now().isoformat(),
        'routes_available': [
            '/api/executive-data',
            '/api/clients-data', 
            '/api/analytics-data',
            '/api/refresh-data'
        ]
    })

# === INICIALIZAÇÃO ===

if __name__ == '__main__':
    print("🚀 Iniciando Dashboard Papello...")
    print("📊 Rotas disponíveis:")
    print("   • /api/executive-data  (Visão Executiva)")
    print("   • /api/clients-data    (Gestão de Clientes)")
    print("   • /api/analytics-data  (Analytics)")
    print("   • /api/refresh-data    (Limpar Cache)")
    print("   • /api/test           (Teste de Conexão)")
    print()
    app.run(debug=True, host='0.0.0.0', port=5003)