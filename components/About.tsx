import React from 'react';
import './About.css';

const About: React.FC = () => {
  return (
    <section id="about" className="about-section">
      <div className="container">
        <div className="about-grid">
          
          <div className="about-content" data-aos="fade-up">
            <h2 className="about-title">About  Us</h2>
            <p className="about-text">
              Scott Pigs Farm is a premier Nyeri-based pig farming business dedicated to excellence. 
              We specialize in providing high-quality pig products, from healthy weaned piglets to 
              premium pork cuts and processed bacon.
            </p>
            <p className="about-text">
              Our commitment to hygiene, ethical farming practices, and superior taste ensures that 
              you get "Quality in every bite". Whether you need fresh meat for your family, 
              grilled pork for an event, or professional consultation to start your own farm, 
              Scott Pigs Farm is your trusted partner in agribusiness.
            </p>
          </div>

          <div className="about-images" data-aos="fade-up" data-aos-delay="1000">
            <img 
              src="/Public/Images/farm_operations.jpg" 
              alt="Farm Operations" 
              className="about-img"
            />
            <img 
              src="/Public/Images/pork.jpg" 
              alt="Quality Pork" 
              className="about-img img-offset"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;