/**
 * Maps a given entity string from the raw data to a standard location string.
 * @param {string} entityString 
 * @returns {string} Standardized Location
 */
function entityToLocation(entityString) {
  if (!entityString || typeof entityString !== 'string') return 'Other';

  const e = entityString.toLowerCase();

  if (e.includes('kft') || e.includes('hungary')) return 'Budapest';
  if (e.includes('ag') || e.includes('swiss') || e.includes('switzerland')) return 'Zurich';
  if (e.includes('india')) return 'Bangalore';
  if (e.includes('limited') || e.includes('hong kong')) return 'Hong Kong';
  if (e.includes('sl') || e.includes('spain')) return 'Valencia';
  if (e.includes('partners') || e.includes('morocco')) return 'Morocco';
  if (e.includes('inc') && !e.includes('india')) return 'Princeton';

  return 'Other';
}

module.exports = { entityToLocation };
