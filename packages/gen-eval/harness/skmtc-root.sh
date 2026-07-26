# Sourced by run.sh / seed.sh / gates.sh / preflight.sh after they set
# HARNESS_DIR. Single source for the workspace-root derivation:
# SKMTC_ROOT = parent of the MAIN skmtc checkout, derived via git so
# harness runs from a linked worktree resolve correctly (the plain
# ../../../.. default landed inside .claude/worktrees/). An exported
# SKMTC_ROOT still overrides.
SKMTC_ROOT=${SKMTC_ROOT:-$(dirname "$(git -C "$HARNESS_DIR" worktree list --porcelain | head -1 | cut -d' ' -f2-)")}
