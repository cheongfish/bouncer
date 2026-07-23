'use strict';

const VALID_PROFILES = ['native', 'superpowers'];

// Single source of truth for methodology profile.
// Precedence: explicit methodology.profile > legacy engine fields > 'native'.
function resolveProfile(config) {
  const m = (config && config.methodology) || {};
  let profile = typeof m.profile === 'string' ? m.profile : null;
  if (!profile) {
    const legacy = [m.verification, m.review].filter(Boolean);
    if (legacy.length > 0 && legacy.every((x) => x === 'superpowers')) {
      profile = 'superpowers';
    }
  }
  if (!profile || !VALID_PROFILES.includes(profile)) profile = 'native';
  return profile;
}

module.exports = { resolveProfile, VALID_PROFILES };
