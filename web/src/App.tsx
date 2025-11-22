import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import './App.css'

const GET_CONTAINERS = gql`
  query GetContainers {
    containers(limit: 50, offset: 0) {
      id
      name
      type
      capacityHUnits
      currentState {
        quantifiedComposition {
          qty
          unit
          attributes
        }
      }
      history {
        id
        type
        description
        timestamp
      }
    }
  }
`;

function App() {
  const { loading, error, data } = useQuery(GET_CONTAINERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const containers = data.containers;
  if (!containers.length) {
    return <p>No containers found.</p>;
  }

  const selected = containers.find((c: any) => c.id === selectedId) ?? containers[0];

  return (
    <div className="layout">
      <section className="list-panel">
        <h1>Containers</h1>
        <ul>
          {containers.map((c: any) => (
            <li key={c.id}>
              <button
                className={selected?.id === c.id ? 'list-item active' : 'list-item'}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="name">{c.name}</span>
                <span className="meta">
                  {c.type}
                  {c.currentState && ` · ${c.currentState.quantifiedComposition.qty} ${c.currentState.quantifiedComposition.unit}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="detail-panel">
        {selected ? (
          <>
            <h2>{selected.name}</h2>
            <p className="detail-type">{selected.type}</p>
            {selected.currentState ? (
              <div className="detail-state">
                <div>
                  <span className="label">Quantity</span>
                  <div className="value">
                    {selected.currentState.quantifiedComposition.qty} {selected.currentState.quantifiedComposition.unit}
                  </div>
                </div>
                <div>
                  <span className="label">Capacity</span>
                  <div className="value">{selected.capacityHUnits ?? '—'}</div>
                </div>
              </div>
            ) : (
              <p>No current state recorded.</p>
            )}
            <div className="detail-attrs">
              <span className="label">Attributes</span>
              <pre>{JSON.stringify(selected.currentState?.quantifiedComposition.attributes ?? {}, null, 2)}</pre>
            </div>
            <div className="detail-history">
              <span className="label">Recent Operations</span>
              {selected.history && selected.history.length ? (
                <ul>
                  {selected.history.slice(0, 5).map((op: any) => (
                    <li key={op.id}>
                      <strong>{op.type}</strong>
                      <span>{op.description || '—'}</span>
                      <time>{op.timestamp ? new Date(op.timestamp).toLocaleString() : 'unknown date'}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No operations recorded.</p>
              )}
            </div>
          </>
        ) : (
          <p>Select a container to view details.</p>
        )}
      </section>
    </div>
  )
}

export default App
