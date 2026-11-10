param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
$signer = $null

if ($signature.SignerCertificate) {
  $signer = $signature.SignerCertificate.Subject
}

[pscustomobject]@{
  Status = $signature.Status.ToString()
  StatusMessage = $signature.StatusMessage
  Signer = $signer
} | ConvertTo-Json -Compress
