import { useParams } from 'react-router-dom';
import { VarianceReportPage } from './VarianceReportPage';

export function VarianceReportPageRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <VarianceReportPage projectId={projectId} />;
}
