import { motion } from 'framer-motion';
import { Bell, BellRing, Calendar, Link as LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FeedItem {
  id: string;
  type: 'connection' | 'job_view' | 'message';
  title: string;
  description?: string;
  created_at: string;
  url?: string;
  read: boolean;
}

interface FeedItemProps {
  item: FeedItem;
  onMarkRead: (id: string) => void;
}

export const FeedItem = ({ item, onMarkRead }: FeedItemProps) => {
  const getIcon = () => {
    switch (item.type) {
      case 'connection':
        return <Bell className="h-4 w-4 text-primary-600" />;
      case 'job_view':
        return <Calendar className="h-4 w-4 text-secondary-600" />;
      case 'message':
        return <BellRing className="h-4 w-4 text-accent-600" />;
    }
  };
  
  return (
    <motion.div 
      className={`p-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
        !item.read ? 'bg-primary-50' : ''
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-1">{getIcon()}</div>
        
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-900">{item.title}</p>
            <span className="text-xs text-neutral-500">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
          
          {item.description && (
            <p className="mt-1 text-sm text-neutral-600">{item.description}</p>
          )}
          
          {item.url && (
            <a 
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-sm text-primary-600 hover:text-primary-800 flex items-center"
            >
              <LinkIcon className="h-3 w-3 mr-1" />
              View Profile
            </a>
          )}
        </div>
        
        {!item.read && (
          <button
            onClick={() => onMarkRead(item.id)}
            className="ml-4 text-xs text-primary-600 hover:text-primary-800"
          >
            Mark as read
          </button>
        )}
      </div>
    </motion.div>
  );
};