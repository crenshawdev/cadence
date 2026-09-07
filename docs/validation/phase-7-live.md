# Phase 7 live guard validation

Host: `2.1.263 (Claude Code)`. Host-help SHA-256 `95a31820dc2a7b1adbd197346baa89a62cddd14b984079e1fc2ad56d11a97b20`. Native binary SHA-256 `0545bcf19d1fba44ec257ed0a8dee4379cad6beffb78539eb07649dc7ded59c8`. Git `git version 2.55.0`.

Fixture root: `/tmp/cadence-phase7-live/guard-run-yUJz4N`. Normal permission mode; command exactly as PLAN-1 Notes, substituting fixture settings/MCP paths. All repositories, signing material and remotes are disposable and local. Raw host streams remain under this root. No unit result substitutes for a required host attempt.

- Host attempt `deny`: exit `0`, SHA-256 `7fb572dcf78bcf5ae25b7ffd68003ada91525d6d1a9aff0665e00cded10249ff`, bytes `19195`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/deny-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Confirmed `state.json` SHA-256 `68cbb08dcb54d6160dfa511e2b87988706b51299409fa04913a7d43c7b11aa41`.
  Confirmed `decisions.jsonl` SHA-256 `9c3a5f39ea719646598842273ff2544d4e95a6c55208ecba4def4311393bec0d`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_01ELFcHEcZq4S2iLVxypj1Na` attempt; hook `9edc2d6d-5eeb-4993-8e81-a083c118c755` returned `Some("deny")`; tool error `true`; HEAD `5ccfca1d851125c1d23002c2e8e95fe121417a6a` -> `5ccfca1d851125c1d23002c2e8e95fe121417a6a`; durable outcome `Some(Deny)`; unavailable inputs `Some([])`.

- Host attempt `ask`: exit `0`, SHA-256 `73fe9acfa9a8948da7712b1f456213ef45c8cb664734334ea49fd9821bb6a6af`, bytes `20824`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/ask-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Confirmed `state.json` SHA-256 `b3b8bb76a794f25f01dbf0c0b9b9b709665dcdf7093f6cca84e633a229e83b34`.
  Confirmed `decisions.jsonl` SHA-256 `a08a538c6c009e687076d69c4cdcd53a11594e1818ea7f887225e5e4bb189838`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_016tUbaah1cfYKgLXHybVh1z` attempt; hook `b8a21920-8067-4d63-b1f3-80eee3273707` returned `Some("ask")`; tool error `true`; HEAD `9cbddadd496fae0179f34fdf00b7e846cf2e0e23` -> `9cbddadd496fae0179f34fdf00b7e846cf2e0e23`; durable outcome `Some(Ask)`; unavailable inputs `Some([])`.

- Host attempt `pass`: exit `0`, SHA-256 `a93c1d33900c5eefb5ec2dfbbdfc95fecc42bf3357134bb73d0b2a413104db2d`, bytes `17781`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/pass-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Verified actual `toolu_01Cxswgb68QNyawoJqVvM95q` attempt; hook `cd14457b-6e29-44c6-95ae-b707ea399780` returned `None`; tool error `false`; HEAD `9216a39b21201d2d65f3cc153da418078dfcfbed` -> `4b4480c998dc6278cf42ae12adb7bc7c0b87245b`; durable outcome `None`; unavailable inputs `None`.

- Host attempt `push`: exit `0`, SHA-256 `0c1f1c5e8133b868d7f531a07584d20434e9bc28a9d889c69b75202312c734fb`, bytes `19367`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/push-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Confirmed `state.json` SHA-256 `5d1492b3579b9d0d1aeb039b73165c40b4f621c85d4b797e0f56f4ed6b3a605e`.
  Confirmed `decisions.jsonl` SHA-256 `e5d0546d5aab4834fdd3707d8db49f4d9af8bbc468f8871b309770d8975f8a29`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_01Jx859UdW6PFmjvgqAKxpn2` attempt; hook `d3cd3298-1413-4d8e-a3f8-e3facf252076` returned `Some("ask")`; tool error `true`; HEAD `97a97e78641605268758b6558d72cebf82782261` -> `97a97e78641605268758b6558d72cebf82782261`; durable outcome `Some(Ask)`; unavailable inputs `Some([])`.

- Host attempt `silent`: exit `0`, SHA-256 `0763446c603bb89f8bbe20c407d9d89438df03993e4a744e851ffdb816222f34`, bytes `19625`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/silent-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Verified actual `toolu_015YQoiSxE1SCzQdC3cjkKvg` attempt; hook `73e2442e-d936-466a-8e5b-5afdaf134572` returned `None`; tool error `false`; HEAD `cc3d59c031c760a5cdca24579a4e14f0fed0b7e6` -> `cc3d59c031c760a5cdca24579a4e14f0fed0b7e6`; durable outcome `None`; unavailable inputs `None`.

- Host attempt `git-open`: exit `0`, SHA-256 `b449d546ab8cb7573f46f0bc3e74b68e6da30ff62b40932472f7a0973a6ab7fb`, bytes `18013`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/git-open-host.jsonl`. Settings SHA-256 `0cad486e3e62c7f28c6fae13416d26e8a507525e7750c0efb10e30da9cf5516f`.
  Confirmed `state.json` SHA-256 `a1a9a925f937dfe04eb559ddeaf1b9f88244723590c2383da8abeb4b87116dac`.
  Confirmed `decisions.jsonl` SHA-256 `bc48837eef4825b861b45551939344223cddefd08ba450327dc405abcbfa8018`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_01JMPc3sA9aE8YzzT6UJMY28` attempt; hook `44d42ae0-d200-4b4d-97eb-fac0bb864ac2` returned `None`; tool error `false`; HEAD `0a215a2a4c024ea258d1be9404e55582a4bac544` -> `7471afc6a7d2bfe4bc2ae2d9832aaec4981a0a5a`; durable outcome `Some(FailurePass)`; unavailable inputs `Some([Unavailable { input: "Git", reason: "Git cannot read the cwd repository" }])`.

- Host attempt `torn`: exit `0`, SHA-256 `2ea3ae9b2b68427bb75b74a5915e879940f0fcdd08ff6065c30cd2ccfe0809b2`, bytes `25617`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/torn-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Confirmed `state.json` SHA-256 `5e028176e9b1979f7761c2a17a4997a4e69c61854f137924024f90c24a4c8332`.
  Confirmed `decisions.jsonl` SHA-256 `2d044b587cfe38b2e032bfbb76391e81de987c69c0bce5bc8c057565949296c3`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_011i66J7iHd7cwPkvwKJaKPu` attempt; hook `0edff9b1-a39b-4260-8696-7be8a6dbf76e` returned `Some("ask")`; tool error `true`; HEAD `ccc1fd901919b098d4692ecf50d02e1402dce92f` -> `ccc1fd901919b098d4692ecf50d02e1402dce92f`; durable outcome `Some(Ask)`; unavailable inputs `Some([Unavailable { input: "repo config /tmp/cadence-phase7-live/guard-run-yUJz4N/torn/.planning/config.json", reason: "controlling layer is malformed or not an object" }])`.

- Host attempt `deny-torn`: exit `0`, SHA-256 `36bed314459bb47aa46de6bf4a0b1c3786379451edd16e5305f608d0b07319c7`, bytes `24837`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/deny-torn-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Confirmed `state.json` SHA-256 `3ef0680058967e644e2633334f71301e90ae396026e98876543f9d7bd25dd4ae`.
  Confirmed `decisions.jsonl` SHA-256 `fb8eb21a5129b787453d279cd90d1b832cea399e7a44fa69974e0abfa6753b8b`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_01XrjSgqKEsfpmFYzP1V7tEg` attempt; hook `c53d1cb2-3904-4302-be49-aa0d1efd69aa` returned `Some("deny")`; tool error `true`; HEAD `11401944f972965391bd230f2994cc8960c8f66f` -> `11401944f972965391bd230f2994cc8960c8f66f`; durable outcome `Some(Deny)`; unavailable inputs `Some([Unavailable { input: "repo config /tmp/cadence-phase7-live/guard-run-yUJz4N/deny-torn/.planning/config.json", reason: "controlling layer is malformed or not an object" }])`.

- Host attempt `hard-git`: exit `0`, SHA-256 `cb67f0713518d14ec0773a4774ba8448ffcfa05f6bb4b8068805bbbc31270631`, bytes `21520`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/hard-git-host.jsonl`. Settings SHA-256 `0cad486e3e62c7f28c6fae13416d26e8a507525e7750c0efb10e30da9cf5516f`.
  Confirmed `state.json` SHA-256 `e37af70d6e61c2dd81706ac23106fd723b4be6519e01644d3423d9db6616bec2`.
  Confirmed `decisions.jsonl` SHA-256 `389dda7cec8d8b0487ed60b51c5b452d658bafe7a4f8e108aeff1f861e540cf3`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_01Xs3YnhzmEsfjWCTZNFKWkS` attempt; hook `ac0afab6-c6c5-4aab-aae0-47153099b322` returned `Some("deny")`; tool error `true`; HEAD `0e719bfc80f47c3828c94c311d94665ec164bf91` -> `0e719bfc80f47c3828c94c311d94665ec164bf91`; durable outcome `Some(Deny)`; unavailable inputs `Some([Unavailable { input: "Git", reason: "Git cannot read the cwd repository" }])`.

- Host attempt `hard-torn`: exit `0`, SHA-256 `4fc19cea3b9a7232cbfaf27f3ad8c2d74edd661c3f84ff0fe393aaf4a983707f`, bytes `26009`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/hard-torn-host.jsonl`. Settings SHA-256 `0cad486e3e62c7f28c6fae13416d26e8a507525e7750c0efb10e30da9cf5516f`.
  Confirmed `state.json` SHA-256 `b014e9cf64174fbc343ec41360160d78e69b3f32e2df9cf05d01c1bd2185854c`.
  Confirmed `decisions.jsonl` SHA-256 `aa3c333a548244da2d3ac626118750541c8c0e21c756204b09469e6a18e08884`.
  Confirmed `items.jsonl` SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Verified actual `toolu_01Ebz4SY84ga4eywez5oyAqc` attempt; hook `164ffa14-ccfb-4543-93ba-e0b63002063d` returned `Some("deny")`; tool error `true`; HEAD `0e719bfc80f47c3828c94c311d94665ec164bf91` -> `0e719bfc80f47c3828c94c311d94665ec164bf91`; durable outcome `Some(Deny)`; unavailable inputs `Some([Unavailable { input: "repo config /tmp/cadence-phase7-live/guard-run-yUJz4N/hard/.planning/config.v4.json", reason: "controlling layer is malformed or not an object" }, Unavailable { input: "Git", reason: "Git cannot read the cwd repository" }])`.

- Host attempt `ownership`: exit `0`, SHA-256 `db2c61c7392f713ea235c6ecc82eb8657ce8e9a09402a4851d77e7d97ea7d390`, bytes `49634`, output `/tmp/cadence-phase7-live/guard-run-yUJz4N/ownership-host.jsonl`. Settings SHA-256 `7b768eb81f6ce1306c978e829b56ac0235c3fa6cf2337572a5400372846a9914`.
  Verified real Write and Edit hook denials, tool refusals and unchanged state bytes, SHA-256 `b014e9cf64174fbc343ec41360160d78e69b3f32e2df9cf05d01c1bd2185854c`.

All required guard host cases passed. Hook asks were observed as asks, without counting them as denials or publication.
