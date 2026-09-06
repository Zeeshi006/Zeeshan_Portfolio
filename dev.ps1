# Load .env into the current process environment, then start all services.
# Usage: .\dev.ps1

Get-Content (Join-Path $PSScriptRoot ".env") | ForEach-Object {
    if ($_ -match '^\s*$' -or $_ -match '^\s*#') { return }
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
}

Write-Host "Env loaded. Starting all services..." -ForegroundColor Green
pnpm dev
