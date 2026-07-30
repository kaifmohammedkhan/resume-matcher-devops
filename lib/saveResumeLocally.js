import fs from 'node:fs/promises';
import path from 'node:path';

export async function saveResumeLocally(resumeData) {
  const folder = path.resolve('./private-resumes');
  await fs.mkdir(folder, { recursive: true });

  const filename = `${resumeData.email.replace(/[@.]/g, '_')}.json`;
  const filepath = path.join(folder, filename);

  await fs.writeFile(filepath, JSON.stringify(resumeData, null, 2));
  console.log('📁 Resume saved locally at:', filepath);
}
