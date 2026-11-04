# Bound the testing effort

A test can be reasonable on its own and still add little to a suite. The decision is about what it establishes beyond the checks you already have, including what it will cost to maintain.

Cadence plans that work before writing tests. The task's `Verify:` field records a short testing scope:

- The important observable outcomes and representative failures.
- What existing tests already establish.
- The smallest set of additional checks needed.
- What counts as sufficient evidence and where testing stops.

Fixtures, mocks and test infrastructure count toward the effort. If setup becomes disproportionate to the change, simplify the approach before building it.

## Plan around behavior

Suppose a CLI gains a command-line option that overrides a value in its configuration file. Existing tests already cover loading the file and rejecting invalid values. The change needs coverage of the override behavior. It doesn't automatically justify another configuration-loading suite or every permutation of unrelated options.

The planning question is:

> What plausible defect in supported behavior would this catch that existing tests would miss?

Use it to choose the checks. There's no table to complete for each test, and no fixed one-test-per-criterion rule. One check may establish several outcomes; a consequential behavior may need several checks.

## Assertions have to establish something

Expected results should come from the requirements or design, independently of the implementation being tested. Repeating the implementation's calculation in the assertion can reproduce the same mistake and still pass.

Test doubles can replace dependencies. They shouldn't replace the behavior the test claims to verify. A test that runs code without checking its result may improve the reported percentage while leaving the requirement unprotected.

For a bug fix, reuse an existing reproducer if it provides lasting regression coverage. Confirm that it fails for the defect and passes after the fix. There is no blanket requirement to manufacture a negative control for every test.

## Know when to finish

Once the agreed behavior is covered and the required suite and coverage gate pass, finish.

Expanding the work needs one of three things:

| Reason | What to do |
|---|---|
| A demonstrated defect | Add or reuse the smallest check that catches it. |
| An uncovered acceptance requirement | Establish that behavior with an automated check. |
| A measured coverage shortfall | Inspect the actual gap and add meaningful coverage. |

Another imaginable failure or an alternative way the code could have been written isn't enough. Reviewers follow the same rule; a review doesn't restart completed testing without that evidence.

If closing a real gap would materially exceed the planned effort, Cadence should report the tradeoff once. It shouldn't quietly grow the task or lower the threshold.

These scope rules guide the agents. CI enforces executable checks and coverage thresholds; it cannot prove that every additional test earned its place. The short testing scope makes the intended boundary visible in the plan.
