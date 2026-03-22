
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');


require('dotenv').config();

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  
});

const uploadToS3 = async (file, entityType, entityId) => {
  const fileExt = file.originalname.split('.').pop();
  const fileName = `${uuidv4()}.${fileExt}`;

  const s3Key = `${entityType.toLowerCase()}/${entityId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: s3Key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  return {
    s3Key,
    fileName,
  };
};

const getSignedFileUrl = async (s3Key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: s3Key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
  });

  return url;
};


const deleteFromS3 = async (s3Key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: s3Key,
  });

  await s3Client.send(command);
};

module.exports = {
  uploadToS3,
  getSignedFileUrl,
  deleteFromS3
};