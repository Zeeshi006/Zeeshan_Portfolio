import { Injectable } from '@nestjs/common';

export interface IntentCheckResult {
  clean: boolean;
  reason: string | null;
}

@Injectable()
export class IntentFilterService {
  private readonly INJECTION_PATTERNS: RegExp[] = [
    // Classic prompt injection
    /ignore.*previous.*instruction/i,
    /ignore.*(all|any|your).*(instructions|guidelines|rules)/i,
    /forget.*everything/i,
    /new.*persona/i,
    /reveal.*prompt/i,
    /system.*prompt/i,

    // Persona / roleplay hijacking
    /you are now/i,
    /pretend (to be|you are|you're)/i,
    /roleplay as/i,
    /in (this|the) roleplay/i,
    /hypothetically.*you (are|were|have no)/i,
    /as if you (had no|were not|weren't|have no)/i,
    /act as.*(different|another|new|other|ai|model)/i,

    // Jailbreak phrases
    /\bdan\b.*mode/i,
    /developer mode/i,
    /jailbreak/i,
    /bypass.*(filter|restriction|guideline)/i,

    // Off-topic general tasks (tightened — avoid false positives on portfolio questions)
    /write\s+(me\s+|some\s+|a\s+)?code\b/i,
    /\bwhat is (the )?(capital (city )?of|current weather|weather (in|for)|recipe for)\b/i,

    // Override markers
    /\[.*override.*\]/i,
    /\bsudo\b/i,
  ];

  checkForInjection(query: string): IntentCheckResult {
    // Reject excessively long queries (prompt stuffing)
    if (query.length > 1000) {
      return { clean: false, reason: 'query too long' };
    }

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(query)) {
        return { clean: false, reason: 'off-topic or injection attempt' };
      }
    }
    return { clean: true, reason: null };
  }
}
