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
 * @returns {Object} Artifact plan with required flag, extension, path, etc.
 */
export function decideArtifactPlan({ taskText, suggestedTitle }) {
  const reportLike = /报告|总结|周报|方案|调研|文档/i.test(taskText);
  if (!reportLike) return { required: false };

  const file = `${slugify(suggestedTitle || '交付物')}.md`;
  return {
    required: true,
    extension: '.md',
    relativePath: `deliverables/${file}`,
    // TODO: Implement suffix conflict handling (e.g., "report-1.md", "report-2.md")
    // when the file already exists. For now, overwrite is acceptable.
    conflict: 'suffix'
  };
}