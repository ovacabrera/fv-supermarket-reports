import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, LineChart, ReferenceLine,
} from "recharts";

const C = {
  bg:"#0f1117", surface:"#181c27", surfaceAlt:"#1e2335", border:"#2a3050",
  accent:"#e8a838", text:"#eef0f8", textMuted:"#7880a0",
  green:"#3ecf8e", blue:"#4da6ff", red:"#ff6b6b", purple:"#b48eff",
};
const COLORS = ["#e8a838","#3ecf8e","#4da6ff","#ff6b6b","#b48eff","#ff9f43","#54a0ff","#5f27cd","#01cbc6","#ff6348","#ffd32a","#0be881","#c7b198","#3c40c4","#ef5777"];
const DIAS_CORTO  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_LARGO  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MESES_NOMBRE = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ─── IPC INDEC hardcodeado (variación mensual %) ───────────────────────────────
const IPC = {
  2023: [6.0, 6.6, 7.7, 8.4, 7.8, 6.0, 6.3, 12.4, 12.7, 8.3, 12.8, 25.5],
  2024: [20.6,13.2,11.0, 8.8, 4.2, 4.6, 4.0,  4.2,  3.5, 2.7,  2.4,  2.7],
  2025: [2.2,  2.4, 3.7, 2.8, 1.5, 1.6, 1.9,  1.9,  2.1, 2.3,  2.5,  2.8],
  2026: [2.9,  2.9, 3.4, 2.6, null,null,null,  null, null,null, null, null],
};

function acumuladoFactor(year, mesInicio, mesFin) {
  let f = 1;
  const datos = IPC[year] || [];
  for (let m = mesInicio; m <= mesFin; m++) {
    const v = datos[m];
    if (v != null) f *= (1 + v / 100);
  }
  return f;
}

function factorHastaHoy(year, mes) {
  const hoy = new Date();
  const hoyYear = hoy.getFullYear();
  const hoyMes  = hoy.getMonth();
  let f = 1;
  for (let y = year; y <= hoyYear; y++) {
    const inicio = (y === year)  ? mes  : 0;
    const fin    = (y === hoyYear) ? hoyMes : 11;
    const datos  = IPC[y] || [];
    for (let m = inicio; m <= fin; m++) {
      const v = datos[m];
      if (v != null) f *= (1 + v / 100);
    }
  }
  return f;
}

// ─── Utilidades fecha ──────────────────────────────────────────────────────────
function toYMD(d)  { return d.toISOString().slice(0,10); }
function fromYMD(s){ return new Date(s + "T12:00:00"); }
function sameDay(a,b){ return toYMD(a)===toYMD(b); }
function addMonths(d,n){ return new Date(d.getFullYear(), d.getMonth()+n, 1); }

// ─── Calendario de rango ───────────────────────────────────────────────────────
function RangeCalendar({ dateFrom, dateTo, onChange }) {
  const [viewDate, setViewDate] = useState(()=>fromYMD(dateFrom));
  const [hovering, setHovering] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const year=viewDate.getFullYear(), month=viewDate.getMonth();
  const firstDow=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const dfDate=fromYMD(dateFrom), dtDate=fromYMD(dateTo);

  function inRange(d){ const end=(selecting&&hovering)?hovering:dtDate; const lo=dfDate<end?dfDate:end; const hi=dfDate<end?end:dfDate; return d>lo&&d<hi; }
  function isStart(d){ return sameDay(d,dfDate); }
  function isEnd(d)  { const end=(selecting&&hovering)?hovering:dtDate; return sameDay(d,end); }
  function handleDayClick(d){
    const s=toYMD(d);
    if (!selecting){ onChange(s,s); setSelecting(true); }
    else { const a=fromYMD(dateFrom); const lo=d<a?s:dateFrom; const hi=d<a?dateFrom:s; onChange(lo,hi); setSelecting(false); setHovering(null); }
  }
  const cells=[];
  for(let i=0;i<firstDow;i++) cells.push(null);
  for(let i=1;i<=daysInMonth;i++) cells.push(new Date(year,month,i,12));

  return (
    <div style={{userSelect:"none"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setViewDate(addMonths(viewDate,-1))} style={{background:"none",border:"none",color:C.textMuted,fontSize:18,cursor:"pointer",padding:"2px 8px"}}>‹</button>
        <div style={{fontWeight:700,fontSize:14,color:C.text}}>{MESES_NOMBRE[month]} {year}</div>
        <button onClick={()=>setViewDate(addMonths(viewDate,1))}  style={{background:"none",border:"none",color:C.textMuted,fontSize:18,cursor:"pointer",padding:"2px 8px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {["Do","Lu","Ma","Mi","Ju","Vi","Sá"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:600,paddingBottom:2}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const start=isStart(d), end=isEnd(d), range=inRange(d), isToday=sameDay(d,new Date());
          const bg=(start||end)?C.accent:range?"#e8a83828":"transparent";
          const color=(start||end)?"#000":range?C.accent:C.text;
          const br=start?"50% 0 0 50%":end?"0 50% 50% 0":range?"0":"50%";
          return <div key={i} onClick={()=>handleDayClick(d)} onMouseEnter={()=>{ if(selecting) setHovering(d); }}
            style={{textAlign:"center",padding:"5px 0",cursor:"pointer",background:bg,borderRadius:br,color,fontWeight:(start||end)?700:400,fontSize:13,outline:isToday&&!start&&!end?`1px solid ${C.accent}`:"none"}}>{d.getDate()}</div>;
        })}
      </div>
      {selecting && <div style={{textAlign:"center",fontSize:11,color:C.accent,marginTop:8}}>Ahora elegí la fecha hasta ›</div>}
    </div>
  );
}

// ─── Parser HSQLDB ────────────────────────────────────────────────────────────
function parseHSQLScript(text) {
  text = text.replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
  const lines = text.split(/\r?\n/);
  const OC={ORDER_ID:0,SALE_DATE:38,STATUS:40,TOTAL:45,CASHIER_ID:46};
  const LC={PRICE:6,QTY:8,CATEGORY_ID:10,ORDER_ID:11,PRODUCT_ID:12};
  function parseValues(line){ const m=line.match(/VALUES\((.+)\)$/s); if(!m) return null; const raw=m[1]; const vals=[]; let cur="",inStr=false,i=0; while(i<raw.length){ const ch=raw[i]; if(ch==="'"&&!inStr){inStr=true;i++;continue;} if(ch==="'"&&inStr){if(raw[i+1]==="'"){cur+="'";i+=2;continue;}inStr=false;i++;continue;} if(ch===","&&!inStr){vals.push(cur);cur="";i++;continue;} cur+=ch;i++;} vals.push(cur); return vals; }
  function num(v){ if(!v||v==="NULL") return 0; return parseFloat(v.replace(/E0$/,""))||0; }
  function parseTS(v){ if(!v||v==="NULL") return null; return new Date(v.replace(/\.\d+$/,"").replace(" ","T")); }
  const orders=[],orderLines=[],employees={},categories={},products={};
  for(const line of lines){
    if(line.startsWith("INSERT INTO FVPOS_ORDER VALUES")){
      const v=parseValues(line); if(!v) continue;
      if(v[OC.STATUS]!=="COMPLETED") continue;
      const saleDate=parseTS(v[OC.SALE_DATE]); if(!saleDate) continue;
      orders.push({id:num(v[OC.ORDER_ID]),saleDate,total:num(v[OC.TOTAL]),cashierId:num(v[OC.CASHIER_ID])});
    } else if(line.startsWith("INSERT INTO FVPOS_ORDER_LINE VALUES")){
      const v=parseValues(line); if(!v) continue;
      orderLines.push({orderId:num(v[LC.ORDER_ID]),categoryId:v[LC.CATEGORY_ID]==="NULL"?null:num(v[LC.CATEGORY_ID]),subtotal:num(v[LC.PRICE])*num(v[LC.QTY]),qty:num(v[LC.QTY]),productId:v[LC.PRODUCT_ID]==="NULL"?null:num(v[LC.PRODUCT_ID]),description:v[2]||""});
    } else if(line.startsWith("INSERT INTO FVPOS_EMPLOYEE VALUES")){
      const v=parseValues(line); if(!v) continue;
      const id=num(v[0]);
      const name=[v[32]||"",v[34]||""].join(" ").trim()||(v[45]||"").trim()||`Cajero ${id}`;
      employees[id]=name;
    } else if(line.startsWith("INSERT INTO FVPOS_PRODUCT_CATEGORY VALUES")){
      const v=parseValues(line); if(!v) continue;
      categories[num(v[0])]=v[2]||`Cat.${v[0]}`;
    } else if(line.startsWith("INSERT INTO FVPOS_PRODUCT VALUES")){
      const v=parseValues(line); if(!v) continue;
      products[num(v[0])]=v[6]||`Prod.${v[0]}`;
    }
  }
  return {orders,orderLines,employees,categories,products};
}

// ─── Helpers display ──────────────────────────────────────────────────────────
function ars(n)      { return "$ "+Math.round(n).toLocaleString("es-AR"); }
function arsShort(n) { n=Math.round(n); if(n>=1000000) return "$"+(n/1000000).toFixed(1).replace(".",",")+"M"; if(n>=1000) return "$"+Math.round(n/1000)+"k"; return "$"+n; }
function pct(n)      { return (n>=0?"+":"")+n.toFixed(1)+"%" }

function PieLabel({cx,cy,midAngle,innerRadius,outerRadius,value}){
  if(value<500) return null;
  const r=innerRadius+(outerRadius-innerRadius)*0.55;
  const x=cx+r*Math.cos(-midAngle*Math.PI/180), y=cy+r*Math.sin(-midAngle*Math.PI/180);
  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>{arsShort(value)}</text>;
}
function BarLabelRight({x,y,width,height,value}){
  if(!value||value<500) return null;
  return <text x={x+width+5} y={y+height/2} fill={C.textMuted} dominantBaseline="central" fontSize={10}>{arsShort(value)}</text>;
}

// ─── Tooltip histograma ────────────────────────────────────────────────────────
function TooltipHistograma({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:12}}>
      <div style={{fontWeight:700,color:C.text,marginBottom:4}}>{d.rangoLabel}</div>
      <div style={{color:C.accent}}>{d.cantidad} transacci{d.cantidad===1?"ón":"ones"}</div>
      <div style={{color:C.textMuted,marginTop:2}}>{d.pctTotal?.toFixed(1)}% del total</div>
    </div>
  );
}

// ─── Histograma de distribución de tickets ────────────────────────────────────
function HistogramaTickets({ filtered, ticketProm }) {
  const histData = useMemo(() => {
    if (!filtered?.length) return null;

    // Filtrar outliers extremos (> 5x el ticket promedio) para que la escala sea legible
    const totales = filtered.map(o => o.total).filter(t => t > 0);
    if (!totales.length) return null;

    // Calcular percentil 95 para el límite superior del histograma
    const sorted = [...totales].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const maxVal = Math.max(p95, ticketProm * 2);

    // Definir bins: queremos ~15 barras que cubran bien el rango
    const NUM_BINS = 15;
    const binSize = Math.ceil(maxVal / NUM_BINS / 100) * 100; // redondear a centenas
    const actualBins = Math.ceil(maxVal / binSize) + 1;

    // Inicializar bins
    const bins = Array.from({ length: actualBins }, (_, i) => ({
      desde: i * binSize,
      hasta: (i + 1) * binSize,
      cantidad: 0,
    }));

    // Acumular transacciones en cada bin
    totales.forEach(t => {
      const idx = Math.min(Math.floor(t / binSize), actualBins - 1);
      if (bins[idx]) bins[idx].cantidad++;
    });

    const totalTx = totales.length;

    return bins
      .filter((b, i) => {
        // Eliminar bins vacíos al final
        const lastNonEmpty = bins.reduce((acc, b2, i2) => b2.cantidad > 0 ? i2 : acc, 0);
        return i <= lastNonEmpty + 1;
      })
      .map(b => ({
        ...b,
        rangoLabel: `${arsShort(b.desde)} – ${arsShort(b.hasta)}`,
        pctTotal: (b.cantidad / totalTx) * 100,
        label: arsShort(b.desde),
      }));
  }, [filtered, ticketProm]);

  if (!histData || !histData.length) return <NoData />;

  // Encontrar el bin del ticket promedio
  const binSize = histData[0]?.hasta - histData[0]?.desde;
  const ticketBinIdx = histData.findIndex(b => ticketProm >= b.desde && ticketProm < b.hasta);
  const maxCantidad = Math.max(...histData.map(d => d.cantidad));

  // Stats adicionales
  const totales = filtered.map(o => o.total).filter(t => t > 0).sort((a,b)=>a-b);
  const mediana = totales.length
    ? totales.length % 2 === 0
      ? (totales[totales.length/2-1] + totales[totales.length/2]) / 2
      : totales[Math.floor(totales.length/2)]
    : 0;
  const p25 = totales[Math.floor(totales.length * 0.25)] ?? 0;
  const p75 = totales[Math.floor(totales.length * 0.75)] ?? 0;

  // Calcular skewness simple (promedio vs mediana)
  const sesgo = ticketProm > mediana * 1.1
    ? "↗ Cola alta: hay algunas compras grandes que suben el promedio"
    : ticketProm < mediana * 0.9
    ? "↙ Cola baja: muchas compras pequeñas arrastran el promedio"
    : "≈ Distribución bastante simétrica alrededor del promedio";

  const TickLabel = ({ x, y, payload }) => {
    if (!payload?.value) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={10} textAnchor="end" fill={C.textMuted} fontSize={9}
          transform="rotate(-40)">{payload.value}</text>
      </g>
    );
  };

  return (
    <div>
      {/* Stats rápidos */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <MiniStatSm label="Mediana" value={arsShort(mediana)} color={C.green}/>
        <MiniStatSm label="Promedio" value={arsShort(ticketProm)} color={C.accent}/>
        <MiniStatSm label="P25" value={arsShort(p25)} color={C.textMuted}/>
        <MiniStatSm label="P75" value={arsShort(p75)} color={C.textMuted}/>
      </div>

      {/* Insight automático */}
      <div style={{
        background: C.surfaceAlt,
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 12,
        fontSize: 11,
        color: C.textMuted,
        borderLeft: `3px solid ${C.accent}`,
      }}>
        {sesgo}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={histData} margin={{top:10, right:16, left:0, bottom:30}}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis
            dataKey="label"
            interval={0}
            tick={<TickLabel/>}
            axisLine={false}
            tickLine={false}
            height={44}
          />
          <YAxis
            tick={{fill:C.textMuted, fontSize:10}}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip content={<TooltipHistograma/>}/>

          {/* Línea vertical del ticket promedio */}
          {ticketBinIdx >= 0 && (
            <ReferenceLine
              x={histData[ticketBinIdx]?.label}
              stroke={C.accent}
              strokeDasharray="4 3"
              strokeWidth={2}
              label={{
                value: "x̄ prom.",
                position: "top",
                fill: C.accent,
                fontSize: 10,
                fontWeight: 700,
              }}
            />
          )}

          <Bar
            dataKey="cantidad"
            name="Transacciones"
            radius={[3,3,0,0]}
          >
            {histData.map((entry, index) => (
              <Cell
                key={index}
                fill={index === ticketBinIdx ? C.accent : C.blue}
                opacity={index === ticketBinIdx ? 1 : 0.55}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{
        display:"flex",gap:16,justifyContent:"center",marginTop:4,fontSize:11,color:C.textMuted
      }}>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:10,height:10,borderRadius:2,background:C.accent,display:"inline-block"}}/>
          Bin con el promedio
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:10,height:10,borderRadius:2,background:C.blue,opacity:0.6,display:"inline-block"}}/>
          Resto de rangos
        </span>
      </div>
    </div>
  );
}

// ─── Tooltip custom para gráfico histórico ─────────────────────────────────────
function TooltipHistorico({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:12}}>
      <div style={{fontWeight:700,color:C.text,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||C.text,marginBottom:2}}>
          {p.name}: {p.name==="IPC %" ? (p.value!=null ? p.value.toFixed(1)+"%" : "—") : ars(p.value??0)}
        </div>
      ))}
    </div>
  );
}

// ─── Gráfico anual con IPC + sombra año anterior ──────────────────────────────
function GraficoAnual({ year, orders, orderLines, esActual }) {
  const hoy     = new Date();
  const hoyYear = hoy.getFullYear();
  const hoyMes  = hoy.getMonth();

  const ventasMes = Array(12).fill(0);
  const opsMes    = Array(12).fill(0);
  orders.forEach(o => {
    if (o.saleDate.getFullYear() !== year) return;
    if (o.total > 10_000_000) return;
    const m = o.saleDate.getMonth();
    ventasMes[m] += o.total;
    opsMes[m]    += 1;
  });

  const ordenMes={};
  orders.forEach(o=>{
    if(o.saleDate.getFullYear()!==year||o.total>10_000_000) return;
    ordenMes[o.id]=o.saleDate.getMonth();
  });
  const unidadesMesCorrecto=Array(12).fill(0);
  orderLines.forEach(ol=>{
    const m=ordenMes[ol.orderId];
    if(m===undefined) return;
    unidadesMesCorrecto[m]+=ol.qty;
  });

  const mesFin = year===hoyYear ? hoyMes : 11;
  let totalAnio=0, opsAnio=0, unidadesAnio=0;
  for(let m=0;m<=mesFin;m++){
    totalAnio    += ventasMes[m];
    opsAnio      += opsMes[m];
    unidadesAnio += unidadesMesCorrecto[m];
  }
  const ticketAnio = opsAnio ? totalAnio/opsAnio : 0;

  let ventasAnteriorMes = null;
  if (esActual) {
    ventasAnteriorMes = Array(12).fill(0);
    orders.forEach(o => {
      if (o.saleDate.getFullYear() !== year - 1) return;
      if (o.total > 10_000_000) return;
      ventasAnteriorMes[o.saleDate.getMonth()] += o.total;
    });
  }

  const ipcAnio = IPC[year] || Array(12).fill(null);
  const factorAnioActual = esActual ? acumuladoFactor(year, 0, hoyMes) : 1;

  const data = MESES_CORTO.map((mes, m) => {
    const esFuturo = year === hoyYear && m > hoyMes;
    const ventas   = esFuturo ? null : Math.round(ventasMes[m]);
    const row      = { mes, ventas, ipc: ipcAnio[m] ?? null };
    if (esActual && ventasAnteriorMes) {
      row.sombra = esFuturo ? null : Math.round(ventasAnteriorMes[m] * factorAnioActual);
    }
    return row;
  });

  const maxVentas = Math.max(...data.map(d => Math.max(d.ventas||0, d.sombra||0)), 1);

  const TickRotado = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="end" fill={C.textMuted} fontSize={9}
        transform="rotate(-40)">{payload.value}</text>
    </g>
  );

  const LabelBarra = ({ x, y, width, value }) => {
    if (!value) return null;
    return (
      <text x={x + width / 2} y={y - 3} textAnchor="middle"
        fill={C.accent} fontSize={8} fontWeight={600}>
        {arsShort(value)}
      </text>
    );
  };

  return (
    <Card title={`${year}${esActual ? " · año en curso" : ""}`}>
      <div style={{display:"flex",gap:14,marginBottom:12,flexWrap:"wrap",paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
        <MiniStatSm label="Total" value={arsShort(totalAnio)} color={C.accent}/>
        <MiniStatSm label="Operaciones" value={Math.round(opsAnio).toLocaleString("es-AR")} color={C.blue}/>
        <MiniStatSm label="Ticket prom." value={arsShort(ticketAnio)} color={C.green}/>
        <MiniStatSm label="Unidades" value={Math.round(unidadesAnio).toLocaleString("es-AR")} color={C.purple}/>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap",fontSize:11}}>
        <LegendDot color={C.accent} label="Ventas nominales"/>
        {esActual && <LegendDot color={C.textMuted} label={`${year-1} ajustado IPC`} faded/>}
        <LegendDot color={C.blue} label="IPC mensual %" line/>
      </div>
      <ResponsiveContainer width="100%" height={270}>
        <ComposedChart data={data} margin={{top:20, right:38, left:0, bottom:24}}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis
            dataKey="mes"
            interval={0}
            tick={<TickRotado/>}
            axisLine={false}
            tickLine={false}
            height={40}
          />
          <YAxis yAxisId="v" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}
            tickFormatter={arsShort} domain={[0, maxVentas*1.25]} width={42}/>
          <YAxis yAxisId="i" orientation="right" tick={{fill:C.blue,fontSize:9}} axisLine={false}
            tickLine={false} tickFormatter={v=>v!=null?v.toFixed(0)+"%":""} domain={[0,"auto"]} width={28}/>
          <Tooltip content={<TooltipHistorico/>}/>
          {esActual && (
            <Bar yAxisId="v" dataKey="sombra" name={`${year-1} ajustado`}
              fill={C.textMuted} opacity={0.3} radius={[3,3,0,0]} barSize={10}/>
          )}
          <Bar yAxisId="v" dataKey="ventas" name="Ventas"
            fill={C.accent} radius={[3,3,0,0]} barSize={10}
            label={<LabelBarra/>}/>
          <Line yAxisId="i" type="monotone" dataKey="ipc" name="IPC %"
            stroke={C.blue} strokeWidth={2} dot={{r:3,fill:C.blue}}
            activeDot={{r:5}} connectNulls={false}/>
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function LegendDot({color,label,faded,line}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,color:C.textMuted}}>
      {line
        ? <div style={{width:16,height:2,background:color}}/>
        : <div style={{width:10,height:10,borderRadius:2,background:color,opacity:faded?0.35:1}}/>
      }
      <span>{label}</span>
    </div>
  );
}

// ─── Top productos frecuentes con ticket bajo ─────────────────────────────────
function TooltipFrecuentes({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:12}}>
      <div style={{fontWeight:700,color:C.text,marginBottom:6,maxWidth:180,whiteSpace:"normal",lineHeight:1.3}}>{d.name}</div>
      <div style={{color:C.green,marginBottom:2}}>🔁 {d.txCount} transacciones</div>
      <div style={{color:C.textMuted}}>Subtotal prom.: {arsShort(d.subtotalProm)}</div>
    </div>
  );
}

function TopFrecuentesBaratos({ data, mediana }) {
  if (!data?.length) return (
    <div style={{padding:"20px 0",textAlign:"center",color:C.textMuted,fontSize:13}}>
      No hay productos frecuentes con ticket bajo en este período
    </div>
  );

  const LabelFrec = ({ x, y, width, height, value }) => {
    if (!value) return null;
    return (
      <text x={x + width + 6} y={y + height / 2} dominantBaseline="central"
        fill={C.textMuted} fontSize={10}>
        {value} tx
      </text>
    );
  };

  const TickNombre = ({ x, y, payload }) => {
    const texto = payload.value.length > 18 ? payload.value.slice(0, 17) + "…" : payload.value;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={4} textAnchor="end" fill={C.textMuted} fontSize={11}>{texto}</text>
      </g>
    );
  };

  return (
    <div>
      <div style={{
        background:C.surfaceAlt, borderRadius:8, padding:"8px 12px",
        marginBottom:14, fontSize:11, color:C.textMuted,
        borderLeft:`3px solid ${C.green}`,
      }}>
        Productos que aparecen en más transacciones <strong style={{color:C.text}}>pero su subtotal promedio está por debajo de la mediana</strong> ({arsShort(mediana)}). Son los mejores candidatos para un <strong style={{color:C.green}}>3x2</strong>.
      </div>

      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 48 + 20)}>
        <BarChart
          data={data}
          layout="vertical"
          barSize={22}
          margin={{top:4, right:60, left:8, bottom:4}}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
          <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="name" tick={<TickNombre/>} axisLine={false} tickLine={false} width={130}/>
          <Tooltip content={<TooltipFrecuentes/>}/>
          <Bar dataKey="txCount" name="Transacciones" radius={[0,4,4,0]} label={<LabelFrec/>}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:10}}>
        {data.map((p,i)=>(
          <div key={i} style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"6px 10px", borderRadius:6, background:C.surfaceAlt,
            fontSize:11,
          }}>
            <span style={{color:COLORS[i%COLORS.length],fontWeight:600,
              maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {p.name}
            </span>
            <span style={{color:C.textMuted,fontFamily:"'DM Mono',monospace",flexShrink:0,marginLeft:8}}>
              prom. {arsShort(p.subtotalProm)} / tx
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pestaña Histórico ─────────────────────────────────────────────────────────
function TabHistorico({ db }) {
  const hoyYear = new Date().getFullYear();
  const years = [hoyYear, hoyYear-1, hoyYear-2, hoyYear-3];

  return (
    <div>
      <div style={{background:C.surfaceAlt,borderRadius:12,border:`1px solid ${C.border}`,padding:"12px 14px",marginBottom:14,fontSize:12,color:C.textMuted,lineHeight:1.6}}>
        <span style={{color:C.blue,fontWeight:600}}>ℹ️ Cómo leer los gráficos:</span> Las barras <span style={{color:C.accent}}>doradas</span> son ventas nominales. La línea <span style={{color:C.blue}}>azul</span> es el IPC mensual del INDEC — si tus barras crecen menos que la línea, en términos reales estás vendiendo menos. En el año en curso, las barras grises son las ventas del año anterior ajustadas por inflación acumulada.
      </div>
      {years.map((y,i) => (
        <GraficoAnual key={y} year={y} orders={db.orders} orderLines={db.orderLines} esActual={i===0}/>
      ))}
      <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:4,marginBottom:16}}>
        Fuente IPC: INDEC · Datos 2023–2026 · 2026 con datos disponibles hasta feb.
      </div>
    </div>
  );
}

// ─── App principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [db, setDb]           = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [fileName, setFileName] = useState(null);
  const [tab, setTab]         = useState("ventas");
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef(null);

  const today = toYMD(new Date());
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo]     = useState(today);
  const [timeFrom, setTimeFrom] = useState("00:00");
  const [timeTo, setTimeTo]     = useState("23:59");

  useEffect(()=>{
    function handler(e){ if(calRef.current&&!calRef.current.contains(e.target)) setCalOpen(false); }
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const handleFile = useCallback(async (file)=>{
    if(!file) return;
    setLoading(true); setError(null); setFileName(file.name);
    try {
      if(file.name.endsWith(".7z")||file.name.endsWith(".zip")){ setError("Descomprimí el .7z y subí fvposdb.script."); setLoading(false); return; }
      setDb(parseHSQLScript(await file.text()));
    } catch(e){ setError("Error: "+e.message); }
    setLoading(false);
  },[]);

  const onDrop = useCallback((e)=>{ e.preventDefault(); const f=e.dataTransfer?.files?.[0]||e.target?.files?.[0]; if(f) handleFile(f); },[handleFile]);

  const filtered = useMemo(()=>{
    if(!db) return null;
    const [fH,fM]=timeFrom.split(":").map(Number);
    const [tH,tM]=timeTo.split(":").map(Number);
    const fromMs=new Date(dateFrom+"T00:00:00").getTime();
    const toMs=new Date(dateTo+"T23:59:59").getTime();
    return db.orders.filter(o=>{
      const t=o.saleDate.getTime();
      if(t<fromMs||t>toMs) return false;
      const mins=o.saleDate.getHours()*60+o.saleDate.getMinutes();
      return mins>=fH*60+fM&&mins<=tH*60+tM;
    });
  },[db,dateFrom,dateTo,timeFrom,timeTo]);

  const metrics = useMemo(()=>{
    if(!filtered) return null;
    const totalVentas=filtered.reduce((s,o)=>s+o.total,0);
    const cantOps=filtered.length;
    const ticketProm=cantOps?totalVentas/cantOps:0;
    const singleDay=dateFrom===dateTo;
    const filteredIds=new Set(filtered.map(o=>o.id));
    const totalUnidades=Math.round(db.orderLines.reduce((s,ol)=>filteredIds.has(ol.orderId)?s+ol.qty:s,0));
    let timeData;
    if(singleDay){
      const byHour={};
      filtered.forEach(o=>{const h=o.saleDate.getHours();byHour[h]=(byHour[h]||0)+o.total;});
      timeData=Array.from({length:24},(_,i)=>({label:`${String(i).padStart(2,"0")}h`,ventas:Math.round(byHour[i]||0)})).filter(d=>d.ventas>0);
    } else {
      const byDay={};
      filtered.forEach(o=>{const d=toYMD(o.saleDate);byDay[d]=(byDay[d]||0)+o.total;});
      timeData=Object.entries(byDay).sort().map(([d,v])=>{const dt=fromYMD(d);return{label:`${DIAS_CORTO[dt.getDay()]} ${dt.getDate()}`,ventas:Math.round(v)};});
    }
    const byEmp={};
    filtered.forEach(o=>{const name=db.employees[o.cashierId]||`Cajero ${o.cashierId}`;byEmp[name]=(byEmp[name]||0)+o.total;});
    const empData=Object.entries(byEmp).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value);
    const FIAMBR_PROD_ID = 25912;
    const byCat={};
    db.orderLines.forEach(ol=>{
      if(!filteredIds.has(ol.orderId)) return;
      let cat;
      if(ol.productId===FIAMBR_PROD_ID) { cat="Fiambrería Ticket"; }
      else { cat=ol.categoryId?(db.categories[ol.categoryId]||"Sin categoría"):"Sin categoría"; }
      byCat[cat]=(byCat[cat]||0)+ol.subtotal;
    });
    const catData=Object.entries(byCat).map(([name,value])=>({name,value:Math.round(value)})).sort((a,b)=>b.value-a.value).slice(0,15);
    const byProd={};
    db.orderLines.forEach(ol=>{
      if(!filteredIds.has(ol.orderId)) return;
      if(!ol.productId||ol.productId===0) return;
      if(ol.productId===FIAMBR_PROD_ID) return;
      const nombre=db.products[ol.productId]||`Prod.${ol.productId}`;
      if(!byProd[nombre]) byProd[nombre]={qty:0,total:0,txCount:0};
      byProd[nombre].qty+=ol.qty;
      byProd[nombre].total+=ol.subtotal;
      byProd[nombre].txCount+=1; // cuántas transacciones distintas incluyen este producto
    });
    const top5=Object.entries(byProd).map(([name,d])=>({name,qty:Math.round(d.qty),total:Math.round(d.total)})).sort((a,b)=>b.qty-a.qty).slice(0,5);

    // Mediana del negocio (tickets de las órdenes filtradas)
    const ticketsSorted = filtered.map(o=>o.total).filter(t=>t>0).sort((a,b)=>a-b);
    const mediana = ticketsSorted.length
      ? ticketsSorted.length % 2 === 0
        ? (ticketsSorted[ticketsSorted.length/2-1] + ticketsSorted[ticketsSorted.length/2]) / 2
        : ticketsSorted[Math.floor(ticketsSorted.length/2)]
      : 0;

    // Top 5 productos: frecuentes (muchas transacciones) con subtotal promedio < mediana
    const top5FrecuentesBaratos = Object.entries(byProd)
      .map(([name,d])=>({
        name,
        txCount: d.txCount,
        subtotalProm: d.txCount > 0 ? Math.round(d.total / d.txCount) : 0,
        total: Math.round(d.total),
      }))
      .filter(p => p.subtotalProm < mediana && p.txCount >= 2)
      .sort((a,b) => b.txCount - a.txCount)
      .slice(0,5);

    return{totalVentas,cantOps,ticketProm,totalUnidades,timeData,empData,catData,singleDay,top5,top5FrecuentesBaratos,mediana};
  },[filtered,db,dateFrom,dateTo]);

  const historico = useMemo(()=>{
    if(!db) return null;
    const now=new Date();
    const meses = Array.from({length:4},(_,i)=>{
      const ref=new Date(now.getFullYear(),now.getMonth()-1-i,1);
      const inicio=new Date(ref.getFullYear(),ref.getMonth(),1);
      const fin=new Date(ref.getFullYear(),ref.getMonth()+1,0,23,59,59);
      const ords=db.orders.filter(o=>o.saleDate>=inicio&&o.saleDate<=fin&&o.total<=10_000_000);
      const total=ords.reduce((s,o)=>s+o.total,0);
      const cantOps=ords.length;
      const ticketProm=cantOps?total/cantOps:0;
      const ordIds=new Set(ords.map(o=>o.id));
      const unidades=Math.round(db.orderLines.reduce((s,ol)=>ordIds.has(ol.orderId)?s+ol.qty:s,0));
      const byDay={};
      ords.forEach(o=>{const d=toYMD(o.saleDate);byDay[d]=(byDay[d]||0)+o.total;});
      let picoKey=null,picoVal=0;
      Object.entries(byDay).forEach(([d,v])=>{if(v>picoVal){picoVal=v;picoKey=d;}});
      let picoInfo=null;
      if(picoKey){const dt=fromYMD(picoKey);picoInfo={dia:dt.getDate(),diaSemana:DIAS_LARGO[dt.getDay()],total:Math.round(picoVal)};}
      const nombreMes=ref.toLocaleString("es-AR",{month:"long",year:"numeric"});
      const ipcMes = (IPC[ref.getFullYear()]||[])[ref.getMonth()] ?? null;
      return{nombre:nombreMes.charAt(0).toUpperCase()+nombreMes.slice(1),total:Math.round(total),cantOps,ticketProm:Math.round(ticketProm),unidades,pico:picoInfo,ipc:ipcMes,ref};
    });
    return meses.slice(0,3).map((m,i)=>{
      const anterior = meses[i+1];
      const variacion = anterior && anterior.total > 0
        ? ((m.total - anterior.total) / anterior.total) * 100
        : null;
      return {...m, variacion};
    });
  },[db]);

  const rangeLabel = useMemo(()=>{
    if(dateFrom===dateTo){const d=fromYMD(dateFrom);return `${d.getDate()} de ${MESES_NOMBRE[d.getMonth()]}`;}
    const a=fromYMD(dateFrom),b=fromYMD(dateTo);
    return `${a.getDate()} ${MESES_NOMBRE[a.getMonth()].slice(0,3)} → ${b.getDate()} ${MESES_NOMBRE[b.getMonth()].slice(0,3)}`;
  },[dateFrom,dateTo]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#2a3050;border-radius:3px}
        input[type=time]{background:#1e2335;color:#eef0f8;border:1px solid #2a3050;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:14px;outline:none;cursor:pointer;color-scheme:dark;width:100%}
        input[type=time]:focus{border-color:#e8a838}
        button{cursor:pointer;font-family:inherit}
        .dropzone:hover{border-color:#e8a838!important}
      `}</style>

      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:10,background:C.surface}}>
        <div style={{width:32,height:32,borderRadius:7,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🛒</div>
        <div><div style={{fontWeight:700,fontSize:16}}>Panel de Ventas</div><div style={{fontSize:11,color:C.textMuted}}>FácilVirtual · HSQLDB</div></div>
        {fileName && <div style={{marginLeft:"auto",fontSize:11,color:C.green,background:"#3ecf8e18",padding:"3px 10px",borderRadius:20,border:`1px solid #3ecf8e33`}}>✓ {fileName}</div>}
      </div>

      {/* Tabs */}
      {db && (
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
          {[["ventas","📊 Ventas"],["historico","📈 Histórico IPC"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1,padding:"12px 0",fontSize:13,fontWeight:600,
              background:"none",border:"none",
              color:tab===id?C.accent:C.textMuted,
              borderBottom:tab===id?`2px solid ${C.accent}`:"2px solid transparent",
              transition:"all 0.15s",
            }}>{label}</button>
          ))}
        </div>
      )}

      <div style={{padding:"16px 14px",maxWidth:680,margin:"0 auto"}}>

        {/* Upload */}
        {!db && !loading && (
          <div className="dropzone" style={{border:`2px dashed ${C.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center",cursor:"pointer",background:C.surface}}
            onDragOver={e=>e.preventDefault()} onDrop={onDrop} onClick={()=>document.getElementById("fi").click()}>
            <div style={{fontSize:38,marginBottom:10}}>📂</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Subí <span style={{color:C.accent}}>fvposdb.script</span></div>
            <div style={{fontSize:13,color:C.textMuted}}>Dentro del .7z en <code style={{color:C.accent}}>FacilVirtual/data/</code></div>
            <input id="fi" type="file" accept="*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          </div>
        )}
        {loading && <div style={{textAlign:"center",padding:60,color:C.textMuted}}><div style={{fontSize:28,marginBottom:10}}>⏳</div>Procesando base de datos...</div>}
        {error   && <div style={{background:"#ff6b6b18",border:`1px solid #ff6b6b44`,borderRadius:10,padding:"12px 16px",marginBottom:14,color:C.red}}>⚠️ {error}</div>}

        {/* ── PESTAÑA VENTAS ── */}
        {db && tab==="ventas" && (
          <>
            <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:"16px 14px",marginBottom:14}}>
              <Lbl>Período</Lbl>
              <div ref={calRef} style={{position:"relative",marginBottom:12}}>
                <button onClick={()=>setCalOpen(o=>!o)} style={{width:"100%",background:C.surfaceAlt,border:`1px solid ${calOpen?C.accent:C.border}`,color:C.text,borderRadius:8,padding:"10px 14px",fontSize:14,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>📅 {rangeLabel}</span><span style={{color:C.textMuted,fontSize:12}}>{calOpen?"▲":"▼"}</span>
                </button>
                {calOpen && (
                  <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:100,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",boxShadow:"0 8px 32px #00000080"}}>
                    <RangeCalendar dateFrom={dateFrom} dateTo={dateTo} onChange={(a,b)=>{setDateFrom(a);setDateTo(b);}}/>
                    <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                      <SmallBtn onClick={()=>{const t=toYMD(new Date());setDateFrom(t);setDateTo(t);}}>Hoy</SmallBtn>
                      <SmallBtn onClick={()=>{const a=new Date();a.setDate(a.getDate()-6);setDateFrom(toYMD(a));setDateTo(toYMD(new Date()));}}>Últimos 7 días</SmallBtn>
                      <SmallBtn onClick={()=>{const n=new Date();setDateFrom(toYMD(new Date(n.getFullYear(),n.getMonth(),1)));setDateTo(toYMD(new Date(n.getFullYear(),n.getMonth()+1,0)));}}>Este mes</SmallBtn>
                      <SmallBtn onClick={()=>setCalOpen(false)} accent>Listo ✓</SmallBtn>
                    </div>
                  </div>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div><Lbl>Hora desde</Lbl><input type="time" value={timeFrom} onChange={e=>setTimeFrom(e.target.value)} style={{fontSize:12,padding:"6px 8px"}}/></div>
                <div><Lbl>Hora hasta</Lbl><input type="time" value={timeTo}   onChange={e=>setTimeTo(e.target.value)}   style={{fontSize:12,padding:"6px 8px"}}/></div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Btn onClick={()=>{setDateFrom(today);setDateTo(today);setTimeFrom("00:00");setTimeTo("23:59");}}>Hoy completo</Btn>
                <Btn onClick={()=>{setTimeFrom("00:00");setTimeTo("16:00");}}>🌅 Mañana</Btn>
                <Btn onClick={()=>{setTimeFrom("16:00");setTimeTo("23:59");}}>🌆 Tarde</Btn>
              </div>
            </div>

            {filtered&&filtered.length===0 && (
              <div style={{textAlign:"center",padding:50,color:C.textMuted,background:C.surface,borderRadius:14,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:26,marginBottom:8}}>🔍</div>Sin ventas en el período seleccionado
              </div>
            )}

            {metrics&&filtered.length>0 && (
              <>
                <div style={{background:`linear-gradient(135deg,${C.surface} 0%,#1a2240 100%)`,borderRadius:14,border:`1px solid ${C.border}`,padding:"22px 18px",marginBottom:14}}>
                  <div style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:2,marginBottom:6}}>Venta Total</div>
                  <div style={{fontSize:"clamp(28px,8vw,48px)",fontWeight:700,color:C.accent,letterSpacing:"-1px",lineHeight:1.1,fontFamily:"'DM Mono',monospace"}}>{ars(metrics.totalVentas)}</div>
                  <div style={{display:"flex",gap:20,marginTop:14,flexWrap:"wrap"}}>
                    <MiniStat label="Operaciones" value={metrics.cantOps.toLocaleString("es-AR")} color={C.blue}/>
                    <MiniStat label="Ticket prom." value={ars(metrics.ticketProm)} color={C.green}/>
                    <MiniStat label="Unidades" value={metrics.totalUnidades.toLocaleString("es-AR")} color={C.purple}/>
                  </div>
                </div>

                <Card title={metrics.singleDay?"Ventas por hora":"Ventas por día"}>
                  {metrics.timeData.length===0?<NoData/>:(
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={metrics.timeData} barSize={metrics.timeData.length>14?10:18}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                        <XAxis dataKey="label" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={arsShort}/>
                        <Tooltip contentStyle={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8}} labelStyle={{color:C.text,fontWeight:700}} formatter={v=>[ars(v),"Ventas"]}/>
                        <Bar dataKey="ventas" fill={C.accent} radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                {/* ── NUEVO: Histograma de distribución de tickets ── */}
                {filtered.length >= 5 && (
                  <Card title="Distribución de tickets">
                    <HistogramaTickets filtered={filtered} ticketProm={metrics.ticketProm}/>
                  </Card>
                )}

                <Card title="Ventas por cajero">
                  {metrics.empData.length===0?<NoData/>:(
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={metrics.empData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} innerRadius={36} paddingAngle={2} labelLine={false} label={PieLabel}>
                          {metrics.empData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>[ars(v),"Ventas"]}/>
                        <Legend formatter={v=><span style={{color:C.text,fontSize:12}}>{v}</span>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Ventas por rubro">
                  {metrics.catData.length===0?<NoData/>:(
                    <ResponsiveContainer width="100%" height={Math.max(220,metrics.catData.length*30+40)}>
                      <BarChart data={metrics.catData} layout="vertical" barSize={15} margin={{right:60}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                        <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={arsShort}/>
                        <YAxis type="category" dataKey="name" tick={{fill:C.textMuted,fontSize:11}} axisLine={false} tickLine={false} width={108}/>
                        <Tooltip contentStyle={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8}} formatter={v=>[ars(v),"Ventas"]}/>
                        <Bar dataKey="value" radius={[0,4,4,0]} label={<BarLabelRight/>}>
                          {metrics.catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="🎯 Candidatos para 3x2 · frecuentes con ticket bajo">
                  <TopFrecuentesBaratos data={metrics.top5FrecuentesBaratos} mediana={metrics.mediana}/>
                </Card>

                <Card title="Top 5 artículos más vendidos">
                  {!metrics.top5?.length ? <NoData/> : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {metrics.top5.map((p,i)=>{
                        const maxQty = metrics.top5[0].qty;
                        const pct = maxQty > 0 ? (p.qty/maxQty)*100 : 0;
                        return (
                          <div key={i}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                              <div style={{fontSize:12,color:C.text,fontWeight:500,flex:1,marginRight:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                <span style={{color:C.textMuted,marginRight:6,fontSize:11}}>#{i+1}</span>{p.name}
                              </div>
                              <div style={{display:"flex",gap:10,flexShrink:0}}>
                                <span style={{fontSize:13,fontWeight:700,color:C.accent,fontFamily:"'DM Mono',monospace"}}>{Math.round(p.qty).toLocaleString("es-AR")} u.</span>
                                <span style={{fontSize:12,color:C.textMuted,fontFamily:"'DM Mono',monospace"}}>{arsShort(p.total)}</span>
                              </div>
                            </div>
                            <div style={{height:4,borderRadius:2,background:C.border}}>
                              <div style={{height:"100%",borderRadius:2,width:`${pct}%`,background:COLORS[i],transition:"width 0.4s ease"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Resumen 3 meses anteriores */}
                {historico && (
                  <Card title="Resumen meses anteriores">
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {historico.map((m,i)=>(
                        <div key={i} style={{background:C.surfaceAlt,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:m.pico?8:0}}>
                            <div style={{fontSize:14,color:C.textMuted,fontWeight:500}}>{m.nombre}</div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>{ars(m.total)}</div>
                              {m.variacion!=null && (
                                <div style={{display:"flex",alignItems:"center",gap:2,fontSize:11,fontWeight:700,color:m.variacion>=0?C.green:C.red,background:m.variacion>=0?"#3ecf8e18":"#ff6b6b18",padding:"2px 7px",borderRadius:12}}>
                                  <span>{m.variacion>=0?"↑":"↓"}</span>
                                  <span>{Math.abs(m.variacion).toFixed(1)}%</span>
                                </div>
                              )}
                              {m.ipc!=null && (
                                <div style={{display:"flex",alignItems:"center",gap:2,fontSize:11,fontWeight:700,color:C.blue,background:"#4da6ff18",padding:"2px 7px",borderRadius:12}}>
                                  <span>📊</span>
                                  <span>{m.ipc.toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {m.pico && (
                            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.accent,borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:8}}>
                              <span>🏆</span>
                              <span>Mejor día: <strong>día {m.pico.dia}, {m.pico.diaSemana}</strong> — {ars(m.pico.total)}</span>
                            </div>
                          )}
                          <div style={{display:"flex",gap:14,marginTop:8,flexWrap:"wrap",borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                            <MiniStatSm label="Operaciones" value={m.cantOps.toLocaleString("es-AR")} color={C.blue}/>
                            <MiniStatSm label="Ticket prom." value={ars(m.ticketProm)} color={C.green}/>
                            <MiniStatSm label="Unidades" value={m.unidades.toLocaleString("es-AR")} color={C.purple}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        {/* ── PESTAÑA HISTÓRICO ── */}
        {db && tab==="historico" && <TabHistorico db={db}/>}
      </div>
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Lbl({children}){return <div style={{fontSize:11,color:"#7880a0",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{children}</div>;}
function Btn({onClick,children}){return <button onClick={onClick} style={{background:"#1e2335",border:"1px solid #2a3050",color:"#eef0f8",borderRadius:8,padding:"7px 13px",fontSize:13}}>{children}</button>;}
function SmallBtn({onClick,children,accent}){return <button onClick={onClick} style={{background:accent?"#e8a83820":"#1e2335",border:`1px solid ${accent?"#e8a838":"#2a3050"}`,color:accent?"#e8a838":"#eef0f8",borderRadius:6,padding:"5px 11px",fontSize:12}}>{children}</button>;}
function MiniStat({label,value,color}){return(<div><div style={{fontSize:11,color:"#7880a0",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{label}</div><div style={{fontSize:19,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{value}</div></div>);}
function MiniStatSm({label,value,color}){return(<div><div style={{fontSize:10,color:"#7880a0",textTransform:"uppercase",letterSpacing:1,marginBottom:1}}>{label}</div><div style={{fontSize:13,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{value}</div></div>);}
function Card({title,children}){return(<div style={{background:"#181c27",borderRadius:14,border:"1px solid #2a3050",padding:"16px 14px",marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:"#7880a0",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>{title}</div>{children}</div>);}
function NoData(){return <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:"#7880a0"}}>Sin datos para el período</div>;}
