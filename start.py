#!/usr/bin/env python3
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
