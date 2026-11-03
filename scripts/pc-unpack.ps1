# Run on the PC by sync-pc.sh: clear the old source (keeping node_modules, the mGBA copy, the lockfile,
# shots and logs) and unpack the new tarball over it.
$d = 'C:\Users\ivank\dev\poke-evolution-web'
$keep = @('node_modules', 'public', 'shots', 'dev.log', 'package-lock.json')
Get-ChildItem $d -Force | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem "$d\public" -Force | Where-Object { @('mgba', 'patch') -notcontains $_.Name } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
tar -xzf C:\Users\ivank\pew.tgz -C $d
