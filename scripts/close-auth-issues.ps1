$token = (Get-Content "C:\Users\DELL\.github-token" -Raw).Trim()
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
    "Accept"        = "application/vnd.github+json"
}

# Close issues 109-113 via REST
foreach ($num in @(109, 110, 111, 112, 113)) {
    $body = '{"state":"closed","state_reason":"completed"}'
    $r = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/3bsolutionsltd/amis-multi-tenant/issues/$num" `
        -Method PATCH `
        -Headers $headers `
        -Body $body
    Write-Host "Closed #$num -> $($r.state)"
}

# Mark items Done in Project #5
# Status field: PVTSSF_lAHODNsZL84BUPC_zhBYnDg  Done option: 98236657
$itemIds = @(
    "PVTI_lAHODNsZL84BUPC_zgsWue8",
    "PVTI_lAHODNsZL84BUPC_zgsWugQ",
    "PVTI_lAHODNsZL84BUPC_zgsWuhc",
    "PVTI_lAHODNsZL84BUPC_zgsWuh8",
    "PVTI_lAHODNsZL84BUPC_zgsWujM"
)

foreach ($itemId in $itemIds) {
    $mutation = @"
{
  "query": "mutation { updateProjectV2ItemFieldValue(input: { projectId: \"PVT_kwHODNsZL84BUPC_\", itemId: \"$itemId\", fieldId: \"PVTSSF_lAHODNsZL84BUPC_zhBYnDg\", value: { singleSelectOptionId: \"98236657\" } }) { projectV2Item { id } } }"
}
"@
    $r = Invoke-RestMethod `
        -Uri "https://api.github.com/graphql" `
        -Method POST `
        -Headers $headers `
        -Body $mutation
    if ($r.errors) {
        Write-Host "Error for item $itemId`: $($r.errors[0].message)"
    } else {
        Write-Host "Marked Done: $itemId"
    }
}
