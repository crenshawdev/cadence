PLAN PARTIAL
Plan: .planning/phases/1/PLAN-1.md
Tasks: 2 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - Make every `## ` heading scan in the module fence-aware | 73aa7bb | Added module-private `fenceScanner`/`fenceMask`, gated `sectionEnd`'s next-heading scan, all four `prependChangelogEntry` anchor scans, and `promoteUnreleased`'s Unreleased/release-heading locators, plus `releaseSectionEmpty`'s heading locator, on fence state. Two new tests added (fence-only prependChangelogEntry, and the scaffold-then-promote compose case). 44/44 tests pass. |
| 2 - Report a heading-only release section as empty | c68f0a7 | `releaseSectionEmpty`'s content loop now skips blank lines and `###`/`####` subheadings only; any other non-blank line (including bare prose) is still content. Two new tests: heading-only body -> `sectionEmpty:true`, prose-only body -> `sectionEmpty:false`. 46/46 tests pass, committed `sectionEmpty` test unmodified and green. |
Deviations: none
Open items: none
