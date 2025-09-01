#!/usr/bin/env python3
"""
Teste Específico - Verificar Dados Refinados
"""

def test_new_sheet_ids():
    """Testa os novos IDs das planilhas"""
    print("🔧 Testando novos IDs das planilhas...")
    
    try:
        from data_utils import load_google_sheet_public, load_satisfaction_data
        from config import Config
        
        print(f"📋 ID Classificação: {Config.CLASSIFICACAO_SHEET_ID}")
        print(f"📋 ID Pesquisa: {Config.PESQUISA_SHEET_ID}")
        
        # Testar planilha de clientes
        print("📊 Carregando clientes...")
        df_clientes = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        
        if df_clientes.empty:
            print("❌ Planilha de clientes vazia ou inacessível")
            return False
        
        print(f"✅ Clientes: {len(df_clientes)} registros")
        print(f"📋 Colunas clientes: {list(df_clientes.columns)[:10]}...")
        
        # Testar planilha de pedidos
        print("📊 Carregando pedidos...")
        df_pedidos = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "pedidos_com_id2")
        
        if not df_pedidos.empty:
            print(f"✅ Pedidos: {len(df_pedidos)} registros")
        else:
            print("⚠️  Planilha de pedidos vazia")
        
        # Testar planilha de satisfação com nova aba
        print("📊 Carregando satisfação...")
        df_satisfacao = load_satisfaction_data()
        
        if not df_satisfacao.empty:
            print(f"✅ Satisfação: {len(df_satisfacao)} respostas")
            print(f"📋 Colunas satisfação: {list(df_satisfacao.columns)[:5]}...")
        else:
            print("⚠️  Planilha de satisfação vazia ou aba incorreta")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao testar planilhas: {str(e)}")
        return False

def test_executive_summary():
    """Testa a função refinada de summary"""
    print("\n🔧 Testando função executive summary refinada...")
    
    try:
        from data_utils import get_executive_summary_data
        
        print("📊 Executando get_executive_summary_data refinada...")
        data = get_executive_summary_data()
        
        if 'error' in data:
            print(f"❌ Erro na função: {data['error']}")
            return False
        
        print("✅ Dados carregados com sucesso!")
        
        # Verificar KPIs
        if 'kpis' in data:
            kpis = data['kpis']
            print(f"\n📊 KPIs REFINADOS:")
            print(f"   - Total Clientes: {kpis.get('total_clientes', 'N/A'):,}")
            print(f"   - Clientes Ativos: {kpis.get('clientes_ativos', 'N/A'):,}")
            print(f"   - Taxa Retenção: {kpis.get('taxa_retencao', 'N/A'):.2f}%")
            print(f"   - Clientes Críticos: {kpis.get('clientes_criticos', 'N/A'):,}")
            print(f"   - Taxa Críticos: {kpis.get('taxa_criticos', 'N/A'):.2f}%")
            print(f"   - Receita Total: R$ {kpis.get('receita_total', 0):,.2f}")
        
        # Verificar satisfação
        if 'satisfaction' in data and data['satisfaction']:
            print(f"\n⭐ SATISFAÇÃO:")
            for key, value in data['satisfaction'].items():
                print(f"   - {key.title()}: {value.get('value', 'N/A')} ({value.get('trend', 'N/A')})")
        
        # Verificar distribuições
        if 'distributions' in data and data['distributions']:
            print(f"\n📊 DISTRIBUIÇÕES:")
            for key, dist in data['distributions'].items():
                if dist:
                    print(f"   - {key.title()}: {len(dist)} categorias")
                    for cat, count in list(dist.items())[:3]:  # Primeiros 3
                        print(f"     • {cat}: {count}")
        
        # Info de debug
        if 'debug_info' in data:
            debug = data['debug_info']
            print(f"\n🔍 DEBUG INFO:")
            print(f"   - Clientes carregados: {debug.get('total_clients_loaded', 'N/A')}")
            print(f"   - Respostas satisfação: {debug.get('satisfaction_responses', 'N/A')}")
            print(f"   - Colunas clientes: {debug.get('columns_clients', [])}")
            print(f"   - Colunas satisfação: {debug.get('columns_satisfaction', [])}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao testar executive summary: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_api_formatting():
    """Testa a formatação da API"""
    print("\n🔧 Testando formatação da API...")
    
    try:
        import requests
        
        # Testar API
        response = requests.get("http://localhost:5000/api/executive-data", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API respondeu com sucesso")
            
            if 'kpis' in data:
                print(f"📊 KPIs formatados:")
                kpis = data['kpis']
                for key, kpi in kpis.items():
                    print(f"   - {key}: {kpi.get('value', 'N/A')} ({kpi.get('subtitle', '')})")
            
            return True
        else:
            print(f"❌ API retornou erro: {response.status_code}")
            print(f"Resposta: {response.text[:200]}...")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Flask não está rodando. Execute 'python app.py' primeiro")
        return False
    except Exception as e:
        print(f"❌ Erro ao testar API: {str(e)}")
        return False

def main():
    """Executa todos os testes refinados"""
    print("🎯 TESTE REFINADO - DADOS PAPELLO")
    print("=" * 50)
    
    # Teste 1: IDs das planilhas
    sheets_ok = test_new_sheet_ids()
    
    # Teste 2: Função refinada
    function_ok = test_executive_summary()
    
    # Teste 3: API (opcional, se Flask estiver rodando)
    api_ok = test_api_formatting()
    
    print("\n" + "=" * 50)
    print("📋 RESUMO DOS TESTES REFINADOS:")
    print("=" * 50)
    
    print(f"Planilhas.......... {'✅ OK' if sheets_ok else '❌ FALHOU'}")
    print(f"Função Summary..... {'✅ OK' if function_ok else '❌ FALHOU'}")
    print(f"API Formatting..... {'✅ OK' if api_ok else '⚠️ FLASK OFF'}")
    
    if sheets_ok and function_ok:
        print(f"\n🎉 DADOS REFINADOS FUNCIONANDO!")
        print("Execute 'python app.py' e teste no navegador")
    else:
        print(f"\n❌ CORRIJA OS PROBLEMAS ACIMA")
    
    print("=" * 50)

if __name__ == "__main__":
    main()