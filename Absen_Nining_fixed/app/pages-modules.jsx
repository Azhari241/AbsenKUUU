// Modul: Hafalan, Tugas/PR, Keaktifan, Bebas Semester
function HafalanPage() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const [addT, setAddT] = useState(false); const [tTitle, setTTitle] = useState(''); const [busy, setBusy] = useState(false);
  const [editT, setEditT] = useState(null); const [delT, setDelT] = useState(null);
  if (!classes.length) return <NoClasses />;
  const students = data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ms = L.sortMeetings(data.meetings.filter(m => m.class_id === cid && m.semester_id === ctx.sem.id));
  const targets = data.memorization_targets.filter(t => t.class_id === cid && t.semester_id === ctx.sem.id);
  const recs = L.recordsFor('memorization_records', data, ms);
  const req = recs.filter(r => r.status !== 'bebas');
  const addTarget = async () => {
    if (tTitle.trim().length < 2) return;
    setBusy(true);
    try { await api.insert('memorization_targets', [{ class_id: cid, semester_id: ctx.sem.id, title: tTitle.trim(), description: '' }], 'Target hafalan'); setTTitle(''); setAddT(false); toast('Target hafalan ditambahkan.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub="Bebas Setor tidak dihitung sebagai nilai 100 dan tidak masuk penyebut ketuntasan. Setor hafalan diisi melalui Absensi.">
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <button className="btn btn-dark" onClick={() => setAddT(true)}><Icon n="plus" s={15} />Target hafalan</button>
      </PageHead>
      <div className="g g-stats">
        <div className="card stat"><span className="k">Ketuntasan kelas</span><span className="v">{L.fmtPct(L.pct(req.filter(r => r.status === 'setor').length, req.length))}</span><span className="s">{req.filter(r => r.status === 'setor').length} setor dari {req.length} kewajiban</span></div>
        <div className="card stat"><span className="k">Rata-rata nilai</span><span className="v">{L.avg(recs.filter(r => r.status === 'setor').map(r => r.score)) ?? '—'}</span><span className="s">hanya dari status Setor</span></div>
        <div className="card stat"><span className="k">Bebas Setor</span><span className="v">{recs.filter(r => r.status === 'bebas').length}</span><span className="s">berdasarkan catatan khusus</span></div>
        <div className="card stat"><span className="k">Target</span><span className="v">{targets.length}</span><span className="s">semester ini</span></div>
      </div>
      {addT && <div className="card card-pad row wrap" style={{ gap: 8 }}><input className="input grow" style={{ minWidth: 200 }} placeholder="mis. QS. An-Naba 1–10" value={tTitle} onChange={e => setTTitle(e.target.value)} autoFocus /><button className="btn" onClick={() => setAddT(false)}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={addTarget}>{busy && <span className="spin" />}Simpan target</button><p className="tiny muted" style={{ width: '100%' }}>Target dengan judul sama seperti "Materi" pertemuan akan otomatis terhubung saat menyimpan absensi.</p></div>}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h"><h3>Riwayat setor per pertemuan</h3><Legend items={[{ label: 'Setor', color: '#0f766e' }, { label: 'Belum', color: '#ef4444' }, { label: 'Izin', color: '#f59e0b' }, { label: 'Bebas', color: '#8b5cf6' }]} /></div>
        {ms.length && students.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Nama</th>{ms.map(m => <th key={m.id} className="c" title={m.topic}>P{m.number}</th>)}<th className="c">Tuntas</th><th className="c">Nilai</th></tr></thead>
          <tbody>{students.map(s => {
            const sr = recs.filter(r => r.student_id === s.id); const rq = sr.filter(r => r.status !== 'bebas');
            return <tr key={s.id}><td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.full_name}</td>
              {ms.map(m => { const r = sr.find(x => x.meeting_id === m.id); const c = r ? { setor: '#0f766e', belum: '#ef4444', izin: '#f59e0b', bebas: '#8b5cf6' }[r.status] : null; return <td key={m.id} className="c" title={r ? L.MEM[r.status] + (r.score != null ? ' · ' + r.score : '') : 'Belum diisi'}>{r ? <span style={{ display: 'inline-block', minWidth: 26, fontSize: 11, fontWeight: 700, color: '#fff', background: c, borderRadius: 5, padding: '2px 4px' }}>{r.status === 'setor' ? (r.score ?? '✓') : r.status === 'bebas' ? 'B' : r.status === 'izin' ? 'I' : '–'}</span> : <span className="muted">·</span>}</td>; })}
              <td className="c" style={{ fontWeight: 700 }}>{L.fmtPct(L.pct(sr.filter(r => r.status === 'setor').length, rq.length))}</td>
              <td className="c">{L.avg(sr.filter(r => r.status === 'setor').map(r => r.score)) ?? '—'}</td></tr>;
          })}</tbody></table></div> : <Empty icon="book" title="Belum ada data hafalan" text="Isi kolom Hafalan pada halaman Absensi untuk setiap pertemuan." />}
      </div>
      {targets.length > 0 && <div className="card"><div className="card-h"><h3>Target hafalan semester ini</h3></div>{targets.map(t => <div key={t.id} className="list-i"><Icon n="book" s={15} />
        {editT && editT.id === t.id ? <><input className="input input-sm grow" value={editT.title} onChange={e => setEditT({ ...editT, title: e.target.value })} autoFocus /><button className="btn btn-sm" onClick={() => setEditT(null)}>Batal</button><button className="btn btn-sm btn-dark" disabled={busy} onClick={async () => { if (editT.title.trim().length < 2) return; setBusy(true); try { await api.update('memorization_targets', t.id, { title: editT.title.trim() }, 'Ubah target hafalan'); toast('Target diperbarui.'); setEditT(null); } catch (e) { toast(DB.friendlyError(e), 'err'); } setBusy(false); }}>Simpan</button></>
          : <><span className="grow">{t.title}</span><span className="tiny muted">{recs.filter(r => r.target_id === t.id && r.status === 'setor').length} setor</span>
            <button className="btn btn-ghost btn-sm btn-icon" aria-label="Edit target" onClick={() => setEditT({ id: t.id, title: t.title })}><Icon n="edit" s={14} /></button>
            <button className="btn btn-ghost btn-sm btn-icon btn-danger" aria-label="Hapus target" onClick={() => setDelT(t)}><Icon n="trash" s={14} /></button></>}
      </div>)}</div>}
      {delT && <Confirm danger title="Hapus target hafalan?" confirmLabel="Hapus Permanen" onClose={() => setDelT(null)} message={<>Target <b>{delT.title}</b> akan dihapus. {recs.filter(r => r.target_id === delT.id).length} catatan setor yang memakai target ini <b>tetap tersimpan</b> beserta nilainya (hanya tautan targetnya dilepas).</>}
        onConfirm={async () => { try { await api.remove('memorization_targets', delT.id, 'Hapus target hafalan'); toast('Target dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}

function AssignmentModal({ classId, meetingId, assignment, onClose }) {
  const { data, api, ctx, v3 } = useApp(); const toast = useToast();
  const [f, setF] = useState(assignment ? { ...assignment, given_date: assignment.given_date || (assignment.created_at || '').slice(0, 10) || L.today(), teacher_note: assignment.teacher_note || '', student_ids: assignment.student_ids || [] } : { class_id: classId, title: '', description: '', given_date: L.today(), due_date: L.addDays(L.today(), 7), teacher_note: '', target: 'kelas', student_ids: [] });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const students = data.students.filter(s => s.class_id === f.class_id && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const save = async () => {
    const e = {};
    if (f.title.trim().length < 2) e.title = 'Judul tugas wajib diisi.';
    if (!f.due_date) e.due_date = 'Batas pengumpulan wajib diisi.';
    else if (f.given_date && f.given_date > f.due_date) e.due_date = 'Batas pengumpulan tidak boleh sebelum tanggal pemberian.';
    if (f.target === 'siswa' && !f.student_ids.length) e.target = 'Pilih minimal satu siswa.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const row = { class_id: f.class_id, semester_id: ctx.sem.id, meeting_id: meetingId || f.meeting_id || null, title: f.title.trim(), description: f.description.trim(), due_date: f.due_date, target: f.target, student_ids: f.target === 'siswa' ? f.student_ids : [], ...(v3 ? { given_date: f.given_date || null, teacher_note: (f.teacher_note || '').trim() } : {}) };
    try {
      let out;
      if (assignment) out = await api.update('assignments', assignment.id, row, 'Ubah tugas');
      else [out] = await api.insert('assignments', [row], 'Tugas baru ' + row.title);
      toast('Tugas tersimpan.'); onClose(out);
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  return (
    <Modal title={assignment ? 'Edit tugas' : 'Tugas / PR baru'} onClose={() => onClose(null)} footer={<><button className="btn" onClick={() => onClose(null)}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan tugas</button></>}>
      <div className="fg">
        <Field label="Judul" error={err.title} className="full"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Kelas"><select className="select" value={f.class_id} disabled={!!assignment} onChange={e => setF({ ...f, class_id: e.target.value, student_ids: [] })}>{data.classes.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        {v3 && <Field label="Tanggal pemberian"><input type="date" className="input" value={f.given_date} onChange={e => setF({ ...f, given_date: e.target.value })} /></Field>}
        <Field label="Batas pengumpulan" error={err.due_date}><input type="date" className="input" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label="Deskripsi" className="full"><textarea className="textarea" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        {v3 && <Field label="Catatan guru (tidak dicetak pada dokumen siswa)" className="full"><input className="input" value={f.teacher_note} onChange={e => setF({ ...f, teacher_note: e.target.value })} /></Field>}
        <Field label="Ditujukan untuk" error={err.target} className="full"><Seg value={f.target} onChange={v => setF({ ...f, target: v })} options={[{ v: 'kelas', l: 'Seluruh kelas' }, { v: 'siswa', l: 'Siswa tertentu' }]} /></Field>
        {f.target === 'siswa' && <div className="full row wrap" style={{ gap: 6, maxHeight: 180, overflow: 'auto' }}>{students.map(s => { const on = f.student_ids.includes(s.id); return <button key={s.id} type="button" className={'chip ' + (on ? 'on' : '')} onClick={() => setF({ ...f, student_ids: on ? f.student_ids.filter(x => x !== s.id) : [...f.student_ids, s.id] })}>{s.full_name}</button>; })}</div>}
      </div>
    </Modal>
  );
}

function TugasPage() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const [modal, setModal] = useState(null); const [open, setOpen] = useState(null); const [del, setDel] = useState(null);
  if (!classes.length) return <NoClasses />;
  const t = L.today();
  const list = data.assignments.filter(a => a.class_id === cid && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const allStud = data.students.filter(s => s.class_id === cid && s.status === 'aktif');
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub="Status & nilai tersimpan otomatis. Bisa juga diisi langsung di tabel Absensi. Rekap tugas tersedia di Rekap Data Siswa → Tugas.">
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tugas baru</button>
      </PageHead>
      {!list.length ? <div className="card"><Empty icon="clip" title="Belum ada tugas" text="Buat tugas atau PR, tetapkan tenggat, lalu catat pengumpulannya." action={<button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tugas baru</button>} /></div> :
        <div className="col" style={{ gap: 10 }}>{list.map(a => {
          const tgt = a.target === 'kelas' ? allStud : allStud.filter(s => (a.student_ids || []).includes(s.id));
          const rs = data.assignment_records.filter(r => r.assignment_id === a.id);
          const done = rs.filter(r => L.ASG_DONE.includes(r.status)).length, beb = rs.filter(r => r.status === 'bebas').length;
          const ungraded = rs.filter(r => L.ASG_DONE.includes(r.status) && r.score == null).length;
          const notDone = tgt.filter(st => { const r = rs.find(x => x.student_id === st.id); return !r || r.status === 'belum'; });
          const overdue = a.due_date < t;
          return (
            <div key={a.id} className="card">
              <div className="row wrap" style={{ padding: '14px 16px', gap: 12, cursor: 'pointer' }} onClick={() => setOpen(open === a.id ? null : a.id)}>
                <div className="col grow" style={{ gap: 3, minWidth: 200 }}>
                  <b>{a.title}</b>
                  <span className="tiny muted">{a.given_date ? 'Diberikan ' + L.fmtDate(a.given_date, false) + ' · ' : ''}Batas {L.fmtDate(a.due_date)} · {a.target === 'kelas' ? 'Seluruh kelas' : tgt.length + ' siswa'}</span>
                  {overdue && notDone.length > 0 && <span className="tiny" style={{ color: 'var(--danger)' }}>Belum menyelesaikan: {notDone.slice(0, 4).map(x => x.full_name).join(', ')}{notDone.length > 4 ? ' +' + (notDone.length - 4) : ''}</span>}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="badge teal">{done}/{tgt.length - beb} kumpul</span>
                  {beb > 0 && <span className="badge purple">{beb} bebas</span>}
                  {ungraded > 0 && <span className="badge warn">{ungraded} belum dinilai</span>}
                  {overdue && tgt.length - beb - done > 0 && <span className="badge red">{tgt.length - beb - done} belum</span>}
                  {!overdue && <span className="badge">Berjalan</span>}
                </div>
                <Icon n={open === a.id ? 'chevD' : 'chevR'} s={16} />
              </div>
              {open === a.id && <AssignmentRecords a={a} students={tgt} onEdit={() => setModal(a)} onDelete={() => setDel(a)} />}
            </div>
          );
        })}</div>}
      {modal && <AssignmentModal classId={cid} assignment={modal.id ? modal : null} onClose={() => setModal(null)} />}
      {del && (() => {
        const nRec = data.assignment_records.filter(r => r.assignment_id === del.id).length;
        const nScore = data.assignment_records.filter(r => r.assignment_id === del.id && r.score != null).length;
        const nNote = data.student_notes.filter(n => n.related_assignment_id === del.id).length;
        return <Confirm title="Hapus tugas permanen?" danger confirmLabel="Hapus Permanen" typeToConfirm={nRec ? 'HAPUS' : null} onClose={() => setDel(null)}
          message={<>Tugas <b>"{del.title}"</b> (tenggat {L.fmtDate(del.due_date, false)}) akan dihapus.</>}
          details={nRec || nNote ? <div className="alert warn"><Icon n="alert" s={16} /><div><ul style={{ margin: 0, paddingLeft: 18 }}>{nRec > 0 && <li>{nRec} catatan pengumpulan ({nScore} bernilai) ikut dihapus permanen</li>}{nNote > 0 && <li>{nNote} catatan khusus tetap ada, tautan ke tugas ini dilepas</li>}</ul><div className="tiny" style={{ marginTop: 4 }}>Rekap tugas & Perlu Perhatian dihitung ulang otomatis.</div></div></div> : null}
          onConfirm={async () => { try { await api.remove('assignments', del.id, 'Hapus tugas ' + del.title); toast('Tugas dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />;
      })()}
    </div>
  );
}
function AssignmentRecords({ a, students, onEdit, onDelete }) {
  const { data, api, v3 } = useApp();
  const as = useAutosave();
  const init = () => Object.fromEntries(students.map(s => { const r = data.assignment_records.find(x => x.assignment_id === a.id && x.student_id === s.id); return [s.id, { status: r ? r.status : '', score: r && r.score != null ? String(r.score) : '', comment: r ? r.comment || '' : '' }]; }));
  const [rows, setRows] = useState(init);
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const dataRef = useRef(data); dataRef.current = data;
  const exempt = s => data.student_notes.find(n => n.student_id === s.id && n.related_assignment_id === a.id && n.status === 'aktif' && ['bebas_tugas', 'perpanjangan', 'tugas_pengganti'].includes(n.type));
  const save = sid => async () => {
    const r = rowsRef.current[sid];
    if (r.score && !(+r.score >= 0 && +r.score <= 100)) throw Object.assign(new Error('Nilai harus 0–100.'), { validation: true });
    const ex = dataRef.current.assignment_records.find(x => x.assignment_id === a.id && x.student_id === sid);
    if (!r.status) { if (ex) await api.removeMany('assignment_records', [ex.id]); return; }
    const done = L.ASG_DONE.includes(r.status);
    await api.upsert('assignment_records', [{ assignment_id: a.id, student_id: sid, status: r.status, score: done && r.score !== '' ? Number(r.score) : null, comment: r.comment.trim(), submitted_at: done ? (ex && ex.submitted_at) || L.today() : null }], 'assignment_id,student_id');
  };
  const upd = (id, p, delay) => { const n = { ...rowsRef.current, [id]: { ...rowsRef.current[id], ...p } }; rowsRef.current = n; setRows(n); as.queue('asg:' + id, save(id), { delay }); };
  const OPTS = L.asgOptions(v3);
  return (
    <div style={{ borderTop: '1px solid var(--line2)' }}>
      {a.description && <p className="small muted" style={{ padding: '10px 16px 0' }}>{a.description}</p>}
      {a.teacher_note && <p className="tiny" style={{ padding: '6px 16px 0', color: 'var(--ink2)' }}><b>Catatan guru:</b> {a.teacher_note}</p>}
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Nama</th><th>Status</th><th className="c">Nilai</th><th>Komentar</th></tr></thead>
        <tbody>{students.map(s => { const r = rows[s.id]; const ex = exempt(s); if (!r) return null; return <tr key={s.id}>
          <td style={{ fontWeight: 600, minWidth: 160 }}>{s.full_name}{ex && <div className="tiny" style={{ color: '#6d28d9', fontWeight: 500 }}>{L.NOTE_TYPES[ex.type].label}: {ex.reason}</div>}</td>
          <td><select className="select input-sm" style={{ width: 170 }} value={r.status} onChange={e => upd(s.id, { status: e.target.value, score: L.ASG_DONE.includes(e.target.value) ? r.score : '' })}><option value="">— belum dicatat —</option>{OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td className="c">{L.ASG_DONE.includes(r.status) ? <input className="input input-sm" style={{ width: 64, textAlign: 'center' }} inputMode="numeric" placeholder="—" value={r.score} onChange={e => upd(s.id, { score: e.target.value }, 800)} /> : <span className="muted">—</span>}</td>
          <td><input className="input input-sm" style={{ minWidth: 140 }} value={r.comment} disabled={!r.status} placeholder={r.status ? '' : 'pilih status dulu'} onChange={e => upd(s.id, { comment: e.target.value }, 800)} /></td>
        </tr>; })}</tbody>
      </table></div>
      <div className="row between wrap" style={{ padding: 12, gap: 8 }}>
        <div className="row" style={{ gap: 6 }}><button className="btn btn-sm" onClick={onEdit}><Icon n="edit" s={13} />Edit tugas</button><button className="btn btn-sm btn-danger" onClick={onDelete}><Icon n="trash" s={13} />Hapus</button></div>
        <AutosaveIndicator s={as} idleText="Perubahan tersimpan otomatis" />
      </div>
    </div>
  );
}

function KeaktifanPage() {
  const { data, ctx } = useApp(); const { go } = useNav();
  const [cid, setCid, classes] = useClassPicker();
  if (!classes.length) return <NoClasses />;
  const max = ctx.settings.activity_scale_max;
  const students = data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ms = L.sortMeetings(data.meetings.filter(m => m.class_id === cid && m.semester_id === ctx.sem.id));
  const recs = L.recordsFor('activity_records', data, ms);
  const trend = ms.map(m => ({ x: 'P' + m.number, full: 'Pertemuan ' + m.number + ' · ' + L.fmtShort(m.date), avg: L.avg(recs.filter(r => r.meeting_id === m.id).map(r => r.score)) }));
  // Rekap bulanan: rata-rata skor per siswa per bulan
  const months = [...new Set(ms.map(m => m.date.slice(0, 7)))].sort();
  const mIdx = L.idx(ms);
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub={`Skala nilai 0–${max} (ubah di Pengaturan). Nilai keaktifan tidak dicampur dengan hafalan atau tugas.`}>
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <button className="btn btn-dark" onClick={() => go('absensi', { classId: cid })}><Icon n="star" s={15} />Nilai di pertemuan</button>
      </PageHead>
      <div className="card"><div className="card-h"><h3>Rata-rata keaktifan per pertemuan</h3></div><div style={{ padding: '12px 14px' }}>{trend.some(x => x.avg != null) ? <Chart data={trend} series={[{ k: 'avg', label: 'Rata-rata', color: '#8b5cf6' }]} yMax={max} height={190} /> : <NoData />}</div></div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h"><h3>Rekap per siswa</h3></div>
        {students.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Nama</th><th className="c">Penilaian</th><th className="c">Rata-rata</th><th style={{ width: '35%' }}>Sebaran</th><th>Catatan terakhir</th></tr></thead>
          <tbody>{students.map(s => { const sr = recs.filter(r => r.student_id === s.id && r.score != null); const av = L.avg(sr.map(r => r.score)); const lastNote = recs.filter(r => r.student_id === s.id && r.note).pop(); return <tr key={s.id}>
            <td style={{ fontWeight: 600 }}>{s.full_name}</td><td className="c">{sr.length}</td><td className="c" style={{ fontWeight: 700 }}>{av ?? '—'}</td>
            <td><div className="kbar" style={{ height: 8 }}><i style={{ width: ((av || 0) / max * 100) + '%', background: '#8b5cf6' }} /></div></td>
            <td className="small muted">{lastNote ? lastNote.note : '—'}</td></tr>; })}</tbody>
        </table></div> : <Empty title="Belum ada siswa" />}
      </div>
      {months.length > 0 && students.length > 0 && <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h"><h3>Rekap bulanan & semester</h3><span className="tiny muted">rata-rata skor 0–{max}</span></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Nama</th>{months.map(mo => <th key={mo} className="c">{L.BULAN[+mo.slice(5) - 1].slice(0, 3)} {mo.slice(0, 4)}</th>)}<th className="c">Semester</th></tr></thead>
          <tbody>{students.map(s => { const sr = recs.filter(r => r.student_id === s.id && r.score != null); return <tr key={s.id}><td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.full_name}</td>
            {months.map(mo => <td key={mo} className="c">{L.avg(sr.filter(r => mIdx[r.meeting_id].date.startsWith(mo)).map(r => r.score)) ?? <span className="muted">—</span>}</td>)}
            <td className="c" style={{ fontWeight: 700 }}>{L.avg(sr.map(r => r.score)) ?? '—'}</td></tr>; })}</tbody>
        </table></div>
      </div>}
    </div>
  );
}

// BebasPage dipindahkan ke app/pages-bebas.jsx

Object.assign(window, { HafalanPage, TugasPage, KeaktifanPage, AssignmentModal });
