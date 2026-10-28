// =====================================================================
// Perkembangan Siswa — catatan akademik, kedisiplinan, keterlambatan, prestasi,
// tindak lanjut, dan catatan guru. Tersimpan di tabel student_progress_notes (migration 0003).
// Catatan bertanda "sensitif" tidak pernah dicetak pada dokumen publik.
// =====================================================================
function ProgressNoteModal({ note, studentId, classId, onClose }) {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const students = data.students.filter(s => s.status === 'aktif' && (!classId || s.class_id === classId)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const [f, setF] = useState(note ? { ...note } : { student_id: studentId || '', date: L.today(), category: 'akademik', content: '', follow_up: 'none', sensitive: true });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = {};
    if (!f.student_id) e.student_id = 'Pilih siswa.';
    if ((f.content || '').trim().length < 2) e.content = 'Isi catatan wajib diisi.';
    if (!f.date) e.date = 'Tanggal wajib diisi.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const st = data.students.find(x => x.id === f.student_id);
    const row = { student_id: f.student_id, class_id: st ? st.class_id : null, semester_id: ctx.sem.id, date: f.date, category: f.category, content: f.content.trim(), follow_up: f.follow_up, sensitive: !!f.sensitive };
    try {
      if (note) await api.update('student_progress_notes', note.id, row, 'Ubah catatan perkembangan');
      else await api.insert('student_progress_notes', [row], 'Catatan perkembangan ' + (st ? st.full_name : ''));
      toast('Catatan perkembangan tersimpan di database.'); onClose();
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  return (
    <Modal title={note ? 'Edit catatan perkembangan' : 'Catatan perkembangan baru'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan</button></>}>
      <div className="fg">
        <Field label="Siswa" error={err.student_id} className="full"><select className="select" value={f.student_id} disabled={!!note} onChange={e => setF({ ...f, student_id: e.target.value })}><option value="">— pilih siswa —</option>{students.map(s => <option key={s.id} value={s.id}>{s.full_name} · {(data.classes.find(c => c.id === s.class_id) || {}).name}</option>)}</select></Field>
        <Field label="Tanggal" error={err.date}><input type="date" className="input" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Kategori"><select className="select" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{Object.entries(L.PROGRESS_CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Catatan" error={err.content} className="full"><textarea className="textarea" style={{ minHeight: 110 }} value={f.content} onChange={e => setF({ ...f, content: e.target.value })} placeholder="mis. Sudah lancar membaca teks pendek; perlu latihan menulis." autoFocus /></Field>
        <Field label="Tindak lanjut"><select className="select" value={f.follow_up} onChange={e => setF({ ...f, follow_up: e.target.value })}>{Object.entries(L.FOLLOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Privasi"><label className="chk"><input type="checkbox" checked={!!f.sensitive} onChange={e => setF({ ...f, sensitive: e.target.checked })} />Sensitif — jangan pernah dicetak</label></Field>
      </div>
    </Modal>
  );
}

function PerkembanganPage({ params }) {
  const { data, ctx, api, v3 } = useApp(); const toast = useToast(); const { go } = useNav();
  const [cid, setCid, classes] = useClassPicker(params.classId);
  const [sid, setSid] = useState(params.studentId || '');
  const [cat, setCat] = useState('');
  const [fu, setFu] = useState('');
  const [modal, setModal] = useState(null); const [del, setDel] = useState(null);
  if (!v3) return <div className="card"><Empty icon="db" title="Modul perkembangan belum tersedia" text="Fitur ini memerlukan pembaruan database (migration 0003). Hubungi pengelola aplikasi. Data lain tetap dapat digunakan." /></div>;
  if (!classes.length) return <NoClasses />;
  const sIdx = L.idx(data.students);
  const students = data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const notes = data.student_progress_notes.filter(n => (sIdx[n.student_id] || {}).class_id === cid && (!sid || n.student_id === sid) && (!cat || n.category === cat) && (!fu || n.follow_up === fu)).sort((a, b) => a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1);
  const setFollow = async (n, v) => { try { await api.update('student_progress_notes', n.id, { follow_up: v }, 'Tindak lanjut perkembangan'); toast('Tindak lanjut diperbarui.'); } catch (e) { toast(DB.friendlyError(e), 'err'); } };
  const countBy = k => data.student_progress_notes.filter(n => (sIdx[n.student_id] || {}).class_id === cid && n.category === k).length;
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub="Riwayat perkembangan per siswa. Catatan sensitif tidak dicetak pada dokumen publik atau daftar yang ditempel di sekolah.">
        <ClassSelect value={cid} onChange={v => { setCid(v); setSid(''); }} classes={classes} />
        <select className="select" style={{ width: 'auto', minWidth: 180 }} value={sid} onChange={e => setSid(e.target.value)}><option value="">Semua siswa</option>{students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
        <button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Catatan</button>
      </PageHead>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className={'chip ' + (!cat ? 'on' : '')} onClick={() => setCat('')}>Semua kategori</button>
        {Object.entries(L.PROGRESS_CATS).map(([k, v]) => <button key={k} className={'chip ' + (cat === k ? 'on' : '')} style={{ '--c': v.c }} onClick={() => setCat(cat === k ? '' : k)}>{v.label} ({countBy(k)})</button>)}
        <select className="select input-sm" style={{ width: 'auto', marginLeft: 'auto' }} value={fu} onChange={e => setFu(e.target.value)}><option value="">Semua tindak lanjut</option>{Object.entries(L.FOLLOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {!notes.length ? <div className="card"><Empty icon="trend" title="Belum ada catatan perkembangan" text="Catat perkembangan akademik, kedisiplinan, prestasi, atau hal yang perlu ditindaklanjuti untuk setiap siswa." action={<button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Catatan baru</button>} /></div> :
        <div className="card">{notes.map(n => { const st = sIdx[n.student_id]; const c = L.PROGRESS_CATS[n.category]; return (
          <div key={n.id} className="list-i" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span className="dot" style={{ background: c.c, marginTop: 6 }} />
            <div className="col grow" style={{ gap: 4, minWidth: 220 }}>
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="link" style={{ textDecoration: 'none', color: 'var(--ink)' }} onClick={() => go('siswaDetail', { id: n.student_id })}><b>{st ? st.full_name : '—'}</b></button>
                <span className="badge" style={{ background: c.c + '18', color: c.c }}>{c.label}</span>
                {n.sensitive && <span className="badge" title="Tidak dicetak pada dokumen publik"><Icon n="lock" s={11} />Sensitif</span>}
                <span className="tiny muted">{L.fmtDate(n.date)}</span>
              </div>
              <p className="small tw-pretty" style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{n.content}</p>
            </div>
            <select className="select input-sm" style={{ width: 160 }} value={n.follow_up} onChange={e => setFollow(n, e.target.value)} aria-label="Tindak lanjut">{Object.entries(L.FOLLOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className="btn btn-ghost btn-sm btn-icon" aria-label="Edit" onClick={() => setModal(n)}><Icon n="edit" s={14} /></button>
            <button className="btn btn-ghost btn-sm btn-icon btn-danger" aria-label="Hapus" onClick={() => setDel(n)}><Icon n="trash" s={14} /></button>
          </div>); })}</div>}
      {modal && <ProgressNoteModal note={modal.id ? modal : null} studentId={sid} classId={cid} onClose={() => setModal(null)} />}
      {del && <Confirm danger title="Hapus catatan perkembangan?" confirmLabel="Hapus" message="Catatan ini akan dihapus permanen dari riwayat siswa." onClose={() => setDel(null)} onConfirm={async () => { try { await api.remove('student_progress_notes', del.id, 'Hapus catatan perkembangan'); toast('Catatan dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}

Object.assign(window, { PerkembanganPage, ProgressNoteModal });
