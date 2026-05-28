// src/runtime/artifact-policy.js
// Artifact save decision and path policy for AI-generated deliverables

/**
 * Convert a title/name into a safe filename slug.
 * @param {string} name - The title to slugify
 * @returns {string} A safe filename slug
 */
export function slugify(name = 'untitled') {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'untitled';
}

/**
 * Decide whether an AI-generated response should be saved as an artifact.
 * Report-like tasks (reports, summaries, weekly updates, proposals, surveys, docs)
 * require markdown artifacts saved in the deliverables folder.
 *
 * @param {Object} params - Decision parameters
 * @param {string} params.taskText - The original task text from user
 * @param {string} [params.suggestedTitle] - Suggested title for the artifact
 * @param {Object} [params.skillPack] - Optional skill pack with artifact config
 * @returns {Object} Artifact plan with required flag, extension, path, etc.
 */
export function decideArtifactPlan({ taskText, suggestedTitle, skillPack }) {
  // Check if skill pack overrides artifact requirements
  const artifactConfig = skillPack?.artifact;
  if (artifactConfig?.required === false) {
    return { required: false };
  }

  const reportLike = /报告|总结|周报|方案|调研|文档/i.test(taskText);

  // Use skill pack directory if available, otherwise check report-like detection
  if (artifactConfig?.required || reportLike) {
    const defaultDir = artifactConfig?.default_dir || 'deliverables';
    const extension = artifactConfig?.extension || '.md';
    const file = `${slugify(suggestedTitle || '交付物')}${extension}`;
    return {
      required: true,
      extension,
      relativePath: `${defaultDir}/${file}`,
      conflict: 'suffix'
    };
  }

  return { required: false };
}

/**
 * Decide whether an artifact should be auto-ingested into the wiki.
 * Text files (.md, .txt, .json) are eligible for auto-ingest by default.
 *
 * @param {Object} params - Decision parameters
 * @param {string} params.relativePath - The artifact file path
 * @param {boolean} [params.autoIngest=true] - Whether auto-ingest is enabled
 * @returns {boolean} Whether the artifact should be auto-ingested
 */
export function shouldAutoIngest({ relativePath, autoIngest = true }) {
  if (!autoIngest) return false;
  return /\.(md|txt|json)$/i.test(relativePath);
}