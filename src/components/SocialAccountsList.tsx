import { useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { useSocials } from '../hooks/useSocials'
// import { Social } from '../types'

interface SocialAccountsListProps {
  selectedAccountId: string | null
  onAccountSelect: (accountId: string) => void
}

const SocialAccountsList = ({ selectedAccountId, onAccountSelect }: SocialAccountsListProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAccount, setNewAccount] = useState({
    platform: 'twitter' as 'twitter' | 'linkedin',
    username: '',
    profile_url: '',
    is_active: true,
    knowledge: '',
  })

  const { socials, loading, error, addSocial } = useSocials()

  const filteredSocials = socials.filter(social =>
    social.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    social.platform.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccount.username.trim()) return

    try {
      await addSocial(newAccount)
      setNewAccount({
        platform: 'twitter',
        username: '',
        profile_url: '',
        is_active: true,
        knowledge: '',
      })
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to add social account:', err)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'twitter':
        return 'X'
      case 'linkedin':
        return 'LI'
      default:
        return platform.charAt(0).toUpperCase()
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'twitter':
        return 'bg-gray-900 text-white'
      case 'linkedin':
        return 'bg-blue-600 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <>
      {/* Search and Add */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
          <input
            type="text"
            placeholder="Search accounts..."
            className="w-full pl-7 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-2 py-1 text-sm rounded hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </button>
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <div className="bg-white rounded border border-gray-200 p-2 mb-3">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Add Social Account</h3>
          <form onSubmit={handleAddAccount} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newAccount.platform}
                onChange={e => setNewAccount({ ...newAccount, platform: e.target.value as 'twitter' | 'linkedin' })}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="twitter">X/Twitter</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <input
                type="text"
                placeholder="Username *"
                value={newAccount.username}
                onChange={e => setNewAccount({ ...newAccount, username: e.target.value })}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <input
              type="url"
              placeholder="Profile URL (optional)"
              value={newAccount.profile_url}
              onChange={e => setNewAccount({ ...newAccount, profile_url: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            />
            <textarea
              placeholder="Knowledge/Notes (optional)"
              value={newAccount.knowledge}
              onChange={e => setNewAccount({ ...newAccount, knowledge: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
            />
            <div className="flex items-center gap-1">
              <button
                type="submit"
                className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
          <p className="text-red-800 text-sm">Error: {error}</p>
          <p className="text-red-600 text-xs mt-1">Make sure you've run the database migrations for the social posting tables.</p>
        </div>
      )}

      {/* Social Accounts List */}
      <div className="bg-white rounded border border-gray-200">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-xs">Loading accounts...</p>
          </div>
        ) : filteredSocials.length === 0 ? (
          <div className="text-center py-4">
            <Users className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {socials.length === 0 ? 'No social accounts yet' : 'No accounts found'}
            </h3>
            <p className="text-gray-600 text-xs">
              {socials.length === 0
                ? 'Add your first social account to get started.'
                : 'Try adjusting your search or add a new account.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredSocials.map(social => (
              <div
                key={social.id}
                onClick={() => onAccountSelect(social.id)}
                className={`p-2 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedAccountId === social.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getPlatformColor(social.platform)}`}>
                      <span className="text-xs font-medium">
                        {getPlatformIcon(social.platform)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">@{social.username}</h3>
                      <p className="text-xs text-gray-600 capitalize">
                        {social.platform === 'twitter' ? 'X/Twitter' : social.platform}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      social.is_active ? 'bg-green-400' : 'bg-gray-400'
                    }`} title={social.is_active ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default SocialAccountsList