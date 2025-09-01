#!/usr/bin/env python3
"""
Script de Correção Simples - Sem emojis para Windows
"""

import os
import sys
import subprocess
from pathlib import Path

def check_python():
    """Verifica versão Python"""
    if sys.version_info < (3, 8):
        print("ERRO: Python 3.8+ necessario")
        sys.exit(1)
    print(f"OK: Python {sys.version_info.major}.{sys.version_info.minor}")

def create_folders():
    """Cria pastas necessárias"""
    print("\nCriando estrutura de pastas...")
    
    folders = [
        "static/js",
        "static/img", 
        "static/css",
        "templates",
        "logs"
    ]
    
    for folder in folders:
        Path(folder).mkdir(parents=True, exist_ok=True)
        print(f"OK: {folder}/")

def create_env():
    """Cria arquivo .env"""
    print("\nCriando arquivo .env...")
    
    if os.path.exists(".env"):
        print("OK: .env ja existe")
        return
    
    env_content = '''# Configuracoes Flask
DEBUG=True
SECRET_KEY=papello-dashboard-secret-key-2025

# IDs das planilhas Google Sheets
CLASSIFICACAO_SHEET_ID=1ZKgy7jCXUzkU0oaOw5IdnezKuJrCtGOeqiks2el0olE
PESQUISA_SHEET_ID=1ZKgy7jCXUzkU0oaOw5IdnezKuJrCtGOeqiks2el0olE

# Configuracoes de cache
CACHE_TIMEOUT=300
'''
    
    with open(".env", "w", encoding="utf-8") as f:
        f.write(env_content)
    print("OK: .env criado")

def fix_requirements():
    """Corrige requirements.txt"""
    print("\nCorrigindo requirements.txt...")
    
    requirements = '''Flask==3.0.0
pandas==2.1.4
requests==2.31.0
python-dotenv==1.0.0
gunicorn==21.2.0
numpy>=1.25.0
openpyxl==3.1.2
Werkzeug==3.0.0
'''
    
    with open("requirements.txt", "w", encoding="utf-8") as f:
        f.write(requirements)
    print("OK: requirements.txt corrigido")

def install_deps():
    """Instala dependências"""
    print("\nInstalando dependencias...")
    
    try:
        # Remover numpy antigo
        subprocess.run([sys.executable, "-m", "pip", "uninstall", "numpy", "-y"], 
                      capture_output=True)
        
        # Instalar corretos
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("OK: Dependencias instaladas")
        return True
        
    except Exception as e:
        print(f"ERRO: {e}")
        return False

def test_imports():
    """Testa importações"""
    print("\nTestando importacoes...")
    
    try:
        import flask
        print("OK: Flask")
        
        import pandas
        print("OK: Pandas")
        
        import numpy
        print(f"OK: Numpy {numpy.__version__}")
        
        from dotenv import load_dotenv
        print("OK: Dotenv")
        
        return True
        
    except ImportError as e:
        print(f"ERRO: {e}")
        return False

def check_files():
    """Verifica arquivos necessários"""
    print("\nVerificando arquivos...")
    
    critical = []
    optional = []
    
    # Arquivos críticos
    critical_files = ["app.py", "config.py", "data_utils.py"]
    for file in critical_files:
        if os.path.exists(file):
            print(f"OK: {file}")
        else:
            print(f"FALTA: {file}")
            critical.append(file)
    
    # Arquivos opcionais
    optional_files = [
        "static/js/dashboard.js",
        "static/js/charts.js",
        "templates/clients.html",
        "templates/analytics.html", 
        "templates/actions.html"
    ]
    
    for file in optional_files:
        if os.path.exists(file):
            print(f"OK: {file}")
        else:
            print(f"FALTA: {file}")
            optional.append(file)
    
    return critical, optional

def create_start_script():
    """Cria script de inicialização"""
    print("\nCriando start.py...")
    
    content = '''#!/usr/bin/env python3
"""
Script de Inicializacao - Dashboard Papello
"""
import os
import sys

def main():
    print("Iniciando Dashboard Papello...")
    
    if not os.path.exists("app.py"):
        print("ERRO: app.py nao encontrado!")
        sys.exit(1)
    
    try:
        from app import app
        print("App carregado com sucesso")
        print("Acessivel em: http://localhost:5000")
        print("Para parar: Ctrl+C")
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Erro ao iniciar: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
    
    with open("start.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: start.py criado")

def show_summary(critical, optional, imports_ok):
    """Mostra resumo final"""
    print("\n" + "=" * 50)
    print("RESUMO DA CORRECAO")
    print("=" * 50)
    
    if critical:
        print("\nARQUIVOS CRITICOS FALTANDO:")
        for file in critical:
            print(f"  - {file}")
        print("\nO projeto NAO vai funcionar sem estes arquivos!")
        
    if optional:
        print("\nARQUIVOS OPCIONAIS FALTANDO:")
        for file in optional:
            print(f"  - {file}")
        print("\nPrecisa criar estes templates/scripts JS")
    
    print("\nPARA EXECUTAR:")
    if not critical and imports_ok:
        print("  python start.py")
        print("  # OU")
        print("  python app.py")
        print("\nTUDO OK! Projeto pronto!")
    else:
        print("  1. Crie os arquivos faltantes primeiro")
        print("  2. Depois execute: python start.py")
        
    print("\nURLS:")
    print("  http://localhost:5000/ -> Dashboard")
    print("  http://localhost:5000/clients -> Clientes")
    print("  http://localhost:5000/analytics -> Analytics")

def main():
    """Função principal"""
    print("CORRECAO AUTOMATICA - PAPELLO DASHBOARD")
    print("=" * 50)
    
    # Executar correções
    check_python()
    create_folders()
    create_env()
    fix_requirements()
    
    deps_ok = install_deps()
    imports_ok = test_imports() if deps_ok else False
    critical, optional = check_files()
    create_start_script()
    
    # Resumo
    show_summary(critical, optional, imports_ok)

if __name__ == "__main__":
    main()