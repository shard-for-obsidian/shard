#!/bin/bash
set -euo pipefail

# Configuration
COMMUNITY_PLUGINS_URL="https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"
REGISTRY_BASE="ghcr.io/shard-for-obsidian/shard/community"
OUTPUT_DIR="./apps/marketplace/content/plugins"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Fetch community plugins list
echo -e "${BLUE}Fetching community plugins list...${NC}"
PLUGINS_JSON=$(curl -s "$COMMUNITY_PLUGINS_URL")

if [ -z "$PLUGINS_JSON" ]; then
    echo -e "${RED}Error: Failed to fetch community plugins list${NC}"
    exit 1
fi

# Count total plugins
TOTAL_PLUGINS=$(echo "$PLUGINS_JSON" | jq length)
echo -e "${GREEN}Found $TOTAL_PLUGINS plugins${NC}"
echo ""

# Initialize counters
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Function to generate markdown for a single plugin
generate_markdown() {
    local plugin_id="$1"
    local plugin_name="$2"
    local plugin_author="$3"
    local plugin_description="$4"
    local plugin_repo="$5"
    local index="$6"
    local total="$7"

    local registry_url="${REGISTRY_BASE}/${plugin_id}"
    local output_file="${OUTPUT_DIR}/${plugin_id}.md"
    local repo_url="https://github.com/${plugin_repo}"

    echo -e "${YELLOW}[$index/$total]${NC} Processing: ${plugin_name} (${plugin_id})"

    # Check if file already exists
    if [ -f "$output_file" ]; then
        echo -e "  ${BLUE}ℹ Already exists, skipping${NC}"
        ((SKIP_COUNT++))
        return 0
    fi

    # Escape values for YAML (quote if contains special characters)
    # Using jq to properly escape and quote YAML values
    local yaml_name=$(echo -n "$plugin_name" | jq -Rs .)
    local yaml_author=$(echo -n "$plugin_author" | jq -Rs .)
    local yaml_description=$(echo -n "$plugin_description" | jq -Rs .)

    # Generate the markdown content with frontmatter from community plugins list
    cat > "$output_file" <<EOF
---
id: ${plugin_id}
registryUrl: ${registry_url}
name: ${yaml_name}
author: ${yaml_author}
description: ${yaml_description}
repository: ${repo_url}
---

${plugin_description}
EOF

    echo -e "  ${GREEN}✓ Created${NC}"
    ((SUCCESS_COUNT++))
    return 0
}

# Main generation loop
echo "Generating markdown files..."
echo "===================="
echo ""

INDEX=0
while IFS= read -r plugin; do
    ((INDEX++))

    # Extract plugin details
    PLUGIN_ID=$(echo "$plugin" | jq -r '.id')
    PLUGIN_NAME=$(echo "$plugin" | jq -r '.name')
    PLUGIN_AUTHOR=$(echo "$plugin" | jq -r '.author')
    PLUGIN_DESCRIPTION=$(echo "$plugin" | jq -r '.description')
    PLUGIN_REPO=$(echo "$plugin" | jq -r '.repo')

    # Skip if any required field is missing
    if [ "$PLUGIN_ID" = "null" ] || [ "$PLUGIN_NAME" = "null" ]; then
        echo -e "${YELLOW}[$INDEX/$TOTAL_PLUGINS]${NC} Skipping invalid entry"
        ((SKIP_COUNT++))
        continue
    fi

    # Generate the markdown
    generate_markdown "$PLUGIN_ID" "$PLUGIN_NAME" "$PLUGIN_AUTHOR" "$PLUGIN_DESCRIPTION" "$PLUGIN_REPO" "$INDEX" "$TOTAL_PLUGINS" || {
        echo -e "  ${RED}✗ Failed${NC}"
        ((FAIL_COUNT++))
    }

    # Small delay to avoid rate limiting
    sleep 0.1

done < <(echo "$PLUGINS_JSON" | jq -c '.[]')

# Print summary
echo ""
echo "===================="
echo "Generation Complete"
echo "===================="
echo -e "${GREEN}Created: $SUCCESS_COUNT${NC}"
echo -e "${BLUE}Skipped: $SKIP_COUNT${NC}"
echo -e "${RED}Failed:  $FAIL_COUNT${NC}"
echo ""
echo "Files saved to: $OUTPUT_DIR"
