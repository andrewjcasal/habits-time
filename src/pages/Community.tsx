import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Search, Phone, Mail, MessageSquare } from 'lucide-react'
import { usePeople } from '../hooks/usePeople'
import { Person } from '../types'

const Community = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPerson, setNewPerson] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
  })

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-light text-gray-900 mb-2">Community</h1>
        <p className="text-gray-600">Your network of people and connections</p>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search people, companies, or roles..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Person
        </button>
      </div>

      {/* Add Person Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Person</h3>
          <form onSubmit={handleAddPerson} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Name *"
              value={newPerson.name}
              onChange={e => setNewPerson({ ...newPerson, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newPerson.email}
              onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={newPerson.phone}
              onChange={e => setNewPerson({ ...newPerson, phone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Company"
              value={newPerson.company}
              onChange={e => setNewPerson({ ...newPerson, company: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Role"
              value={newPerson.role}
              onChange={e => setNewPerson({ ...newPerson, role: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Person
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* People List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading people...</p>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {people.length === 0 ? 'No people yet' : 'No people found'}
            </h3>
            <p className="text-gray-600">
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
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-medium">
                        {person.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{person.name}</h3>
                      {person.role && person.company && (
                        <p className="text-sm text-gray-600">
                          {person.role} at {person.company}
                        </p>
                      )}
                      {person.role && !person.company && (
                        <p className="text-sm text-gray-600">{person.role}</p>
                      )}
                      {!person.role && person.company && (
                        <p className="text-sm text-gray-600">{person.company}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-400">
                    {person.email && <Mail className="w-4 h-4" />}
                    {person.phone && <Phone className="w-4 h-4" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Community
