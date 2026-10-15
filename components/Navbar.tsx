import React, { useState } from 'react';
import { ViewState } from '../types';
import { Menu, X, LayoutDashboard, Home, LogOut } from 'lucide-react';
import './Navbar.css';

interface NavbarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isAuthenticated: boolean;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setView, isAuthenticated, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = [
    { name: 'About', target: 'about' },
    { name: 'Products', target: 'products' },
    { name: 'Contact', target: 'contact' },
  ];

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 70; // Adjusts for sticky navbar height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
    setIsOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div 
          className="navbar-logo" 
          onClick={() => {
            setView(ViewState.HOME);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <img src="/Public/images/logo.svg
          " className="logo-img" alt="" />
        </div>
        
        {/* Desktop Menu */}
        <div className="navbar-links desktop">
          {currentView === ViewState.HOME && navLinks.map((link) => (
            <a 
              key={link.name} 
              href={`#${link.target}`} 
              className="nav-link"
              onClick={(e) => handleScroll(e, link.target)}
            >
              {link.name}
            </a>
          ))}
          
          <button
            onClick={() => {
              if (currentView === ViewState.HOME) {
                 setView(isAuthenticated ? ViewState.ADMIN : ViewState.LOGIN);
              } else {
                 setView(ViewState.HOME);
              }
            }}
            className="admin-btn"
          >
            {currentView === ViewState.HOME ? (
               <><LayoutDashboard size={16} /> Admin</>
            ) : (
               <><Home size={16} /> Home</>
            )}
          </button>

          {isAuthenticated && currentView === ViewState.ADMIN && (
             <button onClick={onLogout} className="nav-link" style={{display: 'flex', gap: '5px', alignItems: 'center'}}>
                <LogOut size={16} /> Logout
             </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={toggleMenu}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="mobile-menu">
           {currentView === ViewState.HOME && navLinks.map((link) => (
              <a
                key={link.name}
                href={`#${link.target}`}
                onClick={(e) => handleScroll(e, link.target)}
                className="mobile-nav-link"
              >
                {link.name}
              </a>
            ))}
           <button
              onClick={() => {
                  if (currentView === ViewState.HOME) {
                    setView(isAuthenticated ? ViewState.ADMIN : ViewState.LOGIN);
                  } else {
                    setView(ViewState.HOME);
                  }
                  toggleMenu();
              }}
              className="admin-btn mobile-admin-btn"
            >
               {currentView === ViewState.HOME ? 'Admin Dashboard' : 'Back to Home'}
            </button>
            {isAuthenticated && currentView === ViewState.ADMIN && (
              <button 
                onClick={() => { onLogout(); toggleMenu(); }} 
                className="nav-link mobile-nav-link" 
                style={{width: '100%', textAlign: 'left', marginTop: '10px'}}
              >
                Logout
              </button>
            )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;