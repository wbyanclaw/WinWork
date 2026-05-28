// src/runtime/skill-packs/index.js
// Skill pack loader and resolver for task-type-specific routing

import defaultPacks from './default.json' with { type: 'json' };

/**
 * Resolve a skill pack based on task text intent.
 * Matches the first pack whose tokens appear in the task text.
 *
 * @param {string} taskText - The original task text from user
 * @returns {Object} Matched skill pack or fallback
 */
export async function resolveSkillPack(taskText) {
  return defaultPacks.find(pack => pack.match.some(token => taskText.includes(token)))
    ?? { name: 'fallback', artifact: { required: false }, wiki: { auto_ingest: false } };
}