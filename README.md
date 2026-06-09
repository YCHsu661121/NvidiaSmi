# GPU Monitor Project Documentation

## 📌 Overview
`NvidiaSmi` is a lightweight, real-time hardware monitoring service designed to provide a web-based dashboard for tracking NVIDIA GPU status, system resource usage (CPU/RAM), and active GPU processes. It leverages Docker for easy deployment and Server-Sent Events (SSE) for efficient, low-latency data streaming.

## 🏗️ Architecture
The project follows a client-server architecture:
- **Backend**: A Python `FastAPI` application that executes `nvidia-smi` commands and parses the output.
- **Data Stream**: Uses **Server-Sent Events (SSE)** to push updates from the server to the client every 5 seconds, avoiding the overhead of repeated HTTP polling.
- **Frontend**: A web interface (located in `static/`) that consumes the JSON stream and renders real-time metrics.
- **Containerization**: Dockerized via `Dockerfile` and managed by `docker-compose.yml`, ensuring GPU passthrough is configured correctly.

## ⚙️ Core Workflow

### 1. Data Collection Pipeline
The backend performs three distinct collection tasks:
1.  **GPU Metrics (`collect_gpu_stats`)**:
    *   Executes `nvidia-smi --query-gpu=... --format=csv`.
    *   Extracts: Utilization %, Memory (Used/Total), Temperature, Power Draw, and Clock speeds.
2.  **Process Tracking (`collect_processes`)**:
    *   Execations `nvidia-smi -q -x` (XML format).
    *   Maps GPU UUIDs to indices.
    *   Pars/> parses `<process_info>` nodes to identify PIDs and process names.
    *   **Fallback Mechanism**: If the driver returns "N/A" for a process name, it uses `psutil` to resolve the name from the system PID.
3.  **System Health (`collect_system`)**:
    *   Uses `psutil` to capture CPU utilization and RAM usage (Used/Total/Percentage).

### 2. Data Streaming (The SSE Loop)
- The endpoint `/api/stream` initiates an asynchronous generator.
- **Interval**: Every 5 seconds, a new snapshot of all collected data is captured.
- **Payload**: A JSON object containing `gpus`, `processes`, and `system` keys is pushed to the client as a `text/event-stream`.

### 3. Deployment Flow
1.  **Docker Build**: The `docker-compose` builds an image from the local `Dockerfile`.
2.  **GPU Access**: The container is granted access to all host NVIDIA GPUs via the `nvidia-container-toolkit` (defined in `deploy.resources`).
3.  **Service Exposure**: Port `9999` is mapped, allowing users to access the dashboard via `http://<host>:9999`.

## 🛠️ Technology Stack
- **Language**: Python 3.x
- **Web Framework**: FastAPI
- **ASGI Server**: Uvicorn
- **System Utilities**: `psutil`, `nvidia-smi`
- **Containerization**: Docker & Docker Compose

## 📂 Directory Structure
```text
NvidiaSmi/
├── docker-compose.yml   # Orchestration & GPU configuration
├── app/
│   ├── main.py          # Core logic (API, Parsing, SSE)
│   ├── requirements.txt # Python dependencies
│   └── static/          # Frontend assets (HTML/JS/CSS)
└── Dockerfile           # Environment setup
```
