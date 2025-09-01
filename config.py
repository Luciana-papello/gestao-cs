import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Configurações Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'papello-dashboard-secret-key-2025'
    DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
    
    # IDs das planilhas Google Sheets - CORRIGIDOS
    CLASSIFICACAO_SHEET_ID = "1ZKgy7jCXUzkU0oaOw5IdnezKuJrCtGOeqiks2el0olE"
    PESQUISA_SHEET_ID = "1Z-Q2l75JMSwvFYI7EY4DqLywbDhCTH_2rlYXD4QdaGw"  # ← CORRIGIDO!
    
    # Cores da marca Papello
    COLORS = {
        'primary': '#96CA00',      # Verde principal Papello
        'secondary': '#84A802',    # Verde escuro Papello  
        'success': '#96CA00',      # Verde Papello para sucesso
        'warning': '#f59e0b',      # Laranja para avisos
        'danger': '#ef4444',       # Vermelho para alertas
        'info': '#3b82f6',         # Azul para informações
        'light_green': '#C5DF56',  # Verde claro Papello
        'premium': '#8b5cf6',      # Roxo para Premium
        'gold': '#f59e0b',         # Dourado para Gold
        'silver': '#6b7280',       # Cinza para Silver
        'bronze': '#dc2626',       # Vermelho para Bronze
        'papello_black': '#000000' # Preto Papello
    }
    
    # Configurações de cache
    CACHE_TIMEOUT = 300  # 5 minutos
    
    # URLs base das planilhas
    SHEETS_BASE_URL = "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:csv"
    
    # Configurações de paginação
    CLIENTS_PER_PAGE = 10
    ACTIONS_PER_PAGE = 20