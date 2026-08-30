{
  "findings": [
    {
      "file": "cadence-core/bin/lib/redact-url.mjs",
      "line": 111,
      "severity": "high",
      "claim": "Finding 1 remains open: the scheme lookbehind does not bound retry starts because it rejects only starts preceded by a letter, while the scheme continuation class also accepts digits, `+`, `.`, and `-`.",
      "failure_scenario": "A segment such as `'1a'.repeat(240000) + ':///@'` passes the `://` and `@` pre-checks. Every `a` is preceded by `1`, so every candidate passes `(?<![A-Za-z])`; each attempt scans the remaining alternating run to the common `://` and then fails when userinfo begins with the extra slash. The engine therefore performs quadratically many character visits despite the new fence."
    },
    {
      "file": "cadence-core/bin/review-provider.mjs",
      "line": 484,
      "severity": "medium",
      "claim": "Finding 2 is only fixed for zero-versus-nonzero observability; `redactions` still does not count the spans removed.",
      "failure_scenario": "For `https://<redacted>:one@h/a https://<redacted>:two@h/b`, two credential spans are replaced, but each consumes one existing marker and emits one marker. The before and after marker counts are both two, so `net` is zero and the floor reports `redactions: 1` in the envelope and trace even though two spans were redacted."
    }
  ]
}
