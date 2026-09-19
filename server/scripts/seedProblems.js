import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';

dotenv.config();

const sampleProblems = [
  {
    title: 'Clean Up Versova Beach Mangrove Belt',
    description: 'Plastic waste and industrial debris are choking the local mangrove ecosystem. We need community volunteers for a weekend drive to clear non-biodegradable trash and plant native saplings.',
    category: 'environment',
    urgency: 'high',
    status: 'team_forming',
    photos: [
      'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80'
    ],
    location: {
      city: 'Mumbai',
      area: 'Versova Beach, Andheri West',
      coordinates: [72.8152, 19.1317]
    },
    estimatedResourcesNeeded: '40 volunteer hours, 100 burlap sacks, 50 pairs of puncture-resistant gloves',
    financialGoal: 25000,
    collectedAmount: 8500
  },
  {
    title: 'Digital Literacy & Coding Lab for Underprivileged Students',
    description: 'Setting up a community weekend computer lab for 60 primary school students. Volunteers needed to teach basic computer usage, Scratch programming, and assist with homework.',
    category: 'education',
    urgency: 'medium',
    status: 'in_progress',
    photos: [
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80'
    ],
    location: {
      city: 'Bangalore',
      area: 'Koramangala 4th Block',
      coordinates: [77.6245, 12.9352]
    },
    estimatedResourcesNeeded: '5 mentors (2 hours/weekend), 3 refurbished monitors, internet connectivity',
    financialGoal: 40000,
    collectedAmount: 32000
  },
  {
    title: 'Solar Lamp & Heating Repair for Senior Citizens Home',
    description: 'Elderly care home requires urgent electrical inspection and repair of water heaters and perimeter solar lighting ahead of the monsoon season.',
    category: 'elderly_support',
    urgency: 'high',
    status: 'funding_needed',
    photos: [
      'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=800&q=80'
    ],
    location: {
      city: 'Pune',
      area: 'Kothrud',
      coordinates: [73.8077, 18.5074]
    },
    estimatedResourcesNeeded: 'Certified electrician, replacement solar batteries, wiring kit',
    financialGoal: 18000,
    collectedAmount: 4200
  },
  {
    title: 'Community Stray Animal Vaccination & Shelter Drive',
    description: 'Rabies vaccination, deworming, and reflective collar fitting for community dogs in East Delhi. Animal lovers and veterinary students welcome.',
    category: 'animal_welfare',
    urgency: 'medium',
    status: 'reported',
    photos: [
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80'
    ],
    location: {
      city: 'Delhi',
      area: 'Mayur Vihar Phase 1',
      coordinates: [77.2975, 28.6083]
    },
    estimatedResourcesNeeded: 'Veterinary assistant, 50 vaccine vials, reflective collars, pet food',
    financialGoal: 15000,
    collectedAmount: 15000
  },
  {
    title: 'Mobile Health Checkup & Hygiene Kit Distribution',
    description: 'Free basic primary health screening camp and distribution of dental care and sanitation kits for migrant construction workers and their families.',
    category: 'health',
    urgency: 'low',
    status: 'completed',
    photos: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80'
    ],
    location: {
      city: 'Hyderabad',
      area: 'Gachibowli',
      coordinates: [78.3489, 17.4401]
    },
    estimatedResourcesNeeded: '2 doctors, 4 triage volunteers, 150 hygiene kits',
    financialGoal: 30000,
    collectedAmount: 30000
  }
];

export const seedProblems = async () => {
  try {
    await connectDB();
    console.log('🌱 Connected to DB for seeding problems...');

    // Find or create an author user for seeded problems
    let user = await User.findOne({ role: 'community_user' });
    if (!user) {
      user = await User.findOne({});
    }

    if (!user) {
      user = await User.create({
        name: 'Aarav Sharma',
        email: 'aarav.volunteer@karmaconnect.org',
        passwordHash: '$2a$12$eXampLeHashForSeededUser12345678901234567890123456789012',
        role: 'community_user',
        isEmailVerified: true,
        location: { city: 'Mumbai', area: 'Bandra' }
      });
      console.log('👤 Created default seed author user');
    }

    for (const item of sampleProblems) {
      const exists = await Problem.findOne({ title: item.title });
      if (!exists) {
        await Problem.create({
          ...item,
          postedBy: user._id
        });
        console.log(`✅ Seeded problem: "${item.title}"`);
      } else {
        console.log(`ℹ️ Problem already exists: "${item.title}"`);
      }
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
  } finally {
    await disconnectDB();
  }
};

// If run directly via node CLI
if (process.argv[1]?.includes('seedProblems.js')) {
  seedProblems();
}
