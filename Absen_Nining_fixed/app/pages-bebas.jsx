// =====================================================================
// Bebas Semester — aturan dapat dikonfigurasi (simpan otomatis), status kelayakan,
// persetujuan manual guru, dokumen "DAFTAR SISWA BEBAS SEMESTER" (Pratinjau/Word/PDF/
// Excel/Cetak), dan riwayat dokumen yang ditetapkan (snapshot, tidak berubah walau aturan diganti).
// =====================================================================
const BS_DEFAULT = { min_attendance: 90, min_memorization: 80, min_assignment: 80, min_activity: 60, use_memorization: true, use_assignment: true, use_activity: false, extra_requirements: '' };

function BebasPage() {
  const { data, ctx } = useApp();
  const [tab, setTab] = useState('daftar');
  const rule = data.semester_exemption_rules.find(r => r.semester_id === ctx.sem.id);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="alert info"><Icon n="info" s={16} /><div>Status Bebas Semester <b>tidak mengubah</b> nilai akademik. Sistem hanya menghitung kelayakan; <b>keputusan akhir tetap persetujuan guru</b>. Siswa dengan data belum lengkap tidak pernah otomatis dinyatakan memenuhi syarat.</div></div>
      <div className="tabs">{[['daftar', 'Daftar & persetujuan'], ['aturan', 'Aturan syarat'], ['cetak', 'Cetak daftar'], ['riwayat', 'Riwayat dokumen']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'aturan' && <BebasRules rule={rule} />}
      {tab !== 'aturan' && !rule && <div className="card"><Empty icon="award" title="Aturan syarat belum diatur" text="Tentukan syarat kehadiran, tugas, hafalan, dan keaktifan untuk semester ini terlebih dahulu." action={<button className="btn btn-dark" onClick={() => setTab('aturan')}><Icon n="sliders" s={15} />Atur syarat</button>} /></div>}
      {tab === 'daftar' && rule && <BebasList rule={rule} />}
      {tab === 'cetak' && rule && <BebasPrint rule={rule} onSaved={() => setTab('riwayat')} />}
      {tab === 'riwayat' && rule && <BebasHistory />}
    </div>
  );
}

function BebasRules({ rule }) {
  const { ctx, api, v3 } = useApp();
  const as = useAutosave();
  const [f, setF] = useState(() => ({ ...BS_DEFAULT, ...(rule || {}), use_memorization: rule ? rule.use_memorization !== false : true }));
  const fRef = useRef(f); fRef.current = f;
  const idRef = useRef(rule ? rule.id : null);
  const creating = useRef(null);
  const save = async () => {
    const x = fRef.current;
    for (const k of ['min_attendance', 'min_memorization', 'min_assignment', 'min_activity']) if (!(String(x[k]) !== '' && +x[k] >= 0 && +x[k] <= 100)) throw Object.assign(new Error('Ambang batas harus 0–100.'), { validation: true });
    const row = { semester_id: ctx.sem.id, min_attendance: +x.min_attendance, min_memorization: +x.min_memorization, min_assignment: +x.min_assignment, min_activity: +x.min_activity, use_assignment: !!x.use_assignment, use_activity: !!x.use_activity, extra_requirements: (x.extra_requirements || '').trim() };
    if (v3) row.use_memorization = !!x.use_memorization;
    if (idRef.current) { await api.update('semester_exemption_rules', idRef.current, row); return; }
    if (!creating.current) creating.current = api.insert('semester_exemption_rules', [row], 'Aturan Bebas Semester').then(([r]) => { idRef.current = r.id; return r; }).catch(e => { creating.current = null; throw e; });
    await creating.current;
  };
  const set = (k, v, delay) => { const n = { ...fRef.current, [k]: v }; fRef.current = n; setF(n); as.queue('rule', save, { delay }); };
  // Fungsi biasa (bukan komponen) agar input tidak dipasang ulang dan fokus tidak hilang saat mengetik.
  const num = (k, dis) => <input type="number" min="0" max="100" className="input" disabled={dis} value={f[k]} onChange={e => set(k, e.target.value, 700)} aria-label={k} />;
  const comps = [
    { use: null, k: 'min_attendance', l: 'Persentase kehadiran minimum (%)', how: '(Hadir + Terlambat) ÷ semua catatan absensi yang diisi pada semester ini. Siswa tanpa catatan absensi = data belum lengkap.' },
    { use: 'use_memorization', k: 'min_memorization', l: 'Ketuntasan hafalan minimum (%)', how: 'Jumlah status Setor ÷ kewajiban setor. Bebas Setor tidak dihitung sebagai 100 dan tidak masuk penyebut.' },
    { use: 'use_assignment', k: 'min_assignment', l: 'Penyelesaian tugas minimum (%)', how: 'Tugas berstatus Dikumpulkan / Selesai Dinilai / Terlambat ÷ tugas yang sudah sampai batas pengumpulan (Bebas Tugas dikecualikan).' },
    { use: 'use_activity', k: 'min_activity', l: 'Keaktifan minimum (% dari skala)', how: 'Rata-rata skor keaktifan ÷ skala maksimum (Pengaturan) × 100.' },
  ];
  return (
    <div className="card">
      <div className="card-h"><h3>Aturan — Semester {ctx.sem.name} {ctx.year.name}</h3><AutosaveIndicator s={as} idleText={rule ? 'Tersimpan di database' : 'Belum disimpan'} /></div>
      <div className="col" style={{ padding: 16, gap: 14 }}>
        {comps.map(c => (
          <div key={c.k} className="row wrap" style={{ gap: 14, alignItems: 'flex-start', paddingBottom: 14, borderBottom: '1px solid var(--line2)' }}>
            <div className="col grow" style={{ gap: 4, minWidth: 220 }}>
              <div className="row" style={{ gap: 9 }}>{c.use ? <Toggle on={!!f[c.use]} onChange={v => set(c.use, v)} label={c.l} /> : <span className="badge">Wajib</span>}<b style={{ fontSize: 13.5 }}>{c.l}</b></div>
              <span className="tiny muted tw-pretty" style={{ lineHeight: 1.5 }}>Cara hitung: {c.how}</span>
            </div>
            <div style={{ width: 120 }}>{num(c.k, !!(c.use && !f[c.use]))}</div>
          </div>
        ))}
        <Field label="Persyaratan tambahan (diperiksa manual oleh guru sebelum menyetujui)" hint="mis. Mengembalikan buku paket, melunasi administrasi kelas."><textarea className="textarea" value={f.extra_requirements} onChange={e => set('extra_requirements', e.target.value, 900)} /></Field>
        <div className="alert info"><Icon n="shield" s={16} /><div>Mengubah aturan hanya memengaruhi perhitungan berikutnya. Dokumen yang sudah <b>ditetapkan</b> menyimpan salinan aturan & daftar siswa sendiri dan tidak ikut berubah.</div></div>
      </div>
    </div>
  );
}

function useBebasRows(rule, classIds) {
  const { data, ctx } = useApp();
  const cIdx = L.idx(data.classes);
  return data.students.filter(s => s.status === 'aktif' && classIds.includes(s.class_id))
    .sort((a, b) => ((cIdx[a.class_id] || {}).name || '').localeCompare((cIdx[b.class_id] || {}).name || '') || a.full_name.localeCompare(b.full_name))
    .map(s => ({ s, cls: cIdx[s.class_id], r: L.exemption(data, ctx.sem.id, s, rule) }));
}

function BebasList({ rule }) {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const res = useBebasRows(rule, cid ? [cid] : []);
  if (!classes.length) return <NoClasses />;
  const shown = res.filter(x => !filter || x.r.status === filter);
  const review = async (s, status) => {
    setBusy(s.id);
    try { await api.upsert('semester_exemption_reviews', [{ semester_id: ctx.sem.id, student_id: s.id, status, note: '', reviewed_at: DB.nowIso() }], 'semester_id,student_id', 'Bebas Semester ' + status + ': ' + s.full_name); toast('Tersimpan: ' + s.full_name + ' → ' + (L.APPROVAL[status] || [status])[0] + '.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy('');
  };
  const eligibleNotApproved = res.filter(x => x.r.eligibility === 'memenuhi' && x.r.approval !== 'disetujui');
  const approveAll = async () => {
    await api.upsert('semester_exemption_reviews', eligibleNotApproved.map(x => ({ semester_id: ctx.sem.id, student_id: x.s.id, status: 'disetujui', note: '', reviewed_at: DB.nowIso() })), 'semester_id,student_id', 'Setujui ' + eligibleNotApproved.length + ' siswa Bebas Semester');
    toast(eligibleNotApproved.length + ' siswa disetujui.');
  };
  const pctCell = c => c ? <td className="c" style={{ color: c.v == null ? 'var(--mute)' : c.ok ? 'var(--teal)' : 'var(--danger)', fontWeight: 700 }}>{c.v == null ? 'belum ada' : L.fmtPct(c.v)}</td> : <td className="c muted">—</td>;
  const chk = (r, k) => r.checks.find(c => c.k === k);
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <div className="row wrap" style={{ gap: 6 }}>
          <button className={'chip ' + (!filter ? 'on' : '')} onClick={() => setFilter('')}>Semua ({res.length})</button>
          {Object.entries(L.EXEMPT_STATUS).map(([k, [l]]) => <button key={k} className={'chip ' + (filter === k ? 'on' : '')} onClick={() => setFilter(k)}>{l} ({res.filter(x => x.r.status === k).length})</button>)}
        </div>
      </div>
      {eligibleNotApproved.length > 0 && <div className="row between wrap card card-pad" style={{ gap: 10, padding: 12 }}><span className="small">{eligibleNotApproved.length} siswa memenuhi syarat dan menunggu persetujuan Anda.{rule.extra_requirements ? ' Pastikan persyaratan tambahan sudah diperiksa.' : ''}</span><button className="btn btn-teal btn-sm" onClick={() => setConfirmAll(true)}><Icon n="check" s={14} />Setujui semua yang memenuhi</button></div>}
      <div className="card" style={{ overflow: 'hidden' }}>
        {shown.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th className="c">No</th><th>NIS</th><th>Nama siswa</th><th>Kelas</th><th className="c">Kehadiran</th><th className="c">Tugas</th><th className="c">Hafalan</th>{rule.use_activity && <th className="c">Keaktifan</th>}<th>Kelayakan</th><th>Persetujuan</th><th></th></tr></thead>
          <tbody>{shown.map(({ s, cls, r }, i) => { const [lbl, col] = L.EXEMPT_STATUS[r.eligibility]; const [al, ac] = L.APPROVAL[r.approval]; return <tr key={s.id}>
            <td className="c muted">{i + 1}</td><td className="mono small muted">{s.nis || '—'}</td>
            <td style={{ fontWeight: 600, minWidth: 150 }}>{s.full_name}{r.reasons.length > 0 && <div className="tiny muted" style={{ fontWeight: 400, maxWidth: 260 }}>{r.reasons.join('; ')}</div>}</td>
            <td>{cls ? cls.name : '—'}</td>
            {pctCell(chk(r, 'Kehadiran'))}
            {rule.use_assignment ? pctCell(chk(r, 'Ketuntasan tugas')) : <td className="c muted small">{L.fmtPct(r.sum.asgPct)}</td>}
            {rule.use_memorization !== false ? pctCell(chk(r, 'Ketuntasan hafalan')) : <td className="c muted small">{L.fmtPct(r.sum.memPct)}</td>}
            {rule.use_activity && pctCell(chk(r, 'Keaktifan'))}
            <td><span className={'badge ' + col}>{lbl}</span></td>
            <td><span className={'badge ' + ac}>{al}</span></td>
            <td><div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
              {busy === s.id ? <span className="spin" /> : <>
                {r.approval !== 'disetujui' && <button className="btn btn-sm" disabled={!r.ok} title={!r.ok ? (r.noData ? 'Data belum lengkap — tidak dapat disetujui' : 'Belum memenuhi syarat') : 'Setujui'} onClick={() => review(s, 'disetujui')}>Setujui</button>}
                {r.approval !== 'belum' && r.approval !== 'menunggu' && <button className="btn btn-sm btn-ghost" onClick={() => review(s, 'menunggu')}>Tinjau ulang</button>}
                {r.approval !== 'ditolak' && r.approval !== 'disetujui' && <button className="btn btn-sm btn-ghost" onClick={() => review(s, 'ditolak')}>Tolak</button>}
              </>}
            </div></td></tr>; })}</tbody>
        </table></div> : <Empty title="Tidak ada siswa pada filter ini" />}
      </div>
      {confirmAll && <Confirm title="Setujui siswa yang memenuhi syarat?" message={<>{eligibleNotApproved.length} siswa akan berstatus <b>Disetujui</b> untuk Semester {ctx.sem.name} {ctx.year.name}. Status dapat ditinjau ulang kapan saja.</>} confirmLabel="Setujui" onClose={() => setConfirmAll(false)} onConfirm={async () => { try { await approveAll(); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}

function bebasDoc(ctx, { title, list, classNames, showNis, showDetail, scope, decided, principal, rule }) {
  const cols = [{ h: 'No', w: .5, align: 'center' }, ...(showNis ? [{ h: 'NIS', w: 1.3, align: 'center' }] : []), { h: 'Nama Siswa', w: 3.4 }, { h: 'Kelas', w: 1, align: 'center' },
    ...(showDetail ? [{ h: 'Kehadiran', w: 1, align: 'center' }, { h: 'Tugas', w: 1, align: 'center' }, { h: 'Hafalan', w: 1, align: 'center' }] : []), { h: 'Status', w: 1.6, align: 'center' }];
  const rows = list.map((x, i) => [i + 1, ...(showNis ? [x.nis || '—'] : []), x.name, x.cls, ...(showDetail ? [L.fmtPct(x.att), L.fmtPct(x.asg), L.fmtPct(x.mem)] : []), x.statusLabel]);
  const notes = [];
  if (rule) notes.push('Ketentuan: kehadiran ≥ ' + rule.min_attendance + '%' + (rule.use_assignment ? ', penyelesaian tugas ≥ ' + rule.min_assignment + '%' : '') + (rule.use_memorization !== false ? ', ketuntasan hafalan ≥ ' + rule.min_memorization + '%' : '') + (rule.use_activity ? ', keaktifan ≥ ' + rule.min_activity + '%' : '') + '.');
  if (scope === 'approved') notes.push('Daftar memuat siswa yang telah disetujui guru mata pelajaran.');
  return {
    title: title || 'DAFTAR SISWA BEBAS SEMESTER', subtitle: 'Ditetapkan ' + L.fmtDate(decided, true),
    meta: docMeta(ctx, { className: classNames, period: 'Semester ' + (ctx.sem ? ctx.sem.name : '') }),
    columns: cols, rows, notes, orientation: 'portrait',
    signatures: docSigs(ctx, { teacher: true, principal, date: decided }),
    filename: L.fileSafe(['Daftar_Bebas_Semester', classNames.length > 30 ? 'Gabungan' : classNames, ctx.sem && ctx.sem.name, ctx.year && ctx.year.name]),
    sheet: 'Bebas Semester',
  };
}

function BebasPrint({ rule, onSaved }) {
  const { data, ctx, api, v3 } = useApp(); const toast = useToast();
  const classes = data.classes.filter(c => !c.archived).sort((a, b) => L.LEVELS.indexOf(a.level) - L.LEVELS.indexOf(b.level) || a.name.localeCompare(b.name));
  const [sel, setSel] = useState(() => classes.slice(0, 1).map(c => c.id));
  const [scope, setScope] = useState('approved'); // approved | all
  const [showNis, setShowNis] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [principal, setPrincipal] = useState(true);
  const [decided, setDecided] = useState(L.today());
  const [busy, setBusy] = useState(false);
  const res = useBebasRows(rule, sel);
  const list = res.filter(x => scope === 'all' || x.r.status === 'disetujui').map(x => ({
    student_id: x.s.id, nis: x.s.nis || '', name: x.s.full_name, cls: x.cls ? x.cls.name : '', att: x.r.sum.attPct, asg: x.r.sum.asgPct, mem: x.r.sum.memPct,
    status: x.r.status, statusLabel: x.r.status === 'disetujui' ? 'Bebas Semester' : L.EXEMPT_STATUS[x.r.status][0],
  }));
  const classNames = classes.filter(c => sel.includes(c.id)).map(c => c.name).join(', ');
  const doc = bebasDoc(ctx, { list, classNames, showNis, showDetail, scope, decided, principal, rule });
  const toggle = id => setSel(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  const saveSnapshot = async () => {
    setBusy(true);
    try {
      await api.insert('semester_exemption_documents', [{ semester_id: ctx.sem.id, title: doc.title, class_ids: sel, decided_at: decided, rule: { ...rule, id: undefined, owner_id: undefined }, options: { scope, showNis, showDetail, principal, classNames }, students: list }], 'Tetapkan dokumen Bebas Semester ' + classNames);
      toast('Dokumen ditetapkan & disimpan ke riwayat.'); onSaved && onSaved();
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  return (
    <div className="rk-layout">
      <div className="card card-pad col rk-filters" style={{ gap: 14 }}>
        <b>Opsi dokumen</b>
        <Field label="Kelas (pilih satu atau beberapa untuk gabungan)">
          <div className="row wrap" style={{ gap: 6 }}>{classes.map(c => <button key={c.id} className={'chip ' + (sel.includes(c.id) ? 'on' : '')} style={{ '--c': 'var(--teal)' }} onClick={() => toggle(c.id)}>{c.name}</button>)}</div>
        </Field>
        <Field label="Isi daftar"><Seg value={scope} onChange={setScope} options={[{ v: 'approved', l: 'Hanya disetujui' }, { v: 'all', l: 'Semua + status' }]} /></Field>
        <Field label="Tanggal penetapan"><input type="date" className="input" value={decided} onChange={e => setDecided(e.target.value)} /></Field>
        <label className="chk"><input type="checkbox" checked={showNis} onChange={e => setShowNis(e.target.checked)} />Tampilkan NIS</label>
        <label className="chk"><input type="checkbox" checked={showDetail} onChange={e => setShowDetail(e.target.checked)} />Tampilkan rincian nilai (kehadiran, tugas, hafalan)</label>
        <label className="chk"><input type="checkbox" checked={principal} onChange={e => setPrincipal(e.target.checked)} />Tanda tangan kepala sekolah</label>
        {principal && !ctx.profile.principal_name && <div className="alert warn"><Icon n="alert" s={16} /><div>Nama kepala sekolah belum diisi. Lengkapi di Pengaturan → Profil & identitas.</div></div>}
        {scope === 'all' && <div className="alert warn"><Icon n="alert" s={16} /><div>Untuk dokumen yang ditempel di sekolah, disarankan <b>Hanya disetujui</b>. Catatan pribadi/alasan siswa tidak pernah dicetak.</div></div>}
        <p className="tiny muted">{list.length} siswa pada dokumen · data diambil langsung dari database.</p>
        {v3 ? <button className="btn btn-dark" disabled={busy || !sel.length || !list.length} onClick={saveSnapshot}>{busy ? <span className="spin" /> : <Icon n="archive" s={15} />}Tetapkan & simpan ke riwayat</button>
          : <div className="alert info"><Icon n="info" s={16} /><div>Riwayat dokumen memerlukan migration 0003. Hubungi pengelola aplikasi.</div></div>}
      </div>
      <DocPreview doc={doc} disabled={!sel.length} />
    </div>
  );
}

function BebasHistory() {
  const { data, ctx, api, v3 } = useApp(); const toast = useToast();
  const [open, setOpen] = useState(null); const [del, setDel] = useState(null);
  if (!v3) return <div className="card"><Empty icon="db" title="Riwayat dokumen belum tersedia" text="Fitur ini memerlukan pembaruan database (migration 0003). Hubungi pengelola aplikasi." /></div>;
  const docs = [...data.semester_exemption_documents].sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const semName = id => { const s = data.semesters.find(x => x.id === id); const y = s && data.academic_years.find(a => a.id === s.academic_year_id); return s ? 'Semester ' + s.name + ' ' + (y ? y.name : '') : '—'; };
  const rebuild = d => {
    const s = data.semesters.find(x => x.id === d.semester_id); const y = s && data.academic_years.find(a => a.id === s.academic_year_id);
    const c2 = { ...ctx, sem: s || ctx.sem, year: y || ctx.year };
    const o = d.options || {};
    return bebasDoc(c2, { title: d.title, list: d.students || [], classNames: o.classNames || '', showNis: o.showNis, showDetail: o.showDetail, scope: o.scope, decided: d.decided_at, principal: o.principal, rule: d.rule });
  };
  const cur = open && docs.find(d => d.id === open);
  return (
    <div className="col" style={{ gap: 12 }}>
      {!docs.length ? <div className="card"><Empty icon="archive" title="Belum ada dokumen yang ditetapkan" text="Tetapkan dokumen dari tab Cetak daftar. Dokumen yang ditetapkan menyimpan aturan & daftar siswa saat itu sehingga bisa dicetak ulang persis sama." /></div> :
        <div className="card">{docs.map(d => <div key={d.id} className="list-i" style={{ flexWrap: 'wrap' }}>
          <Icon n="file" s={16} />
          <div className="col grow" style={{ gap: 2, minWidth: 200 }}><b style={{ fontSize: 13.5 }}>{d.title} — {(d.options || {}).classNames}</b><span className="tiny muted">{semName(d.semester_id)} · ditetapkan {L.fmtDate(d.decided_at, false)} · {(d.students || []).length} siswa · aturan: hadir ≥ {(d.rule || {}).min_attendance}%</span></div>
          <button className="btn btn-sm" onClick={() => setOpen(open === d.id ? null : d.id)}><Icon n="eye" s={13} />{open === d.id ? 'Tutup' : 'Buka & cetak ulang'}</button>
          <button className="btn btn-sm btn-ghost btn-icon btn-danger" aria-label="Hapus dokumen" onClick={() => setDel(d)}><Icon n="trash" s={14} /></button>
        </div>)}</div>}
      {cur && <DocPreview doc={rebuild(cur)} />}
      {del && <Confirm danger title="Hapus dokumen dari riwayat?" confirmLabel="Hapus" message="Dokumen historis ini akan dihapus. Status persetujuan siswa tidak berubah." onClose={() => setDel(null)} onConfirm={async () => { try { await api.remove('semester_exemption_documents', del.id, 'Hapus dokumen Bebas Semester'); if (open === del.id) setOpen(null); toast('Dokumen dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}

Object.assign(window, { BebasPage });
