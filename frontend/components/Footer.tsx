import React from 'react';
import { Facebook, Instagram,  Youtube } from 'lucide-react';
import './Footer.css';
const TiktokIcon = ({ size = 24, color = "currentColor" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          
          <div className="footer-brand">
            <h4>Scott Pigs Farm</h4>
            <p>Quality in every bite.
              <br /> Nyeri, Kenya.</p>
            <p className="footer-slogan">Don't forget to like,share and follow!</p>
          </div>

          <div className="social-links">
          
            <a href="https://www.facebook.com/scotfilled.jonson" target="_blank " className="social-icon">
              <Facebook size={24} />
            </a>
            <a href="https://www.instagram.com/scott_pigs_farm?igsh=NnRoamI2czVmNGU0" target="_blank" rel="noopener noreferrer "className="social-icon">
              <Instagram size={24} />
            </a>
            
            <a href="https://www.youtube.com/@Scott_pig_farm" target="_blank" rel="noopener noreferrer "className="social-icon">
              <Youtube size={24} />
            </a>
            <a href="https://www.tiktok.com/search?q=scott_pigs%20farm&t=1769279392741" target="_blank" rel="noopener noreferrer "className="social-icon">
  <TiktokIcon size={24} />
</a>
          </div>
        </div>

        <div className="footer-copyright">
          <p>&copy; {new Date().getFullYear()} Scott Pigs Farm. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;