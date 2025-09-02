import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from config import Config
import re
import json
import os

# Cache simples em memória (para produção, usar Redis)
_cache = {}
_cache_timestamps = {}

def get_from_cache(key: str, timeout: int = 300):
    """Recupera dados do cache se ainda válidos"""
    if key in _cache and key in _cache_timestamps:
        if datetime.now() - _cache_timestamps[key] < timedelta(seconds=timeout):
            return _cache[key]
    return None

def set_cache(key: str, data):
    """Armazena dados no cache"""
    _cache[key] = data
    _cache_timestamps[key] = datetime.now()

def load_google_sheet_public(sheet_id: str, tab_name: str = None) -> pd.DataFrame:
    """Carrega planilha pública do Google Sheets com cache e correção de data."""
    cache_key = f"{sheet_id}_{tab_name}"
    cached_data = get_from_cache(cache_key, Config.CACHE_TIMEOUT)
    
    if cached_data is not None:
        # Retorna uma cópia para evitar modificações no cache
        return cached_data.copy()
    
    try:
        if tab_name:
            url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={tab_name}"
        else:
            url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv"
        
        df = pd.read_csv(url)
        df.columns = df.columns.str.strip()
        
        # --- LINHA CRÍTICA DA CORREÇÃO ---
        # Verifica se a coluna de data existe e a converte para o formato datetime correto
        if 'data_pedido_realizado' in df.columns:
            print("INFO: Convertendo a coluna 'data_pedido_realizado' para datetime...")
            df['data_pedido_realizado'] = pd.to_datetime(df['data_pedido_realizado'], dayfirst=True, errors='coerce')
            print("INFO: Conversão de data concluída.")

        set_cache(cache_key, df)
        # Retorna uma cópia para o uso
        return df.copy()
        
    except Exception as e:
        print(f"ERRO: Falha ao carregar a planilha '{tab_name}': {str(e)}")
        return pd.DataFrame()

def load_satisfaction_data() -> pd.DataFrame:
    """Carrega dados de pesquisa de satisfação com correção de data brasileira"""
    cache_key = "satisfaction_data"
    cached_data = get_from_cache(cache_key, Config.CACHE_TIMEOUT)
    
    if cached_data is not None:
        return cached_data
    
    try:
        url = f"https://docs.google.com/spreadsheets/d/{Config.PESQUISA_SHEET_ID}/gviz/tq?tqx=out:csv"
        df = pd.read_csv(url)
        df.columns = df.columns.str.strip()
        
        date_cols = [col for col in df.columns if any(x in col.lower() for x in ['carimbo', 'data', 'timestamp'])]
        
        for col in date_cols:
            df[col] = pd.to_datetime(df[col], format='%d/%m/%Y %H:%M:%S', errors='coerce')
            mask_null = df[col].isnull()
            if mask_null.any():
                df.loc[mask_null, col] = pd.to_datetime(df.loc[mask_null, col], format='%d/%m/%Y', errors='coerce')
        
        set_cache(cache_key, df)
        return df.copy()
        
    except Exception as e:
        print(f"Erro ao carregar dados de satisfação: {str(e)}")
        return pd.DataFrame()

def convert_text_score_to_number(text_score) -> float:
    """Converte respostas em texto para valores numéricos"""
    if pd.isna(text_score) or text_score == "":
        return np.nan
    
    text_score = str(text_score).lower().strip()
    
    # Mapeamento otimizado
    mappings = {
        'entre 0 e 1': 0.5, 'entre 1 e 2': 1.5, 'entre 2 e 3': 2.5,
        'entre 3 e 4': 3.5, 'entre 4 e 5': 4.5, 'entre 5 e 6': 5.5,
        'entre 6 e 7': 6.5, 'entre 7 e 8': 7.5, 'entre 8 e 9': 8.5,
        'entre 9 e 10': 9.5, 'entre 1 e 6': 3.5
    }
    
    for key, value in mappings.items():
        if key in text_score:
            return value
    
    # Fallback para extração de números
    numbers = re.findall(r'\d+', text_score)
    if len(numbers) >= 2:
        return (float(numbers[0]) + float(numbers[1])) / 2
    elif len(numbers) == 1:
        return float(numbers[0])
    
    return np.nan

def categorize_nps_from_text(text_score) -> str:
    """Categoriza respostas em texto para NPS"""
    if pd.isna(text_score) or text_score == "" or str(text_score).lower().strip() == "":
        return "Sem resposta"
    
    text_score = str(text_score).lower().strip()
    
    # Detratores (0-6)
    detrator_patterns = [
        'entre 0 e 1', 'entre 1 e 2', 'entre 2 e 3', 
        'entre 3 e 4', 'entre 4 e 5', 'entre 5 e 6', 
        'entre 1 e 6', '0', '1', '2', '3', '4', '5', '6'
    ]
    
    # Neutros (7-8)
    neutro_patterns = ['entre 7 e 8', '7', '8']
    
    # Promotores (9-10)
    promotor_patterns = ['entre 9 e 10', '9', '10']
    
    # Verificar padrões
    if any(pattern in text_score for pattern in promotor_patterns):
        return "Promotor"
    elif any(pattern in text_score for pattern in neutro_patterns):
        return "Neutro"
    elif any(pattern in text_score for pattern in detrator_patterns):
        return "Detrator"
    
    # Tentar extrair número se for formato numérico direto
    numbers = re.findall(r'\d+', text_score)
    if numbers:
        try:
            score = int(numbers[0])
            if score >= 9:
                return "Promotor"
            elif score >= 7:
                return "Neutro"
            elif score >= 0:
                return "Detrator"
        except ValueError:
            pass
    
    return "Indefinido"

def calculate_priority_score(row) -> float:
    try:
        priority_weights = {'Premium': 100, 'Gold': 80, 'Silver': 60, 'Bronze': 40}
        churn_weights = {
            'Dormant_Premium': 300, 'Dormant_Gold': 250, 'Dormant_Silver': 200,
            'Dormant_Bronze': 150, 'Dormant_Novo': 120, 'Inativo': 100, 'Ativo': 0
        }
        risk_weights = {
            'Novo_Alto': 80, 'Alto': 50, 'Novo_Médio': 40,
            'Médio': 30, 'Novo_Baixo': 20, 'Baixo': 10
        }
        nivel = row.get('nivel_cliente', 'Bronze')
        risco = row.get('risco_recencia', 'Baixo')
        churn = row.get('status_churn', 'Ativo')
        top20 = 1 if row.get('top_20_valor', 'Não') == 'Sim' else 0
        return float(priority_weights.get(nivel, 40) + risk_weights.get(risco, 10) + churn_weights.get(churn, 0) + top20 * 25)
    except:
        return 0


def calculate_satisfaction_metrics(df_satisfacao: pd.DataFrame, column_name: str, 
                                 is_nps: bool = False, data_inicio=None, data_fim=None) -> Dict:
    """Calcula métricas de satisfação com comparação temporal"""
    if df_satisfacao.empty:
        return {
            'value': 'N/A',
            'trend': 'Sem dados',
            'color_class': 'info',
            'details': {}
        }
    
    # Usar período padrão se não especificado
    if not data_inicio or not data_fim:
        data_fim = datetime.now()
        data_inicio = data_fim - timedelta(days=30)
    
    # Buscar coluna de data
    date_column = None
    for col in df_satisfacao.columns:
        if any(x in col.lower() for x in ['carimbo', 'data', 'timestamp', 'time']):
            date_column = col
            break
    
    if not date_column or column_name not in df_satisfacao.columns:
        return {
            'value': 'N/A',
            'trend': 'Coluna não encontrada',
            'color_class': 'info',
            'details': {}
        }
    
    # Filtrar dados no período
    df_valid = df_satisfacao.dropna(subset=[date_column])
    dados_periodo = df_valid[
        (df_valid[date_column] >= data_inicio) & 
        (df_valid[date_column] <= data_fim)
    ]
    
    respostas_periodo = dados_periodo[column_name].dropna()
    
    if len(respostas_periodo) == 0:
        return {
            'value': 'N/A',
            'trend': 'Sem dados no período',
            'color_class': 'warning',
            'details': {}
        }
    
    # Período de comparação
    periodo_dias = (data_fim - data_inicio).days
    inicio_comparacao = data_inicio - timedelta(days=periodo_dias)
    fim_comparacao = data_inicio
    
    dados_comparacao = df_valid[
        (df_valid[date_column] >= inicio_comparacao) & 
        (df_valid[date_column] < fim_comparacao)
    ]
    respostas_comparacao = dados_comparacao[column_name].dropna()
    
    if is_nps:
        # Cálculo NPS
        categorias_periodo = respostas_periodo.apply(categorize_nps_from_text)
        promotores = (categorias_periodo == 'Promotor').sum()
        neutros = (categorias_periodo == 'Neutro').sum()
        detratores = (categorias_periodo == 'Detrator').sum()
        total_validas = promotores + neutros + detratores
        
        if total_validas == 0:
            return {
                'value': 'N/A',
                'trend': 'Sem respostas válidas',
                'color_class': 'warning',
                'details': {}
            }
            
        nps_valor = ((promotores - detratores) / total_validas * 100)
        
        # Comparação com período anterior
        if len(respostas_comparacao) > 0:
            categorias_comp = respostas_comparacao.apply(categorize_nps_from_text)
            promotores_comp = (categorias_comp == 'Promotor').sum()
            detratores_comp = (categorias_comp == 'Detrator').sum()
            neutros_comp = (categorias_comp == 'Neutro').sum()
            total_comp = promotores_comp + neutros_comp + detratores_comp
            
            if total_comp > 0:
                nps_comp = ((promotores_comp - detratores_comp) / total_comp * 100)
                diferenca = nps_valor - nps_comp
                
                if diferenca > 5:
                    trend = f"↗️ +{diferenca:.0f} pts vs anterior"
                    color_class = "success"
                elif diferenca < -5:
                    trend = f"↘️ {diferenca:.0f} pts vs anterior"
                    color_class = "danger"
                else:
                    trend = f"➡️ {diferenca:+.0f} pts vs anterior"
                    color_class = "success" if nps_valor >= 50 else "warning" if nps_valor >= 0 else "danger"
            else:
                trend = f"{total_validas} avaliações"
                color_class = "success" if nps_valor >= 50 else "warning" if nps_valor >= 0 else "danger"
        else:
            trend = f"{total_validas} avaliações"
            color_class = "success" if nps_valor >= 50 else "warning" if nps_valor >= 0 else "danger"
            
        return {
            'value': f"{nps_valor:.0f}",
            'trend': trend,
            'color_class': color_class,
            'details': {
                'promotores': promotores,
                'neutros': neutros,
                'detratores': detratores,
                'total_validas': total_validas,
                'nps_valor': nps_valor
            }
        }
    
    else:
        # Outras métricas (Atendimento, Produto, Prazo)
        scores = respostas_periodo.apply(convert_text_score_to_number).dropna()
        
        if len(scores) == 0:
            return {
                'value': 'N/A',
                'trend': 'Erro na conversão',
                'color_class': 'warning',
                'details': {}
            }
            
        valor = scores.mean()
        
        if len(respostas_comparacao) > 0:
            scores_comp = respostas_comparacao.apply(convert_text_score_to_number).dropna()
            if len(scores_comp) > 0:
                valor_comp = scores_comp.mean()
                diferenca = valor - valor_comp
                
                if diferenca > 0.3:
                    trend = f"↗️ +{diferenca:.1f} vs anterior"
                    color_class = "success"
                elif diferenca < -0.3:
                    trend = f"↘️ {diferenca:.1f} vs anterior"
                    color_class = "danger"
                else:
                    trend = f"➡️ {diferenca:+.1f} vs anterior"
                    color_class = "success" if valor >= 8 else "warning" if valor >= 6 else "danger"
            else:
                trend = f"{len(respostas_periodo)} avaliações"
                color_class = "success" if valor >= 8 else "warning" if valor >= 6 else "danger"
        else:
            trend = f"{len(respostas_periodo)} avaliações"
            color_class = "success" if valor >= 8 else "warning" if valor >= 6 else "danger"
            
        return {
            'value': f"{valor:.1f}/10",
            'trend': trend,
            'color_class': color_class,
            'details': {
                'valor_medio': valor,
                'total_respostas': len(respostas_periodo)
            }
        }

def analyze_client_recurrence(df_pedidos: pd.DataFrame, data_inicio=None, data_fim=None) -> Dict:
    """Analisa a recorrência de clientes com correção explícita do formato da data."""
    if df_pedidos.empty:
        return {}
    
    try:
        df_work = df_pedidos.copy()
        
        # --- CORREÇÃO DEFINITIVA ---
        # Força o pandas a ler as datas no formato ano-mês-dia, removendo a ambiguidade.
        df_work['data_pedido_realizado'] = pd.to_datetime(
            df_work['data_pedido_realizado'], 
            format='%Y-%m-%d %H:%M:%S', 
            errors='coerce'
        )
        df_valid = df_work.dropna(subset=['data_pedido_realizado']).copy()
        # --- FIM DA CORREÇÃO ---

        if df_valid.empty:
            print("AVISO: Nenhuma data válida encontrada após a conversão.")
            return {}

        if data_inicio and data_fim:
            df_valid = df_valid[
                (df_valid['data_pedido_realizado'] >= data_inicio) &
                (df_valid['data_pedido_realizado'] <= data_fim)
            ]

        if df_valid.empty:
            print(f"AVISO: Nenhum pedido encontrado no período de {data_inicio.strftime('%d/%m/%Y')} a {data_fim.strftime('%d/%m/%Y')}.")
            return {}

        df_valid['status_pedido_clean'] = df_valid['status_pedido'].astype(str).str.strip().str.lower()
        
        df_primeira = df_valid[df_valid['status_pedido_clean'] == 'primeiro']
        df_recompra = df_valid[df_valid['status_pedido_clean'] == 'recompra']

        pedidos_primeira_compra = len(df_primeira)
        pedidos_recompra = len(df_recompra)
        
        df_valid['valor_numerico'] = pd.to_numeric(
            df_valid['valor_do_pedido'].astype(str).str.replace(',', '.').str.replace(r'[^\d.]', '', regex=True),
            errors='coerce'
        ).fillna(0)

        ticket_primeira = df_primeira['valor_numerico'].mean() if pedidos_primeira_compra > 0 else 0.0
        ticket_recompra = df_recompra['valor_numerico'].mean() if pedidos_recompra > 0 else 0.0
        
        taxa_conversao = 0.0
        clientes_primeira = set(df_primeira['cliente_unico_id'])
        if len(clientes_primeira) > 0:
            clientes_recompra_set = set(df_recompra['cliente_unico_id'])
            clientes_convertidos = len(clientes_primeira.intersection(clientes_recompra_set))
            taxa_conversao = (clientes_convertidos / len(clientes_primeira)) * 100

        return {
            'pedidos_primeira': int(pedidos_primeira_compra),
            'pedidos_recompra': int(pedidos_recompra),
            'taxa_conversao': float(taxa_conversao),
            'ticket_primeira': float(ticket_primeira),
            'ticket_recompra': float(ticket_recompra)
        }

    except Exception as e:
        print(f"ERRO em analyze_client_recurrence: {e}")
        import traceback
        traceback.print_exc()
        return {}

def get_latest_update_date(df_pedidos: pd.DataFrame) -> str:
    """Pega a data mais recente da planilha de pedidos"""
    if df_pedidos.empty:
        return "N/A"
    
    try:
        if 'data_pedido_realizado' not in df_pedidos.columns:
            return "N/A"
        
        df_temp = df_pedidos.copy()
        df_temp['data_pedido_realizado'] = pd.to_datetime(df_temp['data_pedido_realizado'], errors='coerce')
        
        dates_valid = df_temp['data_pedido_realizado'].dropna()
        
        if len(dates_valid) == 0:
            return "N/A"
        
        latest_date = dates_valid.max()
        
        if pd.isna(latest_date):
            return "N/A"
        
        return latest_date.strftime('%d/%m/%Y')
    
    except Exception as e:
        return "N/A"

# === ADICIONAR ESTAS FUNÇÕES NO FINAL DO data_utils.py ===

# ENCONTRAR E SUBSTITUIR A FUNÇÃO INCOMPLETA get_executive_summary_data() 
# no data_utils.py por esta versão completa:

def get_executive_summary_data() -> Dict:
    """Carrega todos os dados necessários para a Visão Executiva - VERSÃO COMPLETA"""
    try:
        print("📊 Iniciando carregamento dos dados executivos...")

        # Carregar dados das planilhas
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")
        df_satisfacao = load_satisfaction_data()

        print(f"✅ Dados carregados: {len(df_clientes)} clientes, {len(df_pedidos)} pedidos")

        if df_clientes.empty:
            print("❌ Planilha de clientes vazia")
            return {'error': 'Não foi possível carregar dados dos clientes'}

        # Processar dados dos clientes
        df_clientes = df_clientes.copy()
        df_clientes['priority_score'] = df_clientes.apply(calculate_priority_score, axis=1)

        # Converter receita para numérico (essencial para cálculos)
        df_clientes['receita_num'] = pd.to_numeric(
            df_clientes['receita'].str.replace(',', '.'),
            errors='coerce'
        ).fillna(0)

        print(f"✅ Dados processados: receita total R$ {df_clientes['receita_num'].sum():.0f}")

        # KPIs principais
        total_clientes = len(df_clientes)
        clientes_ativos = len(df_clientes[df_clientes['status_churn'] == 'Ativo'])
        clientes_criticos = len(df_clientes[df_clientes['priority_score'] >= 200])
        receita_total = df_clientes['receita_num'].sum()

        print(f"✅ KPIs calculados: {total_clientes} clientes, {clientes_ativos} ativos, {clientes_criticos} críticos")

        # Análise de recorrência (últimos 6 meses por padrão)
        data_fim = datetime.now()
        data_inicio = data_fim - timedelta(days=180)
        recurrence_data = analyze_client_recurrence(df_pedidos, data_inicio, data_fim)

        # Buscar colunas de satisfação automaticamente
        satisfaction_columns = {
            'atendimento': None,
            'produto': None,
            'prazo': None,
            'nps': None
        }

        if not df_satisfacao.empty:
            for col in df_satisfacao.columns:
                col_lower = col.lower()
                if 'atendimento' in col_lower and not satisfaction_columns['atendimento']:
                    satisfaction_columns['atendimento'] = col
                elif 'produto' in col_lower and not satisfaction_columns['produto']:
                    satisfaction_columns['produto'] = col
                elif 'prazo' in col_lower and not satisfaction_columns['prazo']:
                    satisfaction_columns['prazo'] = col
                elif any(x in col_lower for x in ['possibilidade', 'recomenda']) and not satisfaction_columns['nps']:
                    satisfaction_columns['nps'] = col

        # Calcular métricas de satisfação (período padrão de 30 dias)
        satisfaction_metrics = {}
        for metric_name, column_name in satisfaction_columns.items():
            if column_name:
                is_nps = (metric_name == 'nps')
                satisfaction_metrics[metric_name] = calculate_satisfaction_metrics(
                    df_satisfacao, column_name, is_nps
                )
            else:
                satisfaction_metrics[metric_name] = {
                    'value': 'N/A',
                    'trend': 'Coluna não encontrada',
                    'color_class': 'info',
                    'details': {}
                }

        # Distribuições para gráficos
        nivel_distribution = df_clientes['nivel_cliente'].value_counts().to_dict()
        churn_distribution = df_clientes['status_churn'].value_counts().to_dict()

        # Análise de risco agrupado
        risco_agrupado = df_clientes['risco_recencia'].map({
            'Alto': 'Alto Risco', 'Novo_Alto': 'Alto Risco',
            'Médio': 'Médio Risco', 'Novo_Médio': 'Médio Risco',
            'Baixo': 'Baixo Risco', 'Novo_Baixo': 'Baixo Risco'
        }).fillna('Sem Classificação').value_counts().to_dict()

        # Clientes Premium em risco para análise crítica
        premium_em_risco = df_clientes[
            (df_clientes['nivel_cliente'].isin(['Premium', 'Gold'])) &
            (df_clientes['risco_recencia'].isin(['Alto', 'Novo_Alto', 'Médio', 'Novo_Médio']))
        ]

        print("✅ Dados executivos processados com sucesso")

        # Estrutura de retorno completa para a API
        return {
            'kpis': {
                'total_clientes': total_clientes,
                'clientes_ativos': clientes_ativos,
                'taxa_retencao': (clientes_ativos / total_clientes * 100) if total_clientes > 0 else 0,
                'clientes_criticos': clientes_criticos,
                'taxa_criticos': (clientes_criticos / total_clientes * 100) if total_clientes > 0 else 0,
                'receita_total': receita_total
            },
            'recurrence': recurrence_data,
            'satisfaction': satisfaction_metrics,
            'distributions': {
                'nivel': nivel_distribution,
                'churn': churn_distribution,
                'risco': risco_agrupado
            },
            'critical_analysis': {
                'premium_em_risco': len(premium_em_risco),
                'total_premium': len(df_clientes[df_clientes['nivel_cliente'].isin(['Premium', 'Gold'])]),
                'receita_em_risco': premium_em_risco['receita_num'].sum() if len(premium_em_risco) > 0 else 0
            },
            'latest_update': get_latest_update_date(df_pedidos)
        }

    except Exception as e:
        print(f"❌ Erro ao carregar dados executivos: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'error': f'Erro ao processar dados: {str(e)}'}
        


def clear_cache():
    """Limpa o cache interno"""
    global _cache, _cache_timestamps
    _cache.clear()
    _cache_timestamps.clear()
    print("✅ Cache limpo com sucesso")
    

def format_number(value, prefix="", suffix=""):
    """Formata números para exibição"""
    if pd.isna(value) or value == 0:
        return f"{prefix}0{suffix}"
    
    if value >= 1000000:
        return f"{prefix}{value/1000000:.1f}M{suffix}"
    elif value >= 1000:
        return f"{prefix}{value/1000:.0f}K{suffix}"
    else:
        return f"{prefix}{value:,.0f}{suffix}"

def format_phone_number(phone):
    """Formata número de telefone"""
    if pd.isna(phone) or phone == "":
        return "N/A"
    
    phone_str = str(phone)
    if phone_str.endswith('.0'):
        phone_str = phone_str[:-2]
    
    return phone_str


def convert_text_score_to_number(text_score):
    """Converte respostas em texto para números"""
    if pd.isna(text_score) or text_score == "":
        return np.nan
    
    text_score = str(text_score).lower().strip()
    
    # Mapeamento de respostas textuais
    text_mappings = {
        'excelente': 10,
        'ótimo': 9,
        'muito bom': 8,
        'bom': 7,
        'regular': 6,
        'ruim': 4,
        'péssimo': 2,
        'muito ruim': 3,
        'satisfeito': 8,
        'muito satisfeito': 9,
        'insatisfeito': 4,
        'muito insatisfeito': 2
    }
    
    # Procurar por mapeamentos textuais
    for key, value in text_mappings.items():
        if key in text_score:
            return value
    
    # Procurar por números na string
    numbers = re.findall(r'\d+', text_score)
    if numbers:
        try:
            return float(numbers[0])
        except ValueError:
            pass
    
    return np.nan

def categorize_nps_from_text(text_score):
    """Categoriza respostas de NPS em texto"""
    if pd.isna(text_score) or text_score == "":
        return "Sem resposta"
    
    text_score = str(text_score).lower().strip()
    
    # Padrões para promotores
    promoter_patterns = [
        'entre 9 e 10', '9-10', 'promotor', 
        'muito provável', 'certamente', 'definitivamente'
    ]
    
    # Padrões para neutros
    neutral_patterns = [
        'entre 7 e 8', '7-8', 'neutro',
        'talvez', 'possivelmente', 'pode ser'
    ]
    
    # Padrões para detratores
    detractor_patterns = [
        'entre 0 e 6', '0-6', 'detrator', 'entre 1 e 6',
        'improvável', 'nunca', 'jamais', 'não recomendo'
    ]
    
    # Classificar baseado nos padrões
    if any(pattern in text_score for pattern in promoter_patterns):
        return "Promotor"
    elif any(pattern in text_score for pattern in neutral_patterns):
        return "Neutro"
    elif any(pattern in text_score for pattern in detractor_patterns):
        return "Detrator"
    
    # Tentar extrair número se for formato numérico direto
    numbers = re.findall(r'\d+', text_score)
    if numbers:
        try:
            score = int(numbers[0])
            if score >= 9:
                return "Promotor"
            elif score >= 7:
                return "Neutro"
            elif score >= 0:
                return "Detrator"
        except ValueError:
            pass
    
    return "Indefinido"

def load_actions_log():
    """Carrega log de ações (para compatibilidade com o Streamlit)"""
    actions_file = "cs_actions_log.json"
    if os.path.exists(actions_file):
        try:
            with open(actions_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Erro ao carregar actions log: {str(e)}")
            return []
    return []

def save_action_log(action_data):
    """Salva ação no log"""
    actions_file = "cs_actions_log.json"
    actions = load_actions_log()
    action_data['timestamp'] = datetime.now().isoformat()
    actions.append(action_data)
    
    try:
        with open(actions_file, 'w', encoding='utf-8') as f:
            json.dump(actions, f, ensure_ascii=False, indent=2)
        print(f"✅ Ação salva: {action_data.get('action_type', 'N/A')}")
    except Exception as e:
        print(f"❌ Erro ao salvar ação: {str(e)}")

# Função para compatibilidade com chamadas do template
def calculate_satisfaction_metrics(df_satisfacao: pd.DataFrame, column_name: str, 
                                 is_nps: bool = False, data_inicio=None, data_fim=None) -> Dict:
    """Calcula métricas de satisfação com comparação temporal"""
    if df_satisfacao.empty or column_name not in df_satisfacao.columns:
        return {
            'value': 'N/A',
            'trend': 'Coluna não encontrada' if column_name else 'Sem dados',
            'color_class': 'info',
            'details': {}
        }
    
    # Usar período padrão se não especificado
    if not data_inicio or not data_fim:
        data_fim = datetime.now()
        data_inicio = data_fim - timedelta(days=30)
    
    # Buscar coluna de data
    date_column = None
    for col in df_satisfacao.columns:
        if any(x in col.lower() for x in ['carimbo', 'data', 'timestamp', 'time']):
            date_column = col
            break
    
    if date_column and date_column in df_satisfacao.columns:
        # Filtrar por período
        df_work = df_satisfacao.copy()
        df_work[date_column] = pd.to_datetime(df_work[date_column], errors='coerce')
        
        # Período atual
        mask_atual = (df_work[date_column] >= data_inicio) & (df_work[date_column] <= data_fim)
        respostas_atual = df_work[mask_atual][column_name].dropna()
        
        # Período anterior (mesmo tamanho)
        periodo_anterior_inicio = data_inicio - (data_fim - data_inicio)
        mask_anterior = (df_work[date_column] >= periodo_anterior_inicio) & (df_work[date_column] < data_inicio)
        respostas_anterior = df_work[mask_anterior][column_name].dropna()
    else:
        # Sem filtro de data, usar todos os dados
        respostas_atual = df_satisfacao[column_name].dropna()
        respostas_anterior = pd.Series(dtype=object)
    
    if len(respostas_atual) == 0:
        return {
            'value': 'N/A',
            'trend': 'Sem respostas no período',
            'color_class': 'info',
            'details': {}
        }
    
    if is_nps:
        # Lógica específica para NPS
        nps_categories = respostas_atual.apply(categorize_nps_from_text)
        
        promoters = len(nps_categories[nps_categories == 'Promotor'])
        detractors = len(nps_categories[nps_categories == 'Detrator'])
        total_valid = len(nps_categories[nps_categories != 'Indefinido'])
        
        if total_valid == 0:
            nps_score = 0
        else:
            nps_score = ((promoters - detractors) / total_valid) * 100
        
        # Comparação com período anterior se disponível
        if len(respostas_anterior) > 0:
            nps_anterior = respostas_anterior.apply(categorize_nps_from_text)
            promoters_ant = len(nps_anterior[nps_anterior == 'Promotor'])
            detractors_ant = len(nps_anterior[nps_anterior == 'Detrator'])
            total_ant = len(nps_anterior[nps_anterior != 'Indefinido'])
            
            if total_ant > 0:
                nps_anterior_score = ((promoters_ant - detractors_ant) / total_ant) * 100
                diferenca = nps_score - nps_anterior_score
                
                if diferenca > 5:
                    trend = f"↗️ +{diferenca:.1f} vs anterior"
                    color_class = "success"
                elif diferenca < -5:
                    trend = f"↘️ {diferenca:.1f} vs anterior"
                    color_class = "danger"
                else:
                    trend = f"➡️ {diferenca:+.1f} vs anterior"
                    color_class = "success" if nps_score >= 50 else "warning" if nps_score >= 0 else "danger"
            else:
                trend = f"{total_valid} avaliações"
                color_class = "success" if nps_score >= 50 else "warning" if nps_score >= 0 else "danger"
        else:
            trend = f"{total_valid} avaliações"
            color_class = "success" if nps_score >= 50 else "warning" if nps_score >= 0 else "danger"
        
        return {
            'value': f"{nps_score:.0f}",
            'trend': trend,
            'color_class': color_class,
            'details': {
                'nps_score': nps_score,
                'promoters': promoters,
                'detractors': detractors,
                'total_respostas': total_valid
            }
        }
    else:
        # Métricas normais (produto, atendimento, prazo)
        scores_atual = respostas_atual.apply(convert_text_score_to_number).dropna()
        
        if len(scores_atual) == 0:
            return {
                'value': 'N/A',
                'trend': 'Erro na conversão',
                'color_class': 'info',
                'details': {}
            }
        
        valor_atual = scores_atual.mean()
        
        # Calcular período anterior se houver dados
        if len(respostas_anterior) > 0:
            scores_anterior = respostas_anterior.apply(convert_text_score_to_number).dropna()
            
            if len(scores_anterior) > 0:
                valor_anterior = scores_anterior.mean()
                diferenca = valor_atual - valor_anterior
                
                if diferenca > 0.3:
                    trend = f"↗️ +{diferenca:.1f} vs anterior"
                    color_class = "success"
                elif diferenca < -0.3:
                    trend = f"↘️ {diferenca:.1f} vs anterior"
                    color_class = "danger"
                else:
                    trend = f"➡️ {diferenca:+.1f} vs anterior"
                    color_class = "success" if valor_atual >= 8 else "warning" if valor_atual >= 6 else "danger"
            else:
                trend = f"{len(respostas_atual)} avaliações"
                color_class = "success" if valor_atual >= 8 else "warning" if valor_atual >= 6 else "danger"
        else:
            trend = f"{len(respostas_atual)} avaliações"
            color_class = "success" if valor_atual >= 8 else "warning" if valor_atual >= 6 else "danger"
        
        return {
            'value': f"{valor_atual:.1f}/10",
            'trend': trend,
            'color_class': color_class,
            'details': {
                'valor_medio': valor_atual,
                'total_respostas': len(respostas_atual)
            }
        }
