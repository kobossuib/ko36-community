import { readFileSync } from 'node:fs';
import { initialLabels } from '../src/intake.mjs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${event.issue.number}`;
const headers = {Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type':'application/json'};
const current = await fetch(base, {headers});
if (!current.ok) throw new Error(`GitHub read: ${current.status}`);
const issue = await current.json();
// Ignore delayed open/reopen events after a maintainer has advanced the ticket.
if (issue.state === 'open' && issue.updated_at === event.issue.updated_at) {
  const labels = initialLabels(issue.labels.map(l => l.name), event.action);
  const response = await fetch(`${base}/labels`, {method:'PUT', headers, body:JSON.stringify({labels})});
  if (!response.ok) throw new Error(`GitHub labels: ${response.status}`);
}
