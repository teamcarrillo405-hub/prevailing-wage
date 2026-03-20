import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Job name is required').max(200),
  state: z
    .string()
    .length(2, 'State must be a 2-letter code')
    .toUpperCase(),
  county: z.string().min(1, 'County is required'),
  contractType: z.enum(['federal-davis-bacon', 'state-prevailing', 'gsa-schedule', 'private'], {
    error: () => ({ message: 'Select a contract type' }),
  }),
  awardDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Award date must be YYYY-MM-DD'),
  fundingType: z.enum(['federal', 'state', 'mixed'], {
    error: () => ({ message: 'Select a funding type' }),
  }),
});

type ProjectFields = z.infer<typeof CreateProjectSchema>;

interface ProjectFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProjectForm({ onSuccess, onCancel }: ProjectFormProps) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFields>({ resolver: zodResolver(CreateProjectSchema) });

  async function onSubmit(data: ProjectFields) {
    setApiError(null);
    try {
      await api.post('/projects', data);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to create project');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <label htmlFor="proj-name" className="block text-sm font-medium text-gray-700 mb-1">
          Job name
        </label>
        <input
          id="proj-name"
          type="text"
          {...register('name')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
        />
        {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="proj-state" className="block text-sm font-medium text-gray-700 mb-1">
            State (2-letter)
          </label>
          <input
            id="proj-state"
            type="text"
            maxLength={2}
            placeholder="CA"
            {...register('state')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm uppercase focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          />
          {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state.message}</p>}
        </div>

        <div>
          <label htmlFor="proj-county" className="block text-sm font-medium text-gray-700 mb-1">
            County
          </label>
          <input
            id="proj-county"
            type="text"
            {...register('county')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          />
          {errors.county && <p className="text-red-600 text-xs mt-1">{errors.county.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="proj-contract-type" className="block text-sm font-medium text-gray-700 mb-1">
          Contract type
        </label>
        <select
          id="proj-contract-type"
          {...register('contractType')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
        >
          <option value="">Select contract type</option>
          <option value="federal-davis-bacon">Federal Davis-Bacon</option>
          <option value="state-prevailing">State Prevailing</option>
          <option value="gsa-schedule">GSA Schedule</option>
          <option value="private">Private</option>
        </select>
        {errors.contractType && (
          <p className="text-red-600 text-xs mt-1">{errors.contractType.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="proj-award-date" className="block text-sm font-medium text-gray-700 mb-1">
            Award date
          </label>
          <input
            id="proj-award-date"
            type="date"
            {...register('awardDate')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          />
          {errors.awardDate && (
            <p className="text-red-600 text-xs mt-1">{errors.awardDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="proj-funding-type" className="block text-sm font-medium text-gray-700 mb-1">
            Funding type
          </label>
          <select
            id="proj-funding-type"
            {...register('fundingType')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
          >
            <option value="">Select funding type</option>
            <option value="federal">Federal</option>
            <option value="state">State</option>
            <option value="mixed">Mixed</option>
          </select>
          {errors.fundingType && (
            <p className="text-red-600 text-xs mt-1">{errors.fundingType.message}</p>
          )}
        </div>
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-[#F5C518] text-gray-900 font-semibold py-2 px-4 rounded hover:bg-yellow-400 transition-colors disabled:opacity-60"
        >
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
