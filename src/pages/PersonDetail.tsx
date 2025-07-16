import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  Edit3,
  Briefcase,
  User,
  ExternalLink,
  Trash2,
  Calendar,
  Globe,
  Linkedin,
  Twitter,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { usePeople } from "../hooks/usePeople";
import { useExperiences } from "../hooks/useExperiences";
import { Person, Experience } from "../types";
import { AddExperienceModal } from "../components/AddExperienceModal";

const PersonDetail = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddExperienceModal, setShowAddExperienceModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    notes: '',
    linkedin_url: '',
    twitter_url: '',
    website_url: ''
  });

  const { people, updatePerson, deletePerson } = usePeople();
  const { experiences, loading: experiencesLoading, addExperience, deleteExperience } = useExperiences(person?.id);

  useEffect(() => {
    if (personId && people.length > 0) {
      const foundPerson = people.find(p => p.id === personId);
      if (foundPerson) {
        setPerson(foundPerson);
        setEditForm({
          name: foundPerson.name,
          email: foundPerson.email || '',
          phone: foundPerson.phone || '',
          company: foundPerson.company || '',
          role: foundPerson.role || '',
          notes: foundPerson.notes || '',
          linkedin_url: foundPerson.linkedin_url || '',
          twitter_url: foundPerson.twitter_url || '',
          website_url: foundPerson.website_url || ''
        });
      } else {
        setError('Person not found');
      }
      setLoading(false);
    } else if (people.length === 0) {
      // Still loading people
      setLoading(true);
    }
  }, [personId, people]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person) return;

    try {
      await updatePerson(person.id, {
        name: editForm.name,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        company: editForm.company || undefined,
        role: editForm.role || undefined,
        notes: editForm.notes || undefined,
        linkedin_url: editForm.linkedin_url || undefined,
        twitter_url: editForm.twitter_url || undefined,
        website_url: editForm.website_url || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating person:', error);
    }
  };

  const handleDelete = async () => {
    if (!person) return;
    
    if (window.confirm(`Are you sure you want to delete ${person.name}?`)) {
      try {
        await deletePerson(person.id);
        navigate('/community');
      } catch (error) {
        console.error('Error deleting person:', error);
      }
    }
  };

  const handleAddExperience = async (experienceData: Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await addExperience(experienceData);
  };

  const getExperienceTypeColor = (type: string) => {
    const colors = {
      shared: 'bg-blue-100 text-blue-700',
      individual: 'bg-gray-100 text-gray-700',
      meeting: 'bg-green-100 text-green-700',
      event: 'bg-purple-100 text-purple-700',
      other: 'bg-orange-100 text-orange-700',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getConnectionStrengthIcon = (strength: string) => {
    switch (strength) {
      case 'strengthened':
        return <TrendingUp className="w-3 h-3 text-green-600" />;
      case 'maintained':
        return <Minus className="w-3 h-3 text-blue-600" />;
      case 'weakened':
        return <TrendingDown className="w-3 h-3 text-red-600" />;
      default:
        return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  const getConnectionStrengthColor = (strength: string) => {
    const colors = {
      strengthened: 'text-green-600 bg-green-50',
      maintained: 'text-blue-600 bg-blue-50',
      weakened: 'text-red-600 bg-red-50',
      neutral: 'text-gray-600 bg-gray-50',
    };
    return colors[strength as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading person details...</p>
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-900 mb-2">Person Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The person you are looking for does not exist.'}</p>
          <button
            onClick={() => navigate('/community')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Community
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/community")}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <span className="text-blue-600 font-medium text-xl">
                {person.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-light text-gray-900">{person.name}</h1>
              {person.role && person.company && (
                <p className="text-gray-600">{person.role} at {person.company}</p>
              )}
              {person.role && !person.company && (
                <p className="text-gray-600">{person.role}</p>
              )}
              {!person.role && person.company && (
                <p className="text-gray-600">{person.company}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {isEditing ? (
        /* Edit Form */
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Edit Person</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={editForm.linkedin_url}
                  onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twitter URL</label>
                <input
                  type="url"
                  value={editForm.twitter_url}
                  onChange={(e) => setEditForm({ ...editForm, twitter_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://twitter.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                <input
                  type="url"
                  value={editForm.website_url}
                  onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Add any notes about this person..."
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Person
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Display Mode */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Experiences Section - 2/3 width */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Experiences
              </h2>
              <button
                onClick={() => setShowAddExperienceModal(true)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Experience
              </button>
            </div>


            {/* Experiences List */}
            {experiencesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading experiences...</p>
              </div>
            ) : experiences.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No experiences yet</p>
                <p className="text-xs text-gray-400">Add your first experience to start tracking your interactions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {experiences.map((experience) => (
                  <div key={experience.id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{experience.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <div className="flex items-center text-gray-500 text-sm">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(experience.experience_date).toLocaleDateString()}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getExperienceTypeColor(experience.type)}`}>
                            {experience.type}
                          </span>
                          {experience.location && (
                            <div className="flex items-center text-gray-500 text-xs">
                              <MapPin className="w-3 h-3 mr-1" />
                              {experience.location}
                            </div>
                          )}
                          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConnectionStrengthColor(experience.connection_strength)}`}>
                            {getConnectionStrengthIcon(experience.connection_strength)}
                            <span className="ml-1">{experience.connection_strength}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteExperience(experience.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Delete experience"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {experience.description && (
                      <p className="text-gray-600 text-sm mt-2">{experience.description}</p>
                    )}
                    
                    {experience.attendees && (
                      <div className="flex items-center text-gray-500 text-sm mt-2">
                        <Users className="w-3 h-3 mr-1" />
                        <span>Also attended: {experience.attendees}</span>
                      </div>
                    )}
                    
                    {experience.outcome && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <div className="font-medium text-blue-900 mb-1">Outcome:</div>
                        <div className="text-blue-800">{experience.outcome}</div>
                      </div>
                    )}
                    
                    {experience.next_steps && (
                      <div className="mt-2 p-2 bg-orange-50 rounded text-sm">
                        <div className="font-medium text-orange-900 mb-1">Next Steps:</div>
                        <div className="text-orange-800">{experience.next_steps}</div>
                      </div>
                    )}
                    
                    {experience.follow_up_needed && (
                      <div className="flex items-center mt-2 p-2 bg-yellow-50 rounded text-sm">
                        <AlertCircle className="w-3 h-3 text-yellow-600 mr-1" />
                        <span className="text-yellow-800 font-medium">Follow-up needed</span>
                        {experience.follow_up_date && (
                          <span className="text-yellow-700 ml-2">
                            by {new Date(experience.follow_up_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes Section - 1/3 width */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Notes</h2>
            {person.notes ? (
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{person.notes}</p>
            ) : (
              <p className="text-gray-400 italic text-sm">No notes yet. Click edit to add some.</p>
            )}
          </div>
        </div>
      )}

      {/* Add Experience Modal */}
      {person && (
        <AddExperienceModal
          isOpen={showAddExperienceModal}
          onClose={() => setShowAddExperienceModal(false)}
          onSubmit={handleAddExperience}
          personId={person.id}
          personName={person.name}
        />
      )}
    </div>
  );
};

export default PersonDetail;