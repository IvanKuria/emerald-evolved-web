# Starts the dev server on the PC, detached from the SSH session, bound to 0.0.0.0:5180.
$dir = 'C:\Users\ivank\dev\poke-evolution-web'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*poke-evolution-web*vite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$env:PRESENCE_DEMO = $args[0]
$cmd = "cmd /c cd /d $dir && set PRESENCE_DEMO=$($args[0]) && npm run dev > dev.log 2>&1"
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd } | Out-Null
Start-Sleep -Seconds 6
Get-Content "$dir\dev.log" -Tail 15
