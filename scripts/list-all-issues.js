const https = require('https');
const token = process.env.GH_TOKEN;
const opts = {
  hostname: 'api.github.com',
  path: '/repos/3bsolutionsltd/amis-multi-tenant/issues?state=all&per_page=100&sort=created&direction=desc',
  headers: {
    'Authorization': 'bearer ' + token,
    'User-Agent': 'AMIS',
    'Accept': 'application/vnd.github+json'
  }
};
https.get(opts, res => {
  let b = '';
  res.on('data', d => b += d);
  res.on('end', () => {
    const issues = JSON.parse(b);
    issues.forEach(i => console.log(i.number + ' [' + i.state + ']: ' + i.title));
  });
});
