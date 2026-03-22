const { uploadToS3,getSignedFileUrl, deleteFromS3 } = require('../utils/s3.util');
const fileRepository = require('../repositories/file.repository');


const uploadFileService = async (file, body, userId) => {
  const { entity_type, entity_id } = body;

  console.log("BODY:", body);
  console.log("FILE:", file);

  if (!file) {
    throw new Error('File is required');
  }

  const { s3Key } = await uploadToS3(file, entity_type, entity_id);

  const result = await fileRepository.insertFile({
    entity_type,
    entity_id,
    file_name: file.originalname,
    file_extension: '.' + file.originalname.split('.').pop(),
    file_size_kb: Math.round(file.size / 1024),
    s3_key: s3Key,
    content_type: file.mimetype,
    uploaded_by: userId || null   // ✅ FIX
  });

  if (result.success === 0) {
    throw new Error(result.message);
  }

  return {
    file_id: result.file_id,
    s3_key: s3Key,
  };
};




const getFileViewService = async (fileId) => {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  const result = await fileRepository.getFileById(fileId);

  if (!result || result.success === 0 || !result.s3_key) {
    throw new Error(result?.message || 'File not found');
  }

  const signedUrl = await getSignedFileUrl(result.s3_key);

  return {
    url: signedUrl
  };
};


const deleteFileService = async (fileId, userId) => {
  if (!fileId) {
    throw new Error('File ID is required');
  }

  // Step 1: Get file (reuse existing repo)
  const file = await fileRepository.getFileById(fileId);

  if (!file || file.success === 0 || !file.s3_key) {
    throw new Error(file?.message || 'File not found');
  }

  // Step 2: Delete from S3
  await deleteFromS3(file.s3_key);

  // Step 3: Soft delete in DB
  const result = await fileRepository.deleteFile(fileId, userId || null);

  if (result.success === 0) {
    throw new Error(result.message);
  }

  return true;
};

module.exports = {
  uploadFileService,
  getFileViewService,
  deleteFileService
};