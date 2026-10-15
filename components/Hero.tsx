import React from 'react';
import { CONTACT_INFO } from '../constants';
import './Hero.css';

const Hero: React.FC = () => {
  return (
    <section className="hero">
      <div className="hero-bg"></div>
      <div className="hero-overlay"></div>

      <div className="hero-content" data-aos="fade-up" data-aos-delay="2000" >
        <h1 className="hero-title">Scott Pigs Farm</h1>
        <p className="hero-slogan"> Welcome to  Nyeri’s trusted source for quality pigs, pig feed, and premium pork products.
      
        {CONTACT_INFO.slogan}</p>
        <div className="hero-buttons">
          <a href="#products" className="btn btn-primary">
            View Products
          </a>
          <a href="#contact" className="btn btn-outline">
            Contact Us
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;