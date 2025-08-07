/* ========= Galáxia Tributária — fit “um pouco mais perto” + abrir card na busca + zoom no clique ========= */
(async function () {
    /* ---------- Dados ---------- */
    const data = await d3.json('produtos.json');
  
    /* ---------- UI ---------- */
    const $ = s => document.querySelector(s);
    const macroSel = $('#macro-filter');
    const microSel = $('#micro-filter');
    const searchIn = $('#search-input');
  
    /* ---------- Medidas / layout ---------- */
    const headerH = document.querySelector('header').offsetHeight;
    const universeDiv = document.getElementById('universe');
    universeDiv.style.top = headerH + 'px';
  
    let width  = window.innerWidth;
    let height = window.innerHeight - headerH;
    const center = { x: width / 2, y: height / 2 };
    const isMobile =
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      Math.min(window.innerWidth, window.innerHeight) < 820;
  
    /* ---------- SVG ---------- */
    const svg = d3.select('#universe')
      .append('svg')
      .attr('width',  width)
      .attr('height', height)
      .style('position','absolute')
      .style('top',0);
  
    const sectorG = svg.append('g');
    const planetG = svg.append('g');
  
    /* ---------- Escalas ---------- */
    const planetScale = d3.scaleLinear()
      .domain([1, d3.max(data, d => d.products.length)])
      .range([32, 70]);
  
    /* ---------- Órbitas ---------- */
    data.forEach(sec => {
      sec.r = 160 + sec.products.length * 30;
      sec.maxPlanetR = planetScale(sec.products.length);
    });
  
    const sectorsN = data.length;
    const maxR  = d3.max(data, d => d.r);
    const ringR = ((maxR * 2) + 60) / (2 * Math.sin(Math.PI / sectorsN));
  
    /* ---------- Setores ---------- */
    data.forEach((sec, i) => {
      const ang = (i / sectorsN) * 2 * Math.PI;
      const ux = Math.cos(ang), uy = Math.sin(ang);
  
      sec.cx = center.x + ringR * ux;
      sec.cy = center.y + ringR * uy;
  
      const labelDist = sec.r + sec.maxPlanetR + 20;
      const lx = sec.cx + labelDist * ux;
      const ly = sec.cy + labelDist * uy;
  
      sectorG.append('circle')
        .attr('class','sector-orbit')
        .attr('cx', sec.cx).attr('cy', sec.cy)
        .attr('r', sec.r);
  
      sectorG.append('text')
        .attr('class','sector-label')
        .attr('x', lx).attr('y', ly)
        .text(sec.sector);
    });
  
    /* ---------- Planetas ---------- */
    const planets = [];
    data.forEach(sec => {
      const step = 2 * Math.PI / sec.products.length;
      sec.products.forEach((p, idx) => {
        const ang = idx * step, ux = Math.cos(ang), uy = Math.sin(ang);
        Object.assign(p, {
          x:  sec.cx + sec.r * ux,
          y:  sec.cy + sec.r * uy,
          r:  sec.maxPlanetR,
          col: sec.color,
          macro: sec.sector
        });
        planets.push(p);
      });
    });
  
    // ⬇⬇⬇ AQUI: clique no planeta agora dá zoom e abre o card
    planetG.selectAll('circle')
      .data(planets).enter()
      .append('circle')
      .attr('class','planet')
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('r',  d => d.r)
      .attr('fill', d => d.col)
      .on('click', async (evt, d) => {
        await flyTo(d.x, d.y, d.r, 650);  // aproxima
        openTooltipAtWorld(d);            // abre o card na posição correta
      });
  
    planetG.selectAll('text')
      .data(planets).enter()
      .append('text')
      .attr('class','product-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y - d.r - 14)
      .text(d => d.name);
  
    /* ---------- Universo (extents) ---------- */
    const outerRad = d3.max(data, s => ringR + s.r + s.maxPlanetR + 60);
    const worldW = outerRad * 2;
    const worldH = outerRad * 2;
  
    /* ---------- ZOOM (fit + margens) ---------- */
    function computeFitK() {
      return Math.min(width / worldW, height / worldH);
    }
  
    let fitK  = computeFitK();
    let initK = fitK * (isMobile ? 0.80 : 0.90);
    let minK  = Math.max(fitK * (isMobile ? 0.60 : 0.50), 0.001);
    const maxK = 12;
  
    const zoom = d3.zoom()
      .scaleExtent([minK, maxK])
      .on('zoom', ({transform})=>{
        sectorG.attr('transform', transform);
        planetG.attr('transform', transform);
      });
  
    svg.call(zoom);
  
    // home (inicial)
    let homeT = d3.zoomIdentity
      .translate(width/2 - center.x * initK, height/2 - center.y * initK)
      .scale(initK);
  
    svg.call(zoom.transform, homeT);
  
    // voar até um ponto (usado em clique e filtros)
    function flyTo(x, y, targetR, dur = 750){
      const minDim = Math.min(width, height);
      const k = Math.max(minK, Math.min(maxK, (0.45 * minDim) / (targetR + 60)));
      const tr = d3.zoomIdentity
        .translate(width/2 - x * k, height/2 - y * k)
        .scale(k);
  
      return new Promise(res=>{
        svg.transition().duration(dur).call(zoom.transform, tr).on('end', res);
      });
    }
  
    // abrir tooltip calculando as coords de tela
    function openTooltipAtWorld(d){
      const t = d3.zoomTransform(svg.node());
      const sx = d.x * t.k + t.x;
      const sy = d.y * t.k + t.y;
      showTooltip({ pageX: sx, pageY: sy + headerH }, d);
    }
  
    /* ---------- Filtros ---------- */
    data.forEach(sec=>{
      const o = document.createElement('option');
      o.value = sec.sector; o.textContent = sec.sector;
      macroSel.appendChild(o);
    });
  
    function updateMicro(macro){
      microSel.innerHTML = '<option value="">Todos os produtos</option>';
      const list = macro
        ? (data.find(s=>s.sector===macro)?.products.map(p=>p.name) || [])
        : planets.map(p=>p.name);
  
      [...new Set(list)]
        .sort((a,b)=>a.localeCompare(b,'pt',{sensitivity:'base'}))
        .forEach(n=>{
          const o = document.createElement('option');
          o.value = o.textContent = n;
          microSel.appendChild(o);
        });
    }
    updateMicro('');
  
    macroSel.addEventListener('change', async ()=>{
      updateMicro(macroSel.value);
      await navigate();
    });
    microSel.addEventListener('change', ()=>navigate());
    searchIn.addEventListener('keydown', e=>{
      if(e.key === 'Enter') navigate(true);   // abre card também
    });
  
    async function navigate(openCard=false){
      const macro = macroSel.value;
      const micro = microSel.value;
      const term  = searchIn.value.trim().toLowerCase();
  
      if (micro){
        const p = planets.find(pl => pl.name === micro);
        if (p){ await flyTo(p.x, p.y, p.r); openTooltipAtWorld(p); }
        return;
      }
      if (macro){
        const s = data.find(sec => sec.sector === macro);
        if (s){ await flyTo(s.cx, s.cy, s.r + s.maxPlanetR); }
        return;
      }
      if (term){
        const p = planets.find(pl => pl.name.toLowerCase().includes(term));
        if (p){
          await flyTo(p.x, p.y, p.r);
          if (openCard) openTooltipAtWorld(p);
        }
        return;
      }
      // reset → volta pro home
      svg.transition().duration(700).call(zoom.transform, homeT);
    }
  
    /* ---------- Tooltip ---------- */
    const tooltip = $('#tooltip');
    const tTitle  = $('#tt-title');
    const tDesc   = $('#tt-desc');
    const tTags   = $('#tt-tags');
    $('#tt-close').onclick = ()=> tooltip.classList.add('hidden');
  
    function showTooltip(evt, d){
      tTitle.textContent = d.name;
      tDesc.textContent  = d.description;
      tTags.innerHTML = `
        <span class="tag recurrence">${d.recurrence} Recorrência</span>
        <span class="tag complexity">${d.complexity} Complexidade</span>
      `;
      tooltip.style.setProperty('--accent', d.col);
      tooltip.style.left = (evt.pageX + 12) + 'px';
      tooltip.style.top  = (evt.pageY - 12) + 'px';
      tooltip.classList.remove('hidden');
    }
  
    window.addEventListener('click', e=>{
      if(!tooltip.contains(e.target) && !e.target.classList.contains('planet')){
        tooltip.classList.add('hidden');
      }
    });
  
    /* ---------- Resize: recalcula fit/min/home ---------- */
    window.addEventListener('resize', ()=>{
      const newH = document.querySelector('header').offsetHeight;
      universeDiv.style.top = newH + 'px';
      width  = window.innerWidth;
      height = window.innerHeight - newH;
  
      svg.attr('width', width).attr('height', height);
  
      fitK  = computeFitK();
      initK = fitK * (isMobile ? 0.80 : 0.90);
      minK  = Math.max(fitK * (isMobile ? 0.60 : 0.50), 0.001);
  
      zoom.scaleExtent([minK, maxK]);
  
      homeT = d3.zoomIdentity
        .translate(width/2 - center.x * initK, height/2 - center.y * initK)
        .scale(initK);
  
      const cur = d3.zoomTransform(svg.node());
      if (cur.k <= minK + 1e-6){
        svg.call(zoom.transform, homeT);
      }
    });
  })();
  