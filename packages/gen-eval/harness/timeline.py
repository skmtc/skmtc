#!/usr/bin/env python3
"""Turn-by-turn progress view over a Claude Code stream-json feed.

Usage:
  ... | python3 timeline.py --tee <timeline.md>   # live: stdin -> terminal + file
  python3 timeline.py <transcript.jsonl>          # post-hoc render to stdout

One line per action, stamped with elapsed time and turn number.
Milestones (skill loaded, generator files written, first clean
generate, tests green) are tagged so a skim shows the arc of the run.
"""
import json
import sys
import time
import re

MILESTONE_FILES = ('base.ts', 'mod.ts', 'enrichments.ts')


class Timeline:
    def __init__(self, out_path=None):
        self.start = time.monotonic()
        self.turn = 0
        self.tool_names = {}     # tool_use_id -> label
        self.seen_milestones = set()
        self.out = open(out_path, 'w') if out_path else None
        if self.out:
            self.out.write('# Run timeline\n\n```\n')

    def elapsed(self):
        seconds = int(time.monotonic() - self.start)
        return f"{seconds // 60:02d}:{seconds % 60:02d}"

    def emit(self, text):
        line = f"[{self.elapsed()} t{self.turn:03d}] {text}"
        print(line, flush=True)
        if self.out:
            self.out.write(line + '\n')
            self.out.flush()

    def milestone(self, key, text):
        if key not in self.seen_milestones:
            self.seen_milestones.add(key)
            self.emit(f"*** MILESTONE: {text}")

    def handle_tool_use(self, item):
        name = item.get('name', '?')
        tool_input = item.get('input') or {}
        label = name
        if name == 'Skill':
            skill = tool_input.get('skill', '?')
            label = f"Skill: {skill}"
            if 'skmtc' in skill:
                self.milestone(f"skill:{skill}", f"loaded {skill} skill")
        elif name in ('Write', 'Edit', 'MultiEdit', 'Read'):
            path = tool_input.get('file_path', '?')
            short = '/'.join(path.split('/')[-3:])
            label = f"{name}: {short}"
            if name in ('Write', 'Edit'):
                for marker in MILESTONE_FILES:
                    if path.endswith(f"src/{marker}") and 'gen-' in path:
                        self.milestone(f"write:{marker}", f"generator src/{marker} written")
        elif name == 'Bash':
            command = re.sub(r'\s+', ' ', tool_input.get('command', ''))[:90]
            label = f"Bash: {command}"
            for marker, text in (
                ('skmtc bundle', 'first bundle attempt'),
                ('skmtc generate', 'first generate attempt'),
                ('gradle test', 'first test attempt'),
            ):
                if marker in command:
                    self.milestone(f"cmd:{marker}", text)
        elif name in ('Grep', 'Glob'):
            label = f"{name}: {tool_input.get('pattern', tool_input.get('query', ''))[:60]}"
        else:
            compact = json.dumps(tool_input)[:70]
            label = f"{name}: {compact}"
        self.tool_names[item.get('id')] = label
        self.emit(label)

    def handle_event(self, event):
        kind = event.get('type')
        if kind == 'system' and event.get('subtype') == 'init':
            self.emit(f"session start — model {event.get('model', '?')}")
            return
        if kind == 'assistant':
            content = (event.get('message') or {}).get('content') or []
            bumped = False
            for item in content:
                if not isinstance(item, dict):
                    continue
                if not bumped and item.get('type') in ('text', 'tool_use', 'thinking'):
                    self.turn += 1
                    bumped = True
                if item.get('type') == 'thinking':
                    self.emit(f"thinking ({len(item.get('thinking', ''))} chars)")
                elif item.get('type') == 'text':
                    text = re.sub(r'\s+', ' ', item.get('text', '')).strip()
                    if text:
                        self.emit(f"say: {text[:110]}")
                elif item.get('type') == 'tool_use':
                    self.handle_tool_use(item)
        elif kind == 'user':
            content = (event.get('message') or {}).get('content') or []
            for item in content:
                if isinstance(item, dict) and item.get('type') == 'tool_result':
                    if item.get('is_error'):
                        label = self.tool_names.get(item.get('tool_use_id'), '?')
                        raw = item.get('content')
                        if isinstance(raw, list):
                            raw = ' '.join(
                                part.get('text', '') for part in raw if isinstance(part, dict)
                            )
                        snippet = re.sub(r'\s+', ' ', str(raw or ''))[:90]
                        self.emit(f"  !! error <- {label}: {snippet}")
                    else:
                        # success milestones from tool output
                        raw = item.get('content')
                        if isinstance(raw, list):
                            raw = ' '.join(
                                part.get('text', '') for part in raw if isinstance(part, dict)
                            )
                        text = str(raw or '')
                        if '"type": "generated"' in text or '"type":"generated"' in text:
                            if '"errors": []' in text or '"errors":[]' in text:
                                self.milestone('generate-ok', 'clean generate (no errors)')
                        if 'BUILD SUCCESSFUL' in text:
                            self.milestone('gradle-ok', 'gradle BUILD SUCCESSFUL')
        elif kind == 'result':
            cost = event.get('total_cost_usd')
            cost_text = f" cost=${cost:.2f}" if cost is not None else ''
            self.emit(
                f"done — turns={event.get('num_turns')}{cost_text} error={event.get('is_error')}"
            )

    def close(self):
        if self.out:
            self.out.write('```\n')
            self.out.close()


def main():
    args = sys.argv[1:]
    if args and args[0] == '--tee':
        timeline = Timeline(out_path=args[1] if len(args) > 1 else None)
        source = sys.stdin
    else:
        timeline = Timeline()
        source = open(args[0]) if args else sys.stdin

    try:
        for line in source:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            try:
                timeline.handle_event(event)
            except Exception as error:  # never kill the pipe mid-run
                print(f"[timeline error: {error}]", file=sys.stderr)
    finally:
        timeline.close()


if __name__ == '__main__':
    main()
