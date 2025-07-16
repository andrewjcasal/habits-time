import { useState } from 'react';
import { X, Calendar, Users, User, Building, MapPin } from 'lucide-react';
import { Experience } from '../types';

interface AddExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (experience: Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  personId: string;
  personName: string;
}

export function AddExperienceModal({ isOpen, onClose, onSubmit, personId, personName }: AddExperienceModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    experience_date: '',
    type: 'shared' as const,
    location: '',
    attendees: '',
    outcome: '',
    follow_up_needed: false,
    follow_up_date: '',
    connection_strength: 'neutral' as const,
    next_steps: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        person_id: personId,
        title: formData.title,
        description: formData.description || undefined,
        experience_date: formData.experience_date,
        type: formData.type,
        location: formData.location || undefined,
        attendees: formData.attendees || undefined,
        outcome: formData.outcome || undefined,
        follow_up_needed: formData.follow_up_needed,
        follow_up_date: formData.follow_up_date || undefined,
        connection_strength: formData.connection_strength,
        next_steps: formData.next_steps || undefined,
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        experience_date: '',
        type: 'shared',
        location: '',
        attendees: '',
        outcome: '',
        follow_up_needed: false,
        follow_up_date: '',
        connection_strength: 'neutral',
        next_steps: '',
      });
      onClose();
    } catch (error) {
      console.error('Error adding experience:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Add Experience with {personName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Coffee meeting, Conference, Project collaboration"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.experience_date}
                onChange={(e) => setFormData({ ...formData, experience_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Type and Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Experience['type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="shared">Shared Experience</option>
                <option value="individual">Individual Experience</option>
                <option value="meeting">Meeting</option>
                <option value="event">Event</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Coffee shop, Office, Virtual"
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other Attendees
            </label>
            <input
              type="text"
              value={formData.attendees}
              onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., John Smith, Sarah Johnson (optional)"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Describe what happened, what you discussed, or key takeaways..."
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outcome / Result
            </label>
            <textarea
              value={formData.outcome}
              onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="What was accomplished? Any decisions made or agreements reached?"
            />
          </div>

          {/* Connection Impact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impact on Relationship
            </label>
            <select
              value={formData.connection_strength}
              onChange={(e) => setFormData({ ...formData, connection_strength: e.target.value as Experience['connection_strength'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="strengthened">Strengthened the relationship</option>
              <option value="maintained">Maintained current relationship</option>
              <option value="neutral">Neutral interaction</option>
              <option value="weakened">Strained the relationship</option>
            </select>
          </div>

          {/* Next Steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Next Steps / Action Items
            </label>
            <textarea
              value={formData.next_steps}
              onChange={(e) => setFormData({ ...formData, next_steps: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="What actions were agreed upon? What should happen next?"
            />
          </div>

          {/* Follow-up */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="follow_up_needed"
                checked={formData.follow_up_needed}
                onChange={(e) => setFormData({ ...formData, follow_up_needed: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="follow_up_needed" className="ml-2 text-sm font-medium text-gray-700">
                Follow-up needed
              </label>
            </div>

            {formData.follow_up_needed && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Experience'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}