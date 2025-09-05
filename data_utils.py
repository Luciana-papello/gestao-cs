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
        
        if 'data_pedido_realizado' in df.columns:
            print("INFO: Convertendo a coluna 'data_pedido_realizado' para datetime...")
            # CORREÇÃO: Removido 'dayfirst=True'. Pandas irá inferir o formato ISO (YYYY-MM-DD) corretamente.
            df['data_pedido_realizado'] = pd.to_datetime(df['data_pedido_realizado'], errors='coerce')
            
            validas = df['data_pedido_realizado'].notna().sum()
            total = len(df)
            print(f"INFO: Conversão de data concluída. {validas}/{total} datas válidas ({(validas/total*100):.1f}%).")

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
                'promotores': int(promotores),
                'neutros': int(neutros),
                'detratores': int(detratores),
                'total_validas': int(total_validas),
                'nps_valor': float(nps_valor)
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

def load_google_sheet_corrected(sheet_id: str, sheet_name: str) -> pd.DataFrame:
    """Carregamento corrigido do Google Sheets que funciona com datas ISO"""
    try:
        url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={sheet_name}"
        print(f"📊 Carregando aba '{sheet_name}' com método corrigido...")
        
        # Carregar dados
        df = pd.read_csv(url)
        print(f"✅ {len(df)} registros carregados")
        
        # Se tem coluna de data, converter corretamente
        if 'data_pedido_realizado' in df.columns:
            print("🔄 Convertendo datas com método corrigido...")
            
            # Múltiplos métodos de conversão para garantir sucesso
            df['data_original'] = df['data_pedido_realizado'].copy()
            
            # Método 1: ISO format direto
            df['data_convertida'] = pd.to_datetime(df['data_pedido_realizado'], errors='coerce')
            
            # Método 2: Se falhou, tentar outros formatos
            mask_nat = df['data_convertida'].isna()
            if mask_nat.sum() > 0:
                print(f"⚠️ {mask_nat.sum()} datas falharam na conversão ISO, tentando outros formatos...")
                
                # Tentar formato DD/MM/YYYY
                df.loc[mask_nat, 'data_convertida'] = pd.to_datetime(
                    df.loc[mask_nat, 'data_pedido_realizado'], 
                    format='%d/%m/%Y', 
                    errors='coerce'
                )
                
                # Tentar formato brasileiro
                mask_nat2 = df['data_convertida'].isna()
                if mask_nat2.sum() > 0:
                    df.loc[mask_nat2, 'data_convertida'] = pd.to_datetime(
                        df.loc[mask_nat2, 'data_pedido_realizado'], 
                        dayfirst=True, 
                        errors='coerce'
                    )
            
            # Substituir coluna original pela convertida
            df['data_pedido_realizado'] = df['data_convertida']
            
            # Estatísticas de conversão
            validas = df['data_pedido_realizado'].notna().sum()
            total = len(df)
            print(f"📊 Conversão de datas: {validas}/{total} ({validas/total*100:.1f}%) válidas")
            
            # Limpar colunas auxiliares
            df = df.drop(['data_original', 'data_convertida'], axis=1, errors='ignore')
        
        return df
        
    except Exception as e:
        print(f"❌ Erro ao carregar planilha: {e}")
        return pd.DataFrame()

def analyze_client_recurrence_corrected(df_pedidos: pd.DataFrame, data_inicio=None, data_fim=None) -> Dict:
    """
    Versão corrigida e simplificada que analisa a recorrência de clientes.
    Funciona com datas corretamente carregadas.
    """
    if df_pedidos.empty:
        return {}
    
    try:
        print("🔍 ANÁLISE DE RECORRÊNCIA - INICIANDO...")
        
        required_cols = ['data_pedido_realizado', 'status_pedido', 'cliente_unico_id', 'valor_do_pedido']
        if not all(col in df_pedidos.columns for col in required_cols):
            print(f"❌ Colunas necessárias não encontradas. Requeridas: {required_cols}")
            return {}
        
        # Trabalhar com cópia e garantir que a coluna de data é do tipo datetime
        df_work = df_pedidos.copy()
        df_work['data_pedido_realizado'] = pd.to_datetime(df_work['data_pedido_realizado'], errors='coerce')
        
        # Remover quaisquer linhas onde a data não pôde ser convertida
        df_valid_dates = df_work.dropna(subset=['data_pedido_realizado'])
        print(f"📊 Total de pedidos com datas válidas: {len(df_valid_dates)} de {len(df_pedidos)}")

        # Aplicar filtro de data se fornecido
        if data_inicio and data_fim:
            df_periodo = df_valid_dates[
                (df_valid_dates['data_pedido_realizado'] >= pd.to_datetime(data_inicio)) &
                (df_valid_dates['data_pedido_realizado'] <= pd.to_datetime(data_fim))
            ]
        else:
            # Se não houver período, analisa todos os dados com datas válidas
            df_periodo = df_valid_dates
        
        print(f"📊 Pedidos no período selecionado: {len(df_periodo)}")
        if df_periodo.empty:
            return {
                'pedidos_primeira': 0, 'pedidos_recompra': 0, 'taxa_conversao': 0.0,
                'ticket_primeira': 0.0, 'ticket_recompra': 0.0, 'total_pedidos': 0, 'clientes_unicos': 0
            }

        # Limpar status e valor do pedido
        df_periodo['status_clean'] = df_periodo['status_pedido'].astype(str).str.strip().str.lower()
        df_periodo['valor_numerico'] = pd.to_numeric(
            df_periodo['valor_do_pedido'].astype(str).str.replace(',', '.').str.replace(r'[^\d.]', '', regex=True),
            errors='coerce'
        ).fillna(0)
        
        # Contar por status (usando a lógica robusta de `cs.py`)
        primeiro_count = len(df_periodo[df_periodo['status_clean'] == 'primeiro'])
        recompra_count = len(df_periodo[df_periodo['status_clean'] == 'recompra'])
        
        # Calcular taxa de conversão
        taxa_conversao = 0.0
        df_primeiro = df_periodo[df_periodo['status_clean'] == 'primeiro']
        if not df_primeiro.empty:
            df_recompra = df_periodo[df_periodo['status_clean'] == 'recompra']
            clientes_primeiro = set(df_primeiro['cliente_unico_id'])
            clientes_recompra = set(df_recompra['cliente_unico_id'])
            clientes_convertidos = len(clientes_primeiro.intersection(clientes_recompra))
            if len(clientes_primeiro) > 0:
                taxa_conversao = (clientes_convertidos / len(clientes_primeiro)) * 100

        # Calcular tickets médios
        ticket_primeiro = df_primeiro['valor_numerico'].mean() if not df_primeiro.empty else 0.0
        ticket_recompra = df_periodo[df_periodo['status_clean'] == 'recompra']['valor_numerico'].mean() if recompra_count > 0 else 0.0
        
        result = {
            'pedidos_primeira': int(primeiro_count),
            'pedidos_recompra': int(recompra_count),
            'taxa_conversao': float(taxa_conversao),
            'ticket_primeira': float(ticket_primeiro),
            'ticket_recompra': float(ticket_recompra),
            'total_pedidos': len(df_periodo),
            'clientes_unicos': df_periodo['cliente_unico_id'].nunique()
        }
        
        print(f"✅ RESULTADO: {primeiro_count} primeira, {recompra_count} recompra, {taxa_conversao:.1f}% conversão")
        return result
        
    except Exception as e:
        print(f"❌ Erro na análise de recorrência: {e}")
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


def get_executive_summary_data() -> Dict:
    """Carrega todos os dados necessários para a Visão Executiva - VERSÃO COMPLETA"""
    try:
        print("📊 Iniciando carregamento dos dados executivos...")

        # Carregar dados das planilhas
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")
        df_satisfacao = load_satisfaction_data()

        print(f"✅ Dados carregados: {len(df_clientes)} clientes, {len(df_pedidos)} pedidos, {len(df_satisfacao)} respostas de satisfação")

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
        data_fim_rec = datetime.now()
        data_inicio_rec = data_fim_rec - timedelta(days=180)
        recurrence_data = analyze_client_recurrence_corrected(df_pedidos, data_inicio_rec, data_fim_rec)

        # Buscar colunas de satisfação automaticamente
        satisfaction_columns = {
            'atendimento': None, 'produto': None, 'prazo': None, 'nps': None
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
                    'value': 'N/A', 'trend': 'Coluna não encontrada', 'color_class': 'info', 'details': {}
                }

        # Distribuições para gráficos
        nivel_distribution = df_clientes['nivel_cliente'].value_counts().to_dict()
        churn_distribution = df_clientes['status_churn'].value_counts().to_dict()
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
            'charts_data': {
                'pie_recurrence': recurrence_data.get('distribuicao_periodo', {}),
                'bar_tickets': {
                    'Primeira Compra': recurrence_data.get('ticket_primeira', 0),
                    'Recompra': recurrence_data.get('ticket_recompra', 0)
                }
            },
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


# === ADICIONAR esta função no data_utils.py para DEBUG ===

def debug_status_pedido_values():
    """Debug específico para investigar valores da coluna status_pedido"""
    try:
        from config import Config
        
        print("🔍 DEBUG: Investigando valores de status_pedido...")
        
        # Carregar dados
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")
        
        if df_pedidos.empty:
            print("❌ Planilha de pedidos vazia")
            return
        
        print(f"📊 Total de pedidos: {len(df_pedidos)}")
        print(f"📋 Colunas disponíveis: {list(df_pedidos.columns)}")
        
        # Verificar se coluna existe
        if 'status_pedido' not in df_pedidos.columns:
            print("❌ PROBLEMA: Coluna 'status_pedido' não encontrada!")
            print("📋 Colunas similares encontradas:")
            for col in df_pedidos.columns:
                if 'status' in col.lower() or 'pedido' in col.lower():
                    print(f"   - {col}")
            return
        
        # Investigar valores únicos
        print("\n🔍 VALORES ÚNICOS da coluna 'status_pedido':")
        valores_unicos = df_pedidos['status_pedido'].value_counts()
        for valor, count in valores_unicos.items():
            print(f"   '{valor}' -> {count} ocorrências")
        
        # Investigar após limpeza
        print("\n🔍 VALORES APÓS LIMPEZA (lower + strip):")
        df_pedidos['status_clean'] = df_pedidos['status_pedido'].astype(str).str.strip().str.lower()
        valores_limpos = df_pedidos['status_clean'].value_counts()
        for valor, count in valores_limpos.items():
            print(f"   '{valor}' -> {count} ocorrências")
        
        # Testar variações de busca
        print("\n🔍 TESTANDO VARIAÇÕES DE BUSCA:")
        primeira_variations = ['primeiro', 'primeira', 'first', 'nova', 'novo']
        recompra_variations = ['recompra', 'repeat', 'recorrente', 'retorno']
        
        print("\n📊 PRIMEIRA COMPRA:")
        for variation in primeira_variations:
            count_isin = len(df_pedidos[df_pedidos['status_clean'].isin([variation])])
            count_contains = len(df_pedidos[df_pedidos['status_clean'].str.contains(variation, na=False)])
            print(f"   '{variation}' -> isin: {count_isin}, contains: {count_contains}")
        
        print("\n📊 RECOMPRA:")
        for variation in recompra_variations:
            count_isin = len(df_pedidos[df_pedidos['status_clean'].isin([variation])])
            count_contains = len(df_pedidos[df_pedidos['status_clean'].str.contains(variation, na=False)])
            print(f"   '{variation}' -> isin: {count_isin}, contains: {count_contains}")
        
        # Filtro por período para comparar
        print(f"\n🔍 FILTRANDO POR PERÍODO (últimos 180 dias)...")
        from datetime import datetime, timedelta
        
        df_pedidos['data_convertida'] = pd.to_datetime(df_pedidos['data_pedido_realizado'], errors='coerce')
        data_fim = datetime.now()
        data_inicio = data_fim - timedelta(days=180)
        
        df_periodo = df_pedidos[
            (df_pedidos['data_convertida'] >= data_inicio) &
            (df_pedidos['data_convertida'] <= data_fim)
        ]
        
        print(f"📊 Pedidos no período: {len(df_periodo)}")
        
        if len(df_periodo) > 0:
            print("\n📊 STATUS NO PERÍODO:")
            status_periodo = df_periodo['status_clean'].value_counts()
            for valor, count in status_periodo.items():
                print(f"   '{valor}' -> {count} ocorrências")
        
        print("\n✅ Debug concluído!")
        
    except Exception as e:
        print(f"❌ Erro no debug: {e}")
        import traceback
        traceback.print_exc()   

def debug_date_conversion():
    """Debug específico para investigar problema na conversão de datas"""
    try:
        from config import Config
        from datetime import datetime, timedelta
        
        print("🔍 DEBUG: Investigando conversão de datas...")
        
        # Carregar dados
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")
        
        if df_pedidos.empty:
            print("❌ Planilha vazia")
            return
        
        print(f"📊 Total de pedidos carregados: {len(df_pedidos)}")
        
        # Verificar coluna de data
        print(f"\n🔍 VALORES BRUTOS da coluna 'data_pedido_realizado':")
        print("Primeiras 5 datas:")
        for i in range(min(5, len(df_pedidos))):
            valor_bruto = df_pedidos.iloc[i]['data_pedido_realizado']
            print(f"   [{i}] '{valor_bruto}' (tipo: {type(valor_bruto)})")
        
        # Testar diferentes métodos de conversão
        print(f"\n🔍 TESTANDO CONVERSÕES DE DATA:")
        
        # Método 1: Padrão (errors='coerce')
        print("1. Conversão padrão (errors='coerce'):")
        df_test1 = df_pedidos.copy()
        df_test1['data_conv_1'] = pd.to_datetime(df_test1['data_pedido_realizado'], errors='coerce')
        validas_1 = df_test1['data_conv_1'].notna().sum()
        print(f"   Válidas: {validas_1} de {len(df_pedidos)} ({validas_1/len(df_pedidos)*100:.1f}%)")
        
        # Método 2: Formato específico ISO
        print("2. Conversão com formato ISO (YYYY-MM-DD):")
        df_test2 = df_pedidos.copy()
        df_test2['data_conv_2'] = pd.to_datetime(df_test2['data_pedido_realizado'], format='%Y-%m-%d %H:%M:%S', errors='coerce')
        validas_2 = df_test2['data_conv_2'].notna().sum()
        print(f"   Válidas: {validas_2} de {len(df_pedidos)} ({validas_2/len(df_pedidos)*100:.1f}%)")
        
        # Método 3: Sem especificar formato
        print("3. Conversão automática (sem format):")
        df_test3 = df_pedidos.copy()
        df_test3['data_conv_3'] = pd.to_datetime(df_test3['data_pedido_realizado'], errors='coerce')
        validas_3 = df_test3['data_conv_3'].notna().sum()
        print(f"   Válidas: {validas_3} de {len(df_pedidos)} ({validas_3/len(df_pedidos)*100:.1f}%)")
        
        # Usar o melhor método
        melhor_metodo = max([(validas_1, 1), (validas_2, 2), (validas_3, 3)])[1]
        print(f"\n✅ MELHOR MÉTODO: {melhor_metodo}")
        
        if melhor_metodo == 1:
            df_work = df_test1
            df_work['data_convertida'] = df_work['data_conv_1']
        elif melhor_metodo == 2:
            df_work = df_test2
            df_work['data_convertida'] = df_work['data_conv_2']
        else:
            df_work = df_test3
            df_work['data_convertida'] = df_work['data_conv_3']
        
        # Remover nulos
        df_valid = df_work.dropna(subset=['data_convertida']).copy()
        print(f"📊 Pedidos com data válida: {len(df_valid)}")
        
        # Investigar range de datas
        data_min = df_valid['data_convertida'].min()
        data_max = df_valid['data_convertida'].max()
        print(f"\n📅 RANGE DE DATAS na planilha:")
        print(f"   Mínima: {data_min}")
        print(f"   Máxima: {data_max}")
        
        # Testar filtro de 180 dias com diferentes datas finais
        print(f"\n🔍 TESTANDO FILTRO DE 180 DIAS:")
        
        # Teste A: Data fim = hoje
        data_fim_hoje = datetime.now()
        data_inicio_hoje = data_fim_hoje - timedelta(days=180)
        
        df_filtrado_hoje = df_valid[
            (df_valid['data_convertida'] >= data_inicio_hoje) &
            (df_valid['data_convertida'] <= data_fim_hoje)
        ]
        
        print(f"A. Fim=HOJE ({data_fim_hoje.strftime('%Y-%m-%d')}):")
        print(f"   Início: {data_inicio_hoje.strftime('%Y-%m-%d')}")
        print(f"   Registros: {len(df_filtrado_hoje)}")
        
        # Teste B: Data fim = data máxima da planilha
        data_fim_max = data_max
        data_inicio_max = data_fim_max - timedelta(days=180)
        
        df_filtrado_max = df_valid[
            (df_valid['data_convertida'] >= data_inicio_max) &
            (df_valid['data_convertida'] <= data_fim_max)
        ]
        
        print(f"B. Fim=MAX_PLANILHA ({data_fim_max.strftime('%Y-%m-%d')}):")
        print(f"   Início: {data_inicio_max.strftime('%Y-%m-%d')}")
        print(f"   Registros: {len(df_filtrado_max)}")
        
        # Teste C: Últimos 180 dias dos dados disponíveis
        print(f"C. ANÁLISE POR PERÍODO:")
        
        # Ver quantos registros por mês
        df_valid['ano_mes'] = df_valid['data_convertida'].dt.to_period('M')
        registros_por_mes = df_valid['ano_mes'].value_counts().sort_index()
        
        print("   Registros por mês:")
        for periodo, count in registros_por_mes.tail(10).items():
            print(f"     {periodo}: {count} registros")
        
        # Análise por status no período que dá mais registros
        periodo_correto = df_filtrado_max if len(df_filtrado_max) > len(df_filtrado_hoje) else df_filtrado_hoje
        
        print(f"\n📊 ANÁLISE DO MELHOR PERÍODO ({len(periodo_correto)} registros):")
        periodo_correto['status_clean'] = periodo_correto['status_pedido'].astype(str).str.strip().str.lower()
        
        primeiro_count = len(periodo_correto[periodo_correto['status_clean'] == 'primeiro'])
        recompra_count = len(periodo_correto[periodo_correto['status_clean'] == 'recompra'])
        
        print(f"   Primeiro: {primeiro_count}")
        print(f"   Recompra: {recompra_count}")
        print(f"   Total: {primeiro_count + recompra_count}")
        
        if primeiro_count + recompra_count > 3000:
            print("🎯 ESTE PARECE SER O PERÍODO CORRETO!")
        else:
            print("⚠️ Ainda não encontrou o período correto...")
        
        print("\n✅ Debug de datas concluído!")
        
    except Exception as e:
        print(f"❌ Erro no debug de datas: {e}")
        import traceback
        traceback.print_exc()         