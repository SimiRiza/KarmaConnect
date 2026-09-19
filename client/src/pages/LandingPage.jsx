import React from 'react';
import { Link } from 'react-router-dom';
import { 
  HeartHandshake, 
  MapPin, 
  Users, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  GraduationCap, 
  TrendingUp,
  Compass
} from 'lucide-react';

export const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-brand-50/60 via-canvas to-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Impact Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100/80 border border-brand-200/60 text-brand-800 text-xs sm:text-sm font-semibold shadow-xs">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Community-Led Social Impact Platform</span>
            </div>

            {/* Headline & Tagline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-stone-900 tracking-tight leading-[1.15]">
              From local problems to <span className="text-brand-600 underline decoration-accent-400 decoration-wavy decoration-2">real impact</span> — together.
            </h1>

            {/* What KarmaConnect does (3-4 lines) */}
            <p className="text-lg sm:text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">
              KarmaConnect is a community-impact ecosystem that unites neighborhood challenges with certified grassroots NGOs, dedicated volunteers, and corporate CSR capital — turning local concern into verifiable change.
            </p>

            {/* Main Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/signup"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-base shadow-lg shadow-accent-500/25 hover:shadow-accent-500/35 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Join KarmaConnect</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/discover"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 font-semibold text-base border border-stone-300 shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <Compass className="w-5 h-5 text-brand-600" />
                <span>Explore Projects</span>
              </Link>
            </div>

            {/* Key Trust Signals */}
            <div className="pt-8 flex flex-wrap justify-center items-center gap-6 text-xs sm:text-sm text-stone-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-600" /> Verified NGO Partners
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-600" /> 100% Transparent Tracking
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-600" /> Skills-Matched Volunteering
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-700">The Impact Lifecycle</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              How KarmaConnect Works
            </h3>
            <p className="text-stone-600 text-base">
              A transparent, structured four-step journey transforming everyday neighborhood challenges into measurable community triumphs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Step 1: Discover */}
            <div className="bg-canvas p-6 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold">
                🗺️
              </div>
              <div className="text-xs font-bold tracking-wider text-amber-700 uppercase">Step 1</div>
              <h4 className="text-xl font-bold text-stone-900">Discover</h4>
              <p className="text-sm text-stone-600 leading-relaxed">
                Citizens and communities post real local problems — from neglected school libraries to urban cleanups — complete with location and urgency.
              </p>
            </div>

            {/* Step 2: Match */}
            <div className="bg-canvas p-6 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
                🤝
              </div>
              <div className="text-xs font-bold tracking-wider text-blue-700 uppercase">Step 2</div>
              <h4 className="text-xl font-bold text-stone-900">Match</h4>
              <p className="text-sm text-stone-600 leading-relaxed">
                Registered NGOs adopt the cause, while smart algorithms match skilled volunteers and corporate sponsors aligned with the cause focus.
              </p>
            </div>

            {/* Step 3: Contribute */}
            <div className="bg-canvas p-6 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative space-y-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center text-2xl font-bold">
                💪
              </div>
              <div className="text-xs font-bold tracking-wider text-orange-700 uppercase">Step 3</div>
              <h4 className="text-xl font-bold text-stone-900">Contribute</h4>
              <p className="text-sm text-stone-600 leading-relaxed">
                Volunteers contribute their time and expertise on the ground, while CSR budgets provide essential materials and execution funding.
              </p>
            </div>

            {/* Step 4: Track Impact */}
            <div className="bg-canvas p-6 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold">
                📊
              </div>
              <div className="text-xs font-bold tracking-wider text-emerald-700 uppercase">Step 4</div>
              <h4 className="text-xl font-bold text-stone-900">Track Impact</h4>
              <p className="text-sm text-stone-600 leading-relaxed">
                Real-time progress, budget utilization (required, collected, spent), before/after photo verification, and verifiable milestones for all stakeholders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role CTA Cards */}
      <section className="py-20 bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">
              A Home for Every Change-Maker
            </h2>
            <p className="text-stone-600 text-base">
              Select your role to start creating verifiable impact in your community today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Volunteers */}
            <div className="bg-white rounded-2xl p-8 border border-stone-200 shadow-sm hover:border-brand-500 hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-stone-900">For Volunteers & Students</h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Discover local causes that need your specific skills — from tutoring and digital design to environmental cleanups. Log verified hours and build real-world leadership.
                </p>
                <ul className="text-xs text-stone-500 space-y-2 pt-2">
                  <li className="flex items-center gap-2">✓ Flexible weekend or remote projects</li>
                  <li className="flex items-center gap-2">✓ Verified volunteer experience badges</li>
                  <li className="flex items-center gap-2">✓ Direct neighborhood community connection</li>
                </ul>
              </div>
              <div className="pt-8">
                <Link
                  to="/signup?role=community_user"
                  className="w-full py-3 px-4 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-sm text-center block transition-colors border border-brand-200"
                >
                  Join as Volunteer
                </Link>
              </div>
            </div>

            {/* Card 2: NGOs */}
            <div className="bg-white rounded-2xl p-8 border-2 border-brand-500/80 shadow-md relative flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                Community Anchors
              </div>
              <div className="space-y-4 pt-1">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-stone-900">For Grassroots NGOs</h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Scale your outreach by adopting local problems, mobilizing vetted volunteer squads, and unlocking corporate CSR funds with audited milestone tracking.
                </p>
                <ul className="text-xs text-stone-500 space-y-2 pt-2">
                  <li className="flex items-center gap-2">✓ Access corporate CSR grants</li>
                  <li className="flex items-center gap-2">✓ Organized volunteer management tools</li>
                  <li className="flex items-center gap-2">✓ Automated proof-of-impact reports</li>
                </ul>
              </div>
              <div className="pt-8">
                <Link
                  to="/signup?role=ngo"
                  className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm text-center block transition-colors shadow-sm"
                >
                  Register Your NGO
                </Link>
              </div>
            </div>

            {/* Card 3: CSR */}
            <div className="bg-white rounded-2xl p-8 border border-stone-200 shadow-sm hover:border-accent-500 hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-stone-900">For CSR Companies</h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Direct your corporate social responsibility budgets into verified projects with transparent fund utilization, audit-ready data, and employee volunteer drives.
                </p>
                <ul className="text-xs text-stone-500 space-y-2 pt-2">
                  <li className="flex items-center gap-2">✓ Fully compliant CSR budget deployment</li>
                  <li className="flex items-center gap-2">✓ Verified NGO due diligence</li>
                  <li className="flex items-center gap-2">✓ Employee engagement & volunteer matching</li>
                </ul>
              </div>
              <div className="pt-8">
                <Link
                  to="/signup?role=csr_manager"
                  className="w-full py-3 px-4 rounded-xl bg-accent-50 hover:bg-accent-100 text-accent-700 font-bold text-sm text-center block transition-colors border border-accent-200"
                >
                  Partner as CSR Sponsor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
