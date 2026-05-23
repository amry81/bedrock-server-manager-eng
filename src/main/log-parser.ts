import type { LogLevel } from '../shared/types';

export function detectLevel(text: string): LogLevel {
  if (/\bERROR\b/.test(text)) return 'ERROR';
  if (/\bWARN(?:ING)?\b/.test(text)) return 'WARN';
  if (/\bINFO\b/.test(text)) return 'INFO';
  return 'RAW';
}

export interface ParsedEvent {
  type: 'server-ready' | 'player-join' | 'player-leave';
  name?: string;
  xuid?: string;
}

/**
 * Extract a meaningful event from a single BDS log line, if any.
 * Connection lines look like: "Player connected: Steve, xuid: 2535123456789".
 */
export function parseLogLine(line: string): ParsedEvent | null {
  if (/Server started/i.test(line)) {
    return { type: 'server-ready' };
  }

  const join = line.match(/Player connected:\s*([^,]+?)(?:,\s*xuid:\s*(\d+))?\s*$/i);
  if (join) {
    return { type: 'player-join', name: join[1].trim(), xuid: join[2] };
  }

  const leave = line.match(/Player disconnected:\s*([^,]+?)(?:,\s*xuid:\s*(\d+))?\s*$/i);
  if (leave) {
    return { type: 'player-leave', name: leave[1].trim(), xuid: leave[2] };
  }

  return null;
}
