$path = 'c:\Users\vbxn6\.gemini\antigravity\scratch\smart-travel-pilot\app\confirmation\[id]\page.tsx'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$enc949 = [System.Text.Encoding]::GetEncoding(949)
$utf8 = [System.Text.Encoding]::UTF8

try {
    # If it was read as CP949 and written as UTF8:
    # Original UTF8 Bytes -> (Read as CP949) -> Unicode Corrupted -> (Written as UTF8)
    # To reverse:
    # Corrupted -> (Encode as CP949) -> Original UTF8 Bytes -> (Decode as UTF8) -> Original
    $bytes = $enc949.GetBytes($content)
    $recovered = $utf8.GetString($bytes)
    [System.IO.File]::WriteAllText($path, $recovered, $utf8)
    Write-Output "SUCCESS: Recovered using CP949 bytes"
} catch {
    Write-Output "FAILED: $_"
}
