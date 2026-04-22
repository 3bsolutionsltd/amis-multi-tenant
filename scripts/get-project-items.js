const https = require('https');

const token = process.env.GH_TOKEN;
const body = JSON.stringify({
  query: `query {
    node(id: "PVT_kwHODNsZL84BUPC_") {
      ... on ProjectV2 {
        items(first: 80) {
          nodes {
            id
            content {
              ... on Issue { number title }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
              }
            }
          }
        }
      }
    }
  }`
});

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
      const items = j.data?.node?.items?.nodes ?? [];
      items.forEach(n => {
        const s = (n.fieldValues?.nodes ?? []).find(f => f.field?.name === 'Status');
        console.log(n.id + '|' + (n.content?.number ?? 'N/A') + '|' + (s?.name || '?'));
      });
    } catch (e) {
      console.error('Parse error:', e.message);
      console.error(b.substring(0, 500));
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(body);
req.end();
