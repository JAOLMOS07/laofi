import { useUi } from '../../state/store';
import { AdminPanel } from './AdminPanel';
import { AgendaPanel } from './AgendaPanel';
import { AvatarPanel } from './AvatarPanel';
import { BuildingPanel } from './BuildingPanel';
import { DeliveriesPanel } from './DeliveriesPanel';
import { DirectoryPanel } from './DirectoryPanel';
import { EditPanel } from './EditPanel';
import { IntegrationsPanel } from './IntegrationsPanel';
import { NotesPanel } from './NotesPanel';
import { PersonPanel } from './PersonPanel';

export function PanelHost() {
  const panel = useUi((s) => s.panel);
  if (!panel) return null;
  return (
    <aside id="panel" className="glass" data-testid={`panel-${panel.kind}`}>
      {panel.kind === 'person' && panel.personId && <PersonPanel userId={panel.personId} />}
      {panel.kind === 'directory' && <DirectoryPanel />}
      {(panel.kind === 'building' || panel.kind === 'elevator') && (
        <BuildingPanel elevator={panel.kind === 'elevator'} />
      )}
      {panel.kind === 'notes' && <NotesPanel />}
      {panel.kind === 'edit' && <EditPanel />}
      {panel.kind === 'avatar' && <AvatarPanel />}
      {panel.kind === 'admin' && <AdminPanel />}
      {panel.kind === 'deliveries' && <DeliveriesPanel />}
      {panel.kind === 'agenda' && <AgendaPanel />}
      {panel.kind === 'integrations' && <IntegrationsPanel />}
    </aside>
  );
}
