const { faker } = require('@faker-js/faker');

// Deterministic — same data every run so tests + demos are reproducible.
faker.seed(42);

const INDIAN_FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Vihaan', 'Ishita',
  'Kabir', 'Meera', 'Arjun', 'Saanvi', 'Ishaan', 'Priya', 'Karthik', 'Neha',
  'Rahul', 'Sneha', 'Aditya', 'Riya', 'Yash', 'Tara'];
const INDIAN_LAST = ['Sharma', 'Nair', 'Iyer', 'Reddy', 'Gupta', 'Menon',
  'Bose', 'Rao', 'Khan', 'Desai', 'Patel', 'Verma', 'Singh', 'Joshi'];
const BRANCHES = ['Computer Science', 'Information Technology', 'Electronics',
  'Mechanical', 'Data Science', 'Electrical'];
const CITIES = ['Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Mumbai', 'Remote'];
const INDUSTRIES = ['Data & Analytics', 'Financial Services', 'Supply Chain',
  'E-commerce', 'Healthcare Tech', 'Cybersecurity'];

function personName() {
  return `${faker.helpers.arrayElement(INDIAN_FIRST)} ${faker.helpers.arrayElement(INDIAN_LAST)}`;
}

function cgpa() {
  // Realistic distribution: most 6.5–9.0, a few outliers
  return Number(faker.number.float({ min: 5.5, max: 9.8, fractionDigits: 2 }));
}

module.exports = { faker, personName, cgpa, BRANCHES, CITIES, INDUSTRIES };
