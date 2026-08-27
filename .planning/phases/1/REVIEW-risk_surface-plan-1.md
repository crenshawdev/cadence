{
  "findings": [
    {
      "file": "cadence-core/bin/lib/forge-decision.mjs",
      "line": 287,
      "severity": "medium",
      "claim": "The hostname grammar enforces only the total DNS-name length and accepts invalid overlong DNS labels.",
      "failure_scenario": "`git.forge_host=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.example.com:3001` is accepted: its total length is below 253 and the 64-character first label matches `HOST_LABEL`. DNS labels are limited to 63 octets, so this accepted persisted Forgejo address cannot be resolved as a DNS hostname; later `tea` login/API operations against it fail even though config set/check/validate reported the value as valid. The included acceptance of `'h'.repeat(253)` codifies the same invalid single-label case."
    }
  ]
}
