param(
  [Parameter(Mandatory = $true)]
  [string]$BaselineInstaller,

  [Parameter(Mandatory = $true)]
  [string]$BundleRoot,

  [string]$ProductName = '智能代账系统',
  [string]$AppIdentifier = 'com.accounting.agent',
  [string]$BaselineVersion = '0.9.0',
  [string]$TargetVersion = '1.0.0'
)

$ErrorActionPreference = 'Stop'

function Invoke-CheckedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [string[]]$ArgumentList = @()
  )

  $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -Wait -PassThru
  if ($process.ExitCode -notin @(0, 1641, 3010)) {
    throw "Process failed with exit code $($process.ExitCode): $FilePath $($ArgumentList -join ' ')"
  }
}

function Get-ProductEntry {
  $registryPaths = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )

  Get-ItemProperty -Path $registryPaths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq $ProductName } |
    Select-Object -First 1
}

function Wait-ProductEntry {
  param(
    [string]$ExpectedVersion,
    [switch]$Absent
  )

  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    $entry = Get-ProductEntry
    if ($Absent) {
      if (-not $entry) {
        return $null
      }
    } elseif ($entry -and $entry.DisplayVersion -eq $ExpectedVersion) {
      return $entry
    }
    Start-Sleep -Seconds 1
  }

  if ($Absent) {
    throw "$ProductName remained registered after uninstall"
  }
  $actual = Get-ProductEntry
  $actualVersion = if ($actual) { $actual.DisplayVersion } else { '<not installed>' }
  throw "$ProductName expected version $ExpectedVersion but found $actualVersion"
}

function Invoke-RegisteredUninstall {
  param(
    [Parameter(Mandatory = $true)]
    $Entry
  )

  $command = [string]$Entry.UninstallString
  if ([string]::IsNullOrWhiteSpace($command)) {
    throw "$ProductName does not expose an uninstall command"
  }

  if ($command.StartsWith('"')) {
    $closingQuote = $command.IndexOf('"', 1)
    if ($closingQuote -lt 2) {
      throw "Unable to parse uninstall command: $command"
    }
    $executable = $command.Substring(1, $closingQuote - 1)
    $arguments = $command.Substring($closingQuote + 1).Trim()
  } else {
    $parts = $command.Split(' ', 2)
    $executable = $parts[0]
    $arguments = if ($parts.Length -gt 1) { $parts[1] } else { '' }
  }

  $argumentList = @()
  if (-not [string]::IsNullOrWhiteSpace($arguments)) {
    $argumentList += $arguments
  }
  $argumentList += '/S'
  Invoke-CheckedProcess -FilePath $executable -ArgumentList $argumentList
}

function Assert-DataSentinel {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Stage
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Application data was removed during $Stage"
  }
  $content = Get-Content -LiteralPath $Path -Raw
  if ($content.Trim() -ne 'release-data-sentinel') {
    throw "Application data changed unexpectedly during $Stage"
  }
}

if (-not (Test-Path -LiteralPath $BaselineInstaller -PathType Leaf)) {
  throw "Baseline NSIS installer not found: $BaselineInstaller"
}

$finalNsis = Get-ChildItem -LiteralPath (Join-Path $BundleRoot 'nsis') -Filter "*$TargetVersion*.exe" -File |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
$finalMsi = Get-ChildItem -LiteralPath (Join-Path $BundleRoot 'msi') -Filter "*$TargetVersion*.msi" -File |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
if (-not $finalNsis) {
  throw "Final NSIS installer for $TargetVersion was not found"
}
if (-not $finalMsi) {
  throw "Final MSI installer for $TargetVersion was not found"
}

$dataDirectory = Join-Path $env:APPDATA $AppIdentifier
$sentinelPath = Join-Path $dataDirectory 'release-data-sentinel.txt'

Write-Host "Installing NSIS baseline $BaselineVersion"
Invoke-CheckedProcess -FilePath $BaselineInstaller -ArgumentList @('/S')
$baselineEntry = Wait-ProductEntry -ExpectedVersion $BaselineVersion

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
Set-Content -LiteralPath $sentinelPath -Value 'release-data-sentinel' -Encoding utf8NoBOM
Assert-DataSentinel -Path $sentinelPath -Stage 'baseline installation'

Write-Host "Upgrading NSIS installation to $TargetVersion"
Invoke-CheckedProcess -FilePath $finalNsis.FullName -ArgumentList @('/S')
$targetEntry = Wait-ProductEntry -ExpectedVersion $TargetVersion
Assert-DataSentinel -Path $sentinelPath -Stage 'NSIS upgrade'

Write-Host 'Uninstalling NSIS package'
Invoke-RegisteredUninstall -Entry $targetEntry
Wait-ProductEntry -Absent | Out-Null
Assert-DataSentinel -Path $sentinelPath -Stage 'NSIS uninstall'

Write-Host 'Installing MSI package'
$msiExecutable = Join-Path $env:SystemRoot 'System32\msiexec.exe'
Invoke-CheckedProcess -FilePath $msiExecutable -ArgumentList @(
  "/i `"$($finalMsi.FullName)`" /qn /norestart"
)
Wait-ProductEntry -ExpectedVersion $TargetVersion | Out-Null
Assert-DataSentinel -Path $sentinelPath -Stage 'MSI installation'

Write-Host 'Uninstalling MSI package'
Invoke-CheckedProcess -FilePath $msiExecutable -ArgumentList @(
  "/x `"$($finalMsi.FullName)`" /qn /norestart"
)
Wait-ProductEntry -Absent | Out-Null
Assert-DataSentinel -Path $sentinelPath -Stage 'MSI uninstall'

Write-Host "Windows installer lifecycle passed: NSIS $BaselineVersion -> $TargetVersion, MSI install/uninstall, app data retained at $dataDirectory"
