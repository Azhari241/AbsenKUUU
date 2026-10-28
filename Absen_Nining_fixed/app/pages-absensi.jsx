// Absensi & Pertemuan — tab Pertemuan, Siswa (catatan khusus), Rekap.
// MeetingEditor (absensi + autosave) ada di app/meeting-editor.jsx

function AbsensiPage({ params }) {
  const { data, ctx } = useApp();
  const [cid, setCid, classes] = useClassPicker(params.classId);
  const [tab, setTab] = useState(params.tab || 'pertemuan');
  if (!classes.length) return <NoClasses />;
  const cls = data.classes.find(c => c.id === cid);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="toolbar">
          <ClassSelect value={cid} onChange={setCid} classes={classes} />
          <span className="small muted">{data.students.filter(s => s.class_id === cid && s.status === 'aktif').length} siswa aktif</span>
        </div>
        <div className="seg">
          {[['pertemuan', 'Pertemuan'], ['siswa', 'Siswa & Catatan'], ['rekap', 'Rekap']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </div>
      {tab === 'pertemuan' && <MeetingEditor key={cid + (params.meetingId || '')} cls={cls} initialMeetingId={params.meetingId} />}
      {tab === 'siswa' && <ClassNotesTab cls={cls} />}
      {tab === 'rekap' && <ClassRekapTab cls={cls} />}
    </div>
  );
}

function ClassNotesTab({ cls }) {
  const { data } = useApp();
  const [add, setAdd] = useState(false);
  const [filter, setFilter] = useState('aktif');
  const notes = data.student_notes.filter(n => n.class_id === cls.id).map(n => ({ n, st: L.noteState(n, data.meetings) })).filter(x => filter === 'semua' || x.st === filter).sort((a, b) => a.n.created_at < b.n.created_at ? 1 : -1);
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <Seg value={filter} onChange={setFilter} options={[{ v: 'aktif', l: 'Aktif' }, { v: 'kedaluwarsa', l: 'Kedaluwarsa' }, { v: 'dicabut', l: 'Dicabut' }, { v: 'semua', l: 'Semua' }]} />
        <button className="btn btn-dark" onClick={() => setAdd(true)}><Icon n="plus" s={15} />Catatan khusus</button>
      </div>
      {notes.length ? <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>{notes.map(x => <NoteCard key={x.n.id} n={x.n} />)}</div>
        : <div className="card"><Empty icon="note" title="Tidak ada catatan" text="Catatan khusus (bebas setor, bebas tugas, remedial, izin khusus, dll.) akan muncul otomatis pada pertemuan yang termasuk masa berlakunya." /></div>}
      {add && <NoteModal classId={cls.id} onClose={() => setAdd(false)} />}
    </div>
  );
}

function ClassRekapTab({ cls }) {
  const { data, ctx } = useApp(); const { go } = useNav();
  const students = data.students.filter(s => s.class_id === cls.id && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const rows = students.map(s => ({ s, sum: L.studentSummary(data, s, ctx.sem.id) }));
  const meetings = data.meetings.filter(m => m.class_id === cls.id && m.semester_id === ctx.sem.id);
  if (!meetings.length) return <div className="card"><Empty icon="chart" title="Belum ada pertemuan" text="Rekap akan muncul setelah pertemuan pertama disimpan." /></div>;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h"><h3>Rekap {cls.name} · {meetings.length} pertemuan</h3></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>No</th><th>Nama</th>{L.ATT.map(a => <th key={a.k} className="c">{a.short}</th>)}<th className="c">Hadir %</th>{ctx.settings.hafalan && <th className="c">Hafalan</th>}{ctx.settings.tugas && <th className="c">Tugas</th>}{ctx.settings.keaktifan && <th className="c">Aktif</th>}</tr></thead>
        <tbody>{rows.map(({ s, sum }, i) => (
          <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => go('siswaDetail', { id: s.id })}>
            <td className="muted">{i + 1}</td><td style={{ fontWeight: 600 }}>{s.full_name}</td>
            {L.ATT.map(a => <td key={a.k} className="c">{sum.att[a.k] || <span className="muted">0</span>}</td>)}
            <td className="c" style={{ fontWeight: 700, color: sum.attPct != null && sum.attPct < ctx.settings.attendance_threshold ? 'var(--danger)' : undefined }}>{L.fmtPct(sum.attPct)}</td>
            {ctx.settings.hafalan && <td className="c">{L.fmtPct(sum.memPct)}</td>}
            {ctx.settings.tugas && <td className="c">{sum.asgTotal ? sum.asgDone + '/' + sum.asgTotal : '—'}</td>}
            {ctx.settings.keaktifan && <td className="c">{sum.actAvg ?? '—'}</td>}
          </tr>))}</tbody>
      </table></div>
    </div>
  );
}

Object.assign(window, { AbsensiPage });
