#!/bin/bash

set -e

# Rebase all local branches to main and push with confirmation
# Usage: ./rebase-and-push.sh

CURRENT_BRANCH=$(git branch --show-current)

# Get all local branches except main
mapfile -t BRANCHES < <(git branch --format='%(refname:short)' | grep -v '^main$')

if [ ${#BRANCHES[@]} -eq 0 ]; then
  echo "No branches to rebase (only main exists)"
  exit 0
fi

echo "Found ${#BRANCHES[@]} branch(es): ${BRANCHES[*]}"

echo "Fetching latest main..."
git fetch origin main

echo ""
echo "=== Checking branches ==="

for branch in "${BRANCHES[@]}"; do
  if ! git rev-parse --verify "$branch" &>/dev/null; then
    echo "ERROR: Branch '$branch' does not exist"
    exit 1
  fi

  # Check if branch is already rebased on main
  MERGE_BASE=$(git merge-base origin/main "$branch")
  MAIN_HEAD=$(git rev-parse origin/main)

  if [ "$MERGE_BASE" = "$MAIN_HEAD" ]; then
    echo "✓ $branch - already rebased on main"
  else
    echo "✗ $branch - needs rebase"
  fi
done

echo ""
read -p "Proceed with rebasing? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "=== Rebasing branches ==="

for branch in "${BRANCHES[@]}"; do
  MERGE_BASE=$(git merge-base origin/main "$branch")
  MAIN_HEAD=$(git rev-parse origin/main)

  if [ "$MERGE_BASE" = "$MAIN_HEAD" ]; then
    echo "Skipping $branch - already rebased"
    continue
  fi

  echo "Rebasing $branch onto main..."
  git checkout "$branch"
  git rebase origin/main
  echo "✓ $branch rebased"
done

# Return to original branch
git checkout "$CURRENT_BRANCH"

echo ""
echo "=== Ready to push ==="

for branch in "${BRANCHES[@]}"; do
  echo ""
  read -p "Push $branch? (y/n/q to quit) " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Qq]$ ]]; then
    echo "Stopped."
    exit 0
  fi

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pushing $branch..."
    git push origin "$branch" --force-with-lease
    echo "✓ $branch pushed"
  else
    echo "Skipped $branch"
  fi
done

echo ""
echo "Done!"
