$ErrorActionPreference = "Stop"

$Repo = "maksimmanko-bit/buildcore-construction-pm"
$Branch = "main"
$Files = @(
  "README.md",
  "src/App.jsx",
  "src/styles.css",
  "supabase/schema.sql"
)

Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "BuildCore GitHub API push"
Write-Host "This bypasses broken git-remote-https.exe and does not save your token."
Write-Host ""
Write-Host "Token needs repository Contents: Read and write permission."
Write-Host ""

$SecureToken = Read-Host "Paste GitHub token" -AsSecureString
$Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
)

if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "Token is empty."
}

$Headers = @{
  Authorization          = "Bearer $Token"
  Accept                 = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent"           = "BuildCore-PM-Push"
}

function Invoke-GitHubJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [object]$Body = $null
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
  }

  $Json = $Body | ConvertTo-Json -Depth 20
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $Json
}

$BaseUrl = "https://api.github.com/repos/$Repo"
$Ref = Invoke-GitHubJson -Method GET -Uri "$BaseUrl/git/ref/heads/$Branch"
$ParentSha = $Ref.object.sha
$ParentCommit = Invoke-GitHubJson -Method GET -Uri "$BaseUrl/git/commits/$ParentSha"
$BaseTreeSha = $ParentCommit.tree.sha

$Tree = @()
foreach ($Path in $Files) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
  }

  Write-Host "Uploading blob: $Path"
  $Bytes = [IO.File]::ReadAllBytes((Join-Path (Get-Location) $Path))
  $Blob = Invoke-GitHubJson -Method POST -Uri "$BaseUrl/git/blobs" -Body @{
    content  = [Convert]::ToBase64String($Bytes)
    encoding = "base64"
  }

  $Tree += @{
    path = $Path.Replace("\", "/")
    mode = "100644"
    type = "blob"
    sha  = $Blob.sha
  }
}

$NewTree = Invoke-GitHubJson -Method POST -Uri "$BaseUrl/git/trees" -Body @{
  base_tree = $BaseTreeSha
  tree      = $Tree
}

$NewCommit = Invoke-GitHubJson -Method POST -Uri "$BaseUrl/git/commits" -Body @{
  message = "Connect app to Supabase data flow"
  tree    = $NewTree.sha
  parents = @($ParentSha)
}

Invoke-GitHubJson -Method PATCH -Uri "$BaseUrl/git/refs/heads/$Branch" -Body @{
  sha   = $NewCommit.sha
  force = $false
} | Out-Null

Write-Host ""
Write-Host "Pushed to GitHub successfully."
Write-Host "Commit: $($NewCommit.sha)"
Write-Host "Actions: https://github.com/$Repo/actions"
