const repository = require('../repositories/vitals.repository');

exports.insertVitals = async (data) => {

    if (!data.patronId) {
        throw new Error('PatronId is required');
    }

    if ((data.systolicBP && !data.diastolicBP) || (!data.systolicBP && data.diastolicBP)) {
        throw new Error('Both Systolic and Diastolic BP required');
    }

    const result = await repository.insertVitals(data);

    return {
        success: true,
        message: 'Vitals recorded successfully',
        vitalId: result
    };
};

exports.getVitals = async (query) => {

    const result = await repository.getVitals(query);

    return {
        success: true,
        data: result.data,
        pagination: result.pagination
    };
};