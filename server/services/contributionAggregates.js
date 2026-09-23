import Contribution from '../models/Contribution.js';
import Funding from '../models/Funding.js';
import { paise } from './resourceValidation.js';
export const confirmedFilter = { status: 'confirmed', schemaVersion: 2, legacyNeedsReview: { $ne: true }, projectId: { $ne: null } };
const rounded = v => Math.round(v * 1000000) / 1000000;
export function sumContributions(records) {
  const totals = { timeHours: 0, skillHours: 0, totalHours: 0, money: 0, materials: [], materialsCount: 0, materialEstimatedValue: 0, skills: [], byType: {} };
  const materials = new Map(), skills = new Map(); let money = 0, value = 0;
  for (const c of records) {
    totals.byType[c.type] = (totals.byType[c.type] || 0) + 1;
    if (c.type === 'time') totals.timeHours += c.timeContributed?.hours || 0;
    if (c.type === 'skills') {
      const hours = c.skillsContributed?.hoursEquivalent || 0; totals.skillHours += hours;
      // A session's hours are split equally among its skills, avoiding doubled skill hours.
      const names = [...new Set((c.skillsContributed?.skills || []).map(s => s.trim().toLowerCase()))];
      for (const name of names) skills.set(name, (skills.get(name) || 0) + hours / names.length);
    }
    if (c.type === 'money') money += paise(c.moneyContributed?.amount || 0);
    if (c.type === 'materials') {
      value += paise(c.materialsContributed?.estimatedValue || 0);
      for (const item of c.materialsContributed?.items || []) {
        const key = item.item.trim().replace(/\s+/g, ' ').toLowerCase();
        materials.set(key, (materials.get(key) || 0) + item.quantity);
      }
    }
  }
  totals.timeHours = rounded(totals.timeHours); totals.skillHours = rounded(totals.skillHours);
  totals.totalHours = rounded(totals.timeHours + totals.skillHours); totals.money = money / 100;
  totals.materialEstimatedValue = value / 100;
  totals.materials = [...materials].sort().map(([item, quantity]) => ({ item, quantity: rounded(quantity) }));
  totals.materialsCount = totals.materials.length; // Distinct item kinds, not unlike physical units added together.
  totals.skills = [...skills].sort().map(([skill, hours]) => ({ skill, hours: rounded(hours) }));
  return totals;
}
export async function aggregateProjectContributions(projectId, session = null) {
  return sumContributions(await Contribution.find({ ...confirmedFilter, projectId }).session(session).lean());
}
export async function aggregateProjectFunding(projectId, session = null) {
  const volunteer = await aggregateProjectContributions(projectId, session);
  const records = await Funding.find({ projectId, status: { $ne: 'withdrawn' } }).select('amountAllocated').session(session).lean();
  const csr = records.reduce((n, f) => n + paise(f.amountAllocated), 0);
  return { fromVolunteers: volunteer.money, fromCSR: csr / 100, total: (paise(volunteer.money) + csr) / 100 };
}
