$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

Write-Host "BuildCore Construction PM -> GitHub" -ForegroundColor Cyan
Write-Host "Repository: https://github.com/maksimmanko-bit/buildcore-construction-pm"
Write-Host ""
Write-Host "Paste a GitHub Personal Access Token. It will be hidden while typing." -ForegroundColor Yellow
Write-Host "Required permission for this repository: Contents = Read and write."
Write-Host ""

$secureToken = Read-Host "GitHub token" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

  if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Token is empty."
  }

  git remote remove origin 2>$null
  git remote add origin "https://github.com/maksimmanko-bit/buildcore-construction-pm.git"
  git branch -M main

  $credential = @(
    "protocol=https",
    "host=github.com",
    "username=maksimmanko-bit",
    "password=$token",
    ""
  ) -join "`n"

  $credential | git credential approve

  Write-Host ""
  Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
  git push -u origin main

  if ($LASTEXITCODE -ne 0) {
    throw "git push failed."
  }

  Write-Host ""
  Write-Host "Done:" -ForegroundColor Green
  Write-Host "https://github.com/maksimmanko-bit/buildcore-construction-pm"
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  Remove-Variable token -ErrorAction SilentlyContinue
}
