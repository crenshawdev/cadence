#!/bin/sh
# Package one built cadence binary as a byte-reproducible release archive and
# print its sha256.
#
# Usage: .github/scripts/package.sh <binary> <name> <outdir>
#
#   <binary>  path to the built binary, e.g. target/<triple>/release/cadence
#   <name>    archive stem, cadence-<tag>-<triple>, one path segment
#   <outdir>  directory the .tar.gz is written to
#
# Writes <outdir>/<name>.tar.gz containing exactly <name>/cadence and
# <name>/LICENSE, and prints ONE line on stdout in sha256sum's own format:
#
#   <sha256>  <name>.tar.gz
#
# That format is fixed, not incidental: the release pin is a committed file of
# these lines, and `sha256sum -c` reads them back verbatim from the directory
# the archive is in.
#
# REPRODUCIBILITY is the point. The checksum is committed from a
# workflow_dispatch build BEFORE the tag exists, and the tag's own build has to
# produce the same bytes or the pin is worthless. rust-toolchain.toml is the
# compiler half of that promise; this script is the packaging half. So every
# input that varies by accident is pinned here: entry mtime, uid, gid, owner
# names, modes, entry order, and a gzip header carrying neither a filename nor
# a timestamp. Nothing is read from the clock, the environment or the umask.
#
# The archive is built by python3's `tarfile` rather than by `tar`, because
# GitHub's Linux runners carry GNU tar and its macOS runners carry bsdtar,
# which has no `--sort` and no `--mtime`; python3 is on every runner image and
# takes the same metadata on both. What this does NOT promise is identical
# bytes across two different runner images: zlib's deflate output is allowed to
# differ between implementations. Each target builds on one runner label, so
# the dispatch build and the tag build of a given target agree, which is the
# property the pin actually needs.

set -eu

if [ "$#" -ne 3 ]; then
    echo "usage: $0 <binary> <name> <outdir>" >&2
    exit 2
fi

binary=$1
name=$2
outdir=$3

# The name reaches this script from a workflow expression and becomes both a
# filename and a path INSIDE the archive, so it is checked before it is used
# rather than trusted. One path segment of ordinary characters: no separator,
# no `..` to climb out of an extraction directory, no leading `-` that a later
# command would read as an option.
case "$name" in
    '' | . | .. | -* | */* | *[!A-Za-z0-9._-]*)
        echo "$0: archive name must be one plain path segment, got: $name" >&2
        exit 2
        ;;
esac

if [ ! -f "$binary" ]; then
    echo "$0: no such binary: $binary" >&2
    exit 1
fi

# Resolved from this script's own location, not from the working directory, so
# the archive carries THIS repository's licence however the job invoked it.
license="$(dirname "$0")/../../LICENSE"
if [ ! -f "$license" ]; then
    echo "$0: no LICENSE at $license" >&2
    exit 1
fi

mkdir -p "$outdir"

python3 - "$binary" "$license" "$name" "$outdir" <<'PY'
import gzip
import io
import os
import sys
import tarfile

binary, license_path, name, outdir = sys.argv[1:5]
archive = os.path.join(outdir, name + ".tar.gz")


def add(tar, arcname, source, mode):
    """Add one file under metadata this script chooses, never the file's own.

    Everything a tar header can carry from the filesystem varies between a
    developer's machine, a Linux runner and a macOS runner: mtime, owner ids,
    owner names, and the permission bits a umask left behind. Each is stated
    here instead.
    """
    info = tarfile.TarInfo(arcname)
    info.type = tarfile.REGTYPE
    info.size = os.path.getsize(source)
    info.mtime = 0
    info.mode = mode
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    with open(source, "rb") as handle:
        tar.addfile(info, handle)


# Built in memory so the gzip wrapper below is the only thing that touches the
# output file, and written in a fixed order: a tar is a sequence, so the order
# entries are added in is part of the bytes.
raw = io.BytesIO()
with tarfile.open(fileobj=raw, mode="w", format=tarfile.GNU_FORMAT) as tar:
    add(tar, name + "/cadence", binary, 0o755)
    add(tar, name + "/LICENSE", license_path, 0o644)

# `filename=""` keeps the source name out of the gzip header and `mtime=0`
# keeps the clock out of it; both are fields gzip writes by default and both
# would make two identical archives compare unequal.
with open(archive, "wb") as out:
    with gzip.GzipFile(
        filename="", mode="wb", fileobj=out, mtime=0, compresslevel=9
    ) as gz:
        gz.write(raw.getvalue())
PY

# Printed from inside the output directory so the line names the archive by its
# bare filename, which is what `sha256sum -c` expects to find beside it.
# macOS has no `sha256sum`; `shasum -a 256` prints the identical format.
if command -v sha256sum >/dev/null 2>&1; then
    (cd "$outdir" && sha256sum "$name.tar.gz")
else
    (cd "$outdir" && shasum -a 256 "$name.tar.gz")
fi
