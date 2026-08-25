#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const apiKey = process.env.DATA_GOV_API_KEY;
const apiBaseUrl = process.env.DATA_GOV_API_BASE_URL || 'https://api.data.gov.in/resource';
const cacheDir = process.env.DATA_GOV_CACHE_DIR || path.join(__dirname, '..', 'data', 'india-geo-api-cache');
const pageLimit = Number(process.env.DATA_GOV_PAGE_LIMIT || 1000);
const requestTimeoutMs = Number(process.env.DATA_GOV_REQUEST_TIMEOUT_MS || 30000);
const pageDelayMs = Number(process.env.DATA_GOV_PAGE_DELAY_MS || 1000);
const maxRetries = Number(process.env.DATA_GOV_MAX_RETRIES || 10);
const rateLimitWaitMs = Number(process.env.DATA_GOV_RATE_LIMIT_WAIT_MS || 60000);
const verifyOnly = process.env.DATA_GOV_VERIFY_ONLY === '1';
const maxRecords = {
  states: Number(process.env.LGD_STATES_MAX_RECORDS || 100),
  districts: Number(process.env.LGD_DISTRICTS_MAX_RECORDS || 2000),
  localBodies: Number(process.env.LGD_LOCAL_BODIES_MAX_RECORDS || 500000),
  localBodiesWithPin: Number(process.env.LGD_LOCAL_BODIES_PIN_MAX_RECORDS || 500000),
  pincodeDirectory: Number(process.env.INDIA_PINCODE_MAX_RECORDS || 250000),
};

const resources = {
  states: process.env.LGD_STATES_RESOURCE_ID || 'a71e60f0-a21d-43de-a6c5-fa5d21600cdb',
  districts: process.env.LGD_DISTRICTS_RESOURCE_ID || '37231365-78ba-44d5-ac22-3deec40b9197',
  localBodies: process.env.LGD_LOCAL_BODIES_RESOURCE_ID || '1a6c26ed-d67c-40ea-aa20-d38d35f341a5',
  localBodiesWithPin:
    process.env.LGD_LOCAL_BODIES_PIN_RESOURCE_ID || '71818d1a-c114-46cb-aa9b-56ed70d4bc4a',
  pincodeDirectory: process.env.INDIA_PINCODE_RESOURCE_ID,
};

const resourceFilters = {
  states: {},
  districts: {},
  localBodies:
    process.env.LGD_LOCAL_BODIES_ENTITY_TYPE === 'ALL'
      ? {}
      : { entityType: process.env.LGD_LOCAL_BODIES_ENTITY_TYPE || 'District' },
  localBodiesWithPin: {},
  pincodeDirectory: {},
};

if (!apiKey) {
  console.error([
    'Usage:',
    '  DATA_GOV_API_KEY=your-private-key npm run import:india-geo-api',
    '',
    'Optional overrides:',
    '  LGD_STATES_RESOURCE_ID=...',
    '  LGD_DISTRICTS_RESOURCE_ID=...',
    '  LGD_LOCAL_BODIES_RESOURCE_ID=...',
    '  LGD_LOCAL_BODIES_PIN_RESOURCE_ID=...',
    '  INDIA_PINCODE_RESOURCE_ID=...',
  ].join('\n'));
  process.exit(1);
}

const normalizeHeader = value =>
  String(value || '')
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeName = value =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const matchKey = value => normalizeName(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const normalizeRecord = record =>
  Object.entries(record || {}).reduce((normalized, [key, value]) => {
    normalized[normalizeHeader(key)] = normalizeName(value);
    return normalized;
  }, {});

const firstValue = (row, names) => {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value) return value;
  }

  return '';
};

const createDb = () =>
  mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    ssl: process.env.DB_SSL_DISABLED === '1' ? undefined : { rejectUnauthorized: false },
  });

const queryDb = async (db, sql, params = [], attempt = 1) => {
  try {
    return await db.query(sql, params);
  } catch (error) {
    const retryableCodes = new Set([
      'ECONNRESET',
      'PROTOCOL_CONNECTION_LOST',
      'ETIMEDOUT',
      'EPIPE',
      'ECONNREFUSED',
    ]);

    if (retryableCodes.has(error.code) && attempt < maxRetries) {
      console.warn(`MySQL ${error.code}; retrying query attempt ${attempt + 1}/${maxRetries}...`);
      await sleep(2000 * attempt);
      return queryDb(db, sql, params, attempt + 1);
    }

    throw error;
  }
};

const buildUrl = (resourceId, offset, filters = {}) => {
  const url = new URL(`${apiBaseUrl}/${resourceId}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(pageLimit));

  for (const [key, value] of Object.entries(filters)) {
    if (value) url.searchParams.set(`filters[${key}]`, value);
  }

  return url;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const cacheFileFor = (label, resourceId, filters = {}) => {
  const filterKey = Object.entries(filters)
    .map(([key, value]) => `${key}-${value}`)
    .join('-');

  return path.join(
    cacheDir,
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${resourceId}${
      filterKey ? `-${filterKey}` : ''
    }-limit-${pageLimit}.jsonl`
  );
};

const loadCachedPages = cacheFile => {
  const pages = new Map();

  if (!fs.existsSync(cacheFile)) return pages;

  const lines = fs.readFileSync(cacheFile, 'utf8').split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const cached = JSON.parse(line);
    if (Number.isInteger(cached.offset) && Array.isArray(cached.records)) {
      pages.set(cached.offset, cached.records);
    }
  }

  return pages;
};

const appendCachedPage = (cacheFile, offset, records) => {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.appendFileSync(cacheFile, `${JSON.stringify({ offset, records })}\n`);
};

const fetchJsonPage = async (resourceId, offset, filters = {}, attempt = 1) => {
  let response;
  let body;
  let timeout;

  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    response = await fetch(buildUrl(resourceId, offset, filters), {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    body = await response.text();
  } catch (error) {
    if (attempt < maxRetries) {
      console.warn(
        `Data API network error at offset ${offset}; retrying attempt ${attempt + 1}/${maxRetries}...`
      );
      await sleep(3000 * attempt);
      return fetchJsonPage(resourceId, offset, filters, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429 && attempt < maxRetries) {
    console.warn(
      `Data API rate limit at offset ${offset}; waiting ${Math.round(
        rateLimitWaitMs / 1000
      )}s before retry ${attempt + 1}/${maxRetries}...`
    );
    await sleep(rateLimitWaitMs);
    return fetchJsonPage(resourceId, offset, filters, attempt + 1);
  }

  if (response.status >= 500 && attempt < maxRetries) {
    await sleep(5000 * attempt);
    return fetchJsonPage(resourceId, offset, filters, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Data API request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const parsed = JSON.parse(body);
  if (parsed.error) {
    throw new Error(`Data API error: ${parsed.error}`);
  }

  return parsed;
};

const fetchPage = async (resourceId, offset, filters = {}) => {
  const parsed = await fetchJsonPage(resourceId, offset, filters);
  return Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord) : [];
};

const verifyResource = async (label, resourceId, filters = {}) => {
  const parsed = await fetchJsonPage(resourceId, 0, filters);
  const firstRecord = Array.isArray(parsed.records) ? parsed.records[0] : null;
  const fields = firstRecord ? Object.keys(firstRecord).join(', ') : 'No records returned';
  const count = parsed.count ?? parsed.total ?? parsed.total_records ?? 'unknown';

  console.log(`${label}`);
  console.log(`  resource: ${resourceId}`);
  console.log(`  filters: ${JSON.stringify(filters)}`);
  console.log(`  reported count: ${count}`);
  console.log(`  fields: ${fields}`);
};

const verifyResources = async () => {
  await verifyResource('States', resources.states, resourceFilters.states);
  await sleep(pageDelayMs);
  await verifyResource('Districts', resources.districts, resourceFilters.districts);
  await sleep(pageDelayMs);
  await verifyResource('Local bodies', resources.localBodies, resourceFilters.localBodies);
  await sleep(pageDelayMs);
  await verifyResource(
    'Local bodies with PIN',
    resources.localBodiesWithPin,
    resourceFilters.localBodiesWithPin
  );

  if (resources.pincodeDirectory) {
    await sleep(pageDelayMs);
    await verifyResource(
      'India pincode directory',
      resources.pincodeDirectory,
      resourceFilters.pincodeDirectory
    );
  } else {
    console.log('India pincode directory');
    console.log('  resource: not configured. Set INDIA_PINCODE_RESOURCE_ID to import full areas.');
  }
};

const fetchAll = async (label, resourceId, maxRecordCount, filters = {}) => {
  const rows = [];
  const cacheFile = cacheFileFor(label, resourceId, filters);
  const cachedPages = loadCachedPages(cacheFile);

  for (let offset = 0; ; offset += pageLimit) {
    const cachedPage = cachedPages.get(offset);
    const page = cachedPage || (await fetchPage(resourceId, offset, filters));

    if (!cachedPage) {
      appendCachedPage(cacheFile, offset, page);
    }

    rows.push(...page);
    console.log(`${label}: ${cachedPage ? 'loaded cached' : 'fetched'} ${rows.length} records`);

    if (rows.length > maxRecordCount) {
      throw new Error(
        `${label} exceeded ${maxRecordCount} records. Check that the resource ID is correct before continuing.`
      );
    }

    if (page.length < pageLimit) break;
    await sleep(pageDelayMs);
  }

  return rows;
};

const getOrCreateCountry = async db => {
  await queryDb(db, 
    `INSERT INTO CountryMaster (CountryCode, CountryName, TeleCode, IsActive)
     SELECT 'IN', 'India', 91, 1
     WHERE NOT EXISTS (SELECT 1 FROM CountryMaster WHERE CountryCode = 'IN')`
  );

  const [rows] = await queryDb(db, 
    `SELECT CountryID FROM CountryMaster WHERE CountryCode = 'IN' LIMIT 1`
  );

  return rows[0].CountryID;
};

const getOrCreateProvince = async (db, countryId, provinceName) => {
  await queryDb(db, 
    `INSERT INTO ProvinceMaster (CountryID, ProvinceName, IsActive)
     SELECT ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM ProvinceMaster
       WHERE CountryID = ? AND ProvinceName = ?
     )`,
    [countryId, provinceName, countryId, provinceName]
  );

  const [rows] = await queryDb(db, 
    `SELECT ProvinceID FROM ProvinceMaster
     WHERE CountryID = ? AND ProvinceName = ?
     LIMIT 1`,
    [countryId, provinceName]
  );

  return rows[0].ProvinceID;
};

const getOrCreateDistrict = async (db, provinceId, districtName) => {
  await queryDb(db, 
    `INSERT INTO DistrictMaster (ProvinceID, DistrictName, IsActive)
     SELECT ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM DistrictMaster
       WHERE ProvinceID = ? AND DistrictName = ?
     )`,
    [provinceId, districtName, provinceId, districtName]
  );

  const [rows] = await queryDb(db, 
    `SELECT DistrictID FROM DistrictMaster
     WHERE ProvinceID = ? AND DistrictName = ?
     LIMIT 1`,
    [provinceId, districtName]
  );

  return rows[0].DistrictID;
};

const getOrCreateCity = async (db, districtId, cityName) => {
  await queryDb(db, 
    `INSERT INTO CityMaster (DistrictID, CityName, IsActive)
     SELECT ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM CityMaster
       WHERE DistrictID = ? AND CityName = ?
     )`,
    [districtId, cityName, districtId, cityName]
  );

  const [rows] = await queryDb(db, 
    `SELECT CityID FROM CityMaster
     WHERE DistrictID = ? AND CityName = ?
     LIMIT 1`,
    [districtId, cityName]
  );

  return rows[0].CityID;
};

const getOrCreateArea = async (db, cityId, areaName, pincode) => {
  await queryDb(db, 
    `INSERT INTO AreaMaster (CityID, AreaName, Pincode, IsActive)
     SELECT ?, ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM AreaMaster
       WHERE CityID = ? AND AreaName = ? AND COALESCE(Pincode, '') = COALESCE(?, '')
     )`,
    [cityId, areaName, pincode || null, cityId, areaName, pincode || null]
  );

  const [rows] = await queryDb(db, 
    `SELECT AreaID FROM AreaMaster
     WHERE CityID = ? AND AreaName = ? AND COALESCE(Pincode, '') = COALESCE(?, '')
     LIMIT 1`,
    [cityId, areaName, pincode || null]
  );

  return rows[0].AreaID;
};

const ensureMapping = async (db, countryId, provinceId, districtId, cityId, areaId) => {
  await queryDb(db, 
    `INSERT INTO GeoMappingDetails
       (CountryID, ProvinceID, DistrictID, CityID, AreaID, IsActive)
     SELECT ?, ?, ?, ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM GeoMappingDetails
       WHERE CountryID = ?
         AND ProvinceID = ?
         AND DistrictID = ?
         AND CityID = ?
         AND AreaID = ?
     )`,
    [
      countryId,
      provinceId,
      districtId,
      cityId,
      areaId,
      countryId,
      provinceId,
      districtId,
      cityId,
      areaId,
    ]
  );
};

const findState = (row, statesByCode, statesByName) => {
  const stateCode = firstValue(row, ['stateCode', 'state_code', 'LGD State Code']);
  const stateName = firstValue(row, ['stateNameEnglish', 'state_name_english', 'stateName']);
  return statesByCode.get(stateCode) || statesByName.get(matchKey(stateName));
};

const getCoveredDistrictName = row => {
  const entityType = firstValue(row, ['entityType', 'entity_type']);
  const entityName = firstValue(row, ['entityName', 'entity_name']);

  if (matchKey(entityType) === 'district') {
    return entityName;
  }

  return '';
};

const getLocalBodyName = row =>
  firstValue(row, ['localBodyNameEnglish', 'local_body_name_english', 'localBodyName']);

const getLocalBodyCode = row => firstValue(row, ['localBodyCode', 'local_body_code']);

const getPincodeStateName = row =>
  firstValue(row, ['statename', 'stateName', 'state_name', 'stateNameEnglish']);

const getPincodeDistrictName = row =>
  firstValue(row, ['districtname', 'district', 'districtName', 'district_name']);

const getPincodeCityName = row =>
  firstValue(row, ['taluk', 'talukname', 'city', 'cityName', 'divisionname']);

const getPincodeAreaName = row =>
  firstValue(row, ['officename', 'officeName', 'office_name', 'postOfficeName']);

const groupLocalBodies = rows => {
  const grouped = new Map();

  for (const row of rows) {
    const code = getLocalBodyCode(row);
    const cityName = getLocalBodyName(row);
    const stateCode = firstValue(row, ['stateCode', 'state_code']);
    const stateName = firstValue(row, ['stateNameEnglish', 'state_name_english', 'stateName']);
    const districtName =
      firstValue(row, ['districtNameEnglish', 'district_name_english', 'districtName']) ||
      getCoveredDistrictName(row);

    if (!code || !cityName) continue;

    const existing = grouped.get(code) || {
      row,
      code,
      cityName,
      stateCode,
      stateName,
      districtName: '',
    };

    if (!existing.districtName && districtName) existing.districtName = districtName;
    grouped.set(code, existing);
  }

  console.log(`Local bodies: ${grouped.size} unique local body codes from ${rows.length} rows`);
  return grouped;
};

const main = async () => {
  if (verifyOnly) {
    await verifyResources();
    return;
  }

  const stateRows = await fetchAll(
    'States',
    resources.states,
    maxRecords.states,
    resourceFilters.states
  );
  const districtRows = await fetchAll(
    'Districts',
    resources.districts,
    maxRecords.districts,
    resourceFilters.districts
  );
  const localBodyRows = await fetchAll(
    'Local bodies',
    resources.localBodies,
    maxRecords.localBodies,
    resourceFilters.localBodies
  );
  const localBodyPinRows = await fetchAll(
    'Local bodies with PIN',
    resources.localBodiesWithPin,
    maxRecords.localBodiesWithPin,
    resourceFilters.localBodiesWithPin
  );
  const pincodeDirectoryRows = resources.pincodeDirectory
    ? await fetchAll(
        'India pincode directory',
        resources.pincodeDirectory,
        maxRecords.pincodeDirectory,
        resourceFilters.pincodeDirectory
      )
    : [];

  const db = createDb();
  const countryId = await getOrCreateCountry(db);
  const statesByCode = new Map();
  const statesByName = new Map();
  const districtsByCode = new Map();
  const districtsByKey = new Map();
  const citiesByCode = new Map();
  const citiesByKey = new Map();
  const localBodiesByCode = groupLocalBodies(localBodyRows);

  for (const row of stateRows) {
    const stateName = firstValue(row, ['stateNameEnglish', 'state_name_english', 'stateName']);
    const stateCode = firstValue(row, ['stateCode', 'state_code', 'LGD State Code']);

    if (!stateName) continue;

    const provinceId = await getOrCreateProvince(db, countryId, stateName);
    const state = { stateName, provinceId };
    statesByName.set(matchKey(stateName), state);
    if (stateCode) statesByCode.set(stateCode, state);
  }

  for (const row of districtRows) {
    const state = findState(row, statesByCode, statesByName);
    const districtName = firstValue(row, [
      'districtNameEnglish',
      'district_name_english',
      'districtName',
    ]);
    const districtCode = firstValue(row, ['districtCode', 'district_code', 'LGD District Code']);

    if (!state || !districtName) continue;

    const districtId = await getOrCreateDistrict(db, state.provinceId, districtName);
    const cityId = await getOrCreateCity(db, districtId, districtName);
    const areaId = await getOrCreateArea(db, cityId, 'Not specified', null);
    const district = { provinceId: state.provinceId, districtId, cityId, districtName };

    if (districtCode) districtsByCode.set(districtCode, district);
    districtsByKey.set(`${matchKey(state.stateName)}|${matchKey(districtName)}`, district);
    citiesByKey.set(
      `${matchKey(state.stateName)}|${matchKey(districtName)}|${matchKey(districtName)}`,
      cityId
    );

    await ensureMapping(db, countryId, state.provinceId, districtId, cityId, areaId);
  }

  for (const localBody of localBodiesByCode.values()) {
    const state =
      statesByCode.get(localBody.stateCode) || statesByName.get(matchKey(localBody.stateName));
    const districtName = localBody.districtName;
    const cityName = localBody.cityName;
    const cityCode = localBody.code;

    if (!state || !districtName || !cityName) continue;

    let district =
      districtsByKey.get(`${matchKey(state.stateName)}|${matchKey(districtName)}`);

    if (!district && districtName) {
      const districtId = await getOrCreateDistrict(db, state.provinceId, districtName);
      const fallbackCityId = await getOrCreateCity(db, districtId, districtName);
      district = { provinceId: state.provinceId, districtId, cityId: fallbackCityId, districtName };
      districtsByKey.set(`${matchKey(state.stateName)}|${matchKey(districtName)}`, district);
    }

    if (!district) continue;

    const cityId = await getOrCreateCity(db, district.districtId, cityName);
    const areaId = await getOrCreateArea(db, cityId, 'Not specified', null);

    if (cityCode) citiesByCode.set(cityCode, cityId);
    citiesByKey.set(
      `${matchKey(state.stateName)}|${matchKey(district.districtName)}|${matchKey(cityName)}`,
      cityId
    );

    await ensureMapping(db, countryId, district.provinceId, district.districtId, cityId, areaId);
  }

  for (const row of localBodyPinRows) {
    const state = findState(row, statesByCode, statesByName);
    const districtCode = firstValue(row, ['districtCode', 'district_code', 'LGD District Code']);
    const districtName = firstValue(row, [
      'districtNameEnglish',
      'district_name_english',
      'districtName',
      'district',
    ]);
    const cityCode = getLocalBodyCode(row);
    const localBody = localBodiesByCode.get(cityCode);
    const cityName =
      getLocalBodyName(row) || localBody?.cityName || firstValue(row, ['officeName', 'office_name']);
    const resolvedDistrictName = districtName || localBody?.districtName;
    const areaName =
      firstValue(row, ['officeName', 'office_name', 'postOfficeName', 'post_office_name']) ||
      cityName ||
      'Not specified';
    const pincode = firstValue(row, ['pincode', 'pinCode', 'pin_code', 'PIN Code']);

    if (!state || !resolvedDistrictName || !cityName) continue;

    let district =
      districtsByCode.get(districtCode) ||
      districtsByKey.get(`${matchKey(state.stateName)}|${matchKey(resolvedDistrictName)}`);

    if (!district) {
      const districtId = await getOrCreateDistrict(db, state.provinceId, resolvedDistrictName);
      const fallbackCityId = await getOrCreateCity(db, districtId, resolvedDistrictName);
      district = {
        provinceId: state.provinceId,
        districtId,
        cityId: fallbackCityId,
        districtName: resolvedDistrictName,
      };
      districtsByKey.set(`${matchKey(state.stateName)}|${matchKey(resolvedDistrictName)}`, district);
      if (districtCode) districtsByCode.set(districtCode, district);
    }

    let cityId =
      citiesByCode.get(cityCode) ||
      citiesByKey.get(
        `${matchKey(state.stateName)}|${matchKey(resolvedDistrictName)}|${matchKey(cityName)}`
      );

    if (!cityId) {
      cityId = await getOrCreateCity(db, district.districtId, cityName);
      citiesByKey.set(
        `${matchKey(state.stateName)}|${matchKey(resolvedDistrictName)}|${matchKey(cityName)}`,
        cityId
      );
      if (cityCode) citiesByCode.set(cityCode, cityId);
    }

    const areaId = await getOrCreateArea(db, cityId, areaName, pincode);
    await ensureMapping(db, countryId, district.provinceId, district.districtId, cityId, areaId);
  }

  for (const row of pincodeDirectoryRows) {
    const stateName = getPincodeStateName(row);
    const districtName = getPincodeDistrictName(row);
    const cityName = getPincodeCityName(row) || districtName;
    const areaName = getPincodeAreaName(row);
    const pincode = firstValue(row, ['pincode', 'pinCode', 'pin_code']);
    const state = statesByName.get(matchKey(stateName));

    if (!state || !districtName || !cityName || !areaName) continue;

    let district = districtsByKey.get(`${matchKey(state.stateName)}|${matchKey(districtName)}`);

    if (!district) {
      const districtId = await getOrCreateDistrict(db, state.provinceId, districtName);
      const fallbackCityId = await getOrCreateCity(db, districtId, districtName);
      district = { provinceId: state.provinceId, districtId, cityId: fallbackCityId, districtName };
      districtsByKey.set(`${matchKey(state.stateName)}|${matchKey(districtName)}`, district);
    }

    const cityKey = `${matchKey(state.stateName)}|${matchKey(districtName)}|${matchKey(cityName)}`;
    let cityId = citiesByKey.get(cityKey);

    if (!cityId) {
      cityId = await getOrCreateCity(db, district.districtId, cityName);
      citiesByKey.set(cityKey, cityId);
    }

    const areaId = await getOrCreateArea(db, cityId, areaName, pincode);
    await ensureMapping(db, countryId, district.provinceId, district.districtId, cityId, areaId);
  }

  await db.end();
  console.log('India geo Data API import complete.');
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
