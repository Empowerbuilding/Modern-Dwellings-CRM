'use client'

import { useState } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { updateDealStage } from '@/lib/supabase'
import type { PipelineStage, DealType } from '@/lib/types'
import type { DealWithCompany } from './page'

const STAGES: PipelineStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]

const STAGE_LABELS: Record<PipelineStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  lead: 'bg-gray-500',
  qualified: 'bg-blue-500',
  proposal: 'bg-yellow-500',
  negotiation: 'bg-purple-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
}

const DEAL_TYPE_COLORS: Record<DealType, string> = {
  custom_design: 'border-l-blue-500',
  builder_design: 'border-l-indigo-500',
  engineering: 'border-l-orange-500',
  software_fees: 'border-l-green-500',
  referral: 'border-l-pink-500',
  budget_builder: 'border-l-yellow-500',
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  custom_design: 'Custom Design',
  builder_design: 'Builder Design',
  engineering: 'Engineering',
  software_fees: 'Software Fees',
  referral: 'Referral',
  budget_builder: 'Budget Builder',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface PipelineBoardProps {
  initialDeals: DealWithCompany[]
}

export function PipelineBoard({ initialDeals }: PipelineBoardProps) {
  const [deals, setDeals] = useState<DealWithCompany[]>(initialDeals)
  const [updating, setUpdating] = useState<string | null>(null)

  const dealsByStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = deals.filter((deal) => deal.stage === stage)
      return acc
    },
    {} as Record<PipelineStage, DealWithCompany[]>
  )

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const newStage = destination.droppableId as PipelineStage
    const dealId = draggableId

    // Optimistic update
    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId ? { ...deal, stage: newStage } : deal
      )
    )

    setUpdating(dealId)

    try {
      const { error } = await updateDealStage(dealId, newStage)

      if (error) {
        // Revert on error
        setDeals((prev) =>
          prev.map((deal) =>
            deal.id === dealId
              ? { ...deal, stage: source.droppableId as PipelineStage }
              : deal
          )
        )
        console.error('Failed to update deal:', error)
      }
    } catch (err) {
      // Revert on error
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === dealId
            ? { ...deal, stage: source.droppableId as PipelineStage }
            : deal
        )
      )
      console.error('Failed to update deal:', err)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = dealsByStage[stage]
          const totalValue = stageDeals.reduce(
            (sum, deal) => sum + (deal.value || 0),
            0
          )

          return (
            <div
              key={stage}
              className="flex-shrink-0 w-72 bg-gray-100 rounded-lg"
            >
              {/* Column Header */}
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${STAGE_COLORS[stage]}`} />
                  <h2 className="font-medium text-gray-900">
                    {STAGE_LABELS[stage]}
                  </h2>
                  <span className="ml-auto text-sm text-gray-500">
                    {stageDeals.length}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {formatCurrency(totalValue)}
                </p>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-2 min-h-[calc(100vh-220px)] transition-colors ${
                      snapshot.isDraggingOver ? 'bg-gray-200' : ''
                    }`}
                  >
                    {stageDeals.map((deal, index) => (
                      <Draggable
                        key={deal.id}
                        draggableId={deal.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`mb-2 p-3 bg-white rounded-lg shadow-sm border-l-4 ${
                              deal.deal_type
                                ? DEAL_TYPE_COLORS[deal.deal_type]
                                : 'border-l-gray-300'
                            } ${
                              snapshot.isDragging
                                ? 'shadow-lg ring-2 ring-blue-400'
                                : ''
                            } ${updating === deal.id ? 'opacity-50' : ''}`}
                          >
                            <p className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                              {deal.title}
                            </p>
                            {deal.company_name && (
                              <p className="text-xs text-gray-500 mb-2">
                                {deal.company_name}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-gray-900">
                                {deal.value ? formatCurrency(deal.value) : '-'}
                              </span>
                              {deal.expected_close_date && (
                                <span className="text-gray-500">
                                  {formatDate(deal.expected_close_date)}
                                </span>
                              )}
                            </div>
                            {deal.deal_type && (
                              <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {DEAL_TYPE_LABELS[deal.deal_type]}
                              </span>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Deal Types:</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(DEAL_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className={`w-3 h-3 rounded border-l-4 ${
                  DEAL_TYPE_COLORS[type as DealType]
                } bg-white`}
              />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  )
}
