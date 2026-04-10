const { execSync } = require('child_process');
try {
  console.log('Adding files...');
  execSync('git add frontend backend push.js');
  console.log('Committing files...');
  execSync('git commit -m "fix(auth): estandarizacion a email, token revocation y fixes de excel"');
  console.log('Pushing to remote...');
  execSync('git push');
  console.log('Success!');
} catch(e) {
  console.log('Error:', e.message);
  if (e.stdout) console.log(e.stdout.toString('utf8'));
  if (e.stderr) console.log(e.stderr.toString('utf8'));
}
