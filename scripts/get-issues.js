const https = require('https');

const token = process.env.GH_TOKEN;

// Remaining Todo issues based on project board
const issueNumbers = [58, 59, 60, 61, 63, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 79, 80, 81];

function getIssue(num) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/3bsolutionsltd/amis-multi-tenant/issues/${num}`,
      method: 'GET',
      headers: {
        'Authorization': 'bearer ' + token,
        'User-Agent': 'AMIS',
        'Accept': 'application/vnd.github.v3+json',
      }
    };
    const req = https.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(b);
          resolve({ num, title: j.title, labels: (j.labels || []).map(l => l.name), body: (j.body || '').substring(0, 400) });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  for (const num of issueNumbers) {
    const issue = await getIssue(num);
    console.log(`\n=== #${issue.num}: ${issue.title} [${issue.labels.join(', ')}] ===`);
    console.log(issue.body);
  }
})();
