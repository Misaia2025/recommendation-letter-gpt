import React, { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import { useAuth } from 'wasp/client/auth';
import { generateGptResponse } from 'wasp/client/operations';
import Confetti from 'react-confetti';

// Letter type options for Step 1
const LETTER_TYPES = [
  { value: 'academic', label: 'Academic (University)' },
  { value: 'job', label: 'Job / Employment' },
  { value: 'immigration', label: 'Immigration / Visa' },
  { value: 'internship', label: 'Internship' },
  { value: 'scholarship', label: 'Scholarship / Financial Aid' },
  { value: 'graduate', label: 'Graduate School' },
  { value: 'medical', label: 'Medical Residency' },
  { value: 'volunteer', label: 'Volunteer / NGO' },
  { value: 'tenant', label: 'Tenant / Landlord' },
  { value: 'personal', label: 'Personal / Character' }
];

export default function NewLetterPage() {
  const { data: user } = useAuth();
  const isGuest = !user;
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => mainRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Steps now from 1 to 5
  const totalSteps = 5;
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const initialForm = {
    letterType: 'academic',
    recName: '', recTitle: '', recOrg: '', relationship: 'manager', knownTime: 'lt1',
    applicantName: '', achievements: '', skills: '', qualities: '',
    recipientName: '', recipientPosition: '',
    gpa: '', visaType: '', rentalAddress: '', residencySpecialty: '',
    language: 'english', formality: 'formal', tone: 'enthusiastic', creativity: '0.5'
  };

  const [form, setForm] = useState(initialForm);
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Map for knownTime
  const KNOWN_TIMES: Record<string, string> = {
    lt1: 'less than 1 year',
    btw1and3: 'between 1 and 3 years',
    gt3: 'more than 3 years'
  };

  // Progress bar
  const getProgress = () => (currentStep / totalSteps) * 100;

  // Validate required fields per step
  const isStepComplete = () => {
    switch (currentStep) {
      case 1: return Boolean(form.letterType);
      case 2: return Boolean(form.recName && form.recTitle && form.recOrg);
      case 3: return Boolean(form.applicantName);
      default: return true;
    }
  };

  // Navigation
  const handleNext = () => {
    if (isStepComplete() && currentStep < totalSteps) {
      setCurrentStep(s => s + 1);
      scrollToTop();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(s => s - 1);
      scrollToTop();
    }
  };

  // Handle input changes
  const handleChange = (e: ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // Submit form: build prompt and call server action
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isGuest && localStorage.getItem('guestUsed')) {
      window.location.href = '/login';
      return;
    }
    setIsGenerating(true);

    const frags: string[] = [];
    frags.push(`Write a ${form.letterType} recommendation letter in ${form.language === 'spanish' ? 'Spanish' : 'English'}.`);
    frags.push(`Recommender: ${form.recName}, ${form.recTitle} at ${form.recOrg}, known for ${KNOWN_TIMES[form.knownTime]}.`);
    frags.push(`Applicant: ${form.applicantName}.`);
    if (form.recipientName) frags.push(`Recipient: ${form.recipientName}, position ${form.recipientPosition}.`);
    if (form.achievements) frags.push(`Highlight achievements: ${form.achievements}.`);
    if (form.skills) frags.push(`Include skills: ${form.skills}.`);
    if (form.qualities) frags.push(`Emphasize qualities: ${form.qualities}.`);
    if (['scholarship','graduate'].includes(form.letterType) && form.gpa) frags.push(`Applicant GPA: ${form.gpa}.`);
    if (form.letterType === 'immigration' && form.visaType) frags.push(`Visa type: ${form.visaType}.`);
    if (form.letterType === 'tenant' && form.rentalAddress) frags.push(`Rental property: ${form.rentalAddress}.`);
    if (form.letterType === 'medical' && form.residencySpecialty) frags.push(`Residency specialty: ${form.residencySpecialty}.`);
    frags.push(`Use a ${form.formality} and ${form.tone} tone. Creativity level: ${form.creativity}.`);

    const prompt = frags.join(' ');

    try {
      const res: any = await (generateGptResponse as any)({ prompt } as any);
      setDraft(res.text || '');
      if (isGuest) localStorage.setItem('guestUsed','1');
      setShowConfetti(true);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'NO_CREDITS') window.location.href = '/pricing?credits=0';
      else alert('Something went wrong.');
    } finally {
      setIsGenerating(false);
      scrollToTop();
    }
  };

  // Confetti cleanup
  useEffect(() => {
    if (showConfetti) {
      const t = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showConfetti]);

  return (
    <main ref={mainRef} className="mx-auto max-w-2xl p-8 bg-white dark:bg-gray-900 rounded-xl shadow-xl space-y-8">
      {showConfetti && <Confetti numberOfPieces={200} />}
      <h1 className="text-4xl font-extrabold text-center">Generate Recommendation Letter</h1>
      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div
          className="h-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 transition-all"
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {!draft ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Letter Basics */}
          {currentStep === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {LETTER_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, letterType: value }))}
                  className={`p-5 border rounded-2xl text-center transform transition hover:scale-105 focus:outline-none ${
                    form.letterType === value
                      ? 'border-blue-600 bg-blue-50 dark:bg-gray-800'
                      : 'border-gray-300 bg-white dark:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Recommender */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {['recName','recTitle','recOrg'].map((field,i) => (
                <div key={i}>
                  <label htmlFor={field} className="block font-semibold mb-2">
                    {field === 'recName' ? 'Recommender Name' : field === 'recTitle' ? 'Title / Position' : 'Organization'}
                  </label>
                  <input
                    id={field}
                    name={field}
                    value={(form as any)[field]}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="relationship" className="block font-semibold mb-2">Relationship</label>
                  <select
                    id="relationship"
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="manager">Manager / Supervisor</option>
                    <option value="professor">Professor / Advisor</option>
                    <option value="colleague">Colleague</option>
                    <option value="mentor">Mentor</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="knownTime" className="block font-semibold mb-2">Known Time</label>
                  <select
                    id="knownTime"
                    name="knownTime"
                    value={form.knownTime}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="lt1">Less than 1 year</option>
                    <option value="btw1and3">1–3 years</option>
                    <option value="gt3">More than 3 years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Applicant */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="applicantName" className="block font-semibold mb-2">Applicant Name</label>
                <input
                  id="applicantName"
                  name="applicantName"
                  value={form.applicantName}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {['achievements','skills','qualities'].map((field,i) => (
                <div key={i}>
                  <label htmlFor={field} className="block font-semibold mb-2 capitalize">
                    {field.replace(/([A-Z])/g,' $1')}
                  </label>
                  <textarea
                    id={field}
                    name={field}
                    rows={field==='achievements'?4:3}
                    value={(form as any)[field]}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 placeholder-gray-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Recipient & Extras */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="recipientName" className="block font-semibold mb-2">Recipient Name (optional)</label>
                <input
                  id="recipientName"
                  name="recipientName"
                  value={form.recipientName}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label htmlFor="recipientPosition" className="block font-semibold mb-2">Recipient Position (optional)</label>
                <input
                  id="recipientPosition"
                  name="recipientPosition"
                  value={form.recipientPosition}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {['scholarship', 'graduate'].includes(form.letterType) && (
                <div>
                  <label htmlFor="gpa" className="block font-semibold mb-2">Applicant GPA (optional)</label>
                  <input
                    id="gpa"
                    name="gpa"
                    value={form.gpa}
                    placeholder="e.g. 3.8/4.0"
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
              {form.letterType === 'immigration' && (
                <div>
                  <label htmlFor="visaType" className="block font-semibold mb-2">Visa Type (optional)</label>
                  <input
                    id="visaType"
                    name="visaType"
                    value={form.visaType}
                    placeholder="e.g. H-1B, O-1"
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
              {form.letterType === 'tenant' && (
                <div>
                  <label htmlFor="rentalAddress" className="block font-semibold mb-2">Rental Address (optional)</label>
                  <input
                    id="rentalAddress"
                    name="rentalAddress"
                    value={form.rentalAddress}
                    placeholder="Property address"
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
              {form.letterType === 'medical' && (
                <div>
                  <label htmlFor="residencySpecialty" className="block font-semibold mb-2">Residency Specialty (optional)</label>
                  <input
                    id="residencySpecialty"
                    name="residencySpecialty"
                    value={form.residencySpecialty}
                    placeholder="e.g. Internal Medicine"
                    onChange={handleChange}
                    className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Tone & Language */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="language" className="block font-semibold mb-2">Language</label>
                <select
                  id="language"
                  name="language"
                  value={form.language}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                >
                  <option value="english">English</option>
                  <option value="spanish">Spanish</option>
                </select>
              </div>
              <div>
                <label htmlFor="formality" className="block font-semibold mb-2">Formality</label>
                <select
                  id="formality"
                  name="formality"
                  value={form.formality}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                >
                  <option value="formal">Formal</option>
                  <option value="semiformal">Semi-formal</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div>
                <label htmlFor="tone" className="block font-semibold mb-2">Tone</label>
                <select
                  id="tone"
                  name="tone"
                  value={form.tone}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                >
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="confident">Confident</option>
                  <option value="professional">Professional</option>
                  <option value="sincere">Sincere</option>
                </select>
              </div>
              <div>
                <label htmlFor="creativity" className="block font-semibold mb-2">Creativity Level</label>
                <input
                  id="creativity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  name="creativity"
                  value={form.creativity}
                  onChange={handleChange}
                  className="w-full"
                />
                <div className="text-sm">Current: {form.creativity}</div>
              </div>
              <div className="flex justify-between space-x-4">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Previous
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isGenerating ? 'Generating...' : 'Generate Letter'}
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons (except for last step) */}
          {currentStep < 5 && (
            <div className="flex justify-between space-x-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 1}
                className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStepComplete()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Generated Letter</h2>
          <div className="whitespace-pre-wrap p-6 bg-gray-100 dark:bg-gray-800 rounded-lg" aria-live="polite">
            {draft}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => navigator.clipboard.writeText(draft)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => setDraft('')}
              className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </main>
  );
}