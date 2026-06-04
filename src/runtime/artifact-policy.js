// src/runtime/artifact-policy.js
// Artifact save decision and path policy for AI-generated deliverables

// v0.2.29.1 hotfix: read-only keywords — when a user message only contains
// one of these intents, the AI should answer directly with text. The
// orchestrator must NOT trigger wind-cli (runTool / writeArtifact /
// ingestWiki) and must NOT save anything to disk.
//
// TODO: this is a "temporary heuristic" — a narrow keyword whitelist.
// v0.3.0 will replace it with a proper intent classifier. Keep this
// list in sync with spec §3.1 L2.5 ("CLI 触发策略当前为 temporary heuristic").
export const READ_ONLY_KEYWORDS = /(列举|列出|读取|读|搜索|查找|查看|看|翻译|解释|说明|什么是|是什么|介绍|简介|总结|概括|对比|区别|怎么用|如何|用.*干什么|列出.*文件|list|ls|read|search|find|show|view|translate|explain|what is|how to|summary|summarize|compare)/i;

const REPORT_LIKE_KEYWORDS = /报告|总结|周报|方案|调研|文档|报告:|交付物|设计|规划|计划|手册|教程|review|spec/i;

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

  // v0.2.29.1 hotfix: read-only short-circuit.
  // If the user is clearly asking for a read-only answer (list/read/translate/
  // explain/...), do NOT trigger any disk write, even if the message also
  // contains words like "总结". The whitelist is conservative on purpose:
  // report-like writes require an EXPLICIT marker word (报告/方案/调研/...).
  if (READ_ONLY_KEYWORDS.test(taskText) && !REPORT_LIKE_KEYWORDS.test(taskText)) {
    return { required: false, reason: 'read-only keyword; no disk write' };
  }

  const reportLike = REPORT_LIKE_KEYWORDS.test(taskText);

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