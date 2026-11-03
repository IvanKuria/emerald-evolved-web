#!/usr/bin/env bash
# Mac -> PC: replace the PC copy's source with the working tree. node_modules, the copied mGBA build and
# the PC's own logs/shots stay; everything else is removed first so deleted files don't linger there.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d)/pew.tgz
COPYFILE_DISABLE=1 tar czf "$T" --exclude node_modules --exclude .git --exclude dist --exclude shots --exclude public/mgba .
scp -q "$T" pc:pew.tgz
scp -q scripts/pc-unpack.ps1 pc:pc-unpack.ps1
ssh pc 'powershell -NoProfile -File C:\Users\ivank\pc-unpack.ps1'
