// Unit tests for lib/redact-url.mjs (EXP-01, AC8). Pure function, no fixtures:
// every input here is a REAL message, measured 2026-08-13 on git 2.55.0 by
// pointing a fixture repo's remote at each transport and running the publish
// seam, so an arm cannot go green against a message git never emits.
//
// Every arm asserts BOTH halves: the credential substring is gone, AND the text
// a reader needs to act on the failure - the host, the path, git's own wording -
// survives. A redactor that returned the empty string would pass the first half
// alone, and it would make `detail` useless for the thing it exists for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactUrl, redactCredentials, REDACTION_MARK } from './lib/redact-url.mjs';

/** The credential halves every arm below asserts are absent. */
const USER = 'cad';
const SECRET = 's3cr3t-tok';

/** @param {string} out @param {string} label */
function assertClean(out, label) {
  assert.equal(out.includes(SECRET), false, `${label}: the secret survived: ${out}`);
  assert.equal(out.includes(`${USER}:`), false, `${label}: the userinfo survived: ${out}`);
  assert.ok(out.length > 0, `${label}: redacted to nothing`);
}

test('redactUrl: the git:// form, which git does NOT anonymize', () => {
  // Measured: `git remote add origin git://cad:s3cr3t-tok@host.invalid/r.git`
  // then push - git prints the userinfo verbatim as part of the host it looked
  // up. This is the form a credential actually reaches the envelope through.
  const msg = 'Command failed: git -C /tmp/fx push --set-upstream -- origin '
    + 'refs/heads/cadence/v9.9.9:refs/heads/cadence/v9.9.9\n'
    + 'fatal: unable to look up cad:s3cr3t-tok@host.invalid (port 9418) (Name or service not known)\n';
  const out = redactUrl(msg);
  assertClean(out, 'git://');
  assert.ok(out.includes('host.invalid'), out);
  assert.ok(out.includes('unable to look up'), out);
  assert.ok(out.includes('(port 9418)'), out);
  assert.ok(out.includes('<redacted>@host.invalid'), out);
});

test('redactUrl: the path/scp-shaped form, the second one measured to leak', () => {
  // Measured: a remote whose URL is a filesystem path carrying the same
  // userinfo. git quotes the whole path back, so the credential rides the error
  // even though no network transport was involved.
  const msg = "Command failed: git -C /tmp/fx push --set-upstream -- pathy refs/heads/w:refs/heads/w\n"
    + "fatal: '/nonexistent/cad:s3cr3t-tok@host.invalid/r.git' does not appear to be a git repository\n"
    + 'fatal: Could not read from remote repository.\n';
  const out = redactUrl(msg);
  assertClean(out, 'path-shaped');
  assert.ok(out.includes('/nonexistent/'), out);
  assert.ok(out.includes('host.invalid/r.git'), out);
  assert.ok(out.includes('does not appear to be a git repository'), out);

  // The scp-shaped remote itself, which git would hand to ssh as a user name.
  const scp = redactUrl('fatal: could not read from cad:s3cr3t-tok@host.invalid:org/r.git');
  assertClean(scp, 'scp');
  assert.ok(scp.includes('host.invalid:org/r.git'), scp);
});

test('redactUrl: an https:// form carrying userinfo, which git anonymizes itself', () => {
  // Covered anyway (see the module header): git anonymizing this today is a
  // behaviour no test here owns, and the helper must not depend on it.
  const out = redactUrl("fatal: unable to access 'https://cad:s3cr3t-tok@host.invalid/r.git/': "
    + 'Could not resolve host: host.invalid');
  assertClean(out, 'https');
  assert.ok(out.includes("'https://<redacted>@host.invalid/r.git/'"), out);
  assert.ok(out.includes('Could not resolve host'), out);
});

test('redactUrl: a password-less userinfo is the whole credential and still goes', () => {
  // `https://<token>@host` is how a forge PAT is usually spelled - there is no
  // password half, so a redactor keyed on the colon would ship the token. The
  // `://` anchor is what makes this unambiguous without a token-prefix list.
  const out = redactUrl("fatal: unable to access 'https://ghp_liveTokenValue@host.invalid/o/r.git/'");
  assert.equal(out.includes('ghp_liveTokenValue'), false, out);
  assert.ok(out.includes("'https://<redacted>@host.invalid/o/r.git/'"), out);

  // The counter-rail, and the reason the scheme-less rule needs the colon: an
  // ORDINARY scp remote has a user and no secret at all, and must survive
  // byte-identical or every ssh push failure comes back unreadable.
  const plain = 'fatal: Could not read from git@github.com:crenshawdev/cadence.git';
  assert.equal(redactUrl(plain), plain);
});

test('redactUrl: a message with no URL in it comes back byte-identical', () => {
  const msg = 'Command failed: git -C /tmp/fx push --set-upstream -- origin refs/heads/w:refs/heads/w\n'
    + 'error: failed to push some refs\nhint: Updates were rejected because the tip is behind.\n';
  assert.equal(redactUrl(msg), msg);
});

test('redactUrl: an email address is an address, not a credential', () => {
  // The shape rule's whole cost is here: `john@jcrenshaw.dev` has no userinfo
  // colon and no `://`, so a commit trailer git echoed back survives intact.
  const msg = 'error: cannot lock ref: committer John Crenshaw <john@jcrenshaw.dev> '
    + 'authored 2026-08-13\nAuthor: someone@example.com\n';
  assert.equal(redactUrl(msg), msg);
});

test('redactUrl: the credential on the second line of a multi-line message', () => {
  // The real shape: execFileSync puts the command line first and git's stderr
  // after it, so a redactor anchored at the start of the string sees nothing.
  const msg = 'Command failed: git -C /tmp/fx push --set-upstream -- origin refs/heads/w:refs/heads/w\n'
    + 'fatal: unable to look up cad:s3cr3t-tok@host.invalid (port 9418)\n'
    + 'fatal: second one at git://cad:s3cr3t-tok@other.invalid/r.git too\n';
  const out = redactUrl(msg);
  assertClean(out, 'multi-line');
  assert.ok(out.includes('host.invalid'), out);
  assert.ok(out.includes('git://<redacted>@other.invalid/r.git'), out);
  assert.equal(out.split('\n').length, msg.split('\n').length, 'line count preserved');
});

test('redactUrl: a non-string input is coerced, not passed through', () => {
  // The callers hand it `e.message ?? String(e)`, always a string. Coercing
  // rather than returning the input untouched is what stops an Error object
  // carrying the same URL from routing around the redaction.
  const err = new Error('fatal: unable to look up cad:s3cr3t-tok@host.invalid (port 9418)');
  const out = redactUrl(err);
  assert.equal(typeof out, 'string');
  assertClean(out, 'Error');
  assert.ok(out.includes('host.invalid'), out);

  // Total: no input throws, whatever it is.
  assert.equal(redactUrl(undefined), 'undefined');
  assert.equal(redactUrl(null), 'null');
  assert.equal(redactUrl(7), '7');
});

test('redactUrl: a userinfo span the window cut before its `@` still goes', () => {
  // EXP-02, the URL-position twin of the quoted-value case at the end of this
  // file. `bodyExcerpt` sanitizes a bounded 4096-byte PREFIX of a provider
  // body, so a credentialed URL straddling that edge arrives with its userinfo
  // and no `@` at all. Rules 1 and 2 are both `@`-anchored, so the whole span
  // used to come back byte-identical and rode the failure envelope.
  const scheme = redactUrl("fatal: unable to access 'https://cad:s3cr3t-tok");
  assertClean(scheme, 'scheme-anchored, cut');
  assert.ok(scheme.includes('https://<redacted>'), scheme);
  assert.ok(scheme.includes('unable to access'), scheme);

  const bare = redactUrl('fatal: unable to look up cad:s3cr3t-tok');
  assertClean(bare, 'scheme-less, cut');
  assert.ok(bare.includes('<redacted>'), bare);
  assert.ok(bare.includes('unable to look up'), bare);

  // Inside a JSON string, which is where a cut URL in a provider-controlled
  // body actually sits - the quote is what the span starts after.
  const json = redactUrl('{"remote":"git://cad:s3cr3t-tok');
  assertClean(json, 'JSON-embedded, cut');

  // The password-less PAT has no colon to key on, so cut before its `@` it is
  // byte-for-byte a plain host and the scheme anchor is the only signal left.
  // Redacting it is why rule 1b does NOT require a colon.
  const pat = redactUrl("fatal: unable to access 'https://ghp_liveTokenValue");
  assert.equal(pat.includes('ghp_liveTokenValue'), false, pat);
});

test('redactUrl: a port is not userinfo, at end-of-input as much as mid-body', () => {
  // The boundary the end-of-input anchor could plausibly break (AC3): `:8080`
  // is a colon-separated pair sitting right where a cut userinfo span would.
  // The `/` exclusion both classes carry is what keeps them apart, so the same
  // URL is byte-identical whether or not it ends the string.
  const url = 'https://example.com:8080/path';
  assert.equal(redactUrl(url), url);
  assert.equal(redactUrl(`see ${url} for more`), `see ${url} for more`);
});

test('redactUrl: the end-of-input rules stay inside redactUrl\'s own half', () => {
  // The split issue-check.mjs:41-47 states in these words: a `name=value` pair
  // is in URL position to nobody, and the new anchors must not widen redactUrl
  // into redactCredentials' coverage to reach the window edge.
  const pair = 'key=sk-live-abc123';
  assert.equal(redactUrl(pair), pair);

  // And the tail the `"`/`'` exclusion protects: a JSON body's own closing
  // `"name":"value"}}` is the diagnostic the excerpt exists to carry. Without
  // the exclusion it reads as one scheme-less userinfo span running to the end
  // of the input, and the excerpt comes back saying nothing.
  const body = '{"error":{"message":"upstream rejected","code":"model_not_found"}}';
  assert.equal(redactUrl(body), body);
});

// --- redactCredentials: the spans a URL-position rule cannot see (RVP-01) -----
//
// The provider seam's HTTP failure envelope carries an excerpt of a body nobody
// in this repo wrote. A misconfigured gateway echoes request headers; a proxy
// error page quotes the URL it was given. Neither is in URL userinfo position,
// so `redactUrl` sees nothing, and both carry the key the seam just sent.
//
// Every arm asserts BOTH halves, same as the arms above: the credential is gone
// AND the diagnostic a reader needs is still there. A redactor that ate the
// whole body would pass the first half and make the excerpt worthless.

test('redactCredentials: an authorization echo loses the scheme word too', () => {
  const out = redactCredentials('authorization: Bearer sk-live-abc123');
  assert.equal(out.includes('Bearer'), false, out);
  assert.equal(out.includes('sk-live-abc123'), false, out);
  assert.equal(out, '<redacted>');

  // The JSON spelling of the same header, where the name is quoted away from
  // its colon so only the scheme word anchors the match.
  const json = redactCredentials('{"headers": {"authorization": "Bearer sk-live-abc123"}}');
  assert.equal(json.includes('Bearer'), false, json);
  assert.equal(json.includes('sk-live-abc123'), false, json);
  assert.ok(json.includes('headers'), json);
});

test('redactCredentials: a credential-shaped query parameter, name and value', () => {
  const out = redactCredentials('proxy error fetching https://api.example/v1?key=sk-live-abc123&x=1');
  assert.equal(out.includes('key='), false, out);
  assert.equal(out.includes('sk-live-abc123'), false, out);
  // The half that makes the excerpt worth carrying: the endpoint and the
  // non-credential parameter survive, so a reader can still see WHAT failed.
  assert.ok(out.includes('https://api.example/v1?'), out);
  assert.ok(out.includes('&x=1'), out);
  assert.ok(out.includes('proxy error fetching'), out);
});

test('redactCredentials: the JSON pair spelling, and the bare form-body one', () => {
  const json = redactCredentials('{"api_token": "glpat-xyz", "model": "gpt-5"}');
  assert.equal(json.includes('token'), false, json);
  assert.equal(json.includes('glpat-xyz'), false, json);
  assert.ok(json.includes('"model": "gpt-5"'), json);

  const form = redactCredentials('secret=hunter2');
  assert.equal(form.includes('secret'), false, form);
  assert.equal(form.includes('hunter2'), false, form);

  // The prefixed spellings a real header dump carries.
  for (const line of ['x-api-key: sk-live-abc123', 'OPENAI_API_KEY=sk-live-abc123',
    'access_token=sk-live-abc123', 'password: hunter2']) {
    const out = redactCredentials(line);
    assert.equal(out, '<redacted>', line);
  }
});

test('redactCredentials: a bare credential WORD is not a credential shape', () => {
  // The boundary that keeps this from eating the diagnostic the excerpt exists
  // for: no separator, no value, nothing to redact.
  const msg = 'the request carried an invalid token';
  assert.equal(redactCredentials(msg), msg);

  // The real one this protects: OpenAI's model_not_found body, which is the one
  // thing /cad-config's review arm reads the envelope for.
  const real = '{"error":{"message":"The model \'gpt-fault-fixture\' does not exist or you '
    + 'do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';
  assert.equal(redactCredentials(real), real);

  // A name that merely ENDS in a credential word mid-token is not one.
  assert.equal(redactCredentials('monkey=1'), 'monkey=1');
});

test('redactCredentials: total - a non-string input is coerced, nothing throws', () => {
  assert.equal(redactCredentials(undefined), 'undefined');
  assert.equal(redactCredentials(null), 'null');
  assert.equal(redactCredentials(7), '7');
  assert.equal(typeof redactCredentials(new Error('key=sk-live-abc123')), 'string');
  assert.equal(redactCredentials(new Error('key=sk-live-abc123')).includes('sk-live-abc123'), false);
});

test('redactCredentials and redactUrl each keep their own coverage', () => {
  // Neither is a superset. The split is the reason issue-check.mjs:41-47 can go
  // on saying redactUrl covers URL position and nothing else.
  const userinfo = 'https://cad:s3cr3t-tok@host.invalid/r.git';
  assert.equal(redactCredentials(userinfo), userinfo, 'userinfo is redactUrl\'s job');
  const pair = 'key=sk-live-abc123';
  assert.equal(redactUrl(pair), pair, 'a name=value pair is redactCredentials\' job');
});

test('redactCredentials: a QUOTED value goes whole, spaces and all', () => {
  // The value class stops at whitespace, so a multi-word secret used to lose
  // only its first word and ride the excerpt with the rest intact. A quoted
  // value now runs to its closing quote.
  for (const [body, leak] of [
    ['{"password":"correct horse battery staple"}', 'horse battery staple'],
    ["{'passwd': 'hunter2 two'}", 'two'],
    ['{"api_token": "glpat one two"}', 'one two'],
  ]) {
    const out = redactCredentials(body);
    assert.equal(out.includes(leak), false, `${leak} survived in ${out}`);
    assert.ok(out.includes("<redacted>"), `nothing was redacted in ${out}`);
  }
  // An UNquoted value still stops at the delimiter that ends it - the boundary
  // that keeps this from eating the diagnostic around it.
  assert.equal(redactCredentials('key=abc&next=1'), "<redacted>&next=1");
});

test('redactCredentials: camelCase names are credential names too', () => {
  // Rule 4 crosses a `_`, `-` or `.` only, so the ordinary spelling of a JSON
  // key went through byte-identical. Case is the discriminator here.
  for (const name of ['apiSecret', 'clientSecret', 'apiKey', 'accessToken', 'refreshToken']) {
    const body = `{"${name}":"sk-live-abc123"}`;
    assert.equal(redactCredentials(body).includes('sk-live-abc123'), false,
      `${name} leaked its value`);
  }
  // And the same false positives rule 4's lookbehind exists to prevent: a
  // lowercase word merely ENDING in a credential word is not a credential name.
  assert.equal(redactCredentials('monkey=1'), 'monkey=1');
  assert.equal(redactCredentials('turkey: soup'), 'turkey: soup');
  assert.equal(redactCredentials('mistoken=1'), 'mistoken=1');
});

test('redactCredentials: a quoted value cut before its closing quote still goes', () => {
  // The window-edge case. `bodyExcerpt` sanitizes a bounded PREFIX of a large
  // body, so a credential straddling that window arrives with its opening quote
  // and no closing one. The terminated alternatives could not match it, the
  // bare class excludes `"` and `'`, and the pair survived byte-identical.
  for (const body of [
    '{"other":1, "password":"SUPERSECRET_TAIL_KEEPS_GOING',
    "{'other':1, 'passwd': 'SUPERSECRET_TAIL_KEEPS_GOING",
    '{"apiSecret": "SUPERSECRET_TAIL_KEEPS_GOING',
    '{"x-api-key":"SUPERSECRET_TAIL_KEEPS_GOING',
  ]) {
    const out = redactCredentials(body);
    assert.equal(out.includes('SUPERSECRET'), false,
      `a window-truncated value survived: ${out}`);
    assert.ok(out.includes('<redacted>'), `nothing was redacted in ${out}`);
  }
  // The terminated forms are tried FIRST, so a well-formed body is untouched
  // past the value it was always going to redact - the diagnostic the excerpt
  // exists to carry must not be eaten by the new alternatives.
  assert.equal(
    redactCredentials('{"password":"hunter2", "error":"model not found: gpt-9"}'),
    '{<redacted>, "error":"model not found: gpt-9"}');
  // And a lone unmatched quote carrying no credential name is still not a
  // credential span.
  assert.equal(redactCredentials('the "quick brown fox'), 'the "quick brown fox');
});

test('REDACTION_MARK is the string both redactors actually write', () => {
  // A caller that COUNTS redactions - review-provider.mjs's outbound payload
  // fence - reads this constant rather than a copy of the literal, so it has to
  // be the same string the two functions put on the page. A drift here would
  // make that fence report zero on a payload it had redacted.
  assert.ok(redactUrl('git://cad:s3cr3t-tok@host.invalid/r.git').includes(REDACTION_MARK));
  assert.ok(redactCredentials('{"password":"hunter2"}').includes(REDACTION_MARK));
});

test('cost: a whole ARTIFACT is linear, not quadratic (#167)', () => {
  // WATCHED FAILING. Before the whitespace segmentation and the literal
  // pre-checks, `redactUrl` backtracked once per start position: measured
  // 2026-08-30, 431ms on 16,000 characters, 6.4s on 64,000 and 25.5s on
  // 128,000 - so a review payload at the 120,000-token default cap (~480,000
  // characters) took minutes and hung the suite outright.
  //
  // This is a COST arm, and the bound is deliberately loose - two orders of
  // magnitude above the 9ms the shipped form measures - so it fails on the
  // return of the quadratic walk and not on a slow machine or a cold JIT.
  const cases = {
    'no whitespace at all, the base64 / hash shape': 'A'.repeat(480000),
    // The shape bound 2 alone let through, and the reason each rule carries a
    // lookbehind: one segment holding both the literal a pre-check looks for
    // and a long delimiter-free run. Measured at 84 SECONDS before the
    // lookbehinds, on the cut rule alone.
    'one segment, a colon, and two long runs': 'A'.repeat(240000) + ':' + 'B'.repeat(240000) + '/',
    'the same with an @, so the terminated rules run too':
      'A'.repeat(240000) + ':' + 'B'.repeat(240000) + '/@',
    // The scheme rules' own version, which a lookbehind of "not preceded by a
    // letter" did NOT bound: a scheme continues with digits, so in an
    // alternating run every letter was still a legal start. Measured at 99.6
    // SECONDS before the continuation class went into the lookbehind.
    'alternating letters and digits, a scheme, and no userinfo':
      '1a'.repeat(240000) + ':///@',
    'a minified bundle, every delimiter present': 'a:b/c;d(e)'.repeat(48000),
    'an ordinary diff of ordinary code': Array(6000).fill(
      '+  const value = compute(alpha, beta); // https://cad:tok@host.invalid/r.git').join('\n'),
    'dense @ with no other delimiter': ('x'.repeat(100) + '@').repeat(4752),
  };
  for (const [name, body] of Object.entries(cases)) {
    const started = Date.now();
    const out = redactCredentials(redactUrl(body));
    const ms = Date.now() - started;
    assert.ok(ms < 2000, `${name}: the fence took ${ms}ms on ${body.length} characters`);
    assert.ok(out.length > 0, `${name}: redacted to nothing`);
  }
  // And the coverage the speed is not allowed to cost: the credential in the
  // ordinary-diff case is still gone, at that size, through the same call.
  const diff = Array(6000).fill(
    '+  const value = compute(alpha, beta); // https://cad:tok@host.invalid/r.git').join('\n');
  const out = redactCredentials(redactUrl(diff));
  assert.equal(out.includes('cad:tok'), false, 'the userinfo survived at artifact scale');
  assert.ok(out.includes('compute(alpha, beta)'), 'the code a reviewer needs was eaten');
});

test('the start lookbehinds remove attempts, never matches', () => {
  // Each rule is pinned to the beginning of a run for cost. The claim that
  // makes that safe is that a match starting mid-run never survived leftmost
  // anyway, so these are the spans where a naive pin WOULD have cost coverage:
  // a run character sitting immediately before the credential, with no
  // delimiter between them.
  for (const [body, gone] of [
    // A digit immediately before a scheme - the scheme rule starts at a letter,
    // so the run begins at the digit and the match begins one later.
    ['see 9abc://cad:s3cr3t-tok@host.invalid/r.git now', 's3cr3t-tok'],
    ['x9https://ghp_deadbeef@host/r.git', 'ghp_deadbeef'],
    // A `+`, a `.` and a `-` are scheme-class characters in the same position.
    ['v1.2+git://cad:s3cr3t-tok@host.invalid/r.git', 's3cr3t-tok'],
    // The scheme-less rule, with an ordinary word character in front.
    ['prefixcad:s3cr3t-tok@host.invalid/r.git', 's3cr3t-tok'],
    // And the two cut rules, which end the input rather than at an `@`.
    ['9abc://cad:s3cr3t-tok', 's3cr3t-tok'],
    ['9a9b://ghp_deadbeef', 'ghp_deadbeef'],
    ['prefixcad:s3cr3t-tok', 's3cr3t-tok'],
  ]) {
    const out = redactUrl(body);
    assert.equal(out.includes(gone), false, `the credential survived: ${out}`);
    assert.ok(out.includes(REDACTION_MARK), `nothing was redacted in ${out}`);
  }
});

test('the scheme pin writes back the prefix it absorbed', () => {
  // The scheme rules are pinned at the START of a run, and a run may begin with
  // a character a scheme may not: `[0-9+.-]*` inside the capture is what lets
  // the match begin there anyway. Inside, because `$1` is written back - a
  // prefix matched outside it would be deleted from the output rather than
  // preserved, which is a corruption and not a redaction.
  assert.equal(redactUrl('9a9b://x@'), `9a9b://${REDACTION_MARK}@`);
  assert.equal(redactUrl('x9https://ghp_tok@h'), `x9https://${REDACTION_MARK}@h`);
  assert.equal(redactUrl('v1.2+git://cad:tok@host/r.git'),
    `v1.2+git://${REDACTION_MARK}@host/r.git`);
  // And the cut twin, which ends the input instead of at an `@`.
  assert.equal(redactUrl('9a9b://ghp_tok'), `9a9b://${REDACTION_MARK}`);
});
