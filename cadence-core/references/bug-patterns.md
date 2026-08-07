# Bug patterns

Read before the first hypothesis, never after. `/cad-debug` step 1 (Hypothesize)
consults this list so the candidate set starts from what actually breaks rather
than from the first plausible story about the symptom in hand.

Ordered by observed frequency, most common first. Each entry is one pattern, the
SIGNATURE that suggests it, and the CHEAPEST check that discriminates it - the
check is the point: it either rules the pattern in or out in one step, and a
pattern you cannot cheaply discriminate does not belong at the top of a
hypothesis list.

Use it as a filter, not a script: a pattern whose signature matches the symptom
enters Hypotheses with its check already named. Matching nothing here is
information too - it means the bug is specific to this code, and the hypotheses
should come from reading it.

1. **The code that ran is not the code you are reading.** Stale build, an older
   process still up, a cached module, an installed copy shadowing the repo, the
   wrong branch or worktree. *Signature:* a fix changes nothing at all, or the
   error cites a line that does not match the file. *Check:* print an identity
   from inside the running path - resolved filename, version, mtime - and
   compare it to the file you edited.

2. **The input is not what you think it is.** Trailing whitespace, CRLF, retained
   quotes, a wrapped or stringified value, an encoding difference. *Signature:*
   the same function is correct in a test and wrong on live data. *Check:* dump
   the RAW value at the boundary (bytes, or `JSON.stringify`), never the parsed
   or printed reading of it.

3. **An error was swallowed.** A bare `catch`, a `|| default`, an ignored return
   code. The failure you see is the fallback behaving correctly. *Signature:* a
   plausible but wrong result with no error anywhere. *Check:* grep the path for
   catch/default/`?.`/`??` and make the catch speak once.

4. **The value is overridden downstream.** Config layering, a later assignment, a
   default applied after your write, an env var beating the file. *Signature:*
   the change has no effect where it is written, and the written value is
   correct. *Check:* print the EFFECTIVE value at the consumer with its source,
   not the value at the setter.

5. **Order or timing.** Read before write, init order, a listener attached after
   the event fires, an unawaited promise. *Signature:* intermittent, or passes
   alone and fails in a suite, or fails only on the fast/slow machine.
   *Check:* log the suspect pair with sequence numbers, or serialize them once
   and see if the symptom disappears.

6. **A falsy-but-valid value.** `0`, `""`, `false`, `null` vs `undefined`, an
   empty array, taken as absent by a truthiness test. *Signature:* the bug exists
   only for the zero/empty/first case. *Check:* run exactly the `0` and `""`
   inputs.

7. **Boundaries.** Off-by-one, inclusive vs exclusive ranges, the empty and
   single-element cases, exactly-at-the-limit. *Signature:* correct in the middle,
   wrong at the first or last element or at a cap. *Check:* run empty, one, and
   limit-exactly.

8. **Shared mutable state.** A module-level cache, a fixture reused across cases,
   a global mutated by a neighbour. *Signature:* order-dependent failures; passes
   in isolation. *Check:* run the failing case alone, then run the suite in
   reverse.

9. **The environment differs.** cwd, PATH, uid, TZ, locale, a missing env var, a
   different runtime version. *Signature:* works in your shell, fails under the
   tool, the hook, CI, or the editor. *Check:* print cwd, the relevant env keys
   and the interpreter path FROM INSIDE the failing process.

10. **The symptom is downstream of the real failure.** What crashed is the second
    thing to go wrong; the first was absorbed or reported as a nullish value.
    *Signature:* the stack points at code that has not changed and is otherwise
    correct. *Check:* walk one frame up and find the first value that is already
    wrong.

11. **A recent change did it.** *Signature:* it worked, and nothing in this file
    changed. *Check:* `git log -S<symbol>` on the symbol in the failing path, or
    bisect the smallest window you can name - one command before any theory.
