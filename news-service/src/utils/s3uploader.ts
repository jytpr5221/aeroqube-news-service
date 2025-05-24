import * as AWS from 'aws-sdk'
import { ServerError } from './ApiError'


const s3config = {
  region: process.env.AWS_REGION as string,
  accessKeyId: process.env.AWS_ACCESS_KEY as string,
  secretAccessKey: process.env.AWS_SECRET as string,
  bucket:process.env.AWS_ATTACHMENT_BUCKET_NAME as string,

}

console.log(s3config)


const s3 = new AWS.S3({
  region: s3config.region,
  accessKeyId: s3config.accessKeyId,
  secretAccessKey: s3config.secretAccessKey,
})

export const uploadAttachmentToS3 = async (
  fileName: string,
  buffer: Buffer,
  mimetype: string
) => {
  try {
    console.log('process',process.env.AWS_REGION,process.env.AWS_ACCESS_KEY)
    const params: AWS.S3.Types.PutObjectRequest = {
      Bucket:s3config.bucket,
      Key: `${Date.now().toString()}-${fileName}`,
      Body: buffer,
      ContentType: mimetype,
    }

    
    console.log('Uploading to S3 with params:', {
      ...params,
      Body: '[Buffer]' // Don't log the actual buffer
    })
 
    console.log(s3.config.credentials)
    const uploadResult = await s3.upload(params).promise()
    console.log('S3 upload successful:', uploadResult.Location)
    return uploadResult
  } catch (error) {
    console.error('S3 upload error:', error)
    throw new ServerError('Failed to upload file to S3')
  }
}

