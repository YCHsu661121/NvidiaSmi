# 🚀 NvidiaSmi Dashboard

A real-time, lightweight web-based monitoring dashboard for NVIDIA GPUs and system resources. This service provides high-frequency updates using Server-Sent Events (SSE), making it ideal for tracking GPU temperature, memory usage, power draw, and active processes with minimal overhead.

## ✨ Features

- 📊 **Real-Time Monitoring**: Live updates of GPU utilization, memory, temperature, and power usage via SSE.
- 🔍 **Process Tracking**: Automatically identifies which processes are consuming GPU resources.
 
- 🖥️ **System Health**: Monitor overall CPU and RAM usage alongside your GPU metrics.
- 🐳 **Docker Ready**: One-command deployment using Docker Compose with full NVIDIA GPU passthrough support.
- ⚡ **Low Latency**: Uses `nvidia-smi` parsing and asynchronous streaming for high performance.

## 🛠️ Tech Stack

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Streaming**: Server-Sent Events (SSE)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Containerization**: Docker & Docker Compose
- **System Utilities**: `nvidia-smi`, `psutil`

## 🚀 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed on your host machine to enable GPU access within containers.

### Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YCHsu661121/NvidiaSmi.git
   cd NvidiaSmi
   ```

2. **Launch with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Access the Dashboard:**
   Open your browser and navigate to:
   `http://localhost:9999`

## 📂 Project Structure

```text
NvidiaSmi/
├── app/
│   ├── main.py              # FastAPI backend & SSE logic
│   ├── requirements.txt     # Python dependencies
│   └── static/              # Frontend assets (HTML, JS, CSS)
├── docker-compose.yml       # Docker orchestration with GPU config
├── Dockerfile               # Container environment definition
├── gpu_stress_test.py       # Script for testing GPU load
└── README.md                # Project documentation
```

## ⚙️ How it Works

The backend periodically executes `nvidia-smi` queries and process checks. The results are bundled into a JSON payload and pushed to the web client every 5 seconds via an asynchronous stream. This approach avoids the "heavy lifting" of traditional HTTP polling, ensuring that monitoring the system doesn't significantly impact its performance.

## 📜 License

[MIT License](LICENSE)
