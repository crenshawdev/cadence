#!/usr/bin/env python3
"""Phase-13 close-only procedure. No discovery, HOME lookup or product install."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import sys


class Refusal(Exception):
    pass


def digest(raw):
    return "absent" if raw is None else hashlib.sha256(raw).hexdigest()


def read(path):
    if path.is_symlink():
        raise Refusal("ambiguous symlink: " + str(path))
    if not path.exists():
        return None
    if not path.is_file():
        raise Refusal("ambiguous non-file: " + str(path))
    return path.read_bytes()


def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise Refusal("ambiguous duplicate JSON key: " + key)
        result[key] = value
    return result


def clean_settings(raw, identity):
    if raw is None:
        return None, 0
    text = raw.decode("utf-8")
    value = json.loads(text, object_pairs_hook=unique)
    if not isinstance(value, dict):
        raise Refusal("settings must be an object")
    hooks = value.get("hooks", {})
    if not isinstance(hooks, dict):
        raise Refusal("ambiguous hooks object")
    targets = set()
    for event, groups in hooks.items():
        if not isinstance(groups, list):
            raise Refusal("ambiguous event groups")
        for group_index, group in enumerate(groups):
            if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
                raise Refusal("ambiguous hook group")
            for index, entry in enumerate(group["hooks"]):
                if not isinstance(entry, dict):
                    raise Refusal("ambiguous hook entry")
                command = entry.get("command")
                if entry.get("type") == "command":
                    if not isinstance(command, str):
                        raise Refusal("ambiguous command")
                    try:
                        argv = shlex.split(command)
                    except ValueError as error:
                        raise Refusal("ambiguous command quoting") from error
                    if argv == identity:
                        targets.add(("hooks", event, group_index, "hooks", index))

    # Walk actual JSON token spans. Delete only targeted array elements and
    # their required delimiters; never serialize unrelated settings.
    decoder = json.JSONDecoder()
    edits = []

    def ws(pos):
        while pos < len(text) and text[pos].isspace():
            pos += 1
        return pos

    def node(pos, path):
        pos = ws(pos)
        if text[pos] == "{":
            pos = ws(pos + 1)
            while text[pos] != "}":
                key, pos = decoder.raw_decode(text, pos)
                pos = ws(pos)
                if text[pos] != ":":
                    raise Refusal("invalid object delimiter")
                pos = ws(node(pos + 1, path + (key,)))
                if text[pos] == ",":
                    pos = ws(pos + 1)
                else:
                    break
            return pos + 1
        if text[pos] == "[":
            pos = ws(pos + 1)
            spans = []
            while text[pos] != "]":
                start = pos
                pos = node(pos, path + (len(spans),))
                spans.append((start, pos))
                pos = ws(pos)
                if text[pos] == ",":
                    pos = ws(pos + 1)
                else:
                    break
            selected = [i for i in range(len(spans)) if path + (i,) in targets]
            cursor = 0
            while cursor < len(selected):
                first = last = selected[cursor]
                cursor += 1
                while cursor < len(selected) and selected[cursor] == last + 1:
                    last = selected[cursor]
                    cursor += 1
                if last + 1 < len(spans):
                    edits.append((spans[first][0], spans[last + 1][0]))
                elif first > 0:
                    edits.append((spans[first - 1][1], spans[last][1]))
                else:
                    edits.append((spans[first][0], spans[last][1]))
            return pos + 1
        return decoder.raw_decode(text, pos)[1]

    node(0, ())
    for start, end in sorted(edits, reverse=True):
        text = text[:start] + text[end:]
    result = text.encode("utf-8")
    json.loads(text, object_pairs_hook=unique)
    return result, len(targets)


def sync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def save_new(path, raw, mode=0o600):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(fd, "wb") as out:
        out.write(raw)
        out.flush()
        os.fsync(out.fileno())
    sync_dir(path.parent)


def replace(path, raw, mode):
    if raw is None:
        if read(path) is not None:
            path.unlink()
            sync_dir(path.parent)
        return
    temporary = path.with_name(path.name + ".phase13-close-new")
    save_new(temporary, raw, mode)
    os.replace(temporary, path)
    sync_dir(path.parent)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["retire", "recover"])
    parser.add_argument("--settings-root", type=Path, required=True)
    parser.add_argument("--settings-sha256", required=True)
    parser.add_argument("--hook-sha256", required=True)
    parser.add_argument("--command", required=True)
    parser.add_argument("--recovery", type=Path, required=True)
    args = parser.parse_args()
    root, recovery = args.settings_root, args.recovery
    if not root.is_absolute() or root.resolve(strict=True) != root:
        raise Refusal("settings root must be explicit, canonical and unambiguous")
    if not recovery.is_absolute() or recovery.parent.resolve(strict=True) != recovery.parent:
        raise Refusal("recovery directory must have an explicit canonical parent")
    if recovery.is_symlink():
        raise Refusal("ambiguous recovery symlink")
    settings, hook = root / "settings.json", root / "hooks" / "rules-gate.mjs"
    if hook.parent.exists() and hook.parent.resolve() != hook.parent:
        raise Refusal("ambiguous hooks directory")
    identity = shlex.split(args.command)
    if len(identity) != 2 or Path(identity[0]).name != "node" or identity[1] != str(hook):
        raise Refusal("inspected command must be node followed by this root's exact hook path")
    binding = {"root": str(root), "command": identity,
               "settings": args.settings_sha256, "hook": args.hook_sha256}
    current_settings, current_hook = read(settings), read(hook)
    manifest_path = recovery / "manifest.json"
    if recovery.exists():
        manifest = json.loads(read(manifest_path) or b"null", object_pairs_hook=unique)
        if not isinstance(manifest, dict) or manifest.get("binding") != binding:
            raise Refusal("recovery does not match inspected binding")
        originals = {}
        for key in ["settings", "hook"]:
            originals[key] = read(recovery / (key + ".original"))
            if digest(originals[key]) != binding[key]:
                raise Refusal("recovery original is missing or changed")
        after, count = clean_settings(originals["settings"], identity)
        if digest(after) != manifest["after"]:
            raise Refusal("recovery output binding changed")
        if args.action == "retire":
            if current_hook is None and current_settings == after:
                print(json.dumps({"status": "already-retired", "binding": binding,
                                  "removed": count, "settings_after": digest(after)}))
                return
            raise Refusal("unfinished or recovered attempt; recover, then inspect with a fresh recovery directory")
        if current_settings not in (originals["settings"], after) or current_hook not in (originals["hook"], None):
            raise Refusal("partial state has unrelated changes; recovery refused")
        replace(settings, originals["settings"], manifest["settings_mode"])
        replace(hook, originals["hook"], manifest["hook_mode"])
        if read(settings) != originals["settings"] or read(hook) != originals["hook"]:
            raise Refusal("recovery confirmation failed")
        print(json.dumps({"status": "recovered", "binding": binding}))
        return
    if args.action == "recover":
        raise Refusal("no recovery originals")
    if digest(current_settings) != binding["settings"] or digest(current_hook) != binding["hook"]:
        raise Refusal("stale inspected preimage")
    after, count = clean_settings(current_settings, identity)
    if current_hook is None and count == 0:
        print(json.dumps({"status": "already-absent", "binding": binding,
                          "settings_after": digest(after)}))
        return
    # Recovery is complete and fsynced before either target can change.
    settings_mode = settings.stat().st_mode & 0o777 if current_settings is not None else 0o600
    hook_mode = hook.stat().st_mode & 0o777 if current_hook is not None else 0o600
    recovery.mkdir(mode=0o700)
    for key, raw in [("settings", current_settings), ("hook", current_hook)]:
        if raw is not None:
            save_new(recovery / (key + ".original"), raw)
    manifest = {"binding": binding, "after": digest(after),
                "settings_mode": settings_mode, "hook_mode": hook_mode}
    save_new(manifest_path, json.dumps(manifest, sort_keys=True).encode())
    if read(settings) != current_settings or read(hook) != current_hook:
        raise Refusal("preimage changed before removal; recovery retained")
    try:
        if current_hook is not None:
            hook.unlink()
            sync_dir(hook.parent)
        if after != current_settings:
            replace(settings, after, settings_mode)
        if read(hook) is not None or read(settings) != after or clean_settings(read(settings), identity)[1] != 0:
            raise Refusal("target absence confirmation failed")
    except (OSError, Refusal) as error:
        print(json.dumps({"status": "unfinished", "reason": str(error),
                          "recovery": str(recovery)}))
        return 2
    print(json.dumps({"status": "retired", "binding": binding, "removed": count,
                      "settings_after": digest(after), "recovery": str(recovery)}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main() or 0)
    except (Refusal, OSError, ValueError) as error:
        print(json.dumps({"status": "refused", "reason": str(error)}))
        sys.exit(1)
