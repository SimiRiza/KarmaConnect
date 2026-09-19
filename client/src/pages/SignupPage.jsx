import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  HeartHandshake, 
  GraduationCap, 
  Building2, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';

const CAUSE_AREAS = [
  'Education & Literacy',
  'Healthcare & Sanitation',
  'Environment & Climate',
  'Hunger & Food Security',
  'Women Empowerment',
  'Animal Welfare',
  'Disaster Relief',
  'Elderly Care',
  'Youth Development',
  'Community Arts & Culture'
];

const BUDGET_RANGES = [
  'Under $10,000 / year',
  '$10,000 – $50,000 / year',
  '$50,000 – $250,000 / year',
  '$250,000 – $1,000,000 / year',
  'Over $1,000,000 / year'
];

export const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signup } = useAuth();

  const initialRole = ['community_user', 'ngo', 'csr_manager'].includes(searchParams.get('role'))
    ? searchParams.get('role')
    : 'community_user';

  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ email: '', message: '', isEmailVerificationRequired: true });

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Role
    role: initialRole,

    // Step 2: Common Fields
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',

    // Step 3: Community User Fields
    subType: 'student',
    city: '',
    state: '',
    skills: [],
    interests: [],
    causeAreas: [],
    bio: '',
    collegeOrOrganization: '',

    // Step 3: NGO Fields
    ngoName: '',
    registrationNumber: '',
    about: '',
    contactPersonName: '',
    contactPhone: '',
    locationsServed: '',

    // Step 3: CSR Fields
    companyName: '',
    csrManagerName: '',
    industry: '',
    budgetRange: BUDGET_RANGES[1],
    companyWebsite: '',
    csrFocusAreas: []
  });

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && ['community_user', 'ngo', 'csr_manager'].includes(roleParam)) {
      setFormData(prev => ({ ...prev, role: roleParam }));
    }
  }, [searchParams]);

  // Validation Helpers
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 0 to 4
  };

  const validateStep2 = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep3 = () => {
    const errors = {};
    if (formData.role === 'community_user') {
      if (!formData.city.trim()) errors.city = 'City is required';
    } else if (formData.role === 'ngo') {
      if (!formData.ngoName.trim()) errors.ngoName = 'NGO name is required';
      if (!formData.registrationNumber.trim()) errors.registrationNumber = 'Registration number is required';
      if (!formData.contactPersonName.trim()) errors.contactPersonName = 'Contact person name is required';
    } else if (formData.role === 'csr_manager') {
      if (!formData.companyName.trim()) errors.companyName = 'Company name is required';
      if (!formData.csrManagerName.trim()) errors.csrManagerName = 'CSR manager name is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (validateStep2()) {
        setStep(3);
      }
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setFieldErrors({});
      setStep(step - 1);
    }
  };

  const toggleCauseArea = (area) => {
    if (formData.role === 'csr_manager') {
      setFormData(prev => ({
        ...prev,
        csrFocusAreas: prev.csrFocusAreas.includes(area)
          ? prev.csrFocusAreas.filter(a => a !== area)
          : [...prev.csrFocusAreas, area]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        causeAreas: prev.causeAreas.includes(area)
          ? prev.causeAreas.filter(a => a !== area)
          : [...prev.causeAreas, area]
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateStep3()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        phone: formData.phone.trim(),
        location: {
          city: formData.city.trim(),
          state: formData.state.trim(),
          coordinates: [0, 0]
        }
      };

      if (formData.role === 'community_user') {
        payload.subType = formData.subType;
        payload.skills = formData.skills;
        payload.interests = formData.interests;
        payload.causeAreas = formData.causeAreas;
        payload.bio = formData.bio;
        payload.collegeOrOrganization = formData.collegeOrOrganization;
      } else if (formData.role === 'ngo') {
        payload.ngoName = formData.ngoName.trim();
        payload.registrationNumber = formData.registrationNumber.trim();
        payload.about = formData.about;
        payload.contactPersonName = formData.contactPersonName.trim();
        payload.contactPhone = formData.contactPhone.trim();
        payload.causeAreas = formData.causeAreas;
        payload.locationsServed = formData.locationsServed
          ? formData.locationsServed.split(',').map(s => s.trim()).filter(Boolean)
          : [];
      } else if (formData.role === 'csr_manager') {
        payload.companyName = formData.companyName.trim();
        payload.csrManagerName = formData.csrManagerName.trim();
        payload.industry = formData.industry.trim();
        payload.budgetRange = formData.budgetRange;
        payload.companyWebsite = formData.companyWebsite.trim();
        payload.csrFocusAreas = formData.csrFocusAreas;
      }

      const response = await signup(payload);

      setSuccessInfo({
        email: formData.email,
        message: response.message,
        isEmailVerificationRequired: response.isEmailVerificationRequired
      });
      setIsSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setGeneralError(msg);
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach(e => {
          errorsObj[e.field] = e.message;
        });
        setFieldErrors(errorsObj);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Success Screen
  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-3xl p-8 sm:p-10 border border-stone-200 shadow-lg shadow-stone-200/50 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
              Welcome to KarmaConnect!
            </h2>
            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
              Your account has been registered for <strong>{successInfo.email}</strong>.
            </p>
          </div>

          {successInfo.isEmailVerificationRequired ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left text-xs sm:text-sm text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-amber-700" />
                Please verify your email address
              </p>
              <p className="text-amber-800 leading-relaxed">
                We've sent a verification link to your inbox. Please click the link to activate your account before logging in.
              </p>
              <p className="text-[11px] text-amber-700 italic pt-1">
                Note for developers: If running locally without SMTP configured, the verification link has been printed directly to your server console.
              </p>
            </div>
          ) : (
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 text-brand-800 text-sm">
              Your account is active and ready to use!
            </div>
          )}

          <div className="pt-2">
            <Link
              to="/login"
              className="w-full py-3.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base text-center block transition-colors shadow-md shadow-brand-600/20"
            >
              Proceed to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pwdStrength = getPasswordStrength(formData.password);

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
          Create Your KarmaConnect Account
        </h1>
        <p className="text-stone-600 text-sm sm:text-base">
          Join a growing community committed to solving local problems with verified impact.
        </p>
      </div>

      {/* Multi-step Indicator */}
      <div className="mb-10 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-xs sm:text-sm font-semibold">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-brand-700' : 'text-stone-400'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              1
            </span>
            <span>Role</span>
          </div>
          <div className={`w-8 sm:w-12 h-0.5 ${step >= 2 ? 'bg-brand-600' : 'bg-stone-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-brand-700' : 'text-stone-400'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              2
            </span>
            <span>Account</span>
          </div>
          <div className={`w-8 sm:w-12 h-0.5 ${step >= 3 ? 'bg-brand-600' : 'bg-stone-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-brand-700' : 'text-stone-400'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-brand-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
              3
            </span>
            <span>Profile Details</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-sm">
        {generalError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* STEP 1: ROLE SELECTION */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-stone-900 text-center mb-6">
                Choose your account type
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Community User */}
                <div
                  onClick={() => setFormData({ ...formData, role: 'community_user' })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    formData.role === 'community_user'
                      ? 'border-brand-600 bg-brand-50/40 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-stone-900">Community User</h3>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      For students, working professionals, and volunteers wanting to offer their skills, join teams, and solve local problems.
                    </p>
                  </div>
                  <div className="pt-4 flex items-center justify-between text-xs font-semibold text-brand-700">
                    <span>Volunteer / Citizen</span>
                    {formData.role === 'community_user' && <Check className="w-5 h-5 text-brand-600" />}
                  </div>
                </div>

                {/* NGO */}
                <div
                  onClick={() => setFormData({ ...formData, role: 'ngo' })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    formData.role === 'ngo'
                      ? 'border-brand-600 bg-brand-50/40 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <HeartHandshake className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-stone-900">Grassroots NGO</h3>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      For registered non-profits looking to adopt problems, organize teams, access CSR grants, and report impact.
                    </p>
                  </div>
                  <div className="pt-4 flex items-center justify-between text-xs font-semibold text-brand-700">
                    <span>Non-Profit Organization</span>
                    {formData.role === 'ngo' && <Check className="w-5 h-5 text-brand-600" />}
                  </div>
                </div>

                {/* CSR Manager */}
                <div
                  onClick={() => setFormData({ ...formData, role: 'csr_manager' })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    formData.role === 'csr_manager'
                      ? 'border-brand-600 bg-brand-50/40 shadow-sm'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-stone-900">CSR Manager</h3>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      For corporate foundations and CSR directors seeking verified projects, transparent budgeting, and audited impact.
                    </p>
                  </div>
                  <div className="pt-4 flex items-center justify-between text-xs font-semibold text-brand-700">
                    <span>Corporate Impact Partner</span>
                    {formData.role === 'csr_manager' && <Check className="w-5 h-5 text-brand-600" />}
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COMMON ACCOUNT CREDENTIALS */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <h2 className="text-lg font-bold text-stone-900">Account Credentials</h2>
                <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                  Role: {formData.role.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      id="name"
                      name="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Maya Chen or NGO Admin"
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        fieldErrors.name ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
                </div>

                {/* Email Address */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="username"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@example.com"
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        fieldErrors.email ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
                </div>

                {/* Phone Number */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min. 8 characters"
                      className={`w-full pl-11 pr-11 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        fieldErrors.password ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password strength meter */}
                  {formData.password && (
                    <div className="space-y-1 pt-1">
                      <div className="flex gap-1 h-1.5">
                        <div className={`flex-1 rounded-full ${pwdStrength >= 1 ? 'bg-red-400' : 'bg-stone-200'}`} />
                        <div className={`flex-1 rounded-full ${pwdStrength >= 2 ? 'bg-amber-400' : 'bg-stone-200'}`} />
                        <div className={`flex-1 rounded-full ${pwdStrength >= 3 ? 'bg-blue-400' : 'bg-stone-200'}`} />
                        <div className={`flex-1 rounded-full ${pwdStrength >= 4 ? 'bg-emerald-500' : 'bg-stone-200'}`} />
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {pwdStrength < 2 && 'Weak password — add uppercase, numbers, or symbols'}
                        {pwdStrength === 2 && 'Fair password'}
                        {pwdStrength === 3 && 'Good password'}
                        {pwdStrength === 4 && 'Strong password!'}
                      </p>
                    </div>
                  )}
                  {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Repeat password"
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        fieldErrors.confirmPassword ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.confirmPassword && <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              <div className="pt-6 flex justify-between">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-7 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
                >
                  <span>Next: Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ROLE-SPECIFIC FIELDS */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <h2 className="text-lg font-bold text-stone-900">
                  {formData.role === 'community_user' && 'Volunteer & Community Profile'}
                  {formData.role === 'ngo' && 'Grassroots NGO Information'}
                  {formData.role === 'csr_manager' && 'CSR Corporate Sponsorship Details'}
                </h2>
                <span className="text-xs text-stone-500">Step 3 of 3</span>
              </div>

              {/* COMMUNITY USER FORM */}
              {formData.role === 'community_user' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Volunteer Subtype */}
                    <div className="space-y-1.5">
                      <label htmlFor="subType" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        I am participating as <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="subType"
                        value={formData.subType}
                        onChange={(e) => setFormData({ ...formData, subType: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600 bg-white"
                      >
                        <option value="student">Student / Intern</option>
                        <option value="working_professional">Working Professional</option>
                        <option value="general_volunteer">General Volunteer</option>
                      </select>
                    </div>

                    {/* College or Organization */}
                    <div className="space-y-1.5">
                      <label htmlFor="collegeOrOrganization" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        College or Organization (Optional)
                      </label>
                      <input
                        type="text"
                        id="collegeOrOrganization"
                        value={formData.collegeOrOrganization}
                        onChange={(e) => setFormData({ ...formData, collegeOrOrganization: e.target.value })}
                        placeholder="e.g. Stanford University or Acme Inc."
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                      >
                      </input>
                    </div>

                    {/* City */}
                    <div className="space-y-1.5">
                      <label htmlFor="city" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        City / Neighborhood <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Brooklyn, NY"
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                          fieldErrors.city ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                        }`}
                      />
                      {fieldErrors.city && <p className="text-xs text-red-600">{fieldErrors.city}</p>}
                    </div>

                    {/* State / Region */}
                    <div className="space-y-1.5">
                      <label htmlFor="state" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        State / Province
                      </label>
                      <input
                        type="text"
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="e.g. NY"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                      />
                    </div>
                  </div>

                  {/* Cause Areas Multi-select Chips */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Causes You Care About (Select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CAUSE_AREAS.map((area) => {
                        const isSelected = formData.causeAreas.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleCauseArea(area)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                              isSelected
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{area}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Short Bio */}
                  <div className="space-y-1.5">
                    <label htmlFor="bio" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Short Bio or What You Hope to Contribute
                    </label>
                    <textarea
                      id="bio"
                      rows={3}
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="A short note on your background, skills, and community interests..."
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                    />
                  </div>
                </div>
              )}

              {/* NGO FORM */}
              {formData.role === 'ngo' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* NGO Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="ngoName" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        NGO Legal Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="ngoName"
                        value={formData.ngoName}
                        onChange={(e) => setFormData({ ...formData, ngoName: e.target.value })}
                        placeholder="e.g. Hope Literacy Foundation"
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                          fieldErrors.ngoName ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                        }`}
                      />
                      {fieldErrors.ngoName && <p className="text-xs text-red-600">{fieldErrors.ngoName}</p>}
                    </div>

                    {/* Registration Number */}
                    <div className="space-y-1.5">
                      <label htmlFor="registrationNumber" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Govt. Registration Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        placeholder="e.g. 501(c)(3) or Reg-98214"
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                          fieldErrors.registrationNumber ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                        }`}
                      />
                      {fieldErrors.registrationNumber && <p className="text-xs text-red-600">{fieldErrors.registrationNumber}</p>}
                    </div>

                    {/* Contact Person Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="contactPersonName" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Primary Contact Person <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="contactPersonName"
                        value={formData.contactPersonName}
                        onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                        placeholder="e.g. Sarah Jenkins (Coordinator)"
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                          fieldErrors.contactPersonName ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                        }`}
                      />
                      {fieldErrors.contactPersonName && <p className="text-xs text-red-600">{fieldErrors.contactPersonName}</p>}
                    </div>

                    {/* Contact Phone */}
                    <div className="space-y-1.5">
                      <label htmlFor="contactPhone" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        NGO Contact Phone
                      </label>
                      <input
                        type="tel"
                        id="contactPhone"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        placeholder="+1 (555) 987-6543"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                      />
                    </div>
                  </div>

                  {/* Locations Served */}
                  <div className="space-y-1.5">
                    <label htmlFor="locationsServed" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Locations / Cities Served (Comma-separated)
                    </label>
                    <input
                      type="text"
                      id="locationsServed"
                      value={formData.locationsServed}
                      onChange={(e) => setFormData({ ...formData, locationsServed: e.target.value })}
                      placeholder="e.g. Chicago, Evanston, Oak Park"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                    />
                  </div>

                  {/* Cause Areas */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Primary NGO Cause Areas
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CAUSE_AREAS.map((area) => {
                        const isSelected = formData.causeAreas.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleCauseArea(area)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                              isSelected
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{area}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* About the NGO */}
                  <div className="space-y-1.5">
                    <label htmlFor="about" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      About Your NGO Mission & Field Experience
                    </label>
                    <textarea
                      id="about"
                      rows={3}
                      value={formData.about}
                      onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                      placeholder="Describe your focus, past successful interventions, and how you engage local communities..."
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                    />
                  </div>
                </div>
              )}

              {/* CSR MANAGER FORM */}
              {formData.role === 'csr_manager' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Company Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="companyName" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="e.g. Apex Technologies Inc."
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                          fieldErrors.companyName ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                        }`}
                      />
                      {fieldErrors.companyName && <p className="text-xs text-red-600">{fieldErrors.companyName}</p>}
                    </div>

                    {/* CSR Manager Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="csrManagerName" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        CSR Manager / Lead Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="csrManagerName"
                        value={formData.csrManagerName}
                        onChange={(e) => setFormData({ ...formData, csrManagerName: e.target.value })}
                        placeholder="e.g. David Vance"
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                          fieldErrors.csrManagerName ? 'border-red-300 focus:ring-red-200' : 'border-stone-300 focus:ring-brand-200 focus:border-brand-600'
                        }`}
                      />
                      {fieldErrors.csrManagerName && <p className="text-xs text-red-600">{fieldErrors.csrManagerName}</p>}
                    </div>

                    {/* Industry */}
                    <div className="space-y-1.5">
                      <label htmlFor="industry" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Industry / Sector
                      </label>
                      <input
                        type="text"
                        id="industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        placeholder="e.g. Renewable Energy, Fintech, Healthcare"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                      />
                    </div>

                    {/* Budget Range */}
                    <div className="space-y-1.5">
                      <label htmlFor="budgetRange" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Annual CSR Budget Allocation
                      </label>
                      <select
                        id="budgetRange"
                        value={formData.budgetRange}
                        onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600 bg-white"
                      >
                        {BUDGET_RANGES.map(range => (
                          <option key={range} value={range}>{range}</option>
                        ))}
                      </select>
                    </div>

                    {/* Company Website */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <label htmlFor="companyWebsite" className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Company Website (Optional)
                      </label>
                      <input
                        type="url"
                        id="companyWebsite"
                        value={formData.companyWebsite}
                        onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                        placeholder="https://company.org"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-600"
                      />
                    </div>
                  </div>

                  {/* CSR Focus Areas */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Priority CSR Focus Areas
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CAUSE_AREAS.map((area) => {
                        const isSelected = formData.csrFocusAreas.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleCauseArea(area)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                              isSelected
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{area}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-8 flex flex-col-reverse sm:flex-row justify-between gap-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Account</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-md shadow-accent-500/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-stone-200 text-center text-xs text-stone-500">
          Already have a KarmaConnect account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
