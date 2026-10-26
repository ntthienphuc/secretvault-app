param(
    [string]$AppPath = (Join-Path $env:LOCALAPPDATA 'Programs\SecretVault\SecretVault.exe'),
    [string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'SecretVault\v2'),
    [int]$Port = 8443,
    [string]$ClientZipDestination
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $AppPath -PathType Leaf)) { throw 'Install SecretVault 2.2 first.' }
if ($Port -lt 1 -or $Port -gt 65535) { throw 'Invalid TCP port.' }
$AppPath = [IO.Path]::GetFullPath($AppPath)
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
$argumentText = '--lan-host --headless --no-browser --port ' + $Port + ' --data-dir "' + $DataDirectory + '"'
$preparation = Start-Process -FilePath $AppPath -ArgumentList ('--lan-host --prepare-lan --port ' + $Port + ' --data-dir "' + $DataDirectory + '"') -WindowStyle Hidden -PassThru -Wait
if ($preparation.ExitCode -ne 0) { throw 'LAN preparation failed. Check secretvault.log in the data folder.' }
$lanDirectory = Join-Path $DataDirectory 'lan'
$connection = Get-Content -LiteralPath (Join-Path $lanDirectory 'connection.json') -Raw | ConvertFrom-Json
$activeSocket = Get-NetTCPConnection -State Listen -LocalAddress $connection.address -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $activeSocket) {
    Start-Process -FilePath $AppPath -ArgumentList $argumentText -WindowStyle Hidden | Out-Null
    $deadline = (Get-Date).AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 250
        $activeSocket = Get-NetTCPConnection -State Listen -LocalAddress $connection.address -LocalPort $Port -ErrorAction SilentlyContinue
    } while (-not $activeSocket -and (Get-Date) -lt $deadline)
    if (-not $activeSocket) { throw 'Host did not start. Check secretvault.log.' }
}
$processMetadata = Get-Content -LiteralPath (Join-Path $lanDirectory 'host-process.json') -Raw | ConvertFrom-Json
if ($activeSocket.OwningProcess -notcontains $processMetadata.pid) { throw 'Port belongs to another process; no changes made to that process.' }
$actualProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$processMetadata.pid)
if (-not $actualProcess -or $actualProcess.ExecutablePath -ne $AppPath) { throw 'Unexpected executable owns the LAN port.' }

# Narrow firewall rule only when firewall is enabled and this shell is elevated.
# Never change a network profile, disable firewall, or open the router.
$interfaceProfile = Get-NetConnectionProfile -InterfaceAlias $connection.interface
$profileName = switch ([int]$interfaceProfile.NetworkCategory) { 0 { 'Public' } 1 { 'Private' } 2 { 'Domain' } }
$firewall = Get-NetFirewallProfile -Name $profileName
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$ruleName = 'SecretVault-LAN-' + $Port
$firewallRuleAdded = $false
if ($firewall.Enabled -and -not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
    if ($isAdministrator) {
        New-NetFirewallRule -Name $ruleName -DisplayName ('SecretVault LAN HTTPS ' + $Port) -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -LocalAddress $connection.address -RemoteAddress $connection.network -InterfaceAlias $connection.interface -Profile $profileName -Program $AppPath | Out-Null
        $firewallRuleAdded = $true
    } else {
        Write-Warning ('Firewall is enabled. An administrator must allow TCP ' + $Port + ' only from ' + $connection.network + ' on ' + $connection.interface + '.')
    }
}

$shellObject = New-Object -ComObject WScript.Shell
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$startupDirectory = [Environment]::GetFolderPath('Startup')
$hostShortcut = $shellObject.CreateShortcut((Join-Path $desktopDirectory 'SecretVault - Host LAN.lnk'))
$hostShortcut.TargetPath = $AppPath
$hostShortcut.Arguments = '--lan-host --no-browser --port ' + $Port + ' --data-dir "' + $DataDirectory + '"'
$hostShortcut.WorkingDirectory = Split-Path -Parent $AppPath
$hostShortcut.Save()
$startupShortcut = $shellObject.CreateShortcut((Join-Path $startupDirectory 'SecretVault LAN Host.lnk'))
$startupShortcut.TargetPath = $AppPath
$startupShortcut.Arguments = $argumentText
$startupShortcut.WorkingDirectory = Split-Path -Parent $AppPath
$startupShortcut.Save()
$openShortcut = Join-Path $desktopDirectory 'SecretVault LAN.url'
('[InternetShortcut]' + "`r`nURL=" + $connection.url + "`r`n") | Set-Content -LiteralPath $openShortcut -Encoding ASCII

$toolsDirectory = Join-Path $lanDirectory 'host-tools'
New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null
$stopScript = @'
param([switch]$NoPause)
$ErrorActionPreference = 'Stop'
try {
    $lanDirectory = Split-Path -Parent $PSScriptRoot
    $metadataFile = Join-Path $lanDirectory 'host-process.json'
    if (-not (Test-Path -LiteralPath $metadataFile)) { throw 'Host is not running.' }
    $hostProcess = Get-Content -LiteralPath $metadataFile -Raw | ConvertFrom-Json
    $hostConnection = Get-Content -LiteralPath (Join-Path $lanDirectory 'connection.json') -Raw | ConvertFrom-Json
    $candidateProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$hostProcess.pid)
    $ownedSocket = Get-NetTCPConnection -State Listen -LocalAddress $hostConnection.address -LocalPort $hostConnection.port -ErrorAction SilentlyContinue
    if (-not $candidateProcess -or $candidateProcess.ExecutablePath -ne $hostProcess.executable -or $candidateProcess.CommandLine -notlike '*--lan-host*' -or $ownedSocket.OwningProcess -notcontains $hostProcess.pid) {
        throw 'Process identity does not match; refused to stop another process.'
    }
    Stop-Process -Id ([int]$hostProcess.pid) -ErrorAction Stop
    Write-Host 'Da dung SecretVault Host LAN. Du lieu van duoc giu.'
} catch { Write-Host $_.Exception.Message -ForegroundColor Yellow }
if (-not $NoPause) { Read-Host 'Nhan Enter de dong' }
'@
Set-Content -LiteralPath (Join-Path $toolsDirectory 'Stop-Host.ps1') -Value $stopScript -Encoding UTF8
$stopShortcut = $shellObject.CreateShortcut((Join-Path $desktopDirectory 'Dung SecretVault Host LAN.lnk'))
$stopShortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$stopShortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $toolsDirectory 'Stop-Host.ps1') + '"'
$stopShortcut.Save()
if ($ClientZipDestination) {
    Copy-Item -LiteralPath (Join-Path $lanDirectory 'SecretVault-LAN-Clients.zip') -Destination $ClientZipDestination -Force
}
$summary = [pscustomobject]@{
    url=$connection.url; network=$connection.network; hostPid=$processMetadata.pid; executable=$AppPath;
    startup=(Join-Path $startupDirectory 'SecretVault LAN Host.lnk'); clientZip=(Join-Path $lanDirectory 'SecretVault-LAN-Clients.zip');
    caThumbprint=$connection.caThumbprint; caTrusted=(Test-Path -LiteralPath ('Cert:\CurrentUser\Root\' + $connection.caThumbprint));
    firewallEnabled=[bool]$firewall.Enabled; firewallChanged=$firewallRuleAdded
}
$summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $lanDirectory 'setup-result.json') -Encoding UTF8
$summary | ConvertTo-Json
