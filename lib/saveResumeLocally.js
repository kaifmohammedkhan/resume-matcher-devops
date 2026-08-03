import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function saveResumeLocally(resumeData) {
  const folder = path.resolve('./private-resumes');
  await mkdir(folder, { recursive: true });

  const filename = `${resumeData.email.replace(/[@.]/g, '_')}.json`;
  const filepath = path.join(folder, filename);

  await writeFile(filepath, JSON.stringify(resumeData, null, 2));
  console.log('📁 Resume saved locally at:', filepath);
}