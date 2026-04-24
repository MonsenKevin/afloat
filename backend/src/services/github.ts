import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { ContactSuggestion } from '../types/index';

const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_ORG = process.env.GITHUB_ORG || 'acme';

export async function getBlameContacts(repo: string, filePath: string): Promise<ContactSuggestion[]> {
  // Fall back to mock data if no token
  if (!GH_TOKEN) {
    return getMockContacts(repo, filePath);
  }
  try {
    const url = `https://api.github.com/repos/${GH_ORG}/${repo}/commits`;
    const { data } = await axios.get(url, {
      params: { path: filePath, per_page: 10 },
      headers: { Authorization: `Bearer ${GH_TOKEN}` }
    });
    const seen = new Set<string>();
    return data
      .filter((c: any) => c.author && !seen.has(c.author.login) && seen.add(c.author.login))
      .slice(0, 5)
      .map((c: any) => ({
        name: c.commit.author.name,
        githubUsername: c.author.login,
        lastCommitDate: c.commit.author.date,
        filePath
      }));
  } catch (err: any) {
    if (err.response?.status === 404) {
      throw new Error(`Repository or file not found: ${GH_ORG}/${repo}/${filePath}`);
    }
    if (err.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded or access denied.');
    }
    throw err;
  }
}

function getMockContacts(repo: string, filePath: string): ContactSuggestion[] {
  const mockPath = path.join(__dirname, '../../data/github-mock.json');
  if (fs.existsSync(mockPath)) {
    const mock = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
    const key = `${repo}/${filePath}`;
    if (mock[key]) return mock[key];
    // Return first available mock data
    const firstKey = Object.keys(mock)[0];
    if (firstKey) return mock[firstKey].map((c: any) => ({ ...c, filePath }));
  }
  // Default mock data
  return [
    { name: 'Alice Johnson', githubUsername: 'alicej', lastCommitDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), filePath },
    { name: 'Bob Smith', githubUsername: 'bobsmith', lastCommitDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), filePath },
    { name: 'Carol White', githubUsername: 'carolw', lastCommitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), filePath },
  ];
}
