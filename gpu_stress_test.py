import torch
import time

def stress_test():
    print("🚀 Starting GPU Stress Test...")
    print("🔥 Generating large matrices for heavy computation...")
    # 使用較大的矩陣以確保對 GPU 有明顯負載
    size = 10000 
    try:
        # 檢查 CUDA 是否可用
        if not torch.cuda.is_available():
            print("❌ Error: CUDA is not available for PyTorch!")
            return

        device = torch.device("cuda")
        print(f"✅ Found GPU: {torch_device_name(device)}")
        
        # 預先建立矩陣
        a = torch.randn(size, size, device=device)
        b = torch.randn(size, size, device=device)

        count = 0
        start_time = time.time()
        
        while True:
            # 執行大量的矩陣乘法 (GEMM)
            _ = torch.matmul(a, b)
            
            count += 1
            elapsed = time.time() - start_time
            
            if count % 10 == 0:
                print(f"📊 Iteration {count} | Elapsed: {elapsed:.2f}s | Load: High", end='\r')
            
            # 稍微給一點點間隙，避免完全卡死系統，但保持高負載
            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n🛑 Stress test stopped by user.")
    except Exception as e:
        print(f"\n❌ Error during stress test: {e}")

def torch_device_name(device):
    if torch.cuda.is_available():
        return torch.cuda.get_device_name(device)
    return "CPU"

if __name__ == "__main__":
    stress_test()
