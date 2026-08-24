// /**
//  * Geo Repository
//  * Handles DB calls & stored procedure execution
//  */

// const db = require('../config/db');

// const getGeoHierarchyRepo = async () => {

//   const sql = `CALL sp_GetGeoHierarchyJSON()`;

//   const connection = await db.getConnection();

//   try {
//     const [rows] = await connection.query(sql);

//     // Stored procedure returns:
//     // rows[0][0].GeoJSON
//     return rows[0][0].GeoJSON;

//   } finally {
//     connection.release();
//   }
// };

// module.exports = {
//   getGeoHierarchyRepo,
// };
const db = require('../config/db');

const getGeoHierarchy = async () => {

  const sql = `CALL sp_GetGeoHierarchyJSON()`;

  const connection = await db.getConnection();

  try {
    const [rows] = await connection.query(sql);

    return rows[0][0].GeoJSON;

  } finally {
    connection.release();
  }
};

const getCountryCode = async (countryId) => {

  const csql = `CALL sp_get_country_code(?)`;

  const [rows] = await db.query(
    csql,
    [countryId]
  );

  return rows[0][0];
};

const getCountries = async () => {
  const [rows] = await db.query(
    `SELECT CountryID, CountryCode, CountryName, TeleCode
     FROM CountryMaster
     WHERE IsActive = 1
     ORDER BY CountryName`
  );

  return rows;
};

const getProvinces = async (countryId) => {
  const [rows] = await db.query(
    `SELECT ProvinceID, ProvinceName
     FROM ProvinceMaster
     WHERE CountryID = ? AND IsActive = 1
     ORDER BY ProvinceName`,
    [countryId]
  );

  return rows;
};

const getDistricts = async (provinceId) => {
  const [rows] = await db.query(
    `SELECT DistrictID, DistrictName
     FROM DistrictMaster
     WHERE ProvinceID = ? AND IsActive = 1
     ORDER BY DistrictName`,
    [provinceId]
  );

  return rows;
};

const getCities = async (districtId, search = '') => {
  const params = [districtId];
  let searchSql = '';

  if (search) {
    searchSql = ' AND CityName LIKE ?';
    params.push(`%${search}%`);
  }

  const [rows] = await db.query(
    `SELECT CityID, CityName
     FROM CityMaster
     WHERE DistrictID = ? AND IsActive = 1${searchSql}
     ORDER BY CityName
     LIMIT 500`,
    params
  );

  return rows;
};

const getAreas = async (cityId, search = '') => {
  const params = [cityId];
  let searchSql = '';

  if (search) {
    searchSql = ' AND (AreaName LIKE ? OR Pincode LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await db.query(
    `SELECT AreaID, AreaName, Pincode
     FROM AreaMaster
     WHERE CityID = ? AND IsActive = 1${searchSql}
     ORDER BY AreaName
     LIMIT 500`,
    params
  );

  return rows;
};

module.exports = {
  getGeoHierarchy,
  getCountryCode,
  getCountries,
  getProvinces,
  getDistricts,
  getCities,
  getAreas,
};
