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

const parseRequiredInt = (value, fieldName) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        const error = new Error(`${fieldName} must be a positive integer`);
        error.statusCode = 400;
        throw error;
    }

    return parsed;
};

const sendGeoList = async (res, promise, message) => {
    const data = await promise;

    return res.status(200).json({
        success: true,
        message,
        data
    });
};

const getCountries = async (req, res, next) => {
    try {
        return sendGeoList(
            res,
            geoService.getCountries(),
            'Countries fetched successfully'
        );
    } catch (error) {
        next(error);
    }
};

const getProvinces = async (req, res, next) => {
    try {
        const countryId = parseRequiredInt(req.query.countryId, 'countryId');

        return sendGeoList(
            res,
            geoService.getProvinces(countryId),
            'States / provinces fetched successfully'
        );
    } catch (error) {
        next(error);
    }
};

const getDistricts = async (req, res, next) => {
    try {
        const provinceId = parseRequiredInt(req.query.provinceId, 'provinceId');

        return sendGeoList(
            res,
            geoService.getDistricts(provinceId),
            'Districts fetched successfully'
        );
    } catch (error) {
        next(error);
    }
};

const getCities = async (req, res, next) => {
    try {
        const districtId = parseRequiredInt(req.query.districtId, 'districtId');
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        return sendGeoList(
            res,
            geoService.getCities(districtId, search),
            'Cities fetched successfully'
        );
    } catch (error) {
        next(error);
    }
};

const getAreas = async (req, res, next) => {
    try {
        const cityId = parseRequiredInt(req.query.cityId, 'cityId');
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        return sendGeoList(
            res,
            geoService.getAreas(cityId, search),
            'Areas fetched successfully'
        );
    } catch (error) {
        next(error);
    }
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
