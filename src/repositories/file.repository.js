const db = require('../config/db');

const insertFile = async (fileData) => {
  const query = `CALL sp_insert_filestorage(?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    fileData.entity_type,
    fileData.entity_id,
    fileData.file_name,
    fileData.file_extension,
    fileData.file_size_kb,
    fileData.s3_key,
    fileData.content_type,
    fileData.uploaded_by,
  ];

  const [rows] = await db.execute(query, values);

  return rows[0][0]; 
  // { success, message, file_id }
};


const getFileById = async (fileId) => {
  const query = `CALL sp_get_file_by_id(?)`;

  const [rows] = await db.execute(query, [fileId]);

  return rows[0][0]; 
  // { success, message, s3_key }
};
const deleteFile = async (fileId, userId) => {
  const query = `CALL sp_delete_file(?, ?)`;

  const [rows] = await db.execute(query, [fileId, userId]);

  return rows[0][0]; 
  // { success, message }
};

module.exports = {
  insertFile,
  getFileById,
  deleteFile
};