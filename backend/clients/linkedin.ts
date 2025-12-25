import { Arcade } from "@arcadeai/arcadejs";
import sharp from "sharp";
import { AuthorizeUserResponse } from "./types.js";

interface LinkedInPost {
  author: string;
  lifecycleState: string;
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: string;
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": string;
  };
}

interface CreateLinkedInImagePostRequest {
  text: string;
  imageUrl: string;
  imageDescription?: string;
  imageTitle?: string;
}

interface MediaUploadResponse {
  value: {
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        headers: Record<string, string>;
        uploadUrl: string;
      };
    };
    mediaArtifact: string;
    asset: string;
  };
}

interface RegisterUploadRequest {
  registerUploadRequest: {
    recipes: string[];
    owner: string;
    serviceRelationships: Array<{
      relationshipType: string;
      identifier: string;
    }>;
  };
}

export class LinkedInClient {
  private baseURL = "https://api.linkedin.com/v2";
  private accessToken: string;
  private personUrn: string | undefined;
  private organizationId: string | undefined;

  /**
   * LinkedIn optimal image dimensions:
   * - Landscape (recommended): 1200x627 (1.91:1)
   * - Square: 1200x1200 (1:1)
   * - Portrait: 1200x1500 (4:5)
   *
   * Maximum file size: 8MB for images
   * Recommended format: JPEG or PNG
   */
  private static readonly LINKEDIN_DIMENSIONS = {
    LANDSCAPE: { width: 1200, height: 627 }, // 1.91:1 - Best for feed
    SQUARE: { width: 1200, height: 1200 }, // 1:1
    PORTRAIT: { width: 1200, height: 1500 }, // 4:5
  };

  constructor(input?: {
    accessToken: string | undefined;
    personUrn: string | undefined;
    organizationId: string | undefined;
  }) {
    const { accessToken, personUrn, organizationId } = {
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN || input?.accessToken,
      organizationId:
        process.env.LINKEDIN_ORGANIZATION_ID || input?.organizationId,
      personUrn: process.env.LINKEDIN_PERSON_URN || input?.personUrn,
    };
    if (!accessToken) {
      throw new Error(
        "Missing LinkedIn access token. Please pass it via the constructor, or set the LINKEDIN_ACCESS_TOKEN environment variable.",
      );
    }
    if (!personUrn && !organizationId) {
      throw new Error(
        "Must provide at least one of personUrn or organizationId.",
      );
    }

    this.accessToken = accessToken;
    this.personUrn = personUrn;
    this.organizationId = organizationId;
  }

  /**
   * Returns the author string for making a post with the LinkedIn API.
   * @param options
   * @throws {Error} If neither personUrn nor organizationId is provided
   */
  private getAuthorString(options?: { postToOrganization?: boolean }): string {
    // First, attempt to use the organization ID if either the postToOrganization option is set, or the personUrn is not set
    if (options?.postToOrganization || !this.personUrn) {
      if (!this.organizationId) {
        throw new Error(
          "Missing organization ID. Please pass it via the constructor, or set the LINKEDIN_ORGANIZATION_ID environment variable.",
        );
      }
      return `urn:li:organization:${this.organizationId}`;
    }

    if (!this.personUrn) {
      throw new Error(
        "Missing person URN. Please pass it via the constructor, or set the LINKEDIN_PERSON_URN environment variable.",
      );
    }
    return `urn:li:person:${this.personUrn}`;
  }

  private async makeRequest<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Process image to ensure optimal quality and dimensions for LinkedIn
   * - Resizes to optimal dimensions (1200px width standard)
   * - Maintains aspect ratio
   * - Uses high-quality JPEG compression
   */
  private async processImageForLinkedIn(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not read image dimensions");
    }

    const aspectRatio = metadata.width / metadata.height;

    console.log(
      `   📐 Original dimensions: ${metadata.width}x${metadata.height} (aspect ratio: ${aspectRatio.toFixed(2)})`,
    );

    let targetWidth: number;
    let targetHeight: number;

    // Determine optimal dimensions based on aspect ratio
    if (aspectRatio >= 0.95 && aspectRatio <= 1.05) {
      // Close to square
      targetWidth = LinkedInClient.LINKEDIN_DIMENSIONS.SQUARE.width;
      targetHeight = LinkedInClient.LINKEDIN_DIMENSIONS.SQUARE.height;
      console.log(`   🔄 Resizing to optimal square (1200x1200)...`);
    } else if (aspectRatio < 1) {
      // Portrait orientation
      targetWidth = LinkedInClient.LINKEDIN_DIMENSIONS.PORTRAIT.width;
      targetHeight = LinkedInClient.LINKEDIN_DIMENSIONS.PORTRAIT.height;
      console.log(`   🔄 Resizing to optimal portrait (1200x1500)...`);
    } else {
      // Landscape orientation (default and recommended)
      targetWidth = LinkedInClient.LINKEDIN_DIMENSIONS.LANDSCAPE.width;
      targetHeight = LinkedInClient.LINKEDIN_DIMENSIONS.LANDSCAPE.height;
      console.log(`   🔄 Resizing to optimal landscape (1200x627)...`);
    }

    // Process with high quality settings
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

  // Create a text-only post
  async createTextPost(
    text: string,
    options?: {
      postToOrganization?: boolean;
    },
  ): Promise<Response> {
    const endpoint = `${this.baseURL}/ugcPosts`;
    const author = this.getAuthorString(options);

    const postData: LinkedInPost = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    return this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(postData),
    });
  }

  private async registerAndUploadMedia(
    imageUrl: string,
    options: {
      author: string;
    },
  ): Promise<string> {
    // Step 1: Register the upload
    const registerEndpoint = `${this.baseURL}/assets?action=registerUpload`;

    const registerData: RegisterUploadRequest = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: options.author,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    const registerResponse = await this.makeRequest<MediaUploadResponse>(
      registerEndpoint,
      {
        method: "POST",
        body: JSON.stringify(registerData),
      },
    );

    // Step 2: Get the image data from the URL
    console.log(`📥 Downloading image from: ${imageUrl.substring(0, 50)}...`);
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Step 3: Process image for optimal LinkedIn quality
    console.log(`🖼️  Processing image for LinkedIn...`);
    const processedBuffer = await this.processImageForLinkedIn(imageBuffer);

    // Step 4: Upload the optimized image to LinkedIn
    const uploadUrl =
      registerResponse.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: processedBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
    }

    console.log(`✅ Image uploaded successfully to LinkedIn`);
    return registerResponse.value.asset;
  }

  // Create a post with an image
  async createImagePost(
    {
      text,
      imageUrl,
      imageDescription,
      imageTitle,
    }: CreateLinkedInImagePostRequest,
    options?: {
      postToOrganization?: boolean;
    },
  ): Promise<Response> {
    // First register and upload the media
    const author = this.getAuthorString(options);
    const mediaAsset = await this.registerAndUploadMedia(imageUrl, { author });

    const endpoint = `${this.baseURL}/ugcPosts`;

    const postData = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text,
          },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              description: {
                text: imageDescription ?? "Image description",
              },
              media: mediaAsset,
              title: {
                text: imageTitle ?? "Image title",
              },
            },
          ],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    return this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(postData),
    });
  }

  static getScopes(postToOrg?: boolean): string[] {
    return postToOrg
      ? ["w_member_social", "w_organization_social"]
      : ["w_member_social"];
  }

  /**
   * Authorizes a user through Arcade's OAuth flow for LinkedIn access.
   * This method is used exclusively in Arcade authentication mode.
   *
   * @param {string} id - The user's unique identifier in your system
   * @param {Arcade} client - An initialized Arcade client instance
   * @returns {Promise<AuthorizeUserResponse>} Object containing either an authorization URL or token
   * @throws {Error} If authorization fails or required tokens are missing
   */
  static async authorizeUser(
    id: string,
    client: Arcade,
    fields?: {
      postToOrganization?: boolean;
    },
  ): Promise<AuthorizeUserResponse> {
    const scopes = LinkedInClient.getScopes(fields?.postToOrganization);
    const authRes = await client.auth.start(id, "linkedin", {
      scopes,
    });

    if (authRes.status === "completed") {
      if (!authRes.context?.token) {
        throw new Error(
          "Authorization status is completed, but token not found",
        );
      }
      return { token: authRes.context.token };
    }

    if (authRes.url) {
      return { authorizationUrl: authRes.url };
    }

    throw new Error(
      `Authorization failed for user ID: ${id}\nStatus: '${authRes.status}'`,
    );
  }

  static async fromArcade(
    linkedInUserId: string,
    fields?: {
      postToOrganization?: boolean;
    },
  ): Promise<LinkedInClient> {
    const arcade = new Arcade({
      apiKey: process.env.ARCADE_API_KEY,
    });
    const scopes = LinkedInClient.getScopes(fields?.postToOrganization);
    const authRes = await arcade.auth.start(linkedInUserId, "linkedin", {
      scopes,
    });

    if (!authRes.context?.token || !authRes.context?.user_info?.sub) {
      throw new Error(
        "Authorization not completed for user ID: " + linkedInUserId,
      );
    }

    return new LinkedInClient({
      accessToken: authRes.context.token,
      personUrn: authRes.context.user_info.sub as string,
      organizationId: undefined,
    });
  }
}
