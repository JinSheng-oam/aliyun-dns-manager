import fs from 'node:fs/promises';
import path from 'node:path';

export default async function globalTeardown() {
  await fs.rm(path.join(process.cwd(), '.e2e-data'), { recursive: true, force: true });
}
