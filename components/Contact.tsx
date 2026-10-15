import React from 'react';
import { CONTACT_INFO } from '../constants';
import { Phone, Mail, MapPin } from 'lucide-react';
import './Contact.css';

const Contact: React.FC = () => {
  return (
    <section id="contact" className="contact-section">
      <div className="container">
        <div className="section-header" data-aos="fade-up">
          <h2 className="section-title" style={{color: 'var(--white)'}}>Get In Touch</h2>
          <div className="section-divider"></div>
          <p className="section-subtitle" style={{color: 'var(--secondary)', opacity: 0.9}}>
            Have questions about our products or need consultation? We are here to help.
          </p>
        </div>

        <div className="contact-grid">
          <a href={`tel:${CONTACT_INFO.phone1}`}>
          <div className="contact-card" data-aos="fade-up" data-aos-delay="0">
            <div className="icon-circle">
              <Phone size={32} color="#fff" />
            </div>
            <h3 className="contact-title">Call Us</h3>
            <p className="contact-info">{CONTACT_INFO.phone1}</p>
            <p className="contact-info">{CONTACT_INFO.phone2}</p>
          </div>
          </a>
            <a 
  href={`mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent("Inquiry about Scott Pigs Farm")}&body=${encodeURIComponent("Hello Scott Pigs Farm,")}`}
  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} // 3. Important CSS
>
          <div className="contact-card" data-aos="fade-up" data-aos-delay="100">
            <div className="icon-circle">
              <Mail size={32} color="#fff" />
            </div>
            <h3 className="contact-title">Email Us</h3>
            <p className="contact-info">{CONTACT_INFO.email}</p>
            
          </div>
          </a>

          <div className="contact-card" data-aos="fade-up" data-aos-delay="200">
            <div className="icon-circle">
              <MapPin size={32} color="#fff" />
            </div>
            <h3 className="contact-title">Visit Farm</h3>
            <p className="contact-info">{CONTACT_INFO.location}</p>
            <p className="contact-sub">Open Mon-Sat: 8am - 6pm</p>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Contact;