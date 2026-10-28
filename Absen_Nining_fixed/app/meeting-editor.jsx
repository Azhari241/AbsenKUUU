// ---------------------------------------------------------------------
// MeetingEditor — absensi dengan SIMPAN OTOMATIS ke Supabase.
// • Pilih status → langsung disimpan. Teks (menit, keterangan, materi, nilai) → debounce.
// • Pertemuan baru dibuat SEKALI (ensureMeeting: satu promise bersama) dan PASTI
//   selesai sebelum catatan absensi yang mengacu padanya dikirim (antrean serial).
// • Status yang tidak dipilih TIDAK diubah menjadi Alpa; mengosongkan status menghapus
//   catatan di server.
// • Konflik antarperangkat: perubahan lokal yang belum terkirim diutamakan; bila tidak ada
//   perubahan lokal tertunda, nilai terbaru dari server (perangkat lain) ditampilkan saat sinkron.
// ---------------------------------------------------------------------
const MODS = [{ k: 'hafalan', l: 'Hafalan' }, { k: 'tugas', l: 'Tugas' }, { k: 'keaktifan', l: 'Keaktifan' }];

function MeetingEditor({ cls, initialMeetingId }) {
  const { data, ctx, api, v3 } = useApp();
  const toast = useToast();
  const as = useAutosave();
  const s = ctx.settings;
  const meetings = L.sortMeetings(data.meetings.filter(m => m.class_id === cls.id && m.semester_id === ctx.sem.id));
  const todays = meetings.filter(m => m.date === L.today());
  const [mid, setMid] = useState(() => initialMeetingId || (todays.length ? todays[todays.length - 1].id : 'new'));
  const meeting = meetings.find(m => m.id === mid) || null;
  const students = data.students.filter(x => x.class_id === cls.id && x.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const nextNum = (meetings.length ? Math.max(...meetings.map(m => m.number)) : 0) + 1;

  const [form, setForm] = useState(null);
  const [rows, setRows] = useState({});
  const [asgId, setAsgId] = useState('');
  const [q, setQ] = useState('');
  const [errs, setErrs] = useState({});
  const [noteFor, setNoteFor] = useState(null);
  const [newAsg, setNewAsg] = useState(false);
  const [editMeeting, setEditMeeting] = useState(false); const [delMeeting, setDelMeeting] = useState(false);
  const [ver, setVer] = useState(0);

  // Ref berisi nilai terbaru — job autosave membaca dari sini saat benar-benar dikirim.
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const formRef = useRef(form); formRef.current = form;
  const dataRef = useRef(data); dataRef.current = data;
  const asgRef = useRef(asgId); asgRef.current = asgId;
  const meetingIdRef = useRef(meeting ? meeting.id : null);
  const creating = useRef(null);
  const skipInit = useRef(false);
  const known = useRef({}); // updated_at terakhir per rekaman (deteksi perubahan dari perangkat lain)

  const rowFrom = (st, m, notes) => {
    const d = dataRef.current;
    const a = m && d.attendance_records.find(x => x.meeting_id === m.id && x.student_id === st.id);
    const h = m && d.memorization_records.find(x => x.meeting_id === m.id && x.student_id === st.id);
    const k = m && d.activity_records.find(x => x.meeting_id === m.id && x.student_id === st.id);
    const bebasH = notes.some(n => n.student_id === st.id && n.type === 'bebas_hafalan');
    return {
      status: a ? a.status : '', late: a && a.late_minutes != null ? String(a.late_minutes) : '', note: a ? a.note || '' : '',
      mem: h ? h.status : (bebasH ? 'bebas' : ''), memScore: h && h.score != null ? String(h.score) : '', memComment: h ? h.comment || '' : '',
      act: k && k.score != null ? String(k.score) : '', actNote: k ? k.note || '' : '', asg: '', asgScore: '',
    };
  };

  useEffect(() => {
    if (skipInit.current) { skipInit.current = false; return; } // pertemuan baru saja dibuat di sini
    const m = meeting;
    meetingIdRef.current = m ? m.id : null; creating.current = null;
    const mods = m ? Object.fromEntries(MODS.map(x => { const mm = data.meeting_modules.find(r => r.meeting_id === m.id && r.module === x.k); return [x.k, mm ? mm.enabled : false]; }))
      : Object.fromEntries(MODS.map(x => [x.k, !!s[x.k]]));
    const f = m ? { date: m.date, number: String(m.number), topic: m.topic || '', notes: m.notes || '', mods } : { date: L.today(), number: String(nextNum), topic: '', notes: '', mods };
    setForm(f); formRef.current = f;
    const notes = L.activeNotesFor(data, m || { class_id: cls.id, date: f.date, number: +f.number });
    const r = {}; known.current = {};
    for (const st of students) r[st.id] = rowFrom(st, m, notes);
    if (m) for (const t of ['attendance_records', 'memorization_records', 'activity_records']) data[t].filter(x => x.meeting_id === m.id).forEach(x => { known.current[t + x.student_id] = x.updated_at; });
    setRows(r); rowsRef.current = r;
    const relevant = data.assignments.filter(a => a.class_id === cls.id && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
    const due = relevant.find(a => a.due_date <= f.date) || relevant[0];
    setAsgId(due ? due.id : '');
    setErrs({});
  }, [mid, cls.id, ver]);

  // Sinkron dari server untuk siswa yang TIDAK punya perubahan lokal tertunda.
  useEffect(() => {
    const m = meetingIdRef.current; if (!m || !formRef.current) return;
    const map = { attendance_records: 'att', memorization_records: 'mem', activity_records: 'act' };
    const ids = new Set();
    for (const t of Object.keys(map)) for (const x of data[t].filter(r => r.meeting_id === m)) {
      const kk = t + x.student_id;
      if (known.current[kk] !== x.updated_at) { known.current[kk] = x.updated_at; if (!as.isPending(map[t] + ':' + x.student_id)) ids.add(x.student_id); }
    }
    if (!ids.size) return;
    const mObj = data.meetings.find(x => x.id === m); if (!mObj) return;
    const notes = L.activeNotesFor(data, mObj);
    setRows(prev => { const n = { ...prev }; ids.forEach(id => { const st = students.find(x => x.id === id); if (st && n[id]) n[id] = { ...rowFrom(st, mObj, notes), asg: n[id].asg, asgScore: n[id].asgScore }; }); rowsRef.current = n; return n; });
  }, [data.attendance_records, data.memorization_records, data.activity_records]);

  // Kolom tugas dari rekaman tersimpan
  useEffect(() => {
    if (!asgId) return;
    setRows(prev => {
      const r = { ...prev };
      for (const st of students) {
        if (as.isPending('asg:' + st.id) || !r[st.id]) continue;
        const rec = data.assignment_records.find(x => x.assignment_id === asgId && x.student_id === st.id);
        const bebasT = data.student_notes.some(n => n.student_id === st.id && n.type === 'bebas_tugas' && n.related_assignment_id === asgId && n.status === 'aktif');
        r[st.id] = { ...r[st.id], asg: rec ? rec.status : (bebasT ? 'bebas' : ''), asgScore: rec && rec.score != null ? String(rec.score) : '' };
      }
      rowsRef.current = r; return r;
    });
  }, [asgId, mid, data.assignment_records]);

  // ---------- Penyimpanan ----------
  const vErr = msg => Object.assign(new Error(msg), { validation: true, friendly: true });
  const meetingRow = () => {
    const f = formRef.current; const n = Number(f.number);
    if (!f.date) throw vErr('Tanggal pertemuan wajib diisi.');
    if (!Number.isInteger(n) || n < 1) throw vErr('Nomor pertemuan harus bilangan bulat ≥ 1.');
    const clash = dataRef.current.meetings.find(m => m.class_id === cls.id && m.semester_id === ctx.sem.id && m.number === n && m.id !== meetingIdRef.current);
    if (clash) throw vErr('Nomor pertemuan ' + n + ' sudah dipakai (' + L.fmtDate(clash.date, false) + ').');
    return { class_id: cls.id, semester_id: ctx.sem.id, date: f.date, number: n, topic: f.topic.trim(), notes: f.notes.trim() };
  };
  // Membuat pertemuan tepat satu kali walau banyak perubahan datang bersamaan.
  const ensureMeeting = async () => {
    if (meetingIdRef.current) return meetingIdRef.current;
    if (!creating.current) {
      creating.current = (async () => {
        const row = meetingRow();
        const [m] = await api.insert('meetings', [row], 'Pertemuan baru ' + row.number + ' ' + cls.name);
        meetingIdRef.current = m.id; skipInit.current = true; setMid(m.id);
        const f = formRef.current;
        await api.upsert('meeting_modules', [{ meeting_id: m.id, module: 'absensi', enabled: true }, ...MODS.map(x => ({ meeting_id: m.id, module: x.k, enabled: !!f.mods[x.k] }))], 'meeting_id,module');
        return m.id;
      })();
      creating.current.catch(() => { if (!meetingIdRef.current) creating.current = null; });
    }
    return creating.current;
  };
  const existing = (table, mId, sid) => dataRef.current[table].find(r => r.meeting_id === mId && r.student_id === sid);
  const saveAtt = sid => async () => {
    const r = rowsRef.current[sid];
    if (r.late && !(+r.late >= 0 && +r.late <= 600)) throw vErr('Menit terlambat harus 0–600.');
    const mId = await ensureMeeting();
    if (!r.status) { const ex = existing('attendance_records', mId, sid); if (ex) await api.removeMany('attendance_records', [ex.id]); return; }
    const [out] = await api.upsert('attendance_records', [{ meeting_id: mId, student_id: sid, status: r.status, late_minutes: r.status === 'terlambat' && r.late !== '' ? Number(r.late) : null, note: r.note.trim() }], 'meeting_id,student_id');
    if (out) known.current['attendance_records' + sid] = out.updated_at;
  };
  const saveMem = sid => async () => {
    const r = rowsRef.current[sid];
    if (r.memScore && !(+r.memScore >= 0 && +r.memScore <= 100)) throw vErr('Nilai hafalan harus 0–100.');
    const mId = await ensureMeeting();
    if (!r.mem) { const ex = existing('memorization_records', mId, sid); if (ex) await api.removeMany('memorization_records', [ex.id]); return; }
    const target = dataRef.current.memorization_targets.find(t => t.class_id === cls.id && t.semester_id === ctx.sem.id && t.title === formRef.current.topic);
    const [out] = await api.upsert('memorization_records', [{ meeting_id: mId, student_id: sid, target_id: target ? target.id : null, status: r.mem, score: r.mem === 'setor' && r.memScore !== '' ? Number(r.memScore) : null, comment: r.memComment.trim() }], 'meeting_id,student_id');
    if (out) known.current['memorization_records' + sid] = out.updated_at;
  };
  const saveAct = sid => async () => {
    const r = rowsRef.current[sid];
    if (r.act !== '' && !(+r.act >= 0 && +r.act <= s.activity_scale_max)) throw vErr('Nilai keaktifan harus 0–' + s.activity_scale_max + '.');
    const mId = await ensureMeeting();
    if (r.act === '' && !r.actNote) { const ex = existing('activity_records', mId, sid); if (ex) await api.removeMany('activity_records', [ex.id]); return; }
    const [out] = await api.upsert('activity_records', [{ meeting_id: mId, student_id: sid, score: r.act !== '' ? Number(r.act) : null, note: r.actNote.trim() }], 'meeting_id,student_id');
    if (out) known.current['activity_records' + sid] = out.updated_at;
  };
  const saveAsg = sid => async () => {
    const r = rowsRef.current[sid]; const aId = asgRef.current; if (!aId) return;
    if (r.asgScore && !(+r.asgScore >= 0 && +r.asgScore <= 100)) throw vErr('Nilai tugas harus 0–100.');
    const ex = dataRef.current.assignment_records.find(x => x.assignment_id === aId && x.student_id === sid);
    if (!r.asg) { if (ex) await api.removeMany('assignment_records', [ex.id]); return; }
    const done = L.ASG_DONE.includes(r.asg);
    await api.upsert('assignment_records', [{ assignment_id: aId, student_id: sid, status: r.asg, score: done && r.asgScore !== '' ? Number(r.asgScore) : null, submitted_at: done ? formRef.current.date : null, comment: ex ? ex.comment || '' : '' }], 'assignment_id,student_id');
  };
  const saveMeeting = async () => {
    const row = meetingRow(); setErrs({});
    if (!meetingIdRef.current) { await ensureMeeting(); return; }
    await api.update('meetings', meetingIdRef.current, row);
  };
  const saveMods = async () => {
    const mId = await ensureMeeting(); const f = formRef.current;
    await api.upsert('meeting_modules', MODS.map(x => ({ meeting_id: mId, module: x.k, enabled: !!f.mods[x.k] })), 'meeting_id,module');
  };

  const TEXT = 800;
  const upd = (sid, patch, kind, delay) => {
    const n = { ...rowsRef.current, [sid]: { ...rowsRef.current[sid], ...patch } };
    rowsRef.current = n; setRows(n);
    const job = { att: saveAtt, mem: saveMem, act: saveAct, asg: saveAsg }[kind];
    as.queue(kind + ':' + sid, job(sid), { delay });
  };
  const useMod = k => !!(s[k] && formRef.current && formRef.current.mods[k]);
  const setStatus = (sid, st) => {
    const cur = rowsRef.current[sid];
    // Klik status yang sama → kosongkan (catatan di server dihapus, TIDAK diubah menjadi Alpa).
    if (cur.status === st) { upd(sid, { status: '', late: '' }, 'att'); return; }
    upd(sid, st !== 'terlambat' ? { status: st, late: '' } : { status: st }, 'att');
    // Siswa tidak hadir: hafalan "izin" untuk izin/sakit; keaktifan dikosongkan.
    if (!['hadir', 'terlambat'].includes(st)) {
      if (useMod('hafalan') && cur.mem !== 'bebas') { const mem = (st === 'izin' || st === 'sakit') ? 'izin' : (cur.mem === 'setor' ? '' : cur.mem); if (mem !== cur.mem) upd(sid, { mem, memScore: '' }, 'mem'); }
      if (useMod('keaktifan') && cur.act !== '') upd(sid, { act: '' }, 'act');
    }
  };
  const bulk = st => { for (const x of students) if (rowsRef.current[x.id] && rowsRef.current[x.id].status !== st) upd(x.id, { status: st, late: '' }, 'att'); };
  const fillEmpty = () => { for (const x of students) if (rowsRef.current[x.id] && !rowsRef.current[x.id].status) upd(x.id, { status: 'hadir' }, 'att'); };
  const setF = (k, v) => {
    const n = { ...formRef.current, [k]: v }; formRef.current = n; setForm(n);
    if (k === 'mods') as.queue('mods', saveMods);
    else as.queue('meeting', async () => { try { await saveMeeting(); } catch (e) { if (e.validation) setErrs({ [k === 'number' ? 'number' : 'date']: e.message }); throw e; } }, { delay: k === 'date' ? 300 : TEXT });
  };

  if (!form) return <Spinner />;
  const probe = meeting || { class_id: cls.id, date: form.date, number: Number(form.number) };
  const activeNotes = L.activeNotesFor(data, probe).filter(n => students.some(st => st.id === n.student_id));
  const noteBy = sid => activeNotes.filter(n => n.student_id === sid);
  const asgOptions = data.assignments.filter(a => a.class_id === cls.id && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const assignment = asgOptions.find(a => a.id === asgId);
  const asgTargets = assignment ? (assignment.target === 'kelas' ? null : new Set(assignment.student_ids || [])) : null;
  const ASG_OPTS = L.asgOptions(v3);

  const filled = students.filter(x => rows[x.id] && rows[x.id].status).length;
  const counts = L.attCounts(students.map(x => rows[x.id]).filter(r => r && r.status));
  const filtered = students.filter(x => x.full_name.toLowerCase().includes(q.toLowerCase()));

  const doPrint = () => {
    const mods = [useMod('hafalan') && 'Hafalan', useMod('tugas') && assignment && 'Tugas', useMod('keaktifan') && 'Keaktifan'].filter(Boolean);
    EXP.print({
      title: 'DAFTAR HADIR SISWA', subtitle: `Pertemuan ${form.number} · ${L.fmtDate(form.date)} · ${form.topic || 'Materi belum diisi'}`,
      meta: docMeta(ctx, { className: cls.name, period: L.fmtDate(form.date, false) }),
      columns: [{ h: 'No', w: .5, align: 'center' }, { h: 'NIS', w: 1.2, align: 'center' }, { h: 'Nama Siswa', w: 3.2 }, { h: 'L/P', w: .5, align: 'center' }, { h: 'Kehadiran', w: 1.4, align: 'center' }, ...mods.map(m => ({ h: m, w: 1.2, align: 'center' })), { h: 'Keterangan', w: 2 }],
      rows: students.map((x, i) => { const r = rows[x.id]; return [i + 1, x.nis || '—', x.full_name, x.gender, r.status ? L.ATT_MAP[r.status].label + (r.late ? ` (${r.late} mnt)` : '') : '—', ...(useMod('hafalan') ? [(L.MEM[r.mem] || '—') + (r.memScore ? ' · ' + r.memScore : '')] : []), ...(useMod('tugas') && assignment ? [(L.ASG[r.asg] || '—') + (r.asgScore ? ' · ' + r.asgScore : '')] : []), ...(useMod('keaktifan') ? [r.act || '—'] : []), r.note]; }),
      foot: ['', '', 'Jumlah', '', L.ATT.map(a => a.short + ':' + counts[a.k]).join(' '), ...mods.map(() => ''), ''],
      signatures: docSigs(ctx, { teacher: true }), filename: L.fileSafe(['Daftar_Hadir', cls.name, 'P' + form.number, form.date]),
    });
  };
  const idxM = meetings.findIndex(m => m.id === mid);
  const goMeeting = async id => {
    if (as.hasPending()) { await as.flush(); if (as.hasPending()) { toast('Masih ada perubahan yang gagal disimpan. Tekan "Coba lagi" sebelum pindah pertemuan.', 'err'); return; } }
    setMid(id);
  };
  const idle = meeting ? 'Tersimpan di database' : 'Pertemuan baru — dibuat otomatis saat Anda mengisi';

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-icon" aria-label="Pertemuan sebelumnya" disabled={mid === 'new' ? !meetings.length : idxM <= 0} onClick={() => goMeeting(mid === 'new' ? meetings[meetings.length - 1].id : meetings[idxM - 1].id)}><Icon n="chevL" /></button>
            <select className="select" style={{ width: 'auto', minWidth: 220, maxWidth: '100%' }} value={mid} onChange={e => goMeeting(e.target.value)} aria-label="Pilih pertemuan">
              <option value="new">+ Pertemuan baru (ke-{nextNum})</option>
              {[...meetings].reverse().map(m => <option key={m.id} value={m.id}>Pertemuan {m.number} · {L.fmtDate(m.date)}</option>)}
            </select>
            <button className="btn btn-icon" aria-label="Pertemuan berikutnya" disabled={mid === 'new' || idxM === meetings.length - 1} onClick={() => goMeeting(meetings[idxM + 1].id)}><Icon n="chevR" /></button>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <AutosaveIndicator s={as} idleText={idle} />
            {meeting && <>
              <button className="btn btn-icon desk-only" title="Edit pertemuan" aria-label="Edit pertemuan" onClick={() => setEditMeeting(true)}><Icon n="edit" s={15} /></button>
              <button className="btn btn-icon btn-danger desk-only" title="Hapus pertemuan" aria-label="Hapus pertemuan" onClick={() => setDelMeeting(true)}><Icon n="trash" s={15} /></button>
              <span className="mobile-only"><ActionMenu items={[{ label: 'Edit pertemuan', icon: 'edit', onClick: () => setEditMeeting(true) }, { label: 'Hapus pertemuan', icon: 'trash', danger: true, onClick: () => setDelMeeting(true) }]} /></span>
            </>}
            <button className="btn" onClick={doPrint}><Icon n="print" s={15} />Cetak</button>
            <button className="btn desk-only" title="Opsional — perubahan sudah tersimpan otomatis" disabled={!as.hasPending()} onClick={() => as.flush()}><Icon n="save" s={15} />Simpan sekarang</button>
          </div>
        </div>
        <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 14, gap: 10 }}>
          <Field label="Tanggal" error={errs.date}><input type="date" className="input" value={form.date} onChange={e => setF('date', e.target.value)} /></Field>
          <Field label="Nomor pertemuan" error={errs.number}><input type="number" min="1" className={'input ' + (errs.number ? 'err' : '')} value={form.number} onChange={e => setF('number', e.target.value)} /></Field>
          <Field label="Materi"><input className="input" value={form.topic} onChange={e => setF('topic', e.target.value)} placeholder="mis. Mufradat: Al-Usrah" /></Field>
          <Field label="Catatan umum"><input className="input" value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="opsional" /></Field>
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <span className="lbl" style={{ marginRight: 4 }}>Modul pertemuan:</span>
          <span className="chip on" style={{ '--c': 'var(--ink)', cursor: 'default' }}>Absensi</span>
          {MODS.filter(x => s[x.k]).map(x => <button key={x.k} className={'chip ' + (form.mods[x.k] ? 'on' : '')} style={{ '--c': 'var(--teal)' }} onClick={() => setF('mods', { ...form.mods, [x.k]: !form.mods[x.k] })}>{form.mods[x.k] ? '✓ ' : ''}{x.l}</button>)}
          {useMod('tugas') && <>
            <span className="lbl" style={{ marginLeft: 8 }}>Tugas diperiksa:</span>
            <select className="select input-sm" style={{ width: 'auto', minWidth: 160 }} value={asgId} onChange={e => setAsgId(e.target.value)}>
              <option value="">— tidak ada —</option>
              {asgOptions.map(a => <option key={a.id} value={a.id}>{a.title} · {L.fmtShort(a.due_date)}</option>)}
            </select>
            <button className="btn btn-sm" onClick={() => setNewAsg(true)}><Icon n="plus" s={13} />Tugas</button>
          </>}
        </div>
        {as.status === 'error' && as.err && <div className="alert err" style={{ marginTop: 12 }}><Icon n="alert" s={16} /><div><b>Perubahan belum tersimpan.</b> {as.err} <button className="link" onClick={as.retry}>Coba lagi</button></div></div>}
      </div>

      <ActiveNotesBanner notes={activeNotes} />

      {!students.length ? <div className="card"><Empty icon="users" title="Belum ada siswa di kelas ini" text="Tambahkan siswa melalui menu Data Siswa." /></div> : <>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="toolbar">
            <div className="search" style={{ width: 220 }}><Icon n="search" s={15} /><input className="input" placeholder="Cari nama siswa…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <button className="btn btn-sm" onClick={() => bulk('hadir')}><Icon n="check" s={14} />Semua Hadir</button>
            <button className="btn btn-sm" onClick={fillEmpty} title="Isi siswa yang belum diisi dengan Hadir"><Icon n="zap" s={14} />Isi kosong = Hadir</button>
          </div>
          <span className="small muted">{filled}/{students.length} terisi{filled < students.length && ' · yang kosong tidak dihitung'} · klik status terpilih untuk mengosongkan</span>
        </div>

        <div className="card att-desk" style={{ overflow: 'hidden' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th className="c" style={{ width: 40 }}>No</th><th>Nama Siswa</th><th className="c">L/P</th>
                {L.ATT.map(a => <th key={a.k} className="c" style={{ width: 66 }}>{a.label}</th>)}
                {useMod('hafalan') && <th>Hafalan</th>}
                {useMod('tugas') && assignment && <th>Tugas</th>}
                {useMod('keaktifan') && <th className="c">Aktif</th>}
                <th style={{ minWidth: 170 }}>Keterangan</th>
              </tr></thead>
              <tbody>
                {filtered.map(x => {
                  const r = rows[x.id]; if (!r) return null; const i = students.indexOf(x);
                  const nn = noteBy(x.id);
                  const absent = r.status && !['hadir', 'terlambat'].includes(r.status);
                  const tgt = !asgTargets || asgTargets.has(x.id);
                  return (
                    <tr key={x.id}>
                      <td className="c muted">{i + 1}</td>
                      <td style={{ minWidth: 170 }}>
                        <div className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }}>{x.full_name}</span>
                          {r.status === 'bolos' && <span className="badge" title="Status lama, tetap tersimpan">Bolos</span>}
                          {nn.length > 0 && <span className="badge purple" title={nn.map(n => L.NOTE_TYPES[n.type].label + ': ' + n.reason).join('\n')} style={{ height: 19 }}><Icon n="note" s={11} />{nn.length}</span>}</div>
                      </td>
                      <td className="c muted">{x.gender}</td>
                      {L.ATT.map(a => <td key={a.k} className="c"><button className={'sr ' + (r.status === a.k ? 'on' : '')} style={{ '--c': a.hex }} onClick={() => setStatus(x.id, a.k)} aria-label={a.label + ' ' + x.full_name} aria-pressed={r.status === a.k} title={a.label} /></td>)}
                      {useMod('hafalan') && <td>
                        <div className="row" style={{ gap: 5 }}>
                          <select className="select input-sm" style={{ width: 112, color: r.mem === 'bebas' ? '#6d28d9' : undefined }} value={r.mem} onChange={e => upd(x.id, { mem: e.target.value, memScore: e.target.value === 'setor' ? r.memScore : '' }, 'mem')}>
                            <option value="">—</option>{Object.entries(L.MEM).map(([k, v]) => <option key={k} value={k} disabled={k === 'setor' && absent}>{v}</option>)}
                          </select>
                          {r.mem === 'setor' && <input className="input input-sm" style={{ width: 56 }} inputMode="numeric" placeholder="Nilai" value={r.memScore} onChange={e => upd(x.id, { memScore: e.target.value }, 'mem', TEXT)} />}
                        </div>
                      </td>}
                      {useMod('tugas') && assignment && <td>{tgt ? <div className="row" style={{ gap: 5 }}>
                        <select className="select input-sm" style={{ width: 136 }} value={r.asg} onChange={e => upd(x.id, { asg: e.target.value, asgScore: L.ASG_DONE.includes(e.target.value) ? r.asgScore : '' }, 'asg')}>
                          <option value="">—</option>{ASG_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        {L.ASG_DONE.includes(r.asg) && <input className="input input-sm" style={{ width: 56 }} inputMode="numeric" placeholder="Nilai" value={r.asgScore} onChange={e => upd(x.id, { asgScore: e.target.value }, 'asg', TEXT)} />}
                      </div> : <span className="tiny muted">bukan target</span>}</td>}
                      {useMod('keaktifan') && <td className="c"><input className="input input-sm" style={{ width: 52, textAlign: 'center' }} inputMode="numeric" disabled={absent} placeholder={'0–' + s.activity_scale_max} value={r.act} onChange={e => upd(x.id, { act: e.target.value }, 'act', TEXT)} /></td>}
                      <td>
                        <div className="row" style={{ gap: 5 }}>
                          {r.status === 'terlambat' && <input className="input input-sm" style={{ width: 62 }} inputMode="numeric" placeholder="mnt" value={r.late} onChange={e => upd(x.id, { late: e.target.value }, 'att', TEXT)} title="Menit keterlambatan" />}
                          <input className="input input-sm" style={{ minWidth: 110 }} value={r.note} onChange={e => upd(x.id, { note: e.target.value }, 'att', TEXT)} placeholder={r.status === 'terlambat' ? 'Alasan terlambat' : r.status ? '' : 'pilih status dulu'} disabled={!r.status} />
                          <button className="btn btn-ghost btn-sm btn-icon" title="Catatan khusus antarpertemuan" onClick={() => setNoteFor(x.id)}><Icon n="note" s={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td></td><td>Jumlah</td><td className="c">{filled}</td>
                {L.ATT.map(a => <td key={a.k} className="c" style={{ color: a.hex }}>{counts[a.k]}</td>)}
                {useMod('hafalan') && <td className="small">{students.filter(x => rows[x.id] && rows[x.id].mem === 'setor').length} setor</td>}
                {useMod('tugas') && assignment && <td className="small">{students.filter(x => rows[x.id] && L.ASG_DONE.includes(rows[x.id].asg)).length} kumpul</td>}
                {useMod('keaktifan') && <td></td>}
                <td className="small muted">Kehadiran {L.fmtPct(counts.pct)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        <div className="att-mobile">
          {filtered.map(x => {
            const r = rows[x.id]; if (!r) return null; const nn = noteBy(x.id);
            const absent = r.status && !['hadir', 'terlambat'].includes(r.status);
            return (
              <div key={x.id} className="att-card col" style={{ gap: 10 }}>
                <div className="row between"><div className="col"><b>{students.indexOf(x) + 1}. {x.full_name}</b><span className="tiny muted">{x.gender === 'L' ? 'Laki-laki' : 'Perempuan'}{x.nis ? ' · ' + x.nis : ''}</span></div>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setNoteFor(x.id)} aria-label="Catatan khusus"><Icon n="note" s={16} /></button></div>
                {nn.map(n => <div key={n.id} className="tiny" style={{ background: '#faf8ff', border: '1px solid #ede7fb', padding: '6px 8px', borderRadius: 8, color: '#5b21b6' }}><b>{L.NOTE_TYPES[n.type].label}:</b> {n.reason}</div>)}
                <div className="g" style={{ gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
                  {L.ATT.map(a => <button key={a.k} className={'chip ' + (r.status === a.k ? 'on' : '')} style={{ '--c': a.hex, height: 44, padding: 0, fontSize: 11.5 }} onClick={() => setStatus(x.id, a.k)} aria-pressed={r.status === a.k}>{a.k === 'terlambat' ? 'Telat' : a.label}</button>)}
                </div>
                {r.status === 'terlambat' && <input className="input" inputMode="numeric" placeholder="Menit terlambat" value={r.late} onChange={e => upd(x.id, { late: e.target.value }, 'att', TEXT)} />}
                {(useMod('hafalan') || useMod('keaktifan') || (useMod('tugas') && assignment)) && <div className="g" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {useMod('hafalan') && <Field label="Hafalan"><select className="select" value={r.mem} onChange={e => upd(x.id, { mem: e.target.value, memScore: e.target.value === 'setor' ? r.memScore : '' }, 'mem')}><option value="">—</option>{Object.entries(L.MEM).map(([k, v]) => <option key={k} value={k} disabled={k === 'setor' && absent}>{v}</option>)}</select></Field>}
                  {useMod('hafalan') && r.mem === 'setor' && <Field label="Nilai hafalan"><input className="input" inputMode="numeric" value={r.memScore} onChange={e => upd(x.id, { memScore: e.target.value }, 'mem', TEXT)} /></Field>}
                  {useMod('tugas') && assignment && (!asgTargets || asgTargets.has(x.id)) && <Field label="Tugas"><select className="select" value={r.asg} onChange={e => upd(x.id, { asg: e.target.value }, 'asg')}><option value="">—</option>{ASG_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
                  {useMod('keaktifan') && <Field label={'Keaktifan (0–' + s.activity_scale_max + ')'}><input className="input" inputMode="numeric" disabled={absent} value={r.act} onChange={e => upd(x.id, { act: e.target.value }, 'act', TEXT)} /></Field>}
                </div>}
                {r.status && <input className="input" placeholder="Keterangan" value={r.note} onChange={e => upd(x.id, { note: e.target.value }, 'att', TEXT)} />}
              </div>
            );
          })}
          <div className="att-mbar"><AutosaveIndicator s={as} idleText={idle} /><span className="tiny muted">{filled}/{students.length} · {L.fmtPct(counts.pct)}</span></div>
        </div>
      </>}
      {noteFor && <NoteModal classId={cls.id} studentId={noteFor} originMeeting={meeting} onClose={() => setNoteFor(null)} />}
      {editMeeting && <MeetingEditModal meeting={meeting} onClose={changed => { setEditMeeting(false); if (changed) setVer(v => v + 1); }} />}
      {delMeeting && <MeetingDeleteConfirm meeting={meeting} onClose={() => setDelMeeting(false)} onDeleted={() => { meetingIdRef.current = null; setMid('new'); }} />}
      {newAsg && <AssignmentModal classId={cls.id} meetingId={meeting && meeting.id} onClose={a => { setNewAsg(false); if (a) setAsgId(a.id); }} />}
    </div>
  );
}

Object.assign(window, { MeetingEditor, MODS });
