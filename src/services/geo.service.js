const geoRepository = require('../repositories/geo.repository');

let geoCache = null;
let lastFetchedTime = null;

const CACHE_TTL = 60 * 60 * 1000;

const getGeoHierarchy = async () => {

  const now = Date.now();

  if (geoCache && (now - lastFetchedTime < CACHE_TTL)) {
    return geoCache;
  }

  const result = await geoRepository.getGeoHierarchy();

  //const parsedData = JSON.parse(result);

  geoCache = result;
  lastFetchedTime = now;

  return result;
};

module.exports = {
  getGeoHierarchy,
};