import { describe, expect, it } from 'vitest';
import {
  CreateMeetingSchema,
  type DeliveryActor,
  buildFloorGeometry,
  canAdvanceDelivery,
  canCreateDelivery,
  featureBlocks,
  floorFeatures,
  isWalkable,
  normalizeWorkItemUrl,
  parseCurrentWork,
  workItemIdFromUrl,
} from '../src/index.js';

const dev: DeliveryActor = { role: 'MEMBER', cellId: 'axis', cellType: 'DEV' };
const otherDev: DeliveryActor = { role: 'MEMBER', cellId: 'atlas', cellType: 'DEV' };
const qa: DeliveryActor = { role: 'MEMBER', cellId: 'qa', cellType: 'QA' };
const admin: DeliveryActor = { role: 'ADMIN', cellId: 'axis', cellType: 'DEV' };
const noCell: DeliveryActor = { role: 'MEMBER', cellId: null, cellType: null };

describe('reglas de entregas', () => {
  it('solo desarrollo y admins registran entregas', () => {
    expect(canCreateDelivery(dev)).toBe(true);
    expect(canCreateDelivery(admin)).toBe(true);
    expect(canCreateDelivery(qa)).toBe(false);
    expect(canCreateDelivery(noCell)).toBe(false);
  });

  it('QA lleva la caja por el flujo', () => {
    const sent = { fromCellId: 'axis', status: 'SENT' as const };
    const testing = { fromCellId: 'axis', status: 'TESTING' as const };
    expect(canAdvanceDelivery(qa, sent, 'TESTING')).toBe(true);
    expect(canAdvanceDelivery(qa, testing, 'APPROVED')).toBe(true);
    expect(canAdvanceDelivery(qa, testing, 'RETURNED')).toBe(true);
    expect(canAdvanceDelivery(dev, testing, 'APPROVED')).toBe(false);
  });

  it('no deja saltarse pasos ni reabrir lo aprobado', () => {
    expect(canAdvanceDelivery(admin, { fromCellId: 'axis', status: 'SENT' }, 'APPROVED')).toBe(false);
    expect(canAdvanceDelivery(admin, { fromCellId: 'axis', status: 'APPROVED' }, 'SENT')).toBe(false);
  });

  it('solo la célula de origen reenvía lo devuelto', () => {
    const returned = { fromCellId: 'axis', status: 'RETURNED' as const };
    expect(canAdvanceDelivery(dev, returned, 'SENT')).toBe(true);
    expect(canAdvanceDelivery(otherDev, returned, 'SENT')).toBe(false);
    expect(canAdvanceDelivery(qa, returned, 'SENT')).toBe(false);
  });
});

describe('despliegue', () => {
  const approved = { fromCellId: 'axis', status: 'APPROVED' as const };
  it('lo aprobado lo despliega la célula de origen, no QA ni otra célula', () => {
    expect(canAdvanceDelivery(dev, approved, 'DEPLOYED')).toBe(true);
    expect(canAdvanceDelivery(qa, approved, 'DEPLOYED')).toBe(false);
    expect(canAdvanceDelivery(otherDev, approved, 'DEPLOYED')).toBe(false);
    expect(canAdvanceDelivery(admin, approved, 'DEPLOYED')).toBe(true);
  });
  it('no se despliega sin aprobación de QA', () => {
    expect(canAdvanceDelivery(dev, { fromCellId: 'axis', status: 'TESTING' }, 'DEPLOYED')).toBe(false);
    expect(canAdvanceDelivery(admin, { fromCellId: 'axis', status: 'SENT' }, 'DEPLOYED')).toBe(false);
  });
});

describe('work items', () => {
  const link = 'https://dev.azure.com/empresa/proyecto/_workitems/edit/1302';
  it('acepta Azure DevOps y rechaza otros sitios', () => {
    expect(normalizeWorkItemUrl(link)).toBe(link);
    expect(normalizeWorkItemUrl('https://empresa.visualstudio.com/p/_workitems/edit/1')).toBeTruthy();
    expect(normalizeWorkItemUrl('https://evil.example.com/_workitems/edit/1')).toBeNull();
    expect(normalizeWorkItemUrl('https://dev.azure.com.evil.example.com/x')).toBeNull();
    expect(normalizeWorkItemUrl('http://dev.azure.com/x')).toBeNull();
    expect(normalizeWorkItemUrl('javascript:alert(1)')).toBeNull();
  });
  it('acepta un host propio solo si se configura', () => {
    const own = 'https://devops.empresa.com/x/_workitems/edit/9';
    expect(normalizeWorkItemUrl(own)).toBeNull();
    expect(normalizeWorkItemUrl(own, ['devops.empresa.com'])).toBe(own);
  });
  it('saca el id del link', () => {
    expect(workItemIdFromUrl(link)).toBe('1302');
    expect(workItemIdFromUrl('https://dev.azure.com/empresa')).toBeNull();
  });
  it('ignora datos guardados que no tengan la forma esperada', () => {
    expect(parseCurrentWork(null)).toBeNull();
    expect(parseCurrentWork({ activity: 'NADA', itemId: 'x' })).toBeNull();
    expect(parseCurrentWork({ activity: 'DEVELOPING', itemId: 'HU-1' })).toEqual({
      activity: 'DEVELOPING',
      itemId: 'HU-1',
      title: null,
      url: null,
    });
  });
});

describe('agenda', () => {
  const ok = { title: 'Daily', startsAt: '2026-11-04T14:00:00.000Z', durationMin: 30, roomId: 'libre' };
  it('valida la reunión', () => {
    expect(CreateMeetingSchema.safeParse(ok).success).toBe(true);
    expect(CreateMeetingSchema.safeParse({ ...ok, startsAt: 'mañana' }).success).toBe(false);
    expect(CreateMeetingSchema.safeParse({ ...ok, durationMin: 0 }).success).toBe(false);
  });
});

describe('instalaciones del piso', () => {
  it('el muelle bloquea el paso solo en el piso de QA', () => {
    const layout = { width: 30, depth: 22, spawn: { x: 15, y: 18 }, elevator: { x: 14, y: 19 } };
    const dock = floorFeatures('qa').dock!;
    const qaGrid = buildFloorGeometry(layout, [], [], [], featureBlocks('qa')).grid;
    const axisGrid = buildFloorGeometry(layout, [], [], [], featureBlocks('axis')).grid;
    expect(isWalkable(qaGrid, dock.x, dock.y)).toBe(false);
    expect(isWalkable(axisGrid, dock.x, dock.y)).toBe(true);
  });
});
