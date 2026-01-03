// Google Calendar OAuth and API utilities

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

interface GoogleUserInfo {
  email: string
  verified_email: boolean
}

interface BusyPeriod {
  start: Date
  end: Date
}

interface FreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: Array<{ start: string; end: string }>
    }
  }
}

interface CalendarEvent {
  id: string
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string
      uri: string
    }>
  }
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens and fetch user email
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string | undefined
  expires_in: number
  email: string
}> {
  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const tokens: TokenResponse = await tokenResponse.json()

  // Fetch user email
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  })

  if (!userInfoResponse.ok) {
    const error = await userInfoResponse.text()
    throw new Error(`Failed to fetch user info: ${error}`)
  }

  const userInfo: GoogleUserInfo = await userInfoResponse.json()

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    email: userInfo.email,
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const data: TokenResponse = await response.json()

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  }
}

/**
 * Get busy time periods from Google Calendar
 */
export async function getCalendarFreeBusy(params: {
  accessToken: string
  calendarId: string
  timeMin: Date
  timeMax: Date
}): Promise<BusyPeriod[]> {
  const { accessToken, calendarId, timeMin, timeMax } = params

  console.log('[google-calendar] FreeBusy request:', {
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  })

  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[google-calendar] FreeBusy error:', error)
    throw new Error(`Failed to fetch free/busy data: ${error}`)
  }

  const data: FreeBusyResponse = await response.json()

  console.log('[google-calendar] FreeBusy raw response:', JSON.stringify(data, null, 2))

  const busyPeriods = data.calendars[calendarId]?.busy || []

  console.log('[google-calendar] Parsed busy periods:', busyPeriods.length, 'periods')
  busyPeriods.forEach((period, i) => {
    console.log(`[google-calendar]   [${i}] ${period.start} - ${period.end}`)
  })

  return busyPeriods.map((period) => ({
    start: new Date(period.start),
    end: new Date(period.end),
  }))
}

/**
 * Create a calendar event with optional Google Meet
 */
export async function createCalendarEvent(params: {
  accessToken: string
  calendarId: string
  summary: string
  description: string
  startTime: Date
  endTime: Date
  attendeeEmail: string
  addGoogleMeet: boolean
  timezone: string
}): Promise<{ eventId: string; meetLink?: string }> {
  const {
    accessToken,
    calendarId,
    summary,
    description,
    startTime,
    endTime,
    attendeeEmail,
    addGoogleMeet,
    timezone,
  } = params

  const eventBody: Record<string, unknown> = {
    summary,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: timezone,
    },
    attendees: [{ email: attendeeEmail }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 30 }, // 30 minutes before
      ],
    },
  }

  // Add Google Meet conference data if requested
  if (addGoogleMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  if (addGoogleMeet) {
    url.searchParams.set('conferenceDataVersion', '1')
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create calendar event: ${error}`)
  }

  const event: CalendarEvent = await response.json()

  // Extract Meet link from conference data or hangoutLink
  let meetLink: string | undefined
  if (event.hangoutLink) {
    meetLink = event.hangoutLink
  } else if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === 'video'
    )
    meetLink = videoEntry?.uri
  }

  return {
    eventId: event.id,
    meetLink,
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(params: {
  accessToken: string
  calendarId: string
  eventId: string
}): Promise<void> {
  const { accessToken, calendarId, eventId } = params

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  // 204 No Content is success, 410 Gone means already deleted
  if (!response.ok && response.status !== 410) {
    const error = await response.text()
    throw new Error(`Failed to delete calendar event: ${error}`)
  }
}
