const YNAB_API_BASE_URL = 'https://api.youneedabudget.com/v1'

export interface YnabSubtransaction {
  id: string
  transaction_id: string
  amount: number
  memo: string | null
  payee_id: string | null
  payee_name: string | null
  category_id: string | null
  category_name: string | null
  transfer_account_id: string | null
  deleted: boolean
}

export interface YnabTransaction {
  id: string
  date: string
  amount: number
  memo: string | null
  cleared: string
  approved: boolean
  flag_color: string | null
  account_id: string
  account_name: string
  payee_id: string | null
  payee_name: string | null
  category_id: string | null
  category_name: string | null
  transfer_account_id: string | null
  transfer_transaction_id: string | null
  matched_transaction_id: string | null
  import_id: string | null
  deleted: boolean
  subtransactions?: YnabSubtransaction[]
}

export interface YnabBudget {
  id: string
  name: string
  last_modified_on: string
  first_month: string
  last_month: string
}

export interface YnabAccount {
  id: string
  name: string
  type: string
  on_budget: boolean
  closed: boolean
  note: string | null
  balance: number
  cleared_balance: number
  uncleared_balance: number
}

class YnabAPI {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${YNAB_API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`YNAB API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data
  }

  async getBudgets(): Promise<YnabBudget[]> {
    const data = await this.makeRequest<{ budgets: YnabBudget[] }>('/budgets')
    return data.budgets
  }

  async getAccounts(budgetId: string): Promise<YnabAccount[]> {
    const data = await this.makeRequest<{ accounts: YnabAccount[] }>(`/budgets/${budgetId}/accounts`)
    return data.accounts
  }

  async getTransactions(budgetId: string, accountId?: string, sinceDate?: string): Promise<YnabTransaction[]> {
    let endpoint = `/budgets/${budgetId}/transactions`
    const params = new URLSearchParams()
    
    if (accountId) {
      params.append('account_id', accountId)
    }
    if (sinceDate) {
      params.append('since_date', sinceDate)
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`
    }

    const data = await this.makeRequest<{ transactions: YnabTransaction[] }>(endpoint)
    return data.transactions
  }
}

export const createYnabAPI = () => {
  const apiKey = import.meta.env.VITE_YNAB_PERSONAL_ACCESS_TOKEN
  if (!apiKey) {
    throw new Error('YNAB API key not found. Please set VITE_YNAB_PERSONAL_ACCESS_TOKEN in your .env file.')
  }
  return new YnabAPI(apiKey)
}