const env = require('../../config/env');

async function createCalendarEvent({ calendarId, event }) {
  if (!env.GOOGLE_CALENDAR_ENABLED) {
    return {
      provider: 'google_calendar',
      enabled: false,
      status: 'skipped',
      message: 'Google Calendar provider is disabled in environment.',
      calendarId,
      event,
    };
  }

  return {
    provider: 'google_calendar',
    enabled: true,
    status: 'pending',
    message: 'Replace this stub with actual Google Calendar integration later.',
    calendarId,
    event,
  };
}

async function updateCalendarEvent({ calendarId, eventId, event }) {
  if (!env.GOOGLE_CALENDAR_ENABLED) {
    return {
      provider: 'google_calendar',
      enabled: false,
      status: 'skipped',
      message: 'Google Calendar provider is disabled in environment.',
      calendarId,
      eventId,
      event,
    };
  }

  return {
    provider: 'google_calendar',
    enabled: true,
    status: 'pending',
    message: 'Replace this stub with actual Google Calendar update logic later.',
    calendarId,
    eventId,
    event,
  };
}

module.exports = {
  createCalendarEvent,
  updateCalendarEvent,
};