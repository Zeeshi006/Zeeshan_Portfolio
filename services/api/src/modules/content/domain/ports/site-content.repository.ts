import { SiteContent } from "../entities/site-content.entity";

export const SITE_CONTENT_REPOSITORY = Symbol("SITE_CONTENT_REPOSITORY");

export interface ISiteContentRepository {
  findByKey(key: string): Promise<SiteContent | null>;
  upsert(key: string, value: Record<string, unknown>): Promise<SiteContent>;
}
