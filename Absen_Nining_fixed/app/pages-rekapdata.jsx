// =====================================================================
// Rekap Data Siswa — satu halaman untuk Gabungan, Absensi, Hafalan, Tugas, Keaktifan,
// Perkembangan. Semua filter bekerja terhadap data aktual. Model dokumen yang sama dipakai
// untuk pratinjau, Cetak PDF, Unduh Word, Excel, dan Cetak Langsung.
// =====================================================================
const RK_TYPES = [
  { k: 'gabungan', l: 'Gabungan', i: 'layers' },
  { k: 'absensi', l: 'Absensi', i: 'calCheck' },
  { k: 'hafalan', l: 'Hafalan', i: 'book', mod: 'hafalan' },
  { k: 'tugas', l: 'Tugas', i: 'clip', mod: 'tugas' },
  { k: 'keaktifan', l: 'Keaktifan', i: 'star', mod: 'keaktifan' },
  { k: 'perkembangan', l: 'Perkembangan', i: 'trend' },
];
const RK_TITLE = { gabungan: 'REKAP DATA SISWA', absensi: 'REKAP ABSENSI SISWA', hafalan: 'REKAP HAFALAN SISWA', tugas: 'REKAP TUGAS SISWA', keaktifan: 'REKAP KEAKTIFAN SISWA', perkembangan: 'REKAP PERKEMBANGAN SISWA' };
const RK_FILE = { gabungan: 'Rekap_Gabungan', absensi: 'Rekap_Absensi', hafalan: 'Rekap_Hafalan', tugas: 'Rekap_Tugas', keaktifan: 'Rekap_Keaktifan', perkembangan: 'Rekap_Perkembangan' };

function buildRekap(data, ctx, f, v3) {
  const s = ctx.settings;
  const year = data.academic_years.find(y => y.id === f.yearId) || ctx.year;
  const sems = data.semesters.filter(x => x.academic_year_id === year.id);
  const semIds = f.semId ? [f.semId] : sems.map(x => x.id);
  const sem = sems.find(x => x.id === f.semId);
  const classes = data.classes.filter(c => (c.academic_year_id === year.id || !c.academic_year_id) && (f.classId ? c.id === f.classId : !c.archived));
  const cIdx = L.idx(data.classes);
  const classIds = classes.map(c => c.id);
  const students = data.students.filter(st => classIds.includes(st.class_id) && (f.inactive || st.status === 'aktif') && (!f.studentId || st.id === f.studentId))
    .sort((a, b) => ((cIdx[a.class_id] || {}).name || '').localeCompare((cIdx[b.class_id] || {}).name || '') || a.full_name.localeCompare(b.full_name));
  const from = f.from || null, to = f.to || null;
  const ms = L.sortMeetings(L.scopeMeetings(data, { classIds, semIds, from, to }));
  const mIdx = L.idx(ms);
  const opt = { semIds, from, to };
  const one = f.studentId ? students[0] : null;
  const nis = st => st.nis || '—';
  const clsName = st => (cIdx[st.class_id] || {}).name || '—';
  const id = [{ h: 'No', w: .5, align: 'center' }, { h: 'NIS', w: 1.2, align: 'center' }, { h: 'Nama Siswa', w: 3 }, { h: 'Kelas', w: .9, align: 'center' }];
  const idRow = (st, i) => [i + 1, nis(st), st.full_name + (st.status !== 'aktif' ? ' (nonaktif)' : ''), clsName(st)];
  const att = st => L.attCounts(data.attendance_records.filter(r => r.student_id === st.id && mIdx[r.meeting_id]));
  const hasBolos = data.attendance_records.some(r => r.status === 'bolos' && mIdx[r.meeting_id]);
  const ATTC = hasBolos ? [...L.ATT, L.ATT_LEGACY] : L.ATT;
  const progOf = st => (data.student_progress_notes || []).filter(n => n.student_id === st.id && (!from || n.date >= from) && (!to || n.date <= to) && (!n.semester_id || semIds.includes(n.semester_id)));
  const progSummary = st => { const ns = progOf(st); if (!ns.length) return '—'; const c = k => ns.filter(n => n.category === k).length; return [c('prestasi') && c('prestasi') + ' prestasi', c('akademik') && c('akademik') + ' akademik', c('kedisiplinan') && c('kedisiplinan') + ' disiplin', ns.filter(n => n.follow_up === 'perlu' || n.follow_up === 'proses').length && ns.filter(n => n.follow_up === 'perlu' || n.follow_up === 'proses').length + ' tindak lanjut'].filter(Boolean).join(', ') || ns.length + ' catatan'; };
  let columns, rows, foot = null, notes = [];

  if (one && f.type !== 'gabungan') {
    // Rincian satu siswa per kejadian
    const st = one;
    if (f.type === 'absensi') {
      columns = [{ h: 'No', w: .5, align: 'center' }, { h: 'Tanggal', w: 2 }, { h: 'Pert.', w: .6, align: 'center' }, { h: 'Materi', w: 3 }, { h: 'Status', w: 1.2, align: 'center' }, { h: 'Keterangan', w: 2.2 }];
      rows = ms.filter(m => m.class_id === st.class_id || data.attendance_records.some(r => r.meeting_id === m.id && r.student_id === st.id)).map((m, i) => { const r = data.attendance_records.find(x => x.meeting_id === m.id && x.student_id === st.id); return [i + 1, L.fmtDate(m.date), m.number, m.topic || '—', r ? L.ATT_MAP[r.status].label : 'Belum diisi', r ? (r.late_minutes ? r.late_minutes + ' menit. ' : '') + (r.note || '') : '']; });
      const c = att(st); foot = ['', 'Rekap', '', ATTC.map(a => a.short + ' ' + c[a.k]).join(' · '), L.fmtPct(c.pct), ''];
    } else if (f.type === 'hafalan') {
      columns = [{ h: 'No', w: .5, align: 'center' }, { h: 'Tanggal', w: 2 }, { h: 'Target / materi', w: 3 }, { h: 'Status', w: 1.2, align: 'center' }, { h: 'Nilai', w: .8, align: 'center' }, { h: 'Komentar', w: 2.2 }];
      rows = data.memorization_records.filter(r => r.student_id === st.id && mIdx[r.meeting_id]).sort((a, b) => mIdx[a.meeting_id].date < mIdx[b.meeting_id].date ? -1 : 1).map((r, i) => [i + 1, L.fmtDate(mIdx[r.meeting_id].date), (data.memorization_targets.find(t => t.id === r.target_id) || {}).title || mIdx[r.meeting_id].topic || '—', L.MEM[r.status], r.score ?? '—', r.comment || '']);
      const sm = L.studentSummary(data, st, null, opt); foot = ['', 'Ketuntasan', sm.memSetor + '/' + sm.memReq + ' setor', L.fmtPct(sm.memPct), sm.memScore ?? '—', ''];
    } else if (f.type === 'tugas') {
      columns = [{ h: 'No', w: .5, align: 'center' }, { h: 'Tugas', w: 3 }, { h: 'Diberikan', w: 1.5 }, { h: 'Batas', w: 1.5 }, { h: 'Status', w: 1.5, align: 'center' }, { h: 'Nilai', w: .8, align: 'center' }];
      const asg = data.assignments.filter(a => semIds.includes(a.semester_id) && a.class_id === st.class_id && (a.target === 'kelas' || (a.student_ids || []).includes(st.id)) && (!from || a.due_date >= from) && (!to || a.due_date <= to)).sort((a, b) => a.due_date < b.due_date ? -1 : 1);
      rows = asg.map((a, i) => { const r = data.assignment_records.find(x => x.assignment_id === a.id && x.student_id === st.id); return [i + 1, a.title, a.given_date ? L.fmtDate(a.given_date, false) : '—', L.fmtDate(a.due_date, false), r ? L.ASG[r.status] : (a.due_date < L.today() ? 'Belum Dikerjakan' : 'Belum tenggat'), r && r.score != null ? r.score : '—']; });
      const sm = L.studentSummary(data, st, null, opt); foot = ['', 'Penyelesaian', '', '', sm.asgTotal ? sm.asgDone + '/' + sm.asgTotal + ' (' + L.fmtPct(sm.asgPct) + ')' : '—', sm.asgScore ?? '—'];
    } else if (f.type === 'keaktifan') {
      columns = [{ h: 'No', w: .5, align: 'center' }, { h: 'Tanggal', w: 2 }, { h: 'Pert.', w: .6, align: 'center' }, { h: 'Materi', w: 3 }, { h: 'Skor (0–' + s.activity_scale_max + ')', w: 1, align: 'center' }, { h: 'Catatan', w: 2.2 }];
      rows = data.activity_records.filter(r => r.student_id === st.id && mIdx[r.meeting_id]).sort((a, b) => mIdx[a.meeting_id].date < mIdx[b.meeting_id].date ? -1 : 1).map((r, i) => [i + 1, L.fmtDate(mIdx[r.meeting_id].date), mIdx[r.meeting_id].number, mIdx[r.meeting_id].topic || '—', r.score ?? '—', r.note || '']);
      const sm = L.studentSummary(data, st, null, opt); foot = ['', 'Rata-rata', '', '', sm.actAvg ?? '—', ''];
    } else {
      columns = [{ h: 'No', w: .5, align: 'center' }, { h: 'Tanggal', w: 1.8 }, { h: 'Kategori', w: 1.8 }, { h: 'Catatan', w: 4.5 }, { h: 'Tindak lanjut', w: 1.4, align: 'center' }];
      const ns = progOf(st).sort((a, b) => a.date < b.date ? -1 : 1);
      const pub = ns.filter(n => !n.sensitive || f.sensitive);
      rows = pub.map((n, i) => [i + 1, L.fmtDate(n.date, false), L.PROGRESS_CATS[n.category].label, n.content, L.FOLLOW[n.follow_up]]);
      if (ns.length > pub.length) notes.push((ns.length - pub.length) + ' catatan sensitif tidak dicantumkan pada dokumen ini.');
    }
  } else if (f.type === 'gabungan') {
    columns = [...id, ...ATTC.map(a => ({ h: a.short, w: .45, align: 'center' })), { h: '% Hadir', w: .8, align: 'center' },
      ...(s.hafalan ? [{ h: 'Hafalan', w: .9, align: 'center' }] : []), ...(s.tugas ? [{ h: 'Tugas', w: .9, align: 'center' }] : []), ...(s.keaktifan ? [{ h: 'Keaktifan', w: .8, align: 'center' }] : []), { h: 'Perkembangan', w: 2 }];
    rows = students.map((st, i) => { const sm = L.studentSummary(data, st, null, opt); const c = att(st); return [...idRow(st, i), ...ATTC.map(a => c[a.k]), L.fmtPct(c.pct), ...(s.hafalan ? [L.fmtPct(sm.memPct)] : []), ...(s.tugas ? [sm.asgTotal ? sm.asgDone + '/' + sm.asgTotal : '—'] : []), ...(s.keaktifan ? [sm.actAvg ?? '—'] : []), progSummary(st)]; });
    notes.push('H Hadir · I Izin · S Sakit · A Alpa · T Terlambat' + (hasBolos ? ' · B Bolos (data lama)' : '') + '. % Hadir = (Hadir + Terlambat) ÷ catatan absensi yang diisi. Hafalan = ketuntasan setor. Tugas = dikumpulkan/wajib. Keaktifan = rata-rata skor 0–' + s.activity_scale_max + '.');
  } else if (f.type === 'absensi') {
    columns = [...id, ...ATTC.map(a => ({ h: a.label, w: .7, align: 'center' })), { h: 'Jumlah', w: .7, align: 'center' }, { h: '% Hadir', w: .8, align: 'center' }];
    const tot = { total: 0 }; ATTC.forEach(a => tot[a.k] = 0);
    rows = students.map((st, i) => { const c = att(st); ATTC.forEach(a => tot[a.k] += c[a.k]); tot.total += c.total; return [...idRow(st, i), ...ATTC.map(a => c[a.k]), c.total, L.fmtPct(c.pct)]; });
    foot = ['', '', 'Jumlah', '', ...ATTC.map(a => tot[a.k]), tot.total, L.fmtPct(L.pct(tot.hadir + tot.terlambat, tot.total))];
    notes.push(ms.length + ' pertemuan pada periode ini. Status yang belum diisi tidak dihitung dan tidak dianggap Alpa.');
  } else if (f.type === 'hafalan') {
    columns = [...id, { h: 'Setor', w: .7, align: 'center' }, { h: 'Belum', w: .7, align: 'center' }, { h: 'Izin', w: .6, align: 'center' }, { h: 'Bebas', w: .6, align: 'center' }, { h: 'Ketuntasan', w: 1, align: 'center' }, { h: 'Rata-rata nilai', w: 1, align: 'center' }];
    rows = students.map((st, i) => { const rs = data.memorization_records.filter(r => r.student_id === st.id && mIdx[r.meeting_id]); const sm = L.studentSummary(data, st, null, opt); const c = k => rs.filter(r => r.status === k).length; return [...idRow(st, i), c('setor'), c('belum'), c('izin'), c('bebas'), L.fmtPct(sm.memPct), sm.memScore ?? '—']; });
    const tg = data.memorization_targets.filter(t => classIds.includes(t.class_id) && semIds.includes(t.semester_id));
    if (tg.length) notes.push('Target: ' + tg.map(t => t.title).join('; ') + '.');
    notes.push('Bebas Setor tidak dihitung sebagai nilai 100 dan tidak masuk penyebut ketuntasan.');
  } else if (f.type === 'tugas') {
    columns = [...id, { h: 'Wajib', w: .6, align: 'center' }, { h: 'Dikumpulkan', w: .9, align: 'center' }, { h: 'Dinilai', w: .7, align: 'center' }, { h: 'Terlambat', w: .8, align: 'center' }, { h: 'Belum', w: .6, align: 'center' }, { h: 'Penyelesaian', w: 1, align: 'center' }, { h: 'Rata-rata', w: .8, align: 'center' }];
    rows = students.map((st, i) => {
      const sm = L.studentSummary(data, st, null, opt);
      const asg = data.assignments.filter(a => semIds.includes(a.semester_id) && a.class_id === st.class_id && (a.target === 'kelas' || (a.student_ids || []).includes(st.id)) && (!from || a.due_date >= from) && (!to || a.due_date <= to) && a.due_date <= L.today());
      const rec = asg.map(a => data.assignment_records.find(r => r.assignment_id === a.id && r.student_id === st.id));
      const c = k => rec.filter(r => r && r.status === k).length;
      return [...idRow(st, i), sm.asgTotal, c('sudah'), c('dinilai'), c('terlambat'), rec.filter(r => !r || r.status === 'belum').length, L.fmtPct(sm.asgPct), sm.asgScore ?? '—'];
    });
    notes.push('Hanya tugas yang sudah sampai batas pengumpulan. Bebas Tugas tidak dihitung sebagai kewajiban.');
  } else if (f.type === 'keaktifan') {
    columns = [...id, { h: 'Penilaian', w: .8, align: 'center' }, { h: 'Rata-rata', w: .8, align: 'center' }, { h: '% Skala', w: .8, align: 'center' }, { h: 'Tertinggi', w: .8, align: 'center' }, { h: 'Terendah', w: .8, align: 'center' }];
    rows = students.map((st, i) => { const sc = data.activity_records.filter(r => r.student_id === st.id && mIdx[r.meeting_id] && r.score != null).map(r => +r.score); const av = L.avg(sc); return [...idRow(st, i), sc.length, av ?? '—', av == null ? '—' : L.fmtPct(Math.round(av / s.activity_scale_max * 1000) / 10), sc.length ? Math.max(...sc) : '—', sc.length ? Math.min(...sc) : '—']; });
    notes.push('Skala keaktifan 0–' + s.activity_scale_max + ' per pertemuan.');
  } else {
    columns = [...id, ...['akademik', 'kedisiplinan', 'prestasi', 'catatan'].map(k => ({ h: L.PROGRESS_CATS[k].label.replace('Perkembangan ', ''), w: .9, align: 'center' })), { h: 'Terlambat (absen)', w: .9, align: 'center' }, { h: 'Tindak lanjut terbuka', w: 1, align: 'center' }];
    rows = students.map((st, i) => { const ns = progOf(st); const c = k => ns.filter(n => n.category === k).length; return [...idRow(st, i), c('akademik'), c('kedisiplinan'), c('prestasi'), c('catatan'), att(st).terlambat, ns.filter(n => n.follow_up === 'perlu' || n.follow_up === 'proses').length]; });
    notes.push('Jumlah catatan per kategori. Isi catatan tidak dicantumkan pada rekap kelas untuk menjaga privasi siswa.');
    if (!v3) notes.push('Catatan perkembangan memerlukan pembaruan database (migration 0003).');
  }

  const period = from || to ? (from ? L.fmtDate(from, false) : 'awal') + ' s.d. ' + (to ? L.fmtDate(to, false) : 'sekarang') : sem ? 'Satu semester' : 'Satu tahun ajaran';
  const className = f.classId ? (cIdx[f.classId] || {}).name : 'Semua kelas';
  const title = RK_TITLE[f.type];
  return {
    title, subtitle: one ? one.full_name + ' · NIS ' + nis(one) + ' · ' + clsName(one) : null,
    meta: { ...docMeta(ctx), year: year.name, semester: sem ? sem.name : 'Ganjil & Genap', className, period },
    columns, rows, foot, notes,
    signatures: docSigs(ctx, { teacher: f.sigTeacher, principal: f.sigPrincipal }),
    filename: L.fileSafe([RK_FILE[f.type], 'Kelas', f.classId ? className : 'Semua', one && one.full_name, sem ? sem.name : 'Setahun', year.name]),
    sheet: title.replace('REKAP ', 'Rekap ').slice(0, 31),
    meetingsCount: ms.length, studentsCount: students.length,
  };
}

function RekapDataPage({ params }) {
  const { data, ctx, v3 } = useApp();
  const s = ctx.settings;
  const types = RK_TYPES.filter(t => !t.mod || s[t.mod]);
  const [f, setF] = useState(() => {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('absendigital.rekap') || '{}'); } catch { }
    return { type: params.type || saved.type || 'gabungan', yearId: ctx.year.id, semId: ctx.sem.id, classId: params.classId || '', studentId: '', from: '', to: '', sigTeacher: saved.sigTeacher !== false, sigPrincipal: !!saved.sigPrincipal, inactive: false, sensitive: false };
  });
  const set = (k, v) => setF(p => {
    const n = { ...p, [k]: v };
    if (k === 'yearId') { const sm = data.semesters.find(x => x.academic_year_id === v && x.is_active) || data.semesters.find(x => x.academic_year_id === v); n.semId = sm ? sm.id : ''; n.classId = ''; n.studentId = ''; }
    if (k === 'classId') n.studentId = '';
    try { localStorage.setItem('absendigital.rekap', JSON.stringify({ type: n.type, sigTeacher: n.sigTeacher, sigPrincipal: n.sigPrincipal })); } catch { }
    return n;
  });
  const dateErr = f.from && f.to && f.from > f.to ? 'Tanggal awal tidak boleh melebihi tanggal akhir.' : '';
  const sems = data.semesters.filter(x => x.academic_year_id === f.yearId).sort((a, b) => a.name === 'Ganjil' ? -1 : 1);
  const classes = data.classes.filter(c => (c.academic_year_id === f.yearId || !c.academic_year_id) && !c.archived).sort((a, b) => L.LEVELS.indexOf(a.level) - L.LEVELS.indexOf(b.level) || a.name.localeCompare(b.name));
  const studs = data.students.filter(x => (f.classId ? x.class_id === f.classId : classes.some(c => c.id === x.class_id)) && (f.inactive || x.status === 'aktif')).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const doc = useMemo(() => buildRekap(data, ctx, dateErr ? { ...f, from: '', to: '' } : f, v3), [data, f, dateErr, v3]);
  if (!data.classes.length) return <NoClasses />;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="col" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 21 }}>Rekap Data Siswa</h2>
        <p className="small muted tw-pretty">Pilih jenis rekap dan filter. Pratinjau di bawah sama persis dengan hasil PDF, Word, Excel, dan cetak.</p>
      </div>
      <div className="rk-types" role="tablist" aria-label="Jenis rekap">
        {types.map(t => <button key={t.k} role="tab" aria-selected={f.type === t.k} className={'rk-type ' + (f.type === t.k ? 'on' : '')} onClick={() => set('type', t.k)}><Icon n={t.i} s={15} />{t.l}</button>)}
      </div>
      <div className="rk-layout">
        <div className="card card-pad col rk-filters" style={{ gap: 12 }}>
          <b>Filter</b>
          <div className="fg" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Tahun ajaran"><select className="select" value={f.yearId} onChange={e => set('yearId', e.target.value)}>{[...data.academic_years].sort((a, b) => a.name < b.name ? 1 : -1).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
            <Field label="Semester"><select className="select" value={f.semId} onChange={e => set('semId', e.target.value)}><option value="">Ganjil & Genap</option>{sems.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          </div>
          <Field label="Kelas"><select className="select" value={f.classId} onChange={e => set('classId', e.target.value)}><option value="">Semua kelas</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Siswa"><select className="select" value={f.studentId} onChange={e => set('studentId', e.target.value)}><option value="">Seluruh siswa ({studs.length})</option>{studs.map(x => <option key={x.id} value={x.id}>{x.full_name}{x.status !== 'aktif' ? ' (nonaktif)' : ''}</option>)}</select></Field>
          <div className="fg" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Tanggal awal"><input type="date" className={'input ' + (dateErr ? 'err' : '')} value={f.from} onChange={e => set('from', e.target.value)} /></Field>
            <Field label="Tanggal akhir"><input type="date" className={'input ' + (dateErr ? 'err' : '')} value={f.to} onChange={e => set('to', e.target.value)} /></Field>
          </div>
          {dateErr && <span className="ferr">{dateErr}</span>}
          {(f.from || f.to) && <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => { set('from', ''); set('to', ''); }}>Hapus rentang tanggal</button>}
          <div className="col" style={{ gap: 2, borderTop: '1px solid var(--line2)', paddingTop: 10 }}>
            <label className="chk"><input type="checkbox" checked={f.sigTeacher} onChange={e => set('sigTeacher', e.target.checked)} />Tanda tangan guru</label>
            <label className="chk"><input type="checkbox" checked={f.sigPrincipal} onChange={e => set('sigPrincipal', e.target.checked)} />Tanda tangan kepala sekolah</label>
            <label className="chk"><input type="checkbox" checked={f.inactive} onChange={e => set('inactive', e.target.checked)} />Sertakan siswa nonaktif</label>
            {f.type === 'perkembangan' && f.studentId && <label className="chk"><input type="checkbox" checked={f.sensitive} onChange={e => set('sensitive', e.target.checked)} />Sertakan catatan sensitif (dokumen internal)</label>}
          </div>
          {f.sigPrincipal && !ctx.profile.principal_name && <div className="alert warn"><Icon n="alert" s={16} /><div>Nama kepala sekolah belum diisi di Pengaturan → Profil.</div></div>}
          <p className="tiny muted">{doc.studentsCount} siswa · {doc.meetingsCount} pertemuan pada filter ini.</p>
        </div>
        <DocPreview doc={doc} disabled={!!dateErr} />
      </div>
    </div>
  );
}

Object.assign(window, { RekapDataPage, buildRekap });
