function parseRequiredString(value, fieldName, errors) {
  if (value === undefined || value === null || String(value).trim() === '') {
    errors.push(`${fieldName} is required`);
    return undefined;
  }
  return String(value).trim();
}

function parseOptionalString(value, fieldName, errors) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (String(value).trim() === '') {
    errors.push(`${fieldName} cannot be empty`);
    return undefined;
  }
  return String(value).trim();
}

function parseRequiredNumber(value, fieldName, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push(`${fieldName} is required`);
    return undefined;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    errors.push(`${fieldName} must be a number`);
    return undefined;
  }
  return numberValue;
}

function parseOptionalNumber(value, fieldName, errors) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    errors.push(`${fieldName} must be a number`);
    return undefined;
  }
  return numberValue;
}

function parseEnum(value, enumObj, fieldName, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push(`${fieldName} is required`);
    return undefined;
  }
  const normalized = String(value).trim().toUpperCase();
  if (!enumObj[normalized]) {
    errors.push(`${fieldName} must be one of: ${Object.keys(enumObj).join(', ')}`);
    return undefined;
  }
  return enumObj[normalized];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseDateOnly(value, fieldName, errors) {
  if (!value) {
    errors.push(`${fieldName} is required`);
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${fieldName} must be a valid date`);
    return undefined;
  }
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function parseTimeToMinutes(value, fieldName, errors) {
  if (!value) {
    errors.push(`${fieldName} is required`);
    return undefined;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value));
  if (!match) {
    errors.push(`${fieldName} must be in HH:mm format`);
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

module.exports = {
  parseRequiredString,
  parseOptionalString,
  parseRequiredNumber,
  parseOptionalNumber,
  parseEnum,
  isValidEmail,
  parseDateOnly,
  parseTimeToMinutes,
};
