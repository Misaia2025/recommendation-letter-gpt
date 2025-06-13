/*  NewLetterPage.tsx ─ REFACTORED 2025-06-11
    – Re-implements Step 5 with richer personalisation controls
    – Keeps previous wizard flow and generateGptResponse wiring intact              */

    import React, {
      useState, useRef, useEffect, ChangeEvent, FormEvent, FocusEvent,
    } from 'react';    
    import { useAuth } from 'wasp/client/auth';
    import { generateGptResponse, createFile } from 'wasp/client/operations';
    import { BsCheckCircleFill } from 'react-icons/bs';
    import { HiMiniSparkles, HiMiniArrowLeft, HiMiniChevronDown, HiMiniDocumentText } from 'react-icons/hi2';
    import { Switch, Listbox } from '@headlessui/react';
    import Confetti from 'react-confetti';
    import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
    import { saveAs } from 'file-saver';

    // ─────────── Helpers para mejorar buildPrompt() ───────────
    /** Extrae porcentajes escritos como “NN%” */

    /** Elige al azar un elemento de un array */
    function pick<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    /** Genera entero aleatorio entre min y max (incluidos) */
    function randRange(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
// ──────────────────────────────────────────────────────────────

    
    
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

// 🎨 Enhanced contrast styles for each group
const GROUP_BG: Record<LetterGroup, string> = {
  education:    'bg-blue-50 text-gray-900 shadow-sm dark:bg-blue-900/40 dark:text-white',
  professional: 'bg-green-50 text-gray-900 shadow-sm dark:bg-green-900/40 dark:text-white',
  personal:     'bg-gray-50 text-gray-900 shadow-sm dark:bg-gray-800/50 dark:text-white',
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
    
        
      // ─────────── Añade esto justo DEBAJO de tus imports ───────────
      /**
       * Extrae todos los porcentajes (%)
       * de un texto dado y los devuelve como números.
       */
      function extractPercents(text: string): number[] {
        const matches = text.match(/(\d{1,3})\s*%/g) || [];
        return matches.map(m => parseInt(m.replace('%', ''), 10));
      }
      // ────────────────────────────────────────────────────────────────




    /* ------------------------------------------------------------------ */
    /*  MAIN COMPONENT                                                     */
    /* ------------------------------------------------------------------ */
    // Función para envolver en rojo los textos entre corchetes
    function renderWithPlaceholders(text: string) {
      // Separar el texto en trozos: partes normales y placeholders
      const parts = text.split(/(\[[^\]]+\])/g);
      return parts.map((part, i) =>
        // Si coincide con [algo], lo pinta de rojo. Si no, tal cual.
        /\[[^\]]+\]/.test(part)
          ? <span key={i} className="text-red-600">{part}</span>
          : <span key={i}>{part}</span>
      );
    }

    
    export default function NewLetterPage() {
      /* ——————————————————————————————————— Refs & Auth */
      const { data: user } = useAuth();
      const isGuest = !user;
      const mainRef = useRef<HTMLDivElement>(null);
      
      const scrollToTop = () => mainRef.current?.scrollIntoView({ behavior: 'smooth' });
    
      /* ——————————————————————————————————— Wizard state */
      const totalSteps = 4;
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
        applicantFirstName: '', applicantLastName: '', applicantSex: '', applicantPosition: '',
        skillsAndQualities: '',
    
        /* Step 4 – Recipient / Conditional */
        gpa: '', visaType: '',
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
        supportingText: '',        // ← new field
      };
      const [form, setForm] = useState(initialForm);
      const fileInputRef = useRef<HTMLInputElement>(null);
      const [cvFile,     setCvFile] = useState<File | null>(null);
      const [cvText,     setCvText] = useState<string>('');  // Contenido leíble del archivo

    
      /* ——————————————————————————————————— Letter generation */
      const [draft, setDraft] = useState('');
      const [isGenerating, setIsGenerating] = useState(false);
      const [showConfetti, setShowConfetti] = useState(false);
      useEffect(() => {
        if (showConfetti) {
          // Apaga el confeti después de 3 segundos
          const timer = setTimeout(() => setShowConfetti(false), 4000);
          return () => clearTimeout(timer);
        }
      }, [showConfetti]);
      
      const [errorMsg, setErrorMsg] = useState('');
      const [successMsg, setSuccessMsg] = useState('');
      
      
    
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

      const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCvFile(file);
      
        const reader = new FileReader();
        reader.onload = () => setCvText(reader.result as string);
        reader.readAsText(file);
      };
      
      const handleRemoveFile = () => {
        setCvFile(null);
        setCvText('');
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
    
    
      /* ------------------ Wizard navigation (Step 1-4 remain unchanged) */
      const isStep1Ok = Boolean(form.letterType);
      const isStep2Ok = Boolean(
        form.recName &&
        form.recLastName &&
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
          if (currentStep === 2) setTouched({
            recName: true,
            recLastName: true,
            relationshipOther: form.relationship === 'other'
          });
          
          if (currentStep === 3) setTouched({ applicantFirstName:true, applicantLastName:true });
          return;
        }
        if (currentStep < totalSteps) { setCurrentStep(s => s + 1); scrollToTop(); }
      };
      const handlePrev = () => { setTouched({}); if (currentStep > 1) setCurrentStep(s => s - 1); };
    
      /* ------------------ Prompt builder (NEW – reads expanded form) */
      const buildPrompt = () => {
        const out: string[] = [];
        const langTxt = {
          english: 'English',
          spanish: 'Spanish',
          french: 'French',
          german: 'German',
          portuguese: 'Portuguese'
        }[form.language] || 'English';
        
        out.push(`Write a ${form.letterType} recommendation letter in ${langTxt}.`);
    
        // Recommender line
        // Recommender line
        const recFull = `${form.recName} ${form.recLastName}`.trim();
        const relationText = form.relationship === 'other'
          ? form.relationshipOther.trim()
          : ({
              manager:   'Supervisor',
              professor: 'Professor',
              colleague: 'Colleague',
              mentor:    'Mentor',
            } as Record<string,string>)[form.relationship] ?? 'Colleague';

        // === BLOQUE NUEVO ===
        let recLine = `Recommender: ${recFull}`;
        if (form.recTitle)   recLine += `, ${form.recTitle}`;
        if (form.recOrg)     recLine += ` at ${form.recOrg}`;
        if (form.recAddress) recLine += `, Address: ${form.recAddress}`;
        recLine += `, Relationship: ${relationText}, known for ${KNOWN_TIMES[form.knownTime]}.`;
        out.push(recLine);
        // === FIN BLOQUE NUEVO ===

        // A continuación continúa el resto de tu prompt…

    
        // Applicant
        const applicantFull = `${form.applicantFirstName} ${form.applicantLastName}`.trim();
        let applicantLine = `Applicant: ${applicantFull}`;
        if (form.applicantSex) applicantLine += ` (${form.applicantSex})`;
        if (form.applicantPosition) applicantLine += `, applying for ${form.applicantPosition}`;
        applicantLine += '.';
        out.push(applicantLine);

    
        if (form.skillsAndQualities.trim()) {
          const traits = form.skillsAndQualities
            .split(/[,;]+/)
            .map(s => s.trim())
            .filter(Boolean);
          out.push(
            `In particular, they demonstrated ${traits.join(', ')}, which translated into tangible results.`
          );
        }
        

    
        /* ✨ New personalisation parameters */
        out.push(
          `Tone preset: ${form.tonePreset.toLowerCase()}; Formality level: ${form.formality} (0 casual → 2 formal). ` +
          `Desired length ≈ ${form.lengthWords} words. Opening style: ${form.openingStyle}. ` +
          `Perspective: ${form.perspective === 'first' ? 'first-person (I)' : 'institutional (We)'}.`
        );
        if (form.styleTags.length) out.push(`Writing style: ${form.styleTags.join(', ')}.`);
        // 1) Localiza y elimina esta línea dentro de buildPrompt():
//    if (form.includeAnecdote) out.push('Include a short anecdote.');

      // 2) Justo en su lugar, pega este bloque completo:

        if (form.includeAnecdote) {
          const anecdoteMap: Record<string, string[]> = {
            academic: [
              'how the candidate led a research project that surpassed expectations',
              'the moment they tutored classmates, boosting class grades',
              'their presentation at the university conference that earned applause',
              'how they organized study groups and improved peer performance',
              'their creative solution to a complex academic challenge'
            ],
            scholarship: [
              'how they wrote a compelling essay that moved the selection committee',
              'their initiative in securing small grants to fund their studies',
              'the way they mentored underclassmen despite a busy schedule',
              'their outreach to community organizations for scholarship support',
              'how they balanced extracurriculars while maintaining top grades'
            ],
            medical: [
              'an occasion where they comforted a nervous patient with empathy',
              'the time they identified a critical diagnosis under pressure',
              'how they coordinated care between multiple specialists',
              'their quick thinking during a sudden emergency on rounds',
              'the compassion they showed in follow-up patient visits'
            ],
            internship: [
              'when they streamlined an internal process, saving hours of work',
              'their ability to learn a new tool on the spot and teach it to peers',
              'how they went beyond the brief to contribute to a key project',
              'the positive feedback they received from their mentor',
              'their clear, confident presentation of findings to the team'
            ],
            job: [
              'how they led a project that boosted team efficiency by example',
              'the time they mediated a conflict to a successful resolution',
              'their innovative idea that cut costs without sacrificing quality',
              'how they mentored a junior colleague to exceed their goals',
              'a client testimonial praising their professionalism'
            ],
            volunteer: [
              'when they organized a community clean-up that mobilized 50+ volunteers',
              'how they led a charity drive that exceeded its fundraising target',
              'their empathy working with underprivileged families',
              'the leadership they showed in disaster-relief efforts',
              'a workshop they ran that left a lasting impact on participants'
            ],
            immigration: [
              'when they overcame a language barrier to help a fellow immigrant',
              'their advocacy for allowing newcomers to access services',
              'how they volunteered to lead cultural-orientation sessions',
              'their persistence in navigating complex visa procedures',
              'the support they provided to new arrivals settling in the city'
            ],
            tenant: [
              'when they coordinated repairs without burdening the landlord',
              'their respectful communication with neighbors during a refurbishment',
              'how they kept the property in pristine condition',
              'their flawless record of on-time rent payments',
              'the community garden initiative they spearheaded'
            ],
            personal: [
              'when they overcame a personal challenge with resilience',
              'their daily habit of volunteering time to mentor others',
              'how they went out of their way to help a stranger in need',
              'the creative solution they applied to a tricky everyday problem',
              'their commitment to continuous self-improvement'
            ],
            default: [
              'a moment that showcases their dedication and impact',
              'an example of their leadership under pressure',
              'how they collaborated effectively in a team setting',
              'their creative approach to solving a complex problem',
              'a time they exceeded expectations in their role'
            ],
          };
          const templates = anecdoteMap[form.letterType] || anecdoteMap.default;
          out.push(`Include a short anecdote about ${pick(templates)}.`);
        }
        
        // Comparaciones tipo “top X%” para reforzar el elogio
        if (true) { // o condicional interno si lo prefieres
          const compMap: Record<string, string[]> = {
            academic:   [`one of the top ${randRange(1,5)}% of students I've taught`],
            medical:    [`among the top ${randRange(1,5)}% of residents I've supervised`],
            internship: [`one of the most proactive interns I've had`],
            job:        [`among the top ${randRange(1,5)}% of professionals I've managed`],
            volunteer:  [`one of the most dedicated volunteers in our program`],
            immigration:[`among the ${randRange(1,5)}% strongest applicants I've endorsed`],
            tenant:     [`with a lease renewal rate above ${randRange(80,100)}%`],
            personal:   [`one of the most dependable individuals I've known`],
            default:    [`a standout individual in their cohort`],
          };
          const list = compMap[form.letterType] || compMap.default;
          out.push(`I consider them ${pick(list)}.`);
        }


        if (form.includeMetrics) {
          // Extraemos porcentajes de los campos opcionales del usuario
          const userMetrics = [
            ...extractPercents(form.skillsAndQualities),
            ...extractPercents(form.supportingText),
          ];
          // Si el usuario proporcionó al menos un %, lo usamos; si no, generamos uno aleatorio (10–60)
          const percent = userMetrics.length
            ? userMetrics[Math.floor(Math.random() * userMetrics.length)]
            : Math.floor(Math.random() * 51) + 10;
        
          // Definimos verbos y métricas contextualizadas por tipo de carta
          let verbs: string[] = [];
          let metricTemplates: ((n: number) => string)[] = [];
        
          switch (form.letterType) {
            case 'academic':
            case 'scholarship':
              verbs = [
                'increasing', 'boosting', 'enhancing', 'elevating', 'magnifying',
                'amplifying', 'strengthening', 'uplifting', 'reinforcing', 'augmenting'
              ];
              metricTemplates = [
                n => `GPA by ${n}%`,
                n => `publication count by ${n}%`,
                n => `research grants by ${n}%`,
                n => `citation index by ${n}%`,
                n => `conference presentations by ${n}%`,
                n => `honors received by ${n}%`,
                n => `scholarship funding by ${n}%`,
                n => `peer reviews by ${n}%`,
                n => `project completion rate by ${n}%`,
                n => `academic collaborations by ${n}%`
              ];
              break;
        
            case 'medical':
              verbs = [
                'improving', 'optimizing', 'elevating', 'advancing', 'refining',
                'strengthening', 'streamlining', 'accelerating', 'enhancing', 'boosting'
              ];
              metricTemplates = [
                n => `patient satisfaction scores by ${n}%`,
                n => `clinical procedure success rate by ${n}%`,
                n => `rounds conducted by ${n}%`,
                n => `case resolution speed by ${n}%`,
                n => `treatment adherence by ${n}%`,
                n => `bed occupancy efficiency by ${n}%`,
                n => `lab test throughput by ${n}%`,
                n => `follow-up compliance by ${n}%`,
                n => `surgical precision by ${n}%`,
                n => `reduction in readmission rates by ${n}%`
              ];
              break;
        
            case 'internship':
              verbs = [
                'accelerating', 'streamlining', 'enhancing', 'expediting', 'facilitating',
                'improving', 'optimizing', 'tightening', 'boosting', 'expanding'
              ];
              metricTemplates = [
                n => `project delivery speed by ${n}%`,
                n => `team collaboration efficiency by ${n}%`,
                n => `task completion rate by ${n}%`,
                n => `learning curve reduction by ${n}%`,
                n => `report turnaround by ${n}%`,
                n => `mentorship satisfaction by ${n}%`,
                n => `presentation quality by ${n}%`,
                n => `documentation accuracy by ${n}%`,
                n => `tool adoption rate by ${n}%`,
                n => `peer feedback scores by ${n}%`
              ];
              break;
        
            case 'job':
            case 'professional':
              verbs = [
                'driving', 'maximizing', 'optimizing', 'leading', 'spearheading',
                'propelling', 'elevating', 'expanding', 'enhancing', 'boosting'
              ];
              metricTemplates = [
                n => `revenue by ${n}%`,
                n => `sales conversion by ${n}%`,
                n => `customer retention by ${n}%`,
                n => `market share by ${n}%`,
                n => `profit margins by ${n}%`,
                n => `operational uptime by ${n}%`,
                n => `client satisfaction by ${n}%`,
                n => `team productivity by ${n}%`,
                n => `budget utilization by ${n}%`,
                n => `new account growth by ${n}%`
              ];
              break;
        
            case 'volunteer':
            case 'ngo':
              verbs = [
                'increasing', 'expanding', 'amplifying', 'broadening', 'multiplying',
                'extending', 'strengthening', 'scaling', 'boosting', 'enhancing'
              ];
              metricTemplates = [
                n => `volunteer hours by ${n}%`,
                n => `community reach by ${n}%`,
                n => `funds raised by ${n}%`,
                n => `events organized by ${n}%`,
                n => `beneficiaries served by ${n}%`,
                n => `partnership growth by ${n}%`,
                n => `awareness campaigns by ${n}%`,
                n => `donor engagement by ${n}%`,
                n => `resource distribution by ${n}%`,
                n => `training sessions by ${n}%`
              ];
              break;
        
            case 'immigration':
              verbs = [
                'facilitating', 'streamlining', 'expediting', 'accelerating', 'optimizing',
                'enhancing', 'simplifying', 'refining', 'boosting', 'improving'
              ];
              metricTemplates = [
                n => `visa approval rate by ${n}%`,
                n => `application processing time reduction by ${n}%`,
                n => `case handling speed by ${n}%`,
                n => `documentation accuracy by ${n}%`,
                n => `interview success by ${n}%`,
                n => `support response rate by ${n}%`,
                n => `compliance rate by ${n}%`,
                n => `policy adherence by ${n}%`,
                n => `client satisfaction by ${n}%`,
                n => `error rate reduction by ${n}%`
              ];
              break;
        
            case 'tenant':
            case 'landlord':
              verbs = [
                'maintaining', 'ensuring', 'demonstrating', 'achieving', 'upholding',
                'exceeding', 'preserving', 'protecting', 'sustaining', 'guaranteeing'
              ];
              metricTemplates = [
                n => `on-time payments by ${n}%`,
                n => `property upkeep satisfaction by ${n}%`,
                n => `lease renewal rate by ${n}%`,
                n => `maintenance request resolution by ${n}%`,
                n => `tenant retention by ${n}%`,
                n => `inspection pass rate by ${n}%`,
                n => `noise complaint reduction by ${n}%`,
                n => `cleanliness scores by ${n}%`,
                n => `community engagement by ${n}%`,
                n => `property value growth by ${n}%`
              ];
              break;
        
            case 'personal':
            default:
              verbs = [
                'enhancing', 'improving', 'boosting', 'uplifting', 'strengthening',
                'elevating', 'maximizing', 'refining', 'expanding', 'fostering'
              ];
              metricTemplates = [
                n => `overall performance by ${n}%`,
                n => `personal growth by ${n}%`,
                n => `project impact by ${n}%`,
                n => `skill proficiency by ${n}%`,
                n => `initiative uptake by ${n}%`,
                n => `goal attainment by ${n}%`,
                n => `efficiency improvements by ${n}%`,
                n => `collaboration effectiveness by ${n}%`,
                n => `creative output by ${n}%`,
                n => `time management by ${n}%`
              ];
          }
        
          // Seleccionamos aleatoriamente un verbo y una plantilla
          const verb = verbs[Math.floor(Math.random() * verbs.length)];
          const template = metricTemplates[Math.floor(Math.random() * metricTemplates.length)];
          const metricPhrase = template(percent);
        
          // Finalmente, añadimos la frase al prompt
          out.push(
            `Use specific metrics appropriate for a ${form.letterType} letter, such as ${verb} ${metricPhrase}.`
          );
        }

        switch (form.letterType) {
          case 'scholarship':
            out.push(
              'This profile aligns perfectly with the scholarship’s goal of fostering academic excellence and innovation.'
            );
            break;
          case 'internship':
            out.push(
              `I am confident they will excel in the ${form.applicantPosition || 'internship'} due to their adaptability and drive.`
            );
            break;
          case 'immigration':
            out.push(
              'I strongly urge you to grant them the requested visa, as they will be an asset to your community.'
            );
            break;
          default:
            // nada extra para otros tipos
        }
        

        out.push(`Creativity/temperature: ${form.creativity}.`);

        // Incluye el texto del textarea como contexto adicional
        // Incluye el contenido del CV como contexto adicional
        if (cvText.trim()) {
          out.push(`Applicant CV/Resume content: ${cvText.trim()}.`);
        }

        if (form.supportingText.trim()) {
          out.push(`Additional context: ${form.supportingText.trim()}.`);
        }
        // Grammar proof
        if (form.grammarCheck) out.push('After composing, run a grammar-check pass.');
        const closings: Record<string, string[]> = {
          default: [
            'I highly recommend them without reservation.',
            'Please feel free to contact me for any further details.',
            'I am happy to provide additional information upon request.',
            'I am confident they will be a valuable addition wherever they go.',
            'Should you need any clarification, do not hesitate to reach out.'
          ],
          academic: [
            'I enthusiastically recommend them for your program and stand by this recommendation.',
            'Their academic promise is outstanding, and I am available to discuss further.',
            'I have no doubt they will excel in your academic environment.',
            'They would be an exceptional addition to your institution.',
            'Please let me know if you require any additional insight into their qualifications.'
          ],
          scholarship: [
            'I strongly endorse their application for this scholarship opportunity.',
            'Their achievements make them an ideal candidate for your funding.',
            'I am certain that investing in their education will yield great returns.',
            'They fully deserve this scholarship, and I am available for further details.',
            'Feel free to contact me for any additional information to support this application.'
          ],
          medical: [
            'I wholeheartedly endorse their application to your residency program.',
            'Their clinical skills and character make them an exemplary candidate.',
            'I fully support their candidacy and can provide further insights on request.',
            'They possess the qualities essential for a successful medical resident.',
            'Please do not hesitate to contact me regarding any aspect of their application.'
          ],
          internship: [
            'I confidently recommend them for this internship opportunity.',
            'Their proactive attitude ensures they will add value from day one.',
            'I believe they will quickly become an asset to your team.',
            'They are well-prepared to meet the challenges of this role.',
            'Please let me know if you would like any further examples of their work.'
          ],
          job: [
            'I am delighted to recommend them for this position.',
            'They have consistently exceeded expectations in their role.',
            'I trust they will bring both skill and integrity to your organization.',
            'They are an outstanding professional, and I fully endorse their candidacy.',
            'Feel free to reach out if you need any further evidence of their qualifications.'
          ],
          volunteer: [
            'I wholeheartedly recommend them for any volunteer role.',
            'Their dedication and compassion set them apart in our community.',
            'I am certain they will make a meaningful impact in your organization.',
            'They have proven themselves as a reliable and caring volunteer.',
            'Please contact me if you need more information on their community contributions.'
          ],
          ngo: [
            'I strongly support their application to join your NGO efforts.',
            'Their leadership and empathy are invaluable assets for social causes.',
            'I am available to discuss how they can contribute to your mission.',
            'They have a track record of driving positive change in communities.',
            'Feel free to ask for any additional examples of their NGO work.'
          ],
          immigration: [
            'I remain at your disposal for any further inquiries.',
            'I strongly encourage you to approve their application.',
            'They will be a valuable contributor to your community, without reservation.',
            'Please consider them favorably; I can provide more details if needed.',
            'I fully endorse their application and welcome any questions you may have.'
          ],
          tenant: [
            'I would gladly lease to them again without hesitation.',
            'They have maintained the property impeccably and paid on time.',
            'I confidently recommend them as a tenant for any future lease.',
            'They are responsible and respectful neighbors; you will not be disappointed.',
            'Please feel free to contact me for any further information on their tenancy.'
          ],
          landlord: [
            'I have no reservations in recommending them as a landlord.',
            'Their management style has been professional and considerate.',
            'They ensure tenants are well-supported and properties well-maintained.',
            'I can attest to their fairness and reliability as a landlord.',
            'Do not hesitate to reach out if you need more details about their management.'
          ]
        };
        const closeList = closings[form.letterType] || closings.default;
        out.push(pick(closeList));
        
        return out.join(' ');
      };
    
      /* ------------------ Submit handler (unchanged flow, new builder) */
      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isGuest && localStorage.getItem('guestUsed')) { window.location.href = '/login'; return; }
    
        setErrorMsg(''); setIsGenerating(true);
  
      try {
        // b) build prompt & call GPT
        // Función simple para extraer porcentajes del texto
      function extractPercents(text: string): number[] {
        const matches = text.match(/(\d{1,3})\s*%/g) || [];
        return matches.map(m => parseInt(m.replace('%',''), 10));
      }

      const prompt = buildPrompt();
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

  // 1) Dividir el texto en líneas
  const lines = draft.split('\n');

  // 2) Para cada línea, construir trozos (runs) que sean
  //    - rojos si están entre corchetes [ ], o
  //    - negros si son texto normal
  const paragraphs = lines.map(line => {
    // Separa la línea en fragmentos, conservando los [placeholders]
    const parts = line.split(/(\[[^\]]+\])/g);

    // Para cada fragmento, creamos un TextRun con color
    const runs = parts.map(text => {
      if (/^\[[^\]]+\]$/.test(text)) {
        // Si el fragmento es exactamente [algo], lo ponemos en rojo
        return new TextRun({
          text,
          color: "FF0000",  // código HEX para rojo
          bold: true,       // opcional: negrita para mayor énfasis
        });
      } else {
        // Texto normal, color por defecto (negro)
        return new TextRun({ text });
      }
    });

    // Convertimos estos runs en un párrafo
    return new Paragraph({
      children: runs,
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED,
    });
  });

  // 3) Empaquetar el documento y disparar la descarga
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'Recommendation_Letter.docx');
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
              {currentStep === 4 && <>Advanced Options 📊</>}
              {currentStep === 1 && <>Generate <span className="text-yellow-500">Recommendation Letter</span></>}
              {currentStep === 2 && <>Generate <span className="text-yellow-500">Recommendation Letter</span></>}
              {currentStep === 3 && <>Generate <span className="text-yellow-500">Recommendation Letter</span></>}           
              {draft ? <>Letter <span className="text-yellow-500">Generated</span></>
                     : <></>}
            </h1>
    
           {/* Stepper (hidden on the final step) */}
            {!draft && currentStep < totalSteps && (
              <>
                <div className="mt-4 text-lg font-medium text-center">
                  Step {currentStep} of {totalSteps}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full">
                  <div
                    className="h-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"
                    style={{ width:`${(currentStep/totalSteps)*100}%` }}
                  />
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

      {/* Title + Organization (now optional) */}
      <div className="md:grid md:grid-cols-2 md:gap-8">
        <div>
          <label htmlFor="recTitle" className="block text-lg font-semibold mb-2">
            Title / Position <span className="text-sm text-gray-400">(optional)</span>
          </label>
          <input
            id="recTitle"
            name="recTitle"
            value={form.recTitle}
            onChange={handleChange}
            placeholder="e.g., Senior Manager"
            className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
          />
          {/* removed required-field indicator and validation message */}
        </div>
        <div>
          <label htmlFor="recOrg" className="block text-lg font-semibold mb-2">
            Organization <span className="text-sm text-gray-400">(optional)</span>
          </label>
          <input
            id="recOrg"
            name="recOrg"
            value={form.recOrg}
            onChange={handleChange}
            placeholder="e.g., Acme Corp"
            className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3"
          />
          {/* removed required-field indicator and validation message */}
        </div>
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
          <option value="manager">Supervisor</option>
          <option value="professor">Professor</option>
          <option value="colleague">Colleague</option>
          <option value="mentor">Mentor</option>
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
    {/* 3 · Applicant name + Sex */}
    <div className="md:grid md:grid-cols-12 md:gap-6">
      <div className="md:col-span-5">
        <label
          htmlFor="applicantFirstName"
          className="block text-lg font-semibold mb-2"
        >
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

      <div className="md:col-span-5">
        <label
          htmlFor="applicantLastName"
          className="block text-lg font-semibold mb-2"
        >
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

      <div className="md:col-span-2">
        <label htmlFor="applicantSex" className="block text-lg font-semibold mb-2">
          Sex <span className="text-red-500">*</span>
        </label>
        <select
          id="applicantSex"
          name="applicantSex"
          value={form.applicantSex}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full bg-gray-50 dark:bg-gray-700 border rounded-lg px-4 py-3 text-gray-900 dark:text-white"
        >
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        {touched.applicantSex && !form.applicantSex && (
          <p className="text-red-500 text-sm mt-1">Required.</p>
        )}
      </div>
    </div>  

      {/* 4 · Position & Conditional fields side-by-side */}
      <div className="grid md:grid-cols-2 md:gap-8 gap-8">
        {/* Position / Program Applying To */}
        <div
          className={`${
            ['scholarship','immigration','tenant','medical'].includes(form.letterType)
              ? ''
              : 'md:col-span-2'
          }`}
        >
        <label
          htmlFor="applicantPosition"
          className="block text-lg font-semibold mb-2"
        >
          Position / Program Applying To <span className="text-sm text-gray-400">(optional)</span>
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

        {/* Conditional fields */}
        {form.letterType === 'scholarship' && (
          <div>
            <label
              htmlFor="gpa"
              className="block text-lg font-semibold mb-2"
            >
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
            <label
              htmlFor="visaType"
              className="block text-lg font-semibold mb-2"
            >
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
            <label
              htmlFor="rentalAddress"
              className="block text-lg font-semibold mb-2"
            >
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
          <label
            htmlFor="residencySpecialty"
            className="block text-lg font-semibold mb-2"
          >
            Residency Specialty <span className="text-sm text-gray-400">(optional)</span>
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

      {/* 5 · Skills & Qualities */}
      <div>
      <label
        htmlFor="skillsAndQualities"
        className="block text-lg font-semibold mb-2"
      >
        Skills / Qualities / Achievements <span className="text-sm text-gray-400">(optional)</span>
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

{/* STEP 5 – ✨ REBUILT */}
{currentStep === 4 && (
  <div className="space-y-8">
  <h1 className="text-2xl md:text-2xl font-semibold text-center mt-16 mb-16">
  
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

{/* ── Upload Applicant’s CV/Resume ── */}
<div className="col-span-full mb-6">
  <label className="block font-semibold mb-2">
    Upload Applicant’s CV/Resume <span className="text-sm text-gray-400">(optional)</span>
  </label>

  {!cvFile ? (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition"
      >
        Upload Applicant’s CV/Resume
      </button>
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  ) : (
    <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
      <span className="truncate">{cvFile.name}</span>
      <button
        type="button"
        onClick={handleRemoveFile}
        className="text-red-600 hover:underline"
      >
        Remove
      </button>
    </div>
  )}
</div>


{/* 7 · Supporting Document Text */}
<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
  <div className="col-span-full md:col-span-2">
    <label htmlFor="supportingText" className="block font-semibold mb-2">
      Add more context (optional){' '}
      <span className="text-sm italic font-normal">
        e.g., job posting, scholarship instructions, visa application, etc.
      </span>
    </label>
    <textarea
      id="supportingText"
      name="supportingText"
      value={form.supportingText}
      onChange={handleChange}
      placeholder="Paste any relevant info here…"
      rows={3}
      maxLength={3900}
      className="w-full p-3 border-2 border-dashed rounded-lg
                 bg-white dark:bg-gray-700 resize-none"
    />
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
      This text will be included as a reference document for your letter.
    </p>
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
                {currentStep < 4 && (
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
                      setCurrentStep(4);       // vuelve al paso 5 del wizard
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
                <p className="text-center text-gray-700 dark:text-gray-300 mb-4">
                  Now just replace the <span className="text-red-600 font-semibold">red placeholders</span> with your own information, and you’re all set!
                </p>
                <div className="whitespace-pre-wrap p-6 bg-gray-100 dark:bg-gray-700
                rounded-lg text-justify max-w-4xl w-full mx-auto">
                  {renderWithPlaceholders(draft)}
                  </div>

                <button onClick={()=>{setDraft('');setCurrentStep(1);setForm(initialForm);scrollToTop();}}
                        className="w-full py-4 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white
                                   rounded-xl font-semibold hover:bg-gray-400 dark:hover:bg-gray-500">
                  🔄 Generate A New Letter
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
    