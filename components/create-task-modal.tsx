'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Contact, Deal, Company, User, TaskPriority, TaskType } from '@/lib/types'
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from '@/lib/types'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  contact?: Pick<Contact, 'id' | 'first_name' | 'last_name'> | null
  deal?: Pick<Deal, 'id' | 'title'> | null
  company?: Pick<Company, 'id' | 'name'> | null
  contactOwnerId?: string | null
}

interface FormData {
  title: string
  description: string
  priority: TaskPriority
  task_type: TaskType
  due_date: string
  due_time: string
  assigned_to: string
}

export function CreateTaskModal({
  isOpen,
  onClose,
  contact,
  deal,
  company,
  contactOwnerId,
}: CreateTaskModalProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'medium',
    task_type: 'to_do',
    due_date: '',
    due_time: '',
    assigned_to: contactOwnerId ?? '',
  })
  const [users, setUsers] = useState<User[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTask, setCreatedTask] = useState<{ id: string; title: string } | null>(null)

  // Fetch users on mount
  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase.from('users').select('*').order('name')
      if (data) {
        setUsers(data as User[])
      }
    }
    fetchUsers()
  }, [])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        task_type: 'to_do',
        due_date: '',
        due_time: '',
        assigned_to: contactOwnerId ?? '',
      })
      setCreatedTask(null)
      setError(null)
    }
  }, [isOpen, contactOwnerId])

  const associatedWith = contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal
      ? deal.title
      : company
        ? company.name
        : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreating(true)

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        task_type: formData.task_type,
        due_date: formData.due_date || null,
        due_time: formData.due_time || null,
        assigned_to: formData.assigned_to || null,
        contact_id: contact?.id || null,
        deal_id: deal?.id || null,
        company_id: company?.id || null,
      }

      const { data: newTask, error: taskError } = await (supabase.from('tasks') as any)
        .insert(payload)
        .select('id, title')
        .single()

      if (taskError) throw taskError

      setCreatedTask(newTask)
      router.refresh()
    } catch (err) {
      console.error('Failed to create task:', err)
      setError('Failed to create task. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setCreatedTask(null)
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      task_type: 'to_do',
      due_date: '',
      due_time: '',
      assigned_to: contactOwnerId ?? '',
    })
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {createdTask ? 'Task Created' : 'Create Task'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {createdTask ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Task Created Successfully</h3>
                <p className="text-sm text-gray-600 mb-6">{createdTask.title}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Close
                  </button>
                  <Link
                    href="/tasks"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View All Tasks
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* Associated With Preview */}
                {associatedWith && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Associated With</p>
                    <p className="text-sm font-medium text-gray-900">{associatedWith}</p>
                  </div>
                )}

                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Follow up with client"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Priority and Type Row */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value as TaskPriority })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {TASK_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {TASK_PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={formData.task_type}
                      onChange={(e) =>
                        setFormData({ ...formData, task_type: e.target.value as TaskType })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {TASK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TASK_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due Date and Time Row */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Time</label>
                    <input
                      type="time"
                      value={formData.due_time}
                      onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Assigned To */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {creating ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
