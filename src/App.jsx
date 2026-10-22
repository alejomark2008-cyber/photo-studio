import { useEffect, useMemo, useRef, useState } from 'react'
import { Aperture, ArrowDownToLine, Check, ChevronRight, FileArchive, FileImage, FileText, History, Home, ImagePlus, Images, LoaderCircle, LogIn, Menu, Moon, PanelLeftClose, Plus, Scissors, Settings, ShieldCheck, Sparkles, Sun, Trash2, UploadCloud, WandSparkles, X } from 'lucide-react'
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { blobToDataUrl, normalizeImage } from './lib/imageTools.js'

const navItems = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'process', label: 'Procesar fotos', icon: Images },
  { id: 'pdf', label: 'Crear PDF', icon: FileText },
  { id: 'history', label: 'Historial', icon: History },
  { id: 'settings', label: 'Configuración', icon: Settings },
]

function App() {
  const [section, setSection] = useState('home')
  const [mobileNav, setMobileNav] = useState(false)
  const [files, setFiles] = useState([])
  const [results, setResults] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [margin, setMargin] = useState(10)
  const [pdfLayout, setPdfLayout] = useState('catalog')
  const [perPage, setPerPage] = useState(6)
  const [pdfName, setPdfName] = useState('Catalogo-DigiAR')
  const [notice, setNotice] = useState('')
  const [dark, setDark] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => () => {
    files.forEach(item => item.preview && URL.revokeObjectURL(item.preview))
    results.forEach(item => item.url && URL.revokeObjectURL(item.url))
  }, [])

  const readyCount = results.length
  const canExport = readyCount > 0 && !processing

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter(file => file.type.startsWith('image/'))
    if (!incoming.length) { setNotice('Selecciona archivos de imagen, como JPG, PNG o WebP.'); return }
    const next = incoming.map((file, index) => ({ id: `${Date.now()}-${index}-${Math.random()}`, file, preview: URL.createObjectURL(file), name: file.name, status: 'pending' }))
    setFiles(old => [...old, ...next])
    setResults([])
    setNotice(`${incoming.length} imagen${incoming.length === 1 ? '' : 'es'} añadida${incoming.length === 1 ? '' : 's'} al lote.`)
    setSection('process')
  }

  function removeFile(id) {
    setFiles(old => {
      const target = old.find(item => item.id === id)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return old.filter(item => item.id !== id)
    })
    setResults(old => old.filter(item => item.id !== id))
  }

  async function processBatch() {
    if (!files.length || processing) return
    setProcessing(true); setProgress(0); setResults([]); setNotice('Procesando imágenes en este dispositivo…')
    const processed = []
    try {
      for (let i = 0; i < files.length; i++) {
        const item = files[i]
        const blob = await normalizeImage(item.file, { brightness: brightness / 100, contrast: contrast / 100, margin: margin / 100 })
        processed.push({ id: item.id, name: item.name.replace(/\.[^.]+$/, '') + '-1080.jpg', blob, url: URL.createObjectURL(blob) })
        setProgress(Math.round(((i + 1) / files.length) * 100))
        setResults([...processed])
      }
      setNotice(`Listo: ${processed.length} imagen${processed.length === 1 ? '' : 'es'} preparada${processed.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setNotice(error.message || 'Ocurrió un error procesando las imágenes.')
    } finally { setProcessing(false) }
  }

  async function downloadZip() {
    if (!canExport) return
    const zip = new JSZip()
    results.forEach(item => zip.file(item.name, item.blob))
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'DigiAR-fotos-procesadas.zip')
    setNotice('ZIP generado y listo para guardar.')
  }

  async function createPdf() {
    if (!canExport) { setNotice('Primero procesa al menos una fotografía.'); return }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210, pageH = 297, pad = 12, gap = 5
    const cols = pdfLayout === 'individual' ? 1 : perPage === 4 ? 2 : 3
    const rows = pdfLayout === 'individual' ? 1 : Math.ceil(perPage / cols)
    const cellW = (pageW - pad * 2 - gap * (cols - 1)) / cols
    const cellH = (pageH - pad * 2 - gap * (rows - 1) - 12) / rows
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && i % (pdfLayout === 'individual' ? 1 : perPage) === 0) pdf.addPage()
      if (i === 0 || i % (pdfLayout === 'individual' ? 1 : perPage) === 0) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text('DigiAR · Catálogo de productos', pad, 10)
      }
      const local = pdfLayout === 'individual' ? 0 : i % perPage
      const col = pdfLayout === 'individual' ? 0 : local % cols
      const row = pdfLayout === 'individual' ? 0 : Math.floor(local / cols)
      const x = pad + col * (cellW + gap)
      const y = 16 + row * (cellH + gap)
      const data = await blobToDataUrl(results[i].blob)
      const size = Math.min(cellW, cellH)
      pdf.addImage(data, 'JPEG', x + (cellW - size) / 2, y + (cellH - size) / 2, size, size)
      if (pdfLayout === 'individual') {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(results[i].name.replace(/-1080\.jpg$/i, ''), pad, 16 + size + 7, { maxWidth: pageW - pad * 2 })
      }
    }
    pdf.save(`${safeName(pdfName)}.pdf`)
    setNotice('PDF creado y descargado.')
  }

  function downloadOne(item) { downloadBlob(item.blob, item.name) }

  const activeTitle = useMemo(() => navItems.find(item => item.id === section)?.label || 'Inicio', [section])

  return <div className={`app ${dark ? 'theme-dark' : 'theme-light'}`}>
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Aperture size={25}/></div><div><strong>DigiAR</strong><span>PHOTO STUDIO</span></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
      <div className="workspace-label">ESPACIO DE TRABAJO</div>
      <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${section === item.id ? 'active' : ''}`} onClick={() => { setSection(item.id); setMobileNav(false) }}><Icon size={18}/><span>{item.label}</span>{section === item.id && <ChevronRight className="nav-arrow" size={16}/>}</button> })}</nav>
      <div className="sidebar-bottom"><div className="avatar">D</div><div className="profile-copy"><strong>Equipo DigiAR</strong><span>Espacio de trabajo</span></div><ShieldCheck size={17} className="muted-icon"/></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Cerrar navegación"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={21}/></button><div className="crumb">DigiAR <span>/</span> {activeTitle}</div><div className="top-actions"><span className="local-badge"><span/> Procesamiento local</span><button className="icon-btn" onClick={() => setDark(value => !value)} aria-label="Cambiar tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>
      <div className="page-content">
        {section === 'home' && <>
          <section className="welcome"><div><div className="eyebrow"><Sparkles size={14}/> HERRAMIENTAS PARA TU EQUIPO</div><h1>Menos tiempo editando.<br/><span>Más tiempo creando.</span></h1><p>Prepara las fotografías de tus clientes, uniforma tus catálogos y exporta tus archivos desde un solo lugar.</p><button className="primary-btn" onClick={() => { setSection('process'); inputRef.current?.click() }}><Plus size={17}/> Crear nuevo lote</button></div><div className="welcome-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-icon"><Aperture size={62}/></div><div className="art-caption"><span>PHOTO WORKFLOW</span><strong>Un solo lugar.<br/>Todo listo.</strong></div></div></section>
          <section className="section-block"><div className="section-heading"><div><h2>Tu espacio de trabajo</h2><p>Elige qué quieres hacer hoy.</p></div></div><div className="feature-grid"><Feature icon={Images} title="Procesar fotos" text="Ajusta tamaño, márgenes, iluminación y formato por lotes." onClick={() => setSection('process')}/><Feature icon={FileText} title="Crear PDF" text="Organiza las fotos preparadas en un catálogo para compartir." onClick={() => setSection('pdf')}/><Feature icon={FileArchive} title="Exportar imágenes" text="Descarga todas tus fotografías en un archivo ZIP." onClick={() => setSection('process')}/></div></section>
          <section className="section-block"><div className="section-heading"><div><h2>Resumen del lote</h2><p>Estado de este espacio de trabajo.</p></div></div><div className="stats-grid"><Stat label="Fotos cargadas" value={files.length} icon={ImagePlus}/><Stat label="Fotos preparadas" value={readyCount} icon={Check}/><Stat label="Formato de salida" value="1080²" icon={FileImage}/></div></section>
          <div className="privacy-note"><ShieldCheck size={18}/><div><strong>Diseñado para trabajar localmente</strong><p>Las funciones básicas de esta versión se ejecutan en tu navegador. No se suben las fotografías a un servidor de edición.</p></div></div>
        </>}
        {section === 'process' && <>
          <PageTitle eyebrow="PROCESAMIENTO DE IMÁGENES" title="Prepara tus fotografías" text="Carga un lote, ajusta los parámetros y genera imágenes uniformes para tus catálogos."/>
          <div className="process-layout"><section className="panel upload-panel"><div className="panel-head"><div><h2>1. Fotografías originales</h2><p>Selecciona varios archivos de imagen.</p></div><span className="count-pill">{files.length} archivos</span></div><div className="dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files) }}><div className="upload-icon"><UploadCloud size={28}/></div><strong>Arrastra tus fotografías aquí</strong><span>o selecciona archivos desde tu dispositivo</span><button className="secondary-btn" onClick={() => inputRef.current?.click()}>Seleccionar imágenes</button><small>JPG, PNG y WebP · La imagen original no se modifica</small></div><input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={event => { addFiles(event.target.files); event.target.value = '' }}/>{files.length > 0 && <div className="thumb-grid">{files.map(item => <div className="thumb-card" key={item.id}><img src={item.preview} alt={item.name}/><div className="thumb-name" title={item.name}>{item.name}</div><button className="thumb-remove" onClick={() => removeFile(item.id)} aria-label={`Quitar ${item.name}`}><X size={14}/></button></div>)}</div>}</section>
            <section className="panel settings-panel"><div className="panel-head"><div><h2>2. Ajustes de salida</h2><p>Se aplican a todo el lote.</p></div><WandSparkles size={20} className="accent-icon"/></div><div className="setting-row"><div><strong>Formato cuadrado</strong><span>1080 × 1080 píxeles</span></div><span className="enabled-tag"><Check size={13}/> Activo</span></div><div className="setting-row"><div><strong>Fondo blanco</strong><span>Se coloca la imagen sobre blanco</span></div><span className="enabled-tag"><Check size={13}/> Activo</span></div><RangeSetting label="Margen alrededor" value={margin} min={0} max={25} suffix="%" onChange={setMargin}/><RangeSetting label="Brillo" value={brightness} min={70} max={130} suffix="%" onChange={setBrightness}/><RangeSetting label="Contraste" value={contrast} min={70} max={130} suffix="%" onChange={setContrast}/><div className="notice-box"><Scissors size={17}/><p>El fondo blanco y el centrado funcionan en esta versión. La eliminación automática del fondo original y la mejora avanzada con IA aún están pendientes de integración.</p></div><button className="primary-btn full-btn" disabled={!files.length || processing} onClick={processBatch}>{processing ? <><LoaderCircle className="spin" size={17}/> Procesando {progress}%</> : <><WandSparkles size={17}/> Procesar {files.length || ''} fotografías</>}</button>{processing && <div className="progress-track"><div style={{ width: `${progress}%` }}/></div>}</section></div>
          <section className="panel results-panel"><div className="panel-head"><div><h2>3. Resultados</h2><p>Vista previa de las imágenes preparadas.</p></div><div className="export-actions"><button className="secondary-btn" disabled={!canExport} onClick={downloadZip}><FileArchive size={16}/> Descargar ZIP</button><button className="primary-btn small-btn" disabled={!canExport} onClick={() => setSection('pdf')}><FileText size={16}/> Crear PDF</button></div></div>{results.length === 0 ? <div className="empty-state"><div className="empty-icon"><Images size={26}/></div><strong>Tus imágenes preparadas aparecerán aquí</strong><span>Sube un lote y pulsa “Procesar fotografías”.</span></div> : <div className="result-grid">{results.map(item => <div className="result-card" key={item.id}><img src={item.url} alt={item.name}/><div className="result-meta"><span title={item.name}>{item.name}</span><button className="icon-btn" onClick={() => downloadOne(item)} aria-label={`Descargar ${item.name}`}><ArrowDownToLine size={16}/></button></div></div>)}</div>}</section>
        </>}
        {section === 'pdf' && <><PageTitle eyebrow="EXPORTACIÓN" title="Crea tu catálogo PDF" text="Convierte las fotografías procesadas en un documento listo para compartir o imprimir."/><div className="pdf-layout"><section className="panel"><div className="panel-head"><div><h2>Configuración del documento</h2><p>Personaliza la distribución de las imágenes.</p></div><FileText size={20} className="accent-icon"/></div><label className="field-label">Nombre del archivo</label><input className="text-input" value={pdfName} onChange={event => setPdfName(event.target.value)} placeholder="Catalogo-DigiAR"/><label className="field-label">Diseño</label><div className="choice-grid"><button className={`choice-card ${pdfLayout === 'catalog' ? 'selected' : ''}`} onClick={() => setPdfLayout('catalog')}><div className="mini-pages"><i/><i/><i/><i/><i/><i/></div><strong>Catálogo</strong><span>Varias fotos por página</span></button><button className={`choice-card ${pdfLayout === 'individual' ? 'selected' : ''}`} onClick={() => setPdfLayout('individual')}><div className="mini-pages single"><i/></div><strong>Individual</strong><span>Una foto por página</span></button></div>{pdfLayout === 'catalog' && <><label className="field-label">Fotos por página</label><div className="segmented">{[4,6,9].map(value => <button key={value} className={perPage === value ? 'selected' : ''} onClick={() => setPerPage(value)}>{value} fotos</button>)}</div></>}<div className="pdf-summary"><div><span>Fotografías incluidas</span><strong>{results.length}</strong></div><div><span>Documento</span><strong>A4 · Vertical</strong></div><div><span>Coste de generación</span><strong className="green-text">Gratis</strong></div></div><button className="primary-btn full-btn" disabled={!canExport} onClick={createPdf}><FileText size={17}/> Generar y descargar PDF</button>{results.length === 0 && <p className="helper-text">Primero procesa algunas fotografías en la sección “Procesar fotos”.</p>}</section><section className="panel pdf-preview-panel"><div className="panel-head"><div><h2>Vista previa del diseño</h2><p>Ejemplo de la distribución del catálogo.</p></div></div><div className="paper-preview"><div className="paper-logo"><Aperture size={20}/><span>DigiAR</span></div><h3>Catálogo de productos</h3><p>Fotografías de producto</p><div className={`paper-grid ${pdfLayout === 'individual' ? 'paper-single' : ''}`} style={{ gridTemplateColumns: `repeat(${pdfLayout === 'individual' ? 1 : perPage === 4 ? 2 : 3}, 1fr)` }}>{Array.from({ length: pdfLayout === 'individual' ? 1 : perPage }).map((_, i) => <div key={i} className="paper-image"><FileImage size={22}/></div>)}</div><div className="paper-footer">DigiAR · Catálogo de productos</div></div><p className="helper-text">La vista previa es ilustrativa; el PDF se genera con las fotografías procesadas.</p></section></div></>}
        {section === 'history' && <><PageTitle eyebrow="ACTIVIDAD" title="Historial de trabajo" text="Consulta los resultados de la sesión actual."/><div className="panel"><div className="empty-state"><div className="empty-icon"><History size={26}/></div><strong>{results.length ? `${results.length} fotografías preparadas en esta sesión` : 'Todavía no hay resultados'}</strong><span>Esta versión no guarda el historial entre sesiones.</span><button className="secondary-btn" onClick={() => setSection('process')}>Ir a procesar fotos <ChevronRight size={16}/></button></div></div></>}
        {section === 'settings' && <><PageTitle eyebrow="PREFERENCIAS" title="Configuración" text="Ajustes generales de DigiAR Photo Studio."/><div className="panel settings-page"><div className="setting-row"><div><strong>Apariencia</strong><span>Cambia entre modo oscuro y claro.</span></div><button className="secondary-btn" onClick={() => setDark(value => !value)}>{dark ? <Sun size={16}/> : <Moon size={16}/>} {dark ? 'Usar modo claro' : 'Usar modo oscuro'}</button></div><div className="setting-row"><div><strong>Privacidad</strong><span>Las fotos se procesan localmente en el navegador.</span></div><ShieldCheck size={20} className="accent-icon"/></div><div className="setting-row"><div><strong>Versión</strong><span>Prototipo inicial · 0.1.0</span></div><span className="count-pill">MVP</span></div><div className="notice-box"><ShieldCheck size={17}/><p>El inicio de sesión individual todavía no está conectado. Antes de usar la aplicación con información interna, integraremos autenticación real y protección de rutas.</p></div></div></>}
        {notice && <div className="toast" role="status"><Check size={16}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={15}/></button></div>}
        <footer className="footer"><span>© DigiAR Photo Studio</span><span><ShieldCheck size={14}/> Herramientas de trabajo para DigiAR</span></footer>
      </div>
    </main>
  </div>
}

function Feature({ icon: Icon, title, text, onClick }) { return <button className="feature-card" onClick={onClick}><div className="feature-icon"><Icon size={21}/></div><strong>{title}</strong><p>{text}</p><span className="feature-link">Abrir herramienta <ChevronRight size={15}/></span></button> }
function Stat({ label, value, icon: Icon }) { return <div className="stat-card"><div className="stat-icon"><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong></div></div> }
function PageTitle({ eyebrow, title, text }) { return <div className="page-title"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div> }
function RangeSetting({ label, value, min, max, suffix, onChange }) { return <div className="range-setting"><div><strong>{label}</strong><span>{value}{suffix}</span></div><input type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))}/></div> }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
function safeName(name) { return (name || 'Catalogo-DigiAR').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'Catalogo-DigiAR' }

export default App
