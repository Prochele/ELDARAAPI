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

module.exports = {
  getGeoHierarchy,
  getCountryCode,
};