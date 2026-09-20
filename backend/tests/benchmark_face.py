"""
Teste de estresse e calibração de hardware -- FaceService (InsightFace/ArcFace)

Correções em relação à versão anterior:
  1. Warm-up (carregamento do modelo) FORA do laço cronometrado -- a versão
     anterior incluía o carregamento do buffalo_l dentro da 1a iteração,
     inflando a média com 10 amostras.
  2. Sweep de intra_op_num_threads (4/8/16) -- a versão anterior fixava 16
     (= threads lógicas) sem nunca aplicar de fato a SessionOptions (bug
     corrigido no face_service.py). 8 (núcleos físicos do Ryzen 7 5700U)
     costuma ser o ponto de partida mais estável para cargas de conv-net.
  3. Sweep de det_size (320/480/640) -- o SCRFD escala com a resolução de
     entrada; câmera de controle de acesso tem enquadramento controlado,
     então um det_size menor pode manter a precisão com bem menos custo.
  4. Teste genuine/impostor real -- a versão anterior comparava o MESMO
     frame consigo mesmo (sempre dá ~1.0, não valida nada). Aqui capturamos
     dois frames da MESMA pessoa em momentos diferentes (genuine) e
     comparamos com um vetor sintético como impostor grosseiro.

Não foi possível executar este script no ambiente de geração (sem
InsightFace/webcam instalados) -- rode localmente e ajuste conforme o que
aparecer no terminal.
"""

import os
import sys
import time
import gc

import psutil
import numpy as np
import cv2

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def get_cpu_temperature() -> str:
    try:
        temps = psutil.sensors_temperatures()
        for key in ["k10temp", "coretemp", "cpu_thermal", "acpitz", "zenpower"]:
            if key in temps and temps[key]:
                return f"{temps[key][0].current:.1f}°C"
    except Exception:
        pass
    return "N/A"


def cooldown(seconds: float, label: str) -> None:
    """Pausa entre blocos de teste pra reduzir viés térmico entre medições."""
    print(f"[Benchmark] Resfriando {seconds:.0f}s antes de '{label}' (temp: {get_cpu_temperature()})...")
    time.sleep(seconds)


def capture_webcam_frame(prompt: str = "") -> bytes:
    if prompt:
        print(f"[Benchmark] {prompt}")
    cap = cv2.VideoCapture(0)
    frame_captured = None
    if cap.isOpened():
        time.sleep(0.5)
        ret, frame = cap.read()
        if ret and frame is not None:
            frame_captured = frame
        cap.release()

    if frame_captured is not None:
        print("Frame capturado com sucesso!")
        _, encoded = cv2.imencode(".jpg", frame_captured)
        return encoded.tobytes()

    raise RuntimeError("Camera nao detectada -- conecte a webcam e tente novamente.")


class LegacyFaceService:
    """Modulo antigo (dlib/face_recognition, 128d) -- mantido so para comparacao."""

    @staticmethod
    def extract_face_vector(img_rgb: np.ndarray) -> list[float] | None:
        import face_recognition

        face_locations = face_recognition.face_locations(img_rgb, model="hog")
        if not face_locations:
            return None
        encodings = face_recognition.face_encodings(
            img_rgb, known_face_locations=face_locations, num_jitters=1
        )
        return encodings[0].tolist() if encodings else None


def timed_run(fn, iterations: int, warmup: int = 2) -> list[float]:
    """
    Roda `fn()` `warmup` vezes SEM cronometrar (absorve o custo de
    inicializacao de modelo), depois `iterations` vezes cronometradas.
    """
    for _ in range(warmup):
        fn()

    times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn()
        t1 = time.perf_counter()
        times.append((t1 - t0) * 1000)
    return times


def run_thread_sweep(img_bytes: bytes, iterations: int = 8) -> None:
    """
    Varre intra_op_num_threads pra achar o ponto ideal no hardware atual.
    Reconstroi o FaceAnalysis a cada configuracao (bypassa o singleton
    de classe de proposito, so para este experimento).
    """
    import onnxruntime as ort
    from insightface.app import FaceAnalysis

    print("\n" + "=" * 75)
    print("SWEEP DE THREADS (intra_op_num_threads)")
    print("=" * 75)

    for threads in [4, 8, 16]:
        gc.collect()
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.execution_mode = ort.ExecutionMode.ORT_PARALLEL
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        app = FaceAnalysis(
            name=os.getenv("FACE_MODEL", "buffalo_l"),
            providers=["CPUExecutionProvider"],
            sess_options=so,
        )
        app.prepare(ctx_id=0, det_size=(640, 640))

        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        times = timed_run(lambda: app.get(img_bgr), iterations=iterations, warmup=2)
        print(f"   intra_op={threads:>2} -> {np.mean(times):.1f} ms (desvio {np.std(times):.1f} ms)")

        del app
        gc.collect()


def run_detsize_sweep(img_bytes: bytes, iterations: int = 8, threads: int = 8) -> None:
    import onnxruntime as ort
    from insightface.app import FaceAnalysis

    print("\n" + "=" * 75)
    print("SWEEP DE DET_SIZE")
    print("=" * 75)

    for det_size in [320, 480, 640]:
        gc.collect()
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.execution_mode = ort.ExecutionMode.ORT_PARALLEL

        app = FaceAnalysis(
            name=os.getenv("FACE_MODEL", "buffalo_l"),
            providers=["CPUExecutionProvider"],
            sess_options=so,
        )
        app.prepare(ctx_id=0, det_size=(det_size, det_size))

        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        def call():
            faces = app.get(img_bgr)
            return len(faces)

        times = timed_run(call, iterations=iterations, warmup=2)
        n_faces = call()
        print(
            f"   det_size={det_size:>3} -> {np.mean(times):.1f} ms "
            f"(desvio {np.std(times):.1f} ms) | rostos detectados: {n_faces}"
        )

        del app
        gc.collect()


def run_genuine_impostor_test() -> None:
    """
    Teste real de discriminacao: duas capturas da MESMA pessoa em momentos
    diferentes (genuine) vs um vetor sintetico (impostor grosseiro -- na
    falta de uma segunda pessoa disponivel para o teste).
    """
    from app.services.face_service import FaceService

    print("\n" + "=" * 75)
    print("TESTE GENUINE / IMPOSTOR (validacao real, nao autocomparacao)")
    print("=" * 75)

    frame1 = capture_webcam_frame("Capturando frame 1 -- olhe pra camera...")
    print("Mude levemente de posicao/expressao nos proximos 3 segundos...")
    time.sleep(3)
    frame2 = capture_webcam_frame("Capturando frame 2 -- mesma pessoa, momento diferente...")

    r1 = FaceService.extract_face_vector_detailed(frame1)
    r2 = FaceService.extract_face_vector_detailed(frame2)

    if not (r1.success and r2.success):
        print(f"   Falha na extracao: frame1={r1.message}, frame2={r2.message}")
        return

    genuine = FaceService.calculate_similarity(r1.vector, r2.vector)
    print(
        f"   GENUINE (mesma pessoa, 2 capturas): "
        f"similarity={genuine.similarity:.4f} | match={genuine.is_match}"
    )

    rng = np.random.default_rng(42)
    impostor_vector = rng.normal(size=len(r1.vector)).tolist()
    impostor = FaceService.calculate_similarity(r1.vector, impostor_vector)
    print(
        f"   IMPOSTOR (vetor aleatorio, sanity check grosseiro): "
        f"similarity={impostor.similarity:.4f} | match={impostor.is_match}"
    )
    print(
        "   Isso e so um piso de sanidade -- pra calibrar o threshold de "
        "verdade, repita com fotos de pelo menos 2-3 pessoas diferentes do grupo."
    )


def run_main_comparison(iterations: int = 10) -> None:
    from app.services.face_service import FaceService as NewFaceService

    print("=" * 75)
    print(f"COMPARACAO PRINCIPAL: LEGADO (dlib) vs NOVO (InsightFace) -- {iterations} iteracoes")
    print("=" * 75)

    img_bytes = capture_webcam_frame("Capturando frame de referencia para os testes de velocidade...")
    nparr = np.frombuffer(img_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    process = psutil.Process(os.getpid())

    print("\n[1/2] Modulo legado (dlib, 128d) -- com warm-up isolado...")
    mem_before = process.memory_info().rss / (1024 * 1024)
    legacy_times = timed_run(
        lambda: LegacyFaceService.extract_face_vector(img_rgb), iterations=iterations, warmup=2
    )
    mem_after_legacy = process.memory_info().rss / (1024 * 1024)

    cooldown(10, "modulo novo")

    print("\n[2/2] Modulo novo (InsightFace, 512d) -- com warm-up isolado...")
    new_times = timed_run(
        lambda: NewFaceService.extract_face_vector(img_bytes), iterations=iterations, warmup=2
    )
    mem_after_new = process.memory_info().rss / (1024 * 1024)

    print("\n" + "=" * 75)
    print("RESULTADO (warm-up excluido da medicao)")
    print("=" * 75)
    print(f"   Legado:  {np.mean(legacy_times):.1f} ms (desvio {np.std(legacy_times):.1f} ms)")
    print(f"   Novo:    {np.mean(new_times):.1f} ms (desvio {np.std(new_times):.1f} ms)")
    print(f"   RAM antes: {mem_before:.1f} MB | apos legado: {mem_after_legacy:.1f} MB | apos novo: {mem_after_new:.1f} MB")
    print(
        "   Nota: legado e novo ainda rodam no mesmo processo em sequencia -- "
        "a RAM do 'novo' inclui o que o legado ja tinha alocado. Para uma medicao "
        "de memoria isolada de verdade, rode cada um em um processo separado."
    )


if __name__ == "__main__":
    run_main_comparison(iterations=10)

    frame = capture_webcam_frame("Capturando frame para os sweeps de configuracao...")
    cooldown(5, "sweep de threads")
    run_thread_sweep(frame, iterations=8)
    cooldown(5, "sweep de det_size")
    run_detsize_sweep(frame, iterations=8)
    cooldown(5, "teste genuine/impostor")
    run_genuine_impostor_test()