$ErrorActionPreference = 'Stop'
$base = $env:SCOTT_TEST_BASE_URL
if ([string]::IsNullOrWhiteSpace($base)) { $base = 'http://localhost/pork-farm/backend/api' }

function Assert-Status([string]$Url, [int]$Expected, [hashtable]$Headers = @{}) {
  $curlArgs = @('-sS', '-i', '-H', 'Accept: application/json')
  foreach ($header in $Headers.GetEnumerator()) { $curlArgs += @('-H', "$($header.Key): $($header.Value)") }
  $curlArgs += $Url
  $response = & curl.exe @curlArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Request failed for $Url (curl exit code $LASTEXITCODE). Is Apache running and is SCOTT_TEST_BASE_URL correct?"
  }
  $status = (($response -split "`r?`n") | Select-Object -First 1)
  if ($status -notmatch "HTTP/\S+ $Expected ") { throw "Expected HTTP $Expected from $Url but received $status" }
  Write-Output "PASS HTTP $Expected $Url"
}

Assert-Status "$base/products.php" 200
Assert-Status "$base/auth.php" 200
Assert-Status "$base/groups.php" 401
Assert-Status "$base/pig_photos.php" 401
Assert-Status "$base/litter_weights.php" 401
Assert-Status "$base/products.php" 403 @{ Origin = 'https://untrusted.example' }
Write-Output 'ALL SECURITY CHECKS PASSED'
