#!/usr/bin/env bash
# Mac -> PC: ship the working tree (no node_modules) and unpack it over the PC copy.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d)/pew.tgz
COPYFILE_DISABLE=1 tar czf "$T" --exclude node_modules --exclude .git --exclude dist --exclude shots --exclude public/mgba .
scp -q "$T" pc:pew.tgz
ssh pc 'tar -xzf C:\Users\ivank\pew.tgz -C C:\Users\ivank\dev\poke-evolution-web'
