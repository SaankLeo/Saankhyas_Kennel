---
title: "Building Mocker: What I Learned Writing a CPU Emulator"
date: 2025-06-01
description: "Notes on building a CPU emulator from scratch in C++ — registers, pipelines, and the weird gaps in my understanding."
collections: ["posts"]
tags: ["systems", "C++", "emulation"]
---

# The Emulator Rabbit Hole

Mocker was supposed to be a CPU emulator

Then I wanted to run two programs.
Then I wanted them to share memory.
Then I wanted them to stop fighting.
Then I wanted them to ask the kernel for things.
Then I wanted the kernel to interrupt them whenever it felt like it.

Every time I thought I was done, another problem appeared. Solving it usually meant reinventing something that had already been solved decades ago.

I used to look at things like privilege levels, schedulers, timer interrupts, memory protection and think, "surely there's an easier way to do this." I kept hoping I could ignore the problem and that it'd somehow work itself out buttt it didn't. So here's what actually happened, in order, with the parts that made me want to throw my laptop. Repo's here if you want to poke at it: github.com/SaankLeo/Mocker

Phase 0: A calculator pretends to be a CPU

I started with 8 registers, separate code and data memory, a fake instruction format `[opcode, op1, op2, op3]`, and a fetch-decode-execute loop:

```c
instruction = codeMemory[PC];
opcode = instruction.opcode;
// execute
PC = PC + 4;
```

There's no magic in `PC = PC + 4;` my instructions are 4 bytes wide, so the CPU just moves to the next one. That's it.

Once branching showed up, I had zero flags and could finally write a loop. Felt like a proud parent watching R0 count down from 5 to 1 because JNZ kept sending the counter backwards. Low bar, I know. Didn't care.

Then I bolted on a two pass assembler so I could write `loop` and `done` instead of hardcoding the addresses. First pass builds a symbol table and second, patches the jumps.

Phase 1: Switching to RISC-V and immediately regretting the encoding

Custom ISA was comfortable because I made the rules. My senior Prawns (the G) suggested I stop making up my own ISA and look at RISC-V instead.

Turns out a real instruction isn't four friendly slots, it's one 32-bit number where every single bit means something and you have to rip it apart with bitwise math like a raccoon going through a trash can. Every instruction is now a single 32-bit word, and getting from `add x3, x1, x2` to `0x002081B3` means packing six different bit fields into the right slots:

```c
opcode = insn & 0x7F;
rd     = (insn >> 7) & 0x1F;
rs1    = (insn >> 15) & 0x1F;
```

The annoying part wasn't the R-type format (that one's actually pretty clean). It was realizing `ADD` and `SUB` share the same encoding except for one field. Get that wrong and you've implemented a completely different instruction.

Then came sign extension. A 12-bit immediate that somehow has to become a 32-bit negative number. Forget to sign-extend a branch offset and suddenly your program counter is off in another postcode. I spent way too long staring at a PC that was clearly haunted.

`x0` also has to be hardwired to zero, which thankfully boiled down to one gloriously boring line:

```c
if (rd != 0)
    registers[rd] = result;
```

Tiny change, but now writes to `x0` simply disappear, exactly like real RISC-V hardware.

Phase 2: One CPU, then three

I wanted multiple programs running at once, so I added **harts** . RISC-V's term for a hardware thread. Each one gets its own register file and program counter, and all of them point at one shared `Memory` object. That's a simplified SMP model: multiple execution contexts on a single shared address space.
Sharing memory means something has to decide whose turn it is to run. I implemented a round-robin scheduler since its dumboclat :

```c
hart 0 runs a quantum → hart 1 runs a quantum → hart 2 runs a quantum → repeat
```

I ran a memory writer, a factorial calculator, and a Fibonacci generator concurrently and pulled the scheduler stats afterward. Factorial alone accounted for most of total instructions executed, a compute-heavy program just runs more instructions per turn cycle. First point where the system's behavior wasn't something I'd fully predicted going in.

Phase 3: Shared memory means shared blast radius

Multiple harts on one memory space means nothing stops hart 2 from just overwriting hart 0's code. Not even on purpose, one bad pointer and it's gone:

```c
lui  x1, 0x3
sw   x0, 0(x1)   ; hart 0's code just got zeroed
```

So now every memory access has to pass a bouncer first :

```c
bool isValidAddress(uint32_t addr, Hart& hart) {
    return addr >= hart.baseAddress &&
           addr < hart.baseAddress + hart.regionSize;
}
```

Say no and you get a fault instead of silently trashing someone else's memory. This is basically what an MMU does in real hardware, I just did it with a plain range check instead of page tables.

Here's what that boundary looks like:

!image1.png

Phase 4: User code doesn't get to do whatever it wants

Bounds checks stop accidental mistakes. They don't stop a program from deciding it's the kernel. So I split everything into two tiers: M-mode, which can do anything, and U-mode, which can barely do anything and has to *ask* for the rest.

The asking mechanism is one instruction, `ecall`. The CPU writes down where it was (`mepc`), why it stopped (`mcause`), jumps to the kernel's handler (`mtvec`), kernel does the favor, `mret` hands control back like nothing happened:

```c
mepc   = pc
mcause = reason
pc     = mtvec        ; go handle it
...
mret                  ; pc = mepc, back to U-mode
```

Here's the round trip:

!image2.png

Once that existed, syscalls were basically free — `PRINT_INT`, `EXIT`, `YIELD`, `SEND`, `RECV` are all just numbers the handler switches on.

Phase 5: The kernel needed the power to be rude

Without help, the kernel only gets control back if a program *chooses* to give it back. That doesn't survive contact with this:

```c
loop:
    jal x0, loop
```

That's the whole machine, gone, forever. Nothing else ever runs again because nothing is forcing this hart to stop.

Fix: a timer that doesn't ask permission. Every so often, no matter what's running, the kernel barges in and takes the CPU back anyway:

```c
globalTicks++;
if (globalTicks % TIMER_INTERVAL == 0)
    deliverTimerInterrupt(hart);   // it does not get a vote
```

Rude, but this is exactly how every real scheduler guarantees it gets the CPU back even from code that never wants to give it up.

Here's the handoff:

!image3.png

Phase 6: Now they're isolated AND lonely :(

Locking everything down meant the harts couldn't talk to each other either, which is a problem when the whole point was running them together. So: mailboxes. One queue per hart, only the kernel can touch it, programs send and receive through syscalls instead of poking each other's memory directly:

```c
void handleSend(Hart& sender) {
    Message msg = { sender.id, sender.registers[A1] };
    messageQueues[sender.registers[A0]].push(msg);
    if (harts[target].state == WAITING)
        harts[target].state = RUNNING;
}
```

 Scheduler skips you every round like you don't exist, right up until someone actually sends you something, at which point you snap back to RUNNING like you weren't just ghosted for 40 scheduler cycles

This took about 3–4 months on and off. Every problem I hit turned out to be an operating systems problem with a solution that had already existed for decades. None of it really made sense until I built the wrong version first.

I started out writing an emulator. Somewhere along the way it picked up a scheduler, privilege levels, traps, IPC and memory protection. At this point I'm just waiting to find out what else I've accidentally signed myself up for. The repo's still alive so I guess I'll find out eventually 0-0 

```c
Mocker today: RV32I decoder, assembler, 3 concurrent harts, 
   round-robin scheduler, timer interrupts, traps, syscalls, IPC, 
   memory protection, U/M modes

   Not yet: paging, virtual memory, ELF loading, cache, pipeline
```