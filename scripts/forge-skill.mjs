// Re-export the production forge (lib/skill.mjs) so the demo harness and the
// real CLI share one source of truth.
export { buildSkillFiles, buildSkill, writeSkillFolder, adaptLessons } from '../lib/skill.mjs'
