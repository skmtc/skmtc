#!/usr/bin/env python3
"""Bake a self-contained in-browser run viewer.

Usage:
  python3 viewer.py <run-dir>            # reads transcript.jsonl (+meta.json)
                                         # writes <run-dir>/viewer.html
  python3 viewer.py --template out.html  # standalone viewer (drag-drop mode)

The generated page has no external dependencies — open it from disk.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
TEMPLATE = (HERE / 'viewer.template.html').read_text()


def escape_for_script(payload: str) -> str:
    return payload.replace('</', '<\\/')


def main() -> None:
    args = sys.argv[1:]
    if args and args[0] == '--template':
        out = Path(args[1] if len(args) > 1 else 'viewer.html')
        out.write_text(TEMPLATE.replace('__DATA__', 'null').replace('__META__', 'null'))
        print(f'wrote {out} (standalone drag-drop mode)')
        return

    run_dir = Path(args[0] if args else '.')
    transcript_path = run_dir / 'transcript.jsonl'
    if not transcript_path.exists():
        print(f'no transcript.jsonl in {run_dir}', file=sys.stderr)
        raise SystemExit(1)

    lines = []
    with open(transcript_path) as transcript:
        for line in transcript:
            line = line.strip()
            if not line:
                continue
            try:
                lines.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    meta = None
    meta_path = run_dir / 'meta.json'
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError:
            pass

    html = TEMPLATE.replace('__DATA__', escape_for_script(json.dumps(lines)))
    html = html.replace('__META__', escape_for_script(json.dumps(meta)))
    out = run_dir / 'viewer.html'
    out.write_text(html)
    print(f'wrote {out} ({len(lines)} events)')
    print(f'view:  file://{out.resolve()}')


if __name__ == '__main__':
    main()
