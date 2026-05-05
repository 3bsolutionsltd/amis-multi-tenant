/**
 * Close issues #99–#103 on GitHub and mark them Done in the project board.
 *
 * Usage: GH_TOKEN=$(cat ~/.github-token) node scripts/close-issues-99-103.js
 */

const https = require('https');
const fs = require('fs');

// Read token
const token = process.env.GH_TOKEN ||
  (fs.existsSync('C:\\Users\\DELL\\.github-token')
    ? fs.readFileSync('C:\\Users\\DELL\\.github-token', 'utf8').trim()
    : null);

if (!token) {
  console.error('GH_TOKEN not set and ~/.github-token not found');
  process.exit(1);
}

const OWNER = '3bsolutionsltd';
const REPO  = 'amis-multi-tenant';
const PROJECT_ID      = 'PVT_kwHODNsZL84BUPC_';
const STATUS_FIELD_ID = 'PVTSSF_lAHODNsZL84BUPC_zhBYnDg';
const DONE_OPTION_ID  = '98236657';

const ISSUE_NUMBERS = [99, 100, 101, 102, 103];

function restRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'AMIS',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: b ? JSON.parse(b) : null }); }
        catch (e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function graphql(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const opts = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'User-Agent': 'AMIS',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (j.errors) reject(new Error(JSON.stringify(j.errors)));
          else resolve(j.data);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getProjectItemId(issueNumber) {
  const data = await graphql(`
    query {
      repository(owner: "${OWNER}", name: "${REPO}") {
        issue(number: ${issueNumber}) {
          id
          projectItems(first: 5) {
            nodes {
              id
              project { id }
            }
          }
        }
      }
    }
  `);
  const items = data.repository.issue.projectItems.nodes;
  const item = items.find((n) => n.project.id === PROJECT_ID);
  return item ? item.id : null;
}

async function markDone(itemId) {
  await graphql(`
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}"
        itemId: "${itemId}"
        fieldId: "${STATUS_FIELD_ID}"
        value: { singleSelectOptionId: "${DONE_OPTION_ID}" }
      }) {
        projectV2Item { id }
      }
    }
  `);
}

async function closeIssue(issueNumber) {
  const result = await restRequest(
    'PATCH',
    `/repos/${OWNER}/${REPO}/issues/${issueNumber}`,
    { state: 'closed', state_reason: 'completed' }
  );
  return result.status;
}

(async () => {
  for (const num of ISSUE_NUMBERS) {
    try {
      // 1. Close the issue on GitHub
      const status = await closeIssue(num);
      if (status === 200) {
        console.log(`✓ Issue #${num} closed`);
      } else {
        console.warn(`⚠ Issue #${num} close returned HTTP ${status}`);
      }

      // 2. Mark Done on the project board
      const itemId = await getProjectItemId(num);
      if (itemId) {
        await markDone(itemId);
        console.log(`✓ Issue #${num} marked Done on project board`);
      } else {
        console.warn(`⚠ Issue #${num} not found in project board — mark manually`);
      }
    } catch (err) {
      console.error(`✗ Issue #${num} failed: ${err.message}`);
    }
  }
  console.log('\nDone.');
})();
