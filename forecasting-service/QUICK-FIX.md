# Quick Fix for Port Already in Use Error

## Error
```
ERROR: [Errno 10048] error while attempting to bind on address ('0.0.0.0', 8001): 
[winerror 10048] only one usage of each socket address (protocol/network address/port) is normally permitted
```

## What This Means
Port 8001 is already being used by another process (likely a previous instance of the forecasting service).

## Quick Fix

### Option 1: Kill the Process Using Port 8001
```powershell
# Find the process
netstat -ano | findstr :8001

# Kill it (replace PID with the number from above)
taskkill /F /PID <PID>
```

### Option 2: Use a Different Port
Edit `main.py` and change:
```python
uvicorn.run(app, host="0.0.0.0", port=8002)  # Changed from 8001 to 8002
```

Then update `backend/appsettings.json`:
```json
{
  "ForecastingService": {
    "Url": "http://localhost:8002"
  }
}
```

### Option 3: One-Liner to Kill All Python Processes (Use Carefully!)
```powershell
Get-Process python | Where-Object {$_.Path -like "*forecasting-service*"} | Stop-Process -Force
```

## Prevention
Always stop the service properly:
- Press `Ctrl+C` in the terminal running the service
- Or use: `taskkill /F /IM python.exe /FI "WINDOWTITLE eq *forecasting*"`

## Verify Service is Running
```powershell
# Check if port 8001 is in use
netstat -ano | findstr :8001

# Test the service
curl http://localhost:8001/health
# Or in browser: http://localhost:8001/docs
```

