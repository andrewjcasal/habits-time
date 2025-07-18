import { motion, AnimatePresence } from 'framer-motion'
import { Edit, Trash2, UsersIcon } from 'lucide-react'
import { Contact } from '../types'

interface ContactsTableProps {
  contacts: Contact[]
  onContactClick: (contact: Contact) => void
  onEditContact: (contact: Contact) => void
  onDeleteContact: (contactId: string) => void
}

export const ContactsTable = ({
  contacts,
  onContactClick,
  onEditContact,
  onDeleteContact,
}: ContactsTableProps) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Name</th>
            <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Company</th>
            <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Role</th>
            <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
              Last Contact
            </th>
            <th className="text-right py-1 px-2 text-xs font-medium text-neutral-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {contacts.map((contact, index) => (
              <motion.tr
                key={contact.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                onClick={() => onContactClick(contact)}
              >
                <td className="py-1 px-2">
                  <span className="text-sm font-medium">{contact.name}</span>
                </td>
                <td className="py-1 px-2">
                  <span className="text-sm">{contact.company || '-'}</span>
                </td>
                <td className="py-1 px-2">
                  <span className="text-sm">{contact.role || '-'}</span>
                </td>
                <td className="py-1 px-2">
                  <span className="text-sm text-neutral-600">
                    {contact.last_contact_date
                      ? new Date(contact.last_contact_date).toLocaleDateString('en-US', {
                          month: 'numeric',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </td>
                <td className="py-1 px-2 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onEditContact(contact)
                      }}
                      className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onDeleteContact(contact.id)
                      }}
                      className="p-1 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>

      {/* Empty state */}
      {contacts.length === 0 && (
        <div className="p-8 text-center">
          <UsersIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600">No contacts yet</p>
          <p className="text-sm text-neutral-500 mt-1">
            Add contacts to track your networking activities
          </p>
        </div>
      )}
    </div>
  )
}
