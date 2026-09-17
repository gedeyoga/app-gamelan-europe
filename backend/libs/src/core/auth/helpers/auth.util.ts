import { createHash } from 'crypto';
import { DomainException } from '@app/libs/common/exceptions/domain.exception';

const MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new DomainException(`Invalid duration format: ${duration}`);
  }
  return Number(match[1]) * MULTIPLIERS[match[2]];
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}