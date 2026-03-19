// src/client/components/UnionTradeForm.tsx
import { useForm } from 'react-hook-form';

interface TradeFormValues {
  tradeCode: string;
  tradeName: string;
  unionName?: string;
  baseRate: number;
  fringeRate: number;
}

interface Props {
  projectId: string;
  onSaved: () => void;
}

export function UnionTradeForm({ projectId, onSaved }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TradeFormValues>({
    defaultValues: { fringeRate: 0 },
  });

  async function onSubmit(values: TradeFormValues) {
    await fetch(`/api/union/${projectId}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(values),
    });
    reset();
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-white">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Trade Code</label>
        <input
          {...register('tradeCode', { required: 'Required' })}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
          placeholder="e.g. IRON"
        />
        {errors.tradeCode && <p className="text-red-600 text-xs mt-1">{errors.tradeCode.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Trade / Union Name</label>
        <input
          {...register('tradeName', { required: 'Required' })}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
          placeholder="e.g. Ironworkers Local 433"
        />
        {errors.tradeName && <p className="text-red-600 text-xs mt-1">{errors.tradeName.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Base Rate ($/hr, reference)</label>
        <input
          type="number" step="0.01"
          {...register('baseRate', { required: 'Required', valueAsNumber: true, min: 0 })}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Fringe Rate ($/hr, reference)</label>
        <input
          type="number" step="0.01"
          {...register('fringeRate', { valueAsNumber: true, min: 0 })}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#F5C518] text-black text-sm font-semibold px-4 py-2 rounded hover:bg-yellow-400 disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add Trade'}
        </button>
      </div>
    </form>
  );
}
