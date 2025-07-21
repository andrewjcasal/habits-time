import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Search, Phone, Mail, MessageSquare } from 'lucide-react'
import { usePeople } from '../hooks/usePeople'
import { Person } from '../types'
import SocialAccountsList from '../components/SocialAccountsList'
import { SocialPostsFeed } from '../components/SocialPostsFeed'
import { CreatePostModal } from '../components/CreatePostModal'

const Community = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'network' | 'social'>('network')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPerson, setNewPerson] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
  })

  // Social posting state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false)

  const { people, loading, error, addPerson } = usePeople()

  const filteredPeople = people.filter(person => {
    const searchLower = searchTerm.toLowerCase()
    return (
      person.name.toLowerCase().includes(searchLower) ||
      person.company?.toLowerCase().includes(searchLower) ||
      person.role?.toLowerCase().includes(searchLower) ||
      person.email?.toLowerCase().includes(searchLower)
    )
  })

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addPerson({
        name: newPerson.name,
        email: newPerson.email || undefined,
        phone: newPerson.phone || undefined,
        company: newPerson.company || undefined,
        role: newPerson.role || undefined,
      })
      setNewPerson({ name: '', email: '', phone: '', company: '', role: '' })
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding person:', error)
    }
  }

  // Social posting handlers
  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId)
  }

  const handleCreatePost = () => {
    setIsCreatePostModalOpen(true)
  }

  const handleCloseCreatePostModal = () => {
    setIsCreatePostModalOpen(false)
  }

  const handleSubmitPost = (postData: any) => {
    // Handle post submission logic here
    console.log('Post submitted:', postData)
    setIsCreatePostModalOpen(false)
  }

  return (
    <div className="max-w-6xl mx-auto px-2 py-2">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-xl font-light text-gray-900 mb-1">Community</h1>
        <p className="text-sm text-gray-600">Your network of people and connections</p>
      </div>

      {/* Tabs */}
      <div className="mb-3">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('network')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'network'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Network
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'social'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Social Posting
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'network' && (
        <>
          {/* Search and Add */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
              <input
                type="text"
                placeholder="Search people, companies, or roles..."
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

          {/* Add Person Form */}
          {showAddForm && (
            <div className="bg-white rounded border border-gray-200 p-2 mb-3">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Add New Person</h3>
              <form onSubmit={handleAddPerson} className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Name *"
                  value={newPerson.name}
                  onChange={e => setNewPerson({ ...newPerson, name: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newPerson.email}
                  onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={newPerson.phone}
                  onChange={e => setNewPerson({ ...newPerson, phone: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={newPerson.company}
                  onChange={e => setNewPerson({ ...newPerson, company: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Role"
                  value={newPerson.role}
                  onChange={e => setNewPerson({ ...newPerson, role: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
            </div>
          )}

          {/* People List */}
          <div className="bg-white rounded border border-gray-200">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 text-xs">Loading people...</p>
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="text-center py-4">
                <Users className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {people.length === 0 ? 'No people yet' : 'No people found'}
                </h3>
                <p className="text-gray-600 text-xs">
                  {people.length === 0
                    ? 'Add your first person to get started.'
                    : 'Try adjusting your search or add a new person.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredPeople.map(person => (
                  <div
                    key={person.id}
                    onClick={() => navigate(`/community/${person.id}`)}
                    className="p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-xs font-medium">
                            {person.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{person.name}</h3>
                          {person.role && person.company && (
                            <p className="text-xs text-gray-600">
                              {person.role} at {person.company}
                            </p>
                          )}
                          {person.role && !person.company && (
                            <p className="text-xs text-gray-600">{person.role}</p>
                          )}
                          {!person.role && person.company && (
                            <p className="text-xs text-gray-600">{person.company}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400">
                        {person.email && <Mail className="w-3 h-3" />}
                        {person.phone && <Phone className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'social' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left sidebar - Social Accounts */}
          <div className="lg:w-1/3">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Social Accounts</h3>
            <SocialAccountsList
              selectedAccountId={selectedAccountId}
              onAccountSelect={handleAccountSelect}
            />
          </div>

          {/* Right main area - Social Posts Feed */}
          <div className="flex-1 lg:w-2/3">
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Social Posts</h3>
                <button
                  onClick={handleCreatePost}
                  className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Post
                </button>
              </div>
              <SocialPostsFeed
                selectedAccountId={selectedAccountId}
                onCreatePost={handleCreatePost}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={handleCloseCreatePostModal}
        onSubmit={handleSubmitPost}
        selectedAccountId={selectedAccountId}
      />
    </div>
  )
}

export default Community
