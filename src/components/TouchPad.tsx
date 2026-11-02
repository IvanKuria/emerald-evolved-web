import { useRef } from 'react'
import type { Emulator } from '../lib/emulator'

/* ------------------------------------------------------------------
   Touch controls, for phones and tablets.

   Not a drawing of a Game Boy: plain ink shapes on the page, laid out
   where thumbs are. The D-pad is one surface that reads the angle of
   the thumb, so you can roll from Up to Right without lifting -- and
   it gives diagonals, which Emerald's bike needs. Every press is a
   pointer event with capture, so a thumb that slides off a button
   still releases it.
------------------------------------------------------------------ */

const DIRS = ['Right', 'Down', 'Left', 'Up'] as const

function Dpad({ emu }: { emu: Emulator }) {
  const held = useRef(new Set<string>())
  const set = (next: Set<string>) => {
    for (const d of held.current) if (!next.has(d)) emu.buttonUnpress(d)
    for (const d of next) if (!held.current.has(d)) {
      emu.buttonPress(d)
      navigator.vibrate?.(6)
    }
    held.current = next
  }
  const read = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - (r.left + r.width / 2)
    const y = e.clientY - (r.top + r.height / 2)
    const next = new Set<string>()
    if (Math.hypot(x, y) > r.width * 0.12) {
      const a = (Math.atan2(y, x) * 180) / Math.PI // 0 = right, 90 = down
      DIRS.forEach((d, i) => {
        const diff = Math.abs(((a - i * 90 + 540) % 360) - 180)
        if (diff < 67.5) next.add(d)
      })
    }
    set(next)
  }
  return (
    <div
      className="relative h-36 w-36 touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        read(e)
      }}
      onPointerMove={(e) => e.buttons && read(e)}
      onPointerUp={() => set(new Set())}
      onPointerCancel={() => set(new Set())}
      role="group"
      aria-label="Direction pad"
    >
      <div className="absolute top-1/2 left-0 h-12 w-full -translate-y-1/2 rounded-[14px] bg-ink shadow-lift" />
      <div className="absolute top-0 left-1/2 h-full w-12 -translate-x-1/2 rounded-[14px] bg-ink" />
    </div>
  )
}

function Key({ emu, name, className, children }: { emu: Emulator; name: string; className: string; children: React.ReactNode }) {
  return (
    <button
      className={`grid touch-none place-items-center select-none ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        emu.buttonPress(name)
        navigator.vibrate?.(6)
      }}
      onPointerUp={() => emu.buttonUnpress(name)}
      onPointerCancel={() => emu.buttonUnpress(name)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={name}
    >
      {children}
    </button>
  )
}

export function TouchPad({ emu }: { emu: Emulator }) {
  const shoulder = 'h-10 w-24 rounded-pill bg-paper-sink text-body font-bold text-ink active:bg-paper-deep'
  const face = 'h-16 w-16 rounded-full bg-ink text-lead font-bold text-white shadow-lift active:scale-95 transition-transform'
  const small = 'h-8 w-20 rounded-pill bg-paper-sink text-micro font-bold text-ink-soft active:bg-paper-deep'
  return (
    <div className="mt-2 select-none">
      <div className="flex justify-between">
        <Key emu={emu} name="L" className={shoulder}>L</Key>
        <Key emu={emu} name="R" className={shoulder}>R</Key>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Dpad emu={emu} />
        <div className="relative h-36 w-40">
          <Key emu={emu} name="B" className={`${face} absolute bottom-2 left-0`}>B</Key>
          <Key emu={emu} name="A" className={`${face} absolute top-2 right-0`}>A</Key>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <Key emu={emu} name="Select" className={small}>Select</Key>
        <Key emu={emu} name="Start" className={small}>Start</Key>
      </div>
    </div>
  )
}
