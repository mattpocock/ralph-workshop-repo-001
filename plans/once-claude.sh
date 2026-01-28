#!/bin/bash

set -e

ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

claude --permission-mode acceptEdits "@plans/prompt.md Previous RALPH commits: $ralph_commits"
