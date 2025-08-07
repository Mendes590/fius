/* ========= Galáxia Tributária – filtros que “voam” (nada some) ========= */
(async function () {

    /* ---------- Carrega dados ---------- */
    const data = await d3.json('produtos.json');
  
    /* ---------- Referências de UI ---------- */
    const $        = s => document.querySelector(s);
    const macroSel = $('#macro-filter');
    const microSel = $('#micro-filter');
    const searchIn = $('#search-input');
  
    /* ---------- Prepara área do universo ---------- */
    const headerH  = document.querySelector('header').offsetHeight;
    $('#universe').style.top = headerH + 'px';
  
    const width  = window.innerWidth;
    const height = window.innerHeight - headerH;
    const center = { x: width / 2, y: height / 2 };
  
    /* ---------- SVG/grupos ---------- */
    const svg = d3.select('#universe')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('position', 'absolute')
      .style('top', 0);
  
    const sectorG = svg.append('g');
    const planetG = svg.append('g');
  
    /* ---------- Escalas & layout ---------- */
    const planetScale = d3.scaleLinear()
      .domain([1, d3.max(data, d => d.products.length)])
      .range([32, 70]);
  
    data.forEach(sec => {
      sec.r          = 160 + sec.products.length * 30;
      sec.maxPlanetR = planetScale(sec.products.length);
    });
  
    const maxR  = d3.max(data, d => d.r);
    const ringR = ((maxR * 2) + 60) / (2 * Math.sin(Math.PI / data.length));
  
    /* ---------- Desenha setores ---------- */
    data.forEach((sec, i) => {
      const ang = (i / data.length) * 2 * Math.PI,
            ux  = Math.cos(ang), uy = Math.sin(ang);
  
      sec.cx = center.x + ringR * ux;
      sec.cy = center.y + ringR * uy;
  
      const labelD = sec.r + sec.maxPlanetR + 20;
      const lx = sec.cx + labelD * ux,
            ly = sec.cy + labelD * uy;
  
      sectorG.append('circle')
        .attr('class', 'sector-orbit')
        .attr('cx', sec.cx).attr('cy', sec.cy).attr('r', sec.r);
  
      sectorG.append('text')
        .attr('class', 'sector-label')
        .attr('x', lx).attr('y', ly)
        .text(sec.sector);
    });
  
    /* ---------- Desenha planetas ---------- */
    const planets = [];
    data.forEach(sec => {
      const step = 2 * Math.PI / sec.products.length;
      sec.products.forEach((p, idx) => {
        const ang = idx * step,
              ux  = Math.cos(ang), uy = Math.sin(ang);
  
        Object.assign(p, {
          x:  sec.cx + sec.r * ux,
          y:  sec.cy + sec.r * uy,
          r:  sec.maxPlanetR,
          col: sec.color,
          macro: sec.sector           // guarda macro-setor
        });
        planets.push(p);
      });
    });
  
    planetG.selectAll('circle')
      .data(planets).enter()
      .append('circle')
      .attr('class', 'planet')
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', d => d.col)
      .on('click', showTooltip);
  
    planetG.selectAll('text')
      .data(planets).enter()
      .append('text')
      .attr('class', 'product-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y - d.r - 14)
      .text(d => d.name);
  
    /* ---------- Zoom configurável ---------- */
    const zoom = d3.zoom()
      .scaleExtent([0.4, 4])
      .on('zoom', ({ transform }) => {
        sectorG.attr('transform', transform);
        planetG.attr('transform', transform);
      });
  
    svg.call(zoom);
  
    function flyTo(x, y, targetR, dur = 750) {
      const minDim = Math.min(width, height);
      const k = Math.max(0.4, Math.min(4, (0.45 * minDim) / (targetR + 60)));
  
      svg.transition().duration(dur)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(width / 2 - x * k, height / 2 - y * k)
            .scale(k)
        );
    }
  
    /* ---------- Preenche combos ---------- */
    data.forEach(sec => {
      const o = document.createElement('option');
      o.value = sec.sector; o.textContent = sec.sector;
      macroSel.appendChild(o);
    });
    updateMicro('');
  
    function updateMicro(macro) {
      microSel.innerHTML = '<option value="">Todos os produtos</option>';
  
      let list = macro
        ? data.find(s => s.sector === macro).products.map(p => p.name)
        : planets.map(p => p.name);
  
      [...new Set(list)].sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }))
        .forEach(n => {
          const o = document.createElement('option');
          o.value = n; o.textContent = n;
          microSel.appendChild(o);
        });
    }
  
    /* ---------- Eventos de filtro ---------- */
    macroSel.addEventListener('change', () => {
      updateMicro(macroSel.value);
      navigate();
    });
    microSel.addEventListener('change', navigate);
    searchIn.addEventListener('keydown', e => {
      if (e.key === 'Enter') navigate();
    });
  
    function navigate() {
      const macro = macroSel.value;
      const micro = microSel.value;
      const term  = searchIn.value.trim();
  
      // 1) planeta específico
      if (micro) {
        const p = planets.find(pl => pl.name === micro);
        if (p) flyTo(p.x, p.y, p.r);
        return;
      }
  
      // 2) macro-setor
      if (macro) {
        const s = data.find(sec => sec.sector === macro);
        if (s) flyTo(s.cx, s.cy, s.r + s.maxPlanetR);
        return;
      }
  
      // 3) busca textual
      if (term) {
        const p = planets.find(pl => pl.name.toLowerCase().includes(term.toLowerCase()));
        if (p) flyTo(p.x, p.y, p.r);
        return;
      }
  
      // 4) reset
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
  
    /* ---------- Tooltip ---------- */
    const tooltip = $('#tooltip');
    const tTitle  = $('#tt-title');
    const tDesc   = $('#tt-desc');
    const tTags   = $('#tt-tags');
    $('#tt-close').onclick = () => tooltip.classList.add('hidden');
  
    function showTooltip(evt, d) {
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
  
    window.addEventListener('click', e => {
      if (!tooltip.contains(e.target) && !e.target.classList.contains('planet')) {
        tooltip.classList.add('hidden');
      }
    });
  
  })();
  