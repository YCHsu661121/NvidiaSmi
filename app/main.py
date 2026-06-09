import asyncio
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

import psutil
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def run_nvidia_smi(args: list[str]) -> str:
    result = subprocess.run(
        ["nvidia-smi"] + args,
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.stdout.strip()


def collect_gpu_stats() -> list[dict]:
    query = (
        "index,name,utilization.gpu,memory.used,memory.total,"
        "temperature.gpu,power.draw,power.limit,"
        "clocks.current.sm,clocks.current.memory"
    )
    raw = run_nvidia_smi(
        [f"--query-gpu={query}", "--format=csv,noheader,nounits"]
    )
    gpus = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 10:
            continue

        def safe_float(v: str) -> float | None:
            try:
                return float(v)
            except ValueError:
                return None

        mem_used = safe_float(parts[3])
        mem_total = safe_float(parts[4])
        mem_pct = round(mem_used / mem_total * 100, 1) if mem_total else None

        gpus.append({
            "index": int(parts[0]) if parts[0].isdigit() else 0,
            "name": parts[1],
            "utilization_pct": safe_float(parts[2]),
            "memory_used_mib": mem_used,
            "memory_total_mib": mem_total,
            "memory_pct": mem_pct,
            "temperature_c": safe_float(parts[5]),
            "power_draw_w": safe_float(parts[6]),
            "power_limit_w": safe_float(parts[7]),
            "clock_sm_mhz": safe_float(parts[8]),
            "clock_mem_mhz": safe_float(parts[9]),
        })
    return gpus


def collect_processes() -> list[dict]:
    # Build gpu_uuid -> index mapping
    uuid_raw = run_nvidia_smi(
        ["--query-gpu=index,gpu_uuid", "--format=csv,noheader"]
    )
    uuid_to_index: dict[str, int] = {}
    for line in uuid_raw.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) == 2:
            try:
                uuid_to_index[parts[1]] = int(parts[0])
            except ValueError:
                pass

    # Use XML output to capture ALL processes (compute + graphics)
    xml_raw = run_nvidia_smi(["-x", "-q"])
    procs: list[dict] = []
    try:
        root = ET.fromstring(xml_raw)
        for gpu_elem in root.findall("gpu"):
            uuid_elem = gpu_elem.find("uuid")
            gpu_uuid = uuid_elem.text.strip() if uuid_elem is not None else ""
            gpu_idx = uuid_to_index.get(gpu_uuid, -1)

            # Use .//process_info to catch both Graphics and Compute processes 
            # regardless of whether they are under <processes> or other nodes.
            for proc_elem in gpu_elem.findall(".//process_info"):
                pid_elem = proc_elem.find("pid")
                name_elem = proc_elem.find("process_name")
                mem_elem = proc_elem.find("used_memory")

                if pid_elem is None:
                    continue
                try:
                    pid = int(pid_elem.text.strip())
                except (ValueError, AttributeError):
                    continue

                name = (name_elem.text or "").strip() if name_elem is not None else ""
                # Fallback: resolve name from psutil when driver returns empty/N/A
                if not name or name.upper() == "N/A":
                    try:
                        name = psutil.Process(pid).name()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        name = f"PID {pid}"

                memory_mib: float | None = None
                if mem_elem is not None and mem_elem.text:
                    try:
                        memory_mib = float(mem_elem.text.strip().split()[0])
                    except (ValueError, IndexError):
                        pass

                procs.append({
                    "gpu_index": gpu_idx,
                    "pid": pid,
                    "name": name,
                    "memory_mib": memory_mib,
                })
    except Exception:
        pass

    return procs


def collect_system() -> dict:
    cpu_pct = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()
    return {
        "cpu_pct": cpu_pct,
        "ram_used_gb": round(vm.used / 1024**3, 2),
        "ram_total_gb": round(vm.total / 1024**3, 2),
        "ram_pct": vm.percent,
    }


def collect_all() -> dict:
    try:
        gpus = collect_gpu_stats()
    except Exception as e:
        gpus = [{"error": str(e)}]

    try:
        processes = collect_processes()
    except Exception:
        processes = []

    system = collect_system()

    return {"gpus": gpus, "processes": processes, "system": system}


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html)


@app.get("/api/stream")
async def stream():
    async def event_generator():
        # psutil cpu_percent 第一次呼叫需先 warmup
        psutil.cpu_percent(interval=None)
        await asyncio.sleep(0.1)
        while True:
            data = collect_all()
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
