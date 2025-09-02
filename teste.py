import pandas as pd
from datetime import datetime, timedelta

# --- Configuração ---
# Substitua pelos seus dados reais, se forem diferentes
SHEET_ID = '1ZKgy7jCXUzkU0oaOw5IdnezKuJrCtGOeqiks2el0olE'
TAB_NAME = 'pedidos_com_id2'

def run_test():
    """Executa um teste de carregamento e filtragem dos dados da planilha."""
    print("--- INICIANDO TESTE DE DEPURACAO ---")
    
    try:
        # 1. Carregar os dados
        url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={TAB_NAME}"
        print(f"1. A carregar dados de: {url[:80]}...")
        df = pd.read_csv(url)
        print(f"   -> Sucesso! {len(df)} linhas carregadas.")
        
        # 2. Inspecionar os dados brutos
        print("\n2. Amostra dos dados brutos (primeiras 3 linhas):")
        print(df.head(3))
        print("\n   Tipos de dados originais:")
        df.info(verbose=False, memory_usage=False) # Mostra os tipos de cada coluna
        
        # 3. Converter a coluna de data
        date_column = 'data_pedido_realizado'
        if date_column not in df.columns:
            print(f"\nERRO CRITICO: A coluna '{date_column}' nao foi encontrada!")
            return
            
        print(f"\n3. A converter a coluna '{date_column}'...")
        # Força a conversão, tratando o formato DD/MM/AAAA como prioridade
        df['data_convertida'] = pd.to_datetime(df[date_column], dayfirst=True, errors='coerce')
        
        # Verificar se a conversão funcionou
        successful_conversions = df['data_convertida'].notna().sum()
        total_rows = len(df)
        print(f"   -> {successful_conversions} de {total_rows} datas foram convertidas com sucesso.")
        
        if successful_conversions == 0:
            print("   -> AVISO: Nenhuma data pode ser convertida. Verifique o formato na planilha.")
            return

        print("\n   Amostra das datas convertidas:")
        print(df[['data_pedido_realizado', 'data_convertida']].head(3))

        # 4. Aplicar filtro de datas
        print("\n4. A aplicar filtro de datas (ultimos 365 dias)...")
        data_fim = datetime.now()
        data_inicio = data_fim - timedelta(days=365)
        
        # Filtra o DataFrame
        df_filtrado = df[
            (df['data_convertida'] >= data_inicio) & 
            (df['data_convertida'] <= data_fim)
        ]
        print(f"   -> {len(df_filtrado)} linhas restaram apos o filtro de data.")

        if len(df_filtrado) == 0:
            print("   -> AVISO: Nenhum dado encontrado no periodo. Tente aumentar o numero de dias no script.")
            return
            
        # 5. Aplicar filtro de status
        print("\n5. A aplicar filtro de status ('Primeiro' e 'Recompra')...")
        df_filtrado['status_clean'] = df_filtrado['status_pedido'].astype(str).str.strip().str.lower()
        
        primeiro = df_filtrado[df_filtrado['status_clean'] == 'primeiro'].shape[0]
        recompra = df_filtrado[df_filtrado['status_clean'] == 'recompra'].shape[0]
        
        print(f"   -> Pedidos 'Primeiro': {primeiro}")
        print(f"   -> Pedidos 'Recompra': {recompra}")
        
        print("\n--- TESTE CONCLUIDO ---")

    except Exception as e:
        print(f"\n--- OCORREU UM ERRO DURANTE O TESTE ---")
        print(str(e))

# Executar o teste
if __name__ == "__main__":
    run_test()