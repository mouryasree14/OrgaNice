# Start OrgaNice PostgreSQL 18 server
$pgDir = "c:\Users\moury\OrgaNice\.pgdata"
$status = & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D $pgDir status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting PostgreSQL 18 server on port 5433..."
    & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D $pgDir -l "$pgDir\server.log" start
} else {
    Write-Host "PostgreSQL 18 server is already running on port 5433."
}
