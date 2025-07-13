import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Zap } from "lucide-react";
import { Contact, NetworkingAction } from "../types";
import NetworkingActionsList from "./NetworkingActionsList";

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
        className="fixed inset-0 mt-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 border-b border-neutral-200">
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
                {actions.filter(
                  (action) => action.action_taken === "ask_for_intro"
                ).length > 0 && (
                  <div>
                    <p className="text-sm text-neutral-600">
                      {
                        actions.filter(
                          (action) => action.action_taken === "ask_for_intro"
                        ).length
                      }{" "}
                      intro requests
                    </p>
                  </div>
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
          <NetworkingActionsList
            actions={actions as unknown as NetworkingAction[]}
            onEditAction={() => {}}
            onDeleteAction={() => {}}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
