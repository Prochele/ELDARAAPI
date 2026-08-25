const geoRepository = require('../repositories/geo.repository');

let geoCache = null;
let lastFetchedTime = null;

const CACHE_TTL = 60 * 60 * 1000;

const geoCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const normalizeSortValue = (value) => String(value || '').trim();

const isNotSpecified = (value) =>
  normalizeSortValue(value).toLowerCase().startsWith('not specified');

const compareByName = (nameKey, secondaryKey) => (a, b) => {
  const aNotSpecified = isNotSpecified(a?.[nameKey]);
  const bNotSpecified = isNotSpecified(b?.[nameKey]);

  if (aNotSpecified && !bNotSpecified) return 1;
  if (!aNotSpecified && bNotSpecified) return -1;

  const primaryCompare = geoCollator.compare(
    normalizeSortValue(a?.[nameKey]),
    normalizeSortValue(b?.[nameKey])
  );

  if (primaryCompare !== 0 || !secondaryKey) {
    return primaryCompare;
  }

  return geoCollator.compare(
    normalizeSortValue(a?.[secondaryKey]),
    normalizeSortValue(b?.[secondaryKey])
  );
};

const sortGeoHierarchy = (geoData) => {
  const parsedGeoData = typeof geoData === 'string' ? JSON.parse(geoData) : geoData;

  const countries = parsedGeoData?.Countries;

  if (!Array.isArray(countries)) {
    return parsedGeoData;
  }

  countries.sort(compareByName('CountryName'));

  countries.forEach((country) => {
    if (!Array.isArray(country.Provinces)) return;

    country.Provinces.sort(compareByName('ProvinceName'));

    country.Provinces.forEach((province) => {
      if (!Array.isArray(province.Districts)) return;

      province.Districts.sort(compareByName('DistrictName'));

      province.Districts.forEach((district) => {
        if (!Array.isArray(district.Cities)) return;

        district.Cities.sort(compareByName('CityName'));

        district.Cities.forEach((city) => {
          if (!Array.isArray(city.Areas)) return;

          city.Areas.sort(compareByName('AreaName', 'Pincode'));
        });
      });
    });
  });

  return parsedGeoData;
};

const getGeoHierarchy = async () => {

  const now = Date.now();

  if (geoCache && (now - lastFetchedTime < CACHE_TTL)) {
    return geoCache;
  }

  const result = await geoRepository.getGeoHierarchy();

  geoCache = sortGeoHierarchy(result);
  lastFetchedTime = now;

  return geoCache;
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
