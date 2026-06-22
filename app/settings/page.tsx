'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [bodyweight, setBodyweight] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.bodyweight != null) setBodyweight(String(data.bodyweight));
        if (data.age != null) setAge(String(data.age));
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyweight: bodyweight ? parseFloat(bodyweight) : null,
          age: age ? parseInt(age) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3.5 text-base text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelClass = 'block text-sm font-medium text-gray-400 mb-1.5';

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Used to calculate strength tiers on the Body page.
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-5">
        <div>
          <label className={labelClass}>Bodyweight (kg)</label>
          <input
            type="number"
            min={20}
            max={300}
            step={0.1}
            placeholder="e.g. 80"
            value={bodyweight}
            onChange={(e) => setBodyweight(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Age</label>
          <input
            type="number"
            min={13}
            max={100}
            placeholder="e.g. 25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 rounded-lg bg-red-950/40 border border-red-800 px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full rounded-xl py-3.5 text-base font-semibold transition-colors ${
            saved
              ? 'bg-green-700 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50'
          }`}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <p className="text-xs text-gray-600 text-center">
        Strength standards are compared against common lifts for each muscle group.
      </p>
    </div>
  );
}
