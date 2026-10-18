"""Mede a latência HTTP de uma rota GET sem alterar dados."""

from __future__ import annotations

import argparse
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8001/api/v1/health/db")
    parser.add_argument("--requests", type=int, default=40)
    parser.add_argument("--concurrency", nargs="+", type=int, default=[1, 4])
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()
    if args.requests < 1 or args.warmup < 0 or any(n < 1 for n in args.concurrency):
        parser.error("requests e concurrency devem ser positivos; warmup não pode ser negativo")

    def request(_: int) -> float:
        started = time.perf_counter()
        with urlopen(args.url, timeout=args.timeout) as response:
            response.read()
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")
        return (time.perf_counter() - started) * 1_000

    for concurrency in args.concurrency:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            list(executor.map(request, range(args.warmup)))
            wall_started = time.perf_counter()
            samples = list(executor.map(request, range(args.requests)))
            wall_seconds = time.perf_counter() - wall_started

        ordered = sorted(samples)
        p95 = ordered[max(0, round(0.95 * len(ordered) + 0.5) - 1)]
        print(
            f"concorrência={concurrency} requisições={args.requests} "
            f"média={statistics.fmean(samples):.2f}ms "
            f"p50={statistics.median(samples):.2f}ms p95={p95:.2f}ms "
            f"throughput={args.requests / wall_seconds:.1f}req/s"
        )


if __name__ == "__main__":
    main()
