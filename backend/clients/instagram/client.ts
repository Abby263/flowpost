import { IgApiClient, IgLoginRequiredError } from "instagram-private-api";
import sharp from "sharp";

export class InstagramClient {
  private ig: IgApiClient;
  private isLoggedIn = false;
  private lastLoginUsername: string | null = null;

  constructor() {
    this.ig = new IgApiClient();
  }

  /**
   * Instagram optimal image dimensions:
   * - Square: 1080x1080 (1:1)
   * - Portrait: 1080x1350 (4:5)
   * - Landscape: 1080x566 (1.91:1)
   *
   * Maximum file size: 8MB for photos
   * Recommended format: JPEG with high quality
   */
  private static readonly INSTAGRAM_DIMENSIONS = {
    SQUARE: { width: 1080, height: 1080 }, // 1:1
    PORTRAIT: { width: 1080, height: 1350 }, // 4:5
    LANDSCAPE: { width: 1080, height: 566 }, // 1.91:1
  };

  /**
   * Process image to ensure it meets Instagram's requirements with optimal quality
   * - Resizes to optimal dimensions (1080px width standard)
   * - Maintains aspect ratio within acceptable range
   * - Uses high-quality JPEG compression
   */
  private async processImageForInstagram(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not read image dimensions");
    }

    const aspectRatio = metadata.width / metadata.height;

    // Instagram's acceptable aspect ratio range
    const MIN_RATIO = 0.8; // 4:5 portrait
    const MAX_RATIO = 1.91; // 1.91:1 landscape

    console.log(
      `   📐 Original dimensions: ${metadata.width}x${metadata.height} (aspect ratio: ${aspectRatio.toFixed(2)})`,
    );

    let targetWidth: number;
    let targetHeight: number;

    if (aspectRatio >= MIN_RATIO && aspectRatio <= MAX_RATIO) {
      // Aspect ratio is acceptable - resize to optimal width while maintaining ratio
      if (aspectRatio >= 0.95 && aspectRatio <= 1.05) {
        // Close to square - use square dimensions
        targetWidth = InstagramClient.INSTAGRAM_DIMENSIONS.SQUARE.width;
        targetHeight = InstagramClient.INSTAGRAM_DIMENSIONS.SQUARE.height;
        console.log(`   🔄 Resizing to optimal square (1080x1080)...`);
      } else if (aspectRatio < 1) {
        // Portrait orientation
        targetWidth = InstagramClient.INSTAGRAM_DIMENSIONS.PORTRAIT.width;
        targetHeight = InstagramClient.INSTAGRAM_DIMENSIONS.PORTRAIT.height;
        console.log(`   🔄 Resizing to optimal portrait (1080x1350)...`);
      } else {
        // Landscape orientation
        targetWidth = InstagramClient.INSTAGRAM_DIMENSIONS.LANDSCAPE.width;
        targetHeight = InstagramClient.INSTAGRAM_DIMENSIONS.LANDSCAPE.height;
        console.log(`   🔄 Resizing to optimal landscape (1080x566)...`);
      }
    } else {
      // Aspect ratio outside acceptable range - crop to square (safest option)
      console.log(
        `   ⚠️  Aspect ratio ${aspectRatio.toFixed(2)} is outside Instagram's acceptable range`,
      );
      console.log(`   🔄 Cropping to optimal square (1080x1080)...`);
      targetWidth = InstagramClient.INSTAGRAM_DIMENSIONS.SQUARE.width;
      targetHeight = InstagramClient.INSTAGRAM_DIMENSIONS.SQUARE.height;
    }

    // Process with high quality settings for crisp images
    const processedBuffer = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: "center",
        withoutEnlargement: false, // Allow upscaling for small images
      })
      // Sharpen slightly to maintain clarity after resize
      .sharpen({ sigma: 0.5 })
      // Use high-quality JPEG settings
      .jpeg({
        quality: 95, // High quality for crisp images
        mozjpeg: true, // Use mozjpeg for better compression
        chromaSubsampling: "4:4:4", // Better color preservation
      })
      .toBuffer();

    const finalMetadata = await sharp(processedBuffer).metadata();
    console.log(
      `   ✅ Image optimized to ${finalMetadata.width}x${finalMetadata.height} (${(processedBuffer.length / 1024).toFixed(1)}KB)`,
    );

    return processedBuffer;
  }

  async login(credentials: { username?: string; password?: string }) {
    const username = credentials.username || process.env.INSTAGRAM_USERNAME;
    const password = credentials.password || process.env.INSTAGRAM_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "Instagram username and password must be provided either in credentials or environment variables.",
      );
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

      if (error.name === "IgCheckpointError") {
        throw new Error(
          `Instagram requires verification for this account. ` +
            `Please log in through the Instagram app or website to complete the challenge, then try again.`,
        );
      } else if (error.name === "IgLoginBadPasswordError") {
        throw new Error(`Incorrect Instagram password for @${username}`);
      } else if (error.name === "IgLoginInvalidUserError") {
        throw new Error(`Instagram username @${username} does not exist`);
      } else if (error.name === "IgLoginTwoFactorRequiredError") {
        throw new Error(
          `Two-factor authentication is enabled for @${username}. ` +
            `This workflow currently doesn't support 2FA. Please disable it temporarily or use an app-specific password.`,
        );
      } else if (error.message?.includes("rate limit")) {
        throw new Error(
          `Instagram rate limit exceeded. Please wait 10-15 minutes before trying again.`,
        );
      } else {
        console.error(`❌ Instagram login error:`, error.message);
        throw new Error(`Failed to log in to Instagram: ${error.message}`);
      }
    }
  }

  async uploadPhoto({
    photo,
    caption,
    credentials,
  }: {
    photo: Buffer;
    caption: string;
    credentials?: { username?: string; password?: string };
  }) {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ensure we're logged in
        await this.login(credentials || {});

        console.log(
          `📸 Uploading photo to Instagram (attempt ${attempt}/${maxRetries})...`,
        );

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
        if (
          error instanceof IgLoginRequiredError ||
          error.name === "IgLoginRequiredError"
        ) {
          console.log(
            `   🔄 Session expired, will re-authenticate on next attempt...`,
          );
          this.isLoggedIn = false;
          this.lastLoginUsername = null;

          if (attempt < maxRetries) {
            console.log(`   ⏳ Waiting 3 seconds before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
            continue;
          }
        }

        // If it's not a retry-able error, throw immediately
        if (error.name === "IgCheckpointError") {
          throw new Error(
            `Instagram requires verification. Please log in through the Instagram app to complete the security challenge.`,
          );
        }

        // For other errors on last attempt, throw
        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry
        console.log(`   ⏳ Waiting 3 seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // If we get here, all retries failed
    throw new Error(
      `Failed to upload to Instagram after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
    );
  }
}
