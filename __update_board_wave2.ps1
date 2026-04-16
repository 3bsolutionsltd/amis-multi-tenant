# ============================================================
# AMIS Build Tracker — Mark Wave-2 issues as Done
# Usage: $env:GITHUB_TOKEN = "ghp_xxx" ; .\__update_board_wave2.ps1
# ============================================================

$TOKEN = $env:GITHUB_TOKEN
if (-not $TOKEN) { Write-Error "Set `$env:GITHUB_TOKEN first"; exit 1 }

$HEADERS = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

function GQL($query, $vars) {
  $body = @{ query = $query; variables = $vars } | ConvertTo-Json -Depth 10
  $r = Invoke-RestMethod -Uri "https://api.github.com/graphql" `
                         -Method POST -Headers $HEADERS -Body $body
  if ($r.errors) { Write-Warning ($r.errors | ConvertTo-Json); return $null }
  return $r.data
}

# ── Step 1: Use known project node ID ────────────────────────────────────────
Write-Host "`n[1] Using AMIS Build Tracker (PVT_kwHODNsZL84BUPC_) …" -ForegroundColor Cyan
$projectId = "PVT_kwHODNsZL84BUPC_"
Write-Host "  Project ID: $projectId" -ForegroundColor Green

# ── Step 2: Discover Status field + Done option ───────────────────────────────
Write-Host "`n[2] Fetching Status field …" -ForegroundColor Cyan

$fieldData = GQL @"
query(`$pid: ID!) {
  node(id: `$pid) {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField { id name options { id name } }
          ... on ProjectV2Field { id name }
        }
      }
    }
  }
}
"@ @{ pid = $projectId }

$statusField = $fieldData.node.fields.nodes |
               Where-Object { $_.name -eq "Status" } |
               Select-Object -First 1

$doneOption = $statusField.options | Where-Object { $_.name -eq "Done" } | Select-Object -First 1
if (-not $doneOption) { $doneOption = $statusField.options | Where-Object { $_.name -like "*Done*" } | Select-Object -First 1 }

Write-Host "  Status field: $($statusField.id)"
Write-Host "  'Done' option: $($doneOption.id) ($($doneOption.name))" -ForegroundColor Green

# ── Step 3: Collect Wave-2 issue item IDs (#13, #14, #15, #16) ───────────────
Write-Host "`n[3] Finding project items for issues #13, #14, #15, #16 …" -ForegroundColor Cyan

$TARGET_ISSUES = @(13, 14, 15, 16)

$itemsData = GQL @"
query(`$pid: ID!) {
  node(id: `$pid) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue { number title }
          }
        }
      }
    }
  }
}
"@ @{ pid = $projectId }

$itemsToUpdate = $itemsData.node.items.nodes | Where-Object {
  $_.content.number -in $TARGET_ISSUES
}

Write-Host "  Found $($itemsToUpdate.Count) matching items"

# ── Step 4: Update each item to Done ─────────────────────────────────────────
Write-Host "`n[4] Updating items to 'Done' …" -ForegroundColor Cyan

foreach ($item in $itemsToUpdate) {
  $issueNum = $item.content.number
  Write-Host "  Updating #$issueNum '$($item.content.title)' …" -NoNewline

  $result = GQL @"
mutation(`$pid: ID!, `$itemId: ID!, `$fieldId: ID!, `$optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: `$pid
    itemId: `$itemId
    fieldId: `$fieldId
    value: { singleSelectOptionId: `$optionId }
  }) {
    projectV2Item { id }
  }
}
"@ @{
    pid      = $projectId
    itemId   = $item.id
    fieldId  = $statusField.id
    optionId = $doneOption.id
  }

  if ($result) { Write-Host " ✅" -ForegroundColor Green }
  else         { Write-Host " ❌ (check warnings above)" -ForegroundColor Red }
}

Write-Host "`nDone! Wave-2 issues #13 #14 #15 #16 → Status: Done`n" -ForegroundColor Cyan
