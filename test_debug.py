#!/usr/bin/env python3
"""
Script de Debug - Dashboard Papello
Use este arquivo para testar e identificar problemas
"""

def test_basic_imports():
    """Testa importações básicas"""
    print("🔧 Testando importações básicas...")
    try:
        import pandas as pd
        print("✅ pandas OK")
        
        import requests
        print("✅ requests OK")
        
        from datetime import datetime
        print("✅ datetime OK")
        
        from config import Config
        print(f"✅ Config OK - Sheet ID: {Config.CLASSIFICACAO_SHEET_ID[:10]}...")
        
        return True
    except Exception as e:
        print(f"❌ Erro nas importações básicas: {str(e)}")
        return False

def test_data_utils_imports():
    """Testa importações do data_utils"""
    print("\n🔧 Testando importações do data_utils...")
    try:
        from data_utils import load_google_sheet_public
        print("✅ load_google_sheet_public OK")
        
        from data_utils import load_satisfaction_data
        print("✅ load_satisfaction_data OK")
        
        from data_utils import calculate_priority_score
        print("✅ calculate_priority_score OK")
        
        from data_utils import format_number
        print("✅ format_number OK")
        
        return True
    except Exception as e:
        print(f"❌ Erro nas importações do data_utils: {str(e)}")
        return False

def test_google_sheets_connection():
    """Testa conexão com Google Sheets"""
    print("\n🔧 Testando conexão com Google Sheets...")
    try:
        from data_utils import load_google_sheet_public
        from config import Config
        
        print("📊 Carregando planilha de clientes...")
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        
        if df_clientes.empty:
            print("⚠️  Planilha de clientes vazia")
            return False
            
        print(f"✅ Clientes carregados: {len(df_clientes)} registros")
        print(f"✅ Colunas: {list(df_clientes.columns)[:5]}...")  # Primeiras 5 colunas
        
        return True
    except Exception as e:
        print(f"❌ Erro na conexão: {str(e)}")
        return False

def test_executive_summary_function():
    """Testa a função get_executive_summary_data"""
    print("\n🔧 Testando função get_executive_summary_data...")
    try:
        from data_utils import get_executive_summary_data
        print("✅ Função importada com sucesso")
        
        print("📊 Executando get_executive_summary_data...")
        data = get_executive_summary_data()
        
        if 'error' in data:
            print(f"❌ Erro na função: {data['error']}")
            return False
            
        if 'kpis' in data:
            print("✅ KPIs encontrados:")
            kpis = data['kpis']
            print(f"   - Total Clientes: {kpis.get('total_clientes', 'N/A')}")
            print(f"   - Clientes Ativos: {kpis.get('clientes_ativos', 'N/A')}")
            print(f"   - Taxa Retenção: {kpis.get('taxa_retencao', 'N/A')}%")
            print(f"   - Receita Total: R$ {kpis.get('receita_total', 'N/A')}")
            return True
        else:
            print("❌ KPIs não encontrados no retorno")
            print(f"Retorno recebido: {list(data.keys())}")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao testar função: {str(e)}")
        print(f"Tipo do erro: {type(e).__name__}")
        return False

def test_api_endpoint():
    """Testa o endpoint da API"""
    print("\n🔧 Testando endpoint /api/executive-data...")
    try:
        import requests
        
        # Testar se o servidor está rodando
        response = requests.get("http://localhost:5000/api/executive-data", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API respondeu com sucesso")
            if 'kpis' in data:
                print("✅ Dados KPIs encontrados na API")
                return True
            else:
                print("❌ Dados KPIs não encontrados na resposta da API")
                print(f"Chaves encontradas: {list(data.keys())}")
                return False
        else:
            print(f"❌ API retornou erro: {response.status_code}")
            print(f"Resposta: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Servidor não está rodando. Execute 'python app.py' primeiro")
        return False
    except Exception as e:
        print(f"❌ Erro ao testar API: {str(e)}")
        return False

def main():
    """Executa todos os testes"""
    print("🎯 DASHBOARD PAPELLO - DEBUG E TESTES")
    print("=" * 50)
    
    tests = [
        ("Importações Básicas", test_basic_imports),
        ("Importações Data Utils", test_data_utils_imports),
        ("Conexão Google Sheets", test_google_sheets_connection),
        ("Função Executive Summary", test_executive_summary_function),
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
    
    print("\n" + "=" * 50)
    print("📋 RESUMO DOS TESTES:")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSOU" if passed else "❌ FALHOU"
        print(f"{test_name:.<30} {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 TODOS OS TESTES PASSARAM!")
        print("Agora teste o endpoint da API:")
        print("1. Execute: python app.py")
        print("2. Execute: python test_debug.py --api")
    else:
        print("❌ ALGUNS TESTES FALHARAM")
        print("Corrija os problemas acima antes de continuar")
    
    print("=" * 50)

if __name__ == "__main__":
    import sys
    if "--api" in sys.argv:
        test_api_endpoint()
    else:
        main()