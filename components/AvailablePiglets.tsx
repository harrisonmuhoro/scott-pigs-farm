// Pork/components/AvailablePiglets.tsx
import React from 'react';
import { PigLitter } from '../types';
import { Calendar, Info } from 'lucide-react';
import { CONTACT_INFO } from '../constants';
import './AvailablePiglets.css';

interface AvailablePigletsProps {
  pigs: PigLitter[];
}

const AvailablePiglets: React.FC<AvailablePigletsProps> = ({ pigs }) => {
  
  const calculateAge = (dobString: string) => {
    const dob = new Date(dobString);
    const diff = Date.now() - dob.getTime();
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    return `${weeks} Weeks Old`;
  };

  const getWhatsappLink = (pig: PigLitter) => {
    const message = `Hello, I am interested in the ${pig.breed} piglets (Born: ${pig.dob}) from Sow ${pig.mother}. Are they available?`;
    return `https://wa.me/${CONTACT_INFO.phone1.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
  };

  return (
    <section id="piglets" className="piglets-section">
      <div className="container">
        <div className="section-header" data-aos="fade-up">
          <h2 className="section-title">Available Piglets</h2>
          <div className="section-divider"></div>
          <p className="section-subtitle">
            Healthy, high-quality litters ready for booking. Traceable lineage from our best stock.
          </p>
        </div>

        <div className="piglets-grid">
          {pigs.length === 0 ? (
             <div style={{textAlign: 'center', gridColumn: '1/-1', padding: '40px', color: 'var(--gray-medium)'}}>
               <h3>No piglets currently listed online.</h3>
               <p>Please contact us directly for upcoming litters.</p>
             </div>
          ) : (
            pigs.map((pig, index) => (
              <div key={pig.id} className="piglet-card" data-aos="fade-up" data-aos-delay={index * 100}>
                
                {/* Parents Images */}
                <div className="parents-gallery">
                  <div className="parent-image-container">
                    <img src={pig.motherImage || '/Public/Images/mature pigs.jpg'} alt={pig.mother} className="parent-img" />
                    <div className="parent-label">Mother: {pig.mother}</div>
                  </div>
                  <div className="parent-image-container" style={{borderLeft: '2px solid white'}}>
                    <img src={pig.fatherImage || '/Public/Images/pigs.jpg'} alt={pig.father} className="parent-img" />
                    <div className="parent-label">Father: {pig.father}</div>
                  </div>
                </div>

                <div className="piglet-info">
                  <div className="piglet-header">
                    <div>
                      <div className="piglet-breed">{pig.breed}</div>
                      <div className="piglet-dob">
                         <Calendar size={14} /> Born: {pig.dob}
                      </div>
                    </div>
                    <div style={{textAlign: 'right'}}>
                       <span style={{
                         backgroundColor: pig.status === 'Available' ? 'var(--success)' : 'var(--error)',
                         color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold'
                       }}>
                         {pig.status}
                       </span>
                    </div>
                  </div>

                  <div className="info-grid">
                    <div className="info-item">
                      <h4>Litter Size</h4>
                      <p>{pig.pigletsBorn} Piglets</p>
                    </div>
                    <div className="info-item">
                      <h4>Age</h4>
                      <p>{calculateAge(pig.dob)}</p>
                    </div>
                    <div className="info-item">
                      <h4>Color/Markings</h4>
                      <p>{pig.color}</p>
                    </div>
                    <div className="info-item">
                      <h4>Sire Line</h4>
                      <p>{pig.father}</p>
                    </div>
                  </div>

                  <div className="piglet-footer">
                    <div className="piglet-price">KES {pig.price.toLocaleString()}</div>
                    <a href={getWhatsappLink(pig)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                       Inquire Now
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default AvailablePiglets;