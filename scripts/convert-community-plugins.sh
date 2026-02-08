#!/bin/bash
set -euo pipefail

# Configuration
COMMUNITY_PLUGINS_URL="https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"
REGISTRY_BASE="ghcr.io/shard-for-obsidian/shard/community"
SHARD_CLI="node packages/shard-cli/dist/index.js"  # Relative to repo root
LOG_DIR="./conversion-logs"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN environment variable not set${NC}"
    echo "Please set it with: export GITHUB_TOKEN=ghp_your_token_here"
    exit 1
fi

# Check if shard CLI is built
if [ ! -f "$SHARD_CLI" ]; then
    echo -e "${RED}Error: Shard CLI not found at $SHARD_CLI${NC}"
    echo "Please build it first with: pnpm build"
    exit 1
fi

# Create log directory
mkdir -p "$LOG_DIR"

# Fetch community plugins list
echo -e "${BLUE}Fetching community plugins list...${NC}"
PLUGINS_JSON=$(curl -s "$COMMUNITY_PLUGINS_URL")

if [ -z "$PLUGINS_JSON" ]; then
    echo -e "${RED}Error: Failed to fetch community plugins list${NC}"
    exit 1
fi

# Count total plugins
TOTAL_PLUGINS=$(echo "$PLUGINS_JSON" | jq length)
echo -e "${GREEN}Found $TOTAL_PLUGINS plugins to convert${NC}"
echo ""

# Initialize counters
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Function to convert a single plugin
convert_plugin() {
    local plugin_id="$1"
    local plugin_name="$2"
    local plugin_repo="$3"
    local index="$4"
    local total="$5"

    local repository="${REGISTRY_BASE}/${plugin_id}"
    local log_file="${LOG_DIR}/${plugin_id}.log"

    echo -e "${YELLOW}[$index/$total]${NC} Converting: ${plugin_name} (${plugin_id})"
    echo "  Repository: ${repository}"

    # Try to convert the plugin
    if $SHARD_CLI convert "$plugin_id" "$repository" --token "$GITHUB_TOKEN" > "$log_file" 2>&1; then
        echo -e "  ${GREEN}✓ Success${NC}"
        ((SUCCESS_COUNT++))
        return 0
    else
        echo -e "  ${RED}✗ Failed${NC} (see ${log_file})"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Main conversion loop
echo "Starting conversion..."
echo "===================="
echo ""

INDEX=0
while IFS= read -r plugin; do
    ((INDEX++))

    # Extract plugin details
    PLUGIN_ID=$(echo "$plugin" | jq -r '.id')
    PLUGIN_NAME=$(echo "$plugin" | jq -r '.name')
    PLUGIN_REPO=$(echo "$plugin" | jq -r '.repo')

    # Skip if any field is missing
    if [ "$PLUGIN_ID" = "null" ] || [ "$PLUGIN_NAME" = "null" ]; then
        echo -e "${YELLOW}[$INDEX/$TOTAL_PLUGINS]${NC} Skipping invalid entry"
        ((SKIP_COUNT++))
        continue
    fi

    # Convert the plugin
    convert_plugin "$PLUGIN_ID" "$PLUGIN_NAME" "$PLUGIN_REPO" "$INDEX" "$TOTAL_PLUGINS" || true

    # Small delay to avoid rate limiting
    sleep 1

done < <(echo "$PLUGINS_JSON" | jq -c '.[]')

# Print summary
echo ""
echo "===================="
echo "Conversion Complete"
echo "===================="
echo -e "${GREEN}Success: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed:  $FAIL_COUNT${NC}"
echo -e "${YELLOW}Skipped: $SKIP_COUNT${NC}"
echo ""
echo "Logs saved to: $LOG_DIR"

# Exit with error code if any failed
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
fi
