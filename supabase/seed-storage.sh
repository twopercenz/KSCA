#!/usr/bin/env bash
# Uploads a minimal placeholder PDF to every seed paper's storage path so
# the signed-download flow works against seeded data too.
# Run AFTER `supabase start` (and after `supabase db reset` has applied seed.sql).
set -euo pipefail

STATUS=$(npx supabase status -o json)
API_URL=$(echo "$STATUS" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).API_URL")
SERVICE_KEY=$(echo "$STATUS" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).SERVICE_ROLE_KEY")

PDF_PATH="$(mktemp).pdf"
printf '%%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF' > "$PDF_PATH"

for path in seed/rl-intro-v1.pdf seed/rl-intro-v2.pdf seed/nutrition-analysis-v1.pdf; do
  curl -s -X POST "$API_URL/storage/v1/object/papers/$path" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/pdf" \
    --data-binary "@$PDF_PATH" > /dev/null
  echo "uploaded $path"
done

rm -f "$PDF_PATH"
