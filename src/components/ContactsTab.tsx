import { useState } from "react";
import { Plus } from "lucide-react";
import { Contact, NetworkingAction } from "../types";
import { ContactsTable } from "./ContactsTable";
import { ContactActionsModal } from "./ContactActionsModal";

interface ContactsTabProps {
  contacts: Contact[];
  onAddContact: () => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string) => void;
  onFetchContactActions: (contactId: string) => Promise<void>;
  contactActions: NetworkingAction[];
}

export const ContactsTab = ({
  contacts,
  onAddContact,
  onEditContact,
  onDeleteContact,
  onFetchContactActions,
  contactActions,
}: ContactsTabProps) => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const handleContactClick = async (contact: Contact) => {
    setSelectedContact(contact);
    await onFetchContactActions(contact.id);
  };

  const handleCloseModal = () => {
    setSelectedContact(null);
  };

  return (
    <div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-600">
            {contacts.length} total contacts
          </div>
          <button className="btn btn-primary btn-sm" onClick={onAddContact}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Contact
          </button>
        </div>

        <ContactsTable
          contacts={contacts}
          onContactClick={handleContactClick}
          onEditContact={onEditContact}
          onDeleteContact={onDeleteContact}
        />
      </div>
      <ContactActionsModal
        contact={selectedContact}
        actions={contactActions}
        onClose={handleCloseModal}
      />
    </div>
  );
};
