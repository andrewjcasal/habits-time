import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  Layout, 
  Home, 
  Code, 
  Briefcase, 
  Users, 
  Settings,
  Menu,
  X
} from 'lucide-react';

const MainLayout = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/spaced-rep', label: 'Neetcode 150', icon: Code },
    { path: '/interview-prep', label: 'Interview Prep', icon: Layout },
    { path: '/job-tracker', label: 'Job Tracker', icon: Briefcase }
  ];

  const isActive = (path: string) => location.pathname === path;
  
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-neutral-200">
        <div className="p-6">
          <h1 className="text-xl font-semibold text-primary-700 flex items-center">
            <Users className="w-6 h-6 mr-2 text-primary-600" />
            FrontPrep
          </h1>
        </div>
        
        <nav className="flex-1 px-4 pb-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`
                    }
                  >
                    <Icon className="mr-2 h-5 w-5" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="mt-auto p-4 border-t border-neutral-200">
          <NavLink
            to="/settings"
            className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Settings className="mr-2 h-5 w-5" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Mobile Header & Menu */}
      <div className="flex flex-col flex-1">
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-primary-700 flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary-600" />
            FrontPrep
          </h1>
          <button onClick={toggleMobileMenu} className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100">
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        
        {isMobileMenuOpen && (
          <div className="md:hidden absolute inset-x-0 top-[57px] z-50 bg-white border-b border-neutral-200 animate-fadeDown">
            <nav className="px-4 py-3">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                          }`
                        }
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon className="mr-2 h-5 w-5" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
                <li>
                  <NavLink
                    to="/settings"
                    className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Settings className="mr-2 h-5 w-5" />
                    Settings
                  </NavLink>
                </li>
              </ul>
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;