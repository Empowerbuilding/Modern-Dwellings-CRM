'use client'

import { useState } from 'react'

interface CustomField {
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  options?: string[]
}

interface MeetingType {
  id: string
  slug: string
  title: string
  duration_minutes: number
  location_type: string
  custom_location?: string
  custom_fields: CustomField[]
  timezone: string
}

interface BookingFormProps {
  meetingType: MeetingType
  hostName: string
  selectedSlot: { start: Date; end: Date }
  timezone: string
  onBack: () => void
  onSuccess: (meeting: unknown) => void
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  notes?: string
  [key: string]: string | undefined
}

function getLocationDisplay(locationType: string, customLocation?: string): string {
  switch (locationType) {
    case 'google_meet':
      return 'Google Meet'
    case 'zoom':
      return 'Zoom Meeting'
    case 'phone':
      return 'Phone Call'
    case 'in_person':
      return customLocation || 'In Person'
    case 'custom':
      return customLocation || 'To be provided'
    default:
      return locationType
  }
}

function getLocationIcon(locationType: string): string {
  switch (locationType) {
    case 'google_meet':
    case 'zoom':
      return '📹'
    case 'phone':
      return '📞'
    case 'in_person':
      return '📍'
    default:
      return '📍'
  }
}

function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {}

  const params = new URLSearchParams(window.location.search)
  const utmParams: Record<string, string> = {}

  const utmSource = params.get('utm_source')
  const utmMedium = params.get('utm_medium')
  const utmCampaign = params.get('utm_campaign')

  if (utmSource) utmParams.utmSource = utmSource
  if (utmMedium) utmParams.utmMedium = utmMedium
  if (utmCampaign) utmParams.utmCampaign = utmCampaign

  return utmParams
}

function getAnonymousId(): string | undefined {
  if (typeof window === 'undefined') return undefined

  // Try window.CRMTracking first
  const crmTracking = (window as unknown as { CRMTracking?: { getVisitorId?: () => string } }).CRMTracking
  if (crmTracking?.getVisitorId) {
    return crmTracking.getVisitorId()
  }

  // Fall back to localStorage
  return localStorage.getItem('crm_anonymous_id') || undefined
}

export default function BookingForm({
  meetingType,
  hostName,
  selectedSlot,
  timezone,
  onBack,
  onSuccess,
}: BookingFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const formattedDate = selectedSlot.start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = selectedSlot.start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const locationDisplay = getLocationDisplay(meetingType.location_type, meetingType.custom_location)
  const locationIcon = getLocationIcon(meetingType.location_type)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required'
    }

    // Validate custom fields
    for (const field of meetingType.custom_fields) {
      if (field.required && !customFieldValues[field.label]?.trim()) {
        newErrors[`custom_${field.label}`] = `${field.label} is required`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: meetingType.slug,
          startTime: selectedSlot.start.toISOString(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
          customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
          timezone,
          anonymousId: getAnonymousId(),
          source: 'website',
          ...getUtmParams(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to book meeting')
      }

      onSuccess(data.meeting)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to book meeting. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCustomFieldChange = (label: string, value: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [label]: value }))
    // Clear error when user types
    if (errors[`custom_${label}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[`custom_${label}`]
        return newErrors
      })
    }
  }

  const renderCustomField = (field: CustomField) => {
    const fieldError = errors[`custom_${field.label}`]
    const value = customFieldValues[field.label] || ''

    const baseInputClasses = `block w-full rounded-lg border px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
      fieldError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
    }`

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.label}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
              rows={3}
              className={baseInputClasses}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {fieldError && <p className="mt-1.5 text-sm text-red-600">{fieldError}</p>}
          </div>
        )

      case 'select':
        return (
          <div key={field.label}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
              className={baseInputClasses}
            >
              <option value="">Select an option</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldError && <p className="mt-1.5 text-sm text-red-600">{fieldError}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={field.label}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
              className={baseInputClasses}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {fieldError && <p className="mt-1.5 text-sm text-red-600">{fieldError}</p>}
          </div>
        )

      default:
        return (
          <div key={field.label}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.label, e.target.value)}
              className={baseInputClasses}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {fieldError && <p className="mt-1.5 text-sm text-red-600">{fieldError}</p>}
          </div>
        )
    }
  }

  const inputClasses = (hasError: boolean) =>
    `block w-full rounded-lg border px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
      hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
    }`

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Your information</h2>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{formattedDate}</span>
              <span className="text-gray-400">at</span>
              <span className="font-medium">{formattedTime}</span>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <span>{locationIcon}</span>
            <span>{locationDisplay}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          </div>
        )}

        {/* Name fields - side by side on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }))
              }}
              className={inputClasses(!!errors.firstName)}
              placeholder="John"
            />
            {errors.firstName && <p className="mt-1.5 text-sm text-red-600">{errors.firstName}</p>}
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }))
              }}
              className={inputClasses(!!errors.lastName)}
              placeholder="Doe"
            />
            {errors.lastName && <p className="mt-1.5 text-sm text-red-600">{errors.lastName}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Your email address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            className={inputClasses(!!errors.email)}
            placeholder="john@example.com"
          />
          {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
            }}
            className={inputClasses(!!errors.phone)}
            placeholder="(555) 123-4567"
          />
          {errors.phone && <p className="mt-1.5 text-sm text-red-600">{errors.phone}</p>}
        </div>

        {/* Custom fields */}
        {meetingType.custom_fields.map(renderCustomField)}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            What would you like to discuss?
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClasses(false)}
            placeholder="Let us know what you'd like to cover in this meeting..."
          />
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Confirming...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
