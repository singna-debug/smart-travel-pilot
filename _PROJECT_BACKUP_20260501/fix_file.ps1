$lines = Get-Content -LiteralPath 'c:\Users\vbxn6\.gemini\antigravity\scratch\smart-travel-pilot\app\confirmation\[id]\page.tsx'
$clean = ($lines | Select-Object -First 491) + ($lines | Select-Object -Skip 687)
$clean | Set-Content -LiteralPath 'c:\Users\vbxn6\.gemini\antigravity\scratch\smart-travel-pilot\app\confirmation\[id]\page.tsx' -Encoding UTF8
