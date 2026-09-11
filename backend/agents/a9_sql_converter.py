"""
A9 — SQL Converter + Workflow Flowchart Agent (LLM)
=====================================================
NATURE: LLM with structured output
ROLE: Converts natural language questions into SQL queries and
      generates Mermaid.js flowcharts of the query execution plan.
      Enables non-technical users to query their data visually.
"""
import logging
import sqlite3
import tempfile
import os

import pandas as pd

from core.ledger import Ledger, SQLConversionResult
from core.llm_client import call_llm, extract_json_from_response
from prompts.templates import get_prompt
from observability.telemetry import timed_agent

logger = logging.getLogger(__name__)


def _execute_sql_on_df(df: pd.DataFrame, sql: str) -> dict:
    """
    Execute a SQL query against the DataFrame using SQLite in-memory.
    Returns result as a dict for JSON serialization.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "temp.db")
        conn = sqlite3.connect(db_path)
        try:
            df.to_sql("data_table", conn, if_exists="replace", index=False)
            result_df = pd.read_sql_query(sql, conn)
            return {
                "columns": result_df.columns.tolist(),
                "rows": result_df.head(100).values.tolist(),   # Limit to 100 rows
                "total_rows": len(result_df),
            }
        except Exception as e:
            return {"error": str(e)}
        finally:
            conn.close()


def run(ledger: Ledger, natural_language_query: str) -> Ledger:
    """
    A9: Convert a natural language question to SQL + Mermaid flowchart.
    
    Args:
        ledger: Current session ledger with dataset loaded.
        natural_language_query: User's question in plain English.
    
    Returns:
        Updated ledger with sql_result populated.
    """
    with timed_agent(ledger.session_id, "A9_SQL_CONVERTER") as ctx:
        df = getattr(ledger, "_cleaned_df", None)
        if df is None:
            raise ValueError("[A9] No DataFrame loaded. Run A0 first.")

        # Build column info string for the LLM
        col_lines = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            sample = df[col].dropna().head(3).tolist()
            col_lines.append(f"  - {col} ({dtype}): sample = {sample}")
        columns_info = "\n".join(col_lines)

        system_prompt = get_prompt("A9_SYSTEM")
        user_prompt = get_prompt("A9_USER").format(
            columns_info=columns_info,
            natural_language_query=natural_language_query,
        )

        response_text, tokens = call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2,
            json_mode=True,
            task="code",   # pandas/SQL generation gets the code-tuned model
        )
        ledger.total_tokens_used += tokens
        ledger.llm_call_count += 1

        data = extract_json_from_response(response_text)
        sql_query = data.get("sql_query", "")
        explanation = data.get("explanation", "")
        flowchart = data.get("flowchart_mermaid", "")

        # Execute the generated SQL and get result
        query_result = _execute_sql_on_df(df, sql_query) if sql_query else {}

        ledger.sql_result = SQLConversionResult(
            natural_language_query=natural_language_query,
            sql_query=sql_query,
            explanation=explanation,
            flowchart_mermaid=flowchart,
            estimated_rows=query_result.get("total_rows"),
        )
        # Attach raw result for API response
        ledger._sql_query_result = query_result

        ctx["output"] = f"SQL: {sql_query[:100]}... ({tokens} tokens)"
        ctx["tokens"] = tokens
        logger.info(f"[A9] SQL generated and executed. Rows: {query_result.get('total_rows', 'N/A')}")

    return ledger
