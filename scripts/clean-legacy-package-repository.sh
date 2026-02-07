#!/bin/bash

# Disable pager for gh commands
export GH_PAGER=""

# Organization name
ORG="shard-for-obsidian"

# Base package path (will match legacy, legacy/*, legacy/*/*, etc.)
BASE_PATH="shard"

echo "Fetching all container packages for organization ${ORG}..."

# Get all container packages and filter for ones matching the base path
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/orgs/${ORG}/packages?package_type=container" \
  --paginate \
  --jq '.[] | select(.name == "'${BASE_PATH}'" or (.name | startswith("'${BASE_PATH}'/")) ) | .name' > /tmp/package_names.txt

PACKAGE_COUNT=$(wc -l < /tmp/package_names.txt | tr -d ' ')

if [ "$PACKAGE_COUNT" -eq 0 ]; then
  echo "No packages found matching '${BASE_PATH}' or '${BASE_PATH}/*'"
  exit 0
fi

echo "Found ${PACKAGE_COUNT} package(s) to delete:"
cat /tmp/package_names.txt
echo ""

# Prompt for confirmation
read -p "Are you sure you want to delete all these packages and their versions? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelled."
  rm -f /tmp/package_names.txt
  exit 0
fi

echo ""

# Process each package
PACKAGE_NUM=0
while read -r PACKAGE_NAME; do
  PACKAGE_NUM=$((PACKAGE_NUM + 1))
  echo "=========================================="
  echo "Deleting package ${PACKAGE_NUM}/${PACKAGE_COUNT}: ${PACKAGE_NAME}"
  echo "=========================================="
  
  # URL-encode the package name (replace / with %2F)
  ENCODED_PACKAGE_NAME="${PACKAGE_NAME//\//%2F}"
  
  # Delete the entire package (this will cascade and delete all versions)
  gh api \
    --method DELETE \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/orgs/${ORG}/packages/container/${ENCODED_PACKAGE_NAME}" \
    && echo "✓ Deleted package ${PACKAGE_NAME}" \
    || echo "✗ Failed to delete package ${PACKAGE_NAME}"
  
  echo ""
done < /tmp/package_names.txt

# Clean up temp files
rm -f /tmp/package_names.txt

echo "=========================================="
echo "All done! Deleted ${PACKAGE_NUM} package(s)"
echo "=========================================="