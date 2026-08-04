// server/semanticMatch.js
import { embedText } from './embedText.js';

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

/**
 * Calculates semantic similarity between two text strings using embeddings.
 */
export async function calculateSemanticSimilarity(text1, text2) {
  const embeddingA = await embedText(text1);
  const embeddingB = await embedText(text2);
  return cosineSimilarity(embeddingA, embeddingB);
}

export async function scoreJobs(resumeText, jobs) {
  const resumeEmbedding = await embedText(resumeText);

  const scored = await Promise.all(jobs.map(async job => {
    const jobText = `${job.title || ''} ${job.job_description || ''}`.trim();

    if (jobText.length < 50) {
      return { ...job, matchScore: 0 }; // skip weak listings
    }

    const jobEmbedding = await embedText(jobText);
    const score = cosineSimilarity(resumeEmbedding, jobEmbedding);

    return { ...job, matchScore: score };
  }));

  // Debug: log scores
  console.log('🔍 Semantic Match Scores:', scored.map(j => ({
    title: j.title,
    score: j.matchScore
  })));

  return scored.sort((a, b) => b.matchScore - a.matchScore);
}