/**
 * AVL Tree Visualizer — SVG Renderer (v2)
 * Uses a proper recursive layout (Reingold-Tilford inspired)
 * to guarantee all nodes are visible and correctly spaced.
 */

class Visualizer {
  constructor(svgId, tree) {
    this.svg = document.getElementById(svgId);
    this.tree = tree;
    this.R = 26;            // node radius
    this.LH = 95;           // level height (vertical gap between levels)
    this.MIN_SEP = 20;      // minimum horizontal gap between sibling subtrees

    // Zoom / pan
    this.scale = 1;
    this.tx = 0;
    this.ty = 40;
    this.dragging = false;
    this.dragStart = { x: 0, y: 0 };

    this._setupDefs();
    this._setupZoomPan();
  }

  // ─── SVG Defs (gradients + filters) ──────────────────────────────────────

  _setupDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <radialGradient id="gNormal" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stop-color="#8b5cf6"/>
        <stop offset="100%" stop-color="#4c1d95"/>
      </radialGradient>
      <radialGradient id="gRoot" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#78350f"/>
      </radialGradient>
      <radialGradient id="gImbalanced" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stop-color="#f87171"/>
        <stop offset="100%" stop-color="#7f1d1d"/>
      </radialGradient>
      <radialGradient id="gHighlight" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="100%" stop-color="#064e3b"/>
      </radialGradient>
      <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="rgba(0,0,0,0.6)"/>
      </filter>
      <filter id="glowRed" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    `;
    this.svg.appendChild(defs);

    // Main group for pan/zoom
    this.g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.g.setAttribute('id', 'main-g');
    this.svg.appendChild(this.g);
  }

  // ─── Zoom / Pan ───────────────────────────────────────────────────────────

  _setupZoomPan() {
    const svg = this.svg;
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      this.scale = Math.max(0.2, Math.min(4, this.scale * factor));
      this._applyTransform();
    }, { passive: false });

    svg.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.altKey || e.button === 0 && !e.target.closest('.tree-node')) {
        this.dragging = true;
        this.dragStart = { x: e.clientX - this.tx, y: e.clientY - this.ty };
        svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.tx = e.clientX - this.dragStart.x;
      this.ty = e.clientY - this.dragStart.y;
      this._applyTransform();
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
      svg.style.cursor = 'default';
    });
  }

  _applyTransform() {
    this.g.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.scale})`);
  }

  resetView() {
    this.scale = 1; this.tx = 0; this.ty = 40;
    this._applyTransform();
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  // Two-pass layout: 
  //   Pass 1 (_initX): bottom-up, assign x relative to parent (stored as mod)
  //   Pass 2 (_finalizeX): top-down, convert to absolute x by accumulating mods

  _layout(root) {
    if (!root) return;
    this._initPos(root, 0, 0);   // assign depth→y, and relative x
    this._finalizeX(root, 0);    // propagate accumulated offsets → absolute x
  }

  // Assign y from depth, assign initial x using leftmost-position rule.
  // Returns the rightmost x used at each depth (as an array indexed by depth)
  _initPos(node, depth, xOffset) {
    if (!node) return;
    node.y = depth * this.LH + this.R + 10;
    node._mod = 0;   // modifier to add to all descendants

    // Init children first
    this._initPos(node.left,  depth + 1, 0);
    this._initPos(node.right, depth + 1, 0);

    if (!node.left && !node.right) {
      // Leaf — x will be finalized later; set to 0 relative
      node._x = 0;
    } else if (!node.right) {
      node._x = node.left._x;
    } else if (!node.left) {
      node._x = node.right._x;
    } else {
      // Place parent midway between children
      node._x = (node.left._x + node.right._x) / 2;
    }
  }

  // Actually, let's use the simpler approach: assign x by in-order traversal counter
  // This guarantees no overlap and correct ordering.
  _layoutSimple(root) {
    if (!root) return;
    let counter = { val: 0 };
    this._assignDepthSimple(root, 0);
    this._inorderAssignX(root, counter);
  }

  _assignDepthSimple(node, depth) {
    if (!node) return;
    node.y = depth * this.LH + this.R + 10;
    this._assignDepthSimple(node.left,  depth + 1);
    this._assignDepthSimple(node.right, depth + 1);
  }

  _inorderAssignX(node, counter) {
    if (!node) return;
    this._inorderAssignX(node.left, counter);
    node.x = counter.val * (this.R * 2 + this.MIN_SEP);
    counter.val++;
    this._inorderAssignX(node.right, counter);
  }

  _finalizeX(node, modSum) { /* unused */ }

  // ─── FitView ──────────────────────────────────────────────────────────────

  _fitView() {
    if (!this.tree.root) return;

    const nodes = [];
    const collect = (n) => { if (n) { nodes.push(n); collect(n.left); collect(n.right); } };
    collect(this.tree.root);

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const x0 = Math.min(...xs) - this.R * 2.5;
    const x1 = Math.max(...xs) + this.R * 2.5;
    const y0 = Math.min(...ys) - this.R * 2;
    const y1 = Math.max(...ys) + this.R * 4;

    const tW = x1 - x0, tH = y1 - y0;

    // Use parent element's measured dimensions — always valid after layout
    const parent = this.svg.parentElement || this.svg;
    const svgW = Math.max(parent.clientWidth  || parent.offsetWidth  || 0, 300);
    const svgH = Math.max(parent.clientHeight || parent.offsetHeight || 0, 300);
    const pad = 48;

    const sx = (svgW - pad * 2) / Math.max(tW, 1);
    const sy = (svgH - pad * 2) / Math.max(tH, 1);

    // Guard: scale must be positive and reasonable
    this.scale = Math.min(Math.max(sx, 0.05), Math.min(sy, 2.8));

    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    this.tx = svgW / 2 - cx * this.scale;
    this.ty = svgH / 2 - cy * this.scale;
    this._applyTransform();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render(highlightValue = null) {
    // Wipe the group
    while (this.g.firstChild) this.g.removeChild(this.g.firstChild);
    // Wipe any stale text on svg itself
    [...this.svg.children].forEach(c => {
      if (c !== this.g) this.svg.removeChild(c);
    });

    if (!this.tree.root) {
      this._renderEmpty();
      return;
    }

    // Layout (in-order x assignment — guaranteed no overlap)
    this._layoutSimple(this.tree.root);

    // Edges first (rendered below nodes)
    this._drawEdgesOf(this.tree.root);

    // Nodes
    this._drawNodesOf(this.tree.root, highlightValue);

    // Fit to view — deferred to next frame so SVG has painted dimensions
    requestAnimationFrame(() => this._fitView());
  }

  _renderEmpty() {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', '50%');
    t.setAttribute('y', '50%');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', 'rgba(139,92,246,0.6)');
    t.setAttribute('font-size', '17');
    t.setAttribute('font-family', 'Inter, sans-serif');
    t.textContent = '🌱 Empty tree — insert a value to begin';
    this.svg.appendChild(t);
  }

  // ─── Draw edges ───────────────────────────────────────────────────────────

  _drawEdgesOf(node) {
    if (!node) return;
    if (node.left)  { this._drawEdgeLine(node, node.left);  this._drawEdgesOf(node.left); }
    if (node.right) { this._drawEdgeLine(node, node.right); this._drawEdgesOf(node.right); }
  }

  _drawEdgeLine(parent, child) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', parent.x); line.setAttribute('y1', parent.y);
    line.setAttribute('x2', child.x);  line.setAttribute('y2', child.y);
    line.setAttribute('stroke', 'rgba(139,92,246,0.45)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.classList.add('tree-edge');
    this.g.appendChild(line);
  }

  // ─── Draw nodes ───────────────────────────────────────────────────────────

  _drawNodesOf(node, highlightValue) {
    if (!node) return;
    this._drawOneNode(node, highlightValue);
    this._drawNodesOf(node.left,  highlightValue);
    this._drawNodesOf(node.right, highlightValue);
  }

  _drawOneNode(node, highlightValue) {
    const bf         = this.tree.getBF(node);
    const isRoot     = node === this.tree.root;
    const isImbal    = Math.abs(bf) > 1;
    const isHilite   = node.data === highlightValue;

    const R = this.R;
    const gn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gn.setAttribute('class', 'tree-node');
    gn.setAttribute('transform', `translate(${node.x},${node.y})`);

    // Pulse ring (imbalanced or highlighted)
    if (isImbal || isHilite) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('r', R + 8);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', isHilite ? '#34d399' : '#f87171');
      ring.setAttribute('stroke-width', '2');
      ring.setAttribute('class', 'pulse-ring');
      gn.appendChild(ring);
    }

    // Main circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', R);
    circle.setAttribute('filter', 'url(#nodeShadow)');
    const fill = isHilite ? 'url(#gHighlight)'
               : isImbal  ? 'url(#gImbalanced)'
               : isRoot   ? 'url(#gRoot)'
               :             'url(#gNormal)';
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    circle.setAttribute('stroke-width', '1.5');
    gn.appendChild(circle);

    // Value label
    const fontSize = String(node.data).length > 2 ? 12 : 15;
    const vLabel = this._mkText(String(node.data), 0, 0, 'white', fontSize, '700');
    gn.appendChild(vLabel);

    // BF badge (top-right, green/yellow/red)
    const bfColor = isImbal ? '#ef4444' : bf === 0 ? '#10b981' : '#f59e0b';
    const bfStr   = bf >= 0 ? `+${bf}` : String(bf);
    gn.appendChild(this._badge(R - 2, -(R - 2), bfStr, bfColor, '#fff'));

    // Height badge (top-left, dark)
    gn.appendChild(this._badge(-(R - 2), -(R - 2), `h${node.h}`, '#1e1b4b', '#a5b4fc'));

    // Root star label
    if (isRoot) {
      const star = this._mkText('★ root', 0, R + 16, '#fbbf24', 10, '600');
      gn.appendChild(star);
    }

    // Tooltip on hover
    gn.addEventListener('mouseenter', (e) => this._showTip(node, e));
    gn.addEventListener('mouseleave', ()  => this._hideTip());

    this.g.appendChild(gn);
  }

  // Helper: make a text element
  _mkText(content, x, y, fill, size, weight = '400') {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', fill);
    t.setAttribute('font-size', size);
    t.setAttribute('font-weight', weight);
    t.setAttribute('font-family', 'Inter, "Fira Code", monospace');
    t.setAttribute('pointer-events', 'none');
    t.textContent = content;
    return t;
  }

  // Helper: circular badge
  _badge(cx, cy, label, bgColor, textColor) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${cx},${cy})`);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '11');
    circle.setAttribute('fill', bgColor);
    circle.setAttribute('stroke', 'rgba(255,255,255,0.3)');
    circle.setAttribute('stroke-width', '1');
    g.appendChild(circle);

    const t = this._mkText(label, 0, 0, textColor, 9, '700');
    g.appendChild(t);
    return g;
  }

  // ─── Tooltip ──────────────────────────────────────────────────────────────

  _showTip(node, e) {
    this._hideTip();
    const bf = this.tree.getBF(node);
    const tip = document.createElement('div');
    tip.id = 'node-tip';
    tip.style.cssText = `
      position:fixed; left:${e.clientX + 14}px; top:${e.clientY - 10}px;
      background:rgba(10,5,30,0.93); border:1px solid #7c3aed;
      border-radius:8px; padding:10px 14px; font-family:'Fira Code',monospace;
      font-size:12px; color:#e2e8f0; line-height:1.8; pointer-events:none;
      z-index:9999; box-shadow:0 4px 20px rgba(0,0,0,0.5);
    `;
    tip.innerHTML = `
      <div style="color:#a78bfa;font-weight:700;margin-bottom:4px">Node ${node.data}</div>
      <div>Height : <span style="color:#fbbf24">${node.h}</span></div>
      <div>BF&nbsp;&nbsp;&nbsp;&nbsp; : <span style="color:${Math.abs(bf)>1?'#f87171':bf===0?'#34d399':'#fde68a'}">${bf>=0?'+'+bf:bf}</span></div>
      <div>Left&nbsp;&nbsp; : <span style="color:#94a3b8">${node.left  ? node.left.data  : '∅'}</span></div>
      <div>Right&nbsp; : <span style="color:#94a3b8">${node.right ? node.right.data : '∅'}</span></div>
    `;
    document.body.appendChild(tip);
  }

  _hideTip() {
    const tip = document.getElementById('node-tip');
    if (tip) tip.remove();
  }
}
