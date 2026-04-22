const https = require('https');

const token = process.env.GH_TOKEN;
const PROJECT_ID = 'PVT_kwHODNsZL84BUPC_';
const STATUS_FIELD_ID = 'PVTSSF_lAHODNsZL84BUPC_zhBYnDg';
const DONE_OPTION_ID = '98236657';

// Issues to mark Done: #74, #75
const ITEM_IDS = [
  'PVTI_lAHODNsZL84BUPC_zgqVwHk', // #74
  'PVTI_lAHODNsZL84BUPC_zgqVwH4', // #75
];

function markDone(itemId) {
  return new Promise((resolve, reject) => {
    const mutation = `mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}"
        itemId: "${itemId}"
        fieldId: "${STATUS_FIELD_ID}"
        value: { singleSelectOptionId: "${DONE_OPTION_ID}" }
      }) {
        projectV2Item { id }
      }
    }`;
    const body = JSON.stringify({ query: mutation });
    const opts = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': 'bearer ' + token,
        'User-Agent': 'AMIS',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (j.errors) reject(new Error(JSON.stringify(j.errors)));
          else resolve(j);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const issueNums = [74, 75];
  for (let i = 0; i < ITEM_IDS.length; i++) {
    try {
      await markDone(ITEM_IDS[i]);
      console.log(`✓ #${issueNums[i]} marked Done`);
    } catch (e) {
      console.error(`✗ #${issueNums[i]} failed: ${e.message}`);
    }
  }
})();
