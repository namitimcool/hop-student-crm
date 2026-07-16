import { useEffect, useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Layout from '../components/Layout';
import ShareFormModal from '../components/ShareFormModal';
import api from '../api/client';
import { asArray } from '../utils/safeData';

const STAGES = ['Shared', 'Interview Scheduled', 'Interview Done', 'Offer Made', 'Joined', 'Rejected', 'On Hold'];

export default function Sharing() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/shares');
      setShares(asArray(res.data));
    } catch (err) {
      console.error('Failed to load shares:', err);
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = STAGES.reduce((acc, stage) => {
    acc[stage] = asArray(shares).filter((s) => s.interviewStatus === stage);
    return acc;
  }, {});

  async function onDragEnd(result) {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;

    setShares((prev) => asArray(prev).map((s) => (s.id === draggableId ? { ...s, interviewStatus: newStatus } : s)));
    try {
      await api.put(`/shares/${draggableId}`, { interviewStatus: newStatus });
    } catch (err) {
      console.error('Failed to update share status:', err);
      load(); // re-sync with the server if the optimistic update didn't persist
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Candidate Sharing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Drag a card to update interview status, or share a new candidate.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-emerald"><Plus size={16} /> Share Candidate</button>
      </div>

      {loading ? (
        <div className="animate-pulse text-slate-400">Loading pipeline…</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <Droppable droppableId={stage} key={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-72 shrink-0 rounded-2xl p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-emerald-50' : 'bg-slate-100/70'}`}
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                      <h3 className="text-sm font-semibold text-navy-800">{stage}</h3>
                      <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full">{columns[stage].length}</span>
                    </div>
                    <div className="space-y-2 min-h-[4rem]">
                      {columns[stage].map((s, index) => (
                        <Draggable draggableId={s.id} index={index} key={s.id}>
                          {(dragProvided, dragSnapshot) => (
                            <Link
                              to={`/candidates/${s.candidateId}`}
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`block bg-white rounded-xl p-3 shadow-card border border-slate-100 ${dragSnapshot.isDragging ? 'ring-2 ring-emerald-400' : ''}`}
                            >
                              <div className="font-medium text-sm text-navy-900">{s.candidateName}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{s.companyName}{s.position ? ` · ${s.position}` : ''}</div>
                              {s.recruiter && <div className="text-xs text-slate-400 mt-1">Recruiter: {s.recruiter}</div>}
                            </Link>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      <ShareFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </Layout>
  );
}
