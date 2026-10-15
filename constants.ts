import { Product, FinancialMetric } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Weaned Piglets',
    price: 4500,
    image: '/Public/Images/weaned pig.jpg',
    category: 'Livestock',
    description: 'Healthy, vaccinated 2-month old piglets.',
    inquire: 'https://wa.me/254741137175?text=Inquiry%20about%20weaned%pigs'
  },
  {
    id: '2',
    name: 'Mature Pig (Slaughter Ready)',
    price: 18000,
    image: '/Public/Images/mature pigs.jpg',
    category: 'Livestock',
    description: 'Well-fed pigs approx 90-100kg live weight.',
    inquire: 'https://wa.me/254741137175?text=Inquiry%20about%20mature%20pigs'
  },
  {
    id: '3',
    name: 'Fresh Pork Meat (Per KG)',
    price: 600,
    image: '/Public/Images/pork2.jpg',
    category: 'Meat',
    description: 'Premium cuts, fresh from the farm.',
    inquire: 'https://wa.me/254741137175?text=Inquiry%20about%20fresh%20pork'
  },
  {
    id: '4',
    name: 'Premium Bacon (500g)',
    price: 850,
    image: '/Public/Images/bacon.jpg',
    category: 'Processed',
    description: 'Cured and smoked to perfection.',
    inquire: 'https://wa.me/254741137175?text=Inquiry%20about%20premium%20bacon'
  },
  {
    id: '5',
    name: 'Grilled Pork Platter',
    price: 2500,
    image: '/Public/Images/pork large.jpg',
    category: 'Events',
    description: 'Ready-to-eat grilled pork for events/parties.',
    inquire:'https://wa.me/254741137175?text=Inquiry%20about%20grilled%20pork'
  },
  {
    id: '6',
    name: 'Pig Feed (70kg Sack)',
    price: 3200,
    image: '/Public/Images/pig feed.jpg',
    category: 'Supplies',
    description: 'High-nutrient grower mash.',
    inquire:'https://wa.me/254741137175?text=Inquiry%20about%20pig%20feeds'
  },
  {
    id: '7',
    name: 'Rendered Pork Fat (1L)',
    price: 400,
    image: '/Public/Images/rendered pork.jpg',
    category: 'By-product',
    description: 'Pure rendered lard for cooking.',
    inquire:'https://wa.me/254741137175?text=Inquiry%20about%20rendered%20pork'
  },
  {
    id: '8',
    name: 'Consultation Services',
    price: 1500,
    image: '/Public/Images/consultation.jpg',
    category: 'Service',
    description: 'Expert advice on housing, feeding, and health.',
    inquire:'https://wa.me/254741137175?text=Inquiry%20about%20consultation%20services'
  },
  {
    id: '9',
    name: 'Pig Carcass',
    price: 450,
    image: '/Public/Images/carcass.jpg',
    category: 'Wholesale',
    description: 'Whole carcass for butcheries and events.',
    inquire:'https://wa.me/254741137175?text=Inquiry%20about%20pig%20carcass'  }
];

export const INITIAL_METRICS: FinancialMetric[] = [
  { label: 'Total Revenue (mtd)', value: 450000, type: 'income' },
  { label: 'Feed Expenses', value: 120000, type: 'expense' },
  { label: 'Vet & Labour', value: 45000, type: 'expense' },
  { label: 'Net Profit', value: 285000, type: 'neutral' },
];

export const CONTACT_INFO = {
  phone1: '+254 741 137 175',
  phone2: '+254 781 520 912',
  email: 'gichukia333@gmail.com',
  location: 'Nyeri, Kenya',
  slogan: 'Quality in every bite'
};