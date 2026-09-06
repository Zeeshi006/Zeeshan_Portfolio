import { Injectable } from '@nestjs/common';
import { IBlogRepository } from '../../domain/ports/blog-repository.port';

@Injectable()
export class SlugService {
  toSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  }

  async uniqueSlug(base: string, repo: IBlogRepository, excludeSlug?: string): Promise<string> {
    const baseSlug = this.toSlug(base);
    let candidate = baseSlug;
    let counter = 2;
    while (true) {
      const exists = await repo.slugExists(candidate);
      if (!exists || candidate === excludeSlug) return candidate;
      candidate = `${baseSlug}-${counter++}`;
    }
  }
}
