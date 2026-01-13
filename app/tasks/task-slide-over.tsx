'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User, Contact, Deal, Company, TaskPriority, TaskType, NoteWithAuthor } from '@/lib/types'
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  TASK_PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from '@/lib/types'
import type { TaskWithRelations } from './page'

interface TaskSlideOverProps {
  open: boolean
  onClose: () => void
  task: TaskWithRelations | null
  users: User[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'owner_id'>[]
  deals: Pick<Deal, 'id' | 'title'>[]
  companies: Pick<Company, 'id' | 'name'>[]
  onSave: (task: TaskWithRelations) => void
  onDelete: (taskId: string) => void
}

interface FormData {
  title: string
  description: string
  priority: TaskPriority
  task_type: TaskType
  due_date: string
  due_time: string
  assigned_to: string
  contact_id: string
  deal_id: string
  company_id: string
}

export function TaskSlideOver({
  open,
  onClose,
  task,
  users,
  contacts,
  deals,
  companies,
  onSave,
  onDelete,
}: TaskSlideOverProps) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'medium',
    task_type: 'to_do',
    due_date: '',
    due_time: '',
    assigned_to: '',
    contact_id: '',
    deal_id: '',
    company_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactNotes, setContactNotes] = useState<NoteWithAuthor[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)

  // Fetch contact notes when contact changes
  const fetchContactNotes = useCallback(async (contactId: string) => {
    if (!contactId) {
      setContactNotes([])
      return
    }

    setLoadingNotes(true)
    try {
      const { data } = await (supabase.from('notes') as any)
        .select('*, author:created_by(id, name)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(5)

      setContactNotes(data || [])
    } catch (err) {
      console.error('Failed to fetch contact notes:', err)
      setContactNotes([])
    } finally {
      setLoadingNotes(false)
    }
  }, [])

  // Fetch notes when contact_id changes
  useEffect(() => {
    if (formData.contact_id) {
      fetchContactNotes(formData.contact_id)
    } else {
      setContactNotes([])
    }
    setExpandedNotes(new Set())
    setNewNote('')
  }, [formData.contact_id, fetchContactNotes])

  const toggleNoteExpanded = (noteId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !formData.contact_id) return

    setAddingNote(true)
    try {
      const { data, error: insertError } = await (supabase.from('notes') as any)
        .insert({
          contact_id: formData.contact_id,
          content: newNote.trim(),
        })
        .select('*, author:created_by(id, name)')
        .single()

      if (insertError) throw insertError

      setContactNotes((prev) => [data, ...prev])
      setNewNote('')
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setAddingNote(false)
    }
  }

  const handleEditNote = (note: NoteWithAuthor) => {
    setEditingNoteId(note.id)
    setEditingNoteContent(note.content)
  }

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editingNoteContent.trim()) return

    setSavingNote(true)
    try {
      const { error: updateError } = await (supabase.from('notes') as any)
        .update({ content: editingNoteContent.trim() })
        .eq('id', editingNoteId)

      if (updateError) throw updateError

      setContactNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId ? { ...n, content: editingNoteContent.trim() } : n
        )
      )
      setEditingNoteId(null)
      setEditingNoteContent('')
    } catch (err) {
      console.error('Failed to update note:', err)
    } finally {
      setSavingNote(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingNoteContent('')
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return

    setDeletingNoteId(noteId)
    try {
      const { error: deleteError } = await (supabase.from('notes') as any)
        .delete()
        .eq('id', noteId)

      if (deleteError) throw deleteError

      setContactNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      console.error('Failed to delete note:', err)
    } finally {
      setDeletingNoteId(null)
    }
  }

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        task_type: task.task_type,
        due_date: task.due_date ?? '',
        due_time: task.due_time ?? '',
        assigned_to: task.assigned_to ?? '',
        contact_id: task.contact_id ?? '',
        deal_id: task.deal_id ?? '',
        company_id: task.company_id ?? '',
      })
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        task_type: 'to_do',
        due_date: '',
        due_time: '',
        assigned_to: '',
        contact_id: '',
        deal_id: '',
        company_id: '',
      })
    }
    setError(null)
  }, [task, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        task_type: formData.task_type,
        due_date: formData.due_date || null,
        due_time: formData.due_time || null,
        assigned_to: formData.assigned_to || null,
        contact_id: formData.contact_id || null,
        deal_id: formData.deal_id || null,
        company_id: formData.company_id || null,
      }

      if (task) {
        // Update existing task
        const { error: updateError } = await (supabase.from('tasks') as any)
          .update(payload)
          .eq('id', task.id)

        if (updateError) throw updateError

        // Get relationship names for the saved task
        const contactName = formData.contact_id
          ? contacts.find((c) => c.id === formData.contact_id)
          : null
        const dealTitle = formData.deal_id
          ? deals.find((d) => d.id === formData.deal_id)?.title
          : null
        const companyName = formData.company_id
          ? companies.find((c) => c.id === formData.company_id)?.name
          : null
        const assignedUserName = formData.assigned_to
          ? users.find((u) => u.id === formData.assigned_to)?.name
          : null

        onSave({
          ...task,
          ...payload,
          contact_name: contactName
            ? `${contactName.first_name} ${contactName.last_name}`
            : null,
          deal_title: dealTitle ?? null,
          company_name: companyName ?? null,
          assigned_user_name: assignedUserName ?? null,
        })
      } else {
        // Create new task
        const { data, error: insertError } = await (supabase.from('tasks') as any)
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError

        // Get relationship names for the saved task
        const contactName = formData.contact_id
          ? contacts.find((c) => c.id === formData.contact_id)
          : null
        const dealTitle = formData.deal_id
          ? deals.find((d) => d.id === formData.deal_id)?.title
          : null
        const companyName = formData.company_id
          ? companies.find((c) => c.id === formData.company_id)?.name
          : null
        const assignedUserName = formData.assigned_to
          ? users.find((u) => u.id === formData.assigned_to)?.name
          : null

        onSave({
          ...data,
          contact_name: contactName
            ? `${contactName.first_name} ${contactName.last_name}`
            : null,
          deal_title: dealTitle ?? null,
          company_name: companyName ?? null,
          assigned_user_name: assignedUserName ?? null,
        })
      }
    } catch (err) {
      console.error('Failed to save task:', err)
      setError('Failed to save task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm('Are you sure you want to delete this task?')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await (supabase.from('tasks') as any)
        .delete()
        .eq('id', task.id)

      if (deleteError) throw deleteError

      onDelete(task.id)
    } catch (err) {
      console.error('Failed to delete task:', err)
      setError('Failed to delete task. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {task ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            onClick={onClose}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
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

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Add any additional details..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            {/* Priority and Type Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
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

            {/* Assigned To */}
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

            {/* Associations Section */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Link to Record</h3>

              {/* Contact */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact
                </label>
                <select
                  value={formData.contact_id}
                  onChange={(e) => {
                    const contactId = e.target.value
                    const selectedContact = contacts.find((c) => c.id === contactId)
                    // Auto-fill assignee if not already set and contact has an owner
                    const newAssignedTo = !formData.assigned_to && selectedContact?.owner_id
                      ? selectedContact.owner_id
                      : formData.assigned_to
                    setFormData({ ...formData, contact_id: contactId, assigned_to: newAssignedTo })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">No contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Notes */}
              {formData.contact_id && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">
                      Contact Notes {contactNotes.length > 0 && `(${contactNotes.length})`}
                    </h4>
                    <Link
                      href={`/contacts/${formData.contact_id}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View Contact
                    </Link>
                  </div>

                  {/* Add Note Form */}
                  <div className="mb-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-white"
                    />
                    {newNote.trim() && (
                      <div className="flex justify-end mt-1">
                        <button
                          type="button"
                          onClick={handleAddNote}
                          disabled={addingNote}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {addingNote ? 'Adding...' : 'Add Note'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notes List */}
                  {loadingNotes ? (
                    <p className="text-sm text-gray-400">Loading notes...</p>
                  ) : contactNotes.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No notes for this contact yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {contactNotes.map((note) => {
                        const isExpanded = expandedNotes.has(note.id)
                        const isLong = note.content.length > 150 || note.content.split('\n').length > 3
                        const isEditing = editingNoteId === note.id
                        const isDeleting = deletingNoteId === note.id

                        return (
                          <div key={note.id} className={`text-sm bg-white p-2 rounded border border-gray-200 ${isDeleting ? 'opacity-50' : ''}`}>
                            {isEditing ? (
                              <>
                                <textarea
                                  value={editingNoteContent}
                                  onChange={(e) => setEditingNoteContent(e.target.value)}
                                  rows={3}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-1">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={savingNote || !editingNoteContent.trim()}
                                    className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {savingNote ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p
                                  className={`text-gray-700 whitespace-pre-wrap ${
                                    !isExpanded && isLong ? 'line-clamp-3' : ''
                                  }`}
                                >
                                  {note.content}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-gray-400">
                                    {note.author?.name || 'Unknown'} · {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {isLong && (
                                      <button
                                        type="button"
                                        onClick={() => toggleNoteExpanded(note.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        {isExpanded ? 'Show less' : 'Show more'}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleEditNote(note)}
                                      className="p-1 text-gray-400 hover:text-gray-600"
                                      title="Edit note"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteNote(note.id)}
                                      disabled={isDeleting}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                      title="Delete note"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Deal */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deal
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

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <select
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">No company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          {task ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : task ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
