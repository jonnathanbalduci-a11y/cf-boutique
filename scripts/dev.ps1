$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiPath = Join-Path $repoRoot "apps/api"
$webPath = Join-Path $repoRoot "apps/web"
$webNextPath = Join-Path $webPath ".next"

function Get-PidsListeningOnPort {
  param([int]$Port)

  $pids = @()

  try {
    $pids += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  }
  catch {
    # Ignora e tenta fallback abaixo
  }

  if (-not $pids -or $pids.Count -eq 0) {
    $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING\s+\d+$"
    foreach ($line in $lines) {
      $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
      if ($parts.Count -gt 0) {
        $pidCandidate = $parts[$parts.Count - 1]
        if ($pidCandidate -match "^\d+$") {
          $pids += [int]$pidCandidate
        }
      }
    }
  }

  return ($pids | Sort-Object -Unique)
}

function Stop-NodeOnPort {
  param([int]$Port)

  $connections = Get-PidsListeningOnPort -Port $Port

  foreach (${procId} in $connections) {
    try {
      Stop-Process -Id ${procId} -Force -ErrorAction Stop
      Write-Host "Porta $Port liberada (PID ${procId} encerrado)."
    }
    catch {
      Write-Host "Nao foi possivel encerrar PID ${procId} da porta ${Port}: $($_.Exception.Message)"
    }
  }

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 150
    $remaining = Get-PidsListeningOnPort -Port $Port
    if (-not $remaining -or $remaining.Count -eq 0) {
      return
    }
  }
}

Stop-NodeOnPort -Port 3000
Stop-NodeOnPort -Port 3001

if (Test-Path $webNextPath) {
  Write-Host "Limpando cache do Next (.next)..."
  try {
    cmd /c "attrib -R \"$webNextPath\*\" /S /D" | Out-Null
  }
  catch {
    # Se falhar em ajustar atributo, tenta remover mesmo assim
  }

  Remove-Item -Path $webNextPath -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Iniciando API e Web..."
Write-Host "API: http://localhost:3001"
Write-Host "WEB: http://localhost:3000"
Write-Host "Use Ctrl+C para encerrar ambos."

$apiJob = Start-Job -Name "cf-api" -ScriptBlock {
  param($path)
  Set-Location $path
  npm run start:dev 2>&1 | ForEach-Object { "[api] $_" }
} -ArgumentList $apiPath

$webJob = Start-Job -Name "cf-web" -ScriptBlock {
  param($path)
  Set-Location $path
  npm run dev -- --port 3000 2>&1 | ForEach-Object { "[web] $_" }
} -ArgumentList $webPath

try {
  while ($true) {
    Receive-Job -Job $apiJob | Write-Host
    Receive-Job -Job $webJob | Write-Host

    if ($apiJob.State -in @("Failed", "Completed", "Stopped")) {
      throw "Processo da API finalizou com estado: $($apiJob.State)"
    }

    if ($webJob.State -in @("Failed", "Completed", "Stopped")) {
      throw "Processo do Web finalizou com estado: $($webJob.State)"
    }

    Start-Sleep -Milliseconds 300
  }
}
finally {
  foreach ($job in @($apiJob, $webJob)) {
    if ($job -and $job.State -eq "Running") {
      Stop-Job -Job $job -ErrorAction SilentlyContinue
    }
  }

  foreach ($job in @($apiJob, $webJob)) {
    if ($job) {
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
  }
}
