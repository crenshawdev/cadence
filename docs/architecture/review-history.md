# Historical review origin

`read_pause_origin` reads saved bytes through a filesystem interface with no
write operation. A fix-shaped finding with no dispatch returns exactly
`{"provenance":"historical","dispatch":null,"verified":false}`. The fixture
`tests/fixtures/phase9/historical-pause.json` is independently authored old input.

Use the existing grouped query tool:

- `{"operation":"review-original","original":"historical:<relative-path>"}`
- `{"operation":"review-consumer","consumer":"historical-pause","attempt":"<relative-path>","supplied":null}`

The historical adapter's path is relative to the bound planning root. It refuses
absolute paths, traversal and symlink escapes. The response is a review-original
envelope containing `origin` and exact `raw_bytes`. The path is a historical
read address, not a modern fire, attempt or dispatch ID. No file is rewritten,
no saved contract is upgraded and no H3 observation is backfilled.

Unknown or older schema bytes remain readable with verified false, an explicit
unrecognized-historical-schema diagnostic and an identified-new-review recovery
path. An existing dispatch field is retained as historical data; it is never
validated as observed participation. Phase 10 owns recovery decisions and
settlement. A newly identified review cannot rewrite the old origin or silently
clear its obligation.

Modern pauses enter `review-admit` with caller pause, ordinary risk_surface and
an authored staged-tree target with null head. Shared admission retains the
occurrence, material and roster before issuing work. Its response includes the
ordinary delivery_request fields, and subsequent review-observation/review-return
operations persist actual observation and exact original bytes. Modern findings
use failure_scenario; they never become a historical fix field. The existing
unversioned internal pause entry and its old decoder remain historical.
Phase 10 D-70 owns the mandatory settlement-clearance cutover; this adapter
provides no modern raw-result clearance.

Direct module check, from the repository root:
`TMPDIR=/tmp CARGO_NET_OFFLINE=true RUSTC_WRAPPER= cargo test -p cadence --test phase9_history history_`.
The historical live/operator episode and the other MANUAL.md items remain
unverified by this test.
