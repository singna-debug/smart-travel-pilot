Write-Host "🔍 checking ngrok installation..."
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ ngrok not found. Installing via npm..."
    npm install -g ngrok
}

Write-Host "🚀 Starting ngrok tunnel for port 3000..."
Write-Host "👉 Copy the 'Forwarding' URL (https://...) and set it in Kakao Developers Console -> Skill Server URL"
Write-Host "   Example: https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/kakao-skill"
ngrok http 3000
