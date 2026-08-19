# A worked example

**One small CLI tool, from the first question to the publish decision.**

Say you're starting a small CLI tool. You run `/cad-new-project` and answer the
questions, what it is, why it exists, who it's for, what done looks like.
Cadence writes `PROJECT.md`, `REQUIREMENTS.md`, and a phased `ROADMAP.md` into
`.planning/`, and sets a state cursor at phase 1. Nothing is in the conversation
that isn't also on disk.

Then you work one phase at a time:

```
/cad-context 1     # lock the decisions and acceptance criteria for phase 1
/cad-plan 1        # turn phase 1 into a checkable PLAN.md; the plan review fires here
/cad-execute 1     # build it, one atomic commit per task
/cad-verify 1      # confirm phase 1 delivered what it promised, recorded in UAT.md
```

Between commands you `/clear`, every one, not just the phase boundaries. The
window empties and you lose nothing, because each command reads `.planning/` and
git back into context, and a window carried across commands is spend without
information. Even a review still in flight survives the cut: an advisory
reviewer writes its own findings file and its own trace line, so the session
that fired it can end freely. The first external project run went through the
whole cycle one command per session. Run `/cad-progress` after a clear and it
tells you that phase 1 is verified and phase 2 is next, then you plan phase 2
the same way. When you hit a wall mid-build, `/cad-debug` runs the scientific
method with hypotheses that survive a clear, and `/cad-capture` parks a stray
todo or idea without derailing the phase you're in.

When the phases that make up a release are done, `/cad-milestone` audits that
nothing was silently dropped, bumps the version, prunes the completed phases
from the live roadmap, and evolves the docs for the next cycle. It also reads
the run record back at you: `/cad-suggest` turns the milestone's own trace into
evidence-backed retune suggestions, a gate whose fires kept coming back empty, a
role that never needed its escalation, each named with its config key, the value
in force, the direction to move it and the target value where the record can
price one, and it ends by offering to route the tweaks you accept to
`/cad-config` rather than writing any of them itself. To publish, `/cad-land`
asks how you want to ship, push, MR or PR, tag, or leave it local, with no
preselected default, and does exactly that. Before it asks, it names the issues
this branch's commits reference and which of them are still open on the host
your origin points at, so you decide to ship knowing what the work did and did
not answer; it closes nothing, and `git.issue_check: false` turns the report
off.

That's the whole shape of it: define once, then loop `context -> plan -> execute
-> verify` per phase, clearing aggressively, until the milestone is ready to
cut.
