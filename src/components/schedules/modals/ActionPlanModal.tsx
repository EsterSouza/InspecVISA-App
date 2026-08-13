import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { ActionPlanPanel } from '../ActionPlanPanel';

interface ActionPlanModalProps {
  requestId: string;
  title: string;
  onClose: () => void;
}

export function ActionPlanModal({ requestId, title, onClose }: ActionPlanModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-plan-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl"
      >
        <CardContent className="p-6">
          <h3 id="action-plan-modal-title" className="mb-1 text-xl font-bold text-gray-900">
            Plano de ação no portal
          </h3>
          <p className="mb-6 text-sm text-gray-500">{title}</p>

          <ActionPlanPanel requestId={requestId} busy={false} />

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
