
# Check and install ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "Installing ngrok..."
    npm install -g ngrok
}

# Kill existing ngrok
Stop-Process -Name "ngrok" -ErrorAction SilentlyContinue

# Start ngrok in background
Write-Host "Starting ngrok..."
Start-Process -FilePath "ngrok" -ArgumentList "http 3000" -WindowStyle Hidden

# Wait for it to start
Start-Sleep -Seconds 5

# Get URL from local API
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
    $url = $response.tunnels[0].public_url
    if ($url) {
        Write-Host "✅ Ngrok Started Successfully!"
        Write-Host "Public URL: $url"
        Write-Host "👉 Set this in Kakao Console: $url/api/kakao-skill"
    } else {
        Write-Host "⚠️ Ngrok started but no tunnel found?"
    }
} catch {
    Write-Host "❌ Failed to get ngrok URL. Is ngrok running?"
    Get-Process ngrok -ErrorAction SilentlyContinue
}
