/*  NewLetterPage.tsx ─ REFACTORED 2025-06-11
    – Re-implements Step 5 with richer personalisation controls
    – Keeps previous wizard flow and generateGptResponse wiring intact              */

    import React, {
      useState, useRef, useEffect, ChangeEvent, FormEvent, FocusEvent,
    } from 'react';    
    import { useAuth } from 'wasp/client/auth';
    import { generateGptResponse, createFile } from 'wasp/client/operations';
    import { BsCheckCircleFill } from 'react-icons/bs';
    import { HiMiniDocumentText, HiMiniSparkles, HiMiniArrowLeft, HiMiniChevronDown } from 'react-icons/hi2';
    import { Switch, Listbox } from '@headlessui/react';
    import Confetti from 'react-confetti';
    import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
    import { saveAs } from 'file-saver';
    
    
    /* ------------------------------------------------------------------ */
    /*  CONSTANTS & ENUM-LIKE MAPS                                         */
    /* ------------------------------------------------------------------ */
    
    // 💌 Letter types (unchanged)
    type LetterGroup = 'education' | 'professional' | 'personal';
    const LETTER_TYPES: { value: string; label: string; group: LetterGroup }[] = [
      { value: 'academic',   label: '🎓 Academic (University)', group: 'education' },
      { value: 'scholarship',label: '🧑‍🏫 Scholarships & Aid',  group: 'education' },
      { value: 'medical',    label: '🧑‍⚕️ Medical Residency',   group: 'education' },
      { value: 'internship', label: '📋 Internship',            group: 'professional' },
      { value: 'job',        label: '💼 Job / Employment',       group: 'professional' },
      { value: 'volunteer',  label: '🤝 Volunteer / NGO',        group: 'professional' },
      { value: 'immigration',label: '🛂 Immigration / Visa',     group: 'personal' },
      { value: 'tenant',     label: '🏠 Tenant / Landlord',      group: 'personal' },
      { value: 'personal',   label: '👤 Personal / Character',   group: 'personal' },
    ];
    
    // Colour helpers for the grid buttons
    const GROUP_BG: Record<LetterGroup, string> = {
      education:    'bg-blue-50 dark:bg-blue-900/40',
      professional: 'bg-green-50 dark:bg-green-900/40',
      personal:     'bg-gray-50 dark:bg-gray-800/50',
    };
    const GROUP_BORDER: Record<LetterGroup, string> = {
      education:    'border-blue-600',
      professional: 'border-green-600',
      personal:     'border-gray-600',
    };
    const GROUP_RING: Record<LetterGroup, string> = {
      education:    'ring-blue-400/70',
      professional: 'ring-green-400/70',
      personal:     'ring-gray-400/70',
    };
    
    // Step-5 preset lists
    const TONE_PRESETS = ['Neutral', 'Enthusiastic', 'Persuasive', 'Objective'] as const;
    const OPENING_STYLES = [ 'Direct praise','Quote', 'Problem-solution'] as const;
    const PERSPECTIVES = [
      { id: 'first',  label: 'First-person (“I”)' },
      { id: 'inst',   label: 'Institutional (“We”)' },
    ] as const;
    const WRITING_STYLE_TAGS = ['Executive', 'Bullet-points','Storytelling' ] as const;
    
    // S3 vars (unchanged)
    const S3_BUCKET = import.meta.env.VITE_S3_BUCKET as string;
    const S3_REGION = import.meta.env.VITE_S3_REGION as string;
    
    /* ------------------------------------------------------------------ */
    /*  MAIN COMPONENT                                                     */
    /* ------------------------------------------------------------------ */
    
    export default function NewLetterPage() {
      /* ——————————————————————————————————— Refs & Auth */
      const { data: user } = useAuth();
      const isGuest = !user;
      const mainRef = useRef<HTMLDivElement>(null);
      const fileInputRef = useRef<HTMLInputElement>(null);
      const scrollToTop = () => mainRef.current?.scrollIntoView({ behavior: 'smooth' });
    
      /* ——————————————————————————————————— Wizard state */
      const totalSteps = 5;
      const [currentStep, setCurrentStep] = useState(1);
      const [touched, setTouched] = useState<Record<string, boolean>>({});
      const [copied, setCopied] = useState(false);
    
      /* ——————————————————————————————————— Form state (NEW FIELDS inside) */
      const initialForm = {
        /* Step 1 */
        letterType: 'academic',
    
        /* Step 2 – Recommender */
        recName: '', recLastName: '', recTitle: '', recOrg: '', recAddress: '',
        relationship: 'manager', relationshipOther: '', knownTime: 'lt6m',
    
        /* Step 3 – Applicant */
        applicantFirstName: '', applicantLastName: '', applicantPosition: '',
        skillsAndQualities: '',
    
        /* Step 4 – Recipient / Conditional */
        recipientName: '', recipientPosition: '', gpa: '', visaType: '',
        rentalAddress: '', residencySpecialty: '',
    
        /* Step 5 – ✨ Personalisation (all new) */
        writingStyle: 'Executive',
        language: 'english',
        formality: 0 as 0|1|2,                             // 0 casual → 2 formal
        tonePreset: 'Neutral' as typeof TONE_PRESETS[number],
        lengthWords: 300,
        includeAnecdote: false,
        includeMetrics: false,
        openingStyle: 'Direct praise' as typeof OPENING_STYLES[number],
        perspective: 'first' as 'first'|'inst',
        styleTags: [] as string[],                         // multi-select chips
        creativity: 0.5,
        grammarCheck: false,
        
    
        /* Attachment */
        file: null as File | null,
      };
      const [form, setForm] = useState(initialForm);
    
      /* ——————————————————————————————————— Letter generation */
      const [draft, setDraft] = useState('');
      const [isGenerating, setIsGenerating] = useState(false);
      const [showConfetti, setShowConfetti] = useState(false);
      useEffect(() => {
        if (showConfetti) {
          // Apaga el confeti después de 3 segundos
          const timer = setTimeout(() => setShowConfetti(false), 3000);
          return () => clearTimeout(timer);
        }
      }, [showConfetti]);
      
      const [errorMsg, setErrorMsg] = useState('');
      const [successMsg, setSuccessMsg] = useState('');
      const [fileError, setFileError] = useState('');
      const [dragActive, setDragActive] = useState(false);
    
      /* ——————————————————————————————————— MISC CONSTANTS */
      const KNOWN_TIMES: Record<string, string> = {
        lt6m: 'less than 6 months',
        btw6m1y: '6 months – 1 year',
        btw1y2y: '1 – 2 years',
        btw2y5y: '2 – 5 years',
        gt5y: 'more than 5 years',
      };
      const MIN_LEN = 150; const MAX_LEN = 800; const STEP_LEN = 10;
    
      /* ------------------------------------------------------------------ */
      /*  HANDLERS                                                          */
      /* ------------------------------------------------------------------ */
    
      // Generic change (for <input>, <select>)
      const handleChange = (e:
        ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const parsed = type === 'range' ? Number(value) : value;
        setForm(f => ({ ...f, [name]: parsed }));
      };
    
      const handleBlur = (
        e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      ) => {
        const { name } = e.target;
        setTouched(t => ({ ...t, [name]: true }));
      };
    
      // ——— Toggle helpers
      const toggleBoolean = (key: keyof typeof initialForm) =>
        setForm(f => ({ ...f, [key]: !f[key] }));
    
      // ——— Chips multiselect
      const toggleStyleTag = (tag: string) => {
        setForm(f => ({
          ...f,
          styleTags: f.styleTags.includes(tag)
            ? f.styleTags.filter(t => t !== tag)
            : [...f.styleTags, tag],
        }));
      };
    
      /* ------------------ File support (unchanged except setForm path) */
      const validateFile = (file: File) => {
        const okTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!okTypes.includes(file.type)) { setFileError('Only PDF or DOCX up to 5 MB'); return false; }
        if (file.size > 5 * 1024 * 1024) { setFileError('File > 5 MB'); return false; }
        setFileError(''); return true;
      };
      const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file && validateFile(file)) setForm(f => ({ ...f, file }));
      };
      const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
      const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); };
      const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file && validateFile(file)) setForm(f => ({ ...f, file }));
      };
      const handleFileRemove = () => setForm(f => ({ ...f, file: null }));
    
      /* ------------------ Wizard navigation (Step 1-4 remain unchanged) */
      const isStep1Ok = Boolean(form.letterType);
      const isStep2Ok = Boolean(
        form.recName && form.recLastName && form.recTitle && form.recOrg &&
        (form.relationship !== 'other' || form.relationshipOther.trim())
      );
      const isStep3Ok = Boolean(form.applicantFirstName.trim() && form.applicantLastName.trim());
    
      const isStepComplete = () => {
        switch (currentStep) {
          case 1: return isStep1Ok;
          case 2: return isStep2Ok;
          case 3: return isStep3Ok;
          default: return true;
        }
      };
    
      const handleNext = () => {
        setTouched({});
        if (!isStepComplete()) {           // focus invalid fields
          if (currentStep === 2) setTouched({ recName:true, recLastName:true, recTitle:true, recOrg:true,
            relationshipOther: form.relationship === 'other' });
          if (currentStep === 3) setTouched({ applicantFirstName:true, applicantLastName:true });
          return;
        }
        if (currentStep < totalSteps) { setCurrentStep(s => s + 1); scrollToTop(); }
      };
      const handlePrev = () => { setTouched({}); if (currentStep > 1) setCurrentStep(s => s - 1); };
    
      /* ------------------ Prompt builder (NEW – reads expanded form) */
      const buildPrompt = (s3Key?: string) => {
        const out: string[] = [];
        const langTxt = form.language === 'spanish' ? 'Spanish' : 'English';
        out.push(`Write a ${form.letterType} recommendation letter in ${langTxt}.`);
    
        // Recommender line
        const recFull = `${form.recName} ${form.recLastName}`.trim();
        const relationText = form.relationship === 'other'
          ? form.relationshipOther.trim()
          : ({
              manager:'Manager / Supervisor', professor:'Professor / Academic Advisor',
              colleague:'Coworker / Colleague', mentor:'Mentor / Coach',
            } as Record<string,string>)[form.relationship] ?? 'Colleague';
        out.push(`Recommender: ${recFull}, ${form.recTitle} at ${form.recOrg}` +
          (form.recAddress ? `, Address: ${form.recAddress}` : '') +
          `, Relationship: ${relationText}, known for ${KNOWN_TIMES[form.knownTime]}.`);
    
        // Applicant
        const applicantFull = `${form.applicantFirstName} ${form.applicantLastName}`.trim();
        out.push(`Applicant: ${applicantFull}` +
          (form.applicantPosition ? `, applying for ${form.applicantPosition}` : '') + '.');
    
        if (form.skillsAndQualities.trim())
          out.push(`Key skills, qualities & achievements: ${form.skillsAndQualities.trim()}.`);
    
        // Conditional Step 4 values (unchanged)
        if (form.gpa) out.push(`Applicant GPA: ${form.gpa}.`);
        if (form.visaType) out.push(`Visa type: ${form.visaType}.`);
        if (form.rentalAddress) out.push(`Rental property: ${form.rentalAddress}.`);
        if (form.residencySpecialty) out.push(`Residency specialty: ${form.residencySpecialty}.`);
    
        // Attachment
        if (s3Key)
          out.push(`Supporting document: https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`);
    
        /* ✨ New personalisation parameters */
        out.push(
          `Tone preset: ${form.tonePreset.toLowerCase()}; Formality level: ${form.formality} (0 casual → 2 formal). ` +
          `Desired length ≈ ${form.lengthWords} words. Opening style: ${form.openingStyle}. ` +
          `Perspective: ${form.perspective === 'first' ? 'first-person (I)' : 'institutional (We)'}.`
        );
        if (form.styleTags.length) out.push(`Writing style: ${form.styleTags.join(', ')}.`);
        if (form.includeAnecdote) out.push('Include a short anecdote.');
        if (form.includeMetrics) out.push('Use specific metrics or numbers where relevant.');
        out.push(`Creativity/temperature: ${form.creativity}.`);
    
        // Grammar proof
        if (form.grammarCheck) out.push('After composing, run a grammar-check pass.');
    
        return out.join(' ');
      };
    
      /* ------------------ Submit handler (unchanged flow, new builder) */
      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isGuest && localStorage.getItem('guestUsed')) { window.location.href = '/login'; return; }
    
        setErrorMsg(''); setFileError(''); setIsGenerating(true);
        let s3Key: string | undefined;
    
        // a) upload file if present
        if (form.file) {
          try {
            const { s3UploadUrl, s3UploadFields } = await createFile({
              fileName: form.file.name,
              fileType: form.file.type as any,
            });
            const fd = new FormData();
            Object.entries(s3UploadFields).forEach(([k,v]) => fd.append(k, v));
            fd.append('file', form.file);
            const upRes = await fetch(s3UploadUrl, { method:'POST', body: fd });
            if (!upRes.ok) throw new Error('upload');
            s3Key = s3UploadFields.key;
          } catch { setFileError('Upload failed'); setIsGenerating(false); return; }
        }
    
        // b) build prompt & call GPT
        const prompt = buildPrompt(s3Key);
        try {
          const res: any = await generateGptResponse({ prompt });
          setDraft(res.text || ''); if (isGuest) localStorage.setItem('guestUsed', '1');
          setShowConfetti(true); setSuccessMsg('Your letter is ready!'); setTimeout(()=>setSuccessMsg(''),3e3);
        } catch (err:any) {
          console.error(err);
          if (err.message === 'NO_CREDITS') window.location.href = '/pricing?credits=0';
          else setErrorMsg('Oops! Something went wrong.');
        } finally { setIsGenerating(false); scrollToTop(); }
      };
    
      /* ------------------ Word export (unchanged) */
      const handleDownloadDocx = async () => {
        if (!draft) return;
        const paragraphs = draft.split('\n').map(l => new Paragraph({
          children:[new TextRun(l)], spacing:{after:200}, alignment:AlignmentType.JUSTIFIED,
        }));
        const doc = new Document({ sections:[{ children:paragraphs }] });
        const blob = await Packer.toBlob(doc); saveAs(blob, 'Recommendation_Letter.docx');
      };
    
      /* ------------------------------------------------------------------ */
      /*  RENDER                                                             */
      /* ------------------------------------------------------------------ */
    
      // SUMMARY helper (live under Step 5 controls)
      const summaryStr = `${form.lengthWords} words · ` +
        `${['Casual','Neutral','Formal'][form.formality]} · ` +
        `${form.includeAnecdote ? 'Anecdote ON · ' : ''}${form.language}`;
    
      return (
        <>
          {isGenerating && <LoadingCurtain />}
          <main
            ref={mainRef}
            className="mx-auto max-w-3xl sm:max-w-4xl px-4 sm:px-6 md:px-8 py-8
                       bg-white dark:bg-gray-800 rounded-2xl shadow-xl mt-6 space-y-6">
            {showConfetti && <Confetti numberOfPieces={200} />}
            {successMsg && (
              <div className="fixed top-20 sm:top-16 right-5 z-[9999]
                              bg-green-100 border border-green-400 text-green-700
                              px-4 py-3 rounded-lg shadow-md">✅ {successMsg}</div>)}
            {errorMsg && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                {errorMsg}</div>)}
    
            {/* Heading */}
            <h1 className="text-4xl md:text-5xl font-extrabold text-center">
              {draft ? <>Letter <span className="text-yellow-500">Generated</span></>
                     : <>Generate <span className="text-yellow-500">Recommendation Letter</span></>}
            </h1>
    
            {/* Stepper */}
            {!draft && (
              <>
                <div className="mt-4 text-lg font-medium text-center">
                  Step {currentStep} of {totalSteps}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                  <div className="h-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"
                       style={{ width:`${(currentStep/totalSteps)*100}%` }} />
                </div>
              </>
            )}
    
            {/* Helper sentence Step 1 */}
            {currentStep === 1 && (
              <p className="my-8 text-lg font-medium text-center text-gray-700 dark:text-gray-300">
                Select your Recommendation Letter type:
              </p>)}
    
            {/* ——————————————————— WIZARD FORM ——————————————————— */}
            {!draft ? (
              <form onSubmit={handleSubmit} className="space-y-10">
    
                {/* STEP 1 (unchanged grid) */}
                {currentStep === 1 && (
                  <div className="space-y-8">
                    {(['education','professional','personal'] as LetterGroup[]).map(g => (
                      <div key={g} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {LETTER_TYPES.filter(t=>t.group===g).map(({value,label,group})=>{
                          const active = form.letterType===value, g2=group as LetterGroup;
                          return (
                            <button key={value} type="button"
                              onClick={()=>setForm(f=>({...f,letterType:value}))}
                              className={`relative w-full rounded-2xl font-medium transition ring-offset-2
                                px-4 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5
                                ${active?`${GROUP_BG[g2]} ${GROUP_BORDER[g2]} ring-4 ${GROUP_RING[g2]} shadow-md`
                                        :`border border-gray-300 ${GROUP_BG[g2]} hover:scale-[1.03]`}`}>
                              {active && <BsCheckCircleFill className="absolute top-2 right-2 h-5 w-5
                                                                   text-blue-600 dark:text-blue-400"/>}
                              {label}
                            </button>);
                        })}
                      </div>))}
                  </div>)}
    
                {/* STEP 2 & 3 & 4  —— keep your existing JSX 100 % unchanged */}
                {currentStep === 2 && (
  <div className="grid gap-8">
    {/* First + Last Name */}
    <div className="md:grid md:grid-cols-2 md:gap-8">
      <div>
        <label htmlFor="recName" className="block text-lg font-semibold mb-2">
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
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
        {touched.recName && !form.recName && (
          <p className="text-red-500 text-sm mt-1">
            Please enter the recommender's first name.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="recLastName" className="block text-lg font-semibold mb-2">
          Recommender Last Name <span className="text-red-500">*</span>
        </label>
        <input
          id="recLastName"
          name="recLastName"
          value={form.recLastName}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g., Doe"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
        {touched.recLastName && !form.recLastName && (
          <p className="text-red-500 text-sm mt-1">
            Please enter the recommender's last name.
          </p>
        )}
      </div>
    </div>

    {/* Title + Organization */}
    <div className="md:grid md:grid-cols-2 md:gap-8">
      <div>
        <label htmlFor="recTitle" className="block text-lg font-semibold mb-2">
          Title / Position <span className="text-red-500">*</span>
        </label>
        <input
          id="recTitle"
          name="recTitle"
          value={form.recTitle}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g., Senior Manager"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
        {touched.recTitle && !form.recTitle && (
          <p className="text-red-500 text-sm mt-1">Please enter the title.</p>
        )}
      </div>
      <div>
        <label htmlFor="recOrg" className="block text-lg font-semibold mb-2">
          Organization <span className="text-red-500">*</span>
        </label>
        <input
          id="recOrg"
          name="recOrg"
          value={form.recOrg}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g., Acme Corp"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
        {touched.recOrg && !form.recOrg && (
          <p className="text-red-500 text-sm mt-1">Please enter the organization.</p>
        )}
      </div>
    </div>

    {/* Address optional */}
    <div>
      <label htmlFor="recAddress" className="block text-lg font-semibold mb-2">
        Recommender Address (optional)
      </label>
      <input
        id="recAddress"
        name="recAddress"
        value={form.recAddress}
        onChange={handleChange}
        placeholder="e.g., 123 Main St, City"
        className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
      />
    </div>

    {/* Relationship + Known time */}
    <div className="md:grid md:grid-cols-2 md:gap-8">
      <div>
        <label htmlFor="relationship" className="block text-lg font-semibold mb-2">
          Relationship
        </label>
        <select
          id="relationship"
          name="relationship"
          value={form.relationship}
          onChange={handleChange}
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        >
          <option value="manager">Manager / Supervisor</option>
          <option value="professor">Professor / Academic Advisor</option>
          <option value="colleague">Coworker / Colleague</option>
          <option value="mentor">Mentor / Coach</option>
          <option value="other">Other</option>
        </select>

        {form.relationship === 'other' && (
          <div className="mt-4">
            <label
              htmlFor="relationshipOther"
              className="block text-lg font-semibold mb-2"
            >
              Please specify Relationship <span className="text-red-500">*</span>
            </label>
            <input
              id="relationshipOther"
              name="relationshipOther"
              value={form.relationshipOther}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g., Team Lead"
              className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
            />
            {touched.relationshipOther && !form.relationshipOther.trim() && (
              <p className="text-red-500 text-sm mt-1">Required.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="knownTime" className="block text-lg font-semibold mb-2">
          Known Time
        </label>
        <select
          id="knownTime"
          name="knownTime"
          value={form.knownTime}
          onChange={handleChange}
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
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
    {/* First + Last Name */}
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
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
        {touched.applicantFirstName && !form.applicantFirstName.trim() && (
          <p className="text-red-500 text-sm mt-1">Required.</p>
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
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
        {touched.applicantLastName && !form.applicantLastName.trim() && (
          <p className="text-red-500 text-sm mt-1">Required.</p>
        )}
      </div>
    </div>

    {/* Position / Program (optional) */}
    <div>
      <label htmlFor="applicantPosition" className="block text-lg font-semibold mb-2">
        Position / Program Applying To (optional)
      </label>
      <input
        id="applicantPosition"
        name="applicantPosition"
        value={form.applicantPosition}
        onChange={handleChange}
        placeholder="e.g., MBA Program"
        className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
      />
    </div>

    {/* Skills & Qualities */}
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
        placeholder="e.g., Leadership; Project management; Award-winning research"
        className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
      />
    </div>
  </div>
)}

{currentStep === 4 && (
  <div className="grid gap-8">
    <div>
      <label htmlFor="recipientName" className="block text-lg font-semibold mb-2">
        Recipient Name (optional)
      </label>
      <input
        id="recipientName"
        name="recipientName"
        value={form.recipientName}
        onChange={handleChange}
        placeholder="e.g., Admissions Committee"
        className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
      />
    </div>

    <div>
      <label htmlFor="recipientPosition" className="block text-lg font-semibold mb-2">
        Recipient Position (optional)
      </label>
      <input
        id="recipientPosition"
        name="recipientPosition"
        value={form.recipientPosition}
        onChange={handleChange}
        placeholder="e.g., Dean of Admissions"
        className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
      />
    </div>

    {/* Conditional fields */}
    {form.letterType === 'scholarship' && (
      <div>
        <label htmlFor="gpa" className="block text-lg font-semibold mb-2">
          Applicant GPA (optional)
        </label>
        <input
          id="gpa"
          name="gpa"
          value={form.gpa}
          onChange={handleChange}
          placeholder="e.g., 3.9 / 4.0"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
      </div>
    )}

    {form.letterType === 'immigration' && (
      <div>
        <label htmlFor="visaType" className="block text-lg font-semibold mb-2">
          Visa Type (optional)
        </label>
        <input
          id="visaType"
          name="visaType"
          value={form.visaType}
          onChange={handleChange}
          placeholder="e.g., H-1B"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
      </div>
    )}

    {form.letterType === 'tenant' && (
      <div>
        <label htmlFor="rentalAddress" className="block text-lg font-semibold mb-2">
          Rental Address (optional)
        </label>
        <input
          id="rentalAddress"
          name="rentalAddress"
          value={form.rentalAddress}
          onChange={handleChange}
          placeholder="e.g., 123 Main St, City"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
      </div>
    )}

    {form.letterType === 'medical' && (
      <div>
        <label htmlFor="residencySpecialty" className="block text-lg font-semibold mb-2">
          Residency Specialty (optional)
        </label>
        <input
          id="residencySpecialty"
          name="residencySpecialty"
          value={form.residencySpecialty}
          onChange={handleChange}
          placeholder="e.g., Internal Medicine"
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
        />
      </div>
    )}
  </div>
)}

{/* STEP 5 – ✨ REBUILT */}
{currentStep === 5 && (
  <div className="space-y-8">
  <h1 className="text-2xl md:text-2xl font-semibold text-center mt-10 mb-10">
  Advanced Options
</h1>
    {/* 1 · Top Section: Language & Tone */}
    <div className="grid gap-8 md:grid-cols-2">
      {/* Language */}
      <div>
        <label className="font-semibold block mb-2">Language</label>
        <select
          name="language"
          value={form.language}
          onChange={handleChange}
          className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3"
        >
          <option value="english">English</option>
          <option value="spanish">Spanish</option>
          <option value="french">French</option>
          <option value="german">German</option>
          <option value="portuguese">Portuguese</option>
        </select>
      </div>

      {/* Tone preset */}
      <div>
        <label className="font-semibold block mb-2">Tone preset</label>
        <Listbox
          value={form.tonePreset}
          onChange={v => setForm(f => ({ ...f, tonePreset: v }))}
        >
          <div className="relative">
          <Listbox.Button className="relative w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-3 text-left">
          <span className="block truncate">{form.tonePreset}</span>
          {/* Flecha posicionada */}
          <HiMiniChevronDown
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
          />
          </Listbox.Button> 
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 shadow-lg">
              {TONE_PRESETS.map(tp => (
                <Listbox.Option
                  key={tp}
                  value={tp}
                  className={({ active }) =>
                    `px-4 py-2 cursor-pointer ${
                      active ? 'bg-blue-100 dark:bg-blue-900' : ''
                    }`
                  }
                >
                  {tp}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>
    </div>

    {/* 2 · Length */}
    <div>
      <label className="font-semibold block mb-2">Length (words)</label>
      <input
        type="range"
        min={MIN_LEN}
        max={MAX_LEN}
        step={STEP_LEN}
        name="lengthWords"
        value={form.lengthWords}
        onChange={handleChange}
        className="w-full"
      />
      <p className="text-sm mt-1">{form.lengthWords} words target</p>
    </div>

{/* 3 · Opening & Writing Style | Formality */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
  {/* Opening style */}
  <div>
    <label className="font-semibold block mb-2">Opening style</label>
    <div className="flex flex-wrap gap-2">
      {OPENING_STYLES.map(os => (
        <button
          key={os}
          type="button"
          className={`px-3 py-1 rounded-full border ${
            form.openingStyle === os
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
          onClick={() => setForm(f => ({ ...f, openingStyle: os }))}
        >
          {os}
        </button>
      ))}
    </div>
  </div>

  {/* Formality */}
  <div>
    <label className="font-semibold block mb-2">Formality</label>
    <div className="flex flex-wrap gap-2">
      {['Formal', 'Neutral', 'Casual'].map((lvl, idx) => (
        <button
          key={lvl}
          type="button"
          className={`px-3 py-1 rounded-full border ${
            form.formality === idx
              ? 'bg-purple-700 text-white'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
          onClick={() =>
            setForm(f => ({ ...f, formality: idx as 0 | 1 | 2 }))
          }
        >
          {lvl}
        </button>
      ))}
    </div>
  </div>

  {/* Writing style */}
  <div>
    <label className="font-semibold block mb-2">Writing style</label>
    <div className="flex flex-wrap gap-2">
      {WRITING_STYLE_TAGS.map(tag => (
        <button
          key={tag}
          type="button"
          className={`px-3 py-1 rounded-full border ${
            form.writingStyle === tag
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
          onClick={() => setForm(f => ({ ...f, writingStyle: tag }))}
        >
          {tag}
        </button>
      ))}
    </div>
  </div>
</div>

{/* 7 · Attachment & Examples */}
<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
  {/* Upload UI */}
  <div className="col-span-full md:col-span-2">
    <label className="block font-semibold mb-2">
      Upload Supporting Document (optional) e.g., CV, job posting, scholarship instructions
    </label>
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`flex items-center justify-center p-6 border-2 border-dashed rounded-lg
        cursor-pointer transition ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-white dark:bg-gray-700'
        }`}
    >
      {!form.file ? (
        <p className="text-gray-500 dark:text-gray-400">
          Drag & drop PDF/DOCX, or click to browse
        </p>
      ) : (
        <div className="flex items-center space-x-4">
          <p>
            {form.file.name} ({(form.file.size / 1048576).toFixed(2)} MB)
          </p>
          <button
            type="button"
            onClick={handleFileRemove}
            className="text-red-500 hover:underline"
          >
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
  </div>
</div>

{/* 8 · Toggles side by side below upload box */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
  {/* Include anecdote */}
  <div>
    <div className="flex items-center">
      <Switch
        checked={form.includeAnecdote}
        onChange={() => toggleBoolean('includeAnecdote')}
        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
          form.includeAnecdote ? 'bg-blue-600' : 'bg-gray-400'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            form.includeAnecdote ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </Switch>
      <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Include anecdote
      </span>
    </div>
    <p className="ml-14 mt-1 text-base text-gray-500 dark:text-gray-300">
      Adds a short personal anecdote.
    </p>
  </div>

  {/* Use metrics / numbers */}
  <div>
    <div className="flex items-center">
      <Switch
        checked={form.includeMetrics}
        onChange={() => toggleBoolean('includeMetrics')}
        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
          form.includeMetrics ? 'bg-blue-600' : 'bg-gray-400'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            form.includeMetrics ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </Switch>
      <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Use metrics / numbers
      </span>
    </div>
    <p className="ml-14 mt-1 text-base text-gray-500 dark:text-gray-300">
      Highlights quantifiable achievements.
    </p>
  </div>
</div>

            
            {/* Navigation */}
            <div className="flex space-x-4 mt-8">
              <button type="button" onClick={handlePrev}
                      className="flex-1 py-4 bg-gray-500 text-white rounded-xl hover:bg-gray-600">Previous</button>
              <button type="submit" disabled={isGenerating}
                      className="flex-1 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50">
                {isGenerating ? 'Generating…' : 'Generate Letter ✨'}
              </button>
            </div>
          </div>
        )}
    
                {/* Navigation for steps 1-4 */}
                {currentStep < 5 && (
                  <div className="flex justify-between space-x-4">
                    <button type="button" onClick={handlePrev} disabled={currentStep===1}
                            className="flex-1 py-3 bg-gray-500 text-white rounded-lg
                                       hover:bg-gray-600 disabled:opacity-50">Previous</button>
                    <button type="button" onClick={handleNext} disabled={!isStepComplete()}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-lg
                                       hover:bg-blue-700 disabled:opacity-50">Next</button>
                  </div>)}
              </form>
            ) : (
              /* DRAFT VIEW (same as before) */
              <div className="space-y-6">
                <div className="mt-11 w-full max-w-4xl mx-auto flex items-center justify-between gap-4">
                  {/* ← Nuevo “Previous” */}
                  <button
                    type="button"
                    onClick={() => {
                      setDraft('');            // quita el draft
                      setCurrentStep(5);       // vuelve al paso 5 del wizard
                      scrollToTop();           // sube al principio
                    }}
                    className="flex-1 py-3 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600"
                  >
                    🠔 Advanced Options
                  </button>

                  {/* Copy to Clipboard */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(draft);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
                  >
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                  </button>

                  {/* Download DOCX */}
                  <button
                    onClick={handleDownloadDocx}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
                  >
                    Download DOCX
                  </button>

                </div>
                <div className="whitespace-pre-wrap p-6 bg-gray-100 dark:bg-gray-700
                rounded-lg text-justify max-w-4xl w-full mx-auto">
                  {draft}
                </div>

                <button onClick={()=>{setDraft('');setCurrentStep(1);setForm(initialForm);scrollToTop();}}
                        className="w-full py-4 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white
                                   rounded-xl font-semibold hover:bg-gray-400 dark:hover:bg-gray-500">
                  🔄 Generate Another Letter
                </button>
              </div>)}
          </main>
        </>
      );
    }
    
    /* ------------------------------------------------------------------ 
    /*  Full-screen loader (unchanged)                                     */
    /* ------------------------------------------------------------------ */
    function LoadingCurtain() {
      return (
        <div role="alert" aria-live="assertive"
             className="fixed inset-0 z-50 flex flex-col items-center justify-center
                        bg-black/60 backdrop-blur-sm">
          <div className="relative">
            <div className="h-28 w-28 rounded-full
                            bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 animate-spin-slow"/>
            <HiMiniDocumentText className="absolute inset-0 m-auto text-white text-5xl"/>
          </div>
          <HiMiniSparkles className="mt-6 text-yellow-300 text-4xl animate-bounce"/>
          <p className="mt-4 text-xl font-semibold text-white animate-pulse">
            Crafting your letter… please wait.</p>
        </div>);
    }
    