"""Compara conexoes PostgreSQL descartaveis com uma pool persistente.

O benchmark e somente leitura: ele consulta as tabelas existentes e usa
``generate_series`` para simular respostas com diferentes quantidades de linhas.
"""

from __future__ import annotations

import argparse
import os
import statistics
import time
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import psycopg
from psycopg import sql
from psycopg_pool import ConnectionPool


ACCESS_TIMEZONE = os.getenv("ACCESS_TIMEZONE", "America/Sao_Paulo")
TABLES = (
    "administrador",
    "usuario",
    "local",
    "dispositivo",
    "permissao",
    "tentativa_acesso",
    "historico_acesso",
    "audit_logs",
)

SYNTHETIC_QUERY = """
    SELECT
        i AS id,
        (i %% 100) + 1 AS usuario_id,
        (i %% 10) + 1 AS local_id,
        (i %% 5) + 1 AS dispositivo_id,
        'UID-' || LPAD(i::text, 8, '0') AS uid_card_lido,
        CURRENT_TIMESTAMP - (i * INTERVAL '1 second') AS data_hora,
        (i %% 2) = 0 AS autorizado,
        (i %% 100)::double precision AS percentual_similaridade,
        CASE WHEN (i %% 2) = 0 THEN NULL ELSE 'Acesso negado' END AS motivo_recusa
    FROM generate_series(1, %s) AS serie(i)
    ORDER BY i DESC
"""

HISTORY_QUERY = """
    SELECT
        h.id,
        h.usuario_id,
        h.local_id,
        h.dispositivo_id,
        h.uid_card_lido,
        h.data_hora,
        h.autorizado,
        h.percentual_similaridade,
        h.motivo_recusa,
        u.nome AS nome_usuario,
        l.nome AS nome_local
    FROM historico_acesso AS h
    LEFT JOIN usuario AS u ON u.user_id = h.usuario_id
    LEFT JOIN local AS l ON l.local_id = h.local_id
    ORDER BY h.data_hora DESC, h.id DESC
    LIMIT %s
"""


@dataclass(frozen=True)
class Measurement:
    mode: str
    scenario: str
    rows_requested: int
    rows_returned: int
    operations: int
    concurrency: int
    durations_ms: tuple[float, ...]
    wall_seconds: float

    @property
    def mean_ms(self) -> float:
        return statistics.fmean(self.durations_ms)

    @property
    def median_ms(self) -> float:
        return statistics.median(self.durations_ms)

    @property
    def p95_ms(self) -> float:
        ordered = sorted(self.durations_ms)
        index = max(0, min(len(ordered) - 1, round(0.95 * len(ordered) + 0.5) - 1))
        return ordered[index]

    @property
    def throughput(self) -> float:
        return self.operations / self.wall_seconds


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Mede o custo de abrir conexoes por chamada versus reutilizar uma pool."
    )
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--rows", nargs="+", type=int, default=[1, 100, 1_000, 10_000])
    parser.add_argument("--operations", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--warmup", type=int, default=3)
    parser.add_argument("--pool-min", type=int, default=2)
    parser.add_argument("--pool-max", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    if not args.database_url:
        parser.error("informe --database-url ou configure DATABASE_URL")
    if any(value < 1 for value in args.rows):
        parser.error("todos os valores de --rows devem ser maiores que zero")
    if args.operations < 1 or args.concurrency < 1 or args.warmup < 0:
        parser.error("operations/concurrency devem ser positivos e warmup nao pode ser negativo")
    if args.pool_min < 0 or args.pool_max < 1 or args.pool_min > args.pool_max:
        parser.error("use 0 <= pool-min <= pool-max")
    return args


def connection_kwargs(timeout: float) -> dict[str, object]:
    return {
        "options": f"-c timezone={ACCESS_TIMEZONE}",
        "connect_timeout": max(1, round(timeout)),
    }


def inspect_database(database_url: str, timeout: float) -> list[tuple[str, int, str]]:
    rows: list[tuple[str, int, str]] = []
    with psycopg.connect(database_url, **connection_kwargs(timeout)) as connection:
        for table in TABLES:
            exists = connection.execute("SELECT to_regclass(%s)", (f"public.{table}",)).fetchone()[0]
            if exists is None:
                continue
            count = connection.execute(
                sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
            ).fetchone()[0]
            size = connection.execute(
                "SELECT pg_size_pretty(pg_total_relation_size(%s))", (f"public.{table}",)
            ).fetchone()[0]
            rows.append((table, count, size))
    return rows


def execute_query(connection: psycopg.Connection, query: str, row_count: int) -> int:
    with connection.cursor() as cursor:
        cursor.execute(query, (row_count,))
        return len(cursor.fetchall())


def direct_runner(database_url: str, timeout: float) -> Callable[[str, int], int]:
    def run(query: str, row_count: int) -> int:
        with psycopg.connect(database_url, **connection_kwargs(timeout)) as connection:
            return execute_query(connection, query, row_count)

    return run


def pool_runner(pool: ConnectionPool) -> Callable[[str, int], int]:
    def run(query: str, row_count: int) -> int:
        with pool.connection() as connection:
            return execute_query(connection, query, row_count)

    return run


def measure(
    *,
    mode: str,
    scenario: str,
    runner: Callable[[str, int], int],
    query: str,
    rows_requested: int,
    operations: int,
    concurrency: int,
    warmup: int,
) -> Measurement:
    for _ in range(warmup):
        runner(query, rows_requested)

    def one_operation(_: int) -> tuple[float, int]:
        started = time.perf_counter()
        rows_returned = runner(query, rows_requested)
        elapsed_ms = (time.perf_counter() - started) * 1_000
        return elapsed_ms, rows_returned

    wall_started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        samples = list(executor.map(one_operation, range(operations)))
    wall_seconds = time.perf_counter() - wall_started

    returned_counts = {sample[1] for sample in samples}
    if len(returned_counts) != 1:
        raise RuntimeError(f"quantidades de linhas inconsistentes: {returned_counts}")

    return Measurement(
        mode=mode,
        scenario=scenario,
        rows_requested=rows_requested,
        rows_returned=returned_counts.pop(),
        operations=operations,
        concurrency=concurrency,
        durations_ms=tuple(sample[0] for sample in samples),
        wall_seconds=wall_seconds,
    )


def print_inventory(inventory: Sequence[tuple[str, int, str]]) -> None:
    print("\nDados atuais do banco")
    print("| Tabela | Linhas | Tamanho total |")
    print("|---|---:|---:|")
    for table, rows, size in inventory:
        print(f"| {table} | {rows} | {size} |")


def print_results(measurements: Sequence[Measurement]) -> None:
    print("\nResultados")
    print("| Cenario | Linhas | Modo | Media ms | P50 ms | P95 ms | req/s |")
    print("|---|---:|---|---:|---:|---:|---:|")
    for item in measurements:
        label = f"{item.rows_returned}/{item.rows_requested}"
        print(
            f"| {item.scenario} | {label} | {item.mode} | "
            f"{item.mean_ms:.2f} | {item.median_ms:.2f} | {item.p95_ms:.2f} | "
            f"{item.throughput:.1f} |"
        )

    print("\nGanho da pool")
    print("| Cenario | Linhas solicitadas | Latencia media | Throughput |")
    print("|---|---:|---:|---:|")
    grouped: dict[tuple[str, int], dict[str, Measurement]] = {}
    for item in measurements:
        grouped.setdefault((item.scenario, item.rows_requested), {})[item.mode] = item
    for (scenario, rows_requested), modes in grouped.items():
        direct = modes["conexao nova"]
        pooled = modes["pool"]
        latency_gain = direct.mean_ms / pooled.mean_ms
        throughput_gain = pooled.throughput / direct.throughput
        print(
            f"| {scenario} | {rows_requested} | {latency_gain:.2f}x | "
            f"{throughput_gain:.2f}x |"
        )


def main() -> None:
    args = parse_args()
    inventory = inspect_database(args.database_url, args.timeout)
    print_inventory(inventory)

    history_rows = next((count for table, count, _ in inventory if table == "historico_acesso"), 0)
    scenarios = [("sintetico", SYNTHETIC_QUERY, rows) for rows in args.rows]
    if history_rows:
        scenarios.insert(0, ("historico real", HISTORY_QUERY, max(args.rows)))

    direct = direct_runner(args.database_url, args.timeout)
    measurements: list[Measurement] = []
    with ConnectionPool(
        conninfo=args.database_url,
        min_size=args.pool_min,
        max_size=args.pool_max,
        timeout=args.timeout,
        kwargs=connection_kwargs(args.timeout),
        open=True,
    ) as pool:
        pool.wait(timeout=args.timeout)
        pooled = pool_runner(pool)

        for scenario, query, rows_requested in scenarios:
            for mode, runner in (("conexao nova", direct), ("pool", pooled)):
                measurements.append(
                    measure(
                        mode=mode,
                        scenario=scenario,
                        runner=runner,
                        query=query,
                        rows_requested=rows_requested,
                        operations=args.operations,
                        concurrency=args.concurrency,
                        warmup=args.warmup,
                    )
                )

    print_results(measurements)
    print(
        "\nA inicializacao da pool nao entra na medicao. Cada operacao consome "
        "todas as linhas, como uma resposta de lista da API."
    )


if __name__ == "__main__":
    main()
