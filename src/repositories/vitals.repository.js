const db = require('../config/db');

exports.insertVitals = async (data) => {

    const [rows] = await db.execute(
        `CALL sp_insert_vitals(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.patronId,
            data.temperature || null,
            data.systolicBP || null,
            data.diastolicBP || null,
            data.pulse || null,
            data.bloodSugar || null,
            data.oxygenSaturation || null,
            data.heartRate || null,
            data.respiratoryRate || null,
            data.createdBy
        ]
    );

    return rows[0][0].VitalId;
};


exports.getVitals = async (query) => {

    const pageNumber = parseInt(query.pageNumber) || 1;
    const pageSize = parseInt(query.pageSize) || 5;

    const [rows] = await db.execute(
        `CALL sp_get_vitals(?, ?, ?, ?, ?)`,
        [
            query.patronId,
            query.fromDate || null,
            query.toDate || null,
            pageNumber,
            pageSize
        ]
    );

    const data = rows[0];
    const totalCount = rows[1][0].TotalCount;

    const formattedData = data.map(item => ({
        vitalId: item.VitalId,
        date: new Date(item.RecordedAt).toLocaleDateString('en-GB'),
        time: new Date(item.RecordedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }),
        temperature: item.Temperature ? Number(item.Temperature) : null,
        bloodPressure: item.SystolicBP && item.DiastolicBP
            ? `${item.SystolicBP}/${item.DiastolicBP}`
            : null,
        pulse: item.Pulse,
        bloodSugar: item.BloodSugar ? Number(item.BloodSugar) : null,
        oxygenSaturation: item.OxygenSaturation ? Number(item.OxygenSaturation) : null,
        heartRate: item.HeartRate,
        respiratoryRate: item.RespiratoryRate
    }));

    return {
        data: formattedData,
        pagination: {
            pageNumber,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize)
        }
    };
};