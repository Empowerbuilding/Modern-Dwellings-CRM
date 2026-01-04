'use client'

import { useState, useEffect } from 'react'

interface CustomField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required: boolean
  options?: string[]
  placeholder?: string
}

interface MeetingType {
  id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  availability_start: string
  availability_end: string
  available_days: number[]
  timezone: string
  max_days_ahead: number
  min_notice_hours: number
  location_type: string
  custom_location: string | null
  custom_fields: CustomField[]
  confirmation_message: string | null
  brand_color: string
  logo_url: string | null
  is_active: boolean
}

interface MeetingTypeFormProps {
  meetingType?: MeetingType | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface FormData {
  title: string
  slug: string
  description: string
  duration_minutes: number
  location_type: string
  custom_location: string
  available_days: number[]
  availability_start: string
  availability_end: string
  timezone: string
  buffer_before: number
  buffer_after: number
  min_notice_hours: number
  max_days_ahead: number
  custom_fields: CustomField[]
  brand_color: string
  logo_url: string
  confirmation_message: string
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
]

const LOCATION_OPTIONS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'in_person', label: 'In Person' },
  { value: 'custom', label: 'Custom' },
]

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (AZ)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
]

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select/Dropdown' },
  { value: 'number', label: 'Number' },
]

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

const defaultFormData: FormData = {
  title: '',
  slug: '',
  description: '',
  duration_minutes: 30,
  location_type: 'phone',
  custom_location: '',
  available_days: [1, 2, 3, 4, 5],
  availability_start: '08:00',
  availability_end: '17:00',
  timezone: 'America/Chicago',
  buffer_before: 0,
  buffer_after: 15,
  min_notice_hours: 4,
  max_days_ahead: 60,
  custom_fields: [],
  brand_color: '#2d3748',
  logo_url: '',
  confirmation_message: '',
}

export function MeetingTypeForm({
  meetingType,
  open,
  onClose,
  onSaved,
}: MeetingTypeFormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('basic')

  const isEditing = !!meetingType

  // Initialize form data
  useEffect(() => {
    if (open) {
      if (meetingType) {
        setFormData({
          title: meetingType.title,
          slug: meetingType.slug,
          description: meetingType.description || '',
          duration_minutes: meetingType.duration_minutes,
          location_type: meetingType.location_type,
          custom_location: meetingType.custom_location || '',
          available_days: meetingType.available_days,
          availability_start: meetingType.availability_start,
          availability_end: meetingType.availability_end,
          timezone: meetingType.timezone,
          buffer_before: meetingType.buffer_before,
          buffer_after: meetingType.buffer_after,
          min_notice_hours: meetingType.min_notice_hours,
          max_days_ahead: meetingType.max_days_ahead,
          custom_fields: meetingType.custom_fields || [],
          brand_color: meetingType.brand_color,
          logo_url: meetingType.logo_url || '',
          confirmation_message: meetingType.confirmation_message || '',
        })
        setSlugManuallyEdited(true)
      } else {
        setFormData(defaultFormData)
        setSlugManuallyEdited(false)
      }
      setError(null)
      setActiveSection('basic')
    }
  }, [meetingType, open])

  // Auto-generate slug from title
  function handleTitleChange(title: string) {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: !slugManuallyEdited ? generateSlug(title) : prev.slug,
    }))
  }

  function handleSlugChange(slug: string) {
    setSlugManuallyEdited(true)
    setFormData((prev) => ({
      ...prev,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    }))
  }

  function toggleDay(day: number) {
    setFormData((prev) => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter((d) => d !== day)
        : [...prev.available_days, day].sort(),
    }))
  }

  function addCustomField() {
    setFormData((prev) => ({
      ...prev,
      custom_fields: [
        ...prev.custom_fields,
        {
          id: generateFieldId(),
          label: '',
          type: 'text',
          required: false,
          options: [],
        },
      ],
    }))
  }

  function updateCustomField(index: number, updates: Partial<CustomField>) {
    setFormData((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.map((field, i) =>
        i === index ? { ...field, ...updates } : field
      ),
    }))
  }

  function removeCustomField(index: number) {
    setFormData((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    if (!formData.slug.trim() || formData.slug.length < 3) {
      setError('Slug must be at least 3 characters')
      return
    }

    if (formData.available_days.length === 0) {
      setError('Select at least one available day')
      return
    }

    setSaving(true)

    try {
      const payload = {
        title: formData.title.trim(),
        slug: formData.slug,
        description: formData.description.trim() || null,
        duration_minutes: formData.duration_minutes,
        location_type: formData.location_type,
        custom_location:
          formData.location_type === 'in_person' || formData.location_type === 'custom'
            ? formData.custom_location.trim() || null
            : null,
        available_days: formData.available_days,
        availability_start: formData.availability_start,
        availability_end: formData.availability_end,
        timezone: formData.timezone,
        buffer_before: formData.buffer_before,
        buffer_after: formData.buffer_after,
        min_notice_hours: formData.min_notice_hours,
        max_days_ahead: formData.max_days_ahead,
        custom_fields: formData.custom_fields.filter((f) => f.label.trim()),
        brand_color: formData.brand_color,
        logo_url: formData.logo_url.trim() || null,
        confirmation_message: formData.confirmation_message.trim() || null,
      }

      const url = isEditing
        ? `/api/meeting-types/${meetingType.id}`
        : '/api/meeting-types'

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save meeting type')
      }

      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save meeting type:', err)
      setError(err instanceof Error ? err.message : 'Failed to save meeting type')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Meeting Type' : 'New Meeting Type'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-6 py-2 border-b border-gray-200 flex gap-1 overflow-x-auto">
          {[
            { id: 'basic', label: 'Basic' },
            { id: 'availability', label: 'Availability' },
            { id: 'booking', label: 'Booking Rules' },
            { id: 'fields', label: 'Custom Fields' },
            { id: 'customize', label: 'Customize' },
          ].map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeSection === section.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Basic Info Section */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g., 30 Minute Consultation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="e.g., 30-minute-consultation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Booking link: crm.empowerbuilding.ai/book/<span className="font-medium">{formData.slug || 'your-slug'}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this meeting is about..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration *
                  </label>
                  <select
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <select
                    value={formData.location_type}
                    onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    {LOCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(formData.location_type === 'in_person' || formData.location_type === 'custom') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Details
                  </label>
                  <input
                    type="text"
                    value={formData.custom_location}
                    onChange={(e) => setFormData({ ...formData, custom_location: e.target.value })}
                    placeholder="Enter address or location details"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Availability Section */}
          {activeSection === 'availability' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Days *
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        formData.available_days.includes(day.value)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.availability_start}
                    onChange={(e) => setFormData({ ...formData, availability_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.availability_end}
                    onChange={(e) => setFormData({ ...formData, availability_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Booking Rules Section */}
          {activeSection === 'booking' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buffer Before (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.buffer_before}
                    onChange={(e) => setFormData({ ...formData, buffer_before: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Blocked time before meeting</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buffer After (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.buffer_after}
                    onChange={(e) => setFormData({ ...formData, buffer_after: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Blocked time after meeting</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Notice (hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="168"
                    value={formData.min_notice_hours}
                    onChange={(e) => setFormData({ ...formData, min_notice_hours: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">How far in advance must guests book</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Days Ahead
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.max_days_ahead}
                    onChange={(e) => setFormData({ ...formData, max_days_ahead: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">How far into the future guests can book</p>
                </div>
              </div>
            </div>
          )}

          {/* Custom Fields Section */}
          {activeSection === 'fields' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Custom Questions</h3>
                  <p className="text-xs text-gray-500">Ask guests for additional information when booking</p>
                </div>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Field
                </button>
              </div>

              {formData.custom_fields.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-500">No custom fields yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add fields like &quot;Preferred Square Footage&quot; or &quot;Budget Range&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.custom_fields.map((field, index) => (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Field {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCustomField(index)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Label
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateCustomField(index, { label: e.target.value })}
                            placeholder="e.g., Preferred Square Footage"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Type
                            </label>
                            <select
                              value={field.type}
                              onChange={(e) =>
                                updateCustomField(index, {
                                  type: e.target.value as CustomField['type'],
                                })
                              }
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            >
                              {FIELD_TYPES.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) =>
                                  updateCustomField(index, { required: e.target.checked })
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Required</span>
                            </label>
                          </div>
                        </div>

                        {field.type === 'select' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Options (one per line)
                            </label>
                            <textarea
                              value={(field.options || []).join('\n')}
                              onChange={(e) =>
                                updateCustomField(index, {
                                  options: e.target.value.split('\n').filter((o) => o.trim()),
                                })
                              }
                              placeholder="Under $100k&#10;$100k-$250k&#10;$250k-$500k&#10;Over $500k"
                              rows={4}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Customize Section */}
          {activeSection === 'customize' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.brand_color}
                    onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.brand_color}
                    onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Used for buttons and accents on the booking page</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">Logo displayed on the booking page (recommended: square image, at least 48x48px)</p>
                {formData.logo_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={formData.logo_url}
                      alt="Logo preview"
                      className="w-12 h-12 rounded-lg object-contain bg-gray-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <span className="text-xs text-gray-500">Preview</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmation Message
                </label>
                <textarea
                  value={formData.confirmation_message}
                  onChange={(e) => setFormData({ ...formData, confirmation_message: e.target.value })}
                  placeholder="Thank you for scheduling! We look forward to speaking with you."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
                <p className="mt-1 text-xs text-gray-500">Shown to guests after they book</p>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Meeting Type'}
          </button>
        </div>
      </div>
    </>
  )
}
