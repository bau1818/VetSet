import { Compass } from 'lucide-react';
import { EmptyState, LinkButton } from '../components/ui';

export function NotFound() {
  return <EmptyState icon={Compass} title="Page not found" body="That page doesn’t exist in VetSet Manager." action={<LinkButton to="/" variant="primary">Back to dashboard</LinkButton>} />;
}
