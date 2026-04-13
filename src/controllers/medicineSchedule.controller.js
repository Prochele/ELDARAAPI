const medicineScheduleService = require('../services/medicineSchedule.service');

const getMedicineSchedule = async (req, res) => {
  try {
    const patronId = req.params.patronId;

    const result = await medicineScheduleService.getMedicineSchedule(patronId);

    return res.json({
      success: 1,
      data: result
    });

  } catch (error) {
    console.error('GET MEDICINE SCHEDULE ERROR:', error);
    return res.status(500).json({
      success: 0,
      message: error.message
    });
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const medicineId = req.params.medicineId;
    const userId = req.user?.userId;

    await medicineScheduleService.deleteMedicine(medicineId, userId);

    return res.json({
      success: 1,
      message: 'Medicine deleted successfully'
    });

  } catch (error) {
    console.error('DELETE MEDICINE ERROR:', error);
    return res.status(500).json({
      success: 0,
      message: error.message
    });
  }
};

module.exports = {
  getMedicineSchedule,
  deleteMedicine
};