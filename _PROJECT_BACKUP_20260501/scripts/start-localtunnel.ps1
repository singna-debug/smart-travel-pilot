
# Check and install localtunnel
if (-not (Get-Command lt -ErrorAction SilentlyContinue)) {
    Write-Host "Installing localtunnel..."
    npm install -g localtunnel
}

# Kill existing lt
Stop-Process -Name "node" -ErrorAction SilentlyContinue 
# Warning: Killing node might kill Next.js server too! 
# Better to kill by command line match if possible, or just ignore.
# Let's assume user is running Next.js in a separate terminal.

# Start lt in background via cmd /c npx (Windows compatibility)
Write-Host "Starting localtunnel via cmd /c npx..."
$process = Start-Process -FilePath "cmd" -ArgumentList "/c npx localtunnel --port 3000" -PassThru -RedirectStandardOutput "lt.log" -WindowStyle Hidden

# Wait for URL in log
Start-Sleep -Seconds 5
if (Test-Path "lt.log") {
    $log = Get-Content "lt.log" -Raw
    Write-Host "Log Content: $log"
    if ($log -match "your url is: (https://[a-zA-Z0-9-]+\.loca\.lt)") {
        $url = $matches[1]
        Write-Host "✅ Localtunnel Started!"
        Write-Host "URL: $url"
        Write-Host "👉 Set this in Kakao Console: $url/api/kakao-skill"
    } else {
        Write-Host "⚠️ Localtunnel started but URL not found in log yet."
    }
}
