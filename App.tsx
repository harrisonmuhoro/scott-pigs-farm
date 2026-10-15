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
import { ViewState, Product } from './types';
import { INITIAL_PRODUCTS } from './constants';
import AOS from 'aos';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string, username: string }>({ id: '', username: '' });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const fetchedProducts = await api.getProducts();
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Failed to load products:", error);
        // Fallback to initial products if API fails (for demo purposes)
        setProducts(INITIAL_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }, []);

  const handleLogin = (userData?: { id: string, username: string }) => {
    setIsAuthenticated(true);
    if (userData) setUser(userData);
    setCurrentView(ViewState.ADMIN);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView(ViewState.HOME);
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.ADMIN:
        return isAuthenticated ? (
          <AdminDashboard user={user} products={products} setProducts={setProducts} />
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
            <Products products={products} />
            <Contact />
          </>
        );
    }
  };

  return (
    <div className="app-container">
      <Navbar
        currentView={currentView}
        setView={setCurrentView}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      <main>
        {renderContent()}
      </main>

      {currentView === ViewState.HOME && <Footer />}
    </div>
  );
};

export default App;