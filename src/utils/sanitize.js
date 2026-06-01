const stripHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '');
};

const rejectNoSqlOperators = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (key.includes('$') || key.includes('.')) {
      continue; // strip the key
    }
    clean[key] = typeof obj[key] === 'object' ? rejectNoSqlOperators(obj[key]) : obj[key];
  }
  return clean;
};

module.exports = { stripHtml, rejectNoSqlOperators };
