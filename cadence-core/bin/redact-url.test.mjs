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
import { redactUrl, redactCredentials } from './lib/redact-url.mjs';

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
