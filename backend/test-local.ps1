# LOCAL TESTING ONLY. Builds a throwaway database from the web project's
# migrations (which include the mobile API, 20261026000100_mobile_api.sql)
# + seed (+ demo data), then runs the contract tests in this folder.
#   ./backend/test-local.ps1 [-Port 54329] [-Database cas_mobile_test] [-NoDemo]
param(
  [int]$Port = 54329,
  [string]$Database = "cas_mobile_test",
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [string]$Webapp = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "college-attendance-system"),
  [switch]$NoDemo
)
$ErrorActionPreference = "Stop"
if ($Database -in @("cas_dev", "postgres")) { throw "Refusing to recreate $Database" }

& (Join-Path $Webapp "supabase\tests\run-local.ps1") -Port $Port -Database $Database -PgBin $PgBin -Demo:(-not $NoDemo)

$psql = Join-Path $PgBin "psql.exe"
$common = @("-U", "postgres", "-h", "localhost", "-p", "$Port", "-w", "-v", "ON_ERROR_STOP=1", "-q", "-d", $Database)
if ($NoDemo) { Write-Host "done: $Database (contract tests need demo data)"; return }

$tests = @((Join-Path $Webapp "supabase\tests\test_00_helpers.sql")) + (Get-ChildItem (Join-Path $PSScriptRoot "tests") -Filter *.sql | Sort-Object Name | ForEach-Object FullName)
$failed = $false
foreach ($file in $tests) {
  $out = & $psql @common -o NUL -f $file 2>&1
  $out | Where-Object { "$_" -match "PASS|FAIL|ERROR" } | ForEach-Object { Write-Host "    $_" }
  if ($LASTEXITCODE -ne 0) { $failed = $true; Write-Host "  FAILED  $(Split-Path -Leaf $file)" } else { Write-Host "  ok  $(Split-Path -Leaf $file)" }
}
if ($failed) { throw "contract tests failed" }
Write-Host "done: $Database"
