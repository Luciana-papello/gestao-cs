#!/usr/bin/env python3
"""
Script de inicialização do Dashboard Papello
Facilita a execução e setup inicial
"""

import os
import sys
import subprocess
from pathlib import Path

def check_python_version():
    """Verifica versão do Python"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ é necessário")
        print(f"   Versão atual: {sys.version}")
        sys.exit(1)
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} - OK")

def check_dependencies():
    """Verifica se dependências estão instaladas"""
    try:
        import flask
        import pandas
        import requests
        print("✅ Dependências principais encontradas")
        return True
    except ImportError as e:
        print(f"❌ Dependências em falta: {e}")
        return False

def install_dependencies():
    """Instala dependências automaticamente"""
    print("📦 Instalando dependências...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependências instaladas")
        return True
    except subprocess.CalledProcessError:
        print("❌ Erro ao instalar dependências")
        return False

def check_file_structure():
    """Verifica se todos os arquivos necessários existem"""
    required_files = [
        "app.py",
        "config.py", 
        "data_utils.py",
        "requirements.txt",
        ".env",
        "templates/base.html",
        "templates/executive.html",
        "static/css/papello.css",
        "static/js/dashboard.js",
        "static/js/charts.js"
    ]
    
    missing_files = []
    for file in required_files:
        if not Path(file).exists():
            missing_files.append(file)
    
    if missing_files:
        print("❌ Arquivos em falta:")
        for file in missing_files:
            print(f"   - {file}")
        return False
    
    print("✅ Estrutura de arquivos completa")
    return True

def test_google_sheets_connection():
    """Testa conexão com Google Sheets"""
    try:
        from data_utils import load_google_sheet_public
        from config import Config
        
        print("🔗 Testando conexão com Google Sheets...")
        
        # Testar carregamento de uma planilha
        df = load_google_sheet_public(Config.CLASSIFICACAO_SHEET_ID, "classificacao_clientes3")
        
        if df.empty:
            print("⚠️  Planilha vazia ou inacessível")
            return False
        
        print(f"✅ Conexão OK - {len(df)} registros carregados")
        return True
        
    except Exception as e:
        print(f"❌ Erro na conexão: {str(e)}")
        print("   Verifique se as planilhas estão públicas")
        return False

def print_startup_info():
    """Mostra informações de inicialização"""
    print("\n" + "🎯" * 30)
    print("     DASHBOARD PAPELLO - CUSTOMER SUCCESS")
    print("🎯" * 30)
    print()
    print("🌐 Acesso local:  http://localhost:5000")
    print("🌐 Acesso rede:   http://0.0.0.0:5000")
    print()
    print("📊 Funcionalidades disponíveis:")
    print("   • Visão Executiva (KPIs e métricas)")
    print("   • Análise de Recorrência")
    print("   • Métricas de Satisfação/NPS")
    print("   • Distribuições visuais")
    print("   • Análises críticas")
    print()
    print("⚙️  Para parar: Ctrl+C")
    print()

def run_flask_app():
    """Executa o aplicativo Flask"""
    try:
        from app import app
        print("🚀 Iniciando servidor Flask...")
        app.run(debug=True, host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        print("\n👋 Dashboard finalizado pelo usuário")
    except Exception as e:
        print(f"❌ Erro ao iniciar Flask: {str(e)}")

def main():
    """Função principal"""
    print("🔧 Iniciando setup do Dashboard Papello...\n")
    
    # Verificações iniciais
    check_python_version()
    
    if not check_file_structure():
        print("\n❌ Estrutura de arquivos incompleta")
        print("   Certifique-se de ter criado todos os arquivos necessários")
        sys.exit(1)
    
    # Verificar/instalar dependências
    if not check_dependencies():
        response = input("\n📦 Instalar dependências automaticamente? (s/n): ")
        if response.lower() in ['s', 'sim', 'y', 'yes']:
            if not install_dependencies():
                sys.exit(1)
        else:
            print("Execute: pip install -r requirements.txt")
            sys.exit(1)
    
    # Testar conexão com dados
    if not test_google_sheets_connection():
        print("\n⚠️  Problema na conexão com Google Sheets")
        response = input("Continuar mesmo assim? (s/n): ")
        if response.lower() not in ['s', 'sim', 'y', 'yes']:
            sys.exit(1)
    
    print("\n✅ Todas as verificações passaram!")
    
    # Mostrar informações e executar
    print_startup_info()
    run_flask_app()

if __name__ == "__main__":
    main()