import { useNavigate } from 'react-router-dom';

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

interface ProjectCardProps {
  project: Project;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  'federal-davis-bacon': 'Federal Davis-Bacon',
  'state-prevailing': 'State Prevailing',
  'gsa-schedule': 'GSA Schedule',
  private: 'Private',
};

const FUNDING_TYPE_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  mixed: 'Mixed',
};

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-[#F5C518] hover:shadow-md transition-all group"
    >
      <h3 className="font-headline text-lg text-gray-900 mb-3 group-hover:text-gray-800 truncate">
        {project.name}
      </h3>

      <p className="text-sm text-gray-600 mb-3">
        {project.state} — {project.county}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-block text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
          {CONTRACT_TYPE_LABELS[project.contractType] ?? project.contractType}
        </span>
        <span className="inline-block text-xs font-medium px-2 py-0.5 bg-[#F5C518] text-gray-900 rounded">
          {FUNDING_TYPE_LABELS[project.fundingType] ?? project.fundingType}
        </span>
      </div>

      <p className="text-xs text-gray-500">
        Award date: {project.awardDate}
      </p>
    </button>
  );
}
