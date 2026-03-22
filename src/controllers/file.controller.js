const fileService = require('../services/file.service');
const { successResponse, errorResponse } = require('../utils/response.util');


const uploadFile = async (req, res) => {
  try {
    const userId = req.user?.user_id;

    const result = await fileService.uploadFileService(
      req.file,
      req.body,
      userId
    );

    return successResponse(res, 'File uploaded successfully', result);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


const getFileView = async (req, res) => {
  try {
    const fileId = req.params.file_id;

    const result = await fileService.getFileViewService(fileId);

    return successResponse(res, 'File URL generated', result);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

const deleteFile = async (req, res) => {
  try {
    const fileId = req.params.file_id;
    const userId = req.user?.user_id;

    await fileService.deleteFileService(fileId, userId);

    return successResponse(res, 'File deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  uploadFile,   // existing
  getFileView,   // new
  deleteFile    // new
};