import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

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
}

export const SecondaryNav = ({
  items,
  activeItem,
  onChange,
}: SecondaryNavProps) => {
  const navigate = useNavigate();

  const handleItemClick = (item: SecondaryNavItem) => {
    if (item.href) {
      navigate(item.href);
    } else {
      onChange(item.id);
    }
  };

  return (
    <div className="w-64 bg-white border-r border-neutral-200 flex-shrink-0">
      <nav className="p-2">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleItemClick(item)}
                className={`
                  w-full flex items-center justify-between rounded-lg px-1 py-1 text-sm font-medium transition-colors
                  ${
                    activeItem === item.id
                      ? "bg-primary-50 text-primary-700 border-l-4 border-primary-700"
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
  );
};
