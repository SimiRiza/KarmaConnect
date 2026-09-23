import React from 'react';
import { Clock, Wrench, HandCoins, Package } from 'lucide-react';
export default function ContributionTypeIcon({ type }) { const Icon = { time: Clock, skills: Wrench, money: HandCoins, materials: Package }[type] || Package; return <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />; }
