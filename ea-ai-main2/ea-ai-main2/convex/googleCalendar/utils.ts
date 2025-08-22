// Smart date parsing and utility functions for Google Calendar integration
// Adapted from Google Calendar MCP datetime utilities

export interface ParsedDateTime {
  dateTime: string; // ISO 8601 format
  timeZone?: string;
}

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  count?: number;
  until?: string;
  interval?: number;
  byDay?: string[]; // MO, TU, WE, TH, FR, SA, SU
  byMonthDay?: number[];
}

/**
 * Create a Google Calendar API time object with timezone support
 * Adapted from MCP createTimeObject utility
 */
export function createTimeObject(dateTimeString: string, timezone?: string): ParsedDateTime {
  // Check if the datetime string already has timezone info
  const hasTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(dateTimeString);
  const withoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateTimeString);
  
  if (hasTimezone) {
    // Already has timezone, use as-is
    return { dateTime: dateTimeString };
  } else if (withoutTimezone && timezone) {
    // No timezone but we have a timezone parameter
    return { 
      dateTime: dateTimeString,
      timeZone: timezone 
    };
  } else if (withoutTimezone) {
    // No timezone and no parameter - assume UTC
    return { dateTime: `${dateTimeString}Z` };
  } else {
    throw new Error(`Invalid datetime format: ${dateTimeString}. Must be ISO 8601 format.`);
  }
}

/**
 * Parse natural language date strings into ISO 8601 format
 * Handles common patterns like "tomorrow at 2pm", "next Monday", etc.
 */
export function parseSmartDate(input: string, baseTimezone: string = 'UTC'): string {
  const now = new Date();
  const inputLower = input.toLowerCase().trim();
  
  // Handle "tomorrow" pattern
  if (inputLower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Extract time if present
    const timeMatch = inputLower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3] === 'pm';
      
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      // Default to 9 AM if no time specified
      tomorrow.setHours(9, 0, 0, 0);
    }
    
    return tomorrow.toISOString().slice(0, 19); // Remove Z suffix for timezone handling
  }
  
  // Handle "today" pattern
  if (inputLower.includes('today')) {
    const today = new Date(now);
    
    const timeMatch = inputLower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3] === 'pm';
      
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      today.setHours(hours, minutes, 0, 0);
    } else {
      today.setHours(9, 0, 0, 0);
    }
    
    return today.toISOString().slice(0, 19);
  }
  
  // Handle "next [day]" pattern
  const nextDayMatch = inputLower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextDayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(nextDayMatch[1]);
    const currentDay = now.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
    
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    
    // Extract time
    const timeMatch = inputLower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3] === 'pm';
      
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      targetDate.setHours(hours, minutes, 0, 0);
    } else {
      targetDate.setHours(9, 0, 0, 0);
    }
    
    return targetDate.toISOString().slice(0, 19);
  }
  
  // Handle "in X days/weeks/months"
  const relativeMatch = inputLower.match(/in\s+(\d+)\s+(day|days|week|weeks|month|months)/);
  if (relativeMatch) {
    const count = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const futureDate = new Date(now);
    
    if (unit.startsWith('day')) {
      futureDate.setDate(futureDate.getDate() + count);
    } else if (unit.startsWith('week')) {
      futureDate.setDate(futureDate.getDate() + (count * 7));
    } else if (unit.startsWith('month')) {
      futureDate.setMonth(futureDate.getMonth() + count);
    }
    
    // Extract time or default to 9 AM
    const timeMatch = inputLower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3] === 'pm';
      
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      futureDate.setHours(hours, minutes, 0, 0);
    } else {
      futureDate.setHours(9, 0, 0, 0);
    }
    
    return futureDate.toISOString().slice(0, 19);
  }
  
  // Try to parse as ISO 8601 or standard date format
  try {
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid date');
    }
    return parsed.toISOString().slice(0, 19);
  } catch (error) {
    // If all else fails, return current time + 1 hour as fallback
    const fallback = new Date(now.getTime() + 60 * 60 * 1000);
    return fallback.toISOString().slice(0, 19);
  }
}

/**
 * Parse natural language into recurrence rules
 * Examples: "every day", "every Tuesday", "every week", "every month"
 */
export function parseRecurrence(input: string): string[] | undefined {
  const inputLower = input.toLowerCase().trim();
  
  if (!inputLower.includes('every')) {
    return undefined;
  }
  
  // Daily patterns
  if (inputLower.includes('every day') || inputLower.includes('daily')) {
    return ['RRULE:FREQ=DAILY'];
  }
  
  // Weekly patterns
  if (inputLower.includes('every week') || inputLower.includes('weekly')) {
    return ['RRULE:FREQ=WEEKLY'];
  }
  
  // Monthly patterns
  if (inputLower.includes('every month') || inputLower.includes('monthly')) {
    return ['RRULE:FREQ=MONTHLY'];
  }
  
  // Specific day of week patterns
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayAbbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  
  for (let i = 0; i < dayNames.length; i++) {
    if (inputLower.includes(`every ${dayNames[i]}`)) {
      return [`RRULE:FREQ=WEEKLY;BYDAY=${dayAbbrevs[i]}`];
    }
  }
  
  // Count-based patterns (e.g., "every 5 days", "every 2 weeks")
  const countMatch = inputLower.match(/every\s+(\d+)\s+(day|days|week|weeks|month|months)/);
  if (countMatch) {
    const count = parseInt(countMatch[1]);
    const unit = countMatch[2];
    
    if (unit.startsWith('day')) {
      return [`RRULE:FREQ=DAILY;INTERVAL=${count}`];
    } else if (unit.startsWith('week')) {
      return [`RRULE:FREQ=WEEKLY;INTERVAL=${count}`];
    } else if (unit.startsWith('month')) {
      return [`RRULE:FREQ=MONTHLY;INTERVAL=${count}`];
    }
  }
  
  return undefined;
}

/**
 * Format event details for display (adapted from MCP formatEventWithDetails)
 */
export function formatEventSummary(event: any): string {
  const lines: string[] = [];
  
  if (event.summary) {
    lines.push(`**${event.summary}**`);
  }
  
  if (event.start?.dateTime || event.start?.date) {
    const startTime = event.start.dateTime || event.start.date;
    const endTime = event.end?.dateTime || event.end?.date;
    
    if (endTime) {
      lines.push(`📅 ${startTime} - ${endTime}`);
    } else {
      lines.push(`📅 ${startTime}`);
    }
  }
  
  if (event.location) {
    lines.push(`📍 ${event.location}`);
  }
  
  if (event.description) {
    lines.push(`📝 ${event.description}`);
  }
  
  if (event.attendees?.length) {
    const attendeeNames = event.attendees
      .map((a: any) => a.email || a.displayName)
      .filter(Boolean)
      .join(', ');
    lines.push(`👥 ${attendeeNames}`);
  }
  
  if (event.recurrence?.length) {
    lines.push(`🔄 Recurring event`);
  }
  
  return lines.join('\n');
}

/**
 * Get current time with timezone information
 */
export function getCurrentTimeWithTimezone(timezone?: string): { 
  currentTime: string; 
  timezone: string; 
  utcTime: string 
} {
  const now = new Date();
  const utcTime = now.toISOString();
  
  if (timezone) {
    try {
      const localTime = new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now);
      
      return {
        currentTime: localTime.replace(' ', 'T'),
        timezone,
        utcTime
      };
    } catch (error) {
      // Fallback to UTC if timezone is invalid
      return {
        currentTime: utcTime.slice(0, 19),
        timezone: 'UTC',
        utcTime
      };
    }
  }
  
  // Default to system timezone
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    currentTime: now.toISOString().slice(0, 19),
    timezone: systemTimezone,
    utcTime
  };
}