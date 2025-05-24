import * as AWS from 'aws-sdk'


const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey:process.env.AWS_SECRET,
})


export const uploadAttachmentToS3 = async (
  fileName: string,
  buffer: Buffer,
  mimetype: string
) => {
  const params: AWS.S3.Types.PutObjectRequest = {
    Bucket: process.env.AWS_ATTACHMENT_BUCKET_NAME,
    Key: `${Date.now().toString()}-${fileName}`,
    Body: buffer,
    ContentType: mimetype,
  }

  const uploadResult = await s3.upload(params).promise()
  return uploadResult
}

