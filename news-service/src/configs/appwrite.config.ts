import { ServerError } from '@utils/ApiError';
import { Client, Storage, Permission, Role, ID } from 'appwrite';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

class AppwriteService {
    private client: Client;
    private storage: Storage;

    constructor() {
        this.client = new Client();
        const appwriteEndpoint = process.env.APPWRITE_ENDPOINT;
        const appwriteProjectId = process.env.APPWRITE_PROJECT_ID;

        if (!appwriteEndpoint || !appwriteProjectId) {
            throw new ServerError('Appwrite credentials not found in environment variables');
        }

        this.client
            .setEndpoint(appwriteEndpoint)
            .setProject(appwriteProjectId)
            
            

        this.storage = new Storage(this.client);
    }

    
    async uploadToBucket(filePath): Promise<string | null> {
        if (!fs.existsSync(filePath)) {
            console.error(`File does not exist: ${filePath}`);
            return null;
        }

        try {
            const fileName = filePath.split('/').pop()!;
            console.log(`Uploading file: ${filePath}`);

            const bucketId = process.env.APPWRITE_BUCKET_ID;
            const result = await this.storage.createFile(
                bucketId,
                ID.unique(),
                fileName,
                [Permission.read(Role.any())]
            );

            const fileId = result.$id;
            const appwriteEndpoint = process.env.APPWRITE_ENDPOINT;
            const appwriteProjectId = process.env.APPWRITE_PROJECT_ID;
            const fileUrl = `${appwriteEndpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${appwriteProjectId}`;

            console.log(`Uploaded file '${fileName}' to Appwrite. File ID: ${fileId}`);
            return fileUrl;
        } catch (e) {
            console.error(`Error uploading file '${filePath}': ${e}`);
            return null;
        }
    }

    async deleteFromBucket(fileId: string, bucketId = 'tts_files'): Promise<boolean> {
        try {
            await this.storage.deleteFile(bucketId, fileId);
            console.log(`Deleted file with ID: ${fileId} from bucket '${bucketId}'`);
            return true;
        } catch (e) {
            console.error(`Error deleting file with ID '${fileId}': ${e}`);
            return false;
        }
    }
}

export default AppwriteService;
