import { useState } from 'react';
import { generateGptResponse } from 'wasp/client/operations';

export default function NewLetterPage() {
  const [form, setForm] = useState({ applicant: '', recommender: '', context: '' });
  const [draft, setDraft] = useState('');

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const prompt = `
      Write a ${form.context} recommendation letter.
      Recommender: ${form.recommender}.
      Applicant: ${form.applicant}.`;

    try {
        const rawRes: any = await (generateGptResponse as any)({ prompt } as any);
        const text = rawRes.text ?? '';
      setDraft(text);
    } catch (err) {
      if ((err as any)?.message === 'NO_CREDITS') window.location.href = '/pricing';
      else alert('Something went wrong.');
    }
  };

  return (
    <main className='mx-auto max-w-xl py-20 px-6'>
      <h1 className='text-3xl font-bold mb-8'>Generate Recommendation Letter</h1>

      <form onSubmit={handleSubmit} className='space-y-6'>
        <input
          name='applicant'
          placeholder='Applicant name'
          value={form.applicant}
          onChange={handleChange}
          className='w-full border rounded px-3 py-2'
        />
        <input
          name='recommender'
          placeholder='Your name / title'
          value={form.recommender}
          onChange={handleChange}
          className='w-full border rounded px-3 py-2'
        />
        <select
          name='context'
          value={form.context}
          onChange={handleChange}
          className='w-full border rounded px-3 py-2'
        >
          <option value=''>Select context…</option>
          <option value='academic'>Academic</option>
          <option value='professional'>Professional</option>
          <option value='character'>Character / Personal</option>
        </select>

        <button
          type='submit'
          className='w-full rounded bg-[#5B2D90] hover:bg-[#8B5E3C] text-white py-2 font-semibold'
        >
          Generate
        </button>
      </form>

      {draft && (
        <textarea
          className='mt-10 w-full h-64 border rounded p-4'
          value={draft}
          readOnly
        />
      )}
    </main>
  );
}
