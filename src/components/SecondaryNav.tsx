import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export interface SecondaryNavItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  href?: string;
}

interface SecondaryNavProps {
  items: SecondaryNavItem[];
  activeItem: string;
  onChange: (itemId: string) => void;
  isVisible?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const SecondaryNav = ({
  items,
  activeItem,
  onChange,
  isVisible = true,
  onMouseEnter,
  onMouseLeave,
}: SecondaryNavProps) => {
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleItemClick = (item: SecondaryNavItem) => {
    if (item.href) {
      navigate(item.href);
    } else {
      onChange(item.id);
    }
  };

  return (
    <>
      {/* Desktop Version */}
      <div
        className={`hidden md:flex w-64 bg-white border-r border-neutral-200 flex-shrink-0 transition-all duration-200 ${
          isVisible ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <nav className="p-2 w-full">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="relative">
                <button
                  onClick={() => handleItemClick(item)}
                  className={`
                    w-full flex items-center justify-between rounded-lg px-1 py-1 text-sm font-medium transition-colors
                    ${
                      activeItem === item.id
                        ? "bg-primary-50 text-primary-700"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    }
                  `}
                >
                  <div className="flex items-center">
                    {item.icon && (
                      <span className="mr-1 flex-shrink-1">{item.icon}</span>
                    )}
                    <span>{item.label}</span>
                  </div>

                  {typeof item.count === "number" && (
                    <span
                      className={`
                      ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${
                        activeItem === item.id
                          ? "bg-primary-100 text-primary-800"
                          : "bg-neutral-100 text-neutral-600"
                      }
                    `}
                    >
                      {item.count}
                    </span>
                  )}
                </button>

                {activeItem === item.id && !item.href && (
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600"
                    layoutId="activeIndicator"
                  />
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Mobile Version */}
      {isVisible && (
        <aside
          className="md:hidden w-8 flex flex-col bg-white border-r border-neutral-200 relative z-8 transition-all duration-200"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Navigation Icons */}
          <nav className="flex-1 py-2">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = activeItem === item.id;
                return (
                  <li key={item.id} className="relative px-1.5">
                    <div className="relative">
                      <button
                        onClick={() => handleItemClick(item)}
                        className={`flex items-center justify-center w-5 h-5 rounded-full transition-all duration-200 ${
                          active
                            ? "bg-primary-100 text-primary-700"
                            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                        }`}
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {item.icon || (
                          <div className="w-2 h-2 rounded-full bg-current"></div>
                        )}
                        {typeof item.count === "number" && item.count > 0 && (
                          <span className="absolute top-0 -right-1 w-2 h-2 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                            {item.count > 9 ? ":)" : item.count}
                          </span>
                        )}
                      </button>

                      {/* Popover */}
                      <AnimatePresence>
                        {hoveredItem === item.id && (
                          <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-full -top-0.5 transform -translate-y-1/2 ml-2 z-50 bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 whitespace-nowrap"
                            style={{ zIndex: 1000 }}
                          >
                            <div className="text-sm font-medium text-neutral-900">
                              {item.label}
                            </div>
                            {typeof item.count === "number" && (
                              <div className="text-xs text-neutral-600">
                                {item.count} items
                              </div>
                            )}
                            {/* Arrow */}
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2">
                              <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white"></div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      )}
    </>
  );
};
