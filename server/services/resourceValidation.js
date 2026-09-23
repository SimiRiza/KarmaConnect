import mongoose from 'mongoose';
export const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), {
    statusCode
  });
};
export const validId = value => {
  if (!mongoose.isValidObjectId(value)) fail('Invalid record ID.');
  return value;
};
export const paise = value => Math.round(value * 100);
export const money = (value, positive = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (positive ? 0.01 : 0) || value > 100000000000 || Math.abs(value * 100 - paise(value)) > 0.0001) fail('Use an INR amount with at most two decimal places.');
  return paise(value);
};
