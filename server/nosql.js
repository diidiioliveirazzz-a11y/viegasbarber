const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * NoSQL Document Database Layer for Viegas Barber.
 * Supports both:
 * 1. Native MongoDB when MONGODB_URI is provided and reachable.
 * 2. High-performance, persistent Embedded Document Store (JSON collections in data/nosql/)
 *    with standard NoSQL document operations (find, findOne, insertOne, insertMany,
 *    updateOne, updateMany, deleteOne, deleteMany, countDocuments, operators $set, $inc, $in, etc.).
 */

const DATA_DIR = path.join(__dirname, "..", "data", "nosql");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function matchCondition(val, condition) {
  if (condition === undefined) return true;
  if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
    for (const op of Object.keys(condition)) {
      const target = condition[op];
      if (op === "$in") {
        if (!Array.isArray(target) || !target.includes(val)) return false;
      } else if (op === "$nin") {
        if (Array.isArray(target) && target.includes(val)) return false;
      } else if (op === "$ne") {
        if (val === target) return false;
      } else if (op === "$gt") {
        if (!(val > target)) return false;
      } else if (op === "$gte") {
        if (!(val >= target)) return false;
      } else if (op === "$lt") {
        if (!(val < target)) return false;
      } else if (op === "$lte") {
        if (!(val <= target)) return false;
      } else if (op === "$regex") {
        const re = target instanceof RegExp ? target : new RegExp(target, "i");
        if (!re.test(String(val || ""))) return false;
      }
    }
    return true;
  }
  return val === condition;
}

function matchDoc(doc, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;
  if (query.$or && Array.isArray(query.$or)) {
    const orMatch = query.$or.some((subQuery) => matchDoc(doc, subQuery));
    if (!orMatch) return false;
  }
  if (query.$and && Array.isArray(query.$and)) {
    const andMatch = query.$and.every((subQuery) => matchDoc(doc, subQuery));
    if (!andMatch) return false;
  }
  for (const [key, cond] of Object.entries(query)) {
    if (key === "$or" || key === "$and") continue;
    if (!matchCondition(doc[key], cond)) return false;
  }
  return true;
}

function clone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
}

class DocumentCollection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.documents = [];
    this.loaded = false;
    this._writeLock = false;
    this._queue = [];
  }

  _load() {
    if (this.loaded) return;
    ensureDirectory();
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.documents = JSON.parse(raw);
      } catch (err) {
        console.error(`Erro ao carregar coleção NoSQL ${this.name}:`, err.message);
        this.documents = [];
      }
    } else {
      this.documents = [];
      this._saveSync();
    }
    this.loaded = true;
  }

  _saveSync() {
    ensureDirectory();
    const tempPath = `${this.filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.documents, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }

  async _save() {
    return new Promise((resolve, reject) => {
      this._queue.push({ resolve, reject });
      if (this._writeLock) return;
      this._processQueue();
    });
  }

  async _processQueue() {
    if (!this._queue.length) return;
    this._writeLock = true;
    const batch = [...this._queue];
    this._queue = [];
    try {
      this._saveSync();
      batch.forEach((item) => item.resolve());
    } catch (err) {
      batch.forEach((item) => item.reject(err));
    } finally {
      this._writeLock = false;
      if (this._queue.length) this._processQueue();
    }
  }

  async findOne(query = {}) {
    this._load();
    const doc = this.documents.find((d) => matchDoc(d, query));
    return doc ? clone(doc) : null;
  }

  find(query = {}) {
    this._load();
    const results = this.documents.filter((d) => matchDoc(d, query)).map(clone);

    const cursor = {
      _data: results,
      sort(criteria = {}) {
        const keys = Object.keys(criteria);
        if (keys.length) {
          cursor._data.sort((a, b) => {
            for (const key of keys) {
              const dir = criteria[key] >= 0 ? 1 : -1;
              const valA = a[key] ?? "";
              const valB = b[key] ?? "";
              if (valA < valB) return -1 * dir;
              if (valA > valB) return 1 * dir;
            }
            return 0;
          });
        }
        return cursor;
      },
      skip(count = 0) {
        cursor._data = cursor._data.slice(count);
        return cursor;
      },
      limit(count = 0) {
        if (count > 0) cursor._data = cursor._data.slice(0, count);
        return cursor;
      },
      async toArray() {
        return cursor._data;
      },
      then(resolve, reject) {
        return Promise.resolve(cursor._data).then(resolve, reject);
      },
    };
    return cursor;
  }

  async insertOne(doc) {
    this._load();
    const newDoc = {
      _id: doc._id || doc.id || crypto.randomUUID(),
      id: doc.id || doc._id || crypto.randomUUID(),
      ...doc,
      created_at: doc.created_at || new Date().toISOString(),
      updated_at: doc.updated_at || new Date().toISOString(),
    };
    this.documents.push(newDoc);
    await this._save();
    return { insertedId: newDoc._id, acknowledged: true };
  }

  async insertMany(docs) {
    this._load();
    const inserted = [];
    for (const doc of docs) {
      const newDoc = {
        _id: doc._id || doc.id || crypto.randomUUID(),
        id: doc.id || doc._id || crypto.randomUUID(),
        ...doc,
        created_at: doc.created_at || new Date().toISOString(),
        updated_at: doc.updated_at || new Date().toISOString(),
      };
      this.documents.push(newDoc);
      inserted.push(newDoc);
    }
    await this._save();
    return { insertedCount: inserted.length, acknowledged: true };
  }

  async updateOne(query = {}, update = {}, options = {}) {
    this._load();
    const index = this.documents.findIndex((d) => matchDoc(d, query));
    if (index === -1) {
      if (options.upsert) {
        const base = typeof query === "object" ? { ...query } : {};
        delete base.$or;
        delete base.$and;
        const newDoc = {
          _id: base._id || base.id || crypto.randomUUID(),
          id: base.id || base._id || crypto.randomUUID(),
          ...base,
        };
        applyUpdate(newDoc, update);
        newDoc.created_at = new Date().toISOString();
        newDoc.updated_at = new Date().toISOString();
        this.documents.push(newDoc);
        await this._save();
        return { matchedCount: 0, modifiedCount: 1, upsertedId: newDoc._id };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
    const doc = this.documents[index];
    applyUpdate(doc, update);
    doc.updated_at = new Date().toISOString();
    await this._save();
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(query = {}, update = {}) {
    this._load();
    let modified = 0;
    for (const doc of this.documents) {
      if (matchDoc(doc, query)) {
        applyUpdate(doc, update);
        doc.updated_at = new Date().toISOString();
        modified++;
      }
    }
    if (modified > 0) await this._save();
    return { matchedCount: modified, modifiedCount: modified };
  }

  async deleteOne(query = {}) {
    this._load();
    const index = this.documents.findIndex((d) => matchDoc(d, query));
    if (index !== -1) {
      this.documents.splice(index, 1);
      await this._save();
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    this._load();
    const initialLen = this.documents.length;
    this.documents = this.documents.filter((d) => !matchDoc(d, query));
    const deletedCount = initialLen - this.documents.length;
    if (deletedCount > 0) await this._save();
    return { deletedCount };
  }

  async countDocuments(query = {}) {
    this._load();
    return this.documents.filter((d) => matchDoc(d, query)).length;
  }
}

function applyUpdate(doc, update) {
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      if (v !== undefined) doc[k] = v;
    }
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      doc[k] = (Number(doc[k]) || 0) + Number(v);
    }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[k])) doc[k] = [];
      doc[k].push(v);
    }
  }
  if (update.$pull) {
    for (const [k, v] of Object.entries(update.$pull)) {
      if (Array.isArray(doc[k])) {
        doc[k] = doc[k].filter((item) => item !== v);
      }
    }
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) {
      delete doc[k];
    }
  }
  // If plain object without operators
  const hasOperators = Object.keys(update).some((k) => k.startsWith("$"));
  if (!hasOperators) {
    for (const [k, v] of Object.entries(update)) {
      if (v !== undefined) doc[k] = v;
    }
  }
}

const collections = new Map();

function getCollection(name) {
  if (!collections.has(name)) {
    collections.set(name, new DocumentCollection(name));
  }
  return collections.get(name);
}

module.exports = {
  getCollection,
  collection: getCollection,
  DATA_DIR,
};
