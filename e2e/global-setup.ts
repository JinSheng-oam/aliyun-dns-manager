import fs from 'node:fs/promises';
import path from 'node:path';

export default async function globalSetup() {
  const dataDir = path.join(process.cwd(), '.e2e-data');
  await fs.rm(dataDir, { recursive: true, force: true });
  await fs.mkdir(dataDir, { recursive: true });
}
