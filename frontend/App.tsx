import React, { useState, useEffect } from 'react';
import { api } from './src/services/api';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Products from './components/Products';
import Contact from './components/Contact';
import Footer from './components/Footer';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { ViewState, Product, User } from './types';
import AOS from 'aos';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productError, setProductError] = useState('');
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.getProducts(), api.session()]).then(([productResult, sessionResult]) => {
      if (!active) return;
      if (productResult.status === 'fulfilled') setProducts(productResult.value);
      else setProductError('The product catalog could not be loaded. Please refresh to try again.');
      if (sessionResult.status === 'fulfilled' && sessionResult.value) {
        setUser(sessionResult.value);
        setIsAuthenticated(true);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }, []);

  const handleLogin = (userData: User) => {
    setIsAuthenticated(true);
    setUser(userData);
    setCurrentView(ViewState.ADMIN);
  };

  const handleUserUpdate = (userData: User) => setUser(userData);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await api.logout();
      setIsAuthenticated(false);
      setUser(null);
      setCurrentView(ViewState.HOME);
    } catch {
      setLogoutError('Could not end the server session. Check your connection and try again.');
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.ADMIN:
        return isAuthenticated ? (
          user ? <AdminDashboard user={user} onUserUpdate={handleUserUpdate} onHome={() => setCurrentView(ViewState.HOME)} onLogout={handleLogout} products={products} setProducts={setProducts} /> : <div role="status">Loading account…</div>
        ) : (
          <Login onLogin={handleLogin} />
        );
      case ViewState.LOGIN:
        return <Login onLogin={handleLogin} />;
      case ViewState.HOME:
      default:
        return (
          <>
            <Hero />
            <About />
            {productError ? <div role="alert" className="catalog-error">{productError}</div> : <Products products={products} />}
            <Contact />
          </>
        );
    }
  };

  return (
    <div className="app-container">
      {currentView !== ViewState.ADMIN && (
        <Navbar
          currentView={currentView}
          setView={setCurrentView}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
        />
      )}

      <main>
        {loading ? <div className="app-loading" role="status">Loading Scott Pigs Farm…</div> : renderContent()}
        {logoutError && <div role="alert" className="catalog-error">{logoutError}</div>}
      </main>

      {currentView === ViewState.HOME && <Footer />}
    </div>
  );
};

export default App;
