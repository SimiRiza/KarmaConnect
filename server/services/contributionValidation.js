import { fail, money } from './resourceValidation.js';
export const payloadKeys = { time: 'timeContributed', skills: 'skillsContributed', money: 'moneyContributed', materials: 'materialsContributed' };
const str = (v, label, max = 2000) => { if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`Invalid ${label}.`); return v.trim(); };
const positive = (v, label) => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 1000000) fail(`${label} must be a positive number up to 1000000.`); return v; };
export function validateContribution(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !payloadKeys[data.type]) fail('Choose time, skills, money or materials.');
  const key = payloadKeys[data.type];
  if (Object.values(payloadKeys).filter(k => data[k] !== undefined && data[k] !== null).length !== 1 || !data[key] || typeof data[key] !== 'object' || Array.isArray(data[key])) fail('Provide exactly one contribution payload matching its type.');
  const value = data[key]; let payload;
  if (data.type === 'time') payload = { hours: positive(value.hours, 'Hours'), description: str(value.description, 'description') };
  if (data.type === 'skills') {
    if (!Array.isArray(value.skills) || !value.skills.length || value.skills.length > 30) fail('List 1–30 skills.');
    payload = { skills: [...new Set(value.skills.map(s => str(s, 'skill', 100).toLowerCase()))], hoursEquivalent: positive(value.hoursEquivalent, 'Skill hours'), description: str(value.description, 'description') };
  }
  if (data.type === 'money') payload = { amount: money(value.amount, true) / 100 };
  if (data.type === 'materials') {
    if (!Array.isArray(value.items) || !value.items.length || value.items.length > 50) fail('List 1–50 material items.');
    payload = { items: value.items.map(i => ({ item: str(i?.item, 'material item', 100), quantity: positive(i?.quantity, 'Quantity') })), estimatedValue: money(value.estimatedValue ?? 0) / 100 };
  }
  return { type: data.type, [key]: payload };
}
