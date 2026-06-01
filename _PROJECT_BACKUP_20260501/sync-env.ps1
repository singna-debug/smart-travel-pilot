# Vercel 환경 변수 강제 동기화 스크립트 (sync-env.ps1)

function Sync-VercelEnv {
    param (
        [string]$EnvFile = ".env.local"
    )

    if (-not (Test-Path $EnvFile)) {
        Write-Error "❌ $EnvFile 파일을 찾을 수 없습니다."
        return
    }

    Write-Host "🚀 Vercel 환경 변수 강제 동기화를 시작합니다 (기존 값 삭제 후 재생성)..." -ForegroundColor Cyan

    $content = Get-Content $EnvFile -Raw
    $envVars = @{}
    
    $lines = $content -split "`r?`n"
    $currentKey = ""
    $currentValue = ""
    $isCollectingMultiLine = $false

    foreach ($line in $lines) {
        $l = $line.Trim()
        if ($l -match "^#") { continue }
        if ($l -eq "") { continue }

        if ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()

            if ($value -match "^`"(.*)") {
                if ($value -match "^`"(.*)`"$") {
                    $envVars[$key] = $matches[1]
                } else {
                    $currentKey = $key
                    $currentValue = $line.Substring($line.IndexOf("=") + 2)
                    $isCollectingMultiLine = $true
                }
            } else {
                $envVars[$key] = $value
            }
        } elseif ($isCollectingMultiLine) {
            if ($line -match "(.*)`"$") {
                $currentValue += "`n" + $matches[1]
                $envVars[$currentKey] = $currentValue
                $isCollectingMultiLine = $false
            } else {
                $currentValue += "`n" + $line
            }
        }
    }

    $keysToSync = @(
        "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        "GOOGLE_PRIVATE_KEY",
        "GOOGLE_SHEET_ID",
        "SCRAPINGBEE_API_KEY",
        "GEMINI_API_KEY",
        "KAKAO_REST_API_KEY",
        "KAKAO_ADMIN_KEY",
        "KAKAO_CHANNEL_ID",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "KAKAO_SKILL_SERVER_URL",
        "NEXT_PUBLIC_SHEET_ID"
    )

    foreach ($key in $keysToSync) {
        if ($envVars.ContainsKey($key)) {
            $val = $envVars[$key]
            Write-Host "📡 $key 동기화 중..." -ForegroundColor Yellow
            
            # Remove existing key first to avoid conflicts (silently continue on error if not found)
            & npx vercel env rm $key production --yes 2>$null | Out-Null
            
            # Add new key
            $val | npx vercel env add $key production
        } else {
            Write-Host "⚠️ $key 가 .env.local에 없습니다. 건너뜁니다." -ForegroundColor Gray
        }
    }

    Write-Host "✅ 동기화 완료! 설정을 반영하려면 다시 배포(npx vercel --prod)가 필요합니다." -ForegroundColor Green
}

Sync-VercelEnv
