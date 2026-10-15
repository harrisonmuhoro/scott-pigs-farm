import React from 'react';
import { Product } from '../types';
import './Products.css';

interface ProductsProps {
  products: Product[];
}

const Products: React.FC<ProductsProps> = ({ products }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  return (
    <section id="products" className="products-section">
      <div className="container">
        <div className="section-header" data-aos="fade-up">
          <h2 className="section-title">Our Products & Services</h2>
          <div className="section-divider"></div>
          <p className="section-subtitle">
            Browse our selection of quality farm produce and professional services.
          </p>
        </div>

        <div className="products-grid">
          {products.map((product, index) => (
            <div 
              key={product.id} 
              className="product-card" 
              data-aos="fade-up"
              data-aos-delay={index * 100} // Staggered effect
            >
              <div className="product-image-container">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="product-img"
                />
                <span className="product-category">
                  {product.category}
                </span>
              </div>
              <div className="product-content">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-desc">{product.description}</p>
                <div className="product-footer">
                  <span className="product-price">
                    {formatCurrency(product.price)}
                  </span>
                  <button className="btn-inquire">
                    <a href={product.inquire} target="_blank" rel="noopener noreferrer">Inquire Now &rarr;</a>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Products;