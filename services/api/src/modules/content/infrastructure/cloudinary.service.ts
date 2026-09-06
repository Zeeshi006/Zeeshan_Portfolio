import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey    = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.configured = true;
    } else {
      this.logger.warn("Cloudinary env vars not set — diagram upload disabled");
    }
  }

  async uploadBuffer(buffer: Buffer, publicId: string): Promise<string> {
    if (!this.configured) throw new InternalServerErrorException("Cloudinary not configured");
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          public_id:    publicId,
          folder:       "portfolio/diagrams",
          overwrite:    true,
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (err, result: UploadApiResponse | undefined) => {
          if (err || !result) {
            this.logger.error("Cloudinary upload failed", err);
            reject(new InternalServerErrorException("Image upload failed"));
            return;
          }
          resolve(result.secure_url);
        },
      ).end(buffer);
    });
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(`portfolio/diagrams/${publicId}`);
    } catch (err) {
      this.logger.warn(`Cloudinary delete failed for ${publicId}`, err);
    }
  }
}
