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
@app.route("/api/recurrence-analysis")
def api_recurrence_data():
    """API específica para dados de recorrência com filtro de data - VERSÃO CORRIGIDA"""
    try:
        data_inicio_str = request.args.get('data_inicio')
        data_fim_str = request.args.get('data_fim')

        # Conversão das datas
        if data_inicio_str and data_fim_str:
            data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d')
            data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d')
        else:
            data_fim = datetime.now()
            data_inicio = data_fim - timedelta(days=180)

        print(f"📅 Analisando recorrência: {data_inicio.strftime('%d/%m/%Y')} até {data_fim.strftime('%d/%m/%Y')}")

        # Carregar dados
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")

        if df_pedidos.empty:
            return jsonify({'error': 'Dados de pedidos não disponíveis'}), 500

        # Analisar recorrência
        recurrence_data = analyze_client_recurrence(df_pedidos, data_inicio, data_fim)

        if not recurrence_data:
            return jsonify({'error': 'Nenhum dado de recorrência encontrado para o período'}), 404

        # Formatar resposta
        periodo_dias = (data_fim - data_inicio).days
        
        # Configurar cores para os gráficos
        colors_config = {
            'warning': Config.COLORS['warning'],
            'success': Config.COLORS['success']
        }

        formatted_data = {
            'periodo': {
                'inicio': data_inicio.strftime('%d/%m/%Y'),
                'fim': data_fim.strftime('%d/%m/%Y'),
                'dias': periodo_dias
            },
            'metrics': {
                'pedidos_primeira': recurrence_data.get('pedidos_primeira', 0),
                'pedidos_recompra': recurrence_data.get('pedidos_recompra', 0), 
                'taxa_conversao': recurrence_data.get('taxa_conversao', 0.0),
                'ticket_primeira': recurrence_data.get('ticket_primeira', 0.0),
                'ticket_recompra': recurrence_data.get('ticket_recompra', 0.0)
            },
            'charts_data': {
                'pie_recurrence': {
                    'labels': ['Primeira Compra', 'Recompra'],
                    'values': [
                        recurrence_data.get('pedidos_primeira', 0),
                        recurrence_data.get('pedidos_recompra', 0)
                    ],
                    'colors': [colors_config['warning'], colors_config['success']]
                },
                'bar_tickets': {
                    'labels': ['Primeira Compra', 'Recompra'],
                    'values': [
                        recurrence_data.get('ticket_primeira', 0),
                        recurrence_data.get('ticket_recompra', 0)
                    ],
                    'colors': [colors_config['warning'], colors_config['success']]
                }
            },
            'status': 'success'
        }

        print(f"✅ Recorrência calculada: {formatted_data['metrics']['pedidos_primeira']} novos, {formatted_data['metrics']['pedidos_recompra']} recompras")
        return jsonify(formatted_data)

    except Exception as e:
        print(f"❌ Erro em /api/recurrence-data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Erro ao analisar recorrência: {str(e)}'}), 500

# 2. ADICIONAR ROTA PARA DADOS CRÍTICOS
@app.route('/api/critical-analysis')
def api_critical_analysis():
    """API para análises críticas estratégicas"""
    try:
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        
        if df_clientes.empty:
            return jsonify({'error': 'Dados de clientes não disponíveis'}), 500
        
        # Processar dados
        df_clientes = df_clientes.copy()
        df_clientes['priority_score'] = df_clientes.apply(calculate_priority_score, axis=1)
        df_clientes['receita_num'] = pd.to_numeric(df_clientes['receita'].str.replace(',', '.'), errors='coerce').fillna(0)
        
        # Análise de Premium em risco
        premium_em_risco = df_clientes[
            (df_clientes['nivel_cliente'].isin(['Premium', 'Gold'])) &
            (df_clientes['risco_recencia'].isin(['Alto', 'Novo_Alto', 'Médio', 'Novo_Médio']))
        ]
        
        total_premium = len(df_clientes[df_clientes['nivel_cliente'].isin(['Premium', 'Gold'])])
        receita_em_risco = premium_em_risco['receita_num'].sum()
        
        # Métricas em declínio
        taxa_inativos = len(df_clientes[df_clientes['status_churn'] == 'Inativo']) / len(df_clientes) * 100
        taxa_dormant = len(df_clientes[df_clientes['status_churn'].str.contains('Dormant', na=False)]) / len(df_clientes) * 100
        
        issues = []
        if taxa_inativos > 25:
            issues.append(f"Taxa de inativos alta ({taxa_inativos:.1f}%)")
        if taxa_dormant > 20:
            issues.append(f"Muitos clientes Dormant ({taxa_dormant:.1f}%)")
        
        # Top 3 clientes mais críticos  
        top_criticos = premium_em_risco.nlargest(3, 'priority_score') if len(premium_em_risco) > 0 else pd.DataFrame()
        top_criticos_list = []
        for _, cliente in top_criticos.iterrows():
            top_criticos_list.append({
                'nome': cliente.get('nome', 'N/A'),
                'nivel': cliente.get('nivel_cliente', 'N/A'), 
                'score': float(cliente.get('priority_score', 0)),
                'receita': float(cliente.get('receita_num', 0))
            })
        
        analysis = {
            'premium_risk': {
                'count': len(premium_em_risco),
                'total_premium': total_premium,
                'receita_em_risco': float(receita_em_risco),
                'top_criticos': top_criticos_list
            },
            'metrics_issues': issues,
            'recommendations': [
                'Campanha de reativação de clientes inativos' if taxa_inativos > 25 else None,
                'Programa de incentivos para clientes Dormant' if taxa_dormant > 20 else None,
                f'Contato direto com {len(premium_em_risco)} clientes premium em risco' if len(premium_em_risco) > 0 else None
            ],
            'status': 'success'
        }
        
        # Remover recomendações None
        analysis['recommendations'] = [r for r in analysis['recommendations'] if r is not None]
        
        return jsonify(analysis)
        
    except Exception as e:
        print(f"❌ Erro em critical analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/executive-data')  
def api_executive_data_improved():
    """API executiva melhorada com debug detalhado"""
    try:
        print("🔄 [API] Processando /api/executive-data melhorada...")
        
        # Carregar dados usando a função melhorada
        data = get_executive_summary_data()
        
        if 'error' in data:
            print(f"❌ [API] Erro nos dados: {data['error']}")
            return jsonify({
                'error': data['error'],
                'status': 'error',
                'timestamp': datetime.now().isoformat()
            }), 500
        
        # Debug das distribuições
        distributions = data.get('distributions', {})
        print(f"📊 [DEBUG] Distribuições encontradas:")
        for key, dist in distributions.items():
            if dist:
                print(f"   - {key}: {len(dist)} categorias, total: {sum(dist.values()) if isinstance(dist, dict) else 'N/A'}")
        
        # Formatar dados para o frontend
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
            'distributions': distributions,
            'critical_analysis': data.get('critical_analysis', {}),
            'latest_update': data.get('latest_update', 'N/A'),
            'debug_info': {
                'total_clients_loaded': len(data.get('df_clientes', [])) if 'df_clientes' in data else 0,
                'distributions_count': len([k for k, v in distributions.items() if v]),
                'satisfaction_metrics': len([k for k, v in data.get('satisfaction', {}).items() if v])
            },
            'status': 'success',
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"✅ [API] Dados formatados - {len(formatted_response['kpis'])} KPIs, {len(distributions)} distribuições")
        return jsonify(formatted_response)
        
    except Exception as e:
        print(f"❌ [API] Erro crítico melhorado: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Resposta de erro estruturada
        error_response = {
            'error': f'Erro interno: {str(e)}',
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