import { useState, ChangeEvent, FormEvent } from 'react';
import { useAuth } from 'wasp/client/auth';
import { generateGptResponse } from 'wasp/client/operations';

export default function NewLetterPage() {
  // Detectamos si el usuario está logueado o no
  const { data: user } = useAuth();
  const isGuest = !user;

  // Estado del formulario con Fases 1–5
  const [form, setForm] = useState({
    // Fase 2 · Info del recomendador
    recName: '',
    recTitle: '',
    recOrg: '',
    relationship: 'manager',
    knownTime: '<1yr',
    // Fase 1 · Tipo de carta
    letterType: 'academic',
    // Fase 3 · Info del recomendado
    applicant: '',
    targetName: '',
    targetPosition: '',
    achievements: '',
    skills: '',
    qualities: '',
    // Fase 4 · Tono y estilo
    context: '',
    language: 'english',
    formality: 'formal',
    tone: 'enthusiastic',
    creativity: '0.5',
    // Fase 5 · Opciones avanzadas
    addAnecdote: false,
    addMetrics: false,
    addressedTo: '',
  });
  const [draft, setDraft] = useState('');

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Invitado: 1 uso gratis
    if (isGuest && localStorage.getItem('guestUsed')) {
      window.location.href = '/login';
      return;
    }

    // Construir prompt con todos los campos
    let prompt = `Write a ${form.letterType} recommendation letter in ${
      form.language === 'spanish' ? 'Spanish' : 'English'
    }.`;
    prompt += ` Recommender: ${form.recName}, ${form.recTitle} at ${form.recOrg}, known for ${form.knownTime}.`;
    prompt += ` Applicant: ${form.applicant}.`;
    if (form.targetName) {
      prompt += ` Target: ${form.targetName}, position ${form.targetPosition}.`;
    }
    if (form.achievements) {
      prompt += ` Highlight these achievements: ${form.achievements}.`;
    }
    if (form.skills) {
      prompt += ` Include key skills: ${form.skills}.`;
    }
    if (form.qualities) {
      prompt += ` Emphasize personal qualities: ${form.qualities}.`;
    }
    prompt += ` Use a ${form.formality} and ${form.tone} tone.`;
    prompt += ` Creativity level: ${form.creativity}.`;
    if (form.addAnecdote) {
      prompt += ` Include a specific anecdote for illustration.`;
    }
    if (form.addMetrics) {
      prompt += ` Include quantitative metrics where possible.`;
    }
    if (form.addressedTo) {
      prompt += ` Address the letter to ${form.addressedTo}.`;
    }
    if (form.context) {
      prompt += ` Additional context: ${form.context}.`;
    }

    try {
      const rawRes: any = await (generateGptResponse as any)({ prompt } as any);
      const text = rawRes.text ?? '';
      setDraft(text);
      if (isGuest) {
        localStorage.setItem('guestUsed', '1');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'NO_CREDITS') {
        window.location.href = '/pricing?credits=0';
      } else {
        alert('Something went wrong.');
      }
    }
  };

  return (
    <main className="mx-auto max-w-xl py-20 px-6 space-y-6">
      <h1 className="text-3xl font-bold">Generate Recommendation Letter</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fase 1 · Tipo de carta */}
        <select
          name="letterType"
          value={form.letterType}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="academic">Academic (university admission)</option>
          <option value="job">Job / Employment</option>
          <option value="internship">Internship</option>
          <option value="scholarship">Scholarship / Financial Aid</option>
          <option value="immigration">Immigration / Visa</option>
          <option value="medical">Medical residency</option>
          <option value="volunteer">Volunteer / NGO</option>
          <option value="personal">Personal / Character</option>
        </select>

        {/* Fase 2 · Info del recomendador */}
        <input
          name="recName"
          placeholder="Your full name"
          value={form.recName}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="recTitle"
          placeholder="Your title / position"
          value={form.recTitle}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="recOrg"
          placeholder="Your organization / company"
          value={form.recOrg}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />
        <select
          name="relationship"
          value={form.relationship}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="manager">Manager</option>
          <option value="professor">Professor</option>
          <option value="colleague">Colleague</option>
          <option value="mentor">Mentor</option>
        </select>
        <select
          name="knownTime"
          value={form.knownTime}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="<1yr">Less than 1 yr</option>
          <option value="1-3yr">1–3 yrs</option>
          <option value=">3yr">More than 3 yrs</option>
        </select>

        {/* Fase 3 · Info del recomendado */}
        <input
          name="applicant"
          placeholder="Applicant name"
          value={form.applicant}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="targetName"
          placeholder="Target recipient name"
          value={form.targetName}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="targetPosition"
          placeholder="Target recipient position"
          value={form.targetPosition}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />
        <textarea
          name="achievements"
          placeholder="Key achievements (one per line)"
          value={form.achievements}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
          rows={3}
        />
        <textarea
          name="skills"
          placeholder="Key skills (comma separated)"
          value={form.skills}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
          rows={2}
        />
        <textarea
          name="qualities"
          placeholder="Personal qualities"
          value={form.qualities}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
          rows={2}
        />

        {/* Fase 4 · Tono y estilo */}
        <select
          name="context"
          value={form.context}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Additional context (optional)</option>
          <option value="context1">Context 1</option>
          <option value="context2">Context 2</option>
        </select>
        <select
          name="language"
          value={form.language}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="english">English</option>
          <option value="spanish">Español</option>
        </select>
        <select
          name="formality"
          value={form.formality}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="formal">Formal</option>
          <option value="semi-formal">Semi-formal</option>
          <option value="informal">Informal</option>
        </select>
        <select
          name="tone"
          value={form.tone}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        >
          <option value="enthusiastic">Enthusiastic</option>
          <option value="objective">Objective</option>
          <option value="academic">Academic</option>
          <option value="empathetic">Empathetic</option>
          <option value="corporate">Corporate</option>
        </select>
        <div>
          <label className="block mb-1">Creativity: {form.creativity}</label>
          <input
            type="range"
            name="creativity"
            min="0"
            max="1"
            step="0.1"
            value={form.creativity}
            onChange={handleChange}
            className="w-full"
          />
        </div>

        {/* Fase 5 · Opciones avanzadas */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="addAnecdote"
            checked={form.addAnecdote}
            onChange={handleChange}
          />
          Include a specific anecdote
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="addMetrics"
            checked={form.addMetrics}
            onChange={handleChange}
          />
          Include quantitative metrics
        </label>
        <input
          name="addressedTo"
          placeholder="Address to (e.g. Dr. Smith)"
          value={form.addressedTo}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2"
        />

        <button
          type="submit"
          className="w-full rounded bg-[#5B2D90] hover:bg-[#8B5E3C] text-white py-3 font-semibold"
        >
          Generate
        </button>
      </form>

      {draft && (
        <textarea
          className="mt-10 w-full h-64 border rounded p-4"
          value={draft}
          readOnly
        />
      )}
    </main>
  );
}
