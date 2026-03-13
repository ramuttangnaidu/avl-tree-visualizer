/**
 * AVL Tree — Complete Implementation
 * Based on the professor's reference (ideone.com/EMY6gV)
 * Extended with: deletion, all 4 rotations, BF computation, traversals
 */

class AVLNode {
  constructor(data) {
    this.data = data;
    this.h = 1;          // height
    this.left = null;
    this.right = null;
    this.x = 0;          // visual position (set by visualizer)
    this.y = 0;
    this.id = AVLNode._nextId++;
  }
}
AVLNode._nextId = 1;

class AVLTree {
  constructor() {
    this.root = null;
    this.lastRotation = null;   // { type, node, detail }
    this.rotationLog = [];      // full history of rotations
    this.stepLog = [];          // step-by-step messages
  }

  // ─── Height / BF helpers ─────────────────────────────────────────────────

  _h(node) {
    return node ? node.h : 0;
  }

  _updateHeight(node) {
    if (!node) return;
    node.h = 1 + Math.max(this._h(node.left), this._h(node.right));
  }

  getBF(node) {
    if (!node) return 0;
    return this._h(node.left) - this._h(node.right);
  }

  // ─── Rotations ──────────────────────────────────────────────────────────

  _leftRotate(z) {
    const y = z.right;
    const T2 = y.left;

    y.left = z;
    z.right = T2;

    this._updateHeight(z);
    this._updateHeight(y);

    return y;
  }

  _rightRotate(z) {
    const y = z.left;
    const T3 = y.right;

    y.right = z;
    z.left = T3;

    this._updateHeight(z);
    this._updateHeight(y);

    return y;
  }

  // ─── Balance ─────────────────────────────────────────────────────────────

  _balance(node, trigger) {
    this._updateHeight(node);
    const bf = this.getBF(node);

    // LL — Left-Left
    if (bf === 2 && this.getBF(node.left) >= 0) {
      this._log(`⚖️ Imbalance at ${node.data} (BF=+2) → LL Case: Right Rotation`, 'rotation');
      this.lastRotation = { type: 'LL', node: node.data };
      this.rotationLog.unshift({ type: 'LL', node: node.data, trigger });
      return this._rightRotate(node);
    }

    // LR — Left-Right
    if (bf === 2 && this.getBF(node.left) < 0) {
      this._log(`⚖️ Imbalance at ${node.data} (BF=+2) → LR Case: Left then Right Rotation`, 'rotation');
      this.lastRotation = { type: 'LR', node: node.data };
      this.rotationLog.unshift({ type: 'LR', node: node.data, trigger });
      node.left = this._leftRotate(node.left);
      return this._rightRotate(node);
    }

    // RR — Right-Right
    if (bf === -2 && this.getBF(node.right) <= 0) {
      this._log(`⚖️ Imbalance at ${node.data} (BF=-2) → RR Case: Left Rotation`, 'rotation');
      this.lastRotation = { type: 'RR', node: node.data };
      this.rotationLog.unshift({ type: 'RR', node: node.data, trigger });
      return this._leftRotate(node);
    }

    // RL — Right-Left
    if (bf === -2 && this.getBF(node.right) > 0) {
      this._log(`⚖️ Imbalance at ${node.data} (BF=-2) → RL Case: Right then Left Rotation`, 'rotation');
      this.lastRotation = { type: 'RL', node: node.data };
      this.rotationLog.unshift({ type: 'RL', node: node.data, trigger });
      node.right = this._rightRotate(node.right);
      return this._leftRotate(node);
    }

    return node;
  }

  // ─── Insert ──────────────────────────────────────────────────────────────

  insert(value) {
    if (this.search(value)) {
      this._log(`⚠️ Value ${value} already exists in tree`, 'warning');
      return false;
    }
    this.lastRotation = null;
    this._log(`➕ Inserting ${value}`, 'insert');
    this.root = this._insert(this.root, value);
    if (!this.lastRotation) {
      this._log(`✅ Inserted ${value} — tree balanced, no rotation needed`, 'ok');
    }
    return true;
  }

  _insert(node, value) {
    if (!node) return new AVLNode(value);

    if (value < node.data) {
      this._log(`  ↙ Go left from ${node.data}`, 'trace');
      node.left = this._insert(node.left, value);
    } else {
      this._log(`  ↘ Go right from ${node.data}`, 'trace');
      node.right = this._insert(node.right, value);
    }

    return this._balance(node, value);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  delete(value) {
    if (!this.search(value)) {
      this._log(`⚠️ Value ${value} not found`, 'warning');
      return false;
    }
    this.lastRotation = null;
    this._log(`🗑️ Deleting ${value}`, 'delete');
    this.root = this._delete(this.root, value);
    if (!this.lastRotation) {
      this._log(`✅ Deleted ${value} — tree balanced, no rotation needed`, 'ok');
    }
    return true;
  }

  _delete(node, value) {
    if (!node) return null;

    if (value < node.data) {
      node.left = this._delete(node.left, value);
    } else if (value > node.data) {
      node.right = this._delete(node.right, value);
    } else {
      // Node to delete found
      if (!node.left || !node.right) {
        node = node.left || node.right;
      } else {
        // Node has two children — find inorder successor
        let successor = node.right;
        while (successor.left) successor = successor.left;
        this._log(`  📌 Successor of ${value} is ${successor.data}`, 'trace');
        node.data = successor.data;
        node.right = this._delete(node.right, successor.data);
      }
    }

    if (!node) return null;
    return this._balance(node, value);
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  search(value) {
    let cur = this.root;
    while (cur) {
      if (value === cur.data) return cur;
      cur = value < cur.data ? cur.left : cur.right;
    }
    return null;
  }

  // ─── Traversals ──────────────────────────────────────────────────────────

  inorder(node = this.root, result = []) {
    if (!node) return result;
    this.inorder(node.left, result);
    result.push(node.data);
    this.inorder(node.right, result);
    return result;
  }

  preorder(node = this.root, result = []) {
    if (!node) return result;
    result.push(node.data);
    this.preorder(node.left, result);
    this.preorder(node.right, result);
    return result;
  }

  postorder(node = this.root, result = []) {
    if (!node) return result;
    this.postorder(node.left, result);
    this.postorder(node.right, result);
    result.push(node.data);
    return result;
  }

  levelOrder() {
    if (!this.root) return [];
    const result = [];
    const queue = [this.root];
    while (queue.length) {
      const node = queue.shift();
      result.push(node.data);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    return result;
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  getStats() {
    let nodeCount = 0;
    let leafCount = 0;
    let maxBF = 0;
    let sumBF = 0;

    const traverse = (node) => {
      if (!node) return;
      nodeCount++;
      const bf = Math.abs(this.getBF(node));
      if (bf > maxBF) maxBF = bf;
      sumBF += bf;
      if (!node.left && !node.right) leafCount++;
      traverse(node.left);
      traverse(node.right);
    };

    traverse(this.root);

    return {
      nodeCount,
      leafCount,
      height: this._h(this.root),
      maxBF,
      avgBF: nodeCount ? (sumBF / nodeCount).toFixed(2) : 0,
      isBalanced: maxBF <= 1
    };
  }

  // ─── Logging ─────────────────────────────────────────────────────────────

  _log(msg, type = 'info') {
    this.stepLog.unshift({ msg, type, time: Date.now() });
    if (this.stepLog.length > 60) this.stepLog.pop();
  }

  clearLog() {
    this.stepLog = [];
  }

  // ─── Preset sequences ────────────────────────────────────────────────────

  static presets() {
    return {
      'RR Case (10→20→30)': [10, 20, 30],
      'LL Case (30→20→10)': [30, 20, 10],
      'LR Case (30→10→20)': [30, 10, 20],
      'RL Case (10→30→20)': [10, 30, 20],
      'Balanced (1–7)':     [4, 2, 6, 1, 3, 5, 7],
      'Complex (15 nodes)': [50, 25, 75, 10, 30, 60, 80, 5, 15, 27, 35, 55, 65, 78, 90],
    };
  }
}
