const geoService = require('../services/geo.service');

const getGeoHierarchy = async (req, res, next) => {
  try {
    const data = await geoService.getGeoHierarchy();

    return res.status(200).json({
      success: true,
      message: "Geo hierarchy fetched successfully",
      data
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGeoHierarchy,
};