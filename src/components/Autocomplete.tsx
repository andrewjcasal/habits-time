import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export const Autocomplete = ({ 
  value, 
  onChange, 
  onSelect, 
  options, 
  placeholder,
  className = ''
}: AutocompleteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filtered = options.filter(option =>
      option.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`${className}`}
      />

      <AnimatePresence>
        {isOpen && filteredOptions.length > 0 && (
          <motion.div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-neutral-200"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ul className="py-1 max-h-60 overflow-auto">
              {filteredOptions.map((option, index) => (
                <li
                  key={index}
                  className={`px-1 py-0.5 text-sm cursor-pointer flex items-center justify-between ${
                    option === value
                      ? "bg-primary-50 text-primary-900"
                      : "hover:bg-neutral-50"
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  {option}
                  {option === value && (
                    <Check className="h-4 w-4 text-primary-600" />
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};