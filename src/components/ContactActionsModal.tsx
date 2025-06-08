import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Zap } from "lucide-react";
import { Contact, NetworkingAction } from "../types";

interface ContactActionsModalProps {
  contact: Contact | null;
  actions: NetworkingAction[];
  onClose: () => void;
}

export const ContactActionsModal = ({
  contact,
  actions,
  onClose,
}: ContactActionsModalProps) => {
  if (!contact) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-neutral-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  {contact.name}
                </h3>
                {contact.company && (
                  <p className="text-sm text-neutral-600">
                    {contact.role ? `${contact.role} at ` : ""}
                    {contact.company}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <h4 className="text-md font-medium text-neutral-900 mb-4">
              Networking Actions ({actions.length})
            </h4>

            {actions.length > 0 ? (
              <div className="space-y-3">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className="border border-neutral-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">
                          {action.action_taken}
                        </p>
                        {action.note && (
                          <p className="text-sm text-neutral-600 mt-1">
                            {action.note}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(action.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                    </div>
                    {action.follow_up_date && (
                      <div className="flex items-center text-xs text-neutral-500 mt-2">
                        <Calendar className="h-3 w-3 mr-1" />
                        Follow-up:{" "}
                        {new Date(action.follow_up_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-600">No networking actions yet</p>
                <p className="text-sm text-neutral-500 mt-1">
                  Actions with this contact will appear here
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
