// src/client/components/OtThresholdForm.tsx
// Form for setting per-project OT/DT thresholds.
// POSTs to /api/ot-thresholds/:projectId (create or update).
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Zod Schema (mirrors server) ────────────────────────────────────────────

const OtThresholdFormSchema = z.object({
  weeklyOtThreshold: z
    .number()
    .gt(0, { message: 'Must be > 0' }),
  dailyOtThreshold: z
    .number()
    .gt(0)
    .optional()
    .nullable(),
  source: z.enum(['cwhssa', 'cba', 'state']),
});

type OtThresholdFormValues = {
  weeklyOtThreshold: number;
  dailyOtThreshold?: number | null;
  source: 'cwhssa' | 'cba' | 'state';
};

// ── Types ──────────────────────────────────────────────────────────────────

interface SavedThreshold {
  id: string;
  weeklyOtThreshold: number;
  dailyOtThreshold: number | null;
  source: string;
}

interface OtThresholdFormProps {
  projectId: string;
  existingThreshold?: SavedThreshold | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function OtThresholdForm({ projectId, existingThreshold }: OtThresholdFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OtThresholdFormValues>({
    resolver: zodResolver(OtThresholdFormSchema) as any,
    defaultValues: {
      weeklyOtThreshold: existingThreshold?.weeklyOtThreshold ?? 40,
      dailyOtThreshold: existingThreshold?.dailyOtThreshold ?? null,
      source: (existingThreshold?.source as 'cwhssa' | 'cba' | 'state') ?? 'cwhssa',
    },
  });

  // Sync form values when existingThreshold loads after initial render
  useEffect(() => {
    if (existingThreshold) {
      reset({
        weeklyOtThreshold: existingThreshold.weeklyOtThreshold,
        dailyOtThreshold: existingThreshold.dailyOtThreshold ?? null,
        source: existingThreshold.source as 'cwhssa' | 'cba' | 'state',
      });
    }
  }, [existingThreshold, reset]);

  const mutation = useMutation({
    mutationFn: (data: OtThresholdFormValues) =>
      api.post<{ id: string }>(`/ot-thresholds/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ot-threshold', projectId] });
    },
  });

  function onSubmit(values: OtThresholdFormValues) {
    mutation.mutate(values);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
        OT Threshold Settings
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        CWHSSA standard: 40 hours/week. Daily trigger only applies for CBA-defined plans.
      </p>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
        {/* Weekly OT Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weekly OT Threshold (hours)
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            {...register('weeklyOtThreshold', { valueAsNumber: true })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
          />
          {errors.weeklyOtThreshold && (
            <p className="mt-1 text-xs text-red-600">{errors.weeklyOtThreshold.message}</p>
          )}
        </div>

        {/* Daily OT Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily OT Threshold (optional — for CBA plans only; CWHSSA does not use daily triggers)
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            placeholder="Leave blank for CWHSSA / no daily trigger"
            {...register('dailyOtThreshold', {
              setValueAs: (v: string) => (v === '' || v === null ? null : Number(v)),
            })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
          />
          {errors.dailyOtThreshold && (
            <p className="mt-1 text-xs text-red-600">{String(errors.dailyOtThreshold.message)}</p>
          )}
        </div>

        {/* Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Threshold Source
          </label>
          <select
            {...register('source')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
          >
            <option value="cwhssa">CWHSSA (federal default)</option>
            <option value="cba">CBA (collective bargaining agreement)</option>
            <option value="state">State law</option>
          </select>
          {errors.source && (
            <p className="mt-1 text-xs text-red-600">{errors.source.message}</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Threshold'}
          </button>
          {mutation.isSuccess && (
            <span className="text-xs text-green-600">Threshold saved.</span>
          )}
          {mutation.isError && (
            <span className="text-xs text-red-600">
              {(mutation.error as Error).message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
