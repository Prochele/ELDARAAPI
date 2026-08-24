#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const stateCsv = process.env.LGD_STATES_CSV || process.argv[2];
const districtCsv = process.env.LGD_DISTRICTS_CSV || process.argv[3];
const pincodeCsv = process.env.INDIA_POST_PINCODE_CSV || process.argv[4];
const cityCsv = process.env.LGD_CITIES_CSV || process.argv[5];

if (!stateCsv || !districtCsv) {
  console.error([
    'Usage:',
    '  LGD_STATES_CSV=/path/lgd-states.csv \\',
    '  LGD_DISTRICTS_CSV=/path/lgd-districts.csv \\',
    '  LGD_CITIES_CSV=/path/lgd-local-bodies-or-villages.csv \\',
    '  INDIA_POST_PINCODE_CSV=/path/pincode.csv \\',
    '  node scripts/import-india-geo.js',
    '',
    'The pincode CSV is optional but recommended for AreaMaster coverage.',
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

const parseCsvLine = line => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

const parseCsv = filePath => {
  const content = fs.readFileSync(path.resolve(filePath), 'utf8');
  const lines = content
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);

    return headers.reduce((row, header, index) => {
      row[header] = normalizeName(values[index]);
      return row;
    }, {});
  });
};

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

const getOrCreateCountry = async db => {
  await db.query(
    `INSERT INTO CountryMaster (CountryCode, CountryName, TeleCode, IsActive)
     SELECT 'IN', 'India', 91, 1
     WHERE NOT EXISTS (SELECT 1 FROM CountryMaster WHERE CountryCode = 'IN')`
  );

  const [rows] = await db.query(
    `SELECT CountryID FROM CountryMaster WHERE CountryCode = 'IN' LIMIT 1`
  );

  return rows[0].CountryID;
};

const getOrCreateProvince = async (db, countryId, provinceName) => {
  await db.query(
    `INSERT INTO ProvinceMaster (CountryID, ProvinceName, IsActive)
     SELECT ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM ProvinceMaster
       WHERE CountryID = ? AND ProvinceName = ?
     )`,
    [countryId, provinceName, countryId, provinceName]
  );

  const [rows] = await db.query(
    `SELECT ProvinceID FROM ProvinceMaster
     WHERE CountryID = ? AND ProvinceName = ?
     LIMIT 1`,
    [countryId, provinceName]
  );

  return rows[0].ProvinceID;
};

const getOrCreateDistrict = async (db, provinceId, districtName) => {
  await db.query(
    `INSERT INTO DistrictMaster (ProvinceID, DistrictName, IsActive)
     SELECT ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM DistrictMaster
       WHERE ProvinceID = ? AND DistrictName = ?
     )`,
    [provinceId, districtName, provinceId, districtName]
  );

  const [rows] = await db.query(
    `SELECT DistrictID FROM DistrictMaster
     WHERE ProvinceID = ? AND DistrictName = ?
     LIMIT 1`,
    [provinceId, districtName]
  );

  return rows[0].DistrictID;
};

const getOrCreateCity = async (db, districtId, cityName) => {
  await db.query(
    `INSERT INTO CityMaster (DistrictID, CityName, IsActive)
     SELECT ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM CityMaster
       WHERE DistrictID = ? AND CityName = ?
     )`,
    [districtId, cityName, districtId, cityName]
  );

  const [rows] = await db.query(
    `SELECT CityID FROM CityMaster
     WHERE DistrictID = ? AND CityName = ?
     LIMIT 1`,
    [districtId, cityName]
  );

  return rows[0].CityID;
};

const getOrCreateArea = async (db, cityId, areaName, pincode) => {
  await db.query(
    `INSERT INTO AreaMaster (CityID, AreaName, Pincode, IsActive)
     SELECT ?, ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM AreaMaster
       WHERE CityID = ? AND AreaName = ? AND COALESCE(Pincode, '') = COALESCE(?, '')
     )`,
    [cityId, areaName, pincode || null, cityId, areaName, pincode || null]
  );

  const [rows] = await db.query(
    `SELECT AreaID FROM AreaMaster
     WHERE CityID = ? AND AreaName = ? AND COALESCE(Pincode, '') = COALESCE(?, '')
     LIMIT 1`,
    [cityId, areaName, pincode || null]
  );

  return rows[0].AreaID;
};

const ensureMapping = async (db, countryId, provinceId, districtId, cityId, areaId) => {
  await db.query(
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

const main = async () => {
  const db = createDb();
  const countryId = await getOrCreateCountry(db);
  const stateRows = parseCsv(stateCsv);
  const districtRows = parseCsv(districtCsv);
  const statesByCode = new Map();
  const statesByName = new Map();
  const districtsByKey = new Map();
  const citiesByKey = new Map();

  for (const row of stateRows) {
    const stateName = firstValue(row, [
      'stateNameEnglish',
      'stateName',
      'State Name',
      'StateName',
    ]);
    const stateCode = firstValue(row, ['stateCode', 'State Code', 'LGD State Code']);

    if (!stateName) continue;

    const provinceId = await getOrCreateProvince(db, countryId, stateName);
    statesByName.set(matchKey(stateName), { stateName, provinceId });
    if (stateCode) statesByCode.set(stateCode, { stateName, provinceId });
  }

  for (const row of districtRows) {
    const districtName = firstValue(row, [
      'districtNameEnglish',
      'districtName',
      'District Name',
      'DistrictName',
    ]);
    const stateCode = firstValue(row, ['stateCode', 'State Code', 'LGD State Code']);
    const stateName = firstValue(row, ['stateNameEnglish', 'stateName', 'State Name', 'StateName']);
    const state = statesByCode.get(stateCode) || statesByName.get(matchKey(stateName));

    if (!state || !districtName) continue;

    const districtId = await getOrCreateDistrict(db, state.provinceId, districtName);
    const cityId = await getOrCreateCity(db, districtId, districtName);
    const areaId = await getOrCreateArea(db, cityId, 'Not specified', null);

    districtsByKey.set(`${matchKey(state.stateName)}|${matchKey(districtName)}`, {
      provinceId: state.provinceId,
      districtId,
      cityId,
    });
    citiesByKey.set(
      `${matchKey(state.stateName)}|${matchKey(districtName)}|${matchKey(districtName)}`,
      cityId
    );

    await ensureMapping(db, countryId, state.provinceId, districtId, cityId, areaId);
  }

  if (cityCsv) {
    const cityRows = parseCsv(cityCsv);

    for (const row of cityRows) {
      const stateName = firstValue(row, ['stateNameEnglish', 'stateName', 'State Name', 'StateName']);
      const districtName = firstValue(row, [
        'districtNameEnglish',
        'districtName',
        'District Name',
        'DistrictName',
      ]);
      const cityName = firstValue(row, [
        'localBodyNameEnglish',
        'localBodyName',
        'villageNameEnglish',
        'villageName',
        'subDistrictNameEnglish',
        'subDistrictName',
        'cityName',
        'City Name',
      ]);
      const state = statesByName.get(matchKey(stateName));
      let district = districtsByKey.get(`${matchKey(stateName)}|${matchKey(districtName)}`);

      if (!state || !districtName || !cityName) continue;

      if (!district) {
        const districtId = await getOrCreateDistrict(db, state.provinceId, districtName);
        const fallbackCityId = await getOrCreateCity(db, districtId, districtName);
        district = { provinceId: state.provinceId, districtId, cityId: fallbackCityId };
        districtsByKey.set(`${matchKey(stateName)}|${matchKey(districtName)}`, district);
      }

      const cityId = await getOrCreateCity(db, district.districtId, cityName);
      const areaId = await getOrCreateArea(db, cityId, 'Not specified', null);

      citiesByKey.set(
        `${matchKey(stateName)}|${matchKey(districtName)}|${matchKey(cityName)}`,
        cityId
      );

      await ensureMapping(db, countryId, district.provinceId, district.districtId, cityId, areaId);
    }
  }

  if (pincodeCsv) {
    const pincodeRows = parseCsv(pincodeCsv);

    for (const row of pincodeRows) {
      const stateName = firstValue(row, ['stateName', 'statename', 'State Name', 'CircleName']);
      const districtName = firstValue(row, ['district', 'districtName', 'District Name']);
      const cityName = firstValue(row, [
        'taluk',
        'talukName',
        'block',
        'city',
        'cityName',
        'City Name',
      ]);
      const officeName = firstValue(row, ['officeName', 'officename', 'Office Name']);
      const pincode = firstValue(row, ['pincode', 'pinCode', 'PIN Code']);
      const state = statesByName.get(matchKey(stateName));
      let district = districtsByKey.get(`${matchKey(stateName)}|${matchKey(districtName)}`);

      if (!state || !districtName || !officeName) continue;

      if (!district) {
        const districtId = await getOrCreateDistrict(db, state.provinceId, districtName);
        const cityId = await getOrCreateCity(db, districtId, districtName);
        district = { provinceId: state.provinceId, districtId, cityId };
        districtsByKey.set(`${matchKey(stateName)}|${matchKey(districtName)}`, district);
      }

      const cityKey = `${matchKey(stateName)}|${matchKey(districtName)}|${matchKey(cityName)}`;
      let cityId = cityName ? citiesByKey.get(cityKey) : district.cityId;

      if (!cityId && cityName) {
        cityId = await getOrCreateCity(db, district.districtId, cityName);
        citiesByKey.set(cityKey, cityId);
      }

      const areaId = await getOrCreateArea(db, cityId || district.cityId, officeName, pincode);
      await ensureMapping(
        db,
        countryId,
        district.provinceId,
        district.districtId,
        cityId || district.cityId,
        areaId
      );
    }
  }

  await db.end();
  console.log('India geo import complete.');
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
