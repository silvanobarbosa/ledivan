#!/usr/bin/env python3
"""
Script para análise profunda do arquivo Excel Financeiro 040826.xlsx
Lê todas as abas, identifica estruturas e valida dados antes da importação
"""

import pandas as pd
import numpy as np
from datetime import datetime
import json
import sys
import os

# Caminho do arquivo
EXCEL_FILE = "Gi/Financeiro 040826.xlsx"

def analyze_excel():
    """Análise completa do arquivo Excel"""

    print("=" * 80)
    print("ANÁLISE PROFUNDA DO ARQUIVO EXCEL")
    print("=" * 80)
    print(f"\n📁 Arquivo: {EXCEL_FILE}")
    print(f"📅 Data da análise: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    try:
        # Ler todas as abas do arquivo
        xl_file = pd.ExcelFile(EXCEL_FILE)

        print(f"📊 Total de abas encontradas: {len(xl_file.sheet_names)}")
        print("-" * 80)

        # Dicionário para armazenar análise
        analysis = {
            "file": EXCEL_FILE,
            "total_sheets": len(xl_file.sheet_names),
            "sheets": {}
        }

        # Analisar cada aba
        for i, sheet_name in enumerate(xl_file.sheet_names, 1):
            print(f"\n[Aba {i}/{len(xl_file.sheet_names)}] '{sheet_name}'")
            print("-" * 40)

            try:
                # Ler a aba
                df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name)

                # Informações básicas
                print(f"  Dimensões: {df.shape[0]} linhas x {df.shape[1]} colunas")

                # Se a aba estiver vazia, pular
                if df.empty:
                    print("  ⚠️  Aba vazia")
                    analysis["sheets"][sheet_name] = {"status": "empty"}
                    continue

                # Analisar colunas
                print(f"\n  📋 Colunas encontradas:")
                for col in df.columns:
                    non_null = df[col].notna().sum()
                    unique_vals = df[col].nunique()
                    dtype = str(df[col].dtype)

                    print(f"    • {col}:")
                    print(f"      - Tipo: {dtype}")
                    print(f"      - Valores preenchidos: {non_null}/{len(df)}")
                    print(f"      - Valores únicos: {unique_vals}")

                    # Mostrar exemplos de valores
                    sample_values = df[col].dropna().unique()[:5]
                    if len(sample_values) > 0:
                        print(f"      - Exemplos: {list(sample_values)}")

                # Tentar identificar o tipo de dados na aba
                sheet_type = identify_sheet_type(df, sheet_name)
                print(f"\n  🔍 Tipo identificado: {sheet_type}")

                # Análise específica por tipo
                if sheet_type == "PACIENTE":
                    analyze_patient_sheet(df, sheet_name)
                elif sheet_type == "AGENDA":
                    analyze_agenda_sheet(df, sheet_name)
                elif sheet_type == "FINANCEIRO":
                    analyze_financial_sheet(df, sheet_name)
                elif sheet_type == "RESUMO":
                    analyze_summary_sheet(df, sheet_name)

                # Armazenar análise
                analysis["sheets"][sheet_name] = {
                    "type": sheet_type,
                    "rows": df.shape[0],
                    "columns": df.shape[1],
                    "column_names": list(df.columns),
                    "sample_data": df.head(3).to_dict('records')
                }

            except Exception as e:
                print(f"  ❌ Erro ao processar aba: {e}")
                analysis["sheets"][sheet_name] = {"status": "error", "error": str(e)}

        # Salvar análise em JSON
        output_file = "scripts/excel-analysis.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, default=str, ensure_ascii=False)

        print("\n" + "=" * 80)
        print(f"✅ Análise completa salva em: {output_file}")

        # Resumo final
        print("\n📊 RESUMO DA ANÁLISE:")
        print("-" * 40)

        patient_sheets = [s for s, d in analysis["sheets"].items() if d.get("type") == "PACIENTE"]
        agenda_sheets = [s for s, d in analysis["sheets"].items() if d.get("type") == "AGENDA"]
        financial_sheets = [s for s, d in analysis["sheets"].items() if d.get("type") == "FINANCEIRO"]

        print(f"  • Abas de pacientes: {len(patient_sheets)}")
        if patient_sheets:
            print(f"    - {', '.join(patient_sheets[:10])}")
            if len(patient_sheets) > 10:
                print(f"    - ... e mais {len(patient_sheets) - 10}")

        print(f"  • Abas de agenda: {len(agenda_sheets)}")
        if agenda_sheets:
            print(f"    - {', '.join(agenda_sheets[:5])}")

        print(f"  • Abas financeiras: {len(financial_sheets)}")
        if financial_sheets:
            print(f"    - {', '.join(financial_sheets[:5])}")

        return analysis

    except Exception as e:
        print(f"\n❌ Erro ao ler arquivo: {e}")
        sys.exit(1)


def identify_sheet_type(df, sheet_name):
    """Identifica o tipo de dados na aba baseado em padrões"""

    # Converter nome da aba para lowercase para comparação
    name_lower = sheet_name.lower()
    columns_lower = [str(c).lower() for c in df.columns]

    # Padrões para identificar tipo
    patient_patterns = ["consulta", "sessão", "sessao", "atendimento", "horário", "horario"]
    agenda_patterns = ["agenda", "segunda", "terça", "quarta", "quinta", "sexta", "seg", "ter", "qua", "qui", "sex"]
    financial_patterns = ["valor", "pagamento", "receita", "despesa", "total", "r$", "reais"]
    summary_patterns = ["resumo", "total", "geral", "consolidado", "relatório", "relatorio"]

    # Verificar por nome da aba
    if any(p in name_lower for p in summary_patterns):
        return "RESUMO"

    if "agenda" in name_lower:
        return "AGENDA"

    # Verificar por colunas
    columns_text = " ".join(columns_lower)

    if any(p in columns_text for p in agenda_patterns):
        return "AGENDA"

    if any(p in columns_text for p in patient_patterns):
        return "PACIENTE"

    if any(p in columns_text for p in financial_patterns):
        return "FINANCEIRO"

    # Se o nome da aba parece ser um nome de pessoa, é provável que seja paciente
    if len(sheet_name.split()) <= 3 and not sheet_name.startswith("Sheet"):
        return "PACIENTE"

    return "DESCONHECIDO"


def analyze_patient_sheet(df, sheet_name):
    """Análise específica para aba de paciente"""
    print("\n  📋 ANÁLISE DE PACIENTE:")

    # Tentar identificar padrões de consultas
    date_columns = []
    for col in df.columns:
        if df[col].dtype == 'datetime64[ns]' or 'data' in str(col).lower():
            date_columns.append(col)

    if date_columns:
        print(f"    - Colunas de data encontradas: {date_columns}")

    # Identificar valores monetários
    money_columns = []
    for col in df.columns:
        if any(keyword in str(col).lower() for keyword in ['valor', 'pagamento', 'r$', 'reais']):
            money_columns.append(col)

    if money_columns:
        print(f"    - Colunas de valores: {money_columns}")

    # Contar registros válidos
    valid_rows = df.dropna(how='all').shape[0]
    print(f"    - Registros válidos: {valid_rows}")

    # Tentar extrair nome do paciente
    print(f"    - Nome do paciente (provável): {sheet_name}")


def analyze_agenda_sheet(df, sheet_name):
    """Análise específica para aba de agenda"""
    print("\n  📅 ANÁLISE DE AGENDA:")

    # Identificar dias da semana
    weekdays = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
    found_days = []

    for col in df.columns:
        for day in weekdays:
            if day in str(col).lower():
                found_days.append(col)
                break

    if found_days:
        print(f"    - Dias da semana encontrados: {found_days}")

    # Identificar horários
    time_pattern_count = 0
    for col in df.columns:
        sample = df[col].dropna().astype(str).head(10)
        for val in sample:
            if ':' in val and any(c.isdigit() for c in val):
                time_pattern_count += 1
                break

    print(f"    - Colunas com padrão de horário: {time_pattern_count}")


def analyze_financial_sheet(df, sheet_name):
    """Análise específica para aba financeira"""
    print("\n  💰 ANÁLISE FINANCEIRA:")

    # Procurar colunas de valores
    value_columns = []
    for col in df.columns:
        try:
            # Tentar converter para numérico
            numeric_vals = pd.to_numeric(df[col].dropna(), errors='coerce')
            if numeric_vals.notna().sum() > 0:
                value_columns.append({
                    'column': col,
                    'sum': numeric_vals.sum(),
                    'mean': numeric_vals.mean(),
                    'count': numeric_vals.notna().sum()
                })
        except:
            pass

    if value_columns:
        print("    - Colunas numéricas encontradas:")
        for vc in value_columns:
            print(f"      • {vc['column']}: soma={vc['sum']:.2f}, média={vc['mean']:.2f}, qtd={vc['count']}")


def analyze_summary_sheet(df, sheet_name):
    """Análise específica para aba de resumo"""
    print("\n  📊 ANÁLISE DE RESUMO:")

    # Contar totais
    total_values = 0
    for col in df.columns:
        for val in df[col].dropna().astype(str):
            if 'total' in val.lower():
                total_values += 1

    print(f"    - Referências a 'total': {total_values}")

    # Verificar se há consolidação de dados
    numeric_columns = df.select_dtypes(include=[np.number]).columns
    print(f"    - Colunas numéricas: {len(numeric_columns)}")


if __name__ == "__main__":
    # Mudar para o diretório do projeto
    os.chdir("/c/Users/User/Ledivan Plus")

    # Executar análise
    analyze_excel()