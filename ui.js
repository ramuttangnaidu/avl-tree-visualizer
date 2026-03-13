/**
 * AVL Tree Visualizer — UI Controller
 * Handles all user interactions, stats panel, traversal display, step log
 */

class UI {
  constructor(tree, visualizer) {
    this.tree = tree;
    this.viz = visualizer;
    this.lastHighlight = null;
    this.traversalAnimTimeout = null;

    this._bindControls();
    this._bindPresets();
    this._updateStats();
    this._renderTraversals();
    this.viz.render();
  }

  // ─── Control Binding ─────────────────────────────────────────────────────

  _bindControls() {
    // Insert
    document.getElementById('btn-insert').addEventListener('click', () => this._doInsert());
    document.getElementById('input-value').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._doInsert();
    });

    // Delete
    document.getElementById('btn-delete').addEventListener('click', () => this._doDelete());

    // Search
    document.getElementById('btn-search').addEventListener('click', () => this._doSearch());

    // Reset
    document.getElementById('btn-reset').addEventListener('click', () => {
      this.tree.root = null;
      this.tree.rotationLog = [];
      this.tree.stepLog = [];
      AVLNode._nextId = 1;
      this.viz.resetView();
      this._refresh();
    });

    // Reset view
    document.getElementById('btn-fit').addEventListener('click', () => {
      this.viz.fitView();
    });

    // Traversal buttons
    ['inorder', 'preorder', 'postorder', 'levelorder'].forEach(name => {
      document.getElementById(`btn-${name}`)?.addEventListener('click', () => {
        this._animateTraversal(name);
      });
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab)?.classList.add('active');
      });
    });
  }

  _bindPresets() {
    const presets = AVLTree.presets();
    const container = document.getElementById('presets-container');
    Object.entries(presets).forEach(([label, values]) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => this._loadPreset(label, values));
      container.appendChild(btn);
    });
  }

  _loadPreset(label, values) {
    // Reset tree
    this.tree.root = null;
    this.tree.rotationLog = [];
    this.tree.stepLog = [];
    AVLNode._nextId = 1;
    this.tree._log(`📦 Preset: "${label}"`, 'info');

    // Insert one by one with small delay for animation feel
    let i = 0;
    const step = () => {
      if (i < values.length) {
        this.tree.insert(values[i++]);
        this._refresh();
        setTimeout(step, 200);
      }
    };
    step();
  }

  // ─── Operations ──────────────────────────────────────────────────────────

  _doInsert() {
    const input = document.getElementById('input-value');
    const val = parseInt(input.value.trim());
    input.value = '';
    input.focus();

    if (isNaN(val)) {
      this._shake(input);
      return;
    }

    this.tree.insert(val);
    this.lastHighlight = val;
    this._refresh();

    // Clear highlight after 1.5s
    setTimeout(() => {
      this.lastHighlight = null;
      this.viz.render(null);
    }, 1500);
  }

  _doDelete() {
    const input = document.getElementById('input-value');
    const val = parseInt(input.value.trim());
    input.value = '';
    input.focus();

    if (isNaN(val)) {
      this._shake(input);
      return;
    }

    this.tree.delete(val);
    this._refresh();
  }

  _doSearch() {
    const input = document.getElementById('input-value');
    const val = parseInt(input.value.trim());

    if (isNaN(val)) {
      this._shake(input);
      return;
    }

    const found = this.tree.search(val);
    if (found) {
      this.tree._log(`🔍 Found ${val} at height ${found.h}`, 'ok');
      this.lastHighlight = val;
      this._refresh();
      setTimeout(() => {
        this.lastHighlight = null;
        this.viz.render(null);
      }, 2000);
    } else {
      this.tree._log(`🔍 Value ${val} not found`, 'warning');
      this._refresh();
    }
  }

  _shake(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
  }

  // ─── Traversal Animation ─────────────────────────────────────────────────

  _animateTraversal(type) {
    if (this.traversalAnimTimeout) clearTimeout(this.traversalAnimTimeout);

    let result;
    switch (type) {
      case 'inorder':   result = this.tree.inorder();   break;
      case 'preorder':  result = this.tree.preorder();  break;
      case 'postorder': result = this.tree.postorder(); break;
      case 'levelorder': result = this.tree.levelOrder(); break;
    }

    this.tree._log(`📊 ${type.charAt(0).toUpperCase() + type.slice(1)}: [${result.join(', ')}]`, 'traversal');
    this._updateStepLog();

    // Flash nodes one by one
    let i = 0;
    const next = () => {
      if (i < result.length) {
        this.viz.render(result[i]);
        document.getElementById(`btn-${type}`).textContent =
          `${i + 1}/${result.length}: ${result[i]}`;
        i++;
        this.traversalAnimTimeout = setTimeout(next, 500);
      } else {
        this.viz.render(null);
        const names = { inorder: 'In-order', preorder: 'Pre-order', postorder: 'Post-order', levelorder: 'Level-order' };
        document.getElementById(`btn-${type}`).textContent = names[type];
      }
    };
    next();

    // Show result in traversal display
    this._renderTraversals();
  }

  // ─── Panel Updates ───────────────────────────────────────────────────────

  _refresh() {
    this.viz.render(this.lastHighlight);
    this._updateStats();
    this._updateStepLog();
    this._renderTraversals();
    this._updateRotationBadge();
  }

  _updateStats() {
    const s = this.tree.getStats();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('stat-nodes', s.nodeCount);
    set('stat-height', s.height);
    set('stat-leaves', s.leafCount);
    set('stat-maxbf', s.maxBF);
    set('stat-avgbf', s.avgBF);
    set('stat-balanced', s.isBalanced ? '✅ Yes' : '❌ No');

    // Update branching factor meter
    const meter = document.getElementById('bf-meter');
    if (meter) {
      const pct = Math.min(s.maxBF / 2 * 100, 100);
      meter.style.width = pct + '%';
      meter.style.background = s.maxBF === 0 ? '#10b981' : s.maxBF === 1 ? '#f59e0b' : '#ef4444';
    }
  }

  _updateStepLog() {
    const log = document.getElementById('step-log');
    if (!log) return;

    const typeIcons = {
      insert: '➕', delete: '🗑️', rotation: '🔄', ok: '✅',
      warning: '⚠️', trace: '  ', info: 'ℹ️', traversal: '📊'
    };
    const typeColors = {
      insert: '#a5f3fc', delete: '#fca5a5', rotation: '#fde68a',
      ok: '#86efac', warning: '#fdba74', trace: '#94a3b8',
      info: '#c4b5fd', traversal: '#67e8f9'
    };

    log.innerHTML = this.tree.stepLog
      .map(entry => {
        const icon = typeIcons[entry.type] || '';
        const color = typeColors[entry.type] || '#e2e8f0';
        return `<div class="log-entry" style="color:${color}">
          <span class="log-icon">${icon}</span>
          <span>${entry.msg}</span>
        </div>`;
      })
      .join('');
  }

  _renderTraversals() {
    if (!this.tree.root) {
      ['trav-inorder','trav-preorder','trav-postorder','trav-levelorder'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
      return;
    }

    const fmt = arr => arr.length ? arr.join(' → ') : '—';
    const set = (id, arr) => {
      const el = document.getElementById(id);
      if (el) el.textContent = fmt(arr);
    };

    set('trav-inorder',    this.tree.inorder());
    set('trav-preorder',   this.tree.preorder());
    set('trav-postorder',  this.tree.postorder());
    set('trav-levelorder', this.tree.levelOrder());
  }

  _updateRotationBadge() {
    const badge = document.getElementById('rotation-badge');
    if (!badge) return;

    const rotLog = this.tree.rotationLog;
    if (rotLog.length === 0) {
      badge.textContent = 'No rotations yet';
      badge.className = 'rotation-badge empty';
      return;
    }

    const last = rotLog[0];
    const icons = { LL: '↻ LL', LR: '↺↻ LR', RR: '↺ RR', RL: '↻↺ RL' };
    const classes = { LL: 'll', LR: 'lr', RR: 'rr', RL: 'rl' };
    badge.textContent = `${icons[last.type]} at node ${last.node}`;
    badge.className = `rotation-badge ${classes[last.type]}`;

    // Rotation history
    const hist = document.getElementById('rotation-history');
    if (hist) {
      hist.innerHTML = rotLog.slice(0, 10).map(r =>
        `<span class="rot-chip rot-${r.type.toLowerCase()}">${r.type}</span>`
      ).join('');
    }
  }
}
