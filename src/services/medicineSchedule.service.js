// const medicineScheduleRepository = require('../repositories/medicineSchedule.repository');
// const { getSignedFileUrl } = require('../utils/s3.util');

// const getMedicineSchedule = async (patronId) => {

//   const result = await medicineScheduleRepository.getMedicineSchedule(patronId);

//   const data = await Promise.all(
//     result.map(async (item) => {
//       let imageUrl = null;

//       if (item.ImageKey) {
//         console.log("S3 KEY:", item.ImageKey);
//         imageUrl = await getSignedFileUrl(item.ImageKey);
//         console.log("SIGNED URL:", imageUrl);
//       }

//       // return {
//       //   ...item,
//       //   // FromDate: item.FromDate ? item.FromDate.toISOString().split('T')[0] : null,
//       //   // ToDate: item.ToDate ? item.ToDate.toISOString().split('T')[0] : null,
//       //   FromDate: item.FromDate,
//       //   ToDate: item.ToDate,
//       //   imageUrl
//       // };
//     })
//   );

//   return data;
// };

// const deleteMedicine = async (medicineId) => {
//   return await medicineScheduleRepository.deleteMedicine(medicineId);
// };

// module.exports = {
//   getMedicineSchedule,
//   deleteMedicine
// };

const medicineScheduleRepository = require('../repositories/medicineSchedule.repository');
const { getSignedFileUrl } = require('../utils/s3.util');

const getMedicineSchedule = async (patronId) => {
  // 1. Fetch raw data from the database
  const result = await medicineScheduleRepository.getMedicineSchedule(patronId);

  // 2. Process the results asynchronously to handle S3 signatures and date parsing
  const data = await Promise.all(
    result.map(async (item) => {
      let imageUrl = null;

      // Handle image retrieval if a key exists
      if (item.ImageKey) {
        try {
          imageUrl = await getSignedFileUrl(item.ImageKey);
        } catch (e) {
          console.error("S3 URL Error:", e);
        }
      } else if (item.FileId) {
        // Fallback for direct API file viewing if used
        imageUrl = `https://eldaraapi-production.up.railway.app/api/file/view/${item.FileId}`;
      }
      const formatDate = (date) => {
        try {
          if (!date) return null;

          const d = new Date(date);

          if (isNaN(d.getTime())) return date;

          return d.toISOString().split('T')[0];
        } catch {
          return date;
        }
      };
      // ✅ FIX: Ensure we RETURN the object and format dates safely
      return {
        ...item,
        FromDate: formatDate(item.FromDate),
        ToDate: formatDate(item.ToDate),
        imageUrl
      };
    })
  );

  return data; // Return the full processed list to the controller
};

const deleteMedicine = async (medicineId) => {
  return await medicineScheduleRepository.deleteMedicine(medicineId);
};

module.exports = {
  getMedicineSchedule,
  deleteMedicine
};