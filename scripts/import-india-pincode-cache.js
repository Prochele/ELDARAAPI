#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const cacheFile =
  process.env.INDIA_PINCODE_CACHE_FILE ||
  path.join(
    __dirname,
    '..',
    'data',
    'india-geo-api-cache',
    'india-pincode-directory-5c2f62fe-5afa-4119-a499-fec9d604d5bd-limit-500.jsonl'
  );
const batchSize = Number(process.env.IMPORT_BATCH_SIZE || 1000);

const normalizeName = value =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const matchKey = value => normalizeName(value).toLowerCase().replace(/[^a-z0-9]/g, '');

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

    if (retryableCodes.has(error.code) && attempt < 10) {
      console.warn(`MySQL ${error.code}; retrying query attempt ${attempt + 1}/10...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      return queryDb(db, sql, params, attempt + 1);
    }

    throw error;
  }
};

const readPincodeRows = () => {
  if (!fs.existsSync(cacheFile)) {
    throw new Error(`Pincode cache not found: ${cacheFile}`);
  }

  const rows = [];
  const lines = fs.readFileSync(cacheFile, 'utf8').split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const page = JSON.parse(line);
    if (Array.isArray(page.records)) rows.push(...page.records);
  }

  return rows;
};

const chunk = rows => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }
  return chunks;
};

const loadMaps = async db => {
  const [[country]] = await queryDb(
    db,
    `SELECT CountryID FROM CountryMaster WHERE CountryCode = 'IN' LIMIT 1`
  );
  const [provinces] = await queryDb(
    db,
    `SELECT ProvinceID, ProvinceName FROM ProvinceMaster WHERE IsActive = 1`
  );
  const [districts] = await queryDb(
    db,
    `SELECT d.DistrictID, d.ProvinceID, d.DistrictName, p.ProvinceName
     FROM DistrictMaster d
     JOIN ProvinceMaster p ON p.ProvinceID = d.ProvinceID
     WHERE d.IsActive = 1`
  );
  const [cities] = await queryDb(
    db,
    `SELECT c.CityID, c.DistrictID, c.CityName, d.DistrictName, p.ProvinceName
     FROM CityMaster c
     JOIN DistrictMaster d ON d.DistrictID = c.DistrictID
     JOIN ProvinceMaster p ON p.ProvinceID = d.ProvinceID
     WHERE c.IsActive = 1`
  );
  const [areas] = await queryDb(
    db,
    `SELECT a.AreaID, a.CityID, a.AreaName, a.Pincode FROM AreaMaster a WHERE a.IsActive = 1`
  );
  const [mappings] = await queryDb(
    db,
    `SELECT CountryID, ProvinceID, DistrictID, CityID, AreaID FROM GeoMappingDetails WHERE IsActive = 1`
  );

  const provinceMap = new Map();
  const districtMap = new Map();
  const cityMap = new Map();
  const areaMap = new Map();
  const mappingSet = new Set();

  for (const province of provinces) {
    provinceMap.set(matchKey(province.ProvinceName), province);
  }

  for (const district of districts) {
    districtMap.set(
      `${matchKey(district.ProvinceName)}|${matchKey(district.DistrictName)}`,
      district
    );
  }

  for (const city of cities) {
    cityMap.set(
      `${matchKey(city.ProvinceName)}|${matchKey(city.DistrictName)}|${matchKey(city.CityName)}`,
      city
    );
  }

  for (const area of areas) {
    areaMap.set(
      `${area.CityID}|${matchKey(area.AreaName)}|${matchKey(area.Pincode || '')}`,
      area
    );
  }

  for (const mapping of mappings) {
    mappingSet.add(
      [
        mapping.CountryID,
        mapping.ProvinceID,
        mapping.DistrictID,
        mapping.CityID,
        mapping.AreaID,
      ].join('|')
    );
  }

  return {
    countryId: country?.CountryID,
    provinceMap,
    districtMap,
    cityMap,
    areaMap,
    mappingSet,
  };
};

const insertMissingDistricts = async (db, maps, rows) => {
  const missing = new Map();

  for (const row of rows) {
    const stateName = normalizeName(row.statename);
    const districtName = normalizeName(row.district);
    const province = maps.provinceMap.get(matchKey(stateName));

    if (!province || !districtName) continue;

    const key = `${matchKey(stateName)}|${matchKey(districtName)}`;
    if (!maps.districtMap.has(key)) {
      missing.set(key, [province.ProvinceID, districtName, 1]);
    }
  }

  for (const group of chunk([...missing.values()])) {
    await queryDb(db, `INSERT INTO DistrictMaster (ProvinceID, DistrictName, IsActive) VALUES ?`, [
      group,
    ]);
  }

  console.log(`Pincode import: inserted ${missing.size} missing districts`);
};

const insertMissingCities = async (db, maps, rows) => {
  const missing = new Map();

  for (const row of rows) {
    const stateName = normalizeName(row.statename);
    const districtName = normalizeName(row.district);
    const district = maps.districtMap.get(`${matchKey(stateName)}|${matchKey(districtName)}`);

    if (!district) continue;

    const cityName = districtName;
    const key = `${matchKey(stateName)}|${matchKey(districtName)}|${matchKey(cityName)}`;
    if (!maps.cityMap.has(key)) {
      missing.set(key, [district.DistrictID, cityName, 1]);
    }
  }

  for (const group of chunk([...missing.values()])) {
    await queryDb(db, `INSERT INTO CityMaster (DistrictID, CityName, IsActive) VALUES ?`, [group]);
  }

  console.log(`Pincode import: inserted ${missing.size} missing district cities`);
};

const insertMissingAreas = async (db, maps, rows) => {
  const missing = new Map();

  for (const row of rows) {
    const stateName = normalizeName(row.statename);
    const districtName = normalizeName(row.district);
    const areaName = normalizeName(row.officename);
    const pincode = normalizeName(row.pincode);
    const city = maps.cityMap.get(
      `${matchKey(stateName)}|${matchKey(districtName)}|${matchKey(districtName)}`
    );

    if (!city || !areaName) continue;

    const key = `${city.CityID}|${matchKey(areaName)}|${matchKey(pincode)}`;
    if (!maps.areaMap.has(key)) {
      missing.set(key, [city.CityID, areaName, pincode || null, 1]);
    }
  }

  for (const group of chunk([...missing.values()])) {
    await queryDb(db, `INSERT INTO AreaMaster (CityID, AreaName, Pincode, IsActive) VALUES ?`, [
      group,
    ]);
  }

  console.log(`Pincode import: inserted ${missing.size} missing areas`);
};

const insertMissingMappings = async (db, maps) => {
  const [rows] = await queryDb(
    db,
    `SELECT p.CountryID, p.ProvinceID, d.DistrictID, c.CityID, a.AreaID
     FROM AreaMaster a
     JOIN CityMaster c ON c.CityID = a.CityID
     JOIN DistrictMaster d ON d.DistrictID = c.DistrictID
     JOIN ProvinceMaster p ON p.ProvinceID = d.ProvinceID
     WHERE p.CountryID = ? AND a.IsActive = 1 AND c.IsActive = 1 AND d.IsActive = 1 AND p.IsActive = 1`,
    [maps.countryId]
  );
  const missing = [];

  for (const row of rows) {
    const key = [row.CountryID, row.ProvinceID, row.DistrictID, row.CityID, row.AreaID].join('|');
    if (!maps.mappingSet.has(key)) {
      missing.push([row.CountryID, row.ProvinceID, row.DistrictID, row.CityID, row.AreaID, 1]);
    }
  }

  for (const group of chunk(missing)) {
    await queryDb(
      db,
      `INSERT INTO GeoMappingDetails
        (CountryID, ProvinceID, DistrictID, CityID, AreaID, IsActive)
       VALUES ?`,
      [group]
    );
  }

  console.log(`Pincode import: inserted ${missing.length} missing geo mappings`);
};

const main = async () => {
  const rows = readPincodeRows();
  console.log(`Pincode import: loaded ${rows.length} cached rows`);

  const db = createDb();
  let maps = await loadMaps(db);

  if (!maps.countryId) {
    throw new Error('India is missing from CountryMaster. Run the LGD import first.');
  }

  await insertMissingDistricts(db, maps, rows);
  maps = await loadMaps(db);

  await insertMissingCities(db, maps, rows);
  maps = await loadMaps(db);

  await insertMissingAreas(db, maps, rows);
  maps = await loadMaps(db);

  await insertMissingMappings(db, maps);
  await db.end();

  console.log('Pincode cache import complete.');
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
