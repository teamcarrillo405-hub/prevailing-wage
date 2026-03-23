import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectForm } from '../components/projects/ProjectForm';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  contractType: string;
  fundingType: string;
  awardDate: string;
  status: string;
}

export function DashboardPage() {
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', showArchived ? 'all' : 'active'],
    queryFn: () => api.get<{ data: { projects: Project[] } }>(
      showArchived ? '/projects?status=all' : '/projects'
    ),
  });

  const projects = data?.data?.projects ?? [];

  return (
    <Layout>

<PageHeader
        title="Projects"
        action={
          <Button onClick={() => setShowForm(true)}>
            New Project
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
          />
          Show Archived
        </label>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="font-headline text-xl text-gray-900 mb-5">New Project</h3>
            <ProjectForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {isLoading && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-12 text-red-600 text-sm">
          Failed to load projects. Please refresh.
        </div>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          heading="No projects yet"
          message='Click "New Project" to create your first prevailing wage project.'
          action={
            <Button onClick={() => setShowForm(true)}>New Project</Button>
          }
        />
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </Layout>
  );
}
