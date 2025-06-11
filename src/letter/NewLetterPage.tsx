import React, { useState, useRef, ChangeEvent, FormEvent, useEffect, FocusEvent } from 'react';
import { useAuth } from 'wasp/client/auth';
import { generateGptResponse, createFile } from 'wasp/client/operations';
import { BsCheckCircleFill } from 'react-icons/bs'; // check-mark icon
import Confetti from 'react-confetti';

// VARIABLES DE ENTORNO PARA S3
const S3_BUCKET = import.meta.env.VITE_S3_BUCKET as string
const S3_REGION = import.meta.env.VITE_S3_REGION as string

// Letter type options for Step 1
// Letter type options for Step 1 – organised + emoji + group tag
type LetterGroup = 'education' | 'professional' | 'personal';

const LETTER_TYPES: { value: string; label: string; group: LetterGroup }[] = [
  /* Education-related (blue) */
  { value: 'academic',   label: '🎓 Academic (University)',         group: 'education' },
  { value: 'scholarship',label: '🧑‍🏫 Scholarships & Aid', group: 'education' },
  { value: 'medical',    label: '🧑‍⚕️ Medical Residency',          group: 'education' },
  { value: 'internship', label: '📋 Internship', group: 'professional' },


  /* Professional-related (green) */
  { value: 'job',        label: '💼 Job / Employment',              group: 'professional' },
  { value: 'volunteer',  label: '🤝 Volunteer / NGO',               group: 'professional' },

  /* Personal / Legal (gray) */
  { value: 'immigration',label: '🛂 Immigration / Visa',            group: 'personal' },
  { value: 'tenant',     label: '🏠 Tenant / Landlord',             group: 'personal' },
  { value: 'personal',   label: '👤 Personal / Character',          group: 'personal' }
];


/* --- Colour maps for the three logical groups --- */
const GROUP_BG: Record<LetterGroup, string> = {
  education:    'bg-blue-50  dark:bg-blue-900/40',
  professional: 'bg-green-50 dark:bg-green-900/40',
  personal:     'bg-gray-50  dark:bg-gray-800/50'
};

const GROUP_BORDER: Record<'education' | 'professional' | 'personal', string> = {
  education:    'border-blue-600',
  professional: 'border-green-600',
  personal:     'border-gray-600'
};
const GROUP_RING: Record<LetterGroup, string> = {
  education:    'ring-blue-400/70',
  professional: 'ring-green-400/70',
  personal:     'ring-gray-400/70'
};



export default function NewLetterPage() {
  const { data: user } = useAuth();
  const isGuest = !user;
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => mainRef.current?.scrollIntoView({ behavior: 'smooth' });

  const totalSteps = 5;
  const [currentStep, setCurrentStep] = useState(1);

  const initialForm = {
    // Step 1
    letterType: 'academic',
  
    // Step 2 (Recommender)
    recName: '',
    recLastName: '',
    recTitle: '',
    recOrg: '',
    recAddress: '',
  
    relationship: 'manager',
    relationshipOther: '',       // ← new field for “Other”
    knownTime: 'lt6m',
  
    // Step 3 (Applicant)
    applicantFirstName: '',
    applicantLastName: '',
    applicantPosition: '',     // ← new “Position/Program” field

    // Step 3 optional extras
    skillsAndQualities: '',     // ← single box for Skills / Qualities / Achievements

  
    // Step 4 (Recipient + conditional)
    recipientName: '',
    recipientPosition: '',
    gpa: '',
    visaType: '',
    rentalAddress: '',
    residencySpecialty: '',
  
    // Step 5
    language: 'english',
    formality: 'formal',
    tone: 'enthusiastic',
    creativity: '0.5',
  
    // File upload
    file: null as File | null,
  };
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fileError, setFileError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const KNOWN_TIMES: Record<string, string> = {
    lt6m:   'less than 6 months',
    btw6m1y:'6 months to 1 year',
    btw1y2y:'1 to 2 years',
    btw2y5y:'2 to 5 years',
    gt5y:   'more than 5 years',
  };

  const getProgress = () => (currentStep / totalSteps) * 100;

  const isStepComplete = () => {
    switch (currentStep) {
      case 1:
        return Boolean(form.letterType);
      case 2:
      // require the “Other” text if they picked Other
        return Boolean(
          form.recName &&
          form.recLastName &&
          form.recTitle &&
          form.recOrg &&
          (form.relationship !== 'other' || form.relationshipOther.trim() !== '')
        );

      case 3:
        return Boolean(
          form.applicantFirstName.trim() &&
          form.applicantLastName.trim()
        );
      default:
        return true;
    }
  };

  const handleNext = () => {
    setTouched({});
    if (!isStepComplete()) {
      if (currentStep === 2) setTouched({
        recName: true,
        recLastName: true,
        recTitle: true,
        recOrg: true,
        relationshipOther: form.relationship === 'other' ? true : false,
      });
      
      if (currentStep === 3) setTouched({ applicantFirstName: true,
        applicantLastName: true
        });
        
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
      scrollToTop();
    }
  };

  const handlePrev = () => {
    setTouched({});
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      scrollToTop();
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, type, value } = e.target as HTMLInputElement;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleBlur = (
    e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
  };

  const validateFile = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type)) {
      setFileError('Only PDF or DOCX files up to 5 MB are allowed.');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size should be less than 5 MB.');
      return false;
    }
    setFileError('');
    return true;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && validateFile(file)) {
      setForm((f) => ({ ...f, file }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      setForm((f) => ({ ...f, file }));
    }
  };

  const handleFileRemove = () => {
    setForm((f) => ({ ...f, file: null }));
    setFileError('');
  };
  // por encima de handleSubmit

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Si es guest y ya usó su free letter:
    if (isGuest && localStorage.getItem('guestUsed')) {
      window.location.href = '/login';
      return;
    }
  
    setErrorMsg('');
    setFileError('');
    setIsGenerating(true);
  
    let fileKey: string | undefined;
    // 1) Subir archivo si existe
    if (form.file) {
      try {
        // 1.1) Pedir URL firmada /// AQUIIIIII
        // 1.1) Pedir URL firmada (con los nombres correctos)
const { s3UploadUrl, s3UploadFields } = await createFile({
  fileName: form.file.name,
  // casteo para ajustarse al union type de TS
  fileType: form.file.type as any,
});

// 1.2) Construir FormData y subir a S3
const data = new FormData();
Object.entries(s3UploadFields).forEach(([k, v]) => data.append(k, v));
data.append('file', form.file);
const uploadRes = await fetch(s3UploadUrl, {
  method: 'POST',
  body: data,
});
if (!uploadRes.ok) throw new Error('Upload failed');

// 1.3) Guardar la key para usarla en el prompt
fileKey = s3UploadFields.key;
        // opcional: si usas setUploadPct, podrías implementarlo con XHR
        //// AQUIIII
      } catch (err) {
        console.error(err);
        setFileError('Error uploading file. Please try again.');
        setIsGenerating(false);
        return;
      }
    }
  
    // 2) Construir prompt
    const frags: string[] = [];
    frags.push(
      `Write a ${form.letterType} recommendation letter in ${
        form.language === 'spanish' ? 'Spanish' : 'English'
      }.`
    );
// build full name + optional address
const recFullName = `${form.recName} ${form.recLastName}`.trim();
// decide which relationship text to show
const relationText =
  form.relationship === 'other'
    ? form.relationshipOther.trim()
    : ({
        manager: 'Manager / Supervisor',
        professor: 'Professor / Academic Advisor',
        colleague: 'Coworker / Colleague',
        mentor: 'Mentor / Coach',
      }[form.relationship] || form.relationship);

// build the full recommender line
frags.push(
  `Recommender: ${recFullName}, ${form.recTitle} at ${form.recOrg}` +
    (form.recAddress ? `, Address: ${form.recAddress}` : '') +
    `, Relationship: ${relationText}, known for ${KNOWN_TIMES[form.knownTime]}.`
);


  const applicantFullName = `${form.applicantFirstName} ${form.applicantLastName}`.trim();
  frags.push(
    `Applicant: ${applicantFullName}` +
      (form.applicantPosition
        ? `, applying for ${form.applicantPosition}`
        : '') +
      '.'
  );
  if (form.skillsAndQualities.trim()) {
    frags.push(`Key skills, qualities & achievements: ${form.skillsAndQualities.trim()}.`);
  }

    // Si quisieras incluir enlace al doc:
    if (fileKey) {
      frags.push(
        `Supporting document: https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${fileKey}`
      );
    }
    frags.push(`Use a ${form.formality} and ${form.tone} tone. Creativity level: ${form.creativity}.`);
  
    const prompt = frags.join(' ');
  
    // 3) Invocar GPT
    try {
      const res: any = await generateGptResponse({ prompt });
      setDraft(res.text || '');
      if (isGuest) localStorage.setItem('guestUsed', '1');
      setShowConfetti(true);
      setSuccessMsg('Your letter is ready!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'NO_CREDITS') window.location.href = '/pricing?credits=0';
      else setErrorMsg('Oops! Something went wrong. Please try again or contact support.');
    } finally {
      setIsGenerating(false);
      scrollToTop();
    }
  };
  

  useEffect(() => {
    if (showConfetti) {
      const t = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showConfetti]);

  return (
    <main
      ref={mainRef}
          className="mx-auto w-full max-w-3xl sm:max-w-4xl px-4 sm:px-6 md:px-8 py-8 sm:py-10
           bg-white dark:bg-gray-800 rounded-2xl shadow-xl space-y-6 mt-6"
    >
      {showConfetti && <Confetti numberOfPieces={200} />}
      {successMsg && (
        <div className="fixed top-5 right-5 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-md">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {errorMsg}
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-center text-gray-900 dark:text-gray-100">
        Generate <span className="text-yellow-500">Recommendation Letter</span>
      </h1>

     

      <div className="mt-4 text-lg font-medium text-center">
        Step {currentStep} of {totalSteps}
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
        <div
          className="h-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 transition-all"
          style={{ width: `${getProgress()}%` }}
        />
      </div>
      {/* helper sentence – only on Step 1 */}
        {currentStep === 1 && (
          <p className="my-13 text-lg font-medium text-center text-gray-700 dark:text-gray-300">
            Select your Recommendation Letter type:
          </p>
        )}


      {!draft ? (
        <form onSubmit={handleSubmit} className="space-y-10">
      {/* Step 1: Letter Basics */}
      {currentStep === 1 && (
        <div className="space-y-8">
          {['education', 'professional', 'personal'].map((grp) => {
            const g = grp as LetterGroup;

            return (
              /* ➜ Grid responsiva: 1 col móvil, 2 col ≥640 px, 3 col ≥1024 px */
              <div key={g} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {LETTER_TYPES.filter((t) => t.group === g).map(({ value, label, group }) => {
                  const isActive = form.letterType === value;
                  const g2 = group as LetterGroup;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, letterType: value }))}
                      /* w-full para ocupar la celda completa, padding y texto responsivos */
                      className={`relative w-full rounded-2xl font-medium transition ring-offset-2 focus:outline-none
                        px-4 py-3 text-sm
                        sm:px-5 sm:py-4 sm:text-base
                        lg:px-6 lg:py-5 lg:text-lg
                        ${isActive
                          ? `${GROUP_BG[g2]} ${GROUP_BORDER[g2]} ring-4 ${GROUP_RING[g2]} shadow-md`
                          : `border border-gray-300 ${GROUP_BG[g2]} hover:scale-[1.03]`
                        }`}
                    >
                      {isActive && (
                        <BsCheckCircleFill className="absolute top-2 right-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}



          {/* Step 2: Recommender */}
          {currentStep === 2 && (
            <div className="grid gap-8">
              {/* First + Last Name side by side */}
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <label
                    htmlFor="recName"
                    className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2"
                  >
                    Recommender First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="recName"
                    name="recName"
                    value={form.recName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoFocus
                    placeholder="e.g., Jane"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                  {touched.recName && !form.recName && (
                    <p className="text-red-500 text-sm mt-1">
                      Please enter the recommender's first name.
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="recLastName"
                    className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2"
                  >
                    Recommender Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="recLastName"
                    name="recLastName"
                    value={form.recLastName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g., Doe"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                  {touched.recLastName && !form.recLastName && (
                    <p className="text-red-500 text-sm mt-1">
                      Please enter the recommender's last name.
                    </p>
                  )}
                </div>
              </div>

              {/* Title / Position + Organization side by side */}
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <label
                    htmlFor="recTitle"
                    className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2"
                  >
                    Title / Position <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="recTitle"
                    name="recTitle"
                    value={form.recTitle}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g., Senior Manager"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                  {touched.recTitle && !form.recTitle && (
                    <p className="text-red-500 text-sm mt-1">
                      Please enter the recommender's title.
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="recOrg"
                    className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2"
                  >
                    Organization <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="recOrg"
                    name="recOrg"
                    value={form.recOrg}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g., Acme Corp"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                  {touched.recOrg && !form.recOrg && (
                    <p className="text-red-500 text-sm mt-1">
                      Please enter the organization.
                    </p>
                  )}
                </div>
              </div>

              {/* New: Recommender Address */}
              <div>
                <label
                  htmlFor="recAddress"
                  className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2"
                >
                  Recommender Address (optional)
                </label>
                <input
                  id="recAddress"
                  name="recAddress"
                  value={form.recAddress}
                  onChange={handleChange}
                  placeholder="e.g., 123 Main St, City"
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Relationship + Known Time */}
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <label htmlFor="relationship" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Relationship
                  </label>
                  <select
                    id="relationship"
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  >
                      <option value="manager">Manager / Supervisor</option>
                      <option value="professor">Professor / Academic Advisor</option>
                      <option value="colleague">Coworker / Colleague</option>
                      <option value="mentor">Mentor / Coach</option>
                      <option value="other">Other </option>
                  </select>
                  {form.relationship === 'other' && (
                  <div>
                    <label
                      htmlFor="relationshipOther"
                      className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2"
                    >
                      Please specify Relationship <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="relationshipOther"
                      name="relationshipOther"
                      value={form.relationshipOther}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., Team Lead, Research Partner"
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                    />
                    {touched.relationshipOther && !form.relationshipOther.trim() && (
                      <p className="text-red-500 text-sm mt-1">
                        Please describe your relationship.
                      </p>
                    )}
                  </div>
                )}
                </div>
                <div>
                  <label htmlFor="knownTime" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Known Time
                  </label>
                  <select
                    id="knownTime"
                    name="knownTime"
                    value={form.knownTime}
                    onChange={handleChange}
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="lt6m">Less than 6 months</option>
                    <option value="btw6m1y">6 months to 1 year</option>
                    <option value="btw1y2y">1 to 2 years</option>
                    <option value="btw2y5y">2 to 5 years</option>
                    <option value="gt5y">More than 5 years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

            {currentStep === 3 && (
              <div className="grid gap-8">
                {/* First + Last Name side by side */}
                <div className="md:grid md:grid-cols-2 md:gap-8">
                  <div>
                    <label htmlFor="applicantFirstName" className="block text-lg font-semibold mb-2">
                      Applicant First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="applicantFirstName"
                      name="applicantFirstName"
                      value={form.applicantFirstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., John"
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                    />
                    {touched.applicantFirstName && !form.applicantFirstName.trim() && (
                      <p className="text-red-500 text-sm mt-1">Please enter the applicant's first name.</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="applicantLastName" className="block text-lg font-semibold mb-2">
                      Applicant Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="applicantLastName"
                      name="applicantLastName"
                      value={form.applicantLastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., Smith"
                      className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                    />
                    {touched.applicantLastName && !form.applicantLastName.trim() && (
                      <p className="text-red-500 text-sm mt-1">Please enter the applicant's last name.</p>
                    )}
                  </div>
                </div>

                {/* Position / Program (optional) */}
                <div>
                  <label htmlFor="applicantPosition" className="block text-lg font-semibold mb-2">
                    Position /  Program Applying To (optional)
                  </label>
                  <input
                    id="applicantPosition"
                    name="applicantPosition"
                    value={form.applicantPosition}
                    onChange={handleChange}
                    placeholder="e.g., MBA Program, Software Engineer Role"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Skills + Qualities combined */}
                <div>
                <label htmlFor="skillsAndQualities" className="block text-lg font-semibold mb-2">
                Skills / Qualities / Achievements (optional)
                </label>
                  <textarea
                    id="skillsAndQualities"
                    name="skillsAndQualities"
                    rows={4}
                    value={form.skillsAndQualities}
                    onChange={handleChange}
                    placeholder="e.g., Project management; Attention to detail; Leadership; Award-winning project"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            )}

          {/* Step 4: Recipient & Conditional Fields */}
          {currentStep === 4 && (
            <div className="grid gap-8">
              <div>
                <label htmlFor="recipientName" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Recipient Name (optional)
                </label>
                <input
                  id="recipientName"
                  name="recipientName"
                  value={form.recipientName}
                  onChange={handleChange}
                  placeholder="e.g., Admissions Committee"
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label htmlFor="recipientPosition" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Recipient Position (optional)
                </label>
                <input
                  id="recipientPosition"
                  name="recipientPosition"
                  value={form.recipientPosition}
                  onChange={handleChange}
                  placeholder="e.g., Dean of Admissions"
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {['scholarship'].includes(form.letterType) && (
                <div>
                  <label htmlFor="gpa" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Applicant GPA (optional)
                  </label>
                  <input
                    id="gpa"
                    name="gpa"
                    value={form.gpa}
                    onChange={handleChange}
                    placeholder="e.g., 3.8/4.0"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
              {form.letterType === 'immigration' && (
                <div>
                  <label htmlFor="visaType" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Visa Type (optional)
                  </label>
                  <input
                    id="visaType"
                    name="visaType"
                    value={form.visaType}
                    onChange={handleChange}
                    placeholder="e.g., H-1B"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
              {form.letterType === 'tenant' && (
                <div>
                  <label htmlFor="rentalAddress" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Rental Address (optional)
                  </label>
                  <input
                    id="rentalAddress"
                    name="rentalAddress"
                    value={form.rentalAddress}
                    onChange={handleChange}
                    placeholder="e.g., 123 Main St, City"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
              {form.letterType === 'medical' && (
                <div>
                  <label htmlFor="residencySpecialty" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Residency Specialty (optional)
                  </label>
                  <input
                    id="residencySpecialty"
                    name="residencySpecialty"
                    value={form.residencySpecialty}
                    onChange={handleChange}
                    placeholder="e.g., Internal Medicine"
                    className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Tone & Generate */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Language, Formality, Tone, Creativity */}
              <div>
                <label htmlFor="language" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Language
                </label>
                <select
                  id="language"
                  name="language"
                  value={form.language}
                  onChange={handleChange}
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                >
                  <option value="english">English</option>
                  <option value="spanish">Spanish</option>
                </select>
              </div>

              <div>
                <label htmlFor="formality" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Formality
                </label>
                <select
                  id="formality"
                  name="formality"
                  value={form.formality}
                  onChange={handleChange}
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                >
                  <option value="formal">Formal</option>
                  <option value="semiformal">Semi-formal</option>
                  <option value="casual">Casual</option>
                </select>
              </div>

              <div>
                <label htmlFor="tone" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Tone
                </label>
                <select
                  id="tone"
                  name="tone"
                  value={form.tone}
                  onChange={handleChange}
                  className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400"
                >
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="confident">Confident</option>
                  <option value="professional">Professional</option>
                  <option value="sincere">Sincere</option>
                </select>
              </div>

              <div>
                <label htmlFor="creativity" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Creativity Level
                </label>
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

              {/* File Upload with drag-and-drop */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Upload Supporting Document (optional)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition ${
                    dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white dark:bg-gray-700'
                  }`}
                >
                  {!form.file ? (
                    <p className="text-gray-500 dark:text-gray-400">Drag & drop PDF/DOCX here, or click to browse</p>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <p className="text-gray-900 dark:text-gray-100">
                        {form.file.name} ({(form.file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                      <button type="button" onClick={handleFileRemove} className="text-red-500 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                {fileError && <p className="text-red-500 text-sm mt-1">{fileError}</p>}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  *Remember you get one free letter per month, if you need more, you can buy credits.
                </p>
              </div>

              {/* Navigation */}
              <div className="flex space-x-4">
                <button 
                  type="button" 
                  onClick={handlePrev} 
                  className="flex-1 py-4 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600"
                >
                  Previous
                </button>
                <button 
                  type="submit" 
                  disabled={isGenerating} 
                  className="flex-1 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {isGenerating ? 'Generating...' : 'Generate Letter'}
                </button>
              </div>
            </div>
          )}

          {/* Navigation for steps 1-4 */}
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
        /* Draft view */
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Generated Letter</h2>
          <div className="whitespace-pre-wrap p-6 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {draft}
          </div>
          <div className="flex space-x-4">
            <button 
              onClick={() => navigator.clipboard.writeText(draft)} 
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Copy to Clipboard
            </button>
            <button 
              onClick={() => setDraft('')} 
              className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
