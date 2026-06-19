export type ExpenseRecord = {
  id: string
  description: string
  amount: number
  paidBy: string
  date: string
  participants: string[]
  settled: boolean
}

export type ExpenseInput = {
  description: string
  amount: number
  paidBy: string
  date: string
  participants: string[]
  settled?: boolean
}

export type ExpenseRow = {
  id: string
  trip_id: string
  description: string
  amount: number
  paid_by_traveler_id: string | null
  expense_date: string
  participant_traveler_ids: string[]
  settled: boolean
  created_by_user_id: string | null
  created_at: string
}

export function rowToExpense(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    paidBy: row.paid_by_traveler_id || '',
    date: row.expense_date,
    participants: row.participant_traveler_ids || [],
    settled: row.settled,
  }
}

export function inputToRow(tripId: string, input: ExpenseInput, userId: string | null) {
  return {
    trip_id: tripId,
    description: input.description,
    amount: input.amount,
    paid_by_traveler_id: input.paidBy || null,
    expense_date: input.date,
    participant_traveler_ids: input.participants,
    settled: input.settled ?? false,
    created_by_user_id: userId,
  }
}
