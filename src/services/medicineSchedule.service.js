const medicineScheduleRepository = require('../repositories/medicineSchedule.repository');
const { getSignedFileUrl } = require('../utils/s3.util');

const getMedicineSchedule = async (patronId) => {

  const result = await medicineScheduleRepository.getMedicineSchedule(patronId);

  const data = await Promise.all(
    result.map(async (item) => {
      let imageUrl = null;

      if (item.ImageKey) {
        console.log("S3 KEY:", item.ImageKey);
        imageUrl = await getSignedFileUrl(item.ImageKey);
        console.log("SIGNED URL:", imageUrl);
      }

      return {
        ...item,
        FromDate: item.FromDate ? item.FromDate.toISOString().split('T')[0] : null,
        ToDate: item.ToDate ? item.ToDate.toISOString().split('T')[0] : null,
        imageUrl
      };
    })
  );

  return data;
};

const deleteMedicine = async (medicineId) => {
  return await medicineScheduleRepository.deleteMedicine(medicineId);
};

module.exports = {
  getMedicineSchedule,
  deleteMedicine
};