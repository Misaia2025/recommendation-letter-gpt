import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { useAuth } from 'wasp/client/auth';
import { generateGptResponse } from 'wasp/client/operations';

export default function NewLetterPage() {
  const { data: user } = useAuth();
  const isGuest = !user;

  // ---------------------------------------------------------------------------
  // Form state and navigation
  // ---------------------------------------------------------------------------
  const initialFormState = {
    /* Step 1 */
    letterType: 'academic',

    /* Step 2 – Recommender */
    recName: '',
    recTitle: '',
    recOrg: '',
    relationship: 'manager',
    knownTime: 'lt1',

    /* Step 3 – Applicant */
    applicantName: '',
    achievements: '',
    skills: '',
    qualities: '',

    /* Step 4 – Recipient + extras */
    recipientName: '',
    recipientPosition: '',
    gpa: '',
    visaType: '',
    rentalAddress: '',
    residencySpecialty: '',

    /* Step 5 – Tone & style */
    language: 'english',
    formality: 'formal',
    tone: 'enthusiastic',
    creativity: '0.5',

    /* Step 6 – Advanced */
    addAnecdote: false,
    addMetrics: false,
    context: '',
  };

  const [form, setForm] = useState(initialFormState);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => mainRef.current?.scrollIntoView({ behavior: 'smooth' });

  const isCurrentStepComplete = () => {
    switch (currentStep) {
      case 1:
        return !!form.letterType;
      case 2:
        return form.recName && form.recTitle && form.recOrg;
      case 3:
        return !!form.applicantName;
      default:
        return true;
    }
  };

  const getProgress = () => (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (isCurrentStepComplete() && currentStep < totalSteps) {
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // ---------------------------------------------------------------------------
  // Submit and prompt building
  // ---------------------------------------------------------------------------
  const KNOWN_TIMES: Record<string, string> = {
    lt1: 'less than 1 year',
    btw1and3: 'between 1 and 3 years',
    gt3: 'more than 3 years',
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isGuest && localStorage.getItem('guestUsed')) {
      window.location.href = '/login';
      return;
    }

    setIsGenerating(true);
    const timeText = KNOWN_TIMES[form.knownTime] || form.knownTime;

    let prompt = `Write a ${form.letterType} recommendation letter in ${
      form.language === 'spanish' ? 'Spanish' : 'English'
    }.`;
    prompt += ` Recommender: ${form.recName}, ${form.recTitle} at ${form.recOrg}, known for ${timeText}.`;
    prompt += ` Applicant: ${form.applicantName}.`;

    if (form.recipientName) prompt += ` Recipient: ${form.recipientName}, position ${form.recipientPosition}.`;
    if (form.achievements) prompt += ` Highlight achievements: ${form.achievements}.`;
    if (form.skills) prompt += ` Include skills: ${form.skills}.`;
    if (form.qualities) prompt += ` Emphasize qualities: ${form.qualities}.`;

    // Conditional extras
    if (['scholarship', 'graduate'].includes(form.letterType) && form.gpa) {
      prompt += ` Applicant GPA: ${form.gpa}.`;
    }
    if (form.letterType === 'immigration' && form.visaType) {
      prompt += ` Visa type: ${form.visaType}.`;
    }
    if (form.letterType === 'tenant' && form.rentalAddress) {
      prompt += ` Rental property: ${form.rentalAddress}.`;
    }
    if (form.letterType === 'medical' && form.residencySpecialty) {
      prompt += ` Residency specialty: ${form.residencySpecialty}.`;
    }

    prompt += ` Use a ${form.formality} and ${form.tone} tone. Creativity level: ${form.creativity}.`;
    if (form.addAnecdote) prompt += ` Include a specific anecdote.`;
    if (form.addMetrics) prompt += ` Include quantitative metrics.`;
    if (form.context) prompt += ` Additional context: ${form.context}.`;

    try {
      const res: any = await (generateGptResponse as any)({ prompt } as any);
      setDraft(res.text || '');
      if (isGuest) localStorage.setItem('guestUsed', '1');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'NO_CREDITS') window.location.href = '/pricing?credits=0';
      else alert('Something went wrong.');
    } finally {
      setIsGenerating(false);
      scrollToTop();
    }
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const inputClass =
    "w-full rounded px-3 py-2 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 " +
    "dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400";

  return (
    <main ref={mainRef} className="mx-auto max-w-xl py-20 px-6 space-y-8 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold">Generate Recommendation Letter</h1>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
        <div
          className="h-2 bg-blue-600 dark:bg-purple-500 transition-all"
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {!draft && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1 */}
          {currentStep === 1 && (
            <div className="space-y-2">
              <label className="block font-medium">1. Letter Type</label>
              <select
                name="letterType"
                value={form.letterType}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="academic">Academic (University Admission)</option>
                <option value="graduate">Graduate School</option>
                <option value="job">Job / Employment</option>
                <option value="internship">Internship</option>
                <option value="scholarship">Scholarship / Financial Aid</option>
                <option value="immigration">Immigration / Visa</option>
                <option value="medical">Medical Residency</option>
                <option value="volunteer">Volunteer / NGO</option>
                <option value="tenant">Tenant / Landlord Reference</option>
                <option value="personal">Personal / Character Reference</option>
              </select>
            </div>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium">Recommender Name</label>
                <input
                  name="recName"
                  placeholder="e.g. Jane Doe"
                  value={form.recName}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-medium">Title / Position</label>
                <input
                  name="recTitle"
                  placeholder="e.g. Senior Manager"
                  value={form.recTitle}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-medium">Organization</label>
                <input
                  name="recOrg"
                  placeholder="e.g. Acme Corp"
                  value={form.recOrg}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium">Relationship</label>
                  <select
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="manager">Manager / Supervisor</option>
                    <option value="professor">Professor / Advisor</option>
                    <option value="colleague">Colleague</option>
                    <option value="mentor">Mentor</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium">Known Time</label>
                  <select
                    name="knownTime"
                    value={form.knownTime}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="lt1">Less than 1 year</option>
                    <option value="btw1and3">1–3 years</option>
                    <option value="gt3">More than 3 years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium">Applicant Name</label>
                <input
                  name="applicantName"
                  placeholder="Full name of applicant"
                  value={form.applicantName}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-medium">Achievements (optional)</label>
                <textarea
                  name="achievements"
                  placeholder="One per line"
                  value={form.achievements}
                  onChange={handleChange}
                  className={inputClass}
                  rows={3}
                />
              </div>
              <div>
                <label className="block font-medium">Skills (optional)</label>
                <textarea
                  name="skills"
                  placeholder="Comma separated"
                  value={form.skills}
                  onChange={handleChange}
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div>
                <label className="block font-medium">Qualities (optional)</label>
                <textarea
                  name="qualities"
                  placeholder="Describe qualities"
                  value={form.qualities}
                  onChange={handleChange}
                  className={inputClass}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 4 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium">Recipient Name (optional)</label>
                <input
                  name="recipientName"
                  placeholder="Who receives this letter?"
                  value={form.recipientName}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-medium">Recipient Position (optional)</label>
                <input
                  name="recipientPosition"
                  placeholder="Their title or role"
                  value={form.recipientPosition}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              {/* Conditional extras */}
              {['scholarship', 'graduate'].includes(form.letterType) && (
                <div>
                  <label className="block font-medium">Applicant GPA (optional)</label>
                  <input
                    name="gpa"
                    placeholder="e.g. 3.8/4.0"
                    value={form.gpa}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              )}
              {form.letterType === 'immigration' && (
                <div>
                  <label className="block font-medium">Visa Type</label>
                  <input
                    name="visaType"
                    placeholder="e.g. H-1B, O-1"
                    value={form.visaType}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              )}
              {form.letterType === 'tenant' && (
                <div>
                  <label className="block font-medium">Rental Address</label>
                  <input
                    name="rentalAddress"
                    placeholder="Property address"
                    value={form.rentalAddress}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              )}
              {form.letterType === 'medical' && (
                <div>
                  <label className="block font-medium">Residency Specialty</label>
                  <input
                    name="residencySpecialty"
                    placeholder="e.g. Internal Medicine"
                    value={form.residencySpecialty}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5 */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium">Language</label>
                <select
                  name="language"
                  value={form.language}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="english">English</option>
                  <option value="spanish">Spanish</option>
                </select>
              </div>
              <div>
                <label className="block font-medium">Formality</label>
                <select
                  name="formality"
                  value={form.formality}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="formal">Formal</option>
                  <option value="semiformal">Semi-formal</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div>
                <label className="block font-medium">Tone</label>
                <select
                  name="tone"
                  value={form.tone}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="confident">Confident</option>
                  <option value="professional">Professional</option>
                  <option value="sincere">Sincere</option>
                </select>
              </div>
              <div>
                <label className="block font-medium">Creativity Level</label>
                <select
                  name="creativity"
                  value={form.creativity}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="0.2">Conservative</option>
                  <option value="0.5">Balanced</option>
                  <option value="0.8">Creative</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 6 */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium">
                  <input
                    type="checkbox"
                    name="addAnecdote"
                    checked={form.addAnecdote}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  Include a specific anecdote
                </label>
              </div>
              <div>
                <label className="block font-medium">
                  <input
                    type="checkbox"
                    name="addMetrics"
                    checked={form.addMetrics}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  Include quantitative metrics
                </label>
              </div>
              <div>
                <label className="block font-medium">Additional Context (optional)</label>
                <textarea
                  name="context"
                  placeholder="Any other details to include..."
                  value={form.context}
                  onChange={handleChange}
                  className={inputClass}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className={`px-4 py-2 rounded ${
                currentStep === 1
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              Previous
            </button>
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!isCurrentStepComplete()}
                className={`px-4 py-2 rounded ${
                  !isCurrentStepComplete()
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isGenerating}
                className={`px-4 py-2 rounded ${
                  isGenerating
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                {isGenerating ? 'Generating...' : 'Generate Letter'}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Generated Letter */}
      {draft && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Generated Letter</h2>
          <div className="whitespace-pre-wrap p-4 bg-gray-100 dark:bg-gray-800 rounded">
            {draft}
          </div>
          <button
            onClick={() => setDraft('')}
            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
          >
            Generate Another
          </button>
        </div>
      )}
    </main>
  );
}
