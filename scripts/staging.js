const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const script = path.join(__dirname, 'staging.sh');

if (!fs.existsSync(gitBash)) {
  console.error('Git Bash not found at:', gitBash);
  console.error('Install Git for Windows from https://git-scm.com');
  process.exit(1);
}

const result = spawnSync(gitBash, [script], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

process.exit(result.status ?? 1);
