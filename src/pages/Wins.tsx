import { useState, useEffect } from 'react'
import { Trophy, Calendar, FileText, Heart, Search, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/LoadingSpinner'

interface Win {
  id: string
  title: string
  description?: string
  source_type: 'note' | 'habit_streak'
  source_id?: string
  extracted_at: string
  created_at: string
}

const Wins = () => {
  const { user } = useAuth()
  const [wins, setWins] = useState<Win[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'note' | 'habit_streak'>('all')

  // Fetch wins from database
  const fetchWins = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('wins')
        .select('*')
        .eq('user_id', user.id)
        .order('extracted_at', { ascending: false })

      if (error) throw error
      setWins(data || [])
    } catch (err) {
      console.error('Error fetching wins:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter wins based on search and type
  const filteredWins = wins.filter(win => {
    const matchesSearch =
      win.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      win.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || win.source_type === filterType
    return matchesSearch && matchesType
  })

  // Get stats
  const totalWins = wins.length
  const thisWeekWins = wins.filter(win => {
    const winDate = new Date(win.extracted_at)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return winDate >= weekAgo
  }).length

  const getSourceIcon = (sourceType: string) => {
    return sourceType === 'note' ? FileText : Heart
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  useEffect(() => {
    fetchWins()
  }, [user])

  if (loading) {
    return <LoadingSpinner message="Loading wins..." />
  }

  return (
    <div className="p-2 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-light text-gray-900">Wins & Achievements</h1>
        </div>
        <p className="text-gray-600">Celebrate your progress and accomplishments</p>

        {/* Stats */}
        <div className="flex gap-3 mt-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1">
            <div className="text-2xl font-bold text-yellow-700">{totalWins}</div>
            <div className="text-sm text-yellow-600">Total Wins</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1">
            <div className="text-2xl font-bold text-green-700">{thisWeekWins}</div>
            <div className="text-sm text-green-600">This Week</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
          <input
            type="text"
            placeholder="Search wins..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as any)}
          className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Sources</option>
          <option value="note">From Notes</option>
          <option value="habit_streak">Habit Streaks</option>
        </select>
      </div>

      {/* Wins List */}
      {filteredWins.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' ? 'No wins found' : 'No wins yet'}
          </h3>
          <p className="text-gray-600 mb-3">
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filter'
              : "Start writing notes about your achievements and they'll appear here automatically!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredWins.map(win => {
            const SourceIcon = getSourceIcon(win.source_type)

            return (
              <div
                key={win.id}
                className="bg-white rounded-lg border border-gray-200 p-2 hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <h3 className="font-semibold text-gray-900">{win.title}</h3>
                    </div>

                    {win.description && <p className="text-gray-700">{win.description}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs text-gray-500 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <SourceIcon className="w-3 h-3" />
                      <span className="capitalize">
                        {win.source_type === 'habit_streak' ? 'Habit Streak' : 'Note'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(win.extracted_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Wins
