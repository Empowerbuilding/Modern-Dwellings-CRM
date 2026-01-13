'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User, Contact, Deal, Company, TaskPriority, TaskType, Task } from '@/lib/types'
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_TYPE_COLORS,
} from '@/lib/types'

export interface TaskWithRelations extends Task {
  contact_name: string | null
  deal_title: string | null
  company_name: string | null
  assigned_user_name: string | null
}

interface ContactTasksSectionProps {
  contactId: string
  tasks: TaskWithRelations[]
  users: User[]
  deals: Pick<Deal, 'id' | 'title'>[]
  currentUserId?: string
  contactOwnerId?: string | null
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function isToday(dateString: string): boolean {
  const today = new Date()
  const [year, month, day] = dateString.split('-').map(Number)
  return (
    year === today.getFullYear() &&
    month - 1 === today.getMonth() &&
    day === today.getDate()
  )
}

function isOverdue(dateString: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date < today
}

function getDueDateStatus(task: TaskWithRelations): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!task.due_date) return 'none'
  if (task.completed) return 'none'
  if (isOverdue(task.due_date)) return 'overdue'
  if (isToday(task.due_date)) return 'today'
  return 'upcoming'
}

// Confirmation Popover Component
function ConfirmationPopover({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      onCancel()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onCancel])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-gray-600 mb-2">Mark as complete?</p>
      <div className="flex gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onConfirm()
          }}
          className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCancel()
          }}
          className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// Add Task Modal
function AddTaskModal({
  open,
  onClose,
  contactId,
  users,
  deals,
  onSave,
  defaultAssigneeId,
}: {
  open: boolean
  onClose: () => void
  contactId: string
  users: User[]
  deals: Pick<Deal, 'id' | 'title'>[]
  onSave: (task: TaskWithRelations) => void
  defaultAssigneeId?: string | null
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    task_type: 'to_do' as TaskType,
    due_date: '',
    due_time: '',
    assigned_to: defaultAssigneeId ?? '',
    deal_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        task_type: 'to_do',
        due_date: '',
        due_time: '',
        assigned_to: defaultAssigneeId ?? '',
        deal_id: '',
      })
      setError(null)
    }
  }, [open, defaultAssigneeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        task_type: formData.task_type,
        due_date: formData.due_date || null,
        due_time: formData.due_time || null,
        assigned_to: formData.assigned_to || null,
        contact_id: contactId,
        deal_id: formData.deal_id || null,
        company_id: null,
        completed: false,
      }

      const { data, error: insertError } = await (supabase.from('tasks') as any)
        .insert(payload)
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey(name)
        `)
        .single()

      if (insertError) throw insertError

      const savedTask: TaskWithRelations = {
        ...data,
        contact_name: null,
        deal_title: deals.find(d => d.id === data.deal_id)?.title ?? null,
        company_name: null,
        assigned_user_name: data.assigned_user?.name ?? null,
      }

      onSave(savedTask)
      onClose()
    } catch (err) {
      console.error('Failed to create task:', err)
      setError('Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Task</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Task title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.task_type}
                  onChange={(e) => setFormData({ ...formData, task_type: e.target.value as TaskType })}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Time
                </label>
                <input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
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

            {deals.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Related Deal
                </label>
                <select
                  value={formData.deal_id}
                  onChange={(e) => setFormData({ ...formData, deal_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">No deal</option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function ContactTasksSection({
  contactId,
  tasks: initialTasks,
  users,
  deals,
  currentUserId,
  contactOwnerId,
}: ContactTasksSectionProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const incompleteTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  const handleCheckboxClick = (task: TaskWithRelations, e: React.MouseEvent) => {
    e.stopPropagation()
    if (task.completed) {
      performToggleComplete(task)
    } else {
      setConfirmingTaskId(task.id)
    }
  }

  const performToggleComplete = async (task: TaskWithRelations) => {
    setConfirmingTaskId(null)
    const newCompleted = !task.completed
    const completedAt = newCompleted ? new Date().toISOString() : null

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: newCompleted, completed_at: completedAt } : t
      )
    )

    const { error } = await (supabase.from('tasks') as any)
      .update({ completed: newCompleted, completed_at: completedAt })
      .eq('id', task.id)

    if (error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: task.completed, completed_at: task.completed_at } : t
        )
      )
      console.error('Failed to update task:', error)
    }
  }

  const handleTaskSave = (newTask: TaskWithRelations) => {
    setTasks((prev) => [newTask, ...prev])
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-gray-900">Tasks</h2>
          {tasks.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {incompleteTasks.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No tasks yet
        </p>
      ) : (
        <div className="space-y-2">
          {/* Incomplete tasks */}
          {incompleteTasks.map((task) => {
            const dueDateStatus = getDueDateStatus(task)
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="relative pt-0.5">
                  <button
                    onClick={(e) => handleCheckboxClick(task, e)}
                    className="w-4 h-4 rounded border-2 border-gray-300 hover:border-gray-400 flex items-center justify-center transition-colors"
                  />
                  {confirmingTaskId === task.id && (
                    <ConfirmationPopover
                      onConfirm={() => performToggleComplete(task)}
                      onCancel={() => setConfirmingTaskId(null)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/tasks?taskId=${task.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 block truncate"
                  >
                    {task.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {task.due_date && (
                      <span
                        className={`text-xs ${
                          dueDateStatus === 'overdue'
                            ? 'text-red-600 font-medium'
                            : dueDateStatus === 'today'
                              ? 'text-orange-600 font-medium'
                              : 'text-gray-500'
                        }`}
                      >
                        {formatDate(task.due_date)}
                      </span>
                    )}
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${TASK_PRIORITY_COLORS[task.priority]}`}
                    >
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </span>
                    {task.assigned_user_name && (
                      <span className="text-xs text-gray-500">
                        {task.assigned_user_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-2"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {completedTasks.length} completed
              </button>
              {showCompleted && (
                <div className="space-y-2 mt-2">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-2 rounded-lg opacity-60"
                    >
                      <div className="relative pt-0.5">
                        <button
                          onClick={(e) => handleCheckboxClick(task, e)}
                          className="w-4 h-4 rounded border-2 bg-green-500 border-green-500 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-500 line-through block truncate">
                          {task.title}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AddTaskModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        contactId={contactId}
        users={users}
        deals={deals}
        onSave={handleTaskSave}
        defaultAssigneeId={contactOwnerId}
      />
    </div>
  )
}
