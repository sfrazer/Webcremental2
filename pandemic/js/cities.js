const CITIES = [
  // Blue — North America / Europe
  { id: 'atlanta',      name: 'Atlanta',      color: 'blue',   x: 190, y: 218, connections: ['chicago', 'new_york'] },
  { id: 'chicago',      name: 'Chicago',      color: 'blue',   x: 158, y: 188, connections: ['atlanta', 'new_york', 'london'] },
  { id: 'new_york',     name: 'New York',     color: 'blue',   x: 218, y: 192, connections: ['atlanta', 'chicago', 'london', 'madrid', 'bogota'] },
  { id: 'london',       name: 'London',       color: 'blue',   x: 400, y: 143, connections: ['chicago', 'new_york', 'madrid', 'paris'] },
  { id: 'paris',        name: 'Paris',        color: 'blue',   x: 438, y: 162, connections: ['london', 'madrid', 'istanbul', 'cairo'] },
  { id: 'madrid',       name: 'Madrid',       color: 'blue',   x: 400, y: 192, connections: ['london', 'paris', 'new_york', 'sao_paulo', 'lagos'] },

  // Yellow — South America / Africa
  { id: 'bogota',       name: 'Bogotá',       color: 'yellow', x: 188, y: 290, connections: ['new_york', 'lima', 'sao_paulo'] },
  { id: 'lima',         name: 'Lima',         color: 'yellow', x: 168, y: 340, connections: ['bogota', 'sao_paulo'] },
  { id: 'sao_paulo',    name: 'São Paulo',    color: 'yellow', x: 238, y: 368, connections: ['madrid', 'lagos', 'bogota', 'lima'] },
  { id: 'lagos',        name: 'Lagos',        color: 'yellow', x: 445, y: 305, connections: ['madrid', 'sao_paulo', 'kinshasa', 'cairo', 'johannesburg'] },
  { id: 'kinshasa',     name: 'Kinshasa',     color: 'yellow', x: 482, y: 335, connections: ['lagos', 'johannesburg'] },
  { id: 'johannesburg', name: 'Johannesburg', color: 'yellow', x: 492, y: 382, connections: ['kinshasa', 'lagos'] },

  // Black — Middle East / Central Asia
  { id: 'cairo',        name: 'Cairo',        color: 'black',  x: 522, y: 232, connections: ['paris', 'istanbul', 'riyadh', 'lagos'] },
  { id: 'istanbul',     name: 'Istanbul',     color: 'black',  x: 512, y: 188, connections: ['cairo', 'moscow', 'tehran', 'paris', 'riyadh'] },
  { id: 'moscow',       name: 'Moscow',       color: 'black',  x: 548, y: 147, connections: ['istanbul', 'tehran', 'delhi'] },
  { id: 'tehran',       name: 'Tehran',       color: 'black',  x: 578, y: 205, connections: ['istanbul', 'moscow', 'riyadh', 'delhi'] },
  { id: 'riyadh',       name: 'Riyadh',       color: 'black',  x: 568, y: 255, connections: ['cairo', 'istanbul', 'tehran'] },
  { id: 'delhi',        name: 'Delhi',        color: 'black',  x: 638, y: 232, connections: ['moscow', 'tehran', 'bangkok', 'hong_kong'] },

  // Red — East / Southeast Asia / Oceania
  { id: 'tokyo',        name: 'Tokyo',        color: 'red',    x: 802, y: 188, connections: ['beijing', 'hong_kong', 'sydney'] },
  { id: 'beijing',      name: 'Beijing',      color: 'red',    x: 748, y: 182, connections: ['tokyo', 'hong_kong'] },
  { id: 'hong_kong',    name: 'Hong Kong',    color: 'red',    x: 748, y: 252, connections: ['tokyo', 'beijing', 'bangkok', 'jakarta', 'delhi'] },
  { id: 'bangkok',      name: 'Bangkok',      color: 'red',    x: 710, y: 272, connections: ['hong_kong', 'jakarta', 'delhi'] },
  { id: 'sydney',       name: 'Sydney',       color: 'red',    x: 818, y: 380, connections: ['jakarta', 'tokyo'] },
  { id: 'jakarta',      name: 'Jakarta',      color: 'red',    x: 752, y: 318, connections: ['hong_kong', 'bangkok', 'sydney'] },
];

const CITY_MAP = {};
for (const city of CITIES) CITY_MAP[city.id] = city;

function getCityColor(cityId) {
  return CITY_MAP[cityId] ? CITY_MAP[cityId].color : null;
}

function areCitiesAdjacent(a, b) {
  const city = CITY_MAP[a];
  return city ? city.connections.includes(b) : false;
}

function getCitiesByColor(color) {
  return CITIES.filter(c => c.color === color);
}
