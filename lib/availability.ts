// Meeting availability calculation utilities

export interface TimeSlot {
  start: Date
  end: Date
}

export interface MeetingTypeConfig {
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  availability_start: string // "08:00"
  availability_end: string // "17:00"
  available_days: number[] // [1,2,3,4,5] where 0=Sun, 1=Mon
  timezone: string
  min_notice_hours: number
}

interface BusyPeriod {
  start: Date
  end: Date
}

interface ExistingMeeting {
  start_time: Date
  end_time: Date
}

/**
 * Check if two time ranges overlap
 */
export function isOverlapping(
  range1: { start: Date; end: Date },
  range2: { start: Date; end: Date }
): boolean {
  return range1.start < range2.end && range1.end > range2.start
}

/**
 * Validate that a Date object is valid
 */
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Parse a time string (e.g., "08:00") and combine with a date in a specific timezone
 * Returns the Date in UTC
 */
function parseTimeInTimezone(
  date: Date,
  timeStr: string,
  timezone: string
): Date {
  // Validate input date
  if (!isValidDate(date)) {
    console.error('[availability] Invalid date passed to parseTimeInTimezone:', date)
    throw new Error(`Invalid date: ${date}`)
  }

  // Validate time string format (accept HH:MM or HH:MM:SS from PostgreSQL)
  if (!timeStr || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    console.error('[availability] Invalid time string:', timeStr)
    throw new Error(`Invalid time string: ${timeStr}`)
  }

  // Strip seconds if present (e.g., "08:00:00" -> "08:00")
  const timeParts = timeStr.split(':')
  const normalizedTimeStr = timeParts.slice(0, 2).join(':')

  // Parse hours and minutes
  const [hoursStr, minutesStr] = normalizedTimeStr.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error('[availability] Time out of range:', { hours, minutes })
    throw new Error(`Time out of range: ${timeStr}`)
  }

  // Format time with leading zeros
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

  try {
    // Format the date as YYYY-MM-DD in the target timezone
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const dateStr = dateFormatter.format(date)

    // Create an ISO string with the time in the target timezone
    const timeString = `${dateStr}T${formattedTime}:00`

    // Get the offset for this timezone at this date/time
    // Use a known valid date for offset calculation to avoid issues
    const tempDate = new Date(timeString + 'Z')
    if (!isValidDate(tempDate)) {
      console.error('[availability] Failed to create temp date from:', timeString + 'Z')
      throw new Error(`Failed to create date from: ${timeString}`)
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })

    // Parse the offset from the formatted string
    const parts = formatter.formatToParts(tempDate)
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || ''

    // Parse offset like "GMT-6" or "GMT+5:30"
    let offsetMinutes = 0
    const offsetMatch = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (offsetMatch) {
      const sign = offsetMatch[1] === '+' ? 1 : -1
      const hourOffset = parseInt(offsetMatch[2], 10)
      const minOffset = parseInt(offsetMatch[3] || '0', 10)
      offsetMinutes = sign * (hourOffset * 60 + minOffset)
    }

    // Create the final date by adjusting for the timezone offset
    const localDate = new Date(timeString)
    if (!isValidDate(localDate)) {
      console.error('[availability] Failed to create local date from:', timeString)
      throw new Error(`Failed to create date from: ${timeString}`)
    }

    localDate.setMinutes(localDate.getMinutes() - offsetMinutes)

    return localDate
  } catch (error) {
    console.error('[availability] parseTimeInTimezone error:', {
      date: date.toISOString(),
      timeStr,
      timezone,
      error,
    })
    throw error
  }
}

/**
 * Get the day of week for a date in a specific timezone
 * Returns 0=Sun, 1=Mon, ..., 6=Sat
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  if (!isValidDate(date)) {
    console.error('[availability] Invalid date in getDayOfWeekInTimezone:', date)
    return -1
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    })
    const dayName = formatter.format(date)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days.indexOf(dayName)
  } catch (error) {
    console.error('[availability] getDayOfWeekInTimezone error:', { date, timezone, error })
    return -1
  }
}

/**
 * Get the start of day for a date in a specific timezone
 */
function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  return parseTimeInTimezone(date, '00:00', timezone)
}

/**
 * Check if a date is the same day as another date in a specific timezone
 */
function isSameDayInTimezone(
  date1: Date,
  date2: Date,
  timezone: string
): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date1) === formatter.format(date2)
}

/**
 * Get available time slots for a specific date
 */
export function getAvailableSlots(params: {
  meetingType: MeetingTypeConfig
  date: Date
  busyTimes: BusyPeriod[]
  existingMeetings: ExistingMeeting[]
}): TimeSlot[] {
  const { meetingType, date, busyTimes, existingMeetings } = params
  const {
    duration_minutes,
    buffer_before,
    buffer_after,
    availability_start,
    availability_end,
    available_days,
    timezone,
    min_notice_hours,
  } = meetingType

  const slots: TimeSlot[] = []
  const now = new Date()

  // Check if day of week is available
  const dayOfWeek = getDayOfWeekInTimezone(date, timezone)

  console.log('[availability] Day of week check:', {
    date: date.toISOString(),
    dayOfWeek,
    dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] || 'Invalid',
    availableDays: available_days,
    isAvailable: available_days.includes(dayOfWeek),
    timezone,
  })

  if (!available_days.includes(dayOfWeek)) {
    return []
  }

  // Parse availability window for this date in the meeting type's timezone
  const windowStart = parseTimeInTimezone(date, availability_start, timezone)
  const windowEnd = parseTimeInTimezone(date, availability_end, timezone)

  // Calculate minimum allowed start time based on notice hours
  const minNoticeTime = new Date(now.getTime() + min_notice_hours * 60 * 60 * 1000)

  // Generate slots every 30 minutes
  const slotInterval = 30 * 60 * 1000 // 30 minutes in ms
  let currentSlotStart = new Date(windowStart)

  while (currentSlotStart < windowEnd) {
    const slotEnd = new Date(currentSlotStart.getTime() + duration_minutes * 60 * 1000)

    // Skip if slot extends beyond availability window
    if (slotEnd > windowEnd) {
      break
    }

    // Skip if slot start is in the past
    if (currentSlotStart < now) {
      currentSlotStart = new Date(currentSlotStart.getTime() + slotInterval)
      continue
    }

    // Skip if slot start is within min_notice_hours from now
    if (currentSlotStart < minNoticeTime) {
      currentSlotStart = new Date(currentSlotStart.getTime() + slotInterval)
      continue
    }

    // Calculate buffer window
    const bufferStart = new Date(currentSlotStart.getTime() - buffer_before * 60 * 1000)
    const bufferEnd = new Date(slotEnd.getTime() + buffer_after * 60 * 1000)
    const bufferWindow = { start: bufferStart, end: bufferEnd }

    // Check if buffer window overlaps with any busy times
    const overlapsWithBusy = busyTimes.some((busy) =>
      isOverlapping(bufferWindow, { start: busy.start, end: busy.end })
    )

    if (overlapsWithBusy) {
      currentSlotStart = new Date(currentSlotStart.getTime() + slotInterval)
      continue
    }

    // Check if buffer window overlaps with any existing meetings
    const overlapsWithMeetings = existingMeetings.some((meeting) =>
      isOverlapping(bufferWindow, {
        start: new Date(meeting.start_time),
        end: new Date(meeting.end_time),
      })
    )

    if (overlapsWithMeetings) {
      currentSlotStart = new Date(currentSlotStart.getTime() + slotInterval)
      continue
    }

    // Slot is available
    slots.push({
      start: new Date(currentSlotStart),
      end: new Date(slotEnd),
    })

    currentSlotStart = new Date(currentSlotStart.getTime() + slotInterval)
  }

  return slots
}

/**
 * Get dates that have at least one available slot
 */
export function getAvailableDates(params: {
  meetingType: MeetingTypeConfig
  startDate: Date
  endDate: Date
  busyTimes: BusyPeriod[]
  existingMeetings: ExistingMeeting[]
}): Date[] {
  const { meetingType, startDate, endDate, busyTimes, existingMeetings } = params
  const { timezone } = meetingType

  console.log('[availability] getAvailableDates called:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    timezone,
    availableDays: meetingType.available_days,
  })

  const availableDates: Date[] = []

  // Normalize start date to beginning of day in the timezone
  let currentDate = getStartOfDayInTimezone(startDate, timezone)
  const end = getStartOfDayInTimezone(endDate, timezone)

  console.log('[availability] Normalized date range:', {
    currentDate: currentDate.toISOString(),
    end: end.toISOString(),
  })

  // Add one day to end to include it
  const endPlusOne = new Date(end.getTime() + 24 * 60 * 60 * 1000)

  let iterationCount = 0
  while (currentDate < endPlusOne) {
    iterationCount++
    if (iterationCount > 100) {
      console.error('[availability] Too many iterations, breaking loop')
      break
    }

    const dayOfWeek = getDayOfWeekInTimezone(currentDate, timezone)
    console.log('[availability] Checking date:', {
      iteration: iterationCount,
      date: currentDate.toISOString(),
      dayOfWeek,
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] || 'Invalid',
      isInAvailableDays: meetingType.available_days.includes(dayOfWeek),
    })

    // Filter busy times and meetings to only those that could affect this date
    const dayStart = getStartOfDayInTimezone(currentDate, timezone)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const relevantBusyTimes = busyTimes.filter(
      (busy) => busy.end > dayStart && busy.start < dayEnd
    )

    const relevantMeetings = existingMeetings.filter(
      (meeting) =>
        new Date(meeting.end_time) > dayStart &&
        new Date(meeting.start_time) < dayEnd
    )

    const slots = getAvailableSlots({
      meetingType,
      date: currentDate,
      busyTimes: relevantBusyTimes,
      existingMeetings: relevantMeetings,
    })

    if (slots.length > 0) {
      console.log('[availability] Found', slots.length, 'slots for', currentDate.toISOString())
      availableDates.push(new Date(currentDate))
    } else {
      console.log('[availability] No slots for', currentDate.toISOString())
    }

    // Move to next day
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  }

  console.log('[availability] Final result:', availableDates.length, 'available dates')
  return availableDates
}

/**
 * Format a time slot for display in a specific timezone
 */
export function formatSlotTime(
  slot: TimeSlot,
  timezone: string
): { date: string; startTime: string; endTime: string } {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return {
    date: dateFormatter.format(slot.start),
    startTime: timeFormatter.format(slot.start),
    endTime: timeFormatter.format(slot.end),
  }
}
