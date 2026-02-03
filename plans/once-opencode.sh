#!/bin/bash

set -e

issues=""
if [ -d "issues" ]; then
  for f in issues/*.md; do
    [ -f "$f" ] && issues+="--- $(basename "$f") ---
$(cat "$f")

"
  done
fi

ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

# TODO: Unsure if this works fully, double-check
opencode run "@plans/prompt.md ISSUES: $issues Previous RALPH commits: $ralph_commits"
