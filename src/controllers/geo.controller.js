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

const getCountryCode = async (req, res) => {

    try {

        const { countryId } = req.body;

        if (!countryId) {
            return res.status(400).json({
                success: false,
                message: "countryId is required"
            });
        }

        const result = await geoService.getCountryCode(countryId);

        return res.json({
            success: true,
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
  getGeoHierarchy,
  getCountryCode,
};