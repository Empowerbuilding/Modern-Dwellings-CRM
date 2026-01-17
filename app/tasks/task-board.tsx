'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User, Contact, Deal, Company, TaskPriority, TaskType } from '@/lib/types'
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_TYPE_COLORS,
} from '@/lib/types'
import type { TaskWithRelations } from './page'
import { TaskSlideOver } from './task-slide-over'

type StatusFilter = 'all' | 'due_today' | 'overdue' | 'upcoming' | 'completed' | 'no_due_date'
type SortField = 'due_date' | 'priority' | 'title' | 'created_at'
type SortDirection = 'asc' | 'desc'

type ColumnKey = 'associated' | 'dueDate' | 'priority' | 'type' | 'assignedTo' | 'contactEmail' | 'contactPhone'

interface ColumnConfig {
  key: ColumnKey
  label: string
  defaultVisible: boolean
}

const COLUMN_CONFIGS: ColumnConfig[] = [
  { key: 'associated', label: 'Associated With', defaultVisible: true },
  { key: 'dueDate', label: 'Due Date', defaultVisible: true },
  { key: 'priority', label: 'Priority', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'assignedTo', label: 'Assigned To', defaultVisible: true },
  { key: 'contactEmail', label: 'Contact Email', defaultVisible: false },
  { key: 'contactPhone', label: 'Contact Phone', defaultVisible: false },
]

const COLUMN_STORAGE_KEY = 'crm-task-board-columns'
const SORT_STORAGE_KEY = 'crm-task-board-sort'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Tasks' },
  { value: 'due_today', label: 'Due Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'no_due_date', label: 'No Due Date' },
  { value: 'completed', label: 'Completed' },
]

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

interface TaskBoardProps {
  initialTasks: TaskWithRelations[]
  users: User[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'owner_id'>[]
  deals: Pick<Deal, 'id' | 'title'>[]
  companies: Pick<Company, 'id' | 'name'>[]
  initialTaskId?: string | null
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  // Parse as local date to avoid timezone issues (YYYY-MM-DD format)
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeString: string | null): string {
  if (!timeString) return ''
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function isToday(dateString: string): boolean {
  const today = new Date()
  // Parse as local date to avoid timezone issues
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
  // Parse as local date to avoid timezone issues
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

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onCancel()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onCancel])

  // Close on click outside
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

export function TaskBoard({ initialTasks, users, contacts, deals, companies, initialTaskId }: TaskBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('')
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window === 'undefined') return 'due_date'
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.field) return parsed.field as SortField
      }
    } catch {}
    return 'due_date'
  })
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window === 'undefined') return 'asc'
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.direction) return parsed.direction as SortDirection
      }
    } catch {}
    return 'asc'
  })
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null)
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => {
    const defaults: Record<ColumnKey, boolean> = {} as Record<ColumnKey, boolean>
    COLUMN_CONFIGS.forEach((col) => {
      defaults[col.key] = col.defaultVisible
    })
    return defaults
  })
  const columnSettingsRef = useRef<HTMLDivElement>(null)

  // Load column settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setVisibleColumns((prev) => ({ ...prev, ...parsed }))
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [])

  // Save column settings to localStorage
  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] }
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Close column settings dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(event.target as Node)) {
        setColumnSettingsOpen(false)
      }
    }
    if (columnSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [columnSettingsOpen])

  // Auto-open task slide-over if initialTaskId is provided
  useEffect(() => {
    if (initialTaskId) {
      const task = tasks.find((t) => t.id === initialTaskId)
      if (task) {
        setEditingTask(task)
        setSlideOverOpen(true)
      }
    }
  }, [initialTaskId, tasks])

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((task) => {
        return (
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.contact_name?.toLowerCase().includes(searchLower) ||
          task.deal_title?.toLowerCase().includes(searchLower) ||
          task.company_name?.toLowerCase().includes(searchLower)
        )
      })
    }

    // Status filter
    switch (statusFilter) {
      case 'due_today':
        result = result.filter((task) => !task.completed && task.due_date && isToday(task.due_date))
        break
      case 'overdue':
        result = result.filter((task) => !task.completed && task.due_date && isOverdue(task.due_date))
        break
      case 'upcoming':
        result = result.filter(
          (task) => !task.completed && task.due_date && !isToday(task.due_date) && !isOverdue(task.due_date)
        )
        break
      case 'completed':
        result = result.filter((task) => task.completed)
        break
      case 'no_due_date':
        result = result.filter((task) => !task.completed && !task.due_date)
        break
      case 'all':
      default:
        // Show all non-completed tasks by default, unless explicitly showing completed
        if (statusFilter === 'all') {
          result = result.filter((task) => !task.completed)
        }
        break
    }

    // Priority filter
    if (priorityFilter) {
      result = result.filter((task) => task.priority === priorityFilter)
    }

    // Type filter
    if (typeFilter) {
      result = result.filter((task) => task.task_type === typeFilter)
    }

    // Assignee filter
    if (assigneeFilter) {
      result = result.filter((task) => task.assigned_to === assigneeFilter)
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'due_date':
          // Tasks with no due date should come last
          if (!a.due_date && !b.due_date) comparison = 0
          else if (!a.due_date) comparison = 1
          else if (!b.due_date) comparison = -1
          else comparison = a.due_date.localeCompare(b.due_date)
          break
        case 'priority':
          comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'created_at':
          comparison = (a.created_at ?? '').localeCompare(b.created_at ?? '')
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [tasks, search, statusFilter, priorityFilter, typeFilter, assigneeFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection = 'asc'
    if (sortField === field) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDirection)
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    // Save to localStorage
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({
      field: sortField === field ? field : field,
      direction: sortField === field ? newDirection : 'asc'
    }))
  }

  const handleCheckboxClick = (task: TaskWithRelations, e: React.MouseEvent) => {
    e.stopPropagation()

    if (task.completed) {
      // Uncompleting - no confirmation needed
      performToggleComplete(task)
    } else {
      // Completing - show confirmation
      setConfirmingTaskId(task.id)
    }
  }

  const performToggleComplete = async (task: TaskWithRelations) => {
    setConfirmingTaskId(null)

    const newCompleted = !task.completed
    const completedAt = newCompleted ? new Date().toISOString() : null

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: newCompleted, completed_at: completedAt } : t
      )
    )

    const { error } = await (supabase.from('tasks') as any)
      .update({ completed: newCompleted, completed_at: completedAt })
      .eq('id', task.id)

    if (error) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: task.completed, completed_at: task.completed_at } : t
        )
      )
      console.error('Failed to update task:', error)
    }
  }

  const handleRowClick = (task: TaskWithRelations) => {
    setEditingTask(task)
    setSlideOverOpen(true)
  }

  const handleAddNew = () => {
    setEditingTask(null)
    setSlideOverOpen(true)
  }

  const handleSave = (savedTask: TaskWithRelations) => {
    if (editingTask) {
      setTasks((prev) => prev.map((t) => (t.id === savedTask.id ? savedTask : t)))
    } else {
      setTasks((prev) => [savedTask, ...prev])
    }
    setSlideOverOpen(false)
    setEditingTask(null)
  }

  const handleDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setSlideOverOpen(false)
    setEditingTask(null)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">↕</span>
    }
    return <span className="text-gray-600 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  // Calculate counts for status badges
  const taskCounts = useMemo(() => {
    const today = tasks.filter((t) => !t.completed && t.due_date && isToday(t.due_date)).length
    const overdue = tasks.filter((t) => !t.completed && t.due_date && isOverdue(t.due_date)).length
    const upcoming = tasks.filter(
      (t) => !t.completed && t.due_date && !isToday(t.due_date) && !isOverdue(t.due_date)
    ).length
    const noDueDate = tasks.filter((t) => !t.completed && !t.due_date).length
    const completed = tasks.filter((t) => t.completed).length
    const all = tasks.filter((t) => !t.completed).length

    return { today, overdue, upcoming, noDueDate, completed, all }
  }, [tasks])

  return (
    <>
      <div className="flex items-center justify-between mb-6 pt-14 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="relative" ref={columnSettingsRef}>
            <button
              onClick={() => setColumnSettingsOpen(!columnSettingsOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Column settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {columnSettingsOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px]">
                <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Columns</p>
                {COLUMN_CONFIGS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map((filter) => {
          let count = 0
          switch (filter.value) {
            case 'all':
              count = taskCounts.all
              break
            case 'due_today':
              count = taskCounts.today
              break
            case 'overdue':
              count = taskCounts.overdue
              break
            case 'upcoming':
              count = taskCounts.upcoming
              break
            case 'no_due_date':
              count = taskCounts.noDueDate
              break
            case 'completed':
              count = taskCounts.completed
              break
          }

          return (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === filter.value
                  ? filter.value === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                  : filter.value === 'overdue' && count > 0
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                    statusFilter === filter.value
                      ? 'bg-white/20'
                      : filter.value === 'overdue' && count > 0
                        ? 'bg-red-200'
                        : 'bg-gray-200'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="">All Priorities</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {TASK_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TaskType | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="">All Types</option>
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {TASK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          <option value="">All Assignees</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {/* Task Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-4 py-3"></th>
                <th
                  onClick={() => handleSort('title')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Task <SortIcon field="title" />
                </th>
                {visibleColumns.associated && (
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Associated With
                  </th>
                )}
                {visibleColumns.contactEmail && (
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                )}
                {visibleColumns.contactPhone && (
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                )}
                {visibleColumns.dueDate && (
                  <th
                    onClick={() => handleSort('due_date')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Due Date <SortIcon field="due_date" />
                  </th>
                )}
                {visibleColumns.priority && (
                  <th
                    onClick={() => handleSort('priority')}
                    className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Priority <SortIcon field="priority" />
                  </th>
                )}
                {visibleColumns.type && (
                  <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                )}
                {visibleColumns.assignedTo && (
                  <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={2 + Object.values(visibleColumns).filter(Boolean).length} className="px-4 py-8 text-center text-gray-500">
                    {tasks.length === 0
                      ? 'No tasks yet. Create your first task to get started.'
                      : 'No tasks match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedTasks.map((task) => {
                  const dueDateStatus = getDueDateStatus(task)

                  return (
                    <tr
                      key={task.id}
                      onClick={() => handleRowClick(task)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        task.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={(e) => handleCheckboxClick(task, e)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              task.completed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {task.completed && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                          {confirmingTaskId === task.id && (
                            <ConfirmationPopover
                              onConfirm={() => performToggleComplete(task)}
                              onCancel={() => setConfirmingTaskId(null)}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={`font-medium text-gray-900 ${task.completed ? 'line-through' : ''}`}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {task.description}
                          </p>
                        )}
                      </td>
                      {visibleColumns.associated && (
                        <td className="hidden sm:table-cell px-4 py-3">
                          <div className="text-sm space-y-0.5">
                            {task.contact_id && task.contact_name && (
                              <Link
                                href={`/contacts/${task.contact_id}?from=tasks`}
                                onClick={(e) => e.stopPropagation()}
                                className="block text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {task.contact_name}
                              </Link>
                            )}
                            {task.deal_id && task.deal_title && (
                              <Link
                                href={`/deals/${task.deal_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="block text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[150px]"
                              >
                                {task.deal_title}
                              </Link>
                            )}
                            {task.company_id && task.company_name && !task.contact_id && (
                              <Link
                                href={`/companies/${task.company_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="block text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {task.company_name}
                              </Link>
                            )}
                            {!task.contact_id && !task.deal_id && !task.company_id && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.contactEmail && (
                        <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-600">
                          {task.contact_email ? (
                            <a
                              href={`mailto:${task.contact_email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {task.contact_email}
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.contactPhone && (
                        <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-600">
                          {task.contact_phone ? (
                            <a
                              href={`tel:${task.contact_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {task.contact_phone}
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.dueDate && (
                        <td className="px-4 py-3">
                          {task.due_date ? (
                            <div
                              className={`text-sm ${
                                dueDateStatus === 'overdue'
                                  ? 'text-red-600 font-medium'
                                  : dueDateStatus === 'today'
                                    ? 'text-orange-600 font-medium'
                                    : 'text-gray-600'
                              }`}
                            >
                              <p>{formatDate(task.due_date)}</p>
                              {task.due_time && (
                                <p className="text-xs">{formatTime(task.due_time)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No due date</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.priority && (
                        <td className="hidden md:table-cell px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TASK_PRIORITY_COLORS[task.priority]}`}
                          >
                            {TASK_PRIORITY_LABELS[task.priority]}
                          </span>
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="hidden lg:table-cell px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TASK_TYPE_COLORS[task.task_type]}`}
                          >
                            {TASK_TYPE_LABELS[task.task_type]}
                          </span>
                        </td>
                      )}
                      {visibleColumns.assignedTo && (
                        <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-600">
                          {task.assigned_user_name ?? '-'}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        {filteredAndSortedTasks.length} of {tasks.filter((t) => !t.completed).length} active tasks
        {taskCounts.completed > 0 && ` (${taskCounts.completed} completed)`}
      </p>

      <TaskSlideOver
        open={slideOverOpen}
        onClose={() => {
          setSlideOverOpen(false)
          setEditingTask(null)
        }}
        task={editingTask}
        users={users}
        contacts={contacts}
        deals={deals}
        companies={companies}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
