# Copies the database and uploads to a dated folder, keeping the last 14 backups.
param([string]$BackupDir = "$env:USERPROFILE\Documents\YavJourneyBackups")
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$data = Join-Path $repo "data"
$dest = Join-Path $BackupDir (Get-Date -Format "yyyy-MM-dd_HHmm")
New-Item -ItemType Directory -Force -Path $dest | Out-Null
# SQLite WAL mode: copy the main file plus -wal/-shm so the copy is consistent.
Get-ChildItem $data -Filter "yav.sqlite*" | Copy-Item -Destination $dest
if (Test-Path "$data\uploads") { Copy-Item "$data\uploads" -Destination $dest -Recurse }
if (Test-Path "$data\clips") { Copy-Item "$data\clips" -Destination $dest -Recurse }
Get-ChildItem $BackupDir -Directory | Sort-Object Name -Descending | Select-Object -Skip 14 | Remove-Item -Recurse -Force
Write-Host "Backed up to $dest"
