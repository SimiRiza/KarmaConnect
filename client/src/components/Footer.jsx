import React from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, ShieldCheck, ArrowUpRight } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-stone-900 text-stone-300 pt-16 pb-12 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">KarmaConnect</span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              From local problems to real impact — together.
            </p>
            <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-800/80 px-3 py-2 rounded-lg border border-stone-700">
              <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
              <span>Verified NGOs & Transparent Impact</span>
            </div>
          </div>

          {/* Quick Nav */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              </li>
              <li>
                <Link to="/discover" className="hover:text-white transition-colors">Discover Projects</Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-white transition-colors">Create Account</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">Account Login</Link>
              </li>
            </ul>
          </div>

          {/* Community Roles */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">Who We Serve</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/signup?role=community_user" className="hover:text-brand-300 flex items-center gap-1">
                  <span>Volunteers & Students</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </Link>
              </li>
              <li>
                <Link to="/signup?role=ngo" className="hover:text-brand-300 flex items-center gap-1">
                  <span>Grassroots NGOs</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </Link>
              </li>
              <li>
                <Link to="/signup?role=csr_manager" className="hover:text-brand-300 flex items-center gap-1">
                  <span>Corporate CSR Teams</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Core Values */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">Our Commitment</h4>
            <p className="text-xs text-stone-400 leading-relaxed mb-3">
              KarmaConnect is built on transparency: every problem posted, rupee allocated, and hour volunteered is tracked to measurable, on-ground impact.
            </p>
            <p className="text-xs text-stone-500">
              Discover, match, contribute and track community impact.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-stone-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} KarmaConnect. All rights reserved.</p>
          <p className="flex gap-4">
            <span className="text-stone-400">Discover → Match → Contribute → Track Impact</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
