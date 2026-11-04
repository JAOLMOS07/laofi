import {
  DELIVERY_FLOW,
  type DeliveryInfo,
  type DeliveryStatus,
  canAdvanceDelivery,
  canCreateDelivery,
} from '@laofi/shared';
import { useState } from 'react';
import { ApiError, api } from '../../net/api';
import { refreshDeliveries } from '../../net/floor';
import { actorFrom, useUi } from '../../state/store';
import { PanelHeader, timeStr } from '../common';

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  SENT: 'Enviadas',
  TESTING: 'En pruebas',
  APPROVED: 'Aprobadas',
  RETURNED: 'Devueltas',
};
const ACTION_LABEL: Record<DeliveryStatus, string> = {
  SENT: 'Reenviar a QA',
  TESTING: 'Tomar en pruebas',
  APPROVED: 'Aprobar',
  RETURNED: 'Devolver',
};
const ORDER: DeliveryStatus[] = ['SENT', 'TESTING', 'RETURNED', 'APPROVED'];

type Period = 'today' | 'week';

function inPeriod(d: DeliveryInfo, period: Period): boolean {
  if (d.status !== 'APPROVED' && d.status !== 'RETURNED') return true;
  if (period === 'week') return true;
  return new Date(d.updatedAt).toDateString() === new Date().toDateString();
}

function DeliveryCard({ d }: { d: DeliveryInfo }) {
  const me = useUi((s) => s.me);
  const toast = useUi((s) => s.toast);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const actions = me
    ? DELIVERY_FLOW[d.status].filter((to) =>
        canAdvanceDelivery(actorFrom(me), { ...d, fromCellId: d.fromCell.id }, to),
      )
    : [];

  const move = async (status: DeliveryStatus) => {
    try {
      await api('PATCH', `/deliveries/${d.id}/status`, {
        status,
        ...(status === 'RETURNED' && note.trim() ? { note: note.trim() } : {}),
      });
      setReturning(false);
    } catch (e) {
      toast({ title: 'No se pudo', text: e instanceof ApiError ? e.message : String(e), icon: 'x' });
      void refreshDeliveries();
    }
  };

  return (
    <div className={`dlv st-${d.status.toLowerCase()}`} data-testid="delivery">
      <div className="dlv-top">
        <i style={{ background: d.fromCell.color }} />
        <b>{d.externalId}</b>
        <span>{d.fromCell.name}</span>
        {d.source === 'DEMO' && <span className="pill demo">Demo</span>}
      </div>
      <p>{d.title}</p>
      {d.note && <p className="dlv-bug">{d.note}</p>}
      <small>
        {d.createdByName ? `${d.createdByName} · ` : ''}
        {timeStr(d.updatedAt)}
      </small>
      {!!actions.length && !returning && (
        <div className="row">
          {actions.map((to) => (
            <button
              key={to}
              className={`btn sm${to === 'RETURNED' ? '' : ' primary'}`}
              onClick={() => (to === 'RETURNED' ? setReturning(true) : void move(to))}
            >
              {ACTION_LABEL[to]}
            </button>
          ))}
        </div>
      )}
      {returning && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void move('RETURNED');
          }}
        >
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="¿Qué falló? Se ve como etiqueta de bug"
            aria-label="Motivo de la devolución"
            autoFocus
          />
          <div className="row">
            <button className="btn sm primary">Devolver</button>
            <button type="button" className="btn sm" onClick={() => setReturning(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NewDelivery() {
  const me = useUi((s) => s.me);
  const cells = useUi((s) => s.building?.cells ?? []);
  const [open, setOpen] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [title, setTitle] = useState('');
  const [cell, setCell] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!me || !canCreateDelivery(actorFrom(me))) return null;
  const isAdmin = me.role === 'ADMIN';
  const fromCellId = cell || me.cell?.id || '';

  const submit = async () => {
    setError(null);
    try {
      await api('POST', '/deliveries', {
        externalId,
        title,
        ...(isAdmin && fromCellId ? { fromCellId } : {}),
      });
      setExternalId('');
      setTitle('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  if (!open)
    return (
      <button className="btn primary" onClick={() => setOpen(true)} data-testid="delivery-new">
        Registrar entrega a QA
      </button>
    );
  return (
    <form
      className="stack dlv-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        className="input"
        value={externalId}
        onChange={(e) => setExternalId(e.target.value)}
        placeholder="ID del work item, por ejemplo HU-1302"
        aria-label="ID del work item"
        maxLength={40}
        required
        autoFocus
      />
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Qué se entrega"
        aria-label="Título"
        minLength={3}
        maxLength={160}
        required
      />
      {isAdmin && (
        <select
          className="input"
          value={fromCellId}
          onChange={(e) => setCell(e.target.value)}
          aria-label="Célula que entrega"
        >
          {cells
            .filter((c) => c.id !== 'qa')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      )}
      <div className="row">
        <button className="btn primary sm" data-testid="delivery-send">
          Enviar la caja
        </button>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export function DeliveriesPanel() {
  const list = useUi((s) => s.deliveries);
  const [period, setPeriod] = useState<Period>('today');
  const shown = list.filter((d) => inPeriod(d, period));
  const count = (s: DeliveryStatus) => shown.filter((d) => d.status === s).length;

  return (
    <>
      <PanelHeader title="Entregas a QA" sub="Cada entrega es una caja que viaja al muelle del piso de QA." />
      <div className="tabs">
        <button className={period === 'today' ? 'on' : ''} onClick={() => setPeriod('today')}>
          Hoy
        </button>
        <button className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>
          7 días
        </button>
        <button disabled title="Las fechas del sprint vendrían de Azure DevOps">
          Sprint
        </button>
      </div>
      <div className="dlv-counts">
        {ORDER.map((s) => (
          <div key={s} className={`st-${s.toLowerCase()}`}>
            <b>{count(s)}</b>
            <span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>
      <NewDelivery />
      <div className="stack dlv-list">
        {shown.length ? (
          ORDER.flatMap((s) => shown.filter((d) => d.status === s)).map((d) => (
            <DeliveryCard key={d.id} d={d} />
          ))
        ) : (
          <p className="hint">Sin entregas en este periodo.</p>
        )}
      </div>
    </>
  );
}
