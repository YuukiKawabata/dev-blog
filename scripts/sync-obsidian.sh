#!/bin/bash

# Exit on error
set -e

echo "🔄 Syncing blog posts from Obsidian..."

# Define paths
# Note: Space in "YukiKawabata " is handled by quotes
OBSIDIAN_DIR="/Users/yuki/Library/Mobile Documents/iCloud~md~obsidian/Documents/YukiKawabata /個人/記事/published"
BLOG_DIR="src/content/blog"

# Check if Obsidian directory exists
if [ ! -d "$OBSIDIAN_DIR" ]; then
  echo "❌ Error: Obsidian directory not found at $OBSIDIAN_DIR"
  exit 1
fi

# Ensure blog directory exists
mkdir -p "$BLOG_DIR"

# Sync files (from Obsidian to Blog)
# -a: archive mode
# -v: verbose
# --delete: delete files in Blog that are no longer in Obsidian
rsync -av --delete "$OBSIDIAN_DIR/" "$BLOG_DIR/"

echo "✅ Sync complete!"
