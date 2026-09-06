import { Injectable } from '@nestjs/common';

const WORDS_PER_MINUTE = 200;

@Injectable()
export class ReadingTimeService {
  compute(markdown: string): number {
    const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  }
}
