// Writes public/test/evotest-mutant.bps with our own encoder (src/lib/bps.ts).
// The test suite then applies it, and so does Flips (see DESIGN.md "Testing the patcher").
import { readFileSync, writeFileSync } from 'node:fs'
import { createBps } from '../src/lib/bps'
const src = readFileSync('tests/fixtures/evotest.gba')
const dst = readFileSync('tests/fixtures/evotest-mutant.gba')
const patch = createBps(src, dst, 'EVOTEST mutation: coat colour and size genes changed')
writeFileSync('public/test/evotest-mutant.bps', patch)
console.log('wrote public/test/evotest-mutant.bps,', patch.length, 'bytes')
