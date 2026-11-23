# One-time Windows setup. Run in PowerShell as Administrator from the repo folder:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\setup.ps1
param(
  [int]$Port = 5174,
  [string]$BackupDir = "$env:USERPROFILE\Documents\YavJourneyBackups"
)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path

# 1. Firewall: allow the app's port on Private (home) networks only.
if (-not (Get-NetFirewallRule -DisplayName "Yav Learning Journey" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "Yav Learning Journey" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
  Write-Host "Firewall rule added for port $Port (Private networks only)."
}

# 2. Start the server when you log in.
$start = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$repo\scripts\windows\start.bat`"" -WorkingDirectory $repo
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
Register-ScheduledTask -TaskName "YavJourney-Server" -Action $start -Trigger $atLogon -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries) -Force | Out-Null
Write-Host "Server will start at login."

# 3. Nightly backup at 9pm.
$backup = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$repo\scripts\windows\backup.ps1`" -BackupDir `"$BackupDir`""
Register-ScheduledTask -TaskName "YavJourney-Backup" -Action $backup -Trigger (New-ScheduledTaskTrigger -Daily -At 9pm) -Force | Out-Null
Write-Host "Nightly backup to $BackupDir at 9pm."

# 4. Keep the PC awake on mains power (after-school sessions).
powercfg /change standby-timeout-ac 0
Write-Host "Sleep on mains power disabled. Set it back with: powercfg /change standby-timeout-ac 30"

Write-Host "`nNext: give this PC a fixed address in your router (DHCP reservation), then on the iPad open http://<pc-address>:$Port and Add to Home Screen."
