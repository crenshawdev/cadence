#!/usr/bin/env python3
"""Capture with --capture; inspect without building or opening a store with --inspect.

Restoration consumers must hold LOCK_EX on ROOT + '.lock' throughout restore,
server lifetime, reopen assertions and cleanup. Never relocate these bytes.
The sibling lock is persistent: unlinking it would split lock ownership.
"""
import argparse
import base64
import copy
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile


REPO = Path(__file__).resolve().parents[4]
FIXTURE = Path(__file__).resolve().parents[1] / "fixtures/phase12_pre29_blank.json"
COMMIT = "b353f09dba50db20992bd39ae52b0b331168d2f0"
ROOT = Path("/tmp/cadence-phase12-pre29-5b7de640")
OWNER = "cadence-phase12-pre29-5b7de640"
GIT = ["git", "-c", "commit.gpgsign=false", "-c", "user.name=Cadence-Phase12",
       "-c", "user.email=phase12@example.invalid"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.check_output(GIT + list(args), cwd=root, stdin=subprocess.DEVNULL,
                                   env={**os.environ, "GIT_CONFIG_GLOBAL": "/dev/null",
                                        "GIT_CONFIG_NOSYSTEM": "1"})


def approve(submission):
    return {"approved": True, "owner": "Fixture Owner", "at": "2026-09-10T14:00:00Z",
            "submission": copy.deepcopy(submission)}


class Client:
    def __init__(self, binary, transcript, isolation):
        self.transcript = transcript
        self.child = subprocess.Popen(
            [str(binary), "serve", "--project-root", str(ROOT)], cwd=ROOT,
            env={**os.environ, "CADENCE_GLOBAL_CONFIG": "", "HOME": str(isolation),
                 "GNUPGHOME": str(isolation), "GIT_CONFIG_GLOBAL": "/dev/null",
                 "GIT_CONFIG_NOSYSTEM": "1"},
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        response = self.rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "phase12-history", "version": "1"}}})
        assert "serverInfo" in response["result"], response
        self.child.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
        self.child.stdin.flush()

    def rpc(self, request):
        self.child.stdin.write(json.dumps(request) + "\n")
        self.child.stdin.flush()
        response = json.loads(self.child.stdout.readline())
        self.transcript.append({"request": request, "response": response})
        return response

    def call(self, tool, arguments):
        response = self.rpc({"jsonrpc": "2.0", "id": len(self.transcript) + 1,
                             "method": "tools/call", "params": {"name": tool, "arguments": arguments}})
        assert "error" not in response, response
        result = response["result"]
        assert not result.get("isError", False), result
        value = result["structuredContent"]
        assert json.loads("".join(b["text"] for b in result["content"] if b["type"] == "text")) == value
        return value

    def close(self):
        self.child.stdin.close()
        assert self.child.wait(timeout=30) == 0


def item(identity, truth, command):
    return {"kind": "check", "id": identity, "spec": {
        "command": command, "expected": {"kind": "literal", "value": "receipt"},
        "test": {"file": "tests/not_yet_written.rs", "function": "delivery"},
        "setup": "An approved delivery", "call": "Send the parcel",
        "boundary": "Real delivery", "fakes": []},
        "reason": "Removing delivery loses the receipt.", "associations": [{
            "truth_id": truth, "truth_version": 1, "reason": "Delivery provides the receipt."}]}


def capture():
    assert not FIXTURE.exists(), "capture never overwrites an existing artifact"
    with tempfile.TemporaryDirectory(prefix="cadence-phase12-old-source-") as source_dir, \
            tempfile.TemporaryDirectory(prefix="cadence-phase12-old-target-") as target_dir, \
            tempfile.TemporaryDirectory(prefix="cadence-phase12-isolation-") as isolation:
        source = Path(source_dir)
        assert git(REPO, "rev-parse", COMMIT).decode().strip() == COMMIT
        archive = git(REPO, "archive", "--format=tar", COMMIT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(source, filter="data")
        command = ["cargo", "build", "--locked", "-p", "cadence", "--bin", "cadence",
                   "--target-dir", target_dir]
        attempts = []
        for attempt in range(2):
            result = subprocess.run(command, cwd=source, stdin=subprocess.DEVNULL,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            output = result.stdout.decode(errors="replace")
            print(output, flush=True)
            attempts.append({"exit": result.returncode, "output": output})
            if result.returncode == 0:
                break
            if attempt or "mold" not in output or not any(s in output for s in ["SIGBUS", "Bus error", "failed to write to an output file"]):
                raise RuntimeError("pinned binary build failed")
        else:
            raise RuntimeError("pinned binary build retry failed")
        binary = Path(target_dir) / "debug/cadence"
        provenance = {"commit": COMMIT, "archive_sha256": sha(archive),
                      "binary_sha256": sha(binary.read_bytes()), "build_command": command,
                      "build_attempts": attempts,
                      "rustc": subprocess.check_output(["rustc", "--version"], stdin=subprocess.DEVNULL).decode().strip()}
        with open(str(ROOT) + ".lock", "a+") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            assert not ROOT.exists(), "foreign or prior root: refusing to replace contents"
            ROOT.mkdir()
            (ROOT / ".phase12-owner").write_text(OWNER)
            planning = ROOT / ".planning"
            (planning / "phases/12").mkdir(parents=True)
            (planning / "ROADMAP.md").write_text("## Phases\n- [ ] **Phase 12: Execution**\n- [ ] **Phase 13: Next phase**\n")
            git(ROOT, "init", "--initial-branch=fixture/execution")
            git(ROOT, "add", ".phase12-owner", ".planning/ROADMAP.md")
            git(ROOT, "commit", "-m", "Fixture baseline")
            transcript = []
            client = Client(binary, transcript, isolation)
            try:
                truths = [{"id": truth, "trigger": trigger, "observer": "the recipient", "verb": "gets",
                           "outcome": "a receipt", "kind": "property", "observable": True, "fixed_oracle": True}
                          for truth, trigger in [("truth/historical", "the sender sends the parcel"),
                                                 ("truth/control", "the courier arrives")]]
                submission = {"phase": 12, "title": "Execution", "scope": "Approved delivery.",
                              "durable_decisions": [], "decisions": [], "assumptions": [], "truths": truths}
                context = client.call("cadence_apply", {"operation": "context-submit", "submission": submission,
                                                       "approval": approve(submission)})
                assert context["persisted"], context
                allocation = client.call("cadence_query", {"operation": "plan-read", "phase_address": "12", "count": 2})
                assert allocation["status"] == "ok", allocation
                entries = []
                for index, check in enumerate([item("check/historical", "truth/historical", ""),
                                               item("check/control", "truth/control", "custom-delivery-check")]):
                    target = allocation["targets"][index]
                    evidence = {"mode": "attached", "items": [check]}
                    content = {"phase": 12, "plan": target["plan"], "requirements": [check["associations"][0]["truth_id"]],
                               "files": ["src/delivery.rs"], "directories": [], "execution": {"schema": 1,
                               "suite": "printf suite", "tasks": [{"id": "deliver", "verify": ["printf verified"]},
                                                                    {"id": "document", "verify": ["printf documented"]}]},
                               "body": "# Delivery\n## Evidence map\n\n```json\n" + json.dumps(evidence, indent=2) + "\n```\n\n",
                               "evidence_map": evidence}
                    entries.append({"target": target, "content": content})
                submission = {"phase": 12, "occurrence": allocation["occurrence"], "request_id": "historical-batch",
                              "inventory_basis": allocation["inventory"]["basis"], "plans": entries}
                preview = client.call("cadence_query", {"operation": "plan-read", "phase_address": "12", "submission": submission})
                assert preview["status"] == "ok", preview
                assert preview["submission"] == submission, "exact authored map section required"
                published = client.call("cadence_apply", {"operation": "plan-submit", "submission": submission,
                                                         "approval": approve(submission)})
                assert published["persisted"], published
            finally:
                client.close()
            assert not (planning / ".store-intent.json").exists()
            files = {}
            for path in sorted(ROOT.rglob("*")):
                assert not path.is_symlink(), path
                if path.is_file():
                    data = path.read_bytes()
                    files[str(path.relative_to(ROOT))] = {"base64": base64.b64encode(data).decode(),
                                                         "sha256": sha(data), "mode": path.stat().st_mode & 0o777}
            artifact = {"schema": "phase12-pre29-capture-1", "root": str(ROOT), "owner": OWNER,
                        "lock": str(ROOT) + ".lock", "provenance": provenance, "transcript": transcript,
                        "environment": {"CADENCE_GLOBAL_CONFIG": "", "GIT_CONFIG_GLOBAL": "/dev/null",
                                        "GIT_CONFIG_NOSYSTEM": "1"}, "files": files}
            inspect(artifact)
            FIXTURE.write_text(json.dumps(artifact, indent=2) + "\n")
            assert (ROOT / ".phase12-owner").read_text() == OWNER
            shutil.rmtree(ROOT)


def inspect(artifact):
    assert artifact["schema"] == "phase12-pre29-capture-1"
    assert artifact["root"] == str(ROOT) and artifact["lock"] == str(ROOT) + ".lock"
    assert artifact["owner"] == OWNER
    provenance = artifact["provenance"]
    assert provenance["commit"] == COMMIT
    assert sha(git(REPO, "archive", "--format=tar", COMMIT)) == provenance["archive_sha256"]
    assert len(provenance["binary_sha256"]) == 64 and int(provenance["binary_sha256"], 16)
    assert provenance["build_attempts"][-1]["exit"] == 0
    files = {}
    for path, saved in artifact["files"].items():
        assert not Path(path).is_absolute() and ".." not in Path(path).parts
        files[path] = base64.b64decode(saved["base64"], validate=True)
        assert sha(files[path]) == saved["sha256"], path
    assert files[".phase12-owner"].decode() == OWNER
    assert ".planning/.store-intent.json" not in files
    state = json.loads(files[".planning/state.json"])
    # The snapshot is captured verbatim; only inspection parses its data.
    data = state["data"]
    assert str(ROOT) in files[".planning/state.json"].decode(), "root binding absent"
    publications = data["plan_publications"]["phases"]["12"]
    history = data["acceptance_maps"]["phases"]["12"]["revisions"]
    calls = [entry for entry in artifact["transcript"] if entry["request"].get("method") == "tools/call"]
    writes = [entry for entry in calls if entry["request"]["params"]["arguments"]["operation"] in ["context-submit", "plan-submit"]]
    assert len(writes) == 2
    for entry in writes:
        request = entry["request"]["params"]["arguments"]
        assert request["approval"]["submission"] == request["submission"]
        assert entry["response"]["result"]["structuredContent"]["persisted"] is True
    native = data["context"]["phases"]["12"]
    assert native["submission"] == writes[0]["request"]["params"]["arguments"]["submission"]
    assert len(native["truths"]) == 2 and all(t["version"] == 1 for t in native["truths"])
    request = writes[1]["request"]["params"]["arguments"]
    results = writes[1]["response"]["result"]["structuredContent"]["results"]
    assert publications["receipts"]["historical-batch"]["results"] == results
    for index, (command, check_id) in enumerate([("", "check/historical"), ("custom-delivery-check", "check/control")]):
        publication = publications["publications"][str(index + 1)]
        assert publication == results[index]
        assert publication["approval"] == request["approval"]
        assert publication["content"] == request["submission"]["plans"][index]["content"]
        assert sha(files[f".planning/phases/12/PLAN-{index + 1}.md"]) == publication["revision"]
        event = next(e for e in history if e["revision"] == publication["map_revision"])
        assert event["items"] == publication["content"]["evidence_map"]["items"]
        assert event["identity"] == publication["identity"] and event["content_revision"] == publication["revision"]
        check = event["items"][0]
        assert check["id"] == check_id and check["spec"]["command"] == command
        assert check["spec"]["expected"] == {"kind": "literal", "value": "receipt"}
    print(f"history: complete; commit={COMMIT}; binary_sha256={provenance['binary_sha256']}; "
          f"root={ROOT}; files={len(files)}; approved_publications=2; blank_command=1; valid_control=1", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--capture", action="store_true")
    modes.add_argument("--inspect", action="store_true")
    arguments = parser.parse_args()
    if arguments.capture:
        capture()
    else:
        inspect(json.loads(FIXTURE.read_text()))
