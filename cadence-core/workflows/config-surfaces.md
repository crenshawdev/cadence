# cad-config risk surfaces (cold branch)

Loaded from config.md's **Risk surfaces** arm.

## Risk surfaces (`--surfaces`)

The one configuration question Cadence asks on its own - which of the eight risk
surfaces the blocking `risk_surface` trigger fires on - reached deliberately,
with the evidence beside it, and answerable again after the repository has
changed shape. The first fire asks it once
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md`); this arm
is the way back to it, and re-entering it must never cost the user the answer
they already gave.

1. Read the effective answer through `workflows/config.md`'s **Validation seam**:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get review.triggers.risk_surface.surfaces
   ```

   Never a raw read of `.planning/config.json` for a workflow value: this read is
   none of the three exceptions `workflows/config.md`'s **Validation seam**
   lists. A `null` value means nobody has answered and all eight stand.

2. Scan the structure for what it evidences NOW:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" detect-surfaces --root . --answered <a,b,c>
   ```

   `--answered` carries step 1's answered set, comma-separated. DROP the flag
   entirely when step 1 returned `null`: the flag's absence is what says nobody
   has answered, and a `--answered` with nothing usable after it is refused.

3. Show the two SIDE BY SIDE before asking anything - the answered set, and each
   category the envelope's `evidenced` names with its `signal` string - and call
   out every evidenced category the answered set does not contain. That gap is
   the whole reason this arm exists: a project that added Stripe six months
   after answering has no other way to see it. When the scan reports
   `inconclusive: true`, say plainly that the structure evidences nothing either
   way rather than reporting it as a clean bill - silence is never absence
   (D-14), and the recommendation stays all eight.

4. Ask through the ask-user seam
   (`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`),
   rendering the envelope's `options` array in the order it arrives: at most
   four options per
   question, the first labelled `(recommended)`, and that label is a display
   convention and never a pre-selection - the user still chooses and the seam
   still blocks. Each option's own `reason` is what it states beside it, and
   this step composes no options of its own. Carry the LEGEND with the question:
   read the eight one-line category definitions from
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` and present
   them verbatim as the question's context. This arm is the one a user reaches
   deliberately, so it is the one most likely to be read by someone who does not
   already know what `api_contract` means, and it is the path that passes the
   legend nowhere else. Say plainly that keeping the
   current answer and declining are both valid answers.

5. Write ONLY on an explicit pick, through `workflows/config.md`'s **Validation seam**,
   at the repo layer:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set 'review.triggers.risk_surface.surfaces=["secrets","destructive"]'
   ```

   A decline calls no `set` and edits no file, so `.planning/config.json` stays
   byte-identical and the existing answer survives. Nothing on this arm writes a
   default and nothing re-asks on its own.
