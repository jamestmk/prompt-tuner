/**
 * Configuration inheritance and override management utilities.
 */

/**
 * Fields that participate in global/module config inheritance.
 */
export const CONFIG_FIELDS = [
  'model',
  'apiKey',
  'systemPrompt',
  'temperature',
  'topP',
  'maxTokens',
  'frequencyPenalty',
  'presencePenalty',
  'concurrency',
]

/**
 * Returns the effective config value for a given field.
 * If the module has overridden the field, returns the module's value;
 * otherwise returns the global config value.
 * @param {Object} moduleData - Module config object with an `overrides` Set
 * @param {Object} globalConfig - Global config object
 * @param {string} field - The config field name
 * @returns {*} The effective value for the field
 */
export function getEffectiveConfig(moduleData, globalConfig, field) {
  if (moduleData.overrides instanceof Set && moduleData.overrides.has(field)) {
    return moduleData[field]
  }
  return globalConfig[field]
}

/**
 * Applies global config values to all modules for fields that are not overridden.
 * Mutates module objects in place.
 * @param {Object} globalConfig - Global config object
 * @param {Array<Object>} modules - Array of module config objects
 */
export function applyGlobalConfig(globalConfig, modules) {
  for (const m of modules) {
    for (const field of CONFIG_FIELDS) {
      if (!(m.overrides instanceof Set) || !m.overrides.has(field)) {
        m[field] = globalConfig[field]
      }
    }
  }
}

/**
 * Resets all module overrides and re-applies global config to all fields.
 * Clears (or creates) each module's overrides Set, then syncs all config fields from global.
 * @param {Array<Object>} modules - Array of module config objects
 * @param {Object} globalConfig - Global config object
 */
export function resetModuleOverrides(modules, globalConfig) {
  for (const m of modules) {
    m.overrides = new Set()
    for (const field of CONFIG_FIELDS) {
      m[field] = globalConfig[field]
    }
  }
}
