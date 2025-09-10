import { useState, useEffect } from 'react'
import { DollarSign, Calendar, Filter, Search, AlertCircle, Grid } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subWeeks } from 'date-fns'
import { createYnabAPI, YnabTransaction, YnabBudget, YnabAccount } from '../lib/ynab'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

type CustomCategory = 'convenience' | 'social' | 'trip' | 'coworking' | 'date' | null

const Transactions = () => {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<YnabTransaction[]>([])
  const [budgets, setBudgets] = useState<YnabBudget[]>([])
  const [accounts, setAccounts] = useState<YnabAccount[]>([])
  const [selectedBudget, setSelectedBudget] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [customCategories, setCustomCategories] = useState<Record<string, CustomCategory>>({})
  const [categoryLoading, setCategoryLoading] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'list' | 'convenience'>('list')

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        setLoading(true)
        setError(null)
        const ynabAPI = createYnabAPI()
        const budgetsData = await ynabAPI.getBudgets()
        setBudgets(budgetsData)
        
        if (budgetsData.length > 0) {
          // Default to "Andrew" budget if available, otherwise use first budget
          const andrewBudget = budgetsData.find(budget => budget.name === 'Andrew')
          setSelectedBudget(andrewBudget?.id || budgetsData[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load budgets')
      } finally {
        setLoading(false)
      }
    }

    loadBudgets()
  }, [])

  useEffect(() => {
    const loadAccounts = async () => {
      if (!selectedBudget) return

      try {
        const ynabAPI = createYnabAPI()
        const accountsData = await ynabAPI.getAccounts(selectedBudget)
        setAccounts(accountsData.filter(account => !account.closed))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load accounts')
      }
    }

    loadAccounts()
  }, [selectedBudget])

  useEffect(() => {
    const loadTransactions = async () => {
      if (!selectedBudget) return

      try {
        setLoading(true)
        setError(null)
        const ynabAPI = createYnabAPI()
        
        // Get transactions from the last month
        const lastMonth = subMonths(new Date(), 1)
        const sinceDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd')
        
        const transactionsData = await ynabAPI.getTransactions(
          selectedBudget,
          selectedAccount || undefined,
          sinceDate
        )
        
        // Filter and expand transactions to show individual subtransactions when relevant
        const expandedTransactions: YnabTransaction[] = []
        
        transactionsData.forEach(transaction => {
          // Check main transaction category
          const mainCategoryMatch = 
            transaction.category_name?.toLowerCase().includes('dining out') ||
            transaction.category_name?.toLowerCase().includes('dining') ||
            transaction.category_name?.toLowerCase().includes('restaurants') ||
            transaction.category_name?.toLowerCase().includes('coworking')
          
          // If main transaction matches, add it
          if (mainCategoryMatch) {
            expandedTransactions.push(transaction)
          } else if (transaction.subtransactions && transaction.subtransactions.length > 0) {
            // Check subtransactions and create individual transaction entries for matching ones
            transaction.subtransactions.forEach(subtransaction => {
              const subtransactionMatch = 
                subtransaction.category_name?.toLowerCase().includes('dining out') ||
                subtransaction.category_name?.toLowerCase().includes('dining') ||
                subtransaction.category_name?.toLowerCase().includes('restaurants') ||
                subtransaction.category_name?.toLowerCase().includes('coworking')
              
              if (subtransactionMatch) {
                // Create a transaction-like object from the subtransaction
                const subtransactionAsTransaction: YnabTransaction = {
                  ...transaction,
                  id: subtransaction.id,
                  amount: subtransaction.amount,
                  memo: subtransaction.memo || transaction.memo,
                  payee_name: subtransaction.payee_name || transaction.payee_name,
                  category_name: subtransaction.category_name,
                  category_id: subtransaction.category_id,
                  payee_id: subtransaction.payee_id || transaction.payee_id,
                  transfer_account_id: subtransaction.transfer_account_id,
                  // Keep original transaction date and other properties
                }
                expandedTransactions.push(subtransactionAsTransaction)
              }
            })
          }
        })
        
        const diningOutTransactions = expandedTransactions
        
        setTransactions(diningOutTransactions.sort((a, b) => {
          const dateA = new Date(a.date || 0)
          const dateB = new Date(b.date || 0)
          if (isNaN(dateA.getTime())) return 1
          if (isNaN(dateB.getTime())) return -1
          return dateB.getTime() - dateA.getTime()
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }

    loadTransactions()
  }, [selectedBudget, selectedAccount])

  const filteredTransactions = transactions.filter(transaction =>
    transaction.payee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.memo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 1000) // YNAB amounts are in milliunits
  }

  const handleCategoryChange = async (transactionId: string, category: CustomCategory) => {
    if (!user || !selectedBudget) return

    setCategoryLoading(prev => ({ ...prev, [transactionId]: true }))

    try {
      const transaction = transactions.find(t => t.id === transactionId)
      if (!transaction) return

      // Upsert the transaction in our database
      const { error } = await supabase
        .from('transactions')
        .upsert({
          user_id: user.id,
          ynab_transaction_id: transactionId,
          ynab_budget_id: selectedBudget,
          payee_name: transaction.payee_name,
          memo: transaction.memo,
          amount: transaction.amount,
          transaction_date: transaction.date,
          custom_category: category,
        }, {
          onConflict: 'user_id,ynab_transaction_id,ynab_budget_id'
        })

      if (error) throw error

      // Update local state
      setCustomCategories(prev => ({
        ...prev,
        [transactionId]: category
      }))
    } catch (err) {
      console.error('Error updating category:', err)
    } finally {
      setCategoryLoading(prev => ({ ...prev, [transactionId]: false }))
    }
  }

  // Load existing custom categories
  useEffect(() => {
    const loadCustomCategories = async () => {
      if (!user || !selectedBudget || transactions.length === 0) return

      try {
        const transactionIds = transactions.map(t => t.id)
        const { data, error } = await supabase
          .from('transactions')
          .select('ynab_transaction_id, custom_category')
          .eq('user_id', user.id)
          .eq('ynab_budget_id', selectedBudget)
          .in('ynab_transaction_id', transactionIds)

        if (error) throw error

        const categories: Record<string, CustomCategory> = {}
        data?.forEach(item => {
          categories[item.ynab_transaction_id] = item.custom_category
        })
        setCustomCategories(categories)
      } catch (err) {
        console.error('Error loading custom categories:', err)
      }
    }

    loadCustomCategories()
  }, [user, selectedBudget, transactions])

  // Get convenience transactions grouped by date (including subtransactions)
  const getConvenienceTransactionsByDate = () => {
    const convenienceTransactions = transactions.filter(transaction => {
      // Check if main transaction is categorized as convenience or coworking
      const mainTransactionMatch = customCategories[transaction.id] === 'convenience' || customCategories[transaction.id] === 'coworking'
      
      // Check if any subtransaction is categorized as convenience or coworking
      const hasMatchingSubtransaction = transaction.subtransactions?.some(subtransaction =>
        customCategories[subtransaction.id] === 'convenience' || customCategories[subtransaction.id] === 'coworking'
      )
      
      return mainTransactionMatch || hasMatchingSubtransaction
    })
    
    const groupedByDate: Record<string, YnabTransaction[]> = {}
    convenienceTransactions.forEach(transaction => {
      if (transaction.date) {
        // Use the date string directly to avoid timezone conversion issues
        const dateKey = transaction.date
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = []
        }
        groupedByDate[dateKey].push(transaction)
      }
    })
    return groupedByDate
  }

  // Calculate total convenience amount for display period
  const getConvenienceTotal = () => {
    const days = getCalendarDays()
    const startDate = days[0]
    const endDate = days[days.length - 1]
    
    const convenienceTransactions = transactions.filter(transaction => {
      if (!transaction.date) return false
      
      // Check if main transaction is categorized as convenience or coworking
      const mainTransactionMatch = customCategories[transaction.id] === 'convenience' || customCategories[transaction.id] === 'coworking'
      
      // Check if any subtransaction is categorized as convenience or coworking
      const hasMatchingSubtransaction = transaction.subtransactions?.some(subtransaction =>
        customCategories[subtransaction.id] === 'convenience' || customCategories[subtransaction.id] === 'coworking'
      )
      
      if (!mainTransactionMatch && !hasMatchingSubtransaction) return false
      
      const transactionDate = new Date(transaction.date)
      return transactionDate >= startDate && transactionDate <= endDate
    })
    
    const total = convenienceTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    return formatCurrency(total)
  }

  // Generate calendar days for the last 4 weeks
  const getCalendarDays = () => {
    const today = new Date()
    const threeWeeksAgo = subWeeks(today, 3)
    const startDate = startOfWeek(threeWeeksAgo, { weekStartsOn: 0 }) // Start on Sunday
    const endDate = endOfWeek(today, { weekStartsOn: 0 })
    
    return eachDayOfInterval({ start: startDate, end: endDate })
  }

  const renderConvenienceCalendar = () => {
    const days = getCalendarDays()
    const transactionsByDate = getConvenienceTransactionsByDate()
    const weeks: Date[][] = []
    
    // Group days into weeks
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    return (
      <div className="py-2 px-4">
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-xs font-medium text-neutral-600 text-center">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Body */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayTransactions = transactionsByDate[dateKey] || []
                const isToday = isSameDay(day, new Date())
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`border-r border-b border-neutral-200 p-2 h-44 ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-xs text-neutral-600 mb-1">
                      {format(day, 'd')}
                    </div>
                    
                    <div className="space-y-1 overflow-hidden">
                      {dayTransactions.slice(0, 2).map((transaction, index) => (
                        <div 
                          key={transaction.id}
                          className="text-xs bg-orange-100 text-orange-800 rounded px-1 py-0.5 truncate"
                          title={`${transaction.payee_name}: ${formatCurrency(Math.abs(transaction.amount))}`}
                        >
                          <div className="font-medium truncate">{transaction.payee_name}</div>
                          <div className="text-orange-600">{formatCurrency(Math.abs(transaction.amount))}</div>
                        </div>
                      ))}
                      
                      {dayTransactions.length > 2 && (
                        <div className="text-xs text-neutral-500">
                          +{dayTransactions.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }


  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-600 text-lg font-medium mb-2">Error loading YNAB data</div>
          <div className="text-neutral-600 text-sm">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-neutral-200">
        <div className="p-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setView('list')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                view === 'list' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>All Transactions</span>
            </button>
            <button
              onClick={() => setView('convenience')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                view === 'convenience' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Grid className="w-3 h-3" />
              <span>Convenience ({getConvenienceTotal()})</span>
            </button>
          </div>
        </div>
      </div>

      {view === 'list' && (
        <div className="bg-white border-b border-neutral-200">
          <div className="flex items-center justify-between p-1">
            <div className="flex items-center space-x-4">
              <DollarSign className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-neutral-700">Dining Out Transactions (Last Month)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-xs text-neutral-500">
                {filteredTransactions.length} transactions
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 p-1 bg-neutral-50">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedBudget}
                onChange={(e) => setSelectedBudget(e.target.value)}
                className="px-2 py-1 text-xs border border-neutral-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Budget</option>
                {budgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-2 py-1 text-xs border border-neutral-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                disabled={!selectedBudget}
              >
                <option value="">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-6 pr-2 py-1 text-xs border border-neutral-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {view === 'convenience' ? (
          renderConvenienceCalendar()
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-500 text-sm">Loading transactions...</div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No transactions found</h3>
            <p className="text-neutral-500">
              {selectedBudget ? 'No transactions match your current filters' : 'Select a budget to view transactions'}
            </p>
          </div>
        ) : (
          <div className="bg-white">
            <Table>
              <TableHeader>
                <TableRow className="h-1">
                  <TableHead className="h-6 py-0">Date</TableHead>
                  <TableHead className="h-6 py-0">Payee</TableHead>
                  <TableHead className="h-6 py-0">Memo</TableHead>
                  <TableHead className="h-6 py-0 text-right">Amount</TableHead>
                  <TableHead className="h-6 py-0">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const isInflow = transaction.amount > 0

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="py-0">
                        <div className="text-xs text-neutral-600">
                          {(() => {
                            try {
                              if (!transaction.date) return '—'
                              const date = new Date(transaction.date)
                              if (isNaN(date.getTime())) return '—'
                              return format(date, 'M/d')
                            } catch {
                              return '—'
                            }
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="py-0">
                        <div className="font-medium text-sm max-w-[150px] truncate">
                          {transaction.payee_name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="py-0">
                        <div className="text-xs text-neutral-500 max-w-[150px] truncate">
                          {transaction.memo || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="py-0 text-right">
                        <div className={`text-sm font-medium ${isInflow ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(transaction.amount))}
                        </div>
                      </TableCell>
                      <TableCell className="py-0">
                        <select
                          value={customCategories[transaction.id] || ''}
                          onChange={(e) => handleCategoryChange(transaction.id, e.target.value as CustomCategory || null)}
                          disabled={categoryLoading[transaction.id]}
                          className="text-xs border border-neutral-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                        >
                          <option value="">—</option>
                          <option value="convenience">Convenience</option>
                          <option value="social">Social</option>
                          <option value="trip">Trip</option>
                          <option value="coworking">Coworking</option>
                          <option value="date">Date</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Transactions