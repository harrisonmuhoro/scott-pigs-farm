-- Seed Data for Scott Pigs Farm

USE scott_pigs;

-- Insert Initial Products
INSERT INTO products (name, price, image, category, description, inquire) VALUES
('Weaned Piglets', 4500, '/Public/Images/weaned pig.jpg', 'Livestock', 'Healthy, vaccinated 2-month old piglets.', 'https://wa.me/254741137175?text=Inquiry%20about%20weaned%pigs'),
('Mature Pig (Slaughter Ready)', 18000, '/Public/Images/mature pigs.jpg', 'Livestock', 'Well-fed pigs approx 90-100kg live weight.', 'https://wa.me/254741137175?text=Inquiry%20about%20mature%20pigs'),
('Fresh Pork Meat (Per KG)', 600, '/Public/Images/pork2.jpg', 'Meat', 'Premium cuts, fresh from the farm.', 'https://wa.me/254741137175?text=Inquiry%20about%20fresh%20pork'),
('Premium Bacon (500g)', 850, '/Public/Images/bacon.jpg', 'Processed', 'Cured and smoked to perfection.', 'https://wa.me/254741137175?text=Inquiry%20about%20premium%20bacon'),
('Grilled Pork Platter', 2500, '/Public/Images/large.jpg', 'Events', 'Ready-to-eat grilled pork for events/parties.', 'https://wa.me/254741137175?text=Inquiry%20about%20grilled%20pork'),
('Pig Feed (70kg Sack)', 3200, '/Public/Images/pig feed.jpg', 'Supplies', 'High-nutrient grower mash.', 'https://wa.me/254741137175?text=Inquiry%20about%20pig%20feeds'),
('Rendered Pork Fat (1L)', 400, '/Public/Images/rendered pork.jpg', 'By-product', 'Pure rendered lard for cooking.', 'https://wa.me/254741137175?text=Inquiry%20about%20rendered%20pork'),
('Consultation Services', 1500, '/Public/Images/consultation.jpg', 'Service', 'Expert advice on housing, feeding, and health.', 'https://wa.me/254741137175?text=Inquiry%20about%20consultation%20services'),
('Pig Carcass', 450, '/Public/Images/carcass.jpg', 'Wholesale', 'Whole carcass for butcheries and events.', 'https://wa.me/254741137175?text=Inquiry%20about%20pig%20carcass');

-- Do not seed dashboard metrics or default credentials. Create the first owner
-- interactively through the protected CLI provisioning procedure in database/README.md.
