import { useEffect } from 'react';
import { goToFloor } from '../../actions';
import { refreshBuilding } from '../../net/floor';
import { useUi } from '../../state/store';
import { PanelHeader } from '../common';
import { Icon } from '../icons';

export function BuildingPanel({ elevator }: { elevator: boolean }) {
  const building = useUi((s) => s.building);
  const floor = useUi((s) => s.floor);

  useEffect(() => {
    void refreshBuilding();
    const t = setInterval(() => void refreshBuilding(), 5000);
    return () => clearInterval(t);
  }, []);

  const floors = (building?.floors ?? []).slice().sort((a, b) => b.level - a.level);
  return (
    <>
      <PanelHeader
        title={elevator ? 'Ascensor' : 'Edificio'}
        sub={elevator ? 'Elige a qué piso vas.' : 'Quién está en cada piso y qué salas están ocupadas.'}
      />
      <div className="tower">
        {floors.map((f) => {
          const here = f.id === floor?.id;
          const busy = Object.values(f.busyRooms).length;
          return (
            <div className={`lvl${here ? ' here' : ''}`} key={f.id} data-testid={`floor-${f.id}`}>
              <div className="n" style={{ background: f.cell?.color ?? '#6b7f99' }}>
                P{f.level}
              </div>
              <div className="t">
                <b>
                  {f.name} {f.isLocked && <Icon name="lock" size={13} />}
                </b>
                <span>
                  {f.online} {f.online === 1 ? 'persona' : 'personas'} ·{' '}
                  {busy ? `${busy} ${busy === 1 ? 'sala ocupada' : 'salas ocupadas'}` : 'Salas libres'}
                  {f.isLocked ? ' · Solo su célula' : ''}
                </span>
              </div>
              {here ? (
                <span className="chip">Aquí</span>
              ) : f.canEnter ? (
                <button className="btn sm primary" onClick={() => void goToFloor(f.id)}>
                  Ir
                </button>
              ) : (
                <span className="chip">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
