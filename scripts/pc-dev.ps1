# Starts the dev server on the PC, detached from the SSH session, bound to 0.0.0.0:5180.
# Optional first argument: "memory" runs the API against an in-memory store (DEV_STORE=memory);
# without it the API has no storage and the counter and registry stay hidden, as in production
# before the Upstash keys are added.
$dir = 'C:\Users\ivank\dev\poke-evolution-web'
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*poke-evolution-web*vite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2   # let the old server let go of dev.log, or the new one can't write it and exits
$store = if ($args[0] -eq 'memory') { 'memory' } else { '' }
Set-Content -Path "$dir\dev-start.cmd" -Encoding ascii -Value @(
  '@echo off',
  "cd /d $dir",
  "set DEV_STORE=$store",
  'npm run dev > dev.log 2>&1'
)
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "cmd /c $dir\dev-start.cmd" } | Out-Null
Start-Sleep -Seconds 8
Get-Content "$dir\dev.log" -Tail 8
