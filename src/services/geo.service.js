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

const getCountryCode = async (countryId) => {

  const result = await geoRepository.getCountryCode(countryId);
  console.log('Country Code', result.TeleCode);
  return result;
};

const getCountries = () => geoRepository.getCountries();

const getProvinces = (countryId) => geoRepository.getProvinces(countryId);

const getDistricts = (provinceId) => geoRepository.getDistricts(provinceId);

const getCities = (districtId, search) => geoRepository.getCities(districtId, search);

const getAreas = (cityId, search) => geoRepository.getAreas(cityId, search);

module.exports = {
  getGeoHierarchy,
  getCountryCode,
  getCountries,
  getProvinces,
  getDistricts,
  getCities,
  getAreas,
};
