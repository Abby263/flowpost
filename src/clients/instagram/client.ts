import { IgApiClient, IgLoginRequiredError } from 'instagram-private-api';
import sharp from 'sharp';

export class InstagramClient {
    private ig: IgApiClient;
    private isLoggedIn: boolean = false;
    private lastLoginUsername: string | null = null;

    constructor() {
        this.ig = new IgApiClient();
    }

    /**
     * Process image to ensure it meets Instagram's aspect ratio requirements
     * Instagram accepts: 1.91:1 (landscape) to 4:5 (portrait), with 1:1 (square) being safest
     */
    private async processImageForInstagram(imageBuffer: Buffer): Promise<Buffer> {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        
        if (!metadata.width || !metadata.height) {
            throw new Error('Could not read image dimensions');
        }

        const aspectRatio = metadata.width / metadata.height;
        
        // Instagram's acceptable aspect ratio range
        const MIN_RATIO = 0.8;   // 4:5 portrait
        const MAX_RATIO = 1.91;  // 1.91:1 landscape
        
        console.log(`   📐 Image dimensions: ${metadata.width}x${metadata.height} (aspect ratio: ${aspectRatio.toFixed(2)})`);

        // If aspect ratio is within acceptable range, return as-is
        if (aspectRatio >= MIN_RATIO && aspectRatio <= MAX_RATIO) {
            console.log(`   ✅ Aspect ratio is acceptable for Instagram`);
            return imageBuffer;
        }

        // Otherwise, crop to square (1:1) which is always acceptable
        console.log(`   ⚠️  Aspect ratio ${aspectRatio.toFixed(2)} is outside Instagram's acceptable range`);
        console.log(`   🔄 Cropping to square (1:1) for Instagram compatibility...`);
        
        const size = Math.min(metadata.width, metadata.height);
        
        const processedBuffer = await image
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 90 })
            .toBuffer();
        
        console.log(`   ✅ Image processed to ${size}x${size} (1:1 square)`);
        return processedBuffer;
    }

    async login(credentials: { username?: string; password?: string }) {
        const username = credentials.username || process.env.INSTAGRAM_USERNAME;
        const password = credentials.password || process.env.INSTAGRAM_PASSWORD;

        if (!username || !password) {
            throw new Error('Instagram username and password must be provided either in credentials or environment variables.');
        }

        // Skip login if already logged in with same username
        if (this.isLoggedIn && this.lastLoginUsername === username) {
            console.log(`✅ Already logged in as @${username}`);
            return;
        }

        try {
            console.log(`🔐 Logging in to Instagram as @${username}...`);
            
            // Generate device information
            this.ig.state.generateDevice(username);
            
            // Simulate realistic behavior to avoid detection
            this.ig.request.end$.subscribe(() => {
                // Add small delay between requests
            });

            // Attempt login
            const loginResult = await this.ig.account.login(username, password);
            
            this.isLoggedIn = true;
            this.lastLoginUsername = username;
            
            console.log(`✅ Successfully logged in to Instagram as @${username}`);
            console.log(`   User ID: ${loginResult.pk}`);
            
        } catch (error: any) {
            this.isLoggedIn = false;
            this.lastLoginUsername = null;
            
            if (error.name === 'IgCheckpointError') {
                throw new Error(
                    `Instagram requires verification for this account. ` +
                    `Please log in through the Instagram app or website to complete the challenge, then try again.`
                );
            } else if (error.name === 'IgLoginBadPasswordError') {
                throw new Error(`Incorrect Instagram password for @${username}`);
            } else if (error.name === 'IgLoginInvalidUserError') {
                throw new Error(`Instagram username @${username} does not exist`);
            } else if (error.name === 'IgLoginTwoFactorRequiredError') {
                throw new Error(
                    `Two-factor authentication is enabled for @${username}. ` +
                    `This workflow currently doesn't support 2FA. Please disable it temporarily or use an app-specific password.`
                );
            } else if (error.message?.includes('rate limit')) {
                throw new Error(
                    `Instagram rate limit exceeded. Please wait 10-15 minutes before trying again.`
                );
            } else {
                console.error(`❌ Instagram login error:`, error.message);
                throw new Error(`Failed to log in to Instagram: ${error.message}`);
            }
        }
    }

    async uploadPhoto({ photo, caption, credentials }: { photo: Buffer; caption: string; credentials?: { username?: string; password?: string } }) {
        const maxRetries = 2;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Ensure we're logged in
                await this.login(credentials || {});

                console.log(`📸 Uploading photo to Instagram (attempt ${attempt}/${maxRetries})...`);
                
                // Process image to ensure it meets Instagram's aspect ratio requirements
                const processedPhoto = await this.processImageForInstagram(photo);
                
                // Upload and publish the photo
                const publishResult = await this.ig.publish.photo({
                    file: processedPhoto,
                    caption: caption,
                });

                console.log(`✅ Successfully uploaded to Instagram!`);
                console.log(`   Media ID: ${publishResult.media.id}`);
                console.log(`   Media Code: ${publishResult.media.code}`);

                return publishResult;
                
            } catch (error: any) {
                lastError = error;
                
                console.error(`❌ Upload attempt ${attempt} failed:`, error.message);

                // If it's a login required error, force re-login on next attempt
                if (error instanceof IgLoginRequiredError || error.name === 'IgLoginRequiredError') {
                    console.log(`   🔄 Session expired, will re-authenticate on next attempt...`);
                    this.isLoggedIn = false;
                    this.lastLoginUsername = null;
                    
                    if (attempt < maxRetries) {
                        console.log(`   ⏳ Waiting 3 seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        continue;
                    }
                }

                // If it's not a retry-able error, throw immediately
                if (error.name === 'IgCheckpointError') {
                    throw new Error(
                        `Instagram requires verification. Please log in through the Instagram app to complete the security challenge.`
                    );
                }

                // For other errors on last attempt, throw
                if (attempt === maxRetries) {
                    throw error;
                }

                // Wait before retry
                console.log(`   ⏳ Waiting 3 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // If we get here, all retries failed
        throw new Error(
            `Failed to upload to Instagram after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
        );
    }
}
