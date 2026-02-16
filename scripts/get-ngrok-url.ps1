try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
    $url = $response.tunnels[0].public_url
    if ($url) {
        Write-Host "✅ Ngrok URL Found: $url"
    } else {
        Write-Host "⚠️ Ngrok API reachable but no tunnel found."
    }
} catch {
    Write-Host "❌ Failed to contact ngrok API. Is it running?"
    Write-Host $_.Exception.Message
}
